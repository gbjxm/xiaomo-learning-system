import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdir, mkdtemp, readFile, writeFile, copyFile, readdir } from 'node:fs/promises';
import { createNavigationBridge, DEFAULT_LEARNING_ROOT, DEFAULT_NAVIGATION_ROOT } from './bridge.mjs';

const AS_OF = '2026-10-04';
async function fixture() {
  const parent = path.join(DEFAULT_LEARNING_ROOT, '验证', '领航资料-隔离测试');
  await mkdir(parent, { recursive: true });
  const projectRoot = await mkdtemp(path.join(parent, 'run-')), root = path.join(projectRoot, 'room');
  for (const name of ['tools', '状态', '依据', '.agents/skills/navigate-personal-development']) await mkdir(path.join(root, name), { recursive: true });
  await mkdir(path.join(projectRoot, '运行记录'));
  for (const name of ['room.py', 'continuity.py']) await copyFile(path.join(DEFAULT_NAVIGATION_ROOT, 'tools', name), path.join(root, 'tools', name));
  const sources = new Map([
    [path.join(projectRoot, '运行记录/个人情况.md'), '# 个人情况\n\n## 关于我（2026-09-24 自述）\n- 我现在是学生。\n- 我学习数字媒体艺术。\n\n## 使用偏好（2026-09-24）\n- 我喜欢自然交流。\n\n## 当前现实（2026-10-03）\n- 当前每周时间仍待确定。\n\n## 更新方式\n- 维护规则不是个人特点。\n'],
    [path.join(root, '当前处境.md'), '# 当前处境\n\n## 本次已明确\n- 本轮建设范围不是个人条目。\n\n## 背景与方向：2026-09-24 自述\n- 我在探索自己的方向。\n\n## 使用与生活偏好\n来源：2026-09-24 本人自述。\n\n- 休息也有价值。\n\n## 尚未建立的判断\n技术状态说明不进入资料。\n'],
    [path.join(root, '人生罗盘.md'), '# 人生罗盘\n\n## 当前明确的系统期待\n- 项目需要一个入口。\n\n## 已有表达：2026-09-24\n- 我在意创作自主性。\n\n## 更新方式\n- 只说明维护方法。\n']
  ]);
  for (const [file, content] of sources) await writeFile(file, content, 'utf8');
  await writeFile(path.join(root, '依据/2026-09-10_短片灵感_机器人与AI内部世界.md'), '# 隔离旧灵感\n\n我想到了一个机器人世界。\n');
  await writeFile(path.join(root, '.agents/skills/navigate-personal-development/SKILL.md'), '隔离技能。模型只读，不自动执行。');
  const common = { occurred_on: '2026-09-24', received_at: '2026-09-24T10:00:00+00:00', source: '隔离本人原话' };
  const records = [
    { ...common, id: 'R-old', kind: 'user_report', content: '我目前住在学校。' },
    { ...common, id: 'R-feeling', kind: 'user_feeling', content: '我当时有些疲劳。' },
    { ...common, id: 'R-20260910-robot-ai-world-idea', kind: 'user_report', content: '我想到了一个机器人世界。', occurred_on: '2026-09-10' },
    { ...common, id: 'R-maintenance', kind: 'user_report', content: '本轮先做模块接入。', source: '隔离建设范围' },
    { ...common, id: 'R-observed', kind: 'observed', content: '隔离工具检查通过。' },
    { id: 'A-old', kind: 'ai_inference', content: '也许有一个卡点，仍待核对。', source: '旧AI回看', received_at: '2026-10-03T18:00:00+00:00', related_ids: ['R-old'] }
  ];
  const routes = [{ id: 'P-adopted', kind: 'phase', status: 'adopted', title: '隔离采用阶段', purpose: '测试只读展示，不是小陌的真实目标。', source: 'fixture', basis_ids: ['R-old'],
    actions: [{ id: 'ACT-one', text: '一个隔离行动', system: 'learning', expected_return: '文字反馈', status: 'pending', depends_on: [] }],
    commitments: [], review: { question: '是否接续', on_request: true }, history: [], reviews: [], user_basis: '隔离明确选择', created_at: '2026-10-03T10:00:00+00:00' }];
  const state = { schema: 'xiaomo.navigation-state/v2', revision: 5, updated_at: '2026-10-03T12:00:00+00:00', focus: { text: '隔离资料测试', basis: 'fixture', history: [] },
    decisions: [], resources: [], routes, applied_events: [], records };
  const stateFile = path.join(root, '状态/领航状态.json');
  await writeFile(stateFile, JSON.stringify(state, null, 2));
  const bridge = createNavigationBridge({ projectRoot, env: { ...process.env, WORKSPACE_MODE: 'isolated', NAVIGATION_ROOT: root } });
  return { projectRoot, root, stateFile, sources, state, call: bridge.call };
}
const items = profile => profile.sections.flatMap(section => section.items);
const request = (profile, fields = {}) => ({ identity: profile.identity, eventId: 'E-profile-one', expectedRevision: profile.revision, id: 'R-profile-one', sectionId: 'about', content: '  我现在已经毕业了。\n原话保留。  ', asOf: AS_OF, ...fields });

