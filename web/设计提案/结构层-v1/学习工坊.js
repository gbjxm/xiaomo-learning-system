(function () {
  'use strict';
  const copy = value => JSON.parse(JSON.stringify(value));
  const defaults = {
    version: 1,
    story: { want: '她想在最后一班船离开前，把信送出去。', obstacle: '收信人就在码头，却不肯接过信。', change: '她把信收回口袋，决定当面说出来。' },
    visual: { order: ['door', 'letter', 'person'], note: '' },
    post: { order: ['door', 'letter', 'person'], durations: { door: 3, letter: 2, person: 4 }, sound: 'none', note: '' }
  };
  const shots = {
    door: { name: '门口', color: '#d5e3d7', caption: '一扇半开的门' },
    letter: { name: '信封', color: '#edddc5', caption: '桌上的一封信' },
    person: { name: '人物', color: '#d6dfea', caption: '一个人的反应' }
  };
  const sceneSvg = id => {
    const body = id === 'door'
      ? '<path d="M61 110V26h66v84M69 110V34l49 11v65" fill="#f8f2df"/><path d="M69 34l49 11v65H69Z" fill="#acbea7"/><circle cx="106" cy="78" r="2" fill="#496056"/><path d="M21 111h135M127 70h19"/>'
      : id === 'letter'
        ? '<path d="M21 99h135M36 99l6-16h92l8 16" fill="#b3a188"/><rect x="46" y="53" width="86" height="44" rx="3" fill="#fff8e5" transform="rotate(-6 89 75)"/><path d="M44 59l45 23 41-32M47 97l29-25M133 88l-29-18"/><path d="M83 30l-2-8M104 30l4-7"/>'
        : '<path d="M34 111h116M60 107q1-43 29-43t31 43" fill="#f8f2df"/><ellipse cx="88" cy="46" rx="21" ry="24" fill="#edcba8"/><path d="M67 43q-4-34 28-26 23 6 15 29l-6-14-25-5-12 16" fill="#6a7268"/><path d="M80 47h1M96 47h1M84 58q4 3 9-1M68 96l19-12 21 12"/>';
    return '<svg class="lw-shot-art" viewBox="0 0 180 130" role="img" aria-label="' + shots[id].caption + '"><rect width="180" height="130" rx="12" fill="' + shots[id].color + '"/><g fill="none" stroke="#5c6e65" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' + body + '</g></svg>';
  };
  function cleanDraft(input) {
    const result = copy(defaults);
    if (!input || typeof input !== 'object') return result;
    const validOrder = order => Array.isArray(order) && order.length === 3 && new Set(order).size === 3 && order.every(id => Object.hasOwn(shots, id));
    for (const key of ['want', 'obstacle', 'change']) if (typeof input.story?.[key] === 'string') result.story[key] = input.story[key].slice(0, 1200);
    for (const mode of ['visual', 'post']) {
      if (validOrder(input[mode]?.order)) result[mode].order = [...input[mode].order];
      if (typeof input[mode]?.note === 'string') result[mode].note = input[mode].note.slice(0, 2000);
    }
    for (const id of Object.keys(shots)) {
      const value = Number(input.post?.durations?.[id]);
      if (Number.isFinite(value) && value >= 1 && value <= 8) result.post.durations[id] = value;
    }
    if (['none', 'room', 'sea'].includes(input.post?.sound)) result.post.sound = input.post.sound;
    return result;
  }
  function mount(container, options = {}) {
    if (!(container instanceof Element)) throw new TypeError('LearningWorkshop.mount 需要一个 DOM 容器');
    const mode = ['story', 'visual', 'post'].includes(options.island) ? options.island : 'visual';
    let state = cleanDraft(options.draft);
    let playbackTimer = null;
    let destroyed = false;
    let playing = false;
    const root = document.createElement('section');
    root.className = 'learning-workshop';
    root.dataset.mode = mode;
    root.setAttribute('aria-label', '岛上的小练习');
    container.replaceChildren(root);
    const el = (tag, className, text) => {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = text;
      return node;
    };
    const button = (label, action, className = 'lw-button') => {
      const node = el('button', className, label);
      node.type = 'button'; node.addEventListener('click', action); return node;
    };
    const heading = {
      story: ['故事便签', '给一个小故事，留下一次变化。'],
      visual: ['三张画，换个顺序', '同样的画面，能不能讲出另一层意思？'],
      post: ['剪一段小节奏', '试试把等待拉长，把反应留住。']
    }[mode];
    const header = el('header', 'lw-heading');
    const headingCopy = el('div');
    headingCopy.append(el('span', 'lw-eyebrow', '岛上工坊 · 原创小练习'), el('h3', '', heading[0]), el('p', '', heading[1]));
    const reset = button('复位', () => {
      stopPlayback(); state[mode] = copy(defaults[mode]); renderBody(); notifyChange();
    }, 'lw-text-button');
    header.append(headingCopy, reset);
    const body = el('div', 'lw-body');
    const footer = el('footer', 'lw-footer');
    const status = el('p', 'lw-status', '改一处，试试自己的想法。'); status.setAttribute('aria-live', 'polite');
    const saveButton = button('把这份草稿留在岛上', async () => {
      if (!hasChange() || destroyed || !options.onSave) return;
      const artifact = { version: 1, exercise: mode, ...copy(state[mode]) };
      const summary = mode === 'story'
        ? '想要：' + state.story.want + '\n阻力：' + state.story.obstacle + '\n变化：' + state.story.change
        : state[mode].order.map((id, index) => (index + 1) + '. ' + shots[id].caption + (mode === 'post' ? ' · ' + state.post.durations[id] + ' 秒' : '')).join('\n') + (state[mode].note ? '\n我的想法：' + state[mode].note : '') + (mode === 'post' ? '\n声音意图：' + ({ none: '暂不加声音', room: '室内环境声', sea: '远处海风' }[state.post.sound]) : '');
      saveButton.disabled = true;
      try {
        await options.onSave({ title: heading[0], kind: '练习草稿', summary, artifact, draft: copy(state), island: mode, source: '本页原创练习', next: mode === 'story' ? '再看人物的选择是否真的改变了局面。' : mode === 'visual' ? '对照另一种顺序，观察观众先知道了什么。' : '对照原节奏，看看哪一处停留改变了感受。' });
        if (!destroyed) status.textContent = '这份草稿已交给岛屿。还可以继续改。';
      } catch (error) {
        if (!destroyed) status.textContent = '这次没有留住草稿，可以再试一次。';
      } finally { if (!destroyed) saveButton.disabled = !hasChange(); }
    }, 'lw-save');
    footer.append(status, saveButton); root.append(header, body, footer);
    function hasChange() { return JSON.stringify(state[mode]) !== JSON.stringify(defaults[mode]); }
    function updateSave() {
      saveButton.disabled = !hasChange() || typeof options.onSave !== 'function';
      saveButton.title = hasChange() ? '保留当前文字、顺序和设置' : '先改一处示例，再留下自己的草稿';
    }
    function notifyChange() {
      updateSave(); status.textContent = hasChange() ? '当前是你的草稿，可以留在岛上。' : '还是初始示例，改一处再留下。';
      if (typeof options.onDraft === 'function') options.onDraft(copy(state));
    }
    function stopPlayback() {
      clearTimeout(playbackTimer); playbackTimer = null; playing = false;
      const track = root.querySelector('.lw-timeline');
      if (track) track.classList.remove('is-playing');
      const playButton = root.querySelector('.lw-play');
      if (playButton) playButton.textContent = '▷ 看看节奏';
    }
    function noteField(label, value, setValue) {
      const field = el('label', 'lw-note'); field.append(el('span', '', label));
      const input = el('textarea'); input.rows = 2; input.maxLength = 2000; input.value = value;
      input.placeholder = '一句话就够，也可以先留空。';
      input.addEventListener('input', () => { setValue(input.value); notifyChange(); });
      field.append(input); return field;
    }
    function hint(text) {
      const details = el('details', 'lw-hint'); details.append(el('summary', '', '想要一点提示？'), el('p', '', text)); return details;
    }
    function move(index, offset) {
      const destination = index + offset;
      if (destination < 0 || destination >= 3) return;
      stopPlayback(); const order = state[mode].order;
      [order[index], order[destination]] = [order[destination], order[index]];
      renderBody(); notifyChange();
      body.querySelectorAll('.lw-shot')[destination]?.querySelector('button:not(:disabled)')?.focus();
    }
    function renderBody() {
      body.replaceChildren();
      if (mode === 'story') {
        const stack = el('div', 'lw-story-grid');
        [['want', '01', '想要', '人物此刻想得到什么？'], ['obstacle', '02', '阻力', '是什么，让这件事不容易？'], ['change', '03', '变化', '这一次，她做了怎样的选择？']].forEach(([key, number, name, prompt]) => {
          const card = el('label', 'lw-story-card');
          card.append(el('span', 'lw-number', number), el('strong', '', name), el('span', 'lw-prompt', prompt));
          const input = el('textarea'); input.value = state.story[key]; input.rows = 4; input.maxLength = 1200;
          input.addEventListener('input', () => { state.story[key] = input.value; notifyChange(); }); card.append(input); stack.append(card);
        });
        body.append(stack, hint('不用补出完整世界。先改一个人的选择，再看看阻力和结尾是否随之变化；没有唯一正确答案。'));
      } else {
        const grid = el('div', 'lw-shot-grid');
        state[mode].order.forEach((id, index) => {
          const card = el('article', 'lw-shot');
          const art = el('div', 'lw-art'); art.innerHTML = sceneSvg(id);
          const cap = el('div', 'lw-caption'); cap.append(el('span', 'lw-number', String(index + 1).padStart(2, '0')), el('strong', '', shots[id].name));
          const controls = el('div', 'lw-order');
          const earlier = button('←', () => move(index, -1)); earlier.disabled = index === 0; earlier.setAttribute('aria-label', shots[id].name + '向前移');
          const later = button('→', () => move(index, 1)); later.disabled = index === 2; later.setAttribute('aria-label', shots[id].name + '向后移');
          controls.append(earlier, later); cap.append(controls); card.append(art, cap);
          if (mode === 'post') {
            const rangeLabel = el('label', 'lw-duration'); const durationText = el('span', '', state.post.durations[id] + ' 秒');
            const slider = el('input'); slider.type = 'range'; slider.min = '1'; slider.max = '8'; slider.step = '0.5'; slider.value = state.post.durations[id]; slider.setAttribute('aria-label', shots[id].name + '停留时长');
            slider.addEventListener('input', () => { stopPlayback(); state.post.durations[id] = Number(slider.value); durationText.textContent = slider.value + ' 秒'; renderTimeline(); notifyChange(); });
            rangeLabel.append(slider, durationText); card.append(rangeLabel);
          }
          grid.append(card);
        });
        body.append(grid);
        if (mode === 'post') {
          const preview = el('section', 'lw-preview');
          const track = el('div', 'lw-timeline'); track.setAttribute('aria-label', '静帧节奏示意');
          const playRow = el('div', 'lw-play-row');
          const play = button('▷ 看看节奏', () => {
            if (playing) { stopPlayback(); return; }
            playing = true;
            const total = Object.values(state.post.durations).reduce((a, b) => a + b, 0);
            track.style.setProperty('--lw-duration', total + 's'); track.classList.remove('is-playing'); void track.offsetWidth;
            track.classList.add('is-playing'); play.textContent = 'Ⅱ 停下预览';
            playbackTimer = setTimeout(stopPlayback, total * 1000);
          }, 'lw-play lw-button');
          playRow.append(play, el('span', '', '游标只演示停留节奏，不生成视频或音效。')); preview.append(track, playRow); body.append(preview);
          const sound = el('label', 'lw-sound'); sound.append(el('span', '', '声音意图'));
          const select = el('select');
          [['none', '暂不加声音'], ['room', '室内环境声'], ['sea', '远处海风']].forEach(([value, label]) => { const option = el('option', '', label); option.value = value; select.append(option); });
          select.value = state.post.sound; select.addEventListener('change', () => { state.post.sound = select.value; notifyChange(); }); sound.append(select, el('small', '', '只记意图，不播放声音')); body.append(sound); renderTimeline();
        }
        body.append(noteField(mode === 'visual' ? '换了顺序后，你想让观众先知道什么？' : '你想在哪一刻，让观众多停一下？', state[mode].note, value => { state[mode].note = value; }));
        body.append(hint(mode === 'visual' ? '试试先给人物，再给信封；或者先给信封，再给人物。两种顺序分别让你猜到了什么？这里观察的是你的叙事意图，不做对错评分。' : '先只改变一张画的停留时间，再和原来的 3 / 2 / 4 秒对照。声音选项只是记录想法，不需要买素材或生成新镜头。'));
      }
      updateSave();
    }
    function renderTimeline() {
      const track = root.querySelector('.lw-timeline'); if (!track) return;
      track.replaceChildren();
      state.post.order.forEach(id => { const segment = el('div', 'lw-segment', shots[id].name + ' ' + state.post.durations[id] + 's'); segment.style.flexGrow = state.post.durations[id]; segment.style.backgroundColor = shots[id].color; track.append(segment); });
      track.append(el('i', 'lw-cursor'));
    }
    renderBody();
    return { destroy() { if (destroyed) return; stopPlayback(); destroyed = true; root.remove(); } };
  }
  window.LearningWorkshop = { mount };
})();
