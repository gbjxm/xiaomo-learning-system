import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { mkdtemp, mkdir, copyFile, cp, readFile, writeFile, rm } from 'node:fs/promises';
import { createLearningServer } from '../server.mjs';

const SOURCE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FIXED_NOW = () => new Date('2026-09-24T06:35:00.000Z');

async function listen(server) {
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${server.address().port}`;
}

async function close(server) {
  server.closeAllConnections?.();
  await new Promise(resolve => server.close(resolve));
}

async function fixture(t, { configured = true, upstreamStatus = 200, upstreamReply = '先看已有片段的镜头衔接，再做一个十分钟文字分镜，最后留五分钟收尾。', cli = null, apiKeyName = 'LEARNING_API_KEY' } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'xiaomo-learning-web-'));
  await mkdir(path.join(root, '运行记录'), { recursive: true });
  await mkdir(path.join(root, 'web/public'), { recursive: true });
  for (const name of ['运行约定.md', '运行记录/个人情况.md', '运行记录/当前状态.md', '运行记录/阶段安排.md', '运行记录/能力依据.md']) {
    await copyFile(path.join(SOURCE_ROOT, name), path.join(root, name));
  }
  await cp(path.join(SOURCE_ROOT, '.agents/skills'), path.join(root, '.agents/skills'), { recursive: true });
  await writeFile(path.join(root, 'web/public/index.html'), '<!doctype html><title>isolated</title>', 'utf8');
  const upstreamCalls = [];
  const upstream = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    upstreamCalls.push({ url: req.url, headers: req.headers, body: JSON.parse(Buffer.concat(chunks).toString('utf8')) });
    res.writeHead(upstreamStatus, { 'Content-Type': 'application/json' });
    res.end(upstreamStatus === 200
      ? JSON.stringify({ choices: [{ message: { content: upstreamReply } }] })
      : JSON.stringify({ error: { message: 'do not relay provider secrets' } }));
  });
  const upstreamUrl = await listen(upstream);
  const appdata = path.join(root, 'fake-appdata');
  const nativeBinary = path.join(appdata, 'npm/node_modules/@openai/codex/node_modules/@openai/codex-win32-x64/vendor/x86_64-pc-windows-msvc/bin/codex.exe');
  if (cli) {
    await mkdir(path.dirname(nativeBinary), { recursive: true });
    await writeFile(nativeBinary, 'fake native binary, never executed', 'utf8');
  }
  const env = configured ? { LEARNING_API_BASE_URL: `${upstreamUrl}/v1`, [apiKeyName]: 'fake-local-secret', LEARNING_API_MODEL: 'fake-learning-model', ...(cli ? { APPDATA: appdata } : {}) }
    : cli ? { APPDATA: appdata, LEARNING_API_KEY: 'must-strip-learning', OPENAI_API_KEY: 'must-strip-openai', CODEX_API_KEY: 'must-strip-codex', OpenAI_Api_Key: 'must-strip-mixed', LEARNING_API_MODEL: 'unavailable-compatible-model', ...(cli.defaultModel ? {} : { LEARNING_CODEX_MODEL: 'fake-codex-model' }) } : {};
  const spawnCalls = [];
  const fakeSpawn = (binary, args, options) => {
    const child = new EventEmitter();
    child.stdin = new PassThrough();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    const observed = { binary, args, options, prompt: '', killed: false };
    spawnCalls.push(observed);
    child.kill = () => { observed.killed = true; queueMicrotask(() => child.emit('close', null)); return true; };
    child.stdin.on('data', chunk => { observed.prompt += chunk.toString('utf8'); });
    child.stdin.on('end', () => {
      if (cli?.neverCompletes) return;
      queueMicrotask(() => {
        child.stderr.write('secret-from-stderr-must-not-leak');
        if (cli?.exitCode === 0 || cli?.exitCode === undefined) {
          child.stdout.write(`${JSON.stringify({ type: 'item.completed', item: { type: 'command_execution', text: 'tool output must not become reply' } })}\n`);
          child.stdout.write(`${JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: cli?.reply ?? '先用已有镜头练一个小样。' } })}\n`);
        }
        child.emit('close', cli?.exitCode ?? 0);
      });
    });
    return child;
  };
  const app = createLearningServer({ projectRoot: root, env, unified: false, now: FIXED_NOW, ...(cli ? { spawnImpl: fakeSpawn, cliTimeoutMs: cli.timeoutMs ?? 90000 } : {}) });
  const appUrl = await listen(app);
  t.after(async () => { await close(app); await close(upstream); await rm(root, { recursive: true, force: true }); });
  return { root, appUrl, upstreamCalls, spawnCalls, nativeBinary };
}

async function chat(appUrl, { message = '今天下午有一个小时，帮我安排镜头衔接学习。', mode = 'plan', requestId = 'request-0001', history = [], skipSave } = {}, headers = {}) {
  const response = await fetch(`${appUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: appUrl, ...headers },
    body: JSON.stringify({ message, mode, requestId, history, skipSave }),
  });
  return { status: response.status, body: await response.json() };
}

