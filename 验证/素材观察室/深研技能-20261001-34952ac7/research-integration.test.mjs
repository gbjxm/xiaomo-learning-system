import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ObservatoryStore, initStore } from '../../../web/observatory/store.mjs';
import { importResearchAttachment } from '../../../web/observatory/research-import.mjs';
import { handoff } from '../../../web/observatory/cli.mjs';
import { createObservatoryHandler } from '../../../web/observatory/http.mjs';
import { hash } from '../../../web/observatory/model.mjs';

const run = path.dirname(fileURLToPath(import.meta.url));
const project = path.resolve(run, '../../..');
const testRoot = path.join(run, `集成核验-${Date.now()}`);
const dataDir = path.join(testRoot, 'data');
await fsp.mkdir(testRoot); // Never replace evidence or an existing library.
const identity = await initStore({ dataDir, scope: 'isolated' });
const store = new ObservatoryStore({ dataDir });
const textPath = path.join(testRoot, '示例.txt');
const imagePath = path.join(testRoot, '演示关键帧.png');
await fsp.writeFile(textPath, '技术演练：不是小陌的素材或研究成果。', 'utf8');
await fsp.copyFile(path.join(project, '验证/素材观察室/阶段3/media-run-2026-10-01T11-15-01-676Z/TEST_FIXTURES/TEST_PURPLE_IMAGE.png'), imagePath);
const request = (filePath, overrides = {}) => ({ identity, submissionId: randomUUID(), filePath, ...overrides });
let imported, materialId, topicId, initialMaterialHash, initialStageHash;
const evidence = [];
const originalFields = material => Object.fromEntries(['materialId', 'revision', 'status', 'title', 'original', 'originalImpression', 'currentImpression', 'impressionHistory', 'notes', 'tags', 'segments', 'attachmentIds', 'source', 'sourceHistory', 'createdAt', 'updatedAt'].map(key => [key, material[key]]));
async function rejectsCode(promise, code) { await assert.rejects(promise, error => error.code === code); }
function record(name, extra = {}) { evidence.push({ name, passed: true, ...extra }); }

test('ordinary local UTF-8 file imports through real upload, receipt and byte checks', async () => {
  imported = await importResearchAttachment(store, request(textPath));
  assert.equal(imported.verification.persistedSubmission, true);
  assert.equal(imported.verification.snapshotVerified, true);
  assert.equal(imported.attachment.sha256, hash(await fsp.readFile(textPath)));
  assert.deepEqual(imported.receipt.snapshot, imported.attachment);
  assert.equal(imported.attachment.permissionStatus, 'unknown');
  assert.match(imported.permissionNotice, /不是/);
  assert.equal((await store.listMaterials()).records.length, 0);
  record('受控导入TXT及字节/登记/收据核对', { attachmentId: imported.attachment.attachmentId });
});

test('same name, same bytes and submission ID retry does not register twice', async () => {
  const payload = request(textPath, { permissionStatus: '示例本地自制；声明不认证授权' });
  const first = await importResearchAttachment(store, payload);
  const again = await importResearchAttachment(store, payload);
  assert.deepEqual(again.receipt, first.receipt);
  assert.equal((await store.listAttachments()).records.filter(a => a.attachmentId === first.attachment.attachmentId).length, 1);
  await fsp.writeFile(textPath, '技术演练：内容变化，必须使用新提交。', 'utf8');
  await rejectsCode(importResearchAttachment(store, payload), 'SUBMISSION_ID_CONFLICT');
  record('同ID重试幂等；异内容拒绝');
});

test('identity is verified before an inaccessible file is read', async () => {
  await rejectsCode(importResearchAttachment(store, request('Z:\\不存在.txt', { identity: { ...identity, storeId: 'wrong' } })), 'STORE_IDENTITY_MISMATCH');
  record('身份错误先拒绝');
});

test('relative, UNC, device, alternate stream and directory paths rejected', async () => {
  for (const filePath of ['relative.txt', '\\\\server\\share\\file.txt', '\\\\?\\C:\\file.txt', 'C:\\file.txt:secret'])
    await rejectsCode(importResearchAttachment(store, request(filePath)), 'INVALID_DATA_PATH');
  const dir = path.join(testRoot, 'directory.txt'); await fsp.mkdir(dir);
  await rejectsCode(importResearchAttachment(store, request(dir)), 'UNSAFE_FILE_PATH');
  record('受限本地文件路径');
});