test('profile GET reuses dated personal sources, excludes maintenance/AI, adopted stage is read-only and GET writes nothing', async () => {
  const f = await fixture(), before = await readFile(f.stateFile), filesBefore = await readdir(path.dirname(f.stateFile));
  const profile = await f.call('profile', { asOf: AS_OF });
  assert.deepEqual(profile.sections.map(s => s.id), ['about', 'values', 'current']);
  const all = items(profile), old = all.find(item => item.text === '我现在是学生。');
  assert.equal(old.kind, 'source_summary'); assert.equal(old.sourceDate, '2026-09-24'); assert.equal(old.canCorrect, true);
  assert(all.some(item => item.text === '我在意创作自主性。' && item.sectionId === 'values'));
  assert(!all.some(item => /维护规则|本轮建设范围|技术状态说明|项目需要一个入口|本轮先做模块接入/.test(item.text)));
  assert(!all.some(item => item.kind === 'ai_inference' || item.kind === 'observed'));
  assert(!all.some(item => ['R-old', 'R-feeling', 'R-20260910-robot-ai-world-idea'].includes(item.id)));
  assert.equal(profile.analyses[0].id, 'A-old'); assert.equal(profile.analyses[0].kind, 'ai_inference');
  assert.equal(all.find(item => item.kind === 'adopted_stage').canCorrect, false);
  assert.deepEqual(await readFile(f.stateFile), before); assert.deepEqual(await readdir(path.dirname(f.stateFile)), filesBefore);
  for (const [file, content] of f.sources) assert.equal(await readFile(file, 'utf8'), content);
});

test('source metadata stays out of personal entries and recent file updates do not replace section dates', async () => {
  const f = await fixture(), file = [...f.sources.keys()][0];
  await writeFile(file, '# 个人情况\n\n初始资料日期：2026-09-23；最近补充：2026-09-30。来源：本人表达。本页未作能力认证。\n\n## 使用偏好\n- 我喜欢简短交流。\n\n## 背景（2026-09-24 自述）\n- 我学数字媒体。\n\n## 兴趣\n来源：本人在2026-09-25的自述。\n\n- 我喜欢看电影。\n');
  const p = await f.call('profile', { asOf: AS_OF }), all = items(p);
  assert(!all.some(item => item.text.includes('初始资料日期：')));
  const initial = all.find(item => item.text === '我喜欢简短交流。');
  assert.equal(initial.sourceDate, '2026-09-23'); assert(initial.dateBasis.includes('不等于经历日期'));
  assert.equal(initial.sourceRef.lastUpdatedDate, '2026-09-30');
  assert.equal(all.find(item => item.text === '我学数字媒体。').sourceDate, '2026-09-24');
  assert.equal(all.find(item => item.text === '我喜欢看电影。').sourceDate, '2026-09-25');
});

