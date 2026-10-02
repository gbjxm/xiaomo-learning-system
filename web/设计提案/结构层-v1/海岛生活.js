'use strict';
// 只增强独立草图。全部输入及练习仍在本页内存，场景没有第二份个人进度。
const life={open:false,place:'desk',sceneKey:'',scene:null,workshop:null,drafts:{},previousDrafts:{},watch:{},tone:'day',still:false,quiet:false,pet:0,audio:null,audioNodes:[],sound:false};
const baseRender=render,baseVisit=visit,baseOverview=overview,baseRenderSpace=renderSpace,baseOpenTrace=openTrace,baseResumeTrace=resumeTrace,baseRenderDesk=renderDesk,baseRenderCourses=renderCourses;
const placeNames={desk:'学习桌',courses:'课程与材料',practice:'小小练习工坊',watch:'岛上放映角',rest:'在海边歇一会儿',traces:'留在岛上的痕迹',cat:'岛上的小伙伴'};

render=function(){baseRender();syncLife();};
visit=function(id){stopWorkshop();life.open=false;life.place='desk';baseVisit(id);syncLife();};
overview=function(){stopWorkshop();life.open=false;baseOverview();syncLife();};
renderSpace=function(){
  stopWorkshop();
  if(!life.open){$('workspace').hidden=true;return;}
  $('workspace').hidden=false;
  const auxiliary=['practice','watch','rest','cat'].includes(state.tab);
  document.querySelector('.space-tabs').classList.toggle('auxiliary-tabs',auxiliary);
  $('spaceScope').textContent=islands[state.current].name+' / '+(placeNames[state.tab]||'学习桌');
  if(auxiliary){
    $('spaceBody').removeAttribute('aria-labelledby');$('spaceBody').setAttribute('aria-label',placeNames[state.tab]);$('spaceBody').replaceChildren();
    if(state.tab==='practice')mountWorkshop();
    if(state.tab==='watch')renderWatch($('spaceBody'));
    if(state.tab==='rest')renderRest($('spaceBody'));
    if(state.tab==='cat')renderCat($('spaceBody'));
  }else if(state.current==='home'){
    document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab===state.tab)));
    const body=$('spaceBody');body.replaceChildren();body.setAttribute('aria-labelledby',state.tab==='traces'?'tracesTab':state.tab==='courses'?'coursesTab':'deskTab');body.removeAttribute('aria-label');
    if(state.tab==='traces')renderAllTraces(body);
    else if(state.tab==='courses')renderHomeCourses(body);
    else if(here())renderDesk(body);else renderHomeDesk(body);
  }else{baseRenderSpace();$('spaceScope').textContent=islands[state.current].name+' / '+(placeNames[state.tab]||'学习桌');$('spaceBody').removeAttribute('aria-label');}
  syncLife();
};
renderDesk=function(body){baseRenderDesk(body);if(here()?.closing)return;const links=el('div',undefined,'activity-options');links.append(button('拿所学试一小下',()=>openPlace('practice')),button('带着一个问题看片',()=>openPlace('watch')));body.append(links);};
renderCourses=function(body){baseRenderCourses(body);const options=el('div',undefined,'activity-options');options.append(button('从一份原创练习开始',()=>openPlace('practice')),button('先随意看点东西',()=>openPlace('watch')));body.append(options);};
openTrace=function(record){
  if(!record.artifact){baseOpenTrace(record);return;}
  const box=el('div',undefined,'trace-detail');box.append(el('span',record.time+' · 本页练习草稿','source-label'),el('h3',record.title),el('p',record.note),el('p','来源：'+record.source,'note'),el('p','这是你在草图里编辑的版本，未作专业评定，也不代表已经掌握。','note'));
  box.append(button('打开这份草稿，接着试 →',()=>{closeDialog();visit(record.island);const current=life.drafts[record.island];if(current&&JSON.stringify(current)!==JSON.stringify(record.workshopDraft))life.previousDrafts[record.island]=structuredClone(current);life.drafts[record.island]=structuredClone(record.workshopDraft);openPlace('practice');},'primary'));openDialog('翻开一次尝试', [box]);
};
resumeTrace=function(record){baseResumeTrace(record);openPlace('desk');};