test('可读当前状态；配置缺失时聊天明确失败且不会调用上游', async t => {
  const { appUrl, upstreamCalls } = await fixture(t, { configured: false });
  const boot = await (await fetch(`${appUrl}/api/bootstrap`)).json();
  assert.equal(boot.configured, false);
  assert.equal(boot.provider, 'none');
  assert.match(boot.reason, /Codex CLI/);
  assert.equal(typeof boot.state.focus, 'string');
  assert.equal(typeof boot.state.nextStep, 'string');
  assert.match(boot.state.lastActivity, /尚无/);
  const result = await chat(appUrl);
  assert.equal(result.status, 503);
  assert.equal(result.body.saved, false);
  assert.match(result.body.reply, /LEARNING_API_BASE_URL/);
  assert.equal(upstreamCalls.length, 0);
});

test('请求计划保存为待执行；重试不重复写入、也不再次请求上游', async t => {
  const longReply = `先看已有片段的镜头衔接。${'只观察镜头关系，留出休息和收尾。'.repeat(35)}独特尾句不应写入摘要。`;
  const { root, appUrl, upstreamCalls } = await fixture(t, { upstreamReply: longReply });
  const first = await chat(appUrl);
  assert.equal(first.status, 200);
  assert.equal(first.body.saved, true);
  assert.match(first.body.reply, /已记下这次待执行安排/);
  assert.match(first.body.state.planStatus, /待执行/);
  assert.match(first.body.state.focus, /尚未选择/);
  assert.equal(upstreamCalls.length, 1);
  assert.equal(upstreamCalls[0].url, '/v1/chat/completions');
  assert.equal(upstreamCalls[0].headers.authorization, 'Bearer fake-local-secret');
  assert.equal(upstreamCalls[0].body.model, 'fake-learning-model');
  assert.match(upstreamCalls[0].body.messages[0].content, /自然收尾与保存范围/);
  const record = await readFile(path.join(root, '运行记录/学习记录/2026-09-24.md'), 'utf8');
  const stage = await readFile(path.join(root, '运行记录/阶段安排.md'), 'utf8');
  const evidence = await readFile(path.join(root, '运行记录/能力依据.md'), 'utf8');
  assert.match(record, /待执行安排/);
  assert.match(record, /尚未报告执行/);
  assert.match(stage, /\*\*待执行/);
  assert.match(stage, /## 已采用的改进/);
  assert.match(first.body.reply, /独特尾句不应写入摘要/);
  assert.match(record, /独特尾句不应写入摘要/); // Activity stores the full AI response in its own layer.
  assert.match(stage, /独特尾句不应写入摘要/);
  assert.match(evidence, /目前尚无实际学习或练习证据/);
  const duplicate = await chat(appUrl);
  assert.equal(duplicate.body.saved, true);
  assert.match(duplicate.body.reply, /此前已记下/);
  assert.equal(upstreamCalls.length, 1);
  const recordAgain = await readFile(path.join(root, '运行记录/学习记录/2026-09-24.md'), 'utf8');
  assert.equal((recordAgain.match(/learning-entry:start/g) ?? []).length, 1);
  const conflict = await chat(appUrl, { requestId: 'request-0001', message: '换成另一个计划' });
  assert.equal(conflict.status, 409);
  assert.equal(upstreamCalls.length, 1);
});

test('进展记录保留小陌自述来源；停下但没报告活动时不制造真实学习进展', async t => {
  const { root, appUrl } = await fixture(t);
  const progress = await chat(appUrl, { requestId: 'request-0002', mode: 'progress', message: '我看完了镜头衔接课，但交叉轴线这里还是没理解。' });
  assert.equal(progress.body.saved, true);
  assert.match(progress.body.state.lastActivity, /小陌自述/);
  const record = await readFile(path.join(root, '运行记录/学习记录/2026-09-24.md'), 'utf8');
  assert.match(record, /完成、理解与独立掌握仍需分别判断/);
  assert.match(record, /交叉轴线这里还是没理解/);
  const savedState = await readFile(path.join(root, '运行记录/当前状态.md'), 'utf8');
  assert.match(savedState, /^- 系统内当次课程学习或练习记录：.*小陌自述/m);
  assert.doesNotMatch(savedState, /^- 最近真实学习记录：/m);
  const stage = await readFile(path.join(root, '运行记录/阶段安排.md'), 'utf8');
  assert.match(stage, /尚无已制定的当次安排/);

  const { root: secondRoot, appUrl: secondApp } = await fixture(t);
  const wrap = await chat(secondApp, {
    requestId: 'request-0003', mode: 'wrap', message: '今天先到这里。',
    history: [
      { role: 'user', content: '我刚才在看一段对话戏的分镜。' },
      { role: 'assistant', content: '可以先看人物位置。' },
      { role: 'user', content: '这里的轴线我还不确定。' },
    ],
  });
  assert.equal(wrap.body.saved, true);
  assert.match(wrap.body.state.lastActivity, /尚无/);
  const current = await readFile(path.join(secondRoot, '运行记录/当前状态.md'), 'utf8');
  assert.match(current, /今天先到这里/);
  const pauseRecord = await readFile(path.join(secondRoot, '运行记录/学习记录/2026-09-24.md'), 'utf8');
  assert.match(pauseRecord, /请求附带历史中的小陌原话摘录/);
  assert.match(pauseRecord, /轴线我还不确定/);
  assert.doesNotMatch(pauseRecord, /可以先看人物位置/);
});

test('旧版最近真实学习记录栏位仍可读取和保存，且不新增重复栏位', async t => {
  const { root, appUrl } = await fixture(t);
  const statePath = path.join(root, '运行记录/当前状态.md');
  const originalState = await readFile(statePath, 'utf8');
  await writeFile(statePath, originalState.replace(/^(- )系统内当次课程学习或练习记录：[^\r\n]*/m, '$1最近真实学习记录：已有旧版自述摘要。'), 'utf8');
  const boot = await (await fetch(`${appUrl}/api/bootstrap`)).json();
  assert.equal(boot.state.lastActivity, '已有旧版自述摘要。');
  const progress = await chat(appUrl, { requestId: 'request-legacy-state', mode: 'progress', message: '我看完了这节镜头课，但具体运用仍有疑问。' });
  assert.equal(progress.status, 200);
  assert.equal(progress.body.saved, true);
  assert.match(progress.body.state.lastActivity, /小陌自述/);
  const savedState = await readFile(statePath, 'utf8');
  assert.match(savedState, /^- 最近真实学习记录：.*小陌自述/m);
  assert.doesNotMatch(savedState, /^- 系统内当次课程学习或练习记录：/m);
});

test('进展状态栏位缺失时先报错，不追加活动；修复后同一请求只保存一次', async t => {
  const { root, appUrl, upstreamCalls } = await fixture(t);
  const statePath = path.join(root, '运行记录/当前状态.md');
  const originalState = await readFile(statePath, 'utf8');
  const brokenState = originalState.replace(/^- (?:系统内当次课程学习或练习记录|最近真实学习记录)：[^\r\n]*(?:\r?\n|$)/gm, '');
  await writeFile(statePath, brokenState, 'utf8');
  const request = { requestId: 'request-missing-state', mode: 'progress', message: '我看完了镜头课，但轴线这里仍然不懂。' };
  const first = await chat(appUrl, request);
  assert.equal(first.status, 500);
  assert.equal(first.body.saved, false);
  assert.match(first.body.saveError, /当前状态检查未通过，本次尚未执行写入/);
  assert.match(first.body.saveError, /缺少.*栏位/);
  assert.doesNotMatch(first.body.saveError, /可能有部分写入/);
  const recordPath = path.join(root, '运行记录/学习记录/2026-09-24.md');
  await assert.rejects(readFile(recordPath, 'utf8'), { code: 'ENOENT' });
  assert.equal(await readFile(statePath, 'utf8'), brokenState);
  await writeFile(statePath, originalState, 'utf8');
  const retry = await chat(appUrl, request);
  assert.equal(retry.status, 200);
  assert.equal(retry.body.saved, true);
  assert.equal(upstreamCalls.length, 1);
  const record = await readFile(recordPath, 'utf8');
  assert.equal((record.match(/learning-entry:start/g) ?? []).length, 1);
  assert.equal((record.match(/learning-entry:complete/g) ?? []).length, 1);
});

test('保存准备失败不改业务记录；相同 requestId 修复后复用答复且不重复活动', async t => {
  const { root, appUrl, upstreamCalls } = await fixture(t);
  const stagePath = path.join(root, '运行记录/阶段安排.md');
  const originalStage = await readFile(stagePath, 'utf8');
  await writeFile(stagePath, originalStage.replace('## 当次或当天', '## 临时改名'), 'utf8');
  const first = await chat(appUrl, { requestId: 'request-0004' });
  assert.equal(first.status, 500);
  assert.equal(first.body.saved, false);
  assert.match(first.body.reply, /保存没有完成/);
  assert.match(first.body.saveError, /保存准备未完成/);
  const recordPath = path.join(root, '运行记录/学习记录/2026-09-24.md');
  await assert.rejects(readFile(recordPath, 'utf8'), { code: 'ENOENT' });
  await writeFile(stagePath, originalStage, 'utf8');
  const retry = await chat(appUrl, { requestId: 'request-0004' });
  assert.equal(retry.status, 200);
  assert.equal(retry.body.saved, true);
  assert.equal(upstreamCalls.length, 1);
  const repaired = await readFile(recordPath, 'utf8');
  assert.equal((repaired.match(/learning-entry:start/g) ?? []).length, 1);
  assert.equal((repaired.match(/learning-entry:complete/g) ?? []).length, 1);
});

test('上游失败和不保存请求不产生学习记录', async t => {
  const failed = await fixture(t, { upstreamStatus: 500 });
  const result = await chat(failed.appUrl, { requestId: 'request-0005' });
  assert.equal(result.status, 502);
  assert.equal(result.body.saved, false);
  assert.doesNotMatch(result.body.reply, /fake-local-secret|do not relay provider secrets/);
  const normal = await fixture(t);
  const noSave = await chat(normal.appUrl, { requestId: 'request-0006', skipSave: true });
  assert.equal(noSave.body.saved, false);
  const records = path.join(normal.root, '运行记录/学习记录');
  await assert.rejects(readFile(path.join(records, '2026-09-24.md'), 'utf8'), { code: 'ENOENT' });
});

test('普通聊天里的自然进展会记为自述，本次不要记录会被尊重', async t => {
  const { root, appUrl } = await fixture(t);
  const first = await chat(appUrl, {
    requestId: 'request-0008', mode: 'chat',
    message: '我看完这节镜头课了，但轴线还是有些疑惑。',
  });
  assert.equal(first.body.saved, true);
  const record = await readFile(path.join(root, '运行记录/学习记录/2026-09-24.md'), 'utf8');
  assert.match(record, /学习进展/);
  assert.match(record, /仍需分别判断/);
  const second = await chat(appUrl, {
    requestId: 'request-0009', mode: 'progress',
    message: '我做完一个练习了，但这次不要记录。',
  });
  assert.equal(second.body.saved, false);
  const hypothetical = await chat(appUrl, {
    requestId: 'request-0010', mode: 'chat',
    message: '如果我看完这节课了，下一步可以怎样练？',
  });
  assert.equal(hypothetical.body.saved, false);
  const unchanged = await readFile(path.join(root, '运行记录/学习记录/2026-09-24.md'), 'utf8');
  assert.equal((unchanged.match(/learning-entry:start/g) ?? []).length, 1);
});

test('无 Base URL 时发现原生 Codex CLI，使用登录且不把密钥传给子进程', async t => {
  const { root, appUrl, upstreamCalls, spawnCalls, nativeBinary } = await fixture(t, { configured: false, cli: { reply: '先从已有画面挑一个镜头关系，做一小段文字练习。' } });
  const boot = await (await fetch(`${appUrl}/api/bootstrap`)).json();
  assert.equal(boot.configured, true);
  assert.equal(boot.provider, 'codex-cli');
  assert.match(boot.reason, /本机 Codex/);
  const result = await chat(appUrl, { requestId: 'request-cli-01', mode: 'plan' });
  assert.equal(result.status, 200);
  assert.equal(result.body.saved, true);
  assert.match(result.body.reply, /已有画面/);
  assert.equal(upstreamCalls.length, 0);
  assert.equal(spawnCalls.length, 1);
  const call = spawnCalls[0];
  assert.equal(call.binary, nativeBinary);
  for (const value of ['exec', '--ephemeral', '--json', '--skip-git-repo-check', '--ignore-user-config', '-']) assert.ok(call.args.includes(value));
  assert.deepEqual(call.args.slice(call.args.indexOf('-c'), call.args.indexOf('-c') + 2), ['-c', 'approval_policy="never"']);
  assert.deepEqual(call.args.slice(call.args.indexOf('--sandbox'), call.args.indexOf('--sandbox') + 2), ['--sandbox', 'read-only']);
  assert.deepEqual(call.args.slice(call.args.indexOf('--cd'), call.args.indexOf('--cd') + 2), ['--cd', path.join(os.tmpdir(), 'xiaomo-learning-terminal-cli')]);
  assert.deepEqual(call.args.slice(call.args.indexOf('--model'), call.args.indexOf('--model') + 2), ['--model', 'fake-codex-model']);
  assert.ok(call.args.includes('skills.max_context_tokens=128'));
  assert.equal(call.options.windowsHide, true);
  for (const key of ['OPENAI_API_KEY', 'CODEX_API_KEY', 'LEARNING_API_KEY', 'OpenAI_Api_Key']) assert.equal(call.options.env[key], undefined);
  assert.match(call.prompt, /自然收尾与保存范围/);
  assert.match(call.prompt, /今天下午有一个小时/);
  assert.doesNotMatch(call.prompt, /must-strip/);
  const stage = await readFile(path.join(root, '运行记录/阶段安排.md'), 'utf8');
  assert.match(stage, /已有画面/);
});

test('本机 Codex 默认模型不沿用兼容接口模型名', async t => {
  const { appUrl, spawnCalls } = await fixture(t, { configured: false, cli: { defaultModel: true } });
  const boot = await (await fetch(`${appUrl}/api/bootstrap`)).json();
  assert.equal(boot.provider, 'codex-cli');
  assert.equal(boot.model, '默认模型');
  const result = await chat(appUrl, { mode: 'question', requestId: 'request-cli-default', message: '这是一条不保存的连接测试。', skipSave: true });
  assert.equal(result.status, 200);
  assert.equal(spawnCalls.length, 1);
  assert.equal(spawnCalls[0].args.includes('--model'), false);
  assert.equal(spawnCalls[0].options.cwd, path.join(os.tmpdir(), 'xiaomo-learning-terminal-cli'));
});

test('本机 Codex 失败或超时会明确返回，不泄漏 stderr 也不保存', async t => {
  const failed = await fixture(t, { configured: false, cli: { exitCode: 1 } });
  const error = await chat(failed.appUrl, { requestId: 'request-cli-02' });
  assert.equal(error.status, 502);
  assert.equal(error.body.saved, false);
  assert.match(error.body.reply, /本机 Codex/);
  assert.doesNotMatch(error.body.reply, /secret-from-stderr|must-strip/);
  await assert.rejects(readFile(path.join(failed.root, '运行记录/学习记录/2026-09-24.md'), 'utf8'), { code: 'ENOENT' });
  const timed = await fixture(t, { configured: false, cli: { neverCompletes: true, timeoutMs: 20 } });
  const timeout = await chat(timed.appUrl, { requestId: 'request-cli-03' });
  assert.equal(timeout.status, 502);
  assert.match(timeout.body.reply, /未完成/);
  assert.equal(timed.spawnCalls[0].killed, true);
});

test('只设置第三方 Base URL 时不会把全局 OPENAI_API_KEY 发过去', async t => {
  const { appUrl, upstreamCalls, spawnCalls } = await fixture(t, { configured: true, apiKeyName: 'OPENAI_API_KEY', cli: {} });
  const boot = await (await fetch(`${appUrl}/api/bootstrap`)).json();
  assert.equal(boot.configured, false);
  assert.equal(boot.provider, 'none');
  assert.match(boot.reason, /LEARNING_API_KEY/);
  const result = await chat(appUrl, { requestId: 'request-no-key' });
  assert.equal(result.status, 503);
  assert.equal(upstreamCalls.length, 0);
  assert.equal(spawnCalls.length, 0);
});

test('长计划之后仍把已采用改进带入下一次学习上下文', async t => {
  const longPlan = `先做一块可收尾的镜头任务。\n${'这段描述只用于测试长计划的截取边界。'.repeat(400)}\n最后回顾本次困难。`;
  const { root, appUrl, upstreamCalls } = await fixture(t, { upstreamReply: longPlan });
  const plan = await chat(appUrl, { requestId: 'request-long-plan' });
  assert.equal(plan.body.saved, true);
  const stagePath = path.join(root, '运行记录/阶段安排.md');
  const stage = await readFile(stagePath, 'utf8');
  await writeFile(stagePath, stage.replace('目前暂无。实际采用后', '画人物站位草图再排对话镜头：待尝试。实际采用后'), 'utf8');
  const question = await chat(appUrl, { requestId: 'request-long-question', mode: 'question', message: '为什么对话镜头容易跳轴？' });
  assert.equal(question.status, 200);
  const context = upstreamCalls.at(-1).body.messages[0].content;
  assert.ok(context.includes('画人物站位草图再排对话镜头'), '长计划之后仍应带上已采用改进');
  assert.ok(context.includes('本次上下文节选'), '长计划应限制上下文体积并提示节选');
  assert.ok(context.length < 33000);
});

test('兼容 API 优先；日、周、月计划只更新明确请求的范围', async t => {
  const { root, appUrl, upstreamCalls, spawnCalls } = await fixture(t, { configured: true, cli: {}, upstreamReply: '## 第一步\n读一段材料。\n## 第二步\n做小练习。' });
  const boot = await (await fetch(`${appUrl}/api/bootstrap`)).json();
  assert.equal(boot.provider, 'compatible-api');
  await chat(appUrl, { requestId: 'request-scope-01', message: '今天先安排故事起点。' });
  await chat(appUrl, { requestId: 'request-scope-02', message: '明天先安排镜头起点。' });
  let stage = await readFile(path.join(root, '运行记录/阶段安排.md'), 'utf8');
  assert.doesNotMatch(stage, /今天先安排故事起点/);
  assert.match(stage, /明天先安排镜头起点/);
  assert.equal((stage.match(/> ## 第一步/g) ?? []).length, 1);
  assert.match(stage, /## 已采用的改进/);
  await chat(appUrl, { requestId: 'request-scope-03', message: '帮我安排本周镜头学习。' });
  await chat(appUrl, { requestId: 'request-scope-04', message: '帮我安排这个月的剪辑学习。' });
  stage = await readFile(path.join(root, '运行记录/阶段安排.md'), 'utf8');
  assert.match(stage, /## 本周\n\n\*\*待执行/);
  assert.match(stage, /## 月或阶段\n\n\*\*待执行/);
  assert.match(stage, /## 当次或当天\n\n\*\*待执行/);
  assert.match(stage, /## 已采用的改进/);
  const state = await (await fetch(`${appUrl}/api/bootstrap`)).json();
  assert.match(state.state.planStatus, /月或阶段安排待执行/);
  assert.equal(spawnCalls.length, 0);
  assert.equal(upstreamCalls.length, 4);
});

test('Origin、Host 和静态路径受限，密钥不送到浏览器', async t => {
  const { appUrl } = await fixture(t);
  const boot = await (await fetch(`${appUrl}/api/bootstrap`)).text();
  assert.doesNotMatch(boot, /fake-local-secret/);
  const cross = await chat(appUrl, { requestId: 'request-0007' }, { Origin: 'https://unrelated.example' });
  assert.equal(cross.status, 403);
  const source = await fetch(`${appUrl}/server.mjs`);
  assert.equal(source.status, 404);
  const traversal = await fetch(`${appUrl}/%2e%2e%2fserver.mjs`);
  assert.equal(traversal.status, 404);
  const index = await fetch(`${appUrl}/`);
  assert.equal(index.status, 200);
  assert.match(await index.text(), /isolated/);
  assert.match(index.headers.get('content-security-policy'), /connect-src 'self'/);
  const wrongHost = await new Promise((resolve, reject) => {
    const url = new URL(appUrl);
    http.get({ hostname: '127.0.0.1', port: Number(url.port), path: '/api/bootstrap', headers: { Host: `unrelated.example:${url.port}` } }, res => {
      res.resume(); res.on('end', () => resolve(res.statusCode));
    }).on('error', reject);
  });
  assert.equal(wrongHost, 403);
});
