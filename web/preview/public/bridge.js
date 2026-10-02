'use strict';
(() => {
  const region=document.body.dataset.previewRegion;if(!region)return;
  const key='xiaomo-exploration-preview-v1';let restoring=true,timer,navigationSerial=0;
  let activeRouteURL=location.pathname+location.search+location.hash;
  let explicitReadingURL=null;
  function load(){try{return JSON.parse(sessionStorage.getItem(key)||'{}');}catch{return{};}}
  function persist(value){try{sessionStorage.setItem(key,JSON.stringify(value));}catch{}}
  function inform(text){const box=document.getElementById('previewFeedback');const host=document.querySelector('dialog[open]')||document.body;if(box.parentElement!==host)host.append(box);box.textContent=text;box.hidden=false;clearTimeout(timer);timer=setTimeout(()=>box.hidden=true,5000);}
  const filters=region==='observatory'?['searchInput','categoryFilter','kindFilter','statusFilter','topicSearch','topicStatus']:region==='information'?['search','platform','status','reward','fit-filter','sort']:[];
  function infoState(){try{return region==='information'&&typeof state==='object'&&state?.data?state:null;}catch{return null;}}
  function disclosureNodes(container){
    const seen=new Map();return [...(container?.querySelectorAll('details')||[])].map(node=>{
      const title=node.querySelector(':scope > summary')?.textContent.trim().slice(0,240)||'';
      const ordinal=seen.get(title)||0;seen.set(title,ordinal+1);
      return {node,key:node.id?'id:'+node.id:'summary:'+title+':'+ordinal};
    });
  }
  function readingState(){
    const savedNodes=container=>disclosureNodes(container).map(({node,key})=>({key,open:node.open}));
    if(region==='information'){const current=infoState();return {mainView:current?.view,detailId:current?.detailId,mainDisclosures:savedNodes(document.getElementById('main')),detailDisclosures:savedNodes(document.getElementById('detail-content'))};}
    return {stageVersion:region==='observatory'?document.getElementById('stageVersion')?.value??null:null,disclosures:savedNodes(document.getElementById('main'))};
  }
  function restoreReading(record){
    if(!record)return;
    if(region==='observatory'&&record.stageVersion!==null){
      const select=document.getElementById('stageVersion');
      if(select&&[...select.options].some(option=>option.value===record.stageVersion)&&select.value!==record.stageVersion){
        select.value=record.stageVersion;select.dispatchEvent(new Event('change',{bubbles:true}));
      }
    }
    function apply(container,values){const wanted=new Map((values||[]).map(entry=>[entry.key,entry.open]));for(const {node,key} of disclosureNodes(container))if(wanted.has(key))node.open=wanted.get(key);}
    if(region==='information'){const current=infoState();if(record.mainView===current?.view)apply(document.getElementById('main'),record.mainDisclosures);if(record.detailId===current?.detailId)apply(document.getElementById('detail-content'),record.detailDisclosures);}
    else apply(document.getElementById('main'),record.disclosures);
  }
  function revealRouteTarget(url){
    const hash=new URL(url,location.href).hash,match=/^#topic\/[^/]+\/(source|paragraph|section)\/([^/]+)$/.exec(hash);if(!match)return false;
    let id;try{id=decodeURIComponent(match[2]);}catch{return false;}
    const target=document.getElementById(match[1]==='source'?'source-'+id:match[1]==='paragraph'?'paragraph-'+id:id);
    if(!target||!document.getElementById('main')?.contains(target))return false;
    for(let node=target;node&&node!==document.getElementById('main');node=node.parentElement)if(node.tagName==='DETAILS')node.open=true;
    target.classList.add('highlight');if(!target.hasAttribute('tabindex'))target.setAttribute('tabindex','-1');target.focus({preventScroll:true});target.scrollIntoView({behavior:'instant',block:'start'});return true;
  }
  function capture(){if(restoring)return;const saved=load(),previous=saved.regions?.[region]||{};const values={...previous.filters};for(const id of filters){const input=document.getElementById(id);if(input)values[id]=input.value;}const information=infoState(),detail=document.getElementById('detail');const focus=document.activeElement;const record={url:region==='observatory'?activeRouteURL:location.pathname+location.search+location.hash,scrollY:information?.detailContext?.scroll??window.scrollY,filters:values,focus:focus?.id||'',detailId:information?.detailId??null,detailScroll:detail?.open?detail.scrollTop:0,view:information?.view??null,toolsClosed:document.body.classList.contains('preview-tools-closed'),reading:region==='learning'?null:readingState()};saved.lastRegion=region;saved.regions={...saved.regions,[region]:record};if(region==='observatory'){const routes={...saved.observatoryRoutes};delete routes[record.url];routes[record.url]=record;saved.observatoryRoutes=Object.fromEntries(Object.entries(routes).slice(-40));}persist(saved);}
  const atLoad=load(),retained=(region==='observatory'?atLoad.observatoryRoutes?.[activeRouteURL]:null)||atLoad.regions?.[region];
  // A scene place is an explicit entry action, consumed once after the original page is ready.
  const entryURL=new URL(location.href);
  const requestedPlace=region==='learning'&&['courses','practice','watch'].includes(entryURL.searchParams.get('preview-place'))?entryURL.searchParams.get('preview-place'):null;
  const requestedView=region==='information'&&['opportunities','works'].includes(entryURL.searchParams.get('preview-view'))?entryURL.searchParams.get('preview-view'):null;
  function applyEntry(){
    let parameter=null;
    if(requestedPlace){
      if(typeof openPlace!=='function')throw new Error('原课程与练习入口尚未就绪');
      if(typeof state==='object'&&state.overview&&typeof visit==='function')visit(state.current);
      openPlace(requestedPlace);parameter='preview-place';
    }else if(requestedView){
      if(!infoState()||typeof setView!=='function')throw new Error('原作品与机会入口尚未就绪');
      setView(requestedView);parameter='preview-view';
    }
    if(parameter){const url=new URL(location.href);url.searchParams.delete(parameter);history.replaceState(history.state,'',url.pathname+url.search+url.hash);}
  }
  function applyFilters(values=load().regions?.[region]?.filters||retained?.filters){if(!values)return;for(const [id,value] of Object.entries(values)){const input=document.getElementById(id);if(input&&input.value!==value){input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));}}}
  async function restore(){
    const serial=navigationSerial;
    const deadline=Date.now()+8000;
    while(Date.now()<deadline){
      const ready=region==='learning' ? !!window.learningIsland?.version()?.identity && !document.getElementById('shell').inert
        : region==='observatory' ? !!document.querySelector('.material-row,.material-original,.long-reader,.topic-top,#searchInput,#topicRows,#topicSearch') : !!infoState()&&(!['opportunities','starred','archive'].includes(infoState().view)||!!document.getElementById('info-reading-tools')&&!!document.getElementById('info-library-meta'));
      if(ready)break;
      await new Promise(resolve=>setTimeout(resolve,80));
    }
    if(serial!==navigationSerial)return;
    if(retained){
      applyFilters();
      const sameTarget=!requestedPlace&&!requestedView&&retained.url===location.pathname+location.search+location.hash;
      const information=infoState();
      if(sameTarget && information && retained.view && typeof setView==='function' && retained.view!==information.view)setView(retained.view);
      if(sameTarget && information && retained.detailId && typeof openDetail==='function'){document.querySelector(`.opportunity-card[data-id="${CSS.escape(retained.detailId)}"] .card-title`)?.focus({preventScroll:true});await openDetail(retained.detailId);}
      if(serial!==navigationSerial)return;
      if(sameTarget)restoreReading(retained.reading);
      if(retained.toolsClosed && region!=='learning')document.body.classList.add('preview-tools-closed');
      await new Promise(resolve=>setTimeout(resolve,180));
      if(serial!==navigationSerial)return;
      if(sameTarget){
        window.scrollTo(0,retained.scrollY||0);
        const dialog=document.getElementById('detail');
        if(dialog?.open)dialog.scrollTop=retained.detailScroll||0;
        if(retained.focus)document.getElementById(retained.focus)?.focus({preventScroll:true});
      }
    }
    applyEntry();updateFormal();restoring=false;updateTools();capture();
  }
  function updateFormal(){const anchor=document.getElementById('previewFormal');anchor.href='http://127.0.0.1:8787'+location.pathname+location.hash;}
  function updateTools(){const button=document.getElementById('previewTools');const open=region==='learning'?!document.getElementById('learningPanel')?.hidden:!document.body.classList.contains('preview-tools-closed');button.setAttribute('aria-expanded',String(open));button.textContent=region==='learning'?(open?'收起向导':'展开向导'):(open?'收起导航':'展开导航');}
  document.getElementById('previewTools').addEventListener('click',()=>{if(region==='learning'){const panel=document.getElementById('learningPanel');document.getElementById(panel.hidden?'reopenPanel':'collapsePanel')?.click();}else document.body.classList.toggle('preview-tools-closed');updateTools();capture();});
  for(const link of document.querySelectorAll('[data-preview-region-link]')){const saved=load().regions?.[link.dataset.previewRegionLink];if(saved?.url&&saved.url.startsWith('/'+link.dataset.previewRegionLink+'/'))link.href=saved.url;}
  document.addEventListener('click',event=>{const link=event.target.closest('a');if(link&&(link.closest('.preview-header,.preview-dialog-nav')||(region==='observatory'&&link.getAttribute('href')?.startsWith('#'))))capture();if(region==='observatory'&&event.button===0&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&!event.altKey&&(!link?.target||link.target==='_self')&&/^#topic\/[^/]+\/(source|paragraph|section)\//.test(link?.getAttribute('href')||'')){const targetURL=new URL(link.getAttribute('href'),location.href);explicitReadingURL=targetURL.pathname+targetURL.search+targetURL.hash;if(explicitReadingURL===activeRouteURL)setTimeout(()=>{if(explicitReadingURL===activeRouteURL){revealRouteTarget(explicitReadingURL);explicitReadingURL=null;capture();}},140);}const write=event.target.closest('#update,#stop,#backupButton,[type="submit"]');if(write&&region!=='learning'){event.preventDefault();event.stopImmediatePropagation();inform('界面预览保留当前输入，未写正式资料。保存请打开右上角“正式使用”。');}},true);
  document.addEventListener('submit',event=>{if(region==='learning')return;if(['filterForm','topicFilterForm'].includes(event.target.id))return;event.preventDefault();event.stopImmediatePropagation();inform('这份输入尚未提交。请在正式页面保存，预览不会修改资料。');},true);
  addEventListener('scroll',()=>{clearTimeout(window.__previewScrollTimer);window.__previewScrollTimer=setTimeout(capture,100);},{passive:true});
  function acceptNewInput(event){if(restoring&&event.isTrusted){++navigationSerial;restoring=false;updateTools();}if(!restoring)capture();}
  document.addEventListener('input',acceptNewInput);
  document.addEventListener('focusin',()=>{if(!restoring)capture();});
  document.addEventListener('keydown',event=>{if(event.altKey&&['ArrowLeft','ArrowRight'].includes(event.key))capture();});
  document.addEventListener('change',event=>{acceptNewInput(event);if(!restoring)setTimeout(capture,80);});
  document.addEventListener('toggle',()=>{if(!restoring)setTimeout(capture,80);},true);
  addEventListener('pagehide',capture);
  addEventListener('hashchange',()=>{
    updateFormal();
    if(region==='observatory'){
      const destination=location.pathname+location.search+location.hash,serial=++navigationSerial;
      const explicitTarget=explicitReadingURL===destination;explicitReadingURL=null;
      const saved=load(),remembered=saved.observatoryRoutes?.[destination];
      const rememberedFilters=remembered?.filters||saved.regions?.[region]?.filters;
      restoring=true;activeRouteURL=destination;
      clearTimeout(window.__previewCaptureTimer);clearTimeout(window.__previewScrollTimer);
      (async()=>{
        await new Promise(resolve=>setTimeout(resolve,100));if(serial!==navigationSerial)return;
        applyFilters(rememberedFilters);if(remembered)restoreReading(remembered.reading);
        await new Promise(resolve=>setTimeout(resolve,140));if(serial!==navigationSerial)return;
        const revealed=explicitTarget&&revealRouteTarget(destination);
        if(remembered&&!revealed)window.scrollTo(0,remembered.scrollY||0);
        const target=(remembered?.focus&&document.getElementById(remembered.focus))||document.querySelector('#main .highlight,#main h1');
        if(target&&!revealed){if(!target.hasAttribute('tabindex')&&!target.matches('a,button,input,select,textarea'))target.setAttribute('tabindex','-1');target.focus({preventScroll:true});}
        restoring=false;capture();
      })().catch(()=>{if(serial===navigationSerial){restoring=false;capture();}});
    }else setTimeout(capture,100);
  });
  if(region==='information'){const nav=document.querySelector('.sidebar nav');const heading=document.createElement('div');heading.className='preview-nav-section';heading.textContent='核验与维护';nav?.querySelector('[data-view="discoveries"]')?.before(heading);const caption=document.querySelector('.nav-caption');if(caption)caption.textContent='浏览与准备';}
  if(region==='information'){const content=document.getElementById('detail-content');function dialogNavigation(){if(!content||!document.getElementById('detail')?.open||content.querySelector('.preview-dialog-nav'))return;const nav=document.createElement('nav');nav.className='preview-dialog-nav';nav.setAttribute('aria-label','从当前机会返回个人空间');for(const [href,label] of [['/preview/','← 自由探索'],['/learning/','学习小岛'],['/observatory/','素材观察室']]){const link=document.createElement('a');link.href=href;link.textContent=label;nav.append(link);}content.prepend(nav);}const detailObserver=new MutationObserver(()=>{dialogNavigation();if(!restoring){clearTimeout(window.__previewDetailTimer);window.__previewDetailTimer=setTimeout(capture,140);}});if(content)detailObserver.observe(content,{childList:true,subtree:true});}
  let collectionForm=document.getElementById('filterForm');
  let topicForm=document.getElementById('topicFilterForm');
  const observer=new MutationObserver(()=>{
    if(region==='observatory'){
      const currentForm=document.getElementById('filterForm');
      if(currentForm && currentForm!==collectionForm){collectionForm=currentForm;applyFilters();}
      else if(!currentForm)collectionForm=null;
      const currentTopicForm=document.getElementById('topicFilterForm');
      if(currentTopicForm && currentTopicForm!==topicForm){topicForm=currentTopicForm;applyFilters();}
      else if(!currentTopicForm)topicForm=null;
    }
    updateTools();
    if(!restoring){clearTimeout(window.__previewCaptureTimer);window.__previewCaptureTimer=setTimeout(capture,140);}
  });
  observer.observe(document.querySelector(region==='learning'?'#shell':'#main')||document.body,{childList:true,subtree:true});
  updateFormal();restore().catch(()=>{restoring=false;inform('原页面已打开；上次位置未完全恢复，可继续浏览。');});
})();
