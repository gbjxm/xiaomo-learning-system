'use strict';

// Review tools are intentionally secondary: notices and decision information
// stay first; drafts survive folding, returning and refreshing this tab.
window.stage2Review = (() => {
  const labels = {time:'时间 / 截止',eligibility:'参与资格',work_requirements:'作品与AI要求',steps:'投稿步骤',rewards:'奖励及条件',risks:'版权 / 独家',program:'长期机制',summary:'简介',organizer:'主办方',entry_url:'报名入口',publication_at:'发布日期',assessment:'AI资格'};
  const drafts = new Map();
  let activeWrites=0;
  const uncertainWrites=new Set();
  const epoch=()=>state.dataEpoch||0;
  async function writeRequest(path,payload){activeWrites++;try{return await api(path,typeof payload==='function'?await payload():payload);}finally{activeWrites--;}}
  function message(value,error=false){const node=el('p',error?'error note-status':'note-status',value);node.setAttribute('role','status');return node;}
  function field(label,value='',options={}){
    const wrap=el('label','review-field');add(wrap,el('span',null,label));let input;
    if(options.choices){input=el('select');for(const [key,name] of options.choices){const option=el('option',null,name);option.value=key;add(input,option);}input.value=value;}
    else{input=el(options.multiline?'textarea':'input');if(!options.multiline)input.type=options.type||'text';input.value=value??'';input.maxLength=options.maxLength||5000;if(options.multiline)input.rows=options.rows||3;}
    input.setAttribute('aria-label',label);if(options.placeholder)input.placeholder=options.placeholder;
    if(options.help)add(wrap,el('small',null,options.help));add(wrap,input);return {wrap,input};
  }
  function storedDraft(id){if(drafts.has(id))return drafts.get(id);try{const saved=JSON.parse(sessionStorage.getItem('xiaomo-review-draft-'+id)||'null');return saved&&typeof saved==='object'?saved:null;}catch{return null;}}
  function keepDraft(id,data){drafts.set(id,data);try{sessionStorage.setItem('xiaomo-review-draft-'+id,JSON.stringify(data));}catch{}}
  function clearDraft(id){drafts.delete(id);try{sessionStorage.removeItem('xiaomo-review-draft-'+id);}catch{}}
  function localDownload(label,id){const node=el('a','link-button',label);node.href=informationURL('/api/evidence/download?id='+encodeURIComponent(id));node.download='';return node;}

  function candidateTools(candidate){
    const details=el('details','stage2-tools review-candidate');add(details,el('summary',null,candidate.review_state==='known'?'查看核验 / 关联工具':'核验后保存 · 或关联已有条目'));
    const body=el('div','stage2-panel');add(details,body);let loaded=false,request=0;
    details.addEventListener('toggle',async()=>{
      if(!details.open||loaded)return;const current=++request,readingEpoch=epoch();body.replaceChildren(message('正在读取线索与核验表单…'));
      try{const result=await api('/api/review/candidate?id='+encodeURIComponent(candidate.id));if(current!==request||readingEpoch!==epoch()||!details.isConnected)return;loaded=true;body.replaceChildren();buildCandidateForm(body,result);}
      catch(error){if(current===request&&readingEpoch===epoch()&&details.isConnected)body.replaceChildren(message('读取失败：'+error.message,true),button('重试',null,()=>{loaded=false;details.open=false;details.open=true;}));}
    });return details;
  }

  function buildCandidateForm(body,result){
    const candidate=result.candidate,initial=storedDraft(candidate.id)||{...result.suggestions,action:candidate.review_state==='known'?'link':'create',kind:'competition',mechanism:'unspecified',ai_policy:'unspecified',time_verified:false,rewards:[]};
    add(body,message(result.note+' 表单空白表示未知；不会自动确认账号资格。'));
    const form=el('form','review-form'),inputs={},fields=el('div','review-field-grid');let preview=null,pending=false,uncertainOperation=typeof initial.uncertain_operation==='string'?initial.uncertain_operation:null;
    const status=message('填写已核部分，再预览；正式入库不等于规则已核完整。'),previewBox=el('div','review-preview');
    const action=field('处理方式',initial.action,{choices:[['create','核验后新增正式记录'],['link','关联已有同届记录']]});add(form,action.wrap);inputs.action=action.input;
    const target=field('关联已有条目',initial.target_id||'',{choices:[['','请选择同一届活动'],...(state.data?.items||[]).map(item=>[item.id,item.title+' · '+item.edition])]});add(form,target.wrap);inputs.target_id=target.input;
    const definitions=[['title','活动 / 计划名称'],['platform','平台 / 来源名称'],['organizer','主办方'],['edition','年份 / 届次 / 轮次'],['kind','机会类型',{choices:[['competition','比赛征集'],['creator_program','长期创作者计划'],['limited_benefit','限时福利'],['rule_update','规则更新']]}],['official_url','官方原文网址'],['entry_url','报名 / 加入网址（未知留空）'],['summary','这是怎样的机会',{multiline:true}],['publication_at','发布日期（未知留空）',{placeholder:'2026-09-30；不要推定时刻'}],['mechanism','时间机制',{choices:[['unspecified','官方未说明'],['fixed','明确起止'],['ongoing','官方明确常年开放'],['batches','分批 / 定向开放']]}],['start','开始日期 / 时刻',{placeholder:'YYYY-MM-DD 或完整ISO时刻'}],['deadline','截止日期 / 时刻',{placeholder:'支持 YYYY-MM-DD 24:00，保留原文'}],['timezone','原文时区',{placeholder:'官方未写就留空；北京时区可填 +08:00'}],['month_start','仅月份窗口：开始',{placeholder:'YYYY-MM（不要补造日与时刻）'}],['month_end','仅月份窗口：结束',{placeholder:'YYYY-MM'}],['time_excerpt','时间机制对应官方摘录',{multiline:true}],['conflict','时间 / 状态冲突说明',{multiline:true}],['eligibility','参与资格（每行一项）',{multiline:true}],['work_requirements','时长 / 格式 / AI工具等要求（每行一项）',{multiline:true}],['ai_policy','公开AI作品使用规则',{choices:[['unspecified','未核，不能默认允许'],['allowed','官方明确允许'],['limited','仅允许有限AI参与'],['prohibited','官方明确不接受AI作品']]}],['steps','投稿 / 加入步骤（每行一项）',{multiline:true}],['rights','首发 / 独家 / 授权 / 版权要求（每行一项）',{multiline:true}],['excerpt','本次已读官方原文依据',{multiline:true,rows:5,maxLength:12000,help:'请自行阅读和摘录；自动提取正文不是人工确认。'}],['review_note','核验说明与仍需确认之处',{multiline:true}]];
    for(const [key,label,options] of definitions){const entry=field(label,initial[key],options||{});inputs[key]=entry.input;add(fields,entry.wrap);}add(form,fields);
    for(const [key,label] of [['time_verified','我已对照官方原文确认上述时间机制（不确认个人资格）'],['deadline_tentative','官方截止暂定']]){const entry=field(label,'',{type:'checkbox'});entry.input.checked=initial[key]===true;inputs[key]=entry.input;add(form,entry.wrap);}
    const rewards=el('div','review-rewards'),rewardRows=[];add(form,el('h3',null,'奖励分别填写'),message('总奖池、单项奖、积分和流量要分别写口径；留空表示尚未核到奖励。'),rewards);
    function addReward(value={}){
      const row=el('fieldset','review-reward-row');add(row,el('legend',null,'一项奖励'));const nodes={};
      for(const [key,label,options] of [['type','奖励类别',{choices:Object.entries(rewardNames)}],['amount','已核数量',{type:'number',placeholder:'未知留空'}],['currency','币种 / 单位',{placeholder:'CNY、USD、积分…'}],['label','奖励说明'],['scope','口径 / 获得条件',{placeholder:'总奖池；或单项最高奖。不能写成保底个人收益'}],['validity','奖励有效期'],['source_excerpt','奖励对应原文',{multiline:true}]]){const entry=field(label,value[key]??(key==='type'?'cash':''),options||{});nodes[key]=entry.input;add(row,entry.wrap);}
      const record={row,nodes};rewardRows.push(record);add(row,button('移除此奖励',null,()=>{if(pending)return;rewardRows.splice(rewardRows.indexOf(record),1);row.remove();edited();}));add(rewards,row);
    }
    for(const value of initial.rewards||[])addReward(value);const addRewardButton=button('＋ 添加一项奖励',null,()=>{if(rewardRows.length>=20)return;addReward();edited();});add(form,addRewardButton);
    const previewButton=el('button','link-button','预览核验结果');previewButton.type='submit';add(form,add(el('div','review-actions'),previewButton),status,previewBox);add(body,form);
    function collect(){const values={};for(const [key,input] of Object.entries(inputs))values[key]=input.type==='checkbox'?input.checked:input.value;values.rewards=rewardRows.map(({nodes})=>Object.fromEntries(Object.entries(nodes).map(([key,input])=>[key,key==='amount'?(input.value.trim()===''?null:Number(input.value)):input.value])));return values;}
    function syncAction(){const linking=action.input.value==='link';fields.hidden=linking;rewards.hidden=linking;addRewardButton.hidden=linking;target.wrap.hidden=!linking;for(const key of ['time_verified','deadline_tentative'])inputs[key].parentElement.hidden=linking;previewButton.textContent=linking?'预览关联关系':'预览核验结果';}
    function edited(){keepDraft(candidate.id,uncertainOperation?{...collect(),uncertain_operation:uncertainOperation}:collect());preview=null;previewBox.replaceChildren();status.textContent=uncertainOperation?'上次提交结果仍未确认；编辑草稿已保留，请先查询结果。':'草稿已保留在此标签页；修改后请重新预览。';if(uncertainOperation)add(previewBox,button('查询上次提交结果',null,()=>queryReceipt(uncertainOperation)));syncAction();}
    form.addEventListener('input',edited);form.addEventListener('change',edited);syncAction();
    function setPending(value){pending=value;previewButton.disabled=value;for(const node of form.querySelectorAll('input,textarea,select,button'))node.disabled=value;}
    function showReceipt(receipt){uncertainWrites.delete(receipt.operation_id);uncertainOperation=null;previewBox.replaceChildren(message(receipt.note||'操作已确认。'));if(receipt.item_id)add(previewBox,button('查看正式条目',null,()=>openDetail(receipt.item_id)));if(receipt.status==='confirmed'){clearDraft(candidate.id);status.textContent='已保存。来源、开放时间、条款完整度与个人资格仍分别判断。';load();}}
    async function queryReceipt(operation){const readingEpoch=epoch();try{const receipt=await api('/api/review/receipt?id='+encodeURIComponent(operation));if(readingEpoch!==epoch()||!form.isConnected)return;if(receipt.status==='confirmed')showReceipt(receipt);else{status.textContent=receipt.note;add(previewBox,button('我已核对当前线索，放弃本次未确认提交',null,()=>{uncertainWrites.delete(operation);uncertainOperation=null;keepDraft(candidate.id,collect());preview=null;previewBox.replaceChildren();status.textContent='未确认提交已放弃；草稿保留，请重新预览。已有正式记录不删除。';}));}}catch(error){if(readingEpoch===epoch()&&form.isConnected)status.textContent='结果仍未读到：'+error.message+'。请保留当前表单并稍后查询。';}}
    if(typeof initial.uncertain_operation==='string'){uncertainWrites.add(initial.uncertain_operation);status.textContent='上次提交结果尚未确认，请先查询结果；草稿保留。';add(previewBox,button('查询上次提交结果',null,()=>queryReceipt(initial.uncertain_operation)));}
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(pending)return;if(uncertainOperation){queryReceipt(uncertainOperation);return;}const values=collect(),readingEpoch=epoch();keepDraft(candidate.id,values);setPending(true);status.textContent='正在校验并生成预览；还没有写入正式记录。';
      try{const payload={candidate_id:candidate.id,action:values.action};if(values.action==='link')payload.target_id=values.target_id;else{payload.fields={...values};delete payload.fields.action;delete payload.fields.target_id;}
        const result=await api('/api/review/preview',payload);if(readingEpoch!==epoch()||!form.isConnected)return;preview=result;previewBox.replaceChildren(el('h3',null,'确认前核对'),...result.warnings.map(value=>message(value)));
        if(result.action==='link')add(previewBox,el('p',null,result.preview.candidate_title+' → '+result.preview.title+' · '+result.preview.edition),link('目标官方原文 ↗',result.preview.official_url));
        else add(previewBox,el('h4',null,result.preview.title),el('p',null,result.preview.summary),el('p',null,'状态：'+result.preview.status.label+'；'+result.preview.status.note),el('p',null,'资格：'+(result.preview.eligibility.join('；')||'未核')),el('p',null,'奖励：'+(result.preview.rewards.map(reward=>rewardText(reward)+'（'+reward.scope+'）').join('；')||'未核')),el('p',null,'版权：'+(result.preview.risks.map(risk=>risk.detail).join('；')||'未核；不代表无约束')));
        const confirm=button(result.action==='link'?'确认关联':'确认保存正式记录','save-button',async()=>{
          if(pending||preview!==result||readingEpoch!==epoch())return;setPending(true);status.textContent='正在提交；断连时先查询结果，避免重复入库。';
          try{const receipt=await writeRequest('/api/review/confirm',{token:result.token,operation_id:result.operation_id});uncertainWrites.delete(result.operation_id);if(receipt.status==='confirmed')clearDraft(candidate.id);if(readingEpoch===epoch()){if(form.isConnected)showReceipt(receipt);else load();}}
          catch(error){uncertainOperation=result.operation_id;uncertainWrites.add(result.operation_id);keepDraft(candidate.id,{...collect(),uncertain_operation:result.operation_id});if(readingEpoch===epoch()&&form.isConnected){status.textContent='提交结果未获确认：'+error.message+'；核对结果前暂停恢复资料。';add(previewBox,button('查询这次提交结果',null,()=>queryReceipt(result.operation_id)));}}
          finally{if(form.isConnected)setPending(false);}
        });add(previewBox,add(el('div','review-actions'),confirm,button('取消预览，继续修改',null,()=>{preview=null;previewBox.replaceChildren();status.textContent='预览已取消，草稿仍在；没有提交写入。';})));status.textContent='请核对上述结果；只有点击确认才写入。';
      }catch(error){if(readingEpoch===epoch()&&form.isConnected){preview=null;previewBox.replaceChildren();status.textContent='预览未完成：'+error.message;}}
      finally{if(form.isConnected)setPending(false);}
    });
  }

  function readableSnapshot(doc){
    const node=el('div','version-snapshot');add(node,el('h4',null,doc.title),el('p',null,doc.summary),el('p',null,(doc.organizer||'主办方未核')+' · '+doc.platform+' · '+doc.edition),link('该版本官方原文 ↗',doc.official_url));
    const date=doc.time||{};add(node,el('p',null,'时间：'+(date.start||'开始未知')+' → '+(date.deadline||'截止未知')+'；时区 '+(date.timezone||'未注明')+'；机制 '+(MECHANISM_LABELS[date.mechanism]||date.mechanism)+'；'+(date.confirmed?'已人工确认机制':'时间未确认')));if(date.month_period)add(node,el('p',null,'月份窗口：'+date.month_period.start+' 至 '+date.month_period.end));if(date.conflict)add(node,message('时间冲突：'+date.conflict,true));
    for(const [key,label] of [['eligibility','参与资格'],['work_requirements','作品要求'],['steps','投稿 / 加入步骤']]){add(node,el('h5',null,label));const values=doc[key]||[];if(!values.length)add(node,el('p',null,'未核'));for(const value of values)add(node,el('p',null,value));}
    add(node,el('h5',null,'奖励分别计量'));for(const reward of doc.rewards||[])add(node,el('p',null,(rewardNames[reward.type]||reward.type)+'：'+rewardText(reward)+'；口径 '+(reward.scope||'未知')+'；有效期 '+(reward.validity||'未知')));if(!doc.rewards?.length)add(node,el('p',null,'未核'));
    add(node,el('h5',null,'版权 / 独家'));for(const risk of doc.risks||[])add(node,el('p',risk.level==='high'?'risk-card high':'',risk.detail));if(!doc.risks?.length)add(node,el('p',null,'条款未核；未知不等于没有限制。'));
    for(const [key,value] of Object.entries(doc.program||{}))if(value)add(node,el('p',null,(programNames[key]||key)+'：'+value));
    add(node,el('h5',null,'当时保存的完整原文摘录'));for(const evidence of doc.evidence||[])add(node,el('p',null,evidence.excerpt),evidence.note?el('small',null,evidence.note):null,link('摘录来源 ↗',evidence.url));
    const complete=el('details');add(complete,el('summary',null,'完整结构化快照（包含额外字段）'),el('pre','diff',JSON.stringify(doc,null,2)));add(node,complete);return node;
  }
  const MECHANISM_LABELS={fixed:'明确起止',ongoing:'官方明确常年开放',batches:'分批 / 定向',unspecified:'官方未说明'};

  function detailTools(item){
    const details=el('details','stage2-tools');add(details,el('summary',null,'核验工作台 · 完整旧版、原文差异与本地证据'));
    const body=el('div','stage2-panel');add(details,body);let loaded=false,request=0;
    details.addEventListener('toggle',async()=>{if(!details.open||loaded)return;const current=++request,readingEpoch=epoch();body.replaceChildren(message('正在读取完整历史与证据…'));
      try{const [history,evidence]=await Promise.all([api('/api/review/history?id='+encodeURIComponent(item.id)),api('/api/evidence?id='+encodeURIComponent(item.id))]);if(current!==request||readingEpoch!==epoch()||!details.isConnected)return;loaded=true;body.replaceChildren(message('旧版和网页变化用于核验，不代替当前适用规则；个人判断、机器提取和官方内容分别标注。'));buildHistory(body,item,history);buildEvidence(body,item,evidence);}
      catch(error){if(current===request&&readingEpoch===epoch()&&details.isConnected)body.replaceChildren(message('读取未完成：'+error.message,true),button('重试',null,()=>{loaded=false;details.open=false;details.open=true;}));}
    });return details;
  }

  function buildHistory(body,item,history){
    const section=el('section','review-history');add(section,el('h3',null,'完整版本对照'));
    const versions=history.versions||[],choices=versions.map(version=>[String(version.version),'版本 '+version.version+' · '+fmt(version.at)]),left=field('左侧版本',String(versions[1]?.version||versions[0]?.version||''),{choices}),right=field('右侧版本',String(versions[0]?.version||''),{choices}),panels=el('div','version-comparison'),difference=el('div','version-differences');add(section,add(el('div','review-field-grid'),left.wrap,right.wrap),difference,panels);
    function render(){const before=versions.find(v=>String(v.version)===left.input.value),after=versions.find(v=>String(v.version)===right.input.value);panels.replaceChildren();difference.replaceChildren();if(!before||!after){add(section,message('尚无可读取的版本'));return;}add(panels,add(el('article'),el('h4',null,'版本 '+before.version+' · '+before.reason),readableSnapshot(before.snapshot)),add(el('article'),el('h4',null,'版本 '+after.version+' · '+after.reason),readableSnapshot(after.snapshot)));for(const key of ['time','eligibility','work_requirements','rewards','risks','program'])if(JSON.stringify(before.snapshot[key])!==JSON.stringify(after.snapshot[key]))add(difference,message('重要变化：'+labels[key]+'；请按两侧原文重新复核。',true));if(!difference.childNodes.length)add(difference,message('两版关键参与条件相同；其他字段见完整快照。'));}
    left.input.addEventListener('change',render);right.input.addEventListener('change',render);render();add(body,section);
    for(const change of history.page_changes||[]){const details=el('details','review-page-change');add(details,el('summary',null,'网页全文变化 · '+fmt(change.at)),message(change.note));const columns=el('div','version-comparison');add(columns,add(el('article'),el('h4',null,'变化前完整文字'),el('pre','diff',change.before_body)),add(el('article'),el('h4',null,'变化后完整文字'),el('pre','diff',change.after_body)));add(details,columns);
      if(change.review)add(details,message('最新人工判断：'+change.review.data.note+'（不改动官方规则版本）'));
      const reviewDraftKey='change-'+item.id+'-'+change.id,reviewDraft=storedDraft(reviewDraftKey)||{};
      const stateField=field('本次判断',reviewDraft.state==='reviewed'?'reviewed':'needs_review',{choices:[['needs_review','仍待核实关键变化'],['reviewed','已读原文并记录判断']]}),note=field('复核依据 / 不确定性',reviewDraft.note||'',{multiline:true}),status=message('复核记录只追加人工判断，不自动确认官方规则。文字草稿在此标签页保留。');const save=button('追加复核记录',null,async()=>{if(save.disabled)return;const writingEpoch=epoch();save.disabled=true;try{await writeRequest('/api/review/change',{item_id:item.id,change_id:change.id,state:stateField.input.value,note:note.input.value});if(writingEpoch===epoch()&&details.isConnected)status.textContent='判断已追加；当前正式条款未自动改变。';}catch(error){if(writingEpoch===epoch()&&details.isConnected)status.textContent='未保存：'+error.message;}finally{save.disabled=false;}});details.addEventListener('input',()=>keepDraft(reviewDraftKey,{state:stateField.input.value,note:note.input.value}));details.addEventListener('change',()=>keepDraft(reviewDraftKey,{state:stateField.input.value,note:note.input.value}));add(details,stateField.wrap,note.wrap,save,status);add(body,details);
    }
  }

  function buildEvidence(body,item,result){
    const section=el('section','review-evidence');add(section,el('h3',null,'字段依据与本地证据'),message(result.note));const list=el('div'),attachments=result.attachments||[];add(section,list);
    function renderAttachments(){list.replaceChildren();for(const record of attachments){const data=record.data,details=el('details');add(details,el('summary',null,data.filename+' · '+(data.verification==='manual_checked'?'人工已核附件':'附件尚未核验')+' · 对应版本 '+data.item_version),message('文件 SHA-256：'+data.sha256),data.source_url?link('证据来源 ↗',data.source_url):message('来源链接未填写，文件存在不代表官方出处已核。'),localDownload('下载已保存证据',record.id),message(data.text_state==='no_text'?'无可读文字；未执行OCR或PDF文本提取。':data.text_state==='user_supplied'?'下方文字为用户提供的转录，未宣称自动OCR。':'TXT正文已读取。'),data.text?el('pre','diff',data.text):null,data.note?message(data.note):null);add(list,details);}}
    renderAttachments();for(const record of result.field_evidence||[]){const value=record.data;add(section,add(el('div','evidence-row'),el('strong',null,(labels[value.field]||value.field)+' · 版本 '+value.item_version+' · '+(value.status==='manual_checked'?'人工已核摘录':'摘录待核')),el('p',null,value.excerpt),value.page?el('small',null,'原文位置：'+value.page):null,value.source_url?link('对应原文 ↗',value.source_url):null,value.attachment_id?localDownload('对应证据附件',value.attachment_id):null));}
    const upload=el('details');add(upload,el('summary',null,'添加截图 / PDF / TXT证据'));
    const file=field('本地证据文件','',{type:'file'});file.input.removeAttribute('maxlength');file.input.accept='.pdf,.png,.jpg,.jpeg,.txt';
    const source=field('证据来源网址（未知可留空）',item.official_url),date=field('证据日期（未知留空）','',{placeholder:'YYYY-MM-DD 或完整时刻'}),verification=field('附件核验状态','unverified',{choices:[['unverified','仅保存文件，尚未核验'],['manual_checked','我已阅读并核验该附件']]}),note=field('核验说明 / 仍缺字段','',{multiline:true}),transcript=field('人工转录文字（可选）','',{multiline:true,maxLength:120000,help:'图片或PDF不会自动OCR。用户转录单独标明，不能替代原件。'}),status=message('仅导入本机文件；不会访问任意网址。单文件最多8MB。');let uploadId=null;file.input.addEventListener('change',()=>{uploadId=crypto.randomUUID().replaceAll('-','');});
    const save=button('保存新证据附件',null,async()=>{if(save.disabled)return;const selected=file.input.files?.[0];if(!selected){status.textContent='请选择文件。';return;}if(selected.size>8*1024*1024){status.textContent='文件超过8MB，请使用清晰且适当大小的证据副本。';return;}save.disabled=true;status.textContent='正在校验并保存新文件；已有证据不会被覆盖。';
      const writingEpoch=epoch();try{const record=await writeRequest('/api/evidence/import',async()=>{const buffer=new Uint8Array(await selected.arrayBuffer());if(writingEpoch!==epoch()||!upload.isConnected)throw new Error('当前资料或页面已变化，请重新选择文件后再保存');let binary='';for(let start=0;start<buffer.length;start+=8192)binary+=String.fromCharCode(...buffer.subarray(start,start+8192));uploadId??=crypto.randomUUID().replaceAll('-','');return {item_id:item.id,name:selected.name,content_base64:btoa(binary),source_url:source.input.value,observed_at:date.input.value,verification:verification.input.value,note:note.input.value,text:transcript.input.value,upload_id:uploadId};});if(writingEpoch!==epoch()||!upload.isConnected)return;if(!attachments.some(value=>value.id===record.id))attachments.push(record);renderAttachments();status.textContent='证据已保存，哈希已校验；原始规则未自动变更。';file.input.value='';uploadId=null;refreshAttachmentChoices();}
      catch(error){if(upload.isConnected)status.textContent='保存未获确认：'+error.message+'。保留文件选择后可重试，同一上传不会重复登记。';}
      finally{if(upload.isConnected)save.disabled=false;}});add(upload,file.wrap,source.wrap,date.wrap,verification.wrap,note.wrap,transcript.wrap,save,status);add(section,upload);
    const annotation=el('details');add(annotation,el('summary',null,'给关键规则追加原文依据'));const fieldName=field('对应规则字段','time',{choices:Object.entries(labels)}),excerpt=field('对应官方摘录','',{multiline:true,maxLength:12000}),fieldSource=field('摘录来源网址',item.official_url),page=field('页码 / 章节 / 图片位置',''),attachment=field('关联本地附件（可选）','',{choices:[['','不关联附件']]}),checked=field('摘录核验状态','unverified',{choices:[['unverified','尚待核验'],['manual_checked','已对照官方原文']]}),fieldStatus=message('每次追加一份证据，绑定当前版本；不会自动改日期或资格。');
    function refreshAttachmentChoices(){const selected=attachment.input.value;attachment.input.replaceChildren();for(const [value,label] of [['','不关联附件'],...attachments.map(record=>[record.id,record.data.filename])]){const option=el('option',null,label);option.value=value;add(attachment.input,option);}attachment.input.value=selected;}
    refreshAttachmentChoices();const append=button('追加字段证据',null,async()=>{if(append.disabled)return;const writingEpoch=epoch();append.disabled=true;try{const record=await writeRequest('/api/evidence/field',{item_id:item.id,field:fieldName.input.value,excerpt:excerpt.input.value,source_url:fieldSource.input.value,page:page.input.value,attachment_id:attachment.input.value,status:checked.input.value});if(writingEpoch===epoch()&&annotation.isConnected){fieldStatus.textContent='已追加 '+(labels[record.data.field]||record.data.field)+' 的版本 '+record.data.item_version+' 证据。';excerpt.input.value='';saveEvidenceDraft();}}catch(error){if(writingEpoch===epoch()&&annotation.isConnected)fieldStatus.textContent='未保存：'+error.message;}finally{append.disabled=false;}});add(annotation,fieldName.wrap,excerpt.wrap,fieldSource.wrap,page.wrap,attachment.wrap,checked.wrap,append,fieldStatus);add(section,annotation);add(body,section);
    const evidenceDraftKey='evidence-'+item.id,evidenceDraft=storedDraft(evidenceDraftKey)||{},draftInputs={source:source.input,date:date.input,verification:verification.input,note:note.input,transcript:transcript.input,field:fieldName.input,excerpt:excerpt.input,fieldSource:fieldSource.input,page:page.input,attachment:attachment.input,status:checked.input};
    for(const [key,input] of Object.entries(draftInputs)){const value=evidenceDraft[key];if(typeof value==='string'&&value.length<=120000&&(input.tagName!=='SELECT'||[...input.options].some(option=>option.value===value)))input.value=value;}
    function saveEvidenceDraft(){keepDraft(evidenceDraftKey,Object.fromEntries(Object.entries(draftInputs).map(([key,input])=>[key,input.value])));}
    section.addEventListener('input',saveEvidenceDraft);section.addEventListener('change',saveEvidenceDraft);add(section,message('文字草稿可在此标签页关闭详情或刷新后恢复；文件选择需重新选择，浏览器不会保存文件内容。'));
  }
  return {candidateTools,detailTools,pending:()=>activeWrites>0||uncertainWrites.size>0};
})();
