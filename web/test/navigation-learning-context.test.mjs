import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { mkdtemp, mkdir, copyFile, writeFile, readFile, readdir } from 'node:fs/promises';
import { readNavigationLearningContext, shouldUseNavigationLearningContext } from '../learning/navigation-context.mjs';
import { createNavigationBridge, DEFAULT_NAVIGATION_ROOT } from '../navigation/bridge.mjs';

const AS_OF = '2026-10-05';
const now = () => new Date('2026-10-04T17:00:00Z'); // Already October 5 in Shanghai.
const root = path.resolve('navigation-provider-synthetic-root');
const baseItem = (fields = {}) => ({ id: 'profile-original', text: '我喜欢自然交流，学习安排保留休息。',
  source: '学习系统 · 个人情况 · 使用偏好', sourceDate: '2026-09-24', dateBasis: '原小节明示日期', kind: 'source_summary',
  current: true, sectionId: 'values', sourceRef: { system: 'learning', sourceId: 'learning-personal', path: '运行记录/个人情况.md', heading: '使用偏好', line: 4 }, ...fields });
const route = (fields = {}) => ({ id: 'P-stage', title: '学习方向', purpose: '先继续镜头衔接', status: 'adopted', kind: 'phase',
  source: '隔离来源', user_basis: '隔离明确选择，不是小陌真实选择', basis_ids: ['R-basis'], created_at: '2026-10-03T12:00:00Z',
  actions: [{ id: 'ACT-stage', text: '继续学习', system: 'learning', expected_return: '本人反馈', status: 'pending', depends_on: [] }], ...fields });
function bridgeFixture({ items = [baseItem()], routes = [route()], revision = 8, contextRevision = revision, warnings = [] } = {}) {
  const calls = [];
  const profile = { identity: 'navigation-isolated-fixture', revision, asOf: AS_OF, sections: [{ id: 'values', items }], corrections: items.filter(item => item.changeType), analyses: [{ kind: 'ai_inference', text: '不应进入学习背景的AI推测' }], warnings };
  const context = { revision: contextRevision, context: { routes: Object.fromEntries(['adopted', 'candidate', 'paused', 'closed', 'superseded'].map(status => [status, routes.filter(item => item.status === status)])), profile: '该已拼接字符串不可整包加载', records: [{ kind: 'ai_inference', content: '不应读取的旅程推测' }] }, profile: '兼容的扁平profile字符串' };
  const bridge = { async call(command, input) { calls.push({ command, input }); return structuredClone(command === 'profile' ? profile : context); } };
  return { bridge, calls, profile, context };
}
const read = (bridge, payload = { mode: 'plan', message: '今天只有二十分钟，帮我安排一下学习。' }, extra = {}) => readNavigationLearningContext({ projectRoot: root, scope: 'isolated', payload, bridge, now, ...extra });
const contentOf = result => result.sources.map(source => source.content).join('\n');

test('pure notes, quoted plans and conceptual chat do not read navigation', async () => {
  const f = bridgeFixture();
  for (const payload of [
    { mode: 'chat', message: '帮我记下：昨晚看了电影。' },
    { mode: 'note', message: '帮我安排学习' },
    { mode: 'question', message: '为什么镜头要遵守轴线？' },
    { mode: 'chat', message: '例如帮我安排今天的学习。' },
    { mode: 'chat', message: '朋友说“帮我安排一下学习”，这里的安排是什么意思？' },
    { mode: 'chat', message: '> 帮我安排一下学习\n这是朋友说的话。' }
  ]) assert.equal((await read(f.bridge, payload)).status, 'not_requested');
  assert.equal(f.calls.length, 0);
});

test('natural planning and explicit navigation requests use the same gate', () => {
  for (const message of ['今天怎么学？', '请帮我重排一下。', '结合我的资料安排下一步', '接下来主攻什么？', '我想调整学习路线。']) assert.equal(shouldUseNavigationLearningContext({ mode: 'chat', message }), true, message);
  assert.equal(shouldUseNavigationLearningContext({ mode: 'plan', message: '只聊不保存，给点安排建议。', skipSave: true }), true);
});

