const byId = (id) => document.getElementById(id);
const ui = {
  card: byId('launchCard'), startInput: byId('startInput'), startButton: byId('startButton'),
  chatInput: byId('chatInput'), sendButton: byId('sendButton'), skipSave: byId('skipSave'),
  messageList: byId('messageList'), conversation: byId('conversation'), mode: byId('composerMode'),
  next: byId('nextStep'), focus: byId('focusSidebar'), last: byId('lastSidebar'),
  apiBadge: byId('apiBadge'), connection: byId('connectionCard'), toast: byId('toast'),
  helpButton: byId('helpButton'), helpDialog: byId('helpDialog'), closeHelp: byId('closeHelp')
};

const modeNames = { chat: '自由交流', plan: '安排这次学习', question: '理解一个问题', progress: '聊聊实际进展', wrap: '自然收尾' };
const modeHints = {
  chat: '说说你现在的想法、困惑或进展…',
  plan: '今天还剩多少时间？想保留、缩小或换成什么？',
  question: '哪个地方没听懂？可以直接贴一小段课程或笔记。',
  progress: '实际做了什么？哪些地方有收获或仍有疑问？',
  wrap: '今天到这里了。可以补一句做到哪、下次从哪继续。'
};
const sessionKey = 'xiaomo-learning-terminal-v1-chat';
let selectedTime = '';
let selectedMode = 'chat';
let busy = false;
let pendingRequest = null;
let failedSaveNodes = null;
let history = [];
let toastTimer;

function showToast(message) {
  ui.toast.textContent = message;
  ui.toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.remove('visible'), 3800);
}

