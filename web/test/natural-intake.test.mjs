import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { LearningRepository, SUMMARY_FILES, LEARNING_ROOT } from '../learning/records.mjs';
import { LearningCommitter } from '../learning/commit.mjs';
import { NaturalRecordingCoordinator, isNaturalRecording } from '../learning/intake.mjs';
import { ContentStore } from '../content/store.mjs';
import { suppressSave } from '../learning/coordinator.mjs';
import { runLearningCLI } from '../learning/cli.mjs';

const NOW = () => new Date('2026-10-05T03:00:00.000Z');
const NOTE_MESSAGE = '今天看了老白第3课，感觉视线方向一变，人物关系就不清楚了。先把这个疑问记下。';
const NOTE_CAPTURE = { kind: 'learning', title: '学习笔记', courseId: 'C002', courseQuote: '老白第3课', chapter: 3, occurredOn: '2026-10-05' };
const WATCH_MESSAGE = '昨晚看了电影《海街日记》，感觉很平静，帮我记一下。';
const WATCH_CAPTURE = { kind: 'watch', title: '海街日记', occurredOn: '2026-10-04', watchStatus: 'unknown' };
const CREATION_MESSAGE = '我有个故事点子：小猫在雨中寻找回家的路，先记下。';
const CREATION_CAPTURE = { kind: 'creation', title: '小猫在雨中寻找回家的路' };
const payload = (message, requestId = 'natural-request-0001', context) => ({ message, requestId, mode: 'chat', history: [], ...(context ? { context } : {}) });
const modelText = (capture, reply = '先留下这段原话，后续可以接着补充。') => reply + '\n<learning_updates>' + JSON.stringify({ version: 1, saveReason: 'note', capture }) + '</learning_updates>';

async function fixture(t, extras = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'xiaomo-natural-intake-'));
  t.after(async () => { const canonical = await fs.realpath(root), temp = await fs.realpath(os.tmpdir()); assert.ok(path.relative(temp, canonical).startsWith('xiaomo-natural-intake-')); await fs.rm(canonical, { recursive: true }); });
  await fs.mkdir(path.join(root, '运行记录'));
  for (const relative of SUMMARY_FILES) await fs.copyFile(path.join(LEARNING_ROOT, relative), path.join(root, relative));
  const repository = new LearningRepository({ projectRoot: root, scope: 'isolated' }), canonical = repository.root;
  const committer = new LearningCommitter({ projectRoot: canonical, scope: 'isolated', repository, now: NOW });
  const content = new ContentStore({ projectRoot: canonical, scope: 'isolated', repository, now: NOW });
  const make = options => new NaturalRecordingCoordinator({ projectRoot: canonical, scope: 'isolated', repository, committer, contentStore: content, now: NOW, ...extras, ...options });
  return { root: canonical, repository, committer, content, intake: make(), make };
}
async function summaryTexts(root) { return Object.fromEntries(await Promise.all(SUMMARY_FILES.map(async relative => [relative, await fs.readFile(path.join(root, relative), 'utf8')]))); }
async function businessCount(f) { const snap = await f.repository.snapshot(), items = (await f.content.list()).items.filter(item => !item.readOnly); return { notes: snap.notes.length, tasks: snap.tasks.length, watch: items.filter(item => item.kind === 'watch').length, creation: items.filter(item => item.kind === 'creation').length }; }
async function nativeItem(f, kind, title, extra = {}) { const base = await f.content.bootstrap(); return (await f.content.save({ identity: base.identity, expectedRevision: base.revision, submissionId: 'seed-' + crypto.randomUUID(), action: 'append', item: { kind, title, body: '已存原话', ...extra } })).item; }
function runChild(root, message, capture, counter, options = {}) {
  const imports = Object.fromEntries(['records', 'commit', 'intake'].map(name => [name, pathToFileURL(path.join(LEARNING_ROOT, 'web/learning/' + name + '.mjs')).href]));
  const source = 'import fs from "node:fs/promises"; import {LearningRepository} from ' + JSON.stringify(imports.records) + ';import {LearningCommitter} from ' + JSON.stringify(imports.commit) + ';import {NaturalRecordingCoordinator} from ' + JSON.stringify(imports.intake) + ';const root=' + JSON.stringify(root) + ';const repository=new LearningRepository({projectRoot:root,scope:"isolated"});const committer=new LearningCommitter({projectRoot:root,scope:"isolated",repository,now:()=>new Date("2026-10-05T03:00:00Z")});const intake=new NaturalRecordingCoordinator({projectRoot:root,scope:"isolated",repository,committer,now:()=>new Date("2026-10-05T03:00:00Z"),faultInjector(point){' + (options.crash ? 'if(point===' + JSON.stringify(options.crash) + ')process.exit(77);' : '') + '}});const result=await intake.handle(' + JSON.stringify(payload(message)) + ',{runModel:async()=>{await fs.appendFile(' + JSON.stringify(counter) + ',process.pid+"\\n");await new Promise(r=>setTimeout(r,80));return ' + JSON.stringify(modelText(capture)) + ';}});process.stdout.write(JSON.stringify(result));';
  return new Promise((resolve, reject) => { const child = spawn(process.execPath, ['--input-type=module', '-e', source], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }); let out = '', error = ''; child.stdout.on('data', value => { out += value; }); child.stderr.on('data', value => { error += value; }); child.on('error', reject); child.on('close', code => code === 0 ? resolve(JSON.parse(out)) : options.crash && code === 77 ? resolve({ crashed: true }) : reject(new Error(error))); });
}

