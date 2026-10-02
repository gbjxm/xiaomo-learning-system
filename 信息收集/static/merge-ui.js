'use strict';

// A separate, quiet management view. Never mutates user notes or submits anything.
window.MergeUI = (() => {
  const ui = {host: null, bridge: null, data: null, comparison: null, choices: {}, preview: null, busy: false, loading: false, error: '', sequence: 0, operation: null, selection: {target: '', source: ''}};
  const operationKey = 'xiaomo-merge-operation-v1';
  const labels = {title: '名称', platform: '平台', organizer: '主办方', entry_url: '报名 / 加入入口', summary: '简介', tags: '标签', publication_at: '公告时间', rewards: '奖励及条件', eligibility: '参加资格', work_requirements: '作品要求', steps: '投稿步骤', risks: '版权 / 首发 / 独家', program: '长期机制', assessment: '适用范围判断', importance: '重要性依据', fit_rules: '适配条件', canvas_requirements: '画布要求', cash_tiers: '现金档位', fees: '费用', relations: '父子 / 历史关联', entry_status: '入口状态', contact_email: '联系邮箱', reward_conflict: '奖励信息冲突', record_context: '记录用途', 'time.mechanism': '开放机制', 'time.start': '开始时间', 'time.deadline': '截止时间', 'time.timezone': '原文时区', 'time.absolute_start': '明确开始时刻', 'time.absolute_deadline': '明确截止时刻', 'time.confirmed': '时间机制核验', 'time.evidence': '时间原文依据', 'time.month_period': '月精度范围', 'time.deadline_raw': '截止原文', 'time.deadline_tentative': '截止是否暂定', 'time.conflict': '时间冲突', 'time.policy_effective': '政策生效', 'time.policy_end': '政策结束', 'time.policy_version': '政策版本', 'time.batches': '分批安排'};
  const node = (tag, text, className) => {const result = document.createElement(tag); if (text !== undefined && text !== null) result.textContent = String(text); if (className) result.className = className; return result;};
  const append = (host, ...children) => {for (const child of children) if (child) host.append(child); return host;};
  const button = (text, action, disabled = false) => {const value = node('button', text, 'link-button'); value.type = 'button'; value.disabled = disabled; value.addEventListener('click', action); return value;};
  const readable = value => value === undefined || value === null || value === '' ? '未说明 / 待核实' : typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  const call = (path, data) => ui.bridge.request(path, data);
  const items = () => ui.bridge.getState?.().data?.items || ui.bridge.getState?.().items || ui.bridge.items || [];
  const announce = message => ui.bridge.toast?.(message);
  const active = () => !ui.bridge?.getState?.().view || ui.bridge.getState().view === 'duplicates';
  const current = host => Boolean(host && ui.host === host && host.isConnected && active());
  const dataEpoch = () => ui.bridge?.getState?.().dataEpoch || 0;
  const latest = (sequence, epoch) => sequence === ui.sequence && epoch === dataEpoch();
  function safeLink(url, label) {
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || !parsed.hostname.includes('.') || /(?:^localhost$|\.local$|\.localhost$)/i.test(parsed.hostname) || /^(?:127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(parsed.hostname)) return null;
      const a = node('a', label, 'link-button'); a.href = parsed.href; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a;
    } catch {return null;}
  }
  function remember(operation) {
    ui.operation = operation;
    try {if (operation) sessionStorage.setItem(operationKey, JSON.stringify(operation)); else sessionStorage.removeItem(operationKey);} catch {}
  }
  function restoreOperation() {
    try {const value = JSON.parse(sessionStorage.getItem(operationKey) || 'null'); if (value && /^[a-f0-9]{32}$/.test(value.operation_id) && ['merge', 'undo'].includes(value.action)) ui.operation = value;} catch {}
  }
  restoreOperation();
  function optionSelect(label, key) {
    const wrapper = node('label', label), select = node('select'); select.setAttribute('aria-label', label); select.dataset.mergeSelect = key;
    const blank = node('option', '请选择一条机会'); blank.value = ''; select.append(blank);
    for (const item of items()) {const option = node('option', `${item.title} · ${item.edition}`); option.value = item.id; select.append(option);}
    select.value = ui.selection[key]; select.disabled = ui.busy;
    select.addEventListener('change', () => {ui.selection[key] = select.value; ui.comparison = null; clearPreview(); draw(); ui.host?.querySelector(`[data-merge-select="${key}"]`)?.focus();}); wrapper.append(select); return wrapper;
  }
  function clearPreview() {
    if (ui.preview?.confirm_token) call('/api/merge/cancel', {token: ui.preview.confirm_token}).catch(() => {});
    ui.preview = null;
  }
  async function load() {
    if (ui.loading || ui.busy || !ui.bridge || !current(ui.host)) return;
    ui.loading = true; const sequence = ++ui.sequence, epoch = dataEpoch(); const host = ui.host; draw();
    try {const data = await call('/api/merge/suspects'); if (latest(sequence, epoch)) {ui.data = data; ui.error = '';}}
    catch (error) {if (latest(sequence, epoch)) ui.error = '疑似重复读取失败：' + error.message;}
    finally {if (sequence === ui.sequence) {ui.loading = false; if (latest(sequence, epoch) && current(host)) draw();}}
  }
  async function compare(targetId = ui.selection.target, sourceId = ui.selection.source) {
    if (ui.busy || !targetId || !sourceId || ui.operation) return;
    clearPreview(); ui.comparison = null; ui.choices = {}; ui.selection = {target: targetId, source: sourceId}; ui.busy = true; ui.error = ''; const sequence = ++ui.sequence, epoch = dataEpoch(); const host = ui.host; draw();
    try {const data = await call('/api/merge/compare', {target_id: targetId, source_id: sourceId}); if (latest(sequence, epoch)) ui.comparison = data;}
    catch (error) {if (latest(sequence, epoch)) ui.error = '比较失败：' + error.message;}
    finally {if (sequence === ui.sequence) {ui.busy = false; if (latest(sequence, epoch) && current(host)) {draw(); host.querySelector('[data-merge-comparison]')?.scrollIntoView({block: 'start'});}}}
  }
  async function preview() {
    if (ui.busy || !ui.comparison || ui.operation) return;
    ui.busy = true; ui.error = ''; const sequence = ++ui.sequence, epoch = dataEpoch(); const host = ui.host; draw();
    try {const result = await call('/api/merge/preview', {target_id: ui.selection.target, source_id: ui.selection.source, choices: {...ui.choices}}); if (latest(sequence, epoch)) ui.preview = {...result, action: 'merge'};}
    catch (error) {if (latest(sequence, epoch)) ui.error = '预览失败：' + error.message;}
    finally {if (sequence === ui.sequence) {ui.busy = false; if (latest(sequence, epoch) && current(host)) {draw(); host.querySelector('[data-merge-preview]')?.scrollIntoView({block: 'start'});}}}
  }
  async function undoPreview(id) {
    if (ui.busy || ui.operation) return;
    clearPreview(); ui.busy = true; ui.error = ''; const sequence = ++ui.sequence, epoch = dataEpoch(); const host = ui.host; draw();
    try {const data = await call('/api/merge/undo-preview', {group_id: id}); if (latest(sequence, epoch)) ui.preview = {...data, action: 'undo'};}
    catch (error) {if (latest(sequence, epoch)) ui.error = '撤销预览失败：' + error.message;}
    finally {if (sequence === ui.sequence) {ui.busy = false; if (latest(sequence, epoch) && current(host)) draw();}}
  }
  async function finish(result) {
    if (result?.completed !== true) throw new Error('操作尚未确认完成');
    remember(null); ui.comparison = null; ui.preview = null; ui.choices = {}; ui.data = null;
    await ui.bridge.refresh?.();
    announce(result.action === 'undo' ? '已撤销归并，新旧版本与两条笔记仍保留' : '已关联同一机会，原记录和个人资料全部保留');
  }
  async function confirm(checkbox) {
    if (ui.busy || ui.operation || !ui.preview || checkbox.checked !== true) return;
    const previewValue = ui.preview, action = previewValue.action;
    const operation = {operation_id: crypto.randomUUID().replaceAll('-', ''), action};
    remember(operation); ui.busy = true; ui.error = ''; const sequence = ++ui.sequence, epoch = dataEpoch(); const host = ui.host; draw();
    try {
      const payload = {confirm_token: previewValue.confirm_token, operation_id: operation.operation_id, ...(action === 'merge' ? {same_entity: true} : {confirmed: true})};
      const result = await call(action === 'merge' ? '/api/merge/confirm' : '/api/merge/undo', payload); if (latest(sequence, epoch)) await finish(result);
    } catch (error) {if (latest(sequence, epoch)) {ui.preview = null; ui.error = '操作结果尚未确认：' + error.message + '。请读取操作回执，不自动重复写入。';}}
    finally {if (sequence === ui.sequence) {ui.busy = false; if (latest(sequence, epoch) && current(host)) draw(); if (latest(sequence, epoch) && !ui.operation && !ui.data) load();}}
  }
  async function readStatus() {
    if (!ui.operation || ui.busy) return;
    const operation = ui.operation; ui.busy = true; const sequence = ++ui.sequence, epoch = dataEpoch(); const host = ui.host; draw();
    try {const result = await call('/api/merge/status?operation_id=' + encodeURIComponent(operation.operation_id)); if (!latest(sequence, epoch)) return; if (result.completed) await finish(result); else {ui.operation = {...operation, status: 'unknown'}; ui.error = '当前服务未找到回执；没有证据判断上次操作成功或失败。请先核对两条最新记录及关联组。';}}
    catch (error) {if (latest(sequence, epoch)) ui.error = '回执读取失败：' + error.message;}
    finally {if (sequence === ui.sequence) {ui.busy = false; if (latest(sequence, epoch) && current(host)) draw(); if (latest(sequence, epoch) && !ui.operation && !ui.data) load();}}
  }
  function comparisonPanel() {
    const value = ui.comparison; if (!value) return null;
    const panel = node('article', null, 'backup-panel'); panel.dataset.mergeComparison = 'true';
    append(panel, node('h2', '逐字段比较'), node('p', value.preservation, 'meta'));
    const versions = node('div', null, 'decision-columns');
    for (const [key, label] of [['target', '保留身份的目标'], ['source', '保留原件的来源']]) {const member = value[key], doc = member.document; const box = node('section'); append(box, node('h3', label), node('strong', doc.title), node('p', `${doc.edition} · ${doc.platform} · 版本 ${member.version}`), safeLink(doc.official_url, '查看官方原文 ↗')); versions.append(box);} panel.append(versions);
    for (const blocker of value.blockers) panel.append(node('p', blocker, 'notice error'));
    for (const field of value.fields) {
      const row = node('fieldset', null, 'merge-field'); row.dataset.mergeField = field.field;
      append(row, node('legend', (labels[field.field] || field.field) + (field.critical ? ' · 重要规则' : '')));
      const columns = node('div', null, 'decision-columns');
      for (const [choice, label] of [['target', '保留目标'], ['source', '采用来源']]) {
        const option = node('label'), radio = node('input'); radio.type = 'radio'; radio.name = 'merge-' + field.field; radio.value = choice; radio.checked = ui.choices[field.field] === choice; radio.disabled = ui.busy || Boolean(ui.preview) || value.blockers.length > 0;
        radio.addEventListener('change', () => {ui.choices[field.field] = choice; panel.querySelector('[data-merge-preview-button]').disabled = value.fields.some(item => !ui.choices[item.field]) || ui.busy || value.blockers.length > 0;});
        append(option, radio, node('strong', label), node('pre', readable(field[choice]), 'evidence-body')); columns.append(option);
      } row.append(columns); panel.append(row);
    }
    if (!value.fields.length) panel.append(node('p', '可选规则没有差异，仍会保留两份来源并生成关联记录。'));
    const previewButton = button('预览归并结果', preview, ui.busy || Boolean(ui.preview) || value.blockers.length > 0 || value.fields.some(item => !ui.choices[item.field])); previewButton.dataset.mergePreviewButton = 'true'; panel.append(previewButton); return panel;
  }
  function previewPanel() {
    const value = ui.preview; if (!value) return null;
    const panel = node('article', null, 'backup-preview'); panel.dataset.mergePreview = 'true';
    append(panel, node('h2', value.action === 'merge' ? '归并预览 · 尚未写入' : '撤销归并预览 · 尚未写入'), node('p', value.preservation));
    if (value.critical_pending?.length) append(panel, node('p', '采纳的重要规则需复核：' + value.critical_pending.map(field => labels[field] || field).join('、') + '。归并不会自动确认开放或个人资格。', 'notice'));
    for (const change of value.differences) {const diff = node('details'); append(diff, node('summary', labels[change.field] || change.field), node('pre', '当前：\n' + readable(change.before) + '\n\n归并后：\n' + readable(change.after), 'evidence-body')); panel.append(diff);}
    const full = node('details'); append(full, node('summary', '完整预览记录'), node('pre', readable(value.document), 'evidence-body')); panel.append(full);
    const consent = node('label'), checkbox = node('input'); checkbox.type = 'checkbox'; checkbox.dataset.mergeConsent = 'true'; checkbox.disabled = ui.busy;
    append(consent, checkbox, node('span', value.action === 'merge' ? '我确认两条是同一活动、同一年度、同一轮次，并已核对各字段选择' : '我已核对撤销差异，确认生成新版本并恢复独立显示'));
    const confirmButton = button(value.action === 'merge' ? '确认归并' : '确认撤销归并', () => confirm(checkbox), true); confirmButton.dataset.mergeConfirm = 'true'; checkbox.addEventListener('change', () => {confirmButton.disabled = !checkbox.checked || ui.busy || Boolean(ui.operation);});
    append(panel, consent, append(node('div', null, 'backup-actions'), button('取消预览', () => {clearPreview(); draw(); announce('已取消预览，没有写入');}, ui.busy), confirmButton)); return panel;
  }
  function draw() {
    const host = ui.host; if (!host || !host.isConnected || !active()) return;
    host.replaceChildren();
    append(host, append(node('article', null, 'backup-panel'), node('h2', '跨来源归并'), node('p', '将同一活动的多个来源关联起来。先比较、逐字段选择，再预览确认；不同届次独立保留。所有原件和个人资料都能找回。'), node('p', ui.data?.note || '名称相近只提供线索，不自动合并。', 'meta')));
    if (ui.error) append(host, node('p', ui.error, 'notice error'));
    if (ui.loading || ui.busy) append(host, node('p', ui.busy ? '正在处理，请等待结果；页面返回不会撤销已提交操作。' : '正在读取关联和疑似重复…', 'notice'));
    if (ui.operation) {const panel = node('article', null, 'backup-panel'); append(panel, node('h3', '核对上次操作'), node('p', `操作 ${ui.operation.operation_id}`), button('读取操作回执', readStatus, ui.busy)); if (ui.operation.status === 'unknown') panel.append(button('已核对当前记录，解除待确认', async () => {if (ui.busy) return; try {await ui.bridge.refresh?.(); remember(null); ui.error = '已按你的核对解除待确认；未将上次操作标为成功。'; ui.data = null; draw(); load();} catch (error) {ui.error = error.message; draw();}}, ui.busy)); host.append(panel);}
    const manual = node('article', null, 'backup-panel'); append(manual, node('h3', '选择两条记录'), append(node('div', null, 'decision-columns'), optionSelect('目标记录', 'target'), optionSelect('来源记录', 'source')), button('比较所选记录', () => compare(), ui.busy || Boolean(ui.operation))); host.append(manual);
    for (const pair of ui.data?.pairs || []) {const card = node('article', null, 'backup-card'); append(card, node('h3', pair.target_title), node('p', pair.source_title + ' · ' + pair.edition), node('p', pair.reason, 'meta'), button('逐项比较', () => compare(pair.target_id, pair.source_id), ui.busy || Boolean(ui.operation))); host.append(card);}
    if (ui.data && !ui.data.pairs.length) append(host, node('p', '没有符合保守条件的疑似重复。仍可手动选择两条比较；不同轮次不会被归并。', 'meta'));
    append(host, comparisonPanel(), previewPanel());
    for (const group of ui.data?.groups || []) {
      const panel = node('article', null, 'backup-card'); panel.dataset.mergeGroup = group.id;
      append(panel, node('h3', (group.status === 'active' ? '已关联 · ' : '已撤销 · ') + group.members[0].document.title), node('p', '原记录全部保留；来源、证据和个人笔记按原件分别显示。', 'meta'));
      for (const member of group.members) {const detail = node('details'); append(detail, node('summary', member.document.title + ' · ' + member.document.edition), node('p', member.document.source_id + ' · 版本 ' + member.version), node('p', member.starred ? '此记录已关注' : '此记录未关注'), node('pre', member.note || '此记录暂无个人笔记', 'evidence-body'), safeLink(member.document.official_url, '官方原文 ↗'), button('查看该原记录详情', () => ui.bridge.openDetail?.(member.id))); panel.append(detail);}
      if (group.status === 'active') panel.append(button('预览撤销归并', () => undoPreview(group.id), ui.busy || Boolean(ui.operation))); host.append(panel);
    }
    append(host, button('重新读取', () => {ui.data = null; load();}, ui.busy || ui.loading));
  }
  function mount(host, bridge) {ui.host = host; ui.bridge = bridge; draw(); if (!ui.data && !ui.loading && !ui.busy) load();}
  function afterRestore() {++ui.sequence; ui.preview = null; ui.comparison = null; ui.choices = {}; ui.data = null; ui.loading = false; ui.busy = false; ui.error = ''; if (current(ui.host)) {draw(); return load();}}
  return {mount, render: mount, afterRestore, refresh: () => {ui.data = null; return load();}, pending: () => ui.busy || Boolean(ui.operation), collapsedIds: () => (ui.data?.groups || []).filter(group => group.status === 'active').map(group => group.source_id)};
})();
