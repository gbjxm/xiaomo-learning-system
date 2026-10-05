import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const source = await fs.readFile(new URL('../public/learning/terminal-learning.js', import.meta.url), 'utf8');
async function page(query, { found = true, blocked = false } = {}) {
  const calls = [], nodes = new Map(); let release;
  const ready = new Promise(resolve => { release = resolve; });
  const node = id => { if (!nodes.has(id)) nodes.set(id, { hidden: false, textContent: '', setAttribute() {}, after() {}, scrollIntoView() {}, focus() {}, addEventListener() {} }); return nodes.get(id); };
  const context = vm.createContext({ URL, URLSearchParams, Promise, Object,
    location: { href: 'http://localhost/learning/' + query, assign() { calls.push('leave'); } }, history: { state: null, replaceState() { calls.push('consume'); } }, document: { querySelectorAll() { return []; } }, el() { return node('status'); }, $: node,
    islands: { home: { name: '主岛' } }, state: { current: 'home', records: [] }, life: {},
    openPlace() {}, openTrace() {}, visit() { calls.push('visit'); }, renderPanel() {}, syncLife() {}, setPanel() {}, setMode() {}, notice() {},
    window: { addEventListener() {}, learningIsland: { ready, status: () => ({ ready: true, recordsLoaded: true, blocked }), flushUiDraft: async () => true,
      openTaskById: async id => { calls.push(['task', id]); return found; }, openRecordingContext: async target => { calls.push([target.kind, target.id]); return found; }, resumeCurrentTask() { calls.push('recent'); return true; }, clearRecordingContext() { calls.push('clear'); return true; } } }
  });
  vm.runInContext(source, context);
  return { calls, nodes, release, settle: () => new Promise(resolve => setImmediate(resolve)) };
}
for (const [key, kind, id] of [['taskId', 'task', 'task_old_001'], ['noteId', 'note', 'note_aaaaaaaaaaaaaaaaaaaaaaaa'], ['contentId', 'content', 'W007']]) {
  test('精确 ' + key + ' 入口等待草稿恢复，使用指定编号而不是最近任务', async () => {
    const p = await page('?' + key + '=' + id + '&entry=resume'); await p.settle(); assert.deepEqual(p.calls, []);
    p.release(); await p.settle(); assert.deepEqual(p.calls, [[kind, id], 'consume']);
  });
}
test('目标不存在时保留链接和草稿，不消费入口或回到最近任务', async () => {
  const p = await page('?noteId=note_missing', { found: false }); p.release(); await p.settle();
  assert.deepEqual(p.calls, [['note', 'note_missing']]); assert.match(p.nodes.get('status').textContent, /原输入和片段保留/);
});
test('多个目标不猜测；版本冲突时也不触发任何对象读取', async () => {
  const p = await page('?contentId=W001&taskId=task_old'); p.release(); await p.settle(); assert.deepEqual(p.calls, []);
  const q = await page('?contentId=W001', { blocked: true }); q.release(); await q.settle(); assert.deepEqual(q.calls, []);
});
test('新的自然交流入口退出旧关联，保留原页面草稿', async () => {
  const p = await page('?entry=record'); p.release(); await p.settle(); assert.deepEqual(p.calls, ['clear', 'consume']);
});
