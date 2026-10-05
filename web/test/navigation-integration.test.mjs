import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { createLearningServer } from '../server.mjs';
import { createNavigationBridge } from '../navigation/bridge.mjs';

// Every writable object lives inside a fresh, explicitly isolated project.
// Original navigation evidence is only copied and compared, never used as a writable root.
const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const realNavigation = 'D:/codex/2026-10-03/new-chat/outputs/小陌的领航室';
const fixtureParent = path.join(project, '验证/三系统整合');
const digest = data => createHash('sha256').update(data).digest('hex');
const evidenceFiles = [
  '依据/2026-10-03_生活记录与反思.md',
  '依据/2026-09-10_短片灵感_机器人与AI内部世界.md',
  '依据/原始转写/2026-09-10_短片灵感_原始转写.txt',
];

async function hashTree(root) {
  const result = {};
  async function walk(directory) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(filename);
      else if (entry.isFile()) result[path.relative(root, filename).replaceAll('\\', '/')] = digest(await fs.readFile(filename));
    }
  }
  await walk(root);
  return result;
}

async function fixture(t, options = {}) {
  const root = path.join(fixtureParent, 'navigation-independent-' + randomUUID());
  const navigationRoot = path.join(root, '领航室');
  await fs.mkdir(navigationRoot, { recursive: true });
  for (const name of ['tools', '方法', '.agents', '00_开始这里.md', '当前处境.md', '人生罗盘.md', '系统约定.md', '核心架构.md', 'connections.json', '状态/领航状态.json', ...evidenceFiles]) {
    const source = path.join(realNavigation, name), target = path.join(navigationRoot, name);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.cp(source, target, { recursive: true });
  }
  await fs.cp(path.join(project, '运行记录'), path.join(root, '运行记录'), { recursive: true });
  for (const name of ['运行约定.md', '开始这里.md']) await fs.copyFile(path.join(project, name), path.join(root, name));
  for (const name of ['learning', 'observatory', 'terminal']) {
    await fs.cp(path.join(project, 'web/public', name), path.join(root, 'web/public', name), { recursive: true });
  }
  await fs.cp(path.join(project, 'web/navigation/public'), path.join(root, 'web/navigation/public'), { recursive: true });
  const stateFile = path.join(navigationRoot, '状态/领航状态.json');
  const originalState = await fs.readFile(stateFile);
  const originalLearning = await hashTree(path.join(root, '运行记录'));
  const config = { schemaVersion: 1, navigationRoot };
  await fs.writeFile(path.join(root, 'navigation-connection.json'), JSON.stringify(config));
  const informationRoot = path.join(root, '信息收集');
  const databasePath = path.join(informationRoot, 'data/opportunities.sqlite3');
  await fs.mkdir(path.dirname(databasePath), { recursive: true });
  await fs.writeFile(databasePath, 'isolated mock identity file; not a database');
  const canonicalDatabase = await fs.realpath(databasePath);
  const informationMock = http.createServer((req, res) => {
    res.setHeader('Content-Type', req.url === '/api/health' ? 'application/json' : 'text/html; charset=utf-8');
    res.end(req.url === '/api/health' ? JSON.stringify({ app: 'xiaomo-opportunities', marker: digest(canonicalDatabase).slice(0, 16), local_only: true }) : '<!doctype html><title>隔离信息模块</title><p>旧代理路由仍然可进入。</p>');
  });
  await new Promise(resolve => informationMock.listen(0, '127.0.0.1', resolve));
  const modelCalls = [];
  const providerAdapter = { kind: 'mock', async complete(messages, metadata) {
    modelCalls.push({ messages, metadata });
    return '这是隔离模拟领航回复。现有记录只提供有限依据；候选建议需要小陌自己决定。';
  } };
  const server = createLearningServer({
    projectRoot: root, learningScope: 'isolated',
    env: {
      WORKSPACE_MODE: 'isolated', LEARNING_UI_MODE: 'isolated', NAVIGATION_ROOT: navigationRoot,
      WORKSPACE_STATE_PATH: path.join(root, '三系统工作台/data/workspace-state.json'),
      LEARNING_UI_STATE_PATH: path.join(root, '学习小岛/data/ui-state.json'),
      OBSERVATORY_MODE: 'isolated', OBSERVATORY_DATA_DIR: path.join(root, '素材观察室/data'),
      ...(options.env ?? {}),
    },
    informationOptions: { root: informationRoot, scope: 'isolated', port: informationMock.address().port },
    providerAdapter: options.noModel ? null : providerAdapter,
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  t.after(async () => {
    server.closeAllConnections?.();
    informationMock.closeAllConnections?.();
    await Promise.all([new Promise(resolve => server.close(resolve)), new Promise(resolve => informationMock.close(resolve))]);
    const actual = await fs.realpath(root), allowed = await fs.realpath(fixtureParent);
    const relative = path.relative(allowed, actual);
    assert.ok(relative.startsWith('navigation-independent-') && !relative.includes(path.sep), 'cleanup confined to the exact fixture root');
    await fs.rm(actual, { recursive: true });
  });
  async function request(route, { method = 'GET', body, token, headers = {} } = {}) {
    const response = await fetch(origin + route, {
      method, headers: { Origin: origin, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { 'X-Navigation-Token': token } : {}), ...headers },
      ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
      redirect: 'manual',
    });
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch {}
    return { status: response.status, headers: response.headers, body: data, text };
  }
  return { root, navigationRoot, stateFile, originalState, originalLearning, origin, server, request, modelCalls };
}

async function bootstrap(f) {
  const result = await f.request('/api/navigation/bootstrap');
  assert.equal(result.status, 200, result.text);
  assert.equal(result.body.ok, true);
  assert.equal(typeof result.body.data.token, 'string');
  return result.body.data;
}

function rawRequest(origin, pathname, headers, method = 'GET') {
  const address = new URL(origin);
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: address.hostname, port: address.port, path: pathname, method, headers }, res => {
      let text = '';
      res.on('data', chunk => text += chunk);
      res.on('end', () => resolve({ status: res.statusCode, text }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('navigation bootstrap is read-only and preserves dated original evidence and learning background', async t => {
  const f = await fixture(t), before = await hashTree(f.navigationRoot), boot = await bootstrap(f);
  assert.equal(boot.revision, JSON.parse(f.originalState).revision);
  assert.deepEqual(await fs.readFile(f.stateFile), f.originalState);
  assert.deepEqual(await hashTree(f.navigationRoot), before);
  assert.deepEqual(await hashTree(path.join(f.root, '运行记录')), f.originalLearning);
  assert.equal(f.modelCalls.length, 0);
  assert.ok(Array.isArray(boot.journeys));
  assert.ok(boot.journeys.length >= 2);
  const body = JSON.stringify(boot);
  assert.match(body, /2026-09-10/);
  assert.match(body, /2026-10-03/);
  for (const filename of evidenceFiles) {
    assert.equal(digest(await fs.readFile(path.join(f.navigationRoot, filename))), digest(await fs.readFile(path.join(realNavigation, filename))));
  }
});

test('navigation mount retains all modules and opens the adopted terminal homepage', async t => {
  const f = await fixture(t);
  for (const route of ['/learning/', '/observatory/', '/information/', '/navigation/']) {
    const result = await f.request(route);
    assert.equal(result.status, 200, `${route}: ${result.text}`);
    assert.match(result.headers.get('content-type'), /text\/html/);
  }
  const homepage = await f.request('/');
  assert.equal(homepage.status, 302);
  assert.equal(homepage.headers.get('location'), '/terminal/');
  const terminal = await f.request('/terminal/');
  assert.equal(terminal.status, 200);
  assert.match(terminal.headers.get('content-security-policy'), /script-src 'self'/);
  assert.match(terminal.text, /小陌的个人终端/);
  assert.doesNotMatch(terminal.text, /<script(?![^>]*src=)[^>]*>/);
  assert.doesNotMatch(terminal.text, /<style[\s>]/);
  for (const asset of ['app.js', 'app.css', 'shell.js', 'shell.css', 'assets/home.png']) {
    const result = await f.request('/terminal/' + asset);
    assert.equal(result.status, 200, asset);
  }
  assert.equal((await f.request('/terminal/..%5c..%5cAGENTS.md')).status, 404);
  assert.equal(f.modelCalls.length, 0);
  assert.deepEqual(await fs.readFile(f.stateFile), f.originalState);
});

test('navigation rejects foreign Host, Origin and duplicate Host before reading user data', async t => {
  const f = await fixture(t);
  assert.equal((await f.request('/api/navigation/bootstrap', { headers: { Origin: 'https://evil.example' } })).status, 403);
  assert.equal((await rawRequest(f.origin, '/api/navigation/bootstrap', ['Host', 'evil.example'])).status, 403);
  const host = new URL(f.origin).host;
  assert.equal((await rawRequest(f.origin, '/api/navigation/bootstrap', ['Host', host, 'Host', host])).status, 403);
  assert.deepEqual(await fs.readFile(f.stateFile), f.originalState);
});

test('isolated navigation refuses a formal navigation root', async t => {
  const f = await fixture(t, { env: { NAVIGATION_ROOT: realNavigation } }), realStateFile = path.join(realNavigation, '状态/领航状态.json');
  const realBefore = await fs.readFile(realStateFile);
  const denied = await f.request('/api/navigation/bootstrap');
  assert.ok(denied.status >= 400, denied.text);
  assert.deepEqual(await fs.readFile(realStateFile), realBefore);
  assert.deepEqual(await fs.readFile(f.stateFile), f.originalState);
});

test('a missing navigation state produces an error instead of initializing or migrating on GET', async t => {
  const f = await fixture(t);
  await fs.rename(f.stateFile, f.stateFile + '.preserved-original');
  const before = await hashTree(f.navigationRoot);
  const result = await f.request('/api/navigation/bootstrap');
  assert.ok(result.status >= 400, result.text);
  await assert.rejects(fs.stat(f.stateFile), { code: 'ENOENT' });
  assert.deepEqual(await hashTree(f.navigationRoot), before);
});

test('unconfigured navigation fails explicitly without initializing a shadow store', async t => {
  const f = await fixture(t, { env: { NAVIGATION_ROOT: '' } });
  const before = await hashTree(f.navigationRoot);
  const result = await f.request('/api/navigation/bootstrap');
  assert.ok(result.status >= 400, result.text);
  assert.deepEqual(await hashTree(f.navigationRoot), before);
  assert.deepEqual(await hashTree(path.join(f.root, '运行记录')), f.originalLearning);
  assert.equal((await f.request('/learning/')).status, 200);
});

test('navigation static and data paths cannot expose project files or traverse outside the module', async t => {
  const f = await fixture(t);
  for (const route of [
    '/navigation/%2e%2e%2f%2e%2e%2fAGENTS.md',
    '/navigation/%2e%2e%5c%2e%2e%5cAGENTS.md',
    '/navigation/%00index.html',
    '/api/navigation/journeys/%2e%2e%2f状态%2f领航状态.json',
  ]) {
    const result = await f.request(route);
    assert.ok(result.status >= 400, `${route}: ${result.text}`);
    assert.doesNotMatch(result.text, /个人协作约定|applied_events/);
  }
  const page = await f.request('/navigation/');
  assert.match(page.headers.get('content-security-policy'), /script-src 'self'/);
  assert.match(page.headers.get('content-security-policy'), /object-src 'none'/);
  assert.equal(page.headers.get('x-content-type-options'), 'nosniff');
  assert.deepEqual(await fs.readFile(f.stateFile), f.originalState);
});

test('navigation chat returns a reply without adopting candidates or writing learning/navigation data', async t => {
  const f = await fixture(t), boot = await bootstrap(f);
  const result = await f.request('/api/navigation/chat', {
    method: 'POST', token: boot.token,
    body: { requestId: 'qa-chat-' + randomUUID(), message: '结合我的背景，看看最近哪里可能卡住了。', mode: 'chat', asOf: '2026-10-04', history: [] },
  });
  assert.equal(result.status, 200, result.text);
  assert.equal(result.body.data.saved, false);
  assert.match(result.body.data.reply, /隔离模拟领航回复/);
  assert.equal(f.modelCalls.length, 1);
  assert.deepEqual(await fs.readFile(f.stateFile), f.originalState);
  assert.deepEqual(await hashTree(path.join(f.root, '运行记录')), f.originalLearning);
  const prompt = JSON.stringify(f.modelCalls[0].messages);
  assert.match(prompt, /个人情况|学习背景|用户背景/);
  assert.match(prompt, /候选|candidate/);
});

test('ordinary navigation input cannot invoke real models from an isolated no-model server', async t => {
  let compatibleCalls = 0;
  const configuredEndpoint = http.createServer((_req, res) => {
    compatibleCalls++;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ choices: [{ message: { content: 'This endpoint must not be called during an isolated test.' } }] }));
  });
  await new Promise(resolve => configuredEndpoint.listen(0, '127.0.0.1', resolve));
  t.after(async () => { configuredEndpoint.closeAllConnections?.(); await new Promise(resolve => configuredEndpoint.close(resolve)); });
  const f = await fixture(t, { noModel: true, env: {
    LEARNING_API_BASE_URL: 'http://127.0.0.1:' + configuredEndpoint.address().port,
    LEARNING_API_KEY: 'isolated-dummy-key',
  } }), boot = await bootstrap(f);
  const result = await f.request('/api/navigation/chat', { method: 'POST', token: boot.token, body: {
    requestId: 'qa-no-model-' + randomUUID(), message: '请回答', mode: 'chat', asOf: '2026-10-04', history: [],
  } });
  assert.ok(result.status >= 400, result.text);
  assert.equal(compatibleCalls, 0, 'the configured live-provider code path remains prohibited in isolation');
  assert.deepEqual(await fs.readFile(f.stateFile), f.originalState);
});

test('the two existing journeys expose the exact full document and raw transcript at their event dates', async t => {
  const f = await fixture(t), before = await hashTree(f.navigationRoot);
  const life = await f.request('/api/navigation/journeys/legacy-life-20261003');
  assert.equal(life.status, 200, life.text);
  assert.equal(life.body.data.entry.date, '2026-10-03');
  assert.equal(life.body.data.entry.content, (await fs.readFile(path.join(f.navigationRoot, evidenceFiles[0]), 'utf8')).replace(/^\uFEFF/, ''));
  assert.equal(life.body.data.entry.contentKind, 'mixed_document');
  const idea = await f.request('/api/navigation/journeys/legacy-idea-20260910');
  assert.equal(idea.status, 200, idea.text);
  assert.equal(idea.body.data.entry.date, '2026-09-10');
  assert.equal(idea.body.data.entry.content, (await fs.readFile(path.join(f.navigationRoot, evidenceFiles[1]), 'utf8')).replace(/^\uFEFF/, ''));
  assert.equal(idea.body.data.entry.rawTranscript, (await fs.readFile(path.join(f.navigationRoot, evidenceFiles[2]), 'utf8')).replace(/^\uFEFF/, ''));
  assert.ok(idea.body.data.entry.rawTranscript.split('\n').length > 40, 'the long original transcript remains multiline');
  const day = await f.request('/api/navigation/journeys?date=2026-09-10&type=idea');
  assert.equal(day.status, 200);
  assert.deepEqual(day.body.data.entries.map(entry => entry.id), ['legacy-idea-20260910']);
  assert.deepEqual(await hashTree(f.navigationRoot), before);
});

test('journey saves preserve exact raw text and are idempotent across a lost-response retry', async t => {
  const f = await fixture(t), boot = await bootstrap(f);
  const entry = { id: 'qa-raw-' + randomUUID(), title: '原话保留', date: '2026-10-02', type: 'note', content: '  原话第一行\n<svg onload="window.attacked=true">想法</svg>\n重复口头表达……\n  ' };
  const payload = { eventId: 'qa-event-' + randomUUID(), expectedRevision: boot.revision, entry };
  const saved = await f.request('/api/navigation/record', { method: 'POST', token: boot.token, body: payload });
  assert.equal(saved.status, 200, saved.text);
  assert.equal(saved.body.data.saved, true);
  assert.equal(saved.body.data.entry.content, entry.content);
  assert.equal(saved.body.data.revision, boot.revision + 1);
  const afterFirst = await fs.readFile(f.stateFile);
  // The client deliberately disregards the first response, verifies the same ID, then resends the identical event.
  const confirmed = await f.request('/api/navigation/journeys/' + entry.id);
  assert.deepEqual(Object.fromEntries(['id', 'title', 'date', 'type', 'content'].map(key => [key, confirmed.body.data.entry[key]])), entry);
  const retried = await f.request('/api/navigation/record', { method: 'POST', token: boot.token, body: payload });
  assert.equal(retried.status, 200, retried.text);
  assert.equal(retried.body.data.duplicate, true);
  assert.deepEqual(await fs.readFile(f.stateFile), afterFirst);
  const record = JSON.parse(afterFirst).records.find(record => record.id === entry.id);
  assert.equal(record.kind, 'user_report');
  assert.equal(record.content, entry.content);
  assert.equal(record.occurred_on, entry.date);
  const original = JSON.parse(f.originalState), updated = JSON.parse(afterFirst);
  assert.deepEqual(updated.records.slice(0, original.records.length), original.records);
  assert.deepEqual(updated.routes, original.routes);
  assert.deepEqual(updated.decisions, original.decisions);
  assert.deepEqual(await hashTree(path.join(f.root, '运行记录')), f.originalLearning);
});

test('stale revisions and changed-event retries fail atomically without replacing the original journey', async t => {
  const f = await fixture(t), boot = await bootstrap(f);
  const payload = { eventId: 'qa-conflict-' + randomUUID(), expectedRevision: boot.revision,
    entry: { id: 'qa-original-' + randomUUID(), title: '先保存的一条', date: '2026-10-04', type: 'life', content: '最初原话' } };
  assert.equal((await f.request('/api/navigation/record', { method: 'POST', token: boot.token, body: payload })).status, 200);
  const committed = await fs.readFile(f.stateFile);
  const stale = await f.request('/api/navigation/record', { method: 'POST', token: boot.token, body: {
    ...payload, eventId: 'qa-other-' + randomUUID(), entry: { ...payload.entry, id: 'qa-second-' + randomUUID(), content: '来自旧页的文本仍应留在草稿' },
  } });
  assert.equal(stale.status, 409, stale.text);
  assert.deepEqual(await fs.readFile(f.stateFile), committed);
  const changed = await f.request('/api/navigation/record', { method: 'POST', token: boot.token, body: { ...payload, entry: { ...payload.entry, content: '不能替换最初原话' } } });
  assert.equal(changed.status, 409, changed.text);
  assert.deepEqual(await fs.readFile(f.stateFile), committed);
  const original = await f.request('/api/navigation/journeys/' + payload.entry.id);
  assert.equal(original.body.data.entry.content, '最初原话');
});

test('simultaneous same-revision saves do not silently overwrite one another', async t => {
  const f = await fixture(t), boot = await bootstrap(f);
  const payload = label => ({ eventId: 'qa-parallel-event-' + randomUUID(), expectedRevision: boot.revision,
    entry: { id: 'qa-parallel-' + randomUUID(), title: label, date: '2026-10-04', type: 'note', content: label } });
  const first = payload('第一份草稿'), second = payload('第二份草稿');
  const results = await Promise.all([first, second].map(body => f.request('/api/navigation/record', { method: 'POST', token: boot.token, body })));
  assert.deepEqual(results.map(result => result.status).sort(), [200, 409]);
  const state = JSON.parse(await fs.readFile(f.stateFile));
  assert.equal(state.revision, boot.revision + 1);
  assert.equal(state.records.filter(record => [first.entry.id, second.entry.id].includes(record.id)).length, 1);
});

test('journey/analysis writes require the module token, bounded JSON and explicit supported fields', async t => {
  const f = await fixture(t), boot = await bootstrap(f);
  const payload = { eventId: 'qa-token-event-' + randomUUID(), expectedRevision: boot.revision,
    entry: { id: 'qa-token-' + randomUUID(), title: '未授权保存', date: '2026-10-04', type: 'note', content: '原文' } };
  assert.equal((await f.request('/api/navigation/record', { method: 'POST', body: payload })).status, 403);
  assert.equal((await f.request('/api/navigation/record', { method: 'POST', token: 'old-token', body: payload })).status, 403);
  assert.equal((await rawRequest(f.origin, '/api/navigation/record', ['Host', new URL(f.origin).host, 'X-Navigation-Token', boot.token, 'X-Navigation-Token', boot.token], 'POST')).status, 403);
  assert.equal((await f.request('/api/navigation/record', { method: 'POST', token: boot.token, body: payload, headers: { 'Content-Type': 'text/plain' } })).status, 415);
  assert.equal((await f.request('/api/navigation/record', { method: 'POST', token: boot.token, body: '{invalid' })).status, 400);
  assert.equal((await f.request('/api/navigation/record', { method: 'POST', token: boot.token, body: { ...payload, entry: { ...payload.entry, content: 'x'.repeat(120000) } } })).status, 413);
  const injected = await f.request('/api/navigation/record', { method: 'POST', token: boot.token, body: { ...payload, op: 'route_adopt', kind: 'observed' } });
  assert.equal(injected.status, 400, injected.text);
  assert.deepEqual(await fs.readFile(f.stateFile), f.originalState);
  assert.equal(f.modelCalls.length, 0);
});

test('navigation Python bridge bounds child output and terminates timed-out children without touching state', async t => {
  const f = await fixture(t);
  function fakeChild({ oversized = false } = {}) {
    const child = new EventEmitter();
    child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.stdin = new PassThrough();
    child.killed = false; child.kill = () => { child.killed = true; return true; };
    if (oversized) child.stdin.on('finish', () => { child.stdout.write(Buffer.alloc(8 * 1024 * 1024 + 1, 32)); });
    return child;
  }
  const output = fakeChild({ oversized: true });
  const largeBridge = createNavigationBridge({ projectRoot: f.root, env: { WORKSPACE_MODE: 'isolated', NAVIGATION_ROOT: f.navigationRoot }, spawnImpl: () => output });
  await assert.rejects(largeBridge.call('bootstrap'), { code: 'NAV_RESULT_TOO_LARGE' });
  assert.equal(output.killed, true);
  const hanging = fakeChild();
  const timeoutBridge = createNavigationBridge({ projectRoot: f.root, env: { WORKSPACE_MODE: 'isolated', NAVIGATION_ROOT: f.navigationRoot }, timeoutMs: 20, spawnImpl: () => hanging });
  await assert.rejects(timeoutBridge.call('bootstrap'), { code: 'NAV_BRIDGE_TIMEOUT' });
  assert.equal(hanging.killed, true);
  assert.deepEqual(await fs.readFile(f.stateFile), f.originalState);
});

test('flexible review uses occurrence dates, exposes evidence coverage and never invents an automatic analysis', async t => {
  const f = await fixture(t);
  const result = await f.request('/api/navigation/review?asOf=2026-10-04&since=2026-10-03&until=2026-10-03');
  assert.equal(result.status, 200, result.text);
  assert.equal(result.body.data.generated, false);
  assert.equal(result.body.data.coverage.journeyCount, 1);
  assert.deepEqual(result.body.data.journeys.map(entry => entry.id), ['legacy-life-20261003']);
  assert.ok(result.body.data.evidence.some(record => record.kind === 'user_report'));
  assert.ok(result.body.data.evidence.some(record => record.kind === 'ai_inference'));
  assert.match(result.body.data.coverage.note, /未记录不等于/);
  assert.match(result.body.data.handoffText, /不要求补打卡|固定日报/);
  const empty = await f.request('/api/navigation/review?asOf=2026-10-04&since=2026-10-01&until=2026-10-02');
  assert.equal(empty.status, 200, empty.text);
  assert.equal(empty.body.data.coverage.journeyCount, 0);
  assert.equal(empty.body.data.generated, false);
  assert.deepEqual(await fs.readFile(f.stateFile), f.originalState);
  assert.equal(f.modelCalls.length, 0);
});

test('only an explicit analysis save creates an AI interpretation and it remains separate from journeys and adopted routes', async t => {
  const f = await fixture(t), boot = await bootstrap(f), prior = JSON.parse(f.originalState);
  const id = 'qa-analysis-' + randomUUID();
  const result = await f.request('/api/navigation/analysis', { method: 'POST', token: boot.token, body: {
    eventId: 'qa-analysis-event-' + randomUUID(), expectedRevision: boot.revision, id,
    content: 'AI假设：开发投入可能挤压休息，还需本人校正。', relatedIds: ['R-20261003-daily-life'],
  } });
  assert.equal(result.status, 200, result.text);
  assert.equal(result.body.data.saved, true);
  assert.equal(result.body.data.kind, 'ai_inference');
  const state = JSON.parse(await fs.readFile(f.stateFile)), saved = state.records.find(record => record.id === id);
  assert.equal(saved.kind, 'ai_inference');
  assert.deepEqual(saved.related_ids, ['R-20261003-daily-life']);
  assert.deepEqual(state.routes, prior.routes);
  assert.deepEqual(state.decisions, prior.decisions);
  const journeys = await f.request('/api/navigation/journeys');
  assert.ok(!journeys.body.data.entries.some(entry => entry.id === id));
  const review = await f.request('/api/navigation/review?asOf=2026-10-04&since=2026-10-03&until=2026-10-03');
  assert.equal(review.body.data.evidence.find(record => record.id === id).kind, 'ai_inference');
  assert.deepEqual(await hashTree(path.join(f.root, '运行记录')), f.originalLearning);
  assert.equal(f.modelCalls.length, 0);
});
