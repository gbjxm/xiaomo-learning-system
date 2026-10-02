(() => {
  'use strict';

  const views = new Set(['home', 'chat', 'trail']);
  const themeKey = 'xiaomo-learning-island-appearance';
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const pointerQuery = window.matchMedia('(pointer: fine)');
  const themeToggle = document.getElementById('themeToggle');
  const cat = document.getElementById('catCompanion');
  const catSpeech = document.getElementById('catSpeech');
  const restDialog = document.getElementById('restDialog');
  const scene = document.getElementById('islandScene') || document.querySelector('[data-parallax-scene]');
  let catLine = 0;
  let petTimer;
  let pointerFrame;

  function showView(view) {
    const selectedView = views.has(view) ? view : 'home';
    document.body.dataset.view = selectedView;
    document.querySelectorAll('[data-panel]').forEach((panel) => {
      panel.hidden = panel.dataset.panel !== selectedView;
    });
    document.querySelectorAll('[data-view]').forEach((button) => {
      const selected = button.dataset.view === selectedView;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-selected', String(selected));
      if (selected) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
  }

  function setTheme(theme, persist = false) {
    const selectedTheme = theme === 'dusk' ? 'dusk' : 'day';
    document.body.dataset.theme = selectedTheme;
    if (themeToggle) {
      const label = selectedTheme === 'day' ? '切换到暮色' : '切换到日光';
      themeToggle.setAttribute('aria-label', label);
      themeToggle.setAttribute('title', label);
      themeToggle.setAttribute('aria-pressed', String(selectedTheme === 'dusk'));
      const text = themeToggle.querySelector('[data-theme-label]');
      if (text) text.textContent = label;
    }
    if (persist) {
      try { localStorage.setItem(themeKey, selectedTheme); } catch { /* Appearance still works when storage is unavailable. */ }
    }
  }

  window.learningIsland = { showView };
  document.querySelectorAll('[data-view]').forEach((button) => {
    button.addEventListener('click', () => showView(button.dataset.view));
  });
  themeToggle?.addEventListener('click', () => {
    setTheme(document.body.dataset.theme === 'day' ? 'dusk' : 'day', true);
  });

  const catLines = [
    '喵，今天也一起慢慢来。',
    '想发会儿呆的话，我陪你。',
    '一小块喜欢的内容，就可以开始了。',
    '云走得很慢，我们也不用着急。',
    '欢迎回来，这里一直留着你的座位。'
  ];
  cat?.addEventListener('click', () => {
    if (catSpeech) {
      catSpeech.textContent = catLines[catLine % catLines.length];
      catSpeech.hidden = false;
      catLine += 1;
    }
    clearTimeout(petTimer);
    cat.classList.remove('is-petted');
    if (!motionQuery.matches) {
      // Restart a short response animation even on repeated clicks.
      void cat.offsetWidth;
      cat.classList.add('is-petted');
      petTimer = setTimeout(() => cat.classList.remove('is-petted'), 700);
    }
  });

  document.getElementById('restButton')?.addEventListener('click', () => {
    if (restDialog && !restDialog.open) restDialog.showModal();
  });
  document.getElementById('closeRest')?.addEventListener('click', () => restDialog?.close());
  restDialog?.addEventListener('click', (event) => {
    if (event.target === restDialog) restDialog.close();
  });

  function resetPointer() {
    cancelAnimationFrame(pointerFrame);
    scene?.style.setProperty('--pointer-x', '0px');
    scene?.style.setProperty('--pointer-y', '0px');
  }

  scene?.addEventListener('pointermove', (event) => {
    if (motionQuery.matches || !pointerQuery.matches || event.pointerType === 'touch') return;
    const bounds = scene.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 14;
    const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 10;
    cancelAnimationFrame(pointerFrame);
    pointerFrame = requestAnimationFrame(() => {
      scene.style.setProperty('--pointer-x', `${x.toFixed(2)}px`);
      scene.style.setProperty('--pointer-y', `${y.toFixed(2)}px`);
    });
  });
  scene?.addEventListener('pointerleave', resetPointer);
  motionQuery.addEventListener('change', resetPointer);
  pointerQuery.addEventListener('change', resetPointer);

  let savedTheme = 'day';
  try { savedTheme = localStorage.getItem(themeKey) || 'day'; } catch { /* Use daylight. */ }
  setTheme(savedTheme);
  showView('home');
})();
