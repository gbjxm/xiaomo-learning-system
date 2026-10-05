'use strict';

(() => {
  const islands = new Map([
    ['home', '我的主岛'], ['story', '故事花园'],
    ['visual', '影像工坊'], ['post', '后期港湾'],
  ]);
  const places = new Set(['plan', 'desk', 'courses', 'watch', 'practice', 'traces', 'rest', 'cat']);
  const views = {
    sea: document.getElementById('sea'),
    cabin: document.getElementById('cabin'),
    island: document.getElementById('islandView'),
  };
  const fullScene = document.getElementById('fullScene');
  const resumeSummary = document.getElementById('resumeSummary');
  const resumeText = document.getElementById('resumeText');
  const reloadResume = document.getElementById('reloadResume');
  const systemsMenu = document.getElementById('systemsMenu');
  const motion = document.getElementById('motion');
  let activeRoute = 'sea';
  let lastSeaFocus = null;
  let resumeLoaded = false;
  let resumePending = false;
  const workspaceLinks = new Map([
    ['observatory', [...document.querySelectorAll('[data-station="material"], .systems-list a[href^="/observatory/"]')]],
    ['information', [...document.querySelectorAll('[data-station="info"], .systems-list a[href^="/information/"]')]],
  ]);
  let workspaceLoaded = false;
  let workspacePending = null;
  let workspaceNavigationSerial = 0;
  for (const [region, links] of workspaceLinks) {
    for (const link of links) link.dataset.workspaceRegion = region;
  }

  function readingURL(region, value) {
    const fallback = `/${region}/?space=daily`;
    if (typeof value !== 'string' || value.length > 2048 || /[\\\u0000-\u001f]/u.test(value)) return fallback;
    try {
      const url = new URL(value, location.origin);
      if (url.origin !== location.origin || url.username || url.password
        || ![`/${region}/`, `/${region}/index.html`].includes(url.pathname)) return fallback;
      url.searchParams.set('space', 'daily');
      return url.pathname + url.search + url.hash;
    } catch { return fallback; }
  }

  function updateReadingLinks(regions) {
    for (const [region, links] of workspaceLinks) {
      const href = readingURL(region, regions?.[region]?.url);
      for (const link of links) link.setAttribute('href', href);
    }
  }

  function loadReadingLinks({ refresh = false } = {}) {
    if (workspacePending) return workspacePending;
    if (workspaceLoaded && !refresh) return Promise.resolve();
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 1200);
    workspacePending = (async () => {
      try {
        const response = await fetch('/api/workspace/bootstrap', {
          method: 'GET', credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
        });
        if (!response.ok) throw new Error('Workspace unavailable');
        const body = await response.json();
        if (!body.ok || !body.data?.state?.regions) throw new Error('Workspace unavailable');
        updateReadingLinks(body.data.state.regions);
      } catch {
        updateReadingLinks(null);
      } finally {
        window.clearTimeout(timeout);
        workspaceLoaded = true;
        workspacePending = null;
      }
    })();
    return workspacePending;
  }

  function placeURL(island, place) {
    if (!islands.has(island) || !places.has(place)) return '/learning/?entry=resume';
    if (island === 'home' && place === 'traces') return '/navigation/?view=journey';
    if (['practice', 'watch', 'traces'].includes(place)) {
      const params = new URLSearchParams({ island });
      if (place === 'watch') params.set('view', 'watch');
      return '/learning/content/?' + params.toString();
    }
    const params = new URLSearchParams({ island, place });
    return '/learning/?' + params.toString();
  }

  function attachDestinations(island) {
    for (const place of fullScene.querySelectorAll('.scene-place')) {
      const link = document.createElementNS('http://www.w3.org/2000/svg', 'a');
      link.setAttribute('href', placeURL(island, place.dataset.place));
      link.setAttribute('class', 'scene-destination');
      link.setAttribute('tabindex', '0');
      link.setAttribute('aria-label', place.getAttribute('aria-label') || '进入这个地点');
      place.removeAttribute('tabindex');
      place.removeAttribute('role');
      place.removeAttribute('aria-label');
      place.before(link);
      link.append(place);
    }
  }

  function renderRoute({ focus = true } = {}) {
    workspaceNavigationSerial += 1;
    const requested = location.hash.slice(1);
    const key = islands.has(requested) || requested === 'cabin' ? requested : 'sea';
    const view = islands.has(key) ? 'island' : key;
    for (const [name, element] of Object.entries(views)) element.hidden = name !== view;
    activeRoute = key;
    systemsMenu.open = false;
    resumeSummary.open = false;
    resumeSummary.hidden = key !== 'home';
    document.getElementById('homeActions').hidden = key !== 'home';
    document.title = key === 'sea' ? '小陌的个人终端' : (islands.get(key) || '小陌的领航船') + ' · 小陌的个人终端';

    if (islands.has(key)) {
      const template = document.getElementById(key + 'Scene');
      fullScene.replaceChildren(template.content.cloneNode(true));
      fullScene.classList.toggle('home-scene', key === 'home');
      document.getElementById('islandTitle').textContent = islands.get(key);
      document.getElementById('islandSubtitle').textContent = key === 'home'
        ? '从这里看看当前一步，也可以随手聊聊。'
        : '选一处熟悉的地方，接着学一点。';
      attachDestinations(key);
    }
    for (const link of document.querySelectorAll('.topnav [data-island], .topnav [data-cabin]')) {
      const current = link.dataset.island === key || (link.hasAttribute('data-cabin') && key === 'cabin');
      if (current) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    if (key === 'cabin') void loadReadingLinks({ refresh: true });
    window.scrollTo(0, 0);
    if (!focus) return;
    if (key === 'sea') {
      const target = lastSeaFocus?.isConnected ? lastSeaFocus : document.querySelector('.home-island');
      target?.focus({ preventScroll: true });
    } else views[view].querySelector('[data-sea]')?.focus({ preventScroll: true });
  }

  const readText = value => typeof value === 'string' ? value.trim() : '';

  async function loadResume() {
    if (resumePending) return;
    resumePending = true;
    reloadResume.disabled = true;
    resumeText.textContent = '正在读取上次停止处…';
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch('/api/learning/bootstrap', {
        method: 'GET', credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
      });
      if (!response.ok) throw new Error('Bootstrap unavailable');
      const data = await response.json();
      const task = data.currentTask && typeof data.currentTask === 'object' && !Array.isArray(data.currentTask)
        ? data.currentTask : null;
      const stop = readText(task?.stopPoint);
      const next = readText(task?.nextStep);
      const purpose = readText(task?.purpose) || readText(task?.title);
      const lines = [];
      if (purpose) lines.push('最近记录：' + purpose);
      if (stop) lines.push('停止处：' + stop);
      if (next) lines.push('已记录的下一步：' + next);
      resumeText.textContent = lines.length
        ? lines.join('\n')
        : '还没有可接续的学习任务。可以直接开始，或带着今天的问题进入学习。';
      resumeLoaded = true;
    } catch {
      resumeLoaded = false;
      resumeText.textContent = '这次没读到接续点。你仍可以直接进入学习，也可以稍后重新读取。';
    } finally {
      window.clearTimeout(timeout);
      resumePending = false;
      reloadResume.disabled = false;
    }
  }

  document.addEventListener('click', event => {
    const link = event.target.closest?.('a[href^="#"]');
    if (link && activeRoute === 'sea' && link.getAttribute('href') !== '#sea') lastSeaFocus = link;
    if (systemsMenu.open && !systemsMenu.contains(event.target)) systemsMenu.open = false;
  });
  document.addEventListener('click', async event => {
    const link = event.target.closest?.('a[data-workspace-region]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey
      || event.shiftKey || event.altKey || link.target === '_blank') return;
    if (workspaceLoaded && !workspacePending) return;
    event.preventDefault();
    const serial = ++workspaceNavigationSerial;
    const from = location.pathname + location.search + location.hash;
    link.setAttribute('aria-busy', 'true');
    try {
      await loadReadingLinks();
      if (serial === workspaceNavigationSerial && from === location.pathname + location.search + location.hash) {
        location.assign(readingURL(link.dataset.workspaceRegion, link.getAttribute('href')));
      }
    } finally { link.removeAttribute('aria-busy'); }
  });
  window.addEventListener('hashchange', () => renderRoute());
  window.addEventListener('pageshow', event => {
    if (!event.persisted) return;
    workspaceLoaded = false;
    if (activeRoute === 'cabin' || systemsMenu.open) void loadReadingLinks({ refresh: true });
  });
  systemsMenu.addEventListener('toggle', () => {
    if (systemsMenu.open) void loadReadingLinks({ refresh: true });
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    workspaceNavigationSerial += 1;
    if (systemsMenu.open) {
      systemsMenu.open = false;
      systemsMenu.querySelector('summary').focus();
    } else if (resumeSummary.open) {
      resumeSummary.open = false;
      resumeSummary.querySelector('summary').focus();
    } else if (activeRoute !== 'sea') location.hash = 'sea';
  });
  resumeSummary.addEventListener('toggle', () => {
    if (resumeSummary.open && !resumeLoaded) void loadResume();
  });
  reloadResume.addEventListener('click', () => void loadResume());

  function setStill(still) {
    document.body.classList.toggle('is-still', still);
    motion.setAttribute('aria-pressed', String(still));
    motion.textContent = still ? '开启轻动效' : '暂停轻动效';
  }
  setStill(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  motion.addEventListener('click', () => setStill(!document.body.classList.contains('is-still')));
  renderRoute({ focus: false });
  document.documentElement.dataset.terminalReady = 'true';
})();
