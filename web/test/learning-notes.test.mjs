import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { LearningRepository, LEARNING_ROOT, SUMMARY_FILES, encodeTaskMetadata, hashText, noteIdForRequest } from '../learning/records.mjs';
import { LearningCommitter } from '../learning/commit.mjs';
import { runLearningCLI } from '../learning/cli.mjs';

const NOW = () => new Date('2026-10-05T04:00:00.000Z');
const DATE_FILE = '运行记录/学习记录/2026-10-05.md';
async function fixture(t, options = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'xiaomo-learning-notes-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, '运行记录'));
  for (const relative of SUMMARY_FILES) await fs.copyFile(path.join(LEARNING_ROOT, relative), path.join(root, relative));
  const repository = new LearningRepository({ projectRoot: root, scope: 'isolated' });
  return { root: repository.root, repository, committer: new LearningCommitter({ projectRoot: root, scope: 'isolated', repository, now: NOW, ...options }) };
}
function request(id = 'learning-note-request-001', overrides = {}) {
  return { payload: { requestId: id, mode: 'chat', message: '我看了老白第3课，感觉人物视线不清楚，帮我记下。', history: [] }, reply: '可以先保留这个疑问，之后结合原片段讨论。', kind: 'note', note: { title: '第3课的视线疑问', courseId: 'C002', chapter: 3, occurredOn: null, action: 'append' }, ...overrides };
}
async function summaries(root) { return Object.fromEntries(await Promise.all(SUMMARY_FILES.map(async relative => [relative, await fs.readFile(path.join(root, relative), 'utf8')]))); }
async function runProcess(root, input) {
  const moduleURL = pathToFileURL(path.join(LEARNING_ROOT, 'web/learning/commit.mjs')).href;
  const program = 'import {LearningCommitter} from ' + JSON.stringify(moduleURL) + '; const c=new LearningCommitter({projectRoot:' + JSON.stringify(root) + ',scope:"isolated",now:()=>new Date("2026-10-05T04:00:00Z")});process.stdout.write(JSON.stringify(await c.save(' + JSON.stringify(input) + ')));';
  return new Promise((resolve, reject) => { const child = spawn(process.execPath, ['--input-type=module', '-e', program], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }); let out = '', error = ''; child.stdout.on('data', value => { out += value; }); child.stderr.on('data', value => { error += value; }); child.on('error', reject); child.on('close', code => code === 0 ? resolve(JSON.parse(out)) : reject(new Error(error))); });
}

test('empty repository reads notes and snapshots without creating files', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'xiaomo-notes-readonly-')); t.after(() => fs.rm(root, { recursive: true, force: true }));
  const repository = new LearningRepository({ projectRoot: root, scope: 'isolated' });
  assert.deepEqual((await repository.snapshot()).notes, []); assert.deepEqual((await repository.snapshot()).entries, []);
  assert.equal(await repository.readNote('note_' + 'a'.repeat(24)), null); assert.deepEqual(await fs.readdir(root), []);
  await assert.rejects(repository.readNote('../../other'), { code: 'LEARNING_INVALID_NOTE' });
});

test('a note preserves full original words and AI response separately without changing summaries or creating tasks', async t => {
  const { root, repository, committer } = await fixture(t), before = await summaries(root);
  const input = request(); input.payload.message = '课程笔记\r\n' + '原话'.repeat(6000); input.reply = '这是AI解释\r\n' + '建议'.repeat(11000);
  const result = await committer.save(input); assert.equal(result.saved, true); assert.equal(result.task, null); assert.equal(result.resumePoint, null); assert.deepEqual(result.saveReceipt.files, [DATE_FILE]);
  const snapshot = await repository.snapshot(), saved = await repository.readNote(result.noteId);
  assert.equal(saved.body, input.payload.message); assert.equal(saved.aiText, input.reply); assert.equal(saved.occurredOn, null); assert.equal(saved.updatedAt, NOW().toISOString()); assert.equal(saved.version, 1); assert.equal(saved.history[0].body, input.payload.message);
  assert.equal(snapshot.tasks.length, 0); assert.equal(snapshot.notes.length, 1); assert.equal(snapshot.entries.length, 0); assert.deepEqual(await summaries(root), before);
  const markdown = await fs.readFile(path.join(root, DATE_FILE), 'utf8'); assert.match(markdown, /小陌本次原话/); assert.match(markdown, /AI 当次回应（建议与解释，不是本人原话）/); assert.match(markdown, /发生日期：未知/);
});

