import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtemp, mkdir, copyFile, cp, readFile, writeFile, rm } from 'node:fs/promises';
import { createLearningServer } from '../server.mjs';

const SOURCE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

async function fixture(t, { registries = true } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'xiaomo-learning-context-'));
  await mkdir(path.join(root, '运行记录'), { recursive: true });
  for (const name of ['运行约定.md', '运行记录/个人情况.md', '运行记录/当前状态.md', '运行记录/阶段安排.md']) {
    await copyFile(path.join(SOURCE_ROOT, name), path.join(root, name));
  }
  await cp(path.join(SOURCE_ROOT, '.agents/skills'), path.join(root, '.agents/skills'), { recursive: true });
  if (registries) {
    for (const name of ['课程记录.md', '观影记录.md']) {
      await copyFile(path.join(SOURCE_ROOT, '运行记录', name), path.join(root, '运行记录', name));
    }
  }
  const requests = [];
  const server = createLearningServer({
    unified: false,
    projectRoot: root,
    env: { LEARNING_API_BASE_URL: 'https://learning.invalid/v1', LEARNING_API_KEY: 'isolated-key' },
    fetchImpl: async (_url, options) => {
      requests.push(JSON.parse(options.body));
      return { ok: true, json: async () => ({ choices: [{ message: { content: '隔离检查回复。' } }] }) };
    },
  });
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  const appUrl = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    server.closeAllConnections?.();
    await new Promise(resolve => server.close(resolve));
    await rm(root, { recursive: true, force: true });
  });
  const ask = async requestId => {
    const response = await fetch(`${appUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: appUrl },
      body: JSON.stringify({ message: '按已知课程和观看经历帮助接续。', mode: 'chat', requestId, history: [], skipSave: true }),
    });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.saved, false);
    return requests.at(-1).messages[0].content;
  };
  return { root, requests, ask };
}

test('模型上下文包含个人背景中段及本人报告的课程，不把看完当作掌握', async t => {
  const { root, ask } = await fixture(t);
  const context = await ask('context-mid-0001');
  assert.match(context, /查理/);
  assert.match(context, /十几节/);
  assert.match(context, /第六或第七节/);
  assert.match(context, /影视飓风/);
  assert.match(context, /具体课程版本未核实/);
  assert.match(context, /### 观影记录/);
  assert.match(context, /《蜘蛛侠：平行宇宙》/);
  assert.match(context, /第一、第二季均已看完/);
  for (const name of ['课程记录.md', '观影记录.md']) {
    const registry = await readFile(path.join(root, '运行记录', name), 'utf8');
    assert.ok(registry.length <= 3500);
    assert.ok(context.includes(registry.trim()));
  }
  const profile = await readFile(path.join(root, '运行记录/个人情况.md'), 'utf8');
  assert.ok(profile.length > 1800 && profile.length <= 12000);
  assert.ok(context.includes(profile.trim()));
  assert.match(context, /不代表.*掌握|不代表.*能力|分别判断/);
  await assert.rejects(readFile(path.join(root, '运行记录/学习记录/2026-09-30.md'), 'utf8'), { code: 'ENOENT' });
});

test('课程和观影文件更新后下次请求读取最新值', async t => {
  const { root, ask } = await fixture(t);
  await writeFile(path.join(root, '运行记录/课程记录.md'), '# 隔离课程\n已看第六或第七节，准确停点未知。', 'utf8');
  await writeFile(path.join(root, '运行记录/观影记录.md'), '# 隔离观看\n虚构测试作品甲：只看了片段。', 'utf8');
  const first = await ask('context-new-0001');
  assert.match(first, /准确停点未知/);
  assert.match(first, /虚构测试作品甲：只看了片段/);
  await writeFile(path.join(root, '运行记录/课程记录.md'), '# 隔离课程\n本人确认看到第八节；理解未知。', 'utf8');
  await writeFile(path.join(root, '运行记录/观影记录.md'), '# 隔离观看\n虚构测试作品乙：本人报告已看完。', 'utf8');
  const second = await ask('context-new-0002');
  assert.match(second, /本人确认看到第八节；理解未知/);
  assert.match(second, /虚构测试作品乙：本人报告已看完/);
  assert.doesNotMatch(second, /虚构测试作品甲|准确停点未知/);
});

test('旧项目没有两份新台账时仍能交流，读取不捏造台账', async t => {
  const { ask } = await fixture(t, { registries: false });
  const context = await ask('context-old-0001');
  assert.doesNotMatch(context, /### 课程记录|### 观影记录/);
  assert.match(context, /### 当前状态/);
});

test('超长个人资料和台账明确节选并保持各文件上下文预算', async t => {
  const { root, ask } = await fixture(t);
  await writeFile(path.join(root, '运行记录/个人情况.md'), '个人开头' + '甲'.repeat(30000) + '个人结尾', 'utf8');
  await writeFile(path.join(root, '运行记录/课程记录.md'), '课程开头' + '乙'.repeat(15000) + '课程结尾', 'utf8');
  await writeFile(path.join(root, '运行记录/观影记录.md'), '片单开头' + '丙'.repeat(15000) + '片单结尾', 'utf8');
  const context = await ask('context-cap-0001');
  for (const [label, next, max] of [['个人情况', '当前状态', 12000], ['课程记录', '观影记录', 3500], ['观影记录', '总协调技能', 3500]]) {
    const content = context.split(`### ${label}\n`)[1].split(`\n\n### ${next}\n`)[0];
    assert.ok(content.length <= max, `${label} 超出预算`);
    assert.match(content, /本次上下文节选/);
  }
  assert.match(context, /个人结尾|课程结尾|片单结尾/);
});
