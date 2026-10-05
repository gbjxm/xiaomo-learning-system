import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const source = await fs.readFile(new URL('../public/learning/terminal-learning.js', import.meta.url), 'utf8');

async function page(query = '', { saved = true, records = [] } = {}) {
  const calls = { saves: 0, destinations: [], visits: [], places: [], traces: [], notices: [] };
  const nodes = new Map();
  function node(id) {
    if (!nodes.has(id)) nodes.set(id, {
      hidden: false, textContent: '', listeners: new Map(),
      setAttribute() {}, after() {}, scrollIntoView() {},
      addEventListener(type, handler) { this.listeners.set(type, handler); },
    });
    return nodes.get(id);
  }
  const context = vm.createContext({
    URL, URLSearchParams, Promise, Object,
    location: { href: 'http://localhost/learning/' + query, assign(href) { calls.destinations.push(href); } },
    history: { state: null, replaceState() {} },
    document: { querySelectorAll() { return []; } },
    el() { return node('status'); }, $: node,
    islands: { home: { name: '主岛' }, story: { name: '故事岛' }, visual: { name: '影像岛' }, post: { name: '后期岛' } },
    state: { current: 'home', overview: false, records }, life: { sceneKey: '' },
    openPlace(action) { calls.places.push(action); },
    openTrace(record) { calls.traces.push(record.id); },
    visit(island) { calls.visits.push(island); context.state.current = island; },
    renderPanel() {}, syncLife() {}, setPanel() {},
    notice(message) { calls.notices.push(message); },
    window: {
      addEventListener() {},
      learningIsland: {
        async flushUiDraft() { calls.saves++; return saved; },
        status() { return { ready: true, blocked: false, recordsLoaded: true }; },
        resumeCurrentTask() { calls.places.push('current-task'); return true; },
        ready: Promise.resolve(),
      },
    },
  });
  vm.runInContext(source, context);
  const settled = () => new Promise(resolve => setImmediate(resolve));
  await settled();
  return { calls, nodes, context, settled };
}

test('跨岛内容入口先保存原草稿，不切岛或打开另一份空练习', async () => {
  const p = await page('?island=story&place=practice');
  assert.equal(p.calls.saves, 1);
  assert.deepEqual(p.calls.destinations, ['/learning/content/?island=story']);
  assert.deepEqual(p.calls.visits, []);
  assert.deepEqual(p.calls.places, []);
});

test('保存未确认时留在旧页，看片入口也不能绕过保护', async () => {
  const p = await page('?island=post&place=watch', { saved: false });
  assert.deepEqual(p.calls.destinations, []);
  assert.deepEqual(p.calls.visits, []);
  assert.match(p.nodes.get('status').textContent, /尚未确认保存/);
  p.context.openPlace('watch');
  await p.settled();
  assert.equal(p.calls.saves, 2);
  assert.deepEqual(p.calls.destinations, []);
});

test('明确旧书签可精确展开，练习草稿恢复不发生共享页循环', async () => {
  const p = await page('?island=story&place=bookmarks&legacyContent=1&legacyRecord=work-one', {
    records: [{ id: 'work-one', island: 'story', title: '原有尝试' }],
  });
  assert.deepEqual(p.calls.places, ['traces']);
  assert.deepEqual(p.calls.traces, ['work-one']);
  p.context.openPlace('practice');
  assert.deepEqual(p.calls.places, ['traces', 'practice']);
  assert.deepEqual(p.calls.destinations, []);
  assert.equal(p.calls.saves, 0);
});

test('普通页面仍可显式继续旧练习，新的观看入口选中观看', async () => {
  const p = await page();
  p.context.openPlace('practice', { legacy: true });
  assert.deepEqual(p.calls.places, ['practice']);
  p.context.openPlace('watch');
  await p.settled();
  assert.deepEqual(p.calls.destinations, ['/learning/content/?island=home&view=watch']);
});

test('主岛生活旅程与真实学习接续保留原归属', async () => {
  const journey = await page('?island=home&place=traces');
  assert.deepEqual(journey.calls.destinations, ['/navigation/?view=journey']);
  const learning = await page('?entry=resume');
  assert.deepEqual(learning.calls.places, ['current-task']);
  assert.deepEqual(learning.calls.destinations, []);
});

test('我的内容与旧书签分开，内容标签离开前保存', async () => {
  const p = await page();
  p.nodes.get('legacyLearningBookmarks').listeners.get('click')();
  assert.deepEqual(p.calls.places, ['traces']);
  let prevented = false, stopped = false;
  p.nodes.get('tracesTab').listeners.get('click')({ preventDefault() { prevented = true; }, stopImmediatePropagation() { stopped = true; } });
  await p.settled();
  assert.ok(prevented && stopped);
  assert.equal(p.calls.saves, 1);
  assert.deepEqual(p.calls.destinations, ['/learning/content/?island=home']);
});
