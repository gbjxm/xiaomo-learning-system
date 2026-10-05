'use strict';

const $ = id => document.getElementById(id);
// One fixed local mount; this changes only our own API/media routes, never public source URLs.
const informationMounted = location.pathname === '/information' || location.pathname.startsWith('/information/');
function informationURL(value) {
  if (typeof value !== 'string') return value;
  if (value.startsWith('/information/')) return value;
  let local = value;
  if (/^https?:\/\//i.test(value)) {
    try {
      const parsed = new URL(value);
      if (!['127.0.0.1', 'localhost'].includes(parsed.hostname) || parsed.username || parsed.password ||
          (parsed.port !== '8765' && parsed.origin !== location.origin)) return value;
      local = parsed.pathname + parsed.search + parsed.hash;
    } catch { return value; }
  }
  return /^\/(?:api|media)(?:\/|\?|$)/.test(local) ? (informationMounted ? '/information' : '') + local : value;
}
const state = {data:null, view:'opportunities', kind:'all', search:'', platform:'all', status:'all', reward:'all', sort:'validity', fit:'all', detailId:null, detailRequest:0, detailAbort:null, detailContext:null, noteUI:null, drafts:{}, draftBases:{}, storageAvailable:true, pendingStars:new Set(), pendingNotes:new Set(), noteErrors:{}, preferenceRevision:0, preferenceEdits:new Map(), preferenceOperations:{}, updateStarting:false, updateError:null, poll:null, stopped:false, viewPositions:{}};
const names = {opportunities:'创作机会',starred:'我的关注',sources:'官方信源',changes:'规则与变更',archive:'历史归档',batches:'更新批次',discoveries:'新发现待核',backups:'备份与恢复',works:'作品与投稿',duplicates:'重复条目核对'};
const rewardNames = {cash:'现金',credits:'积分',compute:'算力',traffic:'流量',promotion:'推广',screening:'展映',other:'商业合作 / 其他'};
const reportNames = {success_zero:'成功零新增',success:'成功有新增 / 变更',partial:'部分提取',failed:'失败',pending:'待核验 / 未接通'};
const originNames = {manual_handoff:'前序人工核验移交',manual_review:'人工补充核验',live_fetch:'本次公开网页提取',user_hint:'用户线索 · 尚未核实'};
const programNames = {join:'加入方式',revenue:'收益计算',settlement:'结算规则',ongoing_requirements:'持续达标条件',exit:'退出 / 清退条件',effective_version:'生效版本'};
const roleNames={candidate:'候选 · 作品资格待对照',restriction:'AI限制参考',not_recommended:'不建议 · 核心版权限制',due_diligence:'尽调待核',secondary:'推广合作 · 次要',historical:'历史参考'};
const dimensionNames={text_complete:'正文文本完整取得',embedded_text:'嵌入正文已取得',partial_text:'部分文字已取得',no_text:'未取得正文',homepage_only:'仅取得主页',blocked:'访问验证受限',failed:'抓取 / 解析失败',complete:'规则检查完整',partial:'规则字段仍有缺口',not_checked:'未核验',unadapted:'尚未适配'};
function dimensionText(value){if(!value)return '尚未按维度检查';let text=dimensionNames[value.state]||value.state;if(value.text_chars!==undefined)text+=` · ${value.text_chars}字`;if(value.image_refs){const count=Array.isArray(value.image_refs)?value.image_refs.length:value.image_refs;if(count)text+=` · ${count}个图片引用未核`;}return text;}

function el(tag,cls,text){const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined&&text!==null)node.textContent=String(text);return node;}
function add(parent,...children){for(const child of children){if(child!==undefined&&child!==null)parent.append(child instanceof Node?child:document.createTextNode(String(child)));}return parent;}
function button(text,cls,action){const node=el('button',cls,text);node.type='button';node.addEventListener('click',action);return node;}
function safeURL(url){try{const parsed=new URL(url);return parsed.protocol==='https:'&&!parsed.username&&!parsed.password&&(!parsed.port||parsed.port==='443')?parsed.href:null;}catch{return null;}}
function link(text,url,cls){const node=el('a',cls,text),href=safeURL(url);if(href){node.href=href;node.target='_blank';node.rel='noopener noreferrer';}else{node.classList.add('invalid-link');node.title='链接未核验或不是安全HTTPS地址';}return node;}
function fmt(value){if(!value)return '未核验';if(value.length===10)return value+'（仅日期）';return value.replace('T',' ').replace('+00:00',' UTC').replace('Z',' UTC');}
function rewardText(reward){if(typeof reward.amount==='number'){const unit=reward.currency==='CNY'?'元':reward.currency||reward.unit||(reward.type==='credits'?'积分':'');return reward.amount.toLocaleString('zh-CN')+' '+unit;}return reward.label;}
function toast(text){$('toast').textContent=text;$('toast').classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').classList.remove('visible'),3200);}
async function api(path,body,signal){const options={cache:'no-store',signal};if(body!==undefined){if(state.restorePending&&path!=='/api/backup/restore')throw new Error('恢复结果待确认，请先到备份与恢复核对当前资料');if(['/api/preference','/api/works/save'].includes(path)&&state.data?.write_protocol_version!==1)throw new Error('信息后台尚未更新到安全保存协议；服务更新后请重新读取，当前草稿保留。');options.method='POST';options.headers={'Content-Type':'application/json','X-Local-Token':state.data.token};options.body=JSON.stringify(body);}const response=await fetch(informationURL(path),options);const result=await response.json();if(!response.ok){const error=new Error(result.error||'操作未完成');error.status=response.status;error.result=result;throw error;}return result;}

// Only this tab remembers browsing conditions and unsaved drafts. Explicit Save writes SQLite.
const uiKey='xiaomo-opportunities-ui-v1';
function persistUI(){try{sessionStorage.setItem(uiKey,JSON.stringify({view:state.view,kind:state.kind,search:state.search,platform:state.platform,status:state.status,reward:state.reward,sort:state.sort,fit:state.fit,drafts:state.drafts,draftBases:state.draftBases,positions:state.viewPositions,preferenceOperations:state.preferenceOperations}));}catch{state.storageAvailable=false;}}
function restoreUI(){try{const saved=JSON.parse(sessionStorage.getItem(uiKey)||'null');if(!saved||typeof saved!=='object')return;
  if(Object.hasOwn(names,saved.view))state.view=saved.view;
  if(['all','matched','mismatched','unknown'].includes(saved.fit))state.fit=saved.fit;
  for(const key of ['kind','status','reward','sort']){const values=key==='kind'?[...document.querySelectorAll('[data-kind]')].map(n=>n.dataset.kind):[...$(key).options].map(n=>n.value);if(values.includes(saved[key]))state[key]=saved[key];}
  for(const key of ['search','platform'])if(typeof saved[key]==='string')state[key]=saved[key].slice(0,500);
  if(saved.drafts&&typeof saved.drafts==='object')for(const [id,note]of Object.entries(saved.drafts))if(/^[a-z0-9_-]+$/i.test(id)&&typeof note==='string')state.drafts[id]=note.slice(0,5000);
  if(saved.draftBases&&typeof saved.draftBases==='object')for(const [id,base]of Object.entries(saved.draftBases))if(Object.hasOwn(state.drafts,id)&&base&&Number.isSafeInteger(base.revision)&&base.revision>=0&&typeof base.note==='string'&&base.note.length<=5000)state.draftBases[id]={revision:base.revision,note:base.note};
  if(saved.preferenceOperations&&typeof saved.preferenceOperations==='object')for(const [id,operation]of Object.entries(saved.preferenceOperations).slice(0,120))if(/^[a-z0-9_-]{1,80}$/i.test(id)&&operation&&operation.id===id&&/^[a-f0-9]{32}$/.test(operation.submissionId)&&Number.isSafeInteger(operation.expectedPreferenceRevision)&&operation.expectedPreferenceRevision>=0&&((typeof operation.note==='string'&&operation.note.length<=5000)||(typeof operation.starred==='boolean')))state.preferenceOperations[id]=operation;
  if(saved.positions&&typeof saved.positions==='object')for(const [view,pos]of Object.entries(saved.positions))if(Object.hasOwn(names,view)&&Number.isFinite(pos)&&pos>=0)state.viewPositions[view]=pos;
}catch{state.storageAvailable=false;}}
function populatePlatforms(){const values=new Set(state.data.profile.preferred_platforms);for(const item of state.data.items)for(const platform of item.platform.split(/\s*\/\s*/))if(platform)values.add(platform);
  $('platform').replaceChildren(add(el('option',null,'全部平台')));$('platform').firstChild.value='all';
  for(const value of [...values].sort((a,b)=>a.localeCompare(b,'zh-CN'))) {const option=el('option',null,value);option.value=value;$('platform').append(option);}
  if(state.platform!=='all'&&!values.has(state.platform))state.platform='all';
}
function syncFilters(){if($('fit-filter'))$('fit-filter').value=state.fit;for(const id of ['search','platform','status','reward','sort'])$(id).value=state[id];}
function recordPreference(id,key,value){const edits=state.preferenceEdits.get(id)||{};edits[key]={revision:++state.preferenceRevision,value};state.preferenceEdits.set(id,edits);const current=state.data?.items.find(x=>x.id===id);if(current)current[key]=value;}
function mergePreferences(item,requestRevision){for(const [key,edit]of Object.entries(state.preferenceEdits.get(item.id)||{}))if(edit.revision>requestRevision)item[key]=edit.value;return item;}
function writeSubmissionId(){if(!crypto.getRandomValues)throw new Error('浏览器无法生成提交标识，请使用本机 Edge 后重新读取');const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);return [...bytes].map(value=>value.toString(16).padStart(2,'0')).join('');}
function acceptPreferenceResponse(response){const value=response.preference;if(response.saved!==true||!value||typeof value.id!=='string'||typeof value.note!=='string'||typeof value.starred!=='boolean'||!Number.isSafeInteger(value.preference_revision))throw new Error('保存结果尚未确认，草稿仍保留；请核对后重试');for(const key of ['note','starred','preference_revision'])recordPreference(value.id,key,value[key]);return value;}
async function submitPreference(id,patch){const item=state.data?.items.find(value=>value.id===id);if(!item||!Number.isSafeInteger(item.preference_revision))throw new Error('缺少个人资料版本，请重新加载页面后核对保存');const epoch=state.dataEpoch||0;let operation=state.preferenceOperations[id];const same=operation&&Object.keys(patch).every(key=>operation[key]===patch[key])&&Object.keys(operation).filter(key=>key==='note'||key==='starred').length===Object.keys(patch).length;
  if(!operation){const base=state.draftBases[id];if(Object.hasOwn(patch,'note')&&(!base||base.revision!==item.preference_revision||base.note!==item.note))throw new Error('草稿依据的个人资料版本已变化；请先对照最新已保存笔记，再明确采用当前版本');operation={id,...patch,expectedPreferenceRevision:Object.hasOwn(patch,'note')?base.revision:item.preference_revision,submissionId:writeSubmissionId()};state.preferenceOperations[id]=operation;persistUI();}
  try{const response=await api('/api/preference',operation);if(epoch!==(state.dataEpoch||0)||state.preferenceOperations[id]!==operation)throw new Error('资料在请求期间恢复或重读过；上次提交结果待核对，当前草稿保留，未标记新资料已保存');if(response.preference?.id!==id)throw new Error('保存结果不对应当前条目，草稿保留，请核对后重试');const saved=acceptPreferenceResponse(response);delete state.preferenceOperations[id];persistUI();if(!same&&Object.keys(patch).some(key=>saved[key]!==patch[key]))throw new Error('上次提交已确认；当前修改尚未提交，请核对后再次保存');return saved;}
  catch(error){if(epoch===(state.dataEpoch||0)&&state.preferenceOperations[id]===operation&&(error.status===400||error.status===409)){delete state.preferenceOperations[id];persistUI();}throw error;}
}
function renderFilterSummary(){const node=$('active-filters');node.replaceChildren();
  const labels={kind:document.querySelector(`[data-kind="${state.kind}"]`)?.textContent,search:'搜索：'+state.search,platform:'平台：'+state.platform,status:'状态：'+$('status').selectedOptions[0]?.textContent,reward:'奖励：'+$('reward').selectedOptions[0]?.textContent,fit:'作品条件：'+$('fit-filter').selectedOptions[0]?.textContent};
  const keys=['kind','search','platform','status','reward','fit'].filter(key=>state[key]!== (key==='search'?'':'all'));
  for(const key of keys){const chip=button(labels[key]+' ×','filter-chip',()=>{state[key]=key==='search'?'':'all';syncFilters();persistUI();render();$(key==='kind'?'search':key==='fit'?'fit-filter':key).focus();});chip.setAttribute('aria-label','清除'+labels[key]);add(node,chip);}
  if(keys.length)add(node,button('清空筛选','clear-filters',()=>{resetFilters();$('search').focus();}));
  $('clear-search').hidden=!state.search;node.hidden=!keys.length;
}

