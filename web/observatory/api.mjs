import { ObservatoryStore } from './store.mjs';
import { ObservatoryError, fail, object } from './model.mjs';

export const ACTION_METHODS = Object.freeze({
  'create-material': 'createMaterial', 'update-material': 'updateMaterial',
  'create-topic': 'createTopic', 'update-topic': 'updateTopic', 'submit-stage': 'submitStage', 'register-attachment': 'registerAttachment'
});
export const HTTP_STATUS_BY_CODE = Object.freeze({
  INVALID_INPUT: 400, INVALID_DATA_PATH: 400, UNSAFE_URI: 400, INVALID_SOURCE_REF: 400,
  AUTHORSHIP_PROTECTED: 403, PHASE1_INIT_RESTRICTED: 403,
  NOT_FOUND: 404, DATABASE_MISSING: 503, INVALID_DATABASE: 503,
  REVISION_CONFLICT: 409, SUBMISSION_ID_CONFLICT: 409, STORE_IDENTITY_MISMATCH: 409, MATERIAL_DELETED: 409,
  MATERIAL_NOT_LINKED: 422, MATERIAL_VERSION_MISSING: 422, ATTACHMENT_NOT_REGISTERED: 422, ATTACHMENT_UNAVAILABLE: 422, TOPIC_DELETED: 409,
  DATABASE_BUSY: 503, UNSUPPORTED_NODE_VERSION: 503, SQLITE_UNAVAILABLE: 503,
  WRITE_VERIFICATION_FAILED: 500, STORAGE_ERROR: 500,
  ACCESS_DENIED: 403, UPLOAD_TOO_LARGE: 413, UNSUPPORTED_FILE_TYPE: 415, INVALID_FILENAME: 400,
  UNSAFE_FILE_PATH: 400, FILE_TYPE_MISMATCH: 422, INVALID_TEXT_ENCODING: 422,
  INVALID_MEDIA_FILE: 422, DAMAGED_FILE: 422, UNSUPPORTED_MEDIA_DIMENSIONS: 422, MEDIA_PROBE_FAILED: 503,
  MEDIA_CHECK_BUSY: 503, UPLOAD_INTERRUPTED: 503, UPLOAD_INTEGRITY_FAILED: 422,
  ATTACHMENT_COLLISION: 409, INVALID_PACKAGE_ID: 400, INVALID_PACKAGE_METADATA: 422,
  PACKAGE_INTEGRITY_FAILED: 422, PACKAGE_TOOL_UNAVAILABLE: 503, PACKAGE_OPERATION_LIMIT: 503,
  BACKUP_IDENTITY_MISMATCH: 422, BACKUP_REFERENCE_MISSING: 422, BACKUP_ATTACHMENT_CHANGED: 409
});

// A callable adapter only: no HTTP listener, route registration or browser state.
export async function execute(action, input = {}, options = {}) {
  const store = new ObservatoryStore(options);
  if (ACTION_METHODS[action]) return store[ACTION_METHODS[action]](input);
  if (action === 'identity') { object(input, 'identity request', []); return store.identity(); }
  if (action === 'read-material') { object(input, 'read-material request', ['materialId']); return store.readMaterial(input.materialId); }
  if (action === 'read-topic') { object(input, 'read-topic request', ['topicId']); return store.readTopic(input.topicId); }
  if (action === 'list-materials') { object(input, 'list-materials request', ['query', 'tag', 'status', 'uncategorized']); return store.listMaterials(input); }
  if (action === 'list-topics') { object(input, 'list-topics request', ['query', 'status']); return store.listTopics(input); }
  if (action === 'read-attachment') { object(input, 'read-attachment request', ['attachmentId']); return store.readAttachment(input.attachmentId); }
  if (action === 'list-attachments') { object(input, 'list-attachments request', []); return store.listAttachments(); }
  fail('INVALID_INPUT', `未支持的 action：${action}。init 只可由显式 CLI 调用。`);
}

export async function executeForHttp(action, input = {}, options = {}) {
  try { return { status: 200, body: { ok: true, data: await execute(action, input, options) } }; }
  catch (error) {
    const safe = error instanceof ObservatoryError ? error : new ObservatoryError('STORAGE_ERROR', '素材观察室操作失败。', { cause: error.message });
    return { status: HTTP_STATUS_BY_CODE[safe.code] ?? 500, body: { ok: false, error: safe.toJSON() },
      ...(safe.retryable ? { headers: { 'Retry-After': '2' } } : {}) };
  }
}
