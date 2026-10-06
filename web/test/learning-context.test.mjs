import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { mkdtemp, mkdir, writeFile, rm, realpath } from 'node:fs/promises';
import { buildLearningContext } from '../learning/context.mjs';
import { hashText } from '../learning/records.mjs';
import { LearningSourceReader } from '../learning/sources.mjs';

const SKILLS = ['orchestrate-personal-learning', 'design-learning-path', 'plan-learning-time', 'explain-learning-material', 'design-learning-practice', 'assess-learning-progress', 'review-learning-cycle'];
const task = { taskId: 'task_fixture', goalRevision: 3, title: '从片段判断动作衔接', purpose: '将课程原理用于具体片段', courseId: 'C002',
  allowedHelp: '允许AI提示和文字核对', observationPoints: ['观察观众能否理解动作因果'], knownPerformance: '仅本人报告', status: 'paused',
  stopPoint: '已列动作链，尚未核验动态', nextStep: '核对上一版片段', evidenceRefs: ['运行记录/学习记录/2026-10-03.md'], candidates: ['另做镜头练习'] };

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'learning-context-new-'));
  const files = {
    '运行约定.md': '# 运行约定\n计划不是完成，旧知识树只读。',
    '建设方案/学习判断契约.md': '# 判断契约\n按当前目标、真实表现、帮助条件给有边界的判断。',
    '运行记录/当前状态.md': '# 当前状态\n学习主攻尚未选择。',
    '运行记录/个人情况.md': '# 个人情况\n## 希望获得的变化\n拆解串联庞大任务。\n## 使用偏好\n自主学习并保留休息。\n## 2026-09-24 补充：当前在学内容\n通常口述自己的理解；看课不代表掌握。\n## 2026-09-24 补充：真实日常与活动切换\n不需要每轮装载的历史时刻表。',
    '运行记录/阶段安排.md': '# 阶段安排\n## 当次\n计划待执行。\n## 已采用的改进\n先缩小到一个动作链；待尝试，效果未知。',
    '运行记录/能力依据.md': '# 能力依据\n仅自述，见[原活动](学习记录/2026-10-03.md)。没有证据不等于不会。',
    '运行记录/课程记录.md': '# 课程记录\nC001 查理十几节；C002 老白第六或第七节；C003 影视飓风看完，课程版本未核实。',
    '运行记录/观影记录.md': '# 观影记录\n本人报告看过《蜘蛛侠：平行宇宙》，观看不是能力证据。',
    '运行记录/学习记录/2026-10-03.md': '# 原始活动\n本人回答：我先把动作看成因果链。AI判断仍待作品验证。',
    ...Object.fromEntries(SKILLS.map(name => [`.agents/skills/${name}/SKILL.md`, `# ${name}\n这是按需使用的${name}职责。`])),
  };
  for (const [relative, content] of Object.entries(files)) { await mkdir(path.dirname(path.join(root, relative)), { recursive: true }); await writeFile(path.join(root, relative), content, 'utf8'); }
  t.after(() => rm(root, { recursive: true, force: true }));
  const snapshot = { recordVersion: 'rv_fixture_3', currentTask: task, tasks: [task],
    courses: [{ courseId: 'C002', name: '老白分镜课', reportedProgress: '第六或第七节', sourceBindingStatus: 'unverified' }] };
  return { root, snapshot, files };
}

function sourceReader(sources = [], extra = {}) {
  const calls = [];
  return { calls, read: async input => { calls.push(input); return { sources, warnings: [], capabilities: { text: true, image: false, audio: false, video: false }, ...extra }; } };
}

