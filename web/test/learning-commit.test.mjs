import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { LearningRepository, LEARNING_ROOT, SUMMARY_FILES, hashText, encodeTaskMetadata, encodeArtifactMetadata } from '../learning/records.mjs';
import { LearningCommitter } from '../learning/commit.mjs';
import { validateLearningContext } from '../learning/coordinator.mjs';

const NOW = () => new Date('2026-10-03T06:00:00.000Z');
async function fixture(t, options = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'xiaomo-learning-commit-'));
  await fs.mkdir(path.join(root, '运行记录'), { recursive: true });
  for (const relative of SUMMARY_FILES) await fs.copyFile(path.join(LEARNING_ROOT, relative), path.join(root, relative));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const repository = new LearningRepository({ projectRoot: root, scope: 'isolated' });
  return { root: repository.root, repository, committer: new LearningCommitter({ projectRoot: root, scope: 'isolated', repository, now: NOW, ...options }) };
}
const input = (extra = {}) => ({ payload: { requestId: 'commit-request-001', mode: 'progress', message: '我看完了查理的编剧课第七课。', history: [], context: { courseId: 'C001', artifact: { id: 'piece-1', text: '人物把信收回口袋，决定当面说。' } } }, reply: '人物做了一个能改变局面的行动。', kind: 'progress', structured: true, updates: { version: 1, saveReason: 'progress', task: { title: '查理课的文字片段', purpose: '看清人物行动', courseId: 'C001', stopPoint: '第七课', nextStep: '比较另一种决定', evidenceRefs: ['piece-1'] }, facts: [{ kind: 'course_progress', courseId: 'C001', quote: '我看完了查理的编剧课第七课。' }], observations: [{ text: '人物做出了能推动局面的具体选择。', evidenceIds: ['piece-1'], helpLevel: '小陌提供文字，AI给反馈' }], candidates: ['可比较另一个结尾'], adoptedChanges: [] }, sourceCoverage: [{ id: 'course-charlie-7', kind: 'course_note', courseId: 'C001', path: '学习区/查理/第7课.md', heading: '人物行动', hash: 'a'.repeat(64), lines: [10, 40] }], contextSnapshot: {}, ...extra });

