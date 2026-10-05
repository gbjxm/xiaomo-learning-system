import { validId } from './records.mjs';

export const MODEL_PROTOCOL = `先自然回答小陌当前的问题，随后可在回答末尾提供唯一的 <learning_updates>{JSON}</learning_updates> 块。不得把协议JSON当作用户应填写的表单。
JSON version必须是1；saveReason只能为none/plan/progress/wrap/review。可用字段：task、facts、observations、candidates、adoptedChanges、nextStep。不得提供文件路径、自由替换、goalRevision、updatedAt、lastRequestId或写入命令。
task可包含taskId/title/purpose/courseId/allowedHelp/observationPoints/knownPerformance/stopPoint/nextStep/status/evidenceRefs/candidates。已有任务保留同一taskId，改变时间不改变目标。
facts仅含kind(course_progress/viewing/user_report)、courseId、quote、turnId、value；quote必须逐字引用小陌本轮原话。只有明确引用用户history turn时才使用其turnId。保留否定、条件、假设和第六或第七节、十几节等不确定性；模型讲解不是用户已经学会。
observations仅含text/evidenceIds/helpLevel，必须引用实际提供的用户回答或文字产物证据ID，说明帮助条件；不能用AI生成的内容认证小陌掌握，也不以课程时长作能力认证。
adoptedChanges仅含kind(goal/method)、quote、value、taskId；需要用户明确说出的采用或目标变更及原话。你的新建议只放candidates。明确请求安排可存待执行，无须再问采用；不保存时saveReason为none。知识版本和材料未核实保持未知。
一个合规尾块示例：<learning_updates>{"version":1,"saveReason":"none","facts":[],"observations":[],"candidates":[],"adoptedChanges":[]}</learning_updates>`;

const ROOT_KEYS = ['version', 'saveReason', 'task', 'facts', 'observations', 'candidates', 'adoptedChanges', 'nextStep'];
const TASK_KEYS = ['taskId', 'title', 'purpose', 'courseId', 'allowedHelp', 'observationPoints', 'knownPerformance', 'stopPoint', 'nextStep', 'status', 'evidenceRefs', 'candidates'];
const REASONS = ['none', 'plan', 'progress', 'wrap', 'review'];
const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype', 'path', 'file', 'replace', 'replacement', 'goalRevision', 'updatedAt', 'lastRequestId']);
const text = (value, max = 8000) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const strings = (value, max = 30) => Array.isArray(value) && value.length <= max && value.every(v => text(v));
function plain(value) { return value && !Array.isArray(value) && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype; }
function forbidden(value, depth = 0) {
  if (depth > 12) return true;
  if (Array.isArray(value)) return value.some(item => forbidden(item, depth + 1));
  return plain(value) && Object.entries(value).some(([key, item]) => BAD_KEYS.has(key) || forbidden(item, depth + 1));
}
export function parseModelResponse(raw, { requestId } = {}) {
  if (typeof raw !== 'string') return { reply: '', updates: null, structured: false, warnings: ['模型没有返回文字答复。'] };
  const output = raw.trim(), blocks = [...output.matchAll(/<learning_updates>([\s\S]*?)<\/learning_updates>/g)];
  const firstTag = output.indexOf('<learning_updates>'), natural = firstTag >= 0 ? output.slice(0, firstTag).trim() : output;
  if (!blocks.length) return { reply: natural || (firstTag >= 0 ? '本次更新未通过校验，未收到可显示的独立答复。' : output), updates: null, structured: false, warnings: firstTag >= 0 ? ['学习更新尾块未闭合，未更新台账。'] : [] };
  const last = blocks.at(-1);
  if (blocks.length !== 1 || output.slice(last.index + last[0].length).trim()) return { reply: natural || '本次更新未通过校验，未收到可显示的独立答复。', updates: null, structured: false, warnings: ['学习更新不是唯一末尾块，未更新台账。'] };
  try {
    if (last[1].length > 64000) throw new Error('更新过大');
    const updates = JSON.parse(last[1]);
    if (!plain(updates) || updates.version !== 1 || !REASONS.includes(updates.saveReason) || forbidden(updates)) throw new Error('结构不符合约定');
    return { reply: natural || '本次没有提供独立的自然语言答复。', updates, structured: true, warnings: natural ? [] : ['回复仅有结构更新，没有完整答复。'] };
  } catch { return { reply: natural || output, updates: null, structured: false, warnings: ['学习更新格式未通过校验，答复保留，未更新台账。' + (requestId ? ' 请求：' + requestId : '')] }; }
}

