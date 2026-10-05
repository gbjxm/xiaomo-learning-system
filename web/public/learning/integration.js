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
  const fieldIds = ['intent', 'lessonLength', 'materialName', 'destination', 'chatMode', 'skipChatSave', 'learningCourse', 'learningChapter', 'learningTaskId', 'artifactKind', 'artifactText', 'artifactTitle', 'artifactVersion'];
  let pendingChatRequest = null, chatBusy = false, currentDate = chinaDate(), pendingChatOutcome = '';
  let recordingContext = null, contextSequence = 0;
  const recordModel = { loaded: false, courses: [], currentTasks: [], currentTask: null, notes: [], resumePoints: [], recordVersion: null, legacyState: null };
  window.learningRecordModel = recordModel;
  const clone = value => structuredClone(value);
  const stringify = value => JSON.stringify(value);
  const requestId = () => crypto.randomUUID();
  const bytes = value => new TextEncoder().encode(typeof value === 'string' ? value : stringify(value)).byteLength;
  const isObject = value => value && typeof value === 'object' && !Array.isArray(value);
  const isRecordConflict = status => ['conflict', 'record_conflict', 'needs_review'].includes(status);
  const savedLabelFor = message => { const label = message.savedLabel || (message.contentReceipt?.kind === 'watch' ? '观看记录' : message.contentReceipt ? '创作与想法' : message.noteReceipt ? '学习笔记' : '学习记录'); return /已保存|已记下|已写入/.test(label) ? label : label + '已保存'; };

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
  const skipLabel = el('label', undefined, 'skip-chat-save'), skip = el('input'); skip.type = 'checkbox'; skip.id = 'skipChatSave'; skipLabel.append(skip, document.createTextNode('这次只聊，不保存记录'));
  const chatHint = el('p', '看课、看片或想到什么，都可以直接说。课程与课次可留空；保存后可以在“我的内容”找回。', 'note');
  chatOptions.append(modeLabel, modeSelect, skipLabel, chatHint); $('planForm').append(chatOptions);
  const courseLabel = el('label', '这次围绕的课程（可选）'); courseLabel.htmlFor = 'learningCourse';
  const courseSelect = el('select'); courseSelect.id = 'learningCourse'; courseSelect.append(new Option('直接聊当前问题', ''));
  const chapterLabel = el('label', '课次（可选，未知可留空）'); chapterLabel.htmlFor = 'learningChapter';
  const chapterInput = el('input'); chapterInput.id = 'learningChapter'; chapterInput.type = 'number'; chapterInput.min = '1'; chapterInput.max = '200'; chapterInput.step = '1'; chapterInput.placeholder = '例如：2，指第二课';
  const taskInput = el('input'); taskInput.id = 'learningTaskId'; taskInput.type = 'hidden';
  const artifactDetails = el('details', undefined, 'learning-artifact'); artifactDetails.id = 'learningArtifactDetails';
  artifactDetails.append(el('summary', '带一个文字片段或语音转写（可选）'));
  const artifactKind = el('select'); artifactKind.id = 'artifactKind'; artifactKind.setAttribute('aria-label', '片段类型');
  artifactKind.append(new Option('文字片段', 'text'), new Option('语音转写', 'transcript'));
  const artifactTitle = el('input'); artifactTitle.id = 'artifactTitle'; artifactTitle.type = 'text'; artifactTitle.maxLength = 180; artifactTitle.placeholder = '片段名称（可留空）'; artifactTitle.setAttribute('aria-label', '片段名称');
  const artifactVersion = el('input'); artifactVersion.id = 'artifactVersion'; artifactVersion.type = 'text'; artifactVersion.maxLength = 80; artifactVersion.placeholder = '版本（可留空，例如修改后）'; artifactVersion.setAttribute('aria-label', '片段版本');
  const artifactText = el('textarea'); artifactText.id = 'artifactText'; artifactText.maxLength = 16000; artifactText.rows = 5; artifactText.placeholder = '粘贴想讨论的原文或转写即可，不必重新整理成表格。'; artifactText.setAttribute('aria-label', '文字片段或语音转写');
  artifactDetails.append(artifactKind, artifactTitle, artifactVersion, artifactText, el('p', '这里只接收文字。需要看听媒体时，可以把具体问题交给 Codex 继续。', 'note'));
  chatOptions.append(courseLabel, courseSelect, chapterLabel, chapterInput, taskInput, artifactDetails);
  courseSelect.addEventListener('change', () => { contextSequence++; chapterInput.value = ''; taskInput.value = ''; recordingContext = { kind: 'none', verified: true }; renderRecordContext(); queueSave(); });
  chapterInput.addEventListener('input', () => { const task = selectedTask(); if (task?.chapter && task.chapter !== Number(chapterInput.value)) { contextSequence++; taskInput.value = ''; recordingContext = { kind: 'none', verified: true }; renderRecordContext(); } });
  $('intent').maxLength = 16000;
  const chatError = el('p', undefined, 'chat-error'); chatError.id = 'chatError'; chatError.hidden = true; chatError.setAttribute('role', 'alert'); $('chatLog').before(chatError);
  const connection = el('p', '正在检查学习聊天接口…', 'chat-connection'); connection.id = 'chatConnection'; $('learningPanel').querySelector('.context').after(connection);
  const recordContext = el('section', undefined, 'learning-record-context'); recordContext.id = 'learningRecordContext'; recordContext.setAttribute('aria-label', '学习目的与接续点'); connection.after(recordContext);
  const recordRetry = button('读取最新学习记录', async () => { const loaded = await refreshRecords(); if (loaded && pendingChatOutcome === 'conflict') { pendingChatRequest = null; pendingChatOutcome = ''; chatError.textContent = '最新学习记录已读到；原输入保留，可以查看后重新发送。'; } queueSave(); }); recordRetry.id = 'reloadLearningRecords'; recordRetry.hidden = true; chatError.after(recordRetry);

  function selectedCourse() { return recordModel.courses.find(course => course.courseId === courseSelect.value) || null; }
  function selectedTask() { if (recordingContext && recordingContext.kind !== 'task') return null; const id = taskInput.value || (recordingContext ? recordingContext.id : active()?.taskId), task = recordModel.currentTasks.find(task => task.taskId === id) || (recordModel.currentTask?.taskId === id ? recordModel.currentTask : null); return task && (!courseSelect.value || !task.courseId || task.courseId === courseSelect.value) ? task : null; }
  function taskText(value) { if (typeof value === 'string') return value; if (Array.isArray(value)) return value.filter(item => typeof item === 'string').join('；'); return ''; }
  function preserveCourseSelection(courseId) {
    const id = typeof courseId === 'string' ? courseId : '';
    // HTMLSelectElement clears a value with no matching option. During an API
    // outage keep the stored identity visible instead of persisting an empty id.
    if (id && !Array.from(courseSelect.options).some(option => option.value === id)) {
      const option = new Option(id + (recordModel.loaded ? ' · 已存选择，课程记录待核对' : ' · 已存选择，课程记录待读取'), id);
      option.dataset.coursePending = 'true'; courseSelect.append(option);
    }
    courseSelect.value = id;
  }
  function courseOptions() {
    const chosen = courseSelect.value;
    courseSelect.replaceChildren(new Option('直接聊当前问题', ''));
    for (const course of recordModel.courses) courseSelect.append(new Option(course.name, course.courseId));
    preserveCourseSelection(chosen);
  }
  function renderRecordContext() {
    recordContext.replaceChildren();
    if (recordingContext && (recordingContext.kind !== 'task' || !recordingContext.verified)) {
      const ctx = recordingContext;
      recordContext.append(el('p', ctx.kind === 'none' ? '这次直接聊新内容' : '当前关联：' + (ctx.title || ctx.id)));
      if (ctx.kind !== 'none') {
        recordContext.append(el('p', ctx.verified ? '接着这同一份记录交流，原话与 AI 回应分别留下。' : '对应记录尚未核对，原输入已保留；核对后再发送。', 'note'));
        if (!ctx.verified) recordContext.append(button('重新核对这份记录', () => openRecordingContext(ctx, { restore: true }), 'small-link'));
        recordContext.append(button('退出这份关联', clearRecordingContext, 'small-link'));
      }
      const course = selectedCourse(); if (course) recordContext.append(el('p', course.name + (chapterInput.value ? ' · 第 ' + chapterInput.value + ' 课' : ''), 'note'));
      recordContext.hidden = false;
      const name = $('learningPanel').querySelector('.course-name'); if (name) name.textContent = course?.name || '当前交流';
      $('contextCaption').textContent = '经历日期未知时保留未知；登记内容不代表能力进展';
      return;
    }
    const chosen = selectedTask(), latest = recordingContext ? null : recordModel.currentTask, task = chosen || latest;
    const course = selectedCourse() || (!courseSelect.value ? courseOfActivity(active()) : null);
    if (course) recordContext.append(el('p', course.name + ' · ' + courseProgress(course)), el('p', courseResume(course), 'note'));
    else if (courseSelect.value) recordContext.append(el('p', '已保留课程选择 ' + courseSelect.value + '；课程记录尚待重读或核对，原问题与片段保持不变。', 'note'));
    if (task) {
      recordContext.append(el('p', (chosen ? '本次目的：' : '最近记录的目的：') + (task.purpose || task.title || '继续这项学习')));
      if (task.stopPoint) recordContext.append(el('p', '具体停止处：' + taskText(task.stopPoint)));
      if (task.nextStep) recordContext.append(el('p', '下一步：' + taskText(task.nextStep)));
      if (Array.isArray(task.observationPoints) && task.observationPoints.length) recordContext.append(el('p', '这次关注：' + taskText(task.observationPoints), 'note'));
      if (!chosen) recordContext.append(button('回到这项学习交流', () => openTask(task), 'small-link'));
      else recordContext.append(button('退出这项关联', clearRecordingContext, 'small-link'));
    } else if (recordModel.loaded) {
      const stop = recordModel.legacyState?.nextStep;
      recordContext.append(el('p', stop ? '已保存的接续点：' + stop : '还没有已保存的学习任务；可以直接聊当前问题。', 'note'));
    }
    recordContext.hidden = !recordContext.childNodes.length;
    const name = $('learningPanel').querySelector('.course-name');
    if (name) name.textContent = course?.name || '当前选择的内容';
    $('contextCaption').textContent = course ? '本人报告的进度 · 课程版本待核对，资料候选不代表观看进度' : '课程与具体章节可按当前问题选择';
  }
  function openCourse(courseId) {
    const course = recordModel.courses.find(item => item.courseId === courseId); if (!course) return;
    if (!canChangeContext({ kind: 'none' })) return false;
    contextSequence++;
    courseSelect.value = courseId; chapterInput.value = ''; taskInput.value = ''; recordingContext = { kind: 'none', verified: true };
    visit(course.island); setMode('chat'); setPanel(true); openPlace('desk'); renderRecordContext(); queueSave();
  }
  function openTask(task) {
    if (!canChangeContext({ kind: 'task', id: task.taskId })) return false;
    contextSequence++;
    recordingContext = { kind: 'task', id: task.taskId, title: task.title, verified: true };
    taskInput.value = task.taskId; preserveCourseSelection(task.courseId || ''); chapterInput.value = task.chapter || '';
    const course = selectedCourse(); if (course) visit(course.island);
    setMode('chat'); setPanel(true); renderRecordContext(); $('intent').focus(); queueSave();
  }
  function canChangeContext(next) {
    if (chatBusy || pendingChatRequest && (pendingChatOutcome === 'unknown' || pendingChatOutcome === 'save_failed' || !pendingChatOutcome) &&
      (next.kind !== recordingContext?.kind || next.id !== recordingContext?.id)) {
      notice('上一段交流的保存结果还待核对，原输入与关联已保留。请先重试核对原请求。'); return false;
    }
    return true;
  }
  function clearRecordingContext() {
    if (!canChangeContext({ kind: 'none' })) return false;
    contextSequence++; recordingContext = { kind: 'none', verified: true }; taskInput.value = ''; courseSelect.value = ''; chapterInput.value = '';
    const url = new URL(location.href); for (const key of ['taskId', 'noteId', 'contentId']) url.searchParams.delete(key);
    history.replaceState(history.state, '', url.pathname + url.search + url.hash);
    window.dispatchEvent(new CustomEvent('learning:context-cleared'));
    renderRecordContext(); queueSave(); return true;
  }
  async function openRecordingContext(target, { restore = false } = {}) {
    if (!ui.ready || ui.blocked) return false;
    const kind = target?.kind, id = target?.id;
    if (!['note', 'content', 'task'].includes(kind) || typeof id !== 'string' || !id || id.length > 160) { notice('这份关联的编号无效，原输入已保留。'); return false; }
    if (!restore && !canChangeContext({ kind, id })) return false;
    const sequence = ++contextSequence;
    // Reserve the exact target before IO: a missing target may not silently
    // inherit active() or the most recent backend task.
    recordingContext = { kind, id, title: target.title || id, verified: false }; taskInput.value = '';
    const draft = $('intent').value, draftMode = state.mode;
    setMode('chat'); if (draftMode === 'chat') { $('intent').value = draft; state.composerDrafts.chat = draft; }
    setPanel(true); renderRecordContext();
    try {
      const route = kind === 'task' ? '/api/learning/tasks/' : kind === 'note' ? '/api/learning/notes/' : '/api/learning/content/items/';
      const data = await call(route + encodeURIComponent(id));
      if (sequence !== contextSequence) return false;
      const item = kind === 'task' ? data.task : kind === 'note' ? data.note : data.item;
      const actualId = kind === 'task' ? item?.taskId : kind === 'note' ? item?.noteId : item?.id;
      if (!item || actualId !== id || kind === 'content' && (item.readOnly || !['creation', 'watch'].includes(item.kind))) throw { message: '未读到对应的可续写记录。' };
      if (kind === 'task') {
        const index = recordModel.currentTasks.findIndex(item => item.taskId === id);
        if (index < 0) recordModel.currentTasks.push(item); else recordModel.currentTasks[index] = item;
        openTask(item);
      } else {
        recordingContext = { kind, id, title: item.title || id, verified: true };
        preserveCourseSelection(kind === 'note' ? item.courseId || '' : ''); chapterInput.value = kind === 'note' ? item.chapter || '' : '';
        renderRecordContext(); queueSave();
      }
      $('intent').focus(); return true;
    } catch (error) {
      if (sequence === contextSequence) { notice('这份记录暂未找到或未能读取：' + error.message + ' 原输入与片段已保留，没有换成最近任务。'); renderRecordContext(); queueSave(); }
      return false;
    }
  }
  const openTaskById = id => openRecordingContext({ kind: 'task', id });
  function resumeCurrentTask() {
    if (!ui.ready || ui.blocked || !recordModel.loaded) return false;
    if (recordingContext && recordingContext.kind !== 'task') { setMode('chat'); setPanel(true); renderRecordContext(); $('intent').focus(); return true; }
    const activity = active();
    const activityCourseId = activity?.courseId || courseOfActivity(activity)?.courseId;
    if (!taskInput.value && courseSelect.value && activity && courseSelect.value !== activityCourseId) {
      // An explicit course change intentionally cleared taskInput. Do not bind
      // that new draft back to the previous activity's task on terminal resume.
      const course = selectedCourse(); if (course) visit(course.island);
      setMode('chat'); setPanel(true); renderRecordContext(); $('intent').focus();
      notice('已回到你选择的课程；原问题与片段保留，没有接回另一门课的任务。');
      queueSave(); return true;
    }
    const restoredId = taskInput.value || activity?.taskId;
    const task = restoredId ? recordModel.currentTasks.find(item => item.taskId === restoredId) || (recordModel.currentTask?.taskId === restoredId ? recordModel.currentTask : null) : null;
    if (restoredId) {
      // A restored draft owns its existing task/context; a newer backend task must
      // never silently replace it just because the terminal resume link was used.
      if (task) {
        if (!taskInput.value) taskInput.value = restoredId;
        const course = recordModel.courses.find(item => item.courseId === (courseSelect.value || task.courseId));
        const island = activity?.taskId === restoredId ? activity.island : course?.island || state.current;
        visit(island);
      }
      setMode('chat'); setPanel(true); renderRecordContext();
      if (activity?.taskId === restoredId && state.current === activity.island) openPlace('desk');
      if (!task) notice('原学习任务标识与输入已保留；这次未读到对应任务，请先核对学习记录。');
    } else if (activity) {
      visit(activity.island); setMode('chat'); setPanel(true); openPlace('desk'); renderRecordContext();
    } else {
      const hasChatDraft = !!pendingChatRequest || !!artifactText.value.trim() || !!state.composerDrafts?.chat?.trim() || (state.mode === 'chat' && !!$('intent').value.trim());
      const hasContext = !!courseSelect.value || !!chapterInput.value;
      if (!hasChatDraft && !hasContext && recordModel.currentTask) openTask(recordModel.currentTask);
      else {
        setMode('chat'); setPanel(true); renderRecordContext();
        notice(hasChatDraft || hasContext ? '已回到学习交流，原输入和材料选择保持不变。' : '还没有可接续的学习任务，可以直接聊当前问题。');
      }
    }
    $('intent').focus(); queueSave(); return true;
  }
  function publishRecovery() {
    window.dispatchEvent(new CustomEvent('learning:restored', { detail: { ready: ui.ready, recordsLoaded: recordModel.loaded, blocked: ui.blocked } }));
  }
  function chatContext(activityOverride) {
    if (recordingContext && !activityOverride) {
      const ctx = recordingContext, courseId = ctx.kind === 'content' ? '' : courseSelect.value;
      const chapter = Number(chapterInput.value);
      const context = { ...(ctx.kind === 'note' ? { noteId: ctx.id } : ctx.kind === 'content' ? { contentId: ctx.id } : ctx.kind === 'task' ? { taskId: ctx.id } : {}), ...(courseId ? { courseId } : {}), ...(courseId && Number.isSafeInteger(chapter) && chapter >= 1 && chapter <= 200 ? { chapter } : {}) };
      if (artifactText.value.trim()) context.artifact = { kind: artifactKind.value === 'transcript' ? 'transcript' : 'text', text: artifactText.value, ...(artifactTitle.value.trim() ? { title: artifactTitle.value.trim() } : {}), ...(artifactVersion.value.trim() ? { version: artifactVersion.value.trim() } : {}) };
      return context;
    }
    const activity = activityOverride || active();
    const activityCourseId = activity?.courseId || courseOfActivity(activity)?.courseId;
    const courseId = activityOverride ? activityCourseId : courseSelect.value || activityCourseId;
    const selected = selectedTask();
    const taskId = activityOverride?.taskId || (selected && (!courseId || selected.courseId === courseId) ? selected.taskId : (!courseId || activityCourseId === courseId ? activity?.taskId : null));
    const controlsMatch = !activityOverride || !courseSelect.value || courseSelect.value === courseId;
    const chapterValue = activityOverride?.chapter || (controlsMatch ? chapterInput.value.trim() : '') || (activityCourseId === courseId ? activity?.chapter || '' : '');
    const chapter = Number.isSafeInteger(Number(chapterValue)) && Number(chapterValue) >= 1 && Number(chapterValue) <= 200 ? Number(chapterValue) : null;
    const uiRef = { ...(ui.identity?.storeId ? { storeId: ui.identity.storeId, revision: ui.revision } : {}) };
    const activityMatchesTask = !taskId || !activity?.taskId || activity.taskId === taskId;
    if (activity && activityMatchesTask && (!courseId || activityCourseId === courseId)) uiRef.activityId = activity.id;
    if (activity?.lastTrace && activityMatchesTask && (!courseId || activityCourseId === courseId)) uiRef.recordId = activity.lastTrace;
    const context = { ...(taskId ? { taskId } : {}), ...(courseId ? { courseId } : {}), ...(chapter ? { chapter } : {}), ...(Object.keys(uiRef).length ? { uiRef } : {}) };
    if (controlsMatch && artifactText.value.trim()) context.artifact = { kind: artifactKind.value === 'transcript' ? 'transcript' : 'text', text: artifactText.value, ...(artifactTitle.value.trim() ? { title: artifactTitle.value.trim() } : {}), ...(artifactVersion.value.trim() ? { version: artifactVersion.value.trim() } : {}) };
    return context;
  }
  function sameChatContext(left, right) { const a = clone(left || {}), b = clone(right || {}); if (!a.uiRef || !b.uiRef) { delete a.uiRef; delete b.uiRef; } else { delete a.uiRef.revision; delete b.uiRef.revision; } return stringify(a) === stringify(b); }
  function acceptRecordResponse(data, request) {
    if (data.saved !== true && data.saveReceipt?.status !== 'committed') return;
    if (data.recordVersion !== undefined) recordModel.recordVersion = data.recordVersion;
    if (data.state) recordModel.legacyState = data.state;
    if (data.noteReceipt?.noteId) { recordingContext = { kind: 'note', id: data.noteReceipt.noteId, title: recordingContext?.kind === 'note' ? recordingContext.title : '刚留下的学习笔记', verified: true }; taskInput.value = ''; }
    if (data.contentReceipt?.itemId) { recordingContext = { kind: 'content', id: data.contentReceipt.itemId, title: recordingContext?.kind === 'content' ? recordingContext.title : data.contentReceipt.kind === 'watch' ? '刚留下的观看记录' : '刚留下的创作与想法', verified: true }; taskInput.value = ''; courseSelect.value = ''; chapterInput.value = ''; }
    if (data.task?.taskId) {
      if (!data.noteReceipt && !data.contentReceipt) recordingContext = { kind: 'task', id: data.task.taskId, title: data.task.title || data.task.taskId, verified: true };
      const index = recordModel.currentTasks.findIndex(task => task.taskId === data.task.taskId);
      if (index < 0) recordModel.currentTasks.push(data.task); else recordModel.currentTasks[index] = data.task;
      recordModel.currentTask = data.task;
      if (!request.context?.courseId || request.context.courseId === data.task.courseId) taskInput.value = data.task.taskId;
      const activity = Object.values(state.activities).find(item => item.id === request.context?.uiRef?.activityId);
      if (activity && (!activity.courseId || activity.courseId === data.task.courseId)) {
        activity.taskId = data.task.taskId; if (data.task.courseId) activity.courseId = data.task.courseId;
        if (request.context?.chapter) activity.chapter = request.context.chapter;
      }
    }
    if (data.resumePoint) recordModel.resumePoints = [data.resumePoint, ...recordModel.resumePoints.filter(point => point.taskId !== data.resumePoint.taskId)];
    renderRecordContext();
  }
  async function refreshRecords() {
    try {
      const data = await call('/api/bootstrap');
      recordModel.courses = Array.isArray(data.courses) ? data.courses : [];
      recordModel.currentTasks = Array.isArray(data.currentTasks) ? data.currentTasks : [];
      recordModel.notes = Array.isArray(data.notes) ? data.notes : [];
      recordModel.currentTask = data.currentTask || null;
      recordModel.resumePoints = Array.isArray(data.resumePoints) ? data.resumePoints : [];
      recordModel.recordVersion = data.recordVersion ?? null; recordModel.legacyState = data.state || null; recordModel.loaded = true;
      courseOptions(); renderRecordContext();
      connection.textContent = data.configured ? '学习聊天接口可用；发送后以实际结果为准。' : '聊天接口暂不可用：' + (data.reason || '请检查原学习终端配置。');
      connection.classList.toggle('unavailable', !data.configured); recordRetry.hidden = true;
      publishRecovery(); return true;
    } catch (error) { connection.textContent = '学习记录暂未读到：' + error.message + ' 当前输入仍保留。'; recordRetry.hidden = false; return false; }
  }

  function chinaDate() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
  function snapshot() {
    state.composerDrafts ??= { plan: '', chat: '' };
    state.composerDrafts[state.mode] = $('intent').value;
    const islandState = Object.fromEntries(stateKeys.map(key => [key, clone(state[key] ?? null)]));
    const lifeState = Object.fromEntries(lifeKeys.map(key => [key, clone(life[key] ?? null)]));
    const fields = Object.fromEntries(fieldIds.map(id => [id, $(id)?.type === 'checkbox' ? $(id).checked : $(id)?.value ?? '']));
    fields.pendingChatRequest = pendingChatRequest ? clone(pendingChatRequest) : null;
    fields.pendingChatOutcome = pendingChatOutcome;
    fields.recordingContext = recordingContext ? clone(recordingContext) : null;
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
      for (const id of fieldIds) if (Object.hasOwn(fields, id) && $(id)) { if ($(id).type === 'checkbox') $(id).checked = fields[id] === true; else if (id === 'learningCourse') preserveCourseSelection(fields[id]); else $(id).value = typeof fields[id] === 'string' ? fields[id] : ''; }
      pendingChatRequest = isObject(fields.pendingChatRequest) ? clone(fields.pendingChatRequest) : null;
      pendingChatOutcome = typeof fields.pendingChatOutcome === 'string' ? fields.pendingChatOutcome : '';
      recordingContext = isObject(fields.recordingContext) && ['note', 'content', 'task', 'none'].includes(fields.recordingContext.kind) ? { ...clone(fields.recordingContext), verified: fields.recordingContext.kind === 'none' } : null;
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
    publishRecovery();
  }
  function decorateModes() {
    chatOptions.hidden = state.mode !== 'chat';
    $('sendButton').textContent = chatBusy ? '正在发送…' : state.mode === 'plan' ? '按填写值查看安排' : '发送这段交流';
    $('sendButton').disabled = chatBusy;
    const unresolved = !!pendingChatRequest && ['unknown', 'save_failed'].includes(pendingChatOutcome);
    for (const control of [courseSelect, chapterInput, artifactKind, artifactText, artifactTitle, artifactVersion, modeSelect, skip]) control.disabled = chatBusy || unresolved;
  }
  const previousSetMode = setMode;
  setMode = function(mode) { const result = previousSetMode(mode); decorateModes(); queueSave(); return result; };
  const previousRenderPanel = renderPanel;
  renderPanel = function() { const result = previousRenderPanel(); decorateModes(); renderRecordContext(); return result; };
  const previousRenderChat = renderChat;
  renderChat = function() {
    previousRenderChat();
    for (const [index, message] of state.chat.entries()) {
      if (message.role !== 'guide') continue;
      const node = $('chatLog').children[index]; if (!node) continue;
      const savedLabel = savedLabelFor(message);
      if (message.saved === true && node.querySelector('small')) node.querySelector('small').textContent = '学习向导 · ' + savedLabel;
      if (Array.isArray(message.sourceCoverage) && message.sourceCoverage.length) {
        const hasBackground = message.sourceCoverage.some(source => source.sourceKind === 'personal_context');
        const details = el('details', undefined, 'learning-source-coverage'); details.append(el('summary', hasBackground ? '这次参考的资料与背景' : '这次参考的原理'));
        for (const source of message.sourceCoverage) {
          const coverage = source.sourceKind === 'personal_context' ? '本次参考的个人背景' : ({ document: '已读本次提供的正文', section: '已读相关正文节选', excerpt: '已读相关正文节选', full: '已读本次正文', partial: '已读部分正文', provided: '已读本次提供的内容', unavailable: '相关正文尚未读取' })[source.coverage] || '阅读范围见本次来源说明';
          details.append(el('p', [source.title, source.heading].filter(value => typeof value === 'string' && value).join(' · ') || '本次相关资料'));
          details.append(el('p', coverage + (Number.isSafeInteger(source.lineStart) ? ' · 正文第 ' + source.lineStart + (Number.isSafeInteger(source.lineEnd) && source.lineEnd !== source.lineStart ? '—' + source.lineEnd : '') + ' 行' : ''), 'note'));
          if (source.sourceKind === 'personal_context') details.append(el('p', (source.sourceDate ? '资料日期：' + source.sourceDate : '资料日期未注明') + (source.dateBasis ? ' · ' + source.dateBasis : ''), 'note'));
          const limits = taskText(source.limitations); if (limits) details.append(el('p', limits, 'note'));
        }
        node.append(details);
      }
      for (const warning of Array.isArray(message.warnings) ? message.warnings : message.warnings ? [message.warnings] : []) { const text = typeof warning === 'string' ? warning : warning?.message || warning?.text; if (text) node.append(el('small', text, 'learning-response-warning')); }
      const receipt = message.saveReceipt;
      if (receipt) {
        const text = message.saved === true ? savedLabel + '。' : isRecordConflict(receipt.status) ? '正式记录已变化，本次尚未写入；原话与输入保留。' : ['failed', 'save_failed', 'partial'].includes(receipt.status) ? '本次回复已收到，记录保存仍待核对。' : '本次没有新增保存记录。';
        node.append(el('small', text, 'learning-save-receipt'));
      }
      const contentId = message.noteReceipt?.noteId ? 'learning-note:' + message.noteReceipt.noteId : message.contentReceipt?.itemId;
      if (message.saved === true && typeof contentId === 'string') {
        const link = el('a', '查看刚保存的内容 →', 'learning-save-receipt'); link.href = '/learning/content/?item=' + encodeURIComponent(contentId); link.setAttribute('data-learning-leave', ''); node.append(link);
      }
      let handoffText = typeof message.handoff === 'string' ? message.handoff : message.handoff?.text || message.handoff?.prompt || message.handoff?.content;
      if (!handoffText && message.handoff?.reference) {
        const question = state.chat.find(item => item.role === 'user' && item.requestId === message.requestId)?.text || '';
        handoffText = '请在小陌的学习系统中继续核验这项媒体问题。\n材料：' + (message.handoff.title || '待核验媒体') + '\n引用：' + message.handoff.reference + '\n当前问题：' + question + (message.handoff.taskId ? '\n接续任务：' + message.handoff.taskId : '') + '\n网页本次未实际查看或听审媒体；请先核对当前目标、观察点与允许帮助，再按问题读取相关材料。';
      }
      if (typeof handoffText === 'string' && handoffText) {
        const details = el('details', undefined, 'learning-handoff'), text = el('textarea'); text.value = handoffText; text.readOnly = true; text.rows = 5; text.setAttribute('aria-label', '交给 Codex 的接续文本');
        details.append(el('summary', '交给 Codex 继续'), el('p', '把具体对象和问题带到本项目 Codex；网页不会自动启动媒体分析。', 'note'), text, button('复制接续文本', async () => { try { await navigator.clipboard.writeText(handoffText); notice('接续文本已复制，可以粘贴到 Codex。'); } catch { text.focus(); text.select(); notice('自动复制未完成；文本已选中，可按 Ctrl+C。'); } }));
        node.append(details);
      }
    }
  };
  const previousFinish = finish;
  finish = function(keep) {
    const activity = here(), before = state.records.length; previousFinish(keep);
    if (keep && state.records.length > before && activity) { const record = state.records.at(-1); for (const key of ['taskId', 'courseId', 'chapter']) if (activity[key]) record[key] = activity[key]; queueSave(); }
  };
  const previousResumeTrace = resumeTrace;
  resumeTrace = function(record) { previousResumeTrace(record); const activity = state.activities[record.island]; if (activity) for (const key of ['taskId', 'courseId', 'chapter']) if (record[key]) activity[key] = record[key]; renderRecordContext(); queueSave(); };
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
      const done = await sendChat({ message, mode: 'wrap', skipSave: false, useComposer: false, activityOverride: activity });
      if (done) { finish(true); queueSave(); }
    }, 'primary'); action.id = 'aiWrapButton';
    body.querySelector('.close-entry')?.append(action, el('p', '该按钮会发送真实收尾请求；成功后按既有学习保存规则写入。手动书签仅保存界面状态。', 'note'));
  };
  const previousSend = send;
  send = async function() {
    if (state.mode === 'plan') { currentDate = chinaDate(); previousSend(); queueSave(); return; }
    await sendChat({ message: $('intent').value.trim() ? $('intent').value : ($('chatMode').value === 'wrap' ? '今天先到这里。' : ''), mode: $('chatMode').value, skipSave: $('skipChatSave').checked, useComposer: true });
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
  async function lookupChatReceipt(request) {
    let receipt;
    try { receipt = await call('/api/learning/requests/' + encodeURIComponent(request.requestId)); }
    catch (error) { if (error.status === 404) return null; throw { message: '上次交流结果暂未核对到；原输入和请求保留，请连接恢复后再试。' }; }
    if (isRecordConflict(receipt.status) || isRecordConflict(receipt.response?.saveReceipt?.status)) throw { code: 'RECORD_CONFLICT', message: '正式学习记录已经变化，本次尚未写入。请先读取最新记录，再查看并发送原输入。' };
    if (['prepared', 'committing'].includes(receipt.status)) throw { code: 'REQUEST_PENDING', message: '上次交流仍在处理中；原输入已保留，稍后发送会先核对同一次请求。' };
    if (receipt.response && (receipt.status === 'committed' || request.skipSave || ['not_requested', 'not_required', 'answered'].includes(receipt.response.saveReceipt?.status))) return receipt.response;
    return null;
  }
  async function sendChat({ message, mode, skipSave, useComposer, activityOverride }) {
    if (chatBusy) return false;
    if (!activityOverride && recordingContext && !recordingContext.verified) { notice('先重新核对当前关联，或退出这份关联；原输入仍保留。'); return false; }
    if (!message) { notice('先说一句想聊什么；手动时间安排也可以留到以后。'); $('intent').focus(); return false; }
    if (message.length > 16000) { notice('本次交流不超过 16000 字符；原文仍保留。'); return false; }
    if (chapterInput.value.trim() && !chapterInput.checkValidity()) { notice('课次可留空；填写时使用 1—200 的整数。'); chapterInput.reportValidity(); return false; }
    if (!recordModel.loaded) await refreshRecords();
    chatBusy = true; decorateModes();
    const uiSnapshotVerified = await flush();
    const context = chatContext(activityOverride);
    const retry = pendingChatRequest && pendingChatRequest.message === message && pendingChatRequest.mode === mode && pendingChatRequest.skipSave === skipSave && (!pendingChatRequest.context || sameChatContext(pendingChatRequest.context, context));
    if (pendingChatRequest && !retry && ['unknown', 'save_failed'].includes(pendingChatOutcome)) { chatBusy = false; decorateModes(); notice('上一段交流的结果还待核对。请保留原输入，先核对原请求，再发送新的内容。'); return false; }
    const requestContext = clone(context); if (!uiSnapshotVerified) delete requestContext.uiRef;
    const request = retry ? pendingChatRequest : { message, mode, skipSave, requestId: requestId(), history: historyForChat(), context: requestContext, ...(recordModel.recordVersion !== null ? { expectedRecordVersion: recordModel.recordVersion } : {}) };
    if (!retry) pendingChatOutcome = '';
    pendingChatRequest = clone(request); chatBusy = true; decorateModes(); chatError.hidden = true;
    let userMessage = state.chat.find(m => m.role === 'user' && m.requestId === request.requestId);
    if (!userMessage) { userMessage = { role: 'user', text: message, requestId: request.requestId, status: 'pending', saved: false }; state.chat.push(userMessage); }
    userMessage.status = 'pending'; renderChat(); queueSave();
    try {
      let data = retry ? await lookupChatReceipt(request) : null;
      if (!data) {
        const response = await fetch('/api/learning/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: stringify(request) });
        const body = await response.json().catch(() => ({})); data = body.data ?? body;
        if (response.status === 409 && !data.saveError) throw { code: 'RECORD_CONFLICT', message: typeof data.error === 'string' ? data.error : data.error?.message || '正式学习记录已经变化，本次尚未写入。请先读取最新记录，再查看并发送原输入。' };
        if (!response.ok && !data.saveError) throw { message: typeof data.error === 'string' ? data.error : data.error?.message || data.message || data.reply || '交流未完成；原话、片段与输入保留。' };
      }
      if (typeof data.reply !== 'string' || !data.reply.trim()) throw { message: '没有收到真实可用回复；输入已保留，请检查连接后重试。' };
      let reply = state.chat.find(m => m.role === 'guide' && m.requestId === request.requestId);
      if (!reply) { reply = { role: 'guide', requestId: request.requestId }; state.chat.push(reply); }
      Object.assign(reply, { text: data.reply, saved: data.saved === true, status: data.saveError ? 'save_failed' : 'received', sourceCoverage: data.sourceCoverage, warnings: data.warnings, saveReceipt: data.saveReceipt, savedLabel: data.savedLabel, contentReceipt: data.contentReceipt, noteReceipt: data.noteReceipt, handoff: data.handoff });
      userMessage.status = 'sent'; renderChat();
      if (data.saveError || isRecordConflict(data.saveReceipt?.status) || ['failed', 'save_failed', 'partial'].includes(data.saveReceipt?.status)) {
        pendingChatOutcome = isRecordConflict(data.saveReceipt?.status) ? 'conflict' : 'save_failed';
        chatError.textContent = pendingChatOutcome === 'conflict' ? '回复已显示，正式学习记录已有更新，本次尚未写入。原输入与片段保留；请读取最新学习记录，查看后再发送。' : '回复已显示，学习记录保存仍待核对。' + (data.saveReceipt?.files?.length ? '可能已有部分记录写入，当前摘要尚未确认是最新。' : '') + '原输入与片段保留，再发送会先核对同一次请求。'; chatError.hidden = false; recordRetry.hidden = pendingChatOutcome !== 'conflict'; queueSave(); return false;
      }
      if (data.inputNeeded || data.saveReceipt?.status === 'needs_input') {
        pendingChatRequest = null; pendingChatOutcome = ''; recordRetry.hidden = true;
        notice('还需要补充一个信息，当前文字和材料已保留。补充后可以再发送。'); queueSave(); return false;
      }
      acceptRecordResponse(data, request);
      pendingChatRequest = null; pendingChatOutcome = ''; recordRetry.hidden = true;
      if (useComposer && ($('intent').value === request.message || mode === 'wrap' && !$('intent').value.trim())) { $('intent').value = ''; state.composerDrafts.chat = ''; }
      const activity = Object.values(state.activities).find(item => item.id === request.context?.uiRef?.activityId);
      if (activity) activity.draft += (activity.draft ? '\n' : '') + message;
      if (mode === 'wrap' && activity) { activity.status = 'paused'; state.cue = false; state.reminder = 'off'; renderHome(); renderPanel(); syncLife(); }
      renderRecordContext();
      queueSave();
      notice(data.saved ? savedLabelFor(data) + '，可以点开本次结果查看。' : '真实回复已收到；此次没有保存记录。');
      return true;
    } catch (error) { pendingChatOutcome = error.code === 'RECORD_CONFLICT' ? 'conflict' : 'unknown'; userMessage.status = 'failed'; chatError.textContent = error.message || '连接未确认完成，原话与片段保留。再发送时会先核对本次结果。'; chatError.hidden = false; recordRetry.hidden = pendingChatOutcome !== 'conflict'; renderChat(); queueSave(); return false; }
    finally { chatBusy = false; decorateModes(); }
  }
  document.addEventListener('input', queueSave);
  document.addEventListener('change', queueSave);
  document.addEventListener('click', event => {
    const navigation = event.target.closest('.module-nav a, a[data-learning-leave]');
    if (navigation && navigation.origin === location.origin && !event.defaultPrevented && event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && navigation.target !== '_blank') {
      event.preventDefault(); const href = navigation.href;
      remember(); flush().then(saved => { if (saved) location.href = href; else { setPanel(true); statusBox.scrollIntoView({ block: 'nearest' }); notice('界面草稿尚未确认保存，请先核对保存提示。'); } }).catch(() => { setPanel(true); statusBox.scrollIntoView({ block: 'nearest' }); }); return;
    }
    queueMicrotask(queueSave);
  });
  window.addEventListener('pagehide', () => {
    const value = remember();
    if (!ui.ready || ui.blocked || stringify(value) === stringify(ui.lastSaved) || bytes(value) > 60000) return;
    const pending = ui.pending && ui.pending.signature === stringify(value) ? ui.pending.input : { identity: ui.identity, expectedRevision: ui.revision, submissionId: requestId(), state: value };
    fetch('/api/learning/ui-state', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json', 'X-Learning-Token': ui.token }, body: stringify(pending) }).catch(() => {});
  });
  window.learningIsland = { flushUiDraft: flush, snapshot: () => clone(snapshot()), version: () => ({ identity: clone(ui.identity), revision: ui.revision, blocked: ui.blocked }), status: () => ({ ready: ui.ready, recordsLoaded: recordModel.loaded, blocked: ui.blocked }), selectedCourse, openCourse, openTaskById, openRecordingContext, clearRecordingContext, resumeCurrentTask, ready: null };
  $('shell').inert = true; decorateModes();
  window.learningIsland.ready = refreshRecords().then(() => reconnect()).then(async () => { if (recordingContext?.id) await openRecordingContext(recordingContext, { restore: true }); }).finally(() => { $('shell').inert = false; renderRecordContext(); if (life.open && state.tab === 'courses') renderSpace(); publishRecovery(); });
})();
