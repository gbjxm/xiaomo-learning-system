import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { LearningRepository, LEARNING_ROOT, encodeTaskMetadata, encodeSourceMetadata } from '../learning/records.mjs';

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'xiaomo-learning-records-'));
  await fs.mkdir(path.join(root, '运行记录/学习记录'), { recursive: true });
  for (const name of ['个人情况', '当前状态', '阶段安排', '课程记录', '观影记录', '能力依据']) await fs.copyFile(path.join(LEARNING_ROOT, '运行记录', name + '.md'), path.join(root, '运行记录', name + '.md'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const repository = new LearningRepository({ projectRoot: root, scope: 'isolated' });
  return { root: repository.root, repository };
}
const task = (fields = {}) => ({ taskId: 'task_records_0001', goalRevision: 1, title: '查理课的一段文字', purpose: '看清人物欲望与阻力', courseId: 'C001', allowedHelp: '先自行写，AI反馈', observationPoints: ['行动是否改变局面'], knownPerformance: '', stopPoint: '写到人物选择', nextStep: '补一个具体行动', status: 'paused', evidenceRefs: ['artifact:current'], candidates: [], updatedAt: '2026-10-03T05:00:00.000Z', lastRequestId: 'request-records-001', ...fields });

test('courses preserve current reported uncertainty; GET snapshot creates no journals or tasks', async t => {
  const { root, repository } = await fixture(t), result = await repository.snapshot();
  assert.equal(result.courses.length, 3); assert.match(result.courses[1].reportedProgress, /第六或第七节/); assert.equal(result.courses[0].sourceBindingStatus, 'unverified');
  assert.deepEqual(result.tasks, []); assert.equal(result.currentTask, null); assert.equal(result.fileHashes['运行记录/课程记录.md'].length, 64);
  await assert.rejects(fs.access(path.join(root, '运行记录/.学习提交')), { code: 'ENOENT' });
});
test('task read model merges latest metadata without inventing legacy task ids; sources retain exact locations', async t => {
  const { root, repository } = await fixture(t);
  await fs.writeFile(path.join(root, '运行记录/学习记录/2026-10-01.md'), '# 旧记录\n这里只是过去自述。\n');
  await fs.writeFile(path.join(root, '运行记录/学习记录/2026-10-02.md'), encodeTaskMetadata(task()) + '\n');
  const newer = task({ nextStep: '先改人物的决定', updatedAt: '2026-10-03T06:00:00.000Z', lastRequestId: 'request-records-002' });
  await fs.writeFile(path.join(root, '运行记录/学习记录/2026-10-03.md'), encodeTaskMetadata(newer) + '\n' + encodeSourceMetadata([{ id: 'course:charlie:2', path: '学习区/查理/第2课.md', heading: '八要素', hash: 'a'.repeat(64), lines: [14, 32], scope: 'formal_current' }]));
  const result = await repository.snapshot(); assert.equal(result.tasks.length, 1); assert.equal(result.currentTask.nextStep, '先改人物的决定');
  assert.equal(result.sourceCatalog['course:charlie:2'].heading, '八要素'); assert.deepEqual(result.sourceCatalog['course:charlie:2'].lines, [14, 32]);
  assert.equal((await repository.readTask(newer.taskId)).lastRequestId, 'request-records-002'); assert.equal(await repository.readTask('task_missing_0001'), null);
});
test('recordVersion changes when relevant files change, and goal revision cannot roll backward', async t => {
  const { root, repository } = await fixture(t), first = await repository.snapshot();
  await fs.appendFile(path.join(root, '运行记录/能力依据.md'), '\n仅本次文字观察。\n');
  const second = await repository.snapshot(); assert.notEqual(first.recordVersion, second.recordVersion);
  await fs.writeFile(path.join(root, '运行记录/学习记录/2026-10-03.md'), encodeTaskMetadata(task({ goalRevision: 2 })) + '\n' + encodeTaskMetadata(task({ goalRevision: 1 })));
  const result = await repository.snapshot(); assert.equal(result.currentTask.goalRevision, 2); assert.match(result.warnings.join(' '), /倒退/);
});
test('incomplete multi-file commit metadata is not exposed as a committed task', async t => {
  const { root, repository } = await fixture(t), item = task();
  await fs.mkdir(path.join(root, '运行记录/.学习提交'));
  await fs.writeFile(path.join(root, '运行记录/.学习提交/' + item.lastRequestId + '.json'), JSON.stringify({ version: 1, requestId: item.lastRequestId, projectRoot: root, scope: 'isolated', status: 'interrupted', targets: [{ relative: '运行记录/课程记录.md' }] }));
  await fs.writeFile(path.join(root, '运行记录/学习记录/2026-10-03.md'), encodeTaskMetadata(item));
  const result = await repository.snapshot(); assert.equal(result.currentTask, null); assert.equal(result.pendingCommits[0].status, 'interrupted'); assert.match(result.warnings.join(' '), /未完成/);
});
test('production and isolated roots cannot be interchanged or redirected by symlinks', async t => {
  const { root, repository } = await fixture(t);
  assert.throws(() => new LearningRepository({ projectRoot: root, scope: 'production' }), /固定目录/);
  assert.throws(() => new LearningRepository({ projectRoot: LEARNING_ROOT, scope: 'isolated' }), /不能使用正式根/);
  const original = path.join(root, '运行记录/课程记录.md'), elsewhere = path.join(root, 'course-original.md');
  await fs.rename(original, elsewhere);
  try { await fs.symlink(elsewhere, original, 'file'); } catch (error) { if (error.code === 'EPERM') { t.diagnostic('OS forbids file symlink; root guards still checked.'); return; } throw error; }
  await assert.rejects(repository.snapshot(), /符号链接|重定向/);
});
test('a Windows junction inside an allowed fixture cannot redirect learning reads', async t => {
  const { root, repository } = await fixture(t), original = path.join(root, '运行记录'), moved = path.join(root, 'original-records');
  await fs.rename(original, moved);
  await fs.symlink(moved, original, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(repository.snapshot(), /符号链接|重定向/);
});
test('quoted, fenced and inline-AI metadata examples never become authoritative task or source records', async t => {
  const { root, repository } = await fixture(t), quoted = task({ taskId: 'task_quoted_example' }), fenced = task({ taskId: 'task_fenced_example' }), inline = task({ taskId: 'task_inline_example' }), actual = task({ taskId: 'task_actual_writer' });
  const fakeSources = encodeSourceMetadata([{ id: 'source:example-only', path: 'untrusted/example.md' }]), realSources = encodeSourceMetadata([{ id: 'source:actual', path: 'formal/current-course.md', heading: '人物行动', hash: 'b'.repeat(64) }]);
  await fs.writeFile(path.join(root, '运行记录/学习记录/2026-10-03.md'), ['# 学习记录', '> ' + encodeTaskMetadata(quoted), '> ' + fakeSources, '```markdown', encodeTaskMetadata(fenced), fakeSources, '```', '- AI 当次回应要点（模型建议，节选）：' + encodeTaskMetadata(inline), '- 来源示例：' + fakeSources, encodeTaskMetadata(actual), realSources].join('\r\n'));
  const snapshot = await repository.snapshot(); assert.deepEqual(snapshot.tasks.map(task => task.taskId), [actual.taskId]); assert.equal(snapshot.sourceCatalog['source:example-only'], undefined); assert.equal(snapshot.sourceCatalog['source:actual'].heading, '人物行动');
});