test('prepare is read-only and bare note registration does not load teaching material', async t => {
  let readCalls = 0; const f = await fixture(t, { sourceReader: { async read() { readCalls++; return { sources: [], warnings: [] }; } } }), before = await summaryTexts(f.root);
  const result = await f.intake.prepare(payload(NOTE_MESSAGE)); assert.equal(result.contextSnapshot.today, '2026-10-05'); assert.equal(readCalls, 0); assert.deepEqual(await summaryTexts(f.root), before);
  for (const folder of ['.自然记录', '.学习提交', '我的内容', '学习记录']) await assert.rejects(fs.access(path.join(f.root, '运行记录', folder)), { code: 'ENOENT' });
});

test('explicit explanation and practice requests load actual local skill text; explicit old modes stay with learning coordinator', async t => {
  const f = await fixture(t);
  for (const [name, marker] of [['explain-learning-material', '解释技能实际正文'], ['design-learning-practice', '练习技能实际正文']]) { const dir = path.join(f.root, '.agents/skills', name); await fs.mkdir(dir, { recursive: true }); await fs.writeFile(path.join(dir, 'SKILL.md'), marker); }
  const prepared = await f.intake.prepare(payload('学习笔记：请解释为什么要先看人物目标，并帮我设计一个练习。')); assert.match(prepared.systemContext, /解释技能实际正文/); assert.match(prepared.systemContext, /练习技能实际正文/);
  for (const mode of ['plan', 'progress', 'wrap']) assert.equal(isNaturalRecording({ ...payload('帮我记录学习'), mode, context: { noteId: 'note_' + 'a'.repeat(24) } }), false);
  assert.equal(isNaturalRecording(payload('按已知课程和观看经历帮助接续。')), false);
});

test('natural course note uses unique course alias, preserves raw words and complete AI separately, and leaves all summaries unchanged', async t => {
  const f = await fixture(t), before = await summaryTexts(f.root), p = payload('  ' + NOTE_MESSAGE + '\r\n'), answer = 'AI解释'.repeat(300);
  const result = await f.intake.handle(p, { runModel: async () => modelText(NOTE_CAPTURE, answer) }); assert.equal(result.status, 200); assert.equal(result.body.saved, true);
  const note = await f.repository.readNote(result.body.noteReceipt.noteId); assert.equal(note.body, p.message); assert.equal(note.aiText, answer); assert.equal(note.courseId, 'C002'); assert.equal(note.chapter, 3); assert.equal(note.occurredOn, '2026-10-05'); assert.deepEqual(await summaryTexts(f.root), before); assert.equal((await f.repository.snapshot()).tasks.length, 0);
});

