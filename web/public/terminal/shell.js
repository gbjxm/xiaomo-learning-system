'use strict';
(() => {
  const region = location.pathname.split('/')[1] || 'terminal';
  const destinations = [
    ['sea', '海域总览', '/terminal/#sea'],
    ['home', '我的主岛', '/terminal/#home'],
    ['learning', '学习', '/learning/'],
    ['navigation', '领航', '/navigation/?view=journey'],
    ['observatory', '素材', '/observatory/?space=daily'],
    ['information', '信息', '/information/?space=daily'],
    ['cabin', '领航船', '/terminal/#cabin'],
    ['explore', '资料查找', '/explore/']
  ];
  let header = document.querySelector('[data-terminal-shell], .preview-header');
  if (!header) {
    header = document.createElement('header');
    const brand = document.createElement('a');
    brand.className = 'terminal-brand';
    brand.href = '/terminal/#sea';
    const mark = document.createElement('span');
    mark.className = 'terminal-mark';
    mark.textContent = 'm';
    mark.setAttribute('aria-hidden', 'true');
    const name = document.createElement('span');
    name.append(document.createTextNode('小陌的个人终端'));
    const sub = document.createElement('small');
    sub.textContent = '按自己的节奏，慢慢走';
    name.append(sub);
    brand.append(mark, name);
    header.append(brand);
    document.body.prepend(header);
  } else {
    const brand = header.querySelector('.preview-brand');
    if (brand) {
      brand.href = '/terminal/#sea';
      brand.classList.add('terminal-brand');
      const name = brand.lastElementChild;
      if (name) {
        name.replaceChildren(document.createTextNode('小陌的个人终端'));
        const sub = document.createElement('small');
        sub.textContent = '按自己的节奏，慢慢走';
        name.append(sub);
      }
    }
  }
  header.dataset.terminalShell = '';
  header.classList.add('terminal-header');
  document.body.dataset.terminalModule = region;
  let nav = header.querySelector('.preview-nav, .terminal-nav');
  if (!nav) { nav = document.createElement('nav'); header.append(nav); }
  nav.classList.add('terminal-nav');
  nav.setAttribute('aria-label', '个人终端导航');
  nav.replaceChildren();
  for (const [key, label, href] of destinations) {
    const link = document.createElement('a');
    link.href = href;
    link.textContent = label;
    link.dataset.terminalDestination = key;
    if (key === region) link.setAttribute('aria-current', 'page');
    if (['learning','observatory','information'].includes(key)) link.dataset.previewRegionLink = key;
    nav.append(link);
  }
  document.addEventListener('click', async event => {
    const link = event.target.closest('a');
    if (!link?.closest('.terminal-header,.preview-dialog-nav')) return;
    if (!link || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || link.target === '_blank') return;
    const destination = new URL(link.href, location.href);
    if (destination.origin !== location.origin || destination.pathname === location.pathname && destination.search === location.search) return;
    if (!window.learningIsland?.flushUiDraft && !window.workspaceNavigation?.flush && !window.workspaceNavigationReady) return;
    event.preventDefault();
    try {
      if (window.workspaceNavigationReady) await window.workspaceNavigationReady;
      const flushLearning = window.learningIsland?.flushUiDraft;
      if (typeof flushLearning === 'function' && await flushLearning() === false) return;
      const flushPosition = window.workspaceNavigation?.flush;
      if (typeof flushPosition === 'function' && await flushPosition() === false) return;
      location.assign(destination.href);
    } catch {
      const feedback = document.getElementById('uiSaveText');
      if (feedback) { feedback.textContent = '这次离开前还没有确认草稿保存，请先核对保存状态。'; feedback.scrollIntoView({ block: 'nearest' }); }
    }
  });
})();