test('从明确笔记请求练习时读回原话和旧AI层，不接最近任务或冒充本轮表现', async t => {
  const {root,snapshot}=await fixture(t),noteId='note_'+ 'b'.repeat(24),reader=sourceReader();
  snapshot.notes=[{noteId,title:'人物视线疑问',body:'我觉得视线切换很乱。',aiText:'过去的AI候选解释。',courseId:'C002',chapter:3,occurredOn:null,version:1,activityFile:'运行记录/学习记录/2026-10-03.md'}];
  const result=await buildLearningContext({projectRoot:root,snapshot,task:null,payload:{mode:'plan',message:'按这条笔记给我一个短练习。',context:{noteId}},sourceReader:reader});
  assert.equal(result.contextSnapshot.taskId,null);assert.equal(reader.calls[0].courseId,undefined);
  const saved=result.sources.find(item=>item.id==='personal-record:'+noteId);assert.equal(saved.sourceKind,'personal_record');assert.match(saved.content,/我觉得视线切换很乱/);assert.match(saved.content,/过去的AI候选解释/);assert.match(saved.limitations.join(' '),/不是本轮新表现/);
  assert.match(result.systemContext,/design-learning-practice/);assert.doesNotMatch(result.systemContext,/"taskId": "task_fixture"/);
  await assert.rejects(buildLearningContext({projectRoot:root,snapshot,task:null,payload:{context:{noteId:'note_'+ 'c'.repeat(24)}},sourceReader:reader}),{code:'LEARNING_REFERENCE_UNAVAILABLE'});
});

const courseSource = { id: 'course:C002:6:aaaabbbbcccc', title: '第六课 用画面推导机位', path: '/fixture/course.md', heading: '方法与条件',
  lineStart: 40, lineEnd: 71, documentHash: 'a'.repeat(64), snapshot: 'corpus-fixture', scope: { include_paths: ['选定课文'] },
  content: '## 方法与条件\n画面须通过人物或道具形成呼应；同轴一侧不自动保证衔接。', coverage: 'section', sourceKind: 'course_note', limitations: ['原声未听，动态未审'] };

test('任务目的、允许帮助、观察点和完整资料章节跨mode保留；来源覆盖可持久追查', async t => {
  const { root, snapshot } = await fixture(t); const reader = sourceReader([courseSource]);
  const result = await buildLearningContext({ projectRoot: root, snapshot, payload: { mode: 'question', message: '解释老白第六课', context: { chapter: 6 } }, sourceReader: reader });
  assert.match(result.systemContext, /允许AI提示和文字核对/); assert.match(result.systemContext, /观众能否理解动作因果/);
  assert.ok(result.systemContext.includes(courseSource.content)); assert.match(result.systemContext, /先缩小到一个动作链/);
  assert.equal(result.sourceCoverage[0].documentHash, courseSource.documentHash);
  assert.equal(result.contextSnapshot.taskId, task.taskId); assert.equal(result.contextSnapshot.goalRevision, 3);
  assert.equal(result.contextSnapshot.recordVersion, 'rv_fixture_3');
  assert.equal(reader.calls[0].courseId, 'C002'); assert.equal(reader.calls[0].chapter, 6);
  for (const relative of ['运行记录/当前状态.md', '运行记录/阶段安排.md', '运行记录/课程记录.md']) assert.equal(result.contextSnapshot.targetHashes[relative].length, 64);
  assert.doesNotMatch(result.systemContext, /不需要每轮装载的历史时刻表/);
});

test('综合安排与反馈按职责加载多于两个技能，没有slice2漏掉能力/练习/复盘', async t => {
  const { root, snapshot } = await fixture(t);
  const result = await buildLearningContext({ projectRoot: root, snapshot, payload: { mode: 'plan', message: '本周课程练习安排，评价能力并回顾反复卡住的问题' }, sourceReader: sourceReader() });
  for (const name of ['plan-learning-time', 'design-learning-path', 'design-learning-practice', 'assess-learning-progress', 'review-learning-cycle']) assert.match(result.systemContext, new RegExp(name));
});

