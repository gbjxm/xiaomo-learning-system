import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import { mkdtemp, mkdir, readFile, writeFile, copyFile, symlink } from 'node:fs/promises';
import { createNavigationHandler } from './http.mjs';
import { createNavigationBridge, navigationConfiguration, DEFAULT_NAVIGATION_ROOT, DEFAULT_LEARNING_ROOT } from './bridge.mjs';

async function fixture() {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'xiaomo-navigation-fixture-'));
  const root = path.join(projectRoot, 'room');
  await Promise.all(['tools', '状态', '依据/原始转写', '.agents/skills/navigate-personal-development'].map(relative => mkdir(path.join(root, relative), { recursive: true })));
  await mkdir(path.join(projectRoot, '运行记录'));
  await Promise.all(['room.py', 'continuity.py'].map(name => copyFile(path.join(DEFAULT_NAVIGATION_ROOT, 'tools', name), path.join(root, 'tools', name))));
  const originals = {
    '依据/2026-10-03_生活记录与反思.md': '# 生活记录\n\n## 原话\n  我做了饭，也和朋友玩了游戏。\n\n## AI理解\n仅为假设，不能证明原因。\n',
    '依据/2026-09-10_短片灵感_机器人与AI内部世界.md': '# 机器人灵感\n\n原始词语仍待核对。\n',
    '依据/原始转写/2026-09-10_短片灵感_原始转写.txt': '  嗯机器人啊\n重复重复。\n可能错字，保持原样。  \n'
  };
  await Promise.all(Object.entries(originals).map(([relative, content]) => writeFile(path.join(root, relative), content)));
  await Promise.all([writeFile(path.join(root, '当前处境.md'), '# 处境\n本人旧自述'), writeFile(path.join(root, '人生罗盘.md'), '# 罗盘\n休息和朋友有价值'), writeFile(path.join(root, '.agents/skills/navigate-personal-development/SKILL.md'), '这是隔离领航技能。'), writeFile(path.join(projectRoot, '运行记录/个人情况.md'), '只读学习背景，测试不记为进步。')]);
  const state = { schema: 'xiaomo.navigation-state/v2', revision: 33, updated_at: '2026-10-03T17:00:00Z', focus: { text: '隔离演练', basis: 'fixture', history: [] }, decisions: [], resources: [], routes: [], applied_events: [], records: [
    { id: 'R-20261003-daily-life', kind: 'user_report', occurred_on: '2026-10-03', received_at: '2026-10-03T17:00:00Z', source: 'fixture原话', content: '我做了饭，也和朋友玩了游戏。' },
    { id: 'R-20260910-robot-ai-world-idea', kind: 'user_report', occurred_on: '2026-09-10', received_at: '2026-10-03T17:00:00Z', source: 'fixture原转写', content: '机器人啊' },
    { id: 'R-20261004-quota-opportunity-cost-hypothesis', kind: 'ai_inference', occurred_on: '2026-10-04', received_at: '2026-10-03T17:00:00Z', source: 'fixtureAI理解', content: '可能有投入取舍，原因未知。', related_ids: ['R-20261003-daily-life'] }
  ] };
  const stateFile = path.join(root, '状态/领航状态.json');
  await writeFile(stateFile, JSON.stringify(state, null, 2));
  const env = { ...process.env, WORKSPACE_MODE: 'isolated', NAVIGATION_ROOT: root };
  return { projectRoot, root, stateFile, originals, env };
}

