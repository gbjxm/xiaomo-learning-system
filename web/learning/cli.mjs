import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LearningRepository, LEARNING_ROOT } from './records.mjs';
import { LearningCommitter } from './commit.mjs';
import { LearningSourceReader } from './sources.mjs';
import { buildLearningContext } from './context.mjs';
import { validateLearningContext, learningSaveKind, suppressSave, resolveLearningTask } from './coordinator.mjs';
import { parseModelResponse, validateUpdates } from './protocol.mjs';

const HELP = `小陌学习模块 CLI（只读命令不初始化数据）
node web/learning/cli.mjs snapshot
node web/learning/cli.mjs task <taskId>
node web/learning/cli.mjs notes
node web/learning/cli.mjs note <noteId>
node web/learning/cli.mjs request <requestId>
node web/learning/cli.mjs context --input <请求JSON文件>
node web/learning/cli.mjs sources --input <请求JSON文件>
node web/learning/cli.mjs commit --input <提交JSON文件>
node web/learning/cli.mjs recover
隔离测试追加 --project-root <完整隔离副本> --scope isolated；正式根固定，不接受任意写入目标。
请求格式：{message,mode,requestId,history:[],skipSave?,context?:{taskId,courseId,chapter,artifact},expectedRecordVersion?}
提交格式：{payload:<请求>,reply:<实际答复>,updates?:<受限更新候选>,structured?:true,kind?:plan/progress/wrap/review,contextSnapshot?,sourceCoverage?}。
仅保存学习笔记：{payload:<请求>,reply:<实际答复>,kind:"note",note:{noteId?,title?,courseId?,chapter?,occurredOn?,action:"append"|"correct"},contextSnapshot?}。笔记不创建任务或改写个人摘要；追加/更正需先readNote核对同一编号。
commit 不调用模型，不编辑正式作品或知识树；事实、采用和观察须能追到原话或实际材料。`;

export async function runLearningCLI(argv, { stdout = value => process.stdout.write(value + '\n') } = {}) {
  const args = [...argv], command = args.shift() ?? 'help', positional = [], options = {};
  while (args.length) {
    const arg = args.shift();
    if (arg.startsWith('--')) {
      if (!['--input', '--project-root', '--scope'].includes(arg) || !args.length || options[arg] !== undefined) throw new Error('未知、重复或缺值的参数：' + arg);
      options[arg] = args.shift();
    } else positional.push(arg);
  }
  if (['help', '--help', '-h'].includes(command)) { stdout(HELP); return; }
  const projectRoot = options['--project-root'] ? path.resolve(options['--project-root']) : LEARNING_ROOT;
  const scope = options['--scope'] ?? 'production';
  const repository = new LearningRepository({ projectRoot, scope }), committer = new LearningCommitter({ projectRoot, scope, repository });
  const input = async () => {
    if (!options['--input']) throw new Error('此命令需要 --input JSON 文件。');
    const file = path.resolve(options['--input']), stat = await fs.stat(file);
    if (!stat.isFile() || stat.size > 512 * 1024) throw new Error('输入须为不超过512KiB的JSON文件。');
    return JSON.parse((await fs.readFile(file, 'utf8')).replace(/^\uFEFF/, ''));
  };
  const payloadOf = raw => {
    const p = raw?.payload ?? raw;
    if (!p || typeof p.message !== 'string' || !p.message.trim() || p.message.length > 16000 || !['chat', 'plan', 'question', 'progress', 'wrap'].includes(p.mode) || !/^[A-Za-z0-9_-]{8,128}$/.test(p.requestId ?? '') || !Array.isArray(p.history ?? [])) throw new Error('请求格式不正确。');
    return { ...p, history: p.history ?? [], skipSave: suppressSave(p), context: validateLearningContext(p.context) };
  };
  let result;
  if (command === 'snapshot') result = await repository.snapshot();
  else if (command === 'task') { result = await repository.readTask(positional[0]); if (!result) throw new Error('学习任务未找到。'); }
  else if (command === 'notes') result = { notes: (await repository.snapshot()).notes };
  else if (command === 'note') { result = await repository.readNote(positional[0]); if (!result) throw new Error('学习笔记未找到。'); }
  else if (command === 'request') result = await committer.lookup(positional[0]);
  else if (command === 'recover') result = await committer.recover();
  else if (command === 'sources' || command === 'context') {
    const p = payloadOf(await input()), snapshot = await repository.snapshot({ taskId: p.context?.taskId, courseId: p.context?.courseId });
    const task = await resolveLearningTask(repository, snapshot, p);
    const reader = new LearningSourceReader({ projectRoot, scope });
    result = await buildLearningContext({ projectRoot, payload: p, snapshot, task, sourceReader: reader, scope });
    if (command === 'sources') result = { sources: result.sources, sourceCoverage: result.sourceCoverage, warnings: result.warnings, handoff: result.handoff };
  } else if (command === 'commit') {
    const raw = await input(), payload = payloadOf(raw), snapshot = await repository.snapshot({ taskId: payload.context?.taskId, courseId: payload.context?.courseId });
    if (raw.kind === 'note') {
      if (typeof raw.reply !== 'string' || raw.reply.length > 24000) throw new Error('笔记AI回应须为不超过24000字符的原始文字。');
      result = await committer.save({ payload, reply: raw.reply, kind: 'note', note: raw.note, contextSnapshot: raw.contextSnapshot ?? { recordVersion: snapshot.recordVersion, fileHashes: snapshot.fileHashes } });
      stdout(JSON.stringify(result, null, 2)); return;
    }
    const task = await resolveLearningTask(repository, snapshot, payload);
    const parsed = raw.updates ? { reply: raw.reply, updates: raw.updates, structured: raw.structured !== false } : parseModelResponse(raw.reply ?? '', { requestId: payload.requestId });
    if (typeof parsed.reply !== 'string' || !parsed.reply.trim() || parsed.reply.length > 24000) throw new Error('提交需要完整的实际文字答复，不超过24000字符。');
    const checked = validateUpdates(parsed.updates, { payload, task, sources: { sources: raw.sourceCoverage ?? [], courses: snapshot.courses }, stagePlan: snapshot.stagePlan });
    const kind = learningSaveKind(payload, checked.updates);
    result = await committer.save({ payload, reply: parsed.reply, updates: checked.updates, structured: parsed.structured && !!checked.updates, contextSnapshot: raw.contextSnapshot ?? { recordVersion: snapshot.recordVersion, fileHashes: snapshot.fileHashes }, kind, task, sourceCoverage: raw.sourceCoverage ?? [] });
    result.warnings = [...new Set([...(result.warnings ?? []), ...(checked.warnings ?? [])])];
  } else throw new Error('未知命令：' + command);
  stdout(JSON.stringify(result, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runLearningCLI(process.argv.slice(2)).catch(error => { process.stderr.write(JSON.stringify({ ok: false, error: error.message, code: error.code ?? 'LEARNING_CLI_ERROR' }) + '\n'); process.exitCode = 1; });
}