test('unsupported extension, empty file, excessive size and invalid UTF-8 rejected', async () => {
  const unsupported = path.join(testRoot, '拒绝.exe'); await fsp.writeFile(unsupported, 'x');
  await rejectsCode(importResearchAttachment(store, request(unsupported)), 'UNSUPPORTED_FILE_TYPE');
  const empty = path.join(testRoot, '空.txt'); await fsp.writeFile(empty, '');
  await rejectsCode(importResearchAttachment(store, request(empty)), 'UPLOAD_TOO_LARGE');
  const large = path.join(testRoot, '过大.txt'); const fd = await fsp.open(large, 'wx'); await fd.truncate(5 * 1024 ** 2 + 1); await fd.close();
  await rejectsCode(importResearchAttachment(store, request(large)), 'UPLOAD_TOO_LARGE');
  const invalid = path.join(testRoot, '错误编码.txt'); await fsp.writeFile(invalid, Buffer.from([0xff, 0xfe, 0xff]));
  await rejectsCode(importResearchAttachment(store, request(invalid)), 'INVALID_TEXT_ENCODING');
  record('白名单/上限/格式校验');
});

test('actual CLI JSON import and read-attachment work without an HTTP service', async () => {
  const payload = request(imagePath, { permissionStatus: '自制隔离演示图；不是原作关键帧' });
  const jsonPath = path.join(testRoot, 'import.json'); await fsp.writeFile(jsonPath, '\uFEFF' + JSON.stringify(payload), 'utf8');
  const cli = path.join(project, 'web/observatory/cli.mjs');
  const result = JSON.parse(execFileSync(process.execPath, [cli, 'import-attachment', '--data-dir', dataDir, '--file', jsonPath], { encoding: 'utf8', windowsHide: true }));
  assert.equal(result.ok, true);
  assert.equal(result.data.attachment.mimeType, 'image/png');
  assert.equal(result.data.attachment.sha256, hash(await fsp.readFile(imagePath)));
  const read = JSON.parse(execFileSync(process.execPath, [cli, 'read-attachment', result.data.attachment.attachmentId, '--data-dir', dataDir], { encoding: 'utf8', windowsHide: true }));
  assert.equal(read.data.record.sha256, result.data.receipt.snapshot.sha256);
  imported = result.data;
  record('真实独立CLI导入和原件回读', { attachmentId: imported.attachment.attachmentId });
});

test('stage-only integration retains original material and previous result', async () => {
  const m = await store.createMaterial({ identity, submissionId: randomUUID(), material: { title: '隔离研究技术示例', original: { kind: 'text', text: '原始吸引点保留测试；不是用户原话。' }, originalImpression: '演练的吸引点，不是用户自述。' } });
  materialId = m.receipt.recordId; initialMaterialHash = hash(originalFields(m.receipt.snapshot));
  const t = await store.createTopic({ identity, submissionId: randomUUID(), topic: { title: '技术验收，不作研究质量认证', question: '同一素材能否受控图文回流？', scope: '技术写回合同', materialIds: [materialId] } });
  topicId = t.receipt.recordId;
  const stage = { focus: '隔离技术验收', confirmed: [], candidates: [], parked: [], unknown: ['未验证真实作品专业分析。'], nextStep: '查看真实浏览器图文回流。', limitations: ['本条仅隔离技术演练。'], researchStatus: 'paused', paragraphs: [{ heading: '演示图', markdown: `![演示图，非原作关键帧](attachment:${imported.attachment.attachmentId})`, basisKind: 'demo', attachmentIds: [imported.attachment.attachmentId], sourceRefs: [{ sourceId: 'demo_image', locator: '本地演示PNG完整文件', note: '仅支持示例图显示，不支持任何作品结论。' }] }], sources: [{ sourceId: 'demo_image', kind: 'attachment', attachmentId: imported.attachment.attachmentId, title: '演示图', locator: '全图', verificationScope: '仅本地格式及图文回流验证', licenseStatus: 'self_created_demo' }] };
  const payload = { identity, submissionId: randomUUID(), topicId, expectedRevision: 1, materialVersions: [{ materialId, revision: 1 }], stage };
  const first = await store.submitStage(payload); initialStageHash = hash(first.receipt.snapshot.stages[0]);
  assert.deepEqual((await store.submitStage(payload)).receipt, first.receipt);
  await rejectsCode(store.submitStage({ ...payload, submissionId: randomUUID() }), 'REVISION_CONFLICT');
  const second = await store.submitStage({ ...payload, submissionId: randomUUID(), expectedRevision: 2, stage: { ...stage, focus: '后续阶段', nextStep: '保持唯一下一步。' } });
  assert.equal(second.receipt.snapshot.stages.length, 2);
  assert.equal(hash(second.receipt.snapshot.stages[0]), initialStageHash);
  assert.equal(hash(originalFields((await store.readMaterial(materialId)).record)), initialMaterialHash);
  record('同素材ID追加阶段/旧成果保全/原话保全/阶段幂等/CAS', { materialId, topicId });
});