test('viewing and creation go to their existing stores, not learning notes or tasks', async t => {
  const f = await fixture(t), before = await businessCount(f);
  const watch = await f.intake.handle(payload(WATCH_MESSAGE), { runModel: async () => modelText(WATCH_CAPTURE, '观看AI回应') }); assert.equal(watch.body.saved, true);
  const watched = (await f.content.detail(watch.body.contentReceipt.itemId)).item; assert.equal(watched.date, '2026-10-04'); assert.equal(watched.body, WATCH_MESSAGE); assert.equal(watched.aiText, '观看AI回应'); assert.equal(watched.watch.status, 'unknown');
  const creation = await f.intake.handle(payload(CREATION_MESSAGE, 'natural-create-0001'), { runModel: async () => modelText(CREATION_CAPTURE) }); assert.equal(creation.body.saved, true);
  assert.deepEqual(await businessCount(f), { ...before, watch: before.watch + 1, creation: before.creation + 1 });
});

test('verbatim numeric and Chinese chapter strings normalize without asking the user to repeat an explicit chapter', async t => {
  for (const chapter of ['第3课', '第三课']) await t.test(chapter, async child => {
    const f = await fixture(child), message = chapter === '第三课' ? NOTE_MESSAGE.replace('第3课', '第三课') : NOTE_MESSAGE;
    const result = await f.intake.handle(payload(message), { runModel: async () => modelText({ ...NOTE_CAPTURE, courseQuote: '老白' + chapter, chapter }) });
    assert.equal(result.body.saved, true); assert.equal(result.body.inputNeeded, undefined); const note = await f.repository.readNote(result.body.noteReceipt.noteId); assert.equal(note.chapter, 3); assert.equal(note.body, message);
  });
});

test('lesson reference and counts cannot justify a model-invented chapter; unknown or selected note identity remains usable', async t => {
  for (const [message, chapter] of [
    ['学习笔记：记下老白上次那一课的疑问。', 1],
    ['学习笔记：看了三课，先记下我的疑问。', 3],
    ['学习笔记：上了两节，先记下我的疑问。', 2],
    ['学习笔记：第六/第七课有个疑问，记下。', 7],
  ]) await t.test(message, async child => {
    const f = await fixture(child), before = await businessCount(f);
    const result = await f.intake.handle(payload(message, 'uncertain-chapter-001', { courseId: 'C002' }),
      { runModel: async () => modelText({ kind: 'learning', title: '学习笔记', chapter }) });
    assert.equal(result.body.saved, false); assert.equal(result.body.inputNeeded, true);
    assert.deepEqual(await businessCount(f), before);
  });
  const f = await fixture(t);
  const unknown = await f.intake.handle(payload('学习笔记：记下老白上次那一课的疑问。', 'unknown-chapter-001', { courseId: 'C002' }),
    { runModel: async () => modelText({ kind: 'learning', title: '学习笔记' }) });
  assert.equal(unknown.body.saved, true);
  assert.equal((await f.repository.readNote(unknown.body.noteReceipt.noteId)).chapter, null);
  const first = await f.intake.handle(payload(NOTE_MESSAGE), { runModel: async () => modelText(NOTE_CAPTURE) });
  const noteId = first.body.noteReceipt.noteId;
  const resumed = await f.intake.handle(payload('补充上次那一课的疑问：人物视线。', 'selected-chapter-001', { noteId }),
    { runModel: async () => modelText({ kind: 'learning', chapter: 3 }) });
  assert.equal(resumed.body.saved, true);
  assert.equal((await f.repository.readNote(noteId)).chapter, 3);
  const upperBound = await f.intake.handle(payload('学习笔记：第200课有个疑问，先记下。', 'chapter-bound-0200'),
    { runModel: async () => modelText({ kind: 'learning', title: '学习笔记', chapter: 200 }) });
  assert.equal(upperBound.body.saved, true);
  assert.equal((await f.repository.readNote(upperBound.body.noteReceipt.noteId)).chapter, 200);
});

