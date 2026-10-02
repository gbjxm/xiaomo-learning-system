'use strict';

const enhancementViewHelpers = (() => {
  const categories = [
    ['new', '新增条目'], ['candidate_new', '新增待核线索'], ['extended', '时间延期'],
    ['shortened', '时间提前 / 缩短'], ['rules_changed', '奖励 / 规则变更'], ['expired', '到期'],
    ['failed', '核验失败'], ['review_pending', '页面变化待复核'], ['status_changed', '状态变化']
  ];
  const categoryNames = Object.fromEntries(categories);
  const batchStatuses = {running: '检查中', finished: '已完成', cancelled: '已取消', interrupted: '未完成'};
  const candidateStatuses = {pending: '待核线索', known: '已关联保存条目', dismissed: '暂不关注'};
  const fieldNames = {
    organizer: '主办方', official_url: '官方原文', entry_url: '报名 / 加入入口', eligibility: '资格',
    work_requirements: '作品要求', steps: '操作步骤', risks: '版权与风险条款', relations: '关联条目',
    status: '公开状态', verification: '条目核验状态', type: '类别', label: '名称', amount: '数量',
    currency: '币种', unit: '单位', scope: '奖励口径', validity: '有效期', detail: '条款', level: '风险等级',
    'time.mechanism': '时间机制', 'time.start': '报名 / 加入开始', 'time.deadline': '报名 / 加入截止',
    'time.timezone': '原文时区', 'time.absolute_start': '明确的绝对开始', 'time.absolute_deadline': '明确的绝对截止',
    'time.confirmed': '时间依据已核', 'time.batches': '批次安排', 'time.policy_effective': '规则生效',
    'time.policy_end': '规则终止', 'time.policy_version': '规则版本', 'time.month_period.start': '月份窗口开始',
    'time.month_period.end': '月份窗口结束', 'time.deadline_tentative': '截止为暂定', 'time.conflict': '时间信息冲突',
    'program.join': '加入方式', 'program.revenue': '收益计算', 'program.settlement': '结算规则',
    'program.ongoing_requirements': '持续达标条件', 'program.exit': '退出条件', 'program.effective_version': '收益规则版本'
  };
  const basisNames = {
    official_confirmed_time: '已核官方时间', time_unconfirmed: '官方时间尚未核全', source_attempt: '本次信源请求记录',
    page_observation: '网页原文抓取记录', legacy_version_timestamp: '历史版本时间关联'
  };
  const articleStatuses = {not_checked: '尚未读取公告正文', partial_text: '取得部分正文文字', no_text: '未取得可读正文', failed: '正文读取失败'};

  function batchUI() {
    if (!state.batchUI) state.batchUI = {selectedId: null, cache: new Map(), request: 0, inFlight: null, controller: null, error: null, openDetails: new Set(), bootstrapSeen: null};
    return state.batchUI;
  }

  function discoveryUI() {
    if (!state.discoveryUI) state.discoveryUI = {filter: 'pending', pending: new Set(), errors: new Map(), openBodies: new Set(), focusId: null};
    return state.discoveryUI;
  }

  function sourceName(id) {
    return (state.data.sources || []).find(source => source.id === id)?.name || id || '来源待核';
  }

  function notice(text, error = false) {
    return el('p', 'notice' + (error ? ' error' : ''), text);
  }

  function emptyView(title, text) {
    return add(el('div', 'empty'), el('strong', null, title), el('p', null, text));
  }

  function countNodes(digest, compact = false) {
    const node = el('div', 'digest-counts');
    for (const [category, label] of categories) {
      const count = Number(digest?.counts?.[category]) || 0;
      if (compact && !count && !['new', 'extended', 'rules_changed', 'expired', 'failed'].includes(category)) continue;
      const entry = add(el('div', 'digest-count'), el('strong', null, count), el('span', null, label));
      entry.dataset.category = category;
      add(node, entry);
    }
    return node;
  }

  function openBatch(id) {
    const ui = batchUI();
    if (id) ui.selectedId = id;
    ui.error = null;
    setView('batches');
  }

  function digestSummary() {
    const host = document.getElementById('digest-summary');
    if (!host) return;
    host.hidden = state.view !== 'opportunities' || !state.data || state.stopped;
    if (host.hidden) return;
    const digest = state.data.digest, run = digest?.run;
    host.className = 'digest-panel';
    host.replaceChildren();
    add(host, add(el('div', 'digest-heading'), el('h2', null, '本次更新摘要'), run ? el('small', null, `${fmt(run.finished_at || run.started_at)} · ${batchStatuses[run.status] || run.status}`) : null));
    if (!run) {
      add(host, el('p', null, digest?.note || '尚无更新批次；检查一次后可在这里回看新增与条款变化。'));
    } else {
      add(host, countNodes(digest, true));
      if (run.status === 'running') add(host, notice('本批次尚未完成，现有数字不能用于判断没有更新。'));
      if (digest.limited) add(host, el('p', 'digest-limited', digest.note || '历史批次摘要受限，无法恢复当时全部变化。'));
    }
    add(host, add(el('div', 'digest-actions'), button('回看批次详情 ↗', 'link-button', () => openBatch(run?.id)), button('查看待核线索 ↗', 'link-button', () => setView('discoveries'))));
  }

  function readableField(field) {
    if (fieldNames[field]) return fieldNames[field];
    if (field.startsWith('rewards.')) return (typeof rewardNames !== 'undefined' ? rewardNames[field.slice(8)] : null) || '奖励';
    return fieldNames[field.split('.').pop()] || field;
  }

  function readableValue(value) {
    if (value === null || value === undefined || value === '') return '未说明 / 未核';
    if (typeof value === 'boolean') return value ? '是' : '否';
    if (typeof value === 'number') return value.toLocaleString('zh-CN');
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return value.length ? value.map(readableValue).join('\n\n') : '尚无记录';
    return Object.entries(value).map(([key, item]) => {
      const text = key === 'type' && typeof rewardNames !== 'undefined' && rewardNames[item] ? rewardNames[item] : readableValue(item);
      return `${fieldNames[key] || key}：${text}`;
    }).join('\n');
  }

  function trackedDetails(key, title, children) {
    const ui = batchUI(), node = el('details');
    add(node, el('summary', null, title), ...children);
    node.open = ui.openDetails.has(key);
    node.addEventListener('toggle', () => node.open ? ui.openDetails.add(key) : ui.openDetails.delete(key));
    return node;
  }

  function eventCard(event, index, runId) {
    const node = el('article', 'batch-event');
    node.dataset.category = event.category || 'unknown';
    add(node, add(el('div', 'batch-event-heading'), el('span', 'tag', event.label || categoryNames[event.category] || '批次记录'), el('h3', null, event.title || '未命名记录')));
    add(node, el('p', 'batch-meta', `${sourceName(event.source_id)} · 记录时间 ${fmt(event.at)}`));
    const actions = el('div', 'digest-actions');
    if (event.official_url) add(actions, link('本次官方原文 ↗', event.official_url, 'link-button'));
    if (event.official_url_before && event.official_url_before !== event.official_url) add(actions, link('变更前官方原文 ↗', event.official_url_before, 'link-button'));
    if (event.item_id && (state.data.items || []).some(item => item.id === event.item_id)) add(actions, button('查看当前条目 ↗', 'link-button', () => openDetail(event.item_id)));
    if (event.candidate_id) add(actions, button('查看待核线索 ↗', 'link-button', () => {
      const ui = discoveryUI(), candidate = (state.data.candidates || []).find(item => item.id === event.candidate_id);
      ui.filter = candidate?.review_state || 'all';
      ui.focusId = event.candidate_id;
      setView('discoveries');
    }));
    add(node, actions);
    if (event.message) add(node, el('p', null, event.message));
    if (event.status_before || event.status_after) {
      const before = event.status_before?.label || event.status_before?.code || '无前次状态记录';
      const after = event.status_after?.label || event.status_after?.code || '状态待核';
      add(node, el('p', 'batch-status', `${event.category === 'failed' ? '信源核验结果' : '公开状态'}：${before} → ${after}`));
    }
    if (event.version_before || event.version_after) add(node, el('small', 'batch-meta', `条目版本：${event.version_before || '初次记录'} → ${event.version_after || '未记录'}`));
    if ((event.changes || []).length) {
      const diffs = el('div', 'batch-diffs');
      for (const change of event.changes) {
        const entry = el('section', 'field-diff');
        add(entry, el('h4', null, readableField(change.field || '')),
          add(el('div', 'diff-before'), el('small', null, '变更前'), el('pre', null, readableValue(change.before))),
          add(el('div', 'diff-after'), el('small', null, '变更后'), el('pre', null, readableValue(change.after))));
        add(diffs, entry);
      }
      add(node, diffs);
    }
    if (event.category === 'rules_changed' && !['manual_review', 'manual_handoff'].includes(event.origin)) add(node, el('p', 'digest-limited', '以上为结构化字段变化，仍需对照官方原文核验完整条款。'));
    const evidence = el('div', 'batch-evidence');
    for (const [label, urls] of [['本次证据', event.evidence_urls], ['前次证据', event.evidence_urls_before]]) {
      for (const [number, url] of [...new Set(Array.isArray(urls) ? urls : [])].entries()) add(evidence, link(`${label} ${number + 1} ↗`, url));
    }
    if (evidence.childNodes.length) add(node, evidence);
    const source = event.time_source;
    if (typeof source === 'string') add(node, el('p', 'batch-time-source', `时间来源：${source}`));
    else if (source && typeof source === 'object') {
      const descriptions = [`时间来源：${basisNames[source.basis] || source.basis || '批次记录'}`];
      if (source.observed_at) descriptions.push('观察 / 确认时间 ' + fmt(source.observed_at));
      if (source.version_recorded_at) descriptions.push('条款版本记录 ' + fmt(source.version_recorded_at));
      if (source.transition === 'confirmed_by_rule_update') descriptions.push('本次核验条款确认已截止');
      if (source.transition === 'clock_crossed_confirmed_boundary') descriptions.push('检查期间经过已核截止边界');
      add(node, el('p', 'batch-time-source', descriptions.join(' · ')));
      if (source.time) {
        const entries = [['开始原文', source.time.start], ['截止原文', source.time.deadline], ['绝对截止', source.time.absolute_deadline], ['政策终止', source.time.policy_end], ['原文时区', source.time.timezone || '未说明；边界状态保守判断'], ['官方时间依据', source.time.evidence]];
        const facts = el('dl', 'data-grid');
        for (const [label, value] of entries) if (value) add(facts, add(el('div', 'wide'), el('dt', null, label), el('dd', null, value)));
        add(node, trackedDetails(`${runId}:time:${index}`, '查看官方时间依据', [facts]));
      }
    }
    for (const page of event.page_diffs || []) add(node, trackedDetails(`${runId}:page:${page.id}`, `页面原文差异 · ${fmt(page.at)} · 待复核`, [el('p', null, '原文变化可能来自导航或排版，尚未认定奖励或规则变化。'), el('pre', 'diff', page.diff || '未保存差异正文')]));
    return node;
  }

  function batchKey(run) {
    return `${run.id}|${run.started_at || ''}|${run.finished_at || ''}|${run.status || ''}`;
  }

  function cancelBatchRequest() {
    const ui = batchUI();
    ui.controller?.abort();
    ui.controller = null;
    ui.inFlight = null;
    ++ui.request;
  }

  async function requestBatch(run, key) {
    const ui = batchUI();
    cancelBatchRequest();
    const request = ui.request, controller = new AbortController();
    ui.controller = controller;
    ui.inFlight = key;
    ui.error = null;
    try {
      const digest = await api('/api/digest?id=' + encodeURIComponent(run.id), undefined, controller.signal);
      if (request !== ui.request || state.stopped) return;
      ui.cache.set(run.id, {key, digest});
    } catch (error) {
      if (request !== ui.request || error.name === 'AbortError' || state.stopped) return;
      ui.error = {key, message: error.message};
    } finally {
      if (request === ui.request) {
        ui.inFlight = null;
        ui.controller = null;
        if (state.view === 'batches' && ui.selectedId === run.id && !state.stopped) batches();
      }
    }
  }

  function attemptList(run) {
    const attempts = run.attempts || [];
    if (!attempts.length) return null;
    const list = el('div', 'batch-attempts');
    for (const attempt of attempts) add(list, add(el('article', 'batch-attempt'),
      el('strong', null, sourceName(attempt.source_id)),
      el('p', null, `${typeof reportNames !== 'undefined' ? reportNames[attempt.status] || attempt.status : attempt.status} · ${fmt(attempt.finished_at || attempt.attempted_at)}`),
      el('p', null, attempt.message || '未保存说明')));
    return trackedDetails(`${run.id}:attempts`, `查看本批次信源检查结果（${attempts.length} 次）`, [list]);
  }

  function batches() {
    if (!state.data || state.stopped) return;
    const ui = batchUI(), runs = state.data.runs || [], content = document.getElementById('content');
    if (!content) return;
    if (!runs.length) {
      cancelBatchRequest();
      content.replaceChildren(emptyView('还没有更新批次', '检查一次后，新增、延期、规则差异与失败记录会按批次保存在这里。'));
      return;
    }
    if (!runs.some(run => run.id === ui.selectedId)) ui.selectedId = state.data.digest?.run?.id && runs.some(run => run.id === state.data.digest.run.id) ? state.data.digest.run.id : runs[0].id;
    const run = runs.find(item => item.id === ui.selectedId), key = batchKey(run);
    if (ui.inFlight && ui.inFlight !== key) cancelBatchRequest();
    const bootstrapDigest = state.data.digest;
    if (bootstrapDigest?.run?.id === run.id && ui.bootstrapSeen !== bootstrapDigest) {
      ui.cache.set(run.id, {key, digest: bootstrapDigest});
      ui.bootstrapSeen = bootstrapDigest;
    }
    const cached = ui.cache.get(run.id), digest = cached?.key === key ? cached.digest : null;
    const wrapper = el('section', 'batch-panel');
    const select = el('select');
    select.id = 'batch-select';
    select.setAttribute('aria-label', '选择更新批次');
    for (const item of runs) {
      const option = el('option', null, `${fmt(item.started_at)} · ${batchStatuses[item.status] || item.status} · ${item.id.slice(0, 8)}`);
      option.value = item.id;
      add(select, option);
    }
    select.value = run.id;
    select.addEventListener('change', () => {ui.selectedId = select.value; ui.error = null; batches(); document.getElementById('batch-select')?.focus();});
    const refresh = button('重读本批次', 'link-button', () => {ui.cache.delete(run.id); ui.error = null; cancelBatchRequest(); void requestBatch(run, key); batches();});
    refresh.disabled = ui.inFlight === key;
    add(wrapper, add(el('div', 'batch-toolbar'), add(el('label'), el('span', null, '更新批次'), select), refresh), el('p', 'batch-meta', `开始 ${fmt(run.started_at)} · 结束 ${fmt(run.finished_at)} · ${batchStatuses[run.status] || run.status}`));
    if (digest) {
      add(wrapper, countNodes(digest), el('p', 'digest-limited', '各类别分别计数，同一条目可能同时发生条款变化与到期。新增待核线索需另行核验开放状态与规则。'));
      if (digest.limited) add(wrapper, notice(digest.note || '历史摘要受限，未保存完整运行前后状态。'));
      if (run.status !== 'finished') add(wrapper, notice(run.status === 'running' ? '本批次仍在检查，尚未完成的信源不能视为没有更新。' : '本批次未完整完成；未检查部分不能视为零更新。'));
      const events = el('div', 'batch-events');
      for (const [index, event] of (digest.events || []).entries()) add(events, eventCard(event, index, run.id));
      add(wrapper, events);
      if (!(digest.events || []).length) add(wrapper, emptyView('本批次没有可回看的变化事件', digest.limited ? '历史摘要受限；可查看下方信源尝试，不能据此判定所有规则均未变化。' : '没有保存条款变化、到期或失败事件；检查覆盖范围以下方信源结果为准。'));
    } else if (ui.error?.key === key) add(wrapper, notice('批次详情暂未读到：' + ui.error.message + '。可点击“重读本批次”重试。', true));
    else {
      const loading = notice('正在读取本机保存的批次详情…');
      loading.setAttribute('role', 'status');
      add(wrapper, loading);
      wrapper.setAttribute('aria-busy', 'true');
    }
    add(wrapper, attemptList(run));
    content.replaceChildren(wrapper);
    if (!digest && ui.inFlight !== key && ui.error?.key !== key) void requestBatch(run, key);
  }

  async function reviewCandidate(candidate, nextState) {
    const ui = discoveryUI();
    if (ui.pending.has(candidate.id) || state.stopped) return;
    ui.pending.add(candidate.id);
    ui.errors.delete(candidate.id);
    if (state.view === 'discoveries') discoveries();
    try {
      await api('/api/candidate/review', {id: candidate.id, state: nextState});
      const current = (state.data?.candidates || []).find(item => item.id === candidate.id);
      if (current) current.review_state = nextState;
      if (!state.stopped) toast(nextState === 'dismissed' ? '线索已暂不关注；可在对应筛选中恢复待核。' : '线索已恢复待核；规则仍需对照官方原文。');
    } catch (error) {
      ui.errors.set(candidate.id, error.message);
      if (!state.stopped) toast('线索状态未获确认：' + error.message);
    } finally {
      ui.pending.delete(candidate.id);
      if (state.view === 'discoveries' && !state.stopped) discoveries();
    }
  }

  function candidateCard(candidate) {
    const ui = discoveryUI(), evidence = candidate.evidence || {}, node = el('article', 'discovery-card');
    node.id = 'candidate-' + candidate.id;
    node.dataset.id = candidate.id;
    node.tabIndex = -1;
    add(node, add(el('div', 'discovery-meta'), el('span', 'tag', candidateStatuses[candidate.review_state] || '待核线索'), el('span', null, sourceName(candidate.source_id))), el('h2', null, candidate.title));
    add(node, el('p', 'discovery-meta', `首次发现 ${fmt(candidate.first_seen_at)} · 最近发现 ${fmt(candidate.last_seen_at)} · ${candidate.edition || '轮次待核'}`));
    add(node, el('p', 'discovery-status', '官方列表发现与规则核验分别记录。此线索尚不代表正在开放，也未确认个人资格、奖励或版权条件。'));
    const actions = el('div', 'discovery-actions');
    add(actions, link('官方公告原文 ↗', candidate.official_url, 'link-button'));
    if (evidence.list_url) add(actions, link('发现线索的官方列表 ↗', evidence.list_url, 'link-button'));
    if (candidate.known_item_id) add(actions, button('查看关联保存条目 ↗', 'link-button', () => openDetail(candidate.known_item_id)));
    const nextState = candidate.review_state === 'dismissed' ? 'pending' : 'dismissed';
    const review = button(ui.pending.has(candidate.id) ? '保存中…' : nextState === 'pending' ? '恢复待核' : '暂不关注', 'link-button', () => reviewCandidate(candidate, nextState));
    review.disabled = ui.pending.has(candidate.id) || state.stopped;
    add(actions, review);
    add(node, actions);
    if(window.stage2Review)add(node,window.stage2Review.candidateTools(candidate));
    if (ui.errors.has(candidate.id)) add(node, notice('线索状态未获确认：' + ui.errors.get(candidate.id) + '。可重新操作。', true));
    const provenance = el('div', 'discovery-evidence');
    add(provenance, el('p', null, `发现方式：${evidence.method === 'official_public_html_list' ? '已登记官方公开公告列表' : '公开网页线索'} · 列表观察 ${fmt(evidence.observed_at)}`), el('p', null, `公告正文：${articleStatuses[evidence.article_state] || '读取范围待核'}${Number.isFinite(evidence.article_text_chars) ? ' · ' + evidence.article_text_chars + ' 字' : ''}`));
    if (evidence.note) add(provenance, el('p', null, evidence.note));
    if (evidence.article_error) add(provenance, notice('正文读取失败：' + evidence.article_error + '；保留线索，不能据此判定没有更新。', true));
    add(node, provenance);
    if (candidate.body) {
      const details = el('details', 'discovery-body'), body = el('div');
      add(details, el('summary', null, '查看已保存正文 · 未完成规则核验'), body);
      const populate = () => {if (details.open && !body.childNodes.length) add(body, el('p', null, '下方为公开网页提取文字，图片、外链及条款缺口仍需逐项核验。'), el('pre', 'diff', candidate.body));};
      details.open = ui.openBodies.has(candidate.id);
      populate();
      details.addEventListener('toggle', () => {if (details.open) ui.openBodies.add(candidate.id); else ui.openBodies.delete(candidate.id); populate();});
      add(node, details);
    } else add(node, el('p', 'digest-limited', '尚无已保存正文；请从官方公告补核。'));
    if (Array.isArray(evidence.article_links) && evidence.article_links.length) {
      const details = el('details', 'discovery-evidence'), links = el('div', 'batch-evidence');
      add(details, el('summary', null, '正文提到的链接 · 外链内容未核'));
      for (const [index, url] of [...new Set(evidence.article_links)].entries()) add(links, link('正文链接 ' + (index + 1) + ' ↗', url));
      add(details, links);
      add(node, details);
    }
    return node;
  }

  function discoveries() {
    if (!state.data || state.stopped) return;
    const ui = discoveryUI(), candidates = state.data.candidates || [], content = document.getElementById('content');
    if (!content) return;
    const wrapper = el('section', 'discovery-panel'), tabs = el('div', 'discovery-tabs');
    tabs.setAttribute('role', 'group');
    tabs.setAttribute('aria-label', '筛选待核线索');
    for (const [filter, label] of [['pending', '待核'], ['known', '已关联'], ['dismissed', '暂不关注'], ['all', '全部']]) {
      const count = filter === 'all' ? candidates.length : candidates.filter(item => item.review_state === filter).length;
      const tab = button(`${label} ${count}`, ui.filter === filter ? 'filter-chip selected' : 'filter-chip', () => {ui.filter = filter; discoveries();});
      tab.setAttribute('aria-pressed', String(ui.filter === filter));
      add(tabs, tab);
    }
    add(wrapper, add(el('div', 'discovery-toolbar'), tabs), notice('这里只保存官方公开列表发现的线索。公告文字取得、规则核验和确认开放分别判断；暂不关注可以恢复待核。'));
    const selected = candidates.filter(candidate => ui.filter === 'all' || candidate.review_state === ui.filter), list = el('div', 'discovery-list');
    for (const candidate of selected) add(list, candidateCard(candidate));
    add(wrapper, list);
    if (!selected.length) add(wrapper, emptyView('此筛选下暂无线索', candidates.length ? '可切换到其他状态，查看已关联或暂不关注的线索。' : '检查已登记的官方列表后，实际发现的候选公告会保存在这里。'));
    content.replaceChildren(wrapper);
    if (ui.focusId) {
      const target = document.getElementById('candidate-' + ui.focusId);
      if (target) {target.scrollIntoView({block: 'center'}); target.focus({preventScroll: true});}
      ui.focusId = null;
    }
  }

  return {digestSummary, batches, discoveries};
})();

function renderDigestSummary() { enhancementViewHelpers.digestSummary(); }
function renderBatches() { enhancementViewHelpers.batches(); }
function renderDiscoveries() { enhancementViewHelpers.discoveries(); }