async function load(){
  const revision=state.preferenceRevision,profileRevision=state.profileRevision||0,epoch=state.dataEpoch||0,request=state.loadRequest=(state.loadRequest||0)+1;
  if(!state.data&&typeof loadingSkeleton==='function')$('content').replaceChildren(loadingSkeleton('正在读取本机已保存的机会…'));
  try{const result=await api('/api/state');if(state.stopped||epoch!==(state.dataEpoch||0)||request!==state.loadRequest)return false;result.items.forEach(item=>mergePreferences(item,revision));if(typeof mergeProfileResponse==='function')mergeProfileResponse(result,profileRevision);if(typeof acceptProfileResponse==='function')acceptProfileResponse(result);state.data=result;if(globalThis.librarySearch)globalThis.librarySearch.invalidate();populatePlatforms();syncFilters();if(typeof initProfileUI==='function')initProfileUI();render();if(state.data.update.running&&!state.updateError)pollUpdate();return true;}
  catch(error){if(state.stopped||epoch!==(state.dataEpoch||0)||request!==state.loadRequest)return false;$('update-notice').className='notice error';$('update-notice').replaceChildren(el('span',null,'无法读取本地信息库：'+error.message),button('重新连接',null,load));if(!state.data)$('content').replaceChildren(empty(informationMounted?'信息模块尚未连接':'服务尚未连接',informationMounted?'运行统一启动脚本后点击重新连接；学习小岛和素材观察室可继续使用。':'双击「双击启动.cmd」启动服务后点击重新连接。'));return false;}
}
function empty(title,text,reset=false){const node=el('div','empty');add(node,el('strong',null,title),el('div',null,text));if(reset)add(node,button('清除筛选',null,resetFilters));return node;}
function resetFilters(){state.kind='all';state.search='';state.platform='all';state.status='all';state.reward='all';state.fit='all';syncFilters();persistUI();render();}
function archived(item){return item.status.code==='closed'||Boolean(item.archived_at)||item.record_context==='historical_reference';}
function displayStatus(item){
  if(item.record_context==='historical_reference'&&item.status.code!=='closed')return {code:'closed',label:'历史参考 · 报名期未核'};
  if(!item.priority?.public_time_reviewed&&['open','window','upcoming','effective'].includes(item.status.code))return {code:'uncertain',label:item.status.label+' · 证据待复核'};
  return item.status;
}
function priorityGroup(item){return archived(item)?5:item.priority?.group??3;}

