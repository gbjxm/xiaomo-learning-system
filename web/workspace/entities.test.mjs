import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { createEntityCatalog } from './entities.mjs';
import { WorkspaceStore, ISOLATION_ROOT, normalizeRef, validateWorkspaceState } from './store.mjs';
import { createWorkspaceHandler } from './http.mjs';
import { createContentHandler } from '../content/http.mjs';
import { ContentStore } from '../content/store.mjs';
import { LearningRepository, encodeTaskMetadata } from '../learning/records.mjs';
import { LearningCommitter } from '../learning/commit.mjs';

const now = () => new Date('2026-10-06T04:00:00.000Z');
async function fixture(t, { workspace = false } = {}) {
  const parent = workspace ? ISOLATION_ROOT : os.tmpdir();
  await fs.mkdir(parent, { recursive: true });
  const root = await fs.mkdtemp(path.join(parent, 'xiaomo-catalog-'));
  t.after(async () => { const actual = await fs.realpath(root), allowed = await fs.realpath(parent), relative = path.relative(allowed, actual); assert.ok(relative.startsWith('xiaomo-catalog-') && !relative.includes(path.sep)); await fs.rm(actual, { recursive: true }); });
  const repository = new LearningRepository({ projectRoot: root, scope: 'isolated' });
  const content = new ContentStore({ projectRoot: root, scope: 'isolated', repository, now });
  const committer = new LearningCommitter({ projectRoot: root, scope: 'isolated', repository, now });
  const saved = await committer.save({ payload: { requestId: 'catalog-note-0001', mode: 'chat', message: '原话中的独特关键词', history: [] }, reply: '单独的AI解释', kind: 'note', note: { title: '同名对象' } });
  assert.equal(saved.saved, true);
  const task = { taskId: 'task_catalog_0001', goalRevision: 2, title: '同名对象', purpose: '原任务目的', courseId: null, allowedHelp: '可解释', observationPoints: [], knownPerformance: '未判断', stopPoint: '原停止处', nextStep: '回原处', status: 'active', evidenceRefs: [], candidates: [], updatedAt: now().toISOString(), lastRequestId: 'catalog-task-0001' };
  await fs.appendFile(path.join(root, '运行记录/学习记录/2026-10-06.md'), '\n' + encodeTaskMetadata(task) + '\n');
  const bootstrap = await content.bootstrap();
  const creation = await content.save({ identity: bootstrap.identity, expectedRevision: bootstrap.revision, submissionId: randomUUID(), item: { kind: 'creation', title: '同名对象', body: '创作原文' } });
  const uiRecord = { revision: 7, state: { islandState: { records: [{ id: 'old-record', title: '旧书签' }] } } };
  const uiStore = { async read() { return uiRecord; }, identity() { return { storeId: 'ui-catalog-test', scope: 'isolated' }; } };
  const informationManager = { async verify() { throw Object.assign(new Error('隔离信息源未启动'), { code: 'TEST_SOURCE_OFFLINE' }); } };
  const catalog = (extra = {}) => createEntityCatalog({ projectRoot: root, scope: 'isolated', env: { OBSERVATORY_DATA_DIR: path.join(root, 'observatory') }, uiStore, informationManager, ...extra });
  return { root, content, catalog, uiStore, noteId: saved.noteId, taskId: task.taskId, contentId: creation.item.id };
}

