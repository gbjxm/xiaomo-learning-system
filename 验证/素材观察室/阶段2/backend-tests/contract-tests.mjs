import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { PROJECT_ROOT, DEFAULT_DATA_DIR, ObservatoryStore, initStore } from '../../../../web/observatory/store.mjs';
import { execute, executeForHttp } from '../../../../web/observatory/api.mjs';
import { validateMaterial } from '../../../../web/observatory/model.mjs';
import { main as cliMain } from '../../../../web/observatory/cli.mjs';

const testsRoot = path.dirname(fileURLToPath(import.meta.url));
const runRoot = path.join(testsRoot, `run-${new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')}`);
fs.mkdirSync(runRoot, { recursive: true });
const dataDir = path.join(runRoot, 'demo', 'data');
const results = [];
async function test(name, callback) {
  try { await callback(); results.push({ name, status: 'passed' }); process.stdout.write(`PASS ${name}\n`); }
  catch (error) { results.push({ name, status: 'failed', error: error.stack }); process.stdout.write(`FAIL ${name}: ${error.message}\n`); }
}
async function rejectsCode(callback, code) { await assert.rejects(callback, error => error.code === code); }
const sid = () => randomUUID();
let identity; let store; let matA; let matB; let topicA; let topicB; let stagePayload; let stageReceipt;
const materialPayload = text => ({ identity, submissionId: sid(), material: { original: { kind: 'text', text } } });