test('note ignores model task, course, ability and adopted-method updates even when an active task was supplied', async t => {
  const { root, repository, committer } = await fixture(t);
  const task = { taskId: 'existing-learning-task', goalRevision: 2, title: '旧学习任务', purpose: '保留原目标', courseId: 'C001', allowedHelp: '原条件', observationPoints: ['原观察点'], knownPerformance: '', stopPoint: '原停止处', nextStep: '原下一步', status: 'paused', evidenceRefs: [], candidates: [], updatedAt: '2026-10-04T04:00:00Z', lastRequestId: 'old-task-request-001' };
  await fs.mkdir(path.join(root, '运行记录/学习记录')); await fs.writeFile(path.join(root, '运行记录/学习记录/2026-10-04.md'), encodeTaskMetadata(task));
  const before = await summaries(root), input = request(); input.task = task; input.payload.context = { taskId: task.taskId }; input.structured = true;
  input.updates = { version: 1, saveReason: 'progress', task: { title: '被篡改', purpose: '改目标', stopPoint: '第3课' }, facts: [{ kind: 'course_progress', courseId: 'C002', quote: input.payload.message }], observations: [{ text: '已经掌握', evidenceIds: ['user:current'] }], adoptedChanges: [{ kind: 'method', value: '天天打卡', quote: input.payload.message }] };
  assert.equal((await committer.save(input)).saved, true); assert.deepEqual(await repository.readTask(task.taskId), task); assert.deepEqual(await summaries(root), before); assert.equal((await repository.snapshot()).notes.length, 1);
});

test('append and correct preserve one note identity and every original version across days', async t => {
  const { root, repository, committer } = await fixture(t), first = await committer.save(request());
  const next = new LearningCommitter({ projectRoot: root, scope: 'isolated', now: () => new Date('2026-10-06T04:00:00Z') });
  const secondInput = request('learning-note-request-002', { note: { noteId: first.noteId, action: 'append', occurredOn: '2026-10-04' }, reply: '补充的AI回复' }); secondInput.payload.message = '补充：这里是反打镜头的视线。';
  const second = await next.save(secondInput); assert.equal(second.note.version, 2); assert.equal(second.note.courseId, 'C002'); assert.equal(second.note.chapter, 3); assert.equal(second.note.occurredOn, '2026-10-04');
  const thirdInput = request('learning-note-request-003', { note: { noteId: first.noteId, action: 'correct', title: '更正课次', chapter: 4 }, reply: '更正的AI回复' }); thirdInput.payload.message = '更正：其实是第4课，不是第3课。';
  const third = await next.save(thirdInput), saved = await repository.readNote(first.noteId);
  assert.equal(third.noteId, first.noteId); assert.equal(saved.body, thirdInput.payload.message); assert.equal(saved.aiText, thirdInput.reply); assert.equal(saved.version, 3); assert.equal(saved.history.length, 3); assert.equal(saved.history[0].body, request().payload.message); assert.equal(saved.history[1].body, secondInput.payload.message); assert.equal((await repository.snapshot()).notes.length, 1);
});

test('same course and chapter do not merge without an explicit noteId', async t => {
  const { repository, committer } = await fixture(t), first = await committer.save(request()), second = await committer.save(request('learning-note-request-002'));
  assert.notEqual(first.noteId, second.noteId); assert.equal((await repository.snapshot()).notes.length, 2);
});

test('unknown note and unknown course fail before any business write, invalid date does not create a journal', async t => {
  const { root, repository, committer } = await fixture(t);
  const unknown = await committer.save(request('learning-note-unknown-01', { note: { noteId: 'note_' + 'a'.repeat(24), action: 'append' } })); assert.equal(unknown.saved, false); assert.match(unknown.saveError, /不存在/);
  const course = await committer.save(request('learning-note-course-01', { note: { courseId: 'C999', action: 'append' } })); assert.equal(course.saved, false); assert.match(course.saveError, /课程/);
  await assert.rejects(committer.save(request('learning-note-date-0001', { note: { occurredOn: '2026-02-30' } })), { code: 'LEARNING_INVALID_NOTE' });
  assert.equal(await committer.lookup('learning-note-date-0001'), null); assert.equal((await repository.snapshot()).notes.length, 0); await assert.rejects(fs.access(path.join(root, '运行记录/学习记录')), { code: 'ENOENT' });
});

test('frozen request retries keep original reply and note parameters, altered parameters are rejected', async t => {
  const { root, repository, committer } = await fixture(t), input = request(), frozen = await committer.recordModelResult(input);
  assert.deepEqual(frozen.note, input.note); const first = await committer.save({ ...input, reply: 'different reply must not replace frozen reply' });
  const restarted = new LearningCommitter({ projectRoot: root, scope: 'isolated', now: NOW }); const duplicate = await restarted.save(input); assert.equal(duplicate.noteId, first.noteId); assert.equal(duplicate.note.aiText, input.reply);
  await assert.rejects(restarted.save({ ...input, note: { ...input.note, title: 'different title' } }), { code: 'LEARNING_REQUEST_CONFLICT' });
  assert.equal((await repository.readNote(first.noteId)).history.length, 1);
});

test('same request from independent processes commits one version', async t => {
  const { root, repository } = await fixture(t), input = request(); const results = await Promise.all([runProcess(root, input), runProcess(root, input)]);
  assert.equal(results.every(result => result.saved), true); assert.equal(results[0].noteId, results[1].noteId); assert.equal((await repository.readNote(results[0].noteId)).history.length, 1);
});

