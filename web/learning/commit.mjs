import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { LearningRepository, LEARNING_ROOT, SUMMARY_FILES, assertLearningRoot, safeLearningPath, readLearningFile, validId, validNoteId, noteIdForRequest, entryIdForRequest, learningError, hashText, normalizeTask, encodeTaskMetadata, encodeSourceMetadata, encodeArtifactMetadata, encodeNoteMetadata, encodeEntryMetadata } from './records.mjs';
import { validateUpdates } from './protocol.mjs';
import { hasNoSaveIntent } from './save-intent.mjs';

const JOURNAL_DIR = '运行记录/.学习提交';
const stable = value => Array.isArray(value) ? '[' + value.map(stable).join(',') + ']' : value && typeof value === 'object' ? '{' + Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => JSON.stringify(key) + ':' + stable(value[key])).join(',') + '}' : JSON.stringify(value);
export const requestFingerprint = payload => hashText(stable({ message: payload.message, mode: payload.mode, skipSave: !!payload.skipSave, history: payload.history ?? [], context: payload.context ?? null, expectedRecordVersion: payload.expectedRecordVersion ?? null }));
const sha = text => text === null ? null : hashText(text);
const quote = value => String(value ?? '').replace(/\r\n/g, '\n').split('\n').map(line => '> ' + line).join('\n');
const inline = (value, max = 1000) => String(value ?? '').replace(/[\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const cell = value => inline(value, 5000).replace(/\|/g, '\\|');
const hasNoSave = hasNoSaveIntent;
export function normalizeLearningNote(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !['noteId', 'title', 'courseId', 'chapter', 'occurredOn', 'action'].includes(key))) throw learningError('LEARNING_INVALID_NOTE', '学习笔记参数包含不支持的字段。');
  if (value.noteId !== undefined && !validNoteId(value.noteId)) throw learningError('LEARNING_INVALID_NOTE', '学习笔记编号无效。');
  if (value.title !== undefined && (typeof value.title !== 'string' || !value.title.trim() || value.title.length > 1000)) throw learningError('LEARNING_INVALID_NOTE', '学习笔记标题无效。');
  if (value.courseId !== undefined && value.courseId !== null && !/^C\d{3,8}$/.test(value.courseId)) throw learningError('LEARNING_INVALID_NOTE', '笔记课程身份无效。');
  if (value.chapter !== undefined && value.chapter !== null && (!Number.isSafeInteger(value.chapter) || value.chapter < 1 || value.chapter > 200)) throw learningError('LEARNING_INVALID_NOTE', '笔记课次须为1至200或未知。');
  if (value.occurredOn !== undefined && value.occurredOn !== null && (typeof value.occurredOn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.occurredOn) || !Number.isFinite(Date.parse(value.occurredOn + 'T00:00:00Z')) || new Date(value.occurredOn + 'T00:00:00Z').toISOString().slice(0, 10) !== value.occurredOn)) throw learningError('LEARNING_INVALID_NOTE', '笔记发生日期无效。');
  if (value.action !== undefined && !['append', 'correct'].includes(value.action)) throw learningError('LEARNING_INVALID_NOTE', '学习笔记只支持追加或更正。');
  if (value.action === 'correct' && !value.noteId) throw learningError('LEARNING_INVALID_NOTE', '更正笔记须指定已核对的原编号。');
  return { ...structuredClone(value), action: value.action ?? 'append' };
}
function stamp(now) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  return { date: parts.year + '-' + parts.month + '-' + parts.day, time: parts.hour + ':' + parts.minute, iso: now.toISOString() };
}
function replaceBullet(markdown, field, value) {
  const expression = new RegExp('(^- ' + field + '：)[^\\r\\n]*(\\r?\\n|$)', 'm');
  if (!expression.test(markdown)) throw learningError('LEARNING_STATE_FIELD_MISSING', '当前状态缺少「' + field + '」栏位', { relative: '运行记录/当前状态.md', originalText: markdown, field });
  return markdown.replace(expression, (_, prefix, end) => prefix + inline(value, 2000) + end);
}
function replaceSection(markdown, heading, body) {
  const expression = new RegExp('(^## ' + heading + '\\r?\\n)([\\s\\S]*?)(?=^## |$(?![\\s\\S]))', 'm');
  if (!expression.test(markdown)) throw learningError('LEARNING_STAGE_FIELD_MISSING', '阶段安排缺少「' + heading + '」章节', { relative: '运行记录/阶段安排.md', originalText: markdown, heading });
  return markdown.replace(expression, (_, prefix) => prefix + '\n' + body.trim() + '\n\n');
}
function appendSection(markdown, heading, body) {
  if (!new RegExp('^## ' + heading + '\\r?$', 'm').test(markdown)) return markdown.trimEnd() + '\n\n## ' + heading + '\n\n' + body + '\n';
  const expression = new RegExp('(^## ' + heading + '\\r?\\n)([\\s\\S]*?)(?=^## |$(?![\\s\\S]))', 'm');
  return markdown.replace(expression, (_, prefix, existing) => prefix + existing.trimEnd() + '\n\n' + body + '\n\n');
}
function methodSection(markdown) { return /^## 已采用的改进\r?\n([\s\S]*?)(?=^## |$(?![\s\S]))/m.exec(markdown); }
function methodBlocks(markdown) {
  const section = methodSection(markdown); if (!section) return [];
  const result = [];
  for (const match of section[1].matchAll(/<!-- learning-method:start id=([a-f0-9]{64}) -->([\s\S]*?)<!-- learning-method:end id=\1 -->/g)) {
    const encoded = match[2].match(/<!-- learning-method:v1 ([A-Za-z0-9+/=]+) -->/), block = { id: match[1], full: match[0], data: null };
    try {
      const data = JSON.parse(Buffer.from(encoded?.[1] ?? '', 'base64').toString('utf8'));
      if (data.version === 1 && data.methodId === block.id && typeof data.value === 'string' && (data.taskId === null || validId(data.taskId))) block.data = data;
    } catch {}
    result.push(block);
  }
  return result;
}
function methodMetadata(data) { return '<!-- learning-method:v1 ' + Buffer.from(JSON.stringify(data), 'utf8').toString('base64') + ' -->'; }
function setMethodBullet(block, label, value) {
  const line = '- ' + label + '：' + inline(value, 5000), expression = new RegExp('^- ' + label + '：[^\\r\\n]*', 'm');
  if (expression.test(block)) return block.replace(expression, () => line);
  return block.replace('<!-- learning-method:v1 ', line + '\n<!-- learning-method:v1 ');
}
function replaceMethodBlock(markdown, block, updated) {
  // Restrict replacements to the single adopted-method section; quoted old
  // plans elsewhere in the file are historical evidence, not current items.
  const section = methodSection(markdown);
  if (!section) return markdown;
  const changed = section[0].replace(block.full, () => updated);
  return markdown.slice(0, section.index) + changed + markdown.slice(section.index + section[0].length);
}
function updateAdoptedMethods(markdown, { changes, task, previousTask, date, payload, observations, kind }, warnings) {
  let result = markdown;
  const currentTask = task ?? previousTask, taskId = currentTask?.taskId ?? null;
  const activity = '[' + date.date + ' 活动](学习记录/' + date.date + '.md)（请求 ' + payload.requestId + '）';
  for (const change of changes.filter(change => change.kind === 'method')) {
    const methodId = hashText(JSON.stringify([taskId, change.value]));
    const existing = methodBlocks(result).find(block => block.id === methodId);
    if (existing && !existing.data) { warnings.push('已有采用方法块元数据不完整，保留原内容；本次采用原话已留活动。'); continue; }
    if (existing) {
      let updated = setMethodBullet(existing.full, '最近一次明确采用', inline(change.quote) + '；' + activity);
      const data = { ...existing.data, latestAdoptionDate: date.iso, latestAdoptionRequestId: payload.requestId };
      updated = updated.replace(/<!-- learning-method:v1 [A-Za-z0-9+/=]+ -->/, () => methodMetadata(data));
      result = replaceMethodBlock(result, existing, updated);
    } else {
      const data = { version: 1, methodId, taskId, value: change.value, firstQuote: change.quote, firstDate: date.iso, firstActivity: '运行记录/学习记录/' + date.date + '.md', firstRequestId: payload.requestId, firstGoalRevision: currentTask?.goalRevision ?? null };
      const block = '<!-- learning-method:start id=' + methodId + ' -->\n### 已采用做法 · ' + inline(change.value, 180) + '\n\n- 首次采用原话：' + inline(change.quote, 5000) + '\n- 首次采用依据：' + activity + '\n- 适用情境：' + (currentTask ? inline(currentTask.title + '；任务 ' + taskId + '，目标版本 ' + currentTask.goalRevision) : '未绑定具体任务，适用范围尚待实际交流说明') + '\n- 原观察点：' + inline(currentTask?.observationPoints?.join('；') || '尚未说明，不补造观察标准') + '\n- 初次帮助条件：' + inline(currentTask?.allowedHelp || '帮助程度未记录') + '\n- 当前状态：已采用，待尝试；实际使用情况及效果未知。\n- 使用与效果：方法效果与因果未知，不认证普遍有效。\n' + methodMetadata(data) + '\n<!-- learning-method:end id=' + methodId + ' -->';
      result = appendSection(result, '已采用的改进', block);
    }
  }
  const feedbackNode = ['progress', 'review'].includes(kind), message = payload.message?.trim() ?? '';
  const requestOnly = /^(?:请|帮我|给我|能否|能不能)?(?:看看|分析|复盘|评价|检查|整理|回顾)(?:一下)?(?:这段|这块|我的文字|文字)?[。！？!?\s]*$/.test(message);
  if (taskId && feedbackNode && message && (!requestOnly || observations.length)) {
    for (const block of methodBlocks(result).filter(block => block.data?.taskId === taskId)) {
      let updated = setMethodBullet(block.full, '最近收到的本人反馈', requestOnly ? '未提供方法使用反馈；本次原话：' + message : message + '（本人报告；没有据此推断实际采用了本条方法）');
      updated = setMethodBullet(updated, '最近AI局部观察', observations.length ? observations.map(observation => observation.text).join('；') + '；仅针对本次可见文字' : '本次没有新增可核验的局部表现判断');
      updated = setMethodBullet(updated, '本次帮助条件', observations.length ? [...new Set(observations.map(observation => observation.helpLevel))].join('；') : currentTask.allowedHelp || '帮助程度未记录');
      updated = setMethodBullet(updated, '最近反馈来源', activity);
      updated = setMethodBullet(updated, '使用与效果', '实际使用本条方法的情况未独立核验；方法效果与因果未知，不把本次变化推为普遍有效');
      const data = { ...block.data, latestFeedbackDate: date.iso, latestFeedbackRequestId: payload.requestId, latestFeedbackGoalRevision: currentTask.goalRevision };
      updated = updated.replace(/<!-- learning-method:v1 [A-Za-z0-9+/=]+ -->/, () => methodMetadata(data));
      result = replaceMethodBlock(result, block, updated);
    }
  }
  return result;
}
const planScope = message => /本月|这个月|下个月|未来(?:一|1)个月|阶段安排|阶段计划/.test(message) ? '月或阶段' : /本周|这周|下周|这一周|一周安排|一周计划/.test(message) ? '本周' : '当次或当天';
const isTarget = relative => SUMMARY_FILES.includes(relative) || /^运行记录\/学习记录\/\d{4}-\d{2}-\d{2}\.md$/.test(relative);
function onlyHeaderRepair(before, after, failure) {
  if (typeof before !== 'string' || typeof after !== 'string') return false;
  const oldLines = before.split(/\r?\n/), newLines = after.split(/\r?\n/);
  if (failure.field && newLines.length === oldLines.length + 1) {
    const compatibleFields = ['系统内当次课程学习或练习记录', '最近真实学习记录'].includes(failure.field) ? ['系统内当次课程学习或练习记录', '最近真实学习记录'] : [failure.field];
    const matching = newLines.map((line, index) => compatibleFields.some(field => line.startsWith('- ' + field + '：')) ? index : -1).filter(index => index >= 0);
    return matching.length === 1 && newLines.filter((_, index) => index !== matching[0]).join('\n') === oldLines.join('\n');
  }
  if (oldLines.length !== newLines.length) return false;
  const changed = oldLines.map((line, index) => line === newLines[index] ? -1 : index).filter(index => index >= 0);
  if (changed.length !== 1) return false;
  const index = changed[0];
  if (failure.heading) return oldLines[index].startsWith('## ') && newLines[index] === '## ' + failure.heading;
  if (failure.field) {
    const old = oldLines[index].match(/^- [^：]+：(.*)$/), repaired = newLines[index].match(new RegExp('^- ' + failure.field + '：(.*)$'));
    return !!old && !!repaired && old[1] === repaired[1];
  }
  return false;
}

export class LearningCommitter {
  constructor({ projectRoot = LEARNING_ROOT, scope = 'production', repository = null, faultInjector = null, now = () => new Date() } = {}) {
    this.root = assertLearningRoot(projectRoot, scope); this.scope = scope; this.repository = repository ?? new LearningRepository({ projectRoot, scope }); this.faultInjector = faultInjector; this.now = now;
    if (this.repository.root !== this.root || this.repository.scope !== this.scope) throw learningError('LEARNING_IDENTITY_MISMATCH', '学习读取与写入身份不同。');
  }
  async lookup(requestId) { return this.repository.findRequest(requestId); }
  async #fault(point, journal) { if (this.faultInjector) await this.faultInjector(point, structuredClone(journal)); }
  async #journalWrite(journal) {
    const file = await safeLearningPath(this.root, JOURNAL_DIR + '/' + journal.requestId + '.json');
    await this.#atomic(file, JSON.stringify(journal));
  }
  async #atomic(file, text) {
    const temporary = file + '.' + randomUUID() + '.tmp'; let handle;
    try {
      handle = await fs.open(temporary, 'wx'); await handle.writeFile(text, 'utf8'); await handle.sync(); await handle.close(); handle = null;
      await fs.rename(temporary, file);
      if (await fs.readFile(file, 'utf8') !== text) throw learningError('LEARNING_WRITE_UNVERIFIED', '写入后回读不一致，保留提交ID核对。');
    } finally { await handle?.close(); await fs.unlink(temporary).catch(() => {}); }
  }
  async #locked(work) {
    const lease = await this.#acquireLock('.lock', { timeoutMs: 2000 });
    try { return await work(); } finally { await lease.release(); }
  }
  async #acquireLock(name, { requestId = null, requestHash = null, timeoutMs = 2000, cachedResult = null } = {}) {
    const dir = await safeLearningPath(this.root, JOURNAL_DIR); await fs.mkdir(dir, { recursive: true }); await safeLearningPath(this.root, JOURNAL_DIR);
    const relative = JOURNAL_DIR + '/' + name, lock = await safeLearningPath(this.root, relative), token = randomUUID(), ownerName = '.owner_' + token + '.tmp', ownerFile = await safeLearningPath(this.root, JOURNAL_DIR + '/' + ownerName);
    const owner = JSON.stringify({ version: 1, pid: process.pid, token, requestId, requestHash, ownerName, createdAt: new Date().toISOString() }), deadline = Date.now() + timeoutMs;
    let handle, published = false;
    try {
      // Publish an already complete owner inode. open(lock,'wx') followed by
      // write leaves an unrecoverable empty-lock window if the process dies.
      handle = await fs.open(ownerFile, 'wx'); await handle.writeFile(owner); await handle.sync(); await handle.close(); handle = null;
      await this.#fault('before_lock_publish:' + name, { requestId, requestHash, token });
      while (!published) {
        try { await fs.link(ownerFile, lock); published = true; }
        catch (error) {
          if (error.code !== 'EEXIST') throw learningError('LEARNING_LOCK_PUBLISH_FAILED', '无法原子发布完整锁持有者；需要本机支持文件硬链接，未退回空锁写法。', { cause: error.code });
          if (await this.#recoverDeadLock(lock, { requestId, requestHash })) continue;
          if (cachedResult) { const cached = await cachedResult(); if (cached) return { cached, release: async () => {} }; }
          if (Date.now() > deadline) throw learningError(requestId ? 'LEARNING_MODEL_BUSY' : 'LEARNING_COMMIT_BUSY', requestId ? '同一学习请求仍在生成，保留原提交ID稍后核对。' : '学习记录正被另一进程保存，保留原提交ID后重试。');
          await new Promise(resolve => setTimeout(resolve, requestId ? 50 : 30));
        }
      }
      await this.#fault('after_lock_publish:' + name, { requestId, requestHash, token });
      return { release: async () => { try { if (await fs.readFile(lock, 'utf8') === owner) await fs.unlink(lock); } catch {} await fs.unlink(ownerFile).catch(() => {}); } };
    } catch (error) {
      if (published) { try { if (await fs.readFile(lock, 'utf8') === owner) await fs.unlink(lock); } catch {} }
      throw error;
    } finally {
      await handle?.close();
      if (!published) await fs.unlink(ownerFile).catch(() => {});
    }
  }
  async #recoverDeadLock(lock, { requestId = null, requestHash = null } = {}) {
    let before, raw, owner;
    try { before = await fs.lstat(lock); } catch (error) { if (error.code === 'ENOENT') return true; throw error; }
    if (!before.isFile() || before.isSymbolicLink() || before.size > 4096) throw learningError('LEARNING_UNSAFE_LOCK', '学习锁不是安全的普通持有者文件，保留原件。');
    try { raw = await fs.readFile(lock, 'utf8'); owner = JSON.parse(raw); }
    catch {
      if (Date.now() - before.mtimeMs < 1000) return false;
      throw learningError('LEARNING_LOCK_OWNER_UNKNOWN', '旧学习锁为空或持有者记录损坏，无法确认进程是否退出；保留原件，须先核对锁持有者。');
    }
    if (!Number.isSafeInteger(owner.pid) || owner.pid < 1 || typeof (owner.token ?? owner.nonce) !== 'string') throw learningError('LEARNING_LOCK_OWNER_UNKNOWN', '旧学习锁缺少可核对的进程与token，保留原件。');
    if (requestId && (owner.requestId !== requestId || owner.requestHash !== requestHash)) throw learningError('LEARNING_REQUEST_CONFLICT', '同一请求生成锁绑定不同内容或学习对象。');
    try { process.kill(owner.pid, 0); return false; } catch (error) { if (error.code !== 'ESRCH') return false; }
    const after = await fs.lstat(lock).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
    if (!after) return true;
    if (before.ino !== after.ino || before.mtimeMs !== after.mtimeMs || before.size !== after.size || raw !== await fs.readFile(lock, 'utf8')) return false;
    await fs.unlink(lock);
    if (typeof owner.ownerName === 'string' && /^\.owner_[a-f0-9-]{36}\.tmp$/.test(owner.ownerName)) {
      const oldOwner = await safeLearningPath(this.root, JOURNAL_DIR + '/' + owner.ownerName);
      try { if (await fs.readFile(oldOwner, 'utf8') === raw) await fs.unlink(oldOwner); } catch {}
    }
    return true;
  }
  async withModelLease(payload, kind, callback) {
    if (typeof callback !== 'function') throw learningError('LEARNING_INVALID_CALLBACK', '模型生成协调需要回调函数。');
    if (hasNoSave(payload) || !kind || kind === 'none') return callback(null);
    if (!validId(payload?.requestId)) throw learningError('LEARNING_INVALID_REQUEST', 'requestId无效。');
    const cached = async () => { const journal = await this.lookup(payload.requestId); if (journal) this.#check(journal, payload); return journal; };
    const existing = await cached(); if (existing) return callback(existing);
    const lease = await this.#acquireLock(payload.requestId + '.model.lock', { requestId: payload.requestId, requestHash: requestFingerprint(payload), timeoutMs: 120000, cachedResult: cached });
    try { return await callback(lease.cached ?? await cached()); }
    finally { await lease.release(); }
  }
  #noSave() { return { saved: false, saveReceipt: { status: 'not_requested', persisted: false, files: [] }, warnings: [] }; }
  #check(journal, payload, note, kind) {
    if (journal.requestHash !== requestFingerprint(payload)) throw learningError('LEARNING_REQUEST_CONFLICT', '同一 requestId 对应了不同内容、历史或学习对象。');
    if (kind !== undefined && (journal.kind === 'note' || kind === 'note') && (journal.kind !== kind || stable(journal.note) !== stable(note))) throw learningError('LEARNING_REQUEST_CONFLICT', '同一 requestId 对应了不同笔记身份或保存参数。');
  }
  async recordModelResult({ payload, reply, updates = null, structured = false, contextSnapshot = {}, kind, sourceCoverage = [], note: suppliedNote }) {
    if (!validId(payload?.requestId)) throw learningError('LEARNING_INVALID_REQUEST', 'requestId无效。');
    if (hasNoSave(payload) || !kind || kind === 'none') return null;
    const note = kind === 'note' ? normalizeLearningNote(suppliedNote) : undefined;
    if (kind === 'note' && (typeof payload.message !== 'string' || !payload.message.trim() || payload.message.length > 16000 || typeof reply !== 'string' || reply.length > 24000)) throw learningError('LEARNING_INVALID_NOTE', '笔记须保留不超过16000字符的原话及不超过24000字符的AI回应。');
    return this.#locked(async () => {
      const existing = await this.lookup(payload.requestId);
      if (existing) { this.#check(existing, payload, note, kind); return existing; }
      const journal = { version: 1, requestId: payload.requestId, requestHash: requestFingerprint(payload), projectRoot: this.root, scope: this.scope, status: 'model_complete', createdAt: stamp(this.now()).iso, payload, reply: String(reply ?? ''), updates: structured ? updates : null, structured: !!structured, contextSnapshot, kind, sourceCoverage, targets: [], warnings: [] };
      if (note) journal.note = note;
      await this.#journalWrite(journal); await this.#fault('after_model_result', journal); return journal;
    });
  }
  async save(input) {
    const { payload, task = null } = input;
    if (hasNoSave(payload) || !input.kind || input.kind === 'none') return this.#noSave();
    await this.recordModelResult(input);
    return this.#locked(async () => {
      const journal = await this.lookup(payload.requestId); this.#check(journal, payload);
      if (journal.status === 'committed') return journal.result;
      if (journal.status === 'needs_review') return this.#failed(journal);
      if (!journal.targets.length) {
        try { await this.#prepare(journal, task); }
        catch (error) {
          journal.status = error.code === 'LEARNING_WRITE_CONFLICT' ? 'needs_review' : journal.targets.length ? 'interrupted' : 'preparation_failed'; journal.error = error.message; journal.errorCode = error.code;
          if (['LEARNING_STATE_FIELD_MISSING', 'LEARNING_STAGE_FIELD_MISSING'].includes(error.code)) journal.preparationFailure = { ...error.details, code: error.code };
          await this.#journalWrite(journal);
          return this.#failed(journal);
        }
      }
      try { return await this.#apply(journal); }
      catch (error) {
        journal.status = error.code === 'LEARNING_WRITE_CONFLICT' ? 'needs_review' : 'interrupted'; journal.error = error.message; journal.errorCode = error.code; await this.#journalWrite(journal);
        return this.#failed(journal);
      }
    });
  }
  async #failed(journal) {
    const files = [];
    for (const target of journal.targets) { try { if (target.applied || sha(await readLearningFile(this.root, target.relative)) === target.newHash) files.push(target.relative); } catch {} }
    const checked = journal.errorCode === 'LEARNING_STATE_FIELD_MISSING';
    return { saved: false, task: null, warnings: journal.warnings ?? [], saveError: checked ? '当前状态检查未通过，本次尚未执行写入。' + journal.error : (files.length ? '可能有部分写入：' + files.join('、') + '。' : '保存准备未完成。') + (journal.error ?? '') + ' 重试相同 requestId 可继续核对修复；冲突不会覆盖。', saveReceipt: { requestId: journal.requestId, requestHash: journal.requestHash, status: journal.status, persisted: false, files, error: journal.error } };
  }
  async #prepare(journal, suppliedTask) {
    const snapshot = await this.repository.snapshot({ taskId: suppliedTask?.taskId ?? journal.payload.context?.taskId ?? null });
    if (snapshot.pendingCommits.some(other => other.requestId !== journal.requestId && other.hasPreparedTargets)) throw learningError('LEARNING_WRITE_CONFLICT', '存在另一笔未完成多文件提交，先核对恢复，未继续改写学习摘要。');
    const oldHashes = journal.contextSnapshot?.fileHashes ?? journal.contextSnapshot?.snapshot?.fileHashes;
    let repairedRelative = null;
    if (journal.status === 'preparation_failed' && !journal.structured && !journal.targets.length && journal.preparationFailure) {
      const failure = journal.preparationFailure, latest = await readLearningFile(this.root, failure.relative);
      if (onlyHeaderRepair(failure.originalText, latest, failure)) repairedRelative = failure.relative;
    }
    if (oldHashes && Object.entries(oldHashes).some(([relative, expected]) => isTarget(relative) && relative !== repairedRelative && snapshot.fileHashes[relative] !== expected)) {
      throw learningError('LEARNING_WRITE_CONFLICT', '生成期间相关学习记录已经变化，答复保留，请读取最新状态后再决定本次更新。');
    }
    if (journal.payload.expectedRecordVersion && journal.payload.expectedRecordVersion !== snapshot.recordVersion && !repairedRelative) throw learningError('LEARNING_WRITE_CONFLICT', '学习记录版本已变化，旧更新未写入。');
    // A note records only the supplied words and response. Even hostile or
    // over-eager model updates cannot change a task, course ledger or summary.
    if (journal.kind === 'note') return this.#prepareNote(journal, snapshot);
    if (repairedRelative) journal.warnings.push('已核对仅栏目名称修复，重用原始答复完成同一请求；未重放结构化事实。');
    const p = journal.payload, date = stamp(new Date(journal.createdAt)), relative = '运行记录/学习记录/' + date.date + '.md';
    const previous = suppliedTask?.taskId ? snapshot.tasks.find(task => task.taskId === suppliedTask.taskId) ?? suppliedTask : p.context?.taskId ? snapshot.currentTask : null;
    const coverage = Array.isArray(journal.sourceCoverage) ? journal.sourceCoverage : journal.sourceCoverage?.sources ?? journal.sourceCoverage?.items ?? [];
    const validated = journal.structured ? validateUpdates(journal.updates, { payload: p, task: previous, sources: { sources: coverage, courses: snapshot.courses } }) : { updates: null, warnings: [] };
    const u = validated.updates; journal.warnings.push(...validated.warnings);
    if (!u) journal.structured = false;
    const current = await readLearningFile(this.root, '运行记录/当前状态.md', { optional: false });
    // Validate the current-state shape before any business write. Other target
    // preparation can fail without leaving a partial Markdown transaction.
    replaceBullet(current, '当前停止处', '检查'); replaceBullet(current, '下次入口', '检查');
    if (journal.kind === 'plan') replaceBullet(current, '有效安排', '检查');
    if (journal.kind === 'progress') replaceBullet(current, /^- 系统内当次课程学习或练习记录：/m.test(current) ? '系统内当次课程学习或练习记录' : '最近真实学习记录', '检查');
    let nextTask = null;
    if (u && u.saveReason !== 'none' && (u.task || previous)) {
      const fields = u.task ?? {}, goal = (u.adoptedChanges ?? []).find(change => change.kind === 'goal');
      const courseId = previous?.courseId ?? (snapshot.courses.some(c => c.courseId === fields.courseId) ? fields.courseId : null);
      nextTask = { taskId: previous?.taskId ?? 'task_' + randomUUID(), goalRevision: (previous?.goalRevision ?? 1) + (previous && goal && goal.value !== previous.purpose ? 1 : 0), title: fields.title || previous?.title || snapshot.courses.find(c => c.courseId === courseId)?.name || inline(p.message, 80), purpose: goal?.value ?? previous?.purpose ?? fields.purpose ?? '', courseId, allowedHelp: fields.allowedHelp ?? previous?.allowedHelp ?? '帮助程度未记录', observationPoints: fields.observationPoints ?? previous?.observationPoints ?? [], knownPerformance: (u.observations ?? []).length ? u.observations.map(o => o.text).join('；') : previous?.knownPerformance ?? '', stopPoint: fields.stopPoint ?? previous?.stopPoint ?? '', nextStep: u.nextStep ?? fields.nextStep ?? previous?.nextStep ?? '', status: fields.status ?? (journal.kind === 'plan' ? 'planned' : journal.kind === 'wrap' ? 'paused' : previous?.status ?? 'active'), evidenceRefs: [...new Set([...(previous?.evidenceRefs ?? []), ...(fields.evidenceRefs ?? []), ...(u.observations ?? []).flatMap(o => o.evidenceIds), ...coverage.map(source => source?.id ?? source?.sourceId ?? source?.evidenceId).filter(id => typeof id === 'string')])].slice(-100), candidates: [...new Set([...(previous?.candidates ?? []), ...(fields.candidates ?? []), ...(u.candidates ?? [])])], updatedAt: date.iso, lastRequestId: p.requestId };
      if (!normalizeTask(nextTask)) throw learningError('LEARNING_INVALID_TASK', '受限任务更新没有形成合法任务，未写入。');
    }
    const hash = journal.requestHash, title = { plan: '待执行安排', progress: '学习进展', wrap: '自然收尾', review: '学习复盘' }[journal.kind] ?? '交流依据';
    const meaning = journal.kind === 'plan' ? '小陌明确请求制定的计划，尚未报告执行。' : journal.kind === 'progress' ? '仅记录小陌本次自述；完成、理解与独立掌握仍需分别判断。' : '本次自然收尾或复盘；没有报告的学习内容与效果保持未知。';
    let activity = '\n<!-- learning-entry:start id=' + p.requestId + ' hash=' + hash + ' mode=' + journal.kind + ' -->\n### ' + date.time + ' ' + title + '\n\n- 记录性质：' + meaning + '\n- 小陌本次原话：\n' + quote(p.message) + '\n- AI 当次回应（建议与解释，不是本人原话）：\n' + quote(journal.reply) + '\n';
    if (journal.kind === 'wrap') {
      const history = (p.history ?? []).filter(turn => turn.role === 'user').slice(-2);
      if (history.length) activity += '- 请求附带历史中的小陌原话摘录（时间未核验；仅为对话线索）：\n' + history.map(turn => quote(turn.content.slice(0, 300))).join('\n') + '\n';
    }
    const suppliedArtifact = p.context?.artifact;
    if (suppliedArtifact && typeof suppliedArtifact.text === 'string' && suppliedArtifact.text.trim() && suppliedArtifact.text.length <= 16000) {
      const artifact = { kind: typeof suppliedArtifact.kind === 'string' ? suppliedArtifact.kind : 'text', text: suppliedArtifact.text, title: typeof suppliedArtifact.title === 'string' ? suppliedArtifact.title : '本次提供的原始文字', version: suppliedArtifact.version ?? null, authorship: typeof suppliedArtifact.authorship === 'string' ? suppliedArtifact.authorship : 'user_provided', origin: typeof suppliedArtifact.origin === 'string' ? suppliedArtifact.origin : typeof suppliedArtifact.authorship === 'string' ? suppliedArtifact.authorship : 'user_provided', helpLevel: typeof suppliedArtifact.helpLevel === 'string' ? suppliedArtifact.helpLevel : '帮助程度未记录，不推断独立完成' };
      const expectedId = 'user-text:' + hashText(artifact.text).slice(0, 20), actualSource = coverage.find(source => source?.id === expectedId && (source.sourceKind ?? source.kind) === 'user_text');
      activity += '- 本次提供的原始文字产物：' + inline(artifact.title, 300) + '；作者/来源：' + inline(artifact.authorship) + ' / ' + inline(artifact.origin) + '；帮助条件：' + inline(artifact.helpLevel) + '\n' + quote(artifact.text) + '\n';
      const artifactTaskId = nextTask?.taskId ?? previous?.taskId ?? null;
      if (actualSource && artifactTaskId) activity += encodeArtifactMetadata({ version: 1, taskId: artifactTaskId, id: expectedId, artifact, sourcePath: relative, activityFile: relative, sourceRequestId: p.requestId }) + '\n';
      else journal.warnings.push('原始文字已完整保存在活动；未取得同任务的实际文字来源身份，未登记可自动恢复的产物引用。');
    }
    if (!journal.structured) activity += '- 更新限制：结构更新不可用；未据模型回复改写课程、观影或任务台账。\n';
    for (const fact of u?.facts ?? []) activity += '- 本人报告（' + fact.kind + (fact.courseId ? '，' + fact.courseId : '') + '；' + fact.turnId + '）：' + inline(fact.quote, 5000) + '\n';
    for (const observation of u?.observations ?? []) activity += '- AI 对当前文字的观察：' + inline(observation.text, 5000) + '；依据：' + observation.evidenceIds.join('、') + '；帮助条件：' + inline(observation.helpLevel) + '。不认证全部能力。\n';
    for (const candidate of u?.candidates ?? []) activity += '- 未采用候选：' + inline(candidate) + '\n';
    for (const change of u?.adoptedChanges ?? []) activity += '- 用户明确采用（' + change.kind + '）：' + inline(change.value) + '；采用原话：' + inline(change.quote) + '\n';
    if (nextTask) activity += '- 当前任务目标 v' + nextTask.goalRevision + '：' + inline(nextTask.purpose) + '\n- 停止处：' + inline(nextTask.stopPoint || '未说明') + '\n- 下次一步：' + inline(nextTask.nextStep || '下次按本人意图决定') + '\n' + encodeTaskMetadata(nextTask) + '\n';
    activity += encodeEntryMetadata({ version: 1, sourceRequestId: p.requestId, activityFile: relative, taskId: nextTask?.taskId ?? previous?.taskId ?? null, courseId: p.context?.courseId ?? nextTask?.courseId ?? previous?.courseId ?? null, chapter: p.context?.chapter ?? null, savedAt: date.iso }) + '\n' + encodeSourceMetadata(journal.sourceCoverage) + '\n<!-- learning-entry:end id=' + p.requestId + ' -->\n<!-- learning-entry:complete id=' + p.requestId + ' -->\n';
    const oldActivity = await readLearningFile(this.root, relative), targets = [{ relative, before: oldActivity, after: (oldActivity ?? '# 学习记录 · ' + date.date + '\n') + activity }];
    if (u?.facts?.some(f => f.kind === 'course_progress')) {
      const rel = '运行记录/课程记录.md', before = await readLearningFile(this.root, rel, { optional: false }); let after = before;
      for (const fact of u.facts.filter(f => f.kind === 'course_progress')) {
        if (!snapshot.courses.some(course => course.courseId === fact.courseId)) { journal.warnings.push('课程已不可用，未改课程台账：' + fact.courseId); continue; }
        after = after.split(/\r?\n/).map(line => {
          if (!new RegExp('^\\|\\s*' + fact.courseId + '\\s*\\|').test(line)) return line;
          const cells = line.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map(c => c.trim());
          if (cells.length < 5) return line;
          cells[2] = '本人自述：' + cell(fact.quote); cells[3] = nextTask?.stopPoint ? cell(nextTask.stopPoint) + '；未确定部分保留原记录：' + cells[3] : cells[3];
          cells[4] = '[' + date.date + ' 原话依据](学习记录/' + date.date + '.md)（请求 ' + p.requestId + '）'; return '| ' + cells.join(' | ') + ' |';
        }).join(before.includes('\r\n') ? '\r\n' : '\n');
      }
      if (after !== before) targets.push({ relative: rel, before, after });
    }
    // Viewing facts have no frozen viewingId/name field. Preserve their verbatim
    // report in the activity, rather than guessing a matching film or new row.
    if (u?.facts?.some(f => f.kind === 'viewing')) journal.warnings.push('观看原话已保存；缺少稳定作品身份，未自动改观影表。');
    if (journal.kind === 'plan') {
      const rel = '运行记录/阶段安排.md', before = await readLearningFile(this.root, rel, { optional: false }), scope = planScope(p.message);
      const oldSection = before.match(new RegExp('^## ' + scope + '\\r?\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))', 'm'))?.[1]?.trim();
      if (oldSection) targets[0].after = targets[0].after.replace('<!-- learning-entry:end', '\n- 被替换的既有安排（调整前保留）：\n' + quote(oldSection) + '\n<!-- learning-entry:end');
      const body = '**待执行（' + date.date + '，小陌明确请求制定）**。对应学习记录：[' + date.date + '](学习记录/' + date.date + '.md)。\n\n- 本次需求：' + inline(p.message, 150) + '\n\n' + quote(journal.reply) + (nextTask ? '\n\n- 任务：' + nextTask.taskId + '；目标版本：' + nextTask.goalRevision : '');
      targets.push({ relative: rel, before, after: replaceSection(before, scope, body) });
    }
    if ((u?.adoptedChanges ?? []).some(change => change.kind === 'method') || (nextTask && ['progress', 'review'].includes(journal.kind))) {
      const rel = '运行记录/阶段安排.md', existing = targets.find(t => t.relative === rel), before = existing?.before ?? await readLearningFile(this.root, rel, { optional: false });
      const base = existing?.after ?? before;
      const after = updateAdoptedMethods(base, { changes: u?.adoptedChanges ?? [], task: nextTask, previousTask: previous, date, payload: p, observations: u?.observations ?? [], kind: journal.kind }, journal.warnings);
      if (existing) existing.after = after; else if (after !== before) targets.push({ relative: rel, before, after });
    }
    if (u?.observations?.length) {
      const rel = '运行记录/能力依据.md', before = await readLearningFile(this.root, rel, { optional: false });
      const body = '### ' + date.date + ' 当前文字表现' + (nextTask ? ' · ' + inline(nextTask.title) : '') + '\n\n' + u.observations.map(o => '- AI 观察：' + inline(o.text) + '\n  - 原始依据：[' + date.date + ' 活动](学习记录/' + date.date + '.md)；证据ID：' + o.evidenceIds.join('、') + '\n  - 帮助条件：' + inline(o.helpLevel) + '；只针对本次文字范围，不据此认证全面能力。').join('\n');
      const base = before.replace(/^目前尚无实际学习或练习证据，/m, '当前已记录下列具体文字表现，');
      targets.push({ relative: rel, before, after: appendSection(base, '已记录的局部观察', body) });
    }
    let afterState = current.replace(/^更新日期：[^\r\n]*/m, '更新日期：' + date.date + '。');
    if (u?.facts?.some(fact => fact.kind === 'course_progress') && /^- 当前在学：/m.test(afterState)) {
      const report = u.facts.filter(fact => fact.kind === 'course_progress').map(fact => fact.courseId + '：' + fact.quote).join('；');
      afterState = replaceBullet(afterState, '当前在学', date.date + ' 本人报告：' + report + '；其余课程与不确定处见[课程记录](课程记录.md)，未据此认证能力或改变阶段主攻。');
    }
    if (u?.observations?.length && /^- 能力依据：/m.test(afterState)) afterState = replaceBullet(afterState, '能力依据', '[能力依据](能力依据.md)已记录本次可见文字的局部AI观察；帮助条件与限制见原始活动，不据此认证全面掌握。');
    if (journal.kind === 'plan') {
      afterState = replaceBullet(afterState, '有效安排', '[阶段安排](阶段安排.md)，' + date.date + ' 制定的' + planScope(p.message) + '安排待执行。');
      afterState = replaceBullet(afterState, '当前停止处', nextTask?.stopPoint || '已制定' + planScope(p.message) + '安排，尚未报告执行。');
      afterState = replaceBullet(afterState, '下次入口', nextTask?.nextStep || '从待执行的' + planScope(p.message) + '安排开始；先按实际时间和状态调整。');
    } else if (nextTask) {
      if (journal.kind === 'progress') afterState = replaceBullet(afterState, /^- 系统内当次课程学习或练习记录：/m.test(current) ? '系统内当次课程学习或练习记录' : '最近真实学习记录', '[' + date.date + ' 学习记录](学习记录/' + date.date + '.md)；内容包含小陌自述，能力判断仅据本次可见文字。');
      afterState = replaceBullet(afterState, '当前停止处', nextTask.stopPoint || '本次停止处未明确；见原话记录。');
      afterState = replaceBullet(afterState, '下次入口', (nextTask.nextStep || '具体下一步待小陌下次意图确定。') + '；任务 ' + nextTask.taskId + '，依据 [' + date.date + '](学习记录/' + date.date + '.md)。');
    } else if (!journal.structured) {
      // Keep legacy explicit modes compatible, while preserving the existing
      // task's actual resume point when there is one.
      if (journal.kind === 'progress') afterState = replaceBullet(afterState, /^- 系统内当次课程学习或练习记录：/m.test(current) ? '系统内当次课程学习或练习记录' : '最近真实学习记录', '[' + date.date + ' 学习记录](学习记录/' + date.date + '.md)；内容仅为小陌自述，尚未据此认定能力。');
      if (!previous) {
        afterState = replaceBullet(afterState, '当前停止处', (journal.kind === 'wrap' ? '小陌表示本次收尾：' : '小陌报告的进展：') + inline(p.message, 130) + '。');
        afterState = replaceBullet(afterState, '下次入口', '从[' + date.date + ' 的记录](学习记录/' + date.date + '.md)接续；时间和具体下一步以小陌下次意图为准。');
      }
    }
    if (afterState !== current) targets.push({ relative: '运行记录/当前状态.md', before: current, after: afterState });
    journal.targets = targets.map(target => ({ ...target, oldHash: sha(target.before), newHash: sha(target.after), applied: false })); journal.task = nextTask; journal.status = 'prepared'; journal.error = null; journal.errorCode = null;
    await this.#journalWrite(journal); await this.#fault('after_prepare', journal);
  }
  async #prepareNote(journal, snapshot) {
    const input = normalizeLearningNote(journal.note), p = journal.payload;
    const noteId = input.noteId ?? noteIdForRequest(p.requestId), previous = snapshot.notes.find(note => note.noteId === noteId);
    if (input.noteId && !previous) throw learningError('LEARNING_NOTE_NOT_FOUND', '原学习笔记不存在或未通过校验，未新建替代条目。');
    const value = key => Object.hasOwn(input, key) ? input[key] : previous?.[key] ?? null;
    const courseId = value('courseId');
    if (courseId !== null && !snapshot.courses.some(course => course.courseId === courseId)) throw learningError('LEARNING_COURSE_UNAVAILABLE', '笔记引用的课程未在当前课程记录中核对到。');
    const date = stamp(new Date(journal.createdAt)), relative = '运行记录/学习记录/' + date.date + '.md';
    const event = { schemaVersion: 1, noteId, version: (previous?.version ?? 0) + 1, title: input.title ?? previous?.title ?? '学习笔记', body: p.message, aiText: journal.reply, courseId, chapter: value('chapter'), occurredOn: value('occurredOn'), savedAt: date.iso, sourceRequestId: p.requestId, activityFile: relative, action: input.action };
    const body = previous && event.action === 'append' ? previous.body + '\n\n' + event.body : event.body;
    const aiText = previous && event.action === 'append' ? [previous.aiText, event.aiText].filter(Boolean).join('\n\n') : event.aiText;
    journal.savedNote = { id: noteId, noteId, title: event.title, body, aiText, courseId, chapter: event.chapter, occurredOn: event.occurredOn, updatedAt: event.savedAt, sourceRequestId: p.requestId, activityFile: relative, version: event.version, history: [...(previous?.history ?? []), event] };
    const activity = '\n<!-- learning-entry:start id=' + p.requestId + ' hash=' + journal.requestHash + ' mode=note -->\n### ' + date.time + ' 学习笔记 · ' + inline(event.title, 1000) + '\n\n- 记录性质：本人留下的学习笔记，不据此创建任务、认证掌握或改变学习安排。\n- 笔记编号：' + noteId + '；版本：' + event.version + '；动作：' + event.action + '\n- 课程：' + (courseId ?? '未指定') + '；课次：' + (event.chapter ?? '未知') + '\n- 发生日期：' + (event.occurredOn ?? '未知') + '\n- 保存时间：' + event.savedAt + '\n- 小陌本次原话：\n' + quote(event.body) + '\n- AI 当次回应（建议与解释，不是本人原话）：\n' + quote(event.aiText) + '\n' + encodeNoteMetadata(event) + '\n<!-- learning-entry:end id=' + p.requestId + ' -->\n<!-- learning-entry:complete id=' + p.requestId + ' -->\n';
    const before = await readLearningFile(this.root, relative), after = (before ?? '# 学习记录 · ' + date.date + '\n') + activity;
    if (Buffer.byteLength(after, 'utf8') > 8 * 1024 * 1024) throw learningError('LEARNING_TOO_LARGE', '当天学习记录达到读取上限，原话尚未保存，请保留原稿。');
    journal.targets = [{ relative, before, after, oldHash: sha(before), newHash: sha(after), applied: false }];
    journal.task = null; journal.status = 'prepared'; journal.error = null; journal.errorCode = null;
    await this.#journalWrite(journal); await this.#fault('after_prepare', journal);
  }
  async #apply(journal) {
    for (const target of journal.targets) {
      if (!isTarget(target.relative) || target.newHash !== sha(target.after) || target.oldHash !== sha(target.before)) throw learningError('LEARNING_INVALID_JOURNAL', '提交目标或内容hash无效。');
      const current = await readLearningFile(this.root, target.relative), hash = sha(current);
      if (hash === target.newHash) { target.applied = true; continue; }
      if (hash !== target.oldHash) throw learningError('LEARNING_WRITE_CONFLICT', target.relative + '出现其他修改，停止覆盖。');
      journal.status = 'committing'; await this.#journalWrite(journal); await this.#fault('before_write:' + target.relative, journal);
      const file = await safeLearningPath(this.root, target.relative); await fs.mkdir(path.dirname(file), { recursive: true }); await safeLearningPath(this.root, target.relative);
      // Recheck after preparation and injected waits, immediately before rename.
      if (sha(await readLearningFile(this.root, target.relative)) !== target.oldHash) throw learningError('LEARNING_WRITE_CONFLICT', target.relative + '已变化，停止覆盖。');
      await this.#atomic(file, target.after); await this.#fault('after_write:' + target.relative, journal); target.applied = true; await this.#journalWrite(journal);
    }
    for (const target of journal.targets) if (sha(await readLearningFile(this.root, target.relative)) !== target.newHash) throw learningError('LEARNING_WRITE_CONFLICT', '提交末尾回读不符，未报告全部保存。');
    const snapshot = await this.repository.snapshot({ taskId: journal.task?.taskId ?? null });
    const stateRaw = await readLearningFile(this.root, '运行记录/当前状态.md'), field = name => stateRaw?.match(new RegExp('^- ' + name + '：([^\\r\\n]*)', 'm'))?.[1] ?? '';
    const state = { focus: field('阶段主攻'), nextStep: field('下次入口'), lastActivity: field('系统内当次课程学习或练习记录') || field('最近真实学习记录'), planStatus: field('有效安排') };
    const result = { saved: true, state, task: journal.task ?? null, resumePoint: journal.task ? { taskId: journal.task.taskId, courseId: journal.task.courseId, stopPoint: journal.task.stopPoint, nextStep: journal.task.nextStep } : null, saveReceipt: { requestId: journal.requestId, requestHash: journal.requestHash, status: 'committed', persisted: true, files: journal.targets.map(target => target.relative), verifiedHashes: Object.fromEntries(journal.targets.map(target => [target.relative, target.newHash])) }, warnings: journal.warnings, recordVersion: snapshot.recordVersion };
    result.entryId = entryIdForRequest(journal.requestId);
    if (journal.kind === 'note') { result.noteId = journal.savedNote.noteId; result.note = journal.savedNote; result.saveReceipt.kind = 'note'; result.saveReceipt.noteId = result.noteId; }
    journal.status = 'committed'; journal.result = result; journal.error = null; await this.#journalWrite(journal); await this.#fault('after_commit', journal); return result;
  }
  async recover() {
    const dir = await safeLearningPath(this.root, JOURNAL_DIR); let names;
    try { names = await fs.readdir(dir); } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
    const results = [];
    for (const name of names.filter(name => /^[A-Za-z0-9_-]{8,128}\.json$/.test(name)).sort()) {
      const journal = await this.lookup(name.slice(0, -5));
      if (['prepared', 'committing', 'interrupted'].includes(journal.status) && journal.targets.length) {
        results.push(await this.#locked(async () => {
          const latest = await this.lookup(journal.requestId);
          if (latest.status === 'committed') return latest.result;
          try { return await this.#apply(latest); }
          catch (error) { latest.status = 'needs_review'; latest.error = error.message; latest.errorCode = error.code; await this.#journalWrite(latest); return this.#failed(latest); }
        }));
      } else if (journal.status !== 'committed') results.push({ requestId: journal.requestId, status: journal.status, saved: false });
    }
    return results;
  }
}