function renderStats(){
  const items=state.data.items;
  const values=[['已核窗口 / 机制',items.filter(x=>x.priority?.group===0).length,'公开时间已核；个人资格另核','◷'],['公告窗口内',items.filter(x=>x.priority?.group===1).length,'日期或月份精度；开放待核','∞'],['开放状态待核',items.filter(x=>!archived(x)&&['unknown','uncertain'].includes(displayStatus(x).code)).length,'缺失字段明确提示','◇'],['已结束 / 历史',items.filter(archived).length,'列表末尾与历史归档均可查','▤']];
  $('stats').replaceChildren(...values.map(([label,value,note,icon])=>add(el('article','stat'),el('span','stat-icon',icon),el('div','stat-label',label),el('div','stat-number',value),el('small',null,note))));
}
function latestRun(){return state.data.runs.find(run=>run.finished_at);}
function renderNotice(){
  if(state.stopped)return;
  const node=$('update-notice'), update=state.data.update;
  node.replaceChildren();node.className='notice';
  if(state.restorePending){node.classList.add('error');add(node,el('span',null,'恢复结果待确认。已有页面可能是恢复前资料；请到备份与恢复核对，确认前暂停保存与检查。'),button('查看恢复状态',null,()=>setView('backups')));}
  else if(state.updateError){node.classList.add('error');const retry=button('重读检查状态',null,()=>readUpdateStatus(false));retry.disabled=Boolean(state.statusReading);add(node,el('span',null,`检查状态未获确认：${state.updateError}。不能据此判断已结束或没有更新。`),retry);}
  else if(state.updateStarting){node.classList.add('busy');add(node,el('span','spin','↻'),el('span',null,'正在请求本轮检查，可以继续浏览已保存的资料…'));}
  else if(update.running){node.classList.add('busy');const source=state.data.sources.find(s=>s.id===update.last_source);const info=el('div','update-progress');const progress=el('progress');progress.max=update.total||1;progress.value=update.completed||0;progress.setAttribute('aria-label','已完成信源检查数量');add(info,el('span',null,`正在检查 ${update.completed} / ${update.total} 个信源 · 可以继续浏览`),progress,source?el('small',null,'最近完成：'+source.name):null);add(node,el('span','spin','↻'),info);}
  else if(update.error){node.classList.add('error');add(node,el('span',null,'本轮检查未完成：'+update.error+'。已有资料保留，可以重新检查。'));}
  else{const run=latestRun();if(!run)add(node,el('span',null,'已载入人工核验种子。尚未执行本机检查；点击右上方按钮检查一次。'));
    else{const counts=run.summary?.counts;if(run.summary?.kind==='manual_review')add(node,el('span',null,`最近人工规则补核 ${fmt(run.finished_at)} · 更新 ${run.summary.changed} 条，自动抓取结果在信源区另列。`));else if(counts){const text=`上次检查 ${fmt(run.finished_at)} · 规则完整 ${counts.success_zero+counts.success} · 部分 ${counts.partial} · 失败 ${counts.failed} · 待核 ${counts.pending}`+(run.summary.dimensions?` · 正文文本完整 ${run.summary.dimensions.article.text_complete||0}`:'');add(node,el('span',null,text));if(counts.failed)node.classList.add('error');}
      else add(node,el('span',null,`上次检查未完成（${run.status}），不能判断没有更新。`));}}
  const discovery=latestRun()?.summary?.discovery;if(discovery&&!update.running&&!state.updateError)add(node,el('small',null,`列表发现：成功 ${(discovery.success||0)+(discovery.success_zero||0)}（零新增 ${discovery.success_zero||0}）· 列表提取不全 ${discovery.partial_list||0}；开放与规则另核。`));
  add(node,button('查看信源结果 ↗',null,()=>setView('sources')));
  $('update').disabled=Boolean(update.running||state.updateStarting||state.updateError||state.statusReading||state.restorePending);
  $('stop').disabled=Boolean(state.restorePending);
  $('update-label').textContent=state.updateError?'状态待重读':state.updateStarting?'请求中…':update.running?'检查中…':'检查更新';
  $('update-icon').className=update.running&&!state.updateError?'spin':'';
}
function render(){
  if(!state.data||state.stopped)return;
  renderStats();renderNotice();if(typeof refreshLinkedControl==='function')refreshLinkedControl();if(typeof refreshProfileState==='function')refreshProfileState();if(typeof renderDigestSummary==='function')renderDigestSummary();$('candidate-count').textContent=state.data.candidates.filter(x=>x.review_state==='pending').length;
  $('nav-count').textContent=state.data.items.length;
  $('change-count').textContent=state.data.changes.pages.length+state.data.changes.versions.length;
  $('breadcrumb').textContent=names[state.view];
  $('footer-count').textContent=`${state.data.items.length} 条已保存 · ${state.data.sources.length} 个登记信源`;
  for(const node of document.querySelectorAll('[data-view]')){node.classList.toggle('active',node.dataset.view===state.view);if(node.dataset.view===state.view)node.setAttribute('aria-current','page');else node.removeAttribute('aria-current');}
  for(const node of document.querySelectorAll('[data-kind]')){node.classList.toggle('selected',node.dataset.kind===state.kind);node.setAttribute('aria-pressed',String(node.dataset.kind===state.kind));}
  renderFilterSummary();refreshNoteState();
  const listViews=['opportunities','starred','archive'];
  $('opportunity-tools').hidden=!listViews.includes(state.view);$('list-heading').hidden=!listViews.includes(state.view);$('sort-explanation').hidden=!listViews.includes(state.view);
  if(state.view==='works')renderWorks($('content'));else if(state.view==='duplicates')renderDuplicateTools($('content'));else if(state.view==='batches')renderBatches();else if(state.view==='discoveries')renderDiscoveries();else if(state.view==='backups')renderBackups();else if(state.view==='sources')renderSources();else if(state.view==='changes')renderChanges();else renderList();
}
function setView(view,restorePosition=true){if(view!==state.view){closeDetail();state.viewPositions[state.view]=window.scrollY;}state.view=view;const titles={works:['从作品走向投递','为每部作品留一份准备单。','官方要求与个人进度分开；作品条件和账号资格仍需核对。'],duplicates:['同一届，先比较再关联','核对可能重复的条目。','逐项处理冲突，保留各自来源、笔记、关注与历史；不同年度轮次继续独立。'],batches:['每轮变化有记录','读懂这一轮更新。','新增线索、已核条款变化、到期与失败分别记录，原始页面变化需复核。'],discoveries:['先发现，再逐项核验','新的公告，先留作线索。','官方列表发现不等于开放；正文受限、年度轮次与未知规则分别保留。'],backups:['资料在自己手里','给创作资料留一份副本。','完整备份包括关注、笔记与证据；先预览，再明确确认恢复。'],opportunities:['为下一部作品做准备','把创作机会，留在手边。','从比赛征集到长期创作者计划，先看资格，再看奖励与规则。'],starred:['你的创作备选','留意值得投入的机会。','关注与笔记保存在本机，每次更新都会保留。'],sources:['官方证据优先','每次检查，都有据可查。','可访问、提取到正文与完成核验分别记录；登录受限来源明确标注。'],changes:['规则需要对齐','看看条款发生了什么。','页面变化进入待复核记录，人工核验版本与原始提取分别保存。'],archive:['结束的机会也有价值','规则留下，机会归档。','只依据已核截止或政策终止时间归档，未知截止保留待核验。']};
  const [eye,title,sub]=titles[view];$('eyebrow').textContent=eye;$('page-title').textContent=title;$('page-subtitle').textContent=sub;persistUI();render();if(restorePosition)window.scrollTo(0,state.viewPositions[view]||0);}
