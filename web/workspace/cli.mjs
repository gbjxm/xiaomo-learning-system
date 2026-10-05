import fs from 'node:fs/promises';
import path from 'node:path';
import { WorkspaceStore, WorkspaceError, DEFAULT_WORKSPACE_FILE, PROJECT_ROOT } from './store.mjs';

const args = process.argv.slice(2);
const command = args.shift() || 'help';
const options = {};
try {
  while (args.length) {
    const key = args.shift();
    if (!['--state-file', '--project-root', '--scope', '--file'].includes(key) || !args.length || Object.hasOwn(options, key)) throw new WorkspaceError('WORKSPACE_INVALID_INPUT', 'CLI参数无效或重复。');
    options[key] = args.shift();
  }
  if (command === 'help') {
    process.stdout.write('workspace CLI: init | read | relations | apply | save-state\n' +
      'Options: --state-file ABS --project-root ABS --scope production|isolated --file ABS_JSON\n' +
      'init explicitly creates an empty new store; reads never create files. relations input is a canonical ref. apply/save-state use the complete original envelope.\n');
  } else {
    const store = new WorkspaceStore({ stateFile: options['--state-file'] || DEFAULT_WORKSPACE_FILE, projectRoot: options['--project-root'] || PROJECT_ROOT, scope: options['--scope'] || 'production' });
    let input;
    if (['relations', 'apply', 'save-state'].includes(command)) {
      if (!options['--file'] || !path.isAbsolute(options['--file'])) throw new WorkspaceError('WORKSPACE_INVALID_INPUT', '写入或引用须从绝对路径 --file 读取完整JSON。');
      const stat = await fs.stat(options['--file']);
      if (!stat.isFile() || stat.size > 2 * 1024 * 1024) throw new WorkspaceError('WORKSPACE_INVALID_INPUT', '输入文件无效或超过2MiB。');
      try { input = JSON.parse((await fs.readFile(options['--file'], 'utf8')).replace(/^\uFEFF/, '')); } catch { throw new WorkspaceError('WORKSPACE_INVALID_INPUT', '输入不是有效UTF-8 JSON。'); }
    }
    const data = command === 'init' ? await store.initialize()
      : command === 'read' ? await store.read()
      : command === 'relations' ? await store.listRelations(input)
      : command === 'apply' ? await store.apply(input)
      : command === 'save-state' ? await store.saveState(input)
      : (() => { throw new WorkspaceError('WORKSPACE_INVALID_INPUT', 'CLI命令无效。'); })();
    process.stdout.write(JSON.stringify({ ok: true, data }, null, 2) + '\n');
  }
} catch (error) {
  process.stderr.write(JSON.stringify({ ok: false, error: { code: error.code || 'WORKSPACE_STORAGE_ERROR', message: error.message, retryable: !!error.retryable, details: error.details || {} } }, null, 2) + '\n');
  process.exitCode = error.status === 409 ? 4 : error.status === 404 || error.status === 503 && !error.retryable ? 3 : error.retryable ? 5 : 2;
}
