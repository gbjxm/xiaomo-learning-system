'use strict';
/* Layout derived from saved records. Daily writes remain in the original module. */
(() => {
  if (document.body.dataset.previewRegion !== 'observatory') return;
  const main = document.getElementById('main');
  if (!main) return;
  const mode=['production','isolated'].includes(document.body.dataset.spaceMode)?document.body.dataset.spaceMode:'readonly';
  const readonly=mode==='readonly';
  const API = '/api/observatory';
  const kinds = { link:'链接', text:'文字', recollection:'回忆描述', mixed:'组合素材', attachment:'文件', image:'图片', video:'视频' };
  const topicStates = { draft:'问题整理', researching:'研究中', paused:'暂停 · 可继续', stage_complete:'阶段完成', archived:'已归档', deleted:'已删除 · 可恢复' };
  const writes = new Set(['add','research','feeling','edit-material','edit-topic','mark','archive','delete-material','restore-material','archive-topic','delete-topic','restore-topic','detach','append-files','remove-mark','link','unlink']);
  let materials = new Map(), topics = [], attachments = new Map(), loaded = false, readSequence = 0, sourceIdentity = null, emittedMount = null, emittedKey = '';
  let queued = false, feedbackTimer, currentReader = null, railTargets = [], positionQueued = false, sourcePage = null, sourceTimer;
  const text = (tag, className, value) => { const node=document.createElement(tag); if(className)node.className=className; node.textContent=value; return node; };
  const materialHref = id => '#material/' + encodeURIComponent(id);
  const topicHref = id => '#topic/' + encodeURIComponent(id);
  const byMaterial = item => topics.filter(topic => topic.materialIds?.includes(item.materialId));
  const currentTopics = item => byMaterial(item).filter(topic => !['archived','deleted'].includes(topic.status));
  function feedback(message) {
    const box=document.getElementById('previewFeedback') || document.getElementById('toast');
    if (!box) return;
    box.textContent=message;box.hidden=false;clearTimeout(feedbackTimer);
    feedbackTimer=setTimeout(()=>{box.hidden=true;},7000);
  }
  function markReadonly() {
    if(!readonly)return;
    for (const button of document.querySelectorAll('[data-action]')) {
      const action=button.dataset.action;
      if (writes.has(action) || action.startsWith('export-')) {
        button.classList.add('obs-readonly-control');
        button.title='只读预览：请在正式页面保存或修改';
      }
    }
  }
  // Run before the original delegated action listener so it cannot prepare a write.
  document.addEventListener('click',event=>{
    if(!readonly)return;
    const button=event.target.closest('[data-action]');
    const action=button?.dataset.action;
    if (!action || (!writes.has(action) && !action.startsWith('export-'))) return;
    event.preventDefault();event.stopImmediatePropagation();
    feedback(action.startsWith('export-')
      ? '当前只读预览尚未生成成果包。可浏览原文或下载已保存的原件；导出请打开“正式使用”。'
      : '当前为只读预览，收藏、修改与新建研究尚未提交。阅读已有记录可继续；保存请打开右上角“正式使用”。');
  },true);
  document.addEventListener('change',event=>{
    if (readonly && event.target.matches('input[type=file]')) feedback('选中的文件尚未上传，预览不会登记或关联附件。');
  });
  async function get(route) {
    const response=await fetch(API+route,{cache:'no-store'}),result=await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error?.message || '未读到保存记录');
    return result.data;
  }
  async function loadRecords() {
    const sequence=++readSequence;loaded=false;
    const [bootstrap,m,t,a]=await Promise.all([get('/bootstrap'),get('/materials?status=all'),get('/topics'),get('/attachments')]);
    if(sequence!==readSequence)return;
    const identity=m.identity;
    if (!identity || ![bootstrap,t,a].every(data=>data.identity?.storeId===identity.storeId && data.identity?.canonicalDbPath===identity.canonicalDbPath && data.identity?.scope===identity.scope)) throw new Error('数据身份不一致，未补充预览内容');
    sourceIdentity=bootstrap.identity;
    materials=new Map(m.records.map(item=>[item.materialId,item]));topics=t.records;attachments=new Map(a.records.filter(record=>record.status==='registered').map(record=>[record.attachmentId,record]));loaded=true;
    // A manual reload may finish the original render before these three reads.
    // Re-derive the decorations from the refreshed snapshot without duplicating them.
    for(const row of main.querySelectorAll('.material-row[data-material-id]')){delete row.dataset.obsPolished;row.querySelector('.obs-research-status')?.remove();}
    const layout=main.querySelector('.material-layout');if(layout)delete layout.dataset.obsPolished;
    const banner=document.getElementById('datasetBanner');
    if (banner && readonly && identity.scope==='production') { banner.textContent='已保存的正式收藏 · 当前为只读预览';banner.title='原始数据身份与保存位置可在页尾查看'; }
    schedule();
  }
  function coverFallback(anchor,item) {
    const plate=text('span','obs-text-cover','');
    const textFile=(item.attachmentIds || []).some(id=>attachments.get(id)?.mimeType?.startsWith('text/'));
    plate.append(text('small','',textFile?'文字附件':kinds[item.original?.kind] || '素材'));
    const name=String(item.title || item.original?.source?.title || '未命名素材').replace(/^测试案例[｜|]/,'').trim();
    plate.append(text('strong','',name),text('span','',textFile || item.original?.kind==='text'?'已保存文字 · 未使用配图':'未设置图片 · 浏览原始素材'));
    anchor.replaceChildren(plate);anchor.removeAttribute('data-media-kind');
  }
  function cover(anchor,item) {
    anchor.id='obs-cover-'+item.materialId;
    anchor.setAttribute('aria-label','查看素材：'+(item.title || '未命名素材'));
    const candidate=(item.attachmentIds || []).map(id=>attachments.get(id)).find(record=>record?.mimeType?.startsWith('image/'));
    if (!candidate) { coverFallback(anchor,item);return; }
    anchor.dataset.mediaKind=item.original?.kind || 'image';
    const img=document.createElement('img');img.src=API+'/attachments/'+encodeURIComponent(candidate.attachmentId);img.alt='';img.loading='eager';img.decoding='async';
    const label=/示意/.test(candidate.originalFilename)?'已存示意图':item.original?.kind==='video'?'已存定位图':'已存图片';
    const caption=text('span','obs-cover-caption',label);
    anchor.replaceChildren(img,caption);
    img.addEventListener('error',()=>{coverFallback(anchor,item);anchor.querySelector('.obs-text-cover>span').textContent='图片暂未显示 · 原件可在详情核对';anchor.classList.add('obs-cover-error');},{once:true});
  }
  function researchStatus(row,item) {
    const side=row.querySelector('.row-side');if(!side)return;
    const allLinked=byMaterial(item),linked=currentTopics(item),stageCount=linked.reduce((sum,topic)=>sum+(topic.stages?.length||0),0);
    const status=text('div','obs-research-status','');
    if (stageCount) {
      const paused=linked.some(topic=>topic.status==='paused');status.dataset.paused=String(paused);
      status.append(text('strong','',paused?'研究暂停':'已有研究'),text('span','',stageCount+' 个已保存阶段'));
      status.title='已保存阶段不代表所有原件或连续声画已读；具体读取范围见专题来源。';
      const target=linked.find(topic=>topic.stages?.length);
      if(target){const link=text('a','','读已有解读 →');link.href=topicHref(target.topicId);link.id='obs-row-research-'+item.materialId+'-'+target.topicId;status.append(link);}
    } else if(allLinked.some(topic=>['archived','deleted'].includes(topic.status))) status.append(text('strong','','暂无活跃研究正文'),text('span','','已有归档或删除历史，详情仍可查看'));
    else if(linked.length) status.append(text('strong','','问题已整理'),text('span','','尚无研究正文'));
    else status.append(text('strong','','轻量收藏'),text('span','','尚未建立研究专题'));
    side.append(status);
  }
  function polishRows() {
    if (!loaded) return;
    for(const row of main.querySelectorAll('.material-row[data-material-id]')) {
      if(row.dataset.obsPolished==='true')continue;
      const item=materials.get(row.dataset.materialId);if(!item)continue;
      row.dataset.obsPolished='true';row.id='obs-row-'+item.materialId;
      const anchor=row.querySelector('.row-image');if(anchor)cover(anchor,item);
      const primary=row.querySelector('.row-main h2 a');if(primary)primary.id='obs-material-'+item.materialId;
      const feeling=row.querySelector('.row-feeling');
      if(feeling){if(!String(item.currentImpression || '').trim()){feeling.textContent='尚未填写个人感受';feeling.dataset.empty='true';}else{feeling.textContent=item.currentImpression;delete feeling.dataset.empty;}}
      researchStatus(row,item);
    }
  }
  function polishCollection() {
    const form=document.getElementById('filterForm');if(!form)return;
    if(form.dataset.obsPolished!=='true'){
      form.dataset.obsPolished='true';
      const searchLabel=form.querySelector('label[for=searchInput]');if(searchLabel){searchLabel.textContent='搜索收藏与研究正文';searchLabel.title='搜索标题、标签、来源、原话、备注与已保存研究正文';}
      const search=document.getElementById('searchInput');if(search)search.placeholder='记得一个词，也能找回来';
      const summary=main.querySelector('.list-summary>span:last-child');
      if(summary){summary.replaceChildren(text('span','','收藏与研究各自保留'));const clear=text('button','','清除筛选');clear.type='button';clear.id='obsClearFilters';clear.addEventListener('click',()=>{
        for(const [id,value] of [['searchInput',''],['categoryFilter','all'],['kindFilter','all'],['statusFilter','active']]){const input=document.getElementById(id);if(input && input.value!==value){input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));}}
        document.getElementById('searchInput')?.focus({preventScroll:true});
      });summary.append(clear);}
      const quick=main.querySelector('.quick-save-bar p');if(quick && readonly)quick.replaceChildren(text('strong','','先收藏，再决定何时深入。'),document.createTextNode('此处阅读已有记录；收藏与修改请在正式页面完成。'));
      const quickButton=main.querySelector('.quick-save-bar button');if(quickButton && readonly)quickButton.textContent='收藏入口 · 只读';
    }
    const clear=document.getElementById('obsClearFilters');if(clear){const enabled=['searchInput','categoryFilter','kindFilter','statusFilter'].some(id=>{const input=document.getElementById(id);return input && input.value!==({searchInput:'',categoryFilter:'all',kindFilter:'all',statusFilter:'active'}[id]);});clear.disabled=!enabled;}
  }
  function polishMaterial() {
    const layout=main.querySelector('.material-layout');if(!layout || layout.dataset.obsPolished==='true')return;
    layout.dataset.obsPolished='true';
    const id=decodeURIComponent(location.hash.split('/')[1] || ''),item=materials.get(id);
    if(item && readonly){
      const linked=currentTopics(item).filter(topic=>topic.stages?.length);
      const begin=document.getElementById('beginResearch');
      if(begin && linked.length){
        if(begin.tagName==='A'){begin.href=topicHref(linked[0].topicId);begin.textContent='读已有解读 →';}
        else{const link=text('a','primary-button','读已有解读 →');link.id='beginResearch';link.href=topicHref(linked[0].topicId);begin.replaceWith(link);}
      }else if(begin?.tagName==='A'){
        const button=text('button','primary-button','组织研究 · 只读');button.type='button';button.id='beginResearch';button.dataset.action='research';button.dataset.id=item.materialId;begin.replaceWith(button);
      }
    }
    const aside=layout.querySelector('.material-right'),sources=aside?.querySelector('.source-section-material');if(sources)aside.append(sources);
    const append=document.getElementById('appendForm');
    if(append && !append.closest('.obs-writing-tools')){const details=document.createElement('details');details.className='obs-writing-tools';details.id='obsAttachmentTools';details.append(text('summary','',readonly?'补充附件 · 只读预览':'补充附件'));append.before(details);details.append(append);}
    for(const [index,link] of [...main.querySelectorAll('.reading-continue,.topic-link,.mini-research>a,.breadcrumb>a')].entries())if(!link.id)link.id='obs-material-link-'+id+'-'+index;
  }
  function buildReadingRail(reader) {
    if(!reader || reader===currentReader)return;
    currentReader=reader;main.querySelector('#observatoryReadingRail')?.remove();
    const nav=reader.querySelector('.long-toc');if(!nav)return;
    const rail=text('aside','obs-reading-rail','');rail.id='observatoryReadingRail';rail.setAttribute('aria-label','文章目录');
    const inner=text('div','obs-reading-rail-inner','');inner.append(text('p','','阅读目录'));
    const links=document.createElement('nav');links.setAttribute('aria-label','当前文章');
    const sections=[...nav.querySelectorAll('a')];
    for(const [index,original] of sections.entries()){
      const link=original.cloneNode(true);link.id='obs-reading-link-'+index;links.append(link);
      if(index===1){
        const headings=[...reader.querySelectorAll('#reportSection>.long-section>h2')];
        for(const [hIndex,heading] of headings.entries()){
          const section=heading.closest('.long-section'),sub=text('a','',heading.textContent);sub.href=topicHref(main.dataset.readingTopic)+'/paragraph/'+encodeURIComponent(section.id.replace(/^paragraph-/,''));sub.dataset.subheading='true';sub.id='obs-reading-body-'+hIndex;links.append(sub);
        }
      }
    }
    const position=text('div','obs-reading-position','当前位置');position.append(text('span','','内容概要'));position.id='observatoryReadingPosition';
    inner.append(links,position);rail.append(inner);main.prepend(rail);
    const header=reader.querySelector('.long-topic-header');if(header && !header.querySelector('.obs-reading-label'))header.prepend(text('p','obs-reading-label','连续阅读 · 正文在前，依据随时可查'));
    railTargets=[...links.querySelectorAll('a')].map(link=>{const segments=link.hash.slice(1).split('/');const kind=segments.at(-2),id=decodeURIComponent(segments.at(-1));const target=document.getElementById(kind==='paragraph'?'paragraph-'+id:id);return{link,target};}).filter(entry=>entry.target);
    updatePosition();
  }
  function updatePosition() {
    positionQueued=false;if(!currentReader?.isConnected)return;
    let current=railTargets[0];
    for(const entry of railTargets){if(entry.target.getBoundingClientRect().top<=160)current=entry;}
    if(!current)return;
    for(const entry of railTargets){if(entry===current)entry.link.setAttribute('aria-current','location');else entry.link.removeAttribute('aria-current');}
    const label=document.querySelector('#observatoryReadingPosition>span');if(label && label.textContent!==current.link.textContent)label.textContent=current.link.textContent;
  }
  function polishTopics() {
    for(const entry of main.querySelectorAll('.topic-list-entry')){
      const link=entry.querySelector('h2>a');if(!link || link.id)continue;
      const id=decodeURIComponent(link.hash.split('/')[1] || '');link.id='obs-topic-list-'+id;
    }
  }
  function polish() {
    queued=false;
    if(!readonly){
      const current=main.querySelector('#filterForm,.material-layout,.long-reader,.topic-top,#topicFilterForm');
      if(current!==sourcePage){const previous=sourcePage;sourcePage=current;if(current && (loaded || previous)){loaded=false;refreshSaved();}}
    }
    markReadonly();polishCollection();polishRows();
    if(loaded)polishMaterial();polishTopics();
    const reader=main.querySelector('.long-reader');
    if(reader)buildReadingRail(reader);else{currentReader=null;railTargets=[];main.querySelector('#observatoryReadingRail')?.remove();}
    emitContext();
  }
  function emitContext(force=false){
    if(!loaded || !sourceIdentity)return;
    const parts=location.hash.slice(1).split('/'),kind=parts[0];let id;
    try{id=decodeURIComponent(parts[1] || '');}catch{return;}
    const item=kind==='material'?materials.get(id):kind==='topic'?topics.find(topic=>topic.topicId===id):null;
    const holder=kind==='material'?main.querySelector('.material-right'):kind==='topic'?(main.querySelector('#readingTools')||main.querySelector('.topic-sidebar')||main.querySelector('.topic-content')):null;
    if(!item || !holder){
      if(emittedMount){emittedMount=null;emittedKey='';window.workspaceLastContext=null;dispatchEvent(new CustomEvent('workspace:context',{detail:{ref:null,mount:null}}));}
      return;
    }
    if(!readonly && sourceIdentity.scope!==mode)return;
    let mount=holder.querySelector(':scope > .workspace-relations-mount');
    if(!mount){mount=document.createElement('div');mount.className='workspace-relations-mount';mount.id='observatoryWorkspaceRelations';
      const native=holder.querySelector(':scope > .relation-section');if(native)native.after(mount);else holder.append(mount);
    }
    const ref={module:'observatory',kind,storeId:sourceIdentity.storeId,id},contextKey=JSON.stringify(ref);
    if(!force && emittedMount===mount && emittedKey===contextKey)return;
    emittedMount=mount;emittedKey=contextKey;const detail={ref,mount};window.workspaceLastContext=detail;dispatchEvent(new CustomEvent('workspace:context',{detail}));
  }
  function refreshSaved(){clearTimeout(sourceTimer);sourceTimer=setTimeout(()=>loadRecords().catch(()=>{feedback('补充视图暂未重新读取；原模块的保存结果仍以实际回读为准。可点击“重新加载”核对。');}),100);}
  function schedule(){if(queued)return;queued=true;queueMicrotask(polish);}
  new MutationObserver(schedule).observe(main,{childList:true,subtree:true});
  addEventListener('scroll',()=>{if(!positionQueued){positionQueued=true;requestAnimationFrame(updatePosition);}},{passive:true});
  document.addEventListener('input',event=>{if(event.target.closest('#filterForm'))schedule();});
  document.getElementById('reloadRecords')?.addEventListener('click',()=>{loadRecords().catch(()=>{});});
  addEventListener('workspace:records-changed',event=>{if(!readonly && ['observatory',undefined].includes(event.detail?.module || event.detail?.region))refreshSaved();});
  addEventListener('workspace:context-request',()=>emitContext(true));
  loadRecords().catch(error=>{feedback('保存资料仍由原页面显示；预览补充未完成：'+error.message);});schedule();
})();