function filtered(){
  const query=state.search.trim().toLowerCase();
  return (state.data?.items||[]).filter(item=>{
    if(!state.showMerged&&state.view!=='archive'&&state.view!=='starred'&&(state.data.merge_groups||[]).some(group=>group.status==='active'&&group.source_id===item.id))return false;if(state.view==='archive'&&!archived(item))return false;
    if(state.view==='starred'&&!item.starred)return false;
    const matchesStatus=state.status==='all'||(state.status==='history'?archived(item):displayStatus(item).code===state.status&&(!archived(item)||state.status==='closed'));
    return(state.fit==='all'||item.fit?.status===state.fit)&&(state.kind==='all'||item.kind===state.kind)&&(state.platform==='all'||item.platform.includes(state.platform))&&matchesStatus&&(state.reward==='all'||item.rewards.some(reward=>reward.type===state.reward))&&(!query||(globalThis.librarySearch?globalThis.librarySearch.matches(item,query):JSON.stringify(item).toLowerCase().includes(query)));
  });
}
function compareOpportunities(a,b,mode='validity'){
  const byGroup=priorityGroup(a)-priorityGroup(b);if(byGroup)return byGroup;
  const deadline=(a.priority?.deadline_order??Infinity)-(b.priority?.deadline_order??Infinity);
  const verified=(b.priority?.verified_order??-Infinity)-(a.priority?.verified_order??-Infinity);
  const published=(b.priority?.publication_order??-Infinity)-(a.priority?.publication_order??-Infinity);
  const match=(b.match_score||0)-(a.match_score||0);
  const possiblePast=Number(Boolean(a.status.possible_expired))-Number(Boolean(b.status.possible_expired));
  const stable=()=>String(a.id).localeCompare(String(b.id),'en');
  if(mode==='publication')return possiblePast||published||deadline||verified||stable();
  if(mode==='match')return possiblePast||match||deadline||verified||published||stable();
  return possiblePast||deadline||verified||published||stable();
}
function sorting(items){return [...items].sort((a,b)=>compareOpportunities(a,b,state.sort));}
function statusPill(code,text){return el('span','status '+code,text);}
function renderList(){
  const visualKey=[state.view,state.kind,state.search,state.platform,state.status,state.reward,state.sort,state.fit].join('\u001f'),visualChanged=state.visualListKey!==undefined&&state.visualListKey!==visualKey;state.visualListKey=visualKey;
  if(!state.data||state.stopped)return;
  renderFilterSummary();
  const items=sorting(filtered());$('result-title').textContent=state.view==='archive'?'已结束 / 历史参考':state.view==='starred'?'我关注的机会':'已保存的机会';$('result-count').textContent=items.length+' 条';
  const nodes=[];let previous=-1;const labels=['官方时间与机制已核','公告窗口内 · 开放待核','尚未开始 / 生效','开放或规则待核','限制 / 推广 / 尽调参考','已结束 / 历史参考'];
  for(const item of items){const group=priorityGroup(item);if(group!==previous){nodes.push(el('h2','priority-heading',labels[group]+' · '+items.filter(x=>priorityGroup(x)===group).length+'条'));previous=group;}nodes.push(card(item));}
  $('content').replaceChildren(...nodes);
  if(!items.length)$('content').append(empty('这里暂时没有符合条件的内容','可清除筛选，或检查已登记的官方信源。',true));
  if(visualChanged&&typeof briefFeedback==='function')briefFeedback($('content'));if(globalThis.librarySearch)globalThis.librarySearch.onRendered();
}
function rewardSummary(item){
  const fragment=document.createDocumentFragment();
  if(!item.rewards.length)return add(fragment,el('span','reward-unknown','奖励未核；不推断现金额度'));
  for(const reward of item.rewards){
    const amount=typeof reward.amount==='number',entry=el('span','reward-summary-entry');
    add(entry,el('small',null,rewardNames[reward.type]),el('strong',null,rewardText(reward)),el('em',null,[amount?reward.label:null,reward.scope||'具体口径待核'].filter(Boolean).join(' · ')));
    add(fragment,entry);
  }
  return fragment;
}
function participantPreview(item,field){
  const values=item[field]||[];return values.length?values.slice(0,2).join('；'):(field==='eligibility'?'参与资格未核；个人资格另核':'作品要求未核；请读完整规则');
}
function opportunityTiming(item){
  const time=item.time;let main;
  if(time.deadline)main='截止 '+fmt(time.deadline_raw||time.deadline)+(time.deadline_tentative?'（暂定）':'');
  else if(time.month_period)main=`${time.month_period.start} 至 ${time.month_period.end}（月份精度）`;
  else if(time.policy_end)main='政策终止 '+fmt(time.policy_end);
  else if(item.kind==='rule_update'&&time.policy_effective)main='政策生效 '+fmt(time.policy_effective);
  else if(time.mechanism==='ongoing'&&time.confirmed)main='机制：官方明确常年开放';
  else if(time.mechanism==='batches')main='分批开放 · 本期以实际页面为准';
  else main='截止未说明 / 未核';
  const note=time.conflict?'官方状态有冲突 · 开放待复核':time.deadline_tentative?'截止暂定；不作为确认开放依据':time.timezone?'原文时区：'+time.timezone:(time.deadline||time.month_period?'时区未注明 · 边界待核':'缺截止不等于长期开放');
  return {main,note};
}
function riskHighlights(item){
  const labels={transfer:'获奖须转让著作权',exclusive:'排他 / 独家条款',exclusivity:'排他 / 独家条款',first_release:'首发要求',tool_restriction:'工具 / 竞品露出限制',licence:'授权条款',ongoing:'作品保留与持续履约'};
  return [...new Set(item.risks.filter(r=>r.level==='high').map(r=>labels[r.type]||'重大参与限制'))];
}
function card(item){
  const node=el('article','opportunity-card');node.dataset.id=item.id;const main=el('div','card-main');
  const top=add(el('div','card-top'),el('span',null,item.platform),el('span','tag',item.kind_label));
  if(item.is_new_publication)add(top,el('span','tag new','新发布'));
  if(item.deadline_urgency)add(top,el('span','tag risk',item.deadline_urgency));
  if(item.assessment?.role&&item.assessment.role!=='candidate')add(top,el('span','tag',roleNames[item.assessment.role]||item.assessment.role));
  if(item.stale)add(top,el('span','tag risk','核验较久 · 请复核'));
  if(item.risks.some(r=>r.level==='high'))add(top,el('span','tag risk','版权限制需审阅'));
  const title=button(item.title,'card-title',()=>openDetail(item.id));title.setAttribute('aria-haspopup','dialog');
  const organizer=el('small','card-organizer','主办方：'+(item.organizer||'待核'));organizer.title=item.organizer||'主办方待核';
  const facts=el('dl','card-facts');
  add(facts,add(el('div'),el('dt',null,'奖励'),add(el('dd','card-reward-summary'),rewardSummary(item))));
  add(facts,add(el('div'),el('dt',null,'资格'),el('dd','card-gate',participantPreview(item,'eligibility'))));
  add(facts,add(el('div'),el('dt',null,'作品'),el('dd','card-format',participantPreview(item,'work_requirements'))));
  add(top,typeof fitBadge==='function'?fitBadge(item):null);add(main,top,title,organizer,el('p','card-summary',item.summary),facts);
  const important=riskHighlights(item);if(important.length)add(main,el('p','card-cautions','参与限制：'+important.join(' / ')+'；请读完整条款。'));
  main.classList.add('card-click-area');main.addEventListener('click',event=>{if(!event.target.closest('button,a')&&!window.getSelection()?.toString()){title.focus({preventScroll:true});openDetail(item.id);}});
  const status=displayStatus(item);const meta=add(el('div','card-meta'),statusPill(status.code,status.label));
  const timing=opportunityTiming(item);add(meta,el('span','card-timing',timing.main));if(timing.note)add(meta,el('span','card-time-note',timing.note));
  const star=starButton(item,false);
  add(meta,star,button('查看详情 →','card-open',()=>openDetail(item.id)));
  const identity=typeof opportunityIdentity==='function'?opportunityIdentity(item):el('div','identity-text',item.title.slice(0,8));
  add(node,identity,main,meta);return node;
}
function starButton(item,detail){const node=button('',detail?'link-button':'star-button',()=>toggleStar(item.id));node.dataset.starId=item.id;node.dataset.detailStar=String(detail);applyStar(node,item);return node;}
function applyStar(node,item){const detail=node.dataset.detailStar==='true',pending=state.pendingStars.has(item.id)||state.pendingNotes.has(item.id);node.textContent=pending?'…':detail?(item.starred?'★ 已关注':'☆ 关注此机会'):(item.starred?'★':'☆');node.classList.toggle('starred',item.starred);node.disabled=pending||Boolean(state.restorePending);node.setAttribute('aria-pressed',String(item.starred));node.setAttribute('aria-label',(pending?'正在保存个人资料：':item.starred?'取消关注：':'关注：')+item.title);}
function syncStars(id){const item=state.data.items.find(x=>x.id===id);if(item)for(const node of document.querySelectorAll(`[data-star-id="${id}"]`))applyStar(node,item);}
async function toggleStar(id){const item=state.data?.items.find(x=>x.id===id);if(!item||state.pendingStars.has(id)||state.pendingNotes.has(id)||state.stopped)return;
  const target=!item.starred;let restoreFocus=false,detailFocus=false;state.pendingStars.add(id);syncStars(id);refreshNoteState();
  try{await submitPreference(id,{starred:target});if(state.stopped)return;const focused=document.activeElement,scroll=window.scrollY;detailFocus=focused?.dataset.detailStar==='true';render();restoreFocus=focused?.dataset.starId===id&&!focused.isConnected;window.scrollTo(0,scroll);toast(target?'已加入关注':'已取消关注');}
  catch(error){if(!state.stopped)toast('关注未保存：'+error.message);}
  finally{state.pendingStars.delete(id);if(!state.stopped){syncStars(id);refreshNoteState();if(restoreFocus){const next=document.querySelector(`[data-star-id="${id}"][data-detail-star="${detailFocus}"]`);(next||$('result-title')).focus({preventScroll:true});}}}
}