test('profile supplement preserves exact words, CAS, idempotent retry and all previous state', async () => {
  const f = await fixture(), profile = await f.call('profile', { asOf: AS_OF }), input = request(profile);
  await assert.rejects(f.call('profile-correction', { ...input, expectedRevision: 0 }), { code: 'NAV_REVISION_CONFLICT' });
  const saved = await f.call('profile-correction', input);
  assert.equal(saved.saved, true); assert.equal(saved.revision, 6); assert.equal(saved.correction.text, input.content); assert.equal(saved.correction.kind, 'user_report');
  assert.equal(saved.correction.targetId, null); assert.equal(saved.correction.changeType, 'supplement');
  assert.equal((await f.call('profile-correction', input)).duplicate, true);
  await assert.rejects(f.call('profile-correction', { ...input, content: '不同原话' }), { code: 'NAV_CORRECTION_CONFLICT' });
  const after = JSON.parse(await readFile(f.stateFile, 'utf8'));
  assert.deepEqual(after.records.slice(0, f.state.records.length), f.state.records);
  assert.deepEqual(after.routes, f.state.routes); assert.deepEqual(after.decisions, f.state.decisions);
  assert.equal(after.records.at(-1).content, input.content); assert.equal(after.records.at(-1).occurred_on, AS_OF);
  assert(!after.records.at(-1).journey); assert.equal(items(saved.profile).find(item => item.text === '我现在是学生。').current, true);
});

test('targeted source correction marks only that paragraph historical and is immediately used by context and model prompt', async () => {
  const f = await fixture(), profile = await f.call('profile', { asOf: AS_OF });
  const target = items(profile).find(item => item.text === '我现在是学生。');
  const input = request(profile, { targetId: target.id }), saved = await f.call('profile-correction', input);
  const all = items(saved.profile), historical = all.find(item => item.id === target.id);
  assert.equal(historical.current, false); assert.equal(historical.canCorrect, false); assert.deepEqual(historical.supersededBy, [input.id]);
  assert.equal(all.find(item => item.text === '我学习数字媒体艺术。').current, true);
  const prompt = await f.call('prompt', { message: '我的当前情况是什么？', mode: 'chat', asOf: AS_OF });
  assert(prompt.pack.context.profile.includes(input.content)); assert(!prompt.pack.context.profile.includes('我现在是学生。'));
  assert(prompt.profileEvidence.some(r => r.id === input.id)); assert(prompt.sourceRefs.some(r => r.id === input.id));
  assert(prompt.pack.context.profile.indexOf(input.content) < prompt.pack.context.profile.indexOf('我学习数字媒体艺术。'), 'latest correction must precede potentially clipped source summaries');
  const learning = prompt.background.find(item => item.path === '运行记录/个人情况.md');
  assert(learning.content.includes('我学习数字媒体艺术。')); assert(!learning.content.includes('我现在是学生。'));
  assert((await f.call('context', { asOf: AS_OF })).profile.includes(input.content));
  for (const [file, content] of f.sources) assert.equal(await readFile(file, 'utf8'), content);
});

test('correction chains retain history and exact retry after a later correction does not create duplicates', async () => {
  const f = await fixture(), profile = await f.call('profile', { asOf: AS_OF });
  const target = items(profile).find(item => item.text === '我现在是学生。'), first = request(profile, { targetId: target.id });
  const saved = await f.call('profile-correction', first);
  const second = request(saved.profile, { eventId: 'E-profile-two', id: 'R-profile-two', targetId: first.id, content: '我补充一下：毕业手续还未办完。' });
  const latest = await f.call('profile-correction', second);
  assert.equal(items(latest.profile).find(item => item.id === first.id).current, false);
  assert.equal(latest.correction.current, true);
  const beforeRetry = await readFile(f.stateFile);
  const retry = await f.call('profile-correction', first); assert.equal(retry.duplicate, true); assert.equal(retry.correction.current, false);
  assert.deepEqual(await readFile(f.stateFile), beforeRetry);
  const state = JSON.parse(beforeRetry); assert.equal(state.records.at(-1).corrects_id, first.id);
  assert(!state.records.at(-1).profile.target.target, 'source snapshot must not recursively embed entire correction chains');
});

