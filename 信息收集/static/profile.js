'use strict';

const workProfileFields = ['duration_seconds','is_student','ai_tools','is_published','uses_ai','ai_percent'];
const workFitLabels = {matched:'符合已核作品条件',mismatched:'不符合已核作品条件',unknown:'待确认'};
const workRuleLabels = {
  duration_min_seconds:'最低作品时长',duration_max_seconds:'最高作品时长',
  student_required:'学生身份',required_tools:'指定工具',published_allowed:'已公开作品',
  ai_allowed:'AI 使用限制',ai_required:'AI 使用要求',ai_min_percent:'最低 AI 占比',ai_max_percent:'最高 AI 占比'
};
const workProfileDraftKey='xiaomo-work-profile-draft-v1';
const profileViewState = {ui:null,saved:null,pending:false,error:null,lastSaved:null,lastFits:null,savedChanged:false,restoredDraft:false,restoredSessionDraft:false,draftStorageAvailable:true,draftFeedback:null};

function workProfileCopy(value){
  const profile={};
  for(const field of workProfileFields)profile[field]=value?.[field]===undefined?null:value[field];
  return JSON.parse(JSON.stringify(profile));
}
function workProfileEqual(left,right){
  const a=workProfileCopy(left),b=workProfileCopy(right);
  return workProfileFields.every(field=>typeof a[field]==='number'&&typeof b[field]==='number'?Math.abs(a[field]-b[field])<=Number.EPSILON*Math.max(1,Math.abs(a[field]),Math.abs(b[field]))*8:JSON.stringify(a[field])===JSON.stringify(b[field]));
}
function hasWorkProfile(profile=state.data?.work_profile){return workProfileFields.some(field=>profile?.[field]!==null&&profile?.[field]!==undefined);}
function workProfileTriState(label,id,yes='是',no='否'){
  const control=el('select');control.id=id;
  for(const [value,text] of [['','待确认'],['true',yes],['false',no]]){const option=el('option',null,text);option.value=value;add(control,option);}
  const row=el('div','profile-field');const caption=el('label',null,label);caption.htmlFor=id;add(row,caption,control);
  return {row,control};
}
function workProfileNumber(label,id,placeholder,min,max){
  const control=el('input');control.type='number';control.id=id;control.step='any';control.min=String(min);if(max!==undefined)control.max=String(max);control.inputMode='decimal';control.placeholder=placeholder;
  const row=el('div','profile-field');const caption=el('label',null,label);caption.htmlFor=id;add(row,caption,control);
  return {row,control};
}
function workProfileFill(profile){
  const ui=profileViewState.ui;if(!ui)return;
  const value=workProfileCopy(profile);
  ui.controls.duration_seconds.value=value.duration_seconds===null?'':String(value.duration_seconds/60);
  ui.controls.ai_percent.value=value.ai_percent===null?'':String(value.ai_percent);
  for(const field of ['is_student','is_published','uses_ai'])ui.controls[field].value=value[field]===null?'':String(value[field]);
  ui.controls.ai_tools.value=Array.isArray(value.ai_tools)?value.ai_tools.join('，'):'';
  ui.noTools.checked=Array.isArray(value.ai_tools)&&value.ai_tools.length===0;
  ui.controls.ai_tools.disabled=ui.noTools.checked;
}
function workProfileRead(){
  const ui=profileViewState.ui,profile={};
  for(const field of ['is_student','is_published','uses_ai'])profile[field]=ui.controls[field].value===''?null:ui.controls[field].value==='true';
  for(const field of ['duration_seconds','ai_percent']){
    const control=ui.controls[field],raw=control.value.trim();
    if(control.validity?.badInput)throw new Error(field==='duration_seconds'?'作品时长需要有效数字':'AI 占比需要有效数字');
    profile[field]=raw===''?null:Number(raw)*(field==='duration_seconds'?60:1);
  }
  if(profile.duration_seconds!==null&&(!Number.isFinite(profile.duration_seconds)||profile.duration_seconds<=0))throw new Error('作品时长必须大于 0 分钟，或留空为待确认');
  if(profile.ai_percent!==null&&(!Number.isFinite(profile.ai_percent)||profile.ai_percent<0||profile.ai_percent>100))throw new Error('AI 占比必须在 0 至 100 之间，或留空为待确认');
  const rawTools=ui.controls.ai_tools.value.trim();
  const names=[...new Map(rawTools.split(/[,，;；\n]+/).map(value=>value.trim()).filter(Boolean).map(value=>[value.toLowerCase(),value])).values()];
  profile.ai_tools=ui.noTools.checked?[]:names.length?names:null;
  if(profile.ai_tools!==null&&(profile.ai_tools.length>30||profile.ai_tools.some(value=>value.length>100)))throw new Error('工具最多 30 个，每个名称最多 100 个字符');
  if(profile.uses_ai===false&&(profile.ai_tools?.length||profile.ai_percent>0))throw new Error('未使用 AI 与工具名称或 AI 占比冲突，请核对');
  return profile;
}
function rememberWorkProfileDraft(){
  const ui=profileViewState.ui;if(!ui)return;
  let dirty=true;try{dirty=!workProfileEqual(workProfileRead(),profileViewState.saved);}catch{}
  try{
    if(!dirty){sessionStorage.removeItem(workProfileDraftKey);return;}
    const fields=Object.fromEntries(workProfileFields.map(field=>[field,ui.controls[field].value]));
    sessionStorage.setItem(workProfileDraftKey,JSON.stringify({version:1,fields,no_tools:ui.noTools.checked}));
  }catch{profileViewState.draftStorageAvailable=false;}
}
function restoreWorkProfileDraft(){
  const ui=profileViewState.ui;let raw;
  try{raw=sessionStorage.getItem(workProfileDraftKey);}catch{profileViewState.draftStorageAvailable=false;return;}
  if(!raw)return;
  let draft;
  try{draft=JSON.parse(raw);}catch{draft=null;}
  const valid=draft?.version===1&&draft.fields&&typeof draft.no_tools==='boolean'&&workProfileFields.every(field=>typeof draft.fields[field]==='string'&&draft.fields[field].length<=4000)&&['is_student','is_published','uses_ai'].every(field=>['','true','false'].includes(draft.fields[field]));
  if(!valid){
    try{sessionStorage.removeItem(workProfileDraftKey);}catch{profileViewState.draftStorageAvailable=false;}
    profileViewState.draftFeedback='本标签页的草稿未能恢复，已读取本机保存的条件。';return;
  }
  for(const field of workProfileFields)ui.controls[field].value=draft.fields[field];
  ui.noTools.checked=draft.no_tools;ui.controls.ai_tools.disabled=draft.no_tools;profileViewState.restoredSessionDraft=true;
}
function refreshProfileState(){
  const ui=profileViewState.ui;if(!ui)return;
  if(state.data?.work_profile&&!workProfileEqual(state.data.work_profile,profileViewState.saved)){
    let wasDirty=true;try{wasDirty=!workProfileEqual(workProfileRead(),profileViewState.saved);}catch{}
    profileViewState.savedChanged=wasDirty||profileViewState.pending;profileViewState.saved=workProfileCopy(state.data.work_profile);
    if(!wasDirty&&!profileViewState.pending)workProfileFill(profileViewState.saved);
  }
  let dirty=true;try{dirty=!workProfileEqual(workProfileRead(),profileViewState.saved);}catch{}
  ui.save.disabled=Boolean(profileViewState.pending||!dirty||state.stopped||state.restorePending);
  ui.clear.disabled=Boolean(state.restorePending);ui.revert.disabled=Boolean(state.restorePending);
  ui.save.textContent=profileViewState.pending?'保存中…':dirty?'保存作品条件':'已保存';
  ui.summary.textContent='我的作品条件 · '+(profileViewState.pending?'保存中':dirty?'草稿未保存':hasWorkProfile(profileViewState.saved)?'已保存':'待填写');
  ui.error.hidden=!profileViewState.error;ui.error.textContent=profileViewState.error||'';
  ui.status.className='profile-status'+(profileViewState.error?' error':dirty?' dirty':'');
  const message=state.stopped?'本地服务已停止，当前修改尚未保存。':state.restorePending?'恢复状态待确认，当前草稿保留，暂不写入作品条件。':profileViewState.pending?'正在保存点击时的条件；可以继续编辑，新修改会保留为草稿。':profileViewState.error?'保存未完成，当前草稿仍保留，可核对后重试。':dirty?(profileViewState.restoredDraft?'资料恢复后的已保存作品条件已经更新；当前编辑草稿仍保留，尚未参与适配。':profileViewState.restoredSessionDraft?'已恢复此标签页的未保存草稿；适配仍采用本机已保存的条件。':profileViewState.savedChanged?'本机已保存作品条件已经更新；当前表单仍保留编辑内容，需保存后才更新适配。':'草稿尚未保存；点击保存后才更新本机适配结果。'):hasWorkProfile(profileViewState.saved)?'条件已保存到本机；适配结果依据已保存的条件。':'尚未填写作品条件；未确认的项目保留为待确认。';
  rememberWorkProfileDraft();
  ui.status.textContent=(profileViewState.draftFeedback&&!profileViewState.pending?profileViewState.draftFeedback+' ':'')+message+(dirty?(profileViewState.draftStorageAvailable?' 此标签页刷新后可恢复草稿。':' 浏览器无法保存刷新后的草稿，请保存后再刷新。'):'');
}

