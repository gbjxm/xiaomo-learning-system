'use strict';

// Shared hooks keep specialist tools behind the decision content and use the
// existing token, navigation, draft, scroll and request guards.
window.LibraryBridge={
  request:(path,payload,options)=>api(path,payload,options?.signal),
  refresh:()=>load(),getState:()=>state,getItems:()=>state.data?.items||[],
  filters:()=>({view:state.view,kind:state.kind,search:state.search,platform:state.platform,status:state.status,reward:state.reward,sort:state.sort,fit:state.fit}),
  openDetail:id=>openDetail(id),toast:message=>toast(message),
};
function renderDuplicateTools(host){
  if(window.MergeUI)window.MergeUI.mount(host,window.LibraryBridge);
  else host.replaceChildren(empty('核对工具暂未加载','刷新后重试；已有条目未被修改。'));
}
function addPreparationAction(item,body){
  const actions=body.querySelector('.detail-primary-actions');
  if(actions&&!actions.querySelector('.prepare-opportunity'))add(actions,button('用我的作品准备','link-button prepare-opportunity',()=>openWorksForOpportunity(item.id)));
  const groups=(state.data?.merge_groups||[]).filter(group=>group.status==='active'&&(group.target_id===item.id||group.source_id===item.id));
  const secondary=body.querySelector('.detail-secondary-content');
  for(const group of groups){
    const section=el('section','detail-section merge-provenance');add(section,el('h3',null,'已人工关联的同届记录'),el('p',null,'每条原记录的笔记、关注与历史独立保留，可查看来源条目。'));
    for(const member of group.members||[]){
      const doc=member.document||member;
      add(section,button(doc.title||member.id,'link-button',()=>openDetail(member.id)),member.note?el('p',null,'该记录个人笔记：'+member.note):null);
    }
    if(secondary)add(secondary,section);
  }
}
function addScanCoverage(node,source){
  const scan=source.coverage?.discovery;
  if(source.discovery?.pagination&&!scan?.scan_pages){add(node,el('p','source-scope','分页适配已配置；上方是此前保存的检查结果。尚未在真实资料库执行新的分页检查。'));return;}
  if(!scan?.scan_pages)return;
  const stops={official_last_page:'已到官网声明末页',no_next_link:'实际页面无下一页链接',page_limit:'达到本次页数上限',page_failed:'后续列表页读取失败',invalid_list:'列表结构未核',cancelled:'用户取消',repeated_page:'重复页面，停止继续读取',unsafe_next_link:'下一页链接超出安全边界',pagination_structure_changed:'官网分页结构已变化'};
  const dates=scan.date_range||{};
  add(node,el('p','source-scope',`本轮列表 ${scan.scan_pages} 页 / 上限 ${scan.page_limit??'未记录'}；${stops[scan.stop_reason]||scan.stop_reason||'停止原因未记录'}。`),el('p','source-scope','实际公告日期范围：'+(dates.oldest||'未知')+' 至 '+(dates.newest||'未知')+'；不表示全站或其他栏目已覆盖。'));
  const details=el('details','source-page-coverage');add(details,el('summary',null,'查看逐页覆盖与停止依据'));
  for(const page of scan.per_page||[])add(details,add(el('p','source-scope'),link('扫描官方页 ↗',page.url),` · ${page.status} · 登记路径公告 ${page.entries??0} 条`,page.error?'；'+page.error:null));
  if(scan.previous_scan)add(details,el('p','source-scope','上次有效覆盖仍保留：'+JSON.stringify(scan.previous_scan)));
  add(node,details);
}
const linkedToggle=el('label','merged-display-control'),linkedInput=el('input');linkedInput.type='checkbox';linkedInput.id='show-merged';
add(linkedToggle,linkedInput,' 显示人工关联的来源副本');add($('opportunity-tools'),linkedToggle);
linkedInput.addEventListener('change',()=>{state.showMerged=linkedInput.checked;renderList();});
function refreshLinkedControl(){const used=(state.data?.merge_groups||[]).some(group=>group.status==='active');if(used)linkedInput.dataset.used='true';else delete linkedInput.dataset.used;linkedInput.checked=Boolean(state.showMerged);}
refreshLinkedControl();
if(state.data&&['works','duplicates'].includes(state.view))render();
