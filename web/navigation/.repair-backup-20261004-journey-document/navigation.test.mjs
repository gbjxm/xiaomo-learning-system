import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import { mkdtemp, mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { createNavigationHandler } from './http.mjs';
import { navigationConfiguration, DEFAULT_NAVIGATION_ROOT, DEFAULT_LEARNING_ROOT } from './bridge.mjs';

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