test('wrong classifier kinds become one clarification and never write business records', async t => {
  for (const [message, capture] of [[NOTE_MESSAGE, { kind: 'creation', title: '视线方向' }], [WATCH_MESSAGE, { kind: 'learning', title: '学习笔记' }], [CREATION_MESSAGE, { kind: 'watch', title: '小猫在雨中寻找回家的路' }]]) await t.test(capture.kind, async child => {
    const f = await fixture(child), before = await businessCount(f), result = await f.intake.handle(payload(message), { runModel: async () => modelText(capture) }); assert.equal(result.status, 200); assert.equal(result.body.inputNeeded, true); assert.equal(result.body.saveReceipt.status, 'needs_input'); assert.deepEqual(await businessCount(f), before);
  });
});

test('no-save, quoted or hypothetical reports, recommendations and third-party viewing never become personal watched facts', async t => {
  const cases = ['我没看过电影《测试片》，先聊聊。', '我想看电影《测试片》，帮我记一下。', '朋友看完电影《测试片》，帮我记一下。', '如果我说我看了电影《测试片》，会保存吗？', '原文：“我看完电影《测试片》了。”请解释这句话。', '推荐一部电影《测试片》给我看看。', '我看了电影《测试片》，这次不要保存。', '我看了电影《测试片》，只聊不记。'];
  for (const [index, message] of cases.entries()) await t.test(String(index + 1), async child => { const f = await fixture(child), before = await businessCount(f); const result = await f.intake.handle(payload(message), { runModel: async () => modelText({ kind: 'watch', title: '测试片', watchStatus: 'watched' }) }); assert.equal(result.body.saved, false); assert.deepEqual(await businessCount(f), before); assert.equal(await f.intake.lookup('natural-request-0001'), null); });
});

test('quoted no-save phrase does not override current save instruction across intake, committer and CLI', async t => {
  const f = await fixture(t), message = '学习笔记：第3课里有一句“不要保存”，我不理解这句话，帮我记下。', p = payload(message), capture = { kind: 'learning', title: '学习笔记', chapter: 3 };
  assert.equal(suppressSave(p), false); const result = await f.intake.handle(p, { runModel: async () => modelText(capture) }); assert.equal(result.body.saved, true); assert.equal((await f.repository.readNote(result.body.noteReceipt.noteId)).body, message);
  const input = { payload: payload(message, 'quoted-note-cli-001'), reply: 'CLI真实答复', kind: 'note', note: { title: '学习笔记' } }, file = path.join(f.root, 'quoted-input.json'); await fs.writeFile(file, JSON.stringify(input)); let output;
  await runLearningCLI(['commit', '--input', file, '--project-root', f.root, '--scope', 'isolated'], { stdout(value) { output = JSON.parse(value); } }); assert.equal(output.saved, true);
});

test('having watched or a second viewing does not imply finished, and missing dates remain unknown', async t => {
  for (const [message, expected] of [['我看过电影《测试片》，记一下。', 'unknown'], ['我二刷电影《测试片》，记一下。', 'unknown'], ['我看了电影《测试片》，没看完，记一下。', 'partial'], ['我看完电影《测试片》了，记一下。', 'watched']]) await t.test(expected + message.slice(0, 5), async child => {
    const f = await fixture(child), result = await f.intake.handle(payload(message), { runModel: async () => modelText({ kind: 'watch', title: '测试片', watchStatus: 'watched' }) }); assert.equal(result.body.saved, true); const item = (await f.content.detail(result.body.contentReceipt.itemId)).item; assert.equal(item.date, null); assert.equal(item.watch.status, expected);
  });
});