test('目录保留旧 UI 引用，并精确区分同名正式笔记、任务与内容', async t => {
  const f = await fixture(t), before = await f.content.bootstrap(), result = await f.catalog().list();
  const formal = result.items.filter(item => item.ref.storeId === before.identity);
  assert.deepEqual(formal.map(item => item.ref.id).sort(), ['note:' + f.noteId, 'task:' + f.taskId, 'content:' + f.contentId].sort());
  assert.ok(result.items.some(item => item.ref.storeId === 'ui-catalog-test' && item.ref.id === 'record:old-record'));
  for (const entry of formal) {
    assert.deepEqual(normalizeRef(entry.ref), entry.ref);
    const url = new URL(entry.href, 'http://127.0.0.1');
    assert.equal(url.pathname, '/learning/content/');
    const detail = await f.content.detail(url.searchParams.get('item'));
    assert.deepEqual(detail.item.workspaceRef, entry.ref); assert.equal(detail.scope, 'isolated');
    assert.deepEqual((await f.catalog().resolve(entry.ref, { required: true })).ref, entry.ref);
  }
  assert.equal((await f.catalog().list({ query: '独特关键词' })).items.length, 1);
  assert.deepEqual(await f.content.bootstrap(), before, '目录读取不写正式对象或改版本');
});

test('UI 读取失败与 scope 不符都不能吞掉正式对象，并显式返回局部错误', async t => {
  const f = await fixture(t);
  for (const uiStore of [
    { async read() { throw Object.assign(new Error('损坏UI'), { code: 'UI_STATE_CORRUPT' }); } },
    { ...f.uiStore, identity() { return { scope: 'production', storeId: 'wrong-ui' }; } },
  ]) {
    const catalog = f.catalog({ uiStore }), result = await catalog.list();
    assert.equal(result.items.filter(item => /^(note|task|content):/.test(item.ref.id)).length, 3);
    assert.ok(result.errors.some(error => error.module === 'learning' && error.source === 'ui'));
    const target = result.items.find(item => item.ref.id === 'note:' + f.noteId);
    assert.deepEqual((await catalog.resolve(target.ref, { required: true })).ref, target.ref);
  }
  const brokenUIContent = new ContentStore({ projectRoot: f.root, scope: 'isolated', uiStateReader: async () => { throw Object.assign(new Error('损坏UI'), { code: 'UI_STATE_CORRUPT' }); } });
  const listing = await brokenUIContent.list(); assert.equal(listing.items.length, 3);
  assert.ok(listing.warnings.some(warning => warning.code === 'UI_STATE_CORRUPT'));
  assert.equal((await brokenUIContent.detail('learning-note:' + f.noteId)).item.noteId, f.noteId);
});

test('稳定身份跨重启不变，错来源及隔离根不能解析成另一份同编号对象', async t => {
  const a = await fixture(t), b = await fixture(t);
  assert.equal(new ContentStore({ projectRoot: a.root, scope: 'isolated' }).identity, a.content.identity);
  assert.notEqual(a.content.identity, b.content.identity);
  const ref = (await a.catalog().list()).items.find(item => item.ref.id === 'note:' + a.noteId).ref;
  assert.equal((await b.catalog().resolve(ref)).availability, 'missing');
  await assert.rejects(b.catalog().resolve(ref, { required: true }), error => error.code === 'WORKSPACE_ENTITY_UNAVAILABLE');
  await assert.rejects(a.catalog().resolve({ ...ref, storeId: 'ui-catalog-test' }, { required: true }), error => error.code === 'WORKSPACE_ENTITY_UNAVAILABLE');
});

test('正式引用与精确内容 URL 可保存，未知前缀和越界仍拒绝', () => {
  const ref = { module: 'learning', kind: 'learning', storeId: 'content:identity', id: 'note:note_' + 'a'.repeat(24) };
  assert.deepEqual(normalizeRef(ref), ref);
  const state = { lastRegion: 'learning', regions: { learning: { url: '/learning/content/?item=learning-note%3Anote_' + 'a'.repeat(24) } }, recent: [ref] };
  assert.equal(validateWorkspaceState(state), state);
  for (const id of ['note:bad', 'task:short', 'content:../W001', 'anything:test']) assert.throws(() => normalizeRef({ ...ref, id }));
  assert.throws(() => validateWorkspaceState({ ...state, regions: { learning: { url: '/learning/content/?item=..%2Fsecret' } } }));
});