const uncertain = value => /十几|几节|不确定|不知道|忘了|大概|可能|也许|左右|差不多|(?:第?[一二三四五六七八九十\d]+(?:节|课)?(?:或|还是|到)[第一二三四五六七八九十\d]+)/.test(value);
const hypothetical = value => /假(?:设|如)|如果|要是|倘若|比如|例如/.test(value);
const conditional = value => hypothetical(value) || /(?:打算|计划|准备|想)(?:要)?(?:看|学|做|完成)|(?:还|尚)?(?:没(?:有)?|未)(?:看过|学过|做过|练过|看完|学完|做完|练完|完成|看到|学到|学|看|做|练)|不是.{0,15}(?:看完|学完|完成|掌握)/.test(value);
const aiGenerated = value => /ai_generated|model_generated|AI(?:生成|代写|代做)|纯AI|完全由AI|assistant/i.test(String(value ?? ''));
function performanceMessage(message) {
  if (!text(message, 16000)) return false;
  return /我(?:的)?(?:理解|解释|判断|分析|回答)(?:是|为|：|:)|我的(?:段落|文字|练习|分镜|剧本)[:：]/.test(message) || (/^(?:因为|我认为|主角|人物).{15,}/s.test(message) && !/帮我|给我|安排|请解释|讲解一下|怎么做|为什么/.test(message));
}
function sourceEntries(sources) { return Array.isArray(sources) ? sources : sources?.sources ?? sources?.items ?? []; }
function sentenceAround(input, index, length, clause = false) {
  const marks = ['。', '！', '？', '\n', '.', '!', '?', ...(clause ? ['，', ',', '；', ';'] : [])];
  const before = input.slice(0, index), previous = Math.max(...marks.map(s => before.lastIndexOf(s)));
  const after = input.slice(index + length), offsets = marks.map(s => after.indexOf(s)).filter(n => n >= 0);
  return input.slice(previous + 1, index + length + (offsets.length ? Math.min(...offsets) : after.length));
}
function binding(item, payload) {
  const turnId = item.turnId;
  let input = payload?.message ?? '';
  if (turnId && turnId !== 'current') {
    const users = (payload?.history ?? []).filter(turn => turn?.role === 'user');
    const turn = users.find((turn, index) => turn.turnId === turnId || turn.id === turnId || turnId === 'user:' + index);
    if (!turn) return null;
    input = turn.content;
  }
  if (!text(item.quote) || typeof input !== 'string') return null;
  const index = input.indexOf(item.quote);
  if (index < 0) return null;
  return { turnId: turnId ?? 'current', quote: item.quote, sentence: sentenceAround(input, index, item.quote.length), clause: sentenceAround(input, index, item.quote.length, true) };
}

