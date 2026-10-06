import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';

const run = promisify(execFile);
const edge = process.env.EDGE_EXECUTABLE ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
test('探索场景复用原SVG道具，默认四岛仍使用已选画面；热点和清理均保留', { timeout: 30000 }, async t => {
  try { await fs.access(edge); } catch { t.skip('本机没有配置 Edge，需由浏览器验收补核对'); return; }
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'xiaomo-scene-dom-'));
  t.after(async () => { const actual = await fs.realpath(root), temp = await fs.realpath(os.tmpdir()), relative = path.relative(temp, actual); assert.ok(relative.startsWith('xiaomo-scene-dom-') && !relative.includes(path.sep)); await fs.rm(actual, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });
  const [islandSource, discoverySource] = await Promise.all([
    fs.readFile(new URL('../public/learning/岛屿场景.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('./public/scene.js', import.meta.url), 'utf8'),
  ]);
  const html = '<!doctype html><meta charset="utf-8"><body><script>' + islandSource + '\n' + discoverySource + '\n' + `
  try {
    const ensure = (condition, message) => { if (!condition) throw new Error(message); };
    const host = document.createElement('div'); document.body.append(host);
    for (const island of ['home','story','visual','post']) {
      const view = IslandScenes.mount(host, {island});
      ensure(host.querySelector('image.island-painting')?.getAttribute('href') === IslandScenes.paintingUrl(island), '默认岛屿画面变化：'+island);
      ensure(!host.querySelector('.scene-prop'), '默认岛屿恢复了旧SVG：'+island);
      if (island === 'home') ensure(host.querySelector('[data-place="journey"]'), '每日旅程入口变化');
      view.destroy(); ensure(host.childElementCount === 0, '原岛屿清理失败');
    }
    const regionCalls=[], placeCalls=[];
    const scene = DiscoveryScene.mount(host,{onRegion:id=>regionCalls.push(id),onPlace:value=>placeCalls.push(value)});
    ensure(host.querySelectorAll('[data-region]').length === 3, '区域数量错误');
    ensure(host.querySelectorAll('[data-poi-region]').length === 7, '地点数量错误');
    ensure(!document.querySelector('.island-scenes'), '离屏原图挂载未清理');
    for (const target of host.querySelectorAll('[data-region]')) target.dispatchEvent(new MouseEvent('click',{bubbles:true,button:0}));
    for (const target of host.querySelectorAll('[data-poi-region]')) target.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
    ensure(regionCalls.join(',') === 'learning,observatory,information', '区域导航改变');
    ensure(placeCalls.length === 7 && placeCalls[0].place === 'courses' && placeCalls[6].place === 'preparation', '地点导航改变');
    scene.destroy(); ensure(host.childElementCount === 0, '探索场景清理失败');
    document.body.dataset.sceneResult = btoa(unescape(encodeURIComponent(JSON.stringify({ok:true,regions:regionCalls,places:placeCalls.length}))));
  } catch (error) { document.body.dataset.sceneResult = btoa(unescape(encodeURIComponent(JSON.stringify({ok:false,message:error.message})))); }
  ` + '</script></body>';
  const file = path.join(root, 'scene.html'); await fs.writeFile(file, html);
  const { stdout } = await run(edge, ['--headless', '--disable-gpu', '--no-first-run', '--disable-background-networking', '--user-data-dir=' + path.join(root, 'profile'), '--dump-dom', pathToFileURL(file).href], { windowsHide: true, timeout: 20000, maxBuffer: 2 * 1024 * 1024 });
  const encoded = stdout.match(/data-scene-result="([A-Za-z0-9+/=]+)"/)?.[1];
  assert.ok(encoded, '浏览器未返回DOM验证结果');
  const result = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
  assert.equal(result.ok, true, result.message);
  assert.equal(result.places, 7);
});
