'use strict';
/* Cross-area references. Original module content and permissions stay separate. */
(() => {
  const mode=['production','isolated'].includes(document.body.dataset.spaceMode)?document.body.dataset.spaceMode:'readonly';
  const API='/api/workspace';
  const kinds={learning:'学习',material:'素材',topic:'研究专题',opportunity:'机会',work:'作品'};
  const modules={learning:['learning'],observatory:['material','topic'],information:['opportunity','work']};
  const moduleLabels={learning:'学习小岛',observatory:'素材观察室',information:'信息收集'};
  const availability={available:'可查看',archived:'已归档',deleted:'已删除',missing:'暂不可用'};
  const node=(tag,className,value)=>{const el=document.createElement(tag);if(className)el.className=className;if(value!==undefined)el.textContent=value;return el;};
  const key=ref=>JSON.stringify([ref.module,ref.kind,ref.storeId,String(ref.id)]);
  const same=(a,b)=>!!a&&!!b&&key(a)===key(b);
  const stable=value=>{const ordered=input=>Array.isArray(input)?input.map(ordered):input&&typeof input==='object'?Object.fromEntries(Object.keys(input).sort().map(name=>[name,ordered(input[name])])):input;return JSON.stringify(ordered(value));};
  const valid=ref=>!!ref&&modules[ref.module]?.includes(ref.kind)&&typeof ref.storeId==='string'&&!!ref.storeId&&['string','number'].includes(typeof ref.id)&&String(ref.id).length>0;
  const copy=ref=>({module:ref.module,kind:ref.kind,storeId:ref.storeId,id:ref.id});
  function validPending(value,ref){
    const body=value?.body,input=body?.input;
    if(!valid(value?.source)||!same(value.source,ref)||!body?.identity||!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<0||typeof body.submissionId!=='string'||!body.submissionId||!input)return false;
    if(body.action==='link')return valid(input.a)&&valid(input.b)&&same(input.a,ref)&&input.a.module!==input.b.module&&valid(value.target?.ref)&&same(value.target.ref,input.b);
    return body.action==='unlink'&&typeof input.edgeId==='string'&&!!input.edgeId&&valid(value.target?.ref)&&value.target.ref.module!==ref.module;
  }
  const live=record=>['available','archived'].includes(record.availability);
  function safeHref(value){
    if(typeof value!=='string')return null;
    const candidate=value.trim();if(!candidate||candidate.startsWith('//')||/[\\\u0000-\u001f\u007f]/.test(candidate))return null;
    try{const url=new URL(candidate,location.href);return url.origin===location.origin&&['http:','https:'].includes(url.protocol)&&!url.username&&!url.password&&/^\/(learning|observatory|information)\/(?:index\.html)?$/.test(url.pathname)?url.pathname+url.search+url.hash:null;}catch{return null;}
  }
  function storageKey(ref){return 'xiaomo.workspace.relations.v1:'+mode+':'+key(ref);}
  function recall(ref){try{return JSON.parse(sessionStorage.getItem(storageKey(ref))||'{}');}catch{return {};}}
  function remember(ref,value){try{sessionStorage.setItem(storageKey(ref),JSON.stringify(value));}catch{}}
  async function request(route,options={}){
    let response,body;
    try{response=await fetch(API+route,{cache:'no-store',...options});}
    catch{throw Object.assign(new Error('连接结果未确认。输入与提交标识已保留，可核对后重试。'),{uncertain:options.method==='POST'});}
    try{body=await response.json();}catch{throw Object.assign(new Error('响应未能核对。请保留当前选择，再重新加载。'),{status:response.status,uncertain:options.method==='POST'});}
    if(!response.ok||!body.ok){const error=body.error||{};throw Object.assign(new Error(error.message||'关联入口暂不可用。当前模块仍可正常使用。'),error,{status:response.status,uncertain:options.method==='POST'&&response.status>=500});}
    return body.data;
  }
  function relationRoute(ref){return '/relations?'+new URLSearchParams({module:ref.module,kind:ref.kind,id:ref.id,storeId:ref.storeId});}
  function actionButton(label,callback){const button=node('button','workspace-relation-button',label);button.type='button';button.addEventListener('click',callback);return button;}
  function targetLabel(record){return record.kindLabel||kinds[record.ref?.kind||record.otherRef?.kind]||'记录';}
  let controller=null,lastContext=null;

  class RelationPanel {
    constructor(ref,mount){
      this.ref=copy(ref);this.root=node('section','workspace-relations');this.root.dataset.contextKey=key(ref);this.root.setAttribute('aria-label','跨区域关联');
      this.saved=recall(ref);this.selected=this.saved.selected&&valid(this.saved.selected.ref)?this.saved.selected:null;
      this.pending=validPending(this.saved.pending,ref)?this.saved.pending:null;
      this.undo=this.saved.undo&&same(this.saved.undo.a,ref)&&valid(this.saved.undo.b)?this.saved.undo:null;
      this.relations=[];this.items=[];this.catalogErrors=[];this.catalogSequence=0;this.loadSequence=0;this.busy=false;this.ready=false;this.disposed=false;
      this.build();this.adopt(mount);this.reload();
    }
    save(){remember(this.ref,{selected:this.selected,pending:this.pending,undo:this.undo,query:this.query.value,kind:this.kind.value});}
    adopt(mount){if(!(mount instanceof HTMLElement)||!mount.isConnected)return;this.mount=mount;if(mount.firstChild!==this.root||mount.childNodes.length!==1)mount.replaceChildren(this.root);}
    dispose(){this.disposed=true;clearTimeout(this.searchTimer);this.root.remove();}
    build(){
      const heading=node('div','workspace-relations-heading');heading.append(node('h2','','关联到其他区域'));
      this.reloadButton=actionButton('重新加载',()=>this.reload(true));this.reloadButton.id='workspaceRelationsReload';heading.append(this.reloadButton);
      this.badge=node('p','workspace-relations-target','正在核对关联保存位置…');
      this.list=node('ul','workspace-relations-list');this.list.setAttribute('aria-label','已保存的跨区关联');
      this.status=node('p','workspace-relations-status','');this.status.id='workspaceRelationsStatus';this.status.setAttribute('role','status');this.status.setAttribute('aria-live','polite');
      this.pendingBox=node('div','workspace-relations-pending');this.pendingBox.hidden=true;
      this.undoBox=node('div','workspace-relations-undo');this.undoBox.hidden=true;
      this.root.append(heading,this.badge,this.list,this.pendingBox,this.undoBox,this.status);
      this.editor=node('details','workspace-relations-editor');this.editor.open=false;this.editor.append(node('summary','','添加关联'));
      this.editor.append(node('p','workspace-relations-hint','选择另一处已有记录，建立双方都能查看的引用。不会改动原内容。'));
      const controls=node('div','workspace-relations-controls');
      const queryLabel=node('label','','搜索已有记录');queryLabel.htmlFor='workspaceRelationQuery';this.query=node('input','');this.query.id='workspaceRelationQuery';this.query.type='search';this.query.maxLength=2000;this.query.placeholder='标题或记得的词';this.query.value=this.saved.query||'';
      const kindLabel=node('label','','选择类型');kindLabel.htmlFor='workspaceRelationKind';this.kind=node('select','');this.kind.id='workspaceRelationKind';
      this.kind.append(node('option','','其他区域的全部类型'));this.kind.firstElementChild.value='';
      for(const [module,values]of Object.entries(modules))if(module!==this.ref.module)for(const kind of values){const option=node('option','',kinds[kind]);option.value=kind;this.kind.append(option);}
      if([...this.kind.options].some(option=>option.value===this.saved.kind))this.kind.value=this.saved.kind;
      controls.append(queryLabel,this.query,kindLabel,this.kind);this.editor.append(controls);
      this.results=node('div','workspace-relations-results');this.results.setAttribute('role','group');this.results.setAttribute('aria-label','可选择的已有记录');this.editor.append(this.results);
      this.selection=node('div','workspace-relations-selection');this.editor.append(this.selection);
      this.linkButton=actionButton('建立关联',()=>{if(this.selected)this.submit('link',{a:copy(this.ref),b:copy(this.selected.ref)},this.selected);});this.linkButton.id='workspaceRelationSave';this.linkButton.classList.add('workspace-relation-primary');this.editor.append(this.linkButton);
      this.root.append(this.editor);
      this.query.addEventListener('input',()=>{this.save();clearTimeout(this.searchTimer);this.searchTimer=setTimeout(()=>this.loadCatalog(),180);});
      this.query.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();event.stopPropagation();this.loadCatalog();}});
      this.kind.addEventListener('change',()=>{this.save();this.loadCatalog();});
      this.editor.addEventListener('toggle',()=>{if(this.editor.open&&this.ready)this.loadCatalog();});
      this.renderSelection();this.renderPending();this.updateButtons();
    }
    writable(){return mode!=='readonly'&&this.bootstrap?.scope===mode&&this.ready;}
    updateButtons(){
      this.reloadButton.disabled=this.busy;
      this.linkButton.disabled=this.busy||!this.writable()||!this.selected||!live(this.selected)||!!this.pending||this.relations.some(relation=>same(relation.otherRef,this.selected?.ref));
      this.editor.hidden=mode==='readonly';
      for(const button of this.list.querySelectorAll('button'))button.disabled=this.busy||!this.writable()||!!this.pending;
      for(const button of this.undoBox.querySelectorAll('button'))button.disabled=this.busy||!this.writable()||!!this.pending;
      for(const button of this.pendingBox.querySelectorAll('button'))button.disabled=this.busy||!this.writable();
    }
    async reload(explicit=false){
      const sequence=++this.loadSequence;this.status.textContent='正在读取已保存的关联…';this.ready=false;this.updateButtons();
      try{
        const bootstrap=await request('/bootstrap'),snapshot=await request(relationRoute(this.ref));
        if(this.disposed||sequence!==this.loadSequence)return;
        if(!bootstrap.identity||!bootstrap.token||!snapshot.identity||stable(snapshot.identity)!==stable(bootstrap.identity)||!same(snapshot.ref,this.ref))throw new Error('关联数据身份不一致，尚未提交。请重新打开当前空间核对。');
        this.bootstrap=bootstrap;this.revision=snapshot.revision;this.relations=snapshot.relations||[];this.ready=true;
        if(this.undo&&this.relations.some(relation=>same(relation.otherRef,this.undo.b))){this.undo=null;this.save();}
        const scope=bootstrap.scope;
        this.badge.textContent=mode==='readonly'?(scope==='production'?'只读预览 · 正式关联记录':'只读预览 · 隔离关联记录'):scope==='production'?'正式关联记录':scope==='isolated'?'隔离验证关联 · 不写正式资料':'关联目标尚未核实';
        this.badge.dataset.scope=scope;
        this.renderRelations();this.renderUndo();this.renderPending();
        this.status.textContent=mode!=='readonly'&&scope!==mode?'关联保存位置与当前空间模式不一致，暂不提交。':explicit?'已重新读取。当前选择保留，可按最新状态继续。':'';
        if(this.pending)this.status.textContent='上次提交结果仍待核对。选择与原提交标识已保留，可用同一标识重试。';
        this.updateButtons();if(this.editor.open)await this.loadCatalog();
      }catch(error){if(this.disposed||sequence!==this.loadSequence)return;this.badge.textContent='关联保存位置尚未核实';this.status.textContent='关联暂未读取：'+error.message+' 当前模块内容仍可使用。';this.updateButtons();}
    }
    renderRelations(){
      this.list.replaceChildren();
      if(!this.relations.length){this.list.append(node('li','workspace-relations-empty','尚无跨区关联。素材与专题等本区关系继续由原模块管理。'));return;}
      for(const relation of this.relations){
        const row=node('li','workspace-relation-row');row.dataset.edgeId=relation.edgeId;
        const href=live(relation)?safeHref(relation.href):null,body=node(href?'a':'div','workspace-relation-record');if(href)body.href=href;
        body.append(node('small','workspace-relation-kind',targetLabel(relation)),node('strong','',relation.title||'未命名记录'));
        if(relation.availability!=='available')body.append(node('span','workspace-relation-availability',availability[relation.availability]||'状态待核对'));
        row.append(body);
        if(mode!=='readonly'){const unlink=actionButton('解除',()=>this.submit('unlink',{edgeId:relation.edgeId},{...relation,ref:relation.otherRef}));unlink.classList.add('workspace-relation-unlink');unlink.setAttribute('aria-label','解除与'+(relation.title||'这条记录')+'的关联，原内容保留');row.append(unlink);}
        this.list.append(row);
      }
    }
    async loadCatalog(){
      if(!this.ready||mode==='readonly')return;
      const sequence=++this.catalogSequence;this.results.textContent='正在查找已有记录…';
      try{
        const data=await request('/catalog?'+new URLSearchParams({query:this.query.value.trim(),kind:this.kind.value}));
        if(this.disposed||sequence!==this.catalogSequence)return;
        this.items=(data.items||[]).filter(item=>valid(item.ref)&&item.ref.module!==this.ref.module);
        this.catalogErrors=Array.isArray(data.errors)?data.errors:[];
        const refreshed=this.selected&&this.items.find(item=>same(item.ref,this.selected.ref));if(refreshed)this.selected=refreshed;
        this.renderCatalog();this.renderSelection();this.save();this.updateButtons();
      }catch(error){if(!this.disposed&&sequence===this.catalogSequence)this.results.textContent='查找尚未完成：'+error.message;}
    }
    renderCatalog(){
      this.results.replaceChildren();
      if(this.catalogErrors.length){const regions=[...new Set(this.catalogErrors.map(error=>moduleLabels[error.module]||'相关区域'))];const warning=node('p','workspace-relations-catalog-warning','部分区域暂未读到：'+regions.join('、')+'。以下结果不完整，当前选择保留。');warning.setAttribute('role','status');this.results.append(warning);}
      if(!this.items.length){this.results.append(node('p','workspace-relations-empty',this.catalogErrors.length?'可选记录尚未完整读取。恢复对应区域后可重新查找。':'没有这组可选记录。可以换一个词或类型。'));return;}
      for(const item of this.items){
        const linked=this.relations.some(relation=>same(relation.otherRef,item.ref));
        const button=actionButton('',()=>{this.selected={...item,ref:copy(item.ref)};this.renderCatalog();this.renderSelection();this.save();this.updateButtons();this.linkButton.focus({preventScroll:true});});
        button.classList.add('workspace-relation-choice');button.id='workspaceRelationTarget-'+encodeURIComponent(key(item.ref));button.setAttribute('aria-pressed',String(same(this.selected?.ref,item.ref)));button.disabled=!live(item)||linked||this.busy;
        button.append(node('small','',targetLabel(item)),node('strong','',item.title||'未命名记录'));
        if(linked||item.availability!=='available')button.append(node('span','',linked?'已关联':availability[item.availability]||'状态待核对'));
        this.results.append(button);
      }
    }
    renderSelection(){
      this.selection.replaceChildren();if(!this.selected){this.selection.append(node('p','','尚未选择目标。'));return;}
      this.selection.append(node('p','','已选择：'+(this.selected.title||'未命名记录')));
      if(this.relations.some(relation=>same(relation.otherRef,this.selected.ref)))this.selection.append(node('p','workspace-relations-hint','这条记录已关联，两端均可查看。'));
      if(!live(this.selected))this.selection.append(node('p','workspace-relations-hint','这条记录目前不可建立新关联。当前选择仍保留，可重新加载核对。'));
      const clear=actionButton('清除选择',()=>{this.selected=null;this.renderCatalog();this.renderSelection();this.save();this.updateButtons();});clear.disabled=this.busy;this.selection.append(clear);
    }
    renderPending(){
      this.pendingBox.replaceChildren();this.pendingBox.hidden=!this.pending;if(!this.pending)return;
      this.pendingBox.append(node('p','','提交结果未确认，原提交标识已保留。'));
      this.pendingBox.append(actionButton('同标识重试核对',()=>this.sendPending()));
    }
    renderUndo(){
      this.undoBox.replaceChildren();this.undoBox.hidden=!this.undo||mode==='readonly';if(!this.undo)return;
      this.undoBox.append(node('p','','刚解除与“'+(this.undo.title||'这条记录')+'”的关联。原内容保留。'));
      this.undoBox.append(actionButton('撤销解除',()=>this.submit('link',{a:copy(this.undo.a),b:copy(this.undo.b)},{ref:copy(this.undo.b),title:this.undo.title},true)));
    }
    async submit(action,input,target,undo=false){
      if(this.busy||!this.writable()||this.pending)return;
      if(action==='link'&&(!target||!valid(target.ref)))return;
      this.pending={source:copy(this.ref),body:{identity:this.bootstrap.identity,expectedRevision:this.revision,submissionId:crypto.randomUUID(),action,input},target:target?{ref:copy(target.ref),title:target.title||''}:null,undo};
      this.save();this.renderPending();await this.sendPending();
    }
    async sendPending(){
      if(this.busy||!this.writable()||!this.pending)return;
      if(!validPending(this.pending,this.ref)||stable(this.pending.body.identity)!==stable(this.bootstrap.identity)){this.status.textContent='原提交标识与当前数据身份不匹配，尚未重试。请在原保存位置核对这次提交。';return;}
      const pending=this.pending;let actionConfirmed=false;this.busy=true;this.status.textContent='正在保存并核对关联…';this.updateButtons();
      try{
        const result=await request('/action',{method:'POST',headers:{'Content-Type':'application/json','X-Workspace-Token':this.bootstrap.token},body:JSON.stringify(pending.body)});
        if(result.verification?.persisted!==true||result.verification?.snapshotVerified!==true)throw Object.assign(new Error('提交收据尚未确认，原标识保留。'),{uncertain:true});
        actionConfirmed=true;
        if(stable(result.identity)!==stable(this.bootstrap.identity))throw Object.assign(new Error('提交收据的数据身份不一致，原标识保留。'),{uncertain:true});
        const snapshot=await request(relationRoute(this.ref));
        if(!same(snapshot.ref,this.ref)||stable(snapshot.identity)!==stable(this.bootstrap.identity))throw Object.assign(new Error('回读的数据身份不一致，提交标识保留。'),{uncertain:true});
        const confirmed=pending.body.action==='link'?snapshot.relations.some(relation=>same(relation.otherRef,pending.body.input.b)):!snapshot.relations.some(relation=>relation.edgeId===pending.body.input.edgeId);
        if(!confirmed)throw Object.assign(new Error('关联回读未确认。请按原标识核对重试。'),{uncertain:true});
        this.revision=snapshot.revision;this.relations=snapshot.relations;this.pending=null;
        if(pending.body.action==='unlink')this.undo={a:copy(this.ref),b:copy(pending.target.ref),title:pending.target.title};
        else{if(pending.undo||same(this.undo?.b,pending.body.input.b))this.undo=null;if(same(this.selected?.ref,pending.body.input.b))this.selected=null;}
        this.save();
        if(!this.disposed){this.renderRelations();this.renderUndo();this.renderPending();this.renderCatalog();this.renderSelection();this.status.textContent=pending.body.action==='unlink'?'关联已解除并回读，原资料保留。':'关联已保存并回读，两端均可查看。';this.root.dispatchEvent(new CustomEvent('workspace:relations-changed',{bubbles:true,detail:{ref:copy(this.ref),revision:this.revision}}));}
      }catch(error){
        if(!actionConfirmed&&error.status===409){this.pending=null;this.ready=false;this.save();if(!this.disposed){this.renderPending();this.status.textContent='关联版本已变化，本次未覆盖。当前选择保留，请点“重新加载”核对后再提交。';}}
        else if(!actionConfirmed&&error.status&&error.status<500&&!error.uncertain){this.pending=null;this.save();if(!this.disposed){this.renderPending();this.status.textContent='尚未保存：'+error.message;}}
        else if(!this.disposed){this.status.textContent='结果未确认：'+error.message;this.renderPending();}
      }finally{this.busy=false;if(!this.disposed)this.updateButtons();}
    }
  }
  function setContext(detail){
    if(detail?.ref===null){controller?.dispose();controller=null;lastContext=null;return;}
    if(!detail?.ref||!valid(detail.ref)||!(detail.mount instanceof HTMLElement)||!detail.mount.isConnected)return;
    lastContext=detail;
    if(controller&&same(controller.ref,detail.ref)){controller.adopt(detail.mount);return;}
    controller?.dispose();controller=new RelationPanel(detail.ref,detail.mount);
  }
  addEventListener('workspace:context',event=>setContext(event.detail));
  addEventListener('workspace:records-changed',event=>{if(controller&&(!event.detail?.module||event.detail.module===controller.ref.module))controller.reload(true);});
  addEventListener('pagehide',()=>controller?.save());
  if(window.workspaceLastContext)setContext(window.workspaceLastContext);
  dispatchEvent(new Event('workspace:context-request'));
})();
