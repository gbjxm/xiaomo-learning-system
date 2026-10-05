'use strict';

// Shared content entries leave only after the recovered UI draft is saved.
// Explicit legacy links keep the existing workshop and bookmarks available.
(() => {
  const url = new URL(location.href);
  const requested = { island: url.searchParams.get('island'), place: url.searchParams.get('place'), entry: url.searchParams.get('entry'), legacyRecord: url.searchParams.get('legacyRecord'), taskId: url.searchParams.get('taskId'), noteId: url.searchParams.get('noteId'), contentId: url.searchParams.get('contentId') };
  const legacyContent = url.searchParams.get('legacyContent') === '1';
  const hasEntry = Object.values(requested).some(value => value !== null);
  const places = new Set(['plan', 'desk', 'courses', 'watch', 'practice', 'rest', 'cat', 'traces', 'bookmarks']);
  let recoveryFinished = false, consumed = !hasEntry, applying = false;
  const status = el('p', undefined, 'learning-entry-status'); status.id = 'learningEntryStatus'; status.hidden = true; status.setAttribute('role', 'status');
  $('uiSaveStatus').after(status);

  function statusMessage(message) { status.textContent = message; status.hidden = !message; }
  function consumeEntry() {
    const current = new URL(location.href);
    for (const key of ['island', 'place', 'entry', 'legacyRecord', 'legacyDraft', 'taskId', 'noteId', 'contentId']) current.searchParams.delete(key);
    history.replaceState(history.state, '', current.pathname + current.search + current.hash);
    consumed = true; statusMessage('');
  }
  async function leaveLearning(href) {
    try {
      const saved = await window.learningIsland.flushUiDraft();
      if (saved) { location.assign(href); return true; }
    } catch { /* The existing save status retains the concrete failure. */ }
    setPanel(true); $('uiSaveStatus').scrollIntoView({ block: 'nearest' });
    statusMessage('界面草稿尚未确认保存。请核对保存提示后，再离开这一页。');
    return false;
  }
  function contentURL(action, island = state.current) {
    const params = new URLSearchParams({ island });
    if (action === 'watch') params.set('view', 'watch');
    return '/learning/content/?' + params.toString();
  }

  const priorOpenPlace = openPlace;
  openPlace = function(action, options = {}) {
    if (action === 'journey') { void leaveLearning('/navigation/?view=journey'); return; }
    if (action === 'bookmarks') return priorOpenPlace('traces');
    if (!legacyContent && !options.legacy && ['practice', 'watch', 'traces'].includes(action)) {
      void leaveLearning(contentURL(action)); return;
    }
    return priorOpenPlace(action);
  };
  const priorRenderPanel = renderPanel;
  renderPanel = function() {
    const result = priorRenderPanel();
    $('panelEyebrow').textContent = (state.current === 'home' ? '主岛' : islands[state.current].name) + ' · 学习向导';
    $('personalNavigationLinks').hidden = state.current !== 'home' || state.overview;
    return result;
  };
  $('learningBookmarks').addEventListener('click', () => { void leaveLearning(contentURL('traces')); });
  $('legacyLearningBookmarks').addEventListener('click', () => {
    if (state.overview) visit(state.current);
    openPlace('bookmarks');
  });
  $('tracesTab').addEventListener('click', event => {
    event.preventDefault(); event.stopImmediatePropagation();
    void leaveLearning(contentURL('traces'));
  }, true);

  // Keep the existing overview geometry, camera, labels, keyboard interaction
  // and island identity, while showing the exact artwork used by the homepage.
  for (const group of document.querySelectorAll('#world .island[data-island]')) {
    const key = group.dataset.island, island = islands[key];
    if (!island) continue;
    const ns = 'http://www.w3.org/2000/svg', image = document.createElementNS(ns, 'image');
    for (const [name, value] of Object.entries({ href: IslandScenes.paintingUrl(key), x: String(island.x - 157), y: String(island.y - 124), width: '314', height: '227', preserveAspectRatio: 'xMidYMid meet', 'aria-hidden': 'true' })) image.setAttribute(name, value);
    const name = document.createElementNS(ns, 'text'); name.setAttribute('class', 'name'); name.setAttribute('x', island.x); name.setAttribute('y', island.y + 115); name.setAttribute('text-anchor', 'middle'); name.textContent = island.title;
    const subtitle = document.createElementNS(ns, 'text'); subtitle.setAttribute('class', 'sub'); subtitle.setAttribute('x', island.x); subtitle.setAttribute('y', island.y + 135); subtitle.setAttribute('text-anchor', 'middle'); subtitle.textContent = island.scope;
    group.replaceChildren(image, name, subtitle);
  }

  async function applyEntry() {
    if (consumed || applying || !recoveryFinished) return;
    const readiness = window.learningIsland.status();
    if (!readiness.ready || readiness.blocked) { statusMessage('正在保留原界面与草稿；恢复或版本核对完成后，再打开这次的入口。'); return; }
    if (requested.entry && !['resume', 'record'].includes(requested.entry) || requested.island && !Object.hasOwn(islands, requested.island) || requested.place && !places.has(requested.place)) {
      consumeEntry(); notice('这个学习入口未识别，已保留原来的学习位置。'); return;
    }
    applying = true;
    try {
      const targets = [['task', requested.taskId], ['note', requested.noteId], ['content', requested.contentId]].filter(([, id]) => id !== null);
      if (targets.length) {
        if (targets.length !== 1) { statusMessage('入口中有多份关联，请使用某一条内容的继续入口。原草稿保持不变。'); return; }
        const [kind, id] = targets[0];
        const opened = kind === 'task' ? await window.learningIsland.openTaskById(id) : await window.learningIsland.openRecordingContext({ kind, id });
        if (opened) consumeEntry();
        else statusMessage('这份关联尚未打开；原输入和片段保留，请核对当前关联提示。');
        return;
      }
      if (requested.entry === 'record') {
        if (window.learningIsland.clearRecordingContext()) { setMode('chat'); setPanel(true); $('intent').focus(); consumeEntry(); }
        return;
      }
      if (requested.entry === 'resume') {
        if (!readiness.recordsLoaded) { statusMessage('学习记录暂未读到；原输入保留，读取最新学习记录后会继续接续。'); return; }
        if (window.learningIsland.resumeCurrentTask()) consumeEntry();
        return;
      }
      const island = requested.island || state.current;
      if (island === 'home' && requested.place === 'traces' && !legacyContent) {
        // Only the personal journal hotspot goes to Navigation. The separate
        // learning bookmarks tab and place=bookmarks retain the original data.
        if (await leaveLearning('/navigation/?view=journey')) consumeEntry();
        return;
      }
      if (!legacyContent && ['practice', 'watch', 'traces'].includes(requested.place)) {
        if (await leaveLearning(contentURL(requested.place, island))) consumed = true;
        return;
      }
      visit(island);
      if (requested.place) openPlace(requested.place, { legacy: legacyContent });
      if (legacyContent && requested.legacyRecord) {
        const record = state.records.find(item => item.id === requested.legacyRecord);
        if (record) openTrace(record);
        else notice('这枚旧书签暂未找到，已保留现有书签和草稿。');
      }
      consumeEntry();
    } finally { applying = false; }
  }

  window.addEventListener('learning:restored', () => { void applyEntry(); });
  window.addEventListener('learning:context-cleared', consumeEntry);
  Promise.resolve(window.learningIsland.ready).finally(() => { recoveryFinished = true; void applyEntry(); });
  life.sceneKey = ''; syncLife(); renderPanel();
})();