await test('默认定位只由模块绝对路径决定；跨 CWD 不改变', async () => {
  const before = process.cwd(); try {
    const first = new ObservatoryStore(); process.chdir(runRoot); const second = new ObservatoryStore();
    assert.equal(first.dataDir, second.dataDir); assert.equal(second.dataDir, DEFAULT_DATA_DIR);
  } finally { process.chdir(before); }
});
await test('相对 data-dir 被拒绝', async () => {
  assert.throws(() => new ObservatoryStore({ dataDir: './data' }), error => error.code === 'INVALID_DATA_PATH');
});
await test('缺失库读取不建目录或数据库', async () => {
  const missing = path.join(runRoot, 'wrong-path', 'data');
  await rejectsCode(() => new ObservatoryStore({ dataDir: missing }).identity(), 'DATABASE_MISSING'); assert.equal(fs.existsSync(missing), false);
});
await test('未显式 production 范围不能初始化正式库', async () => {
  await rejectsCode(() => initStore({ dataDir: DEFAULT_DATA_DIR }), 'PHASE1_INIT_RESTRICTED');
});
await test('显式初始化隔离库；身份完整且重复 init 不覆盖', async () => {
  identity = await initStore({ dataDir, scope: 'demo' }); store = new ObservatoryStore({ dataDir });
  assert.equal(identity.scope, 'demo'); assert.equal(identity.projectRoot, PROJECT_ROOT); assert.equal(identity.schemaVersion, 2);
  assert.equal(identity.canonicalDbPath, fs.realpathSync(path.join(dataDir, 'observatory.sqlite3')));
  assert.deepEqual(await store.identity(), identity);
  await rejectsCode(() => initStore({ dataDir, scope: 'demo' }), 'DATABASE_EXISTS');
});
await test('只有链接即可独立收藏，标题标签问题为空', async () => {
  const saved = await execute('create-material', { identity, submissionId: sid(), material: { original: { kind: 'link', url: 'https://example.com/demo-source' }, originalImpression: '【演示原话】这段停顿吸引我。' } }, { dataDir });
  matA = saved.receipt.snapshot; assert.equal(matA.title, ''); assert.deepEqual(matA.tags, []); assert.equal(matA.revision, 1); assert.equal(saved.verification.snapshotVerified, true);
  assert.equal((await store.listTopics()).records.length, 0);
});
await test('短文本原件完整保存，没有截断或总结', async () => {
  const original = '【演示数据】原始句子。\n'.repeat(1500); const saved = await store.createMaterial(materialPayload(original)); matB = saved.receipt.snapshot;
  assert.equal(matB.original.text, original); assert.equal(matB.originalImpression, '');
});
await test('模型接受附件作为唯一输入；未登记附件不能写入', async () => {
  assert.equal(validateMaterial({ original: { kind: 'video' }, attachmentIds: ['att_demo'] }).original.kind, 'video');
  const before = (await store.listMaterials()).records.length;
  await rejectsCode(() => store.createMaterial({ identity, submissionId: sid(), material: { original: { kind: 'image' }, attachmentIds: ['att_missing'] } }), 'ATTACHMENT_NOT_REGISTERED');
  assert.equal((await store.listMaterials()).records.length, before);
});
await test('用户修正感受留 before/after；原始输入与原始感受不变，ID 稳定', async () => {
  const result = await store.updateMaterial({ identity, submissionId: sid(), materialId: matA.materialId, expectedRevision: matA.revision,
    actor: 'user', patch: { currentImpression: '【演示修正】吸引我的是反应前的停顿。', addNote: '【演示后续备注】以后再看。', tags: ['停顿'] } });
  const updated = result.receipt.snapshot; assert.equal(updated.materialId, matA.materialId); assert.equal(updated.originalImpression, matA.originalImpression);
  assert.equal(updated.impressionHistory[0].before, matA.currentImpression); assert.equal(updated.impressionHistory[0].after, updated.currentImpression);
  assert.equal(updated.notes[0].actor, 'user'); matA = updated;
});
await test('AI 不能修改用户感受，任何调用不能补丁覆写 originalImpression', async () => {
  await rejectsCode(() => store.updateMaterial({ identity, submissionId: sid(), materialId: matA.materialId, expectedRevision: matA.revision, actor: 'ai', patch: { currentImpression: '伪造' } }), 'AUTHORSHIP_PROTECTED');
  await rejectsCode(() => store.updateMaterial({ identity, submissionId: sid(), materialId: matA.materialId, expectedRevision: matA.revision, actor: 'ai', patch: { segments: [], tags: ['未采用 AI 标签'] } }), 'AUTHORSHIP_PROTECTED');
  const unchanged = (await store.readMaterial(matA.materialId)).record;
  assert.deepEqual(unchanged.notes, matA.notes); assert.deepEqual(unchanged.tags, matA.tags); assert.deepEqual(unchanged.segments, matA.segments);
  await rejectsCode(() => store.updateMaterial({ identity, submissionId: sid(), materialId: matA.materialId, expectedRevision: matA.revision, actor: 'user', patch: { originalImpression: '伪造' } }), 'INVALID_INPUT');
});
await test('多专题复用同一素材 ID，不复制原始素材', async () => {
  topicA = (await store.createTopic({ identity, submissionId: sid(), topic: { title: '【演示】停顿观察', question: '【演示问题】反应前停顿有什么作用？', scope: '只观察这两条演示素材，不进行真实调研。', materialIds: [matA.materialId, matB.materialId] } })).receipt.snapshot;
  topicB = (await store.createTopic({ identity, submissionId: sid(), topic: { title: '【演示】另一个专题', materialIds: [matA.materialId] } })).receipt.snapshot;
  assert.ok(topicA.materialIds.includes(matA.materialId)); assert.ok(topicB.materialIds.includes(matA.materialId)); assert.equal((await store.listMaterials()).records.length, 2);
});
await test('不同 storeId 提交拒绝，API 适配器返回清楚状态', async () => {
  const output = await executeForHttp('create-material', { ...materialPayload('【演示】'), identity: { ...identity, storeId: 'wrong' } }, { dataDir });
  assert.equal(output.status, 409); assert.equal(output.body.error.code, 'STORE_IDENTITY_MISMATCH');
});
await test('同一记录旧 revision 拒绝，原数据不覆盖', async () => {
  await rejectsCode(() => store.updateMaterial({ identity, submissionId: sid(), materialId: matA.materialId, expectedRevision: 1, actor: 'user', patch: { title: '旧修改' } }), 'REVISION_CONFLICT');
  assert.equal((await store.readMaterial(matA.materialId)).record.currentImpression, matA.currentImpression);
});
const stageBody = { focus: '【演示关注点】反应前的停顿', confirmed: ['【演示已确认】仅确认当前示例中的文字描述。'],
  candidates: ['【演示候选】下一步可对照不同反应时机。'], parked: ['【演示暂不展开】演员经历。'], unknown: ['【演示未知】真实镜头是否存在相同效果。'],
  nextStep: '小陌查看预览后，阶段 2 用真实授权素材跑闭环。', limitations: ['本记录为合成演示，没有开展来源研究。'], researchStatus: 'stage_complete',
  paragraphs: [{ paragraphId: 'para_demo_1', heading: '【演示段落】观察范围', markdown: '这是一段**明确标记的演示正文**，不是研究结论。\n\n保留第二段完整内容。', basisKind: 'demo',
    sourceRefs: [{ sourceId: 'src_demo_m1', locator: 'originalImpression 原话字段', note: '仅支持展示“用户感受与 AI 分析分开”的结构，不支持效果结论。' }], attachmentIds: [] }],
  sources: [{ sourceId: 'src_demo_m1', kind: 'material', title: '【演示素材】', materialId: matA?.materialId, locator: 'originalImpression', verificationScope: 'demo', licenseStatus: 'unknown' }] };