async function host(t, fx, options = {}) {
  const handler = createNavigationHandler({ projectRoot: fx.projectRoot, env: fx.env, ...options });
  const server = http.createServer(async (req, res) => { if (!await handler(req, res, new URL(req.url, 'http://localhost'))) { res.writeHead(404); res.end(); } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/api/navigation/`;
  const bootstrap = await fetch(url + 'bootstrap?asOf=2026-10-04').then(r => r.json());
  assert.equal(bootstrap.ok, true, JSON.stringify(bootstrap));
  const token = bootstrap.data.token;
  async function call(route, input, overrideToken = token) {
    const response = await fetch(url + route, input === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Navigation-Token': overrideToken }, body: JSON.stringify(input) });
    return { status: response.status, body: await response.json() };
  }
  return { call, bootstrap, url };
}

test('navigation GETs reuse both old originals and raw transcript without creating records or files', async t => {
  const fx = await fixture(), before = await readFile(fx.stateFile);
  const { call, bootstrap } = await host(t, fx);
  assert.equal(bootstrap.data.scope, 'isolated');
  assert.equal(bootstrap.data.journeys.length, 2);
  const detail = await call('journeys/legacy-idea-20260910');
  assert.equal(detail.body.data.entry.content, fx.originals['依据/2026-09-10_短片灵感_机器人与AI内部世界.md']);
  assert.equal(detail.body.data.entry.rawTranscript, fx.originals['依据/原始转写/2026-09-10_短片灵感_原始转写.txt']);
  assert.equal(detail.body.data.entry.contentKind, 'mixed_document');
  assert.equal((await call('journeys?query=' + encodeURIComponent('可能错字'))).body.data.entries.length, 1);
  assert.equal((await call('journeys?date=2026-10-03&type=life')).body.data.entries.length, 1);
  assert.equal((await call('context?asOf=2026-10-04&query=' + encodeURIComponent('休息'))).status, 200);
  const review = await call('review?asOf=2026-10-04&since=2026-10-03&until=2026-10-03');
  assert.equal(review.body.data.generated, false);
  assert.equal(review.body.data.journeys.length, 1);
  assert(review.body.data.evidence.some(r => r.kind === 'ai_inference'));
  assert(review.body.data.coverage.note.includes('未记录不等于'));
  assert.deepEqual(await readFile(fx.stateFile), before);
  for (const [relative, content] of Object.entries(fx.originals)) assert.equal(await readFile(path.join(fx.root, relative), 'utf8'), content);
});

test('journey saves preserve exact text, CAS, whole old state and idempotent retry', async t => {
  const fx = await fixture(), before = JSON.parse(await readFile(fx.stateFile, 'utf8'));
  const { call } = await host(t, fx);
  const input = { eventId: 'E-user-exact', expectedRevision: 33, entry: { id: 'J-user-exact', title: '', date: '2026-10-04', type: 'note', content: '  今天一段原话\n\n重复重复。\n  ' } };
  const stale = await call('record', { ...input, expectedRevision: 0 });
  assert.equal(stale.status, 409); assert.equal(stale.body.error.details.currentRevision, 33);
  const saved = await call('record', input);
  assert.equal(saved.status, 200); assert.equal(saved.body.data.revision, 34); assert.equal(saved.body.data.saved, true);
  assert.equal(saved.body.data.entry.content, input.entry.content);
  assert.equal(saved.body.data.entry.title, '');
  const again = await call('record', input);
  assert.equal(again.body.data.duplicate, true); assert.equal(again.body.data.revision, 34);
  assert.equal((await call('record', { ...input, entry: { ...input.entry, content: '其他内容' } })).status, 409);
  assert.equal((await call('journeys/J-user-exact')).body.data.entry.content, input.entry.content);
  const after = JSON.parse(await readFile(fx.stateFile, 'utf8'));
  assert.deepEqual(after.records.slice(0, before.records.length), before.records);
  assert.deepEqual(after.routes, before.routes); assert.deepEqual(after.decisions, before.decisions);
  assert.equal(after.records.at(-1).kind, 'user_report');
  assert.deepEqual(after.records.at(-1).journey, { title: '', type: 'note' });
});

test('AI analysis is explicit, remains inference, and cannot become a journey or cite missing evidence', async t => {
  const fx = await fixture(), { call } = await host(t, fx);
  const input = { eventId: 'E-save-analysis', expectedRevision: 33, id: 'A-explicit', content: '可能有一个卡点，待小陌校正。', relatedIds: ['R-20261003-daily-life'] };
  assert.equal((await call('analysis', { ...input, relatedIds: ['R-missing'] })).status, 400);
  const result = await call('analysis', input);
  assert.equal(result.body.data.kind, 'ai_inference'); assert.equal(result.body.data.saved, true);
  assert.equal((await call('analysis', input)).body.data.duplicate, true);
  assert.equal((await call('journeys')).body.data.entries.length, 2);
  const review = await call('review?since=2026-10-03&until=2026-10-03');
  assert(review.body.data.evidence.some(r => r.id === 'A-explicit' && r.kind === 'ai_inference'));
});

test('writing needs one valid token and does not overwrite old read-only entries', async t => {
  const fx = await fixture(), before = await readFile(fx.stateFile), { call } = await host(t, fx);
  const input = { eventId: 'E-safe-write', expectedRevision: 33, entry: { id: 'J-safe-write', title: '随手记', date: '2026-10-04', type: 'note', content: '内容' } };
  assert.equal((await call('record', input, 'wrong')).status, 403);
  assert.equal((await call('record', { ...input, entry: { ...input.entry, id: 'legacy-life-20261003' } })).status, 409);
  assert.equal((await call('record', { ...input, entry: { ...input.entry, type: 'ai_inference' } })).status, 400);
  assert.equal((await call('record', { ...input, entry: { ...input.entry, date: '2026-02-30' } })).status, 400);
  assert.equal((await call('journeys/' + encodeURIComponent('../状态/领航状态.json'))).status, 400);
  assert.deepEqual(await readFile(fx.stateFile), before);
});

test('real model adapter receives bounded source-aware text, responses do not auto-save and duplicate requests reuse the promise', async t => {
  const fx = await fixture(), before = await readFile(fx.stateFile); let calls = 0, sent;
  const { call } = await host(t, fx, { providerStatus: () => ({ configured: true, provider: 'isolated-mock', model: 'fixture' }), runModel: async messages => { calls++; sent = messages; return '依据 R-20261003-daily-life：记录了做饭和朋友游戏；原因仍未知。'; } });
  const input = { requestId: 'chat-fixture-1', mode: 'review', message: '帮我看这段时间发生了什么', asOf: '2026-10-04', since: '2026-10-03', until: '2026-10-03' };
  const result = await call('chat', input);
  assert.equal(result.status, 200); assert.equal(result.body.data.saved, false);
  assert(sent[0].content.includes('原学习系统只读背景')); assert(sent[0].content.includes('AI原因解释')); assert(sent[0].content.includes('R-20261003-daily-life'));
  assert.deepEqual((await call('chat', input)).body.data.reply, result.body.data.reply); assert.equal(calls, 1);
  assert.equal((await call('chat', { ...input, message: '不同问题' })).status, 409);
  assert.equal((await call('requests/chat-fixture-1')).body.data.status, 'completed');
  assert.deepEqual(await readFile(fx.stateFile), before);
});

test('missing provider and model errors leave private records unchanged', async t => {
  const fx = await fixture(), before = await readFile(fx.stateFile), { call } = await host(t, fx);
  assert.equal((await call('chat', { requestId: 'chat-unconfigured', mode: 'chat', message: '随便聊聊', asOf: '2026-10-04' })).status, 503);
  assert.equal((await call('chat', { requestId: 'chat-invalid-date', mode: 'chat', message: '问问', asOf: '2026-02-30' })).status, 400);
  assert.deepEqual(await readFile(fx.stateFile), before);
});

test('confirmed model failure can retry but a timed-out pending request never generates twice', async t => {
  const fx = await fixture(), before = await readFile(fx.stateFile); let calls = 0, release;
  const { call } = await host(t, fx, { providerStatus: () => ({ configured: true, provider: 'isolated-mock' }), modelTimeoutMs: 30,
    runModel: async () => { calls++; if (calls === 1) throw new Error('fixture provider failure'); return new Promise(resolve => { release = resolve; }); } });
  const input = { requestId: 'retry-fixture', mode: 'chat', message: '问问当前情况', asOf: '2026-10-04' };
  // Reading the prompt itself is part of the pending call. Allow it to settle
  // before asserting the confirmed failure so timing does not hide the cause.
  await call('chat', input);
  for (let n = 0; n < 10; n++) {
    const receipt = await call('requests/retry-fixture');
    if (receipt.body.data.status === 'failed') break;
    await new Promise(resolve => setTimeout(resolve, 40));
  }
  const second = await call('chat', input); assert.equal(second.status, 504);
  const third = await call('chat', input); assert.equal(third.status, 504);
  for (let n = 0; n < 10 && !release; n++) await new Promise(resolve => setTimeout(resolve, 40));
  assert.equal(calls, 2); release('已取得真实mock回答，尚未保存。');
  const finished = await call('chat', input); assert.equal(finished.status, 200); assert.equal(calls, 2);
  assert.deepEqual(await readFile(fx.stateFile), before);
});

test('isolated fixtures cannot fall through to the formal navigation room or overwrite production host', async () => {
  const fx = await fixture();
  await assert.rejects(navigationConfiguration({ projectRoot: fx.projectRoot, env: { ...fx.env, NAVIGATION_ROOT: DEFAULT_NAVIGATION_ROOT } }), { code: 'NAV_INVALID_ROOT' });
  await assert.rejects(navigationConfiguration({ projectRoot: DEFAULT_LEARNING_ROOT, env: fx.env }), { code: 'NAV_INVALID_ROOT' });
  await assert.rejects(navigationConfiguration({ projectRoot: fx.projectRoot, env: { ...process.env, WORKSPACE_MODE: 'isolated' } }), { code: 'NAV_INVALID_ROOT' });
  await assert.rejects(navigationConfiguration({ projectRoot: DEFAULT_LEARNING_ROOT, env: { ...process.env, NAVIGATION_ROOT: fx.root } }), { code: 'NAV_INVALID_ROOT' });
});

// Exercise the real Python reader directly in a fixture; no HTTP service or
// formal state writer is involved in these document-link regressions.
async function documentFixture() {
  const fx = await fixture();
  const bridge = createNavigationBridge({ projectRoot: fx.projectRoot, env: fx.env });
  const input = { eventId: 'E-document-original', expectedRevision: 33, entry: {
    id: 'J-document-original', title: '10 月 4 日生活记录', date: '2026-10-04', type: 'life',
    content: '  今天原话完整保留。\n\n重复重复，不删空白。\n  '
  } };
  const saved = await bridge.call('save', input);
  assert.equal(saved.entry.id, input.entry.id);
  assert.equal(saved.entry.content, input.entry.content);
  assert.equal(saved.entry.originalContent, input.entry.content);
  assert.equal(saved.entry.contentKind, 'user_original');
  return { ...fx, bridge, input, file: '依据/2026-10-04_生活记录与反思.md' };
}

async function appendDocumentAssociation(fx, { kind = 'observed', entryId = fx.input.entry.id,
  relatedIds = [fx.input.entry.id], file = fx.file } = {}) {
  const state = JSON.parse(await readFile(fx.stateFile, 'utf8'));
  const record = { id: 'R-document-association', kind, received_at: '2026-10-04T12:00:00Z',
    source: '隔离文档关联依据', content: '当前条目的整理文件关联已核对。', related_ids: relatedIds,
    journey_document: { entry_id: entryId, file } };
  state.records.push(record);
  await writeFile(fx.stateFile, JSON.stringify(state, null, 2));
  return record;
}

test('journey document link adds the saved summary without changing the original, entry ID or either legacy journey', async () => {
  const fx = await documentFixture();
  const before = await fx.bridge.call('bootstrap', { asOf: '2026-10-04' });
  const legacyBefore = await Promise.all(['legacy-life-20261003', 'legacy-idea-20260910'].map(id => fx.bridge.call('detail', { id })));
  const original = (await fx.bridge.call('detail', { id: fx.input.entry.id })).entry;
  assert.equal(original.content, fx.input.entry.content);
  assert.equal(original.contentKind, 'user_original');
  const document = '# 10 月 4 日\n\n## 发生了什么\n刷了科目四，休息后与朋友游戏。\n\n## 本人原话\n' + fx.input.entry.content + '\n## 本人感受\n国庆期待与实际节奏有落差。\n\n## AI 理解\n环境可能有影响，仍待更多经历核对。\n';
  await writeFile(path.join(fx.root, fx.file), document);
  // Merely creating a similarly named document must not bind it to a journey.
  assert.deepEqual((await fx.bridge.call('detail', { id: fx.input.entry.id })).entry, original);
  const state = JSON.parse(await readFile(fx.stateFile, 'utf8'));
  state.records.push(
    { id: 'F-document-feeling', kind: 'user_feeling', source: 'fixture本人感受', received_at: '2026-10-04T12:00:00Z', content: '国庆期待与实际节奏有落差。', related_ids: [fx.input.entry.id] },
    { id: 'A-document-inference', kind: 'ai_inference', source: 'fixtureAI理解', received_at: '2026-10-04T12:00:00Z', content: '环境可能有影响，仍待更多经历核对。', related_ids: [fx.input.entry.id] }
  );
  await writeFile(fx.stateFile, JSON.stringify(state, null, 2));
  const relation = await appendDocumentAssociation(fx, { relatedIds: [fx.input.entry.id, 'F-document-feeling', 'A-document-inference'] });
  const unchangedState = await readFile(fx.stateFile);
  const detail = await fx.bridge.call('detail', { id: fx.input.entry.id });
  assert.equal(detail.entry.id, fx.input.entry.id);
  assert.equal(detail.entry.content, document);
  assert.equal(detail.entry.contentKind, 'mixed_document');
  assert.equal(detail.entry.originalContent, fx.input.entry.content);
  assert.equal(detail.entry.preview, original.preview);
  assert.deepEqual(detail.entry.recordIds, [fx.input.entry.id, relation.id, 'F-document-feeling', 'A-document-inference']);
  assert.deepEqual(detail.entry.sourceFiles.map(item => item.path), [fx.file]);
  assert.deepEqual(detail.warnings, []);
  const list = await fx.bridge.call('list', { date: '2026-10-04', query: '国庆期待' });
  assert.equal(list.matched, 1);
  assert.equal(list.entries[0].contentKind, 'mixed_document');
  assert(!('content' in list.entries[0]));
  assert(!('originalContent' in list.entries[0]));
  const after = await fx.bridge.call('bootstrap', { asOf: '2026-10-04' });
  assert.equal(after.journeys.length, before.journeys.length);
  assert.deepEqual(after.journeys.filter(item => item.id.startsWith('legacy-')), before.journeys.filter(item => item.id.startsWith('legacy-')));
  for (const previous of legacyBefore) assert.deepEqual(await fx.bridge.call('detail', { id: previous.entry.id }), previous);
  const review = await fx.bridge.call('review', { since: '2026-10-04', until: '2026-10-04' });
  assert.equal(review.journeys.length, 1);
  for (const key of detail.entry.recordIds) assert(review.evidence.some(item => item.id === key));
  assert.deepEqual(await readFile(fx.stateFile), unchangedState);
  const retry = await fx.bridge.call('save', fx.input);
  assert.equal(retry.duplicate, true);
  assert.equal(retry.entry.id, fx.input.entry.id);
  assert.equal(retry.entry.content, document);
  assert.equal(retry.entry.originalContent, fx.input.entry.content);
  assert.deepEqual(await readFile(fx.stateFile), unchangedState);
  assert.equal(JSON.parse(await readFile(fx.stateFile, 'utf8')).records.filter(item => item.id === fx.input.entry.id).length, 1);
  const savedOriginal = JSON.parse(unchangedState).records.find(item => item.id === fx.input.entry.id);
  assert.equal(savedOriginal.content, fx.input.entry.content);
  assert.equal(savedOriginal.kind, 'user_report');
  assert.equal(await readFile(path.join(fx.root, fx.file), 'utf8'), document);
  for (const [relative, content] of Object.entries(fx.originals)) assert.equal(await readFile(path.join(fx.root, relative), 'utf8'), content);
});

test('journey document link needs an observed association to this exact original, and AI or unlinked metadata cannot replace it', async () => {
  for (const kind of ['ai_inference', 'unlinked']) {
    const fx = await documentFixture();
    await writeFile(path.join(fx.root, fx.file), '# 无权替换这条原话\n');
    await appendDocumentAssociation(fx, kind === 'unlinked'
      ? { relatedIds: ['R-20261003-daily-life'] }
      : { kind });
    const before = await readFile(fx.stateFile);
    const detail = await fx.bridge.call('detail', { id: fx.input.entry.id });
    assert.equal(detail.entry.content, fx.input.entry.content);
    assert.equal(detail.entry.contentKind, 'user_original');
    assert.equal(detail.entry.originalContent, fx.input.entry.content);
    assert.deepEqual(detail.entry.recordIds, [fx.input.entry.id]);
    assert.deepEqual(await readFile(fx.stateFile), before);
  }
});

test('journey document missing or outside-path links return exact original and a warning while old entries stay readable', async () => {
  const cases = ['missing', 'traversal', 'absolute', 'junction', 'other-type', 'invalid-type', 'invalid-path'];
  for (const condition of cases) {
    const fx = await documentFixture();
    const outside = path.join(fx.projectRoot, 'outside.md');
    await writeFile(outside, '工作区外部内容，不得读入旅程。');
    await writeFile(path.join(fx.root, fx.file), '# 工作区内整理\n');
    if (condition === 'junction') {
      const external = path.join(fx.projectRoot, 'external-docs');
      await mkdir(external);
      await writeFile(path.join(external, 'outside.md'), '通过目录链接越界的内容，不得读入旅程。');
      await symlink(external, path.join(fx.root, 'linked-docs'), 'junction');
    }
    const file = condition === 'missing' ? '依据/missing.md'
      : condition === 'traversal' ? '../outside.md'
        : condition === 'absolute' ? path.join(fx.root, fx.file)
          : condition === 'junction' ? 'linked-docs/outside.md'
            : condition === 'other-type' ? '依据/原始转写/2026-09-10_短片灵感_原始转写.txt'
              : condition === 'invalid-path' ? '依据/invalid\0.md' : { path: fx.file };
    await appendDocumentAssociation(fx, { file });
    const unchangedState = await readFile(fx.stateFile);
    const detail = await fx.bridge.call('detail', { id: fx.input.entry.id });
    assert.equal(detail.entry.content, fx.input.entry.content, condition);
    assert.equal(detail.entry.contentKind, 'user_original', condition);
    assert.equal(detail.entry.originalContent, fx.input.entry.content, condition);
    assert.equal(detail.warnings.length, 1, condition);
    assert.equal(detail.warnings[0].id, fx.input.entry.id);
    assert(detail.warnings[0].message.includes('当前显示完整原话'));
    assert.deepEqual(detail.entry.sourceFiles, []);
    const list = await fx.bridge.call('list');
    assert.equal(list.entries.length, 3);
    assert(list.warnings.some(item => item.id === fx.input.entry.id));
    assert.equal((await fx.bridge.call('detail', { id: 'legacy-life-20261003' })).entry.content, fx.originals['依据/2026-10-03_生活记录与反思.md']);
    assert.deepEqual(await readFile(fx.stateFile), unchangedState);
    assert.equal(await readFile(outside, 'utf8'), '工作区外部内容，不得读入旅程。');
  }
});
