/* Layout decoration preserves the original business handlers in writable spaces. */
(() => {
  'use strict';
  if (document.body.dataset.previewRegion !== 'information') return;
  const spaceMode = ['production', 'isolated'].includes(document.body.dataset.spaceMode) ? document.body.dataset.spaceMode : 'readonly';
  const isReadonly = spaceMode === 'readonly';
  const byId = id => document.getElementById(id);
  const listViews = new Set(['opportunities', 'starred', 'archive']);
  const touchedCards = new WeakSet();
  const touchedHeadings = new WeakSet();
  const touchedChanges = new WeakSet();
  let queued = false;
  let feedbackTimer;

  function currentState() {
    try { return typeof state === 'object' && state.data ? state : null; }
    catch { return null; }
  }
  function text(node, value) {
    if (node && node.textContent !== value) node.textContent = value;
  }
  function paragraph(className, value) {
    const node = document.createElement('p');
    node.className = className;
    node.textContent = value;
    return node;
  }
  function readonlyFeedback() {
    let node = byId('info-preview-feedback');
    if (!node) {
      node = document.createElement('div');
      node.id = 'info-preview-feedback';
      node.className = 'info-preview-feedback';
      node.setAttribute('role', 'status');
      node.setAttribute('aria-live', 'polite');
    }
    // Dialogs occupy the browser's top layer. Feedback for a dialog action must
    // live inside that layer so it remains both visible and announced.
    const dialog = byId('detail');
    const host = dialog?.open ? dialog : document.body;
    if (node.parentElement !== host) host.append(node);
    text(node, '此预览未提交，也未修改正式资料。当前输入保留；保存、关注或核验请打开右上角“正式使用”。');
    node.hidden = false;
    clearTimeout(feedbackTimer);
    feedbackTimer = setTimeout(() => { node.hidden = true; }, 5200);
  }
  function labelFilters() {
    for (const [id, labelText] of [['platform', '平台'], ['status', '开放状态'], ['reward', '奖励类别']]) {
      const select = byId(id);
      if (!select || select.parentElement?.classList.contains('info-filter-field')) continue;
      const field = document.createElement('div');
      field.className = 'info-filter-field';
      const label = document.createElement('label');
      label.htmlFor = id;
      label.textContent = labelText;
      select.before(field);
      field.append(label, select);
      // Replace the redundant visually hidden label with the visible one.
      const hiddenLabel = document.querySelector(`label.sr-only[for="${id}"]`);
      hiddenLabel?.remove();
    }
  }
  function arrangeTools(s) {
    const tools = byId('opportunity-tools');
    const profile = byId('profile-editor');
    const fit = tools?.querySelector('.fit-filter-label');
    const searchTools = tools?.querySelector('.search-tools');
    const profileDetails = profile?.querySelector(':scope > details');
    if (profileDetails && !profileDetails.id) profileDetails.id = 'info-work-profile';
    if (searchTools && !searchTools.id) searchTools.id = 'info-search-tools';
    let advanced = byId('info-reading-tools');
    if (tools && !advanced) {
      advanced = document.createElement('details');
      advanced.id = 'info-reading-tools';
      advanced.className = 'info-reading-tools';
      const summary = document.createElement('summary');
      summary.textContent = '更多筛选与作品对照 · 作品条件、检索范围、常用筛选';
      const panel = document.createElement('div');
      panel.className = 'info-reading-tools-content';
      advanced.append(summary, panel);
      tools.append(advanced);
    }
    const advancedPanel = advanced?.querySelector('.info-reading-tools-content');
    if (advancedPanel) for (const node of [profile, fit, searchTools]) {
      if (node && node.parentElement !== advancedPanel) advancedPanel.append(node);
    }
    const library = document.querySelector('.library-meta');
    if (library && !library.id) library.id = 'info-library-meta';
    const notice = byId('update-notice');
    const content = library?.querySelector('.library-meta-content');
    if (notice && content && notice.parentElement !== content) content.prepend(notice);
    const run = s.data.runs?.find(value => value.finished_at);
    const counts = run?.summary?.counts;
    const summary = library?.querySelector(':scope > summary');
    const status = s.data.update;
    if (status?.running || s.updateError || status?.error) {
      if (library && !library.open) library.open = true;
      text(summary, '检查状态需留意 · 展开查看结果与资料概况');
    } else if (counts) {
      const recordedCount = value => Number.isFinite(value) && value >= 0 ? value : '未记录';
      text(summary, `上次检查：部分 ${recordedCount(counts.partial)} · 失败 ${recordedCount(counts.failed)} · 待核 ${recordedCount(counts.pending)}　/　结果与资料概况`);
    } else {
      text(summary, '更新记录与资料概况 · 已保存资料可继续浏览');
    }
    let context = byId('info-preview-context');
    if (!context) {
      context = paragraph('info-preview-context', '');
      context.id = 'info-preview-context';
      context.setAttribute('role', 'note');
      document.querySelector('.page-heading')?.after(context);
    }
    text(context, isReadonly ? '只读浏览已保存资料 · 奖励口径、公开时间与个人资格分别核对。输入和筛选留在当前标签页，保存请到“正式使用”。' : spaceMode === 'isolated' ? '当前保存目标：隔离验证信息库 · 笔记、关注、作品与核验只写验证副本。奖励口径、公开时间与个人资格分别核对。' : '当前保存目标：正式信息库 · 笔记、关注、作品与核验保存到本机资料。检查更新须你手动执行，个人资格另核。');
    const update = byId('update');
    if (update && isReadonly) {
      update.title = '预览不会启动采集；请在正式页面手动检查更新。';
      text(byId('update-label'), '正式页检查更新');
    }
    if (profile && isReadonly && !profile.querySelector('.info-preview-note')) {
      const details = profile.querySelector('details');
      details?.querySelector('summary')?.after(paragraph('info-preview-note', '这里可试填条件；未提交正式资料，列表适配仍依据已保存条件。'));
    }
    if (listViews.has(s.view)) document.body.dataset.infoListView = s.view;
    else delete document.body.dataset.infoListView;
  }
  function enhanceList(s) {
    const items = new Map(s.data.items.map(item => [item.id, item]));
    const groupNotes = [
      '公开时间或机制已有依据；本账号和这部作品的资格仍需核对。',
      '处于公告日期范围内；日时、时区或开放状态尚未完整确认。',
      '尚未开始或生效；以条目中的已核时间为准。',
      '开放或规则仍有待核项；缺截止不能视为长期开放。',
      '限制、推广或尽调资料；请先读参与条件与版权风险。',
      '已经结束或属于历史资料；保留规则参考，不能当作当前报名入口。'
    ];
    for (const card of document.querySelectorAll('.opportunity-card[data-id]')) {
      const item = items.get(card.dataset.id);
      if (!item || touchedCards.has(card)) continue;
      touchedCards.add(card);
      if (typeof priorityGroup === 'function') card.dataset.infoPriority = String(priorityGroup(item));
      card.dataset.infoKind = item.kind;
      const star = card.querySelector('[data-star-id]');
      if (star) {
        text(star, item.starred ? '★ 已关注' : '☆ 关注');
        star.title = isReadonly ? '当前关注状态来自正式资料。预览不修改关注，请在正式页保存。' : spaceMode === 'isolated' ? '关注保存到隔离验证副本。' : '关注保存到正式信息库。';
      }
      const caption = card.querySelector('.identity-caption');
      if (caption) caption.title ||= '图片用于辨识；活动状态和奖励以已核文字为准。';
      const reviewedAt = item.public_review?.at || item.verified_at;
      const pending = s.data.changes?.pages?.filter(page => page.linked_items?.some(link => link.id === item.id) && !page.latest_reviews?.some(review => review.item_id === item.id && review.state === 'reviewed')) || [];
      if (reviewedAt || pending.length) {
        const line = document.createElement('div');
        line.className = 'info-verification-line';
        if (reviewedAt) line.append(document.createTextNode('公开条款核验 ' + String(reviewedAt).slice(0, 10)));
        if (pending.length) {
          const action = document.createElement('button');
          action.type = 'button';
          action.className = 'text-button';
          action.textContent = `正文变化 ${pending.length} 项待复核`;
          action.addEventListener('click', () => { if (typeof setView === 'function') setView('changes'); });
          line.append(action);
        }
        card.querySelector('.card-main')?.append(line);
      }
    }
    for (const heading of document.querySelectorAll('#content > .priority-heading')) {
      if (touchedHeadings.has(heading)) continue;
      const next = heading.nextElementSibling;
      const item = next?.matches('.opportunity-card[data-id]') ? items.get(next.dataset.id) : null;
      if (!item || typeof priorityGroup !== 'function') continue;
      touchedHeadings.add(heading);
      const group = priorityGroup(item);
      heading.dataset.infoPriority = String(group);
      const description = document.createElement('span');
      description.className = 'info-priority-note';
      description.textContent = groupNotes[group] || '状态依据原记录；未知仍保留待核。';
      heading.append(description);
    }
  }
  function enhanceDetail(s) {
    const dialog = byId('detail');
    const body = dialog?.querySelector('.dialog-body');
    if (!dialog?.open || !body || dialog.hasAttribute('aria-busy')) return;
    if (isReadonly && !body.querySelector('.info-preview-note')) {
      const note = paragraph('info-preview-note info-detail-readonly', '此处显示正式资料的只读副本。关注、作品准备与笔记保存需要到正式页；这里的试填不会提交。');
      body.querySelector('.detail-primary-actions')?.after(note);
    }
    const note = body.querySelector('.notes');
    const status = byId('note-status');
    const saved = s.data.items.find(item => item.id === s.detailId);
    if (isReadonly && note && saved && status) {
      const dirty = note.value !== saved.note;
      text(status, dirty ? '预览草稿未提交 · 此标签页关闭详情或刷新后可恢复；正式笔记未修改。' : '正在阅读正式资料中的已保存笔记 · 此预览不会修改资料。');
      const save = note.closest('.detail-section')?.querySelector('.save-button');
      text(save, dirty ? '保存请到正式页' : '显示已保存笔记');
      if (save) save.title = '此预览不提交笔记；当前输入仍保留在本标签页。';
    }
  }
  function enhanceChanges(s) {
    if (s.view !== 'changes') return;
    const cards = [...document.querySelectorAll('#content > .change-card')];
    const pages = s.data.changes?.pages || [];
    cards.forEach((card, index) => {
      if (touchedChanges.has(card)) return;
      touchedChanges.add(card);
      const page = pages[index];
      if (page) {
        const linked = page.linked_items || [];
        const reviews = page.latest_reviews || [];
        const reviewed = linked.filter(item => reviews.some(review => review.item_id === item.id && review.state === 'reviewed')).length;
        const status = card.querySelector('small');
        if (linked.length && status) text(status, `${String(page.at).replace('T', ' ')} · 人工复核 ${reviewed}/${linked.length} 条已记录；网页变化仍需与适用规则核对。`);
        const panel = document.createElement('div');
        panel.className = 'info-change-review-links';
        for (const item of linked) {
          const review = reviews.find(value => value.item_id === item.id);
          const action = document.createElement('button');
          action.type = 'button';
          action.className = 'text-button';
          action.textContent = `${item.title} · ${item.edition} · ${review?.state === 'reviewed' ? '人工复核已记录' : '待复核'} →`;
          action.addEventListener('click', () => { if (typeof openDetail === 'function') openDetail(item.id); });
          panel.append(action);
          if (review) panel.append(paragraph('info-change-review-note', '个人复核 ' + String(review.at).slice(0, 10) + '：' + review.note + '；此判断不自动核实或覆盖官方规则。'));
        }
        card.querySelector('pre')?.before(panel);
      } else {
        const version = s.data.changes?.versions?.[index - pages.length];
        if (version?.important_fields?.length) card.querySelector('small')?.after(paragraph('info-change-review-note', '重要字段变化：' + version.important_fields.join('、') + ' · 请核对当前规则与作品准备。'));
      }
    });
  }
  function enhance() {
    const s = currentState();
    if (!s) return;
    labelFilters();
    arrangeTools(s);
    enhanceList(s);
    enhanceDetail(s);
    enhanceChanges(s);
  }
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; enhance(); });
  }
  document.addEventListener('click', event => {
    if (!isReadonly) return;
    const control = event.target.closest('#update,#stop,[data-star-id],.save-button');
    if (!control || control.disabled) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    readonlyFeedback();
  }, true);
  document.addEventListener('input', schedule);
  const observer = new MutationObserver(schedule);
  for (const node of [byId('main'), byId('detail-content')]) if (node) observer.observe(node, {childList:true, subtree:true});
  enhance();
  // Initial data is asynchronous. The DOM observer handles both load and retry.
})();