test('foreign identity, AI/stage targets, another category, free paths, malformed dates and invalid input all reject without writes', async () => {
  const f = await fixture(), profile = await f.call('profile', { asOf: AS_OF }), input = request(profile), before = await readFile(f.stateFile);
  const source = items(profile).find(item => item.text === '我现在是学生。'), stage = items(profile).find(item => item.kind === 'adopted_stage');
  for (const patch of [
    { identity: 'another-room' }, { targetId: 'A-old' }, { targetId: stage.id, sectionId: 'current' }, { targetId: source.id, sectionId: 'values' },
    { targetId: '../当前处境.md' }, { filePath: '当前处境.md' }, { sectionId: 'all' }, { content: ' ' }, { content: '字'.repeat(8001) },
    { asOf: '2026-02-30' }, { asOf: undefined }, { expectedRevision: true }
  ]) await assert.rejects(f.call('profile-correction', { ...input, ...patch }));
  await assert.rejects(f.call('profile', {}), { code: 'NAV_INVALID_INPUT' });
  assert.deepEqual(await readFile(f.stateFile), before);
});

test('changed Markdown target is rejected, while a committed retry keeps its source snapshot and original file untouched', async () => {
  const f = await fixture(), profile = await f.call('profile', { asOf: AS_OF }), target = items(profile).find(item => item.text === '我现在是学生。');
  const file = [...f.sources.keys()][0], input = request(profile, { targetId: target.id }), before = await readFile(f.stateFile);
  await writeFile(file, f.sources.get(file).replace('我现在是学生。', '原系统后来新增了另一种表述。'));
  await assert.rejects(f.call('profile-correction', input), { code: 'NAV_PROFILE_TARGET_CHANGED' });
  assert.deepEqual(await readFile(f.stateFile), before);
  await writeFile(file, f.sources.get(file)); await f.call('profile-correction', input);
  const changed = f.sources.get(file).replace('我现在是学生。', '原系统已经独立更新。'); await writeFile(file, changed);
  const retry = await f.call('profile-correction', input); assert.equal(retry.duplicate, true);
  const old = items(retry.profile).find(item => item.id === target.id); assert.equal(old.current, false); assert.equal(old.sourceChanged, true);
  assert.equal(await readFile(file, 'utf8'), changed);
});

test('profile additions use same-kind core corrections; old reports, ideas and feelings remain journey evidence', async () => {
  const f = await fixture(), profile = await f.call('profile', { asOf: AS_OF });
  for (const targetId of ['R-feeling', 'R-old', 'R-20260910-robot-ai-world-idea']) {
    await assert.rejects(f.call('profile-correction', request(profile, { targetId, sectionId: 'current' })), { code: 'NAV_PROFILE_TARGET_READ_ONLY' });
  }
  const initial = await f.call('profile-correction', request(profile, { sectionId: 'current', content: '我现在住在学校。' }));
  const saved = await f.call('profile-correction', request(initial.profile, { eventId: 'E-profile-two', id: 'R-profile-two', targetId: 'R-profile-one', sectionId: 'current', content: '我现在住在家里。' }));
  const state = JSON.parse(await readFile(f.stateFile, 'utf8')); assert.equal(state.records.at(-1).corrects_id, 'R-profile-one');
  assert.equal(state.records.at(-1).kind, 'user_report'); assert.equal(items(saved.profile).find(item => item.id === 'R-profile-one').current, false);
  assert.deepEqual(state.records.find(r => r.id === 'A-old'), f.state.records.find(r => r.id === 'A-old'));
  const prompt = await f.call('prompt', { message: '回看我的旧灵感', mode: 'review', asOf: AS_OF });
  assert(prompt.pack.evidence.some(item => item.id === 'R-20260910-robot-ai-world-idea' && item.content === '我想到了一个机器人世界。'));
  assert(prompt.pack.journeys.some(item => item.id === 'legacy-idea-20260910'));
  assert(!prompt.pack.context.profile.includes('机器人世界'));
  assert(!items(saved.profile).some(item => item.id === 'R-20260910-robot-ai-world-idea'));
});