test('能力判断读取能力依据及其原活动；任意路径引用不能被读取', async t => {
  const { root, snapshot } = await fixture(t);
  snapshot.currentTask = { ...task, evidenceRefs: [...task.evidenceRefs, '../outside.md', 'D:/private.md'] };
  const result = await buildLearningContext({ projectRoot: root, snapshot, payload: { mode: 'progress', message: '这次能力是否够用？' }, sourceReader: sourceReader() });
  assert.match(result.systemContext, /本人回答：我先把动作看成因果链/);
  assert.match(result.systemContext, /没有证据不等于不会/);
  const record = result.sourceCoverage.find(item => item.sourceKind === 'personal_record'); assert.ok(record);
  assert.equal(record.lineStart, 1); assert.equal(record.documentHash.length, 64);
  assert.ok(!Object.hasOwn(result.contextSnapshot.fileHashes, '../outside.md'));
  assert.equal(result.contextSnapshot.targetHashes['运行记录/能力依据.md'].length, 64);
});

test('媒体交接绑定原task/goalRevision而不宣称看听；artifact本轮文字交给reader', async t => {
  const { root, snapshot } = await fixture(t); const artifact = { kind: 'media_reference', title: '《消失？消失了！》', version: 'v01', text: '四分钟片段引用' };
  const reader = sourceReader([], { warnings: ['未连续审看'], handoff: { reason: 'media_evidence_required', version: 'v01' } });
  const result = await buildLearningContext({ projectRoot: root, snapshot, payload: { mode: 'question', message: '分析动作', context: { artifact } }, sourceReader: reader });
  assert.deepEqual(reader.calls[0].artifact, artifact);
  assert.equal(result.handoff.taskId, task.taskId); assert.equal(result.handoff.goalRevision, 3); assert.equal(result.handoff.version, 'v01');
  assert.match(result.systemContext, /未连续审看/); assert.match(result.systemContext, /不能声称看过图片、听过录音/);
});

test('预算不足整章省略并留下warnings和实际coverage，不能伪报完整', async t => {
  const { root, snapshot } = await fixture(t); const first = { ...courseSource, content: '## 方法与条件\n' + '证据'.repeat(10000) };
  const second = { ...courseSource, id: 'course:C002:6:dddd', heading: '另一个完整章节', content: '## 另一个完整章节\n' + '限定'.repeat(15000) };
  const result = await buildLearningContext({ projectRoot: root, snapshot, payload: { mode: 'question', message: '解释这一章' }, sourceReader: sourceReader([first, second]) });
  assert.ok(result.systemContext.length <= 48000); assert.ok(result.systemContext.includes(first.content));
  assert.ok(!result.systemContext.includes(second.content)); assert.equal(result.sourceCoverage.length, 1);
  assert.equal(result.contextSnapshot.complete, false); assert.match(result.warnings.join('\n'), /未提供/);
  assert.ok(result.contextSnapshot.omittedLabels.some(label => label.includes(second.id)));
});

test('课程和片单依当前文件提供，超长台账明确节选并遵守单项预算', async t => {
  const { root, snapshot } = await fixture(t);
  await writeFile(path.join(root, '运行记录/课程记录.md'), '课程开头\n' + '乙'.repeat(15000) + '课程结尾');
  await writeFile(path.join(root, '运行记录/观影记录.md'), '片单开头\n' + '丙'.repeat(15000) + '片单结尾');
  const result = await buildLearningContext({ projectRoot: root, snapshot, payload: { mode: 'chat', message: '按课程和观看经历接续，举电影例子' }, sourceReader: sourceReader() });
  for (const label of ['课程记录', '观影记录']) {
    const part = result.systemContext.split(`### ${label}\n`)[1].split('\n\n### ')[0];
    assert.ok(part.length <= 3500); assert.match(part, /本次上下文节选/);
  }
  assert.match(result.systemContext, /课程结尾/); assert.match(result.systemContext, /片单结尾/);
});

