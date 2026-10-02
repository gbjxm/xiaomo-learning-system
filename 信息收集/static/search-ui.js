'use strict';

// Search adds evidence-backed snippets to the existing opportunity list. Saved
// views contain filters, never copies of records. All external text is rendered
// through textContent and the application's existing safe HTTPS link helper.
(() => {
  const local = {query:'',history:false,result:null,pending:false,error:null,serial:0,abort:null,timer:null,
    ui:null,views:[],viewsSerial:0,viewsLoading:false,viewError:null,viewSaving:false,viewRemoving:false,
    selected:null,confirmRemove:null,detailPending:null,detailTimer:null};
  const draftKey='xiaomo-search-view-draft-v1';
  const queryOf=()=>typeof state.search==='string'?state.search.trim():'';
  const listView=()=>['opportunities','starred','archive'].includes(state.view);
  const ready=()=>local.result&&local.query===queryOf()&&local.result.query===queryOf()&&local.result.include_history===local.history;
  const replyValid=(serial,query,history)=>serial===local.serial&&query===queryOf()&&history===local.history&&!state.stopped;
  const redraw=()=>{if(state.data&&!state.stopped&&listView())renderList();};
  function draft(){
    try{sessionStorage.setItem(draftKey,JSON.stringify({name:local.ui?.name.value||'',history:local.history,selected:local.selected}));}catch{/* The saved view itself still uses SQLite. */}
  }
  function restoreDraft(){
    try{const saved=JSON.parse(sessionStorage.getItem(draftKey)||'null');if(!saved||typeof saved!=='object')return;
      if(typeof saved.history==='boolean')local.history=saved.history;
      if(typeof saved.name==='string')local.ui.name.value=saved.name.slice(0,60);
      if(typeof saved.selected==='string'&&/^[a-z0-9_-]{1,64}$/i.test(saved.selected))local.selected=saved.selected;
    }catch{}
  }
  function setStatus(){
    if(!local.ui)return;
    const {status,retry,notice,historyNote,banner}=local.ui,query=queryOf();
    retry.hidden=!local.error;
    retry.disabled=local.pending||!state.data||state.stopped;
    status.textContent=!query?'支持多个词用空格分隔；会在已保存内容中同时查找。':
      local.pending?'正在搜索已保存正文与证据…':local.error?'正文检索未完成：'+local.error+'。暂时仅显示当前记录字段匹配，不能据此判断正文无命中。':
      ready()?`正文与证据检索完成 · ${local.result.items.length} 条机会${local.result.counts.historical_only?' · '+local.result.counts.historical_only+' 条需引用历史命中':''}`:'正文检索等待连接…';
    notice.textContent=ready()?local.result.attachment_notice:'图片和未转录 PDF 没有可检索正文；支持已保存的文本和人工转录。';
    historyNote.textContent=local.history?'已包含历史。旧版命中明确标识，不代表现行规则。':'只查当前记录与最近抓取；旧版记录、旧附件默认不参与。';
    banner.hidden=!query||!listView();banner.textContent=query?status.textContent:'';
    banner.classList.toggle('error',Boolean(local.error));
  }
  function schedule(force=false){
    init();
    const query=queryOf(),history=local.history;
    if(!force&&query===local.query&&(local.pending||ready()||local.error)){setStatus();return;}
    clearTimeout(local.timer);local.abort?.abort();++local.serial;
    local.query=query;local.result=null;local.error=null;local.pending=false;
    if(!query||!state.data||state.stopped){setStatus();return;}
    local.pending=true;setStatus();
    const serial=local.serial;
    local.timer=setTimeout(async()=>{
      if(!replyValid(serial,query,history))return;
      const controller=new AbortController();local.abort=controller;
      try{
        const result=await api('/api/search?q='+encodeURIComponent(query)+'&history='+(history?'1':'0'),undefined,controller.signal);
        if(!replyValid(serial,query,history))return;
        if(!result||result.query!==query||result.include_history!==history||!Array.isArray(result.items))throw new Error('搜索返回内容不一致');
        local.result=result;local.error=null;
      }catch(error){if(!replyValid(serial,query,history)||error.name==='AbortError')return;local.error=error.message||'未连接';}
      finally{if(replyValid(serial,query,history)){local.pending=false;local.abort=null;setStatus();redraw();}}
    },force?0:160);
  }
  function matches(item,query=queryOf()){
    if(!query)return true;
    if(ready())return local.result.items.some(value=>value.id===item.id);
    const content=JSON.stringify(item).toLocaleLowerCase();
    return query.trim().toLocaleLowerCase().split(/\s+/).every(term=>content.includes(term));
  }
  function get(id){return ready()?local.result.items.find(item=>item.id===id)||null:null;}
  function renderCardMatches(card,item){
    const found=get(item.id);if(!found||!found.matches.length)return;
    const panel=el('div','search-match-preview');
    if(found.historical_only)add(panel,el('strong','search-history-warning','检索引用旧版资料 · 不作为现行规则'));
    for(const match of found.matches.slice(0,2)){
      const block=el('div','search-match');add(block,el('small',null,match.label),el('p',null,match.text));
      add(panel,block);
    }
    const show=button('查看命中段落','link-button',event=>{event?.stopPropagation();openHits(item.id);});
    show.setAttribute('aria-label','查看'+item.title+'的正文命中段落');add(panel,show);
    // Never nest a button in the card's detail button; root may also call this
    // hook while constructing a card, before it is connected.
    add(card,panel);
  }
  function onRendered(){
    init();schedule();
    const blank=$('content')?.querySelector('.empty');
    if(queryOf()&&blank&&(local.pending||local.error)){
      const title=blank.querySelector('strong'),copy=blank.children[1];
      if(title)title.textContent=local.pending?'正文与证据仍在搜索':'正文搜索尚未完成';
      if(copy)copy.textContent=local.pending?'当前字段暂未命中；完整检索完成后会自动显示结果。':'暂时只能搜索当前记录字段；请重试，不能据此判断正文或证据没有命中。';
    }
    if(!state.data||!listView()||!ready())return;
    for(const card of document.querySelectorAll('.opportunity-card[data-id]')){
      if(card.querySelector('.search-match-preview'))continue;
      const item=state.data.items.find(value=>value.id===card.dataset.id);if(item)renderCardMatches(card,item);
    }
  }
  function afterDetail(item){
    const found=get(item.id),body=document.querySelector('#detail-content .dialog-body');
    if(!body||!found||body.querySelector('#detail-search-matches'))return;
    const section=el('section','detail-section search-detail-matches');section.id='detail-search-matches';
    add(section,el('h3',null,'本次检索命中段落'),el('p',null,'查询：'+queryOf()+'。摘录用于定位证据；机器提取、个人笔记与历史不等于现行官方规则。'));
    for(const match of found.matches){
      const block=el('article','evidence-row');
      add(block,el('strong',null,match.label+(match.version?' · 版本 '+match.version:'')),
        match.historical?el('p','search-history-warning','历史资料 · 非现行规则'):null,
        match.at?el('small',null,fmt(match.at)):null,el('p',null,match.text));
      if(match.source_url)add(block,link('证据官方来源 ↗',match.source_url));
      if(match.related_item_id&&match.related_item_id!==item.id)add(block,button('打开关联来源原记录','link-button',()=>openDetail(match.related_item_id)));
      add(section,block);
    }
    if(found.more_matches)add(section,el('small',null,'另有 '+found.more_matches+' 处命中；可查看完整证据或旧版全文。'));
    const tail=body.querySelector('.decision-provenance')||body.querySelector('details');
    if(tail)tail.before(section);else add(body,section);
    if(local.detailPending===item.id){local.detailPending=null;section.tabIndex=-1;section.scrollIntoView({block:'start'});section.focus({preventScroll:true});}
  }
  async function openHits(id){
    local.detailPending=id;
    await openDetail(id);
    if(state.detailId!==id||!$('detail').open){if(local.detailPending===id)local.detailPending=null;return;}
    const item=state.data.items.find(value=>value.id===id);if(item)afterDetail(item);
  }
  function renderViews(){
    if(!local.ui)return;
    const {select,save,apply,remove,cancelRemove,confirmRemove,statusView,name}=local.ui;
    const selected=local.selected;select.replaceChildren();
    const first=el('option',null,'选择已保存的筛选');first.value='';add(select,first);
    for(const value of local.views){const option=el('option',null,value.data.name);option.value=value.id;add(select,option);}
    if(local.views.some(value=>value.id===selected))select.value=selected;else {select.value='';local.selected=null;}
    const record=local.views.find(value=>value.id===local.selected),busy=local.viewSaving||local.viewRemoving;
    select.disabled=busy||local.viewsLoading;name.disabled=busy;
    save.disabled=busy||!state.data||state.restorePending||state.stopped;
    apply.disabled=busy||!record||!state.data;remove.disabled=busy||!record||state.restorePending||state.stopped;
    save.textContent=local.viewSaving?'保存中…':record?'更新所选视图':'保存当前筛选';
    confirmRemove.hidden=!local.confirmRemove;cancelRemove.hidden=!local.confirmRemove;
    confirmRemove.disabled=busy;cancelRemove.disabled=busy;
    statusView.textContent=local.viewError|| (local.viewsLoading?'正在读取保存视图…':local.viewRemoving?'正在移除视图…':
      local.confirmRemove?'将移除“'+local.confirmRemove.data.name+'”；机会、笔记和关注仍保留。':local.views.length?'保存的是条件，每次打开都会重新筛选当前资料。':'尚未保存常用筛选。');
  }
  async function loadViews(){
    if(!state.data||state.stopped||local.viewSaving||local.viewRemoving)return;
    const serial=++local.viewsSerial;local.viewsLoading=true;local.viewError=null;renderViews();
    try{const result=await api('/api/saved-views');if(serial!==local.viewsSerial||state.stopped)return;
      const values=Array.isArray(result)?result:result.views;if(!Array.isArray(values))throw new Error('视图读取结果不完整');local.views=values;
    }catch(error){if(serial===local.viewsSerial)local.viewError='保存视图读取失败：'+error.message+'；已有输入仍保留。';}
    finally{if(serial===local.viewsSerial){local.viewsLoading=false;renderViews();}}
  }
  function filters(){
    const values={};for(const key of ['view','kind','search','platform','status','reward','sort','fit'])values[key]=state[key];
    if(!['opportunities','starred','archive'].includes(values.view))values.view='opportunities';
    values.search=values.search.trim();values.include_history=local.history;return values;
  }
  async function saveView(){
    if(local.viewSaving||local.viewRemoving||!state.data||state.stopped||state.restorePending)return;
    const name=local.ui.name.value.trim();if(!name){local.viewError='请为当前筛选填写名称。';renderViews();local.ui.name.focus();return;}
    const original=local.views.find(value=>value.id===local.selected),payload={data:{name,filters:filters()},id:original?.id||null,expected_revision:original?.revision??0};
    ++local.viewsSerial;local.viewsLoading=false;
    draft();local.viewSaving=true;local.viewError=null;local.confirmRemove=null;renderViews();
    try{const result=await api('/api/saved-views',payload);const record=result.record||result.view||result;
      if(!record?.id)throw new Error('保存结果未获确认，请重读视图后核对');
      local.views=local.views.filter(value=>value.id!==record.id);local.views.push(record);local.selected=record.id;draft();toast('筛选视图已保存；机会没有复制。');
    }catch(error){local.viewError='视图未确认保存：'+error.message+'；名称草稿仍保留。';}
    finally{local.viewSaving=false;renderViews();}
  }
  function applyView(){
    const record=local.views.find(value=>value.id===local.selected);if(!record||local.viewSaving||local.viewRemoving)return;
    const values=record.data.filters,options=[...$('platform').options].map(value=>value.value);
    if(!options.includes(values.platform)){local.viewError='保存的平台“'+values.platform+'”当前没有对应筛选项；请先核对条件，未自动放宽范围。';renderViews();return;}
    local.abort?.abort();++local.serial;local.query='';local.result=null;local.error=null;local.pending=false;
    for(const key of ['kind','search','platform','status','reward','sort','fit'])state[key]=values[key];
    local.history=Boolean(values.include_history);local.ui.history.checked=local.history;syncFilters();persistUI();draft();
    setView(values.view,false);schedule(true);toast('已应用“'+record.data.name+'”；结果按当前资料重新计算。');
  }
  async function removeView(){
    if(local.viewSaving||local.viewRemoving||!local.confirmRemove||state.restorePending)return;
    const record=local.confirmRemove;++local.viewsSerial;local.viewsLoading=false;local.viewRemoving=true;local.viewError=null;renderViews();
    try{await api('/api/saved-views/remove',{id:record.id,expected_revision:record.revision,confirmed:true});
      local.views=local.views.filter(value=>value.id!==record.id);if(local.selected===record.id)local.selected=null;local.confirmRemove=null;draft();toast('已移除视图；机会资料保留。');
    }catch(error){local.viewError='移除结果待核对：'+error.message+'；请重读视图后再操作。';}
    finally{local.viewRemoving=false;renderViews();}
  }
  function init(){
    if(local.ui)return;
    const tools=$('opportunity-tools');if(!tools)return;
    const panel=el('details','search-tools');panel.id='search-tools';
    add(panel,el('summary',null,'检索范围与常用筛选'));
    const wrap=el('div','search-tools-content'),label=el('label','search-history-control'),history=el('input');history.type='checkbox';history.id='search-history';
    add(label,history,' 包含旧版记录与旧附件');
    const status=el('p','search-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    const historyNote=el('p','search-scope-note'),notice=el('p','search-scope-note');
    const retry=button('重试正文搜索','link-button',()=>schedule(true));retry.hidden=true;
    add(wrap,label,status,retry,historyNote,notice);
    const group=el('section','saved-view-tools');add(group,el('h3',null,'保存动态筛选'));
    const select=el('select');select.id='saved-view-select';select.setAttribute('aria-label','已保存的筛选视图');
    const name=el('input');name.type='text';name.id='saved-view-name';name.maxLength=60;name.placeholder='例如：开放的AI短片比赛';name.setAttribute('aria-label','筛选视图名称');
    const actions=el('div','saved-view-actions'),save=button('保存当前筛选',null,saveView),apply=button('应用所选视图',null,applyView);
    const fresh=button('另存新视图','link-button',()=>{if(local.viewSaving||local.viewRemoving)return;local.selected=null;local.confirmRemove=null;draft();renderViews();name.focus();});
    const reread=button('重读保存视图','link-button',loadViews),remove=button('移除所选视图','link-button',()=>{local.confirmRemove=local.views.find(value=>value.id===local.selected)||null;local.viewError=null;renderViews();});
    const confirmRemove=button('确认移除视图','link-button',removeView),cancelRemove=button('取消移除','link-button',()=>{local.confirmRemove=null;renderViews();});
    confirmRemove.hidden=true;cancelRemove.hidden=true;
    const statusView=el('p','saved-view-status');statusView.setAttribute('role','status');
    add(actions,save,apply,fresh,reread,remove,confirmRemove,cancelRemove);add(group,select,name,actions,statusView);add(wrap,group);add(panel,wrap);add(tools,panel);
    const banner=el('p','search-result-status');banner.id='search-result-status';banner.hidden=true;banner.setAttribute('role','status');banner.setAttribute('aria-live','polite');add(tools,banner);
    local.ui={panel,history,status,retry,historyNote,notice,select,name,save,apply,remove,confirmRemove,cancelRemove,statusView,banner};restoreDraft();history.checked=local.history;
    history.addEventListener('change',()=>{local.history=history.checked;draft();schedule(true);redraw();});
    name.addEventListener('input',()=>{local.viewError=null;draft();});
    select.addEventListener('change',()=>{local.selected=select.value||null;const record=local.views.find(value=>value.id===local.selected);
      if(record)name.value=record.data.name;local.confirmRemove=null;local.viewError=null;draft();renderViews();});
    panel.addEventListener('toggle',()=>{if(panel.open&&!local.views.length&&!local.viewsLoading&&state.data)loadViews();});
    $('search').addEventListener('input',()=>schedule());$('clear-search').addEventListener('click',()=>schedule());
    setStatus();renderViews();if(state.data)loadViews();
  }
  function invalidate(){
    clearTimeout(local.timer);local.abort?.abort();++local.serial;local.result=null;local.query='';local.error=null;local.pending=false;
    schedule(true);loadViews();
  }
  window.librarySearch={init,schedule,matches,get,ids:()=>ready()?new Set(local.result.items.map(item=>item.id)):null,
    renderCardMatches,onRendered,afterDetail,openHits,loadViews,invalidate,includeHistory:()=>local.history,
    pending:()=>local.viewSaving||local.viewRemoving};
  init();if(state.data){schedule();redraw();}
})();
