import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';

export const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DEFAULT_WORKSPACE_FILE = path.join(PROJECT_ROOT, '三系统工作台', 'data', 'workspace-state.json');
export const ISOLATION_ROOT = path.join(PROJECT_ROOT, '验证', '三系统整合');
export const WORKSPACE_LIMITS = Object.freeze({ stateBytes: 1024 * 1024, storeBytes: 8 * 1024 * 1024, relations: 2000, receipts: 4096, recent: 20, observatoryRoutes: 40, disclosures: 128, lockWaitMs: 1500 });
export const DEFAULT_WORKSPACE_STATE = Object.freeze({ lastRegion: null, regions: Object.freeze({}), recent: Object.freeze([]), observatoryRoutes: Object.freeze({}) });
const MODULES = ['learning', 'observatory', 'information'];
const KINDS = { learning: ['learning'], observatory: ['material', 'topic'], information: ['opportunity', 'work'] };
const IDENTITY_FIELDS = ['storeId', 'projectRoot', 'canonicalPath', 'schemaVersion', 'scope'];
const RECORD_FIELDS = ['url', 'scrollY', 'filters', 'focus', 'detailId', 'detailScroll', 'view', 'toolsClosed', 'reading'];
const FILTERS = { learning: [], observatory: ['searchInput', 'categoryFilter', 'kindFilter', 'statusFilter', 'topicSearch', 'topicStatus'], information: ['search', 'platform', 'status', 'reward', 'fit-filter', 'sort'] };
export class WorkspaceError extends Error {
  constructor(code, message, status = 400, retryable = false, details = {}) { super(message); this.code = code; this.status = status; this.retryable = retryable; this.details = details; }
}
const fail = (...args) => { throw new WorkspaceError(...args); };
const stable = value => Array.isArray(value) ? '[' + value.map(stable).join(',') + ']' : value && typeof value === 'object' ? '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + stable(value[key])).join(',') + '}' : JSON.stringify(value);
const sha = value => createHash('sha256').update(stable(value)).digest('hex');
const clone = value => JSON.parse(JSON.stringify(value));
const samePath = (a, b) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
const inside = (child, parent) => { const relative = path.relative(parent, child); return !!relative && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative); };
function object(value, allowed, required = [], label = '提交') {
  if (!value || Array.isArray(value) || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype || Object.getOwnPropertySymbols(value).length) fail('WORKSPACE_INVALID_INPUT', `${label}须为普通JSON对象。`);
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
    if (!descriptor.enumerable || descriptor.get || descriptor.set || ['__proto__', 'constructor', 'prototype'].includes(key) || !allowed.includes(key)) fail('WORKSPACE_INVALID_INPUT', `${label}包含不支持的字段。`, 400, false, { field: key });
  }
  if (required.some(key => !Object.hasOwn(value, key))) fail('WORKSPACE_INVALID_INPUT', `${label}缺少必要字段。`);
  return value;
}
function text(value, label, max = 256, empty = false) {
  if (typeof value !== 'string' || value.length > max || (!empty && !value.length) || /[\u0000-\u001f\u007f]/u.test(value)) fail('WORKSPACE_INVALID_INPUT', `${label}文字无效或过长。`);
  return value;
}
function integer(value, label, min = 1) { if (!Number.isSafeInteger(value) || value < min) fail('WORKSPACE_INVALID_INPUT', `${label}无效。`); return value; }
function timestamp(value) { if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) || !Number.isFinite(Date.parse(value))) fail('WORKSPACE_INVALID_DATABASE', '工作台时间字段损坏。', 503); }
export function normalizeRef(value) {
  object(value, ['module', 'kind', 'storeId', 'id'], ['module', 'kind', 'storeId', 'id'], '实体引用');
  if (!MODULES.includes(value.module) || !KINDS[value.module].includes(value.kind)) fail('WORKSPACE_INVALID_REF', '实体模块与类型不匹配。');
  text(value.storeId, '来源storeId', 256); text(value.id, '实体ID', 256);
  if (value.kind === 'learning' && !/^(?:island:(?:home|story|visual|post)|(?:activity|record):[A-Za-z0-9_-]{1,180})$/.test(value.id)) fail('WORKSPACE_INVALID_REF', '学习引用须为已保存的岛屿、活动或记录ID。');
  return { module: value.module, kind: value.kind, storeId: value.storeId, id: value.id };
}
function relationFor(a, b) {
  a = normalizeRef(a); b = normalizeRef(b);
  if (stable(a) === stable(b)) fail('WORKSPACE_SELF_LINK', '不能关联实体自身。');
  if (a.module === b.module) fail('WORKSPACE_SAME_MODULE_LINK', '同区域关系使用原模块，不在跨区工作台重复保存。');
  if (stable(a) > stable(b)) [a, b] = [b, a];
  return { edgeId: 'edge_' + sha([a, b]), a, b };
}
function localURL(value, module) {
  text(value, '本机区域URL', 2048);
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) fail('WORKSPACE_INVALID_STATE', '阅读位置只允许本机区域的相对URL。');
  const pathname = value.split(/[?#]/)[0];
  try { for (const part of pathname.split('/')) { const decoded = decodeURIComponent(part); if (['.', '..'].includes(decoded) || /[\\/\u0000-\u001f]/u.test(decoded)) throw new Error(); } } catch { fail('WORKSPACE_INVALID_STATE', '阅读URL含越界或无效路径。'); }
  const url = new URL(value, 'http://workspace.local');
  if (url.origin !== 'http://workspace.local' || !(url.pathname === `/${module}` || url.pathname.startsWith(`/${module}/`))) fail('WORKSPACE_INVALID_STATE', '阅读URL与所属区域不一致。');
  const seen = new Set();
  for (const [key, parameter] of url.searchParams) {
    if (seen.has(key)) fail('WORKSPACE_INVALID_STATE', '阅读URL查询字段重复。'); seen.add(key);
    const valid = key === 'space' ? parameter === 'daily'
      : ['focus', 'id'].includes(key) ? /^[A-Za-z0-9_:-]{1,256}$/.test(parameter)
      : key === 'kind' ? Object.values(KINDS).flat().includes(parameter)
      : key === 'preview-place' ? ['courses', 'practice', 'watch'].includes(parameter) && module === 'learning'
      : key === 'preview-view' ? ['opportunities', 'works'].includes(parameter) && module === 'information' : false;
    if (!valid) fail('WORKSPACE_INVALID_STATE', '阅读URL含不支持的查询字段。');
  }
  if ((seen.has('preview-place') || seen.has('preview-view') || seen.has('kind')) && url.searchParams.get('space') !== 'daily') fail('WORKSPACE_INVALID_STATE', '功能查询只允许工作台入口。');
  return value;
}
function disclosures(value) {
  if (!Array.isArray(value) || value.length > WORKSPACE_LIMITS.disclosures) fail('WORKSPACE_INVALID_STATE', '折叠阅读位置过多。');
  const seen = new Set();
  for (const entry of value) { object(entry, ['key', 'open'], ['key', 'open'], '折叠位置'); text(entry.key, '折叠位置key', 300); if (typeof entry.open !== 'boolean' || seen.has(entry.key)) fail('WORKSPACE_INVALID_STATE', '折叠位置无效或重复。'); seen.add(entry.key); }
}
function reading(value, module) {
  if (value === null) return;
  if (module === 'learning') fail('WORKSPACE_INVALID_STATE', '学习阅读位置不能作为活动进度保存。');
  const fields = module === 'observatory' ? ['stageVersion', 'disclosures'] : ['mainView', 'detailId', 'mainDisclosures', 'detailDisclosures'];
  object(value, fields, [], '阅读位置');
  for (const [key, entry] of Object.entries(value)) {
    if (key.endsWith('Disclosures') || key === 'disclosures') disclosures(entry);
    else if (entry !== null) text(entry, key, 256, true);
  }
}
function regionRecord(value, module) {
  object(value, RECORD_FIELDS, ['url'], '区域位置'); localURL(value.url, module);
  for (const key of ['scrollY', 'detailScroll']) if (Object.hasOwn(value, key) && (!Number.isFinite(value[key]) || value[key] < 0 || value[key] > 10000000)) fail('WORKSPACE_INVALID_STATE', '阅读滚动位置无效。');
  for (const key of ['focus', 'detailId', 'view']) if (Object.hasOwn(value, key) && value[key] !== null) text(value[key], key, 256, true);
  if (Object.hasOwn(value, 'toolsClosed') && typeof value.toolsClosed !== 'boolean') fail('WORKSPACE_INVALID_STATE', '区域栏状态无效。');
  if (Object.hasOwn(value, 'filters')) { object(value.filters, FILTERS[module], [], '区域筛选'); for (const entry of Object.values(value.filters)) text(entry, '筛选', 2000, true); }
  if (Object.hasOwn(value, 'reading')) reading(value.reading, module);
}
export function validateWorkspaceState(value) {
  object(value, ['lastRegion', 'regions', 'recent', 'observatoryRoutes'], ['lastRegion', 'regions', 'recent'], '工作台位置');
  if (value.lastRegion !== null && !MODULES.includes(value.lastRegion)) fail('WORKSPACE_INVALID_STATE', '最后区域无效。');
  object(value.regions, MODULES, [], '区域位置集合'); for (const [module, entry] of Object.entries(value.regions)) regionRecord(entry, module);
  if (!Array.isArray(value.recent) || value.recent.length > WORKSPACE_LIMITS.recent) fail('WORKSPACE_INVALID_STATE', '最近实体最多20项。');
  const seen = new Set(); for (const ref of value.recent) { const key = stable(normalizeRef(ref)); if (seen.has(key)) fail('WORKSPACE_INVALID_STATE', '最近实体不能重复。'); seen.add(key); }
  if (Object.hasOwn(value, 'observatoryRoutes')) {
    const routes = value.observatoryRoutes;
    if (!routes || Object.getPrototypeOf(routes) !== Object.prototype || Object.getOwnPropertySymbols(routes).length || Object.keys(routes).length > WORKSPACE_LIMITS.observatoryRoutes) fail('WORKSPACE_INVALID_STATE', '素材阅读路线最多40项。');
    object(routes, Object.keys(routes), [], '素材阅读路线');
    for (const [url, entry] of Object.entries(routes)) { localURL(url, 'observatory'); regionRecord(entry, 'observatory'); if (entry.url !== url) fail('WORKSPACE_INVALID_STATE', '素材阅读路线key与URL不一致。'); }
  }
  if (Buffer.byteLength(JSON.stringify(value), 'utf8') > WORKSPACE_LIMITS.stateBytes) fail('WORKSPACE_STATE_TOO_LARGE', '阅读位置超过1MiB；保留必要位置，不保存原文或无限历史。', 413);
  return value;
}
async function exists(file) { try { await fs.lstat(file); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } }
async function recoverDeadLock(file) {
  try {
    const before = await fs.lstat(file); if (!before.isFile() || before.isSymbolicLink() || before.size > 4096 || Date.now() - before.mtimeMs < 1000) return false;
    const raw = await fs.readFile(file, 'utf8'); const owner = JSON.parse(raw);
    if (!Number.isSafeInteger(owner.pid) || owner.pid < 1 || typeof owner.token !== 'string' || typeof owner.createdAt !== 'string') return false;
    try { process.kill(owner.pid, 0); return false; } catch (error) { if (error.code !== 'ESRCH') return false; }
    const after = await fs.lstat(file);
    if (after.dev !== before.dev || after.ino !== before.ino || after.size !== before.size || after.mtimeMs !== before.mtimeMs || await fs.readFile(file, 'utf8') !== raw) return false;
    await fs.unlink(file); return true;
  } catch { return false; }
}
export class WorkspaceStore {
  constructor({ projectRoot = PROJECT_ROOT, stateFile = DEFAULT_WORKSPACE_FILE, scope = 'production' } = {}) {
    if (typeof stateFile !== 'string' || typeof projectRoot !== 'string' || !path.isAbsolute(stateFile) || !path.isAbsolute(projectRoot) || /^\\\\/.test(stateFile) || stateFile.slice(2).includes(':') || projectRoot.slice(2).includes(':')) fail('WORKSPACE_INVALID_PATH', '工作台须使用固定本机绝对路径。', 403);
    this.file = path.resolve(stateFile); this.projectRoot = path.resolve(projectRoot); this.scope = scope;
    if (scope === 'production') { if (!samePath(this.file, DEFAULT_WORKSPACE_FILE) || !samePath(this.projectRoot, PROJECT_ROOT)) fail('WORKSPACE_INVALID_PATH', '正式工作台仅允许本项目固定新文件。', 403); }
    else if (scope !== 'isolated' || !inside(this.file, ISOLATION_ROOT) || !(samePath(this.projectRoot, PROJECT_ROOT) || inside(this.projectRoot, ISOLATION_ROOT)) || (!samePath(this.projectRoot, PROJECT_ROOT) && !inside(this.file, this.projectRoot))) fail('WORKSPACE_INVALID_PATH', '隔离工作台只允许本项目三系统整合验证目录。', 403);
    if (path.basename(this.file) !== 'workspace-state.json' || path.basename(path.dirname(this.file)) !== 'data' || path.basename(path.dirname(path.dirname(this.file))) !== '三系统工作台') fail('WORKSPACE_INVALID_PATH', '工作台文件须位于三系统工作台/data/workspace-state.json。', 403);
  }
  #identity(record) { return { storeId: record.storeId, projectRoot: this.projectRoot, canonicalPath: this.file, schemaVersion: 1, scope: this.scope }; }
  #public(record) { return { identity: this.#identity(record), revision: record.revision, stateRevision: record.stateRevision, relations: clone(record.relations), state: clone(record.state) }; }
  async #safePath() {
    let directory = path.dirname(this.file);
    while (!await exists(directory)) { const parent = path.dirname(directory); if (parent === directory) fail('WORKSPACE_INVALID_PATH', '工作台路径没有有效根目录。', 403); directory = parent; }
    if (!samePath(await fs.realpath(directory), path.resolve(directory))) fail('WORKSPACE_INVALID_PATH', '工作台目录包含重定向路径。', 403);
    if (await exists(this.file)) { const stat = await fs.lstat(this.file); if (!stat.isFile() || stat.isSymbolicLink()) fail('WORKSPACE_INVALID_PATH', '工作台须为普通文件，不能是链接。', 403); }
  }
  #assertIdentity(expected, record) {
    object(expected, IDENTITY_FIELDS, IDENTITY_FIELDS, '数据身份'); const actual = this.#identity(record);
    for (const field of IDENTITY_FIELDS) if (!(['projectRoot', 'canonicalPath'].includes(field) && typeof expected[field] === 'string' ? samePath(expected[field], actual[field]) : expected[field] === actual[field])) fail('WORKSPACE_IDENTITY_MISMATCH', '工作台身份变化，保留待保存内容并核对入口。', 409, false, { field });
  }
  async #load() {
    await this.#safePath(); let raw;
    try { raw = await fs.readFile(this.file, 'utf8'); } catch (error) { if (error.code === 'ENOENT') fail('WORKSPACE_MISSING', '工作台尚未初始化；读取未创建文件。', 404, false, { initializationRequired: true }); throw error; }
    if (Buffer.byteLength(raw, 'utf8') > WORKSPACE_LIMITS.storeBytes) fail('WORKSPACE_INVALID_DATABASE', '工作台文件异常过大，保留原文件。', 503);
    let record; try { record = JSON.parse(raw); } catch { fail('WORKSPACE_INVALID_DATABASE', '工作台文件损坏，保留原文件，不显示空状态。', 503); }
    try {
      object(record, ['schemaVersion', 'storeId', 'projectRoot', 'canonicalPath', 'scope', 'revision', 'stateRevision', 'relations', 'state', 'submissions', 'createdAt', 'updatedAt'], ['schemaVersion', 'storeId', 'projectRoot', 'canonicalPath', 'scope', 'revision', 'stateRevision', 'relations', 'state', 'submissions', 'createdAt', 'updatedAt']);
      if (record.schemaVersion !== 1 || !/^workspace_[a-f0-9-]{36}$/.test(record.storeId) || !samePath(record.projectRoot, this.projectRoot) || !samePath(record.canonicalPath, this.file) || record.scope !== this.scope) throw new Error();
      integer(record.revision, 'revision'); integer(record.stateRevision, 'stateRevision'); timestamp(record.createdAt); timestamp(record.updatedAt); validateWorkspaceState(record.state);
      if (!Array.isArray(record.relations) || record.relations.length > WORKSPACE_LIMITS.relations || !Array.isArray(record.submissions) || record.submissions.length > WORKSPACE_LIMITS.receipts || record.revision !== record.submissions.length + 1) throw new Error();
      const edges = new Set(); for (const relation of record.relations) { object(relation, ['edgeId', 'a', 'b', 'createdAt'], ['edgeId', 'a', 'b', 'createdAt']); const canonical = relationFor(relation.a, relation.b); if (relation.edgeId !== canonical.edgeId || stable(relation.a) !== stable(canonical.a) || edges.has(relation.edgeId)) throw new Error(); edges.add(relation.edgeId); timestamp(relation.createdAt); }
      const submissions = new Set(); for (const [index, receipt] of record.submissions.entries()) {
        object(receipt, ['submissionId', 'payloadSha256', 'action', 'revision', 'savedAt', 'result'], ['submissionId', 'payloadSha256', 'action', 'revision', 'savedAt', 'result']);
        if (!/^[A-Za-z0-9_-]{8,128}$/.test(receipt.submissionId) || submissions.has(receipt.submissionId) || !/^[a-f0-9]{64}$/.test(receipt.payloadSha256) || !['link', 'unlink'].includes(receipt.action) || receipt.revision !== index + 2) throw new Error(); submissions.add(receipt.submissionId); timestamp(receipt.savedAt);
        object(receipt.result, ['edgeId', 'changed', 'relation'], ['edgeId', 'changed', 'relation']); if (!/^edge_[a-f0-9]{64}$/.test(receipt.result.edgeId) || typeof receipt.result.changed !== 'boolean') throw new Error();
        if (receipt.result.relation !== null) { const relation = receipt.result.relation; object(relation, ['edgeId', 'a', 'b', 'createdAt'], ['edgeId', 'a', 'b', 'createdAt']); if (relationFor(relation.a, relation.b).edgeId !== relation.edgeId || relation.edgeId !== receipt.result.edgeId) throw new Error(); timestamp(relation.createdAt); }
      }
    } catch { fail('WORKSPACE_INVALID_DATABASE', '工作台身份、结构或位置记录无效，保留原文件。', 503); }
    return record;
  }
  async #locked(task, initialize = false) {
    await this.#safePath();
    if (initialize) { await fs.mkdir(path.dirname(this.file), { recursive: true }); await this.#safePath(); }
    const lock = this.file + '.lock'; const owner = JSON.stringify({ pid: process.pid, token: randomUUID(), createdAt: new Date().toISOString() }); let handle;
    const deadline = Date.now() + WORKSPACE_LIMITS.lockWaitMs;
    while (!handle) {
      try { handle = await fs.open(lock, 'wx'); } catch (error) { if (error.code !== 'EEXIST') throw error; if (await recoverDeadLock(lock)) continue; if (Date.now() >= deadline) fail('WORKSPACE_BUSY', '工作台正被写入；保留内容和提交ID后重试。', 503, true); await new Promise(resolve => setTimeout(resolve, 35)); }
    }
    try { await handle.writeFile(owner); await handle.sync(); return await task(); }
    finally { await handle.close(); try { if (await fs.readFile(lock, 'utf8') === owner) await fs.unlink(lock); } catch {} }
  }
  async #save(record, initialize = false) {
    const serialized = JSON.stringify(record); if (Buffer.byteLength(serialized, 'utf8') > WORKSPACE_LIMITS.storeBytes) fail('WORKSPACE_LIMIT', '工作台文件达到上限；保留既有收据，不截断历史。', 409);
    await this.#safePath(); const temporary = this.file + '.' + randomUUID() + '.tmp'; let handle;
    try {
      handle = await fs.open(temporary, 'wx'); await handle.writeFile(serialized, 'utf8'); await handle.sync(); await handle.close(); handle = null;
      if (initialize) { try { await fs.link(temporary, this.file); } catch (error) { if (error.code === 'EEXIST') fail('WORKSPACE_EXISTS', '工作台已存在，初始化不覆盖。', 409); throw error; } }
      else await fs.rename(temporary, this.file);
    } finally { await handle?.close(); await fs.unlink(temporary).catch(() => {}); }
    const readback = await this.#load(); if (sha(readback) !== sha(record)) fail('WORKSPACE_WRITE_UNVERIFIED', '写入后的回读不一致，可能已提交；保留原提交ID核对。', 500);
    return readback;
  }
  async initialize(state = DEFAULT_WORKSPACE_STATE) {
    validateWorkspaceState(state); const initial = clone(state);
    return this.#locked(async () => {
      if (await exists(this.file)) fail('WORKSPACE_EXISTS', '工作台已存在，初始化不覆盖；重新读取。', 409);
      const now = new Date().toISOString(); const record = { schemaVersion: 1, storeId: 'workspace_' + randomUUID(), projectRoot: this.projectRoot, canonicalPath: this.file, scope: this.scope, revision: 1, stateRevision: 1, relations: [], state: initial, submissions: [], createdAt: now, updatedAt: now };
      return { ...this.#public(await this.#save(record, true)), verification: { persisted: true, snapshotVerified: true } };
    }, true);
  }
  async read() { return this.#public(await this.#load()); }
  async identity() { return (await this.read()).identity; }
  async listRelations(ref) {
    ref = normalizeRef(ref); const result = await this.read(); const key = stable(ref);
    result.relations = result.relations.filter(relation => stable(relation.a) === key || stable(relation.b) === key).map(relation => ({ ...relation, other: stable(relation.a) === key ? relation.b : relation.a })); return result;
  }
  async apply(input, { validateNewLink } = {}) {
    if (validateNewLink !== undefined && typeof validateNewLink !== 'function') fail('WORKSPACE_INVALID_INPUT', '新关联校验器无效。');
    object(input, ['identity', 'expectedRevision', 'submissionId', 'action', 'input'], ['identity', 'expectedRevision', 'submissionId', 'action', 'input']);
    object(input.identity, IDENTITY_FIELDS, IDENTITY_FIELDS, '数据身份');
    integer(input.expectedRevision, 'expectedRevision'); if (typeof input.submissionId !== 'string' || !/^[A-Za-z0-9_-]{8,128}$/.test(input.submissionId)) fail('WORKSPACE_INVALID_INPUT', 'submissionId无效。');
    if (input.action === 'link') { object(input.input, ['a', 'b'], ['a', 'b']); relationFor(input.input.a, input.input.b); }
    else if (input.action === 'unlink') { object(input.input, ['edgeId'], ['edgeId']); if (!/^edge_[a-f0-9]{64}$/.test(input.input.edgeId)) fail('WORKSPACE_INVALID_INPUT', 'edgeId无效。'); }
    else fail('WORKSPACE_INVALID_INPUT', '只支持明确建立或解除关系。');
    const request = clone(input); await this.#load();
    return this.#locked(async () => {
      const record = await this.#load(); this.#assertIdentity(request.identity, record); const digest = sha(request);
      const previous = record.submissions.find(receipt => receipt.submissionId === request.submissionId);
      if (previous) { if (previous.payloadSha256 !== digest) fail('WORKSPACE_SUBMISSION_CONFLICT', '同提交ID已用于不同内容，保留原提交。', 409); return { ...this.#public(record), receipt: clone(previous), verification: { persisted: true, snapshotVerified: true, currentRevision: record.revision, currentMatchesSubmittedRevision: record.revision === previous.revision } }; }
      if (record.revision !== request.expectedRevision) fail('WORKSPACE_REVISION_CONFLICT', '另一页面已更新关系；保留待保存内容并重读合并。', 409, false, { expectedRevision: request.expectedRevision, actualRevision: record.revision });
      if (record.submissions.length >= WORKSPACE_LIMITS.receipts) fail('WORKSPACE_LIMIT', '关系收据已达4096项，保留收据，不静默淘汰后重新接受旧ID。', 409);
      // Current source availability gates new intent, not a persisted receipt.
      // A retry must still verify its original receipt if a source later leaves.
      if (request.action === 'link' && validateNewLink) await validateNewLink(clone(request.input));
      const now = new Date().toISOString(); let result;
      if (request.action === 'link') {
        const canonical = relationFor(request.input.a, request.input.b); let relation = record.relations.find(edge => edge.edgeId === canonical.edgeId); const changed = !relation;
        if (changed) { if (record.relations.length >= WORKSPACE_LIMITS.relations) fail('WORKSPACE_LIMIT', '跨区关系数量达到上限。', 409); relation = { ...canonical, createdAt: now }; record.relations.push(relation); }
        result = { edgeId: canonical.edgeId, changed, relation: clone(relation) };
      } else {
        const relation = record.relations.find(edge => edge.edgeId === request.input.edgeId); record.relations = record.relations.filter(edge => edge.edgeId !== request.input.edgeId); result = { edgeId: request.input.edgeId, changed: !!relation, relation: relation ? clone(relation) : null };
      }
      const receipt = { submissionId: request.submissionId, payloadSha256: digest, action: request.action, revision: ++record.revision, savedAt: now, result };
      record.submissions.push(receipt); record.updatedAt = now; const persisted = await this.#save(record);
      return { ...this.#public(persisted), receipt, verification: { persisted: true, snapshotVerified: true, currentRevision: persisted.revision, currentMatchesSubmittedRevision: true } };
    });
  }
  async saveState(input) {
    object(input, ['identity', 'expectedRevision', 'state'], ['identity', 'expectedRevision', 'state']); object(input.identity, IDENTITY_FIELDS, IDENTITY_FIELDS, '数据身份'); integer(input.expectedRevision, 'state expectedRevision'); validateWorkspaceState(input.state);
    const request = clone(input); await this.#load();
    return this.#locked(async () => {
      const record = await this.#load(); this.#assertIdentity(request.identity, record);
      if (sha(record.state) === sha(request.state)) return { ...this.#public(record), changed: false, verification: { persisted: true, snapshotVerified: true } };
      if (record.stateRevision !== request.expectedRevision) fail('WORKSPACE_STATE_REVISION_CONFLICT', '另一页面已更新阅读位置；保留本页位置并重读合并。', 409, false, { expectedRevision: request.expectedRevision, actualRevision: record.stateRevision });
      record.state = request.state; record.stateRevision++; record.updatedAt = new Date().toISOString();
      return { ...this.#public(await this.#save(record)), changed: true, verification: { persisted: true, snapshotVerified: true } };
    });
  }
}
