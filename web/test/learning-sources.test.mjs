import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink, realpath } from 'node:fs/promises';
import { LearningSourceReader } from '../learning/sources.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const NOTE = `---
类型: 分集笔记
材料类型: Bilibili课级笔记
课程: 查理老师的编剧课
状态: 已整理
完整程度: 图文正文已复核；原声未审
---
# 查理老师的编剧课 - 第二课 故事的要素

## 核心原理
人物、事件、主题相互制约；人物的欲望与恐惧决定行动，阻力迫使人物选择。
### 从欲望和恐惧形成事件
不能把人物的标签代替因果；应说明具体想得到什么、为何害怕、实际怎样行动。

## 方法与适用条件
先看本次故事是否需要此检查。八要素服务于组织人物与事件，不是机械填表或保证故事好看的公式。
选择、后果和价值变化必须由具体情境支持；主题不能只写成一句口号。

## 来源可靠性与边界
这是原课图文整理。没有连续审看影片，不据此认证镜头节奏或原声表演。

## 练习建议
请自主决定是否尝试，不把推荐变成已完成练习。
`;

async function fixture(t, options = {}) {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'learning-sources-')));
  const workspace = path.join(root, 'knowledge'); const vault = path.join(workspace, 'vault');
  const learning = path.join(vault, '知识库', '学习区'); const skills = path.join(workspace, 'skills');
  const course = path.join(learning, '课程', '查理老师的编剧课');
  const configPath = path.join(workspace, '.codex', 'knowledge-tree.json');
  await Promise.all([mkdir(course, { recursive: true }), mkdir(skills, { recursive: true }), mkdir(path.dirname(configPath), { recursive: true })]);
  await writeFile(configPath, '{"version":2}', 'utf8');
  const filename = path.join(course, '02 - 第二课 故事的要素（P5-P6）.md');
  await writeFile(filename, options.note ?? NOTE, 'utf8');
  await writeFile(path.join(course, '查理老师的编剧课.md'), '旧统一总结：虚假的万能公式。');
  await writeFile(path.join(course, '02 - 第二课 历史记录.md'), '历史个人记录。');
  const calls = [];
  const config = { version: 2, workspace, vault, learning_root: learning, skills_root: skills, config_path: configPath };
  const spawnImpl = (_command, args, spawnOptions) => {
    const child = new EventEmitter(); child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.kill = () => {};
    calls.push({ args, options: spawnOptions });
    queueMicrotask(async () => {
      try {
        const script = args[3]; let result; let code = 0;
        if (script.endsWith('knowledge_tree_config.py')) result = config;
        else if (script.endsWith('retrieve_knowledge.py')) {
          if (options.retrievalFails) code = 2;
          result = { candidates: [{ path: path.join(vault, '知识库', '创作区', '错误概论.md'), title: '默认创作结果', core: '不得采用这个概论代课文' }],
            source_candidates: [{ path: filename, method_chunks: [] }], snapshot: 'fixture-corpus', scope: { include_paths: [filename] } };
          if (options.mutateDuringRead) await writeFile(filename, `${NOTE}\n新版本内容。`);
        } else {
          const heading = args[args.indexOf('--heading') + 1]; const raw = await readFile(filename); const markdown = raw.toString('utf8');
          const needle = `## ${heading}\n`; const start = markdown.indexOf(needle) + needle.length;
          const next = markdown.indexOf('\n## ', start); const content = markdown.slice(start, next === -1 ? undefined : next + 1);
          result = { path: filename, heading, document_hash: hash(raw), snapshot: 'fixture-corpus', scope: { include_paths: [filename] },
            content, truncated: false, read_required: false };
        }
        child.stdout.end(JSON.stringify(result)); child.emit('close', code);
      } catch (error) { child.emit('error', error); }
    });
    return child;
  };
  t.after(() => rm(root, { recursive: true, force: true }));
  return { root, configPath, filename, course, calls, reader: new LearningSourceReader({ projectRoot: root, knowledgeConfig: configPath, scope: 'fixture', spawnImpl }) };
}

