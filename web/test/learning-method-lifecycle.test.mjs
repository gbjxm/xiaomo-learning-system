import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { LearningRepository, LEARNING_ROOT, SUMMARY_FILES } from '../learning/records.mjs';
import { LearningCommitter } from '../learning/commit.mjs';
import { buildLearningContext } from '../learning/context.mjs';
import { validateUpdates } from '../learning/protocol.mjs';
import { LearningCoordinator } from '../learning/coordinator.mjs';
import { runLearningCLI } from '../learning/cli.mjs';

const VALUE = '先写一个具体行动再比较';
const base = extra => ({ version: 1, saveReason: 'review', task: {}, facts: [], observations: [], candidates: [], adoptedChanges: [], ...extra });
const blocks = stage => [...stage.matchAll(/<!-- learning-method:v1 ([A-Za-z0-9+/=]+) -->/g)].map(match => JSON.parse(Buffer.from(match[1], 'base64').toString('utf8')));
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'learning-method-lifecycle-'));
  t.after(async () => { assert.equal(path.dirname(root), path.resolve(os.tmpdir())); await fs.rm(root, { recursive: true, force: true }); });
  await fs.mkdir(path.join(root, '运行记录'), { recursive: true });
  for (const relative of SUMMARY_FILES) await fs.copyFile(path.join(LEARNING_ROOT, relative), path.join(root, relative));
  for (const relative of ['运行约定.md', '建设方案/学习判断契约.md']) {
    await fs.mkdir(path.dirname(path.join(root, relative)), { recursive: true });
    await fs.writeFile(path.join(root, relative), '# 隔离演练约定\n当前用户要求优先；不能把合成演练当本人学习。', 'utf8');
  }
  const repository = new LearningRepository({ projectRoot: root, scope: 'isolated' });
  const committer = new LearningCommitter({ projectRoot: root, scope: 'isolated', repository, now: () => new Date('2026-10-06T06:00:00Z') });
  let counter = 0;
  const save = async (message, updates, task = null) => committer.save({ payload: { requestId: 'method-fixture-' + (++counter), mode: 'progress', message, context: task ? { taskId: task.taskId } : {}, history: [] }, reply: '仅为隔离演练答复，不代表本人学习经历。', kind: 'review', structured: true, updates: base(updates), task, sourceCoverage: [], contextSnapshot: {} });
  const quote = '我采用' + VALUE + '。';
  const first = await save(quote, { task: { title: '合成任务', purpose: '观察人物具体选择', allowedHelp: '文字提示', observationPoints: ['是否有具体选择'] }, adoptedChanges: [{ kind: 'method', quote, value: VALUE }] });
  assert.equal(first.saved, true);
  const stage = async () => fs.readFile(path.join(root, '运行记录/阶段安排.md'), 'utf8');
  return { root, repository, committer, save, stage, task: first.task, method: blocks(await stage())[0] };
}
const reader = { read: async () => ({ sources: [], warnings: [], capabilities: { text: true, image: false, audio: false, video: false } }) };

