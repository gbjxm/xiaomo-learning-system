import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { LEARNING_ROOT, assertLearningRoot, safeLearningPath, readLearningFile, hashText, LearningRepository } from '../learning/records.mjs';
import { validateUIState } from '../unified/ui-state.mjs';

const CREATIONS = '运行记录/我的内容';
const WATCH = '运行记录/观影记录.md';
const LOCK_DIR = '运行记录/.学习提交';
const ITEM_KEYS = ['id','kind','subtype','title','body','aiText','date','domains','nextStep','watch','links','artifact'];
const CONTENT_ID = /^content_[A-Za-z0-9_-]{8,100}$/;
const WATCH_ID = /^W\d{3,8}$/;
const projectionId = /^(?:legacy-bookmark|legacy-draft|legacy-watch|learning-task|learning-artifact|learning-note|learning-entry):[A-Za-z0-9_-]{1,128}$/;
const validId = id => typeof id === 'string' && (CONTENT_ID.test(id) || WATCH_ID.test(id) || projectionId.test(id));
const stable = value => Array.isArray(value) ? '['+value.map(stable).join(',')+']' : value && typeof value === 'object' ? '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+stable(value[key])).join(',')+'}' : JSON.stringify(value);
const digest = value => hashText(stable(value));
export class ContentError extends Error { constructor(code,message,status=400,details={}) { super(message);this.code=code;this.status=status;this.details=details; } }
function fail(code,message,status=400,details={}) { throw new ContentError(code,message,status,details); }
function fields(value,keys,label) { if (!value || Array.isArray(value) || typeof value !== 'object' || Object.keys(value).some(key=>!keys.includes(key))) fail('CONTENT_INVALID_INPUT',label+'包含不支持的字段。'); }
function text(value,label,max=250000) { if (typeof value!=='string'||value.length>max) fail('CONTENT_INVALID_INPUT',label+'格式无效或过长。');return value; }
function plainJSON(value,depth=0) {
  if(depth>20) fail('CONTENT_INVALID_INPUT','练习结构嵌套过深。');
  if(value===null||typeof value==='boolean'||typeof value==='string')return;
  if(typeof value==='number'&&Number.isFinite(value))return;
  if(Array.isArray(value)){if(value.length>10000)fail('CONTENT_INVALID_INPUT','练习条目过多。');for(const item of value)plainJSON(item,depth+1);return;}
  if(!value||typeof value!=='object'||Object.getPrototypeOf(value)!==Object.prototype)fail('CONTENT_INVALID_INPUT','内容必须是普通JSON。');
  for(const [key,item] of Object.entries(value)){if(['__proto__','prototype','constructor'].includes(key))fail('CONTENT_INVALID_INPUT','内容字段不安全。');plainJSON(item,depth+1);}
}
function calendar(value) { if(value===undefined||value===null||value==='')return null;if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))fail('CONTENT_INVALID_INPUT','日期格式无效。');try{if(new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value)throw new Error();}catch{fail('CONTENT_INVALID_INPUT','日期不存在。');}return value; }
function normalizeItem(input,{stored=false}={}) {
  fields(input,ITEM_KEYS,'内容');
  if(!['creation','watch'].includes(input.kind))fail('CONTENT_INVALID_INPUT','内容类型无效。');
  if(input.id!==undefined&&(!validId(input.id)||projectionId.test(input.id)))fail('CONTENT_READ_ONLY','来源条目只读，请回到原入口继续。',409);
  if(input.id&&((input.kind==='creation'&&!CONTENT_ID.test(input.id))||(input.kind==='watch'&&!WATCH_ID.test(input.id)&&!CONTENT_ID.test(input.id))))fail('CONTENT_INVALID_INPUT','内容编号与类型不符。');
  const title=text(input.title??'','标题',1000),body=text(input.body??'','原话',stored?16*1024*1024:250000);
  // Omitted AI text is different from an explicit correction. Older manual
  // clients omit it and must never erase the response already on this record.
  const ai=input.aiText===undefined?{}:{aiText:text(input.aiText,'AI回应',stored?16*1024*1024:24000)};
  if(input.kind==='watch'&&!title.trim())fail('CONTENT_INVALID_INPUT','至少留一个作品名称。');
  if(input.kind==='creation'&&!title.trim()&&!body.trim())fail('CONTENT_INVALID_INPUT','至少留一个标题或想法。');
  const domains=input.domains??[];if(!Array.isArray(domains)||domains.length>3||domains.some(d=>!['story','visual','post'].includes(d)))fail('CONTENT_INVALID_INPUT','所属岛屿无效。');
  const links=input.links??[];if(!Array.isArray(links)||links.length>(stored?10000:100))fail('CONTENT_INVALID_INPUT','引用格式无效。');
  for(const link of links){fields(link,['label','url'],'引用');text(link.label??'','引用名称',1000);text(link.url,'引用地址',8000);if(!/^https?:\/\/[^\s]+$/i.test(link.url)&&!/^[A-Za-z]:[\\/][^\x00-\x1f]*$/.test(link.url))fail('CONTENT_INVALID_INPUT','引用只支持http(s)链接或本机绝对路径文字。');}
  let watch;
  if(input.kind==='watch'){fields(input.watch??{},['status','progress'],'观看进度');watch={status:input.watch?.status??'unknown',progress:text(input.watch?.progress??'','观看进度',8000)};if(!['unknown','watching','watched','partial'].includes(watch.status))fail('CONTENT_INVALID_INPUT','观看状态无效。');}
  else if(input.watch!==undefined)fail('CONTENT_INVALID_INPUT','创作条目不能携带观看状态。');
  if(input.artifact!==undefined){plainJSON(input.artifact);if(Buffer.byteLength(JSON.stringify(input.artifact))>1024*1024)fail('CONTENT_TOO_LARGE','这份练习超过1MiB，请先保留原稿。',413);}
  return {...(input.id?{id:input.id}:{}),kind:input.kind,subtype:text(input.subtype??(input.kind==='watch'?'viewing':'idea'),'内容形式',100),title,body,...ai,date:calendar(input.date),domains:[...new Set(domains)],nextStep:text(input.nextStep??'','停止处',16000),links:links.map(link=>({label:link.label??'',url:link.url})),...(watch?{watch}:{}),...(input.artifact!==undefined?{artifact:structuredClone(input.artifact)}:{})};
}
function rawItem(item) { return Object.fromEntries(ITEM_KEYS.filter(key=>item[key]!==undefined).map(key=>[key,item[key]])); }
function quote(value) { return String(value).split(/\r?\n/).map(line=>'> '+line).join('\n'); }
function oneLine(value) { return value.replace(/[\r\n]/g,' '); }
function legacyWatch(markdown) {
  const items=[];
  for(const line of markdown.split(/\r?\n/)) {
    const cells=line.trim().replace(/^\||\|$/g,'').split(/(?<!\\)\|/).map(cell=>cell.trim().replace(/\\\|/g,'|'));
    if(!WATCH_ID.test(cells[0]??'')||cells.length<5)continue;
    const item={id:cells[0],kind:'watch',subtype:'viewing',title:cells[1],body:cells[2]+'\n'+cells[3]+'\n最近依据：'+cells[4],date:null,domains:[],nextStep:'',links:[],watch:{status:/均已看完/.test(cells[2])?'watched':'unknown',progress:cells[2]},createdAt:null,updatedAt:null,version:0};
    items.push({...item,history:[{version:0,action:'legacy',savedAt:null,item:rawItem(item),sourceLine:line}]});
  }
  if(new Set(items.map(item=>item.id)).size!==items.length)fail('CONTENT_CORRUPT','观影原表中编号重复，保留原文，需先核对。',503);
  return items;
}
function decorate(item,relative) { return {...item,readOnly:false,source:{kind:item.kind==='watch'?'watch-ledger':'personal-content',label:item.kind==='watch'?'观影记录':'我的创作与想法',path:relative},resumeUrl:'/learning/?contentId='+encodeURIComponent(item.id)}; }
function historyEntry(item,action,savedAt,change) { return {version:item.version,action,savedAt,item:rawItem(item),change:structuredClone(change)}; }
function combine(previous,input,action,id,now) {
  const base=previous?rawItem(previous):null;
  const item={...base,...input,id,createdAt:previous?previous.createdAt:now,updatedAt:now,version:(previous?.version??0)+1};
  if(previous&&action!=='correct') {
    item.body=[previous.body,input.body].filter(v=>v!=='').join('\n\n');
    if(input.aiText!==undefined)item.aiText=[previous.aiText??'',input.aiText].filter(v=>v!=='').join('\n\n');
    if(input.date===null&&action!=='rewatch')item.date=previous.date;
    if(!input.nextStep)item.nextStep=previous.nextStep;
    item.domains=[...new Set([...previous.domains,...input.domains])];
    item.links=[...new Map([...previous.links,...input.links].map(link=>[link.url,link])).values()];
    if(input.kind==='watch'&&action!=='rewatch'){item.watch={status:input.watch.status==='unknown'?previous.watch.status:input.watch.status,progress:input.watch.progress||previous.watch.progress};}
  }
  return item;
}

