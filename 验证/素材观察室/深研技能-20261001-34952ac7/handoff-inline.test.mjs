import test from 'node:test';
import assert from 'node:assert/strict';
import fsp from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { ObservatoryStore, initStore } from '../../../web/observatory/store.mjs';
import { importResearchAttachment } from '../../../web/observatory/research-import.mjs';
import { handoff } from '../../../web/observatory/cli.mjs';
import { createObservatoryHandler } from '../../../web/observatory/http.mjs';

const run = path.dirname(fileURLToPath(import.meta.url));
const project = path.resolve(run, '../../..');
const root = path.join(run, `内联交接核验-${Date.now()}`);
await fsp.mkdir(root);
const dataDir = path.join(root, 'data');
const identity = await initStore({ dataDir, scope: 'isolated' });
const store = new ObservatoryStore({ dataDir });
const fixture = path.join(root, '技术示例.txt');
await fsp.writeFile(fixture, '内联交接技术演练；非用户内容。', 'utf8');
const upload = await importResearchAttachment(store, { identity, submissionId: randomUUID(), filePath: fixture });
const attachmentId = upload.attachment.attachmentId;
const created = await store.createMaterial({ identity, submissionId: randomUUID(), material: { original: { kind: 'text', text: '隔离交接测试，不是用户原话。' } } });
const materialId = created.receipt.recordId;
const evidence = [];
async function topicWithStages(markdowns) {
  const createdTopic = await store.createTopic({ identity, submissionId: randomUUID(), topic: { question: '技术验证内联附件交接', materialIds: [materialId] } });
  const topicId = createdTopic.receipt.recordId;
  let expectedRevision = 1;
  for (const markdown of markdowns) {
    await store.submitStage({ identity, submissionId: randomUUID(), topicId, expectedRevision, materialVersions: [{ materialId, revision: 1 }], stage: {
      focus: '隔离技术演练', nextStep: '验证交接', paragraphs: [{ markdown, basisKind: 'demo', attachmentIds: [], sourceRefs: [] }], sources: [] } });
    expectedRevision++;
  }
  return topicId;
}
function passed(name, extra = {}) { evidence.push({ name, passed: true, ...extra }); }

test('old inline-only stage produces accurate attachment read command', async () => {
  const topicId = await topicWithStages([`![技术示例](attachment:${attachmentId})`]);
  const result = await handoff(store, 'handoff-topic', topicId);
  assert.equal(result.attachmentReadCommands.length, 1);
  assert.equal(result.attachmentReadCommands[0].attachmentId, attachmentId);
  assert.match(result.attachmentReadCommands[0].command, /read-attachment/);
  assert.match(result.attachmentReadCommands[0].command, /--data-dir/);
  assert.deepEqual((await store.readTopic(topicId)).record.stages[0].paragraphs[0].attachmentIds, []);
  passed('旧版仅内联附件准确读取，原stage不变', { topicId, attachmentId });
});

test('shared reference definition across historical stages resolves once', async () => {
  const topicId = await topicWithStages(['![技术示例][frame]\n\n[另一引用][frame]', `[frame]: <attachment:${attachmentId}> "技术示例"`]);
  const result = await handoff(store, 'handoff-topic', topicId);
  assert.equal(result.attachmentReadCommands.length, 1);
  assert.equal(result.attachmentReadCommands[0].attachmentId, attachmentId);
  passed('历史完整正文跨阶段引用定义与去重', { topicId });
});

test('code, escaped syntax and plain mentions do not become file commands', async () => {
  const topicId = await topicWithStages(['`![inline](attachment:att_missing_code)`\n\n```md\n![fenced](attachment:att_missing_fence)\n```\n\n    ![indented](attachment:att_missing_indent)\n\n!\\[escaped](attachment:att_missing_escape)\n\n这里只提到 attachment:att_missing_prose。']);
  const result = await handoff(store, 'handoff-topic', topicId);
  assert.equal(result.attachmentReadCommands.length, 0);
  passed('代码示例/转义/普通提及排除');
});

test('unregistered and malicious inline destinations explicitly fail', async () => {
  const missing = await topicWithStages(['![缺失](attachment:att_missing_registered)']);
  await assert.rejects(handoff(store, 'handoff-topic', missing), error => error.code === 'ATTACHMENT_NOT_REGISTERED' && error.details.attachmentId === 'att_missing_registered');
  const malicious = await topicWithStages(['![恶意](attachment:../../outside.png)']);
  await assert.rejects(handoff(store, 'handoff-topic', malicious), error => error.code === 'INVALID_ATTACHMENT_REFERENCE');
  passed('缺失/恶意引用明确失败，不猜路径');
});

test('webpage HTTP handoff includes recovered historical inline ID', async () => {
  const topicId = await topicWithStages([`![技术示例](attachment:${attachmentId})`]);
  const handler = createObservatoryHandler({ projectRoot: project, env: { OBSERVATORY_MODE: 'isolated', OBSERVATORY_DATA_DIR: dataDir } });
  const server = http.createServer((req, res) => handler(req, res, new URL(req.url, 'http://127.0.0.1')).then(handled => { if (!handled) res.end(); }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const response = await (await fetch(`http://127.0.0.1:${server.address().port}/api/observatory/handoff?kind=topic&id=${topicId}`)).json();
    assert.equal(response.ok, true);
    assert.equal(response.data.attachmentReadCommands[0].attachmentId, attachmentId);
    assert.match(response.data.text, new RegExp(attachmentId));
    passed('真实HTTP交接得到同一内联附件读取命令');
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test.after(async () => { await fsp.writeFile(path.join(root, 'evidence.json'), JSON.stringify({ identity, evidence, noProductionWrites: true, noServiceRestart: true, noModelCalls: true }, null, 2), 'utf8'); });