function afterProfileRestore(){
  const ui=profileViewState.ui;if(!ui||!state.data)return;
  let dirty=true;try{dirty=!workProfileEqual(workProfileRead(),profileViewState.saved);}catch{}
  const saved=workProfileCopy(state.data.work_profile);profileViewState.saved=saved;profileViewState.lastSaved=saved;
  profileViewState.lastFits=Object.fromEntries((state.data.items||[]).map(item=>[item.id,item.fit]));
  state.profileRevision=(state.profileRevision||0)+1;profileViewState.error=null;profileViewState.savedChanged=false;profileViewState.restoredDraft=dirty;
  if(!dirty)workProfileFill(saved);
  refreshProfileState();
}

// The main load captures this revision before its GET and calls the merge hook
// before replacing state.data, so an older request cannot undo a completed save.
function mergeProfileResponse(result,requestProfileRevision){
  if((state.profileRevision||0)>requestProfileRevision&&profileViewState.lastSaved){
    result.work_profile=workProfileCopy(profileViewState.lastSaved);
    for(const item of result.items||[]){
      item.fit=profileViewState.lastFits?.[item.id]||{status:'unknown',label:'待确认',checks:[],account_status:'unknown',note:'作品条件刚更新，此条目的规则适配需重新读取。'};
    }
  }
  return result;
}
function acceptProfileResponse(result){
  if(!result?.work_profile)return;
  const saved=workProfileCopy(result.work_profile),fits=Object.fromEntries((result.items||[]).map(item=>[item.id,item.fit]));
  if(!profileViewState.lastSaved||!workProfileEqual(saved,profileViewState.lastSaved)||JSON.stringify(fits)!==JSON.stringify(profileViewState.lastFits||{}))state.profileRevision=(state.profileRevision||0)+1;
  profileViewState.lastSaved=saved;profileViewState.lastFits=fits;
}
function mergeProfileDetail(item,requestProfileRevision){
  if((state.profileRevision||0)>requestProfileRevision&&profileViewState.lastFits?.[item.id])item.fit=profileViewState.lastFits[item.id];
  return item;
}
async function saveWorkProfile(){
  const ui=profileViewState.ui;if(!ui||profileViewState.pending||state.stopped||state.restorePending)return;
  let snapshot;
  try{snapshot=workProfileRead();}
  catch(error){profileViewState.error=error.message;refreshProfileState();return;}
  profileViewState.pending=true;state.profileSaving=true;profileViewState.error=null;refreshProfileState();
  try{
    const result=await api('/api/profile',snapshot);
    if(result.saved!==true||!result.work_profile||!result.fits||typeof result.fits!=='object')throw new Error('保存结果未获确认，请重新读取本机资料后核对');
    const saved=workProfileCopy(result.work_profile);
    profileViewState.saved=saved;profileViewState.lastSaved=saved;profileViewState.lastFits=result.fits;profileViewState.savedChanged=false;profileViewState.restoredDraft=false;profileViewState.restoredSessionDraft=false;profileViewState.draftFeedback=null;
    state.profileRevision=(state.profileRevision||0)+1;
    if(state.data){state.data.work_profile=saved;for(const item of state.data.items||[])if(Object.hasOwn(result.fits,item.id))item.fit=result.fits[item.id];}
    if(!state.stopped){
      render();
      const current=state.data.items.find(item=>item.id===state.detailId),detail=document.getElementById('detail-fit');
      if(current&&detail)detail.replaceWith(fitDetail(current));
      refreshNoteState();toast('作品条件已保存到本机');
    }
  }catch(error){profileViewState.error=error.message;if(!state.stopped)toast('作品条件保存未完成，草稿仍保留：'+error.message);}
  finally{profileViewState.pending=false;state.profileSaving=false;refreshProfileState();}
}
function initProfileUI(){
  if(profileViewState.ui){refreshProfileState();return;}
  const host=document.getElementById('profile-editor');if(!host||!state.data)return;
  if(!Number.isInteger(state.profileRevision))state.profileRevision=0;
  state.profileSaving=false;
  const details=el('details','profile-details'),summary=el('summary',null,'我的作品条件');
  const intro=el('p','profile-intro','填写作品条件后可逐条对照官方规则。未确认的项目留空，保存后才参与适配；条件只保存在本机。');
  const context=el('p','profile-context','历史背景提到约 4 分钟作品、大四数媒学生；这只是填写参考，尚未替你确认或填入任何条件。');
  const form=el('form','profile-form'),grid=el('div','profile-grid'),controls={};
  const duration=workProfileNumber('作品时长（分钟）','profile-duration','待确认',0);controls.duration_seconds=duration.control;
  const durationHint=el('small','profile-field-hint','按实际成片时长填写，可输入小数。');durationHint.id='profile-duration-hint';duration.control.setAttribute('aria-describedby',durationHint.id);add(duration.row,durationHint);
  const student=workProfileTriState('当前学生身份','profile-student','在读学生','非在读学生');controls.is_student=student.control;
  const published=workProfileTriState('作品是否已经公开','profile-published','已公开','尚未公开');controls.is_published=published.control;
  const ai=workProfileTriState('作品是否使用 AI','profile-ai-used','已使用 AI','未使用 AI');controls.uses_ai=ai.control;
  const percent=workProfileNumber('作品 AI 占比（%）','profile-ai-percent','待确认',0,100);controls.ai_percent=percent.control;
  const percentHint=el('small','profile-field-hint','不同活动的画面占比与流程参与比例口径可能不同，请按目标活动原文核对。');percentHint.id='profile-percent-hint';percent.control.setAttribute('aria-describedby',percentHint.id);add(percent.row,percentHint);
  const tools=el('div','profile-field profile-field-wide'),toolsLabel=el('label',null,'作品使用的 AI 工具');toolsLabel.htmlFor='profile-ai-tools';
  const toolsControl=el('input');toolsControl.type='text';toolsControl.id='profile-ai-tools';toolsControl.placeholder='工具名称用逗号或分号分隔；留空为待确认';toolsControl.maxLength=3100;controls.ai_tools=toolsControl;
  const noTools=el('input');noTools.type='checkbox';noTools.id='profile-no-tools';const noToolsLabel=el('label','profile-checkbox');add(noToolsLabel,noTools,el('span',null,'明确未使用 AI 工具'));
  const toolsHint=el('small','profile-field-hint','请使用官方规则中的工具名称；未确认工具与明确未使用工具分别记录。');toolsHint.id='profile-tools-hint';toolsControl.setAttribute('aria-describedby',toolsHint.id);add(tools,toolsLabel,toolsControl,noToolsLabel,toolsHint);
  add(grid,duration.row,student.row,published.row,ai.row,percent.row,tools);
  const error=el('p','profile-error');error.hidden=true;error.setAttribute('role','alert');
  const status=el('p','profile-status');status.id='profile-save-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const save=el('button','save-button','保存作品条件');save.type='submit';save.setAttribute('aria-describedby',status.id);
  const clear=button('清空为待确认','text-button',()=>{if(state.restorePending)return;workProfileFill({});profileViewState.error=null;profileViewState.restoredSessionDraft=false;profileViewState.draftFeedback='已清空表单为待确认；点击保存后才清除本机条件。';refreshProfileState();controls.duration_seconds.focus();});
  const revert=button('恢复已保存条件','text-button',()=>{if(state.restorePending)return;workProfileFill(profileViewState.saved);profileViewState.error=null;profileViewState.restoredSessionDraft=false;profileViewState.restoredDraft=false;profileViewState.draftFeedback='已恢复已保存条件，未保存的表单修改已清除。';refreshProfileState();});
  add(form,grid,error,add(el('div','profile-actions'),save,clear,revert),status);add(details,summary,intro,context,form);host.replaceChildren(details);
  profileViewState.ui={details,summary,form,controls,noTools,save,clear,revert,status,error};profileViewState.saved=workProfileCopy(state.data.work_profile);workProfileFill(profileViewState.saved);
  restoreWorkProfileDraft();
  form.addEventListener('submit',event=>{event.preventDefault();saveWorkProfile();});
  form.addEventListener('input',()=>{profileViewState.error=null;profileViewState.draftFeedback=null;refreshProfileState();});
  form.addEventListener('change',()=>{controls.ai_tools.disabled=noTools.checked;profileViewState.error=null;profileViewState.draftFeedback=null;refreshProfileState();});
  const filter=document.getElementById('fit-filter');
  if(filter){
    if(!filter.options.length)for(const [value,label] of [['all','全部作品适配'],['matched','符合已核作品条件'],['mismatched','不符合已核作品条件'],['unknown','待确认']]){const option=el('option',null,label);option.value=value;add(filter,option);}
    if(!['all','matched','mismatched','unknown'].includes(state.fit))state.fit='all';filter.value=state.fit;
    filter.addEventListener('change',()=>{state.fit=filter.value;persistUI();renderList();});
  }
  refreshProfileState();
}

