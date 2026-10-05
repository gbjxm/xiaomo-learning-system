'use strict';
(async () => {
  const daily=['production','isolated'].includes(document.body.dataset.spaceMode);
  const key = daily?'xiaomo-daily-navigation-v1':'xiaomo-exploration-preview-v1', $ = id => document.getElementById(id);
  if(daily){try{const r=await fetch('/api/workspace/bootstrap',{cache:'no-store'}),b=await r.json();if(r.ok&&b.ok)sessionStorage.setItem(key,JSON.stringify(b.data.state));}catch{}}
  function dailyURL(value){if(!daily)return value;const u=new URL(value,location.origin);u.searchParams.set('space','daily');return u.pathname+u.search+u.hash;}
  const names = {learning:'学习小岛', observatory:'素材观察室', information:'信息收集'};
  const places = {
    learning: {
      region: {title:'学习小岛', text:'四座岛上有课程、练习和看片角。直接进入，会回到上次停留的地方。', action:'去学习小岛'},
      courses: {title:'课程架', text:'翻看已在学的课程与材料，再选一份接着看。这里保留原四岛的课程入口。', action:'打开课程架', url:'/learning/?preview-place=courses'},
      practice: {title:'练习桌', text:'把所学试一小下，打开当前小岛的练习工坊。预览中的草稿留在本标签页。', action:'打开练习桌', url:'/learning/?preview-place=practice'},
      watch: {title:'放映角', text:'用自己的播放器看片，这里留一个观看角度和可选笔记；也可以只欣赏。', action:'打开看片角', url:'/learning/?preview-place=watch'}
    },
    observatory: {
      region: {title:'素材观察室', text:'翻看收藏，展开原件与完整研究。直接进入，会回到上次看的位置。', action:'去素材观察室'},
      collection: {title:'收藏架', text:'查找已保存的链接、文字和文件。展开素材后，原件、来源与自己的感受各自保留。', action:'翻开收藏', url:'/observatory/#collection'},
      research: {title:'研究台', text:'打开已有研究专题，查看问题、阶段记录和完整成果。浏览不会开始新的研究。', action:'查看已有研究', url:'/observatory/#topics'}
    },
    information: {
      region: {title:'信息收集', text:'查看创作机会、正式规则和自己的准备单。直接进入，会回到上次停留的地方。', action:'去信息收集'},
      opportunities: {title:'机会公告', text:'查看已保存的比赛与激励计划，按门槛、奖励和时间筛选，再展开官方规则。', action:'翻看机会', url:'/information/?preview-view=opportunities'},
      preparation: {title:'准备桌', text:'打开作品档案与机会准备清单。资格和材料由自己核对，这里不会执行投稿。', action:'打开作品与准备', url:'/information/?preview-view=works'}
    }
  };
  if(daily)places.learning.practice.text='把所学试一小下，打开当前小岛的练习工坊。草稿保存在本机；实际学习进展仍以项目记录为准。';
  function read(){try{return JSON.parse(sessionStorage.getItem(key)||'{}');}catch{return{};}}
  function store(value){try{sessionStorage.setItem(key,JSON.stringify(value));}catch{}}
  function rememberScene(region, place='region') {
    const saved=read(); saved.lastRegion=region; saved.sceneInspect={region,place};
    saved.sceneFocus=place==='region' ? 'region-'+region : 'poi-'+region+'-'+place;
    store(saved);
  }
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let userStill=read().still===true;
  function motion(){
    const still=userStill||reduced.matches;
    document.body.classList.toggle('preview-still',still);
    $('motionToggle').textContent=reduced.matches?'动效：随系统关闭':still?'动效：关':'动效：开';
    $('motionToggle').setAttribute('aria-pressed',String(!still));
    $('motionToggle').title=reduced.matches?'系统已启用减少动态效果；预览跟随此设置':'切换轻微水波和树叶动效';
  }
  motion();
  $('motionToggle').addEventListener('click',()=>{userStill=!userStill;const saved=read();saved.still=userStill;store(saved);motion();});
  reduced.addEventListener('change',motion);
  function regionURL(region){
    const destination=read().regions?.[region]?.url;
    try{const url=new URL(destination||'/'+region+'/',location.origin);if(url.origin===location.origin&&url.pathname.startsWith('/'+region+'/'))return dailyURL(url.pathname+url.search+url.hash);}catch{}
    return dailyURL('/'+region+'/');
  }
  function enter(region){if(!names[region])return;rememberScene(region);location.assign(regionURL(region));}
  function enterPlace({region,place}){const item=places[region]?.[place];if(!item?.url)return;rememberScene(region,place);location.assign(dailyURL(item.url));}
  let inspected=null, summary=null;
  function description(region,place,item){
    let prefix='';
    if(region==='observatory'&&(place==='collection'||place==='region')&&Number.isInteger(summary?.materials))prefix='已收藏 '+summary.materials+' 条素材。';
    if(region==='information'&&(place==='opportunities'||place==='region')&&Number.isInteger(summary?.opportunities))prefix='已保存 '+summary.opportunities+' 条机会。';
    return prefix+item.text;
  }
  function showInspect({region,place='region'}){
    const item=places[region]?.[place];if(!item)return;
    const identity=region+'/'+place;
    if(inspected?.identity===identity&&inspected.summary===summary)return;
    inspected={region,place,identity,summary};
    const dock=$('placePreview');dock.dataset.region=region;dock.dataset.place=place;
    $('placeRegion').textContent=names[region];$('placeTitle').textContent=item.title;
    $('placeDescription').textContent=description(region,place,item);
    const link=$('placeOpen');link.hidden=false;link.textContent=item.action+' →';link.href=dailyURL(item.url||regionURL(region));
    link.dataset.destinationRegion=region;link.dataset.destinationPlace=place;
    const saved=read();saved.sceneInspect={region,place};store(saved);
  }
  window.DiscoveryScene.mount($('discoveryScene'),{
    onRegion:enter, onPlace:enterPlace, onInspect:showInspect,
    onCat:()=>{$('sceneNote').textContent='小猫在这儿陪你走走。课程架、收藏架和公告都可以直接打开。';}
  });
  for(const link of document.querySelectorAll('a[data-region]'))link.addEventListener('click',event=>{
    if(event.button===0&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey){event.preventDefault();enter(link.dataset.region);}
  });
  $('placeOpen').addEventListener('click',event=>{
    const {destinationRegion:region,destinationPlace:place}=event.currentTarget.dataset;
    if(!names[region])return;
    if(event.button===0&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey){event.preventDefault();place==='region'?enter(region):enterPlace({region,place});}
  });
  $('entryToggle').addEventListener('click',()=>{
    const open=$('textEntries').hidden;$('textEntries').hidden=!open;
    $('entryToggle').setAttribute('aria-expanded',String(open));
    if(open)$('textEntries').querySelector('a').focus();
  });
  addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('textEntries').hidden){$('textEntries').hidden=true;$('entryToggle').setAttribute('aria-expanded','false');$('entryToggle').focus();}});
  const saved=read();
  if(saved.sceneInspect)showInspect(saved.sceneInspect);
  if(saved.sceneFocus||saved.lastRegion)requestAnimationFrame(()=>{
    const focus=saved.sceneFocus?document.getElementById(saved.sceneFocus):document.querySelector('a[data-region="'+saved.lastRegion+'"]');
    focus?.focus({preventScroll:true});
  });
  fetch(daily?'/api/workspace/summary':'/preview/api/summary',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('summary unavailable');return r.json();}).then(result=>{
    summary=result;
    $('savedSummary').textContent=[Number.isInteger(result.materials)?'收藏 '+result.materials+' 条':null,Number.isInteger(result.opportunities)?'已保存机会 '+result.opportunities+' 条':null].filter(Boolean).join(' · ')||'正式资料在各自区域中保留';
    if(inspected)showInspect(inspected);
  }).catch(()=>{$('savedSummary').textContent='打开区域，查看已保存的资料';});
})();
