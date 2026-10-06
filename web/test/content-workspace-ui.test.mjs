import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const source = await fs.readFile(new URL('../public/learning/content/app.js', import.meta.url), 'utf8');
const relationSource = await fs.readFile(new URL('../workspace/public/relations.js', import.meta.url), 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));
const identity = 'content:isolated-test';
const workspaceIdentity = { storeId: 'workspace-test', projectRoot: 'isolated', canonicalPath: 'isolated/workspace.json', schemaVersion: 1, scope: 'isolated' };
const native = id => ({ id, title: id, kind: id.startsWith('W') ? 'watch' : 'creation', body: '原记录', readOnly: false, links: [], source: { kind: id.startsWith('W') ? 'watch-ledger' : 'personal-content' }, workspaceRef: { module: 'learning', kind: 'learning', storeId: identity, id: 'content:' + id }, resumeUrl: '/learning/?contentId=' + id });
const note = { ...native('learning-note:note_one'), kind: 'learning', readOnly: true, noteId: 'note_one', source: { kind: 'learning-note' }, workspaceRef: { module: 'learning', kind: 'learning', storeId: identity, id: 'note:note_one' }, resumeUrl: '/learning/?noteId=note_one' };
const task = { ...native('learning-task:task_one'), kind: 'learning', readOnly: true, taskId: 'task_one', source: { kind: 'learning-task' }, workspaceRef: { module: 'learning', kind: 'learning', storeId: identity, id: 'task:task_one' }, resumeUrl: '/learning/?taskId=task_one' };

class Element {
  constructor(tag = 'div') { this.tagName = tag.toUpperCase(); this.children = []; this.listeners = new Map(); this.dataset = {}; this.style = {}; this.attributes = {}; this.className = ''; this.parentElement = null; this._text = ''; this.hidden = false; this.classList = { toggle() {}, add() {}, remove() {} }; }
  set textContent(value) { this._text = String(value); this.replaceChildren(); }
  get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
  get isConnected() { return this.root === true || !!this.parentElement?.isConnected; }
  append(...nodes) { for (const node of nodes) { const child = typeof node === 'string' ? Object.assign(new Element('text'), { textContent: node }) : node; child.parentElement = this; this.children.push(child); } }
  replaceChildren(...nodes) { for (const child of this.children) child.parentElement = null; this.children = []; this.append(...nodes); }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  addEventListener(type, fn) { const list = this.listeners.get(type) || []; list.push(fn); this.listeners.set(type, list); }
  click() { for (const fn of this.listeners.get('click') || []) fn({ preventDefault() {} }); }
  querySelectorAll(selector) { const matches = child => selector.startsWith('#') ? child.id === selector.slice(1) : selector.startsWith('.') ? child.className.split(' ').includes(selector.slice(1)) : selector === '[data-kind]' ? !!child.dataset.kind : child.tagName.toLowerCase() === selector; return this.children.flatMap(child => [...(matches(child) ? [child] : []), ...child.querySelectorAll(selector)]); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  scrollIntoView() {}
  focus() {}
}

async function page({ items = [native('W001'), note, task], selected, detail, workspace } = {}) {
  const events = [], requests = [], body = new Element('body'); body.root = true;
  const ids = ['sourceWarnings', 'newContent', 'contentCount', 'contentList', 'reloadContent', 'connectionState', 'pageNotice', 'detailPanel', 'talkToGuide', 'searchForm', 'searchInput', 'clearSearch', 'islandContext', 'backToIsland'];
  for (const id of ids) { const node = new Element(); node.id = id; body.append(node); }
  body.querySelector('#sourceWarnings').append(new Element('div'));
  const listeners = new Map(), storage = new Map();
  const state = { recent: [], regions: { observatory: { url: '/observatory/?space=daily#material/material_one' } }, lastRegion: 'observatory', observatoryRoutes: {} };
  let stateRevision = 1;
  const response = (value, status = 200) => ({ ok: status < 400, status, json: async () => clone(value) });
  const location = { href: 'http://localhost/learning/content/' + (selected ? '?item=' + encodeURIComponent(selected) : ''), pathname: '/learning/content/', origin: 'http://localhost', assign() {} };
  location.search = new URL(location.href).search;
  const window = { matchMedia: () => ({ matches: false }), crypto: { randomUUID: () => 'test-uuid' }, addEventListener(type, fn) { const list = listeners.get(type) || []; list.push(fn); listeners.set(type, list); }, dispatchEvent(event) { events.push(event); for (const fn of listeners.get(event.type) || []) fn(event); } };
  const context = vm.createContext({ URL, URLSearchParams, Intl, Date, Math, Object, Promise, CustomEvent: class { constructor(type, { detail } = {}) { this.type = type; this.detail = detail; } }, window, location,
    history: { replaceState(_state, _title, url) { location.href = String(url); } },
    sessionStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) }, localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    document: { body, createElement: tag => new Element(tag), createTextNode: text => Object.assign(new Element('text'), { textContent: text }), getElementById: id => body.querySelector('#' + id), querySelectorAll: selector => body.querySelectorAll(selector) },
    async fetch(url, options = {}) {
      requests.push({ url, ...options });
      if (workspace && url.startsWith('/api/workspace/')) { const custom = await workspace(url, options, { state, stateRevision, response }); if (custom) return custom; }
      if (url === '/api/learning/content/bootstrap') return response({ identity, scope: 'isolated', revision: 'content-revision', token: 'content-token', items });
      if (url.startsWith('/api/learning/content/items/')) { const id = decodeURIComponent(url.slice('/api/learning/content/items/'.length)); const item = detail ? await detail(id) : items.find(item => item.id === id); return item ? response({ identity, scope: 'isolated', revision: 'content-revision', item }) : response({ error: { message: '未找到这份内容' } }, 404); }
      if (url === '/api/workspace/bootstrap') return response({ ok: true, data: { identity: workspaceIdentity, scope: 'isolated', token: 'workspace-token', stateRevision, state } });
      if (url === '/api/workspace/state') { const input = JSON.parse(options.body); Object.assign(state, input.state); stateRevision++; return response({ ok: true, data: { identity: workspaceIdentity, stateRevision, state } }); }
      throw new Error('Unexpected request ' + url);
    }
  });
  vm.runInContext(source, context);
  const settle = async (count = 8) => { for (let i = 0; i < count; i++) await new Promise(resolve => setImmediate(resolve)); };
  await settle();
  return { window, body, requests, events, state, settle, open(id) { const card = body.querySelector('#contentList').children.find(child => child.dataset.contentId === id); assert.ok(card, id); card.click(); }, node: id => body.querySelector('#' + id) };
}