test('exact note continuation keeps date when classifier returns null, and requires explicit intent before correction', async t => {
  const f = await fixture(t), first = await f.intake.handle(payload(NOTE_MESSAGE), { runModel: async () => modelText(NOTE_CAPTURE) }), noteId = first.body.noteReceipt.noteId;
  const second = await f.intake.handle(payload('补充：我想先观察视线朝向。', 'natural-append-001', { noteId }), { runModel: async () => modelText({ kind: 'learning', chapter: 3, occurredOn: null }) }); assert.equal(second.body.saved, true);
  let note = await f.repository.readNote(noteId); assert.equal(note.occurredOn, '2026-10-05'); assert.equal(note.history.length, 2);
  const bad = await f.intake.handle(payload('补充：还有一个想法。', 'natural-correct-bad', { noteId }), { runModel: async () => modelText({ kind: 'learning', action: 'correct' }) }); assert.equal(bad.body.inputNeeded, true); assert.equal((await f.repository.readNote(noteId)).version, 2);
  const corrected = await f.intake.handle(payload('更正：我想观察的是人物站位。', 'natural-correct-ok', { noteId }), { runModel: async () => modelText({ kind: 'learning', action: 'correct' }) }); assert.equal(corrected.body.saved, true); note = await f.repository.readNote(noteId); assert.equal(note.history.length, 3); assert.equal(note.body, '更正：我想观察的是人物站位。'); assert.equal(note.occurredOn, '2026-10-05');
});

test('same title never silently selects an existing work and selected title or target conflicts never append elsewhere', async t => {
  const f = await fixture(t), seed = await nativeItem(f, 'watch', '同名作品'), other = await nativeItem(f, 'watch', '另一作品');
  const ambiguous = await f.intake.handle(payload('我看了电影《同名作品》，帮我记一下。'), { runModel: async () => modelText({ kind: 'watch', title: '同名作品' }) }); assert.equal(ambiguous.body.inputNeeded, true);
  for (const [index, capture] of [{ kind: 'watch', targetId: other.id }, { kind: 'watch', title: '另一作品' }].entries()) { const response = await f.intake.handle(payload('补充：我觉得这部电影很温暖。', 'wrong-target-' + index, { contentId: seed.id }), { runModel: async () => modelText(capture) }); assert.equal(response.body.inputNeeded, true); }
  assert.equal((await f.content.detail(seed.id)).item.version, 1); assert.equal((await f.content.detail(other.id)).item.version, 1);
  const good = await f.intake.handle(payload('补充 ' + seed.id + '：我觉得这部电影很温暖。', 'exact-target-0001'), { runModel: async () => modelText({ kind: 'watch', targetId: seed.id }) }); assert.equal(good.body.saved, true); assert.equal(good.body.contentReceipt.itemId, seed.id);
});

test('selected note and user-named course must agree even when model repeats the stale selection', async t => {
  const f = await fixture(t), first = await f.intake.handle(payload(NOTE_MESSAGE), { runModel: async () => modelText(NOTE_CAPTURE) }), noteId = first.body.noteReceipt.noteId;
  const response = await f.intake.handle(payload('补充：查理第3课的故事想法。', 'wrong-course-0001', { noteId }), { runModel: async () => modelText({ kind: 'learning', courseId: 'C002' }) }); assert.equal(response.body.inputNeeded, true); assert.equal((await f.repository.readNote(noteId)).version, 1);
});