test('structured save links one task, exact course row, original evidence, help conditions and resume point', async t => {
  const { root, repository, committer } = await fixture(t), snapshot = await repository.snapshot(), request = input({ contextSnapshot: { fileHashes: snapshot.fileHashes } });
  const originalViewing = await fs.readFile(path.join(root, '运行记录/观影记录.md'), 'utf8');
  const saved = await committer.save(request); assert.equal(saved.saved, true); assert.equal(saved.task.goalRevision, 1); assert.equal(saved.task.courseId, 'C001'); assert.equal(saved.saveReceipt.status, 'committed'); assert.equal(saved.task.evidenceRefs.includes('course-charlie-7'), true);
  const state = await repository.snapshot({ taskId: saved.task.taskId }); assert.equal(state.currentTask.nextStep, '比较另一种决定'); assert.equal(state.courses[0].reportedProgress, '本人自述：我看完了查理的编剧课第七课。'); assert.match(state.courses[1].reportedProgress, /第六或第七节/);
  assert.match(state.abilityEvidence, /帮助条件：小陌提供文字/); assert.doesNotMatch(state.abilityEvidence, /^目前尚无实际学习或练习证据/m); assert.equal(state.sourceCatalog['course-charlie-7'].path, '学习区/查理/第7课.md'); assert.equal(await fs.readFile(path.join(root, '运行记录/观影记录.md'), 'utf8'), originalViewing);
  const stateMarkdown = await fs.readFile(path.join(root, '运行记录/当前状态.md'), 'utf8'); assert.match(stateMarkdown, /^- 当前在学：2026-10-03 本人报告：C001/m); assert.match(stateMarkdown, /^- 能力依据：.*局部AI观察/m);
  const journal = await committer.lookup(request.payload.requestId); assert.equal(journal.reply, request.reply); assert.equal(journal.status, 'committed');
});
test('skipSave and no-save node do not create operational journals or business records', async t => {
  const { root, committer } = await fixture(t);
  const result = await committer.save(input({ payload: { ...input().payload, skipSave: true } })); assert.equal(result.saved, false);
  assert.equal(await committer.recordModelResult(input({ kind: 'none' })), null); assert.equal(await committer.lookup('commit-request-001'), null);
  await assert.rejects(fs.access(path.join(root, '运行记录/.学习提交')), { code: 'ENOENT' }); await assert.rejects(fs.access(path.join(root, '运行记录/学习记录')), { code: 'ENOENT' });
});
test('same request survives restarts without duplicate activity; changed history or task is rejected', async t => {
  const { root, repository, committer } = await fixture(t), request = input(); const first = await committer.save(request);
  const restarted = new LearningCommitter({ projectRoot: root, scope: 'isolated', repository, now: NOW }), second = await restarted.save({ ...request, reply: 'another model response must not replace the frozen result' });
  assert.equal(second.task.taskId, first.task.taskId);
  const record = await fs.readFile(path.join(root, '运行记录/学习记录/2026-10-03.md'), 'utf8'); assert.equal((record.match(/learning-entry:start/g) ?? []).length, 1);
  await assert.rejects(restarted.save({ ...request, payload: { ...request.payload, history: [{ role: 'user', content: '换一门课程' }] } }), /不同内容/);
  await assert.rejects(restarted.save({ ...request, payload: { ...request.payload, context: { ...request.payload.context, taskId: 'task_changed_0001' } } }), /不同内容/);
});
test('crash after atomic activity write is recoverable without regenerating a reply', async t => {
  let thrown = false;
  const { root, repository, committer } = await fixture(t, { faultInjector(point) { if (!thrown && point.startsWith('after_write:运行记录/学习记录')) { thrown = true; throw new Error('simulated crash after rename'); } } });
  const result = await committer.save(input()); assert.equal(result.saved, false); assert.equal(result.saveReceipt.status, 'interrupted'); assert.match(result.saveError, /部分写入/);
  assert.equal((await repository.snapshot()).currentTask, null);
  const fresh = new LearningCommitter({ projectRoot: root, scope: 'isolated', repository, now: NOW }); const recovery = await fresh.recover(); assert.equal(recovery[0].saved, true);
  assert.equal((await repository.snapshot()).tasks.length, 1); assert.equal((await fresh.lookup('commit-request-001')).reply, input().reply);
});
test('third hash during interrupted commit stops recovery and protects another writer', async t => {
  const { root, repository, committer } = await fixture(t, { faultInjector(point) { if (point === 'before_write:运行记录/课程记录.md') throw new Error('simulated interruption'); } });
  const saved = await committer.save(input()); assert.equal(saved.saved, false);
  const course = path.join(root, '运行记录/课程记录.md'); await fs.appendFile(course, '\n另一个Codex已经补了新事实。\n'); const bytes = await fs.readFile(course, 'utf8');
  const fresh = new LearningCommitter({ projectRoot: root, scope: 'isolated', repository, now: NOW }), results = await fresh.recover(); assert.equal(results[0].saveReceipt.status, 'needs_review'); assert.equal(await fs.readFile(course, 'utf8'), bytes);
});
test('model-wait file changes prevent all business writes, and missing state fields are preflight errors', async t => {
  const { root, repository, committer } = await fixture(t), snapshot = await repository.snapshot(); await fs.appendFile(path.join(root, '运行记录/能力依据.md'), '\n新观察。\n');
  const conflict = await committer.save(input({ contextSnapshot: { fileHashes: snapshot.fileHashes } })); assert.equal(conflict.saved, false); assert.equal(conflict.saveReceipt.status, 'needs_review'); await assert.rejects(fs.access(path.join(root, '运行记录/学习记录')), { code: 'ENOENT' });
  const { root: other, committer: second } = await fixture(t); const current = path.join(other, '运行记录/当前状态.md'); await fs.writeFile(current, (await fs.readFile(current, 'utf8')).replace('- 下次入口：', '- 临时入口：'));
  const missing = await second.save(input()); assert.match(missing.saveError, /当前状态检查未通过，本次尚未执行写入/); await assert.rejects(fs.access(path.join(other, '运行记录/学习记录')), { code: 'ENOENT' });
});
test('plain explicit plan remains a pending plan and preserves adopted methods without inventing a task', async t => {
  const { root, repository, committer } = await fixture(t); const stage = path.join(root, '运行记录/阶段安排.md'); await fs.appendFile(stage, '\n- 已采用：画人物站位草图再排对话镜头。\n');
  const response = await committer.save(input({ payload: { ...input().payload, mode: 'plan', message: '帮我安排本周镜头衔接学习。' }, kind: 'plan', structured: false, updates: null, reply: '先选一段，再看对话镜头的轴线。'.repeat(40) }));
  assert.equal(response.saved, true); assert.equal(response.task, null); assert.equal((await repository.snapshot()).tasks.length, 0); assert.match(await fs.readFile(stage, 'utf8'), /本周[\s\S]*待执行/); assert.match(await fs.readFile(stage, 'utf8'), /画人物站位草图/); assert.match(response.state.nextStep, /待执行的本周安排/);
});
test('plain preparation failure can retry a verified label-only repair, without duplicate raw records', async t => {
  const { root, repository, committer } = await fixture(t), file = path.join(root, '运行记录/当前状态.md'), original = await fs.readFile(file, 'utf8');
  await fs.writeFile(file, original.replace('- 下次入口：', '- 临时入口：'));
  const snapshot = await repository.snapshot(), request = input({ structured: false, updates: null, contextSnapshot: { fileHashes: snapshot.fileHashes } });
  const failed = await committer.save(request); assert.equal(failed.saved, false); await assert.rejects(fs.access(path.join(root, '运行记录/学习记录')), { code: 'ENOENT' });
  await fs.writeFile(file, original); const repaired = await committer.save(request); assert.equal(repaired.saved, true);
  const activity = await fs.readFile(path.join(root, '运行记录/学习记录/2026-10-03.md'), 'utf8'); assert.equal((activity.match(/learning-entry:start/g) ?? []).length, 1); assert.match(repaired.warnings.join(' '), /仅栏目名称修复/);
});
test('plain missing-state-field repair may add exactly that line and preserve all other content', async t => {
  const { root, repository, committer } = await fixture(t), file = path.join(root, '运行记录/当前状态.md'), original = await fs.readFile(file, 'utf8');
  await fs.writeFile(file, original.replace(/^- 下次入口：[^\r\n]*\r?\n/m, ''));
  const snapshot = await repository.snapshot(), request = input({ structured: false, updates: null, contextSnapshot: { fileHashes: snapshot.fileHashes } });
  assert.equal((await committer.save(request)).saved, false); await fs.writeFile(file, original);
  assert.equal((await committer.save(request)).saved, true);
});
test('only explicit goal adoption increments goalRevision; narrowing time preserves task and uncertainty', async t => {
  const { repository, committer } = await fixture(t), first = await committer.save(input());
  const secondInput = input({ payload: { ...input().payload, requestId: 'commit-request-002', message: '今天改成半小时。', context: { taskId: first.task.taskId } }, kind: 'plan', task: first.task, updates: { version: 1, saveReason: 'plan', task: { purpose: '别的目标' }, facts: [], observations: [], candidates: ['换个目标'], adoptedChanges: [] } });
  const second = await committer.save(secondInput); assert.equal(second.task.goalRevision, 1); assert.equal(second.task.purpose, first.task.purpose);
  const third = await committer.save(input({ payload: { ...input().payload, requestId: 'commit-request-003', message: '我决定把目标改为人物抉择。', context: { taskId: first.task.taskId } }, task: second.task, updates: { version: 1, saveReason: 'progress', task: { purpose: '人物抉择' }, adoptedChanges: [{ kind: 'goal', quote: '我决定把目标改为人物抉择。', value: '人物抉择' }], observations: [], facts: [], candidates: [] } }));
  assert.equal(third.task.goalRevision, 2); assert.equal(third.task.taskId, first.task.taskId); assert.equal((await repository.readTask(first.task.taskId)).purpose, '人物抉择');
});
test('two independent processes writing one request share the lock and create one event', async t => {
  const { root, repository } = await fixture(t), moduleURL = pathToFileURL(path.join(LEARNING_ROOT, 'web/learning/commit.mjs')).href, request = input();
  const program = 'import {LearningCommitter} from ' + JSON.stringify(moduleURL) + '; const c=new LearningCommitter({projectRoot:' + JSON.stringify(root) + ',scope:"isolated",now:()=>new Date("2026-10-03T06:00:00Z")}); const r=await c.save(' + JSON.stringify(request) + '); process.stdout.write(JSON.stringify({saved:r.saved,status:r.saveReceipt.status}));';
  const run = () => new Promise((resolve, reject) => { const child = spawn(process.execPath, ['--input-type=module', '-e', program], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }); let out = '', error = ''; child.stdout.on('data', data => { out += data; }); child.stderr.on('data', data => { error += data; }); child.on('error', reject); child.on('close', code => code === 0 ? resolve(JSON.parse(out)) : reject(new Error(error))); });
  const results = await Promise.all([run(), run()]); assert.equal(results.every(result => result.saved), true); assert.equal((await repository.snapshot()).tasks.length, 1);
  const activity = await fs.readFile(path.join(root, '运行记录/学习记录/2026-10-03.md'), 'utf8'); assert.equal((activity.match(/learning-entry:start/g) ?? []).length, 1);
});
test('each prepared-write boundary can restart into one fully verified multi-file commit', async t => {
  for (const boundary of ['after_prepare', 'before_write:运行记录/学习记录/2026-10-03.md', 'after_write:运行记录/课程记录.md', 'after_write:运行记录/能力依据.md', 'after_write:运行记录/当前状态.md']) {
    await t.test(boundary, async child => {
      const { root, repository, committer } = await fixture(child, { faultInjector(point) { if (point === boundary) throw new Error('interruption at ' + boundary); } });
      const first = await committer.save(input()); assert.equal(first.saved, false); assert.equal(first.saveReceipt.status, 'interrupted');
      const restarted = new LearningCommitter({ projectRoot: root, scope: 'isolated', repository, now: NOW }); const result = await restarted.recover(); assert.equal(result[0].saved, true); assert.equal((await repository.snapshot()).tasks.length, 1);
      const record = await fs.readFile(path.join(root, '运行记录/学习记录/2026-10-03.md'), 'utf8'); assert.equal((record.match(/learning-entry:start/g) ?? []).length, 1);
    });
  }
});
test('per-request model lease makes two independent processes generate one canonical reply', async t => {
  const { root } = await fixture(t), request = input(), counter = path.join(root, 'mock-generation-count.txt'), moduleURL = pathToFileURL(path.join(LEARNING_ROOT, 'web/learning/commit.mjs')).href;
  const program = 'import fs from "node:fs/promises"; import {LearningCommitter} from ' + JSON.stringify(moduleURL) + '; const request=' + JSON.stringify(request) + '; const c=new LearningCommitter({projectRoot:' + JSON.stringify(root) + ',scope:"isolated",now:()=>new Date("2026-10-03T06:00:00Z")}); const result=await c.withModelLease(request.payload,request.kind,async journal=>{if(!journal){await fs.appendFile(' + JSON.stringify(counter) + ',process.pid+"\\n");await new Promise(r=>setTimeout(r,200));journal=await c.recordModelResult({...request,reply:"canonical-"+process.pid});}const result=await c.save({...request,reply:journal.reply,updates:journal.updates,structured:journal.structured,contextSnapshot:journal.contextSnapshot,sourceCoverage:journal.sourceCoverage});return {reply:journal.reply,saved:result.saved};});process.stdout.write(JSON.stringify(result));';
  const run = () => new Promise((resolve, reject) => { const child = spawn(process.execPath, ['--input-type=module', '-e', program], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }); let out = '', error = ''; child.stdout.on('data', data => { out += data; }); child.stderr.on('data', data => { error += data; }); child.on('error', reject); child.on('close', code => code === 0 ? resolve(JSON.parse(out)) : reject(new Error(error))); });
  const results = await Promise.all([run(), run()]); assert.equal(results.every(r => r.saved), true); assert.equal(results[0].reply, results[1].reply); assert.equal((await fs.readFile(counter, 'utf8')).trim().split('\n').length, 1);
});
test('model lease for no-save executes without creating files, and old empty lock has a clear diagnostic', async t => {
  const { root, committer } = await fixture(t), request = input();
  assert.equal(await committer.withModelLease({ ...request.payload, skipSave: true }, 'progress', async journal => journal === null ? 'no-write' : 'unexpected'), 'no-write');
  await assert.rejects(fs.access(path.join(root, '运行记录/.学习提交')), { code: 'ENOENT' });
  await fs.mkdir(path.join(root, '运行记录/.学习提交')); const lock = path.join(root, '运行记录/.学习提交/.lock'); await fs.writeFile(lock, ''); await fs.utimes(lock, new Date(0), new Date(0));
  await assert.rejects(committer.recordModelResult(request), { code: 'LEARNING_LOCK_OWNER_UNKNOWN' }); assert.equal(await fs.readFile(lock, 'utf8'), '');
});
test('process death before or after complete-owner publication does not leave an empty unrecoverable lock', async t => {
  for (const boundary of ['before_lock_publish:.lock', 'after_lock_publish:.lock', 'after_lock_publish:commit-request-001.model.lock']) await t.test(boundary, async childTest => {
    const { root, committer } = await fixture(childTest), request = input(), moduleURL = pathToFileURL(path.join(LEARNING_ROOT, 'web/learning/commit.mjs')).href;
    const program = 'import {LearningCommitter} from ' + JSON.stringify(moduleURL) + '; const req=' + JSON.stringify(request) + '; const c=new LearningCommitter({projectRoot:' + JSON.stringify(root) + ',scope:"isolated",faultInjector(point){if(point===' + JSON.stringify(boundary) + ')process.exit(71);}});' + (boundary.includes('.model.lock') ? 'await c.withModelLease(req.payload,req.kind,()=>c.recordModelResult(req));' : 'await c.recordModelResult(req);');
    const code = await new Promise((resolve, reject) => { const child = spawn(process.execPath, ['--input-type=module', '-e', program], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] }); let errors = ''; child.stderr.on('data', data => { errors += data; }); child.on('error', reject); child.on('close', value => value === 71 ? resolve(value) : reject(new Error(errors))); }); assert.equal(code, 71);
    const journal = await committer.withModelLease(request.payload, request.kind, existing => existing ?? committer.recordModelResult(request)); assert.equal(journal.status, 'model_complete');
  });
});
test('re-adopting the same method upserts one item while preserving its first adoption and unmarked entries', async t => {
  const { root, committer } = await fixture(t), first = await committer.save(input()), file = path.join(root, '运行记录/阶段安排.md');
  const legacy = '- 旧的无标记采用项：先自由看片；不改变此条。'; await fs.appendFile(file, '\n' + legacy + '\n');
  const value = '先写一个具体行动再比较', originalQuote = '我采用先写一个具体行动再比较。';
  const make = (requestId, message) => input({ payload: { ...input().payload, requestId, mode: 'plan', message, context: { taskId: first.task.taskId } }, kind: 'plan', task: first.task, updates: { version: 1, saveReason: 'plan', task: {}, facts: [], observations: [], candidates: [], adoptedChanges: [{ kind: 'method', quote: message, value }] } });
  assert.equal((await committer.save(make('method-adopt-001', originalQuote))).saved, true);
  assert.equal((await committer.save(make('method-adopt-002', '我还是采用先写一个具体行动再比较。'))).saved, true);
  const stage = await fs.readFile(file, 'utf8'); assert.equal((stage.match(/learning-method:start/g) ?? []).length, 1); assert.match(stage, /首次采用原话：我采用先写一个具体行动再比较。/); assert.match(stage, /首次采用依据：.*method-adopt-001/); assert.match(stage, /最近一次明确采用：.*method-adopt-002/); assert.equal(stage.includes(legacy), true); assert.match(stage, /待尝试/);
});
test('same-task review updates the adopted-method item with actual feedback and preserves unknown effect and causality', async t => {
  const { root, repository, committer } = await fixture(t), first = await committer.save(input()), value = '先写一个具体行动再比较', quote = '我采用先写一个具体行动再比较。';
  const adopted = await committer.save(input({ payload: { ...input().payload, requestId: 'method-review-adopt', mode: 'plan', message: quote, context: { taskId: first.task.taskId } }, task: first.task, kind: 'plan', updates: { version: 1, saveReason: 'plan', task: {}, facts: [], observations: [], candidates: [], adoptedChanges: [{ kind: 'method', quote, value }] } })); assert.equal(adopted.saved, true);
  const feedback = '我改了这段文字，人物决定更具体了。但我没说是否照这个方法做，效果还不确定。';
  const reviewed = await committer.save(input({ payload: { ...input().payload, requestId: 'method-review-result', mode: 'progress', message: feedback, context: { taskId: first.task.taskId, artifact: { id: 'review-piece', text: '她把信收回口袋，决定亲自说出真相。', helpLevel: '小陌修改后，AI进行文字反馈' } } }, kind: 'review', task: adopted.task, updates: { version: 1, saveReason: 'review', task: {}, facts: [], observations: [{ text: '当前文字出现了具体决定。', evidenceIds: ['review-piece'], helpLevel: '小陌修改后，AI进行文字反馈' }], candidates: [], adoptedChanges: [] }, sourceCoverage: [] })); assert.equal(reviewed.saved, true);
  const stage = await fs.readFile(path.join(root, '运行记录/阶段安排.md'), 'utf8'); assert.equal((stage.match(/learning-method:start/g) ?? []).length, 1); assert.match(stage, /首次采用原话：我采用先写一个具体行动再比较。/); assert.match(stage, /最近收到的本人反馈：我改了这段文字/); assert.match(stage, /最近AI局部观察：当前文字出现了具体决定/); assert.match(stage, /本次帮助条件：.*AI进行文字反馈/); assert.match(stage, /最近反馈来源：.*method-review-result/); assert.match(stage, /方法效果与因果未知/); assert.doesNotMatch(stage, /已证明有效|普遍有效果|方法导致了/);
  assert.equal((await repository.readTask(first.task.taskId)).lastRequestId, 'method-review-result'); assert.equal(reviewed.saveReceipt.files.includes('运行记录/阶段安排.md'), true);
});
test('same-task artifact preserves full text, exact source hash and latest version for a fresh reader', async t => {
  const { root, repository, committer } = await fixture(t), originalTask = (await committer.save(input())).task;
  const embedded = encodeTaskMetadata({ ...originalTask, taskId: 'task_inside_user_text', lastRequestId: 'request_inside_text' });
  const text = ('她走到码头，把信收回口袋，决定当面说出真相。\r\n').repeat(80) + '\r\n```markdown\r\n' + embedded + '\r\n```', id = 'user-text:' + hashText(text).slice(0, 20);
  const make = (requestId, version) => input({ payload: { ...input().payload, requestId, message: '这是我修改后的文字，先留在这项任务里。', context: { taskId: originalTask.taskId, artifact: { kind: 'text', text, title: '码头文字原稿', version, authorship: 'user_authored', origin: 'user_provided', helpLevel: '本人编写，AI尚未提供修改' } } }, task: originalTask, updates: { version: 1, saveReason: 'progress', task: {}, facts: [], observations: [], candidates: [], adoptedChanges: [] }, sourceCoverage: [{ id, sourceKind: 'user_text', title: '码头文字原稿', authorship: 'user_authored', origin: 'user_provided', helpLevel: '本人编写，AI尚未提供修改', documentHash: hashText(text) }] });
  assert.equal((await committer.save(make('artifact-preserve-001', 'v1'))).saved, true); const latest = await committer.save(make('artifact-preserve-002', 'v2')); assert.equal(latest.saved, true);
  const fresh = new LearningRepository({ projectRoot: root, scope: 'isolated' }), snapshot = await fresh.snapshot({ taskId: originalTask.taskId }), saved = snapshot.artifactCatalog[originalTask.taskId + ':' + id];
  assert.equal(saved.artifact.text, text); assert.equal(saved.artifact.version, 'v2'); assert.equal(saved.sourceRequestId, 'artifact-preserve-002'); assert.equal(saved.activityFile, '运行记录/学习记录/2026-10-03.md'); assert.equal(snapshot.tasks.length, 1); assert.equal(snapshot.currentTask.evidenceRefs.includes(id), true);
  const activity = await fs.readFile(path.join(root, saved.activityFile), 'utf8'); assert.match(activity, /本次提供的原始文字产物：码头文字原稿/); assert.equal(activity.includes('> ' + embedded), true);
  const sourceLine = activity.split(/\r?\n/)[saved.activityLine - 1]; assert.match(sourceLine, /^<!-- learning-artifact:v1 /);
  const originalFromLine = JSON.parse(Buffer.from(sourceLine.match(/v1 ([A-Za-z0-9+/=]+)/)[1], 'base64').toString('utf8')); assert.equal(originalFromLine.artifact.text, text);
  await fs.appendFile(path.join(root, saved.activityFile), '\n' + encodeArtifactMetadata({ ...saved, id: 'user-text:' + '0'.repeat(20), sourceRequestId: 'artifact-bad-hash' }) + '\n');
  assert.equal((await repository.snapshot()).artifactCatalog[originalTask.taskId + ':user-text:' + '0'.repeat(20)], undefined);
});
test('identical artifact text in different tasks preserves distinct authorship and never certifies an AI draft', async t => {
  const { root, committer } = await fixture(t), text = '她把信收回口袋，决定当面说出真相。', id = 'user-text:' + hashText(text).slice(0, 20);
  const make = (requestId, authorship, title) => input({ payload: { ...input().payload, requestId, message: '请保存这一段的原始文字。', context: { courseId: 'C001', artifact: { kind: 'text', text, title, version: 'v1', authorship, origin: authorship === 'ai_generated' ? 'ai_generated' : 'user_provided', helpLevel: authorship === 'ai_generated' ? '由AI生成，非本人表现' : '本人编写，AI给局部反馈' } } }, updates: { version: 1, saveReason: 'progress', task: { title, purpose: '观察人物具体行动', courseId: 'C001' }, facts: [], observations: [{ text: '当前文字包含一个人物决定。', evidenceIds: [id] }], candidates: [], adoptedChanges: [] }, sourceCoverage: [{ id, sourceKind: 'user_text', authorship, origin: authorship === 'ai_generated' ? 'ai_generated' : 'user_provided', helpLevel: authorship === 'ai_generated' ? '由AI生成，非本人表现' : '本人编写，AI给局部反馈', documentHash: hashText(text) }] });
  const human = await committer.save(make('artifact-human-001', 'user_authored', '本人的文字任务')), ai = await committer.save(make('artifact-ai-draft-001', 'ai_generated', 'AI稿参考任务')); assert.equal(human.saved && ai.saved, true); assert.notEqual(human.task.taskId, ai.task.taskId);
  const snapshot = await new LearningRepository({ projectRoot: root, scope: 'isolated' }).snapshot(); assert.equal(snapshot.artifactCatalog[human.task.taskId + ':' + id].artifact.authorship, 'user_authored'); assert.equal(snapshot.artifactCatalog[ai.task.taskId + ':' + id].artifact.authorship, 'ai_generated'); assert.equal(snapshot.artifactCatalog[id], undefined); assert.equal(ai.task.knownPerformance, '');
});
test('a structured-failure save preserves the existing task and refs while keeping its new original artifact', async t => {
  const { repository, committer } = await fixture(t), oldText = '她把信留在桌上，转身离开。', newText = '她把信收回口袋，决定亲自说出真相。', oldId = 'user-text:' + hashText(oldText).slice(0, 20), newId = 'user-text:' + hashText(newText).slice(0, 20);
  const artifact = text => ({ kind: 'text', text, title: '文字原稿', version: text === oldText ? 'v1' : 'v2', authorship: 'user_authored', origin: 'user_provided', helpLevel: '本人提供，未据此推断独立掌握' });
  const source = (id, text) => [{ id, sourceKind: 'user_text', documentHash: hashText(text), authorship: 'user_authored', origin: 'user_provided' }];
  const first = await committer.save(input({ payload: { ...input().payload, requestId: 'artifact-before-bad-001', context: { courseId: 'C001', artifact: artifact(oldText) } }, sourceCoverage: source(oldId, oldText) })); assert.equal(first.saved, true);
  const failedFormat = await committer.save(input({ payload: { ...input().payload, requestId: 'artifact-after-bad-001', message: '这是新版原稿，先留在同一任务里。', context: { taskId: first.task.taskId, artifact: artifact(newText) } }, task: first.task, structured: false, updates: null, reply: '自然答复保留，结构更新未通过。', sourceCoverage: source(newId, newText) })); assert.equal(failedFormat.saved, true);
  const snapshot = await repository.snapshot({ taskId: first.task.taskId }); assert.deepEqual(snapshot.currentTask, first.task); assert.equal(snapshot.currentTask.evidenceRefs.includes(newId), false);
  const oldArtifact = snapshot.artifactCatalog[first.task.taskId + ':' + oldId], newer = snapshot.artifactCatalog[first.task.taskId + ':' + newId]; assert.equal(newer.artifact.text, newText); assert.equal(newer.sourceRequestId, 'artifact-after-bad-001'); assert.equal(newer.activityFile, oldArtifact.activityFile); assert.equal(newer.activityOffset > oldArtifact.activityOffset, true);
});

test('every API-accepted artifact version roundtrips through saved original material at the 500-character boundary', async t => {
  const { repository, committer } = await fixture(t), text = '断网后另找热点，完成投稿。', id = 'user-text:' + hashText(text).slice(0, 20);
  const version = '版'.repeat(500), artifact = { kind: 'text', title: '连接问题原文', text, version, authorship: 'user_authored' };
  const context = validateLearningContext({ courseId: 'C001', artifact });
  assert.throws(() => validateLearningContext({ artifact: { ...artifact, version: version + '版' } }), /过长/);
  const saved = await committer.save(input({ payload: { ...input().payload, requestId: 'artifact-version-limit', context },
    sourceCoverage: [{ id, sourceKind: 'user_text', documentHash: hashText(text), authorship: 'user_authored' }] }));
  assert.equal(saved.saved, true);
  const snapshot = await repository.snapshot({ taskId: saved.task.taskId });
  assert.equal(snapshot.artifactCatalog[saved.task.taskId + ':' + id].artifact.version, version);
  assert.equal(snapshot.artifactCatalog[saved.task.taskId + ':' + id].artifact.text, text);
});
