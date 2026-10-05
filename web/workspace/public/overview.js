'use strict';
(() => {
  const main = document.getElementById('exploration');
  if (!main || document.getElementById('workspaceOverview')) return;
  const names = { learning: '学习小岛', observatory: '素材观察室', information: '信息收集' };
  const kindNames = { learning: '学习入口', material: '素材', topic: '研究专题', opportunity: '创作机会', work: '作品档案' };
  const key = ref => JSON.stringify([ref?.module, ref?.kind, ref?.storeId, ref?.id]);
  const create = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
  async function get(url, signal) {
    const response = await fetch(url, { method: 'GET', credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' }, signal });
    const result = await response.json();
    if (!response.ok || result.ok !== true) throw new Error(result.error?.message || '暂时未能读取本机资料。');
    if (!result.data || typeof result.data !== 'object') throw new Error('读取结果缺少必要资料。');
    return result.data;
  }
  function hrefFor(item) {
    if (!item || ['missing', 'deleted'].includes(item.availability) || typeof item.href !== 'string' || !item.href.startsWith('/') || item.href.startsWith('//') || item.href.includes('\\')) return null;
    try { const url = new URL(item.href, location.href); return url.origin === location.origin && Object.hasOwn(names, item.ref?.module) && url.pathname.startsWith('/' + item.ref.module + '/') ? url.pathname + url.search + url.hash : null; } catch { return null; }
  }
  function itemNode(item, missingReason = '') {
    const row = create('li', 'workspace-item'); const href = hrefFor(item);
    const title = href ? create('a', 'workspace-item-title', item.title || item.ref?.id || '未命名资料') : create('span', 'workspace-item-title workspace-item-unavailable', item.title || '对象暂不可用');
    if (href) title.href = href;
    const detail = create('span', 'workspace-item-detail', [names[item.ref?.module] || '来源区域', item.kindLabel || kindNames[item.ref?.kind] || '资料', item.availability === 'archived' ? '已归档' : ''].filter(Boolean).join(' · '));
    row.append(title, detail);
    if (!href) row.append(create('span', 'workspace-item-reason', missingReason || '对象暂不可用或来源身份已变化。'));
    return row;
  }
  function partialText(errors) {
    if (!Array.isArray(errors) || !errors.length) return '';
    return [...new Set(errors.map(error => names[error.module] || '一个区域'))].join('、') + '暂未读到；结果可能不完整。';
  }
  function validCatalog(data) {
    if (!Array.isArray(data.items) || !Array.isArray(data.errors)) throw new Error('资料目录读取不完整，请稍后重试。');
    return data;
  }

  const section = create('section', 'workspace-overview'); section.id = 'workspaceOverview'; section.setAttribute('aria-label', '最近停留和本机资料查找');
  const recent = create('div', 'workspace-recent');
  const recentHeading = create('h2', 'workspace-overview-title', '最近停留'); recentHeading.id = 'workspaceRecentTitle';
  const recentStatus = create('p', 'workspace-overview-status', '正在读取上次停留…'); recentStatus.setAttribute('role', 'status');
  const recentList = create('ul', 'workspace-item-list'); recentList.setAttribute('aria-labelledby', recentHeading.id);
  const retry = create('button', 'workspace-retry', '重新读取'); retry.type = 'button'; retry.hidden = true;
  recent.append(recentHeading, recentStatus, recentList, retry);
  const search = create('div', 'workspace-search'); const searchHeading = create('h2', 'workspace-overview-title', '找一份资料');
  const form = create('form', 'workspace-search-form'); form.setAttribute('role', 'search');
  const label = create('label', 'workspace-search-label', '在学习、素材和信息里找'); label.htmlFor = 'workspaceSearchInput';
  const controls = create('div', 'workspace-search-controls'); const input = create('input', 'workspace-search-input'); input.id = 'workspaceSearchInput'; input.name = 'query'; input.type = 'search'; input.maxLength = 2000; input.autocomplete = 'off'; input.placeholder = '名称或关键词';
  const submit = create('button', 'workspace-search-submit', '查找'); submit.type = 'submit'; controls.append(input, submit);
  const searchStatus = create('p', 'workspace-overview-status', '只查本机已保存的资料。'); searchStatus.id = 'workspaceSearchStatus'; searchStatus.setAttribute('role', 'status'); input.setAttribute('aria-describedby', searchStatus.id);
  const results = create('ul', 'workspace-item-list workspace-search-results'); results.setAttribute('aria-label', '资料查找结果');
  form.append(label, controls); search.append(searchHeading, form, searchStatus, results); section.append(recent, search);
  const footer = main.querySelector('.explore-footer'); if (footer) main.insertBefore(section, footer); else main.append(section);

  let recentSequence = 0;
  async function loadRecent() {
    const sequence = ++recentSequence; retry.disabled = true; retry.hidden = true; recentStatus.textContent = '正在读取上次停留…';
    try {
      const data = await get('/api/workspace/bootstrap');
      if (!Array.isArray(data.state?.recent)) throw new Error('最近停留记录不完整，请重新读取。');
      const refs = data.state.recent.slice(0, 20);
      if (!refs.length) { if (sequence === recentSequence) { recentList.replaceChildren(); recentStatus.textContent = '还没有最近停留，可以直接去任何一个地方。'; } return; }
      const catalog = validCatalog(await get('/api/workspace/catalog')); if (sequence !== recentSequence) return;
      const items = new Map(catalog.items.map(item => [key(item.ref), item])); const unavailable = new Set(catalog.errors.map(error => error.module));
      recentList.replaceChildren(...refs.map(ref => itemNode(items.get(key(ref)) || { ref, title: '已保存对象暂不可用', href: null, availability: 'missing' }, unavailable.has(ref.module) ? '所在区域暂不可读，保留原停留记录。' : '未找到此对象，可能已移除或来源身份变化。')));
      recentStatus.textContent = partialText(catalog.errors) || '打开一份接着看，也可以从场景重新出发。';
    } catch (error) { if (sequence !== recentSequence) return; recentStatus.textContent = '最近停留暂不可读：' + error.message; retry.hidden = false; }
    finally { if (sequence === recentSequence) retry.disabled = false; }
  }
  retry.addEventListener('click', loadRecent);
  let sequence = 0, controller;
  form.addEventListener('submit', async event => {
    event.preventDefault(); const query = input.value.trim();
    if (!query) { searchStatus.textContent = '写一个名称或关键词，再查找。'; return; }
    const request = ++sequence; controller?.abort(); controller = new AbortController(); submit.disabled = true; search.setAttribute('aria-busy', 'true'); searchStatus.textContent = '正在查找本机资料…';
    try {
      const data = validCatalog(await get('/api/workspace/catalog?query=' + encodeURIComponent(query), controller.signal)); if (request !== sequence) return;
      results.replaceChildren(...data.items.map(item => itemNode(item))); const partial = partialText(data.errors);
      searchStatus.textContent = data.items.length ? `找到 ${data.items.length} 项。` + (partial ? ' ' + partial : '') : partial ? '已读取的区域未找到对应资料。' + partial : '没有找到对应名称或关键词，可以换一个词。';
    } catch (error) { if (request !== sequence || error.name === 'AbortError') return; results.replaceChildren(); searchStatus.textContent = '暂未完成查找：' + error.message; }
    finally { if (request === sequence) { submit.disabled = false; search.removeAttribute('aria-busy'); } }
  });
  loadRecent();
})();