test('current targeted correction replaces historical source without importing AI or candidates', async () => {
  const old = baseItem({ current: false, text: '我每天都能拿出两小时。' });
  const replacement = baseItem({ id: 'R-correction', text: '近期学习只有二十分钟，不要按两小时安排。', kind: 'user_report', sourceDate: AS_OF,
    changeType: 'correction', targetId: old.id, sourceRef: { system: 'navigation', recordId: 'R-correction' }, target: old });
  const f = bridgeFixture({ items: [old, replacement, baseItem({ id: 'AI-one', kind: 'ai_inference', text: '个人能力已掌握。' }), baseItem({ id: 'future', sourceDate: '2026-10-06', text: '未来会有四小时。' })] });
  const result = await read(f.bridge);
  assert.equal(result.status, 'available'); assert.equal(result.replacesLocalProfile, true);
  assert(contentOf(result).includes(replacement.text)); assert(!contentOf(result).includes(old.text));
  assert(!contentOf(result).includes('个人能力已掌握')); assert(!contentOf(result).includes('未来会有四小时'));
  const source = result.sources.find(item => item.recordKind === 'user_report');
  assert.equal(source.targetId, old.id); assert.equal(source.sourceKind, 'personal_context'); assert.equal(source.sourceDate, AS_OF);
  assert.equal(source.authority, 'navigation_user_report'); assert.deepEqual(f.calls.map(call => call.command), ['profile', 'context']);
});

test('context reads do not mutate selected task, overwrite its purpose or turn old capacity into today budget', async () => {
  const task = { taskId: 'task-one', purpose: '检验原稿镜头衔接', allowedHelp: '只给问题，不代写', observationPoints: ['动作连续'], stopPoint: '第二个镜头' };
  const before = structuredClone(task), payload = { mode: 'plan', message: '今天只有二十分钟，继续原任务。' };
  const f = bridgeFixture({ items: [baseItem({ text: '今天我有三小时，可以全部安排学习。', sourceDate: '2026-09-24' })] });
  const result = await read(f.bridge, payload, { task });
  assert.deepEqual(task, before); assert.equal(payload.message, '今天只有二十分钟，继续原任务。');
  assert(contentOf(result).includes('旧时长和资源不是今天可用量')); assert(contentOf(result).includes('只有本人明确改变目标才调整'));
  assert.equal(result.sources[0].sourceDate, '2026-09-24'); assert.equal(result.asOf, AS_OF);
  assert.equal(result.budget, undefined); assert.equal(result.updates, undefined);
});

test('only adopted relevant routes become background, with original adoption and action fields preserved', async () => {
  const f = bridgeFixture({ routes: [route(), route({ id: 'P-candidate', title: '候选学习路线', status: 'candidate' }), route({ id: 'P-paused', title: '暂停学习路线', status: 'paused' }), route({ id: 'P-unrelated', title: '修理花园', purpose: '整理院子', actions: [{ system: 'life', text: '浇水' }] })] });
  const result = await read(f.bridge), shared = result.sources.filter(source => source.recordKind === 'adopted_stage');
  assert.equal(shared.length, 1); assert.equal(shared[0].profileStatus, 'adopted'); assert.deepEqual(shared[0].basisIds, ['R-basis']);
  assert.deepEqual(JSON.parse(shared[0].content).originalRoute.actions, route().actions);
  assert.equal(result.coverage.routeCounts.candidate, 1); assert.equal(result.coverage.routeCounts.paused, 1);
  assert(!contentOf(result).includes('候选学习路线')); assert(contentOf(result).includes('不自动创建学习任务'));
});

test('missing connection is transparent and never triggers initialization or a fallback write', async () => {
  const calls = [], bridge = { async call(command) { calls.push(command); throw Object.assign(new Error('unavailable'), { code: 'NAV_CONNECTION_UNAVAILABLE' }); } };
  const result = await read(bridge);
  assert.equal(result.status, 'unavailable'); assert.equal(result.replacesLocalProfile, false); assert.equal(result.sources.length, 0);
  assert(result.warnings[0].includes('不能声称已核对最新资料更正')); assert.deepEqual(calls, ['profile']);
});

test('missing original learning source cannot silently replace local profile with an incomplete one', async () => {
  const f = bridgeFixture({ warnings: [{ code: 'PROFILE_SOURCE_MISSING', sourceId: 'learning-personal', message: '原学习资料没有读到' }] });
  const result = await read(f.bridge);
  assert.equal(result.status, 'unavailable'); assert.equal(result.replacesLocalProfile, false); assert.equal(f.calls.length, 1);
});

test('a different room revision during reading keeps profile but does not mix route snapshots or block learning', async () => {
  const f = bridgeFixture({ contextRevision: 9 }), result = await read(f.bridge);
  assert.equal(result.status, 'available'); assert.equal(result.coverage.routeStatus, 'unavailable');
  assert(result.sources.some(source => source.recordKind === 'source_summary')); assert(!result.sources.some(source => source.recordKind === 'adopted_stage'));
  assert(result.warnings.some(value => value.includes('版本变化')));
});

test('unrelated journey revisions do not change the fingerprint of the same selected background', async () => {
  const first = await read(bridgeFixture({ revision: 8 }).bridge), second = await read(bridgeFixture({ revision: 9 }).bridge);
  assert.equal(first.fingerprint, second.fingerprint); assert.notEqual(first.revision, second.revision);
});

