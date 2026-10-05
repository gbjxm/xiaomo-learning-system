// Synthetic restore exercise only. Never moves production records or modifies the raw restore.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const sourceRoot=path.resolve(process.argv[2]), here=path.dirname(fileURLToPath(import.meta.url));
const load=relative=>import(pathToFileURL(path.join(sourceRoot,relative)).href);
const {LearningRepository,hashText}=await load('web/learning/records.mjs');
const {LearningCommitter}=await load('web/learning/commit.mjs');
const {NaturalRecordingCoordinator}=await load('web/learning/intake.mjs');
const {ContentStore}=await load('web/content/store.mjs');
const {UIStateStore}=await load('web/unified/ui-state.mjs');
const run=(args,options={})=>{const r=spawnSync('python',['-B','-X','utf8',...args],{encoding:'utf8',...options});if(r.status!==0)throw new Error(r.stdout+'\n'+r.stderr);return JSON.parse(r.stdout);};
const root=run(['-c','import test_backup,json;print(json.dumps(str(test_backup.fixture()),ensure_ascii=False))'],{cwd:here});
const raw=path.join(root,'raw-restored'),NOW=()=>new Date('2026-10-05T03:00:00Z');
const write=async(file,value)=>{await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,typeof value==='string'?value:JSON.stringify(value,null,2)+'\n');};
const json=async file=>JSON.parse(await fs.readFile(file,'utf8'));
for(const relative of ['运行记录/.自然记录/intake_fixture01.json','运行记录/.学习提交/learning_fixture01.json','运行记录/我的内容/content_fixture01.json','学习小岛/data/ui-state.json'])await fs.unlink(path.join(root,relative));
const ui=new UIStateStore({projectRoot:root,stateFile:path.join(root,'学习小岛/data/ui-state.json'),scope:'isolated'});
await ui.initialize({version:1,fields:{draft:'合成未发送稿'},islandState:{},lifeState:{}});
const make=root=>{const repository=new LearningRepository({projectRoot:root,scope:'isolated'});const committer=new LearningCommitter({projectRoot:root,scope:'isolated',repository,now:NOW});const content=new ContentStore({projectRoot:root,scope:'isolated',repository,now:NOW});return{repository,committer,content,intake:new NaturalRecordingCoordinator({projectRoot:root,scope:'isolated',repository,committer,contentStore:content,now:NOW})};};
const original=make(root),payload=(requestId,message,context)=>({requestId,message,mode:'chat',history:[],...(context?{context}:{})});
const encode=capture=>'这是隔离演练的 AI 回应。\n<learning_updates>'+JSON.stringify({version:1,saveReason:'note',capture})+'</learning_updates>';
const inputs=[
 {payload:payload('restore-note-0001','看了第3课，人物关系还有疑问，帮我记一下。'),capture:{kind:'learning',title:'学习笔记',chapter:3}},
 {payload:payload('restore-watch-0001','看了电影《隔离片名》，先记个片名。'),capture:{kind:'watch',title:'隔离片名'}},
 {payload:payload('restore-creation-0001','我有个故事点子：小猫寻找房子，帮我记下。'),capture:{kind:'creation',title:'小猫寻找房子'}}
];
for(const input of inputs){input.result=(await original.intake.handle(input.payload,{runModel:async()=>encode(input.capture)})).body;assert.equal(input.result.saved,true);}
const originalNotes=(await original.repository.snapshot()).notes,originalContent=(await original.content.list()).items.filter(item=>!item.readOnly);
const pendingPayload=payload('restore-pending-0001','还有第4课的疑问，帮我记一下。'),pendingCapture={kind:'learning',title:'学习笔记',chapter:4};
const interruptedCommitter=new LearningCommitter({projectRoot:root,scope:'isolated',repository:original.repository,now:NOW,faultInjector(point){if(point==='after_prepare')throw new Error('synthetic interruption with frozen learning targets');}});
const interrupted=new NaturalRecordingCoordinator({projectRoot:root,scope:'isolated',repository:original.repository,committer:interruptedCommitter,contentStore:original.content,now:NOW});
const interruptedResult=await interrupted.handle(pendingPayload,{runModel:async()=>encode(pendingCapture)});assert.equal(interruptedResult.body.saved,false);assert.equal((await interrupted.lookup(pendingPayload.requestId)).status,'prepared');const frozenBefore=await original.repository.findRequest(pendingPayload.requestId);assert.equal(frozenBefore.status,'interrupted');assert.ok(frozenBefore.targets.length>0);assert.ok(frozenBefore.targets.every(target=>target.oldHash&&target.newHash));
const navigation=path.join(root,'领航原址'),state={schema:'xiaomo.navigation-state/v2',revision:2,updated_at:'2026-10-05T03:00:00Z',focus:{text:'隔离演练',basis:'合成',history:[]},decisions:[],applied_events:[],records:[{id:'R-fixture',kind:'user_report',occurred_on:'2026-10-05',received_at:'2026-10-05T03:00:00Z',source:'合成原话',content:'仅为恢复演练的原话',journey_document:{entry_id:'R-fixture',file:'依据/记录.md'}}],resources:[],routes:[]};
await write(path.join(navigation,'状态/领航状态.json'),state);
const created=run([path.join(here,'backup.py'),'--project-root',root]);
const recovered=run([path.join(here,'backup.py'),'--verify',created.path,'--restore-target',raw]);assert.equal(recovered.contentVerified,true);
const originalManifest=await json(path.join(raw,'RESTORED_ISOLATED.json'));
let rejected=false;try{await make(raw).repository.snapshot();}catch(error){rejected=error.code==='LEARNING_INVALID_JOURNAL';}assert.equal(rejected,true,'raw restore must reject a wrong project root');
const protection=path.join(root,'before-restore'),mapping={purpose:'synthetic_same_absolute_path_restore',sourceProject:root,rawRestore:raw,originalPackage:created.path,originalPackageSha256:created.sha256,recordsAreSynthetic:true,moved:[],identitiesRebound:false};
const inside=(child,parent)=>{const rel=path.relative(parent,child);return !!rel&&!rel.startsWith('..')&&!path.isAbsolute(rel);};
assert.ok(inside(await fs.realpath(root),path.join(sourceRoot,'验证','三系统整合')));
for(const item of originalManifest.manifest.files){
  const destination=item.path.startsWith('领航室/')?path.join(navigation,item.path.slice('领航室/'.length)):path.join(root,item.path);
  assert.ok(inside(destination,root));const before=path.join(protection,item.path);assert.ok(inside(before,protection));
  await fs.mkdir(path.dirname(before),{recursive:true});await fs.rename(destination,before);mapping.moved.push({path:item.path,source:destination,protected:before});
}
for(const item of mapping.moved){await fs.mkdir(path.dirname(item.source),{recursive:true});await fs.copyFile(path.join(raw,item.path),item.source);assert.equal(hashText(await fs.readFile(item.source)),originalManifest.manifest.files.find(f=>f.path===item.path).sha256);}
const cloned=make(root),newNotes=(await cloned.repository.snapshot()).notes,newContent=(await cloned.content.list()).items.filter(item=>!item.readOnly);
assert.deepEqual(newNotes,originalNotes);assert.deepEqual(newContent,originalContent);
for(const input of inputs){const again=(await cloned.intake.handle(input.payload,{runModel:async()=>{throw new Error('must not regenerate');}})).body;assert.deepEqual(again,input.result);}
assert.deepEqual(await cloned.repository.findRequest(pendingPayload.requestId),frozenBefore);
const resumed=(await cloned.intake.handle(pendingPayload,{runModel:async()=>{throw new Error('prepared result must not regenerate');}})).body;assert.equal(resumed.saved,true);assert.equal((await cloned.intake.lookup(pendingPayload.requestId)).status,'committed');assert.equal((await cloned.repository.snapshot()).notes.length,2);
const noteId=originalNotes[0].noteId,more=await cloned.intake.handle(payload('restore-note-0002','补充：第三课里我还有另一个疑问。',{noteId}),{runModel:async()=>encode({kind:'learning',action:'append',targetId:noteId,title:'学习笔记'})});
assert.equal(more.body.saved,true);assert.equal((await cloned.repository.readNote(noteId)).version,2);assert.equal((await cloned.repository.snapshot()).tasks.length,0);
for(const item of originalContent){const base=await cloned.content.bootstrap();const saved=await cloned.content.save({identity:base.identity,expectedRevision:base.revision,submissionId:'restore-append-'+item.kind,action:'append',item:{id:item.id,kind:item.kind,title:item.title,body:'恢复后仅合成补充'}});assert.equal(saved.item.id,item.id);assert.equal(saved.item.version,2);}
const current=await cloned.content.bootstrap();await assert.rejects(cloned.content.save({identity:current.identity,expectedRevision:'0'.repeat(64),submissionId:'wrong-old-revision',item:{kind:'creation',title:'合成',body:'不应写入'}}),{code:'CONTENT_REVISION_CONFLICT'});
const restoredUI=new UIStateStore({projectRoot:root,stateFile:path.join(root,'学习小岛/data/ui-state.json'),scope:'isolated'}),readUI=await restoredUI.read();assert.equal(readUI.state.fields.draft,'合成未发送稿');assert.equal(readUI.storeId,originalManifest.manifest.uiIdentity.storeId);
const workspace=await json(path.join(root,'三系统工作台/data/workspace-state.json'));assert.equal(workspace.storeId,originalManifest.manifest.workspaceIdentity.storeId);assert.equal(workspace.projectRoot,root);
// Navigation's own trusted runtime is supplied separately; code is intentionally absent from the data ZIP.
const navConfig=await json(path.join(sourceRoot,'navigation-connection.json'));
for(const name of ['room.py','continuity.py']){await fs.mkdir(path.join(navigation,'tools'),{recursive:true});await fs.copyFile(path.join(navConfig.navigationRoot,'tools',name),path.join(navigation,'tools',name));}
const worker=(command,value)=>run([path.join(sourceRoot,'web/navigation/worker.py'),command,'--project-root',root,'--root',navigation,'--mode','isolated'],{input:JSON.stringify(value)}).data;
const boot=worker('bootstrap',{asOf:'2026-10-05'});assert.equal(boot.revision,2);
const navigationEvent={event_id:'restore-navigation-0001',op:'record',record:{id:'R-after-restore',kind:'user_report',occurred_on:'2026-10-05',source:'隔离恢复演练',content:'合成的恢复后补充'}};
const eventFile=path.join(root,'event.json');await write(eventFile,navigationEvent);
const roomArgs=[path.join(navigation,'tools/room.py'),'--root',navigation,'apply',eventFile,'--expected-revision','2'];run(roomArgs);
const newBoot=worker('bootstrap',{asOf:'2026-10-05'});assert.equal(newBoot.revision,3);const finalState=await json(path.join(navigation,'状态/领航状态.json'));assert.ok(finalState.records.some(row=>row.id==='R-fixture'));assert.ok(finalState.records.some(row=>row.id==='R-after-restore'));
for(const item of originalManifest.manifest.files){const bytes=await fs.readFile(path.join(raw,item.path));assert.equal(createHash('sha256').update(bytes).digest('hex'),item.sha256);}
const evidence={ok:true,syntheticOnly:true,root,raw,protection,package:created,rawBytePreservation:true,wrongRootRejected:true,identitiesRebound:false,checks:['原字节异地恢复拒绝误用不同根','按清单保护合成原文件并恢复到相同绝对路径','恢复不改任何身份、history或请求哈希','学习笔记原文版本历史不变','三种已提交自然请求不再生成且不重复写入','prepared自然回执及interrupted学习冻结目标原样恢复，按原CAS不调用模型继续同请求','同一noteId补充到版本2','原观看编号和创作编号分别接续到版本2','错误旧版本保存被CAS拒绝','UI原storeId和草稿及工作台身份保留','领航原R编号保留并追加新记录','原始恢复目录全部哈希仍匹配'],limitations:['正式目录未执行灾后覆盖；本次消费者续接仅使用合成隔离数据。','异地换根目录保持原字节仅供核对；异地迁移未作为自动功能。','数据ZIP不含运行源码；演练调用现有可信代码。']};
await write(path.join(root,'rehearsal-mapping.json'),mapping);await write(path.join(root,'rehearsal-evidence.json'),evidence);
console.log(JSON.stringify(evidence,null,2));
