'use strict';
(async () => {
  const region=document.body.dataset.previewRegion;if(!region)return;let resolveNavigationReady;window.workspaceNavigationReady=new Promise(resolve=>{resolveNavigationReady=resolve;});
  const readonly=(document.body.dataset.spaceMode||'readonly')==='readonly';
  if(!readonly&&region==='learning'){const previous=new URL(location.href);if(previous.searchParams.has('relation-view')){previous.searchParams.delete('relation-view');history.replaceState(history.state,'',previous.pathname+previous.search+previous.hash);}}
  const key=readonly?'xiaomo-exploration-preview-v1':'xiaomo-daily-navigation-v1';let restoring=true,timer,navigationSerial=0;
  let workspace=null,saveTimer,writing=false,dirty=false,blocked=false,lastStored='';
  let earlyInteracted=false;document.addEventListener('input',event=>{if(event.isTrusted)earlyInteracted=true;},true);
  if(!readonly){try{const r=await fetch('/api/workspace/bootstrap',{cache:'no-store'});const b=await r.json();if(!r.ok||!b.ok)throw new Error(b.error?.message||'未读取到工作台');workspace=b.data;sessionStorage.setItem(key,JSON.stringify(workspace.state));lastStored=JSON.stringify(workspace.state);}catch(e){blocked=true;setTimeout(()=>inform('阅读位置暂不能保存：'+e.message),100);}}
  let activeRouteURL=location.pathname+location.search+location.hash;
  let explicitReadingURL=null;
  function load(){try{return JSON.parse(sessionStorage.getItem(key)||'{}');}catch{return{};}}
  function persist(value){try{sessionStorage.setItem(key,JSON.stringify(value));}catch{}if(!readonly&&!blocked){dirty=true;clearTimeout(saveTimer);saveTimer=setTimeout(saveNavigation,350);}}
  async function saveNavigation(){
    if(readonly||blocked||writing||!workspace||!dirty)return;const v=load();const state={lastRegion:v.lastRegion??null,regions:v.regions??{},recent:v.recent??[],observatoryRoutes:v.observatoryRoutes??{}};
    const serialized=JSON.stringify(state);dirty=false;if(serialized===lastStored)return;writing=true;
    try{const r=await fetch('/api/workspace/state',{method:'POST',headers:{'Content-Type':'application/json','X-Workspace-Token':workspace.token},body:JSON.stringify({identity:workspace.identity,expectedRevision:workspace.stateRevision,state}),keepalive:serialized.length<55000});const b=await r.json();if(!r.ok||!b.ok)throw new Error(b.error?.message||'保存未确认');workspace.stateRevision=b.data.stateRevision;lastStored=serialized;}
    catch(e){blocked=true;inform('阅读位置保存未确认，当前页面位置保留：'+e.message);}
    finally{writing=false;if(dirty&&!blocked)saveTimer=setTimeout(saveNavigation,350);}
  }
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
  // BEGIN OBSERVATORY_STAGE_RESTORE_HELPERS
  function savedStageVersion(value,count){
    const index=Number(value);
    return Number.isSafeInteger(count)&&count>0&&Number.isSafeInteger(index)&&index>=0&&index<count?JSON.stringify({index,count}):null;
  }
  function restoredStageVersion(value,count,preserveStage=false){
    if(preserveStage||!Number.isSafeInteger(count)||count<1)return null;
    let saved;try{saved=JSON.parse(value);}catch{}
    if(saved&&typeof saved==='object'&&!Array.isArray(saved)&&Object.keys(saved).sort().join(',')==='count,index'&&Number.isSafeInteger(saved.count)&&saved.count>0&&Number.isSafeInteger(saved.index)&&saved.index>=0&&saved.index<saved.count){
      if(saved.count===count||saved.count<count&&saved.index<saved.count-1)return String(saved.index);
    }
    // Older index-only positions cannot tell a former latest stage from an
    // intentional historical choice after new research has been appended.
    return String(count-1);
  }
  function sameTopicReadingRoute(previous,destination){
    const topic=url=>{try{return /^#topic\/([^/]+)(?:\/|$)/.exec(new URL(url,'http://127.0.0.1').hash)?.[1]||null;}catch{return null;}};
    const before=topic(previous);return before!==null&&before===topic(destination);
  }
  // END OBSERVATORY_STAGE_RESTORE_HELPERS
  function readingState(){
    const savedNodes=container=>disclosureNodes(container).map(({node,key})=>({key,open:node.open}));
    if(region==='information'){const current=infoState();return {mainView:current?.view,detailId:current?.detailId,mainDisclosures:savedNodes(document.getElementById('main')),detailDisclosures:savedNodes(document.getElementById('detail-content'))};}
    const select=region==='observatory'?document.getElementById('stageVersion'):null;
    return {stageVersion:select?savedStageVersion(select.value,select.options.length):null,disclosures:savedNodes(document.getElementById('main'))};
  }
  function restoreReading(record,{preserveStage=false}={}){
    if(!record)return;
    if(region==='observatory'&&record.stageVersion!==null){
      const select=document.getElementById('stageVersion');
      const wanted=select?restoredStageVersion(record.stageVersion,select.options.length,preserveStage):null;
      if(select&&wanted!==null&&[...select.options].some(option=>option.value===wanted)&&select.value!==wanted){
        select.value=wanted;select.dispatchEvent(new Event('change',{bubbles:true}));
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
  function capture(force=false){if(restoring&&!force)return;const saved=load(),previous=saved.regions?.[region]||{};const values={...previous.filters};for(const id of filters){const input=document.getElementById(id);if(input)values[id]=input.value;}const information=infoState(),detail=document.getElementById('detail');const focus=document.activeElement;const record={url:region==='observatory'?activeRouteURL:location.pathname+location.search+location.hash,scrollY:information?.detailContext?.scroll??window.scrollY,filters:values,focus:focus?.id||'',detailId:information?.detailId??null,detailScroll:detail?.open?detail.scrollTop:0,view:information?.view??null,toolsClosed:document.body.classList.contains('preview-tools-closed'),reading:region==='learning'?null:readingState()};saved.lastRegion=region;saved.regions={...saved.regions,[region]:record};if(region==='observatory'){const routes={...saved.observatoryRoutes};delete routes[record.url];routes[record.url]=record;saved.observatoryRoutes=Object.fromEntries(Object.entries(routes).slice(-40));}persist(saved);}
  async function flushNavigation(){
    if(readonly||!workspace)return true;
    ++navigationSerial;restoring=false;activeRouteURL=location.pathname+location.search+location.hash;
    clearTimeout(window.__previewCaptureTimer);clearTimeout(window.__previewScrollTimer);clearTimeout(saveTimer);
    capture(true);clearTimeout(saveTimer);
    const deadline=Date.now()+2500;
    while(!blocked&&(writing||dirty)&&Date.now()<deadline){
      if(writing)await new Promise(resolve=>setTimeout(resolve,25));else await saveNavigation();
    }
    const saved=!blocked&&!writing&&!dirty;
    if(!saved)inform('最后的阅读位置还没确认保存，请先核对提示；当前页面继续保留。');
    return saved;
  }
  window.workspaceNavigation={flush:flushNavigation};resolveNavigationReady();
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
    if(earlyInteracted){restoring=false;updateFormal();updateTools();capture();publishContext();return;}
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
    applyEntry();await applyEntityEntry();updateFormal();restoring=false;updateTools();capture();publishContext();
  }
  function updateFormal(){const anchor=document.getElementById('previewFormal');anchor.href=(readonly?'http://127.0.0.1:8787':'')+location.pathname+location.hash;}
  function updateTools(){const button=document.getElementById('previewTools');const open=region==='learning'?!document.getElementById('learningPanel')?.hidden:!document.body.classList.contains('preview-tools-closed');button.setAttribute('aria-expanded',String(open));button.textContent=region==='learning'?(open?'收起向导':'展开向导'):(open?'收起导航':'展开导航');}
  let contextMount=null,contextKey='',informationIdentity=null,learningRecordContext=null,learningEntryContext=null;
  const learningRelationStorageKey=storeId=>'xiaomo.learning.relation-view.v1:'+storeId;
  function clearLearningRelationView(){
    const identity=window.learningIsland?.version()?.identity;try{if(learningEntryContext?.storeId)sessionStorage.removeItem(learningRelationStorageKey(learningEntryContext.storeId));if(identity?.storeId)sessionStorage.removeItem(learningRelationStorageKey(identity.storeId));}catch{}learningEntryContext=null;
  }
  function rememberLearningRelationView(id,snap){
    const identity=window.learningIsland?.version()?.identity,island=id.slice(7);if(!identity||!['home','story','visual','post'].includes(island)||snap?.current!==island)return;
    learningEntryContext={id,island,activityId:snap.activities?.[island]?.id??null,storeId:identity.storeId,canonicalPath:identity.canonicalPath,projectRoot:identity.projectRoot,schemaVersion:identity.schemaVersion,scope:identity.scope};
    try{sessionStorage.setItem(learningRelationStorageKey(identity.storeId),JSON.stringify(learningEntryContext));}catch{inform('关联查看位置未能保留到本标签页；刷新后可从原关联重新进入。');}
  }
  function restoreLearningRelationView(snap){
    const identity=window.learningIsland?.version()?.identity;if(!identity)return;
    let saved;try{saved=JSON.parse(sessionStorage.getItem(learningRelationStorageKey(identity.storeId))||'null');}catch{return;}
    if(!saved)return;
    if(!/^island:(home|story|visual|post)$/.test(saved.id)||saved.id!=='island:'+saved.island||saved.island!==snap?.current||saved.activityId!==(snap.activities?.[snap.current]?.id??null)||saved.storeId!==identity.storeId||saved.canonicalPath!==identity.canonicalPath||saved.projectRoot!==identity.projectRoot||saved.schemaVersion!==identity.schemaVersion||saved.scope!==identity.scope){clearLearningRelationView();return;}
    learningEntryContext={...saved,revealed:false};
  }
  async function applyEntityEntry(){
   if(readonly)return;const u=new URL(location.href),id=u.searchParams.get('focus'),kind=u.searchParams.get('kind');
   if(!id){
     if(region==='learning')restoreLearningRelationView(window.learningIsland?.snapshot()?.islandState);
     return;
   }
   if(region==='learning'&&kind==='learning')clearLearningRelationView();
   // A cross-area deep link is an entry action. Once opened, subsequent reloads
   // resume the actual current view instead of repeatedly opening its old target.
   if((region==='information'&&['opportunity','work'].includes(kind))||(region==='learning'&&kind==='learning')){u.searchParams.delete('focus');u.searchParams.delete('kind');history.replaceState(history.state,'',u.pathname+u.search+u.hash);}
   if(region==='information'&&kind==='opportunity'&&infoState()?.data?.items?.some(x=>x.id===id)){await openDetail(id);}
   else if(region==='information'&&kind==='work'){setView('works');const serial=navigationSerial,deadline=Date.now()+6000;let card;while(!card&&Date.now()<deadline&&serial===navigationSerial){card=document.querySelector('[data-work-id="'+CSS.escape(id)+'"]');if(!card)await new Promise(r=>setTimeout(r,80));}if(serial!==navigationSerial)return;const choice=card?.querySelector(':scope > .filter-chip');if(choice&&choice.getAttribute('aria-pressed')!=='true')choice.click();card=document.querySelector('[data-work-id="'+CSS.escape(id)+'"]');card?.scrollIntoView({block:'center'});if(card)publishContext(id,card);}
   else if(region==='learning'&&kind==='learning'){
     const snap=window.learningIsland?.snapshot()?.islandState;
     if(id.startsWith('island:')&&['home','story','visual','post'].includes(id.slice(7))){visit(id.slice(7));rememberLearningRelationView(id,window.learningIsland?.snapshot()?.islandState);}
     else if(id.startsWith('activity:')){const a=Object.values(snap?.activities??{}).find(x=>x.id===id.slice(9));if(a)visit(a.island);}
     else if(id.startsWith('record:')){const r=(snap?.records??[]).find(x=>x.id===id.slice(7));if(r){openTrace(r);learningRecordContext=id;}}
   }
  }
  function rememberRef(ref){const saved=load(),k=JSON.stringify(ref);if(JSON.stringify(saved.recent?.[0])===k)return;saved.recent=[ref,...(saved.recent??[]).filter(x=>JSON.stringify(x)!==k)].slice(0,20);persist(saved);}
  function learningContextMount(label){
    const shell=document.getElementById('shell');if(!shell)return null;
    let host=document.getElementById('learningWorkspaceContext');
    if(!host){
      host=document.createElement('details');host.id='learningWorkspaceContext';host.className='workspace-learning-context';host.style.cssText='padding:8px 28px;background:var(--paper,#fbfcf8);border-bottom:1px solid var(--line,#d3ddd1)';
      const summary=document.createElement('summary');summary.id='learningWorkspaceContextSummary';summary.style.cssText='cursor:pointer;font-size:13px;color:var(--green,#365c53)';host.append(summary);
      const holder=document.createElement('div');holder.className='workspace-context-mount';holder.style.cssText='max-height:min(45vh,420px);overflow:auto';host.append(holder);
      shell.before(host);host.open=!!learningEntryContext;
    }
    if(learningEntryContext&&!learningEntryContext.revealed){host.open=true;learningEntryContext.revealed=true;}
    host.hidden=!!learningRecordContext;host.querySelector('summary').textContent='关联资料（可选） · '+label;
    return host.querySelector(':scope > .workspace-context-mount');
  }
  function publishContext(workId=null,workMount=null){
    if(readonly||region==='observatory')return;let ref,mount;
    if(region==='learning'){
      const v=window.learningIsland?.version(),snap=window.learningIsland?.snapshot()?.islandState;if(!v?.identity||!snap)return;
      const a=snap.activities?.[snap.current];if(document.getElementById('dialogCover')?.hidden)learningRecordContext=null;
      if(!learningEntryContext)restoreLearningRelationView(snap);
      if(learningEntryContext&&(learningEntryContext.island!==snap.current||learningEntryContext.activityId!==(a?.id??null)||learningEntryContext.storeId!==v.identity.storeId||learningEntryContext.canonicalPath!==v.identity.canonicalPath||learningEntryContext.projectRoot!==v.identity.projectRoot||learningEntryContext.schemaVersion!==v.identity.schemaVersion||learningEntryContext.scope!==v.identity.scope))clearLearningRelationView();
      const id=learningRecordContext??learningEntryContext?.id??(a?.id?'activity:'+a.id:'island:'+(snap.current??'home'));
      ref={module:region,kind:'learning',storeId:v.identity.storeId,id};
      const names={home:'主岛',story:'故事岛',visual:'影像与 AI 创作岛',post:'剪辑音动效岛'};
      const label=id.startsWith('activity:')?'当前活动：'+(a?.title||'未命名活动'):id.startsWith('record:')?'界面书签：'+((snap.records??[]).find(r=>'record:'+r.id===id)?.title||'未命名书签'):'学习区域：'+(names[snap.current]||'主岛');
      const holder=learningContextMount(label);
      mount=learningRecordContext?document.getElementById('dialogBody'):holder;
    }
    else{if(!informationIdentity)return;const s=infoState();if(workId){ref={module:region,kind:'work',storeId:informationIdentity,id:workId};mount=workMount;}else if(s?.detailId&&document.getElementById('detail')?.open){ref={module:region,kind:'opportunity',storeId:informationIdentity,id:s.detailId};mount=document.getElementById('detail-content');}else return;}
    if(!mount)return;if(!mount.classList.contains('workspace-context-mount')){let holder=mount.querySelector(':scope > .workspace-context-mount');if(!holder){holder=document.createElement('div');holder.className='workspace-context-mount';mount.append(holder);}mount=holder;}
    const k=JSON.stringify(ref);if(k===contextKey&&mount===contextMount&&mount.querySelector('.workspace-relations'))return;contextKey=k;contextMount=mount;window.workspaceLastContext={ref,mount};dispatchEvent(new CustomEvent('workspace:context',{detail:{ref,mount}}));rememberRef(ref);
  }
  if(!readonly&&region==='information'){fetch('/information/api/health',{cache:'no-store'}).then(r=>r.json()).then(h=>{if(h.app==='xiaomo-opportunities'){informationIdentity=h.marker;publishContext();}}).catch(()=>{});}
  addEventListener('workspace:context-request',()=>publishContext());
  addEventListener('workspace:context',event=>{if(!readonly&&event.detail?.ref)rememberRef(event.detail.ref);});
  function workButtons(){if(readonly||region!=='information')return;for(const card of document.querySelectorAll('[data-work-id]')){if(card.querySelector('.workspace-work-context'))continue;const b=document.createElement('button');b.type='button';b.className='workspace-work-context';b.textContent='跨区关联';b.addEventListener('click',()=>publishContext(card.dataset.workId,card));card.append(b);}}
  let contextTimer;const contexts=new MutationObserver(()=>{clearTimeout(contextTimer);contextTimer=setTimeout(()=>{workButtons();publishContext();},120);});if(!readonly)contexts.observe(document.querySelector(region==='learning'?'#spaceBody':'#content')||document.body,{childList:true,subtree:true});
  if(!readonly&&region==='learning'){
    const dialog=document.getElementById('dialogCover');if(dialog)contexts.observe(dialog,{attributes:true,attributeFilter:['hidden'],childList:true,subtree:true});
    for(const id of ['mapTitle','learningPanel']){const source=document.getElementById(id);if(source)contexts.observe(source,{childList:true,characterData:true,subtree:true});}
  }
  document.getElementById('previewTools').addEventListener('click',()=>{if(region==='learning'){const panel=document.getElementById('learningPanel');document.getElementById(panel.hidden?'reopenPanel':'collapsePanel')?.click();}else document.body.classList.toggle('preview-tools-closed');updateTools();capture();});
  for(const link of document.querySelectorAll('[data-preview-region-link]')){const saved=load().regions?.[link.dataset.previewRegionLink];if(saved?.url&&saved.url.startsWith('/'+link.dataset.previewRegionLink+'/'))link.href=saved.url;}
  document.addEventListener('click',event=>{const link=event.target.closest('a');if(link&&(link.closest('.preview-header,.preview-dialog-nav')||(region==='observatory'&&link.getAttribute('href')?.startsWith('#'))))capture();if(region==='observatory'&&event.button===0&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&!event.altKey&&(!link?.target||link.target==='_self')&&/^#topic\/[^/]+\/(source|paragraph|section)\//.test(link?.getAttribute('href')||'')){const targetURL=new URL(link.getAttribute('href'),location.href);explicitReadingURL=targetURL.pathname+targetURL.search+targetURL.hash;if(explicitReadingURL===activeRouteURL)setTimeout(()=>{if(explicitReadingURL===activeRouteURL){revealRouteTarget(explicitReadingURL);explicitReadingURL=null;capture();}},140);}const write=event.target.closest('#update,#stop,#backupButton,[type="submit"]');if(readonly&&write&&region!=='learning'){event.preventDefault();event.stopImmediatePropagation();inform('界面预览保留当前输入，未写正式资料。保存请打开右上角“正式使用”。');}},true);
  document.addEventListener('submit',event=>{if(!readonly||region==='learning')return;if(['filterForm','topicFilterForm'].includes(event.target.id))return;event.preventDefault();event.stopImmediatePropagation();inform('这份输入尚未提交。请在正式页面保存，预览不会修改资料。');},true);
  addEventListener('scroll',()=>{clearTimeout(window.__previewScrollTimer);window.__previewScrollTimer=setTimeout(capture,100);},{passive:true});
  function acceptNewInput(event){if(restoring&&event.isTrusted){++navigationSerial;restoring=false;updateTools();}if(!restoring)capture();}
  document.addEventListener('input',acceptNewInput);
  document.addEventListener('focusin',()=>{if(!restoring)capture();});
  document.addEventListener('keydown',event=>{if(event.altKey&&['ArrowLeft','ArrowRight'].includes(event.key))capture();});
  document.addEventListener('change',event=>{acceptNewInput(event);if(!restoring)setTimeout(capture,80);});
  document.addEventListener('toggle',()=>{if(!restoring)setTimeout(capture,80);},true);
  addEventListener('pagehide',()=>{capture();saveNavigation();});
  addEventListener('hashchange',()=>{
    updateFormal();
    if(region==='observatory'){
      const destination=location.pathname+location.search+location.hash,previousRoute=activeRouteURL,serial=++navigationSerial;
      const explicitTarget=explicitReadingURL===destination;explicitReadingURL=null;
      const saved=load(),remembered=saved.observatoryRoutes?.[destination];
      const rememberedFilters=remembered?.filters||saved.regions?.[region]?.filters;
      restoring=true;activeRouteURL=destination;
      clearTimeout(window.__previewCaptureTimer);clearTimeout(window.__previewScrollTimer);
      (async()=>{
        await new Promise(resolve=>setTimeout(resolve,100));if(serial!==navigationSerial)return;
        applyFilters(rememberedFilters);if(remembered)restoreReading(remembered.reading,{preserveStage:explicitTarget&&sameTopicReadingRoute(previousRoute,destination)});
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
  if(region==='information'){const content=document.getElementById('detail-content');function dialogNavigation(){if(!content||!document.getElementById('detail')?.open||content.querySelector('.preview-dialog-nav'))return;const nav=document.createElement('nav');nav.className='preview-dialog-nav';nav.setAttribute('aria-label','从当前机会返回个人空间');for(const [href,label] of [['/terminal/#cabin','← 回领航船'],['/terminal/#home','回主岛'],['/learning/','学习小岛'],['/observatory/','素材观察室']]){const link=document.createElement('a');link.href=readonly?href:(href.startsWith('/terminal/')?href:href+'?space=daily');link.textContent=label;nav.append(link);}content.prepend(nav);}const detailObserver=new MutationObserver(()=>{dialogNavigation();publishContext();if(!restoring){clearTimeout(window.__previewDetailTimer);window.__previewDetailTimer=setTimeout(capture,140);}});if(content)detailObserver.observe(content,{childList:true,subtree:true});}
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
