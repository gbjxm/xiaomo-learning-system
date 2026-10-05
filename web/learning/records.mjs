import fs from 'node:fs/promises';
import fss from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

export const LEARNING_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const SUMMARY_FILES = ['个人情况.md', '当前状态.md', '阶段安排.md', '课程记录.md', '观影记录.md', '能力依据.md'].map(name => '运行记录/' + name);
export const TASK_FIELDS = ['taskId', 'goalRevision', 'title', 'purpose', 'courseId', 'allowedHelp', 'observationPoints', 'knownPerformance', 'stopPoint', 'nextStep', 'status', 'evidenceRefs', 'candidates', 'updatedAt', 'lastRequestId'];
export const hashText = text => createHash('sha256').update(text).digest('hex');
const same = (a, b) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
const within = (child, parent) => { const rel = path.relative(parent, child); return !!rel && rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel); };
export const validId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{8,128}$/.test(value);
export const validNoteId = value => typeof value === 'string' && /^note_[a-f0-9]{24}$/.test(value);
export const noteIdForRequest = requestId => 'note_' + hashText(requestId).slice(0, 24);
export const entryIdForRequest = requestId => 'entry_' + hashText(requestId).slice(0, 24);
const calendarDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value + 'T00:00:00Z')) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
export function learningError(code, message, details = {}) { const error = new Error(message); error.code = code; error.details = details; return error; }

export function assertLearningRoot(projectRoot, scope = 'production') {
  if (typeof projectRoot !== 'string' || !path.isAbsolute(projectRoot) || /^\\\\/.test(projectRoot) || projectRoot.slice(2).includes(':')) throw learningError('LEARNING_INVALID_ROOT', '学习记录须使用本机绝对项目路径。');
  const requested = path.resolve(projectRoot);
  if (!fss.existsSync(requested)) throw learningError('LEARNING_UNSAFE_PATH', '项目目录不存在，拒绝读写。');
  // Windows may expose the configured temp root with an 8.3 spelling. Accept
  // that spelling only after rejecting actual reparse points in its ancestry.
  let cursor = path.parse(requested).root;
  for (const part of path.relative(cursor, requested).split(path.sep).filter(Boolean)) { cursor = path.join(cursor, part); if (fss.lstatSync(cursor).isSymbolicLink()) throw learningError('LEARNING_UNSAFE_PATH', '项目目录包含重定向，拒绝读写。'); }
  const root = fss.realpathSync.native(requested), tempRoot = fss.realpathSync.native(os.tmpdir());
  if (scope === 'production') {
    if (!same(root, LEARNING_ROOT)) throw learningError('LEARNING_INVALID_SCOPE', '正式学习记录只能使用本项目固定目录。');
  } else if (scope !== 'isolated' || same(root, LEARNING_ROOT) || !(within(root, tempRoot) || within(root, path.join(LEARNING_ROOT, '验证')))) {
    throw learningError('LEARNING_INVALID_SCOPE', '隔离学习记录须在系统临时目录或本项目验证副本中，不能使用正式根。');
  }
  return root;
}

export async function safeLearningPath(root, relative) {
  if (typeof relative !== 'string' || relative.includes('\\') || relative.includes('\0') || relative.includes(':') || path.isAbsolute(relative) || relative.split('/').some(p => !p || p === '..' || p === '.')) throw learningError('LEARNING_UNSAFE_PATH', '学习记录相对路径无效。');
  const target = path.resolve(root, relative);
  if (!within(target, root)) throw learningError('LEARNING_UNSAFE_PATH', '学习记录路径越出项目。');
  let current = root;
  for (const part of relative.split('/')) {
    current = path.join(current, part);
    try {
      const stat = await fs.lstat(current);
      if (stat.isSymbolicLink() || !same(await fs.realpath(current), current)) throw learningError('LEARNING_UNSAFE_PATH', '学习路径包含符号链接或目录重定向。');
    } catch (error) { if (error.code === 'ENOENT') break; throw error; }
  }
  return target;
}

export async function readLearningFile(root, relative, { optional = true, maxBytes = 8 * 1024 * 1024 } = {}) {
  const file = await safeLearningPath(root, relative);
  try {
    const stat = await fs.stat(file);
    if (!stat.isFile() || stat.size > maxBytes) throw learningError('LEARNING_FILE_INVALID', '学习文件非普通文件或超过读取上限。', { relative });
    return await fs.readFile(file, 'utf8');
  } catch (error) { if (optional && error.code === 'ENOENT') return null; throw error; }
}

