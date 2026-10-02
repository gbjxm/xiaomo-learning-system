import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';

// Execute the exact pure helper shipped inside app.js; there is no duplicate implementation.
const source = fs.readFileSync(new URL('./app.js', import.meta.url), 'utf8');
const helper = source.split('// BEGIN OBSERVATORY_DRAFT_LEDGER')[1].split('// END OBSERVATORY_DRAFT_LEDGER')[0];
const { createObservatoryDraftLedger, draftStable } = new Function(helper.slice(helper.indexOf('\n')) + '\nreturn { createObservatoryDraftLedger, draftStable };')();
class MemoryStorage {
  constructor() { this.values = new Map(); }
  get length() { return this.values.size; }
  key(i) { return [...this.values.keys()][i] ?? null; }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
  removeItem(key) { this.values.delete(key); }
}
const identity = { storeId: 'store_test', projectRoot: 'D:/isolated', canonicalDbPath: 'D:/isolated/data/test.sqlite3', schemaVersion: 2, scope: 'isolated' };
const context = { kind: 'note', recordId: 'mat_test', baseRevision: 1 };
const values = text => ({ fields: { noteText: text }, files: [] });
const verified = { receipt: { recordId: 'mat_test', revision: 2 }, verification: { persistedSubmission: true, snapshotVerified: true } };
function setup(storage = new MemoryStorage()) {
  let sequence = 0;
  const ledger = createObservatoryDraftLedger(storage, { randomId: () => `id_${++sequence}`, now: () => 1000 + sequence, digest: async value => createHash('sha256').update(value).digest('hex') });
  return { storage, ledger };
}