test('中文“查理第二课”读到正式正文的因果原理和适用条件，而非旧总结或默认创作摘要', async t => {
  const { reader, calls, filename } = await fixture(t);
  const result = await reader.read({ message: '解释查理第二课怎样从欲望和恐惧组织完整故事' });
  const content = result.sources.map(item => item.content).join('\n');
  assert.match(content, /人物、事件、主题相互制约/, result.warnings.join('\n'));
  assert.match(content, /不是机械填表或保证故事好看的公式/);
  assert.doesNotMatch(content, /虚假的万能公式|不得采用这个概论/);
  assert.ok(result.sources.every(item => item.path === filename && item.coverage === 'section' && item.documentHash.length === 64));
  assert.ok(result.sources.every(item => item.lineStart > 0 && item.lineEnd >= item.lineStart));
  const retrieval = calls.find(item => item.args.some(arg => arg.endsWith('retrieve_knowledge.py')));
  assert.ok(retrieval.args.includes('--no-cache'));
  assert.equal(retrieval.args[retrieval.args.indexOf('--include-path') + 1], filename);
  assert.deepEqual(retrieval.args.slice(0, 3), ['-B', '-X', 'utf8']);
  assert.ok(calls.some(item => item.args.some(arg => arg.endsWith('read_knowledge_section.py'))));
  assert.match(result.warnings.join('\n'), /版本尚未核实/);
});

test('阿拉伯数字课次和已有正式章节身份可重读，同名缺失章节明确拒绝', async t => {
  const { reader } = await fixture(t);
  const initial = await reader.read({ courseId: 'C001', chapter: 2, message: '故事要素' });
  const chosen = initial.sources.find(item => item.heading === '核心原理');
  assert.ok(chosen);
  const resumed = await reader.read({ selectedSource: chosen.id, message: '继续这一章' });
  assert.ok(resumed.sources.some(item => item.id === chosen.id));
  const absent = await reader.read({ selectedSource: { courseId: 'C001', chapter: 2, heading: '不存在的章' } });
  assert.equal(absent.sources.length, 0);
  assert.match(absent.warnings.join('\n'), /不存在或不唯一/);
});

test('未知课次与影视飓风版本不猜，不调用知识工具或虚构学习进度', async t => {
  const { reader, calls } = await fixture(t);
  const unspecified = await reader.read({ courseId: 'C001', message: '继续查理的课' });
  const missing = await reader.read({ courseId: 'C003', chapter: 2, message: '影视飓风剪辑课' });
  assert.equal(unspecified.sources.length, 0); assert.equal(missing.sources.length, 0); assert.equal(calls.length, 0);
  assert.match(unspecified.warnings.join('\n'), /没有按历史模糊停点猜测/);
  assert.match(missing.warnings.join('\n'), /未绑定正式正文/);
});

test('任意路径及旧summary选择被拒绝，输入无法驱动本机文件读取', async t => {
  const { reader, calls, filename } = await fixture(t);
  for (const selectedSource of [filename, { path: filename, courseId: 'C001', chapter: 2 }, 'summary:C001:2']) {
    const result = await reader.read({ selectedSource, message: '查理第二课' });
    assert.equal(result.sources.length, 0); assert.ok(result.warnings.length);
  }
  assert.equal(calls.length, 0);
});

test('检索失败允许唯一指定的≤24000字符完整课文后备，保留真实哈希和限制', async t => {
  const { reader, filename } = await fixture(t, { retrievalFails: true });
  const result = await reader.read({ message: '查理第2课' });
  assert.equal(result.sources.length, 1); const source = result.sources[0];
  assert.equal(source.coverage, 'document'); assert.equal(source.content, NOTE);
  assert.equal(source.documentHash, hash(await readFile(filename)));
  assert.match(source.limitations.join('\n'), /完整课文作为受控后备/);
  assert.match(result.warnings.join('\n'), /未完成读取/);
});

test('媒体引用只交接、转录只按文字判断，没有听审或视频能力承诺', async t => {
  const { reader, calls } = await fixture(t);
  const media = await reader.read({ artifact: { kind: 'media_reference', title: '小样', version: 'v01', text: '本地视频引用' } });
  assert.equal(media.sources.length, 0); assert.equal(media.handoff.version, 'v01');
  assert.deepEqual(media.capabilities, { text: true, image: false, audio: false, video: false });
  const transcript = await reader.read({ artifact: { kind: 'transcript', title: '口述草稿', text: '我的理解是人物选择推动变化。' } });
  assert.equal(transcript.sources[0].sourceKind, 'user_text');
  assert.match(transcript.sources[0].limitations.join('\n'), /未听原录音/);
  assert.equal(calls.length, 0);
});

