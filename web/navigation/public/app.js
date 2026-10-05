'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const TYPE_NAMES = {life:'生活旅程', idea:'创作灵感', note:'随手记'};
  const state = {revision:null, token:null, identity:null, context:null, provider:null, journeys:[], pending:null, chatPending:null, reviewPending:null, legacyReview:{question:'',since:'',until:''}, reviewInChat:false, profile:null, profileLoaded:false, profileLoading:false, profilePending:null, profileBusy:false, profileTarget:null, analysesLoaded:false, analysesLoading:false, messages:[], busy:false, chatBusy:false, draftKey:null, sessionKey:null, branch:null, initialized:false};
  const CHAT_CACHE_LIMIT = 512 * 1024, CHAT_CACHE_MESSAGES = 40, DRAFT_CACHE_LIMIT = 768 * 1024;
  const byteLength = value => new TextEncoder().encode(value).length;
  const today = () => {
    const parts = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    const get = type => parts.find(item => item.type === type)?.value;
    return [get('year'),get('month'),get('day')].join('-');
  };
  const uniqueId = prefix => prefix + '_' + (crypto.randomUUID ? crypto.randomUUID().replaceAll('-','') : Date.now().toString(36) + Math.random().toString(36).slice(2));
  const node = (tag, cls, value) => {const el=document.createElement(tag);if(cls)el.className=cls;if(value!==undefined)el.textContent=String(value);return el;};
  const line = (value, cls='original-text') => node('p',cls,value);
  function status(id,text,error=false){$(id).textContent=text;$(id).dataset.state=error?'error':'ok';}
  function messageText(error){return error?.userMessage || error?.message || '暂时没有完成，请保留输入后重试。';}
  function selectedView(view, changeURL=true) {
    const oldReview=view==='review';
    if(oldReview){view='chat';$('reviewEntryNotice').hidden=false;}
    if(!['journey','chat','profile'].includes(view))view='journey';
    state.view=view;
    for(const button of document.querySelectorAll('[data-view]'))button.setAttribute('aria-current',button.dataset.view===view?'page':'false');
    for(const name of ['journey','chat','profile'])$(name+'View').hidden=name!==view;
    const profile=view==='profile';$('deskModes').hidden=profile;$('deskProfile').hidden=profile;$('analysesShelf').hidden=profile;
    $('pageTitle').textContent=profile?'我的资料':'记录一件事，或一起想一想。';
    $('pageDescription').textContent=profile?'关于你的背景、在意的事和目前处境。':'生活、创作、关系与休息，都可以从一句话开始。';
    document.title='小陌的个人终端 · '+(profile?'我的资料':'领航桌');
    if(changeURL||oldReview){const url=new URL(location.href);url.searchParams.set('view',view);history.replaceState(null,'',url.pathname+url.search+url.hash);}
    if(profile&&state.token&&!state.profileLoaded)void loadProfile();
  }
  async function api(path,{method='GET',body,timeout=30000}={}) {
    const serialized=body===undefined?undefined:JSON.stringify(body);
    if(serialized!==undefined&&new TextEncoder().encode(serialized).length>96*1024)throw Object.assign(new Error('这段内容超过一次提交可接收的长度（约 3 万汉字）。原文仍保留，请复制后分段保存或交流。'),{code:'LOCAL_TOO_LONG',ambiguous:false});
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
    try {
      const headers={};if(body!==undefined)headers['content-type']='application/json';if(method!=='GET'&&state.token)headers['x-navigation-token']=state.token;
      const response=await fetch('/api/navigation'+path,{method,headers,body:serialized,cache:'no-store',signal:controller.signal});
      let result;try{result=await response.json();}catch{throw Object.assign(new Error('没有收到完整结果，输入已经保留。'),{ambiguous:method!=='GET'});}
      if(!response.ok||result.ok!==true){const detail=result.error||{};throw Object.assign(new Error(typeof detail==='string'?detail:detail.message||'这次操作未完成。'),{status:response.status,code:detail.code,details:detail.details||result.details,ambiguous:response.status>=500});}
      return result.data;
    } catch(error) {
      if(error.name==='AbortError')throw Object.assign(new Error(method==='GET'?'读取用了较长时间，可以重新加载。':'没有及时收到结果，输入和这次提交都已保留。'),{ambiguous:method!=='GET'});
      if(error instanceof TypeError)error.ambiguous=method!=='GET';
      throw error;
    } finally {clearTimeout(timer);}
  }
  function journeyInput(){return {title:$('journeyTitleInput').value,date:$('journeyDate').value,type:$('journeyType').value,content:$('journeyContent').value};}
  function sameEntry(a,b){return ['title','date','type'].every(key=>(a?.[key]||'')===(b?.[key]||''))&&(a?.originalContent??a?.content??'')===(b?.originalContent??b?.content??'');}
  function profileInput(){return {sectionId:$('profileSection').value,content:$('profileCorrection').value,targetId:state.profileTarget?.id||null,targetLabel:state.profileTarget?.text||''};}
  function draftWrite(){
    if(!state.draftKey)return;
    try{
      const serialized=JSON.stringify({entry:journeyInput(),pending:state.pending,chat:$('chatMessage').value,chatPending:state.chatPending,reviewPending:state.reviewPending,reviewQuestion:state.legacyReview.question,reviewSince:state.legacyReview.since,reviewUntil:state.legacyReview.until,reviewInChat:state.reviewInChat,profileCorrection:profileInput(),profilePending:state.profilePending,updatedAt:new Date().toISOString()});
      if(byteLength(serialized)>DRAFT_CACHE_LIMIT)throw new Error('draft cache too large');
      localStorage.setItem(state.draftKey,serialized);status('draftStatus','原话草稿已留在这个浏览器；保存后进入本机旅程记录。');status('chatDraftStatus',$('chatMessage').value?'问题草稿已保留。':'');
    }catch{status('draftStatus','浏览器暂时无法保留草稿，请先复制原话。',true);status('chatDraftStatus','问题草稿的长期缓存未完成，请在离开前复制需要的内容。',true);status('profileSaveStatus','浏览器暂时无法保留补充草稿，请先复制这句原话。',true);}
    persistConversation();renderLegacyRecovery();
  }
  function readStoredDraft(key){
    const raw=localStorage.getItem(key);if(!raw)return null;
    if(byteLength(raw)>DRAFT_CACHE_LIMIT)throw new Error('draft cache too large');
    const stored=JSON.parse(raw);if(!stored||typeof stored!=='object'||Array.isArray(stored))throw new Error('invalid draft');
    for(const [key,limit] of Object.entries({chat:16000,reviewQuestion:16000,reviewSince:10,reviewUntil:10,updatedAt:40}))if(stored[key]!=null&&(typeof stored[key]!=='string'||stored[key].length>limit))throw new Error('invalid draft field');
    for(const [key,limit] of Object.entries({title:160,date:10,type:10,content:64000}))if(stored.entry?.[key]!=null&&(typeof stored.entry[key]!=='string'||stored.entry[key].length>limit))throw new Error('invalid journey draft');
    if(stored.pending&&(!stored.pending.entry||typeof stored.pending.entry.content!=='string'||typeof stored.pending.entry.id!=='string'||typeof stored.pending.eventId!=='string'||!Number.isInteger(stored.pending.expectedRevision)))throw new Error('invalid pending save');
    for(const key of ['chatPending','reviewPending'])if(stored[key]&&(typeof stored[key].message!=='string'||typeof stored[key].requestId!=='string'||!['chat','review'].includes(stored[key].mode)))throw new Error('invalid pending model request');
    if(stored.profileCorrection&&(typeof stored.profileCorrection.content!=='string'||stored.profileCorrection.content.length>8000||!['about','values','current'].includes(stored.profileCorrection.sectionId)))throw new Error('invalid profile draft');
    if(stored.profilePending&&(typeof stored.profilePending.content!=='string'||stored.profilePending.content.length>8000||typeof stored.profilePending.id!=='string'||typeof stored.profilePending.eventId!=='string'||!Number.isInteger(stored.profilePending.expectedRevision)))throw new Error('invalid pending profile correction');
    return stored;
  }
  function applyStoredDraft(stored){
    for(const [field,id] of Object.entries({title:'journeyTitleInput',date:'journeyDate',type:'journeyType',content:'journeyContent'}))if(typeof stored.entry?.[field]==='string')$(id).value=stored.entry[field];
    if(!stored.entry?.content&&!stored.entry?.title&&!stored.pending)$('journeyDate').value=today();
    state.legacyReview={question:stored.reviewQuestion||'',since:stored.reviewSince||'',until:stored.reviewUntil||''};state.reviewInChat=stored.reviewInChat===true;
    if(typeof stored.chat==='string')$('chatMessage').value=stored.chat;
    state.pending=stored.pending||null;state.chatPending=stored.chatPending||null;state.reviewPending=stored.reviewPending||null;
    if(stored.profileCorrection){$('profileSection').value=stored.profileCorrection.sectionId;$('profileCorrection').value=stored.profileCorrection.content;state.profileTarget=stored.profileCorrection.targetId?{id:stored.profileCorrection.targetId,text:stored.profileCorrection.targetLabel||'以前选中的资料',sectionId:stored.profileCorrection.sectionId}:null;}
    state.profilePending=stored.profilePending||null;renderProfileTarget();
    status('draftStatus',state.pending?'已恢复原话与未确认的保存，请先核对结果。':'已恢复这个标签页的原话草稿。');
    status('chatDraftStatus',state.chatPending?'已恢复问题和未确认请求；再次发送同一问题会先核对结果。':stored.chat?'已恢复上次的问题草稿。':'');
    if(state.pending)showSaveRecovery('上次保存的结果尚未确认。先核对原记录，再继续。');
    if(state.profilePending)showProfileRecovery('上次资料补充的保存结果尚未确认。先核对，或沿原标识重试。');
    renderLegacyRecovery();
  }
  function restoreDraft(preserveCurrent=false){
    try{
      let branch=sessionStorage.getItem('xiaomo.navigation.branch');if(!branch||!/^[A-Za-z0-9_-]{1,100}$/.test(branch)){branch=uniqueId('draft');sessionStorage.setItem('xiaomo.navigation.branch',branch);}
      state.branch=branch;
      state.draftKey='xiaomo.navigation.draft.v1:'+encodeURIComponent(state.identity)+':'+branch;
      state.sessionKey='xiaomo.navigation.chat.v1:'+encodeURIComponent(state.identity)+':'+branch;
      const stored=preserveCurrent?null:readStoredDraft(state.draftKey);
      if(stored)applyStoredDraft(stored);
    }catch{status('draftStatus','浏览器草稿读取不可用，请在离开前复制原话。',true);}
    restoreConversation(preserveCurrent);
    if(preserveCurrent)draftWrite();
    $('findDrafts').disabled=!state.draftKey;
  }
  function cachedMessage(item){
    if(!item||!['user','assistant'].includes(item.role)||typeof item.content!=='string'||item.content.length>128000)throw new Error('invalid cached message');
    const result={role:item.role,content:item.content};
    if(item.role==='assistant'){
      result.sourceRefs=relatedIds(item).map(id=>({id}));
      result.warnings=Array.isArray(item.warnings)?item.warnings.map(w=>typeof w==='string'?w:w?.message).filter(w=>typeof w==='string').slice(0,8).map(w=>w.slice(0,1000)):[];
      Object.assign(result,responseScope(item));
      if(item.analysis){const saved=item.analysis.saved===true,request=item.analysis.request;if(request&&typeof request.eventId==='string'&&request.eventId.length<=100&&typeof request.id==='string'&&request.id.length<=100&&Number.isInteger(request.expectedRevision)&&request.expectedRevision>=0)result.analysis={saved,request:{eventId:request.eventId,id:request.id,expectedRevision:request.expectedRevision}};}
    }
    return result;
  }
  function persistConversation(){
    if(!state.sessionKey)return;
    try{
      let omitted=false;const messages=[];
      for(const item of state.messages.slice(-CHAT_CACHE_MESSAGES)){try{messages.push(cachedMessage(item));}catch{omitted=true;}}
      const cached={schemaVersion:1,identity:state.identity,branch:state.branch,messages,chat:$('chatMessage').value,chatPending:state.chatPending,updatedAt:new Date().toISOString()};
      let raw=JSON.stringify(cached);while(byteLength(raw)>CHAT_CACHE_LIMIT&&messages.length){messages.shift();omitted=true;raw=JSON.stringify(cached);}
      if(byteLength(raw)>CHAT_CACHE_LIMIT)throw new Error('conversation cache too large');
      sessionStorage.setItem(state.sessionKey,raw);
      if(omitted||state.messages.length>CHAT_CACHE_MESSAGES)status('chatSessionStatus','本标签页仅接续最近 40 条且不超过 512 KiB 的交流；更早或过长内容仍在当前页面，需要时请复制或单独保存。');
    }catch{status('chatSessionStatus','浏览器暂时无法保留交流，离开前请复制需要的内容；正式旅程不受影响。',true);}
  }
  function restoreConversation(preserveCurrent=false){
    if(!state.sessionKey)return;
    try{
      const raw=sessionStorage.getItem(state.sessionKey);if(!raw)return;if(byteLength(raw)>CHAT_CACHE_LIMIT)throw new Error('conversation cache too large');
      const cached=JSON.parse(raw);if(cached?.schemaVersion!==1||cached.identity!==state.identity||cached.branch!==state.branch||!Array.isArray(cached.messages)||cached.messages.length>CHAT_CACHE_MESSAGES)throw new Error('invalid conversation cache');
      if(cached.chat!==undefined&&(typeof cached.chat!=='string'||cached.chat.length>16000))throw new Error('invalid chat draft');
      if(cached.chatPending&&(typeof cached.chatPending.message!=='string'||cached.chatPending.message.length>16000||typeof cached.chatPending.requestId!=='string'||cached.chatPending.requestId.length>100||!['chat','review'].includes(cached.chatPending.mode)))throw new Error('invalid pending chat');
      state.messages=cached.messages.map(cachedMessage);$('conversation').replaceChildren();
      if(!preserveCurrent&&typeof cached.chat==='string'){$('chatMessage').value=cached.chat;state.chatPending=cached.chatPending||null;status('chatDraftStatus',state.chatPending?'已恢复问题和未确认请求；再次发送同一问题会先核对结果。':cached.chat?'已恢复本标签页的问题草稿。':'');}
      for(const item of state.messages)renderMessage(item);
      if(!state.messages.length)$('conversation').append(line('从你正在想的一件事开始。领航会结合已保存的背景与你共同判断。','empty-state'));
      else status('chatSessionStatus','已接回这个标签页的最近领航交流。浏览器会话中的内容没有自动写成正式旅程。');
    }catch{status('chatSessionStatus','这份浏览器交流缓存未通过读取校验，本次未加载；原草稿与正式记录仍可使用。',true);}
  }
  function hasCurrentDraft(){return Boolean($('journeyTitleInput').value||$('journeyContent').value||$('chatMessage').value||state.legacyReview.question||$('profileCorrection').value||state.pending||state.chatPending||state.reviewPending||state.profilePending);}
  function legacyReviewText(stored=null){
    const review=stored?{question:stored.reviewQuestion||'',since:stored.reviewSince||'',until:stored.reviewUntil||''}:state.legacyReview,pending=stored?.reviewPending||(!stored?state.reviewPending:null);
    const since=review.since||pending?.since,until=review.until||pending?.until,question=review.question||pending?.message||'';
    return [(since||until)?'想回看的时间：'+(since||'未设开始日期')+' 至 '+(until||'未设结束日期'):'',question].filter(Boolean).join('\n\n');
  }
  function renderLegacyRecovery(){
    const text=legacyReviewText();$('legacyReviewDraft').hidden=!text&&!state.reviewPending;$('legacyReviewText').textContent=text||'这份旧草稿有一个尚未确认的回看请求。';
    $('restoreReviewDraft').disabled=Boolean($('chatMessage').value||state.chatPending||state.chatBusy);
    status('legacyReviewStatus',state.reviewInChat?'已带进聊天；旧稿仍保留，等这次交流确认后再收起。':state.reviewPending?'以前的请求标识仍保留；带进聊天后，发送会先核对原结果。':$('chatMessage').value?'当前已有问题草稿，先保留它；旧回看草稿也可以完整复制。':'带入后可以修改，只有点击发送才会请求回应。');
  }
  function bringLegacyToChat(){
    if($('chatMessage').value||state.chatPending){status('legacyReviewStatus','当前已有未完成的问题，先保留它；旧稿可以完整复制。',true);return;}
    const message=state.reviewPending?.message||legacyReviewText();
    if(message.length>16000){status('legacyReviewStatus','旧稿较长，请先复制，再把想继续讨论的一段放进聊天。',true);return;}
    $('chatMessage').value=message;state.chatPending=state.reviewPending?{...state.reviewPending}:null;state.reviewInChat=true;selectedView('chat');draftWrite();$('chatMessage').focus();
  }
  function findOtherDrafts(){
    const box=$('otherDrafts');box.replaceChildren();const candidates=[];let unreadable=0;
    if(legacyReviewText()||state.reviewPending){const current=node('section','other-draft'),details=node('details'),restore=node('button','secondary','到聊天恢复这份旧回看草稿');restore.type='button';details.append(node('summary','','这个标签页以前的回看草稿'),line(legacyReviewText()));restore.addEventListener('click',()=>{$('draftsDialog').close();selectedView('chat');$('legacyReviewDraft').open=true;});current.append(details,restore);box.append(current);}
    try{const prefix='xiaomo.navigation.draft.v1:'+encodeURIComponent(state.identity)+':';for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(!key?.startsWith(prefix)||key===state.draftKey)continue;try{const stored=readStoredDraft(key);if(stored&&(stored.entry?.content||stored.chat||stored.pending||stored.reviewPending||stored.reviewQuestion||stored.profileCorrection?.content||stored.profilePending))candidates.push({key,stored});}catch{unreadable++;}}}
    catch{status('findDraftsStatus','浏览器暂时无法读取其他草稿。',true);return;}
    candidates.sort((a,b)=>(b.stored.updatedAt||'').localeCompare(a.stored.updatedAt||''));
    for(const {stored} of candidates.slice(0,20)){
      const card=node('section','other-draft'),details=node('details'),title=stored.entry?.title||stored.entry?.date||'未发送草稿';
      const content=[stored.entry?.content?'旅程原话：\n'+stored.entry.content:'',stored.chat?'未发送问题：\n'+stored.chat:'',legacyReviewText(stored)?'以前的回看草稿：\n'+legacyReviewText(stored):'',stored.profileCorrection?.content?'资料补充草稿：\n'+stored.profileCorrection.content:''].filter(Boolean).join('\n\n');
      details.append(node('summary','',title+(stored.updatedAt?' · '+stored.updatedAt.replace('T',' ').slice(0,16):'')),line(content||'这份草稿保留了一次待核对的提交。'));
      const row=node('div','button-row'),restore=node('button','secondary','恢复这份草稿'),copyButton=node('button','text-button','复制完整草稿');restore.type='button';copyButton.type='button';
      restore.disabled=hasCurrentDraft();copyButton.addEventListener('click',()=>copy(content));
      restore.addEventListener('click',()=>{if(hasCurrentDraft()){status('findDraftsStatus','当前已有草稿，请先保留当前内容；旧草稿可以完整复制。',true);return;}applyStoredDraft(stored);draftWrite();$('draftsDialog').close();status('findDraftsStatus','已恢复所选草稿；原分支继续保留，未合并其他聊天历史。');});
      row.append(restore,copyButton);card.append(details,row);if(restore.disabled)card.append(line('当前已有未完成内容，先复制旧草稿可避免覆盖。','field-help'));box.append(card);
    }
    if(!candidates.length)box.append(line('未找到这份领航资料的其他未发送草稿。','field-help'));
    if(unreadable)box.append(line('另有 '+unreadable+' 份草稿未通过读取校验，已保留原缓存。','field-help'));
    if(candidates.length>20)box.append(line('目前显示最近 20 份，其他旧草稿仍保留在浏览器中。','field-help'));
    $('draftsDialog').showModal();
  }
  function showSaveRecovery(text){$('saveRecovery').hidden=false;$('saveRecoveryText').textContent=text;}
  function setRecordBusy(busy){state.busy=busy;$('saveJourney').disabled=busy||!state.token;$('saveJourney').textContent=busy?'正在保存…':'保存这段记录';$('checkSave').disabled=busy;$('retrySave').disabled=busy;}
  async function initialize(){
    $('pageError').hidden=true;status('connectionStatus','正在连接本机记录…');
    try{
      const data=await api('/bootstrap?asOf='+today());const changedIdentity=state.identity&&state.identity!==data.identity;
      if(changedIdentity){draftWrite();$('journeyForm').reset();$('journeyDate').value=today();$('chatMessage').value='';$('profileForm').reset();state.pending=null;state.chatPending=null;state.reviewPending=null;state.legacyReview={question:'',since:'',until:''};state.reviewInChat=false;state.profilePending=null;state.profileTarget=null;state.profile=null;state.profileLoaded=false;state.analysesLoaded=false;state.messages=[];$('conversation').replaceChildren();$('saveRecovery').hidden=true;$('profileRecovery').hidden=true;state.initialized=false;}
      state.revision=data.revision;state.token=data.token;state.identity=data.identity;state.context=data.context;state.provider=data.provider;state.journeys=data.journeys||[];
      status('connectionStatus',data.scope==='isolated'?'当前为隔离演练记录':'本机记录已连接');
      if(!state.initialized){restoreDraft(Boolean($('journeyContent').value||$('chatMessage').value||$('profileCorrection').value));state.initialized=true;}
      if(changedIdentity){$('pageError').hidden=false;$('pageError').textContent='当前记录来源已变化。先前草稿仍单独保留，已切换到这份记录自己的草稿。';}
      renderJourneys(state.journeys);renderContext();renderProvider();setRecordBusy(false);renderLegacyRecovery();
      if(state.pending)status('saveStatus','这份输入有一笔未确认的保存，请先核对。');
      void loadProfile(true);if($('analysesShelf').open)void loadAnalyses(true);
    }catch(error){$('pageError').hidden=false;$('pageError').textContent='本机记录还没有连接上。'+messageText(error);status('connectionStatus','暂时未连接',true);$('saveJourney').disabled=true;$('sendChat').disabled=true;$('saveProfile').disabled=true;}
  }
  function renderJourneys(entries){
    const list=$('journeyList');list.replaceChildren();$('journeyCount').textContent=entries.length?'目前显示 '+entries.length+' 段记录。':'还没有符合条件的旅程记录。';
    if(!entries.length){list.append(line('没有找到这一范围的记录。可以调整筛选，或先留下一段经历。','empty-state'));return;}
    for(const entry of entries){const button=node('button','journey-card');button.type='button';button.dataset.journeyId=entry.id;const meta=node('span','card-meta');meta.append(node('span','',entry.date||'日期未注明'),node('span','',TYPE_NAMES[entry.type]||'随手记'));button.append(meta,node('strong','',entry.title||'一段旅程'),line(entry.preview||'打开查看完整原文。',''),node('span','card-open','读完整记录 →'));button.addEventListener('click',()=>openJourney(entry.id));list.append(button);}
  }
  async function filterJourneys(){
    const params=new URLSearchParams();for(const [name,id] of [['query','journeyQuery'],['since','filterSince'],['until','filterUntil']])if($(id).value)params.set(name,$(id).value);
    if($('filterSince').value&&$('filterUntil').value&&$('filterSince').value>$('filterUntil').value){status('listStatus','起始日期需要早于或等于结束日期。',true);return;}
    status('listStatus','正在找这段记录…');
    try{const data=await api('/journeys?'+params);state.revision=data.revision;renderJourneys(data.entries||[]);status('listStatus','已按当前条件读取。');}catch(error){status('listStatus',messageText(error),true);}
  }
  function appendEntryDetail(container,entry){
    if(entry.contentKind==='mixed_document')container.append(line('这份记录保留经历整理、归纳与原话；助手的理解在正文中单独标明。','detail-note'));
    const section=node('section');section.append(node('h3','',entry.contentKind==='mixed_document'?'整理与原话':'本人原话'),line(entry.content||'这份记录暂无正文。'));container.append(section);
    if(entry.contentKind==='mixed_document'&&typeof entry.originalContent==='string'&&entry.originalContent){const details=node('details');details.append(node('summary','','本人原话 · 完整查看'),line(entry.originalContent));container.append(details);}
    if(typeof entry.rawTranscript==='string'&&entry.rawTranscript){const details=node('details');details.append(node('summary','','原始转写 · 完整查看'),line(entry.rawTranscript));container.append(details);}
    if(entry.sourceFiles?.length){const details=node('details');details.append(node('summary','','记录来源'));const source=node('div','source-list');for(const file of entry.sourceFiles)source.append(line(typeof file==='string'?file:(file.label||'原文件')+'：'+(file.path||''),'source-label'));details.append(source);container.append(details);}
  }
  async function openJourney(id){
    status('listStatus','正在打开完整记录…');
    try{const data=await api('/journeys/'+encodeURIComponent(id)),entry=data.entry;state.revision=data.revision;$('detailTitle').textContent=entry.title||'一段旅程';$('detailMeta').textContent=[entry.date||'日期未注明',TYPE_NAMES[entry.type]||'随手记'].join(' · ');$('detailContent').replaceChildren();for(const warning of data.warnings||[]){if(typeof warning.message==='string')$('detailContent').append(line(warning.message,'detail-note'));}appendEntryDetail($('detailContent'),entry);$('journeyDialog').showModal();status('listStatus','完整记录已打开。');}catch(error){status('listStatus',messageText(error),true);}
  }
  async function recordSucceeded(data,request){
    if(data.saved!==true&&data.entry?.id!==request.entry.id)throw Object.assign(new Error('保存结果还不能确认，原话已保留。'),{ambiguous:true});
    state.revision=data.revision;state.pending=null;$('saveRecovery').hidden=true;
    if(sameEntry(journeyInput(),request.entry)){$('journeyTitleInput').value='';$('journeyContent').value='';$('journeyDate').value=today();$('journeyType').value='life';}
    draftWrite();status('saveStatus',data.duplicate?'已找回这段已保存的旅程，没有重复添加。':'这段旅程已保存到本机。');
    await filterJourneys();
  }
  async function checkPendingSave(){
    const request=state.pending;if(!request){status('saveStatus','当前没有待核对的保存。');return false;}
    setRecordBusy(true);
    try{const data=await api('/journeys/'+encodeURIComponent(request.entry.id));if(data.entry?.id===request.entry.id&&sameEntry(data.entry,request.entry)){await recordSucceeded({revision:data.revision,entry:data.entry,saved:true},request);return true;}status('saveStatus','找到了同一记录标识，但内容需要核对。原话继续保留。',true);showSaveRecovery('记录内容与本次输入不同，暂时不覆盖。可以复制原话后在 Codex 中核对。');return false;}
    catch(error){if(error.status===404){status('saveStatus','目前未找到原记录，可以重试同一次保存。');showSaveRecovery('目前未找到原记录。重试会沿用同一个记录标识，避免重复。');}else status('saveStatus',messageText(error),true);return false;}
    finally{setRecordBusy(false);draftWrite();}
  }
  async function submitJourney(retry=false){
    if(state.busy)return;
    if(!state.token){status('saveStatus','请先连接本机记录。原话继续保留。',true);return;}
    if(!retry&&state.pending){showSaveRecovery('有一次保存尚未确认。先核对，或重试那次保存；当前输入继续保留。');return;}
    if(!retry&&!$('journeyForm').reportValidity())return;
    let request=state.pending;
    if(!request){const entry={id:uniqueId('journey'),...journeyInput()};if(!entry.content.trim()){status('saveStatus','先留下一句话，再保存。',true);return;}request={eventId:uniqueId('record'),expectedRevision:state.revision,entry};state.pending=request;draftWrite();}
    setRecordBusy(true);status('saveStatus','正在保存原话…');
    try{const data=await api('/record',{method:'POST',body:request});await recordSucceeded(data,request);}
    catch(error){
      if(error.status===409){const latest=error.details?.currentRevision;if(Number.isInteger(latest))state.revision=latest;state.pending={...request,expectedRevision:state.revision};status('saveStatus','其他窗口更新了记录，原话已保留。请核对后再点击重试。',true);showSaveRecovery('已经读取到新的版本。点击重试会继续保存这段原话，不改写其他记录。');}
      else{status('saveStatus',messageText(error),true);showSaveRecovery(error.ambiguous?'没有收到确定的保存结果。先核对是否已保存；重试仍沿用原记录标识。':'这次保存未完成，原话已保留。可以核对并重试同一次保存。');}
      if(error.code==='LOCAL_TOO_LONG'){state.pending=null;$('saveRecovery').hidden=true;}
      draftWrite();
    }finally{setRecordBusy(false);}
  }
  const LABELS={personal:'个人背景',profile:'个人背景',learning:'学习记录',navigation:'领航记录',current:'当前处境',stage:'阶段安排',routes:'阶段与改法',resources:'资源与边界',source:'来源',sources:'背景来源',unknowns:'仍待了解',summary:'目前了解的情况',life_compass:'人生罗盘',compass:'人生罗盘'};
  function contextTexts(value){
    if(typeof value==='string')return [value];if(Array.isArray(value))return value.flatMap(contextTexts);if(!value||typeof value!=='object')return [];
    if(typeof value.content==='string')return [value.content];if(typeof value.text==='string')return [value.text];if(typeof value.summary==='string')return [value.summary];
    if(value.title||value.purpose)return [[value.title,value.purpose,value.status==='adopted'?'已采用':value.status==='candidate'?'候选':''].filter(Boolean).join(' · ')];
    return Object.entries(value).filter(([key])=>!['path','revision','identity','token','schema','history','events','record_ids','recordIds','id','as_of','asOf','handoffText'].includes(key)).flatMap(([,part])=>contextTexts(part));
  }
  function renderContext(){
    const items=(state.profile?.sections||[]).flatMap(section=>section.items||[]).filter(item=>item.current!==false&&item.status!=='historical');
    if(!items.length){$('profileBrief').textContent='已留下的背景、偏好和处境，可以在资料里补充。';return;}
    const item=items.find(item=>item.sectionId==='about')||items[0],text=String(item.text||'').replace(/^#{1,6}\s*/gm,'').replace(/\s+/g,' ').trim();
    $('profileBrief').textContent=text?'资料里留下的背景：'+(text.length>100?text.slice(0,100)+'…':text):'已有背景与最近的补充都在资料里，可以随时更正。';
  }
  function renderProvider(){
    const ready=state.provider?.configured===true;$('providerStatus').textContent=ready?'领航已连接。你发送问题后，才会结合背景回应。':'领航对话暂时没有连接模型。你可以先记录旅程，或带着背景去 Codex 继续聊。';$('sendChat').disabled=!ready;
  }
  function contextForHandoff(){const context=state.context||{};return '请读取领航室的当前入口与 navigate-personal-development 技能，现有背景仅供核对，以我本次要求为准。\n'+[['个人背景',context.profile],['人生罗盘',context.compass],['已采用阶段与改法',context.routes?.adopted],['候选方向（未采用）',context.routes?.candidate],['上次关注点',context.focus?.text]].map(([label,value])=>label+'：\n'+contextTexts(value).join('\n\n')).join('\n\n');}
  async function copy(text, statusId, copiedMessage='已复制完整交接，可以粘贴到 Codex 继续。复制本身还没有生成领航回应。'){
    try{await navigator.clipboard.writeText(text);if(statusId)status(statusId,copiedMessage);}
    catch{$('copyText').value=text;$('copyDialog').showModal();$('copyText').focus();$('copyText').select();if(statusId)status(statusId,'自动复制未完成，已打开可手动复制的完整文本。');}
  }
  function responseScope(value){
    const result={};
    if(value.requiresClarification===true)result.requiresClarification=true;
    if(value.period&&typeof value.period==='object'){
      result.period={};for(const key of ['since','until','label','basis'])if(value.period[key]===null||typeof value.period[key]==='string')result.period[key]=typeof value.period[key]==='string'?value.period[key].slice(0,500):null;
    }
    if(value.coverage&&typeof value.coverage==='object'){
      result.coverage={};for(const key of ['sourceSince','sourceUntil','note'])if(typeof value.coverage[key]==='string')result.coverage[key]=value.coverage[key].slice(0,2000);
      for(const key of ['journeyCount','recordCount'])if(Number.isInteger(value.coverage[key])&&value.coverage[key]>=0)result.coverage[key]=value.coverage[key];
      result.coverage.excerpted=value.coverage.excerpted===true;
    }
    return result;
  }
  function appendMessage(role,content,meta={}){
    const item={role,content,sourceRefs:meta.sourceRefs||[],warnings:meta.warnings||[],...responseScope(meta)};state.messages.push(item);renderMessage(item);
  }
  function renderResponseScope(container,meta){
    if(meta.requiresClarification){container.append(line('先确认一下时间范围，再接着聊。','message-scope'));return;}
    const coverage=meta.coverage||{},period=meta.period||{},parts=[];
    const from=coverage.sourceSince||period.since,to=coverage.sourceUntil||period.until;
    if(from||to)parts.push('选取 '+(from||'起始日期未注明')+' — '+(to||'结束日期未注明'));
    else if(period.label)parts.push(period.label);
    if(Number.isInteger(coverage.journeyCount))parts.push(coverage.journeyCount+' 段旅程');
    if(Number.isInteger(coverage.recordCount))parts.push(coverage.recordCount+' 条分层依据');
    if(parts.length)container.append(line(parts.join(' · '),'message-scope'));
    if(coverage.excerpted)container.append(line('部分内容为节选，不能当作已经读完全部记录。','coverage-warning'));
    if(coverage.note)container.append(line(coverage.note,'field-help'));
  }
  function renderMessage(item){
    const {role,content}=item,box=$('conversation');box.querySelector('.empty-state')?.remove();const card=node('article','message '+(role==='user'?'user':'assistant'));card.append(line(role==='user'?'小陌':item.requiresClarification?'领航师 · 确认范围':'领航师 · AI 理解与建议','message-label'));if(role!=='user')renderResponseScope(card,item);card.append(line(content,'message-content'));if(role!=='user')addReplyTools(card,content,item,item);box.append(card);box.scrollTop=box.scrollHeight;
  }
  function relatedIds(meta){const refs=meta.sourceRefs||[];return [...new Set(refs.map(item=>typeof item==='string'?item:item?.id).filter(item=>typeof item==='string'))].slice(0,100);}
  function addReplyTools(container,reply,meta,sessionMessage=null){
    const row=node('div','button-row message-tools'),copyButton=node('button','text-button','复制这段回应'),saveButton=node('button','secondary','保存这段 AI 理解'),saveNotice=node('p','action-status');copyButton.type='button';saveButton.type='button';copyButton.addEventListener('click',()=>copy(reply));row.append(copyButton);if(meta.requiresClarification){container.append(row);return;}row.append(saveButton);container.append(row,saveNotice);
    let request=sessionMessage?.analysis?.request?{...sessionMessage.analysis.request,content:reply,relatedIds:relatedIds(meta)}:null,done=sessionMessage?.analysis?.saved===true;
    if(done){saveButton.disabled=true;saveButton.textContent='AI 理解已保存';saveNotice.textContent='此回应已明确保存为 AI 理解，未写成旅程事实。';}
    saveButton.addEventListener('click',async()=>{if(done)return;const requestIdentity=state.identity;saveButton.disabled=true;saveNotice.textContent='正在单独保存 AI 理解…';request??={eventId:uniqueId('analysis'),expectedRevision:state.revision,id:uniqueId('analysis_record'),content:reply,relatedIds:relatedIds(meta)};
      if(sessionMessage){sessionMessage.analysis={request,saved:false};persistConversation();}
      try{const data=await api('/analysis',{method:'POST',body:request});if(state.identity!==requestIdentity)return;state.revision=data.revision;done=true;if(sessionMessage)sessionMessage.analysis.saved=true;saveButton.textContent='AI 理解已保存';saveNotice.textContent='已单独保存为 AI 理解，原话和旅程事实保持原样。';state.analysesLoaded=false;if($('analysesShelf').open)void loadAnalyses(true);}
      catch(error){if(state.identity!==requestIdentity)return;if(error.status===409&&Number.isInteger(error.details?.currentRevision)){state.revision=error.details.currentRevision;request.expectedRevision=state.revision;}saveNotice.textContent=messageText(error)+' 这段回应仍在页面上，可以复制或重试保存。';saveNotice.dataset.state='error';saveButton.disabled=false;}
      finally{if(sessionMessage&&state.identity===requestIdentity)persistConversation();}
    });
    if(meta.warnings?.length)container.append(line(meta.warnings.map(item=>typeof item==='string'?item:item.message||'').filter(Boolean).join('\n'),'field-help'));
  }
  function chatHistory(message){
    let clipped=false;const history=[];
    for(const item of state.messages.slice(-12).reverse()){
      const content=item.content.length>5000?(clipped=true,item.content.slice(0,4900)+'\n[较长历史为节选，不能声称已读全部。]'):item.content;
      const candidate=[{role:item.role,content},...history];
      if(new TextEncoder().encode(JSON.stringify({message,history:candidate})).length>88*1024){clipped=true;break;}
      history.unshift({role:item.role,content});
    }
    if(clipped)status('chatDraftStatus','本次使用最近交流的节选；完整回应仍保留在上方。');
    return history;
  }
  async function resumeModelRequest(request){
    try{const receipt=await api('/requests/'+encodeURIComponent(request.requestId));if(receipt.status==='completed'&&typeof receipt.reply==='string')return {request,result:receipt};if(receipt.status==='failed')return {request:{...request,requestId:uniqueId(request.mode==='review'?'review':'chat')}};return {request};}
    catch(error){if(error.status===404)return {request:{...request,requestId:uniqueId(request.mode==='review'?'review':'chat')}};throw error;}
  }
  async function sendChat(){
    if(state.chatBusy)return;const message=$('chatMessage').value;if(!message.trim())return;const requestIdentity=state.identity,usingLegacyReview=state.reviewInChat;state.chatBusy=true;const button=$('sendChat');button.disabled=true;status('chatStatus','领航正在结合背景看你的问题…');
    const samePending=state.chatPending?.message===message;let request=samePending?state.chatPending:{requestId:uniqueId('chat'),message,mode:'chat',asOf:today(),history:chatHistory(message)};state.chatPending=request;draftWrite();
    try{let recovered;if(samePending){recovered=await resumeModelRequest(request);if(state.identity!==requestIdentity)return;request=recovered.request;state.chatPending=request;draftWrite();}const data=recovered?.result||await api('/chat',{method:'POST',body:request,timeout:180000});if(state.identity!==requestIdentity)return;if(typeof data.reply!=='string'||!data.reply.trim())throw new Error('没有收到完整回应，问题已经保留。');state.revision=data.revision??state.revision;appendMessage('user',message);appendMessage('assistant',data.reply,data);if($('chatMessage').value===message)$('chatMessage').value='';state.chatPending=null;if(usingLegacyReview){state.reviewPending=null;state.legacyReview={question:'',since:'',until:''};state.reviewInChat=false;}draftWrite();status('chatStatus',data.requiresClarification?'先确认你指的时间范围，再接着聊。':'领航已回应。需要保留这段理解时，可以单独保存。');}
    catch(error){if(state.identity!==requestIdentity)return;status('chatStatus',messageText(error)+' 问题草稿已保留，也可以带着背景去 Codex 聊。',true);draftWrite();}
    finally{state.chatBusy=false;button.disabled=state.provider?.configured!==true;renderLegacyRecovery();}
  }
  const PROFILE_TITLES={about:'关于我',values:'我在意什么',current:'目前情况'};
  function profileKind(item){return ({source_summary:'旧来源摘要',user_report:'本人原话',user_feeling:'本人感受',adopted_stage:'已采用的安排',profile_correction:'本人补充'})[item.kind]||'已留下的资料';}
  function profileItem(item,sectionId){
    const article=node('article','profile-item'),text=String(item.text||''),historical=item.current===false||item.status==='historical';
    if(historical)article.append(line('已有后续更正','history-label'));
    if(text.length>220){article.append(line(text.slice(0,200)+'…','profile-text'));const full=node('details','profile-full');full.append(node('summary','','展开这条原文'),line(text,'profile-text'));article.append(full);}
    else article.append(line(text,'profile-text'));
    const tools=node('div','profile-item-tools'),source=node('details','profile-source');source.append(node('summary','','来源与日期'),line([profileKind(item),item.source||'来源未注明',item.sourceDate?item.sourceDate+'（'+(item.dateBasis||'来源日期，非经历发生日')+'）':'日期未注明'].join(' · '),'source-label'));
    if(item.sourceRef?.heading)source.append(line('原小节：'+item.sourceRef.heading,'source-label'));
    if(Array.isArray(item.supersededBy)&&item.supersededBy.length)source.append(line('后面已有 '+item.supersededBy.length+' 条补充或更正，原来的说法仍保留。','field-help'));
    tools.append(source);
    if(item.canCorrect===true&&!historical){const correct=node('button','text-button','补充 / 更正这条');correct.type='button';correct.addEventListener('click',()=>{state.profileTarget={id:item.id,text,sectionId};$('profileSection').value=sectionId;renderProfileTarget();draftWrite();$('profileCorrection').focus({preventScroll:true});const top=$('profileForm').getBoundingClientRect().top+window.scrollY-28;window.scrollTo({top,behavior:'auto'});});tools.append(correct);}
    article.append(tools);return article;
  }
  function renderProfile(){
    const box=$('profileSections');box.replaceChildren();const profile=state.profile,correctionIds=new Set((profile?.corrections||[]).map(item=>item.id));
    for(const [id,title] of Object.entries(PROFILE_TITLES)){
      const section=(profile?.sections||[]).find(item=>item.id===id),items=section?.items||[],current=items.filter(item=>item.current!==false&&item.status!=='historical'),historical=items.filter(item=>item.current===false||item.status==='historical');
      const ordered=[...current.filter(item=>correctionIds.has(item.id)).sort((a,b)=>String(b.receivedAt||b.sourceDate||'').localeCompare(String(a.receivedAt||a.sourceDate||''))),...current.filter(item=>!correctionIds.has(item.id))];
      const panel=node('section','panel profile-group');panel.append(node('h2','',title));
      if(!ordered.length)panel.append(line('这一块还没有留下资料。想到什么时，补充一句就好。','field-help'));
      for(const item of ordered.slice(0,2))panel.append(profileItem(item,id));
      if(ordered.length>2){const more=node('details','profile-more');more.append(node('summary','','展开其余 '+(ordered.length-2)+' 条已有资料'));for(const item of ordered.slice(2))more.append(profileItem(item,id));panel.append(more);}
      if(historical.length){const old=node('details','profile-history');old.append(node('summary','','以前的说法 · '+historical.length+' 条已更正'));for(const item of historical)old.append(profileItem(item,id));panel.append(old);}
      const add=node('button','text-button','给这一块补充一句');add.type='button';add.addEventListener('click',()=>{state.profileTarget=null;$('profileSection').value=id;renderProfileTarget();draftWrite();$('profileCorrection').focus({preventScroll:true});window.scrollTo({top:$('profileForm').getBoundingClientRect().top+window.scrollY-28,behavior:'auto'});});panel.append(add);box.append(panel);
    }
    renderContext();renderProfileTarget();
  }
  async function loadProfile(force=false){
    if(state.profileLoading||(!force&&state.profileLoaded))return state.profile;
    if(!state.identity)return null;const identity=state.identity;state.profileLoading=true;status('profileStatus','正在读取已有资料…');
    try{const data=await api('/profile?asOf='+today());if(state.identity!==identity)return null;if(data.identity&&data.identity!==identity)throw new Error('资料来源与当前领航记录不同，暂未加载。');state.profile=data;state.profileLoaded=true;state.revision=data.revision??state.revision;renderProfile();const warnings=(data.warnings||[]).map(item=>typeof item==='string'?item:item?.message).filter(Boolean);status('profileStatus',warnings.length?warnings.join(' '):'旧资料与本人补充都保留；需要时再展开或更正。');$('saveProfile').disabled=!state.token||state.profileBusy;return data;}
    catch(error){if(state.identity===identity){status('profileStatus','资料暂未读到。'+messageText(error),true);$('saveProfile').disabled=true;if(!state.profileLoaded)$('profileSections').replaceChildren(line('可以稍后重新加载；现有草稿与聊天仍保留。','empty-state'));}return null;}
    finally{state.profileLoading=false;}
  }
  function renderProfileTarget(){
    $('profileTarget').hidden=!state.profileTarget;$('profileTargetText').textContent=state.profileTarget?'正在补充或更正：'+state.profileTarget.text.slice(0,180)+(state.profileTarget.text.length>180?'…':''):'';
  }
  function showProfileRecovery(text){$('profileRecovery').hidden=false;$('profileRecoveryText').textContent=text;}
  function setProfileBusy(busy){state.profileBusy=busy;$('saveProfile').disabled=busy||!state.token||!state.profileLoaded;$('saveProfile').textContent=busy?'正在保存…':'保存这句补充';$('checkProfileSave').disabled=busy;$('retryProfileSave').disabled=busy;}
  async function profileSucceeded(data,request){
    if(data.saved!==true||data.identity&&data.identity!==state.identity||data.correction?.id!==request.id)throw Object.assign(new Error('资料补充的保存结果还不能确认，原话已保留。'),{ambiguous:true});
    state.revision=data.revision??state.revision;state.profilePending=null;$('profileRecovery').hidden=true;
    if($('profileCorrection').value===request.content&&$('profileSection').value===request.sectionId){$('profileCorrection').value='';state.profileTarget=null;renderProfileTarget();}
    if(data.profile){state.profile=data.profile;state.profileLoaded=true;renderProfile();}else await loadProfile(true);
    draftWrite();status('profileSaveStatus',data.duplicate?'已核对到这句已保存的补充，没有重复添加。':'这句补充已保存，原来的资料和其他条目继续保留。');
  }
  async function checkProfileSave(){
    const request=state.profilePending;if(!request){status('profileSaveStatus','当前没有待核对的资料补充。');return;}setProfileBusy(true);
    try{const profile=await loadProfile(true);if(!profile)return;const found=[...(profile.corrections||[]),...(profile.sections||[]).flatMap(section=>section.items||[])].find(item=>item.id===request.id);if(found&&found.text===request.content&&found.sectionId===request.sectionId){await profileSucceeded({saved:true,duplicate:true,revision:profile.revision,identity:profile.identity,correction:found,profile},request);return;}status('profileSaveStatus',found?'找到了同一标识，但内容需要进一步核对；这次没有覆盖。':'目前未找到这句补充，可以沿原标识重试。',Boolean(found));showProfileRecovery('原话和同一次保存标识继续保留。确认后再重试，不会自动覆盖其他资料。');}
    catch(error){status('profileSaveStatus',messageText(error),true);}
    finally{setProfileBusy(false);draftWrite();}
  }
  async function submitProfile(retry=false){
    if(state.profileBusy)return;if(!state.token||!state.profileLoaded){status('profileSaveStatus','先读取已有资料，再保存这句补充。原话继续保留。',true);return;}
    if(!retry&&state.profilePending){showProfileRecovery('上次补充的保存结果尚未确认。先核对，或重试那次保存；当前输入继续保留。');return;}
    if(!retry&&!$('profileForm').reportValidity())return;let request=state.profilePending;
    if(!request){const input=profileInput();if(!input.content.trim()){status('profileSaveStatus','先写下一句补充，再保存。',true);return;}request={identity:state.identity,eventId:uniqueId('profile'),expectedRevision:state.revision,id:uniqueId('profile_correction'),sectionId:input.sectionId,content:input.content,asOf:today()};if(input.targetId)request.targetId=input.targetId;state.profilePending=request;draftWrite();}
    if(request.identity!==state.identity){status('profileSaveStatus','这句待确认补充属于另一份领航资料，暂不提交。请先复制原话核对。',true);return;}
    const identity=state.identity;setProfileBusy(true);status('profileSaveStatus','正在保存你的补充原话…');
    try{const data=await api('/profile-correction',{method:'POST',body:request});if(state.identity!==identity)return;await profileSucceeded(data,request);}
    catch(error){if(state.identity!==identity)return;if(error.status===409){const latest=error.details?.currentRevision;if(Number.isInteger(latest))state.revision=latest;await loadProfile(true);state.profilePending={...request,expectedRevision:state.revision};showProfileRecovery('另一处更新了资料，已经重新读取。核对后再重试这句补充。');}else showProfileRecovery(error.ambiguous?'没有收到确定结果，先核对是否已保存；重试仍沿用这次标识。':'这次补充未完成，原话仍保留，可以核对或重试。');status('profileSaveStatus',messageText(error),true);draftWrite();}
    finally{setProfileBusy(false);}
  }
  async function loadAnalyses(force=false){
    if(state.analysesLoading||(!force&&state.analysesLoaded)||!state.identity)return;const identity=state.identity;state.analysesLoading=true;status('analysesStatus','正在读取以前保存的 AI 整理…');
    try{const data=await api('/analyses');if(state.identity!==identity)return;if(data.identity&&data.identity!==identity)throw new Error('整理来源与当前领航记录不同，暂未加载。');const box=$('analysesList');box.replaceChildren();const entries=Array.isArray(data.entries)?data.entries:[];
      for(const entry of entries){const details=node('details','saved-analysis'),text=String(entry.text||'');details.append(node('summary','',[entry.sourceDate||'日期未注明','AI 理解与建议'].join(' · ')),line(text),line([entry.source||'已保存的 AI 整理',entry.sourceDate||entry.receivedAt||''].filter(Boolean).join(' · '),'source-label'));const copyButton=node('button','text-button','复制这段整理');copyButton.type='button';copyButton.addEventListener('click',()=>copy(text));details.append(copyButton);box.append(details);}
      if(!entries.length)box.append(line('还没有单独保存的 AI 整理。聊天里的回应仍可按需保存。','field-help'));state.analysesLoaded=true;status('analysesStatus',entries.length?'这里保留 '+entries.length+' 条以前的 AI 理解；它们不是本人原话，也不自动成为当前结论。':'以前的原话仍在旅程记录里。');
    }catch(error){if(state.identity===identity)status('analysesStatus',messageText(error),true);}finally{state.analysesLoading=false;}
  }

  $('journeyDate').value=today();selectedView(new URL(location.href).searchParams.get('view'),false);
  window.addEventListener('popstate',()=>selectedView(new URL(location.href).searchParams.get('view'),false));
  window.addEventListener('pageshow',()=>selectedView(new URL(location.href).searchParams.get('view'),false));
  window.addEventListener('pagehide',draftWrite);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')draftWrite();});
  for(const button of document.querySelectorAll('[data-view]'))button.addEventListener('click',()=>selectedView(button.dataset.view));
  for(const link of document.querySelectorAll('[data-view-link]'))link.addEventListener('click',event=>{if(event.button||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();selectedView(link.dataset.viewLink);});
  $('reloadButton').addEventListener('click',initialize);
  $('journeyForm').addEventListener('submit',event=>{event.preventDefault();submitJourney();});$('journeyForm').addEventListener('input',draftWrite);
  $('chatMessage').addEventListener('input',draftWrite);$('copyDraft').addEventListener('click',()=>copy($('journeyContent').value,'saveStatus','原话已复制。'));
  $('checkSave').addEventListener('click',checkPendingSave);$('retrySave').addEventListener('click',()=>submitJourney(true));
  $('filterForm').addEventListener('submit',event=>{event.preventDefault();filterJourneys();});$('resetFilter').addEventListener('click',()=>{$('filterForm').reset();filterJourneys();});
  $('chatForm').addEventListener('submit',event=>{event.preventDefault();sendChat();});
  $('copyChatHandoff').addEventListener('click',()=>copy('请作为小陌的领航助手，与我共同理解和判断。事实、本人感受与 AI 建议分开，一次只问一个关键问题。\n\n我现在想聊：\n'+$('chatMessage').value+'\n\n已保存背景：\n'+contextForHandoff(),'chatStatus'));
  $('useReviewPrompt').addEventListener('click',()=>{if($('chatMessage').value||state.chatPending){status('chatDraftStatus','当前已有问题草稿，先保留它；回看问题可以直接接在聊天里。');return;}$('chatMessage').value='帮我看看这周发生了什么变化。';draftWrite();$('chatMessage').focus();});
  $('restoreReviewDraft').addEventListener('click',bringLegacyToChat);$('copyReviewDraft').addEventListener('click',()=>copy(legacyReviewText(),'legacyReviewStatus','旧回看草稿已完整复制。'));
  $('profileForm').addEventListener('submit',event=>{event.preventDefault();submitProfile();});$('profileForm').addEventListener('input',draftWrite);
  $('profileSection').addEventListener('change',()=>{state.profileTarget=null;renderProfileTarget();draftWrite();});
  $('clearProfileTarget').addEventListener('click',()=>{state.profileTarget=null;renderProfileTarget();draftWrite();});
  $('copyProfileDraft').addEventListener('click',()=>copy($('profileCorrection').value,'profileSaveStatus','这句补充原话已复制。'));
  $('checkProfileSave').addEventListener('click',checkProfileSave);$('retryProfileSave').addEventListener('click',()=>submitProfile(true));
  $('analysesShelf').addEventListener('toggle',()=>{if($('analysesShelf').open)void loadAnalyses();});$('reloadAnalyses').addEventListener('click',()=>loadAnalyses(true));
  $('findDrafts').addEventListener('click',findOtherDrafts);$('closeDrafts').addEventListener('click',()=>$('draftsDialog').close());
  $('closeDetail').addEventListener('click',()=>$('journeyDialog').close());$('closeCopy').addEventListener('click',()=>$('copyDialog').close());
  for(const dialog of [$('journeyDialog'),$('copyDialog'),$('draftsDialog')])dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
  initialize();

})();