function fitBadge(item){
  if(!hasWorkProfile())return null;
  const fit=item.fit,status=typeof fit?.status==='string'&&Object.hasOwn(workFitLabels,fit.status)?fit.status:'unknown';
  const badge=el('span','fit-badge '+status,status==='unknown'&&fit?.label==='已填条件相符，其他待确认'?fit.label:workFitLabels[status]);
  badge.title='根据已保存的作品条件与已核官方规则对照；账号资格与报名审核仍待确认。';
  return badge;
}
function workFitPlain(value){
  if(value===null||value===undefined)return '待确认';
  if(typeof value==='string')return value;
  if(typeof value==='number')return Number.isFinite(value)?String(value):'无效数值';
  if(typeof value==='boolean')return value?'true':'false';
  const seen=new WeakSet();
  function copy(item,depth){
    if(item===null||typeof item==='string'||typeof item==='boolean')return item;
    if(typeof item==='number')return Number.isFinite(item)?item:'无效数值';
    if(typeof item!=='object')return '[非 JSON 数据]';
    if(depth>16)return '[数据层级过深]';
    if(seen.has(item))return '[循环数据]';seen.add(item);
    const descriptors=Object.getOwnPropertyDescriptors(item),result=Array.isArray(item)?[]:Object.create(null);
    for(const [key,descriptor] of Object.entries(descriptors)){
      if(!descriptor.enumerable)continue;
      result[key]=Object.hasOwn(descriptor,'value')?copy(descriptor.value,depth+1):'[访问器未读取]';
    }
    seen.delete(item);return result;
  }
  try{return JSON.stringify(copy(value,0))||'[非 JSON 数据]';}catch{return '[无法显示的数据]';}
}
function workFitEntries(value){
  return Object.entries(Object.getOwnPropertyDescriptors(value)).filter(([,descriptor])=>descriptor.enumerable).map(([key,descriptor])=>[key,Object.hasOwn(descriptor,'value')?descriptor.value:'[访问器未读取]']);
}
function workFitDuration(value){
  if(!Number.isFinite(value))return workFitPlain(value);
  const minutes=value/60;
  return Number.isInteger(minutes)?minutes.toLocaleString('zh-CN')+' 分钟':value.toLocaleString('zh-CN',{maximumFractionDigits:3})+' 秒（约 '+minutes.toLocaleString('zh-CN',{maximumFractionDigits:3})+' 分钟）';
}
function workFitValue(field,value,isRule=false){
  if(value===null||value===undefined)return isRule?'官方条件未明确':'待确认';
  if(field==='work_coverage'&&Array.isArray(value))return value.map(workFitPlain).join('\n');
  if(field==='duration_min_seconds'||field==='duration_max_seconds')return workFitDuration(value);
  if(field==='ai_min_percent'||field==='ai_max_percent')return typeof value==='number'&&Number.isFinite(value)?value+'%':workFitPlain(value);
  if(field==='required_tools'&&Array.isArray(value))return value.length?value.map(workFitPlain).join('、'):isRule?'未注明指定工具':'明确未使用 AI 工具';
  if(typeof value==='boolean'){
    if(field==='student_required')return isRule?(value?'要求学生身份':'不限制学生身份'):(value?'在读学生':'非在读学生');
    if(field==='published_allowed')return isRule?(value?'接受已公开作品':'仅接受未公开作品'):(value?'作品已公开':'作品尚未公开');
    if(field==='ai_allowed')return isRule?(value?'允许 AI 参与':'禁止 AI 参与'):(value?'已使用 AI':'未使用 AI');
    if(field==='ai_required')return isRule?(value?'必须使用 AI':'不要求使用 AI'):(value?'已使用 AI':'未使用 AI');
    return value?'是':'否';
  }
  if(Array.isArray(value))return value.map(workFitPlain).join('、')||'未注明';
  return workFitPlain(value);
}
function workFitExpected(expected){
  if(!expected||typeof expected!=='object')return null;
  for(const [key,value] of workFitEntries(expected)){
    if(['min_seconds','max_seconds','min_percent','max_percent'].includes(key)){
      const minimum=key.startsWith('min_'),unit=key.endsWith('seconds')?workFitDuration(value):typeof value==='number'&&Number.isFinite(value)?value+'%':workFitPlain(value);
      return (expected.inclusive===false?(minimum?'超过 ':'少于 '):(minimum?'至少 ':'最多 '))+unit+'（'+(expected.inclusive===false?'不含':'包含')+'边界）';
    }
  }
  if(Array.isArray(expected.tools))return (expected.mode==='any'?'至少使用其中一种：':'须全部使用：')+expected.tools.map(workFitPlain).join('、');
  return null;
}
function workFitEvidence(parent,evidence){
  if(Array.isArray(evidence)){for(const value of evidence)workFitEvidence(parent,value);return;}
  if(!evidence||typeof evidence!=='object'){add(parent,el('p','fit-evidence-missing','官方规则出处、核验日期或适用范围仍待确认。'));return;}
  const row=el('div','fit-evidence');
  const date=typeof evidence.verified_at==='string'?fmt(evidence.verified_at):workFitPlain(evidence.verified_at);
  add(row,link('官方规则出处 ↗',typeof evidence.url==='string'?evidence.url:'','fit-evidence-link'),el('small',null,'核验：'+date+' · 范围：'+workFitPlain(evidence.scope)));
  if(evidence.excerpt)add(row,el('p',null,workFitPlain(evidence.excerpt)));add(parent,row);
}
function workFitAlternatives(parent,alternatives){
  if(alternatives&&typeof alternatives==='object'&&!Array.isArray(alternatives)){
    if(alternatives.note)add(parent,el('p','fit-alternative-note',workFitPlain(alternatives.note)));
    if(alternatives.evidence)workFitEvidence(parent,alternatives.evidence);
  }
  const tracks=Array.isArray(alternatives)?alternatives:Array.isArray(alternatives?.tracks)?alternatives.tracks:[];
  for(const [index,track] of tracks.entries()){
    if(!track||typeof track!=='object')continue;
    const box=el('div','fit-alternative');add(box,el('strong',null,workFitPlain(track.label||track.name||track.title||'赛道 '+(index+1))));
    if(track.note||track.description)add(box,el('p',null,workFitPlain(track.note||track.description)));
    const rules=track.rules||track.fit_rules;
    if(rules&&typeof rules==='object'&&!Array.isArray(rules))for(const [field,rule] of workFitEntries(rules)){
      const value=rule&&typeof rule==='object'&&!Array.isArray(rule)?rule.value:rule;
      add(box,el('p',null,workFitPlain(workRuleLabels[field]||rule?.label||'其他条件')+'：'+workFitValue(field,value,true)));
      let expected=rule?.expected;
      if(!expected&&typeof value==='number'&&['duration_min_seconds','duration_max_seconds','ai_min_percent','ai_max_percent'].includes(field))expected={[field.replace(/^(duration_|ai_)/,'')]:value,inclusive:rule.inclusive!==false};
      if(!expected&&field==='required_tools'&&Array.isArray(value))expected={tools:value,mode:rule.mode||'all'};
      const boundary=workFitExpected(expected);if(boundary)add(box,el('p','fit-boundary',boundary));
      if(rule?.note)add(box,el('p',null,workFitPlain(rule.note)));if(rule?.evidence)workFitEvidence(box,rule.evidence);
    }
    if(track.evidence)workFitEvidence(box,track.evidence);add(parent,box);
  }
}
function fitDetail(item){
  const section=el('section','detail-section fit-detail');section.id='detail-fit';add(section,el('h3',null,'个人作品适配'));
  const fit=item.fit,status=typeof fit?.status==='string'&&Object.hasOwn(workFitLabels,fit.status)?fit.status:'unknown';
  add(section,el('p','fit-detail-status '+(hasWorkProfile()?status:'unknown'),hasWorkProfile()?(status==='unknown'&&fit?.label==='已填条件相符，其他待确认'?fit.label:workFitLabels[status]):'作品条件尚未填写 · 待确认'));
  add(section,el('p','fit-detail-note','适配依据已保存的作品条件；未保存的修改尚未参与比较。'+(!hasWorkProfile()?'可在列表上方填写并保存作品条件。':'')));
  const checks=Array.isArray(fit?.checks)?fit.checks:[];
  if(!checks.length)add(section,el('p',null,'尚未取得可以逐项对照的作品规则，请打开官方原文核对。'));
  for(const check of checks){
    if(!check||typeof check!=='object'){add(section,el('p',null,workFitPlain(check)));continue;}
    const field=typeof check.field==='string'?check.field:'';
    const checkStatus=typeof check.status==='string'&&Object.hasOwn(workFitLabels,check.status)?check.status:'unknown',row=el('article','fit-check '+checkStatus);
    const heading=el('div','fit-check-heading');add(heading,el('strong',null,workFitPlain(check.label||workRuleLabels[field]||'作品条件')),el('span','fit-check-status',checkStatus==='matched'?'符合':checkStatus==='mismatched'?'不符合':'待确认'));add(row,heading);
    if(field!=='alternatives'){
      const values=el('dl','data-grid fit-values');
      for(const [label,value] of [['已保存作品条件',workFitValue(field,check.user_value)],['官方规则',workFitValue(field,check.rule_value,true)]])add(values,add(el('div'),el('dt',null,label),el('dd',null,value)));
      add(row,values);const expected=workFitExpected(check.expected);if(expected)add(row,el('p','fit-boundary',expected));
    }else workFitAlternatives(row,check.rule_value);
    add(row,el('p','fit-check-reason',workFitPlain(check.reason||'规则或个人条件仍待确认。')));
    if(check.applicable===false)add(row,el('p',null,'此项属于账号或长期计划条件，未作为作品筛选门槛。'));
    if(field==='work_coverage')add(row,link('核对完整官方作品要求 ↗',typeof item.official_url==='string'?item.official_url:'','fit-evidence-link'));
    else workFitEvidence(row,check.evidence);add(section,row);
  }
  add(section,el('p','fit-account-unknown','账号资格：待确认。账号审核、首次入选、具体赛道报名条件和长期履约要求需另行核对。'),el('p','fit-detail-note',workFitPlain(fit?.note||'符合已核作品条件不代表报名或加入资格已经通过。')));
  return section;
}

// A very fast initial GET can finish before this deferred script executes.
// The internal guard still builds the editor and binds its events just once.
if(state.data){initProfileUI();if(['opportunities','starred','archive'].includes(state.view))renderList();}