test('读取期间正式课文改变时撤回旧课程依据', async t => {
  const { reader } = await fixture(t, { mutateDuringRead: true });
  const result = await reader.read({ message: '查理第二课' });
  assert.equal(result.sources.length, 0);
  assert.match(result.warnings.join('\n'), /版本变化/);
});

test('文字材料保留实际帮助和作者条件，AI稿可分析但不冒充用户独立完成', async t => {
  const { reader } = await fixture(t);
  const result = await reader.read({ artifact: { kind: 'text', text: '这段由AI起草，用户尚未修改。', authorship: 'ai_generated', origin: 'ai_generated', helpLevel: 'AI完整起草' } });
  assert.equal(result.sources[0].sourceKind, 'user_text');
  assert.equal(result.sources[0].authorship, 'ai_generated');
  assert.equal(result.sources[0].origin, 'ai_generated');
  assert.equal(result.sources[0].helpLevel, 'AI完整起草');
});

test('正式课级文件名不足以证明身份，历史或错误metadata不读作正式课程', async t => {
  const { reader } = await fixture(t, { note: NOTE.replace('类型: 分集笔记', '类型: 历史记录') });
  const result = await reader.read({ message: '查理第2课' });
  assert.equal(result.sources.length, 0); assert.match(result.warnings.join('\n'), /不是当前有效的正式课级笔记/);
});

test('课程目录的符号链接越出学习分区时拒绝', async t => {
  const { reader, root, course } = await fixture(t);
  const external = path.join(root, 'outside'); await mkdir(external); await writeFile(path.join(external, '02 - 第二课 错误来源.md'), NOTE);
  await rm(course, { recursive: true }); await symlink(external, course, process.platform === 'win32' ? 'junction' : 'dir');
  const result = await reader.read({ message: '查理第2课' });
  assert.equal(result.sources.length, 0); assert.match(result.warnings.join('\n'), /越出已确认学习范围/);
});

test('指代和课程数量不是序数，未知停点不读取第一课或数量对应课文', async t => {
  const { reader, calls } = await fixture(t);
  for (const message of ['我想复习老白上次那一课。', '继续这一课', '复习前一课', '我看了三课', '今天上了两节']) {
    const result = await reader.read({ courseId: 'C001', message });
    assert.equal(result.sources.length, 0, message);
    assert.match(result.warnings.join('\n'), /具体课次尚未确定/, message);
  }
  assert.equal(calls.length, 0, '不能用未知停点驱动知识工具读取');
});

test('多个明确课次或省略单位的课次范围保持未定，不默选第一或最后一课', async t => {
  const { reader, calls } = await fixture(t);
  for (const message of ['第六/第七课', '第六或第七课', '第二、三课', '第2-3课', '第二课和第三课', '先看第二课，之后是第三课']) {
    const result = await reader.read({ courseId: 'C001', message });
    assert.equal(result.sources.length, 0, message);
    assert.match(result.warnings.join('\n'), /多个课次/, message);
  }
  assert.equal(calls.length, 0, '多课次未选定时不读取任意一课');
});

test('唯一明确第N课正常定位，结构化已选身份仍可消解文字中的多课次', async t => {
  const { reader, filename } = await fixture(t);
  for (const input of [
    { message: '复习查理第二课' },
    { message: '复习查理第2节' },
    { message: '复习查理第 二 课' },
    { message: '第二课的原理，再看看第二课的边界' },
    { message: '第二/第三课', courseId: 'C001', chapter: 2 },
    { message: '第二/第三课', selectedSource: 'course:C001:2' },
    { message: '上次那一课', selectedSource: { courseId: 'C001', chapter: 2 } },
  ]) {
    const result = await reader.read({ courseId: 'C001', ...input });
    assert.ok(result.sources.length > 0, JSON.stringify(input) + result.warnings.join('\n'));
    assert.ok(result.sources.every(source => source.path === filename && source.id.startsWith('course:C001:2')));
  }
});
