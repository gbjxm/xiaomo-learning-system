// Transform only the response served by the independent preview host.
// The production source and its on-disk UI state are never edited here.
function replaceOnce(source, marker, replacement, label) {
  const first = source.indexOf(marker);
  if (first < 0 || source.indexOf(marker, first + marker.length) >= 0) {
    throw new Error(`PREVIEW_ADAPTER_SOURCE_CHANGED: ${label}`);
  }
  return source.slice(0, first) + replacement + source.slice(first + marker.length);
}

function replaceRange(source, start, end, replacement, label) {
  const first = source.indexOf(start);
  const last = first < 0 ? -1 : source.indexOf(end, first + start.length);
  if (first < 0 || last < 0 || source.indexOf(start, first + start.length) >= 0 ||
      source.indexOf(end, last + end.length) >= 0) {
    throw new Error(`PREVIEW_ADAPTER_SOURCE_CHANGED: ${label}`);
  }
  return source.slice(0, first) + replacement + source.slice(last);
}

export function transformLearningIntegration(input) {
  if (typeof input !== 'string') throw new TypeError('Learning integration source must be text.');
  let source = input.replace(/\r\n/g, '\n');
  source = replaceOnce(source,
    "const cacheBase = 'xiaomo-learning-island-ui-v1:' + location.origin;",
    "const cacheBase = 'xiaomo-exploration-preview-learning-v1:' + location.origin;",
    'preview cache namespace');
  // Session storage belongs to this tab and the separate preview origin. Other
  // learning scripts use no browser storage; keep production identities intact.
  const localCount = (source.match(/\blocalStorage\b/g) || []).length;
  if (localCount !== 9) throw new Error('PREVIEW_ADAPTER_SOURCE_CHANGED: browser storage');
  source = source.replace(/\blocalStorage\b/g, 'sessionStorage');
  source = replaceOnce(source,
    "sessionStorage.getItem('xiaomo-learning-island-tab') || crypto.randomUUID(); sessionStorage.setItem('xiaomo-learning-island-tab', tabId);",
    "sessionStorage.getItem('xiaomo-preview-learning-tab') || crypto.randomUUID(); sessionStorage.setItem('xiaomo-preview-learning-tab', tabId);",
    'preview tab namespace');
  source = replaceRange(source,
    '  async function flush() {',
    '  async function reconnect({ discardLocal = false } = {}) {',
    `  async function flush() {
    clearTimeout(ui.timer);
    const value = remember();
    try {
      const retained = JSON.parse(sessionStorage.getItem(cacheKey) || 'null');
      if (!retained || stringify(retained.state) !== stringify(value)) throw new Error('cache unavailable');
      showStatus('预览草稿留在本标签页 · 未写入正式数据');
      return true;
    } catch {
      showStatus('本标签页预览草稿暂不可保存；当前输入仍在页面，离开前可下载。正式数据未修改。', true);
      return false;
    }
  }
`, 'session-only flush');
  source = replaceOnce(source,
    "loaded = await call('/api/learning/ui-state/init', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Learning-Token': ui.token }, body: stringify({ state: snapshot() }) });",
    "throw { code: 'PREVIEW_UI_UNAVAILABLE', message: '正式界面状态尚未建立；预览不会初始化或修改正式数据，请先在正式入口处理。' };",
    'no production initialization');
  source = replaceOnce(source,
    "showStatus('首次建立本机界面草稿；不会创建学习进展…');",
    "showStatus('正式界面草稿尚不可读取；预览不会建立正式状态。');",
    'initialization message');
  source = replaceOnce(source,
    '      } else apply(loaded.state);',
    '      } else apply({ ...loaded.state, panelOpen: false });',
    'first entry leaves scene room');
  source = replaceOnce(source,
    "if (!ui.blocked) { showStatus(`${loaded.identity.scope === 'production' ? '本机界面已恢复' : '隔离界面已恢复'} · v${ui.revision} · 不等于学习进展`); queueSave(); }",
    "if (!ui.blocked) { showStatus(`已读取正式界面 v${ui.revision} · 操作仅留在本标签页预览草稿`); queueSave(); }",
    'honest restore status');
  source = replaceRange(source,
    '  async function sendChat({ message, mode, skipSave, useComposer }) {',
    "  document.addEventListener('input', queueSave);",
    `  async function sendChat({ message, mode, skipSave, useComposer }) {
    remember();
    notice('预览不发送交流，也不写学习记录；请打开正式入口使用。当前输入保留。');
    chatError.textContent = '此处只预览界面。真实交流请在正式入口使用；当前输入没有发送。';
    chatError.hidden = false;
    return false;
  }
`, 'no model request or invented chat');
  source = replaceRange(source,
    "  window.addEventListener('pagehide', () => {",
    '  window.learningIsland = {',
    "  window.addEventListener('pagehide', () => { remember(); });\n",
    'no keepalive production write');
  source = replaceRange(source,
    "  call('/api/bootstrap').then(data => {",
    '\n})();',
    "  connection.textContent = '预览不连接模型或保存学习记录；真实交流请打开正式入口。';\n",
    'preview chat availability');
  source = replaceOnce(source,
    "'聊天实际请求现有接口；本次参考最近少量交流。手动安排与界面草稿分别保存。'",
    "'此处仅预览交流界面。输入留在本标签页，不发送模型，也不写正式学习记录。'",
    'chat helper text');
  source = replaceOnce(source,
    "'该按钮会发送真实收尾请求；成功后按既有学习保存规则写入。手动书签仅保存界面状态。'",
    "'预览不会发送收尾请求。手动书签仅留在本标签页预览草稿，不写正式数据。'",
    'wrap helper text');
  source = replaceOnce(source,
    "'浏览器草稿备份不可用；以本机保存结果为准，离开前可下载草稿。'",
    "'本标签页预览草稿缓存不可用；正式数据未修改，离开前可下载当前草稿。'",
    'storage failure text');
  source = replaceOnce(source,
    "notice: '界面草稿与用户输入，不是学习进展或能力认证。'",
    "notice: '独立预览的界面草稿与用户输入，未写正式数据；不是学习进展或能力认证。'",
    'download evidence label');
  // Fail closed if a new production mutation is introduced outside the adapted
  // functions, rather than silently serving an incompletely isolated page.
  if (/method\s*:\s*['"](?:POST|PUT|PATCH|DELETE)['"]/.test(source) ||
      /fetch\(['"]\/api\/chat/.test(source) || /\blocalStorage\b/.test(source)) {
    throw new Error('PREVIEW_ADAPTER_SOURCE_CHANGED: unexpected mutation');
  }
  return source;
}
