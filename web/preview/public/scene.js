/* 探索总览的独立预览资产。只分发本页导航，不读取或写入业务数据。 */
(function () {
  'use strict';

  let serial = 0;
  const ink = '#647d65';
  const stroke = (d, color = ink, width = 2, fill = 'none') =>
    `<path d="${d}" fill="${fill}" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const translate = (x, y, content, scale = 1) =>
    `<g transform="translate(${x} ${y}) scale(${scale})">${content}</g>`;
  const grass = (x, y) => translate(x, y, stroke('M-11 0-16-9M-3 0-4-13M5 0 12-8', '#8ca276', 1.8));
  const flower = (x, y, color = '#dabbb0') => translate(x, y,
    `${stroke('M0 3V-13M0-2Q-17-12-12-1M0-6Q15-20 13-8', '#98ac8b', 1.5)}` +
    `<circle cy="-17" r="6" fill="${color}"/><circle cy="-17" r="2" fill="#faf3d5"/>`);
  const stones = (x, y, scale = 1) => translate(x, y,
    stroke('M-21 3Q-25-10-11-10Q3-4 0 6Z', '#adb9ab', 1.2, '#cbd4c5') +
    stroke('M7 5Q2-6 17-6Q29 4 20 10Z', '#adb9ab', 1.2, '#dce0cf'), scale);
  const tree = (x, y, scale = 1, color = '#a9c189') => translate(x, y,
    `<ellipse cy="6" rx="30" ry="7" fill="#aab69a" opacity=".15"/>` +
    stroke('M-3 4 0-58 5 4', '#b5a78d', 8) +
    `<g class="scene-leaf">${stroke('M-2-47C-38-27-57-62-34-77C-45-102-18-120 2-103C26-122 47-99 40-80C67-56 34-30 10-48Z', '#829c75', 1.5, color)}` +
    `${stroke('M-23-69Q-6-80 10-80M13-59Q29-67 34-79', '#78926d', 1.5)}</g>`, scale);

  // Clone the existing drawing, then recolor only these preview copies below.
  // Detached temporary scenes cannot dispatch user actions or alter the source.
  function originalArt() {
    if (!window.IslandScenes || typeof window.IslandScenes.mount !== 'function') {
      throw new Error('探索总览需要先加载现有 learning/岛屿场景.js');
    }
    const scratch = document.createElement('div');
    const scenes = [];
    const art = {};
    try {
      scenes.push(window.IslandScenes.mount(scratch, { island: 'home', memories: 0 }));
      for (const [name, place] of Object.entries({
        house: 'plan', shelf: 'courses', screen: 'watch', table: 'practice', board: 'traces', cat: 'cat'
      })) {
        const source = scratch.querySelector(`[data-place="${place}"] .scene-prop`);
        if (!source) throw new Error(`现有小岛画面缺少 ${place}`);
        const copy = source.cloneNode(true);
        copy.setAttribute('class', 'scene-art');
        copy.setAttribute('aria-hidden', 'true');
        art[name] = copy.outerHTML;
      }
      const visual = document.createElement('div');
      scenes.push(window.IslandScenes.mount(visual, { island: 'visual', memories: 0 }));
      const workshop = visual.querySelector('[data-place="desk"] .scene-prop').cloneNode(true);
      workshop.setAttribute('class', 'scene-art');
      workshop.setAttribute('aria-hidden', 'true');
      art.workshop = workshop.outerHTML;
      return art;
    } finally {
      for (const scene of scenes) scene.destroy();
    }
  }

  function shore(d, regionId, label, prefix, captionX, captionY) {
    const hitD = `${d} M${captionX - 130} ${captionY - 26}h260v94h-260Z`;
    return `<g aria-hidden="true" pointer-events="none">` +
      `<path class="scene-shore-water" d="${d}" fill="none" stroke="#b9d0c1" stroke-width="39" opacity=".66"/>` +
      `<path d="${d}" fill="none" stroke="#f5e7c4" stroke-width="23"/>` +
      `<path class="scene-ground" d="${d}" fill="url(#${prefix}-${regionId}-land)" stroke="#a6b392" stroke-width="1.7" filter="url(#${prefix}-ground-shadow)"/></g>` +
      `<path id="region-${regionId}" class="scene-island-hit" data-region="${regionId}" data-inspect-label="${label}" d="${hitD}" fill="transparent" role="button" tabindex="0" aria-label="进入${label}" aria-describedby="placeDescription"><title>进入${label}，也可以探索岛上的具体地点</title></path>` +
      `<path class="scene-region-ring" d="${d}" fill="none" stroke="transparent" stroke-width="4" aria-hidden="true" pointer-events="none"/>`;
  }
  function road(d, width = 19) {
    return stroke(d, '#ece3c8', width) +
      `<path d="${d}" fill="none" stroke="#d3c6a7" stroke-width="1.2" stroke-dasharray="1 10" stroke-linecap="round" opacity=".5"/>`;
  }
  function caption(x, y, title, detail) {
    return `<g class="scene-region-caption" transform="translate(${x} ${y})" aria-hidden="true" pointer-events="none">` +
      `<text class="scene-region-title" text-anchor="middle" fill="#2f493b" font-size="24" font-weight="650" y="0">${title}</text>` +
      `<text class="scene-region-detail" text-anchor="middle" fill="#3d5344" font-size="14" y="27">${detail}</text>` +
      `<g class="scene-region-enter" transform="translate(0 54)">` +
      `<path d="M-33 0H28M22-5 28 0 22 5" fill="none" stroke="#899e89" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>` +
      `</g></g>`;
  }
  function region(id, label, body) {
    return `<g class="scene-region scene-region-${id}" data-region-name="${id}" role="group" aria-label="${label}">${body}</g>`;
  }
  function recolor(art, palette) {
    return art.replace(/#[0-9a-f]{6}/gi, color => palette[color.toLowerCase()] || color);
  }
  function poi(regionId, place, label, x, y, art, scale, prefix, labelY = 58) {
    const bounds = {
      courses: [180, 84], practice: [205, 38], watch: [194, 83],
      collection: [180, 84], research: [228, 113], opportunities: [176, 78], preparation: [205, 38]
    }[place] || [216, 123];
    const width = Math.round(bounds[0] * scale + 18);
    const top = Math.round(-bounds[1] * scale - 10);
    const height = labelY - top + 16;
    // The workshop's roof stays broad, while its lower hit follows the actual
    // wall and label. A rectangular wing here would cover the adjacent shelf.
    const workshopHit = 'M-98-57-45-95H57L98-57H82V40H-82V-57Z M-60 49H60V75H-60Z';
    const hit = place === 'research'
      ? `<path class="scene-poi-hit" d="${workshopHit}" fill="transparent"/><path class="scene-poi-ring" d="${workshopHit}" fill="none" stroke="transparent" stroke-width="2" aria-hidden="true" pointer-events="none"/>`
      : `<rect class="scene-poi-hit" x="${-width / 2}" y="${top}" width="${width}" height="${height}" rx="15" fill="transparent"/><rect class="scene-poi-ring" x="${-width / 2}" y="${top}" width="${width}" height="${height}" rx="15" fill="none" stroke="transparent" stroke-width="2" aria-hidden="true" pointer-events="none"/>`;
    return `<g id="poi-${regionId}-${place}" class="scene-poi scene-poi-${place}" data-place="${place}" data-poi-region="${regionId}" data-inspect-label="${label}" role="button" tabindex="0" aria-label="打开${label}" aria-describedby="placeDescription" transform="translate(${x} ${y})">` +
      `<title>${label}，点击或按回车打开真实功能</title>` +
      hit +
      `<g class="scene-poi-art" transform="scale(${scale})" filter="url(#${prefix}-prop-shadow)" aria-hidden="true" pointer-events="none">${art}</g>` +
      `<g class="scene-poi-label" transform="translate(0 ${labelY})" aria-hidden="true" pointer-events="none">` +
      `<rect x="${-(label.length * 7 + 11)}" y="-17" width="${label.length * 14 + 22}" height="26" rx="13" fill="#fffcf1" fill-opacity=".88" stroke="#91a17f" stroke-opacity=".45"/>` +
      `<text text-anchor="middle" fill="#41583e" font-size="13" font-weight="550" y="1">${label}</text></g></g>`;
  }
  function easel(x, y, scale = 1) {
    return translate(x, y,
      `<ellipse cy="45" rx="40" ry="7" fill="#779587" opacity=".14"/>` +
      stroke('M-24 44-7-63M25 44 9-63M-7-63H9M-30 10H31', '#a38a68', 4) +
      `<rect x="-33" y="-55" width="66" height="62" rx="2" fill="#f7efe0" stroke="#b6a17e" stroke-width="1.7"/>` +
      stroke('M-30 4-5-24 10-7 30-29V4Z', '#91b2a7', 1, '#bed2c2') +
      `<circle cx="17" cy="-37" r="7" fill="#e6c88e"/>`, scale);
  }
  function dock(x, y) {
    return translate(x, y,
      stroke('M0 0H98V30H0Z', '#a89675', 1.5, '#c9b188') +
      [14,30,46,62,78,94].map(value => stroke(`M${value} 1V29`, '#aa9370', 1.2)).join('') +
      stroke('M8-8V37M83-8V37', '#8e8469', 4) +
      stroke('M8-7H83', '#b4a582', 2) +
      `<circle cx="86" cy="17" r="5" fill="#e5d8b5" stroke="#8a9b87" stroke-width="1.5"/>`);
  }
  function definitions(prefix) {
    return `<defs>` +
      `<linearGradient id="${prefix}-learning-land" x1="10%" y1="0%" x2="86%" y2="100%"><stop offset="0" stop-color="#e4ecbe"/><stop offset=".55" stop-color="#d0dfa9"/><stop offset="1" stop-color="#bace9d"/></linearGradient>` +
      `<linearGradient id="${prefix}-observatory-land" x1="15%" y1="0%" x2="85%" y2="100%"><stop offset="0" stop-color="#e8e3c5"/><stop offset=".5" stop-color="#d8ddbe"/><stop offset="1" stop-color="#becdc0"/></linearGradient>` +
      `<linearGradient id="${prefix}-information-land" x1="15%" y1="0%" x2="85%" y2="100%"><stop offset="0" stop-color="#eddfbc"/><stop offset=".55" stop-color="#e2d1a6"/><stop offset="1" stop-color="#c9c59e"/></linearGradient>` +
      `<linearGradient id="${prefix}-window" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0" stop-color="#d7ead5"/><stop offset="1" stop-color="#88b8ae"/></linearGradient>` +
      `<filter id="${prefix}-ground-shadow" x="-25%" y="-25%" width="150%" height="160%"><feDropShadow dx="0" dy="8" stdDeviation="7" flood-color="#426550" flood-opacity=".09"/></filter>` +
      `<filter id="${prefix}-prop-shadow" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="1" dy="4" stdDeviation="2.5" flood-color="#4d6049" flood-opacity=".16"/></filter>` +
      `</defs>`;
  }
  function waves() {
    const positions = [[94,100],[413,111],[732,144],[1335,143],[729,265],[93,609],[631,569],[745,624],[1358,438],[1334,636],[600,60],[99,320],[1371,330]];
    return `<g class="scene-waves" aria-hidden="true">${positions.map(([x, y], index) =>
      translate(x, y, stroke('M-17 0q8 5 17 0t17 0', '#9fbeae', 1.7) +
        (index % 2 ? '' : stroke('M-8 12H9', '#bad0c2', 1.3)))).join('')}</g>`;
  }

  function render(art, titleId, descriptionId, prefix) {
    const learningShore = 'M134 291Q108 230 167 196Q211 124 321 154Q378 111 468 153Q556 146 592 224Q640 276 608 344Q637 414 569 453Q498 501 421 477Q343 521 265 480Q165 484 144 410Q93 357 134 291Z';
    const materialShore = 'M831 223Q815 162 880 131Q941 94 1008 122Q1086 84 1162 131Q1240 128 1273 201Q1306 253 1270 305Q1248 367 1172 362Q1090 393 1018 366Q941 388 881 346Q810 309 831 223Z';
    const informationShore = 'M831 512Q814 446 880 426Q941 389 1022 417Q1100 386 1172 426Q1251 430 1267 490Q1300 548 1256 592Q1224 636 1152 632Q1076 667 1000 636Q920 660 872 616Q815 586 831 512Z';

    const learningArt = Object.fromEntries(Object.entries(art).map(([key, value]) => [key, recolor(value, {
      '#f1e8cc':'#f4dcad', '#b9ba90':'#8ea56d', '#bdcfbd':`url(#${prefix}-window)`,
      '#d7c6a2':'#c9a77c', '#e9dec2':'#f0dfbc', '#d8c7a2':'#c8a477', '#d0d6b6':'#adc4a2',
      '#708775':'#5f7a61', '#c6b58e':'#b59470', '#d7bf95':'#c8a679'
    })]));
    const observatoryArt = Object.fromEntries(Object.entries(art).map(([key, value]) => [key, recolor(value, {
      '#efdfbb':'#eed8b9', '#d5cba0':'#b99c80', '#c9d6be':`url(#${prefix}-window)`,
      '#c6d6c2':'#a5c4b5', '#a7b8a7':'#71988e', '#d7c6a2':'#c4a587', '#e9dec2':'#f3e3c9',
      '#bea5a0':'#b98c80', '#a7b3b0':'#86aaa7', '#d2bd90':'#d2b477', '#a6b891':'#91aa80'
    })]));
    const informationArt = Object.fromEntries(Object.entries(art).map(([key, value]) => [key, recolor(value, {
      '#d2c9a4':'#c3a27b', '#eae3c9':'#fff3d9', '#d8c7a2':'#be9b70', '#f3ead1':'#fff1d4',
      '#d7c6a2':'#b9aa83', '#e9dec2':'#e9ddbe', '#a79f7c':'#927958', '#708775':'#6c7359'
    })]));

    const learning = shore(learningShore, 'learning', '学习小岛', prefix, 372, 451) +
      `<g aria-hidden="true" pointer-events="none">${road('M349 282Q354 340 287 374M351 334Q432 352 470 397M356 335Q459 323 535 291', 22)}` +
      `${tree(160,255,.72)}${tree(266,178,.55)}${tree(591,388,.64)}${grass(236,447)}${grass(539,433)}` +
      `${flower(540,210)}${flower(185,410)}${stones(147,358,.72)}` +
      `${translate(354,270,learningArt.house,1.02)}</g>` +
      poi('learning','courses','课程架',215,343,learningArt.shelf,.66,prefix,50) +
      poi('learning','practice','练习桌',469,367,learningArt.table,.68,prefix,60) +
      poi('learning','watch','海边放映场',541,268,learningArt.screen,.59,prefix,52) +
      caption(372,451,'学习小岛','课程 · 练习 · 看片与歇脚');

    const observatory = shore(materialShore, 'observatory', '素材观察室', prefix, 1056, 339) +
      `<g aria-hidden="true" pointer-events="none">${road('M1051 223Q1046 277 975 288M1050 277Q1118 286 1172 267', 18)}` +
      `${tree(885,199,.62,'#a7bca1')}${tree(1226,194,.52,'#bac6a2')}${tree(1249,315,.56,'#adc2ae')}` +
      `${grass(942,343)}${flower(1153,143,'#cfb6ae')}${stones(858,292,.64)}` +
      `${easel(1185,278,.68)}</g>` +
      poi('observatory','collection','收藏书架',940,270,observatoryArt.shelf,.64,prefix,49) +
      poi('observatory','research','已保存研究工坊',1054,229,observatoryArt.workshop,.79,prefix,66) +
      caption(1056,339,'素材观察室','收藏 · 阅读 · 深入观察');

    const papers = `<g aria-hidden="true" pointer-events="none">` +
      `<rect x="-46" y="-46" width="28" height="39" rx="2" fill="#f9e9c3" stroke="#b99c78" stroke-width="1.2" transform="rotate(-6 -32 -27)"/>` +
      `<rect x="-9" y="-47" width="30" height="40" rx="2" fill="#d6e3cb" stroke="#96ab85" stroke-width="1.2" transform="rotate(4 6 -27)"/>` +
      `<rect x="27" y="-46" width="18" height="38" rx="2" fill="#e8d2c0" stroke="#b99980" stroke-width="1.2"/>` +
      `${stroke('M-39-35h14M-39-27h14M-39-19h10M-3-35h16M-3-27h16M-3-19h11M31-35h10M31-27h10','#8c987d',1.3)}</g>`;
    const information = shore(informationShore, 'information', '信息收集', prefix, 1061, 607) +
      `<g aria-hidden="true" pointer-events="none">${road('M1054 501Q1020 542 940 548M1050 541Q1110 548 1193 530', 18)}` +
      `${tree(896,460,.55,'#b4c19a')}${tree(1224,461,.56,'#bdc293')}${grass(906,597)}` +
      `${flower(1227,598,'#d2b58f')}${stones(840,555,.66)}` +
      `${translate(935,535,informationArt.shelf,.51)}${dock(1260,534)}</g>` +
      poi('information','opportunities','机会告示',1052,481,informationArt.board + papers,1.04,prefix,77) +
      poi('information','preparation','准备书桌',1195,530,informationArt.table,.55,prefix,53) +
      caption(1061,607,'信息收集','机会 · 规则 · 个人准备');

    return `<svg class="discovery-scene-svg" viewBox="0 0 1440 700" preserveAspectRatio="xMidYMid meet" role="group" aria-labelledby="${titleId}" aria-describedby="${descriptionId}" xmlns="http://www.w3.org/2000/svg">` +
      `<title id="${titleId}">小陌的探索海湾：学习小岛、素材观察室、信息收集</title>` +
      `<desc id="${descriptionId}">三处区域可独立进入，七个地点通往已有功能。使用 Tab 选择区域或地点，按回车或空格打开。悬停或聚焦可以查看说明；小猫只在本页和你待一会儿。</desc>` +
      definitions(prefix) +
      waves() +
      `<g class="scene-art scene-sea-details" aria-hidden="true" pointer-events="none">` +
      `${stroke('M78 562Q219 609 372 577M682 72Q787 118 806 194M1336 484Q1381 516 1366 571','#bdd1c3',2)}` +
      `${stroke('M677 390q24 12 44-2M706 411q17 8 31-1', '#c8d9cc', 2)}` +
      `${stones(743,451,1.6)}${grass(729,455)}` +
      `${stroke('M724 520q-14 20-36 27M660 558l-13 7', '#c7d4c2', 1.8)}` +
      `${stroke('M728 301q26-6 33-22M786 263l13-5', '#c7d4c2', 1.8)}</g>` +
      region('learning','学习小岛',learning) +
      region('observatory','素材观察室',observatory) +
      region('information','信息收集',information) +
      `<g class="scene-cat" data-scene-action="cat" transform="translate(749 414) scale(.85)" role="button" tabindex="0" aria-label="和小猫待一会儿">` +
      `<title>和小猫待一会儿，只在当前页面</title>` +
      `<rect class="scene-cat-hit" x="-43" y="-46" width="92" height="90" rx="20" fill="transparent"/>` +
      learningArt.cat + `</g></svg>`;
  }

  function mount(container, options = {}) {
    if (!container || typeof container.appendChild !== 'function') {
      throw new TypeError('DiscoveryScene.mount requires a DOM container');
    }
    const host = document.createElement('div');
    host.className = 'discovery-scene';
    const suffix = ++serial;
    host.innerHTML = render(originalArt(), `discovery-scene-title-${suffix}`, `discovery-scene-description-${suffix}`, `discovery-${suffix}`);
    function targetFor(event) {
      return event.target instanceof Element ? event.target.closest('[data-scene-action], [data-place], [data-region]') : null;
    }
    function inspect(target) {
      if (!target || !host.contains(target) || typeof options.onInspect !== 'function') return;
      if (target.hasAttribute('data-place')) {
        const regionId = target.getAttribute('data-poi-region');
        const place = target.getAttribute('data-place');
        options.onInspect({ region: regionId, place, id: `poi-${regionId}-${place}`, label: target.getAttribute('data-inspect-label') });
      } else if (target.hasAttribute('data-region')) {
        const regionId = target.getAttribute('data-region');
        options.onInspect({ region: regionId, place: 'region', id: `region-${regionId}`, label: target.getAttribute('data-inspect-label') });
      }
    }
    let lastInspection = null;
    function observe(event) {
      const target = targetFor(event);
      if (!target || !host.contains(target) || target === lastInspection) return;
      lastInspection = target;
      inspect(target);
    }
    function leave(event) {
      if (lastInspection && !(event.relatedTarget instanceof Node && lastInspection.contains(event.relatedTarget))) {
        lastInspection = null;
      }
    }
    function activate(event) {
      if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return;
      if (event.type === 'click' && event.button > 0) return;
      const target = targetFor(event);
      if (!target || !host.contains(target)) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.repeat) return;
      if (target.getAttribute('data-scene-action') === 'cat') {
        if (typeof options.onCat === 'function') options.onCat();
      } else if (target.hasAttribute('data-place')) {
        inspect(target);
        if (typeof options.onPlace === 'function') {
          options.onPlace({ region: target.getAttribute('data-poi-region'), place: target.getAttribute('data-place') });
        }
      } else if (typeof options.onRegion === 'function') {
        options.onRegion(target.getAttribute('data-region'));
      }
    }
    host.addEventListener('click', activate);
    host.addEventListener('keydown', activate);
    host.addEventListener('pointerover', observe);
    host.addEventListener('pointerout', leave);
    host.addEventListener('focusin', observe);
    container.appendChild(host);
    return {
      destroy() {
        host.removeEventListener('click', activate);
        host.removeEventListener('keydown', activate);
        host.removeEventListener('pointerover', observe);
        host.removeEventListener('pointerout', leave);
        host.removeEventListener('focusin', observe);
        host.remove();
      }
    };
  }

  window.DiscoveryScene = Object.freeze({ mount });
}());