function renderSources(){
  const content=$('content');content.replaceChildren();
  const run=latestRun();
  if(run){const node=el('article','run-summary');add(node,el('h2',null,'最近一次单次检查'),el('p',null,`${fmt(run.started_at)} → ${fmt(run.finished_at)} · ${run.status}`));
    if(run.summary?.counts)add(node,el('p',null,`本轮检查 ${run.summary.sources} 个信源 · 新增 ${run.summary.new} · 条目 / 正文提取变化 ${run.summary.changed} · 本轮归档 ${run.summary.archived}。提取变化需复核，不等于官方规则修订。`));content.append(node);}
  else content.append(empty('尚未执行本机检查','以下为已配置官方来源，移交种子的核验日期在每条详情中单独记录。'));
  for(const source of state.data.sources){const node=el('article','source-card');const title=add(el('div','source-title'),el('h2',null,source.name),statusPill(source.status,reportNames[source.status]||source.status));
    add(node,title,el('p',null,source.message),el('div','source-scope','覆盖范围：'+source.scope),link('打开官方来源 ↗',source.url,'source-scope'));
    add(node,el('p','source-scope','采集能力：'+(source.adapter==='official_list'?(source.discovery?.pagination?'有限官方列表分页（最多 '+source.discovery.pagination.max_pages+' 页）；新线索先待核，不代表开放':'发现已核官方列表首屏；新线索在待核区，开放与规则另核'):source.adapter==='libtv'?'发现公开活动清单；图片及外链规则另核':source.adapter==='unadapted'?'已登记入口/证据，自动采集未适配':source.adapter==='homepage'?'核对主页可用性；不发现全平台福利':'仅核对已登记URL；不自动发现其他公告')));
    const dims=source.coverage;if(dims?.discovery)add(node,el('p','source-scope',`列表发现：${dims.discovery.state} · 扫描 ${dims.discovery.scanned} · 新线索 ${dims.discovery.new_candidates}；${dims.discovery.scope}`));add(node,dataGrid([['公开正文',dimensionText(dims?.article)],['规则字段',dimensionText(dims?.rules)],['本账号资格','未连接账号 · 未核验',true]]));
    if(typeof addScanCoverage==='function')addScanCoverage(node,source);if(dims?.rules?.missing?.length)add(node,el('p','source-scope','规则缺口：'+dims.rules.missing.join('；')));
    if(dims?.rules?.fields&&Object.keys(dims.rules.fields).length){const facts=el('details');add(facts,el('summary',null,'本次公开提取字段（人工规则另存）'),el('pre','diff',JSON.stringify(dims.rules.fields,null,2)));add(node,facts);}
    const times=el('dl','source-times');for(const [label,key]of[['最后尝试','last_attempt_at'],['最后取得页面','last_fetched_at'],['最后正文文本完整取得','last_article_success_at'],['最后规则完整检查成功','last_success_at']])add(times,add(el('div'),el('dt',null,label),el('dd',null,source[key]?fmt(source[key]):'尚无记录')));add(node,times);content.append(node);}
}
function renderChanges(){const content=$('content'),changes=state.data.changes;content.replaceChildren();
  for(const change of changes.pages){const source=state.data.sources.find(x=>x.id===change.source_id);const node=el('article','change-card');add(node,el('h2',null,(source?.name||change.source_id)+' · 提取文本变化'),el('small',null,fmt(change.at)+' · 待复核，尚未确认是规则变动'),el('div',null,link('查看原官方页 ↗',change.url)),el('pre','diff',change.diff));content.append(node);}
  for(const change of changes.versions){const node=el('article','change-card');add(node,el('h2',null,change.title+' · 版本 '+change.version),el('small',null,fmt(change.at)+' · '+change.reason),el('pre','diff',JSON.stringify(change.changes,null,2)),button('查看当前条目 ↗','card-open',()=>openDetail(change.opportunity_id)));content.append(node);}
  if(!changes.pages.length&&!changes.versions.length)content.append(empty('还没有规则变更记录','首次采集建立证据快照；后续正文或人工条款发生变化时保留前后差异。'));
}
function dataGrid(entries){const grid=el('dl','data-grid');for(const [label,value,wide]of entries)add(grid,add(el('div',wide?'wide':null),el('dt',null,label),el('dd',null,value||'未说明 / 未核验')));return grid;}
function detailSection(title,...children){const section=add(el('section','detail-section'),el('h3',null,title),...children);const ids={'时间与开放状态':'detail-time','奖励分别计量':'detail-rewards','首发、独家与版权':'detail-rights','人工 / 提取证据':'detail-evidence','我的笔记':'detail-notes'};if(ids[title])section.id=ids[title];return section;}
function listSection(title,values){const list=el('ul');if(values?.length)for(const value of values)add(list,el('li',null,value));else add(list,el('li',null,'尚未核到完整官方条款'));return detailSection(title,list);}
function evidenceLinks(record){const node=el('div','evidence-links');for(const [key,label] of [['external_rules','外部规则全文'],['image_refs','图文规则原图']])for(const [index,url] of [...new Set(Array.isArray(record[key])?record[key]:[])].entries())add(node,link(label+' '+(index+1)+' ↗',url));return node;}
function cashTable(tiers){
  const table=el('table','cash-table');add(table,add(el('thead'),add(el('tr'),...['数据条件','基础现金','优质画布加奖','条件均满足时合计'].map(label=>el('th',null,label)))));
  const body=el('tbody');for(const tier of tiers)add(body,add(el('tr'),el('td',null,tier.condition),el('td',null,tier.base.toLocaleString('zh-CN')+'元'),el('td',null,tier.canvas_bonus.toLocaleString('zh-CN')+'元'),el('td',null,(tier.base+tier.canvas_bonus).toLocaleString('zh-CN')+'元')));add(table,body);return add(el('div','table-wrap'),table);
}