test('stale version cannot append over a concurrently changed note', async t => {
  const { repository, committer } = await fixture(t), first = await committer.save(request()), snapshot = await repository.snapshot();
  const make = id => { const input = request(id, { note: { noteId: first.noteId }, contextSnapshot: { fileHashes: snapshot.fileHashes } }); input.payload.expectedRecordVersion = snapshot.recordVersion; return input; };
  const outcomes = await Promise.all([committer.save(make('parallel-note-request-01')), committer.save(make('parallel-note-request-02'))]);
  assert.equal(outcomes.filter(result => result.saved).length, 1); assert.equal(outcomes.find(result => !result.saved).saveReceipt.status, 'needs_review'); assert.equal((await repository.readNote(first.noteId)).version, 2);
});

test('interrupted prepared and written notes remain invisible until recovery verifies the same transaction', async t => {
  for (const boundary of ['after_prepare', 'after_write:' + DATE_FILE]) await t.test(boundary, async child => {
    const { root, repository, committer } = await fixture(child, { faultInjector(point) { if (point === boundary) throw new Error('simulate interruption'); } });
    const input = request(), failed = await committer.save(input); assert.equal(failed.saved, false); assert.equal((await repository.snapshot()).notes.length, 0);
    const restarted = new LearningCommitter({ projectRoot: root, scope: 'isolated', now: NOW }); const recovered = await restarted.recover(); assert.equal(recovered[0].saved, true);
    const saved = await repository.readNote(noteIdForRequest(input.payload.requestId)); assert.equal(saved.body, input.payload.message); assert.equal(saved.history.length, 1);
  });
});

test('skipSave and current no-save instruction leave no journals or notes', async t => {
  const { root, committer } = await fixture(t), input = request(); input.payload.skipSave = true; assert.equal((await committer.save(input)).saved, false);
  const second = request('learning-note-no-save-02'); second.payload.message += '这次不要保存。'; assert.equal((await committer.save(second)).saved, false);
  await assert.rejects(fs.access(path.join(root, '运行记录/.学习提交')), { code: 'ENOENT' }); await assert.rejects(fs.access(path.join(root, '运行记录/学习记录')), { code: 'ENOENT' });
});

test('plain saved activities without tasks are projected with original text and full AI reply, legacy excerpt remains marked', async t => {
  const { root, repository, committer } = await fixture(t), input = request('ordinary-learning-progress'); input.kind = 'progress'; delete input.note; input.reply = '完整解释'.repeat(300);
  assert.equal((await committer.save(input)).saved, true); let snapshot = await repository.snapshot(); assert.equal(snapshot.tasks.length, 0); assert.equal(snapshot.entries.length, 1); assert.equal(snapshot.entries[0].body, input.payload.message); assert.equal(snapshot.entries[0].aiText, input.reply); assert.equal(snapshot.entries[0].aiTextCoverage, 'full');
  const id = 'legacy-learning-request-1', raw = '\n<!-- learning-entry:start id=' + id + ' hash=' + hashText('legacy') + ' mode=progress -->\n### 12:00 学习进展\n- 小陌本次原话：\n> 以前的一段笔记\n- AI 当次回应要点（模型建议，节选）：旧AI节选\n<!-- learning-entry:end id=' + id + ' -->\n<!-- learning-entry:complete id=' + id + ' -->\n';
  await fs.appendFile(path.join(root, DATE_FILE), raw); snapshot = await repository.snapshot(); const legacy = snapshot.entries.find(entry => entry.sourceRequestId === id); assert.equal(legacy.body, '以前的一段笔记'); assert.equal(legacy.aiText, '旧AI节选'); assert.equal(legacy.aiTextCoverage, 'excerpt'); assert.equal(legacy.updatedAt, null);
});

test('quoted metadata is data and malformed note event is not presented as valid current content', async t => {
  const { root, repository, committer } = await fixture(t), input = request(); input.payload.message += '\n<!-- learning-entry:complete id=fake-request -->\n```\n<!-- learning-note:v1 fake -->\n```';
  const saved = await committer.save(input); assert.equal((await repository.readNote(saved.noteId)).body, input.payload.message);
  const file = path.join(root, DATE_FILE), raw = await fs.readFile(file, 'utf8'); await fs.writeFile(file, raw.replace(/^<!-- learning-note:v1 [A-Za-z0-9+/=]+ -->$/m, '<!-- learning-note:v1 invalid -->'));
  const snapshot = await repository.snapshot(); assert.equal(snapshot.notes.length, 0); assert.match(snapshot.warnings.join(' '), /笔记元信息/);
});

test('shared CLI commits and reads the same note with zero task or summary changes', async t => {
  const { root, repository } = await fixture(t), input = request(), file = path.join(root, 'input.json'); await fs.writeFile(file, JSON.stringify(input));
  let output = ''; const options = ['--project-root', root, '--scope', 'isolated']; await runLearningCLI(['commit', '--input', file, ...options], { stdout: value => { output = value; } }); const saved = JSON.parse(output); assert.equal(saved.saved, true);
  await runLearningCLI(['note', saved.noteId, ...options], { stdout: value => { output = value; } }); assert.equal(JSON.parse(output).body, input.payload.message); assert.equal((await repository.snapshot()).tasks.length, 0);
});