test('identity uses all five fields and key order does not change its namespace', () => {
  const { ledger } = setup();
  assert.equal(ledger.identityKey(identity), ledger.identityKey(Object.fromEntries(Object.entries(identity).reverse())));
  for (const field of Object.keys(identity)) assert.notEqual(ledger.identityKey(identity), ledger.identityKey({ ...identity, [field]: 'different' }));
});
test('draft persists through a fresh ledger without writing any database', () => {
  const { storage, ledger } = setup(), session = ledger.open(identity, context);
  ledger.save(session, values('原话 <script>保持文本</script>'));
  assert.equal(setup(storage).ledger.heads(identity)[0].values.fields.noteText, '原话 <script>保持文本</script>');
  assert.equal(ledger.heads({ ...identity, canonicalDbPath: 'D:/other.sqlite3' }).length, 0);
});
test('restoring forks a branch and preserves the original base revision', () => {
  const { ledger } = setup(), session = ledger.open(identity, context), old = ledger.save(session, values('old'));
  const restored = ledger.open(identity, { ...context, baseRevision: 5 }, old);
  assert.equal(restored.context.baseRevision, 1);
  assert.notEqual(restored.branchId, old.branchId); assert.equal(restored.intentId, old.intentId);
  assert.throws(() => ledger.open({ ...identity, scope: 'production' }, context, old), { code: 'DRAFT_IDENTITY_MISMATCH' });
});
test('two tabs restoring one draft retain both changed branches', () => {
  const { ledger } = setup(), original = ledger.save(ledger.open(identity, context), values('original'));
  const left = ledger.open(identity, context, original), right = ledger.open(identity, context, original);
  ledger.save(left, values('left')); ledger.save(right, values('right'));
  assert.deepEqual(ledger.heads(identity).map(r => r.values.fields.noteText).sort(), ['left', 'right']);
});
test('a parent edited after another tab restores it remains separately visible', () => {
  const { ledger } = setup(), originalSession = ledger.open(identity, context), original = ledger.save(originalSession, values('original'));
  ledger.save(ledger.open(identity, context, original), values('fork'));
  ledger.save(originalSession, values('later parent'));
  assert.deepEqual(ledger.heads(identity).map(r => r.values.fields.noteText).sort(), ['fork', 'later parent']);
});
test('success consumes only the exact submitted revision and retains newer typing', async () => {
  const { ledger } = setup(), session = ledger.open(identity, context), first = ledger.save(session, values('submitted'));
  const request = await ledger.prepare(identity, session.intentId, 'update-material', { materialId: 'mat_test', expectedRevision: 1, patch: { addNote: 'submitted' } }, first);
  ledger.save(session, values('typed while waiting'));
  ledger.complete(request, verified);
  assert.equal(ledger.heads(identity)[0].values.fields.noteText, 'typed while waiting');
});
test('success does not consume another tab branch', async () => {
  const { ledger } = setup(), old = ledger.save(ledger.open(identity, context), values('old'));
  const left = ledger.open(identity, context, old), right = ledger.open(identity, context, old);
  const leftRecord = ledger.save(left, values('left')); ledger.save(right, values('right'));
  ledger.complete(await ledger.prepare(identity, left.intentId, 'update-material', { materialId: 'mat_test', expectedRevision: 1, patch: { addNote: 'left' } }, leftRecord), verified);
  assert.deepEqual(ledger.heads(identity).map(r => r.values.fields.noteText), ['right']);
});
test('successful restored draft does not resurface its superseded parent', async () => {
  const { ledger } = setup(), old = ledger.save(ledger.open(identity, context), values('old'));
  const session = ledger.open(identity, context, old), record = ledger.save(session, values('edited'));
  ledger.complete(await ledger.prepare(identity, session.intentId, 'update-material', { patch: { addNote: 'edited' } }, record), verified);
  assert.equal(ledger.heads(identity).length, 0);
});
test('pending retries preserve a frozen complete body and original expectedRevision', async () => {
  const { storage, ledger } = setup(), session = ledger.open(identity, context), ref = ledger.save(session, values('note'));
  const input = { materialId: 'mat_test', expectedRevision: 1, actor: 'user', patch: { addNote: 'note' } };
  const first = await ledger.prepare(identity, session.intentId, 'update-material', input, ref);
  input.patch.addNote = 'edited after preparing'; input.expectedRevision = 2;
  const pending = setup(storage).ledger.pending(identity)[0];
  assert.equal(pending.body.input.expectedRevision, 1); assert.equal(pending.body.input.patch.addNote, 'note');
  const replay = await setup(storage).ledger.prepare(identity, session.intentId, 'update-material', { materialId: 'mat_test', expectedRevision: 1, actor: 'user', patch: { addNote: 'note' } }, ref);
  assert.deepEqual(replay.body, first.body); assert.equal(replay.submissionId, first.submissionId);
});
test('changed fields cannot silently reuse or replace an unresolved submission', async () => {
  const { ledger } = setup();
  const request = await ledger.prepare(identity, 'shared_intent', 'create-material', { material: { text: 'first' } });
  await assert.rejects(ledger.prepare(identity, 'shared_intent', 'create-material', { material: { text: 'new fields' } }), { code: 'PENDING_SUBMISSION' });
  assert.equal(ledger.pending(identity)[0].submissionId, request.submissionId);
});
test('same shared intent and same full payload get the same ID across ledgers/tabs', async () => {
  const { storage, ledger } = setup(), input = { material: { title: '', original: { text: 'same' } } };
  const [first, second] = await Promise.all([ledger.prepare(identity, 'shared', 'create-material', input), setup(storage).ledger.prepare(identity, 'shared', 'create-material', input)]);
  assert.equal(first.submissionId, second.submissionId); assert.deepEqual(first.body, second.body);
});
test('a confirmed rejection allows corrected content with a different ID', async () => {
  const { ledger } = setup(), first = await ledger.prepare(identity, 'shared', 'update-material', { expectedRevision: 1 });
  ledger.reject(first, { code: 'REVISION_CONFLICT' });
  const second = await ledger.prepare(identity, 'shared', 'update-material', { expectedRevision: 2 });
  assert.notEqual(first.submissionId, second.submissionId);
});
test('unknown errors and failed readback keep the original unresolved request', async () => {
  const { ledger } = setup(), request = await ledger.prepare(identity, 'shared', 'create-material', { material: { text: 'first' } });
  ledger.reject(request, { code: 'NETWORK_ERROR' }); assert.equal(ledger.pending(identity).length, 1);
  assert.throws(() => ledger.complete(request, { verification: { persistedSubmission: true, snapshotVerified: false } }), { code: 'WRITE_NOT_VERIFIED' });
  assert.equal(ledger.pending(identity).length, 1);
});
test('discarding an outdated draft choice cannot delete a later revision', () => {
  const { ledger } = setup(), session = ledger.open(identity, context), first = ledger.save(session, values('one'));
  ledger.save(session, values('two')); assert.throws(() => ledger.discard(identity, first), { code: 'DRAFT_BRANCH_CONFLICT' });
  assert.equal(ledger.heads(identity)[0].values.fields.noteText, 'two');
});
test('quota denial blocks a request before its retry ID could be lost', async () => {
  const storage = new MemoryStorage(); storage.setItem = () => { throw new Error('quota'); };
  const { ledger } = setup(storage);
  await assert.rejects(ledger.prepare(identity, 'intent', 'create-material', { material: {} }), { code: 'DRAFT_STORAGE_UNAVAILABLE' });
});
test('file retry IDs include SHA-256 and retain metadata, never the File contents', async () => {
  const { storage, ledger } = setup(), file = { name: 'same.txt', size: 1, lastModified: 1, type: 'text/plain', sha256: 'a'.repeat(64) };
  const original = await ledger.prepareUpload(identity, 'intent', file);
  ledger.completeUpload(original);
  const replay = await setup(storage).ledger.prepareUpload(identity, 'intent', file), different = await ledger.prepareUpload(identity, 'intent', { ...file, sha256: 'b'.repeat(64) });
  assert.equal(original.submissionId, replay.submissionId); assert.equal(replay.status, 'registered');
  assert.notEqual(original.submissionId, different.submissionId); assert.notEqual(original.attachmentId, different.attachmentId);
  assert.equal(draftStable(replay.file), draftStable(file)); assert.equal('bytes' in replay, false);
});
test('File selection nonce protects newer selection while hash enrichment alone does not change input', () => {
  const sameInputLine = source.match(/function sameInput\(a, b\) \{[^\n]+\}/)[0];
  const sameInput = new Function('draftStable', sameInputLine + '; return sameInput;')(draftStable);
  const first = { fields: { addTitleInput: 'title' }, files: [{ name: 'same.txt', size: 1, type: 'text/plain', lastModified: 1, selectionId: 'selection_a' }] };
  const enriched = structuredClone(first); enriched.files[0].sha256 = 'a'.repeat(64);
  const later = structuredClone(first); later.files[0].selectionId = 'selection_b';
  assert.equal(sameInput(first, enriched), true); assert.equal(sameInput(first, later), false);
});
test('reselecting the same bytes uses the original upload ID regardless of File object and timestamp', async () => {
  const { ledger } = setup(), file = { name: 'same.txt', size: 1, lastModified: 1, selectionId: 'selection_a', type: 'text/plain', sha256: 'a'.repeat(64) };
  const first = await ledger.prepareUpload(identity, 'intent', file), replay = await ledger.prepareUpload(identity, 'intent', { ...file, lastModified: 999, selectionId: 'selection_b' });
  assert.equal(first.submissionId, replay.submissionId); assert.equal(first.attachmentId, replay.attachmentId);
});
test('transactionally rejected attachment failure does not permanently lock corrected draft content', async () => {
  const { ledger } = setup(), first = await ledger.prepare(identity, 'intent', 'create-material', { material: { attachmentIds: ['missing'] } });
  ledger.reject(first, { code: 'ATTACHMENT_NOT_REGISTERED' });
  assert.equal(ledger.hasPending(identity, 'intent'), false);
  const corrected = await ledger.prepare(identity, 'intent', 'create-material', { material: { attachmentIds: ['actual'] } });
  assert.notEqual(first.submissionId, corrected.submissionId);
});
test('explicit retry of the same frozen payload binds cleanup to its restored branch revision', async () => {
  const { ledger } = setup(), firstSession = ledger.open(identity, context), original = ledger.save(firstSession, values('same'));
  const input = { materialId: 'mat_test', expectedRevision: 1, actor: 'user', patch: { addNote: 'same' } };
  const originalRequest = await ledger.prepare(identity, firstSession.intentId, 'update-material', input, original);
  const restored = ledger.open(identity, context, original), restoredRecord = ledger.save(restored, values('same'));
  const retry = await ledger.prepare(identity, restored.intentId, 'update-material', input, restoredRecord);
  assert.deepEqual(retry.body, originalRequest.body); assert.equal(retry.submissionId, originalRequest.submissionId);
  assert.equal(retry.draftRef.branchId, restored.branchId);
  ledger.complete(retry, verified); assert.equal(ledger.heads(identity).length, 0);
});