export function validateUpdates(updates, { payload = {}, task = null, sources = [] } = {}) {
  const warnings = [];
  if (!plain(updates) || updates.version !== 1 || !REASONS.includes(updates.saveReason) || forbidden(updates)) return { updates: null, warnings: ['学习更新结构无效，未更新台账。'] };
  for (const key of Object.keys(updates)) if (!ROOT_KEYS.includes(key)) warnings.push('忽略未约定的更新字段：' + key);
  const entries = sourceEntries(sources), courseIds = new Set((sources?.courses ?? []).map(course => course.courseId));
  if (task?.courseId) courseIds.add(task.courseId);
  for (const source of entries) if (source?.courseId) courseIds.add(source.courseId);
  const evidence = new Set(), evidenceHelp = new Map();
  for (const source of entries) if (source && ['user_text', 'user_answer', 'user_statement', 'artifact', 'answer', 'performance', '文字产物', '原话回答'].includes(source.sourceKind ?? source.kind ?? source.type) && !aiGenerated(source.authorship) && !aiGenerated(source.origin)) {
    const id = source.id ?? source.sourceId ?? source.evidenceId;
    evidence.add(id); evidenceHelp.set(id, source.helpLevel ?? (/ai_assisted|AI辅助/i.test(String(source.origin ?? source.authorship)) ? 'AI辅助，不能据此推断独立完成' : '帮助程度未记录；只依据当前提供的文字'));
  }
  const artifact = payload.context?.artifact;
  if (artifact && text(artifact.text, 16000) && artifact.kind !== 'media_reference' && !aiGenerated(artifact.authorship) && !aiGenerated(artifact.origin)) { const id = artifact.id ?? 'artifact:current'; evidence.add(id); evidenceHelp.set(id, artifact.helpLevel ?? (/ai_assisted|AI辅助/i.test(String(artifact.origin ?? artifact.authorship)) ? 'AI辅助，不能据此推断独立完成' : '帮助程度未记录；只依据当前提供的文字')); }
  if (performanceMessage(payload.message)) evidence.add('user:current');
  for (const [index, turn] of (payload.history ?? []).filter(t => t.role === 'user').entries()) if (performanceMessage(turn.content)) evidence.add(turn.turnId ?? turn.id ?? 'user:' + index);
  const result = { version: 1, saveReason: updates.saveReason, facts: [], observations: [], candidates: [], adoptedChanges: [] };
  for (const item of Array.isArray(updates.facts) ? updates.facts.slice(0, 30) : []) {
    const bound = plain(item) ? binding(item, payload) : null;
    if (!bound || !['course_progress', 'viewing', 'user_report'].includes(item.kind) || Object.keys(item).some(k => !['kind', 'courseId', 'quote', 'turnId', 'value'].includes(k))) { warnings.push('一条事实没有有效原话或结构，未更新。'); continue; }
    if (conditional(bound.clause) || hypothetical(bound.sentence)) { warnings.push('原话涉及否定、条件或计划，未当作完成事实。'); continue; }
    if (item.kind === 'course_progress' && (!courseIds.has(item.courseId) || !/^C\d{3,8}$/.test(item.courseId ?? ''))) { warnings.push('课程身份未核实，原话只留活动记录，未改台账。'); continue; }
    const explicitlyNamed = (sources?.courses ?? []).filter(course => text(course.name, 1000) && bound.sentence.includes(course.name));
    if (item.kind === 'course_progress' && explicitlyNamed.length && !explicitlyNamed.some(course => course.courseId === item.courseId)) { warnings.push('原话明确指向另一门课程，未改模型误选的课程台账。'); continue; }
    if (item.kind === 'course_progress' && task?.courseId && item.courseId !== task.courseId && !bound.sentence.includes((sources?.courses ?? []).find(c => c.courseId === item.courseId)?.name ?? '\u0000')) { warnings.push('进度引用了其他课程但原话未明确它，未改台账。'); continue; }
    if (uncertain(bound.sentence) || (text(item.value) && item.value !== item.quote)) warnings.push('事实保留逐字原话，不将模型概括升级为精确进度。');
    result.facts.push({ kind: item.kind, ...(item.kind === 'course_progress' ? { courseId: item.courseId } : {}), quote: uncertain(bound.sentence) ? bound.sentence.trim() : item.quote, turnId: bound.turnId, value: uncertain(bound.sentence) ? bound.sentence.trim() : item.quote });
  }
  for (const item of Array.isArray(updates.observations) ? updates.observations.slice(0, 20) : []) {
    if (!plain(item) || !text(item.text) || !strings(item.evidenceIds, 20) || !item.evidenceIds.length || item.evidenceIds.some(id => !evidence.has(id)) || Object.keys(item).some(k => !['text', 'evidenceIds', 'helpLevel'].includes(k))) { warnings.push('一条能力观察缺少真实已提供的回答或产物依据，未保存能力摘要。'); continue; }
    if (/精通|全面掌握|已经掌握|独立掌握|完全掌握|认证|掌握度|\d+\s*%|独立完成/.test(item.text)) { warnings.push('能力观察含无依据的全面或独立掌握结论，未保存。'); continue; }
    const conditions = [...new Set(item.evidenceIds.map(id => evidenceHelp.get(id)).filter(Boolean))];
    let helpLevel = text(item.helpLevel, 500) ? item.helpLevel : '';
    for (const condition of conditions) if (!helpLevel.includes(condition)) helpLevel += (helpLevel ? '；' : '') + condition;
    result.observations.push({ text: item.text, evidenceIds: [...new Set(item.evidenceIds)], helpLevel: helpLevel || '帮助程度未记录；只依据当前提供的文字' });
  }
  if (strings(updates.candidates)) result.candidates = [...new Set(updates.candidates)];
  for (const item of Array.isArray(updates.adoptedChanges) ? updates.adoptedChanges.slice(0, 10) : []) {
    const bound = plain(item) ? binding(item, payload) : null;
    if (!bound || !['goal', 'method'].includes(item.kind) || !text(item.value) || !bound.quote.includes(item.value) || conditional(bound.sentence) || /不要|不采用|不同意|暂不|别改|不想改/.test(bound.sentence) || !/采用|就按|按这个|用这个|改为|改成|改学|改做|目标|主攻|决定|同意|接受|换成/.test(bound.sentence) || Object.keys(item).some(k => !['kind', 'quote', 'turnId', 'value', 'taskId'].includes(k)) || (item.taskId && item.taskId !== task?.taskId)) { warnings.push('一条采用或目标变更缺少明确、同任务的用户采用依据，保留为未采用。'); continue; }
    if (item.kind === 'goal' && /(?:缩短|缩成|分钟|小时|半小时|今天时间|时段)/.test(item.value)) { warnings.push('时间重排不作为目标版本变更。'); continue; }
    result.adoptedChanges.push({ kind: item.kind, quote: item.quote, value: item.value, ...(task?.taskId ? { taskId: task.taskId } : {}) });
  }
  if (plain(updates.task)) {
    const candidate = {};
    for (const [key, value] of Object.entries(updates.task)) {
      if (!TASK_KEYS.includes(key)) { warnings.push('忽略未约定的任务字段：' + key); continue; }
      if (key === 'taskId') { if (validId(value) && (!task || value === task.taskId)) candidate.taskId = value; else warnings.push('任务身份不能被模型改换。'); }
      else if (key === 'courseId') { if (value === null || courseIds.has(value)) candidate.courseId = value; else warnings.push('任务课程身份未核实，未绑定课程。'); }
      else if (['observationPoints', 'evidenceRefs', 'candidates'].includes(key)) { if (strings(value)) candidate[key] = key === 'evidenceRefs' ? value.filter(id => evidence.has(id) || entries.some(s => (s.id ?? s.sourceId ?? s.evidenceId) === id)) : [...value]; }
      else if (key === 'status') {
        if (['planned', 'active', 'paused', 'closed', 'completed', 'cancelled'].includes(value)) {
          const message = payload.message ?? '', sameTaskCompletion = /(?:这(?:一)?(?:块|项|次|个)?(?:任务|练习|学习)|这块|任务|练习).{0,14}(?:完成|做完|练完|学完)|(?:完成|做完|练完|学完).{0,14}(?:这(?:一)?(?:块|项|次|个)?(?:任务|练习|学习)|这块)/.test(message) || (task?.title && message.includes(task.title) && /完成|做完|练完|学完/.test(message));
          if (value === 'completed' && (!sameTaskCompletion || conditional(message))) warnings.push('完成状态没有明确同一任务的用户依据，未更新。');
          else if (['closed', 'cancelled'].includes(value) && (!/到这里|结束|收尾|取消(?:这|该|当前|这项)|放下|不做了|不学了/.test(message) || /别取消|不要取消|不结束|别结束/.test(message))) warnings.push('关闭或取消任务没有明确用户依据，未更新。');
          else candidate.status = value;
        }
      }
      else if (key === 'knownPerformance') { if (result.observations.length) candidate.knownPerformance = result.observations.map(o => o.text).join('；'); else warnings.push('表现摘要没有有效能力观察，未更新。'); }
      else if (key === 'stopPoint') { if (typeof value === 'string' && value.length <= 8000 && (!value || payload.message?.includes(value) || result.facts.some(f => f.quote.includes(value)))) candidate.stopPoint = value; else warnings.push('停止处缺少用户原话，未更新。'); }
      else if (typeof value === 'string' && value.length <= 8000) candidate[key] = value;
    }
    if (task?.purpose && candidate.purpose && candidate.purpose !== task.purpose && !result.adoptedChanges.some(c => c.kind === 'goal')) { delete candidate.purpose; warnings.push('新目标未被用户采用，保留原任务目标。'); }
    for (const key of ['allowedHelp', 'observationPoints']) {
      if (task && Object.hasOwn(candidate, key) && JSON.stringify(candidate[key]) !== JSON.stringify(task[key])) {
        const values = Array.isArray(candidate[key]) ? candidate[key] : [candidate[key]];
        const explicitlyAdopted = values.length > 0 && values.every(value => value && result.adoptedChanges.some(change => change.quote.includes(value)));
        if (!explicitlyAdopted) { delete candidate[key]; warnings.push('帮助条件或观察点变更未被用户明确采用，保留原值。'); }
      }
    }
    result.task = candidate;
  }
  if (text(updates.nextStep)) result.nextStep = updates.nextStep;
  if (payload.skipSave || /(?:这次|本次)?(?:不要|不必|不用)保存|(?:别|不要|不必)记(?:录)?/.test(payload.message ?? '')) result.saveReason = 'none';
  return { updates: result, warnings };
}