await test('阶段记录保存完整正文、阶段字段与段落级来源映射', async () => {
  stagePayload = { identity, submissionId: sid(), topicId: topicA.topicId, expectedRevision: topicA.revision,
    materialVersions: [{ materialId: matA.materialId, revision: matA.revision }], stage: stageBody };
  const saved = await store.submitStage(stagePayload); stageReceipt = saved.receipt; topicA = saved.receipt.snapshot;
  const stage = topicA.stages[0]; assert.equal(stage.paragraphs[0].markdown, stageBody.paragraphs[0].markdown); assert.equal(stage.sources[0].verificationScope, 'demo');
  assert.equal(stage.paragraphs[0].basisKind, 'demo'); assert.equal(stage.sources[0].licenseStatus, 'unknown'); assert.equal(stage.paragraphs[0].sourceRefs[0].sourceId, stage.sources[0].sourceId);
  assert.deepEqual(stage.unknown, stageBody.unknown); assert.deepEqual(stage.parked, stageBody.parked); assert.equal(saved.verification.currentRevision, 2);
  assert.equal((await store.readMaterial(matA.materialId)).record.originalImpression, matA.originalImpression);
});
await test('同 submissionId/同 payload 返回原收据，不增加成果', async () => {
  const retried = await store.submitStage(stagePayload); assert.deepEqual(retried.receipt, stageReceipt);
  assert.equal((await store.readTopic(topicA.topicId)).record.stages.length, 1);
});
await test('同 submissionId/不同 payload 明确拒绝', async () => {
  await rejectsCode(() => store.submitStage({ ...stagePayload, stage: { ...stageBody, nextStep: '不同内容' } }), 'SUBMISSION_ID_CONFLICT');
});
await test('研究所依据的旧素材版本拒绝，专题阶段不变', async () => {
  await rejectsCode(() => store.submitStage({ ...stagePayload, submissionId: sid(), expectedRevision: topicA.revision, materialVersions: [{ materialId: matA.materialId, revision: 1 }] }), 'REVISION_CONFLICT');
  assert.equal((await store.readTopic(topicA.topicId)).record.stages.length, 1);
});
await test('未定义来源和只列链接不映射段落被拒绝', async () => {
  await rejectsCode(() => store.submitStage({ ...stagePayload, submissionId: sid(), expectedRevision: topicA.revision, stage: { ...stageBody, sources: [] } }), 'INVALID_SOURCE_REF');
  await rejectsCode(() => store.submitStage({ ...stagePayload, submissionId: sid(), expectedRevision: topicA.revision, stage: { ...stageBody, paragraphs: [] } }), 'INVALID_SOURCE_REF');
});
await test('未知附件使阶段提交整体拒绝，topic/stage/submission 均不增', async () => {
  const broken = { ...stagePayload, submissionId: sid(), expectedRevision: topicA.revision,
    stage: { ...stageBody, paragraphs: [{ ...stageBody.paragraphs[0], attachmentIds: ['att_unknown'] }] } };
  await rejectsCode(() => store.submitStage(broken), 'ATTACHMENT_NOT_REGISTERED');
  const after = (await store.readTopic(topicA.topicId)).record; assert.equal(after.revision, topicA.revision); assert.equal(after.stages.length, 1);
  const db = new DatabaseSync(identity.canonicalDbPath, { readOnly: true }); try { assert.equal(db.prepare('SELECT COUNT(*) AS count FROM submissions WHERE submission_id = ?').get(broken.submissionId).count, 0); } finally { db.close(); }
});
await test('已登记但原件缺失的附件拒绝，既有研究保留', async () => {
  const db = new DatabaseSync(identity.canonicalDbPath); try {
    db.prepare('INSERT INTO attachments VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run('att_missing_file', '【演示缺失附件】.png', 'missing.png', '0'.repeat(64), 'image/png', 10, 'unknown', 'registered');
  } finally { db.close(); }
  await rejectsCode(() => store.submitStage({ ...stagePayload, submissionId: sid(), expectedRevision: topicA.revision,
    stage: { ...stageBody, paragraphs: [{ ...stageBody.paragraphs[0], attachmentIds: ['att_missing_file'] }] } }), 'ATTACHMENT_UNAVAILABLE');
  assert.equal((await store.readTopic(topicA.topicId)).record.stages.length, 1);
});
await test('素材归档/删除可恢复且独立于专题状态，不物理删除', async () => {
  const archived = await store.updateMaterial({ identity, submissionId: sid(), materialId: matA.materialId, expectedRevision: matA.revision, actor: 'user', patch: { status: 'archived' } }); matA = archived.receipt.snapshot;
  assert.equal((await store.readTopic(topicA.topicId)).record.status, 'stage_complete'); assert.equal((await store.readTopic(topicB.topicId)).record.status, 'draft');
  const deleted = await store.updateMaterial({ identity, submissionId: sid(), materialId: matA.materialId, expectedRevision: matA.revision, actor: 'user', patch: { status: 'deleted' } }); matA = deleted.receipt.snapshot;
  assert.equal((await store.readMaterial(matA.materialId)).record.status, 'deleted'); assert.ok((await store.readTopic(topicB.topicId)).record.materialIds.includes(matA.materialId));
  const restored = await store.updateMaterial({ identity, submissionId: sid(), materialId: matA.materialId, expectedRevision: matA.revision, actor: 'user', patch: { status: 'active' } }); matA = restored.receipt.snapshot;
});
await test('新增关联失败会回滚此前已做的关系变化', async () => {
  await rejectsCode(() => store.updateTopic({ identity, submissionId: sid(), topicId: topicB.topicId, expectedRevision: topicB.revision, patch: { materialIds: [matB.materialId, 'mat_does_not_exist'] } }), 'NOT_FOUND');
  assert.deepEqual((await store.readTopic(topicB.topicId)).record.materialIds, topicB.materialIds);
});
await test('不合法类型/额外字段/不安全 URI 拒绝', async () => {
  await rejectsCode(() => store.createMaterial({ ...materialPayload('x'), material: { original: { kind: 'text', text: 42 } } }), 'INVALID_INPUT');
  await rejectsCode(() => store.createMaterial({ ...materialPayload('x'), material: { original: { kind: 'link', url: 'javascript:alert(1)' } } }), 'UNSAFE_URI');
  await rejectsCode(() => store.createMaterial({ ...materialPayload('x'), material: { original: { kind: 'text', text: 'x' }, fabricatedField: true } }), 'INVALID_INPUT');
});
await test('错误 schemaVersion 不能被当作正常空库读取', async () => {
  const badDir = path.join(runRoot, 'bad-schema', 'data'); const badIdentity = await initStore({ dataDir: badDir });
  const db = new DatabaseSync(badIdentity.canonicalDbPath); try { db.exec('UPDATE store_meta SET schema_version = 99'); } finally { db.close(); }
  await rejectsCode(() => new ObservatoryStore({ dataDir: badDir }).identity(), 'INVALID_DATABASE');
});
await test('CLI 交接可执行，携带原素材读取命令、范围和阶段接续；不自动研究', async () => {
  const before = (await store.readTopic(topicA.topicId)).record;
  let output = ''; const previous = process.stdout.write;
  process.stdout.write = function (chunk) { output += chunk.toString(); return true; };
  try { await cliMain(['handoff-topic', topicA.topicId, '--data-dir', dataDir]); }
  finally { process.stdout.write = previous; }
  const handoff = JSON.parse(output).data;
  assert.equal(handoff.identity.storeId, identity.storeId); assert.equal(handoff.currentRevision, before.revision);
  assert.equal(handoff.materialReadCommands.length, before.materialIds.length); assert.equal(handoff.scope, before.scope);
  assert.match(handoff.text, /原始感受/); assert.match(handoff.text, /暂不展开/); assert.match(handoff.text, /submit-stage/);
  assert.deepEqual((await store.readTopic(topicA.topicId)).record, before);
  fs.writeFileSync(path.join(runRoot, 'example-topic-handoff.json'), JSON.stringify(handoff, null, 2), 'utf8');
});

fs.writeFileSync(path.join(runRoot, 'example-stage-submission.json'), JSON.stringify({ ...stagePayload, submissionId: sid(), expectedRevision: topicA.revision,
  materialVersions: [{ materialId: matA.materialId, revision: matA.revision }] }, null, 2), 'utf8');
fs.writeFileSync(path.join(runRoot, 'identity.json'), JSON.stringify(identity, null, 2), 'utf8');
const evidence = { phase: 1, scope: 'single-process isolated contract tests only', nodeVersion: process.version,
  runRoot, dataDir, identity, fixtureClassification: 'synthetic demo, not real user materials or research',
  materialIds: [matA?.materialId, matB?.materialId], topicIds: [topicA?.topicId, topicB?.topicId],
  passed: results.filter(r => r.status === 'passed').length, failed: results.filter(r => r.status === 'failed').length, results,
  notVerified: ['HTTP route integration', 'independent CLI process reading/writing the same disk DB as HTTP service', 'cross-process competing writers',
    'real lock wait/recovery or disk commit failure', 'browser refresh/server restart', 'real Codex new conversation continuation', 'attachment upload/registration', 'complete backup restore'],
  generatedAt: new Date().toISOString() };
fs.writeFileSync(path.join(testsRoot, 'evidence.json'), JSON.stringify(evidence, null, 2), 'utf8');
process.stdout.write(`\n${evidence.passed} passed, ${evidence.failed} failed; evidence: ${path.join(testsRoot, 'evidence.json')}\n`);
process.exitCode = evidence.failed ? 1 : 0;