export function normalizeTask(value) {
  if (!value || Array.isArray(value) || typeof value !== 'object' || !validId(value.taskId) || !Number.isSafeInteger(value.goalRevision) || value.goalRevision < 1) return null;
  const result = {};
  for (const key of TASK_FIELDS) {
    if (['observationPoints', 'evidenceRefs', 'candidates'].includes(key)) {
      if (!Array.isArray(value[key]) || value[key].length > 100 || value[key].some(v => typeof v !== 'string' || v.length > 8000)) return null;
      result[key] = [...value[key]];
    } else if (key === 'goalRevision') result[key] = value[key];
    else if (key === 'courseId') {
      if (value[key] !== null && (typeof value[key] !== 'string' || !/^C\d{3,8}$/.test(value[key]))) return null;
      result[key] = value[key];
    } else {
      if (typeof value[key] !== 'string' || value[key].length > 16000) return null;
      result[key] = value[key];
    }
  }
  if (!validId(result.lastRequestId) || !Number.isFinite(Date.parse(result.updatedAt))) return null;
  return result;
}

export function encodeTaskMetadata(task) {
  const normalized = normalizeTask(task);
  if (!normalized) throw learningError('LEARNING_INVALID_TASK', '任务元数据不符合学习任务结构。');
  return '<!-- learning-task:v1 ' + Buffer.from(JSON.stringify(normalized), 'utf8').toString('base64') + ' -->';
}
export function encodeSourceMetadata(coverage) { return '<!-- learning-sources:v1 ' + Buffer.from(JSON.stringify(coverage ?? []), 'utf8').toString('base64') + ' -->'; }
export function encodeArtifactMetadata(value) { return '<!-- learning-artifact:v1 ' + Buffer.from(JSON.stringify(value), 'utf8').toString('base64') + ' -->'; }
export function encodeNoteMetadata(value) { return '<!-- learning-note:v1 ' + Buffer.from(JSON.stringify(value), 'utf8').toString('base64') + ' -->'; }
export function encodeEntryMetadata(value) { return '<!-- learning-activity:v1 ' + Buffer.from(JSON.stringify(value), 'utf8').toString('base64') + ' -->'; }
function normalizeNoteEvent(value, activityFile, requestId) {
  if (!value || value.schemaVersion !== 1 || !validNoteId(value.noteId) || !Number.isSafeInteger(value.version) || value.version < 1 || value.sourceRequestId !== requestId || !validId(requestId) || value.activityFile !== activityFile || !['append', 'correct'].includes(value.action)) return null;
  for (const [key, max] of [['title', 1000], ['body', 16000], ['aiText', 24000]]) if (typeof value[key] !== 'string' || value[key].length > max || key === 'body' && !value[key].trim()) return null;
  if (value.courseId !== null && !/^C\d{3,8}$/.test(value.courseId ?? '')) return null;
  if (value.chapter !== null && (!Number.isSafeInteger(value.chapter) || value.chapter < 1 || value.chapter > 200)) return null;
  if (value.occurredOn !== null && !calendarDate(value.occurredOn)) return null;
  if (typeof value.savedAt !== 'string' || !Number.isFinite(Date.parse(value.savedAt))) return null;
  return Object.fromEntries(['schemaVersion', 'noteId', 'version', 'title', 'body', 'aiText', 'courseId', 'chapter', 'occurredOn', 'savedAt', 'sourceRequestId', 'activityFile', 'action'].map(key => [key, value[key]]));
}
function mergeNote(previous, event) {
  const history = [...(previous?.history ?? []), event];
  return { id: event.noteId, noteId: event.noteId, title: event.title, body: previous && event.action === 'append' ? previous.body + '\n\n' + event.body : event.body, aiText: previous && event.action === 'append' ? [previous.aiText, event.aiText].filter(Boolean).join('\n\n') : event.aiText, courseId: event.courseId, chapter: event.chapter, occurredOn: event.occurredOn, updatedAt: event.savedAt, sourceRequestId: event.sourceRequestId, activityFile: event.activityFile, version: event.version, history };
}
function quotedSection(block, label) {
  const lines = block.split(/\r?\n/), start = lines.findIndex(line => line === label);
  if (start < 0) return '';
  const result = [];
  for (const line of lines.slice(start + 1)) { if (!line.startsWith('> ')) break; result.push(line.slice(2)); }
  return result.join('\n');
}
function activityEntry(block, { requestId, mode, activityFile, line, journal }) {
  const encoded = block.match(/^<!-- learning-activity:v1 ([A-Za-z0-9+/=]+) -->$/m), metadata = encoded ? decode(encoded[1]) : null;
  const body = quotedSection(block, '- 小陌本次原话：');
  const aiText = quotedSection(block, '- AI 当次回应（建议与解释，不是本人原话）：') || block.match(/^- AI 当次回应要点（模型建议，节选）：([^\r\n]*)/m)?.[1] || '';
  const task = [...block.matchAll(/^<!-- learning-task:v1 ([A-Za-z0-9+/=]+) -->$/gm)].map(match => normalizeTask(decode(match[1]))).find(Boolean);
  const checked = metadata?.version === 1 && metadata.sourceRequestId === requestId && metadata.activityFile === activityFile;
  return { id: entryIdForRequest(requestId), entryId: entryIdForRequest(requestId), title: block.match(/^### [^\r\n]*/m)?.[0].replace(/^###\s*/, '') || '学习交流', body, aiText, aiTextCoverage: quotedSection(block, '- AI 当次回应（建议与解释，不是本人原话）：') ? 'full' : 'excerpt', mode, taskId: task?.taskId ?? (checked && validId(metadata.taskId) ? metadata.taskId : null), courseId: task?.courseId ?? (checked && /^C\d{3,8}$/.test(metadata.courseId ?? '') ? metadata.courseId : null), chapter: checked && Number.isSafeInteger(metadata.chapter) ? metadata.chapter : null, occurredOn: null, updatedAt: checked && Number.isFinite(Date.parse(metadata.savedAt)) ? metadata.savedAt : journal?.createdAt ?? null, sourceRequestId: requestId, activityFile, activityLine: line, readOnly: true };
}
function decode(base64) { try { if (base64.length > 256000) return null; return JSON.parse(Buffer.from(base64, 'base64').toString('utf8')); } catch { return null; } }
function normalizeArtifactMetadata(value, activityFile) {
  if (!value || value.version !== 1 || !validId(value.taskId) || !validId(value.sourceRequestId) || value.activityFile !== activityFile || value.sourcePath !== activityFile) return null;
  const artifact = value.artifact;
  if (!artifact || Array.isArray(artifact) || typeof artifact !== 'object' || typeof artifact.text !== 'string' || !artifact.text.trim() || artifact.text.length > 16000 || value.id !== 'user-text:' + hashText(artifact.text).slice(0, 20)) return null;
  for (const name of ['kind', 'title', 'authorship', 'origin', 'helpLevel']) if (typeof artifact[name] !== 'string' || artifact[name].length > 2000) return null;
  if (artifact.version !== null && !(typeof artifact.version === 'string' && artifact.version.length <= 500) && !(typeof artifact.version === 'number' && Number.isFinite(artifact.version))) return null;
  return { version: 1, taskId: value.taskId, id: value.id, artifact: Object.fromEntries(['kind', 'text', 'title', 'version', 'authorship', 'origin', 'helpLevel'].map(name => [name, artifact[name]])), sourcePath: activityFile, activityFile, sourceRequestId: value.sourceRequestId };
}
function withoutFencedExamples(markdown) {
  let fence = null;
  return markdown.split(/\r?\n/).map(line => {
    const marker = /^ {0,3}(`{3,}|~{3,})([^\r\n]*)$/.exec(line);
    if (fence) {
      if (marker && marker[1][0] === fence.character && marker[1].length >= fence.length && !marker[2].trim()) fence = null;
      return '';
    }
    if (marker) { fence = { character: marker[1][0], length: marker[1].length }; return ''; }
    return line;
  }).join('\n');
}

function tableCells(line) {
  if (!line.trim().startsWith('|')) return null;
  return line.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map(cell => cell.trim().replace(/\\\|/g, '|'));
}
export function parseCourses(markdown = '') {
  const courses = [];
  for (const line of markdown.split(/\r?\n/)) {
    const cells = tableCells(line);
    if (!cells || cells.length < 5 || !/^C\d{3,8}$/.test(cells[0])) continue;
    courses.push({ courseId: cells[0], name: cells[1], reportedProgress: cells[2], resumePoint: cells[3], sourceBindingStatus: 'unverified', island: /分镜|镜头|摄影|视觉/.test(cells[1]) ? 'visual' : /剪辑|音效|后期/.test(cells[1]) ? 'post' : /编剧|故事|叙事/.test(cells[1]) ? 'story' : 'home' });
  }
  return courses;
}

export class LearningRepository {
  constructor({ projectRoot = LEARNING_ROOT, scope = 'production' } = {}) { this.root = assertLearningRoot(projectRoot, scope); this.scope = scope; }
  async findRequest(requestId) {
    if (!validId(requestId)) throw learningError('LEARNING_INVALID_REQUEST', 'requestId无效。');
    const raw = await readLearningFile(this.root, '运行记录/.学习提交/' + requestId + '.json');
    if (raw === null) return null;
    try {
      const record = JSON.parse(raw);
      if (record.requestId !== requestId || record.projectRoot !== this.root || record.scope !== this.scope || record.version !== 1) throw new Error();
      return record;
    } catch { throw learningError('LEARNING_INVALID_JOURNAL', '学习提交回执损坏或身份不符，保留原件。'); }
  }
  async snapshot({ taskId = null, courseId = null } = {}) {
    if (taskId !== null && !validId(taskId)) throw learningError('LEARNING_INVALID_TASK', 'taskId无效。');
    if (courseId !== null && (typeof courseId !== 'string' || !/^C\d{3,8}$/.test(courseId))) throw learningError('LEARNING_INVALID_COURSE', 'courseId无效。');
    const fileHashes = {}, texts = {};
    for (const relative of SUMMARY_FILES) {
      const raw = await readLearningFile(this.root, relative);
      texts[relative] = raw ?? ''; fileHashes[relative] = raw === null ? null : hashText(raw);
    }
    const dir = await safeLearningPath(this.root, '运行记录/学习记录');
    let names = [];
    try { names = (await fs.readdir(dir)).filter(name => /^\d{4}-\d{2}-\d{2}\.md$/.test(name)).sort(); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (names.length > 5000) throw learningError('LEARNING_TOO_MANY_RECORDS', '学习活动文件超过读取上限。');
    const tasks = new Map(), notes = new Map(), entries = [], journals = new Map(), sourceCatalog = {}, artifactCatalog = {}, lastActivityFiles = [], warnings = [], pendingCommits = [];
    const journalDir = await safeLearningPath(this.root, '运行记录/.学习提交');
    try {
      for (const name of (await fs.readdir(journalDir)).filter(name => /^[A-Za-z0-9_-]{8,128}\.json$/.test(name))) {
        const journal = await this.findRequest(name.slice(0, -5));
        if (journal) journals.set(journal.requestId, journal);
        if (journal?.status !== 'committed') pendingCommits.push({ requestId: journal.requestId, status: journal.status, hasPreparedTargets: !!journal.targets?.length,
          targetFiles: (Array.isArray(journal.targets) ? journal.targets : []).map(target => target?.relative)
            .filter(relative => SUMMARY_FILES.includes(relative) || typeof relative === 'string' && /^运行记录\/学习记录\/\d{4}-\d{2}-\d{2}\.md$/.test(relative)) });
      }
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (pendingCommits.some(journal => journal.hasPreparedTargets)) warnings.push('存在未完成或冲突的多文件提交；请先核对提交回执，不把部分摘要视为完整最新状态。');
    for (const name of names) {
      const relative = '运行记录/学习记录/' + name, raw = await readLearningFile(this.root, relative, { optional: false });
      fileHashes[relative] = hashText(raw);
      const metadataText = withoutFencedExamples(raw);
      for (const match of metadataText.matchAll(/^<!-- learning-entry:start id=([A-Za-z0-9_-]{8,128}) hash=([a-f0-9]{64}) mode=([a-z]+) -->\r?\n([\s\S]*?)^<!-- learning-entry:end id=\1 -->\r?\n<!-- learning-entry:complete id=\1 -->/gm)) {
        const [, requestId, requestHash, mode, block] = match, journal = journals.get(requestId);
        if (pendingCommits.some(item => item.requestId === requestId)) continue;
        if (journal && journal.requestHash !== requestHash) { warnings.push(relative + '中的活动身份与回执不符，未展示。'); continue; }
        if (mode !== 'note') { entries.push(activityEntry(block, { requestId, mode, activityFile: relative, line: metadataText.slice(0, match.index).split('\n').length, journal })); continue; }
        const markers = [...block.matchAll(/^<!-- learning-note:v1 ([A-Za-z0-9+/=]+) -->$/gm)];
        const event = markers.length === 1 ? normalizeNoteEvent(decode(markers[0][1]), relative, requestId) : null;
        if (!event || event.body.replace(/\r\n/g, '\n') !== quotedSection(block, '- 小陌本次原话：') || event.aiText.replace(/\r\n/g, '\n') !== quotedSection(block, '- AI 当次回应（建议与解释，不是本人原话）：')) { warnings.push(relative + '中的学习笔记元信息或原话校验未通过，保留原文，未展示为有效笔记。'); continue; }
        const previous = notes.get(event.noteId);
        if (event.version !== (previous?.version ?? 0) + 1 || !previous && event.noteId !== noteIdForRequest(requestId)) { warnings.push(relative + '中的学习笔记版本不连续，保留原文，未覆盖旧版本。'); continue; }
        notes.set(event.noteId, mergeNote(previous, event));
      }
      for (const match of metadataText.matchAll(/^<!-- learning-task:v1 ([A-Za-z0-9+/=]+) -->$/gm)) {
        const task = normalizeTask(decode(match[1]));
        if (!task) { warnings.push(relative + '中任务标记不完整，未作为任务状态使用。'); continue; }
        if (pendingCommits.some(journal => journal.requestId === task.lastRequestId)) continue;
        const previous = tasks.get(task.taskId);
        if (previous && task.goalRevision < previous.goalRevision) { warnings.push('任务目标版本倒退，保留先前版本：' + task.taskId); continue; }
        tasks.set(task.taskId, task);
      }
      for (const match of metadataText.matchAll(/^<!-- learning-sources:v1 ([A-Za-z0-9+/=]+) -->$/gm)) {
        const coverage = decode(match[1]);
        const entries = Array.isArray(coverage) ? coverage : coverage?.sources ?? coverage?.items ?? [];
        for (const source of entries) if (source && typeof source === 'object' && typeof (source.id ?? source.sourceId ?? source.evidenceId) === 'string') sourceCatalog[source.id ?? source.sourceId ?? source.evidenceId] = { ...source, activityFile: relative };
      }
      for (const match of metadataText.matchAll(/^<!-- learning-artifact:v1 ([A-Za-z0-9+/=]+) -->$/gm)) {
        const saved = normalizeArtifactMetadata(decode(match[1]), relative);
        if (!saved) { warnings.push(relative + '中的文字产物身份或正文校验未通过，未用于任务接续。'); continue; }
        if (pendingCommits.some(journal => journal.requestId === saved.sourceRequestId)) continue;
        if (!tasks.has(saved.taskId)) { warnings.push(relative + '中的文字产物没有同任务依据，未用于任务接续。'); continue; }
        artifactCatalog[saved.taskId + ':' + saved.id] = { ...saved, activityOffset: match.index,
          activityLine: metadataText.slice(0, match.index).split('\n').length };
      }
      if (raw.includes('learning-task:v1')) lastActivityFiles.push(relative);
    }
    const allTasks = [...tasks.values()].sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
    const filtered = courseId ? allTasks.filter(task => task.courseId === courseId) : allTasks;
    const currentTask = taskId ? tasks.get(taskId) ?? null : [...filtered].reverse().find(task => !['closed', 'completed', 'cancelled'].includes(task.status)) ?? filtered.at(-1) ?? null;
    const recordVersion = hashText(JSON.stringify(Object.entries(fileHashes).sort(([a], [b]) => a.localeCompare(b))));
    return { recordVersion, courses: parseCourses(texts['运行记录/课程记录.md']), tasks: allTasks, notes: [...notes.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), entries, currentTask, resumePoints: allTasks.filter(task => task.nextStep || task.stopPoint).map(task => ({ taskId: task.taskId, courseId: task.courseId, goalRevision: task.goalRevision, stopPoint: task.stopPoint, nextStep: task.nextStep, updatedAt: task.updatedAt })), abilityEvidence: texts['运行记录/能力依据.md'], stagePlan: texts['运行记录/阶段安排.md'], fileHashes, lastActivityFiles: lastActivityFiles.slice(-12), sourceCatalog, artifactCatalog, pendingCommits, warnings };
  }
  async readTask(taskId) { return (await this.snapshot({ taskId })).currentTask; }
  async readNote(noteId) { if (!validNoteId(noteId)) throw learningError('LEARNING_INVALID_NOTE', '学习笔记编号无效。'); return (await this.snapshot()).notes.find(note => note.noteId === noteId) ?? null; }
}