export class ContentStore {
  constructor({projectRoot=LEARNING_ROOT,scope='production',uiStateReader=null,repository=null,now=()=>new Date()}={}) {
    this.root=assertLearningRoot(projectRoot,scope);this.scope=scope;this.uiStateReader=uiStateReader;this.repository=repository??new LearningRepository({projectRoot:this.root,scope});this.now=now;
    if(this.repository.root!==this.root||this.repository.scope!==scope)fail('CONTENT_IDENTITY_MISMATCH','学习来源与我的内容身份不同，拒绝混合读取。',409);
    this.identity='content:'+digest({root:this.root.toLowerCase(),scope,version:1});
  }
  #withWorkspaceRef(item) {
    const id = item.source?.kind === 'learning-note' ? 'note:' + item.noteId
      : item.source?.kind === 'learning-task' ? 'task:' + item.taskId
      : !item.readOnly && (CONTENT_ID.test(item.id) || WATCH_ID.test(item.id)) ? 'content:' + item.id : null;
    return id ? {...item,workspaceRef:{module:'learning',kind:'learning',storeId:this.identity,id}} : item;
  }
  async #native() {
    const documents=new Map(),items=new Map(),receipts=new Map(),hashes={};
    const addReceipt=(receipt,id)=>{if(!receipt||typeof receipt.submissionId!=='string'||!/^[A-Za-z0-9_-]{8,128}$/.test(receipt.submissionId)||!/^[a-f0-9]{64}$/.test(receipt.payloadHash??'')||receipt.itemId!==id||receipts.has(receipt.submissionId))fail('CONTENT_CORRUPT','保存回执结构损坏或重复，保留原件。',503);receipts.set(receipt.submissionId,receipt);};
    const watchRaw=await readLearningFile(this.root,WATCH,{maxBytes:64*1024*1024});hashes[WATCH]=watchRaw===null?null:hashText(watchRaw);
    for(const item of legacyWatch(watchRaw??''))items.set(item.id,decorate(item,WATCH));
    const markerLines=(watchRaw??'').split(/\r?\n/).filter(line=>line.startsWith('<!-- personal-watch'));
    for(const line of markerLines) {
      const match=/^<!-- personal-watch:v1 ([A-Za-z0-9+/=]+) -->$/.exec(line);let event;
      try{if(!match)throw new Error();event=JSON.parse(Buffer.from(match[1],'base64').toString('utf8'));if(event.version!==1||event.identity!==this.identity||!WATCH_ID.test(event.item.id))throw new Error();normalizeItem(rawItem(event.item),{stored:true});}catch{fail('CONTENT_CORRUPT','观影追加元信息损坏或身份不符，保留原文，未按空记录处理。',503);}
      const previous=items.get(event.item.id);if(event.item.kind!=='watch'||event.item.version!==(previous?.version??0)+1)fail('CONTENT_CORRUPT','观影版本不连续，保留原文。',503);
      addReceipt(event.receipt,event.item.id);
      items.set(event.item.id,decorate({...event.item,history:[...(previous?.history??[]),historyEntry(event.item,event.action,event.savedAt,event.change)]},WATCH));
    }
    const dir=await safeLearningPath(this.root,CREATIONS);let names=[];try{names=await fs.readdir(dir);}catch(error){if(error.code!=='ENOENT')throw error;}
    for(const name of names.filter(n=>n.endsWith('.json')).sort()) {
      if(!CONTENT_ID.test(name.slice(0,-5)))fail('CONTENT_CORRUPT','我的内容目录含无法识别的记录文件，保留原件。',503);
      const relative=CREATIONS+'/'+name,raw=await readLearningFile(this.root,relative,{optional:false,maxBytes:64*1024*1024});hashes[relative]=hashText(raw);let doc;
      try{doc=JSON.parse(raw);if(doc.schemaVersion!==1||doc.identity!==this.identity||doc.item.id!==name.slice(0,-5)||doc.item.kind!=='creation'||!Array.isArray(doc.history)||!Array.isArray(doc.receipts)||doc.history.length!==doc.item.version||doc.receipts.length!==doc.item.version)throw new Error();normalizeItem(rawItem(doc.item),{stored:true});for(let i=0;i<doc.history.length;i++){if(doc.history[i].version!==i+1)throw new Error();normalizeItem(doc.history[i].item,{stored:true});}if(stable(doc.history.at(-1).item)!==stable(rawItem(doc.item)))throw new Error();}catch{fail('CONTENT_CORRUPT','创作记录结构损坏或身份不符，保留原件。',503,{relative});}
      doc.receipts.forEach(receipt=>addReceipt(receipt,doc.item.id));documents.set(doc.item.id,doc);items.set(doc.item.id,decorate({...doc.item,history:doc.history},relative));
    }
    return {documents,items,receipts,hashes,watchRaw,revision:digest(hashes)};
  }
  async #projections() {
    const items=[],warnings=[];let ui;
    try {
      if(this.uiStateReader)ui=await this.uiStateReader();
      else {const raw=await readLearningFile(this.root,'学习小岛/data/ui-state.json');if(raw!==null){try{ui=JSON.parse(raw);if(ui.schemaVersion!==1||typeof ui.storeId!=='string'||ui.projectRoot!==this.root||ui.scope!==this.scope||!ui.state)throw new Error();validateUIState(ui.state);}catch{fail('CONTENT_SOURCE_CORRUPT','旧界面记录无法可靠读取。',503);}}}
    } catch(error) {
      ui=null;
      if(error.code!=='UI_STATE_MISSING')warnings.push({source:'ui',code:error.code??'CONTENT_SOURCE_UNAVAILABLE',message:'旧界面记录暂未读到；原件保留，正式学习、创作与观看记录仍可查看。'});
    }
    const state=ui?.state??ui, island=value=>['story','visual','post'].includes(value)?value:'home';
    const make=(id,kind,title,body,domain,extra={})=>({id,kind,title,body,subtype:'source',date:null,domains:domain==='home'?[]:[domain],nextStep:'',links:[],createdAt:null,updatedAt:null,version:0,history:[],readOnly:true,...extra});
    for(const record of state?.islandState?.records??[]) {
      if(!record||typeof record!=='object')continue;
      const domain=island(record.island),id='legacy-bookmark:'+hashText(String(record.id??stable(record))).slice(0,32);
      items.push(make(id,record.report==='watch'?'watch':'creation',String(record.title??'旧书签'),String(record.note??''),domain,{artifact:record.workshopDraft?{draft:record.workshopDraft,artifact:record.artifact??null,island:domain}:record.artifact??null,nextStep:String(record.next??''),watch:record.report==='watch'?{status:'unknown',progress:''}:undefined,source:{kind:'legacy-bookmark',label:'旧界面书签（原保存位置）',path:'学习小岛/data/ui-state.json'},resumeUrl:'/learning/?island='+domain+'&place=bookmarks&legacyContent=1&legacyRecord='+encodeURIComponent(record.id??'')}));
    }
    for(const [domain,draft] of Object.entries(state?.lifeState?.drafts??{}))if(draft&&['home','story','visual','post'].includes(domain))items.push(make('legacy-draft:'+domain,'creation','原来的练习草稿','旧界面保存的草稿可能包含预置示例；未据此认定本人完成练习。',domain,{artifact:{draft,island:domain},source:{kind:'legacy-draft',label:'旧练习草稿',path:'学习小岛/data/ui-state.json'},resumeUrl:'/learning/?island='+domain+'&place=practice&legacyContent=1&legacyDraft='+domain}));
    for(const [domain,draft] of Object.entries(state?.lifeState?.watch??{}))if(draft&&(draft.title||draft.note)&&['home','story','visual','post'].includes(domain))items.push(make('legacy-watch:'+domain,'watch',draft.title||'尚未保存的看片想法',draft.note||'',domain,{watch:{status:'unknown',progress:''},source:{kind:'legacy-watch',label:'旧观看草稿（未登记观看事实）',path:'学习小岛/data/ui-state.json'},resumeUrl:'/learning/?island='+domain+'&place=watch&legacyContent=1'}));
    const learning=await this.repository.snapshot();warnings.push(...learning.warnings);
    const courseName=id=>(learning.courses??[]).find(course=>course.courseId===id)?.name??null;
    for(const task of learning.tasks)items.push(make('learning-task:'+task.taskId,'learning',task.title,task.purpose,'home',{taskId:task.taskId,sourceRevision:learning.recordVersion,courseId:task.courseId??null,courseName:courseName(task.courseId),chapter:task.chapter??null,nextStep:task.nextStep,createdAt:null,updatedAt:task.updatedAt,source:{kind:'learning-task',label:'正式学习任务',path:'运行记录/学习记录'},resumeUrl:'/learning/?taskId='+encodeURIComponent(task.taskId)}));
    for(const artifact of Object.values(learning.artifactCatalog))items.push(make('learning-artifact:'+hashText(artifact.taskId+artifact.id).slice(0,32),'learning',artifact.artifact.title,artifact.artifact.text,'home',{taskId:artifact.taskId,artifact:artifact.artifact,source:{kind:'learning-artifact',label:'正式学习文字产物',path:artifact.activityFile},resumeUrl:'/learning/?taskId='+encodeURIComponent(artifact.taskId)}));
    for(const note of learning.notes??[])items.push(make('learning-note:'+note.noteId,'learning',note.title,note.body,'home',{noteId:note.noteId,aiText:note.aiText??'',aiTextCoverage:'full',courseId:note.courseId,courseName:courseName(note.courseId),chapter:note.chapter,date:note.occurredOn,updatedAt:note.updatedAt,version:note.version,history:note.history??[],source:{kind:'learning-note',label:'学习笔记',path:note.activityFile},resumeUrl:'/learning/?noteId='+encodeURIComponent(note.noteId)}));
    for(const entry of learning.entries??[])items.push(make('learning-entry:'+entry.id,'learning',entry.title||'以前的学习交流',entry.body,'home',{taskId:entry.taskId??null,aiText:entry.aiText??'',aiTextCoverage:entry.aiTextCoverage,courseId:entry.courseId??null,courseName:courseName(entry.courseId),chapter:entry.chapter??null,date:entry.occurredOn??null,updatedAt:entry.updatedAt,source:{kind:'learning-entry',label:'原学习交流记录',path:entry.activityFile},resumeUrl:entry.taskId?'/learning/?taskId='+encodeURIComponent(entry.taskId):null}));
    return {items,warnings};
  }
  async bootstrap(){return this.list();}
  async list({kind='all',q=''}={}) {
    if(!['all','creation','watch','learning'].includes(kind)||typeof q!=='string'||q.length>2000)fail('CONTENT_INVALID_INPUT','查找条件无效。');
    const native=await this.#native(),sources=await this.#projections(),query=q.toLocaleLowerCase();
    const items=[...native.items.values(),...sources.items].filter(item=>(kind==='all'||item.kind===kind)&&(!query||[item.title,item.body,item.aiText,item.courseName,item.nextStep,item.watch?.progress].filter(Boolean).join('\n').toLocaleLowerCase().includes(query))).sort((a,b)=>(b.updatedAt??'').localeCompare(a.updatedAt??'')||a.id.localeCompare(b.id));
    return {identity:this.identity,scope:this.scope,revision:native.revision,items:items.map(({history,...item})=>this.#withWorkspaceRef(item)),warnings:sources.warnings};
  }
  async detail(id) {if(!validId(id))fail('CONTENT_INVALID_INPUT','内容编号无效。');const native=await this.#native();let item=native.items.get(id),warnings=[];if(!item){const projection=await this.#projections();item=projection.items.find(value=>value.id===id);warnings=projection.warnings;}if(!item)fail('CONTENT_NOT_FOUND','未找到这份内容。',404);return {identity:this.identity,scope:this.scope,revision:native.revision,item:this.#withWorkspaceRef(item),warnings};}
  async #lock() {
    const dir=await safeLearningPath(this.root,LOCK_DIR);await fs.mkdir(dir,{recursive:true});await safeLearningPath(this.root,LOCK_DIR);
    const lock=await safeLearningPath(this.root,LOCK_DIR+'/.lock'),token=randomUUID(),ownerName='.owner_'+token+'.tmp',ownerFile=await safeLearningPath(this.root,LOCK_DIR+'/'+ownerName),owner=JSON.stringify({version:1,pid:process.pid,token,ownerName,createdAt:this.now().toISOString()}),deadline=Date.now()+2500;let handle,published=false;
    try {
      handle=await fs.open(ownerFile,'wx');await handle.writeFile(owner);await handle.sync();await handle.close();handle=null;
      while(!published){try{await fs.link(ownerFile,lock);published=true;}catch(error){if(error.code!=='EEXIST')throw error;await safeLearningPath(this.root,LOCK_DIR+'/.lock');const stat=await fs.lstat(lock).catch(e=>{if(e.code==='ENOENT')return null;throw e;});if(!stat)continue;if(!stat.isFile()||stat.isSymbolicLink()||stat.size>4096)fail('CONTENT_UNSAFE_LOCK','保存锁结构异常，请保留草稿。',503);let old,raw;try{raw=await fs.readFile(lock,'utf8');old=JSON.parse(raw);}catch{fail('CONTENT_UNSAFE_LOCK','无法核对保存锁持有者，保留原件。',503);}if(!Number.isSafeInteger(old.pid)||old.pid<1||typeof old.token!=='string')fail('CONTENT_UNSAFE_LOCK','保存锁缺少持有者身份。',503);let dead=false;try{process.kill(old.pid,0);}catch(e){dead=e.code==='ESRCH';}if(dead){const latest=await fs.lstat(lock).catch(()=>null);if(latest&&stat.ino===latest.ino&&stat.size===latest.size&&stat.mtimeMs===latest.mtimeMs&&await fs.readFile(lock,'utf8')===raw){await fs.unlink(lock);if(/^\.owner_[a-f0-9-]{36}\.tmp$/.test(old.ownerName??'')){const oldFile=await safeLearningPath(this.root,LOCK_DIR+'/'+old.ownerName);if(await fs.readFile(oldFile,'utf8').catch(()=>null)===raw)await fs.unlink(oldFile).catch(()=>{});}continue;}}if(Date.now()>deadline)fail('CONTENT_BUSY','另一处正在保存，请保留提交标识后重试。',503);await new Promise(resolve=>setTimeout(resolve,30));}}
      return async()=>{try{if(await fs.readFile(lock,'utf8')===owner)await fs.unlink(lock);}finally{await fs.unlink(ownerFile).catch(()=>{});}};
    }finally{await handle?.close();if(!published)await fs.unlink(ownerFile).catch(()=>{});}
  }
  async #atomic(relative,body,previousHash) {
    if(Buffer.byteLength(body,'utf8')>64*1024*1024)fail('CONTENT_TOO_LARGE','这份内容及版本已超过64MiB保存上限，本次原稿请先保留。',413);
    let file=await safeLearningPath(this.root,relative);await fs.mkdir(path.dirname(file),{recursive:true});file=await safeLearningPath(this.root,relative);const temporary=file+'.'+randomUUID()+'.tmp';let handle;
    try{handle=await fs.open(temporary,'wx');await handle.writeFile(body,'utf8');await handle.sync();await handle.close();handle=null;await safeLearningPath(this.root,relative);const current=await readLearningFile(this.root,relative,{maxBytes:64*1024*1024});if((current===null?null:hashText(current))!==previousHash)fail('CONTENT_REVISION_CONFLICT','文件已被其他操作修改，请保留草稿并重新读取。',409);await fs.rename(temporary,file);if(await fs.readFile(file,'utf8')!==body)fail('CONTENT_WRITE_UNVERIFIED','保存回读不一致，保留原提交标识后核对。',500);}finally{await handle?.close();await fs.unlink(temporary).catch(()=>{});}
  }
  async save(payload) {
    fields(payload,['identity','expectedRevision','submissionId','item','action'],'保存请求');
    if(payload.identity!==this.identity)fail('CONTENT_IDENTITY_MISMATCH','内容保存位置已变化，请保留草稿并重读。',409);
    if(typeof payload.expectedRevision!=='string'||!/^[a-f0-9]{64}$/.test(payload.expectedRevision)||typeof payload.submissionId!=='string'||!/^[A-Za-z0-9_-]{8,128}$/.test(payload.submissionId))fail('CONTENT_INVALID_INPUT','版本或提交标识无效。');
    const input=normalizeItem(payload.item),action=payload.action??'append';if(!['append','correct','rewatch'].includes(action)||action==='rewatch'&&input.kind!=='watch')fail('CONTENT_INVALID_INPUT','保存动作无效。');
    const payloadHash=digest(payload),release=await this.#lock();
    try {
      const native=await this.#native(),prior=native.receipts.get(payload.submissionId);
      if(prior){if(prior.payloadHash!==payloadHash)fail('CONTENT_SUBMISSION_CONFLICT','同一提交标识已用于不同内容，请保留原请求。',409);return {saved:true,duplicate:true,identity:this.identity,scope:this.scope,revision:native.revision,item:this.#withWorkspaceRef(native.items.get(prior.itemId)),receipt:prior};}
      if(payload.expectedRevision!==native.revision)fail('CONTENT_REVISION_CONFLICT','另一处保存了新内容，请重读后核对本次草稿。',409,{currentRevision:native.revision});
      let id=input.id;if(!id)id=input.kind==='watch'?'W'+String(Math.max(0,...[...native.items.keys()].filter(value=>WATCH_ID.test(value)).map(value=>Number(value.slice(1))))+1).padStart(3,'0'):'content_'+randomUUID();
      if(input.kind==='watch'&&!WATCH_ID.test(id))fail('CONTENT_INVALID_INPUT','新观看请省略编号，由同一台账分配。');
      const previous=native.items.get(id);if(input.id&&!previous&&WATCH_ID.test(id))fail('CONTENT_NOT_FOUND','这个观看编号不存在；新观看请省略编号。',404);
      if(previous&&previous.kind!==input.kind)fail('CONTENT_INVALID_INPUT','不能更改已有内容的类型。');
      const savedAt=this.now().toISOString(),item=combine(previous,input,action,id,savedAt),receipt={submissionId:payload.submissionId,payloadHash,itemId:id,version:item.version,savedAt};
      normalizeItem(rawItem(item),{stored:true});
      if(input.kind==='watch') {
        const event={version:1,identity:this.identity,action,savedAt,item,change:input,receipt};
        const heading=action==='rewatch'?'再次观看':previous?(action==='correct'?'更正':'补充'):'登记';
        const block='\n\n### '+id+' · '+heading+' · '+oneLine(item.title)+'\n\n- 保存时间：'+savedAt+'（不是观看日期）\n- 观看日期：'+(input.date??'未知')+'\n- 观看状态：'+input.watch.status+'\n- 观看范围／停止处：'+(oneLine(input.watch.progress)||'未提供')+'\n\n'+(input.body!==''?'本次原话：\n\n'+quote(input.body)+'\n':'本次只登记作品或进度，未提供感想。\n')+(input.aiText?'\nAI回应（不作为本人原话）：\n\n'+quote(input.aiText)+'\n':'')+'\n<!-- personal-watch:v1 '+Buffer.from(JSON.stringify(event),'utf8').toString('base64')+' -->\n';
        await this.#atomic(WATCH,(native.watchRaw??'# 观影记录\n\n观看日期与范围按本人提供的信息保存；未知处保留未知。\n')+block,native.hashes[WATCH]);
      } else {
        const previousDoc=native.documents.get(id),doc={schemaVersion:1,identity:this.identity,item,history:[...(previousDoc?.history??[]),historyEntry(item,action,savedAt,input)],receipts:[...(previousDoc?.receipts??[]),receipt]};const relative=CREATIONS+'/'+id+'.json';await this.#atomic(relative,JSON.stringify(doc,null,2)+'\n',native.hashes[relative]??null);
      }
      const check=await this.#native();if(!check.receipts.has(payload.submissionId))fail('CONTENT_WRITE_UNVERIFIED','保存回执未能回读，请保留原提交标识。',500);
      return {saved:true,duplicate:false,identity:this.identity,scope:this.scope,revision:check.revision,item:this.#withWorkspaceRef(check.items.get(id)),receipt};
    }finally{await release();}
  }
}
