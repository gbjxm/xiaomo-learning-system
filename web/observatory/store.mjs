import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCHEMA_VERSION, MATERIAL_STATUSES, TOPIC_STATUSES, ObservatoryError, fail, object, string, array, id, revision, newId, hash,
  validateMaterial, validateTopic, validateStage, validateSegments, tags, uri } from './model.mjs';

export const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DEFAULT_DATA_DIR = path.join(PROJECT_ROOT, '素材观察室', 'data');
export const PHASE1_ISOLATION_ROOT = path.join(PROJECT_ROOT, '验证', '素材观察室', '阶段1');
export const ISOLATION_ROOT = path.join(PROJECT_ROOT, '验证', '素材观察室');
export const DB_FILENAME = 'observatory.sqlite3';
const IDENTITY_FIELDS = ['storeId', 'projectRoot', 'canonicalDbPath', 'schemaVersion', 'scope'];

export function resolveDataDir(dataDir = DEFAULT_DATA_DIR) {
  if (typeof dataDir !== 'string' || !path.isAbsolute(dataDir)) fail('INVALID_DATA_PATH', 'data-dir 必须是绝对路径；不从当前工作目录推断数据库。', { dataDir });
  return path.resolve(dataDir);
}
function samePath(a, b) { return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b; }
function contained(child, parent) { const relative = path.relative(parent, child); return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative); }
function futureCanonical(target) {
  let existing = target; const parts = [];
  while (!fs.existsSync(existing)) { const parent = path.dirname(existing); if (parent === existing) fail('INVALID_DATA_PATH', '找不到路径的已有根目录。'); parts.unshift(path.basename(existing)); existing = parent; }
  return path.join(fs.realpathSync(existing), ...parts);
}
async function sqliteClass() {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 24 || (major === 24 && minor < 15)) fail('UNSUPPORTED_NODE_VERSION', '素材观察室原型要求 Node 24.15.0 或更高版本，请使用已验证环境。', { actual: process.version });
  try { return (await import('node:sqlite')).DatabaseSync; }
  catch (error) { fail('SQLITE_UNAVAILABLE', 'node:sqlite 不可用；原学习终端可继续独立使用。', { cause: error.message }); }
}
function normalizeError(error) {
  if (error instanceof ObservatoryError) return error;
  if (error.errcode === 5 || error.errcode === 6 || /database (?:is )?(?:locked|busy)/i.test(error.message))
    return new ObservatoryError('DATABASE_BUSY', '数据库忙，本次操作或回读尚未确认完成；保留原提交文件和 submissionId，稍后按相同内容重试。', {}, true);
  return new ObservatoryError('STORAGE_ERROR', '数据库操作或回读失败；不要报告为已确认成功，保留提交文件并按 submissionId 核对结果。', { cause: error.message });
}
function metaIdentity(db, canonicalDbPath) {
  let rows;
  try { rows = db.prepare('SELECT * FROM store_meta').all(); }
  catch (error) {
    const normalized = normalizeError(error);
    if (normalized.code === 'DATABASE_BUSY') throw normalized;
    fail('INVALID_DATABASE', '这个文件不是已初始化的素材观察室数据库。', { canonicalDbPath });
  }
  if (rows.length !== 1 || rows[0].singleton !== 1 || rows[0].schema_version !== SCHEMA_VERSION || !rows[0].store_id ||
      !['demo', 'isolated', 'production'].includes(rows[0].scope) || !samePath(rows[0].project_root, PROJECT_ROOT))
    fail('INVALID_DATABASE', '数据库身份或 schemaVersion 不符合本项目，不能作为正常空库读取；旧结构仅能显式 migrate 升级。', { canonicalDbPath, expectedSchemaVersion: SCHEMA_VERSION });
  for (const table of ['materials', 'topics', 'topic_materials', 'stage_records', 'attachments', 'submissions'])
    if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table)) fail('INVALID_DATABASE', `数据库缺少 ${table} 表。`);
  return { storeId: rows[0].store_id, projectRoot: PROJECT_ROOT, canonicalDbPath, schemaVersion: SCHEMA_VERSION, scope: rows[0].scope };
}
async function openExisting(dataDir, readOnly = true) {
  const directory = resolveDataDir(dataDir); const requested = path.join(directory, DB_FILENAME);
  if (!fs.existsSync(requested) || !fs.statSync(requested).isFile()) fail('DATABASE_MISSING', '数据库不存在。读取不会创建空库；请先核对绝对路径和 identity，首次建立须显式 init。', { requestedDbPath: requested });
  const canonicalDbPath = fs.realpathSync(requested); const DatabaseSync = await sqliteClass(); let db;
  try {
    db = new DatabaseSync(canonicalDbPath, { readOnly });
    db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 1500;');
    const identity = metaIdentity(db, canonicalDbPath);
    // A single read operation sees one SQLite snapshot across its topic/link/stage queries.
    if (readOnly) db.exec('BEGIN;');
    return { db, identity, dataDir: path.dirname(canonicalDbPath), attachmentsDir: path.join(path.dirname(path.dirname(canonicalDbPath)), 'attachments') };
  } catch (error) { db?.close(); throw normalizeError(error); }
}
function assertIdentity(expected, actual) {
  object(expected, 'identity', IDENTITY_FIELDS);
  for (const field of IDENTITY_FIELDS) {
    const matches = ['canonicalDbPath', 'projectRoot'].includes(field) && typeof expected[field] === 'string' ? samePath(expected[field], actual[field]) : expected[field] === actual[field];
    if (!matches) fail('STORE_IDENTITY_MISMATCH', '提交指定的数据身份与当前库不同；停止写入并重新读取 identity。', { field, expected: expected[field], actual: actual[field] });
  }
}
function materialFromRow(row) {
  if (!row) fail('NOT_FOUND', '未找到素材。');
  return { materialId: row.id, revision: row.revision, status: row.status, ...JSON.parse(row.body_json), createdAt: row.created_at, updatedAt: row.updated_at };
}
function material(db, materialId) { return materialFromRow(db.prepare('SELECT * FROM materials WHERE id = ?').get(id(materialId, 'materialId'))); }
// Derived reading/ research evidence is a view of immutable stages. It is never
// stored back over the collector's content, and never enters CAS receipt hashes.
function withResearchEvidence(db, record) {
  const attachmentIds = new Set(attachmentIdsForMaterial(record));
  const urls = new Set([record.original.url, record.source?.uri, record.original.source?.uri].filter(Boolean));
  const evidence = []; const readScopes = [];
  for (const row of db.prepare('SELECT s.*, t.status AS topic_status FROM stage_records s JOIN topics t ON t.id = s.topic_id ORDER BY s.created_at, s.topic_revision').all()) {
    const stage = JSON.parse(row.body_json);
    const basis = stage.materialVersions.find(m => m.materialId === record.materialId);
    const sources = stage.sources.filter(s => (s.kind === 'material' && s.materialId === record.materialId) || (s.kind === 'attachment' && attachmentIds.has(s.attachmentId)) || (s.kind === 'external' && urls.has(s.uri)));
    if (!basis && !sources.length) continue;
    const hasReport = stage.paragraphs.length > 0;
    const item = { topicId: row.topic_id, topicStatus: row.topic_status, stageId: row.id, topicRevision: row.topic_revision,
      basedOnMaterialRevision: basis?.revision ?? null, currentMaterialRevision: record.revision, sourceVersionChanged: !!basis && basis.revision !== record.revision,
      hasReport, researchStatus: stage.researchStatus, focus: stage.focus, createdAt: row.created_at };
    evidence.push(item);
    for (const source of sources) if (source.verificationScope && source.verificationScope !== 'unknown') {
      readScopes.push({ topicId: row.topic_id, stageId: row.id, sourceId: source.sourceId, kind: source.kind,
        ...(source.attachmentId ? { attachmentId: source.attachmentId } : {}), ...(source.uri ? { uri: source.uri } : {}),
        locator: source.locator, verificationScope: source.verificationScope, accessedAt: source.accessedAt,
        supportedParagraphs: stage.paragraphs.filter(p => p.sourceRefs.some(ref => ref.sourceId === source.sourceId)).map(p => ({ paragraphId: p.paragraphId, basisKind: p.basisKind, sourceRefs: p.sourceRefs.filter(ref => ref.sourceId === source.sourceId) })) });
    }
  }
  return { ...record, capabilities: { ...record.capabilities, saved: true, read: readScopes.length ? 'scope_documented' : 'not_read',
    researched: evidence.some(e => e.hasReport), researchStageCount: evidence.length, readScopeSummary: readScopes,
    meaning: 'read=scope_documented 仅表示有保存的读取范围，须逐项查看；不宣称全文或连续声画已读。' }, researchEvidence: evidence };
}
function attachment(db, attachmentId) {
  const row = db.prepare('SELECT * FROM attachments WHERE id = ?').get(id(attachmentId, 'attachmentId'));
  if (!row) fail('NOT_FOUND', '未找到附件。', { attachmentId });
  return { attachmentId: row.id, revision: 1, originalFilename: row.original_filename, relativePath: row.relative_path,
    sha256: row.sha256, mimeType: row.mime_type, byteLength: row.byte_length, permissionStatus: row.permission_status, status: row.status };
}
function topic(db, topicId) {
  const row = db.prepare('SELECT * FROM topics WHERE id = ?').get(id(topicId, 'topicId'));
  if (!row) fail('NOT_FOUND', '未找到专题。', { topicId });
  const materialIds = db.prepare('SELECT material_id FROM topic_materials WHERE topic_id = ? ORDER BY material_id').all(topicId).map(r => r.material_id);
  const stages = db.prepare('SELECT * FROM stage_records WHERE topic_id = ? ORDER BY topic_revision').all(topicId).map(r =>
    ({ stageId: r.id, topicId: r.topic_id, topicRevision: r.topic_revision, ...JSON.parse(r.body_json), createdAt: r.created_at }));
  return { topicId: row.id, revision: row.revision, status: row.status, ...JSON.parse(row.body_json), materialIds, stages, createdAt: row.created_at, updatedAt: row.updated_at };
}
function assertRevision(current, expected, recordId) {
  revision(expected); if (current !== expected) fail('REVISION_CONFLICT', '记录已更新，旧版本提交被拒绝；重新读取、保留待提交内容并合并后用新 submissionId 提交。', { recordId, expectedRevision: expected, actualRevision: current });
}
function assertAttachments(context, attachmentIds) {
  for (const attachmentId of new Set(attachmentIds)) {
    const row = context.db.prepare('SELECT * FROM attachments WHERE id = ?').get(attachmentId);
    if (!row) fail('ATTACHMENT_NOT_REGISTERED', '引用的附件尚未登记，本次提交整体拒绝。', { attachmentId });
    const absolutePath = path.resolve(context.attachmentsDir, row.relative_path);
    if (row.status !== 'registered' || !contained(absolutePath, context.attachmentsDir) || !fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile())
      fail('ATTACHMENT_UNAVAILABLE', '已登记附件缺失或路径不合法，本次提交整体拒绝。', { attachmentId });
    const actual = fs.realpathSync(absolutePath); const root = fs.realpathSync(context.attachmentsDir);
    const moduleRoot = fs.realpathSync(path.dirname(context.attachmentsDir));
    if (fs.lstatSync(context.attachmentsDir).isSymbolicLink() || fs.lstatSync(absolutePath).isSymbolicLink() || !contained(root, moduleRoot) || !contained(actual, root) || fs.statSync(actual).size !== row.byte_length || hash(fs.readFileSync(actual)) !== row.sha256)
      fail('ATTACHMENT_UNAVAILABLE', '附件实际内容未通过路径、大小与 SHA-256 校验，本次提交整体拒绝。', { attachmentId });
  }
}
function attachmentIdsForMaterial(body) { return [...body.attachmentIds, ...body.segments.map(s => s.attachmentId).filter(Boolean)]; }
function replaceLinks(db, topicId, materialIds) {
  for (const materialId of materialIds) if (material(db, materialId).status === 'deleted') fail('MATERIAL_DELETED', '不能新增对已删除素材的关联；可先恢复素材。', { materialId });
  db.prepare('DELETE FROM topic_materials WHERE topic_id = ?').run(topicId);
  const insert = db.prepare('INSERT INTO topic_materials(topic_id, material_id) VALUES (?, ?)');
  for (const materialId of materialIds) insert.run(topicId, materialId);
}
function envelope(value, allowed) { return object(value, '提交', ['identity', 'submissionId', ...allowed]); }

