import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { ContentStore } from './store.mjs';
import { assertLearningRoot } from '../learning/records.mjs';

async function fixture(t, snapshot) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'xiaomo-natural-content-'));
  t.after(async () => { const real = await fs.realpath(root), temp = await fs.realpath(os.tmpdir()); assert.ok(path.relative(temp, real).startsWith('xiaomo-natural-content-')); await fs.rm(real, { recursive: true }); });
  const repository = snapshot ? { root: assertLearningRoot(root, 'isolated'), scope: 'isolated', async snapshot() { return snapshot; } } : undefined;
  return { root, store: new ContentStore({ projectRoot: root, scope: 'isolated', repository }) };
}
async function save(store, item, action = 'append') {
  const { identity, revision } = await store.bootstrap();
  return store.save({ identity, expectedRevision: revision, submissionId: randomUUID(), item, action });
}
test('创作原话和 AI 回应独立存储，人工追加与更正不清空 AI 历史', async t => {
  const { store } = await fixture(t);
  const first = await save(store, { kind: 'creation', title: '点子', body: '  用户第一句\n保留空格  ', aiText: '  AI第一段  ' });
  const second = await save(store, { kind: 'creation', id: first.item.id, title: '点子', body: '第二句' });
  assert.equal(second.item.aiText, '  AI第一段  ');
  assert.equal(second.item.body, '  用户第一句\n保留空格  \n\n第二句');
  const third = await save(store, { kind: 'creation', id: first.item.id, title: '点子', body: '更正文' }, 'correct');
  assert.equal(third.item.body, '更正文'); assert.equal(third.item.aiText, '  AI第一段  ');
  const last = await save(store, { kind: 'creation', id: first.item.id, title: '点子', body: '新补充', aiText: 'AI第二段' });
  assert.equal(last.item.aiText, '  AI第一段  \n\nAI第二段');
  assert.equal(last.item.history[0].change.aiText, '  AI第一段  ');
  assert.equal(last.item.history[1].change.aiText, undefined);
  assert.equal(last.item.history[2].item.body, '更正文');
  assert.ok(!last.item.body.includes('AI')); assert.match(last.item.resumeUrl, /contentId=content_/);
});
test('观看追加的人可读原话与 AI 区域分开，重启仍可回读', async t => {
  const { root, store } = await fixture(t);
  const input = { kind: 'watch', title: '短片甲', body: '  我只看了开头。  ', aiText: '这是 AI 回应。', date: null };
  const first = await save(store, input);
  const raw = await fs.readFile(path.join(root, '运行记录/观影记录.md'), 'utf8');
  assert.match(raw, /本次原话：[\s\S]*>   我只看了开头。  \n\nAI回应（不作为本人原话）：\n\n> 这是 AI 回应。/);
  const reloaded = new ContentStore({ projectRoot: root, scope: 'isolated' });
  const { item } = await reloaded.detail(first.item.id);
  assert.equal(item.body, input.body); assert.equal(item.aiText, input.aiText); assert.equal(item.date, null);
  assert.equal(item.history[0].item.aiText, input.aiText); assert.match(item.resumeUrl, /contentId=W001/);
});
test('每次 AI 文字最多 24000 字，累计回应可跨过单次上限', async t => {
  const { store } = await fixture(t);
  await assert.rejects(save(store, { kind: 'creation', title: '限制', body: '原话', aiText: '字'.repeat(24001) }), error => error.code === 'CONTENT_INVALID_INPUT');
  const a = await save(store, { kind: 'creation', title: '长回复', body: '原话', aiText: '甲'.repeat(20000) });
  const b = await save(store, { kind: 'creation', id: a.item.id, title: '长回复', body: '补充', aiText: '乙'.repeat(20000) });
  assert.equal(b.item.aiText.length, 40002);
});
test('课程笔记、旧交流和任务投影属于 learning，精确续接且不伪造创作', async t => {
  const noteId = 'note_' + 'a'.repeat(24), taskId = 'task_original_0001';
  const snapshot = { warnings: [], courses: [{ courseId: 'C002', name: '分镜课' }], tasks: [{ taskId, title: '旧任务', purpose: '观察轴线', courseId: 'C002', updatedAt: '2026-10-01T00:00:00Z' }], currentTask: { taskId: 'task_newer_0002' }, artifactCatalog: { a: { taskId, id: 'A1', artifact: { title: '旧产物', text: '原文' }, activityFile: '运行记录/活动/旧.md' } }, notes: [{ noteId, title: '今天的课', body: '我的原话', aiText: 'AI说明', courseId: 'C002', chapter: 3, occurredOn: null, updatedAt: '2026-10-05T00:00:00Z', version: 1, activityFile: '运行记录/活动/笔记.md', history: [{ action: 'append', body: '我的原话', aiText: 'AI说明' }] }], entries: [{ id: 'entry_old_0001', title: '早期交流', body: '旧原话', aiText: '旧节选', aiTextCoverage: 'excerpt', taskId: null, activityFile: '运行记录/活动/早期.md' }] };
  const { root, store } = await fixture(t, snapshot);
  const learning = await store.list({ kind: 'learning' }); assert.equal(learning.items.length, 4);
  assert.equal((await store.list({ kind: 'creation' })).items.length, 0);
  const detail = (await store.detail('learning-note:' + noteId)).item;
  assert.equal(detail.courseName, '分镜课'); assert.equal(detail.date, null); assert.equal(detail.chapter, 3); assert.equal(detail.aiText, 'AI说明'); assert.equal(detail.readOnly, true);
  assert.equal(detail.resumeUrl, '/learning/?noteId=' + noteId);
  assert.equal((await store.detail('learning-task:' + taskId)).item.resumeUrl, '/learning/?taskId=' + taskId);
  assert.equal((await store.detail('learning-entry:entry_old_0001')).item.resumeUrl, null);
  assert.equal((await store.list({ q: 'AI说明' })).items.length, 1);
  assert.equal((await store.list({ q: '分镜课' })).items.length, 2);
  await assert.rejects(save(store, { id: detail.id, kind: 'creation', title: '错误创建', body: '不要创建' }), error => error.code === 'CONTENT_READ_ONLY');
  assert.deepEqual(await fs.readdir(root), []);
});
