'use strict';

// Images supplement the verified record. They never supply an opening status or rule.
const visualState={items:{},assets:{},loaded:false};
const visualKinds={event_poster:'官方活动图',platform_mark:'平台标识',organizer_mark:'主办方标识'};
function textIdentity(item){
  const names=[['王者','王者无界'],['X小时','X小时之后'],['一场戏','一场戏'],['那头牛','那头牛'],['瓦漫节','瓦漫节'],['Skill','导演大师赛'],['扫街','扫街去'],['LibTVC','LibTVC'],['精卫','精卫计划'],['vol.2','大乱斗 02'],['vol.1','大乱斗 01'],['狂飙季','影像狂飙季'],['鲸锐','鲸锐 AI'],['金鸡','金鸡 AI'],['可视化','中传 AIGC'],['创所未见','创所未见'],['穹顶','瓦卡穹顶'],['瓦卡','瓦卡奖'],['通义万相','北影节万相'],['北京国际','北影节 AI'],['上海大学生','大学生电视节'],['Aniwow','Aniwow!'],['Astana','AAIFF'],['FIRST','FIRST'],['HKAIIFF','HKAIIFF'],['Runway','Runway AIF'],['AiShorts','AiShorts'],['白模','白模赛'],['二创','B站二创赛'],['新影像','即梦新影像'],['我的人生电影','人生电影']];
  const title=String(item.title||'创作机会');
  const label=names.find(([part])=>title.toLowerCase().includes(part.toLowerCase()))?.[1]||title.replace(/20\d{2}/g,'').trim().slice(0,12);
  const edition=String(item.edition||'');const year=edition.match(/(?:^|\D)(20\d{2})(?:\D|$)/)?.[1]||'';
  return {label,edition:year||'轮次见详情'};
}
function visualFor(item){
  const entry=visualState.items[item.id];if(!entry||typeof entry.asset_id!=='string')return null;
  const asset=visualState.assets[entry.asset_id];if(!asset||!visualKinds[asset.kind])return null;
  // Only the validated local route may supply pixels. External URLs are provenance links.
  if(!/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(entry.asset_id))return null;
  return {...asset,...entry,kind:asset.kind,url:'/media/'+entry.asset_id};
}
function opportunityIdentity(item,context='card'){
  const meta=visualFor(item),text=textIdentity(item);
  const node=el('div','opportunity-identity '+context);node.dataset.identityId=item.id;node.dataset.identityContext=context;
  const frame=el('div','identity-frame'+(meta?.background==='dark'?' dark-background':''));const fallback=add(el('div','identity-text'),el('strong',null,text.label),el('small',null,text.edition));
  fallback.setAttribute('aria-hidden','true');add(frame,fallback);
  const caption=el('small','identity-caption',meta?(meta.label||visualKinds[meta.kind]):'文字标识');
  if(meta){
    node.dataset.visualKind=meta.kind;
    const img=el('img','identity-image');img.alt=(meta.label||visualKinds[meta.kind])+'：'+item.title;img.width=meta.width;img.height=meta.height;img.decoding='async';img.loading=context==='card'?'lazy':'eager';
    img.addEventListener('load',()=>{if(img.hidden)return;fallback.hidden=true;node.classList.add('image-ready');});
    img.addEventListener('error',()=>{img.hidden=true;fallback.hidden=false;node.classList.remove('image-ready');node.dataset.visualKind='text';caption.textContent='文字标识 · 图片不可用';}, {once:true});
    add(frame,img);img.src=informationURL(meta.url);
  }else node.dataset.visualKind='text';
  caption.title=meta?((meta.label||visualKinds[meta.kind])+'；图片中的宣传、日期不替代下方核验状态。'):'为便于辨识而设计的文字标识，并非官方Logo';
  if(context==='card')node.addEventListener('click',()=>{node.closest('.opportunity-card')?.querySelector('.card-title')?.focus({preventScroll:true});openDetail(item.id);});
  add(node,frame,caption);return node;
}
function visualProvenance(item){
  const meta=visualFor(item);if(!meta)return null;
  const section=el('section','detail-section visual-provenance');section.dataset.visualEvidenceId=item.id;
  const links=add(el('div','evidence-links'),link(meta.source_page===meta.image_url?'图片所在官方页面 ↗':'图片出处 · 官方页面 ↗',meta.source_page));
  if(meta.source_page!==meta.image_url)add(links,link('原始公开图片 ↗',meta.image_url));
  add(section,el('h3',null,'标识图片与出处'),el('p',null,(meta.label||visualKinds[meta.kind])+' · 适用轮次：'+(meta.edition||meta.applicable_edition||'见来源说明')),links,
    el('p','visual-rights',meta.rights_note||'公开图片仅缓存供个人本地辨识；不代表获得额外商用权。'),
    el('small',null,'图片像素人工核对 '+fmt(meta.observed_at)+'；封面宣传与活动开放、奖励、规则核验分别判断。'));
  return section;
}
async function loadVisuals(){
  try{
    const response=await fetch(informationURL('/api/visuals'),{cache:'no-store'});if(!response.ok)throw new Error('标识目录未取得');const data=await response.json();
    if(data.schema_version!==1||!data.items||!data.assets||Array.isArray(data.items)||Array.isArray(data.assets))throw new Error('标识目录格式无效');
    visualState.items=data.items;visualState.assets=data.assets;visualState.loaded=true;
    // Replace only fixed-size identity slots: no list rerender, no scroll or draft reset.
    for(const node of document.querySelectorAll('[data-identity-id]')){
      const item=state.data?.items.find(x=>x.id===node.dataset.identityId);if(item)node.replaceWith(opportunityIdentity(item,node.dataset.identityContext));
    }
    const item=state.data?.items.find(x=>x.id===state.detailId);const body=document.querySelector('#detail[open] .dialog-body');
    if(item&&body&&!body.querySelector('.visual-provenance')){const section=visualProvenance(item);if(section)(body.querySelector('.detail-secondary-content')||body).append(section);}
  }catch{visualState.loaded=true;/* Readable text identities remain usable without images. */}
}
function reducedMotion(){return typeof window.matchMedia==='function'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;}
function briefFeedback(node,kind='content'){
  if(!node)return;
  for(const animation of node.getAnimations?.()||[])animation.cancel();
  if(reducedMotion()||typeof node.animate!=='function')return;
  const frames=kind==='dialog'?[{opacity:.75,transform:'translateY(7px)'},{opacity:1,transform:'translateY(0)'}]:[{opacity:.7},{opacity:1}];
  node.animate(frames,{duration:kind==='dialog'?160:120,easing:'cubic-bezier(.2,.7,.2,1)'});
}
function loadingSkeleton(label,detail=false){
  const node=el('div','loading-skeleton'+(detail?' detail-loading':''));node.setAttribute('role','status');
  add(node,el('span','loading-label',label));
  for(let i=0;i<(detail?3:4);i++){const row=el('div','skeleton-row');row.setAttribute('aria-hidden','true');add(row,el('div','skeleton-block'),add(el('div','skeleton-lines'),el('i'),el('i'),el('i')));add(node,row);}
  return node;
}
document.addEventListener('DOMContentLoaded',loadVisuals,{once:true});