test('whole items only: excessive text and profile excerpts cannot lose a trailing negation', async () => {
  const long = '时间安排'.repeat(3000) + '，但这不是今天预算。';
  const f = bridgeFixture({ items: [baseItem({ id: 'very-long', text: long }), baseItem({ id: 'excerpted', text: '截断的内容', excerpted: true }), baseItem({ id: 'normal' })] });
  const result = await read(f.bridge);
  assert(result.coverage.characters <= 12000); assert(!contentOf(result).includes('时间安排时间安排')); assert(!contentOf(result).includes('截断的内容'));
  assert(result.coverage.omittedIds.includes('navigation-profile:very-long')); assert.equal(result.coverage.complete, false);
});

test('profile request date uses Shanghai calendar and malformed profile cannot replace known local data', async () => {
  const f = bridgeFixture(); await read(f.bridge); assert.deepEqual(f.calls[0].input, { asOf: AS_OF });
  f.profile.asOf = '2026-10-04'; const result = await read(f.bridge);
  assert.equal(result.status, 'unavailable'); assert.equal(result.replacesLocalProfile, false);
});

test('real isolated bridge reads profile corrections and adopted route without changing any data', async () => {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'xiaomo-navigation-learning-')), room = path.join(projectRoot, 'room');
  for (const folder of ['tools', '状态', '依据']) await mkdir(path.join(room, folder), { recursive: true });
  await mkdir(path.join(projectRoot, '运行记录'));
  for (const name of ['room.py', 'continuity.py']) await copyFile(path.join(DEFAULT_NAVIGATION_ROOT, 'tools', name), path.join(room, 'tools', name));
  const originals = new Map([
    [path.join(projectRoot, '运行记录/个人情况.md'), '# 个人情况\n\n## 使用偏好（2026-09-24）\n- 旧学习偏好：每天两小时。\n'],
    [path.join(room, '当前处境.md'), '# 处境\n\n## 当前学习（2026-10-03）\n- 我在学习镜头衔接。\n'],
    [path.join(room, '人生罗盘.md'), '# 罗盘\n\n## 学习偏好\n- 我在意自主创作。\n']
  ]);
  for (const [file, body] of originals) await writeFile(file, body);
  const adopted = { ...route(), commitments: [], review: { question: '学习安排是否有用', on_request: true }, history: [], reviews: [] };
  const state = { schema: 'xiaomo.navigation-state/v2', revision: 5, updated_at: '2026-10-03T12:00:00Z', focus: { text: '隔离验证', basis: 'fixture', history: [] },
    decisions: [], resources: [], routes: [adopted], applied_events: [], records: [{ id: 'R-basis', kind: 'user_report', content: '隔离明确选择学习方向。', source: '测试原话，不是本人经历', occurred_on: '2026-10-03', received_at: '2026-10-03T12:00:00Z' }] };
  const stateFile = path.join(room, '状态/领航状态.json'); await writeFile(stateFile, JSON.stringify(state));
  const env = { ...process.env, WORKSPACE_MODE: 'isolated', NAVIGATION_ROOT: room };
  const bridge = createNavigationBridge({ projectRoot, env });
  const beforeProfile = await bridge.call('profile', { asOf: AS_OF });
  const target = beforeProfile.sections.flatMap(section => section.items).find(item => item.text.includes('旧学习偏好'));
  await bridge.call('profile-correction', { identity: beforeProfile.identity, eventId: 'E-learning-correction', expectedRevision: beforeProfile.revision,
    id: 'R-learning-correction', sectionId: target.sectionId, targetId: target.id, content: '近期只有二十分钟，不要仍按两小时安排。', asOf: AS_OF });
  const before = await readFile(stateFile), files = await readdir(path.dirname(stateFile));
  const actualContext = await bridge.call('context', { asOf: AS_OF });
  assert.equal(actualContext.context.routes.adopted[0].id, adopted.id); assert.equal(typeof actualContext.profile, 'string');
  const result = await readNavigationLearningContext({ projectRoot, scope: 'isolated', payload: { mode: 'plan', message: '帮我安排学习。' }, now, env });
  assert.equal(result.status, 'available'); assert.equal(result.coverage.routeCounts.adopted, 1);
  assert(contentOf(result).includes('近期只有二十分钟，不要仍按两小时安排。')); assert(!contentOf(result).includes('旧学习偏好：每天两小时。'));
  assert(result.sources.some(source => source.recordKind === 'adopted_stage' && source.scope.routeId === adopted.id));
  assert(result.sources.every(source => source.path === null || path.isAbsolute(source.path)));
  assert.deepEqual(await readFile(stateFile), before); assert.deepEqual(await readdir(path.dirname(stateFile)), files);
  for (const [file, body] of originals) assert.equal(await readFile(file, 'utf8'), body);
});
