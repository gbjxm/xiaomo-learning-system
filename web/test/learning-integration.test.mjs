import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createLearningServer } from '../server.mjs';
import { runLearningCLI } from '../learning/cli.mjs';

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'learning-http-core-'));
  await fs.mkdir(path.join(root, '运行记录'));
  const files = {
    '当前状态.md': '# 当前状态\n更新日期：2026-10-03。\n- 阶段主攻：尚未选择。\n- 有效安排：尚无。\n- 系统内当次课程学习或练习记录：尚无。\n- 当前停止处：未开始。\n- 下次入口：等待本人请求。\n',
    '阶段安排.md': '# 阶段安排\n## 月或阶段\n尚无。\n## 本周\n尚无。\n## 当次或当天\n尚无。\n## 已采用的改进\n尚无。\n',
    '课程记录.md': '# 课程记录\n| 编号 | 课程 | 进度 | 停点 | 依据 |\n|---|---|---|---|---|\n| C001 | 测试编剧课 | 第六或第七课未知 | 待确认 | 隔离 |\n| C002 | 测试分镜课 | 未知 | 待确认 | 隔离 |\n',
    '能力依据.md': '# 能力依据\n尚无实际证据。\n', '个人情况.md': '# 个人情况\n## 使用偏好\n按需帮助。\n', '观影记录.md': '# 观影记录\n尚无。\n',
  };
  for (const [name, content] of Object.entries(files)) await fs.writeFile(path.join(root, '运行记录', name), content);
  await fs.writeFile(path.join(root, '运行约定.md'), '# 运行约定\n明确请求的计划保存为待执行，普通答疑不自动记录。');
  const calls = [];
  const sourceReader = { async read({ artifact }) { return { sources: artifact ? [{ id: 'artifact:current', title: '隔离文字', content: artifact.text, sourceKind: 'user_text', authorship: 'user_provided', coverage: 'document', limitations: [] }] : [], warnings: [], capabilities: { text: true } }; } };
  const providerAdapter = { kind: 'mock', async complete(_messages, { payload, task }) {
    calls.push(payload.requestId);
    return '隔离实际回复：先检查这一处行动连接。\n<learning_updates>' + JSON.stringify({ version: 1, saveReason: payload.mode === 'wrap' ? 'wrap' : 'plan', task: { title: '行动应用', purpose: task?.purpose ?? '观察行动如何接到结果', courseId: 'C002', observationPoints: ['行动连接'], allowedHelp: 'AI解释', stopPoint: payload.mode === 'wrap' ? payload.message : '', nextStep: '继续同一处文字', status: payload.mode === 'wrap' ? 'paused' : 'planned' }, facts: [], observations: [], candidates: [], adoptedChanges: [] }) + '</learning_updates>';
  } };
  let server;
  async function open() {
    server = createLearningServer({ projectRoot: root, unified: false, learningScope: 'isolated', env: { WORKSPACE_MODE: 'isolated' }, providerAdapter, sourceReader });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    return 'http://127.0.0.1:' + server.address().port;
  }
  async function close() { server.closeAllConnections?.(); await new Promise(resolve => server.close(resolve)); }
  t.after(async () => { if (server?.listening) await close(); const canonical = await fs.realpath(root); const canonicalTemp = await fs.realpath(os.tmpdir()); assert.ok(path.relative(canonicalTemp, canonical).startsWith('learning-http-core-')); await fs.rm(canonical, { recursive: true }); });
  return { root, open, close, calls };
}
async function ask(origin, payload) {
  const response = await fetch(origin + '/api/learning/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(payload) });
  return { status: response.status, body: await response.json() };
}

test('HTTP课程任务归属、完整回执、重启后同请求与下一次收尾共用一项任务', async t => {
  const f = await fixture(t); let origin = await f.open();
  const firstPayload = { requestId: 'http-plan-0001', message: '帮我安排这一处文字练习。', mode: 'plan', history: [], context: { courseId: 'C001', chapter: 2 } };
  const first = await ask(origin, firstPayload);
  assert.equal(first.status, 200); assert.equal(first.body.saved, true);
  assert.equal(first.body.task.courseId, 'C001');
  assert.equal(first.body.task.goalRevision, 1);
  const receipt = await (await fetch(origin + '/api/learning/requests/http-plan-0001')).json();
  assert.equal(receipt.status, 'committed'); assert.match(receipt.response.reply, /隔离实际回复/);
  assert.equal(receipt.response.task.taskId, first.body.task.taskId);
  await f.close(); origin = await f.open();
  const retried = await ask(origin, firstPayload);
  assert.match(retried.body.reply, /隔离实际回复/); assert.match(retried.body.reply, /此前已记下/);
  assert.equal(f.calls.length, 1);
  const wrap = await ask(origin, { requestId: 'http-wrap-0001', message: '今天先到这里，动作之后的结果仍待核对。', mode: 'wrap', history: [], context: { taskId: first.body.task.taskId, courseId: 'C001' } });
  assert.equal(wrap.status, 200); assert.equal(wrap.body.task.taskId, first.body.task.taskId); assert.equal(wrap.body.task.goalRevision, 1);
  const boot = await (await fetch(origin + '/api/learning/bootstrap')).json();
  assert.equal(boot.currentTasks.length, 1); assert.match(boot.resumePoints[0].stopPoint, /结果仍待核对/);
});

test('网页只聊不记没有业务记录，读取回执不存在；HTTP不能打开隔离真实模型', async t => {
  const f = await fixture(t), origin = await f.open();
  const result = await ask(origin, { requestId: 'http-nosave-0001', message: '帮我安排一下，但这次不要保存。', mode: 'plan', history: [], skipSave: true, context: { courseId: 'C001' } });
  assert.equal(result.body.saved, false);
  for (const name of ['.学习提交', '学习记录']) await assert.rejects(fs.stat(path.join(f.root, '运行记录', name)), { code: 'ENOENT' });
  assert.equal((await fetch(origin + '/api/learning/requests/http-nosave-0001')).status, 404);
  await f.close();
  const denied = createLearningServer({ projectRoot: f.root, learningScope: 'isolated', unified: false, env: { WORKSPACE_MODE: 'isolated' } });
  await new Promise(resolve => denied.listen(0, '127.0.0.1', resolve));
  try { const blocked = await ask('http://127.0.0.1:' + denied.address().port, { requestId: 'http-denied-0001', mode: 'question', message: '测试', history: [], mock: true }); assert.equal(blocked.status, 403); }
  finally { denied.closeAllConnections?.(); await new Promise(resolve => denied.close(resolve)); }
});

test('Codex CLI与网页对不存在任务使用同一身份检查，不另建任务', async t => {
  const f = await fixture(t), input = path.join(f.root, 'input.json');
  const payload = { requestId: 'cli-unknown-0001', message: '这项先到这里。', mode: 'wrap', history: [], context: { taskId: 'task_does_not_exist_001', courseId: 'C001' } };
  await fs.writeFile(input, JSON.stringify({ payload, reply: '实际回复', updates: { version: 1, saveReason: 'wrap', task: { title: '不能静默建另一任务' } }, structured: true }));
  await assert.rejects(runLearningCLI(['commit', '--input', input, '--project-root', f.root, '--scope', 'isolated'], { stdout() {} }), error => error.code === 'TASK_UNAVAILABLE');
  const origin = await f.open(), result = await ask(origin, payload); assert.equal(result.status, 409); assert.match(result.body.reply, /任务未找到/);
  await assert.rejects(fs.stat(path.join(f.root, '运行记录/学习记录')), { code: 'ENOENT' });
});

test('当前原话点名另一课程时先解决对象冲突，不把错误课程写进任务', async t => {
  const f = await fixture(t), origin = await f.open();
  const result = await ask(origin, { requestId: 'http-wrongcourse-0001', message: '我想接着老白的分镜课，帮我安排。', mode: 'plan', history: [], context: { courseId: 'C001' } });
  assert.equal(result.status, 409); assert.match(result.body.reply, /点名的课程与页面所选课程不同/); assert.equal(f.calls.length, 0);
  await assert.rejects(fs.stat(path.join(f.root, '运行记录/学习记录')), { code: 'ENOENT' });
});