export async function initStore({ dataDir, scope = 'isolated' } = {}) {
  const target = resolveDataDir(dataDir); const canonicalTarget = futureCanonical(target); const isolationRoot = fs.realpathSync(ISOLATION_ROOT);
  const production = scope === 'production' && samePath(canonicalTarget, futureCanonical(DEFAULT_DATA_DIR));
  if (!production && (!['isolated', 'demo'].includes(scope) || !contained(canonicalTarget, isolationRoot)))
    fail('PHASE1_INIT_RESTRICTED', '初始化须显式选定范围：production 只允许固定正式目录，isolated/demo 只允许 验证/素材观察室 内目录。', { target, scope });
  const dbPath = path.join(target, DB_FILENAME);
  if (fs.existsSync(dbPath)) fail('DATABASE_EXISTS', '数据库已存在，init 不覆盖或恢复它；请使用 identity/read。', { dbPath });
  const DatabaseSync = await sqliteClass(); fs.mkdirSync(target, { recursive: true });
  let db; let created = false;
  try {
    // Exclusive file creation closes the concurrent init overwrite window.
    fs.closeSync(fs.openSync(dbPath, 'wx')); created = true;
    db = new DatabaseSync(dbPath); db.exec('PRAGMA busy_timeout = 1500; BEGIN IMMEDIATE;');
    db.exec(fs.readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
    db.prepare('INSERT INTO store_meta VALUES (1, ?, ?, ?, ?, ?)').run(newId('store'), SCHEMA_VERSION, scope, PROJECT_ROOT, new Date().toISOString());
    db.exec('COMMIT;');
    return metaIdentity(db, fs.realpathSync(dbPath));
  } catch (error) { try { db?.exec('ROLLBACK;'); } catch {} db?.close(); db = undefined; if (created) try { fs.unlinkSync(dbPath); } catch {} throw normalizeError(error); }
  finally { db?.close(); }
}

// Restore may change location and scope, but never the persisted store ID. Only an
// explicit isolated restore command can call this function.
export async function rebindRestoredStore({ dataDir, expectedStoreId }) {
  const target = resolveDataDir(dataDir);
  if (!contained(futureCanonical(target), fs.realpathSync(ISOLATION_ROOT))) fail('INVALID_DATA_PATH', '恢复绑定只允许验证目录；不覆写正式数据库。');
  id(expectedStoreId, 'expectedStoreId');
  const context = await openExisting(target, false);
  try {
    if (context.identity.storeId !== expectedStoreId) fail('STORE_IDENTITY_MISMATCH', '恢复库身份与备份清单不一致。');
    context.db.exec('BEGIN IMMEDIATE;');
    context.db.prepare("UPDATE store_meta SET scope = 'isolated' WHERE singleton = 1 AND store_id = ?").run(expectedStoreId);
    context.db.exec('COMMIT;');
    return metaIdentity(context.db, context.identity.canonicalDbPath);
  } catch (error) { try { context.db.exec('ROLLBACK;'); } catch {} throw normalizeError(error); } finally { context.db.close(); }
}

export async function migrateStore({ dataDir, expectedStoreId } = {}) {
  const target = resolveDataDir(dataDir); const requested = path.join(target, DB_FILENAME);
  if (!fs.existsSync(requested)) fail('DATABASE_MISSING', '迁移只作用于已有数据库。');
  const DatabaseSync = await sqliteClass(); const db = new DatabaseSync(fs.realpathSync(requested));
  try {
    db.exec('PRAGMA busy_timeout = 1500;');
    const meta = db.prepare('SELECT * FROM store_meta WHERE singleton = 1').get();
    if (!meta || meta.store_id !== expectedStoreId || !samePath(meta.project_root, PROJECT_ROOT)) fail('STORE_IDENTITY_MISMATCH', '迁移必须传入已核对的 storeId，且数据库属于本项目。');
    if (meta.schema_version === SCHEMA_VERSION) return metaIdentity(db, fs.realpathSync(requested));
    if (meta.schema_version !== 1) fail('INVALID_DATABASE', '仅支持从结构1显式升级结构2。');
    const schema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='topics'").get()?.sql;
    if (!schema || !schema.includes("'archived'")) fail('INVALID_DATABASE', '旧结构专题表不符合已知版本。');
    db.exec('PRAGMA foreign_keys = OFF; BEGIN IMMEDIATE;');
    db.exec(schema.replace(/CREATE TABLE topics/i, 'CREATE TABLE topics_v2').replace("'archived'", "'archived', 'deleted'"));
    db.exec('INSERT INTO topics_v2 SELECT * FROM topics; DROP TABLE topics; ALTER TABLE topics_v2 RENAME TO topics;');
    db.prepare('UPDATE store_meta SET schema_version = ? WHERE singleton = 1').run(SCHEMA_VERSION);
    if (db.prepare('PRAGMA foreign_key_check').all().length) fail('INVALID_DATABASE', '升级后关联校验失败；事务回滚。');
    db.exec('COMMIT; PRAGMA foreign_keys = ON;'); return metaIdentity(db, fs.realpathSync(requested));
  } catch (error) { try { db.exec('ROLLBACK;'); } catch {} throw normalizeError(error); } finally { db.close(); }
}

export class ObservatoryStore {
  constructor({ dataDir = DEFAULT_DATA_DIR } = {}) { this.dataDir = resolveDataDir(dataDir); }
  async identity() { const context = await openExisting(this.dataDir); try { return context.identity; } finally { context.db.close(); } }
  async readMaterial(materialId) { const context = await openExisting(this.dataDir); try { return { identity: context.identity, record: withResearchEvidence(context.db, material(context.db, materialId)) }; } catch (error) { throw normalizeError(error); } finally { context.db.close(); } }
  async readTopic(topicId) { const context = await openExisting(this.dataDir); try { return { identity: context.identity, record: topic(context.db, topicId) }; } catch (error) { throw normalizeError(error); } finally { context.db.close(); } }
  async listMaterials({ query = '', tag = '', status = 'active', uncategorized = false } = {}) {
    string(query, 'query', { max: 2000 }); string(tag, 'tag', { max: 200 });
    if (!['all', ...MATERIAL_STATUSES].includes(status)) fail('INVALID_INPUT', '列表 status 非法。');
    const context = await openExisting(this.dataDir);
    try {
      const q = query.toLocaleLowerCase();
      const records = context.db.prepare('SELECT * FROM materials ORDER BY updated_at DESC').all().map(materialFromRow).filter(r => {
        if ((status !== 'all' && r.status !== status) || (tag && !r.tags.includes(tag)) || (uncategorized && r.tags.length)) return false;
        if (!q || JSON.stringify(r).toLocaleLowerCase().includes(q)) return true;
        const related = context.db.prepare('SELECT topic_id FROM topic_materials WHERE material_id = ?').all(r.materialId);
        return related.some(link => JSON.stringify(topic(context.db, link.topic_id)).toLocaleLowerCase().includes(q));
      });
      return { identity: context.identity, records: records.map(r => withResearchEvidence(context.db,r)) };
    } catch (error) { throw normalizeError(error); } finally { context.db.close(); }
  }
  async listTopics({ query = '', status = 'all' } = {}) {
    string(query, 'query', { max: 2000 }); if (!['all', ...TOPIC_STATUSES].includes(status)) fail('INVALID_INPUT', '专题列表 status 非法。');
    const context = await openExisting(this.dataDir); try { return { identity: context.identity, records: context.db.prepare('SELECT id FROM topics ORDER BY updated_at DESC').all().map(r => topic(context.db, r.id)).filter(r => (status === 'all' || r.status === status) && (!query || JSON.stringify(r).toLocaleLowerCase().includes(query.toLocaleLowerCase()))) }; } catch (error) { throw normalizeError(error); } finally { context.db.close(); }
  }
  async readAttachment(attachmentId) {
    const context = await openExisting(this.dataDir); try { return { identity: context.identity, record: attachment(context.db, attachmentId) }; } catch (error) { throw normalizeError(error); } finally { context.db.close(); }
  }
  async listAttachments() {
    const context = await openExisting(this.dataDir); try { return { identity: context.identity, records: context.db.prepare('SELECT id FROM attachments ORDER BY rowid').all().map(r => attachment(context.db, r.id)) }; } catch (error) { throw normalizeError(error); } finally { context.db.close(); }
  }
  async registerAttachment(payload) {
    envelope(payload, ['attachment']); const a = object(payload.attachment, 'attachment', ['attachmentId', 'originalFilename', 'relativePath', 'sha256', 'mimeType', 'byteLength', 'permissionStatus']);
    id(a.attachmentId, 'attachmentId'); string(a.originalFilename, 'originalFilename', { nonempty: true, max: 255 });
    string(a.relativePath, 'relativePath', { nonempty: true, max: 1000 }); string(a.mimeType, 'mimeType', { nonempty: true, max: 100 });
    if (path.isAbsolute(a.relativePath) || /[\\:\x00-\x1f]/.test(a.relativePath) || a.relativePath.split('/').some(p => !p || p === '..' || p === '.')) fail('INVALID_DATA_PATH', '附件必须使用无越界的相对路径。');
    if (!/^[0-9a-f]{64}$/.test(a.sha256) || !Number.isSafeInteger(a.byteLength) || a.byteLength <= 0) fail('INVALID_INPUT', '附件大小和 SHA-256 不合法。');
    const permission = a.permissionStatus === undefined ? 'unknown' : string(a.permissionStatus, 'permissionStatus', { nonempty: true, max: 1000 });
    return this.#write('register-attachment', payload, (context) => {
      context.db.prepare('INSERT INTO attachments VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(a.attachmentId, a.originalFilename, a.relativePath, a.sha256, a.mimeType, a.byteLength, permission, 'registered');
      assertAttachments(context, [a.attachmentId]);
      return { recordId: a.attachmentId, revision: 1, snapshot: attachment(context.db, a.attachmentId) };
    });
  }
  async backupSnapshot(targetPath) {
    if (!path.isAbsolute(targetPath) || fs.existsSync(targetPath) || !contained(futureCanonical(targetPath), fs.realpathSync(PROJECT_ROOT))) fail('INVALID_DATA_PATH', '快照目标须为项目内不存在的绝对文件路径。', { targetPath });
    const context = await openExisting(this.dataDir); let destination; let created = false;
    try {
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.closeSync(fs.openSync(targetPath,'wx')); created = true;
      const { backup } = await import('node:sqlite'); await backup(context.db, targetPath);
      const DatabaseSync = await sqliteClass(); destination = new DatabaseSync(targetPath, { readOnly: true });
      const checked = metaIdentity(destination, fs.realpathSync(targetPath));
      if (checked.storeId !== context.identity.storeId || destination.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok') fail('WRITE_VERIFICATION_FAILED', '一致性快照身份或完整性检查失败。');
      return { identity: context.identity, targetPath: fs.realpathSync(targetPath), schemaVersion: SCHEMA_VERSION, integrity: 'ok' };
    } catch (error) { destination?.close(); destination=undefined;if(created)try{fs.unlinkSync(targetPath);}catch{}throw normalizeError(error); } finally { destination?.close(); context.db.close(); }
  }
  async #write(action, payload, mutate) {
    id(payload.submissionId, 'submissionId'); const payloadSha256 = hash({ action, payload }); const context = await openExisting(this.dataDir, false); let inTransaction = false; let receipt;
    try {
      assertIdentity(payload.identity, context.identity); context.db.exec('BEGIN IMMEDIATE;'); inTransaction = true;
      const existing = context.db.prepare('SELECT * FROM submissions WHERE submission_id = ?').get(payload.submissionId);
      if (existing) {
        if (existing.action !== action || existing.payload_sha256 !== payloadSha256) fail('SUBMISSION_ID_CONFLICT', 'submissionId 已用于不同内容；本次提交被拒绝。', { submissionId: payload.submissionId });
        receipt = JSON.parse(existing.receipt_json); context.db.exec('COMMIT;'); inTransaction = false;
      } else {
        const now = new Date().toISOString(); const result = mutate(context, now);
        receipt = { submissionId: payload.submissionId, action, identity: context.identity, recordId: result.recordId, revision: result.revision,
          ...(result.stageId ? { stageId: result.stageId } : {}), savedAt: now, snapshotSha256: hash(result.snapshot), snapshot: result.snapshot };
        context.db.prepare('INSERT INTO submissions VALUES (?, ?, ?, ?, ?)').run(payload.submissionId, action, payloadSha256, JSON.stringify(receipt), now);
        context.db.exec('COMMIT;'); inTransaction = false;
      }
    } catch (error) { if (inTransaction) try { context.db.exec('ROLLBACK;'); } catch {} throw normalizeError(error); }
    finally { context.db.close(); }
    const verification = await this.verifyReceipt(receipt);
    return { receipt, verification };
  }
  async verifyReceipt(receipt) {
    const context = await openExisting(this.dataDir);
    try {
      const saved = context.db.prepare('SELECT receipt_json FROM submissions WHERE submission_id = ?').get(receipt.submissionId);
      if (!saved || hash(JSON.parse(saved.receipt_json)) !== hash(receipt) || hash(receipt.snapshot) !== receipt.snapshotSha256)
        fail('WRITE_VERIFICATION_FAILED', '写入后的收据回读未通过；不要宣称提交成功，请按 submissionId 查明。', { submissionId: receipt.submissionId });
      const isMaterial = receipt.action.includes('material'); const current = receipt.action === 'register-attachment' ? attachment(context.db, receipt.recordId) : isMaterial ? material(context.db, receipt.recordId) : topic(context.db, receipt.recordId);
      if (current.revision < receipt.revision || (current.revision === receipt.revision && hash(current) !== receipt.snapshotSha256))
        fail('WRITE_VERIFICATION_FAILED', '数据库记录与回读收据不一致。', { recordId: receipt.recordId });
      if (receipt.stageId) {
        const stage = current.stages.find(s => s.stageId === receipt.stageId);
        const submitted = receipt.snapshot.stages.find(s => s.stageId === receipt.stageId);
        if (!stage || hash(stage) !== hash(submitted)) fail('WRITE_VERIFICATION_FAILED', '阶段记录回读不一致。', { stageId: receipt.stageId });
      }
      return { persistedSubmission: true, snapshotVerified: true, currentRevision: current.revision,
        currentMatchesSubmittedRevision: current.revision === receipt.revision, verifiedAt: new Date().toISOString() };
    } catch (error) { throw normalizeError(error); } finally { context.db.close(); }
  }
  async createMaterial(payload) {
    envelope(payload, ['material']); const body = validateMaterial(payload.material);
    return this.#write('create-material', payload, (context, now) => {
      assertAttachments(context, attachmentIdsForMaterial(body)); const materialId = newId('mat');
      context.db.prepare('INSERT INTO materials VALUES (?, 1, ?, ?, ?, ?)').run(materialId, 'active', JSON.stringify(body), now, now);
      return { recordId: materialId, revision: 1, snapshot: material(context.db, materialId) };
    });
  }
  async updateMaterial(payload) {
    envelope(payload, ['materialId', 'expectedRevision', 'actor', 'patch']); id(payload.materialId, 'materialId'); revision(payload.expectedRevision);
    object(payload.patch, 'patch', ['title', 'tags', 'status', 'currentImpression', 'addNote', 'segments', 'source', 'attachmentIds']);
    if (!['user', 'ai'].includes(payload.actor)) fail('INVALID_INPUT', 'actor 必须为 user 或 ai。');
    if (payload.actor === 'ai') fail('AUTHORSHIP_PROTECTED', 'AI 研究不能改写素材、关注片段、标签或用户备注；AI 分析与候选建议须提交到专题阶段。用户明确授权编辑时才可按 user 提交。');
    return this.#write('update-material', payload, (context, now) => {
      const current = material(context.db, payload.materialId); assertRevision(current.revision, payload.expectedRevision, payload.materialId);
      const { materialId, revision: rev, status: oldStatus, createdAt, updatedAt, ...body } = current;
      const patch = payload.patch; let status = oldStatus;
      if ('title' in patch) body.title = string(patch.title, 'title', { max: 1000 });
      if ('tags' in patch) body.tags = tags(patch.tags);
      if ('status' in patch) { if (!MATERIAL_STATUSES.includes(patch.status)) fail('INVALID_INPUT', '素材 status 非法。'); status = patch.status; }
      if ('currentImpression' in patch) {
        const after = string(patch.currentImpression, 'currentImpression');
        body.impressionHistory.push({ before: body.currentImpression, after, actor: 'user', changedAt: now, materialRevision: rev + 1 }); body.currentImpression = after;
      }
      if ('addNote' in patch) body.notes.push({ noteId: newId('note'), text: string(patch.addNote, 'addNote', { nonempty: true }), actor: 'user', createdAt: now });
      if ('segments' in patch) body.segments = validateSegments(patch.segments);
      if ('attachmentIds' in patch) body.attachmentIds = [...new Set(array(patch.attachmentIds, 'attachmentIds').map(a => id(a, 'attachmentId')))];
      if ('source' in patch) {
        object(patch.source, 'source', ['title', 'uri', 'author', 'publishedAt', 'locator']);
        const after = { title: string(patch.source.title, 'source.title', { optional: true }), uri: uri(patch.source.uri, 'source.uri', true), author: string(patch.source.author, 'source.author', { optional: true }), publishedAt: string(patch.source.publishedAt, 'source.publishedAt', { optional: true }), locator: string(patch.source.locator, 'source.locator', { optional: true }) };
        body.sourceHistory ??= []; body.sourceHistory.push({ before: body.source ?? body.original.source ?? null, after, actor: 'user', changedAt: now, materialRevision: rev + 1 }); body.source = after;
      }
      assertAttachments(context, attachmentIdsForMaterial(body));
      const changed = context.db.prepare('UPDATE materials SET revision = revision + 1, status = ?, body_json = ?, updated_at = ? WHERE id = ? AND revision = ?').run(status, JSON.stringify(body), now, materialId, rev);
      if (changed.changes !== 1) fail('REVISION_CONFLICT', '素材版本条件更新失败。');
      return { recordId: materialId, revision: rev + 1, snapshot: material(context.db, materialId) };
    });
  }
  async createTopic(payload) {
    envelope(payload, ['topic']); const validated = validateTopic(payload.topic);
    return this.#write('create-topic', payload, (context, now) => {
      const topicId = newId('topic'); const { materialIds, ...body } = validated;
      context.db.prepare('INSERT INTO topics VALUES (?, 1, ?, ?, ?, ?)').run(topicId, 'draft', JSON.stringify(body), now, now); replaceLinks(context.db, topicId, materialIds);
      return { recordId: topicId, revision: 1, snapshot: topic(context.db, topicId) };
    });
  }
  async updateTopic(payload) {
    envelope(payload, ['topicId', 'expectedRevision', 'patch']); id(payload.topicId, 'topicId'); revision(payload.expectedRevision);
    object(payload.patch, 'patch', ['title', 'question', 'scope', 'status', 'materialIds']);
    return this.#write('update-topic', payload, (context, now) => {
      const current = topic(context.db, payload.topicId); assertRevision(current.revision, payload.expectedRevision, payload.topicId);
      const body = { title: current.title, question: current.question, scope: current.scope }; let status = current.status;
      for (const key of ['title', 'question', 'scope']) if (key in payload.patch) body[key] = string(payload.patch[key], key, { max: key === 'title' ? 1000 : 2_000_000 });
      if ('status' in payload.patch) { if (!TOPIC_STATUSES.includes(payload.patch.status)) fail('INVALID_INPUT', '专题 status 非法。'); status = payload.patch.status; }
      if ('materialIds' in payload.patch) replaceLinks(context.db, payload.topicId, [...new Set(array(payload.patch.materialIds, 'materialIds').map(v => id(v, 'materialId')))]);
      const changed = context.db.prepare('UPDATE topics SET revision = revision + 1, status = ?, body_json = ?, updated_at = ? WHERE id = ? AND revision = ?').run(status, JSON.stringify(body), now, payload.topicId, current.revision);
      if (changed.changes !== 1) fail('REVISION_CONFLICT', '专题版本条件更新失败。');
      return { recordId: payload.topicId, revision: current.revision + 1, snapshot: topic(context.db, payload.topicId) };
    });
  }
  async submitStage(payload) {
    envelope(payload, ['topicId', 'expectedRevision', 'materialVersions', 'stage']); id(payload.topicId, 'topicId'); revision(payload.expectedRevision);
    const stage = validateStage(payload.stage);
    const materialVersions = array(payload.materialVersions, 'materialVersions').map(v => { object(v, 'materialVersion', ['materialId', 'revision']); return { materialId: id(v.materialId, 'materialId'), revision: revision(v.revision, 'material.revision') }; });
    if (new Set(materialVersions.map(v => v.materialId)).size !== materialVersions.length) fail('INVALID_INPUT', 'materialVersions 不能包含重复素材。');
    return this.#write('submit-stage', payload, (context, now) => {
      const current = topic(context.db, payload.topicId); assertRevision(current.revision, payload.expectedRevision, payload.topicId);
      if (current.status === 'deleted') fail('TOPIC_DELETED', '专题已删除，先用 update-topic 恢复再提交研究。', { topicId: payload.topicId });
      for (const basedOn of materialVersions) {
        if (!current.materialIds.includes(basedOn.materialId)) fail('MATERIAL_NOT_LINKED', '研究所据素材必须已关联该专题。', { materialId: basedOn.materialId });
        const sourceMaterial = material(context.db, basedOn.materialId); assertRevision(sourceMaterial.revision, basedOn.revision, basedOn.materialId);
        if (sourceMaterial.status === 'deleted') fail('MATERIAL_DELETED', '本阶段引用素材已删除，请核对并恢复或调整范围。', { materialId: basedOn.materialId });
      }
      for (const source of stage.sources) if (source.kind === 'material' && !materialVersions.some(v => v.materialId === source.materialId)) fail('MATERIAL_VERSION_MISSING', '段落引用的素材来源缺少 materialVersions 快照。', { materialId: source.materialId });
      const attachments = [...stage.sources.filter(s => s.kind === 'attachment').map(s => s.attachmentId), ...stage.paragraphs.flatMap(p => p.attachmentIds)];
      assertAttachments(context, attachments);
      const stageId = newId('stage'); const nextRevision = current.revision + 1; const body = { ...stage, materialVersions, author: 'ai' };
      context.db.prepare('INSERT INTO stage_records VALUES (?, ?, ?, ?, ?)').run(stageId, payload.topicId, nextRevision, JSON.stringify(body), now);
      const changed = context.db.prepare('UPDATE topics SET revision = ?, status = ?, updated_at = ? WHERE id = ? AND revision = ?').run(nextRevision, stage.researchStatus, now, payload.topicId, current.revision);
      if (changed.changes !== 1) fail('REVISION_CONFLICT', '专题版本条件更新失败。');
      return { recordId: payload.topicId, revision: nextRevision, stageId, snapshot: topic(context.db, payload.topicId) };
    });
  }
}
