import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { WorkspaceStore, PROJECT_ROOT, DEFAULT_WORKSPACE_FILE, ISOLATION_ROOT } from './store.mjs';

test('new verification round has its own isolated identity and production remains unchanged', async () => {
  const production = await new WorkspaceStore().read();
  const projectRoot = path.join(ISOLATION_ROOT, '工作台路径核验-' + randomUUID(), '隔离运行');
  const stateFile = path.join(projectRoot, '三系统工作台', 'data', 'workspace-state.json');
  const store = new WorkspaceStore({ projectRoot, stateFile, scope: 'isolated' });
  const saved = await store.initialize();
  assert.equal(saved.identity.scope, 'isolated');
  assert.equal(saved.identity.canonicalPath, stateFile);
  assert.notEqual(saved.identity.storeId, production.identity.storeId);
  assert.deepEqual((await store.read()).state, saved.state);
  assert.deepEqual(await new WorkspaceStore().read(), production);
});

test('isolated mode still refuses production, outside verification, another project and other filename', () => {
  const projectRoot = path.join(ISOLATION_ROOT, '路径拒绝核验', '隔离运行');
  const stateFile = path.join(projectRoot, '三系统工作台', 'data', 'workspace-state.json');
  for (const options of [
    { projectRoot: PROJECT_ROOT, stateFile: DEFAULT_WORKSPACE_FILE, scope: 'isolated' },
    { projectRoot: PROJECT_ROOT, stateFile: path.join(PROJECT_ROOT, '验证', '其他', '三系统工作台', 'data', 'workspace-state.json'), scope: 'isolated' },
    { projectRoot, stateFile: path.join(ISOLATION_ROOT, '另一个项目', '三系统工作台', 'data', 'workspace-state.json'), scope: 'isolated' },
    { projectRoot, stateFile: stateFile.replace('workspace-state.json', 'other.json'), scope: 'isolated' },
    { projectRoot, stateFile, scope: 'production' },
  ]) assert.throws(() => new WorkspaceStore(options), error => error.code === 'WORKSPACE_INVALID_PATH');
});