function stopWorkshop(){life.workshop?.destroy?.();life.workshop=null;}
function openPlace(action){
  if(action==='plan'){life.open=false;setPanel(true);setMode('plan');renderSpace();syncLife();$('intent').focus();$('learningPanel').scrollTop=0;return;}
  if(!placeNames[action])return;
  life.open=true;life.place=action;state.tab=action;renderSpace();$('spaceBody').scrollTop=0;
}
function closePlace(){stopWorkshop();life.open=false;renderSpace();syncLife();}
function syncLife(){
  const map=document.querySelector('.map-section');map.classList.toggle('world-open',state.overview);map.classList.toggle('work-open',life.open&&!state.overview);
  const world=document.querySelector('.map-area');world.inert=!state.overview;world.setAttribute('aria-hidden',String(!state.overview));
  $('workspace').hidden=!life.open||state.overview;
  $('islandLife').hidden=state.overview;
  const count=state.current==='home'?state.records.length:state.records.filter(r=>r.island===state.current).length;
  const sceneKey=state.current+':'+count;
  if(window.IslandScenes&&sceneKey!==life.sceneKey){life.scene?.destroy?.();life.scene=IslandScenes.mount($('sceneMount'),{island:state.current,onPlace:openPlace,memories:count});life.sceneKey=sceneKey;$('islandLife').classList.remove('scene-transition');void $('islandLife').offsetWidth;$('islandLife').classList.add('scene-transition');}
  $('sceneMount').inert=life.open||state.overview;
  document.querySelectorAll('[data-route]').forEach(b=>{if(b.dataset.route===state.current&&!state.overview)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
  const a=active();$('currentRibbon').hidden=!a||state.overview||life.open;
  if(a){$('ribbonStatus').textContent=activityStatus(a)+' · '+islands[a.island].name;$('ribbonTask').textContent=a.stop||a.step;$('ribbonButton').textContent=a.status==='resting'?'休息好了':'回到这一块';}
  $('sceneCaption').textContent=count?'这里留下了 '+count+' 枚本页书签':'走走看看，也可以什么都不完成';
}
function mountWorkshop(){
  if(!window.LearningWorkshop){$('spaceBody').append(el('p','练习空间尚未加载，请检查同目录文件。'));return;}
  const island=state.current;
  life.workshop=LearningWorkshop.mount($('spaceBody'),{island,draft:life.drafts[island],onDraft:draft=>{life.drafts[island]=structuredClone(draft);},onSave:result=>{
    const record={id:'work-'+Date.now()+'-'+state.records.length,island,title:result.title,note:result.summary||'',report:'practice',reportLabel:'本页实际编辑 · 尚未评定',next:result.next||'打开这份练习草稿继续尝试。',source:result.source||'本页原创练习',artifact:structuredClone(result.artifact),workshopDraft:structuredClone(result.draft||life.drafts[island]||result.artifact),time:new Date().toLocaleDateString('zh-CN')};
    state.records.push(record);life.sceneKey='';syncLife();notice('这份练习草稿已留在本页岛上，点“痕迹”可以重新打开。刷新仍会清空。');
  }});
  if(life.previousDrafts[island]){
    const recovery=el('div',undefined,'draft-recovery');recovery.append(el('span','打开早前书签时，刚才的改动也留着。'),button('回到刚才的草稿',()=>{life.drafts[island]=structuredClone(life.previousDrafts[island]);delete life.previousDrafts[island];openPlace('practice');}));$('spaceBody').prepend(recovery);
  }
}
function renderHomeDesk(body){
  body.append(el('span','TODAY / 从这里出发','notebook-title'),el('h3','先留下一件值得做的小事'),el('p','你不用同时照顾所有岛。今天想继续看课、处理一个疑问，还是动手试一试，都可以。','notebook-intro'));
  const days=el('div',undefined,'day-slices');[['先安顿','说说时间与状态','只问今天影响安排的缺口'],['去一个地方','围绕一块内容','保留完整看课与纸笔记录的空间'],['带一点回来','问题、尝试或书签','想聊时回来，休息不需要产出']].forEach(([a,b,c])=>{const x=el('div',undefined,'day-slice');x.append(el('small',a),el('strong',b),el('small',c));days.append(x);});body.append(days,button('聊聊今天的安排 →',()=>openPlace('plan'),'primary'),button('不安排，随便逛逛',closePlace,'text'));
}
function renderHomeCourses(body){
  body.append(el('span','ON MY SHELF / 手边的材料','notebook-title'),el('h3','不急着把架子填满'),el('p','这里只放已知在学线索。分镜课的章节、时长和链接，仍等真正学习时再补。','notebook-intro'));
  const book=button('',()=>{visit('visual');openPlace('courses');},'course-book');book.append(el('span','','book-spine'));const words=el('span');words.append(el('strong','老白的分镜课'),el('small','影像与 AI 创作岛 · 目前在学自述'),el('small','到那边的课程架看看 →'));book.append(words);body.append(book);
}
function renderAllTraces(body){
  body.append(el('span','POSTCARDS / 从各座岛带回来','notebook-title'),el('h3','一些问题，一些尝试'),el('p','这里汇合本页留下的书签，点开仍回到原来的岛。','notebook-intro'));
  if(!state.records.length){body.append(el('p','现在还没有书签。做一份小练习，或者聊完后留一句，下次就有地方接着了。','empty-space'));return;}
  state.records.slice().reverse().forEach(r=>{const b=button('',()=>openTrace(r),'trace-book');b.append(el('span','','book-spine'));const t=el('span');t.append(el('span',islands[r.island].name+' · '+r.time,'trace-date'),el('strong',r.title),el('small',r.reportLabel),el('small',r.next));b.append(t);body.append(b);});
}
function renderWatch(body){
  const island=state.current;
  const draft=life.watch[island]??={mode:'enjoy',title:'',note:''};
  const questions={home:'留意一个让你想多看一眼的瞬间。',story:'这个片段里，人物想得到什么？哪一个举动让局面发生变化？',visual:'停在一次切镜前：你期待下一镜看到什么？真正切过去后，信息发生了什么变化？',post:'先感受一次节奏，再留意声音出现或消失的时刻。两次感受有什么不同？'};
  body.append(el('span','SCREENING CORNER / 只是喜欢，也很好','notebook-title'),el('h3','看一段，或者就看看海'),el('p','继续用自己的播放器看片。这里给你留一个观看角度，也可以只欣赏。','notebook-intro'));
  const choices=el('div',undefined,'choice-row');[['enjoy','只想欣赏'],['notice','带一个观察点']].forEach(([id,title])=>{const b=button(title,()=>{draft.mode=id;renderWatchAgain();});b.setAttribute('aria-pressed',String(draft.mode===id));choices.append(b);});body.append(choices);
  body.append(el('div',draft.mode==='enjoy'?'今天不用分析。不暂停、不记笔记也可以。':questions[island],'observation-note'));
  const fields=el('div',undefined,'notebook-fields'),label=el('label','想记下的片名或片段（可留空）'),title=el('input');title.id='watchTitle';label.htmlFor=title.id;title.value=draft.title;title.placeholder='用你自己的影片或片段';title.addEventListener('input',()=>draft.title=title.value);const lab=el('label','忽然想留下的一句话（可留空）'),note=el('textarea');note.id='watchNote';lab.htmlFor=note.id;note.value=draft.note;note.placeholder='没有感想，也不用勉强写。';note.addEventListener('input',()=>draft.note=note.value);fields.append(label,title,lab,note);body.append(fields);
  const actions=el('div',undefined,'step-actions');actions.append(button('把这句话夹进书签',()=>{if(!draft.note.trim()){notice('有想留的话再记。只是欣赏也很好。');return;}state.records.push({id:'watch-'+Date.now(),island,title:draft.title.trim()||'一次随意观看',note:draft.note.trim(),report:'watch',reportLabel:'观看随手记 · 本页自述',next:'回看这段随手记，是否继续由当时的你决定。',source:'本人在本页输入；未查看影片。',time:new Date().toLocaleDateString('zh-CN')});life.sceneKey='';syncLife();notice('这句话夹在本页书签里了；不是观看完成或能力认证。');},'primary'),button('不记了，回岛上',closePlace));body.append(actions);
  function renderWatchAgain(){body.replaceChildren();renderWatch(body);}
}
function renderRest(body){
  const poster=el('div',undefined,'rest-poster');poster.innerHTML='<svg viewBox="0 0 180 110" aria-hidden="true"><path d="M12 82q24-10 48 0t48 0t48 0" fill="none" stroke="#95b7ac" stroke-width="2"/><path d="M22 94q24-10 48 0t48 0t40 0" fill="none" stroke="#b4cdc0"/><circle cx="135" cy="25" r="13" fill="#e1ce8d"/><path d="M50 53h64v10H50zm6 10v18m52-18v18" fill="#b9ad87" stroke="#9e9576"/><path d="M27 69V23m-12 25q-2-28 12-30 21 8 16 30" fill="#bbce9e" stroke="#8ca87d"/></svg>';
  poster.append(el('h3','这一会儿，不用完成什么'),el('p','可以站起来走走，看看远处，或者放空一会儿。岛会留在这里，不替你计算“有没有好好休息”。'));body.append(poster);
  const choices=el('div',undefined,'choice-row rest-actions');['看看远处','起来走走','就坐一会儿'].forEach(text=>choices.append(button(text,()=>{poster.querySelector('p').textContent=text==='看看远处'?'把视线从屏幕移开一会儿。回来时，那一块学习还在。':text==='起来走走'?'去活动一下，喝点水也好。这里不开始倒计时。':'暂时什么都不做也可以。不必为了休息再完成一套动作。';})));body.append(choices);
  const actions=el('div',undefined,'step-actions rest-actions');actions.append(button('让小岛安静陪一会儿',()=>{const a=active();if(a){a.status='resting';state.cue=false;}enterQuiet();},'primary'),button('恢复了，继续那一块',returnFromQuiet),button('回去随便逛逛',closePlace));body.append(actions);
}
function renderCat(body){
  const sayings=['你学你的，我在这里打个盹。','今天留下一点点，也算来过这里。','那边的树荫不错，要一起歇一会儿吗？','我不检查作业。你想说的时候，再来聊。'];
  const card=el('div',undefined,'cat-postcard');card.innerHTML='<svg viewBox="0 0 160 125" aria-hidden="true"><ellipse cx="81" cy="112" rx="51" ry="8" fill="#dfd6bd"/><path d="M44 99q-8-34 15-49l-4-30 25 19 22-20 7 34q27 17 15 50z" fill="#e4c391" stroke="#a58c66" stroke-width="2"/><path d="M57 70q7-7 14 0m19 0q7-7 14 0m-26 12 5 3 5-3m-5 3v6m-5 2q5 4 10 0M118 102q27-9 17-28" fill="none" stroke="#8d785a" stroke-width="2.5" stroke-linecap="round"/></svg>';
  card.append(el('h3','小猫在晒太阳'),el('p',sayings[life.pet%sayings.length]));const actions=el('div',undefined,'step-actions rest-actions');actions.append(button('轻轻摸一下',()=>{life.pet++;card.querySelector('p').textContent=sayings[life.pet%sayings.length];}),button('一起去海边坐坐',()=>openPlace('rest')));card.append(actions);body.append(card,el('p','小伙伴不会饥饿，不用打卡照顾，也不会因为几天没来而失落。','note'));
}
function enterQuiet(){closePlace();life.quiet=true;document.body.classList.add('quiet-view');$('quietExit').hidden=false;setPanel(false);syncLife();}
function returnFromQuiet(){life.quiet=false;document.body.classList.remove('quiet-view');$('quietExit').hidden=true;setPanel(true);const a=active();if(a){a.status='returned';visit(a.island);openPlace('desk');}else closePlace();renderPanel();syncLife();}
async function toggleSea(){
  if(life.sound){stopSea();return;}
  try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)throw new Error('Audio unavailable');life.audio??=new Audio();await life.audio.resume();const buffer=life.audio.createBuffer(1,life.audio.sampleRate*3,life.audio.sampleRate);const data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*.22;const source=life.audio.createBufferSource();source.buffer=buffer;source.loop=true;const low=life.audio.createBiquadFilter();low.type='lowpass';low.frequency.value=650;const gain=life.audio.createGain();gain.gain.value=0;source.connect(low);low.connect(gain);gain.connect(life.audio.destination);gain.gain.linearRampToValueAtTime(.12,life.audio.currentTime+1);source.start();life.audioNodes=[source,low,gain];life.sound=true;$('seaSound').textContent='海声：开';$('seaSound').setAttribute('aria-pressed','true');}catch{notice('这次没有播放出海声，仍可安静看岛。');stopSea();}
}
function stopSea(){const nodes=life.audioNodes;life.audioNodes=[];nodes.forEach(n=>{try{n.stop?.();n.disconnect();}catch{}});life.sound=false;$('seaSound').textContent='海声：关';$('seaSound').setAttribute('aria-pressed','false');}
function changeTone(){const order=['day','gold','night'];life.tone=order[(order.indexOf(life.tone)+1)%order.length];document.body.classList.toggle('tone-gold',life.tone==='gold');document.body.classList.toggle('tone-night',life.tone==='night');$('dayTone').textContent={day:'清晨',gold:'午后',night:'晚风'}[life.tone];}