test('同一方法明确暂停后下次不再作为当前采用项，同 ID 恢复并保留原话与任务', async t => {
  const f = await fixture(t), quote = '先停用' + VALUE + '，它增加了负担，下次不要按它安排。';
  const paused = await f.save(quote, { adoptedChanges: [{ kind: 'method', action: 'pause', methodId: f.method.methodId, value: VALUE, quote }] }, f.task);
  assert.equal(paused.saved, true); assert.equal(paused.task.taskId, f.task.taskId); assert.equal(paused.task.goalRevision, f.task.goalRevision);
  const stage = await f.stage(), current = blocks(stage);
  assert.equal(current.length, 1); assert.equal(current[0].status, 'paused'); assert.equal(current[0].firstQuote, '我采用' + VALUE + '。');
  assert.match(stage, /增加了负担/);
  const snapshot = await f.repository.snapshot({ taskId: f.task.taskId });
  const context = await buildLearningContext({ projectRoot: f.root, snapshot, task: paused.task, payload: { mode: 'plan', message: '帮我安排下一步', context: { taskId: f.task.taskId } }, sourceReader: reader, navigationContextReader: null });
  assert.match(context.systemContext, /已暂停的做法/); assert.match(context.systemContext, /增加了负担/); assert.doesNotMatch(context.systemContext, /仍有效的已采用改进|当前采用的做法/);
  assert.ok(context.systemContext.includes('方法编号 methodId：' + f.method.methodId)); assert.ok(context.systemContext.includes('绑定任务 taskId：' + f.task.taskId));
  assert.doesNotMatch(context.systemContext, /当前状态：已采用，待尝试/);
  const resumeQuote = '我决定恢复' + VALUE + '。';
  const resumed = await f.save(resumeQuote, { adoptedChanges: [{ kind: 'method', action: 'resume', methodId: f.method.methodId, value: VALUE, quote: resumeQuote }] }, paused.task);
  assert.equal(resumed.saved, true); assert.equal(resumed.task.taskId, f.task.taskId); assert.equal(resumed.task.goalRevision, f.task.goalRevision);
  const after = blocks(await f.stage()); assert.equal(after.length, 1); assert.equal(after[0].methodId, f.method.methodId); assert.equal(after[0].status, 'active');
  const activities = await fs.readFile(path.join(f.root, '运行记录/学习记录/2026-10-06.md'), 'utf8');
  assert.ok(activities.includes(quote)); assert.ok(activities.includes(resumeQuote)); assert.match(activities, /用户明确暂停/); assert.match(activities, /用户明确恢复/);
});

test('停用和恢复必须来自本轮明确原话及同任务已有方法，否定假设和旧历史不能变更', async t => {
  const f = await fixture(t), stagePlan = await f.stage();
  const checked = (message, action = 'pause', extra = {}, payloadExtra = {}, task = f.task) => validateUpdates(base({ adoptedChanges: [{ kind: 'method', action, methodId: f.method.methodId, value: VALUE, quote: message, ...extra }] }), { payload: { message, ...payloadExtra }, task, stagePlan });
  assert.equal(checked('请停用' + VALUE + '。').updates.adoptedChanges.length, 1);
  assert.equal(checked('请停用“' + VALUE + '”。').updates.adoptedChanges.length, 1);
  for (const message of ['不要停用' + VALUE + '。', '别暂停' + VALUE + '。', '我不想停用' + VALUE + '。', '如果不合适就停用' + VALUE + '。', '有人说停用' + VALUE + '，我还没决定。']) assert.equal(checked(message).updates.adoptedChanges.length, 0, message);
  assert.equal(checked('恢复' + VALUE + '。', 'resume', { methodId: 'f'.repeat(64) }).updates.adoptedChanges.length, 0);
  assert.equal(checked('停用' + VALUE + '。', 'pause', {}, {}, { ...f.task, taskId: 'task_different' }).updates.adoptedChanges.length, 0);
  assert.equal(checked('请停用' + VALUE + '。', 'pause', { turnId: 'old' }, { message: '继续看看', history: [{ role: 'user', turnId: 'old', content: '请停用' + VALUE + '。' }] }).updates.adoptedChanges.length, 0);
  const twice = checked('请停用' + VALUE + '。');
  assert.deepEqual(validateUpdates(twice.updates, { payload: { message: '请停用' + VALUE + '。' }, task: f.task, stagePlan }).updates, twice.updates);
});

