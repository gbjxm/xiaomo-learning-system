'use strict';
// 手动排程只根据填写值计算，不调用模型或自动写正式学习进展。界面状态由连接层保存。
(() => {
  const core = window.IslandTimeCore;
  if (!core) return;
  const modeNames = {full:'全天有空',afternoon:'下午＋晚上',block:'一段时间'};
  const priorSetMode = setMode, priorRenderPanel = renderPanel, priorSend = send;
  const localMinute = () => {const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(new Date()).map(p=>[p.type,p.value]));return Number(parts.hour)*60+Number(parts.minute);};
  const clock = m => core.formatTime(m);
  const clockInput = m => clock(m).slice(-5);
  const clone = value => structuredClone(value);
  state.timeSetup = {...core.template('block',localMinute(),180),taskType:'course',live:true,duration:180};
  state.acceptedTimePlan = null;
  state.timeDirty = false;
  state.timeActivityId = null;
  state.composerDrafts = {plan:$('intent').value,chat:''};

  const entry = el('section',undefined,'time-entry');entry.id='timeEntry';entry.setAttribute('aria-label','三种时间入口');
  entry.innerHTML = `<p class="time-entry-label">今天，给自己留多少时间？</p>
    <div class="time-presets">
      <button type="button" data-scenario="full" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/></svg><strong>全天有空</strong><small>分几段，慢慢来</small></button>
      <button type="button" data-scenario="afternoon" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 17h20M5 17a7 7 0 0 1 14 0M12 4v3M3 9l2 2m14 0 2-2M5 21h14"/></svg><strong>下午＋晚上</strong><small>饭后接着来</small></button>
      <button type="button" data-scenario="block" aria-pressed="true"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></svg><strong>一段时间</strong><small>三四小时，也从容</small></button>
    </div>
    <p id="timeSummary" class="time-summary"></p>
    <details id="timeEditor" class="time-editor"><summary>调整起止时间</summary>
      <div class="reference-row"><label for="dayReference">从几点开始安排</label><input type="time" id="dayReference"><button type="button" id="timeNow">用现在</button></div>
      <p class="time-boundary">起止是建议，可按做饭、上课和回寝时间修改。已过去的窗口不补排；这里不启动计时。</p>
      <div id="durationRow" class="duration-row"><span>这一段</span><button type="button" data-duration="180">3 小时</button><button type="button" data-duration="240">4 小时</button></div>
      <div id="timeWindows" class="time-windows"></div>
      <p class="time-boundary">已包含准备、休息与收尾余量。具体休息点随任务调整，晚上可以取消。</p>
    </details>
    <p id="timeError" class="time-error" role="status" hidden></p>`;
  $('planForm').before(entry);
  entry.after($('planCard'));
  // 保留旧字段以兼容原草图入口，实际排程统一由 timeSetup 生成。
  $('demoParams').className='time-materials';
  $('demoParams').innerHTML=`<summary>材料、课长与去向 · 可补充</summary>
    <div class="task-types" aria-label="这次做什么"><button type="button" data-task="course" aria-pressed="true">看一节课</button><button type="button" data-task="practice" aria-pressed="false">练习／已有作品</button></div>
    <div id="lessonField" class="lesson-field"><label for="lessonLength">课长</label><input id="lessonLength" type="number" min="1" max="1440" placeholder="未知"><span>分钟，未知可留空</span></div>
    <label for="materialName">手边的课程或作品（可留空）</label><input id="materialName" type="text" maxlength="160" placeholder="课程、纸质笔记或已有片段">
    <label for="destination">这次去哪里</label><select id="destination"><option value="visual">影像与 AI 创作岛</option><option value="story">故事岛</option><option value="post">剪辑音动效岛</option><option value="home">留在个人主岛</option></select>
    <p id="timeMaterialHint" class="time-boundary">这里按填写的时间和材料生成手动安排；与向导聊天时才请求模型。章节、课长和链接未知就留空。</p>
    <input id="minutes" type="hidden" value="180"><input id="buffer" type="hidden" value="45">`;
  const material=el('p',undefined,'plan-material');material.id='planMaterial';$('planFoot').before(material);
  const detail=el('details',undefined,'plan-rationale');detail.innerHTML='<summary>材料与安排理由</summary>';
  $('planFinish').after(detail);detail.append(material,$('planReason'));
  const change=el('p',undefined,'plan-change-note');change.id='planChangeNote';change.hidden=true;$('planCard').querySelector('header').after(change);
  const keep=el('p',undefined,'plan-keep-note');keep.id='planKeepNote';keep.hidden=true;$('planFoot').after(keep);
  const later=el('details',undefined,'plan-remainder');later.id='laterPlan';later.innerHTML='<summary id="laterSummary">稍后怎么安排</summary><div id="laterList" class="later-list"></div>';$('planCard').append(later);
  const cancel=button('保留原安排',restoreAccepted);cancel.id='restorePlan';cancel.hidden=true;$('planCard').querySelector('.plan-adjust').append(cancel);

  function error(message){$('timeError').hidden=!message;$('timeError').textContent=message||'';}
  function refreshClock(){const s=state.timeSetup;if(s.live){s.reference=localMinute();$('dayReference').value=clockInput(s.reference);}}
  function readEvaluation(intent=''){
    const raw=$('lessonLength').value.trim();
    return core.evaluate({...state.timeSetup,lessonMinutes:raw===''?null:Number(raw),intent});
  }
  function currentScope(){const a=active();return a&&a.status!=='closed'?a:null;}
  function ownerOf(p){return p?.activityId?Object.values(state.activities).find(a=>a.id===p.activityId):null;}
  function syncActivityFields(){
    const a=currentScope();$('destination').disabled=!!a;$('materialName').disabled=!!a;
    if((a?.id||null)!==state.timeActivityId){
      $('lessonLength').value=a?.plan?.lesson??'';
      state.timeSetup.taskType=a?.plan?.setup?.taskType||(a?.kind==='practice'?'practice':'course');
      if(!a)$('materialName').value='';
      state.timeActivityId=a?.id||null;
      updateSummary();
    }
    if(a){$('destination').value=a.island;$('materialName').value=a.title;}
    $('materialName').title=a?'本次在调整当前活动。其他领域可以自由逛，结束后再安排新内容。':'';
    $('timeMaterialHint').textContent=a?'这里调整当前活动的时间与做法，材料和归属保留。其他岛可以自由逛；收尾后可安排新内容。':'这里按填写的时间和材料生成手动安排；与向导聊天时才请求模型。章节、课长和链接未知就留空。';
  }
  function dirty(){state.timeDirty=true;error('');$('sendButton').textContent=state.mode==='plan'?'按填写值重新安排':'发送这段交流';if(state.plan?.timing){$('planChangeNote').hidden=false;$('planChangeNote').textContent='设置有改动，先看更新后的安排。当前活动和草稿仍保留。';$('goButton').disabled=true;}updateSummary();}
  function updateSummary(){
    const s=state.timeSetup,result=readEvaluation();
    document.querySelectorAll('[data-scenario]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.scenario===s.mode)));
    document.querySelectorAll('[data-duration]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.duration)===s.duration)));
    document.querySelectorAll('[data-task]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.task===s.taskType)));
    $('lessonField').hidden=s.taskType!=='course';$('durationRow').hidden=s.mode!=='block';
    const current=result.currentWindow;
    $('timeSummary').textContent=!result.ok?'时间还需调整，展开下面修改。':!current?'这几段已结束或暂不使用，可调整窗口，也可以先休息。':`${modeNames[s.mode]} · 先留 ${clock(current.effectiveStart)}—${clock(current.end)} 这一段，含休息与余量。`;
    const maybe=state.plan?.timing&&!state.planAdopted;
    $('restorePlan').hidden=!(maybe&&state.acceptedTimePlan)||!state.timeDirty&&!maybe;
  }
  function renderWindows(){
    const s=state.timeSetup,result=readEvaluation();$('dayReference').value=clockInput(s.reference);$('timeWindows').replaceChildren();
    s.windows.forEach(w=>{
      const evaluated=result.windows?.find(x=>x.id===w.id),box=el('div',undefined,'time-window'+(!w.enabled?' disabled-window':'')+(evaluated?.past?' past-window':''));
      const head=el('div',undefined,'time-window-heading'),label=el('label'),check=el('input');check.type='checkbox';check.checked=w.enabled;check.setAttribute('aria-label','安排'+w.label);label.append(check,document.createTextNode(w.label));head.append(label,el('small',evaluated?.past?'已过去，不补排':w.optional?'可选':'建议，可改'));
      const row=el('div',undefined,'time-window-clock');
      const start=el('input'),end=el('input');start.type=end.type='time';start.value=clockInput(w.start);end.value=clockInput(w.end);start.setAttribute('aria-label',w.label+'开始');end.setAttribute('aria-label',w.label+'结束');
      row.append(start,el('span','—'),end);if(w.end>=1440)row.append(el('small','次日结束'));
      start.addEventListener('change',()=>changeWindow(w,'start',start.value));end.addEventListener('change',()=>changeWindow(w,'end',end.value));
      check.addEventListener('change',()=>{w.enabled=check.checked;dirty();renderWindows();});box.append(head,row);$('timeWindows').append(box);
    });updateSummary();
  }
  function changeWindow(w,field,value){
    const minutes=core.parseTime(value);if(minutes===null){error('请填完整的开始和结束时间。');return;}
    w[field]=minutes;
    // 连续窗口可明确跨午夜；分段日程的结束早于开始视为输入错误。
    if(state.timeSetup.mode==='block'&&w.end<=w.start)w.end+=1440;
    if(state.timeSetup.mode==='block')state.timeSetup.duration=w.end-w.start;
    dirty();renderWindows();
  }
  function chooseMode(mode,duration=state.timeSetup.duration){
    refreshClock();const old=state.timeSetup;
    state.timeSetup={...core.template(mode,old.reference,duration),taskType:old.taskType,live:old.live,duration};
    dirty();renderWindows();
  }
  function fillSetup(p){
    state.timeSetup=clone(p.setup);$('lessonLength').value=p.lesson??'';$('destination').value=p.dest;$('materialName').value=p.materialInput||'';renderWindows();
  }
  function restoreAccepted(){
    const p=state.acceptedTimePlan;if(!p)return;state.plan=p;state.planAdopted=true;state.timeDirty=false;fillSetup(p);
    state.composerDrafts.plan=p.intent||'';if(state.mode==='plan')$('intent').value=state.composerDrafts.plan;
    renderPlan();notice('保留原来的安排，活动和草稿没有改变。');
  }
  window.editDaySchedule=editDaySchedule;
  function editDaySchedule(){setMode('plan');$('timeEditor').open=true;setPanel(true);$('timeEntry').scrollIntoView({block:'start',behavior:'smooth'});}

  setMode=function(mode){
    if(mode!==state.mode){state.composerDrafts[state.mode]=$('intent').value;$('intent').value=state.composerDrafts[mode]||'';}
    priorSetMode(mode);syncActivityFields();$('timeEntry').hidden=mode!=='plan';$('learningPanel').classList.toggle('planning-view',mode==='plan');$('sendButton').textContent=mode==='plan'?'按填写值查看安排':'发送这段交流';$('intent').placeholder=mode==='plan'?'今天想推进什么？\n比如：继续分镜课，或修改手边的片段。':'想聊一个困惑，或留下这次的体会。';};
  makePlan=function(options={}){
    refreshClock();
    const current=currentScope(),dest=current?.island||$('destination').value;
    const previous=state.activities[dest],a=current||(previous&&previous.status!=='closed'?previous:null);
    const samePlan=state.plan&&(!a||state.plan.activityId===a.id);
    const explicitInput=options.useInput===true&&state.mode==='plan';
    const typedIntent=explicitInput?$('intent').value.trim():'';
    const intent=typedIntent||a?.dayIntent||(samePlan?state.plan.intent:'')||'';
    const result=readEvaluation(intent);
    if(!result.ok){error(result.error);$('timeEditor').open=true;notice(result.error);return false;}
    error('');
    const materialInput=$('materialName').value.trim();
    const course=a?.title||materialInput||(state.timeSetup.taskType==='course'&&dest==='visual'?'老白的分镜课':state.timeSetup.taskType==='practice'?'手边的练习或作品':'这次想看的课程');
    const raw=$('lessonLength').value.trim();
    state.plan={timing:result,setup:clone(state.timeSetup),activityId:a?.id||null,dest,course,materialInput,lesson:raw===''?null:Number(raw),minutes:result.currentWindow?.minutes||0,buffer:result.budget?.reserve||0,kind:result.step.kind,step:result.step.title,reason:result.step.reason,intent,explicitInput,followupNotes:Object.fromEntries(state.timeSetup.windows.map(w=>[w.id,w.note||'']))};
    state.planAdopted=false;state.timeDirty=false;state.reentry=false;renderPlan();updateSummary();return true;
  };
  renderPlan=function(){
    const p=state.plan;$('planCard').hidden=!p?.timing;$('learningPanel').classList.toggle('has-time-plan',!!p?.timing);if(!p?.timing)return;
    
    const a=currentScope(),owner=ownerOf(p),linked=a&&a.id===p.activityId,done=state.planAdopted&&owner?.status==='closed';
    $('planCard').querySelector('h3').textContent=done?'这一块已收尾':state.planAdopted&&!linked?'暂放在这里的安排':state.planAdopted?'现在这一块':'这次，先做这一块';
    $('planCard').querySelector('.tag').textContent=state.planAdopted?'本页安排':'待开始';
    $('planIntent').textContent=p.intent||'先围绕手边的一块内容，做到自然停点。';
    $('planStep').textContent=done?'可以从书签接着，也可以另作安排':p.step;
    $('planReason').textContent=p.reason;$('planFinish').textContent=p.timing.step.finish;
    $('planMaterial').textContent='手边材料：'+p.course+(p.materialInput?'':' · 具体章节／版本待确认');
    const w=p.timing.currentWindow;
    $('planFoot').textContent=w?`${clock(w.effectiveStart)}—${clock(w.end)} · ${p.kind==='course'?'课长 '+p.lesson+' 分钟':p.kind==='check'?'看课用时待确认':'先做约 '+p.timing.step.estimateMinutes+' 分钟'} · 含准备、休息与收尾余量`:'没有可用的当前窗口。修改时间或先休息都可以。';
    $('planKeepNote').hidden=!linked;$('planKeepNote').textContent=linked?'仍是同一项活动'+(a.stop?' · 上次停在：'+a.stop:'；已有交流与练习保留。'):'';
    $('planChangeNote').hidden=!state.timeDirty&&(state.planAdopted||!a);
    $('planChangeNote').textContent=state.timeDirty?'设置有改动，先看更新后的安排。当前活动和草稿仍保留。':'这是剩余安排的预览。应用后保留当前活动、停止处和草稿。';
    $('routeChoice').value=p.dest;$('routeName').textContent=islands[p.dest].name;
    $('routeChoice').disabled=!!a;
    $('planCard').querySelector('.plan-route-select summary').lastChild.textContent=a?' · 当前活动':' · 可改选';
    $('goButton').disabled=state.timeDirty||(!w&&!a);
    $('goButton').textContent=done?'按当前条件重新安排':state.planAdopted&&owner?'回到这项安排 →':a?'应用这次调整':'从这一步开始 →';
    $('shortenButton').disabled=false;$('reviseButton').textContent='调整时间与材料';
    $('restorePlan').hidden=state.planAdopted||!state.acceptedTimePlan;
    renderLater(p);
  };
  function renderLater(p){
    const list=$('laterList');list.replaceChildren();
    const currentId=p.timing.currentWindow?.id;
    const all=p.timing.windows.filter(w=>w.id!==currentId&&!w.past);
    $('laterSummary').textContent=all.length?'稍后怎么安排 · '+all.length+' 个可调整窗口':'稍后怎么安排 · 留有余量';
    if(!all.length){
      const current=p.setup.windows.find(w=>w.id===currentId);
      const description=p.kind==='check'?'先了解真实课长，再决定是否放入小练习。':p.kind==='course'?'课后先休息。若还有余量和意愿，再做一个小应用；长课可以留到下次。':p.kind==='practice'?'做出一版后先歇歇，再按剩余时间比较或修改。':'先处理一个小问题；整课与较大的练习留待合适时段。';
      if(!current){list.append(el('p','暂无可用窗口，已有内容保留。','note'),button('调整可用时间',editDaySchedule));return;}
      const enabled=current.afterEnabled!==false;
      const box=el('section',undefined,'later-slot'+(!enabled?' later-disabled':'')),head=el('header');
      head.append(el('strong','这一块之后'),el('small',enabled?'候选，非必做':'这次先不安排'));
      box.append(head,el('p',p.followupNotes[current.id]||description));
      box.append(button(enabled?'后续先留空':'保留这个候选',()=>{
        prepareEdit();const w=state.timeSetup.windows.find(x=>x.id===current.id);w.afterEnabled=!enabled;dirty();makePlan();$('laterPlan').open=true;
      }),button('改后续想法',()=>editLater(current.id)),button('改这段时间',editDaySchedule));
      list.append(box,el('p','开始后续前再看剩余时间与状态；不自动追加任务或计时。','time-boundary'));return;
    }
    all.forEach(w=>{
      const box=el('section',undefined,'later-slot'+(!w.enabled?' later-disabled':''));const head=el('header');head.append(el('strong',w.label),el('small',w.enabled?'待做 · 可调整':'今天先不安排'));
      box.append(head,el('p',`${clock(w.start)}—${clock(w.end)} · ${w.optional?'可选窗口':'建议窗口'}`));
      const proposed=p.followupNotes[w.id]||'接着同一份材料，应用或改一处；回来时再看状态。';
      box.append(el('p',proposed));
      box.append(button(w.enabled?'这段先取消':'把这段加回来',()=>toggleLater(w.id)),button('改内容或时段',()=>editLater(w.id)));
      list.append(box);
    });list.append(el('p','安排可以取消；不会自动开始、响铃或计为完成。','time-boundary'));
  }
  function prepareEdit(){const p=state.plan;if(p?.timing&&!state.timeDirty)fillSetup(p);}
  function toggleLater(id){prepareEdit();const w=state.timeSetup.windows.find(x=>x.id===id);if(!w)return;w.enabled=!w.enabled;dirty();renderWindows();makePlan();$('laterPlan').open=true;notice(currentScope()?'已更新剩余安排预览，点“应用这次调整”采用；已有进展保留。':'后续候选已更新，从这一步开始时采用。');}
  function editLater(id){
    prepareEdit();const w=state.timeSetup.windows.find(x=>x.id===id);if(!w)return;
    const label=el('label','这段想接着做什么（可留空）');label.htmlFor='laterTaskInput';const input=el('input');input.id='laterTaskInput';input.type='text';input.maxLength=180;input.value=w.note||'';input.className='later-task-input';
    openDialog('调整'+w.label,[paragraph('只调整这一段的候选内容。改时间可以返回时间窗口，当前活动不会丢失。'),label,input,button('保留这段内容',()=>{w.note=input.value.trim();closeDialog();dirty();makePlan();$('laterPlan').open=true;},'primary'),button('去改起止时间',()=>{w.note=input.value.trim();closeDialog();dirty();editDaySchedule();})]);input.focus();
  }
  beginPlan=function(){
    const p=state.plan;if(!p?.timing||state.timeDirty)return;
    let a=currentScope();
    const owner=ownerOf(p);
    if(state.planAdopted&&owner&&owner.status!=='closed'){
      if(a&&a!==owner&&a.status==='learning')a.status='paused';
      state.active=owner.island;visit(owner.island);setMode('chat');setPanel(true);openPlace('desk');return;
    }
    if(state.planAdopted){setMode('plan');makePlan();notice('按当前条件重新看一下安排，再开始下一块。');return;}
    if(p.activityId&&a&&a.id!==p.activityId){makePlan();notice('当前活动已经变化，已重新接上；请查看新的安排。');return;}
    if(!a&&owner&&owner.status!=='closed')a=owner;
    if(!p.timing.currentWindow&&!a){editDaySchedule();return;}
    const existed=!!a;
    if(!a){a={id:'activity-'+Date.now(),island:p.dest,title:p.course,step:p.step,reason:p.reason,status:'ready',kind:p.kind,stop:'',draft:'',closeDraft:'',nextDraft:'',report:'paused'};state.activities[p.dest]=a;state.active=p.dest;}
    // 保留原活动对象和全部事实/草稿字段；新安排单独记在 plan 上。
    if(p.timing.currentWindow){a.step=p.step;a.reason=p.reason;a.kind=p.kind;}
    a.dayIntent=p.intent;a.plan=p;state.active=a.island;
    p.activityId=a.id;state.acceptedTimePlan=p;state.planAdopted=true;state.timeDirty=false;
    if(!existed)state.reentry=false;
    if(p.explicitInput){
      if(state.composerDrafts.plan.trim()===p.intent)state.composerDrafts.plan='';
      if(state.mode==='plan'&&$('intent').value.trim()===p.intent)$('intent').value='';
    }
    if(existed){renderPlan();renderHome();if(life.open&&state.tab==='desk'&&!a.closing)renderSpace();syncLife();notice('剩余安排已更新；原活动、停止处和草稿保留。');}
    else{visit(p.dest);setMode('chat');setPanel(true);render();openPlace('desk');notice('这一块已接到岛上。手动安排已加入界面，正在保存到本机。');}
  };
  shorten=function(){
    prepareEdit();refreshClock();const s=state.timeSetup,result=readEvaluation();
    const w=s.windows.find(x=>x.id===result.currentWindow?.id);
    if(w){w.start=Math.max(s.reference,w.start);w.end=w.start+30;w.enabled=true;s.windows.forEach(x=>{if(x.id!==w.id&&x.end>s.reference)x.enabled=false;});}
    else{s.windows=core.template('block',s.reference,30).windows;s.mode='block';}
    s.duration=30;dirty();renderWindows();makePlan();setMode('plan');setPanel(true);$('planCard').scrollIntoView({block:'nearest'});notice('已缩成半小时；后面的窗口先不安排。已有活动保持原状。');
  };
  send=function(){if(state.mode!=='plan'){priorSend();state.composerDrafts.chat=$('intent').value;return;}if(makePlan({useInput:true})){$('planCard').scrollIntoView({block:'start',behavior:'smooth'});notice('按所选时间展示这一步；当前仍是手动界面安排，不自动写学习进展。');}};
  renderPanel=function(){priorRenderPanel();syncActivityFields();if(state.plan?.timing){$('contextCaption').textContent='在学线索 · 课次与进度未确认';}renderPlan();};

  document.querySelectorAll('[data-scenario]').forEach(b=>b.addEventListener('click',()=>chooseMode(b.dataset.scenario)));
  document.querySelectorAll('[data-duration]').forEach(b=>b.addEventListener('click',()=>chooseMode('block',Number(b.dataset.duration))));
  document.querySelectorAll('[data-task]').forEach(b=>b.addEventListener('click',()=>{state.timeSetup.taskType=b.dataset.task;dirty();updateSummary();}));
  $('dayReference').addEventListener('change',()=>{const v=core.parseTime($('dayReference').value);if(v===null){error('请填完整的开始时间。');return;}const s=state.timeSetup;s.reference=v;s.live=false;if(s.mode==='block'&&!state.acceptedTimePlan)s.windows=core.template('block',v,s.duration).windows;dirty();renderWindows();});
  $('timeNow').addEventListener('click',()=>{state.timeSetup.live=true;refreshClock();dirty();renderWindows();});
  ['lessonLength','materialName','destination'].forEach(id=>$(id).addEventListener('input',dirty));
  $('destination').addEventListener('change',()=>{
    if(currentScope())return;
    const old=state.activities[$('destination').value];
    if(old&&old.status!=='closed'){
      $('materialName').value=old.title;$('lessonLength').value=old.plan?.lesson??'';
      state.timeSetup.taskType=old.plan?.setup?.taskType||(old.kind==='practice'?'practice':'course');
      updateSummary();notice('这座岛还有暂停的内容，会接回原活动与草稿。');
    }
  });
  $('intent').addEventListener('input',()=>{state.composerDrafts[state.mode]=$('intent').value;if(state.mode==='plan')dirty();});
  window.refreshIslandTimeControls = () => {renderWindows();updateSummary();};
  renderWindows();setMode(state.mode);render();
})();