test('无效学习元信息明确提示目录不完整，不伪造对象或修改原文', async t => {
  const f = await fixture(t), file = path.join(f.root, '运行记录/学习记录/2026-10-06.md');
  await fs.appendFile(file, '\n<!-- learning-task:v1 e30= -->\n');
  const before = await fs.readFile(file, 'utf8'), result = await f.catalog().list();
  assert.ok(result.errors.some(error => error.module === 'learning' && error.source === 'records' && /任务标记/.test(error.message)));
  assert.equal(result.items.filter(item => /^(note|task|content):/.test(item.ref.id)).length, 3);
  assert.equal(await fs.readFile(file, 'utf8'), before);
});

test('真实 HTTP 将目录对应到精确详情，双向关联回读与解除不修改原对象', async t => {
  const f = await fixture(t, { workspace: true });
  const stateFile = path.join(f.root, '三系统工作台/data/workspace-state.json');
  await new WorkspaceStore({ projectRoot: f.root, stateFile, scope: 'isolated' }).initialize();
  const sourceBefore = await f.content.bootstrap();
  const informationManager = {
    async verify() { return { scope: 'isolated', marker: 'info-isolated-test' }; },
    async read(route) { return route.startsWith('/api/works') ? { works: [] } : { items: [{ id: 'opportunity-test', title: '隔离机会' }] }; },
  };
  const workspaceHandler = createWorkspaceHandler({ projectRoot: f.root, env: { WORKSPACE_MODE: 'isolated', WORKSPACE_STATE_PATH: stateFile, OBSERVATORY_DATA_DIR: path.join(f.root, 'observatory') }, uiStore: f.uiStore, informationManager });
  const contentHandler = createContentHandler({ store: f.content });
  const server = http.createServer(async (req, res) => {
    try { const url = new URL(req.url, 'http://127.0.0.1'); if (await contentHandler(req, res, url) || await workspaceHandler(req, res, url)) return; res.writeHead(404).end(); }
    catch (error) { res.writeHead(500).end(error.message); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const origin = 'http://127.0.0.1:' + server.address().port;
  async function request(route, body, token) {
    const response = await fetch(origin + route, { ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Workspace-Token': token }, body: JSON.stringify(body) } : {}) });
    const data = await response.json(); assert.equal(response.status, 200, JSON.stringify(data)); return data.data ?? data;
  }
  const catalog = await request('/api/workspace/catalog'), a = catalog.items.find(item => item.ref.id === 'note:' + f.noteId), b = catalog.items.find(item => item.ref.module === 'information');
  const itemId = new URL(a.href, origin).searchParams.get('item');
  const detail = await request('/api/learning/content/items/' + encodeURIComponent(itemId));
  assert.equal(detail.scope, 'isolated'); assert.deepEqual(detail.item.workspaceRef, a.ref); assert.equal(detail.item.body, '原话中的独特关键词');
  const bootstrap = await request('/api/workspace/bootstrap');
  const saved = await request('/api/workspace/action', { identity: bootstrap.identity, expectedRevision: bootstrap.revision, submissionId: randomUUID(), action: 'link', input: { a: a.ref, b: b.ref } }, bootstrap.token);
  const relations = ref => request('/api/workspace/relations?' + new URLSearchParams(ref));
  const [fromA, fromB] = await Promise.all([relations(a.ref), relations(b.ref)]);
  assert.equal(fromA.relations[0].edgeId, fromB.relations[0].edgeId); assert.equal(fromB.relations[0].href, a.href);
  assert.deepEqual(fromB.relations[0].otherRef, a.ref);
  await request('/api/workspace/action', { identity: bootstrap.identity, expectedRevision: saved.revision, submissionId: randomUUID(), action: 'unlink', input: { edgeId: fromA.relations[0].edgeId } }, bootstrap.token);
  assert.equal((await relations(a.ref)).relations.length, 0);
  assert.deepEqual(await f.content.bootstrap(), sourceBefore);
});