function jumpDetail(target){const section=$(target);if(!section)return;for(let parent=section.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;section.scrollIntoView({block:'start'});const focus=target==='detail-notes'?section.querySelector('textarea'):section.querySelector('h3');if(focus){focus.tabIndex=-1;focus.focus({preventScroll:true});}}
function arrangeDecisionContent(body,item){
  const original=[...body.children],used=new Set();
  const take=node=>{if(node)used.add(node);return node;};
  const section=title=>take(original.find(node=>node.matches('section')&&node.querySelector('h3')?.textContent===title));
  const actions=take(body.querySelector('.detail-actions'));actions.classList.add('detail-primary-actions');
  const status=actions.querySelector('.status');if(status)status.remove();
  const summary=take(original.find(node=>node.tagName==='P'&&node.textContent===item.summary));
  const intro=add(el('section','decision-intro'),el('h3',null,'这是什么机会'),summary,el('small','decision-organizer','主办方：'+(item.organizer||'未核验')));
  const timing=opportunityTiming(item),overview=el('div','decision-overview');
  add(overview,add(el('div','decision-status'),status,el('p',null,item.status.note)),add(el('div','decision-deadline'),el('strong',null,timing.main),el('small',null,timing.note)));
  if(item.time.conflict)add(overview,el('p','decision-conflict',item.time.conflict));
  const nav=take(body.querySelector('.detail-nav'));
  const rewards=section('奖励分别计量'),eligibility=section('加入资格');
  if(eligibility)add(eligibility,el('p','qualification-note','以上为已整理的公开条件；本账号与这部作品的正式资格仍需确认。'));
  const decisions=add(el('div','decision-columns'),rewards,eligibility);
  const work=section('作品要求'),assessment=section('用途与AI资格');
  const fit=take(original.find(node=>node.id==='detail-fit'));
  let fitDisclosure;if(fit){fitDisclosure=add(el('details','fit-disclosure'),el('summary',null,'对照我的作品条件 · 个人资格仍需确认'),fit);}
  // The complete rights section remains visible. The alert only avoids repeating it twice.
  take(body.querySelector('.critical-terms'));
  const highlights=riskHighlights(item);let alert;
  if(highlights.length)alert=add(el('div','decision-alert'),el('strong',null,'参与前请先看限制'),el('span',null,highlights.join(' / ')),button('查看完整版权与限制 ↓','text-button',()=>jumpDetail('detail-rights')));
  const rights=section('首发、独家与版权'),steps=section('投稿 / 加入步骤'),program=section('长期机制 / 结算规则');
  const cash=section('现金档位与画布加奖'),canvas=section('画布加奖完整已核条件'),fees=section('已公布报名费用');
  const time=section('时间与开放状态');
  const timeSections=['公开活动周期元数据','官方截止原文','官方月份窗口','官方当前阶段','官方信息冲突'].map(section);
  const duration=item.time.policy_duration?take(original.find(node=>node.tagName==='P'&&node.textContent===item.time.policy_duration)):null;
  const conflict=section('奖励口径冲突');
  const related=section('关联计划与独立窗口'),notes=section('我的笔记');
  const back=take(original.find(node=>node.matches('button')&&node.textContent==='返回列表'));
  for(const node of original)if(used.has(node)&&node.matches('section'))node.classList.add('decision-section');
  const secondary=add(el('details','detail-secondary'),el('summary',null,'来源、核验与版本历史'));
  const secondaryBody=el('div','detail-secondary-content');
  for(const node of original)if(!used.has(node))add(secondaryBody,node);
  add(secondary,secondaryBody);
  body.replaceChildren();
  add(body,intro,overview,actions,nav,conflict,fees,decisions,work,assessment,fitDisclosure,alert,rights,steps,program,cash,canvas,time,...timeSections,duration,related,notes,secondary,back);
}
function closeDetail(){const dialog=$('detail'),context=state.detailContext;if(!context&&!dialog.open&&!state.detailId)return;
  ++state.detailRequest;state.detailAbort?.abort();state.detailAbort=null;state.detailId=null;state.noteUI=null;state.detailContext=null;
  if(dialog.open)dialog.close();dialog.removeAttribute('aria-busy');
  if(context){document.body.style.overflow=context.overflow;window.scrollTo(0,context.scroll);const fallback=document.querySelector(`.opportunity-card[data-id="${context.id}"] .card-title`);const target=context.opener?.isConnected?context.opener:fallback||$('result-title');target.focus({preventScroll:true});}
}
function refreshNoteState(){const ui=state.noteUI;if(!ui||!ui.note.isConnected)return;const item=state.data?.items.find(x=>x.id===ui.id);if(!item)return;
  const pending=state.pendingNotes.has(ui.id),dirty=ui.note.value!==item.note,error=state.noteErrors[ui.id],base=state.draftBases[ui.id],conflict=dirty&&(!base||base.revision!==item.preference_revision||base.note!==item.note),unconfirmed=Boolean(state.preferenceOperations[ui.id]);ui.save.disabled=pending||state.pendingStars.has(ui.id)||!dirty||conflict||Boolean(state.restorePending);ui.save.textContent=pending?'保存中…':conflict?'先核对当前版本':dirty?'保存笔记':'已保存';
  if(ui.reconcile){ui.reconcile.hidden=!(conflict||unconfirmed);ui.latest.textContent=item.note||'（当前没有已保存笔记）';ui.base.textContent=base?.note??'（旧草稿未记录原保存版本，需明确核对当前笔记）';ui.adopt.disabled=pending||state.pendingStars.has(ui.id)||unconfirmed||Boolean(state.restorePending);ui.resolve.hidden=!unconfirmed;ui.resolve.disabled=pending||state.pendingStars.has(ui.id)||Boolean(state.restorePending);}
  ui.status.textContent=state.restorePending?'恢复结果待确认；草稿保留，确认前暂停保存。':pending?'正在保存点击时的内容；继续编辑会保留为新草稿。':conflict?'草稿依据的个人资料版本已变化；草稿保留。请展开对照，明确采用当前版本后才能保存。':error?'保存失败：'+error+'。草稿仍在，可重试。':dirty?(state.storageAvailable?'草稿未保存 · 仅保留在当前标签页，刷新或关闭详情可恢复；关闭整个标签页前请先保存。':'草稿未保存 · 浏览器禁止草稿存储，请保存后再刷新。'):'已保存到本机资料库';
  ui.status.className='note-status'+(error?' error':dirty?' dirty':'');const indicator=$('detail-note-indicator');if(indicator){indicator.textContent=pending?'笔记保存中…':dirty?'笔记 · 未保存':'我的笔记';indicator.classList.toggle('dirty',dirty);}
}
async function saveNote(id,note){if(state.pendingNotes.has(id)||state.pendingStars.has(id)||state.stopped)return;const value=note.value;state.pendingNotes.add(id);delete state.noteErrors[id];refreshNoteState();syncStars(id);
  try{await submitPreference(id,{note:value});if(state.drafts[id]===value){delete state.drafts[id];delete state.draftBases[id];}persistUI();if(!state.stopped)toast('笔记已保存到本机');}
  catch(error){state.noteErrors[id]=error.message;toast('笔记未保存，草稿已保留：'+error.message);}
  finally{state.pendingNotes.delete(id);refreshNoteState();syncStars(id);}
}
async function openDetail(id){
  if(!state.data||state.stopped)return;const dialog=$('detail'),container=$('detail-content');
  if(!state.detailContext)state.detailContext={id,opener:document.activeElement,scroll:window.scrollY,overflow:document.body.style.overflow};
  const request=++state.detailRequest,revision=state.preferenceRevision,profileRevision=state.profileRevision||0;state.detailAbort?.abort();const controller=new AbortController();state.detailAbort=controller;state.detailId=id;state.noteUI=null;
  const loadingTitle=el('h2',null,'正在读取机会…');loadingTitle.id='detail-title';const loadingClose=button('×','close-button',closeDetail);loadingClose.setAttribute('aria-label','关闭详情');
  container.replaceChildren(add(el('div','dialog-header'),loadingTitle,loadingClose),add(el('div','dialog-body'),typeof loadingSkeleton==='function'?loadingSkeleton('读取本机已保存的详情；可以按 Esc 返回。',true):el('p',null,'读取本机已保存的详情；可以按 Esc 返回。')));dialog.setAttribute('aria-busy','true');document.body.style.overflow='hidden';if(!dialog.open){dialog.showModal();if(typeof briefFeedback==='function')briefFeedback(container,'dialog');}dialog.scrollTop=0;
  try{const item=mergePreferences(await api('/api/detail?id='+encodeURIComponent(id),undefined,controller.signal),revision);if(request!==state.detailRequest||state.stopped)return;if(typeof mergeProfileDetail==='function')mergeProfileDetail(item,profileRevision);const current=state.data.items.find(x=>x.id===id);if(current){current.note=item.note;current.starred=item.starred;current.preference_revision=item.preference_revision;}container.replaceChildren();dialog.removeAttribute('aria-busy');
    const h=el('h2',null,item.title);h.id='detail-title';h.tabIndex=-1;const close=button('×','close-button',closeDetail);close.setAttribute('aria-label','关闭详情');const back=button('← 返回','detail-back',closeDetail);
    const heading=add(el('div','detail-heading-copy'),el('small',null,item.platform+' · '+item.kind_label+' · '+item.edition),h);
    const headingIdentity=typeof opportunityIdentity==='function'?opportunityIdentity(item,'detail'):null;
    add(container,add(el('div','dialog-header'),add(el('div','detail-heading'),headingIdentity,heading),add(el('div','dialog-controls'),back,close)));
    const status=displayStatus(item);const body=el('div','dialog-body');const actions=add(el('div','detail-actions'),statusPill(status.code,status.label),link('官方原文 ↗',item.official_url,'link-button'));
    if(item.entry_url)add(actions,link('报名 / 加入入口 ↗',item.entry_url,'link-button'));
    add(actions,starButton(item,true));add(body,actions,el('p',null,item.summary));
    const nav=el('nav','detail-nav');nav.setAttribute('aria-label','详情段落');for(const [label,target] of [['时间与状态','detail-time'],['奖励与条件','detail-rewards'],['版权与限制','detail-rights'],['原文与证据','detail-evidence'],['我的笔记','detail-notes']]){const node=button(label,null,()=>jumpDetail(target));if(target==='detail-notes')node.id='detail-note-indicator';add(nav,node);}add(body,nav);
    if(typeof fitDetail==='function')add(body,fitDetail(item));
    const metadata=[['主办方',item.organizer],['平台 / 轮次',item.platform+' / '+item.edition],['公开条款核验',item.verification==='complete'?'记录已核完整；个人资格另核':'部分字段已核，仍有待核条款'],['排序位置',item.priority?.label]];if(item.entry_status)metadata.push(['加入入口状态',item.entry_status,true]);if(item.contact_email)metadata.push(['官方联系邮箱',item.contact_email,true]);add(body,detailSection('机会档案',dataGrid(metadata)));
    if(typeof visualProvenance==='function')add(body,visualProvenance(item));
    const source=state.data.sources.find(s=>s.id===item.source_id);
    add(body,el('div','provenance',`${originNames[item.origin]||item.origin} · 条目核验 ${fmt(item.verified_at)}。${item.origin==='live_fetch'?'提取结果仍需核对原文。':'本机抓取证据另列，不会覆盖已核条款。'} ${source?'本机自动抓取最近结果：'+(reportNames[source.status]||source.status)+'。':''}AI作品资格需按官方当前规则核对。`));
    if(item.public_review)add(body,detailSection('本轮公开原文复核',el('p',null,'本轮只补核以下字段；下方历史证据保留当时的核验状态，自动抓取能力另列。'),dataGrid([['核验日期',fmt(item.public_review.at)],['核验方法',item.public_review.method,true],['本轮已核字段',item.public_review.fields_verified?.join('\n'),true],['仍待核',item.public_review.remaining?.join('\n'),true]])));
    if(item.source_attachments?.length){const attachments=el('div','evidence-links');for(const attachment of item.source_attachments)add(attachments,link(attachment.label+' ↗',attachment.url));add(body,detailSection('官方附件与申报材料',attachments));}
    if(item.risks.some(r=>r.level==='high')){const critical=el('div','critical-terms');add(critical,el('strong',null,'决定参加前先看这些限制'));for(const risk of item.risks.filter(r=>r.level==='high'))add(critical,el('p',null,risk.detail));add(body,critical);}
    if(source?.coverage)add(body,detailSection('最近公开抓取与本账号资格',dataGrid([['公开正文',dimensionText(source.coverage.article)],['规则字段',dimensionText(source.coverage.rules)],['本账号资格','未连接个人账号 · 未核验',true]])));
    add(body,detailSection('时间与开放状态',dataGrid([['公告发布时间',fmt(item.publication_at)],['时间机制',item.mechanism_label],['报名 / 加入开始',fmt(item.time.start)],['报名 / 加入截止',fmt(item.time.deadline)],['明确的绝对开始',fmt(item.time.absolute_start)],['明确的绝对截止',fmt(item.time.absolute_deadline)],['政策生效',fmt(item.time.policy_effective)],['政策终止',fmt(item.time.policy_end)],['政策 / 规则版本',item.time.policy_version],['原文时区',item.time.timezone||'未注明；边界状态保守判断'],['公开时间证据',item.time.evidence,true],['当前状态判断',item.status.note,true],['当前批次',item.time.batches?.join('\n'),true]])));
    if(item.time.source_window)add(body,detailSection('公开活动周期元数据',el('p',null,`${fmt(item.time.source_window.start)} → ${fmt(item.time.source_window.end)}\n${item.time.source_window.note}`)));
      if(item.time.policy_duration)add(body,el('p',null,item.time.policy_duration));
      if(item.time.deadline_raw)add(body,detailSection('官方截止原文',el('p',null,item.time.deadline_raw+(item.time.deadline_tentative?'（暂定；不自动归档）':''))));
      if(item.time.month_period)add(body,detailSection('官方月份窗口',el('p',null,`${item.time.month_period.start} 至 ${item.time.month_period.end}；没有已核日与时刻，不补造。`)));
      if(item.time.provider_phase)add(body,detailSection('官方当前阶段',el('p',null,item.time.provider_phase)));
      if(item.time.conflict)add(body,detailSection('官方信息冲突',el('div','risk-card high',item.time.conflict)));
      if(item.assessment)add(body,detailSection('用途与AI资格',dataGrid([['记录用途',roleNames[item.assessment.role]||item.assessment.role],['AI使用规定',{allowed:'公告明确为AI创作方向',limited:'仅允许有限AI参与；具体比例见作品要求',prohibited:'官方不接受AI作品',unspecified:'未核；不得默认允许'}[item.assessment.ai_policy]||'未核'],['判断依据',item.assessment.reason,true],['个人资格','未对照本账号与具体作品；相关度不等于正式推荐',true]])));
      if(item.importance)add(body,detailSection('关注依据',el('p',null,item.importance.basis)));
      if(item.related_items?.length){const related=el('div','related-records');for(const r of item.related_items)add(related,button((r.direction==='child'?'子活动 / 规则：':'母计划 / 主单元：')+r.title+' · '+r.status,null,()=>openDetail(r.id)),r.note?el('p',null,r.note):null);add(body,detailSection('关联计划与独立窗口',related));}
      if(item.fees?.length)add(body,detailSection('已公布报名费用',dataGrid(item.fees.map(f=>[f.type,`${f.amount} ${f.currency}；${f.scope}`,true]))));
      if(item.reward_conflict)add(body,detailSection('奖励口径冲突',el('div','risk-card high',item.reward_conflict)));
    add(body,listSection('加入资格',item.eligibility),listSection('作品要求',item.work_requirements),listSection('投稿 / 加入步骤',item.steps));
    const rewards=el('div','reward-grid');for(const reward of item.rewards){const node=el('article','reward-card');add(node,el('small',null,rewardNames[reward.type]),el('strong',null,rewardText(reward)));if(typeof reward.amount==='number')add(node,el('p',null,reward.label));add(node,el('p',null,`口径：${reward.scope||'细则待核'} · 有效期：${reward.validity||'未核 / 不适用'}`));if(reward.source_excerpt)add(node,el('p',null,reward.source_excerpt));add(rewards,node);}
    add(body,detailSection('奖励分别计量',item.rewards.length?rewards:el('p',null,'尚未核验；不推断现金、积分或流量额度。')));
    if(item.cash_tiers?.length)add(body,detailSection('现金档位与画布加奖',el('p',null,'每条一次提报最高档、每周现金最多3条。基础与画布分别审核，可叠加；不是所有投稿都获奖，也不能把各档相加。税前/税后口径仍未核。'),cashTable(item.cash_tiers)));
    if(item.canvas_requirements?.length)add(body,listSection('画布加奖完整已核条件',item.canvas_requirements));
    if(item.kind==='creator_program'||Object.values(item.program).some(Boolean))add(body,detailSection('长期机制 / 结算规则',dataGrid(Object.entries(programNames).map(([key,label])=>[label,item.program[key],true]))));
    const risks=el('div');for(const risk of item.risks)add(risks,el('div','risk-card '+risk.level,risk.detail));if(!item.risks.length)add(risks,el('div','risk-card','尚未核到完整首发、独家、授权或版权转让条款。缺失不代表没有限制。'));add(body,detailSection('首发、独家与版权',risks));
      const chips=el('div','missing-chips');for(const missing of item.missing_fields)add(chips,el('span',null,missing));add(body,detailSection(`缺失字段 · 记录度 ${item.evidence_score}%`,chips));add(body,el('p',null,'字段记录度表示信息已填写的比例；未知值与文字中的待核项仍需核实，不代表规则完整或个人资格通过。'));
    const evidence=el('div');for(const record of item.evidence){const row=el('div','evidence-row');add(row,el('small',null,(originNames[record.origin]||record.origin)+' · '+fmt(record.observed_at)+(record.method==='manual_public_review_handoff'?' · 官方公开全文人工复核交接':'')),el('p',null,record.excerpt),record.note?el('p',null,record.note):null,link('证据所在官方页 ↗',record.url),evidenceLinks(record));add(evidence,row);}add(body,detailSection('人工 / 提取证据',evidence));
    for(const record of item.observations){const detail=el('details');add(detail,el('summary',null,`本机抓取原文 · ${fmt(record.last_seen_at)} · ${record.quality}`),link('打开抓取时的官方页 ↗',record.url||item.official_url),el('p',null,'自动提取可能不完整；已整理条款在上方，人工证据和本机抓取分别保留。'),el('small',null,'页面原始内容 SHA-256：'+record.raw_hash),evidenceLinks(record.coverage?.article||{}),el('pre','diff',record.body));add(body,detail);}
    const versions=el('div');for(const version of item.versions){const detail=el('details');add(detail,el('summary',null,`版本 ${version.version} · ${fmt(version.at)} · ${version.reason}`),el('pre','diff',version.changes.length?JSON.stringify(version.changes,null,2):'初始记录；全文快照保存在本机，可随资料导出。'));add(versions,detail);}add(body,detailSection('条目版本历史',versions));
    for(const change of item.page_changes){const detail=el('details');add(detail,el('summary',null,'正文变化待复核 · '+fmt(change.at)),el('pre','diff',change.diff));add(body,detail);}
    const note=el('textarea','notes');note.value=Object.hasOwn(state.drafts,id)?state.drafts[id]:item.note;note.maxLength=5000;note.setAttribute('aria-label','我的创作笔记');note.setAttribute('aria-describedby','note-status');note.placeholder='记下资格是否匹配、作品想法或需要核对的条款…';
    const statusText=el('p','note-status');statusText.id='note-status';statusText.setAttribute('role','status');const save=button('保存笔记','save-button',()=>saveNote(id,note));note.addEventListener('input',()=>{if(!Object.hasOwn(state.drafts,id)){const current=state.data.items.find(value=>value.id===id);if(Number.isSafeInteger(current?.preference_revision))state.draftBases[id]={revision:current.preference_revision,note:current.note};}state.drafts[id]=note.value;delete state.noteErrors[id];persistUI();refreshNoteState();});
    const reconcile=el('details','note-version-comparison');reconcile.id='note-version-comparison';const latest=el('pre','diff note-latest-saved'),base=el('pre','diff note-original-saved');add(reconcile,el('summary',null,'对照草稿原版本与最新已保存笔记'),el('p',null,'草稿原依据的笔记'),base,el('p',null,'当前已保存笔记（草稿仍在上方）'),latest);const adopt=button('已对照，按当前版本继续保存','text-button',()=>{const current=state.data.items.find(value=>value.id===id);if(!current||state.preferenceOperations[id]||state.pendingNotes.has(id)||state.pendingStars.has(id)||state.restorePending)return;state.draftBases[id]={revision:current.preference_revision,note:current.note};delete state.noteErrors[id];persistUI();refreshNoteState();toast('已采用当前版本作为草稿依据；草稿尚未保存');});
    const resolve=button('核对上次提交结果','text-button',async()=>{const operation=state.preferenceOperations[id];if(!operation||state.pendingNotes.has(id)||state.pendingStars.has(id)||state.restorePending)return;state.pendingNotes.add(id);refreshNoteState();syncStars(id);try{await submitPreference(id,Object.hasOwn(operation,'note')?{note:operation.note}:{starred:operation.starred});delete state.noteErrors[id];toast('上次提交已确认；当前草稿仍保留，请对照后保存');}catch(error){state.noteErrors[id]=error.message;toast('上次提交核对：'+error.message);}finally{state.pendingNotes.delete(id);refreshNoteState();syncStars(id);}});add(reconcile,adopt,resolve);state.noteUI={id,note,save,status:statusText,reconcile,latest,base,adopt,resolve};add(body,detailSection('我的笔记',note,add(el('div','note-actions'),save,statusText),reconcile));
    add(body,button('返回列表','link-button',closeDetail));arrangeDecisionContent(body,item);add(container,body);if(globalThis.stage2Review)add(body.querySelector('.detail-secondary-content'),globalThis.stage2Review.detailTools(item));if(globalThis.librarySearch)globalThis.librarySearch.afterDetail(item);if(typeof addPreparationAction==='function')addPreparationAction(item,body);refreshNoteState();dialog.scrollTop=0;h.focus({preventScroll:true});
  }catch(error){if(request!==state.detailRequest||error.name==='AbortError')return;dialog.removeAttribute('aria-busy');const title=el('h2',null,'详情暂未读到');title.id='detail-title';title.tabIndex=-1;const close=button('×','close-button',closeDetail);close.setAttribute('aria-label','关闭详情');container.replaceChildren(add(el('div','dialog-header'),title,close),add(el('div','dialog-body'),el('p',null,error.message+'；本机已保存资料未被修改。'),button('重试读取详情','link-button',()=>openDetail(id)),button('返回列表','link-button',closeDetail)));title.focus({preventScroll:true});}
}

async function checkUpdate(){
  if(state.stopped||!state.data||state.updateStarting||state.data.update.running||state.updateError||state.statusReading||state.restorePending)return;
  state.updateStarting=true;renderNotice();
  try{const result=await api('/api/update',{});if(state.stopped)return;state.data.update=result;if(result.cooldown)toast('刚完成一轮检查，请稍后再检查；本次没有启动新一轮。');else if(result.running)pollUpdate();else if(result.error)toast('检查未完成：'+result.error);}
  catch(error){if(!state.stopped){state.updateError=error.message;toast('检查请求未获确认，请重读状态后再操作');}}
  finally{state.updateStarting=false;renderNotice();}
}
function pollUpdate(){clearTimeout(state.poll);if(!state.stopped)state.poll=setTimeout(()=>readUpdateStatus(true),800);}
async function readUpdateStatus(completedFeedback){clearTimeout(state.poll);if(state.stopped||state.statusReading)return;state.statusReading=true;renderNotice();
  try{const update=await api('/api/update');if(state.stopped)return;state.updateError=null;state.data.update=update;renderNotice();if(update.running)pollUpdate();else{const refreshed=await load();if(!refreshed){state.updateError='本轮状态已读取，但保存结果暂未重新连接';renderNotice();}else if(completedFeedback){if(update.error)toast('检查未完成：'+update.error);else{const counts=latestRun()?.summary?.counts;toast(counts?`本轮结束 · 部分 ${counts.partial} / 失败 ${counts.failed} / 待核 ${counts.pending}，请查看信源结果`:'检查结束状态已读取，请查看信源结果');}}}}
  catch(error){if(!state.stopped){state.updateError=error.message;renderNotice();toast('检查状态暂时无法读取；可重读状态，浏览不受影响');}}
  finally{state.statusReading=false;renderNotice();}
}
async function stopService(){try{await api('/api/stop',{});state.stopped=true;clearTimeout(state.poll);closeDetail();$('update').disabled=true;$('stop').disabled=true;$('opportunity-tools').hidden=true;$('list-heading').hidden=true;$('stats').hidden=true;$('update-notice').textContent=informationMounted?'信息模块已停止；学习小岛和素材观察室仍可使用，已保存资料保留。':'本地服务已停止；已保存的资料会保留。';$('content').replaceChildren(add(el('div','stopped'),el('h2',null,informationMounted?'已停止信息模块':'已停止本地服务'),el('p',null,informationMounted?'重新运行统一启动脚本后刷新本页，即可继续浏览。停止整个应用请使用统一停止脚本。':'下次双击「双击启动.cmd」，即可继续浏览已有资料。')));}catch(error){toast(error.message);}}

for(const node of document.querySelectorAll('[data-view]'))node.addEventListener('click',()=>setView(node.dataset.view));
document.querySelector('.brand').addEventListener('click',event=>{event.preventDefault();setView('opportunities');});
for(const node of document.querySelectorAll('[data-kind]'))node.addEventListener('click',()=>{state.kind=node.dataset.kind;persistUI();render();});
for(const id of ['platform','status','reward','sort'])$(id).addEventListener('change',event=>{state[id]=event.target.value;persistUI();render();});
$('search').addEventListener('input',event=>{state.search=event.target.value;persistUI();renderFilterSummary();renderList();});
$('clear-search').addEventListener('click',()=>{state.search='';$('search').value='';persistUI();renderList();$('search').focus();});
$('update').addEventListener('click',checkUpdate);$('stop').addEventListener('click',stopService);
$('detail').addEventListener('click',event=>{if(event.target===$('detail')){const rect=$('detail').getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)closeDetail();}});
$('detail').addEventListener('cancel',event=>{event.preventDefault();closeDetail();});
$('detail').addEventListener('close',()=>{if(!$('detail').open)closeDetail();});
document.addEventListener('keydown',event=>{if(event.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&!$('detail').open){event.preventDefault();$('search').focus();}});
window.addEventListener('pagehide',()=>{state.viewPositions[state.view]=state.detailContext?.scroll??window.scrollY;persistUI();});
$('today').textContent=new Date().toLocaleDateString('zh-CN',{year:'numeric',month:'long',day:'numeric',timeZone:'UTC'})+' · UTC';
for(const moduleLink of document.querySelectorAll('[data-module-route]')){
  const route=moduleLink.dataset.moduleRoute;moduleLink.href=informationMounted?route:route==='/information/'?'./':'http://127.0.0.1:8787'+route;
}
if(informationMounted){$('stop').textContent='停止信息模块';$('stop').title='只停止信息收集服务；学习小岛和素材观察室继续运行。';}
restoreUI();syncFilters();load().then(loaded=>{if(loaded)setView(state.view);});
