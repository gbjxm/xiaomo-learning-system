'use strict';

// BEGIN OBSERVATORY_DRAFT_LEDGER -- pure implementation also exercised by drafts.test.mjs.
function draftStable(value) {
  if (Array.isArray(value)) return '[' + value.map(draftStable).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + draftStable(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
function createObservatoryDraftLedger(storage, { randomId = () => crypto.randomUUID(), now = () => Date.now(), digest = async value => {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), n => n.toString(16).padStart(2, '0')).join('');
} } = {}) {
  const prefix = 'xiaomo.observatory.drafts.v1:';
  const copy = value => JSON.parse(JSON.stringify(value));
  const identityKey = identity => draftStable(Object.fromEntries(['storeId', 'projectRoot', 'canonicalDbPath', 'schemaVersion', 'scope'].map(k => [k, identity[k]])));
  const ns = identity => prefix + encodeURIComponent(identityKey(identity)) + ':';
  const problem = (code, message) => Object.assign(new Error(message), { code });
  function read(key) { try { const raw = storage.getItem(key); return raw ? JSON.parse(raw) : null; } catch { throw problem('DRAFT_STORAGE_UNAVAILABLE', '无法读取本机草稿。请保留当前输入，勿把草稿当成已提交资料。'); } }
  function put(key, value) { try { storage.setItem(key, JSON.stringify(value)); } catch { throw problem('DRAFT_STORAGE_UNAVAILABLE', '本机草稿空间不足或浏览器禁止保存。当前输入尚未可靠保留，请先复制到本机文件；本次不会发送未保存重试标识的提交。'); } }
  function records(identity, type) {
    const values = [], start = ns(identity) + type + ':';
    try { for (let i = 0; i < storage.length; i++) { const key = storage.key(i); if (key?.startsWith(start)) { const value = read(key); if (value && identityKey(value.identity) === identityKey(identity)) values.push(value); } } }
    catch (error) { if (error.code) throw error; throw problem('DRAFT_STORAGE_UNAVAILABLE', '无法读取本机草稿列表。'); }
    return values;
  }
  const keyFor = (identity, type, id) => ns(identity) + type + ':' + id;
  function heads(identity, context) {
    const drafts = records(identity, 'draft'), consumed = records(identity, 'consumed');
    const hidden = new Set();
    for (const child of [...drafts, ...consumed]) if (child.parent) {
      const parent = drafts.find(d => d.branchId === child.parent.branchId);
      if (parent?.revision === child.parent.revision) hidden.add(parent.branchId);
    }
    return drafts.filter(d => !hidden.has(d.branchId) && !consumed.some(c => c.branchId === d.branchId && c.revision >= d.revision)
      && (!context || (d.context.kind === context.kind && d.context.recordId === context.recordId))).sort((a, b) => b.updatedAt - a.updatedAt);
  }
  function open(identity, context, source) {
    if (source && identityKey(source.identity) !== identityKey(identity)) throw problem('DRAFT_IDENTITY_MISMATCH', '草稿来自另一数据入口，不能恢复到当前库。');
    return { identity: copy(identity), context: copy(source?.context ?? context), branchId: randomId(), intentId: source?.intentId ?? randomId(), revision: 0,
      parent: source ? { branchId: source.branchId, revision: source.revision } : null, values: source ? copy(source.values) : null };
  }
  function save(session, values) {
    const key = keyFor(session.identity, 'draft', session.branchId), previous = read(key);
    if ((previous?.revision ?? 0) !== session.revision) throw problem('DRAFT_BRANCH_CONFLICT', '这份草稿分支已变化。当前输入保留，请另开草稿分支后核对，不能覆盖它。');
    if (previous && draftStable(previous.values) === draftStable(values)) return previous;
    const record = { identity: copy(session.identity), context: copy(session.context), branchId: session.branchId, intentId: session.intentId,
      revision: session.revision + 1, parent: session.parent, updatedAt: now(), values: copy(values) };
    put(key, record); session.revision = record.revision; session.values = copy(values); return record;
  }
  function consume(identity, ref) {
    if (!ref) return;
    const key = keyFor(identity, 'draft', ref.branchId), current = read(key);
    put(keyFor(identity, 'consumed', ref.branchId), { identity: copy(identity), branchId: ref.branchId, revision: Math.max(ref.revision, read(keyFor(identity, 'consumed', ref.branchId))?.revision || 0), parent: ref.parent ?? current?.parent ?? null, updatedAt: now() });
    if (current?.revision === ref.revision) { try { storage.removeItem(key); } catch {} }
  }
  function discard(identity, record) {
    const current = read(keyFor(identity, 'draft', record.branchId));
    if (!current || current.revision !== record.revision) throw problem('DRAFT_BRANCH_CONFLICT', '草稿刚被更新，未丢弃；请重新读取后选择。');
    consume(identity, record);
  }
  const requests = identity => records(identity, 'request');
  async function prepare(identity, intentId, action, input, draftRef) {
    const frozen = copy(input), signature = await digest(draftStable({ identity, intentId, action, input: frozen }));
    const other = requests(identity).find(r => r.intentId === intentId && r.status === 'pending' && r.signature !== signature);
    if (other) throw problem('PENDING_SUBMISSION', '先前提交的结果仍未确认。请先用“核对并重试原提交”处理完整原内容；新输入已保留，不会复用原提交标识。');
    const submissionId = 'webdraft_' + signature, key = keyFor(identity, 'request', submissionId), existing = read(key);
    if (existing && existing.signature !== signature) throw problem('DRAFT_REQUEST_CONFLICT', '本机重试记录不一致，停止发送。');
    if (existing?.status === 'pending') { if (!draftRef) return existing; const rebound = { ...existing, draftRef: copy(draftRef) }; put(key, rebound); return rebound; }
    const record = { identity: copy(identity), intentId, action, signature, submissionId, status: 'pending', draftRef: draftRef ? copy(draftRef) : null,
      body: { action, input: { identity: copy(identity), submissionId, ...frozen } }, updatedAt: now() };
    put(key, record); return record;
  }
  function complete(request, result) {
    if (!result?.verification?.persistedSubmission || !result.verification.snapshotVerified) throw problem('WRITE_NOT_VERIFIED', '提交回读未确认，原内容和标识继续保留。');
    const current = read(keyFor(request.identity, 'request', request.submissionId));
    if (!current || current.signature !== request.signature) throw problem('DRAFT_REQUEST_CONFLICT', '未决提交记录不一致，不能清理草稿。');
    put(keyFor(request.identity, 'request', request.submissionId), { ...current, body: undefined, status: 'verified', recordId: result.receipt?.recordId, revision: result.receipt?.revision, updatedAt: now() });
    consume(request.identity, request.draftRef);
  }
  function reject(request, error) {
    const definite = ['REVISION_CONFLICT', 'INVALID_INPUT', 'UNSAFE_URI', 'AUTHORSHIP_PROTECTED', 'MATERIAL_DELETED', 'TOPIC_DELETED', 'NOT_FOUND', 'INVALID_SOURCE_REF', 'ATTACHMENT_NOT_REGISTERED', 'ATTACHMENT_UNAVAILABLE', 'MATERIAL_NOT_LINKED', 'MATERIAL_VERSION_MISSING'];
    if (!definite.includes(error.code)) return;
    put(keyFor(request.identity, 'request', request.submissionId), { ...request, status: 'rejected', errorCode: error.code, updatedAt: now() });
  }
  async function prepareUpload(identity, intentId, file) {
    const content = { name: file.name, size: file.size, type: file.type, sha256: file.sha256 };
    const signature = await digest(draftStable({ identity, intentId, file: content })), submissionId = 'webupload_' + signature;
    const key = keyFor(identity, 'upload', submissionId), existing = read(key);
    if (existing) return existing;
    const attachmentId = 'att_' + (await digest(draftStable({ storeId: identity.storeId, submissionId }))).slice(0, 40);
    const record = { identity: copy(identity), intentId, file: copy(file), submissionId, attachmentId, status: 'pending', updatedAt: now() };
    put(key, record); return record;
  }
  function completeUpload(record) { put(keyFor(record.identity, 'upload', record.submissionId), { ...record, status: 'registered', updatedAt: now() }); }
  return { identityKey, heads, open, save, consume, discard, prepare, complete, reject, requests,
    readDraft: (identity, branchId) => read(keyFor(identity, 'draft', branchId)),
    pending: identity => requests(identity).filter(r => r.status === 'pending'), prepareUpload, completeUpload,
    uploads: (identity, intentId) => records(identity, 'upload').filter(r => r.intentId === intentId), digest,
    hasPending: (identity, intentId) => requests(identity).some(r => r.intentId === intentId && r.status === 'pending') };
}
// END OBSERVATORY_DRAFT_LEDGER