test('同一task的单一课程课次从实际来源身份恢复；多课次与新显式课次不猜', async t => {
  const { root, snapshot } = await fixture(t);
  snapshot.currentTask = { ...task, evidenceRefs: ['course:C002:6:aaaabbbbcccc', 'course:C002:6:ddddaaaabbbb'] };
  const resumedReader = sourceReader();
  await buildLearningContext({ projectRoot: root, snapshot, payload: { mode: 'question', message: '继续刚才那课' }, sourceReader: resumedReader });
  assert.equal(resumedReader.calls[0].courseId, 'C002'); assert.equal(resumedReader.calls[0].chapter, 6);
  const explicitReader = sourceReader();
  await buildLearningContext({ projectRoot: root, snapshot, payload: { mode: 'question', message: '解释第七课', context: { chapter: 7 } }, sourceReader: explicitReader });
  assert.equal(explicitReader.calls[0].chapter, 7);
  snapshot.currentTask = { ...task, evidenceRefs: ['course:C002:6:aaaabbbbcccc', 'course:C002:7:ddddaaaabbbb'] };
  const ambiguousReader = sourceReader();
  const ambiguous = await buildLearningContext({ projectRoot: root, snapshot, payload: { mode: 'question', message: '继续刚才那课' }, sourceReader: ambiguousReader });
  assert.equal(ambiguousReader.calls[0].chapter, undefined); assert.match(ambiguous.warnings.join('\n'), /多个课次/);
});

test('恢复来源不把旧课次套到新课程，也不跨task引用', async t => {
  const { root, snapshot } = await fixture(t); snapshot.currentTask = { ...task, evidenceRefs: ['course:C002:6:aaaabbbbcccc'] };
  for (const payload of [{ mode: 'question', message: '现在看查理', context: { courseId: 'C001' } },
    { mode: 'question', message: '继续那课', context: { taskId: 'another_task' } }]) {
    const reader = sourceReader(); await buildLearningContext({ projectRoot: root, snapshot, payload, sourceReader: reader });
    assert.equal(reader.calls[0].chapter, undefined);
  }
});

test('上次那一课沿同task唯一可信课次恢复，课程数量不覆盖原课次', async t => {
  const { root, snapshot } = await fixture(t);
  snapshot.currentTask = { ...task, evidenceRefs: ['course:C002:6:aaaabbbbcccc', 'course:C002:6:ddddaaaabbbb'] };
  for (const message of ['我想复习老白上次那一课。', '继续这一课', '看了三课，继续原来的问题', '上了两节，回到原来的问题']) {
    const reader = sourceReader();
    await buildLearningContext({ projectRoot: root, snapshot, payload: { mode: 'question', message }, sourceReader: reader });
    assert.equal(reader.calls[0].courseId, 'C002', message);
    assert.equal(reader.calls[0].chapter, 6, message);
  }
});

test('未知或多课次停点不为复习指代造身份，明确新课次不被旧任务覆盖', async t => {
  const { root, snapshot } = await fixture(t);
  for (const references of [[], ['course:C002:6:aaaabbbbcccc', 'course:C002:7:ddddaaaabbbb']]) {
    snapshot.currentTask = { ...task, evidenceRefs: references };
    const reader = sourceReader();
    const result = await buildLearningContext({ projectRoot: root, snapshot, payload: { mode: 'question', message: '复习上次那一课' }, sourceReader: reader });
    assert.equal(reader.calls[0].chapter, undefined);
    if (references.length) assert.match(result.warnings.join('\n'), /多个课次/);
  }
  snapshot.currentTask = { ...task, evidenceRefs: ['course:C002:6:aaaabbbbcccc'] };
  for (const message of ['复习第七课', '第六/第七课', '第6或7课']) {
    const reader = sourceReader();
    await buildLearningContext({ projectRoot: root, snapshot, payload: { mode: 'question', message }, sourceReader: reader });
    assert.equal(reader.calls[0].chapter, undefined, message);
  }
  const selectedReader = sourceReader();
  await buildLearningContext({ projectRoot: root, snapshot,
    payload: { mode: 'question', message: '第六/第七课', context: { courseId: 'C002', chapter: 7 } }, sourceReader: selectedReader });
  assert.equal(selectedReader.calls[0].chapter, 7);
});

