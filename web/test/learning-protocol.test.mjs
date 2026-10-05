import test from 'node:test';
import assert from 'node:assert/strict';
import { parseModelResponse, validateUpdates } from '../learning/protocol.mjs';

const base = extra => ({ version: 1, saveReason: 'progress', facts: [], observations: [], candidates: [], adoptedChanges: [], ...extra });
const sources = { courses: [{ courseId: 'C001', name: '查理的编剧课' }], sources: [{ id: 'course-current-2', kind: 'course_note', courseId: 'C001' }] };
test('plain replies remain usable; unique JSON tail separates answer and updates', () => {
  assert.equal(parseModelResponse('先看人物做了什么。').structured, false);
  const parsed = parseModelResponse('先看人物做了什么。\n<learning_updates>' + JSON.stringify(base({ saveReason: 'none' })) + '</learning_updates>');
  assert.equal(parsed.reply, '先看人物做了什么。'); assert.equal(parsed.structured, true);
  const broken = parseModelResponse('可读答复。<learning_updates>{bad}</learning_updates>'); assert.equal(broken.reply, '可读答复。'); assert.equal(broken.updates, null);
});
test('multiple, non-tail, privileged, and unclosed updates cannot become file changes', () => {
  for (const value of ['<learning_updates>{}</learning_updates> extra', '<learning_updates>{}</learning_updates><learning_updates>{}</learning_updates>', '<learning_updates>{', '<learning_updates>' + JSON.stringify(base({ task: { goalRevision: 9 } })) + '</learning_updates>', '<learning_updates>' + JSON.stringify(base({ path: 'secret.env' })) + '</learning_updates>']) assert.equal(parseModelResponse(value).structured, false);
  for (const suffix of ['<learning_updates>{"secret":"x"}', '<learning_updates>{}</learning_updates>extra', '<learning_updates>{}</learning_updates><learning_updates>{}</learning_updates>']) assert.equal(parseModelResponse('自然回答。' + suffix).reply, '自然回答。');
});
test('facts require exact user quotes and known course identities; model paraphrase is not a factual upgrade', () => {
  const payload = { message: '我看到了第六或第七节，还不确定准确停点。', history: [] };
  const checked = validateUpdates(base({ facts: [{ kind: 'course_progress', courseId: 'C001', quote: '第六或第七节', value: '第七节已完成' }, { kind: 'course_progress', courseId: 'C999', quote: '第六或第七节' }, { kind: 'user_report', quote: '我看完了第七节' }] }), { payload, sources });
  assert.equal(checked.updates.facts.length, 1); assert.match(checked.updates.facts[0].value, /不确定/); assert.doesNotMatch(checked.updates.facts[0].value, /已完成/); assert.equal(checked.warnings.length >= 2, true);
});
test('quote fragments cannot hide negation or hypothetical/prospective completion', () => {
  for (const message of ['我还没看完第七课。', '如果我看完第七课，就做练习。', '我打算看完第七课。']) {
    const result = validateUpdates(base({ facts: [{ kind: 'course_progress', courseId: 'C001', quote: '看完第七课' }] }), { payload: { message }, sources });
    assert.equal(result.updates.facts.length, 0);
  }
  const positive = validateUpdates(base({ facts: [{ kind: 'course_progress', courseId: 'C001', quote: '我看完了第七课' }] }), { payload: { message: '我看完了第七课，但还没理解轴线。' }, sources }); assert.equal(positive.updates.facts.length, 1);
  const neverWatched = validateUpdates(base({ facts: [{ kind: 'course_progress', courseId: 'C001', quote: '看过查理的编剧课' }] }), { payload: { message: '我没有看过查理的编剧课。' }, sources }); assert.equal(neverWatched.updates.facts.length, 0);
});
test('history facts need an explicitly named user turn, never an assistant turn', () => {
  const payload = { message: '接着来。', history: [{ role: 'assistant', id: 'assistant-1', content: '你已看完第七课' }, { role: 'user', id: 'user-first', content: '我看完了第七课' }] };
  const checked = validateUpdates(base({ facts: [{ kind: 'user_report', quote: '我看完了第七课' }, { kind: 'user_report', turnId: 'user-first', quote: '我看完了第七课' }, { kind: 'user_report', turnId: 'assistant-1', quote: '你已看完第七课' }] }), { payload }); assert.equal(checked.updates.facts.length, 1); assert.equal(checked.updates.facts[0].turnId, 'user-first');
});
test('a first task cannot attach an explicitly named course report to another known course', () => {
  const known = { ...sources, courses: [...sources.courses, { courseId: 'C002', name: '老白的分镜课' }] };
  const checked = validateUpdates(base({ facts: [{ kind: 'course_progress', courseId: 'C001', quote: '我看完了老白的分镜课第七节。' }] }), { payload: { message: '我看完了老白的分镜课第七节。' }, sources: known });
  assert.equal(checked.updates.facts.length, 0); assert.match(checked.warnings.join(' '), /另一门课程/);
});
test('capability observations require supplied performance and do not certify independent mastery', () => {
  const payload = { message: '帮我看看。', context: { artifact: { id: 'piece-1', text: '人物把信收回口袋，决定当面说。' } } };
  const checked = validateUpdates(base({ observations: [{ text: '人物做出了具体选择。', evidenceIds: ['piece-1'] }, { text: '已经独立掌握人物弧光', evidenceIds: ['piece-1'] }, { text: '作品很成熟', evidenceIds: ['nonexistent'] }] }), { payload });
  assert.equal(checked.updates.observations.length, 1); assert.match(checked.updates.observations[0].helpLevel, /未记录/);
  const ai = validateUpdates(base({ observations: [{ text: '体现了人物选择', evidenceIds: ['piece-1'] }] }), { payload: { ...payload, context: { artifact: { ...payload.context.artifact, origin: 'ai_generated' } } } }); assert.equal(ai.updates.observations.length, 0);
});
test('candidate proposals cannot change goals; explicit adoption can, while time changes cannot', () => {
  const task = { taskId: 'task_existing_001', purpose: '人物欲望', courseId: 'C001' };
  const candidate = validateUpdates(base({ task: { purpose: '改学摄影', taskId: 'task_wrong_0001' }, candidates: ['可以改学摄影'] }), { payload: { message: '我想先了解一下。' }, task, sources }); assert.equal(candidate.updates.task.purpose, undefined); assert.equal(candidate.updates.task.taskId, undefined); assert.deepEqual(candidate.updates.candidates, ['可以改学摄影']);
  const message = '我决定把目标改为人物行动。';
  const adopted = validateUpdates(base({ task: { purpose: '人物行动' }, adoptedChanges: [{ kind: 'goal', quote: message, value: '人物行动' }] }), { payload: { message }, task, sources }); assert.equal(adopted.updates.adoptedChanges.length, 1);
  const shortened = validateUpdates(base({ adoptedChanges: [{ kind: 'goal', quote: '我决定改成半小时。', value: '半小时' }] }), { payload: { message: '我决定改成半小时。' }, task, sources }); assert.equal(shortened.updates.adoptedChanges.length, 0);
});
test('no-save gates and missing evidence strip unsafe local updates', () => {
  const checked = validateUpdates(base({ task: { knownPerformance: '已精通', stopPoint: '第九节已看完' } }), { payload: { message: '这次不要保存。', skipSave: true } }); assert.equal(checked.updates.saveReason, 'none'); assert.equal(checked.updates.task.knownPerformance, undefined); assert.equal(checked.updates.task.stopPoint, undefined);
});
test('existing observation points and help conditions survive unadopted model changes and unilateral task closure', () => {
  const task = { taskId: 'task_existing_002', allowedHelp: '先独立写，再讨论', observationPoints: ['人物行动是否具体'], purpose: '人物行动' };
  const result = validateUpdates(base({ task: { allowedHelp: 'AI代写', observationPoints: [], status: 'cancelled' } }), { payload: { message: '继续看看这段。' }, task });
  assert.equal(result.updates.task.allowedHelp, undefined); assert.equal(result.updates.task.observationPoints, undefined); assert.equal(result.updates.task.status, undefined); assert.match(result.warnings.join(' '), /保留原值/);
});
test('course completion cannot complete a pending practice task', () => {
  const task = { taskId: 'task_practice_001', title: '人物行动练习', purpose: '写具体行动', status: 'active' };
  for (const message of ['我看完了第七课，但练习还没做。', '课程看完了，尚未练习。', '我看完了第七课。']) {
    const result = validateUpdates(base({ task: { status: 'completed' } }), { payload: { message }, task }); assert.equal(result.updates.task.status, undefined);
  }
  const complete = validateUpdates(base({ task: { status: 'completed' } }), { payload: { message: '这次人物行动练习已经完成了。' }, task }); assert.equal(complete.updates.task.status, 'completed');
});
test('real sourceKind user_text is usable, while a request-only user:current is not performance', () => {
  const real = { id: 'user-text:b69c08dc8ffe36f4e2cd', sourceKind: 'user_text', content: '人物收回了信，决定亲自解释。', origin: 'user_provided', authorship: 'user_provided', helpLevel: '帮助程度未记录' };
  const valid = validateUpdates(base({ observations: [{ text: '文字包含一个具体的人物决定。', evidenceIds: [real.id] }] }), { payload: { message: '请看看这段。' }, sources: [real] }); assert.equal(valid.updates.observations.length, 1);
  const request = validateUpdates(base({ observations: [{ text: '能用行动表达人物选择。', evidenceIds: ['user:current'] }] }), { payload: { message: '帮我安排一下。' } }); assert.equal(request.updates.observations.length, 0);
  const ai = validateUpdates(base({ observations: [{ text: '能用行动表达人物选择。', evidenceIds: [real.id] }] }), { payload: { message: '请看看。' }, sources: [{ ...real, origin: 'ai_generated' }] }); assert.equal(ai.updates.observations.length, 0);
  const assisted = validateUpdates(base({ observations: [{ text: '文字包含一个具体的人物决定。', evidenceIds: [real.id] }] }), { payload: { message: '请看看。' }, sources: [{ ...real, origin: 'ai_assisted', helpLevel: 'AI辅助后由小陌修改' }] }); assert.match(assisted.updates.observations[0].helpLevel, /AI辅助/);
});
test('repeated validation preserves helpLevel without duplicating source conditions', () => {
  const source = { id: 'user-text:recheck', sourceKind: 'user_text', origin: 'ai_assisted', helpLevel: 'AI辅助后由小陌修改；不能推断独立完成' }, options = { payload: { message: '请看这段。' }, sources: [source] };
  const once = validateUpdates(base({ observations: [{ text: '这段文字呈现了人物的具体决定。', evidenceIds: [source.id], helpLevel: '先由小陌给文字' }] }), options);
  const twice = validateUpdates(once.updates, options);
  assert.equal(twice.updates.observations[0].helpLevel, once.updates.observations[0].helpLevel);
});
