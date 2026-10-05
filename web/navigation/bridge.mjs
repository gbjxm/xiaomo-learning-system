import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { realpath, readFile } from 'node:fs/promises';

export const DEFAULT_LEARNING_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const DEFAULT_NAVIGATION_ROOT = path.resolve('D:/codex/2026-10-03/new-chat/outputs/小陌的领航室');
const WORKER = fileURLToPath(new URL('./worker.py', import.meta.url));
const MAX_OUTPUT = 8 * 1024 * 1024;
export class NavigationError extends Error {
  constructor(code, message, status = 400, { details = {}, retryable = false } = {}) {
    super(message); this.code = code; this.status = status; this.details = details; this.retryable = retryable;
  }
}
const equal = (a, b) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
const inside = (child, parent) => { const relative = path.relative(parent, child); return relative && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative); };

export async function navigationConfiguration({ projectRoot = DEFAULT_LEARNING_ROOT, env = process.env } = {}) {
  const project = await realpath(projectRoot), mode = env.WORKSPACE_MODE === 'isolated' ? 'isolated' : 'production';
  if (mode === 'production') {
    if (!equal(project, await realpath(DEFAULT_LEARNING_ROOT)) || env.NAVIGATION_ROOT) throw new NavigationError('NAV_INVALID_ROOT', '正式领航只读取显式连接配置；隔离目录不能通过环境覆盖正式入口。', 403);
    const file = await realpath(path.join(project, 'navigation-connection.json'));
    if (!inside(file, project)) throw new NavigationError('NAV_INVALID_ROOT', '领航连接配置必须在个人终端内部。', 403);
    const config = JSON.parse((await readFile(file, 'utf8')).replace(/^\uFEFF/, ''));
    if (config.schemaVersion !== 1 || typeof config.navigationRoot !== 'string' || !path.isAbsolute(config.navigationRoot)) throw new NavigationError('NAV_INVALID_ROOT', '领航连接配置无效。', 503);
    return { projectRoot: project, root: await realpath(config.navigationRoot), mode };
  }
  if (equal(project, await realpath(DEFAULT_LEARNING_ROOT)) || typeof env.NAVIGATION_ROOT !== 'string' || !path.isAbsolute(env.NAVIGATION_ROOT)) throw new NavigationError('NAV_INVALID_ROOT', '隔离领航必须指定独立个人终端和领航目录。', 403);
  const root = await realpath(env.NAVIGATION_ROOT);
  if (!inside(root, project) || equal(root, DEFAULT_NAVIGATION_ROOT)) throw new NavigationError('NAV_INVALID_ROOT', '隔离领航目录必须位于该隔离个人终端内，不能指向正式资料。', 403);
  return { projectRoot: project, root, mode };
}

export function createNavigationBridge({ projectRoot = DEFAULT_LEARNING_ROOT, env = process.env, spawnImpl = spawn, timeoutMs = 15000 } = {}) {
  let configuration;
  // No source file or state is created when the module is mounted or read.
  async function config() {
    if (!configuration) configuration = navigationConfiguration({ projectRoot, env }).catch(error => { configuration = null; throw error; });
    return configuration;
  }
  async function call(command, input = {}) {
    let selected;
    try { selected = await config(); }
    catch (error) { if (error instanceof NavigationError) throw error; throw new NavigationError('NAV_CONNECTION_UNAVAILABLE', '尚未读到领航连接配置或原目录；其他模块可继续使用。', 503); }
    const serialized = JSON.stringify(input);
    if (Buffer.byteLength(serialized) > 96 * 1024) throw new NavigationError('NAV_TOO_LARGE', '领航请求超过96KiB。', 413);
    return new Promise((resolve, reject) => {
      const child = spawnImpl(env.NAVIGATION_PYTHON ?? env.LEARNING_PYTHON_BIN ?? 'python', ['-B', '-X', 'utf8', WORKER, command, '--project-root', selected.projectRoot, '--root', selected.root, '--mode', selected.mode], {
        cwd: selected.projectRoot, windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'], env: { ...env, PYTHONUTF8: '1', PYTHONDONTWRITEBYTECODE: '1' }
      });
      const parts = []; let bytes = 0, complete = false;
      const finish = (error, result) => { if (complete) return; complete = true; clearTimeout(timer); error ? reject(error) : resolve(result); };
      const timer = setTimeout(() => { child.kill(); finish(new NavigationError('NAV_BRIDGE_TIMEOUT', '领航读取或保存未及时返回；保存结果未知时按原记录标识核对，勿新建重复旅程。', 504, { retryable: true })); }, timeoutMs);
      child.on('error', () => finish(new NavigationError('NAV_BRIDGE_UNAVAILABLE', '未能启动已有Python领航桥，请保留原输入。', 503)));
      child.stdout.on('data', chunk => { bytes += chunk.length; if (bytes > MAX_OUTPUT) { child.kill(); finish(new NavigationError('NAV_RESULT_TOO_LARGE', '本次资料超过读取预算，请缩小回看期间。', 413)); } else parts.push(chunk); });
      // Consume stderr without returning environment or credentials to the client.
      child.stderr.on('data', () => {});
      child.stdin.on('error', () => {});
      child.on('close', () => {
        if (complete) return;
        try {
          const result = JSON.parse(Buffer.concat(parts).toString('utf8'));
          if (result.ok !== true) { const error = result.error ?? {}; return finish(new NavigationError(error.code ?? 'NAV_STORE_ERROR', error.message ?? '领航操作未完成。', error.status ?? 503, error)); }
          finish(null, result.data);
        } catch { finish(new NavigationError('NAV_BRIDGE_INVALID_RESULT', '领航桥没有返回完整结果；写入结果未知时请按原标识核对。', 503, { retryable: true })); }
      });
      child.stdin.end(serialized);
    });
  }
  return { call, config };
}