test('网页自然指代暂停唯一做法，CLI 同 ID 恢复；多条指代不猜且不保存优先', async t => {
  const f = await fixture(t), coordinator = new LearningCoordinator({ projectRoot: f.root, scope: 'isolated', repository: f.repository, committer: f.committer, sourceReader: reader, navigationContextReader: null });
  const quote = '这个做法先停用。', change = { kind: 'method', action: 'pause', methodId: f.method.methodId, value: VALUE, quote };
  const payload = { requestId: 'method-web-pause-001', mode: 'chat', message: quote, history: [], context: { taskId: f.task.taskId } };
  const runModel = async () => '这项做法先放下。<learning_updates>' + JSON.stringify(base({ adoptedChanges: [change] })) + '</learning_updates>';
  const paused = await coordinator.handle(payload, { runModel }); assert.equal(paused.body.saved, true); assert.equal(blocks(await f.stage())[0].status, 'paused');
  const resumeQuote = '现在恢复这个做法。', inputFile = path.join(f.root, 'resume.json');
  await fs.writeFile(inputFile, JSON.stringify({ payload: { ...payload, requestId: 'method-cli-resume-001', message: resumeQuote }, reply: '按本次适用条件恢复。', updates: base({ adoptedChanges: [{ ...change, action: 'resume', quote: resumeQuote }] }), structured: true }));
  let output; await runLearningCLI(['commit', '--input', inputFile, '--project-root', f.root, '--scope', 'isolated'], { stdout: value => { output = JSON.parse(value); } });
  assert.equal(output.saved, true); assert.equal(output.task.taskId, f.task.taskId); assert.equal(blocks(await f.stage())[0].status, 'active');
  const noSave = await coordinator.handle({ ...payload, requestId: 'method-web-nosave-001', skipSave: true }, { runModel }); assert.equal(noSave.body.saved, false); assert.equal(blocks(await f.stage())[0].status, 'active');
  const other = '先画人物站位图', otherQuote = '我采用' + other + '。';
  await f.save(otherQuote, { adoptedChanges: [{ kind: 'method', value: other, quote: otherQuote }] }, f.task);
  const stagePlan = await f.stage();
  const ambiguous = validateUpdates(base({ adoptedChanges: [change] }), { payload, task: f.task, stagePlan }); assert.equal(ambiguous.updates.adoptedChanges.length, 0);
  const crossedQuote = '保留' + VALUE + '，停用' + other + '。';
  const crossed = validateUpdates(base({ adoptedChanges: [{ ...change, quote: crossedQuote }] }), { payload: { message: crossedQuote }, task: f.task, stagePlan }); assert.equal(crossed.updates.adoptedChanges.length, 0);
  const onceOnly = '今天先别再按它安排。';
  assert.equal(validateUpdates(base({ adoptedChanges: [{ ...change, quote: onceOnly }] }), { payload: { message: onceOnly }, task: f.task, stagePlan }).updates.adoptedChanges.length, 0);
});

test('本次条件不同和无效反馈只保留依据，不自动暂停方法或更换目标', async t => {
  const f = await fixture(t), message = '今天很累，这次只想听解释，不做练习；上次的做法我还没试。';
  const saved = await f.save(message, {}, f.task);
  assert.equal(saved.task.taskId, f.task.taskId); assert.equal(saved.task.goalRevision, f.task.goalRevision);
  const stage = await f.stage(); assert.equal(blocks(stage)[0].status ?? 'active', 'active'); assert.ok(stage.includes(message));
  const context = await buildLearningContext({ projectRoot: f.root, snapshot: await f.repository.snapshot({ taskId: f.task.taskId }), task: saved.task, payload: { mode: 'question', message }, sourceReader: reader, navigationContextReader: null });
  assert.match(context.systemContext, /当前采用的做法/); assert.match(context.systemContext, /本次不适用.*不.*自动|不.*自动.*本次不适用/);
});

test('含不再采用或暂停的原话不能被抽成正向采用，保留未采用候选边界', () => {
  for (const message of ['我不再采用' + VALUE + '。', '我没有采用' + VALUE + '。', '暂停采用' + VALUE + '。', '如果方便，我采用' + VALUE + '。']) {
    const result = validateUpdates(base({ adoptedChanges: [{ kind: 'method', quote: message, value: VALUE }] }), { payload: { message } });
    assert.equal(result.updates.adoptedChanges.length, 0, message);
  }
});