$('closePlace').addEventListener('click',closePlace);
// 安排采用后的学习桌由 beginPlan 统一打开，避免重复重绘草稿。
$('homeContinue').addEventListener('click',()=>{if(active())openPlace('desk');});
$('activeLink').addEventListener('click',()=>openPlace('desk'));
$('ribbonButton').addEventListener('click',()=>{const a=active();if(!a)return;if(a.status==='resting')a.status='returned';visit(a.island);openPlace('desk');});
document.querySelectorAll('[data-route]').forEach(b=>b.addEventListener('click',()=>visit(b.dataset.route)));
$('dayTone').addEventListener('click',changeTone);$('seaSound').addEventListener('click',toggleSea);
$('stillScene').addEventListener('click',()=>{life.still=!life.still;document.body.classList.toggle('is-still',life.still);$('stillScene').textContent=life.still?'动效：关':'动效：开';$('stillScene').setAttribute('aria-pressed',String(!life.still));});
$('quietExit').addEventListener('click',returnFromQuiet);
$('reopenPanel').addEventListener('click',()=>{life.quiet=false;document.body.classList.remove('quiet-view');$('quietExit').hidden=true;});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('dialogCover').hidden&&life.open)closePlace();});
window.addEventListener('pagehide',()=>{stopWorkshop();stopSea();life.audio?.close().catch(()=>{});});
syncLife();
