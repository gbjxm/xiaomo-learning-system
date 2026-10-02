'use strict';

// UI drafts use a separate versioned file. Only explicit chat requests reach the
// existing learning API; hand-entered schedules and bookmarks never do so.
(() => {
  const ui = { ready: false, identity: null, revision: null, token: '', saving: null, pending: null, blocked: false, restoring: false, lastSaved: null, timer: null };
  const cacheBase = 'xiaomo-learning-island-ui-v1:' + location.origin;
  let tabId;
  try { tabId = sessionStorage.getItem('xiaomo-learning-island-tab') || crypto.randomUUID(); sessionStorage.setItem('xiaomo-learning-island-tab', tabId); }
  catch { tabId = crypto.randomUUID(); }
  const cacheKey = cacheBase + ':tab:' + tabId;
  const stateKeys = ['current', 'overview', 'tab', 'plan', 'planAdopted', 'activities', 'active', 'records', 'chat', 'mode', 'reentry', 'timeSetup', 'acceptedTimePlan', 'timeDirty', 'timeActivityId', 'composerDrafts'];
  const lifeKeys = ['open', 'place', 'drafts', 'previousDrafts', 'watch', 'tone', 'still', 'pet'];
  const fieldIds = ['intent', 'lessonLength', 'materialName', 'destination', 'chatMode', 'skipChatSave'];
  let pendingChatRequest = null, chatBusy = false, currentDate = chinaDate();
  const clone = value => structuredClone(value);
  const stringify = value => JSON.stringify(value);
  const requestId = () => crypto.randomUUID();
  const bytes = value => new TextEncoder().encode(typeof value === 'string' ? value : stringify(value)).byteLength;
  const isObject = value => value && typeof value === 'object' && !Array.isArray(value);

  const statusBox = el('section', undefined, 'ui-save-status'); statusBox.id = 'uiSaveStatus';
  statusBox.setAttribute('aria-label', '界面草稿保存');
  const statusText = el('p', '正在读取本机界面草稿…'); statusText.id = 'uiSaveText'; statusText.setAttribute('role', 'status');
  const statusActions = el('div', undefined, 'ui-save-actions');
  const retryButton = button('重新连接保存', () => reconnect()); retryButton.id = 'retryUiSave'; retryButton.hidden = true;
  const downloadButton = button('下载本页草稿', downloadSnapshot); downloadButton.id = 'downloadUiDraft'; downloadButton.hidden = true;
  const reloadButton = button('读取最新界面', () => reconnect({ discardLocal: true })); reloadButton.id = 'reloadUiState'; reloadButton.hidden = true;
  statusActions.append(retryButton, downloadButton, reloadButton); statusBox.append(statusText, statusActions);
  $('learningPanel').querySelector('.panel-heading').after(statusBox);

  const chatOptions = el('div', undefined, 'chat-options'); chatOptions.id = 'chatOptions';
  const modeLabel = el('label', '本次交流'); modeLabel.htmlFor = 'chatMode';
  const modeSelect = el('select'); modeSelect.id = 'chatMode';
  for (const [value, label] of [['chat', '自由交流'], ['question', '理解一个问题'], ['plan', '请向导帮我安排'], ['progress', '聊聊实际进展'], ['wrap', '这块先到这里']]) { const option = el('option', label); option.value = value; modeSelect.append(option); }
  const skipLabel = el('label', undefined, 'skip-chat-save'), skip = el('input'); skip.type = 'checkbox'; skip.id = 'skipChatSave'; skipLabel.append(skip, document.createTextNode('这次只聊，不写学习记录'));
  const chatHint = el('p', '聊天实际请求现有接口；本次参考最近少量交流。手动安排与界面草稿分别保存。', 'note');
  chatOptions.append(modeLabel, modeSelect, skipLabel, chatHint); $('planForm').append(chatOptions);
  $('intent').maxLength = 16000;
  const chatError = el('p', undefined, 'chat-error'); chatError.id = 'chatError'; chatError.hidden = true; chatError.setAttribute('role', 'alert'); $('chatLog').before(chatError);
  const connection = el('p', '正在检查学习聊天接口…', 'chat-connection'); connection.id = 'chatConnection'; $('learningPanel').querySelector('.context').after(connection);

  function chinaDate() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
  function snapshot() {
    state.composerDrafts ??= { plan: '', chat: '' };
    state.composerDrafts[state.mode] = $('intent').value;
    const islandState = Object.fromEntries(stateKeys.map(key => [key, clone(state[key] ?? null)]));
    const lifeState = Object.fromEntries(lifeKeys.map(key => [key, clone(life[key] ?? null)]));
    const fields = Object.fromEntries(fieldIds.map(id => [id, $(id)?.type === 'checkbox' ? $(id).checked : $(id)?.value ?? '']));
    fields.pendingChatRequest = pendingChatRequest ? clone(pendingChatRequest) : null;
    fields.timeReferenceDate = currentDate;
    return { version: 1, islandState, lifeState, fields, panelOpen: !$('learningPanel').hidden };
  }
  function showStatus(text, error = false) { statusText.textContent = text; statusBox.classList.toggle('save-error', error); retryButton.hidden = !error; downloadButton.hidden = !error; reloadButton.hidden = !ui.blocked; }
  function remember() {
    const value = snapshot();
    try {
      const dirty = stringify(value) !== stringify(ui.lastSaved);
      localStorage.setItem(cacheKey, stringify({ identity: ui.identity, baseRevision: ui.revision, state: value, lastSaved: ui.lastSaved, dirty }));
      if (dirty) localStorage.setItem(cacheBase + ':last-dirty', cacheKey);
      else if (localStorage.getItem(cacheBase + ':last-dirty') === cacheKey) localStorage.removeItem(cacheBase + ':last-dirty');
    }
    catch { showStatus('浏览器草稿备份不可用；以本机保存结果为准，离开前可下载草稿。', true); }
    return value;
  }
  function cached() {
    try {
      const own = localStorage.getItem(cacheKey);
      const lastKey = !own ? localStorage.getItem(cacheBase + ':last-dirty') : null;
      const saved = JSON.parse(own || (lastKey?.startsWith(cacheBase + ':tab:') ? localStorage.getItem(lastKey) : null) || localStorage.getItem(cacheBase));
      return isObject(saved) && saved.state?.version === 1 ? saved : null;
    } catch { return null; }
  }
  function downloadSnapshot() {
    const value = { kind: 'learning-island-ui-draft', identity: ui.identity, baseRevision: ui.revision, savedAt: new Date().toISOString(), state: snapshot(), notice: '界面草稿与用户输入，不是学习进展或能力认证。' };
    const url = URL.createObjectURL(new Blob([stringify(value)], { type: 'application/json;charset=utf-8' }));
    const link = el('a'); link.href = url; link.download = '学习小岛-界面草稿.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function call(route, options = {}) {
    let response, body;
    try { response = await fetch(route, { cache: 'no-store', ...options }); body = await response.json(); }
    catch { throw { code: 'NETWORK_ERROR', message: '本机连接未确认完成，当前草稿已保留。连接恢复后可重新保存。' }; }
    if (!response.ok || body.ok === false) throw { ...body.error, code: body.error?.code || 'HTTP_ERROR', message: typeof body.error === 'string' ? body.error : body.error?.message || body.message || '请求失败：' + response.status, status: response.status };
    return body.data ?? body;
  }
  function safeSnapshot(value) {
    if (!isObject(value) || value.version !== 1 || !isObject(value.islandState) || !isObject(value.lifeState) || !isObject(value.fields)) throw { code: 'INVALID_UI_STATE', message: '界面草稿格式不完整，未应用。可以先下载当前草稿。' };
    const s = value.islandState;
    if (!Object.hasOwn(islands, s.current) || !['plan', 'chat'].includes(s.mode) || !isObject(s.activities) || !Array.isArray(s.records) || !Array.isArray(s.chat)) throw { code: 'INVALID_UI_STATE', message: '界面草稿中的岛、交流或活动结构不合法，未应用。' };
    if (s.active && !Object.hasOwn(islands, s.active)) throw { code: 'INVALID_UI_STATE', message: '活动归属不合法。' };
    for (const [key, activity] of Object.entries(s.activities)) if (!Object.hasOwn(islands, key) || !isObject(activity) || activity.island !== key || typeof activity.title !== 'string') throw { code: 'INVALID_UI_STATE', message: '活动草稿结构不合法。' };
    if (s.records.some(r => !isObject(r) || !Object.hasOwn(islands, r.island) || typeof r.title !== 'string')) throw { code: 'INVALID_UI_STATE', message: '书签结构不合法。' };
    if (s.chat.some(m => !isObject(m) || !['user', 'guide'].includes(m.role) || typeof m.text !== 'string')) throw { code: 'INVALID_UI_STATE', message: '交流原话结构不合法。' };
    if (!isObject(s.timeSetup) || !Array.isArray(s.timeSetup.windows)) throw { code: 'INVALID_UI_STATE', message: '时间草稿结构不合法。' };
    for (const plan of [s.plan, s.acceptedTimePlan]) if (plan && (!Object.hasOwn(islands, plan.dest) || !isObject(plan.timing) || !Array.isArray(plan.timing.windows) || !Array.isArray(plan.setup?.windows))) throw { code: 'INVALID_UI_STATE', message: '手动安排结构不合法。' };
    return value;
  }
  function apply(value) {
    safeSnapshot(value); ui.restoring = true;
    try {
      const s = value.islandState, l = value.lifeState, fields = value.fields;
      stopWorkshop();
      for (const key of stateKeys) if (Object.hasOwn(s, key)) state[key] = clone(s[key]);
      for (const key of lifeKeys) if (Object.hasOwn(l, key)) life[key] = clone(l[key]);
      state.cue = false; state.reminder = 'off'; state.active = state.activities[state.active] ? state.active : null; life.quiet = false; life.sound = false; life.sceneKey = '';
      const restore = { current: state.current, overview: state.overview, tab: state.tab, mode: state.mode, open: life.open };
      for (const id of fieldIds) if (Object.hasOwn(fields, id) && $(id)) { if ($(id).type === 'checkbox') $(id).checked = fields[id] === true; else $(id).value = typeof fields[id] === 'string' ? fields[id] : ''; }
      pendingChatRequest = isObject(fields.pendingChatRequest) ? clone(fields.pendingChatRequest) : null;
      currentDate = typeof fields.timeReferenceDate === 'string' ? fields.timeReferenceDate : chinaDate();
      visit(restore.current); state.tab = restore.tab; life.open = restore.open;
      if (restore.overview) overview(); else render();
      setMode(restore.mode); if (typeof fields.intent === 'string') $('intent').value = fields.intent;
      window.refreshIslandTimeControls?.();
      setPanel(value.panelOpen !== false);
      document.body.classList.toggle('tone-gold', life.tone === 'gold'); document.body.classList.toggle('tone-night', life.tone === 'night'); document.body.classList.toggle('is-still', life.still === true);
      $('dayTone').textContent = ({ day: '清晨', gold: '午后', night: '晚风' })[life.tone] || '清晨';
      $('stillScene').textContent = life.still ? '动效：关' : '动效：开'; $('stillScene').setAttribute('aria-pressed', String(!life.still));
      const recovered = [];
      if (Object.keys(state.activities).length) recovered.push('活动位置');
      if (state.chat.length) recovered.push('交流原话');
      if (state.records.length) recovered.push('书签');
      if (Object.keys(life.drafts).length || fields.intent?.trim() || state.plan) recovered.push('界面草稿');
      state.reentry = recovered.length > 0;
      $('reentryBanner').textContent = recovered.length ? `已找回上次的${recovered.join('、')}；实际学习进展以项目记录为准。` : '界面接续已就绪；书签会在你留下之后出现。';
      renderHome(); renderPanel(); renderChat();
      if (currentDate !== chinaDate() && state.plan) $('reentryBanner').textContent = '已恢复之前的界面草稿；时间安排仍是当时的填写值，使用前请调整起止。';
    } finally { ui.restoring = false; }
  }
  function queueSave() {
    if (ui.restoring) return;
    remember(); clearTimeout(ui.timer);
    if (!ui.ready || ui.blocked) return;
    ui.timer = setTimeout(() => flush().catch(() => {}), 250);
  }
  async function flush() {
    clearTimeout(ui.timer);
    if (!ui.ready || ui.blocked) return false;
    if (ui.saving) { const saved = await ui.saving; if (saved && !ui.blocked && stringify(snapshot()) !== stringify(ui.lastSaved)) return flush(); return saved; }
    const value = remember(), signature = stringify(value);
    if (signature === stringify(ui.lastSaved)) return true;
    if (bytes(value) > 128 * 1024) { showStatus('界面草稿超过 128 KiB，尚未保存到磁盘。完整输入仍在本页和浏览器草稿中，可下载后再整理。', true); return false; }
    if (!ui.pending || ui.pending.signature !== signature || ui.pending.input.expectedRevision !== ui.revision) ui.pending = { signature, input: { identity: ui.identity, expectedRevision: ui.revision, submissionId: requestId(), state: value } };
    const pending = ui.pending; showStatus('正在保存界面草稿…');
    ui.saving = (async () => {
      try {
        const result = await call('/api/learning/ui-state', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Learning-Token': ui.token }, body: stringify(pending.input) });
        if (!result.verification?.persisted || !result.verification?.snapshotVerified) throw { code: 'UI_SAVE_UNVERIFIED', message: '界面写入回读尚未确认，请保留草稿并用相同内容重试。' };
        const receipt = result.receipt;
        ui.revision = receipt.revision; ui.lastSaved = clone(pending.input.state); ui.pending = null;
        if (result.revision && result.revision !== receipt.revision && stringify(result.state) !== signature) { ui.blocked = true; showStatus('另一页又更新了界面。本页草稿保留；请下载后读取最新版本，避免覆盖。', true); }
        else showStatus(`${ui.identity.scope === 'production' ? '界面草稿已保存' : '隔离界面草稿已保存'} · v${ui.revision} · 不等于学习进展`);
        remember(); return !ui.blocked;
      } catch (error) {
        if (['REVISION_CONFLICT', 'UI_REVISION_CONFLICT', 'STORE_IDENTITY_MISMATCH', 'UI_IDENTITY_MISMATCH'].includes(error.code)) ui.blocked = true;
        showStatus(`${error.code || '保存失败'}：${error.message} ${ui.blocked ? '本页草稿保留；先下载，再读取最新界面。' : ''}`, true);
        remember(); return false;
      } finally { ui.saving = null; }
    })();
    return ui.saving;
  }
  async function reconnect({ discardLocal = false } = {}) {
    if (ui.saving) await ui.saving;
    if (discardLocal) { try { localStorage.setItem(cacheKey + ':previous', stringify({ identity: ui.identity, baseRevision: ui.revision, state: snapshot(), savedAt: new Date().toISOString() })); } catch {} }
    const retained = discardLocal ? null : cached();
    ui.ready = false; showStatus('正在核对本机界面版本…');
    try {
      let loaded;
      try { loaded = await call('/api/learning/ui-state'); }
      catch (error) {
        if (error.code !== 'UI_STATE_MISSING') throw error;
        ui.token = error.details?.token || '';
        showStatus('首次建立本机界面草稿；不会创建学习进展…');
        loaded = await call('/api/learning/ui-state/init', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Learning-Token': ui.token }, body: stringify({ state: snapshot() }) });
      }
      if (!loaded.identity || !Number.isSafeInteger(loaded.revision)) throw { code: 'INVALID_UI_STATE', message: '界面数据身份或版本缺失。' };
      ui.identity = loaded.identity; ui.revision = loaded.revision; ui.token = loaded.token || ui.token; ui.lastSaved = clone(loaded.state); ui.pending = null; ui.blocked = false;
      const sameStore = retained?.identity?.storeId === loaded.identity.storeId && retained.identity.canonicalPath === loaded.identity.canonicalPath && retained.identity.scope === loaded.identity.scope;
      if (retained?.dirty && sameStore && stringify(retained.state) !== stringify(loaded.state)) {
        apply(retained.state);
        if (retained.baseRevision !== loaded.revision && stringify(retained.lastSaved) !== stringify(loaded.state)) { ui.revision = retained.baseRevision; ui.blocked = true; showStatus('发现本页未保存草稿及更新的磁盘版本。草稿已找回，未覆盖磁盘；请下载后读取最新界面。', true); }
      } else apply(loaded.state);
      ui.ready = true;
      if (!ui.blocked) { showStatus(`${loaded.identity.scope === 'production' ? '本机界面已恢复' : '隔离界面已恢复'} · v${ui.revision} · 不等于学习进展`); queueSave(); }
    } catch (error) { ui.ready = false; showStatus(`${error.code || '读取失败'}：${error.message} 当前输入保留，可下载。`, true); }
  }
  function decorateModes() {
    chatOptions.hidden = state.mode !== 'chat';
    $('sendButton').textContent = chatBusy ? '正在发送…' : state.mode === 'plan' ? '按填写值查看安排' : '发送这段交流';
    $('sendButton').disabled = chatBusy;
  }
  const previousSetMode = setMode;
  setMode = function(mode) { const result = previousSetMode(mode); decorateModes(); queueSave(); return result; };
  const previousRenderPanel = renderPanel;
  renderPanel = function() { const result = previousRenderPanel(); decorateModes(); return result; };
  for (const name of ['render', 'renderSpace', 'syncLife']) {
    const original = name === 'render' ? render : name === 'renderSpace' ? renderSpace : syncLife;
    const wrapped = function(...args) { const result = original(...args); if (!ui.restoring) queueSave(); return result; };
    if (name === 'render') render = wrapped; else if (name === 'renderSpace') renderSpace = wrapped; else syncLife = wrapped;
  }
  const previousRenderClose = renderClose;
  renderClose = function(body, activity) {
    previousRenderClose(body, activity);
    const action = button('请向导整理这次收尾', async () => {
      const message = `这块先到这里。${activity.closeDraft || ''}\n本次进展自述：${reports[activity.report] || '暂停，完成情况未说明'}\n下次入口：${activity.nextDraft || '仍待决定'}`;
      const done = await sendChat({ message, mode: 'wrap', skipSave: false, useComposer: false });
      if (done) { finish(true); queueSave(); }
    }, 'primary'); action.id = 'aiWrapButton';
    body.querySelector('.close-entry')?.append(action, el('p', '该按钮会发送真实收尾请求；成功后按既有学习保存规则写入。手动书签仅保存界面状态。', 'note'));
  };
  const previousSend = send;
  send = async function() {
    if (state.mode === 'plan') { currentDate = chinaDate(); previousSend(); queueSave(); return; }
    await sendChat({ message: $('intent').value.trim() || ($('chatMode').value === 'wrap' ? '今天先到这里。' : ''), mode: $('chatMode').value, skipSave: $('skipChatSave').checked, useComposer: true });
  };
  function historyForChat() {
    const result = []; let total = 0;
    for (const message of state.chat.slice().reverse()) {
      if (message.status === 'pending' || message.status === 'failed' || message.requestId === pendingChatRequest?.requestId) continue;
      const entry = { role: message.role === 'guide' ? 'assistant' : 'user', content: message.text.slice(0, 5000) };
      const length = bytes(entry.content); if (total + length > 20000 || result.length >= 12) break;
      total += length; result.unshift(entry);
    }
    return result;
  }
  async function sendChat({ message, mode, skipSave, useComposer }) {
    if (chatBusy) return false;
    if (!message) { notice('先说一句想聊什么；手动时间安排也可以留到以后。'); $('intent').focus(); return false; }
    if (message.length > 16000) { notice('本次交流不超过 16000 字符；原文仍保留。'); return false; }
    const retry = pendingChatRequest && pendingChatRequest.message === message && pendingChatRequest.mode === mode && pendingChatRequest.skipSave === skipSave;
    const request = retry ? pendingChatRequest : { message, mode, skipSave, requestId: requestId(), history: historyForChat() };
    pendingChatRequest = clone(request); chatBusy = true; decorateModes(); chatError.hidden = true;
    let userMessage = state.chat.find(m => m.role === 'user' && m.requestId === request.requestId);
    if (!userMessage) { userMessage = { role: 'user', text: message, requestId: request.requestId, status: 'pending', saved: false }; state.chat.push(userMessage); }
    userMessage.status = 'pending'; renderChat(); queueSave();
    try {
      const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: stringify(request) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok && !data.saveError) throw { message: typeof data.error === 'string' ? data.error : data.error?.message || data.message || data.reply || `交流失败（${response.status}）；原话和输入保留。` };
      if (typeof data.reply !== 'string' || !data.reply.trim()) throw { message: '没有收到真实可用回复；输入已保留，请检查连接后重试。' };
      let reply = state.chat.find(m => m.role === 'guide' && m.requestId === request.requestId);
      if (!reply) { reply = { role: 'guide', requestId: request.requestId }; state.chat.push(reply); }
      Object.assign(reply, { text: data.reply, saved: data.saved === true, status: data.saveError ? 'save_failed' : 'received' });
      userMessage.status = 'sent'; renderChat();
      if (data.saveError) { chatError.textContent = `真实回复已显示，学习记录保存失败：${data.saveError}。输入与提交标识保留，相同内容再发送可重试。`; chatError.hidden = false; queueSave(); return false; }
      pendingChatRequest = null;
      if (useComposer) { $('intent').value = ''; state.composerDrafts.chat = ''; }
      if (active()) active().draft += (active().draft ? '\n' : '') + message;
      if (mode === 'wrap' && active()) { active().status = 'paused'; state.cue = false; state.reminder = 'off'; renderHome(); renderPanel(); syncLife(); }
      if (data.state) $('contextCaption').textContent = '当前接续：' + (data.state.nextStep || '未指定');
      queueSave();
      notice(data.saved ? '真实回复已收到，并已写入学习记录。' : '真实回复已收到；此次没有写入学习记录。');
      return true;
    } catch (error) { userMessage.status = 'failed'; chatError.textContent = error.message || '连接未确认完成，原话与输入保留。'; chatError.hidden = false; renderChat(); queueSave(); return false; }
    finally { chatBusy = false; decorateModes(); }
  }
  document.addEventListener('input', queueSave);
  document.addEventListener('change', queueSave);
  document.addEventListener('click', event => {
    const navigation = event.target.closest('.module-nav a');
    if (navigation && navigation.origin === location.origin && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
      event.preventDefault(); const href = navigation.href;
      remember(); flush().catch(() => false).finally(() => { location.href = href; }); return;
    }
    queueMicrotask(queueSave);
  });
  window.addEventListener('pagehide', () => {
    const value = remember();
    if (!ui.ready || ui.blocked || stringify(value) === stringify(ui.lastSaved) || bytes(value) > 60000) return;
    const pending = ui.pending && ui.pending.signature === stringify(value) ? ui.pending.input : { identity: ui.identity, expectedRevision: ui.revision, submissionId: requestId(), state: value };
    fetch('/api/learning/ui-state', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json', 'X-Learning-Token': ui.token }, body: stringify(pending) }).catch(() => {});
  });
  window.learningIsland = { flushUiDraft: flush, snapshot: () => clone(snapshot()), version: () => ({ identity: clone(ui.identity), revision: ui.revision, blocked: ui.blocked }) };
  $('shell').inert = true; decorateModes();
  reconnect().finally(() => { $('shell').inert = false; });
  call('/api/bootstrap').then(data => { connection.textContent = data.configured ? '学习聊天接口可用；发送后以实际结果为准。' : '聊天接口暂不可用：' + (data.reason || '请检查原学习终端配置。'); connection.classList.toggle('unavailable', !data.configured); }).catch(error => { connection.textContent = '聊天配置未读取：' + error.message; });
})();