function setMode(mode) {
  selectedMode = modeNames[mode] ? mode : 'chat';
  ui.mode.innerHTML = '<span class="mode-dot"></span>';
  ui.mode.append(document.createTextNode(' ' + modeNames[selectedMode]));
  ui.chatInput.placeholder = modeHints[selectedMode];
  document.querySelectorAll('[data-mode]').forEach((button) => {
    const selected = button.dataset.mode === selectedMode;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
}

function renderState(state = {}) {
  ui.focus.textContent = state.focus || '还没有确定，先从一块内容开始。';
  ui.last.textContent = state.lastActivity || '尚无真实学习记录';
  ui.next.textContent = state.nextStep || '选一块想学的内容，或告诉我今天不知道先学什么。';
}

function setConnection(configured, model, provider, reason) {
  ui.apiBadge.classList.toggle('waiting', !configured);
  ui.apiBadge.innerHTML = '<span class="status-dot"></span>';
  const label = provider === 'codex-cli' ? 'Codex 本地登录可用' : '兼容接口已配置';
  ui.apiBadge.append(document.createTextNode(configured ? ` ${label} · ${model || '模型待确认'}` : ' 聊天入口待配置'));
  ui.connection.hidden = Boolean(configured);
  if (!configured && reason) ui.connection.querySelector('p').textContent = reason;
}

function addMessage(role, content, saved = false, pending = false) {
  const item = document.createElement('div');
  item.className = `message ${role}${pending ? ' pending' : ''}`;
  const avatar = document.createElement('span');
  avatar.className = 'avatar';
  avatar.setAttribute('aria-hidden', 'true');
  avatar.textContent = role === 'user' ? '陌' : '✦';
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = content;
  if (saved) {
    const label = document.createElement('span');
    label.className = 'saved-label';
    label.textContent = '✓ 已写入学习记录';
    bubble.append(label);
  }
  item.append(avatar, bubble);
  ui.messageList.append(item);
  ui.conversation.classList.add('has-messages');
  ui.messageList.scrollTop = ui.messageList.scrollHeight;
  return item;
}

function storeHistory() {
  try { sessionStorage.setItem(sessionKey, JSON.stringify(history.slice(-20))); } catch { /* private browsing can disable storage */ }
}

function restoreHistory() {
  try {
    const value = JSON.parse(sessionStorage.getItem(sessionKey) || '[]');
    if (!Array.isArray(value)) return;
    history = value.filter((entry) => ['user', 'assistant'].includes(entry?.role) && typeof entry.content === 'string').slice(-20);
    for (const entry of history) addMessage(entry.role, entry.content, Boolean(entry.saved));
    if (history.length) document.body.classList.add('session-started');
  } catch { history = []; }
}

async function bootstrap() {
  try {
    const response = await fetch('/api/bootstrap', { cache: 'no-store' });
    if (!response.ok) throw new Error(`状态读取失败（${response.status}）`);
    const data = await response.json();
    renderState(data.state);
    setConnection(data.configured, data.model, data.provider, data.reason);
  } catch (error) {
    ui.next.textContent = '暂时无法读取学习状态，请检查本机服务。';
    setConnection(false, '');
    showToast(error.message || '连接本机服务失败');
  }
}

function requestId() {
  return globalThis.crypto?.randomUUID?.() || `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function sendMessage(source) {
  if (busy) return;
  const isStart = source === 'start';
  const input = isStart ? ui.startInput : ui.chatInput;
  const raw = input.value.trim();
  const mode = isStart ? 'plan' : selectedMode;
  if (!raw && mode !== 'wrap' && !(isStart && selectedTime)) {
    showToast('先写一句现在想做什么，或直接说“不知道先学什么”。');
    input.focus();
    return;
  }
  const message = isStart && selectedTime ? `今天大约有 ${selectedTime}。${raw || '我暂时不知道先学什么，请帮我选一个起点。'}` : raw || '今天先到这里。';
  const skipSave = !isStart && ui.skipSave.checked;
  const old = pendingRequest;
  const sameRetry = old && old.message === message && old.mode === mode && old.skipSave === skipSave;
  if (sameRetry && failedSaveNodes) {
    failedSaveNodes.forEach((node) => node.remove());
    failedSaveNodes = null;
  }
  const request = sameRetry ? old : { message, mode, skipSave, requestId: requestId(), history: history.slice(-12).map(({ role, content }) => ({ role, content })) };
  pendingRequest = request;
  busy = true;
  ui.startButton.disabled = true;
  ui.sendButton.disabled = true;
  const userMessage = addMessage('user', message);
  const waiting = addMessage('assistant', '正在结合你的学习状态整理…', false, true);
  try {
    const response = await fetch('/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok && !data.saveError) throw new Error(data.error || data.message || data.reply || `交流失败（${response.status}）`);
    waiting.remove();
    const assistantMessage = addMessage('assistant', data.reply || '这次没有收到可用回复。', Boolean(data.saved));
    if (data.saveError) {
      failedSaveNodes = [userMessage, assistantMessage];
      showToast(`记录保存失败；再次发送可重试。${data.saveError}`);
      return;
    }
    if (data.saved) showToast('已记下这次的接续点');
    history.push({ role: 'user', content: message }, { role: 'assistant', content: data.reply || '', saved: Boolean(data.saved) });
    history = history.slice(-20);
    storeHistory();
    pendingRequest = null;
    input.value = '';
    if (!isStart) setMode('chat');
    if (isStart) {
      document.body.classList.add('session-started');
      ui.conversation.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (data.state) renderState(data.state);
  } catch (error) {
    waiting.remove();
    userMessage.remove();
    if (!ui.messageList.children.length) ui.conversation.classList.remove('has-messages');
    showToast(error.message || '暂时无法连接聊天接口');
    input.focus();
  } finally {
    busy = false;
    ui.startButton.disabled = false;
    ui.sendButton.disabled = false;
  }
}

document.querySelectorAll('[data-time]').forEach((button) => button.addEventListener('click', () => {
  selectedTime = button.dataset.time === selectedTime ? '' : button.dataset.time;
  document.querySelectorAll('[data-time]').forEach((entry) => entry.setAttribute('aria-pressed', String(entry.dataset.time === selectedTime)));
}));
document.querySelectorAll('[data-mode]').forEach((button) => button.addEventListener('click', () => {
  setMode(button.dataset.mode);
  ui.chatInput.focus();
  ui.conversation.scrollIntoView({ behavior: 'smooth', block: 'start' });
}));
ui.startButton.addEventListener('click', () => sendMessage('start'));
ui.sendButton.addEventListener('click', () => sendMessage('chat'));
ui.startInput.addEventListener('keydown', (event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage('start'); } });
ui.chatInput.addEventListener('keydown', (event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage('chat'); } });
ui.helpButton.addEventListener('click', () => ui.helpDialog.showModal());
ui.closeHelp.addEventListener('click', () => ui.helpDialog.close());
ui.helpDialog.addEventListener('click', (event) => { if (event.target === ui.helpDialog) ui.helpDialog.close(); });
byId('todayLabel').textContent = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'long', day: 'numeric', weekday: 'long' }).format(new Date());
restoreHistory();
setMode('chat');
bootstrap();