test('新会话按正式活动恢复同任务原文与帮助条件，并明确没有收到改稿', async t => {
  const { root, snapshot, files } = await fixture(t);
  const artifact = { kind: 'text', title: '旧稿片段', version: 'v01', text: '想参赛→借电脑上传→断网→投稿成功。\n这是尚未修改的原稿。',
    authorship: 'ai_assisted', origin: 'ai_assisted', helpLevel: '由AI参与补写，未独立完成' };
  const id = `user-text:${hashText(artifact.text).slice(0, 20)}`, activityFile = '运行记录/学习记录/2026-10-03.md';
  // A failed structured update may preserve old refs while saving new input.
  snapshot.currentTask = { ...task, evidenceRefs: ['user-text:' + 'a'.repeat(20)] };
  snapshot.fileHashes = { [activityFile]: hashText(files[activityFile]) };
  const previous = { ...artifact, text: '这是此前的旧稿。', version: 'v00' }, oldId = `user-text:${hashText(previous.text).slice(0, 20)}`;
  // Deliberately insert the older material last: sort uses its activity
  // position rather than object insertion or the unchanged task summary.
  snapshot.artifactCatalog = {
    [`${task.taskId}:${id}`]: { taskId: task.taskId, id, artifact, activityFile, activityOffset: 800, activityLine: 70, sourceRequestId: 'request_original_text' },
    [`${task.taskId}:${oldId}`]: { taskId: task.taskId, id: oldId, artifact: previous, activityFile, activityOffset: 100, sourceRequestId: 'request_previous_text' },
  };
  const result = await buildLearningContext({ projectRoot: root, snapshot, payload: { mode: 'chat', message: '继续上一段的连接问题' },
    sourceReader: new LearningSourceReader({ projectRoot: root, scope: 'isolated' }) });
  assert.ok(result.systemContext.includes(artifact.text));
  const source = result.sourceCoverage.find(item => item.id === id);
  assert.equal(source.authorship, 'ai_assisted'); assert.equal(source.helpLevel, artifact.helpLevel);
  assert.equal(source.scope.kind, 'task_saved_artifact'); assert.equal(source.scope.version, 'v01');
  assert.equal(source.lineStart, 70); assert.equal(source.lineEnd, 70); assert.deepEqual(source.scope.textLines, { start: 1, end: 2 });
  assert.equal(source.path, await realpath(path.join(root, activityFile))); assert.equal(source.sourceRequestId, 'request_original_text');
  assert.equal(source.activityHash, snapshot.fileHashes[activityFile]);
  assert.match(source.limitations.join('\n'), /未收到新版或修改结果/);
  assert.doesNotMatch(source.limitations.join('\n'), /用户本次提供的文字/);
});