test('material version conflict rejects whole stage and keeps previous versions', async () => {
  await store.updateMaterial({ identity, submissionId: randomUUID(), materialId, expectedRevision: 1, actor: 'user', patch: { title: '隔离例明确的新素材版本' } });
  const current = (await store.readTopic(topicId)).record;
  await rejectsCode(store.submitStage({ identity, submissionId: randomUUID(), topicId, expectedRevision: current.revision, materialVersions: [{ materialId, revision: 1 }], stage: { focus: '过时素材尝试', nextStep: '不保存冲突', paragraphs: [], sources: [] } }), 'REVISION_CONFLICT');
  assert.equal((await store.readTopic(topicId)).record.revision, current.revision);
  assert.equal(hash((await store.readTopic(topicId)).record.stages[0]), initialStageHash);
  record('素材旧版本拒绝，旧阶段未变');
});

test('handoff retains legacy keys and adds explicit skill protocol without granting research', async () => {
  const topicHandoff = await handoff(store, 'handoff-topic', topicId);
  const materialHandoff = await handoff(store, 'handoff-material', materialId);
  assert.equal(topicHandoff.submissionTemplate.expectedRevision, 3);
  assert.equal(topicHandoff.researchProtocol.userStartRequired, true);
  assert.equal(topicHandoff.researchProtocol.protocolVersion, 1);
  assert.equal(materialHandoff.submissionTemplate, null);
  assert.equal(topicHandoff.attachmentReadCommands.length, 1);
  assert.match(topicHandoff.text, /不是研究授权/);
  assert.match(topicHandoff.text, /\$orchestrate-material-research/);
  assert.match(topicHandoff.text, /research-traditional-sources/);
  assert.match(topicHandoff.text, /analyze-audiovisual-material/);
  assert.match(topicHandoff.text, /每次只问一个/);
  assert.match(topicHandoff.text, /停止条件/);
  assert.match(topicHandoff.text, /import-attachment/);
  record('兼容交接字段+明确启动/技能/范围/深度/停止/导入');
});

test('real HTTP handoff returns the same protocol the webpage reads', async () => {
  const handler = createObservatoryHandler({ projectRoot: project, env: { OBSERVATORY_MODE: 'isolated', OBSERVATORY_DATA_DIR: dataDir } });
  const server = http.createServer((req, res) => handler(req, res, new URL(req.url, 'http://127.0.0.1')).then(handled => { if (!handled) { res.statusCode = 404; res.end(); } }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const result = await (await fetch(`${base}/api/observatory/handoff?kind=topic&id=${encodeURIComponent(topicId)}`)).json();
    assert.equal(result.ok, true);
    assert.deepEqual(result.data.researchProtocol, (await handoff(store, 'handoff-topic', topicId)).researchProtocol);
    const app = await (await fetch(base + '/observatory/app.js')).text();
    assert.match(app, /handoffText.*result\.text/);
    assert.match(app, /OBSERVATORY_DRAFT_HELPERS|draftLedger/);
    record('真实HTTP交接与网页共享；原草稿代码仍在');
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test.after(async () => {
  await fsp.writeFile(path.join(testRoot, 'evidence.json'), JSON.stringify({ kind: 'isolated_technical_integration', identity, evidence,
    noProductionWrites: true, noServiceRestart: true, noModelCalls: true, professionalResearchQualityVerified: false }, null, 2), 'utf8');
});