for (const item of [native('W001'), native('content_one123456'), note, task]) {
  test('真实详情事件和最近停留沿同一准确编号：' + item.id, async () => {
    const p = await page({ items: [item], selected: item.id });
    assert.deepEqual(clone(p.window.workspaceLastContext.ref), item.workspaceRef);
    assert.equal(p.window.workspaceLastContext.mount.isConnected, true);
    assert.equal(p.body.dataset.spaceMode, 'isolated');
    assert.deepEqual(clone(p.state.recent), [item.workspaceRef]);
    assert.deepEqual(clone(p.state.regions), { observatory: { url: '/observatory/?space=daily#material/material_one' } });
    assert.equal(p.requests.filter(request => request.method === 'POST').every(request => request.url === '/api/workspace/state'), true);
    assert.equal(p.body.querySelectorAll('a').some(anchor => anchor.href === new URL(item.resumeUrl, 'http://localhost').href), true);
  });
}

test('旧投影和不匹配的来源身份不发布正式关联或写最近停留', async () => {
  for (const item of [{ ...note, id: 'learning-entry:old', source: { kind: 'learning-entry' } }, { ...note, workspaceRef: { ...note.workspaceRef, storeId: 'another-content-store' } }, { ...note, workspaceRef: { ...note.workspaceRef, id: 'note:another-note' } }]) {
    const p = await page({ items: [item], selected: item.id });
    assert.equal(p.window.workspaceLastContext, null);
    assert.equal(p.requests.some(request => request.url.startsWith('/api/workspace/')), false);
  }
});

test('快速切换的迟到详情不能覆盖新对象，读取失败也不留下旧关联', async () => {
  let release; const a = native('W001'), b = native('W002');
  const p = await page({ items: [a, b, native('W003')], detail: id => id === a.id ? new Promise(resolve => { release = resolve; }) : id === b.id ? b : null });
  p.open(a.id); p.open(b.id); await p.settle();
  assert.equal(p.window.workspaceLastContext.ref.id, 'content:W002');
  release(a); await p.settle();
  assert.equal(p.window.workspaceLastContext.ref.id, 'content:W002');
  assert.deepEqual(clone(p.state.recent), [b.workspaceRef]);
  p.open('W003'); assert.equal(p.window.workspaceLastContext, null); await p.settle();
  assert.match(p.node('detailPanel').textContent, /未找到这份内容/);
});