test('同正文其他任务不能接续；本轮新版优先；活动外部变化撤回旧材料', async t => {
  const { root, snapshot, files } = await fixture(t);
  const artifact = { kind: 'text', title: '原稿', version: 'v01', text: '这段文字仍需补上因果连接。', authorship: 'user_authored', origin: 'user_authored', helpLevel: '本人原稿' };
  const id = `user-text:${hashText(artifact.text).slice(0, 20)}`, activityFile = '运行记录/学习记录/2026-10-03.md';
  snapshot.currentTask = { ...task, evidenceRefs: [id] };
  snapshot.fileHashes = { [activityFile]: hashText(files[activityFile]) };
  const saved = { taskId: task.taskId, id, artifact, activityFile, sourceRequestId: 'request_original_text' };
  snapshot.artifactCatalog = { [`other_task:${id}`]: { ...saved, taskId: 'other_task' } };
  const otherReader = sourceReader();
  await buildLearningContext({ projectRoot: root, snapshot, payload: { message: '继续' }, sourceReader: otherReader });
  assert.equal(otherReader.calls[0].artifact, undefined);
  snapshot.artifactCatalog[`${task.taskId}:${id}`] = saved;
  const revised = { ...artifact, text: '这是本轮提供的新稿。', version: 'v02' }, explicitReader = sourceReader();
  await buildLearningContext({ projectRoot: root, snapshot, payload: { message: '检查修改后这段', context: { artifact: revised } }, sourceReader: explicitReader });
  assert.deepEqual(explicitReader.calls[0].artifact, revised);
  await writeFile(path.join(root, activityFile), files[activityFile] + '\n用户在外部编辑器补充的新内容。');
  const changedReader = sourceReader();
  const changed = await buildLearningContext({ projectRoot: root, snapshot, payload: { message: '继续' }, sourceReader: changedReader });
  assert.equal(changedReader.calls[0].artifact, undefined);
  assert.match(changed.warnings.join('\n'), /版本变化/);
});

test('pending活动不经能力链接或摘要快捷值泄入模型，已提交原文仍可接续', async t => {
  const { root, snapshot, files } = await fixture(t), activityFile = '运行记录/学习记录/2026-10-03.md';
  const pendingText = 'PENDING_C_这份新版还没有完整提交，不能当作正式当前表现。';
  const artifact = { kind: 'text', title: '已提交原文', version: 'v02', text: 'COMMITTED_B_这是此前已经提交的文字。',
    authorship: 'user_authored', origin: 'user_authored', helpLevel: '本人提供，AI反馈' };
  const id = `user-text:${hashText(artifact.text).slice(0, 20)}`;
  const raw = files[activityFile] + `\n<!-- learning-entry:start id=request_pending_C -->\n> ${pendingText}\n`;
  await writeFile(path.join(root, activityFile), raw);
  snapshot.currentTask = { ...task, evidenceRefs: [activityFile, id] };
  snapshot.fileHashes = { [activityFile]: hashText(raw) };
  snapshot.artifactCatalog = { [`${task.taskId}:${id}`]: { taskId: task.taskId, id, artifact, activityFile, activityOffset: 100, sourceRequestId: 'request_committed_B' } };
  snapshot.pendingCommits = [{ requestId: 'request_pending_C', hasPreparedTargets: true, targetFiles: [activityFile] }];
  snapshot.warnings = ['存在未完成多文件提交，请核对回执。'];
  const read = () => buildLearningContext({ projectRoot: root, snapshot, payload: { mode: 'progress', message: '继续判断这段的能力表现' },
    sourceReader: new LearningSourceReader({ projectRoot: root, scope: 'isolated' }) });
  const linked = await read();
  assert.ok(linked.systemContext.includes(artifact.text)); assert.ok(!linked.systemContext.includes(pendingText));
  assert.equal(linked.sourceCoverage.some(source => source.sourceKind === 'personal_record'), false);
  assert.match(linked.warnings.join('\n'), /尚未完成提交/);
  const summaries = ['运行记录/阶段安排.md', '运行记录/能力依据.md', '运行记录/课程记录.md', '运行记录/当前状态.md'];
  for (const relative of summaries) await writeFile(path.join(root, relative), files[relative] + '\n' + pendingText);
  snapshot.pendingCommits[0].targetFiles.push(...summaries);
  snapshot.stagePlan = pendingText; snapshot.abilityEvidence = pendingText;
  snapshot.courses[0].reportedProgress = pendingText;
  const partial = await read();
  assert.ok(partial.systemContext.includes(artifact.text)); assert.ok(!partial.systemContext.includes(pendingText));
  assert.match(partial.systemContext, /未完成多文件提交/);
});