test('old AI analyses remain queryable and explicitly inference; their saved dates are converted to client timezone', async () => {
  const f = await fixture(), before = await readFile(f.stateFile);
  const result = await f.call('analyses', { since: AS_OF, until: AS_OF, query: '卡点' });
  assert.equal(result.matched, 1); assert.equal(result.entries[0].id, 'A-old'); assert.equal(result.entries[0].sourceDate, AS_OF);
  assert.equal(result.entries[0].kind, 'ai_inference'); assert.deepEqual(await readFile(f.stateFile), before);
  await f.call('analysis', { eventId: 'E-old-protocol', expectedRevision: 5, id: 'A-new', content: '旧协议明确保存的AI理解。', relatedIds: ['R-old'] });
  assert((await f.call('analyses', {})).entries.some(item => item.id === 'A-new' && item.kind === 'ai_inference'));
  assert(!items(await f.call('profile', { asOf: '2099-12-31' })).some(item => item.id === 'A-new'));
});

test('original journey protocol remains independent and a client-date profile read does not apply future corrections', async () => {
  const f = await fixture(), p = await f.call('profile', { asOf: AS_OF }), target = items(p).find(item => item.text === '我现在是学生。');
  await f.call('profile-correction', request(p, { targetId: target.id, asOf: '2026-10-05' }));
  const historical = await f.call('profile', { asOf: AS_OF }); assert.equal(items(historical).find(item => item.id === target.id).current, true);
  const current = await f.call('profile', { asOf: '2026-10-05' }); assert.equal(items(current).find(item => item.id === target.id).current, false);
  const saved = await f.call('save', { eventId: 'E-journey-compat', expectedRevision: 6, entry: { id: 'J-compat', title: '', date: AS_OF, type: 'note', content: '  原旅程协议的原话。  ' } });
  assert.equal(saved.entry.content, '  原旅程协议的原话。  ');
  assert((await f.call('list', {})).entries.some(item => item.id === 'J-compat'));
  assert(!(await f.call('list', {})).entries.some(item => item.id === 'R-profile-one'));
  assert(!items(await f.call('profile', { asOf: AS_OF })).some(item => item.id === 'J-compat'));
});

test('concurrent profile additions do not overwrite each other and a deliberate retry uses the new revision', async () => {
  const f = await fixture(), p = await f.call('profile', { asOf: AS_OF });
  const inputs = [request(p, { eventId: 'E-parallel-a', id: 'R-parallel-a' }), request(p, { eventId: 'E-parallel-b', id: 'R-parallel-b', content: '另一条本人补充。' })];
  const results = await Promise.allSettled(inputs.map(input => f.call('profile-correction', input)));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  const failed = results.findIndex(r => r.status === 'rejected');
  assert(['NAV_REVISION_CONFLICT', 'NAV_WRITE_BUSY'].includes(results[failed].reason.code));
  const fresh = await f.call('profile', { asOf: AS_OF }); await f.call('profile-correction', { ...inputs[failed], expectedRevision: fresh.revision });
  const state = JSON.parse(await readFile(f.stateFile, 'utf8'));
  for (const input of inputs) assert.equal(state.records.find(r => r.id === input.id).content, input.content);
  assert.deepEqual(state.records.slice(0, f.state.records.length), f.state.records);
});