(() => {
  const API = '/api/observatory';
  const main = document.getElementById('main');
  const $ = id => document.getElementById(id);
  let state = { identity: null, limits: {}, token: '', materials: [], topics: [], attachmentInfo: new Map() };
  let selectedMaterial = null, selectedTopic = null, editKind = 'material', toastTimer, loadSequence = 0;
  const selectedStages = new Map();
  const kinds = { link: '链接', text: '文字', recollection: '用户回忆描述', mixed: '组合素材', attachment: '文件', image: '图片', video: '视频' };
  const materialStates = { active: '收藏中', archived: '已归档', deleted: '已删除 · 可恢复' };
  const topicStates = { draft: '问题整理', researching: '研究中', paused: '暂停 · 可继续', stage_complete: '阶段完成', archived: '已归档', deleted: '已删除 · 可恢复' };
  const basisKinds = { direct_observation: '直接观察', source_fact: '来源事实', author_interpretation: '他人解释', ai_hypothesis: 'AI 分析 / 假设', user_impression: '用户感受', unknown: '未知 / 待核查', demo: '隔离测试示例' };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const mat = id => state.materials.find(item => item.materialId === id);
  const top = id => state.topics.find(item => item.topicId === id);
  const title = item => item.title || item.original?.source?.title || item.original?.text?.trim().slice(0, 40) || (item.original?.url ? '收藏的链接 · ' + safeHost(item.original.url) : item.topicId ? '未命名研究专题' : '未命名素材');
  const matUrl = id => '#material/' + encodeURIComponent(id);
  const topUrl = id => '#topic/' + encodeURIComponent(id);
  const date = value => value ? new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }) : '未记录';
  const tags = item => item.tags?.length ? item.tags.map(tag => `<span class="tag">${esc(tag)}</span>`).join('') : '<span class="pill neutral">未分类</span>';
  const list = (items, empty = '尚未记录。') => items?.length ? `<ul class="plain-list">${items.map(item => `<li>${esc(item)}</li>`).join('')}</ul>` : `<p class="subtle">${esc(empty)}</p>`;
  const button = (action, id, label, cls = 'quiet-button', extra = '') => `<button type="button" class="${cls}" data-action="${action}" data-id="${esc(id)}" ${extra}>${esc(label)}</button>`;
  const topicLinks = item => state.topics.filter(t => t.materialIds.includes(item.materialId));
  const readingDisclosures = new Map();
  // A saved introduction opts a stage into the reading layout. Older stages keep
  // their original layout; we do not infer a story from technical research text.
  // BEGIN OBSERVATORY_READING_HELPERS
  function readingIntro(stage) {
    const first = stage?.paragraphs?.[0];
    return first?.heading === '这份素材讲什么' && String(first.markdown || '').trim() ? first : null;
  }
  function readingSentence(paragraph) {
    const line = String(paragraph?.markdown || '').split(/\r?\n/).find(value => value.trim());
    if (!line) return '';
    const plain = line.trim().replace(/^#{1,6}\s+/, '').replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*`_]/g, '').trim();
    return plain.match(/^.*?[。！？](?:[”’」』])?/)?.[0] || plain;
  }
  function readingInlineImages(markdown) {
    const ids = new Set(); let code = false;
    for (const line of String(markdown || '').split('\n')) {
      if (/^```/.test(line)) { code = !code; continue; }
      if (!code) for (const match of line.matchAll(/!\[[^\]]*\]\(attachment:([A-Za-z0-9_-]+)\)/g)) ids.add(match[1]);
    }
    return ids;
  }
  function readingProfile(stage) {
    const paragraphs = stage?.paragraphs || [], preview = paragraphs[0], overview = paragraphs[1];
    if (preview?.heading === '收藏预览' && overview?.heading === '内容概要' && String(preview.markdown || '').trim() && String(overview.markdown || '').trim())
      return { kind: 'long', preview, overview, body: paragraphs.slice(2) };
    const intro = readingIntro(stage);
    return intro ? { kind: 'v3', preview: intro, overview: intro, body: paragraphs.slice(1) } : null;
  }
  function readingPreview(profile) {
    if (!profile) return '';
    if (profile.kind === 'v3') return readingSentence(profile.preview);
    return String(profile.preview.markdown).replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*`_]/g, '').replace(/\s+/g, ' ').trim();
  }
  function partitionLongBody(body) {
    const start = body.findIndex(p => p.heading === '方法与读取记录');
    return start < 0 ? { main: body, methods: [] } : { main: body.slice(0, start), methods: body.slice(start) };
  }
  // END OBSERVATORY_READING_HELPERS
  function materialReading(item) {
    const choices = topicLinks(item).filter(t => !['archived', 'deleted'].includes(t.status))
      .map(t => { const profile = readingProfile(t.stages.at(-1)); return { topic: t, stage: t.stages.at(-1), profile, intro: profile?.overview }; })
      .filter(choice => choice.profile).sort((a, b) => String(b.stage.createdAt).localeCompare(String(a.stage.createdAt)));
    return choices[0] || null;
  }
  const parseTags = value => [...new Set(value.split(/[，,\n]/).map(s => s.trim()).filter(Boolean))];

  let draftLedger = null, draftStorageError = '';
  const draftSessions = new Map(), fileMetadata = new WeakMap(), fileSelections = new WeakMap();
  function initDrafts() {
    try { const storage = window.localStorage; void storage.length; draftLedger = createObservatoryDraftLedger(storage); draftStorageError = ''; }
    catch { draftLedger = null; draftStorageError = '本机草稿存储不可用。请先复制输入到本机文件；浏览仍可使用，本页不会发送无法保留重试标识的修改。'; }
  }
  const fileBase = file => { if (!fileSelections.has(file)) fileSelections.set(file, crypto.randomUUID()); return { name: file.name, size: file.size, lastModified: file.lastModified, type: file.type || '', selectionId: fileSelections.get(file) }; };
  function formValues(form) {
    const fields = {}, files = [];
    form.querySelectorAll('input,select,textarea').forEach(el => {
      if (!el.id || el.readOnly) return;
      if (el.type === 'file') { for (const file of el.files || []) files.push({ inputId: el.id, ...fileBase(file), ...(fileMetadata.get(file) || {}) }); }
      else fields[el.id] = el.value;
    });
    const session = draftSessions.get(form.id);
    return { fields, files: files.length ? files : (session?.restoredFiles || []) };
  }
  function sameInput(a, b) { return draftStable(a.fields) === draftStable(b.fields) && draftStable(a.files.map(f => ({ ...f, sha256: undefined }))) === draftStable(b.files.map(f => ({ ...f, sha256: undefined }))); }
  function currentRevision(context) { return context.recordId === 'new' ? 0 : context.kind === 'edit-topic' ? top(context.recordId)?.revision : mat(context.recordId)?.revision; }
  function persistForm(formId) {
    const session = draftSessions.get(formId), form = $(formId); if (!session || !form || !draftLedger) return null;
    const values = formValues(form);
    if (session.completed && sameInput(values, session.completed)) return null;
    if (session.completed && session.handle.revision && !draftLedger.readDraft(state.identity, session.handle.branchId)) { session.handle = draftLedger.open(state.identity, session.currentContext); session.completed = null; session.ref = null; }
    if (!session.handle.revision && draftStable(values) === draftStable(session.initial)) return null;
    const record = draftLedger.save(session.handle, values); session.ref = record; draftStorageError = ''; return record;
  }
  function draftNotice(session, message) { const box = session.form.querySelector('[data-draft-notice]'); if (box) box.textContent = message; }
  function bindDraft(formId, context, label) {
    const form = $(formId); if (!form) return;
    const session = { form, currentContext: context, label, handle: draftLedger?.open(state.identity, context), restoredFiles: [], verifiedAttachments: [], ref: null };
    draftSessions.set(formId, session); session.initial = formValues(form);
    let box = form.querySelector('[data-draft-box]'); if (!box) { box = document.createElement('div'); box.dataset.draftBox = ''; box.className = 'warning-note'; form.insertBefore(box, form.children[1] || form.firstChild); }
    box.replaceChildren(); const notice = document.createElement('p'); notice.dataset.draftNotice = ''; notice.setAttribute('role', 'status'); box.append(notice);
    notice.textContent = draftStorageError || '未提交内容只作本机浏览器草稿，不会写入正式资料。';
    if (!draftLedger) return;
    const available = draftLedger.heads(state.identity, context);
    for (const record of available) {
      const row = document.createElement('p'); row.textContent = `${new Date(record.updatedAt).toLocaleString('zh-CN')} · 原依据 v${record.context.baseRevision}${record.context.baseRevision !== context.baseRevision ? ' · 版本已变化，恢复后需核对' : ''} `;
      const restore = document.createElement('button'); restore.type = 'button'; restore.className = 'quiet-button'; restore.textContent = '恢复这份草稿'; restore.onclick = () => restoreDraftInto(formId, record).catch(e => toast(errorText(e)));
      const discard = document.createElement('button'); discard.type = 'button'; discard.className = 'quiet-button'; discard.textContent = '丢弃这份草稿'; discard.onclick = () => { try { draftLedger.discard(state.identity, record); row.remove(); renderRecovery(); } catch (e) { toast(errorText(e)); } };
      row.append(restore, discard); box.append(row);
    }
    const rebase = document.createElement('button'); rebase.type = 'button'; rebase.className = 'quiet-button'; rebase.textContent = '已逐项核对，以当前版本继续'; rebase.hidden = true; rebase.dataset.draftRebase = '';
    rebase.onclick = () => { try { if (draftLedger.hasPending(state.identity, session.handle.intentId)) throw { code: 'PENDING_SUBMISSION', message: '先核对未确认的原提交，再合并到当前版本。' }; const latest = currentRevision(session.currentContext); if (latest === undefined) throw { message: '原记录目前不可读，请先核对记录，草稿保留。' }; session.currentContext = { ...session.currentContext, baseRevision: latest }; const material = mat(session.currentContext.recordId), topic = top(session.currentContext.recordId); if (material && formId !== 'noteForm' && formId !== 'appendForm') selectedMaterial = structuredClone(material); if (topic && session.currentContext.kind === 'edit-topic') selectedTopic = structuredClone(topic); const values = formValues(form), old = session.ref; session.handle = draftLedger.open(state.identity, session.currentContext); if (old) session.handle.parent = { branchId: old.branchId, revision: old.revision }; session.initial = { fields: {}, files: [] }; session.ref = draftLedger.save(session.handle, values); rebase.hidden = true; draftNotice(session, '你已确认逐项合并到本页当前版本；保存仍由服务器核对版本。'); renderRecovery(); } catch (e) { toast(errorText(e)); } };
    box.append(rebase);
  }
  async function verifyUpload(record) {
    const info = await request('/attachments/' + encodeURIComponent(record.attachmentId) + '/info');
    if (draftLedger.identityKey(info.identity) !== draftLedger.identityKey(record.identity) || info.record?.attachmentId !== record.attachmentId || info.record.sha256 !== record.file.sha256 || info.record.byteLength !== record.file.size || info.record.originalFilename !== record.file.name)
      throw { code: 'UPLOAD_IDENTITY_MISMATCH', message: '已登记原件与草稿的身份或文件摘要不符，停止复用。请保留草稿并核对原文件。' };
    draftLedger.completeUpload(record); state.attachmentInfo.set(record.attachmentId, info); return record.attachmentId;
  }
  async function restoreDraftInto(formId, record) {
    const session = draftSessions.get(formId); if (!session || !draftLedger) return;
    const current = draftLedger.readDraft(state.identity, record.branchId);
    if (!current || current.revision !== record.revision) throw { code: 'DRAFT_BRANCH_CONFLICT', message: '所选草稿已变化，请重新读取草稿列表；当前输入未覆盖。' };
    persistForm(formId);
    session.handle = draftLedger.open(state.identity, session.currentContext, record); session.restoredFiles = record.values.files || []; session.verifiedAttachments = [];
    session.completed = null; const generation = crypto.randomUUID(); session.restoreGeneration = generation; const branchId = session.handle.branchId;
    session.form.querySelectorAll('input[type="file"]').forEach(el => { el.value = ''; });
    for (const [id, value] of Object.entries(record.values.fields || {})) { const el = $(id); if (el && session.form.contains(el) && el.type !== 'file' && !el.readOnly) el.value = value; }
    session.ref = draftLedger.save(session.handle, record.values); session.initial = { fields: {}, files: [] };
    if (formId === 'addForm') { updateAddKind(); showDuplicates(); }
    if (formId === 'markForm') updateMarkKind(); if (formId === 'researchForm') updateResearchChoice();
    const stale = record.context.baseRevision !== session.currentContext.baseRevision; session.form.querySelector('[data-draft-rebase]').hidden = !stale;
    let filesMessage = session.restoredFiles.length ? '文件选择本体不能恢复，未登记文件须重新选择。' : '';
    for (const meta of session.restoredFiles) {
      if (!meta.sha256) continue;
      const upload = draftLedger.uploads(state.identity, session.handle.intentId).find(u => u.file.sha256 === meta.sha256 && u.file.name === meta.name && u.file.size === meta.size);
      if (!upload) continue;
      try { const attachmentId = await verifyUpload(upload); if (draftSessions.get(formId) !== session || session.handle.branchId !== branchId || session.restoreGeneration !== generation) return; session.verifiedAttachments.push(attachmentId); }
      catch (error) { if (error.code !== 'NOT_FOUND') filesMessage += ' 部分原件尚未核实，请重连后再次恢复或重选文件。'; }
    }
    if (draftSessions.get(formId) !== session || session.handle.branchId !== branchId || session.restoreGeneration !== generation) return;
    if (session.verifiedAttachments.length) filesMessage += ` 已只读核对并可复用 ${session.verifiedAttachments.length} 份登记原件；这不表示 File 选择已恢复。`;
    draftNotice(session, `已恢复本机草稿，尚未提交。${stale ? `原依据 v${record.context.baseRevision}，当前 v${session.currentContext.baseRevision}；保存前必须逐项核对并明确继续。` : ''}${Date.now() - record.updatedAt > 30 * 86400000 ? ' 这份草稿超过30天，请核对内容时效。' : ''}${filesMessage}`);
    renderRecovery();
  }
  function beginDraftSubmit(formId) {
    if (!draftLedger) throw { code: 'DRAFT_STORAGE_UNAVAILABLE', message: draftStorageError || '本机草稿不可用，尚未发送。' };
    const session = draftSessions.get(formId); if (!session) throw { code: 'DRAFT_CONTEXT_MISSING', message: '表单依据尚未核对，请重新打开表单。' };
    const latest = currentRevision(session.currentContext);
    if (latest !== undefined && latest !== session.currentContext.baseRevision) { session.currentContext = { ...session.currentContext, baseRevision: latest }; session.form.querySelector('[data-draft-rebase]').hidden = false; }
    if (draftLedger.identityKey(session.handle.identity) !== draftLedger.identityKey(state.identity)) throw { code: 'DRAFT_IDENTITY_MISMATCH', message: '表单来自另一数据入口，停止提交；请重新核对并打开表单。' };
    if (session.handle.context.baseRevision !== session.currentContext.baseRevision) throw { code: 'DRAFT_BASE_REVISION_CHANGED', message: '恢复的是旧版本草稿。请逐项核对，再点击“以当前版本继续”；未发送修改。' };
    const ref = persistForm(formId) || draftLedger.save(session.handle, formValues(session.form)); session.ref = ref;
    return { formId, identity: structuredClone(state.identity), intentId: session.handle.intentId, ref: structuredClone(ref), values: structuredClone(formValues(session.form)) };
  }
  function refForSubmission(snapshot) {
    if (!snapshot) return null;
    const session = draftSessions.get(snapshot.formId);
    if (session?.handle.branchId === snapshot.ref.branchId && sameInput(formValues(session.form), snapshot.values)) return persistForm(snapshot.formId) || snapshot.ref;
    return snapshot.ref;
  }
  function openFeeling(item) { selectedMaterial = structuredClone(item); $('feelingInput').value = item.currentImpression; clearError('feelingError'); bindDraft('feelingForm', { kind: 'feeling', recordId: item.materialId, baseRevision: item.revision }, '感受修正'); $('feelingDialog').showModal(); }
  async function materialView(item) { const target = matUrl(item.materialId); if (location.hash === target) renderMaterial(item); else { const changed = new Promise(resolve => window.addEventListener('hashchange', resolve, { once: true })); go(target); await changed; } }
  async function openSavedDraft(record) {
    const c = record.context, m = mat(c.recordId), t = top(c.recordId); let formId;
    if (c.kind === 'add') { openAdd(); formId = 'addForm'; }
    else if (c.kind === 'append' && m) { await materialView(m); formId = 'appendForm'; }
    else if (c.kind === 'note' && m) { await materialView(m); formId = 'noteForm'; }
    else if (c.kind === 'feeling' && m) { openFeeling(m); formId = 'feelingForm'; }
    else if (c.kind === 'mark' && m) { openMark(m); formId = 'markForm'; }
    else if (c.kind === 'research' && m) { openResearch(m); formId = 'researchForm'; }
    else if (c.kind === 'edit-material' && m) { openEdit(m, 'material'); formId = 'editForm'; }
    else if (c.kind === 'edit-topic' && t) { openEdit(t, 'topic'); formId = 'editForm'; }
    else throw { code: 'DRAFT_RECORD_MISSING', message: '草稿所据记录在当前入口中不可读；草稿保留，请先核对记录。' };
    await restoreDraftInto(formId, record); $(formId).scrollIntoView({ block: 'center' });
  }
  async function retryOriginal(record) {
    if (draftLedger.identityKey(record.identity) !== draftLedger.identityKey(state.identity)) throw { code: 'DRAFT_IDENTITY_MISMATCH', message: '未决提交来自另一库，已停止。' };
    try {
      const result = await request('/action', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Observatory-Token': state.token }, body: JSON.stringify(record.body) });
      draftLedger.complete(record, result); for (const session of draftSessions.values()) if (session.handle?.branchId === record.draftRef?.branchId) session.completed = record.draftRef.values; await refresh(); toast(`原提交已核对并回读：${result.receipt.recordId} · v${result.receipt.revision}。后来的草稿保留。`);
    } catch (error) { draftLedger.reject(record, error); renderRecovery(); throw error; }
  }
  const draftKindLabels = { add: '收藏素材', feeling: '修正感受', research: '研究专题输入', 'edit-material': '编辑素材', 'edit-topic': '编辑研究专题', mark: '关注片段', note: '素材备注', append: '补充附件' };
  const draftActionLabels = { 'create-material': '收藏素材', 'update-material': '保存素材修改', 'create-topic': '建立研究专题', 'update-topic': '保存专题修改' };
  function renderRecovery() {
    const panel = $('draftRecovery'); if (!panel) return; panel.replaceChildren();
    if (!draftLedger || !state.identity) { panel.hidden = !draftStorageError; panel.textContent = draftStorageError; return; }
    try {
      const records = draftLedger.heads(state.identity), pending = draftLedger.pending(state.identity); panel.hidden = !records.length && !pending.length && !draftStorageError; if (panel.hidden) return;
      if (draftStorageError) { const warning = document.createElement('p'); warning.className = 'form-error'; warning.textContent = draftStorageError; panel.append(warning); }
      const intro = document.createElement('p'); intro.textContent = `本机有 ${records.length} 份未提交草稿、${pending.length} 项结果未确认的提交。仅保存在本机浏览器，不是正式资料；恢复、丢弃和核对均由你选择。`; panel.append(intro);
      if (records.length > 1) { const message = document.createElement('p'); message.className = 'subtle'; message.textContent = '不同页面或版本的草稿分别保留，不自动互相覆盖。'; panel.append(message); }
      for (const record of records) { const row = document.createElement('p'); row.dataset.draftKind = record.context.kind; row.textContent = `${draftKindLabels[record.context.kind] || '未提交资料'} · ${record.context.recordId === 'new' ? '新收藏' : record.context.recordId} · 依据 v${record.context.baseRevision} · ${new Date(record.updatedAt).toLocaleString('zh-CN')} `;
        const restore = document.createElement('button'); restore.type = 'button'; restore.className = 'quiet-button'; restore.textContent = '恢复'; restore.onclick = () => openSavedDraft(record).catch(e => toast(errorText(e)));
        const discard = document.createElement('button'); discard.type = 'button'; discard.className = 'quiet-button'; discard.textContent = '丢弃'; discard.onclick = () => { try { draftLedger.discard(state.identity, record); renderRecovery(); } catch (e) { toast(errorText(e)); } }; row.append(restore, discard); panel.append(row); }
      for (const record of pending) { const row = document.createElement('p'); row.dataset.draftAction = record.action; row.textContent = `${draftActionLabels[record.action] || '保存资料'} · 原提交完整内容和标识已保留 `; const button = document.createElement('button'); button.type = 'button'; button.className = 'secondary-button'; button.textContent = '核对并重试原提交'; button.onclick = async () => { button.disabled = true; try { await retryOriginal(record); } catch (e) { toast(errorText(e)); } finally { button.disabled = false; } }; row.append(button); panel.append(row); }
    } catch (e) { panel.hidden = false; panel.textContent = errorText(e); }
  }
  function saveDraftEvent(event) { if (event.target.type === 'file' && event.target.files?.length) { const owner = draftSessions.get(event.target.closest('form')?.id); if (owner) { owner.restoreGeneration = crypto.randomUUID(); owner.restoredFiles = []; owner.verifiedAttachments = []; } } const form = event.target.closest?.('form'); if (!form || !draftSessions.has(form.id)) return; try { persistForm(form.id); const session = draftSessions.get(form.id); if (!session.handle) draftNotice(session, draftStorageError); else if (session.handle.context.baseRevision === session.currentContext.baseRevision) draftNotice(session, '未提交内容已保留为本机草稿；尚未写入正式资料。'); renderRecovery(); } catch (e) { draftStorageError = errorText(e); renderRecovery(); } }
  document.addEventListener('input', saveDraftEvent); document.addEventListener('change', saveDraftEvent);
  window.addEventListener('storage', event => { if (event.key?.startsWith('xiaomo.observatory.drafts.v1:')) renderRecovery(); });
  window.addEventListener('pagehide', () => { for (const [id, session] of draftSessions) if (session.form.isConnected) try { persistForm(id); } catch {} });

  const uid = () => 'web_' + crypto.randomUUID();
  const decode = value => { try { return decodeURIComponent(value); } catch { return value; } };
  function safeUrl(value) { try { const u = new URL(value); return ['http:', 'https:'].includes(u.protocol) && !u.username && !u.password ? u.href : ''; } catch { return ''; } }
  function safeHost(value) { try { return new URL(value).hostname; } catch { return ''; } }
  function externalLink(uri, label = uri) { const safe = safeUrl(uri); return safe ? `<a href="${esc(safe)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>` : esc(label); }
  function toast(message) { clearTimeout(toastTimer); $('toast').textContent = message; $('toast').hidden = false; toastTimer = setTimeout(() => { $('toast').hidden = true; }, 8000); }
  function errorText(error) { return `${error.code ? error.code + '：' : ''}${error.message || '操作失败。'}${error.code === 'REVISION_CONFLICT' ? ' 当前输入已保留；先复制保留，再重新加载最新版本并合并。' : ''}`; }
  function formError(id, error) { const el = $(id); el.textContent = errorText(error); el.hidden = false; }
  function clearError(id) { $(id).hidden = true; $(id).textContent = ''; }
  async function request(route, options = {}) {
    let response, body;
    try { response = await fetch(API + route, { cache: 'no-store', ...options }); body = await response.json(); }
    catch { throw { code: 'NETWORK_ERROR', message: '连接或响应未确认完成。保留当前输入；恢复连接后用相同内容重试，系统会核对提交标识。' }; }
    if (!response.ok || !body.ok) throw body.error || { code: 'HTTP_ERROR', message: '请求失败：' + response.status };
    return body.data;
  }

  async function write(action, input, key = action, snapshot = null) {
    if (!draftLedger) throw { code: 'DRAFT_STORAGE_UNAVAILABLE', message: draftStorageError || '本机重试记录不可用，未发送。' };
    const intentId = snapshot?.intentId || `action:${key}:${input.materialId || input.topicId || 'new'}:${input.expectedRevision || 0}`;
    const record = await draftLedger.prepare(state.identity, intentId, action, input, refForSubmission(snapshot)); renderRecovery();
    try {
      const result = await request('/action', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Observatory-Token': state.token }, body: JSON.stringify(record.body) });
      draftLedger.complete(record, result); const session = snapshot && draftSessions.get(snapshot.formId); if (session?.handle.branchId === snapshot.ref.branchId) session.completed = snapshot.values; renderRecovery(); return result;
    } catch (error) { draftLedger.reject(record, error); renderRecovery(); throw error; }
  }

  // BEGIN OBSERVATORY_STAGE_REFRESH_HELPER
  function syncStageSelections(previousTopics,nextTopics,selections){
    const previous=new Map(previousTopics.map(topic=>[topic.topicId,topic]));
    for(const topic of nextTopics){
      const before=previous.get(topic.topicId),selected=selections.get(topic.topicId);
      if(before&&topic.stages.length>before.stages.length&&selected===before.stages.length-1)selections.set(topic.topicId,topic.stages.length-1);
    }
  }
  // END OBSERVATORY_STAGE_REFRESH_HELPER
  async function refresh({ renderPage = true } = {}) {
    const sequence = ++loadSequence;
    const [materials, topics] = await Promise.all([request('/materials?status=all'), request('/topics')]);
    if (sequence !== loadSequence) return;
    for (const data of [materials, topics]) if (data.identity.storeId !== state.identity.storeId || data.identity.canonicalDbPath !== state.identity.canonicalDbPath) throw { code: 'STORE_IDENTITY_MISMATCH', message: '数据身份变化，停止操作。请重新打开页面核对数据位置。' };
    syncStageSelections(state.topics,topics.records,selectedStages);
    state.materials = materials.records; state.topics = topics.records;
    if (renderPage) render(); renderRecovery();
  }
  async function reload() { $('reloadRecords').disabled = true; try { if (!state.identity) await boot(); else { const bootstrap = await request('/bootstrap'); if (bootstrap.identity.storeId !== state.identity.storeId || bootstrap.identity.canonicalDbPath !== state.identity.canonicalDbPath || bootstrap.identity.scope !== state.identity.scope) throw { code: 'STORE_IDENTITY_MISMATCH', message: '服务指向的数据集已变化，停止刷新及写入。请完整重新打开页面，核对数据入口。' }; state.token = bootstrap.token; state.limits = bootstrap.limits || state.limits; await refresh(); toast('已从磁盘重新读取最新记录。'); } } catch (e) { toast(errorText(e)); } finally { $('reloadRecords').disabled = false; } }
  async function boot() {
    try {
      const data = await request('/bootstrap'); state.identity = data.identity; state.limits = data.limits || {}; state.token = data.token; initDrafts();
      $('datasetBanner').textContent = `${data.identity.scope === 'production' ? '正式素材库' : '隔离测试数据 · 不是真实收藏'} · ${data.identity.storeId}`;
      $('datasetBanner').classList.toggle('isolated', data.identity.scope !== 'production');
      const identity = data.identity;
      $('dataLocation').innerHTML = `<p class="small">数据身份：<span class="version">${esc(identity.storeId)}</span> · ${esc(identity.scope)} · 结构 v${esc(identity.schemaVersion)}</p><p class="url">数据库：${esc(identity.canonicalDbPath)}</p><p class="url">附件：${esc(data.attachmentsDir || identity.canonicalDbPath.replace(/[\\/]data[\\/]observatory\.sqlite3$/i, '/attachments'))}</p><p class="subtle small">完整备份包含一致的数据库快照、附件与校验清单。恢复演练请用模块 CLI 的显式隔离目录。</p>`;
      $('uploadLimits').textContent = limitDescription();
      await refresh();
    } catch (e) {
      $('datasetBanner').textContent = '素材观察室暂不可用 · 原学习终端仍可使用';
      main.innerHTML = `<div class="empty-state"><h1>尚未读取到素材库</h1><p class="form-error">${esc(errorText(e))}</p><p>读取操作不会创建空库。请核对服务启动方式和模块使用说明；首次初始化需要明确执行。</p><button type="button" data-action="reload" class="secondary-button">重新读取</button> <a href="/">返回学习终端</a></div>`;
    }
  }
  function limitDescription() { const l = state.limits; return `单文件限制：图片 ${mb(l.image || 20 * 1024 ** 2)}，视频 ${mb(l.video || 250 * 1024 ** 2)}，音频 ${mb(l.audio || 50 * 1024 ** 2)}，PDF ${mb(l.pdf || 20 * 1024 ** 2)}，TXT / MD ${mb(l.text || 5 * 1024 ** 2)}。PNG / JPEG / WebP / GIF、MP4 / WebM、MP3 / WAV。预览依浏览器编码支持，上传不代表分析完成。`; }
  function mb(value) { return (value / 1024 ** 2).toFixed(value < 1024 ** 2 ? 2 : 0) + ' MB'; }
  function fileGroup(file) { const ext = file.name.split('.').at(-1).toLowerCase(); return ({ png: 'image', jpg: 'image', jpeg: 'image', webp: 'image', gif: 'image', mp4: 'video', webm: 'video', mp3: 'audio', wav: 'audio', txt: 'text', md: 'text', pdf: 'pdf' })[ext]; }

  async function upload(file, progressElement, intentId) {
    const group = fileGroup(file); if (!group) throw { code: 'UNSUPPORTED_FILE', message: `${file.name}：类型不支持。请使用列出的图片、视频、音频、文本或 PDF 文件。` };
    if (file.size > (state.limits[group] || { image: 20, video: 250, audio: 50, text: 5, pdf: 20 }[group] * 1024 ** 2)) throw { code: 'FILE_TOO_LARGE', message: `${file.name} 超过单文件限制，尚未上传。` };
    if (!draftLedger) throw { code: 'DRAFT_STORAGE_UNAVAILABLE', message: draftStorageError || '不能保存上传重试标识，未上传。' };
    let meta = fileMetadata.get(file);
    if (!meta) { progressElement.textContent = `${file.name} · 正在计算原件摘要，文件内容不会存入浏览器草稿。`; const bytes = await crypto.subtle.digest('SHA-256', await file.arrayBuffer()); meta = { ...fileBase(file), sha256: Array.from(new Uint8Array(bytes), n => n.toString(16).padStart(2, '0')).join('') }; fileMetadata.set(file, meta); }
    const record = await draftLedger.prepareUpload(state.identity, intentId || `append:${location.hash}`, meta);
    const owner = [...draftSessions.values()].find(s => s.handle?.intentId === intentId); if (owner) persistForm(owner.form.id);
    try { const id = await verifyUpload(record); progressElement.textContent = `${file.name} · 已只读核对登记原件并复用；没有恢复 File 选择。`; return id; }
    catch (error) { if (error.code !== 'NOT_FOUND') throw error; }
    const result = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest(); xhr.open('POST', API + '/upload');
      xhr.setRequestHeader('X-Observatory-Token', state.token); xhr.setRequestHeader('X-File-Name', encodeURIComponent(file.name)); xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream'); xhr.setRequestHeader('X-Submission-Id', record.submissionId); xhr.setRequestHeader('X-Store-Id', state.identity.storeId);
      xhr.upload.addEventListener('progress', event => { progressElement.textContent = `${file.name} · 上传 ${event.lengthComputable ? Math.round(event.loaded / event.total * 100) + '%' : mb(event.loaded)}`; });
      xhr.addEventListener('load', () => { try { const body = JSON.parse(xhr.responseText); if (xhr.status < 200 || xhr.status >= 300 || !body.ok) reject(body.error || { message: '上传失败。' }); else resolve(body.data); } catch { reject({ code: 'UPLOAD_UNCONFIRMED', message: '上传结果未确认，原标识与摘要已保留；重选同一文件后可核对重试。' }); } });
      xhr.addEventListener('error', () => reject({ code: 'UPLOAD_INTERRUPTED', message: `${file.name} 上传中断，原标识与摘要已保留；文件本体不能恢复，请重选同一文件。` }));
      xhr.addEventListener('abort', () => reject({ code: 'UPLOAD_INTERRUPTED', message: '上传取消，原标识与摘要已保留。' })); xhr.send(file);
    });
    if (result.receipt?.recordId !== record.attachmentId || !result.verification?.persistedSubmission || !result.verification.snapshotVerified) throw { code: 'UPLOAD_NOT_VERIFIED', message: '附件登记回读未确认，原标识保留，不继续保存素材。' };
    const id = await verifyUpload(record); try { const owner = [...draftSessions.values()].find(s => s.handle?.intentId === intentId); if (owner) persistForm(owner.form.id); } catch {} progressElement.textContent = `${file.name} · 文件已校验登记，正在保存素材引用。`; return id;
  }

  async function ensureAttachments(ids) { await Promise.all([...new Set(ids)].filter(id => !state.attachmentInfo.has(id)).map(async id => { try { state.attachmentInfo.set(id, await request('/attachments/' + encodeURIComponent(id) + '/info')); } catch (e) { state.attachmentInfo.set(id, { error: e }); } })); }
  function attachmentCard(id, removable = false, compact = false) {
    const meta = state.attachmentInfo.get(id);
    if (!meta) return `<div class="attachment-card" data-attachment-id="${esc(id)}"><p>正在读取附件状态…</p></div>`;
    if (meta.error) return `<div class="attachment-card"><p class="form-error">附件 ${esc(id)}：${esc(errorText(meta.error))}</p></div>`;
    const r = meta.record || meta.attachment, cap = meta.capabilities || {}, mime = r.mimeType || '', src = `${API}/attachments/${encodeURIComponent(id)}`;
    if (compact) return `<div class="attachment-reference" data-attachment-id="${esc(id)}"><a href="${src}/download" download>下载原件 · ${esc(r.originalFilename || id)}</a><span>${mb(r.byteLength || 0)} · 已保存 / 文件可访问；研究读取范围见来源</span></div>`;
    let preview = '<p class="subtle">此文件未启用内嵌预览，可以下载原文件。</p>';
    if (mime.startsWith('image/') && cap.preview !== false) preview = `<img src="${src}" alt="${esc(r.originalFilename)}" loading="lazy" data-media="image"><p class="preview-state" role="status">图片预览加载中…</p>`;
    else if (mime.startsWith('video/') && cap.preview !== false) preview = `<video controls preload="metadata" src="${src}" data-media="video"></video><p class="preview-state" role="status">视频预览加载中；可播放不等于已分析。</p>`;
    else if (mime.startsWith('audio/') && cap.preview !== false) preview = `<audio controls preload="metadata" src="${src}" data-media="audio"></audio><p class="preview-state" role="status">音频预览加载中；可播放不等于已分析。</p>`;
    return `<figure class="attachment-card" data-attachment-id="${esc(id)}">${preview}<figcaption><strong>${esc(r.originalFilename || id)}</strong><span class="small"> ${mb(r.byteLength || 0)} · 已保存 / 文件可访问；研究读取范围见专题来源</span><div class="attachment-actions"><a href="${src}/download" download>下载原文件</a>${removable ? button('detach', id, '解除附件引用') : ''}</div>${cap.limitations?.length ? list(cap.limitations) : ''}</figcaption></figure>`;
  }
  function bindMedia() { main.querySelectorAll('[data-media]').forEach(element => { const status = element.nextElementSibling; const ready = () => { status.textContent = `${element.dataset.media === 'image' ? '图片可预览' : element.dataset.media === 'video' ? '视频可预览 / 可播放' : '音频可播放'} · 浏览器预览不代表已完成读取或研究`; status.classList.add('ready'); }; element.addEventListener(element.tagName === 'IMG' ? 'load' : 'loadedmetadata', ready, { once: true }); element.addEventListener('error', () => { status.textContent = '浏览器无法预览此文件。原文件已保存，可下载；请核对文件是否损坏及编码支持。'; status.classList.add('form-error'); }); if (element.tagName === 'IMG' && element.complete && element.naturalWidth) ready(); else if (element.readyState >= 1) ready(); }); }
  function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }
  function render() {
    for (const id of ['noteForm', 'appendForm']) if ($(id)) try { persistForm(id); } catch (e) { draftStorageError = errorText(e); }
    if (!state.identity) return;
    const [route, rawId, targetKind, targetId] = location.hash.replace(/^#/, '').split('/'); const id = rawId ? decode(rawId) : '';
    $('navCollection').classList.toggle('active', !route || ['collection', 'material'].includes(route)); $('navTopics').classList.toggle('active', ['topics', 'topic'].includes(route));
    if (route === 'material' && mat(id)) renderMaterial(mat(id)); else if (route === 'topic' && top(id)) renderTopic(top(id), targetKind, targetId ? decode(targetId) : ''); else if (route === 'topics') renderTopics(); else if (['material', 'topic'].includes(route)) main.innerHTML = '<div class="empty-state"><h1>记录未找到</h1><p>请核对当前数据集及 ID，或重新加载。</p><a href="#collection">返回收藏</a></div>'; else renderCollection();
  }
  function renderCollection() {
    document.body.classList.remove('long-reading-page');
    const uniqueTags = [...new Set(state.materials.flatMap(m => m.tags))].sort();
    main.innerHTML = `<div class="page-header"><div><span class="eyebrow">留住那些想再看一眼的东西</span><h1>收藏</h1><p class="subtle">链接、画面、一句话。先把它留下，研究可以晚一点。</p></div><button class="primary-button" data-action="add" id="addMaterial">+ 收藏素材</button></div><div class="quick-save-bar"><p><strong>不用先回答一个研究问题。</strong>原始素材和你的第一感受，各自留下。</p><button class="secondary-button" data-action="add">快速添加</button></div><details class="collection-filters" ${window.matchMedia('(min-width: 761px)').matches ? 'open' : ''}><summary>查找与筛选</summary><form class="filters" id="filterForm" role="search"><div><label for="searchInput">搜索标题、标签、来源、原话、备注与研究正文</label><input type="search" id="searchInput" maxlength="2000" placeholder="输入你记得的词…"></div><div><label for="categoryFilter">分类</label><select id="categoryFilter"><option value="all">全部标签</option><option value="unclassified">未分类</option>${uniqueTags.map(tag => `<option>${esc(tag)}</option>`).join('')}</select></div><div><label for="kindFilter">形式</label><select id="kindFilter"><option value="all">全部形式</option>${Object.entries(kinds).map(([key, value]) => `<option value="${key}">${value}</option>`).join('')}</select></div><div><label for="statusFilter">收藏状态</label><select id="statusFilter"><option value="active">收藏中</option><option value="all">全部（含已删除）</option><option value="archived">已归档</option><option value="deleted">已删除 · 可恢复</option></select></div></form></details><div class="list-summary"><span id="resultCount"></span><span>不自动研究</span></div><div id="listRows"></div>`;
    $('filterForm').addEventListener('submit', e => e.preventDefault()); ['searchInput', 'categoryFilter', 'kindFilter', 'statusFilter'].forEach(id => $(id).addEventListener('input', filterCollection)); filterCollection();
  }
  function filterCollection() {
    const query = $('searchInput').value.trim().toLocaleLowerCase(), category = $('categoryFilter').value, kind = $('kindFilter').value, status = $('statusFilter').value;
    const items = state.materials.filter(item => (category !== 'unclassified' || !item.tags.length) && (['all', 'unclassified'].includes(category) || item.tags.includes(category)) && (kind === 'all' || item.original.kind === kind) && (status === 'all' || item.status === status) && (!query || JSON.stringify([item, ...topicLinks(item)]).toLocaleLowerCase().includes(query)));
    $('resultCount').textContent = `找到 ${items.length} 条素材 · 共 ${state.materials.length} 条`;
    $('listRows').innerHTML = items.length ? items.map(item => `<article class="material-row" data-material-id="${esc(item.materialId)}"><a class="row-image ${item.original.kind === 'link' ? 'link-preview' : 'text-preview'}" href="${matUrl(item.materialId)}" aria-label="查看原始素材"><span>${item.original.kind === 'link' ? '↗' : esc(item.original.text.slice(0, 80) || kinds[item.original.kind] || '文件素材')}</span></a><div class="row-main"><h2><a href="${matUrl(item.materialId)}">${esc(title(item))}</a></h2>${materialReading(item) ? `<p class="row-description">${esc(readingPreview(materialReading(item).profile))}</p>` : ''}<p class="row-feeling">${esc(item.currentImpression || '还没写为什么吸引我。先留着，以后再想。')}</p><div class="tags"><span class="pill neutral">${kinds[item.original.kind]}</span>${tags(item)}</div><p class="row-context">${item.attachmentIds.length} 个附件 · ${topicLinks(item).length ? '关联 ' + topicLinks(item).length + ' 个专题' : '暂不研究'}${item.original.url ? ' · 收藏端不自动访问链接' : ''}</p></div><div class="row-side"><span>${esc(date(item.createdAt))}</span><span class="pill neutral">${materialStates[item.status]}</span><a href="${matUrl(item.materialId)}">看素材 →</a></div></article>`).join('') : '<div class="empty-state"><h2>还没有这组素材</h2><p>随手保存一个链接或一段文字即可。未分类素材也能保存并找回。</p></div>';
  }
  function renderMaterial(item) {
    const linkedTopics = topicLinks(item), source = item.source || item.original.source || {}, reading = materialReading(item);
    document.body.classList.toggle('long-reading-page', reading?.profile.kind === 'long');
    const original = (item.original.url ? `<div class="original-link"><span class="eyebrow">原始链接 · 收藏不自动读取</span><p class="url">${externalLink(item.original.url)}</p><p class="subtle">收藏只保存输入。实际读取范围及研究结果见关联专题的来源记录。</p></div>` : '') + (item.original.text ? `<div class="original-text">${esc(item.original.text)}</div>` : '') + (item.original.kind === 'recollection' ? '<p class="warning-note">用户凭记忆描述，不能据此认定原片、作者、人物经历或真实出处。</p>' : '');
    main.innerHTML = `<div class="breadcrumb"><a href="#collection">收藏</a><span>/</span><span>${esc(title(item))}</span></div><div class="page-header"><div><h1>${esc(title(item))}</h1><div class="page-meta"><span class="pill neutral">${kinds[item.original.kind]}</span><span class="pill">${materialStates[item.status]}</span><span class="version">${esc(item.materialId)} · v${item.revision}</span></div></div>${item.status === 'deleted' ? button('restore-material', item.materialId, '恢复到收藏', 'primary-button') : button('research', item.materialId, '开始 / 继续研究', 'primary-button', 'id="beginResearch"')}</div>${reading ? `<section class="${reading.profile.kind === 'long' ? 'material-long-overview' : 'reading-intro material-reading-intro'}"><h2>${reading.profile.kind === 'long' ? '内容概要' : '这份素材讲什么'}</h2><div class="markdown-content" data-material-intro></div><a class="reading-continue" href="${topUrl(reading.topic.topicId)}">读原文 / 画面与解读 →</a></section>` : ''}<div class="material-layout"><div class="material-left"><section class="material-original" aria-labelledby="originalTitle"><div class="section-heading"><h2 id="originalTitle">原始素材</h2><span class="version">完整输入保留</span></div>${original}<div id="materialAttachments">${item.attachmentIds.map(id => attachmentCard(id, true)).join('')}</div><p class="original-description">已保存 · ${item.original.url ? '收藏端不检索链接' : '本地输入可浏览'} · ${linkedTopics.some(t => t.stages.length) ? '有相关专题成果，读取范围见研究来源' : '尚未研究'}</p><form id="appendForm"><label for="appendFiles">补充附件 <span class="optional">可多选，不改原始输入</span></label><input type="file" id="appendFiles" multiple><button type="button" class="secondary-button" data-action="append-files" data-id="${esc(item.materialId)}">上传并关联</button><p class="subtle small">${esc(limitDescription())}</p><div id="appendUploadStatus" class="upload-status" role="status"></div></form></section><section class="material-section material-attention"><div class="section-heading"><h2>我关注的片段</h2>${button('mark', item.materialId, '新增标记', 'quiet-button', 'id="addMark"')}</div>${item.segments.length ? `<div class="attention-list">${item.segments.map(s => `<div class="attention-item"><strong>${s.kind === 'time' ? `${s.startSeconds}–${s.endSeconds} 秒` : s.kind === 'image' ? '图片局部说明' : s.kind === 'text' ? '文字选段' : '关注点'}</strong><p>${esc(s.text)}</p><small>${esc(s.note)}</small>${s.attachmentId ? `<p class="version">对应附件 ${esc(s.attachmentId)}</p>` : ''}${button('remove-mark', s.segmentId, '移除标记')}</div>`).join('')}</div>` : '<p class="subtle">没有标记也可以独立收藏。</p>'}</section><section class="material-section material-notes"><h2>后续备注</h2><p class="subtle">新的观察放在这里，与最初的触动分别保存。</p>${item.notes.map(note => `<div class="note-item"><p>${esc(note.text)}</p><small>${esc(date(note.createdAt))} · 用户备注</small></div>`).join('')}<form id="noteForm" class="note-input"><label for="noteText">追加一条备注</label><textarea id="noteText" rows="2" maxlength="2000000" required></textarea><p id="noteError" class="form-error" hidden role="alert"></p><button class="secondary-button" type="submit">追加备注</button></form></section><div class="bottom-actions">${button('archive', item.materialId, item.status === 'archived' ? '恢复到收藏中' : '归档素材')}${button(item.status === 'deleted' ? 'restore-material' : 'delete-material', item.materialId, item.status === 'deleted' ? '恢复素材' : '可恢复删除')}<span class="subtle small">不改变专题状态，不删除共享附件。</span></div></div><aside class="material-right"><section class="feeling-panel"><div class="section-heading"><h2>为什么吸引我</h2>${button('feeling', item.materialId, item.currentImpression ? '修正原话' : '补充感受', 'text-button', 'id="editFeeling"')}</div><span class="initial-label">初始原话 · 收藏时</span><p class="feeling-quote">${esc(item.originalImpression || '收藏时没有填写感受。')}</p>${item.impressionHistory.length ? `<div class="feeling-revision"><span class="initial-label">当前原话</span><p>${esc(item.currentImpression)}</p><details class="feeling-history"><summary>查看修正记录（${item.impressionHistory.length} 次）</summary>${item.impressionHistory.map(h => `<p>素材 v${h.materialRevision} · ${esc(date(h.changedAt))}<br>修改前：${esc(h.before)}<br>修改后：${esc(h.after)}</p>`).join('')}</details></div>` : '<p class="subtle small">原话、后续备注与 AI 分析分别保存。</p>'}</section><section class="material-section source-section-material"><div class="section-heading"><h2>来源与标签</h2>${button('edit-material', item.materialId, '编辑', 'text-button', 'id="editMaterial"')}</div><dl class="source-facts"><dt>来源</dt><dd>${esc(source.title || '未补充')}</dd><dt>作者</dt><dd>${esc(source.author || '未知，待核对')}</dd><dt>链接</dt><dd class="url">${source.uri ? externalLink(source.uri) : '没有补充来源链接'}</dd><dt>位置</dt><dd>${esc(source.locator || '未记录')}</dd><dt>许可</dt><dd>待核查，不能据此用于发布。</dd><dt>收藏</dt><dd>${esc(date(item.createdAt))}</dd></dl><div class="tags">${tags(item)}</div>${item.sourceHistory?.length ? `<details><summary>来源修正历史（${item.sourceHistory.length} 次）</summary>${item.sourceHistory.map(h => `<pre class="safe-pre">${esc(JSON.stringify(h, null, 2))}</pre>`).join('')}</details>` : ''}</section><section class="material-section relation-section"><h2>关联专题 <span class="version">${linkedTopics.length} 个</span></h2>${linkedTopics.map(t => `<a class="topic-link" href="${topUrl(t.topicId)}"><strong>${esc(title(t))}</strong><small>${topicStates[t.status]} · 同一素材引用</small></a>`).join('') || '<p class="subtle">暂不研究。收藏不要求建立专题。</p>'}${button('research', item.materialId, '新建 / 关联专题', 'secondary-button')}</section><section class="material-section research-summary-section"><h2>已有研究</h2>${linkedTopics.filter(t => t.stages.length).map(t => `<div class="mini-research"><a href="${topUrl(t.topicId)}">${esc(title(t))} →</a><p>${esc(t.stages.at(-1).focus)}</p><span class="version">${t.stages.length} 个阶段版本 · 完整正文在专题里</span></div>`).join('') || '<p class="subtle">尚无研究成果。</p>'}${button('handoff-material', item.materialId, '复制素材交接', 'secondary-button')}${button('export-material', item.materialId, '导出素材', 'quiet-button')}</section></aside></div>`;
    if (reading) appendMarkdown(main.querySelector('[data-material-intro]'), reading.intro.markdown);
    bindDraft('appendForm', { kind: 'append', recordId: item.materialId, baseRevision: item.revision }, '补充附件');
    bindDraft('noteForm', { kind: 'note', recordId: item.materialId, baseRevision: item.revision }, '备注');
    $('noteForm').addEventListener('submit', async e => { e.preventDefault(); const form = e.currentTarget; const submit = form.querySelector('button'); submit.disabled = true; clearError('noteError'); try { const snapshot = beginDraftSubmit('noteForm'); await updateMaterial(item, { addNote: snapshot.values.fields.noteText }, 'note', snapshot); await refresh(); toast('备注已保存并回读；初始感受保留。'); } catch (error) { formError('noteError', error); } finally { submit.disabled = false; } });
    bindMedia();
    const missing = item.attachmentIds.filter(id => !state.attachmentInfo.has(id)); if (missing.length) ensureAttachments(missing).then(() => { if (location.hash === matUrl(item.materialId)) { $('materialAttachments').innerHTML = item.attachmentIds.map(id => attachmentCard(id, true)).join(''); bindMedia(); } });
  }
  function renderTopics() {
    document.body.classList.remove('long-reading-page');
    main.innerHTML = `<div class="page-header"><div><span class="eyebrow">需要深入或把多条素材放在一起时</span><h1>研究专题</h1><p class="subtle">问题有自己的停止处；素材继续被其他专题引用。</p></div><a class="secondary-button" href="#collection">从收藏选素材</a></div><form class="topic-filters" id="topicFilterForm"><label for="topicSearch">搜索问题、正文与阶段记录</label><input type="search" id="topicSearch" maxlength="2000"><label for="topicStatus">研究状态</label><select id="topicStatus"><option value="all">全部（不含删除）</option>${Object.entries(topicStates).map(([key, value]) => `<option value="${key}">${value}</option>`).join('')}</select></form><div id="topicRows"></div>`;
    const filter = () => { const q = $('topicSearch').value.trim().toLocaleLowerCase(), status = $('topicStatus').value; const records = state.topics.filter(t => (status === 'all' ? t.status !== 'deleted' : t.status === status) && (!q || JSON.stringify(t).toLocaleLowerCase().includes(q))); $('topicRows').innerHTML = records.map(t => `<article class="topic-list-entry"><div class="page-meta"><span class="pill">${topicStates[t.status]}</span><span class="version">${esc(t.topicId)} · v${t.revision}</span></div><h2><a href="${topUrl(t.topicId)}">${esc(title(t))}</a></h2><p>${esc(t.question || '问题待整理')}</p><span class="subtle small">${t.materialIds.length} 条素材 · ${t.stages.length} 个阶段 · 下一步：${esc(t.stages.at(-1)?.nextStep || '明确关注点后交给 Codex')}</span></article>`).join('') || '<div class="empty-state"><p>还没有这组研究专题。可以从一条已有素材建立，不自动启动研究。</p></div>'; };
    $('topicFilterForm').addEventListener('submit', e => e.preventDefault()); $('topicSearch').addEventListener('input', filter); $('topicStatus').addEventListener('input', filter); filter();
  }
  function renderLegacyStage(stage, t, index) {
    const stale = (stage.materialVersions || []).filter(v => mat(v.materialId)?.revision !== v.revision);
    return `<section class="stage-panel" id="stageSection"><div class="section-heading"><h2>阶段记录 ${index + 1}</h2><span class="version">${esc(stage.stageId)} · 专题 v${stage.topicRevision} · ${esc(date(stage.createdAt))}</span></div>${stale.length ? `<p class="warning-note">本阶段依据的素材已有更新：${stale.map(v => `${esc(v.materialId)}（研究依据 v${v.revision}，当前 v${mat(v.materialId)?.revision ?? '不可读取'}）`).join('；')}。旧成果保留，继续研究前请核对变化。</p>` : ''}<div class="stage-focus"><span>当前关注点</span><p>${esc(stage.focus)}</p></div><div class="stage-columns"><div class="stage-group"><h3><span class="pill confirmed">已确认</span> 已确认内容</h3>${list(stage.confirmed)}</div><div class="stage-group"><h3><span class="pill candidate">候选</span> 仍在探索</h3>${list(stage.candidates, '没有候选方向；不会补成已采用。')}</div></div>${stage.parked?.length ? `<h3>暂时放下</h3>${list(stage.parked)}` : ''}<div class="stage-next"><span>下一步</span><p>${esc(stage.nextStep)}</p></div></section><section class="report-section" id="reportSection"><h2>完整研究成果</h2><p class="report-intro">正文保留完整内容，每段标明依据类型及支持位置。</p>${stage.paragraphs.map(p => `<article class="report-block" id="paragraph-${esc(p.paragraphId)}"><h3>${esc(p.heading || '研究段落')}</h3><span class="pill neutral">${basisKinds[p.basisKind] || '未知'}</span><div class="markdown-content" data-paragraph="${esc(p.paragraphId)}"></div>${p.attachmentIds.map(id => attachmentCard(id)).join('')}<div class="source-refs">${p.sourceRefs.map(ref => `<a href="${topUrl(t.topicId)}/source/${encodeURIComponent(ref.sourceId)}">${esc(ref.locator)} · ${esc(ref.note)}</a>`).join('')}</div></article>`).join('') || '<p class="subtle">本阶段只保存停止处，尚无研究正文。</p>'}</section><section class="source-section" id="sourceSection"><h2>来源与引用位置</h2>${stage.sources.map(s => `<article class="source-entry" id="source-${esc(s.sourceId)}"><h3>${esc(s.title || s.sourceId)}</h3><p>${s.kind === 'external' ? externalLink(s.uri) : s.kind === 'material' ? `<a href="${matUrl(s.materialId)}">原始素材 ${esc(s.materialId)}</a>` : `<a href="${API}/attachments/${encodeURIComponent(s.attachmentId)}/download" download>附件 ${esc(s.attachmentId)}</a>`}</p><p>位置：${esc(s.locator || '见下方段落引用')}</p><p>实际读取范围：${esc(s.verificationScope)} · 查阅：${esc(s.accessedAt || '未注明')}</p><p>许可：${esc(s.licenseStatus || '待核查')}</p><p class="source-linkage">支持段落：${stage.paragraphs.filter(p => p.sourceRefs.some(r => r.sourceId === s.sourceId)).map(p => `<a href="${topUrl(t.topicId)}/paragraph/${encodeURIComponent(p.paragraphId)}">${esc(p.heading || p.paragraphId)}</a>`).join('；')}</p></article>`).join('') || '<p class="subtle">没有列出的来源；不得据此声称已核查外部资料。</p>'}</section><section class="unknown-section" id="unknownSection"><h2>未知、争议与读取限制</h2>${list(stage.unknown)}${stage.limitations?.length ? `<h3>本阶段限制</h3>${list(stage.limitations)}` : ''}</section>`;
  }
  function renderLegacyTopic(t, targetKind, targetId) {
    const index = Math.min(selectedStages.get(t.topicId) ?? t.stages.length - 1, t.stages.length - 1), stage = t.stages[index];
    main.innerHTML = `<div class="breadcrumb"><a href="#collection">收藏</a><span>/</span><a href="#topics">研究专题</a><span>/</span><span>${esc(title(t))}</span></div><div class="topic-top"><div><span class="eyebrow">一个问题，一次推进</span><h1>${esc(title(t))}</h1><div class="page-meta"><span class="pill">${topicStates[t.status]}</span><span class="version">${esc(t.topicId)} · v${t.revision}</span></div></div>${button('handoff-topic', t.topicId, '交给 Codex 继续研究 →', 'primary-button', 'id="handoffButton"')}</div><section class="question-box"><span class="eyebrow">当前问题</span><p>${esc(t.question || '尚未填写。可先保留专题，研究时抓住一个关注点。')}</p>${t.scope ? `<p class="scope">范围：${esc(t.scope)}</p>` : ''}${button('edit-topic', t.topicId, '修改问题 / 范围 / 状态', 'text-button', 'id="editTopic"')}</section><div class="topic-layout"><div class="topic-content">${t.stages.length ? `<label for="stageVersion">查看阶段版本</label><select id="stageVersion">${t.stages.map((s, i) => `<option value="${i}" ${i === index ? 'selected' : ''}>阶段 ${i + 1} · 专题 v${s.topicRevision} · ${esc(date(s.createdAt))}${i === t.stages.length - 1 ? ' · 最新阶段' : ' · 历史保留'}</option>`).reverse().join('')}</select>${renderLegacyStage(stage, t, index)}` : '<section class="topic-start-empty"><h2>问题已留下，尚未启动研究。</h2><p>在 Codex 中明确提出分析或研究后，阶段记录和成果会写回这里。收藏、关联、复制交接都不会调用模型。</p></section>'}<div class="bottom-actions">${button('archive-topic', t.topicId, t.status === 'archived' ? '恢复为问题整理' : '归档专题')}${button(t.status === 'deleted' ? 'restore-topic' : 'delete-topic', t.topicId, t.status === 'deleted' ? '恢复为问题整理' : '可恢复删除专题')}<span class="subtle small">关联素材及附件保留。</span></div></div><aside class="topic-sidebar"><section><h2>关联素材 · ${t.materialIds.length}</h2>${t.materialIds.map(id => { const m = mat(id); return `<div class="linked-material"><a href="${matUrl(id)}">${esc(m ? title(m) : id)}</a><p>${m ? materialStates[m.status] + ' · v' + m.revision : '当前素材不可读取'}</p>${button('unlink', id, '解除专题引用')}</div>`; }).join('')}<label for="linkMaterialSelect">加入已有素材</label><select id="linkMaterialSelect"><option value="">选择素材…</option>${state.materials.filter(m => m.status !== 'deleted' && !t.materialIds.includes(m.materialId)).map(m => `<option value="${esc(m.materialId)}">${esc(title(m))}</option>`).join('')}</select>${button('link', t.topicId, '关联素材', 'secondary-button')}</section><section class="local-section"><h2>本专题</h2><nav class="topic-local-nav"><a href="${topUrl(t.topicId)}/section/stageSection">阶段记录</a><a href="${topUrl(t.topicId)}/section/reportSection">完整成果</a><a href="${topUrl(t.topicId)}/section/sourceSection">来源与引用</a><a href="${topUrl(t.topicId)}/section/unknownSection">未知与限制</a></nav></section><section class="continue-section"><h2>继续探索</h2><p>复制交接，带上当前 ID、版本和停止处。正文从持久化记录读取。</p>${button('handoff-topic', t.topicId, '交给 Codex 继续研究', 'secondary-button handoff-sidebar-button')}${button('export-topic', t.topicId, '导出 Markdown 与附件', 'quiet-button', 'id="exportTopic"')}</section></aside></div>`;
    if (stage) { $('stageVersion').addEventListener('change', () => { selectedStages.set(t.topicId, Number($('stageVersion').value)); renderTopic(t); }); stage.paragraphs.forEach(p => appendMarkdown(main.querySelector(`[data-paragraph="${CSS.escape(p.paragraphId)}"]`), p.markdown)); bindMedia(); const ids = stage.paragraphs.flatMap(p => p.attachmentIds); const missing = ids.filter(id => !state.attachmentInfo.has(id)); if (missing.length) ensureAttachments(missing).then(() => { if (location.hash.startsWith(topUrl(t.topicId))) renderTopic(t, targetKind, targetId); }); }
    if (targetId) { const target = $(targetKind === 'source' ? 'source-' + targetId : targetKind === 'paragraph' ? 'paragraph-' + targetId : targetId); if (target) { target.classList.add('highlight'); target.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }
  }

  function readingParagraph(p, t, intro = false) {
    const refs = p.sourceRefs || [], evidence = `<details class="paragraph-evidence" id="evidence-${esc(p.paragraphId)}" data-reading-disclosure><summary>依据与引用 · ${basisKinds[p.basisKind] || '未知'}${refs.length ? ' · ' + refs.length + ' 处' : ''}</summary><div class="source-refs">${refs.map(ref => `<a href="${topUrl(t.topicId)}/source/${encodeURIComponent(ref.sourceId)}">${esc(ref.locator)} · ${esc(ref.note)}</a>`).join('') || '<span>本段没有来源引用，请结合实际读取范围判断。</span>'}</div></details>`;
    const inlineImages = readingInlineImages(p.markdown);
    return `<article class="${intro ? 'reading-intro' : 'report-block'}" id="paragraph-${esc(p.paragraphId)}"><${intro ? 'h2' : 'h3'}>${esc(p.heading || '研究段落')}</${intro ? 'h2' : 'h3'}><div class="markdown-content" data-paragraph="${esc(p.paragraphId)}"></div>${(p.attachmentIds || []).map(id => attachmentCard(id, false, inlineImages.has(id))).join('')}${evidence}</article>`;
  }
  function readingSources(stage, t) {
    return `<details class="source-section reading-sources" id="sourceSection" data-reading-disclosure><summary>来源与引用位置 · ${stage.sources.length} 条</summary><p class="subtle">展开可查实际读取范围、位置、许可和对应段落；正文中的引用也可直接跳到这里。</p>${stage.sources.map(s => `<article class="source-entry" id="source-${esc(s.sourceId)}"><h3>${esc(s.title || s.sourceId)}</h3><p>${s.kind === 'external' ? externalLink(s.uri) : s.kind === 'material' ? `<a href="${matUrl(s.materialId)}">原始素材 ${esc(s.materialId)}</a>` : `<a href="${API}/attachments/${encodeURIComponent(s.attachmentId)}/download" download>附件 ${esc(s.attachmentId)}</a>`}</p><p>位置：${esc(s.locator || '见下方段落引用')}</p><p>实际读取范围：${esc(s.verificationScope)} · 查阅：${esc(s.accessedAt || '未注明')}</p><p>许可：${esc(s.licenseStatus || '待核查')}</p><p class="source-linkage">支持段落：${stage.paragraphs.filter(p => (p.sourceRefs || []).some(r => r.sourceId === s.sourceId)).map(p => `<a href="${readingProfile(stage)?.kind === 'long' && p === stage.paragraphs[0] ? '#collection' : topUrl(t.topicId) + '/paragraph/' + encodeURIComponent(p.paragraphId)}">${esc(p.heading || p.paragraphId)}</a>`).join('；')}</p></article>`).join('') || '<p class="subtle">没有列出的来源；不得据此声称已核查外部资料。</p>'}</details>`;
  }
  function readingStageRecord(stage, t, index) {
    const stale = (stage.materialVersions || []).filter(v => mat(v.materialId)?.revision !== v.revision);
    return `<details class="stage-panel reading-context" id="stageSection" data-reading-disclosure><summary>研究问题、阶段记录与历史版本</summary><section class="question-box"><span class="eyebrow">当前研究问题</span><p>${esc(t.question || '尚未填写。')}</p>${t.scope ? `<p class="scope">范围：${esc(t.scope)}</p>` : ''}${button('edit-topic', t.topicId, '修改问题 / 范围 / 状态', 'text-button', 'id="editTopic"')}</section><label for="stageVersion">查看阶段版本</label><select id="stageVersion">${t.stages.map((s, i) => `<option value="${i}" ${i === index ? 'selected' : ''}>阶段 ${i + 1} · 专题 v${s.topicRevision} · ${esc(date(s.createdAt))}${i === t.stages.length - 1 ? ' · 最新阶段' : ' · 历史保留'}</option>`).reverse().join('')}</select><div class="section-heading"><h2>阶段记录 ${index + 1}</h2><span class="version">${esc(stage.stageId)} · 专题 v${stage.topicRevision} · ${esc(date(stage.createdAt))}</span></div>${stale.length ? `<p class="warning-note">本阶段依据的素材已有更新：${stale.map(v => `${esc(v.materialId)}（研究依据 v${v.revision}，当前 v${mat(v.materialId)?.revision ?? '不可读取'}）`).join('；')}。旧成果保留，继续研究前请核对变化。</p>` : ''}<div class="stage-focus"><span>当前关注点</span><p>${esc(stage.focus)}</p></div><div class="stage-columns"><div class="stage-group"><h3><span class="pill confirmed">已确认</span> 已确认内容</h3>${list(stage.confirmed)}</div><div class="stage-group"><h3><span class="pill candidate">候选</span> 仍在探索</h3>${list(stage.candidates, '没有候选方向；不会补成已采用。')}</div></div>${stage.parked?.length ? `<h3>暂时放下</h3>${list(stage.parked)}` : ''}<div class="stage-next"><span>下一步</span><p>${esc(stage.nextStep)}</p></div></details>`;
  }
  function renderReadingStage(stage, t, index) {
    const intro = readingIntro(stage);
    const stale = (stage.materialVersions || []).some(v => mat(v.materialId)?.revision !== v.revision);
    return `${readingParagraph(intro, t, true)}${stale ? '<p class="warning-note">这份研究所据素材已有更新。以下保留旧成果；具体版本见下方阶段记录。</p>' : ''}<nav class="reading-nav" aria-label="阅读目录"><a href="${topUrl(t.topicId)}/section/reportSection">原文 / 画面与解读</a><a href="${topUrl(t.topicId)}/section/unknownSection">未核实之处</a><a href="${topUrl(t.topicId)}/section/sourceSection">证据来源</a></nav><section class="report-section" id="reportSection"><h2>原文 / 画面与解读</h2>${stage.paragraphs.slice(1).map(p => readingParagraph(p, t)).join('')}</section><section class="unknown-section" id="unknownSection"><h2>尚未核实与读取限制</h2>${list(stage.unknown)}${stage.limitations?.length ? `<h3>本阶段限制</h3>${list(stage.limitations)}` : ''}</section>${readingStageRecord(stage, t, index)}${readingSources(stage, t)}`;
  }
  function revealReadingTarget(target) {
    for (let element = target; element; element = element.parentElement) if (element.tagName === 'DETAILS') element.open = true;
    target.classList.add('highlight'); target.scrollIntoView({ behavior: 'instant', block: 'start' });
  }

  function longParagraph(p, t, stage, overview = false, hideHeading = false) {
    const images = readingInlineImages(p.markdown), refs = p.sourceRefs || [], kind = basisKinds[p.basisKind] || '未知 / 待核查';
    const heading = p.heading && !hideHeading ? `<h2>${esc(p.heading)}</h2>` : '';
    const references = refs.map(ref => {
      const number = stage.sources.findIndex(source => source.sourceId === ref.sourceId) + 1;
      return `<a href="${topUrl(t.topicId)}/source/${encodeURIComponent(ref.sourceId)}" title="${esc(ref.locator + ' · ' + ref.note)}" aria-label="来源 ${number}：${esc(ref.locator + ' · ' + ref.note)}">[${number}]</a>`;
    }).join(' ');
    return `<section class="${overview ? 'long-overview' : 'long-section'}" id="paragraph-${esc(p.paragraphId)}">${heading}<p class="long-basis">${esc(kind)}</p><div class="markdown-content" data-paragraph="${esc(p.paragraphId)}"></div>${(p.attachmentIds || []).map(id => attachmentCard(id, false, images.has(id))).join('')}${refs.length ? `<p class="long-references">参考 ${references}</p>` : ''}</section>`;
  }
  function renderLongStage(stage, t, index, profile) {
    const stale = (stage.materialVersions || []).some(v => mat(v.materialId)?.revision !== v.revision);
    const sections = partitionLongBody(profile.body);
    return `<article class="long-document" aria-label="素材概要与研究正文">${longParagraph(profile.overview, t, stage, true)}${stale ? '<p class="warning-note">这份研究所据素材已有更新，以下保留旧成果；具体版本见阶段记录。</p>' : ''}<div class="long-report" id="reportSection">${sections.main.map(p => longParagraph(p, t, stage)).join('')}</div><section class="long-boundaries" id="unknownSection"><h2>读取边界与未核实之处</h2>${list(stage.unknown)}${stage.limitations?.length ? `<h3>本阶段限制</h3>${list(stage.limitations)}` : ''}</section>${sections.methods.length ? `<details class="long-methods" id="methodSection" data-reading-disclosure><summary>方法与读取记录</summary>${sections.methods.map((p, i) => longParagraph(p, t, stage, false, i === 0)).join('')}</details>` : ''}</article>${readingStageRecord(stage, t, index)}${readingSources(stage, t)}`;
  }
  function renderLongTopic(t, stage, index, profile, targetKind, targetId) {
    if (main.dataset.readingTopic === t.topicId) readingDisclosures.set(t.topicId, [...main.querySelectorAll('details[data-reading-disclosure][open]')].map(node => node.id));
    main.innerHTML = `<div class="long-reader"><div class="breadcrumb long-breadcrumb"><a href="#collection">← 收藏</a><a href="#topics">研究专题</a></div><header class="long-topic-header"><h1>${esc(title(t))}</h1><div class="page-meta"><span class="pill">${topicStates[t.status]}</span><span class="version">专题 v${t.revision} · 阶段 ${index + 1}${index === t.stages.length - 1 ? ' · 最新' : ' · 历史保留'}</span></div><div class="long-followup">${button('handoff-topic', t.topicId, '继续研究 / 生成交接', 'secondary-button', 'id="handoffButton"')}</div><p class="subtle small">复制到本项目的 Codex 对话，明确说“按交接继续研究”；也可补充本次关注点。新成果保存后，点“重新加载”。</p></header><nav class="long-toc" aria-label="阅读目录"><a href="${topUrl(t.topicId)}/paragraph/${encodeURIComponent(profile.overview.paragraphId)}">内容概要</a><a href="${topUrl(t.topicId)}/section/reportSection">正文</a><a href="${topUrl(t.topicId)}/section/unknownSection">读取边界</a><a href="${topUrl(t.topicId)}/section/sourceSection">证据来源</a></nav>${renderLongStage(stage, t, index, profile)}<details class="long-tools" id="readingTools" data-reading-disclosure><summary>关联素材与后续操作</summary><section><h2>关联素材 · ${t.materialIds.length}</h2>${t.materialIds.map(id => { const m = mat(id); return `<div class="linked-material"><a href="${matUrl(id)}">${esc(m ? title(m) : id)}</a><p>${m ? materialStates[m.status] + ' · v' + m.revision : '当前素材不可读取'}</p>${button('unlink', id, '解除专题引用')}</div>`; }).join('')}<label for="linkMaterialSelect">加入已有素材</label><select id="linkMaterialSelect"><option value="">选择素材…</option>${state.materials.filter(m => m.status !== 'deleted' && !t.materialIds.includes(m.materialId)).map(m => `<option value="${esc(m.materialId)}">${esc(title(m))}</option>`).join('')}</select>${button('link', t.topicId, '关联素材', 'secondary-button')}</section><div class="long-followup">${button('handoff-topic', t.topicId, '交给 Codex 继续研究', 'secondary-button', 'id="handoffFooterButton"')}${button('export-topic', t.topicId, '导出 Markdown 与附件', 'quiet-button', 'id="exportTopic"')}</div><div class="bottom-actions">${button('archive-topic', t.topicId, t.status === 'archived' ? '恢复为问题整理' : '归档专题')}${button(t.status === 'deleted' ? 'restore-topic' : 'delete-topic', t.topicId, t.status === 'deleted' ? '恢复为问题整理' : '可恢复删除专题')}<span class="subtle small">关联素材及附件保留。</span></div></details></div>`;
    main.dataset.readingTopic = t.topicId;
    for (const id of readingDisclosures.get(t.topicId) || []) { const node = $(id); if (node?.tagName === 'DETAILS') node.open = true; }
    $('stageVersion').addEventListener('change', () => { selectedStages.set(t.topicId, Number($('stageVersion').value)); delete main.dataset.readingTopic; renderTopic(t); });
    [profile.overview, ...profile.body].forEach(p => appendMarkdown(main.querySelector(`[data-paragraph="${CSS.escape(p.paragraphId)}"]`), p.markdown));
    bindMedia(); const ids = [...new Set(stage.paragraphs.flatMap(p => [...p.attachmentIds, ...readingInlineImages(p.markdown)]))], missing = ids.filter(id => !state.attachmentInfo.has(id));
    if (missing.length) ensureAttachments(missing).then(() => { if (location.hash.startsWith(topUrl(t.topicId))) renderTopic(t, targetKind, targetId); });
    if (targetId) { const target = $(targetKind === 'source' ? 'source-' + targetId : targetKind === 'paragraph' ? 'paragraph-' + targetId : targetId); if (target) revealReadingTarget(target); }
  }

  function renderTopic(t, targetKind, targetId) {
    const index = Math.min(selectedStages.get(t.topicId) ?? t.stages.length - 1, t.stages.length - 1), stage = t.stages[index];
    const profile = readingProfile(stage);
    document.body.classList.toggle('long-reading-page', profile?.kind === 'long');
    if (profile?.kind === 'long') { renderLongTopic(t, stage, index, profile, targetKind, targetId); return; }
    if (!readingIntro(stage)) { renderLegacyTopic(t, targetKind, targetId); return; }
    const sameTopic = main.dataset.readingTopic === t.topicId;
    if (sameTopic) readingDisclosures.set(t.topicId, [...main.querySelectorAll('details[data-reading-disclosure][open]')].map(node => node.id));
    main.innerHTML = `<div class="breadcrumb"><a href="#collection">收藏</a><span>/</span><a href="#topics">研究专题</a><span>/</span><span>${esc(title(t))}</span></div><div class="topic-top reading-topic-top"><div><h1>${esc(title(t))}</h1><div class="page-meta"><span class="pill">${topicStates[t.status]}</span><span class="version">专题 v${t.revision} · 阶段 ${index + 1}${index === t.stages.length - 1 ? ' · 最新' : ' · 历史保留'}</span></div></div>${button('handoff-topic', t.topicId, '交给 Codex 继续研究 →', 'primary-button', 'id="handoffButton"')}</div><div class="topic-layout reading-layout"><div class="topic-content">${renderReadingStage(stage, t, index)}<div class="bottom-actions">${button('archive-topic', t.topicId, t.status === 'archived' ? '恢复为问题整理' : '归档专题')}${button(t.status === 'deleted' ? 'restore-topic' : 'delete-topic', t.topicId, t.status === 'deleted' ? '恢复为问题整理' : '可恢复删除专题')}<span class="subtle small">关联素材及附件保留。</span></div></div><aside class="topic-sidebar"><section class="local-section"><h2>阅读目录</h2><nav class="topic-local-nav"><a href="${topUrl(t.topicId)}/paragraph/${encodeURIComponent(stage.paragraphs[0].paragraphId)}">简介</a>${stage.paragraphs.slice(1).map(p => `<a href="${topUrl(t.topicId)}/paragraph/${encodeURIComponent(p.paragraphId)}">${esc(p.heading || '研究段落')}</a>`).join('')}<a href="${topUrl(t.topicId)}/section/sourceSection">来源与引用</a><a href="${topUrl(t.topicId)}/section/unknownSection">尚未核实</a><a href="${topUrl(t.topicId)}/section/stageSection">研究问题与阶段</a></nav></section><section><h2>关联素材 · ${t.materialIds.length}</h2>${t.materialIds.map(id => { const m = mat(id); return `<div class="linked-material"><a href="${matUrl(id)}">${esc(m ? title(m) : id)}</a><p>${m ? materialStates[m.status] + ' · v' + m.revision : '当前素材不可读取'}</p>${button('unlink', id, '解除专题引用')}</div>`; }).join('')}<label for="linkMaterialSelect">加入已有素材</label><select id="linkMaterialSelect"><option value="">选择素材…</option>${state.materials.filter(m => m.status !== 'deleted' && !t.materialIds.includes(m.materialId)).map(m => `<option value="${esc(m.materialId)}">${esc(title(m))}</option>`).join('')}</select>${button('link', t.topicId, '关联素材', 'secondary-button')}</section><section class="continue-section"><h2>继续探索</h2><p>保留当前问题、版本和停止处，再继续下一步。</p>${button('handoff-topic', t.topicId, '交给 Codex 继续研究', 'secondary-button handoff-sidebar-button')}${button('export-topic', t.topicId, '导出 Markdown 与附件', 'quiet-button', 'id="exportTopic"')}</section></aside></div>`;
    main.dataset.readingTopic = t.topicId;
    for (const id of readingDisclosures.get(t.topicId) || []) { const node = $(id); if (node?.tagName === 'DETAILS') node.open = true; }
    $('stageVersion').addEventListener('change', () => { selectedStages.set(t.topicId, Number($('stageVersion').value)); delete main.dataset.readingTopic; renderTopic(t); });
    stage.paragraphs.forEach(p => appendMarkdown(main.querySelector(`[data-paragraph="${CSS.escape(p.paragraphId)}"]`), p.markdown));
    bindMedia(); const ids = [...new Set(stage.paragraphs.flatMap(p => [...p.attachmentIds, ...readingInlineImages(p.markdown)]))], missing = ids.filter(id => !state.attachmentInfo.has(id));
    if (missing.length) ensureAttachments(missing).then(() => { if (location.hash.startsWith(topUrl(t.topicId))) renderTopic(t, targetKind, targetId); });
    if (targetId) { const target = $(targetKind === 'source' ? 'source-' + targetId : targetKind === 'paragraph' ? 'paragraph-' + targetId : targetId); if (target) revealReadingTarget(target); }
  }

  // A small Markdown subset built as DOM nodes. Raw HTML remains text; remote images are never fetched.
  function appendMarkdown(container, markdown) {
    const inline = (parent, text) => { const pattern = /(!?\[([^\]]*)\]\(([^)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`)/g; let from = 0, match; while ((match = pattern.exec(text))) { parent.append(document.createTextNode(text.slice(from, match.index))); if (match[4]) { const strong = document.createElement('strong'); strong.textContent = match[4]; parent.append(strong); } else if (match[5]) { const code = document.createElement('code'); code.textContent = match[5]; parent.append(code); } else { const safe = safeUrl(match[3]); if (match[1].startsWith('!')) { const imageId = /^attachment:([A-Za-z0-9_-]+)$/.exec(match[3])?.[1]; if (imageId) { const img = document.createElement('img'); const dimensions = state.attachmentInfo.get(imageId)?.capabilities; if (Number.isFinite(dimensions?.width) && dimensions.width > 0 && Number.isFinite(dimensions?.height) && dimensions.height > 0) { img.width = dimensions.width; img.height = dimensions.height; } img.src = API + '/attachments/' + encodeURIComponent(imageId); img.alt = match[2]; img.loading = 'lazy'; parent.append(img); } else { const note = document.createElement('span'); note.className = 'subtle'; note.textContent = `[外部图片未自动加载：${match[2]}] `; parent.append(note); if (safe) { const link = document.createElement('a'); link.href = safe; link.textContent = '查看来源'; link.target = '_blank'; link.rel = 'noopener noreferrer'; parent.append(link); } } } else if (safe) { const link = document.createElement('a'); link.href = safe; link.textContent = match[2]; link.target = '_blank'; link.rel = 'noopener noreferrer'; parent.append(link); } else parent.append(document.createTextNode(match[1])); } from = pattern.lastIndex; } parent.append(document.createTextNode(text.slice(from))); };
    let codeLines = null, paragraph = [], listElement = null;
    const flush = () => { if (paragraph.length) { const p = document.createElement('p'); inline(p, paragraph.join('\n')); container.append(p); paragraph = []; } listElement = null; };
    for (const line of String(markdown).split('\n')) { if (/^```/.test(line)) { flush(); if (codeLines) { const pre = document.createElement('pre'); pre.textContent = codeLines.join('\n'); container.append(pre); codeLines = null; } else codeLines = []; continue; } if (codeLines) { codeLines.push(line); continue; } const heading = /^(#{1,6})\s+(.+)$/.exec(line), bullet = /^\s*(?:[-*]|\d+\.)\s+(.+)$/.exec(line), quote = /^>\s?(.*)$/.exec(line); if (heading) { flush(); const h = document.createElement('h' + Math.min(6, heading[1].length + 2)); inline(h, heading[2]); container.append(h); } else if (quote) { flush(); const block = document.createElement('blockquote'); inline(block, quote[1]); container.append(block); } else if (bullet) { if (paragraph.length) flush(); if (!listElement) { listElement = document.createElement('ul'); container.append(listElement); } const li = document.createElement('li'); inline(li, bullet[1]); listElement.append(li); } else if (!line.trim()) flush(); else { listElement = null; paragraph.push(line); } } flush(); if (codeLines) { const pre = document.createElement('pre'); pre.textContent = codeLines.join('\n'); container.append(pre); }
  }
  async function updateMaterial(item, patch, key, snapshot) { return write('update-material', { materialId: item.materialId, expectedRevision: snapshot?.ref.context.recordId === item.materialId ? snapshot.ref.context.baseRevision : item.revision, actor: 'user', patch }, key || 'material-' + item.materialId, snapshot); }
  async function updateTopic(t, patch, key, snapshot) { return write('update-topic', { topicId: t.topicId, expectedRevision: snapshot?.ref.context.recordId === t.topicId ? snapshot.ref.context.baseRevision : t.revision, patch }, key || 'topic-' + t.topicId, snapshot); }
  function openAdd() { $('addForm').reset(); clearError('addError'); $('addUploadStatus').textContent = ''; $('duplicateNotice').hidden = true; updateAddKind(); bindDraft('addForm', { kind: 'add', recordId: 'new', baseRevision: 0 }, '收藏素材'); $('addDialog').showModal(); $('addUrl').focus(); }
  function updateAddKind() { const kind = $('addKind').value; $('addUrl').required = false; $('addContent').required = false; $('addFiles').required = false; $('addUrlLabel').hidden = $('addUrl').hidden = ['text', 'recollection', 'attachment'].includes(kind); $('addContentLabel').textContent = kind === 'recollection' ? '凭记忆描述的画面（会标明为用户描述）' : '原始文字 / 说明'; }
  function showDuplicates() { const url = $('addUrl').value.trim(); const same = state.materials.filter(m => m.original.url === url && url); $('duplicateNotice').hidden = !same.length; $('duplicateNotice').textContent = `已有 ${same.length} 条素材使用同一链接。你仍可收藏不同片段或感受，本次保存不会合并旧记录。`; }
  function openResearch(item) {
    selectedMaterial = structuredClone(item); $('researchForm').reset(); clearError('researchError');
    const topics = state.topics.filter(t => !['deleted', 'archived'].includes(t.status));
    const linked = topics.filter(t => t.materialIds.includes(item.materialId));
    const choices = [...linked, ...topics.filter(t => !t.materialIds.includes(item.materialId))];
    $('researchChoice').innerHTML = choices.map(t => `<option value="${esc(t.topicId)}">${t.materialIds.includes(item.materialId) ? '继续已有专题' : '关联已有专题'}：${esc(title(t))}</option>`).join('') + '<option value="new">新建研究专题</option>';
    $('researchChoice').value = linked[0]?.topicId || 'new';
    updateResearchChoice(); bindDraft('researchForm', { kind: 'research', recordId: item.materialId, baseRevision: item.revision }, '研究专题输入'); $('researchDialog').showModal();
  }
  function updateResearchChoice() { const isNew = $('researchChoice').value === 'new'; $('newQuestionFields').hidden = !isNew; $('researchQuestion').required = isNew; }
  function openEdit(item, kind) {
    editKind = kind; clearError('editError'); if (kind === 'material') { selectedMaterial = structuredClone(item); const source = item.source || {}; $('editTitle').textContent = '编辑素材信息'; $('editFields').innerHTML = `<p class="subtle">标题、标签和来源可后补。原始输入保留，来源修正另存历史。</p><label for="editRecordTitle">标题</label><input id="editRecordTitle" maxlength="1000" value="${esc(item.title)}"><label for="editTags">标签</label><input id="editTags" value="${esc(item.tags.join('，'))}"><label for="editSourceTitle">来源名称</label><input id="editSourceTitle" value="${esc(source.title || '')}"><label for="editSourceUri">来源链接</label><input id="editSourceUri" type="url" maxlength="8000" value="${esc(source.uri || '')}"><label for="editSourceAuthor">作者</label><input id="editSourceAuthor" value="${esc(source.author || '')}"><label for="editSourceDate">发布时间</label><input id="editSourceDate" value="${esc(source.publishedAt || '')}"><label for="editSourceLocator">出处位置</label><input id="editSourceLocator" value="${esc(source.locator || '')}">`; }
    else { selectedTopic = structuredClone(item); $('editTitle').textContent = '编辑研究专题'; $('editFields').innerHTML = `<label for="editRecordTitle">标题</label><input id="editRecordTitle" maxlength="1000" value="${esc(item.title)}"><label for="editQuestion">当前问题</label><textarea id="editQuestion" rows="3" maxlength="2000000">${esc(item.question)}</textarea><label for="editScope">研究范围</label><textarea id="editScope" rows="2" maxlength="2000000">${esc(item.scope)}</textarea><label for="editTopicStatus">研究状态</label><select id="editTopicStatus">${Object.entries(topicStates).map(([key, value]) => `<option value="${key}" ${key === item.status ? 'selected' : ''}>${value}</option>`).join('')}</select>`; } bindDraft('editForm', { kind: 'edit-' + kind, recordId: kind === 'material' ? item.materialId : item.topicId, baseRevision: item.revision }, '编辑'); $('editDialog').showModal();
  }
  function openMark(item) { selectedMaterial = structuredClone(item); $('markForm').reset(); clearError('markError'); $('markAttachment').innerHTML = '<option value="">不指定附件</option>' + item.attachmentIds.map(id => `<option value="${esc(id)}">${esc(state.attachmentInfo.get(id)?.record?.originalFilename || id)}</option>`).join(''); updateMarkKind(); bindDraft('markForm', { kind: 'mark', recordId: item.materialId, baseRevision: item.revision }, '关注片段'); $('markDialog').showModal(); }
  function updateMarkKind() { const time = $('markKind').value === 'time'; $('markTimeFields').hidden = !time; $('markStart').required = $('markEnd').required = time; }
  async function openHandoff(kind, id) {
    const result = await request('/handoff?kind=' + kind + '&id=' + encodeURIComponent(id));
    $('handoffText').value = result.text;
    const topic = kind === 'topic' ? top(id) : null;
    const viewedIndex = topic ? (selectedStages.get(id) ?? topic.stages.length - 1) : -1;
    const viewed = topic?.stages[viewedIndex];
    $('handoffContext').textContent = kind === 'topic'
      ? viewed && viewed.stageId !== result.latestStageId
        ? `你正在阅读阶段 ${viewedIndex + 1}。这份交接按最新已保存的专题 v${result.currentRevision} 继续，不会倒退到正在读的历史稿；要讨论旧阶段，请在消息中指出。`
        : `这份交接按专题 v${result.currentRevision} 的最新保存进度继续；旧阶段仍保留。`
      : `这份交接读取素材 v${result.currentRevision}。可独立收藏；深入研究仍需你明确提出。`;
    $('copyStatus').textContent = '已生成最新已保存记录的交接文本，尚未复制或发送。'; $('handoffDialog').showModal();
  }
  async function packageAction(kind, id) { const result = await request('/export', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Observatory-Token': state.token }, body: JSON.stringify({ kind, id }) }); const url = result.downloadUrl || `${API}/downloads/${encodeURIComponent(result.packageId)}?kind=export`; const link = document.createElement('a'); link.href = url; link.download = result.filename || ''; document.body.append(link); link.click(); link.remove(); toast('成果包已生成，浏览器已请求下载。包含完整记录、来源、版本及附件相对引用。'); }
  document.addEventListener('click', async event => {
    const close = event.target.closest('[data-close]'); if (close) { const dialog = $(close.dataset.close), form = dialog.querySelector('form'); if (form) try { persistForm(form.id); renderRecovery(); } catch (e) { toast(errorText(e)); } dialog.close(); return; }
    const el = event.target.closest('[data-action]'); if (!el) return;
    const action = el.dataset.action, id = el.dataset.id, m = mat(id), t = top(id); el.disabled = true;
    try {
      if (action === 'add') openAdd(); else if (action === 'reload') await reload(); else if (action === 'research' && m) openResearch(m); else if (action === 'feeling' && m) openFeeling(m);
      else if (action === 'edit-material') openEdit(m, 'material'); else if (action === 'edit-topic') openEdit(t, 'topic'); else if (action === 'mark') openMark(m);
      else if (['archive', 'delete-material', 'restore-material'].includes(action)) { await updateMaterial(m, { status: action === 'archive' ? m.status === 'archived' ? 'active' : 'archived' : action === 'delete-material' ? 'deleted' : 'active' }); await refresh(); toast('素材状态已保存；专题及附件保留。'); }
      else if (['archive-topic', 'delete-topic', 'restore-topic'].includes(action)) { await updateTopic(t, { status: action === 'archive-topic' ? t.status === 'archived' ? 'draft' : 'archived' : action === 'delete-topic' ? 'deleted' : 'draft' }); await refresh(); toast('专题状态已保存；素材及附件保留。'); }
      else if (action === 'detach') { const item = mat(decode(location.hash.split('/')[1])); const segments = item.segments.map(segment => { if (segment.attachmentId !== id) return segment; const { attachmentId, ...rest } = segment; return rest; }); await updateMaterial(item, { attachmentIds: item.attachmentIds.filter(a => a !== id), segments }); await refresh(); toast('已解除此素材的附件引用。关注说明与原文件保留，其他引用继续可用。'); }
      else if (action === 'append-files') { const item = structuredClone(m), snapshot = beginDraftSubmit('appendForm'), session = draftSessions.get('appendForm'), files = [...$('appendFiles').files], ids = [...session.verifiedAttachments]; if (!files.length && !ids.length) throw { message: '请重选未登记文件，或恢复已核对的登记原件。' }; for (const file of files) ids.push(await upload(file, $('appendUploadStatus'), snapshot.intentId)); if (snapshot.values.files.length > new Set(ids).size) throw { message: '还有未核实原件，请重选原文件，尚未关联。' }; await updateMaterial(item, { attachmentIds: [...new Set([...item.attachmentIds, ...ids])] }, 'append-files', snapshot); await refresh(); toast('附件已校验、关联并回读。'); }
      else if (action === 'remove-mark') { const item = mat(decodeURIComponent(location.hash.split('/')[1])); await updateMaterial(item, { segments: item.segments.filter(s => s.segmentId !== id) }); await refresh(); toast('标记已移除，原始素材保留。'); }
      else if (action === 'link' || action === 'unlink') { const topic = top(decodeURIComponent(location.hash.split('/')[1])); const materialId = action === 'link' ? $('linkMaterialSelect').value : id; if (!materialId) throw { message: '请选择要关联的素材。' }; await updateTopic(topic, { materialIds: action === 'link' ? [...new Set([...topic.materialIds, materialId])] : topic.materialIds.filter(m => m !== materialId) }); await refresh(); toast(action === 'link' ? '已关联同一素材，无需复制原文。' : '已解除专题引用，素材和附件保留。'); }
      else if (action.startsWith('handoff-')) await openHandoff(action.endsWith('topic') ? 'topic' : 'material', id);
      else if (action.startsWith('export-')) await packageAction(action.endsWith('topic') ? 'topic' : 'material', id);
    } catch (e) { toast(errorText(e)); if (action === 'append-files' && $('appendUploadStatus')) $('appendUploadStatus').textContent = errorText(e); } finally { el.disabled = false; }
  });
  $('addKind').addEventListener('change', updateAddKind); $('addUrl').addEventListener('input', showDuplicates);
  $('addForm').addEventListener('submit', async event => {
    event.preventDefault(); $('saveMaterial').disabled = true; clearError('addError');
    try {
      const snapshot = beginDraftSubmit('addForm'), fields = snapshot.values.fields, files = [...$('addFiles').files], session = draftSessions.get('addForm');
      let kind = fields.addKind, url = ['link', 'mixed'].includes(kind) ? fields.addUrl.trim() : '', text = fields.addContent;
      const attachmentIds = [...session.verifiedAttachments];
      if (!url && !text.trim() && !files.length && !attachmentIds.length) throw { message: '至少留下一个链接、一段文字或一个文件。草稿中的未登记文件需要重新选择。' };
      if (url && !safeUrl(url)) throw { code: 'UNSAFE_URI', message: '请输入无账号信息的 http / https 链接。' };
      for (const file of files) attachmentIds.push(await upload(file, $('addUploadStatus'), snapshot.intentId));
      const uniqueIds = [...new Set(attachmentIds)];
      if (snapshot.values.files.length > uniqueIds.length) throw { code: 'FILE_RESELECTION_REQUIRED', message: '仍有未核实或未登记文件，请重选原文件；不会悄悄省略原件。' };
      if (kind === 'link' && !url) kind = text.trim() ? (uniqueIds.length ? 'mixed' : 'text') : 'attachment';
      if (kind === 'attachment' && !uniqueIds.length) kind = text.trim() ? 'text' : 'link';
      if (kind === 'attachment' && files.length === 1 && ['image', 'video'].includes(fileGroup(files[0]))) kind = fileGroup(files[0]);
      if (kind === 'attachment' && uniqueIds.length === 1) { const mime = state.attachmentInfo.get(uniqueIds[0])?.record?.mimeType || ''; if (mime.startsWith('image/')) kind = 'image'; else if (mime.startsWith('video/')) kind = 'video'; }
      const result = await write('create-material', { material: { title: fields.addTitleInput.trim(), original: { kind, text, url }, originalImpression: fields.addFeeling, tags: parseTags(fields.addTags), segments: [], attachmentIds: uniqueIds } }, 'add-material', snapshot);
      $('addDialog').close();
      try { await refresh({ renderPage: false }); go(matUrl(result.receipt.recordId)); toast('素材已保存并回读。后来的未提交输入另作草稿保留；没有建立专题，没有调用模型。'); }
      catch (e) { toast(`素材 ${result.receipt.recordId} 已保存并回读，但页面重载失败：${errorText(e)} 请重新加载，无需重复收藏。`); }
    } catch (e) { formError('addError', e); } finally { $('saveMaterial').disabled = false; renderRecovery(); }
  });
  $('feelingForm').addEventListener('submit', async event => { event.preventDefault(); const button = event.currentTarget.querySelector('[type="submit"]'); button.disabled = true; clearError('feelingError'); try { const item = structuredClone(selectedMaterial), snapshot = beginDraftSubmit('feelingForm'); await updateMaterial(item, { currentImpression: snapshot.values.fields.feelingInput }, 'feeling', snapshot); $('feelingDialog').close(); await refresh(); toast('修正已保存并回读，初始原话与修改前后保留。'); } catch (e) { formError('feelingError', e); } finally { button.disabled = false; } });
  $('researchChoice').addEventListener('change', updateResearchChoice);
  $('researchForm').addEventListener('submit', async event => { event.preventDefault(); $('openResearch').disabled = true; clearError('researchError'); try { const item = structuredClone(selectedMaterial), snapshot = beginDraftSubmit('researchForm'), f = snapshot.values.fields; let id = f.researchChoice; if (id === 'new') { const result = await write('create-topic', { topic: { title: f.researchQuestion.trim().slice(0, 80), question: f.researchQuestion.trim(), scope: f.researchScope, materialIds: [item.materialId] } }, 'new-topic', snapshot); id = result.receipt.recordId; } else { const t = top(id); if (!t) throw { message: '原草稿的专题当前不可读，请重新选择并核对。' }; if (!t.materialIds.includes(item.materialId)) await updateTopic(t, { materialIds: [...t.materialIds, item.materialId] }, 'associate-topic', snapshot); else draftLedger.consume(state.identity, snapshot.ref); } $('researchDialog').close(); await refresh({ renderPage: false }); go(topUrl(id)); toast('专题关系已保存，尚未启动研究。'); } catch (e) { formError('researchError', e); } finally { $('openResearch').disabled = false; renderRecovery(); } });
  $('editForm').addEventListener('submit', async event => { event.preventDefault(); const button = event.currentTarget.querySelector('[type="submit"]'); button.disabled = true; clearError('editError'); try { const item = structuredClone(editKind === 'material' ? selectedMaterial : selectedTopic), kind = editKind, snapshot = beginDraftSubmit('editForm'), f = snapshot.values.fields; if (kind === 'material') {
        const patch = { title: f.editRecordTitle, tags: parseTags(f.editTags) };
        const source = { title: f.editSourceTitle, uri: f.editSourceUri, author: f.editSourceAuthor, publishedAt: f.editSourceDate, locator: f.editSourceLocator };
        if (Object.keys(source).some(key => source[key] !== (item.source?.[key] ?? ''))) patch.source = source;
        await updateMaterial(item, patch, 'edit-material', snapshot);
      } else await updateTopic(item, { title: f.editRecordTitle, question: f.editQuestion, scope: f.editScope, status: f.editTopicStatus }, 'edit-topic', snapshot); $('editDialog').close(); await refresh(); toast('修改已保存并回读。'); } catch (e) { formError('editError', e); } finally { button.disabled = false; } });
  $('markKind').addEventListener('change', updateMarkKind);
  $('markForm').addEventListener('submit', async event => { event.preventDefault(); const button = event.currentTarget.querySelector('[type="submit"]'); button.disabled = true; clearError('markError'); try { const item = structuredClone(selectedMaterial), snapshot = beginDraftSubmit('markForm'), f = snapshot.values.fields, segment = { kind: f.markKind, text: f.markText, note: f.markNote }; if (segment.kind === 'time') { segment.startSeconds = Number(f.markStart); segment.endSeconds = Number(f.markEnd); if (!(segment.endSeconds > segment.startSeconds && segment.startSeconds >= 0)) throw { message: '视频时间需为递增的非负起止秒数。' }; } if (f.markAttachment) segment.attachmentId = f.markAttachment; if (!segment.text.trim() && !segment.note.trim() && segment.kind !== 'time') throw { message: '请写下关注选段或局部说明。' }; await updateMaterial(item, { segments: [...item.segments, segment] }, 'mark', snapshot); $('markDialog').close(); await refresh(); toast('关注片段已保存并回读。'); } catch (e) { formError('markError', e); } finally { button.disabled = false; } });
  $('copyHandoff').addEventListener('click', async () => { let copied = false; try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText($('handoffText').value); copied = true; } } catch {} if (!copied) { $('handoffText').focus(); $('handoffText').select(); } $('copyStatus').textContent = copied ? '已复制交接文本。尚未发送，尚未启动研究。' : '浏览器未允许自动复制。文本已选中，请按 Ctrl+C，或下载文本后复制。'; });
  $('downloadHandoff').addEventListener('click', () => { const url = URL.createObjectURL(new Blob([$ ('handoffText').value], { type: 'text/plain;charset=utf-8' })); const link = document.createElement('a'); link.href = url; link.download = '素材观察室-交接.txt'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); $('copyStatus').textContent = '已请求下载交接文本。未发送或启动研究。'; });
  $('backupButton').addEventListener('click', async () => { $('backupButton').disabled = true; $('backupStatus').textContent = '正在建立一致的数据库快照并校验附件…'; try { const result = await request('/backup', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Observatory-Token': state.token }, body: '{}' }); $('backupStatus').innerHTML = `完整备份已生成：${esc(result.filename)} · ${esc(result.packageId)}。 <a href="${esc(result.downloadUrl || API + '/downloads/' + encodeURIComponent(result.packageId) + '?kind=backup')}" download>下载备份包</a>`; } catch (e) { $('backupStatus').textContent = errorText(e); } finally { $('backupButton').disabled = false; } });
  $('reloadRecords').addEventListener('click', reload); window.addEventListener('hashchange', render);
  boot();
})();
