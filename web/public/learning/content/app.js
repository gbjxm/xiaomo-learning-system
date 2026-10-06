(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const query = new URLSearchParams(location.search);
  const islandNames = { home: '主岛', story: '故事岛', visual: '影像岛', post: '后期岛' };
  const island = Object.hasOwn(islandNames, query.get('island')) ? query.get('island') : 'home';
  const watchNames = { unknown: '进度未注明', watching: '正在看', watched: '已看完', partial: '看过一部分' };
  const kindNames = { creation: '创作与想法', watch: '观看记录', learning: '学习笔记' };
  const state = { identity: null, scope: null, token: null, revision: null, items: [], filter: ['creation', 'watch', 'learning'].includes(query.get('view')) ? query.get('view') : query.get('intent') === 'watch' ? 'watch' : 'all', search: '', selected: null, editor: null, workshop: null, detailSequence: 0, busy: false };
  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
  const uid = () => window.crypto?.randomUUID?.() || 'content-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  const tabId = (() => { try { const key = 'xiaomo.personal-content.tab'; const saved = sessionStorage.getItem(key); if (saved) return saved; const fresh = uid(); sessionStorage.setItem(key, fresh); return fresh; } catch { return uid(); } })();
  const node = (tag, cls, text) => { const result = document.createElement(tag); if (cls) result.className = cls; if (text !== undefined) result.textContent = text; return result; };
  const button = (text, fn, cls = '') => { const result = node('button', cls, text); result.type = 'button'; result.addEventListener('click', fn); return result; };
  const sourceLabel = item => item.source?.label || (item.readOnly ? '原有记录' : '我的内容');
  const isWebUrl = value => { try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; } };
  const safeResumeUrl = value => { try { const url = new URL(value, location.href); return ['http:', 'https:'].includes(url.protocol) ? url.href : null; } catch { return null; } };
  function notice(message, error = false) { $('pageNotice').hidden = !message; $('pageNotice').textContent = message || ''; $('pageNotice').classList.toggle('error', error); }
  function legacyKey(editor) { return 'xiaomo.personal-content.v1:' + editor.identity + ':' + (editor.id || 'new-' + editor.kind); }
  function storageKey(editor) { return 'xiaomo.personal-content.v2:' + editor.identity + ':' + tabId + ':' + (editor.id || 'new-' + editor.kind); }
  function readDraft(editor) {
    try {
      const current = localStorage.getItem(storageKey(editor)); if (current) return JSON.parse(current);
      const legacy = localStorage.getItem(legacyKey(editor));
      if (legacy) { const draft = JSON.parse(legacy); localStorage.setItem(storageKey(editor), legacy); localStorage.removeItem(legacyKey(editor)); return draft; }
      return null;
    } catch { return null; }
  }
  function persistEditor() {
    if (!state.editor) return true;
    try { localStorage.setItem(storageKey(state.editor), JSON.stringify(state.editor)); return true; }
    catch { editorStatus('浏览器暂时没有留住草稿。离开前请保存，或复制当前文字。', true); return false; }
  }
  function clearDraft(editor) { try { localStorage.removeItem(storageKey(editor)); } catch { /* Formal save already succeeded. */ } }
  function editorStatus(message, error = false) { const target = $('editorStatus'); if (!target) return; target.textContent = message; target.classList.toggle('error', error); }
  async function request(path, body) {
    const response = await fetch('/api/learning/content/' + path, { cache: 'no-store', headers: body ? { 'Content-Type': 'application/json', 'x-content-token': state.token } : {}, ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}) });
    let result;
    try { result = await response.json(); } catch { throw new Error('服务没有返回可读取的内容，请稍后重新加载。'); }
    if (!response.ok) { const error = new Error(result.error?.message || result.error || '这次没有完成，请稍后重试。'); error.status = response.status; error.code = result.error?.code; error.details = result.error?.details; throw error; }
    return result;
  }
  function acceptIdentity(result) {
    if (state.identity && result.identity !== state.identity) throw new Error('当前资料位置已经改变。输入已留在原资料的浏览器草稿中，请刷新页面后再继续。');
    if (result.scope !== undefined) {
      if (!['production', 'isolated'].includes(result.scope) || state.scope && result.scope !== state.scope) throw new Error('当前资料范围发生变化，请刷新页面后核对。');
      state.scope = result.scope; document.body.dataset.spaceMode = result.scope;
    }
    state.identity = result.identity; state.revision = result.revision;
  }
  function clearWorkspaceContext() {
    recentPending = null;
    window.workspaceLastContext = null;
    window.dispatchEvent(new CustomEvent('workspace:context', { detail: { ref: null, mount: null } }));
  }
  let recentPending = null, recentRunning = false, recentSaved = null;
  const refKey = ref => JSON.stringify([ref?.module, ref?.kind, ref?.storeId, ref?.id]);
  async function rememberWorkspaceRef(ref, status) {
    const key = refKey(ref); if (key === recentSaved) return;
    recentPending = { ref, status }; if (recentRunning) return;
    recentRunning = true;
    try {
      while (recentPending) {
        const target = recentPending; recentPending = null;
        const isCurrent = () => refKey(window.workspaceLastContext?.ref) === refKey(target.ref);
        try {
          let firstIdentity = null;
          for (let attempt = 0; attempt < 2 && isCurrent(); attempt++) {
            const response = await fetch('/api/workspace/bootstrap', { cache: 'no-store' });
            const body = await response.json(), snapshot = body.data;
            if (!isCurrent()) break;
            if (!response.ok || body.ok !== true || snapshot?.scope !== state.scope || snapshot.identity?.scope !== state.scope || !snapshot.identity?.storeId || !snapshot.token || !Number.isSafeInteger(snapshot.stateRevision) || !Array.isArray(snapshot.state?.recent)) throw new Error('最近停留的保存位置尚未核实。');
            const identity = JSON.stringify(snapshot.identity);
            if (firstIdentity && identity !== firstIdentity) throw new Error('最近停留的保存位置发生变化，请重新加载。');
            firstIdentity = identity;
            const next = { ...snapshot.state, recent: [target.ref, ...snapshot.state.recent.filter(value => refKey(value) !== refKey(target.ref))].slice(0, 20) };
            if (refKey(snapshot.state.recent[0]) === refKey(target.ref)) { recentSaved = refKey(target.ref); break; }
            const saved = await fetch('/api/workspace/state', { method: 'POST', cache: 'no-store', keepalive: true, headers: { 'Content-Type': 'application/json', 'X-Workspace-Token': snapshot.token }, body: JSON.stringify({ identity: snapshot.identity, expectedRevision: snapshot.stateRevision, state: next }) });
            const result = await saved.json();
            if (saved.status === 409 && attempt === 0) continue;
            if (!saved.ok || result.ok !== true || JSON.stringify(result.data?.identity) !== firstIdentity || refKey(result.data?.state?.recent?.[0]) !== refKey(target.ref)) throw new Error(result.error?.message || '最近停留尚未确认保存。');
            recentSaved = refKey(target.ref); break;
          }
        } catch (error) { if (isCurrent()) { target.status.textContent = '最近停留暂未保存：' + error.message + ' 这份内容仍可查看，可从当前链接再次打开。'; target.status.hidden = false; } }
      }
    } finally { recentRunning = false; }
  }
  function mountWorkspaceContext(item, panel) {
    const ref = item.workspaceRef;
    const expected = item.source?.kind === 'learning-note' && item.id === 'learning-note:' + item.noteId ? 'note:' + item.noteId
      : item.source?.kind === 'learning-task' && item.id === 'learning-task:' + item.taskId ? 'task:' + item.taskId
      : !item.readOnly && ['creation', 'watch'].includes(item.kind) ? 'content:' + item.id : null;
    if (!expected || !['production', 'isolated'].includes(state.scope) || ref?.module !== 'learning' || ref.kind !== 'learning' || ref.storeId !== state.identity || ref.id !== expected) return;
    const section = node('details', 'content-relations'); section.append(node('summary', '', '相关资料（可选）'));
    const mount = node('div', 'workspace-context-mount'); section.append(mount); panel.append(section);
    const status = node('p', 'helper'); status.hidden = true; status.setAttribute('role', 'status'); panel.append(status);
    const detail = { ref: { module: ref.module, kind: ref.kind, storeId: ref.storeId, id: ref.id }, mount };
    window.workspaceLastContext = detail;
    window.dispatchEvent(new CustomEvent('workspace:context', { detail }));
    void rememberWorkspaceRef(detail.ref, status);
  }
  window.addEventListener('workspace:context-request', () => {
    const detail = window.workspaceLastContext;
    if (detail?.mount?.isConnected) window.dispatchEvent(new CustomEvent('workspace:context', { detail }));
  });
  function renderWarnings(warnings = []) {
    $('sourceWarnings').hidden = !warnings.length;
    $('sourceWarnings').querySelector('div').replaceChildren(...warnings.map(message => node('p', '', typeof message === 'string' ? message : message.message || '有一处原始记录暂时未读到。')));
  }
  function sortItems(items) {
    return [...items].sort((a, b) => {
      const dateA = a.updatedAt || a.createdAt || a.date || '';
      const dateB = b.updatedAt || b.createdAt || b.date || '';
      return dateB.localeCompare(dateA) || String(a.id).localeCompare(String(b.id));
    });
  }
  function itemDate(item) { return item.date || '日期未注明'; }
  function savedTime(value) { const parsed = new Date(value); return value && Number.isFinite(parsed.getTime()) ? new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(parsed) : '保存时间未注明'; }
  function renderList() {
    document.querySelectorAll('[data-kind]').forEach(tab => tab.setAttribute('aria-pressed', String(tab.dataset.kind === state.filter)));
    $('newContent').textContent = state.filter === 'learning' ? '聊一段学习笔记' : '留下一点';
    const words = state.search.trim().toLocaleLowerCase();
    const items = sortItems(state.items).filter(item => (state.filter === 'all' || item.kind === state.filter) && (!words || [item.title, item.body, item.aiText, item.courseName, item.watch?.progress, sourceLabel(item)].join('\n').toLocaleLowerCase().includes(words)));
    $('contentCount').textContent = (words ? '找到 ' : '共 ') + items.length + ' 份内容';
    const cards = items.map(item => {
      const card = button('', () => openItem(item.id), 'content-card'); card.dataset.contentId = item.id; card.setAttribute('aria-current', String(state.selected === item.id));
      const meta = node('span', 'card-meta'); meta.append(node('span', '', kindNames[item.kind] || '原有记录'), node('span', '', itemDate(item)));
      const preview = item.body || item.watch?.progress || item.artifact?.summary || (item.kind === 'watch' ? '片名已经留住，感想可以以后再说。' : '点开继续这一份内容。');
      card.append(meta, node('strong', 'card-title', item.title || '未命名的想法'), node('span', 'card-preview', preview)); return card;
    });
    $('contentList').replaceChildren(...(cards.length ? cards : [node('p', 'list-empty', state.search ? '还没有找到相符的内容，可以换一个关键词。' : '这里还没有内容。想到什么，留下一句就好。')]));
  }
  function destroyWorkshop() { state.workshop?.destroy(); state.workshop = null; }
  function revealDetailOnSmallScreen() { if (window.matchMedia('(max-width: 680px)').matches) $('detailPanel').scrollIntoView({ block: 'start' }); }
  function leaveEditor() {
    if (!state.editor) return true;
    if (state.busy) { editorStatus('正在保存这份内容，请稍等。'); return false; }
    if (state.editor.uncertain) { editorStatus('上次保存的结果还不确定。请先点“重试核对这次保存”，核对完成后再继续编辑或切换。', true); return false; }
    if (!persistEditor()) return false;
    destroyWorkshop(); state.editor = null; return true;
  }
  async function refreshList() {
    const result = await request('items'); acceptIdentity(result); state.items = result.items || []; renderWarnings(result.warnings); renderList();
  }
  async function boot() {
    $('reloadContent').disabled = true; $('connectionState').textContent = '正在找回内容…';
    try {
      const result = await request('bootstrap'); acceptIdentity(result); state.token = result.token; state.items = result.items || []; renderWarnings(result.warnings); renderList();
      $('connectionState').textContent = '四岛共用同一份内容'; $('newContent').disabled = false;
      if (!state.editor && state.selected) await openItem(state.selected);
      return true;
    } catch (error) { clearWorkspaceContext(); $('connectionState').textContent = '暂时没有连接到记录'; notice(error.message, true); return false; }
    finally { $('reloadContent').disabled = false; }
  }
  function addLinks(container, links) {
    if (!links?.length) return;
    const list = node('ul', 'record-links');
    for (const link of links) {
      const row = node('li');
      if (isWebUrl(link.url)) { const anchor = node('a', '', link.label || link.url); anchor.href = link.url; anchor.target = '_blank'; anchor.rel = 'noopener noreferrer'; row.append(anchor); }
      else { row.append(node('span', '', link.label || '文件位置'), node('small', '', link.url)); }
      list.append(row);
    }
    container.append(list);
  }
  function summaryOfArtifact(value) {
    if (!value) return '';
    if (value.summary) return value.summary;
    const artifact = value.artifact || value;
    if (artifact.exercise === 'story') return ['想要：' + (artifact.want || ''), '阻力：' + (artifact.obstacle || ''), '变化：' + (artifact.change || '')].join('\n');
    if (Array.isArray(artifact.order)) {
      const shotNames = { door: '门口', letter: '信封', person: '人物' };
      return artifact.order.map((key, index) => (index + 1) + '. ' + (shotNames[key] || key) + (artifact.exercise === 'post' ? ' · ' + (artifact.durations?.[key] || '') + ' 秒' : '')).join('\n') + (artifact.note ? '\n我的想法：' + artifact.note : '') + (artifact.exercise === 'post' ? '\n声音意图：' + ({ none: '暂不加声音', room: '室内环境声', sea: '远处海风' }[artifact.sound] || '未注明') : '');
    }
    return artifact.note || '这份内容保留了工坊草稿，可以继续调整。';
  }
  function renderDetail(item) {
    clearWorkspaceContext();
    destroyWorkshop(); state.editor = null;
    const panel = $('detailPanel'); panel.replaceChildren();
    const top = node('div', 'detail-topline'); top.append(node('span', '', kindNames[item.kind] || '原有记录'), node('span', '', item.readOnly ? '原处记录 · 只读' : '可以继续补充'));
    panel.append(top, node('h2', 'detail-title', item.title || '未命名的想法'));
    const meta = node('div', 'detail-meta'); meta.append(node('span', '', item.date ? '经历日期 ' + item.date : '经历日期未注明'));
    if (item.kind === 'watch') { meta.append(node('span', '', watchNames[item.watch?.status] || watchNames.unknown)); if (item.watch?.progress) meta.append(node('span', '', item.watch.progress)); }
    if (item.courseId) meta.append(node('span', '', item.courseName || item.courseId));
    if (item.chapter) meta.append(node('span', '', '第 ' + item.chapter + ' 课'));
    const subtypeLabel = { viewing: '观看', idea: '想法', source: '原有内容', practice: '练习', exercise: '练习', story: '故事', visual: '分镜', post: '剪辑', film: '电影', short: '短片', series: '剧集' }[item.subtype] || item.subtype;
    if (subtypeLabel) meta.append(node('span', '', subtypeLabel));
    panel.append(meta);
    if (item.body) panel.append(node('h3', 'response-heading', item.source?.kind === 'learning-note' || item.source?.kind === 'learning-entry' ? '你的原话' : '留下的内容'), node('div', 'detail-body', item.body));
    if (item.aiText) panel.append(node('h3', 'response-heading', item.aiTextCoverage === 'excerpt' ? '当时的 AI 回应节选' : 'AI 回应'), node('div', 'detail-body ai-response', item.aiText));
    if (item.nextStep) panel.append(node('p', 'helper', '想继续的地方：' + item.nextStep));
    addLinks(panel, item.links);
    if (item.artifact) { const saved = node('details', 'exercise-snapshot'); saved.append(node('summary', '', '已留下的练习'), node('pre', '', summaryOfArtifact(item.artifact))); panel.append(saved); }
    const actions = node('div', 'detail-actions');
    if (!item.readOnly) {
      actions.append(button('继续补充', () => openEditor(item, 'append'), 'primary'), button('更正内容', () => openEditor(item, 'correct')));
      if (item.kind === 'watch') actions.append(button('又看了一次', () => openEditor(item, 'rewatch')));
      else if (item.artifact) actions.append(button('继续这份练习', () => openEditor(item, 'append', { openWorkshop: true })));
    } else if (item.kind !== 'learning') {
      actions.append(button('从这条想法继续', () => {
        const sourceUrl = new URL(location.pathname, location.origin); sourceUrl.searchParams.set('item', item.id);
        openEditor(null, 'append', { kind: 'creation', title: item.title, links: [{ label: '原始内容：' + (item.title || sourceLabel(item)), url: sourceUrl.href }] });
      }, 'primary'));
    }
    const resume = item.resumeUrl && safeResumeUrl(item.resumeUrl);
    if (resume) { const anchor = node('a', '', item.kind === 'learning' || !item.readOnly ? '和学习向导聊 →' : '回到原处继续 →'); anchor.href = resume; actions.append(anchor); }
    panel.append(actions);
    const source = node('p', 'source-note', '来源：' + sourceLabel(item) + (item.readOnly ? '。这里保留原内容，修改仍在原处进行。' : '。补充和更正都会保留之前的版本。'));
    if (item.source?.path) source.append(node('br'), document.createTextNode(item.source.path)); panel.append(source);
    if (item.history?.length) {
      const history = node('details', 'record-history'); history.append(node('summary', '', '查看之前的版本（' + item.history.length + '）'));
      for (const version of [...item.history].reverse()) {
        const past = version.item || version;
        const row = node('article', 'history-version');
        row.append(node('strong', '', savedTime(version.savedAt) + ' · ' + ({ append: '补充', correct: '更正', rewatch: '再次观看' }[version.action] || '已保存')), node('p', '', past.title || ''), node('p', '', past.body || (past.artifact ? summaryOfArtifact(past.artifact) : '仅记录了片名或进度。')));
        if (past.aiText) row.append(node('strong', '', 'AI 回应'), node('p', 'ai-response', past.aiText));
        history.append(row);
      }
      panel.append(history);
    }
    mountWorkspaceContext(item, panel);
  }
  async function openItem(id) {
    if (!leaveEditor()) return;
    clearWorkspaceContext();
    const sequence = ++state.detailSequence;
    state.selected = id; renderList();
    $('detailPanel').replaceChildren(node('p', 'helper', '正在读取这份内容…'));
    try {
      const result = await request('items/' + encodeURIComponent(id));
      if (sequence !== state.detailSequence) return;
      if (result.item?.id !== id) throw new Error('读取结果与所选内容不一致，请重新读取。');
      acceptIdentity(result); renderDetail(result.item); revealDetailOnSmallScreen();
      const url = new URL(location.href); url.searchParams.set('item', id); url.searchParams.delete('intent'); history.replaceState(null, '', url);
    } catch (error) { if (sequence === state.detailSequence) { $('detailPanel').replaceChildren(node('p', 'helper', error.message), button('重新读取', () => openItem(id))); } }
  }
  function blankEditor(item, action, overrides) {
    return {
      identity: state.identity, revision: state.revision, id: item?.id || null, kind: overrides.kind || item?.kind || 'creation', action,
      title: overrides.title ?? item?.title ?? '', body: action === 'correct' ? (item?.body || '') : '', date: action === 'rewatch' ? null : item?.date || null,
      subtype: item?.subtype || '', domains: clone(item?.domains || (island !== 'home' ? [island] : [])), nextStep: item?.nextStep || '',
      watch: clone(action === 'rewatch' ? { status: 'unknown', progress: '' } : item?.watch || { status: 'unknown', progress: '' }), links: clone(overrides.links || item?.links || []),
      artifact: clone(item?.artifact || null), original: item ? clone(item) : null, openWorkshop: !!overrides.openWorkshop,
      workshopMode: item?.artifact?.island || item?.artifact?.artifact?.exercise || (island === 'home' ? 'story' : island), pending: null
    };
  }
  function openEditor(item = null, action = 'append', overrides = {}) {
    if (!leaveEditor()) return;
    clearWorkspaceContext();
    ++state.detailSequence; state.selected = item?.id || null; renderList();
    const base = blankEditor(item, action, overrides);
    const draft = readDraft(base);
    state.editor = draft?.uncertain ? { ...draft, original: base.original } : base;
    renderEditor(draft?.uncertain ? null : draft);
    revealDetailOnSmallScreen();
  }
  function field(label, input) { const wrapper = node('label', 'field'); wrapper.append(node('span', '', label), input); return wrapper; }
  function makeInput(editor, key, opts = {}) {
    const input = node(opts.multiline ? 'textarea' : 'input');
    input.id = opts.id || 'content-' + key; if (!opts.multiline) input.type = opts.type || 'text';
    input.value = editor[key] || ''; input.placeholder = opts.placeholder || ''; input.maxLength = opts.maxLength || (opts.multiline ? 20000 : 300);
    input.addEventListener('input', () => { editor[key] = input.value || (key === 'date' ? null : ''); editor.pending = null; persistEditor(); });
    return input;
  }
  function renderEditor(recoverable = null) {
    const editor = state.editor; if (!editor) return;
    destroyWorkshop(); const panel = $('detailPanel'); panel.replaceChildren();
    const heading = node('div', 'editor-heading');
    heading.append(node('h2', '', editor.id ? ({ append: '接着留下一点', correct: '更正这份内容', rewatch: '又看了一次' }[editor.action]) : '随手留下一点'), button('收起', () => {
      if (!leaveEditor()) return;
      if (state.selected) openItem(state.selected); else panel.replaceChildren(node('div', 'empty-detail', '草稿已留在这个浏览器，下次可以接着写。'));
    }, 'text-button')); panel.append(heading);
    if (recoverable && recoverable.identity === editor.identity) {
      const recovery = node('div', 'draft-recovery', '这里还有一份没有保存的草稿。');
      recovery.append(node('br'), button('继续这份草稿', () => { state.editor = { ...recoverable, original: editor.original }; renderEditor(); }), button('先写这次的', () => { persistEditor(); renderEditor(); }, 'text-button')); panel.append(recovery);
    }
    if (!editor.id) {
      const kinds = node('div', 'editor-kind');
      for (const [kind, label] of [['creation', '创作与想法'], ['watch', '观看记录']]) {
        const control = button(label, () => { if (kind !== editor.kind) openEditor(null, 'append', { kind }); }); control.dataset.editorKind = kind; control.setAttribute('aria-pressed', String(editor.kind === kind)); kinds.append(control);
      }
      panel.append(kinds);
    } else {
      panel.append(node('p', 'helper', editor.action === 'correct' ? '直接改正当前内容，原来的版本仍会保留。' : '这次写下的文字会接在原记录后面，仍是同一份内容。'));
    }
    const form = node('form'); form.id = 'contentEditor'; form.addEventListener('submit', event => { event.preventDefault(); saveEditor(); });
    form.append(field(editor.kind === 'watch' ? '作品名' : '起个短标题（可不填）', makeInput(editor, 'title', { placeholder: editor.kind === 'watch' ? '电影、短片、剧集、动漫…' : '也可以直接在下面写一句话', maxLength: 300 })), field(editor.kind === 'watch' ? '想留下的话（可不填）' : '你的文字', makeInput(editor, 'body', { multiline: true, placeholder: editor.kind === 'watch' ? '只记片名也可以。看到哪、有什么感觉，以后再补。' : '一个想法、一段故事、一次尝试…' })));
    const optional = node('details', 'optional-fields'); optional.append(node('summary', '', '日期、进度与作品位置 · 按需补充'));
    const meta = node('div', 'two-fields'); meta.append(field('经历日期（可留空）', makeInput(editor, 'date', { type: 'date' })), field('内容类型（可留空）', makeInput(editor, 'subtype', { placeholder: editor.kind === 'watch' ? '电影 / 短片 / 电视剧…' : '故事 / 分镜 / 剪辑 / 灵感…', maxLength: 80 }))); optional.append(meta);
    if (editor.kind === 'watch') {
      const select = node('select'); select.id = 'watch-status';
      Object.entries(watchNames).forEach(([value, label]) => { const option = node('option', '', label); option.value = value; select.append(option); }); select.value = editor.watch.status || 'unknown';
      select.addEventListener('change', () => { editor.watch.status = select.value; editor.pending = null; persistEditor(); });
      const progress = node('input'); progress.id = 'watch-progress'; progress.placeholder = '比如：看到第 3 集 / 看了开头'; progress.value = editor.watch.progress || ''; progress.maxLength = 500;
      progress.addEventListener('input', () => { editor.watch.progress = progress.value; editor.pending = null; persistEditor(); });
      const row = node('div', 'two-fields'); row.append(field('观看情况', select), field('看到哪里（可留空）', progress)); optional.append(row);
    }
    const links = node('textarea'); links.id = 'content-links'; links.rows = 2; links.style.minHeight = '78px'; links.placeholder = '一行一个网址或电脑上的完整文件路径'; links.value = editor.links.map(link => link.label ? link.label + ' | ' + link.url : link.url).join('\n');
    links.addEventListener('input', () => { editor.links = links.value.split(/\r?\n/).filter(line => line.trim()).map(line => { const split = line.indexOf(' | '); return split < 0 ? { label: '', url: line.trim() } : { label: line.slice(0, split).trim(), url: line.slice(split + 3).trim() }; }); editor.pending = null; persistEditor(); });
    optional.append(field('作品或文件的位置（可留空）', links), node('p', 'helper', '这里只留下位置，原文件仍在原处。可写成“名称 | 位置”。'), field('下次想从哪继续（可留空）', makeInput(editor, 'nextStep', { placeholder: '想到再写，不需要现在安排', maxLength: 2000 }))); form.append(optional);
    if (editor.kind === 'creation') addWorkshop(form, editor);
    const status = node('p', 'editor-status', '输入会暂存在这个浏览器；点保存后才进入共用内容。'); status.id = 'editorStatus'; status.setAttribute('role', 'status'); form.append(status);
    const conflict = node('div'); conflict.id = 'conflictArea'; form.append(conflict);
    const footer = node('div', 'editor-footer'); const save = node('button', 'primary', editor.id ? '保存这次内容' : '保存'); save.type = 'submit'; save.id = 'saveContent';
    footer.append(save, node('p', 'helper', editor.kind === 'watch' ? '片名就够，不用写感想或评分。' : '保存想法与尝试，不会自动成为正式影视项目。')); form.append(footer); panel.append(form);
    if (editor.openWorkshop && editor.kind === 'creation') mountWorkshop(editor);
    if (editor.uncertain) { lockUncertainEditor(true); editorStatus('上次保存的结果还不确定。原请求与文字已经留住，请先重试核对。', true); }
  }
  function artifactDraft(editor) {
    if (editor.artifact?.draft) return editor.artifact.draft;
    const artifact = editor.artifact?.artifact || editor.artifact;
    if (artifact?.exercise) return { [artifact.exercise]: clone(artifact) };
    return null;
  }
  function addWorkshop(form, editor) {
    const details = node('details', 'workshop-toggle'); details.id = 'workshopTools'; details.open = editor.openWorkshop; details.append(node('summary', '', '想试一试？打开故事、分镜或节奏练习'));
    const modes = node('div', 'workshop-modes');
    for (const [mode, label] of [['story', '故事便签'], ['visual', '分镜顺序'], ['post', '节奏尝试']]) {
      const control = button(label, () => { editor.workshopMode = mode; editor.openWorkshop = true; persistEditor(); mountWorkshop(editor); }); control.dataset.workshopMode = mode; modes.append(control);
    }
    details.append(modes, node('p', 'helper', '练习会附在这一份内容里，原来的文字照常保留。'));
    const mount = node('div'); mount.id = 'workshopMount'; details.append(mount);
    details.addEventListener('toggle', () => { editor.openWorkshop = details.open; persistEditor(); if (details.open && !state.workshop) mountWorkshop(editor); else if (!details.open) destroyWorkshop(); }); form.append(details);
  }
  function mountWorkshop(editor) {
    destroyWorkshop(); const mount = $('workshopMount'); if (!mount || !window.LearningWorkshop) return;
    document.querySelectorAll('[data-workshop-mode]').forEach(control => control.setAttribute('aria-pressed', String(control.dataset.workshopMode === editor.workshopMode)));
    state.workshop = window.LearningWorkshop.mount(mount, {
      island: editor.workshopMode, draft: artifactDraft(editor),
      onDraft(draft) { editor.artifact = { artifact: { version: 1, exercise: editor.workshopMode, ...clone(draft[editor.workshopMode]) }, draft, island: editor.workshopMode }; editor.pending = null; persistEditor(); },
      async onSave(result) {
        editor.artifact = { artifact: result.artifact, draft: result.draft, island: result.island, summary: result.summary };
        if (!editor.title.trim()) { editor.title = result.title; const title = $('content-title'); if (title) title.value = result.title; }
        editor.domains = [...new Set([...(editor.domains || []), result.island])]; editor.pending = null; persistEditor();
        if (!await saveEditor()) throw new Error('暂时没有保存');
      }
    });
    const workshopSave = mount.querySelector('.lw-footer button:last-child'); if (workshopSave) workshopSave.textContent = '保存到这份内容';
  }
  function payloadFor(editor) {
    const exerciseTitle = editor.artifact ? ({ story: '故事便签', visual: '分镜顺序', post: '节奏尝试' }[editor.artifact.island || editor.artifact.artifact?.exercise || editor.workshopMode] || '练习尝试') : '';
    const title = editor.title.trim() ? editor.title : (editor.kind === 'creation' ? editor.body.trim().split(/\r?\n/)[0].slice(0, 48) || exerciseTitle : '');
    if (editor.kind === 'watch' && !title) throw new Error('先留一个作品名就可以。');
    if (editor.kind === 'creation' && !title && !editor.body.trim() && !editor.artifact) throw new Error('先写一句话，或留下一份练习。');
    return { ...(editor.id ? { id: editor.id } : {}), kind: editor.kind, title, body: editor.body, date: editor.date || null, subtype: editor.subtype, domains: editor.domains || [], nextStep: editor.nextStep, watch: editor.kind === 'watch' ? editor.watch : undefined, links: editor.links, artifact: editor.artifact || undefined };
  }
  function lockUncertainEditor(locked) {
    const form = $('contentEditor'); if (!form) return;
    form.querySelectorAll('input,textarea,select,button').forEach(control => { if (control.id !== 'saveContent') control.disabled = locked; });
    if ($('workshopTools')) $('workshopTools').inert = locked;
    document.querySelectorAll('.editor-kind button,.editor-heading button').forEach(control => { control.disabled = locked; });
    if ($('saveContent')) $('saveContent').textContent = locked ? '重试核对这次保存' : state.editor?.id ? '保存这次内容' : '保存';
  }
  async function showConflict(editor, message) {
    const region = $('conflictArea'); if (!region) return;
    region.replaceChildren();
    const box = node('div', 'conflict-review'); box.append(node('h3', '', '保存前，需要核对一下最新记录'), node('p', '', message + '\n你的输入和草稿仍然保留。'));
    const reload = button('读取最新内容并对照', async () => {
      reload.disabled = true;
      try {
        const result = await request(editor.id ? 'items/' + encodeURIComponent(editor.id) : 'items'); acceptIdentity(result);
        if (state.editor !== editor) return;
        if (result.item) {
          box.append(node('h3', '', '当前已保存的内容'), node('p', '', (result.item.title || '') + '\n\n' + (result.item.body || '（仅标题或练习）')));
          if (result.item.artifact) box.append(node('h3', '', '当前已保存的练习'), node('p', '', summaryOfArtifact(result.item.artifact)));
          if (editor.artifact) box.append(node('p', '', '再次保存将采用本页的练习设置；最新记录里的旧练习仍保留在版本历史中。'));
          editor.original = clone(result.item);
        }
        editor.revision = result.revision; editor.pending = null; persistEditor();
        box.append(node('p', '', '输入框保留的是你这次的文字。核对后，再点“保存这次内容”。')); reload.remove();
        editorStatus('已读到最新版本。请核对后手动保存这次输入。');
      } catch (error) { editorStatus(error.message, true); reload.disabled = false; }
    }); box.append(reload); region.append(box);
  }
  async function saveEditor() {
    const editor = state.editor; if (!editor || state.busy) return false;
    if (editor.identity !== state.identity) { editorStatus('资料位置已经改变，不能把原资料的草稿写入新位置。请刷新页面后核对。', true); return false; }
    let item;
    try { item = payloadFor(editor); } catch (error) { editorStatus(error.message, true); return false; }
    const fingerprint = JSON.stringify(item) + editor.action + editor.revision;
    if (!editor.pending || (!editor.uncertain && editor.pending.fingerprint !== fingerprint)) {
      const submissionId = uid();
      editor.pending = { fingerprint, submissionId, request: { identity: editor.identity, expectedRevision: editor.revision, submissionId, item: clone(item), action: editor.action } };
    }
    if (!editor.pending.request) editor.pending.request = { identity: editor.identity, expectedRevision: editor.revision, submissionId: editor.pending.submissionId, item: clone(item), action: editor.action };
    editor.uncertain = true; persistEditor(); state.busy = true; $('saveContent').disabled = true; $('contentEditor').inert = true; editorStatus('正在保存…');
    let writeConfirmed = false;
    try {
      const result = await request('save', editor.pending.request);
      writeConfirmed = true;
      acceptIdentity(result);
      editorStatus('已经保存，正在回读确认…');
      const [detail, listing] = await Promise.all([request('items/' + encodeURIComponent(result.item.id)), request('items')]);
      acceptIdentity(detail); acceptIdentity(listing);
      clearDraft(editor); state.items = listing.items || []; renderWarnings(listing.warnings); state.selected = result.item.id; state.editor = null; destroyWorkshop();
      renderList(); renderDetail(detail.item);
      const url = new URL(location.href); url.searchParams.set('item', result.item.id); url.searchParams.delete('intent'); history.replaceState(null, '', url);
      notice(result.duplicate ? '已经找回刚才保存的内容，没有重复增加。' : '已保存，再从任何一座岛进来都能接着用。');
      return true;
    } catch (error) {
      editor.uncertain = writeConfirmed || !error.status || error.status >= 500;
      persistEditor(); lockUncertainEditor(editor.uncertain);
      editorStatus(error.message + (editor.uncertain ? '\n这次保存的结果尚未核实。输入已锁住，请重试核对原来的请求。' : '\n输入已保留，可以再次保存。'), true);
      if (error.status === 409 && !editor.uncertain) await showConflict(editor, error.message);
      return false;
    } finally { state.busy = false; if ($('saveContent')) $('saveContent').disabled = false; if ($('contentEditor')) $('contentEditor').inert = false; }
  }
  $('islandContext').textContent = island === 'home' ? '' : '从' + islandNames[island] + '来到这里 · 内容在四岛间共用';
  $('backToIsland').href = '/terminal/#' + island; $('backToIsland').textContent = '← 回到' + islandNames[island];
  $('talkToGuide').addEventListener('click', event => { if (!leaveEditor()) event.preventDefault(); });
  $('newContent').addEventListener('click', () => { notice(''); if (state.filter === 'learning') { if (leaveEditor()) location.assign('/learning/?entry=record'); return; } openEditor(null, 'append', { kind: state.filter === 'watch' ? 'watch' : 'creation' }); });
  $('reloadContent').addEventListener('click', () => { notice(''); boot(); });
  document.querySelectorAll('[data-kind]').forEach(control => control.addEventListener('click', () => { state.filter = control.dataset.kind; renderList(); const url = new URL(location.href); if (state.filter === 'all') url.searchParams.delete('view'); else url.searchParams.set('view', state.filter); history.replaceState(null, '', url); }));
  $('searchForm').addEventListener('submit', event => { event.preventDefault(); state.search = $('searchInput').value; renderList(); });
  $('clearSearch').addEventListener('click', () => { state.search = ''; $('searchInput').value = ''; renderList(); });
  window.addEventListener('pagehide', persistEditor);
  window.addEventListener('beforeunload', event => { if (state.busy || (state.editor && !persistEditor())) { event.preventDefault(); event.returnValue = ''; } });
  boot().then(loaded => { if (!loaded) return; if (query.get('item')) openItem(query.get('item')); else if (query.get('intent') === 'practice') openEditor(null, 'append', { kind: 'creation', openWorkshop: true }); });
})();
