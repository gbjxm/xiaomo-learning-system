import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import { WorkspaceStore, ISOLATION_ROOT, PROJECT_ROOT, WORKSPACE_LIMITS, normalizeRef, validateWorkspaceState } from './store.mjs';

const runRoot = path.join(ISOLATION_ROOT, 'Store单测-' + new Date().toISOString().replace(/[:.]/g, '-') + '-' + randomUUID().slice(0, 8));
await fs.mkdir(runRoot, { recursive: true });
const L = { module: 'learning', kind: 'learning', storeId: 'learning-test', id: 'island:home' };
const M = { module: 'observatory', kind: 'material', storeId: 'observatory-test', id: 'material-test' };
const O = { module: 'information', kind: 'opportunity', storeId: 'information-test', id: 'opportunity-test' };
const defaultState = () => ({ lastRegion: null, regions: {}, recent: [], observatoryRoutes: {} });
const digest = async file => createHash('sha256').update(await fs.readFile(file)).digest('hex');
function storeOptions(name) { const projectRoot = path.join(runRoot, name); return { projectRoot, stateFile: path.join(projectRoot, '三系统工作台', 'data', 'workspace-state.json'), scope: 'isolated' }; }
async function fixture(name, initialize = true) { const options = storeOptions(name); const store = new WorkspaceStore(options); const initial = initialize ? await store.initialize() : null; return { store, options, initial }; }
function link(identity, revision = 1, a = L, b = M, submissionId = randomUUID()) { return { identity, expectedRevision: revision, submissionId, action: 'link', input: { a, b } }; }
const code = expected => error => error.code === expected;
function child(script, args = []) {
  return new Promise((resolve, reject) => {
    const process = spawn(globalThis.process.execPath, ['--input-type=module', '-e', script, ...args], { cwd: PROJECT_ROOT, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = ''; process.stdout.on('data', data => stdout += data); process.stderr.on('data', data => stderr += data); process.on('error', reject);
    process.on('close', exitCode => exitCode ? reject(new Error(stderr || 'child exit ' + exitCode)) : resolve({ stdout, pid: process.pid }));
  });
}

test('missing reads and attempted save do not create an empty store or directory', async () => {
  const { store, options } = await fixture('missing', false);
  await assert.rejects(store.read(), code('WORKSPACE_MISSING'));
  await assert.rejects(store.identity(), code('WORKSPACE_MISSING'));
  await assert.rejects(store.listRelations(L), code('WORKSPACE_MISSING'));
  await assert.rejects(store.apply(link({ storeId: 'workspace_' + randomUUID(), projectRoot: options.projectRoot, canonicalPath: options.stateFile, schemaVersion: 1, scope: 'isolated' })), code('WORKSPACE_MISSING'));
  await assert.rejects(fs.lstat(options.projectRoot), error => error.code === 'ENOENT');
});

test('initialization is exclusive, minimal and reread across a fresh Store', async () => {
  const { store, options, initial } = await fixture('init'); const before = await digest(options.stateFile);
  assert.deepEqual(initial.state, defaultState()); assert.equal(initial.revision, 1); assert.equal(initial.stateRevision, 1); assert.equal(initial.verification.snapshotVerified, true);
  await assert.rejects(store.initialize(), code('WORKSPACE_EXISTS')); assert.equal(await digest(options.stateFile), before);
  assert.deepEqual(await new WorkspaceStore(options).read(), await store.read());
  assert.equal(initial.identity.projectRoot, options.projectRoot); assert.equal(initial.identity.canonicalPath, options.stateFile);
});

test('canonical links deduplicate reverse order, query both ways without transitivity, unlink keeps source', async () => {
  const { store, options, initial } = await fixture('relations'); const source = path.join(options.projectRoot, 'existing-source.txt');
  await fs.writeFile(source, 'Existing original content and personal notes\n'); const original = await digest(source);
  const first = await store.apply(link(initial.identity)); const edgeId = first.receipt.result.edgeId;
  const reverse = await store.apply(link(initial.identity, 2, M, L)); assert.equal(reverse.relations.length, 1); assert.equal(reverse.receipt.result.changed, false); assert.equal(reverse.receipt.result.edgeId, edgeId);
  await store.apply(link(initial.identity, 3, M, O));
  const fromL = await store.listRelations(L); const fromM = await store.listRelations(M);
  assert.equal(fromL.relations.length, 1); assert.deepEqual(fromL.relations[0].other, M); assert.equal(fromM.relations.length, 2); assert(!fromL.relations.some(edge => edge.other.id === O.id));
  const after = await store.apply({ identity: initial.identity, expectedRevision: 4, submissionId: randomUUID(), action: 'unlink', input: { edgeId } });
  assert.equal(after.relations.length, 1); assert.equal((await store.listRelations(L)).relations.length, 0); assert.equal(await digest(source), original);
});

test('full identity, self/same-module and invalid/prototype input are rejected without replacing data', async () => {
  const { store, options, initial } = await fixture('validation'); const before = await digest(options.stateFile);
  for (const field of ['storeId', 'projectRoot', 'canonicalPath', 'schemaVersion', 'scope']) {
    const identity = { ...initial.identity, [field]: field === 'schemaVersion' ? 2 : 'wrong' };
    await assert.rejects(store.apply(link(identity)), code('WORKSPACE_IDENTITY_MISMATCH'));
  }
  await assert.rejects(store.apply(link(initial.identity, 1, L, L)), code('WORKSPACE_SELF_LINK'));
  await assert.rejects(store.apply(link(initial.identity, 1, M, { ...M, kind: 'topic', id: 'topic-test' })), code('WORKSPACE_SAME_MODULE_LINK'));
  await assert.rejects(store.apply({ ...link(initial.identity), submissionId: 12345678 }), code('WORKSPACE_INVALID_INPUT'));
  await assert.rejects(store.apply(link(Object.setPrototypeOf({ ...initial.identity }, { injected: true }))), code('WORKSPACE_INVALID_INPUT'));
  let invoked = false; const identity = { ...initial.identity }; Object.defineProperty(identity, 'scope', { enumerable: true, get() { invoked = true; return 'isolated'; } });
  await assert.rejects(store.apply(link(identity)), code('WORKSPACE_INVALID_INPUT')); assert.equal(invoked, false);
  assert.throws(() => normalizeRef({ ...M, module: 'information' }), code('WORKSPACE_INVALID_REF'));
  assert.throws(() => normalizeRef({ kind: 'material', id: M.id }), code('WORKSPACE_INVALID_INPUT'));
  assert.equal(await digest(options.stateFile), before);
});

test('persisted receipt retries stay idempotent after later writes; stale save and changed payload preserve data', async () => {
  const { store, options, initial } = await fixture('retry'); const request = link(initial.identity);
  const first = await store.apply(request); await store.apply(link(initial.identity, 2, M, O)); const before = await digest(options.stateFile);
  const retry = await new WorkspaceStore(options).apply(JSON.parse(JSON.stringify(request)));
  assert.deepEqual(retry.receipt, first.receipt); assert.equal(retry.revision, 3); assert.equal(retry.verification.currentMatchesSubmittedRevision, false);
  await assert.rejects(store.apply({ ...request, expectedRevision: 3 }), code('WORKSPACE_SUBMISSION_CONFLICT'));
  await assert.rejects(store.apply(link(initial.identity, 1, L, O)), code('WORKSPACE_REVISION_CONFLICT'));
  assert.equal(await digest(options.stateFile), before);
});

test('new-link availability gates never block receipt replay or mutate rejected intent', async () => {
  const { store, options, initial } = await fixture('availability-retry'); const request = link(initial.identity); const before = await digest(options.stateFile); let calls = 0;
  const unavailable = async () => { calls++; throw new Error('Source temporarily unavailable'); };
  await assert.rejects(store.apply(request, { validateNewLink: unavailable }), /Source temporarily unavailable/);
  assert.equal(calls, 1); assert.equal(await digest(options.stateFile), before); assert.equal((await store.read()).revision, 1);
  const first = await store.apply(request, { validateNewLink: async input => { calls++; assert.deepEqual(input, request.input); input.a.id = 'island:post'; } });
  assert.equal(calls, 2); assert.deepEqual(first.receipt.result.relation.a.module === L.module ? first.receipt.result.relation.a : first.receipt.result.relation.b, L);
  const saved = await digest(options.stateFile); const retry = await new WorkspaceStore(options).apply(request, { validateNewLink: unavailable });
  assert.deepEqual(retry.receipt, first.receipt); assert.equal(calls, 2); assert.equal(await digest(options.stateFile), saved);
  await assert.rejects(store.apply({ ...request, input: { a: L, b: O } }, { validateNewLink: unavailable }), code('WORKSPACE_SUBMISSION_CONFLICT'));
  assert.equal(calls, 2); assert.equal(await digest(options.stateFile), saved);
});

test('state revision is independent, no receipts per scroll, unchanged stale state is safe', async () => {
  const { store, options, initial } = await fixture('state'); const state = defaultState();
  state.lastRegion = 'observatory'; state.recent = [M];
  state.regions.observatory = { url: '/observatory/?space=daily#topic/topic-test', scrollY: 321.5, filters: { searchInput: 'test query' }, focus: 'paragraph-1', detailId: null, detailScroll: 0, view: null, toolsClosed: true, reading: { stageVersion: 'stage-test', disclosures: [{ key: 'id:sources', open: true }] } };
  state.observatoryRoutes[state.regions.observatory.url] = { ...state.regions.observatory };
  const saved = await store.saveState({ identity: initial.identity, expectedRevision: 1, state }); assert.equal(saved.stateRevision, 2); assert.equal(saved.revision, 1);
  const related = await store.apply(link(initial.identity)); assert.deepEqual(related.state, state); assert.equal(related.stateRevision, 2);
  const before = await digest(options.stateFile); const same = await store.saveState({ identity: initial.identity, expectedRevision: 1, state }); assert.equal(same.changed, false); assert.equal(await digest(options.stateFile), before);
  await assert.rejects(store.saveState({ identity: initial.identity, expectedRevision: 1, state: { ...state, lastRegion: 'learning' } }), code('WORKSPACE_STATE_REVISION_CONFLICT'));
  assert.equal(await digest(options.stateFile), before); assert.equal(JSON.parse(await fs.readFile(options.stateFile, 'utf8')).submissions.length, 1);
});

test('bounded positions reject raw content, arbitrary URLs, wrong module paths, oversized histories and unsafe object keys', () => {
  for (const url of ['https://evil.example/', '//evil.example/observatory/', '/information/?space=daily', '/observatory/../information/', '/observatory/%2e%2e/information/', '/observatory/?proxy=https://evil.example', '/observatory/?space=other']) {
    const state = defaultState(); state.regions.observatory = { url }; assert.throws(() => validateWorkspaceState(state), error => error.code.startsWith('WORKSPACE_'));
  }
  const state = defaultState(); state.regions.observatory = { url: '/observatory/?space=daily', originalText: 'source content' }; assert.throws(() => validateWorkspaceState(state), code('WORKSPACE_INVALID_INPUT'));
  const history = defaultState(); history.observatoryRoutes = Object.fromEntries(Array.from({ length: 41 }, (_, index) => { const url = '/observatory/?space=daily#material/' + index; return [url, { url }]; })); assert.throws(() => validateWorkspaceState(history), code('WORKSPACE_INVALID_STATE'));
  const recent = defaultState(); recent.recent = Array.from({ length: 21 }, (_, index) => ({ ...M, id: 'material-' + index })); assert.throws(() => validateWorkspaceState(recent), code('WORKSPACE_INVALID_STATE'));
  assert.throws(() => validateWorkspaceState(JSON.parse('{"lastRegion":null,"regions":{},"recent":[],"__proto__":{}}')), code('WORKSPACE_INVALID_INPUT'));
});

test('two real processes with the same expected revision cannot overwrite each other', async () => {
  const { store, options, initial } = await fixture('process-cas');
  const files = [path.join(options.projectRoot, 'request-a.json'), path.join(options.projectRoot, 'request-b.json')];
  await fs.writeFile(files[0], JSON.stringify(link(initial.identity))); await fs.writeFile(files[1], JSON.stringify(link(initial.identity, 1, L, O)));
  const script = `const {WorkspaceStore}=await import(process.argv[1]);const fs=await import('node:fs/promises');try{const result=await new WorkspaceStore(JSON.parse(process.argv[2])).apply(JSON.parse(await fs.readFile(process.argv[3],'utf8')));process.stdout.write(JSON.stringify({ok:true,revision:result.revision}));}catch(error){process.stdout.write(JSON.stringify({ok:false,code:error.code}));}`;
  const results = await Promise.all(files.map(file => child(script, [new URL('./store.mjs', import.meta.url).href, JSON.stringify(options), file])));
  const reports = results.map(result => JSON.parse(result.stdout)); assert.equal(reports.filter(report => report.ok).length, 1); assert.equal(reports.find(report => !report.ok).code, 'WORKSPACE_REVISION_CONFLICT');
  const current = await store.read(); assert.equal(current.revision, 2); assert.equal(current.relations.length, 1); assert.equal(JSON.parse(await fs.readFile(options.stateFile, 'utf8')).submissions.length, 1);
});

test('lock recovery only reclaims a verified dead writer; a live owner remains untouched', async () => {
  const { store, options, initial } = await fixture('locks'); const lock = options.stateFile + '.lock';
  const exited = await child('process.stdout.write("exited");'); const deadOwner = JSON.stringify({ pid: exited.pid, token: randomUUID(), createdAt: new Date().toISOString() });
  await fs.writeFile(lock, deadOwner); const old = new Date(Date.now() - 3000); await fs.utimes(lock, old, old);
  const result = await store.apply(link(initial.identity)); assert.equal(result.revision, 2); await assert.rejects(fs.lstat(lock), error => error.code === 'ENOENT');
  const liveOwner = JSON.stringify({ pid: process.pid, token: randomUUID(), createdAt: new Date().toISOString() }); await fs.writeFile(lock, liveOwner); await fs.utimes(lock, old, old); const before = await digest(options.stateFile);
  await assert.rejects(store.apply(link(initial.identity, 2, M, O)), error => error.code === 'WORKSPACE_BUSY' && error.retryable);
  assert.equal(await fs.readFile(lock, 'utf8'), liveOwner); assert.equal(await digest(options.stateFile), before); await fs.unlink(lock);
});

test('corruption and incompatible scope never become a fresh empty store', async () => {
  const { store, options } = await fixture('corrupt'); await fs.writeFile(options.stateFile, '{incomplete'); const before = await digest(options.stateFile);
  await assert.rejects(store.read(), code('WORKSPACE_INVALID_DATABASE')); await assert.rejects(store.initialize(), code('WORKSPACE_EXISTS')); assert.equal(await digest(options.stateFile), before);
  assert.throws(() => new WorkspaceStore({ stateFile: path.join(PROJECT_ROOT, 'workspace-state.json'), scope: 'isolated' }), code('WORKSPACE_INVALID_PATH'));
  assert.throws(() => new WorkspaceStore({ ...storeOptions('bad-scope'), scope: 'production' }), code('WORKSPACE_INVALID_PATH'));
});

test('receipt cap rejects new writes but does not forget idempotent retries', async () => {
  const { store, options, initial } = await fixture('receipt-cap'); const request = link(initial.identity); const first = await store.apply(request);
  const record = JSON.parse(await fs.readFile(options.stateFile, 'utf8')); const template = record.submissions[0];
  record.submissions = Array.from({ length: WORKSPACE_LIMITS.receipts }, (_, index) => ({ ...template, submissionId: index === 0 ? request.submissionId : 'capacity-' + index, revision: index + 2 })); record.revision = WORKSPACE_LIMITS.receipts + 1;
  await fs.writeFile(options.stateFile, JSON.stringify(record)); const before = await digest(options.stateFile);
  await assert.rejects(store.apply(link(initial.identity, record.revision, L, O)), code('WORKSPACE_LIMIT'));
  const retry = await store.apply(request); assert.deepEqual(retry.receipt, first.receipt); assert.equal(await digest(options.stateFile), before);
});

test('CLI read is harmless and explicit isolated initialization can be reread', async () => {
  const options = storeOptions('cli'); const cli = new URL('./cli.mjs', import.meta.url); const args = ['--state-file', options.stateFile, '--project-root', options.projectRoot, '--scope', 'isolated'];
  const run = command => new Promise(resolve => { const childProcess = spawn(process.execPath, [fileURL(cli), command, ...args], { windowsHide: true }); let stdout = '', stderr = ''; childProcess.stdout.on('data', data => stdout += data); childProcess.stderr.on('data', data => stderr += data); childProcess.on('close', exitCode => resolve({ stdout, stderr, exitCode })); });
  const missing = await run('read'); assert.equal(JSON.parse(missing.stderr).error.code, 'WORKSPACE_MISSING'); await assert.rejects(fs.lstat(options.projectRoot), error => error.code === 'ENOENT');
  const initialized = await run('init'); assert.equal(initialized.exitCode, 0); const current = await run('read'); assert.equal(JSON.parse(current.stdout).data.identity.storeId, JSON.parse(initialized.stdout).data.identity.storeId);
});
function fileURL(url) { return process.platform === 'win32' ? decodeURIComponent(url.pathname).slice(1).replaceAll('/', '\\') : decodeURIComponent(url.pathname); }

test.after(async () => { await fs.writeFile(path.join(runRoot, '测试证据.json'), JSON.stringify({ runRoot, productionTouched: false, definedTests: 13, testSelection: process.execArgv.find(value => value.startsWith('--test-name-pattern')) || 'all', timestamp: new Date().toISOString() }, null, 2)); });