test('接口回错编号不展示另一条详情；编辑状态清空旧关联', async () => {
  const p = await page({ selected: 'W001', detail: () => native('W002') });
  assert.equal(p.window.workspaceLastContext, null); assert.match(p.node('detailPanel').textContent, /与所选内容不一致/);
  const q = await page({ selected: 'W001' }); q.node('newContent').click();
  assert.equal(q.window.workspaceLastContext, null); assert.equal(q.node('detailPanel').querySelector('.content-relations'), null);
});

test('迟到的最近停留读取不把已切走对象写回来', async () => {
  let release, blocked = true;
  const p = await page({ items: [native('W001'), native('W002')], workspace: async (url, _options, { response, state }) => {
    if (url === '/api/workspace/bootstrap' && blocked) { blocked = false; await new Promise(resolve => { release = resolve; }); return response({ ok: true, data: { identity: workspaceIdentity, scope: 'isolated', token: 'token', stateRevision: 1, state } }); }
  } });
  p.open('W001'); await p.settle(); p.open('W002'); await p.settle(); release(); await p.settle();
  const writes = p.requests.filter(request => request.url === '/api/workspace/state');
  assert.equal(writes.length, 1); assert.equal(JSON.parse(writes[0].body).state.recent[0].id, 'content:W002');
});

test('最近停留CAS冲突后仅重读一次并保留并发更新的其他区域', async () => {
  let writes = 0;
  const p = await page({ selected: 'W001', workspace: (url, options, { state, response }) => {
    if (url === '/api/workspace/state' && ++writes === 1) { state.regions.information = { url: '/information/?space=daily' }; return response({ ok: false, error: { message: '版本已更新' } }, 409); }
  } });
  assert.equal(writes, 2); assert.deepEqual(p.state.regions.information, { url: '/information/?space=daily' });
  assert.equal(p.state.recent[0].id, 'content:W001');
});

test('最近停留模式错配时不提交，详情仍可查看且有明确提示', async () => {
  const p = await page({ selected: 'W001', workspace: (url, _options, { response }) => url === '/api/workspace/bootstrap' ? response({ ok: true, data: { identity: { ...workspaceIdentity, scope: 'production' }, scope: 'production', token: 'wrong', stateRevision: 1, state: { recent: [] } } }) : null });
  assert.equal(p.window.workspaceLastContext.ref.id, 'content:W001');
  assert.equal(p.requests.some(request => request.method === 'POST'), false);
  assert.match(p.node('detailPanel').textContent, /最近停留暂未保存/);
});

test('最近停留冲突后身份改变不再次提交，也不隐瞒保存缺口', async () => {
  let conflict = false;
  const p = await page({ selected: 'W001', workspace: (url, _options, { response, state }) => {
    if (url === '/api/workspace/state') { conflict = true; return response({ ok: false, error: { message: '状态更新' } }, 409); }
    if (url === '/api/workspace/bootstrap' && conflict) return response({ ok: true, data: { identity: { ...workspaceIdentity, storeId: 'changed-workspace' }, scope: 'isolated', token: 'new-token', stateRevision: 2, state } });
  } });
  assert.equal(p.requests.filter(request => request.method === 'POST').length, 1);
  assert.match(p.node('detailPanel').textContent, /保存位置发生变化/);
  assert.equal(p.window.workspaceLastContext.ref.id, 'content:W001');
});

test('关联只放行既有模块页和准确内容详情路径', () => {
  const start = relationSource.indexOf('  function safeHref('), end = relationSource.indexOf('  function storageKey', start);
  const context = vm.createContext({ URL, location: { href: 'http://localhost/observatory/', origin: 'http://localhost' } });
  vm.runInContext(relationSource.slice(start, end) + '\nthis.safeHref = safeHref;', context);
  assert.equal(context.safeHref('/learning/content/?item=learning-note%3Anote_one'), '/learning/content/?item=learning-note%3Anote_one');
  assert.equal(context.safeHref('/learning/content/index.html?item=W001'), '/learning/content/index.html?item=W001');
  assert.equal(context.safeHref('/observatory/?space=daily#material/m1'), '/observatory/?space=daily#material/m1');
  for (const href of ['/learning/content/admin', '/learning/other/', '//evil.test/learning/content/', 'https://evil.test/learning/content/', 'javascript:alert(1)', '/learning/content\\admin']) assert.equal(context.safeHref(href), null, href);
});