test('same saved request has one model call across repeats, instances and restart; changed capture is rejected', async t => {
  const f = await fixture(t), p = payload(NOTE_MESSAGE); let calls = 0; const runModel = async () => { calls++; return modelText(NOTE_CAPTURE, '冻结的回复'); };
  const first = await f.intake.handle(p, { runModel }), again = await f.intake.handle(p, { runModel }), restarted = await f.make().handle(p, { runModel }); assert.equal(calls, 1); assert.equal(first.body.reply, again.body.reply); assert.equal(restarted.body.reply, first.body.reply); assert.equal((await f.repository.readNote(first.body.noteReceipt.noteId)).version, 1);
  const prepared = await f.intake.prepare(p); await assert.rejects(f.intake.commit({ payload: p, reply: '其他回复', capture: { ...NOTE_CAPTURE, title: '不同标题' }, contextSnapshot: prepared.contextSnapshot }), { code: 'INTAKE_REQUEST_CONFLICT' });
  await assert.rejects(f.make().handle({ ...p, message: p.message + '不同原话' }, { runModel }), { code: 'INTAKE_REQUEST_CONFLICT' });
});

test('independent processes share one frozen classification and reply for both note and watch routes', async t => {
  for (const [message, capture] of [[NOTE_MESSAGE, NOTE_CAPTURE], [WATCH_MESSAGE, WATCH_CAPTURE]]) await t.test(capture.kind, async child => {
    const f = await fixture(child), counter = path.join(f.root, 'model-count.txt'), before = await businessCount(f);
    const results = await Promise.all([runChild(f.root, message, capture, counter), runChild(f.root, message, capture, counter)]); assert.equal(results.every(result => result.body.saved), true); assert.equal(results[0].body.reply, results[1].body.reply); assert.equal((await fs.readFile(counter, 'utf8')).trim().split('\n').length, 1);
    const after = await businessCount(f); assert.equal(after.notes - before.notes + after.watch - before.watch, 1);
  });
});

test('failures after freeze, target save and receipt commit recover without another model call or duplicate content', async t => {
  for (const [message, capture] of [[NOTE_MESSAGE, NOTE_CAPTURE], [WATCH_MESSAGE, WATCH_CAPTURE], [CREATION_MESSAGE, CREATION_CAPTURE]]) for (const boundary of ['after_prepare', 'after_target_save', 'after_commit']) await t.test(capture.kind + ':' + boundary, async child => {
    const f = await fixture(child), intake = f.make({ faultInjector(point) { if (point === boundary) throw new Error('simulated interruption'); } }), before = await businessCount(f), p = payload(message); let calls = 0;
    const runModel = async () => { calls++; return modelText(capture); }; const failed = await intake.handle(p, { runModel }); assert.equal(failed.body.saved, false);
    const recovered = await f.make().handle(p, { runModel }); assert.equal(recovered.body.saved, true); assert.equal(calls, 1); assert.equal((await f.intake.requestStatus(p.requestId)).status, 'committed');
    const after = await businessCount(f); assert.equal(after.notes - before.notes + after.watch - before.watch + after.creation - before.creation, 1);
  });
});

test('dead process request lock and already-saved target recover together without rerunning the model', async t => {
  const f = await fixture(t), counter = path.join(f.root, 'model-count.txt'); assert.equal((await runChild(f.root, WATCH_MESSAGE, WATCH_CAPTURE, counter, { crash: 'after_target_save' })).crashed, true);
  const recovered = await runChild(f.root, WATCH_MESSAGE, WATCH_CAPTURE, counter); assert.equal(recovered.body.saved, true); assert.equal((await fs.readFile(counter, 'utf8')).trim().split('\n').length, 1);
});

test('malformed protocol and invalid dates request one clarification without a save error or business write', async t => {
  for (const output of ['只有普通回应。', modelText({ ...NOTE_CAPTURE, occurredOn: '2026-02-30' }), modelText(NOTE_CAPTURE) + '尾块后有多余内容']) await t.test(output.slice(0, 12), async child => { const f = await fixture(child), before = await businessCount(f); const result = await f.intake.handle(payload(NOTE_MESSAGE), { runModel: async () => output }); assert.equal(result.status, 200); assert.equal(result.body.inputNeeded, true); assert.equal(result.body.saveError, undefined); assert.deepEqual(await businessCount(f), before); });
});
