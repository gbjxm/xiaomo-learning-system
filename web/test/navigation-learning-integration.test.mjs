import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {buildLearningContext} from '../learning/context.mjs';
import {LearningCoordinator} from '../learning/coordinator.mjs';
import {LearningRepository,encodeTaskMetadata,hashText} from '../learning/records.mjs';

const SOURCE=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const now=()=>new Date('2026-10-05T04:00:00Z');
const reader={async read(){return {sources:[],warnings:[],capabilities:{text:true}};}};
async function fixture(t){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'navigation-learning-flow-'));
 t.after(async()=>{const actual=await fs.realpath(root),temp=await fs.realpath(os.tmpdir());assert.ok(path.relative(temp,actual).startsWith('navigation-learning-flow-'));await fs.rm(actual,{recursive:true});});
 const files={'运行记录/个人情况.md':'# 个人情况\n## 使用偏好\n旧版每天安排两个小时。\n','运行记录/当前状态.md':'# 当前状态\n- 阶段主攻：动作连接。\n- 有效安排：原安排。\n- 系统内当次课程学习或练习记录：无。\n- 当前停止处：旧任务停点。\n- 下次入口：继续旧任务。\n','运行记录/阶段安排.md':'# 阶段安排\n## 月或阶段\n原方向。\n## 本周\n原重点。\n## 当次或当天\n原安排。\n## 已采用的改进\n无。\n','运行记录/课程记录.md':'# 课程记录\n| 编号 | 课程 | 进度 | 停点 | 依据 |\n|---|---|---|---|---|\n| C002 | 老白分镜课 | 未知 | 待确认 | 隔离 |\n','运行记录/观影记录.md':'# 观影记录\n','运行记录/能力依据.md':'# 能力依据\n没有实际证据。\n'};
 for(const [rel,body] of Object.entries(files)){await fs.mkdir(path.dirname(path.join(root,rel)),{recursive:true});await fs.writeFile(path.join(root,rel),body);}
 for(const rel of ['运行约定.md','建设方案/学习判断契约.md']){await fs.mkdir(path.dirname(path.join(root,rel)),{recursive:true});await fs.copyFile(path.join(SOURCE,rel),path.join(root,rel));}
 await fs.cp(path.join(SOURCE,'.agents'),path.join(root,'.agents'),{recursive:true});
 return {root,repository:new LearningRepository({projectRoot:root,scope:'isolated'})};
}
function shared(text='最近一周希望每次先做二十分钟的小块。'){
 const source={id:'navigation-profile:corrected-001',title:'目前情况 · 本人更正',sourceKind:'personal_context',coverage:'record',path:null,documentHash:hashText(text),snapshot:'navigation-test@2',sourceDate:'2026-10-04',dateBasis:'本人补充日期',recordKind:'user_report',profileStatus:'current',targetId:'old-personal-item',authority:'本人自述',sourceRef:{system:'navigation',recordId:'corrected-001'},limitations:['旧日预算不是今天可用时长；不是本轮实际表现。'],content:JSON.stringify({originalText:text})};
 return {status:'available',replacesLocalProfile:true,identity:'navigation-test',revision:2,fingerprint:source.documentHash,sources:[source],warnings:[]};
}
test('最新共享更正替换旧背景进入实际上下文，保留日期和证据边界',async t=>{
 const f=await fixture(t),snapshot=await f.repository.snapshot();let calls=0;
 const result=await buildLearningContext({projectRoot:f.root,scope:'isolated',snapshot,task:null,payload:{mode:'plan',message:'今天只有十分钟，帮我安排一小步。'},sourceReader:reader,navigationContextReader:async()=>{calls++;return shared();},now});
 assert.equal(calls,1);assert.doesNotMatch(result.systemContext,/旧版每天安排两个小时/);assert.match(result.systemContext,/最近一周希望每次先做二十分钟/);assert.match(result.systemContext,/当前用户明确说出的时间/);
 assert.equal(result.contextSnapshot.sharedBackground.status,'available');assert.equal(result.sourceCoverage[0].sourceDate,'2026-10-04');assert.equal(result.sourceCoverage[0].sourceRef.recordId,'corrected-001');assert.equal(result.sourceCoverage[0].sourceKind,'personal_context');
});
test('普通解释和只留笔记不读取共享背景，读取失败透明沿本轮输入继续',async t=>{
 const f=await fixture(t),snapshot=await f.repository.snapshot();let calls=0;
 const nav=async()=>{calls++;throw new Error('bridge unavailable');};
 await buildLearningContext({projectRoot:f.root,scope:'isolated',snapshot,task:null,payload:{mode:'question',message:'为什么这句对白有潜台词？'},sourceReader:reader,navigationContextReader:nav,now});assert.equal(calls,0);
 const coordinator=new LearningCoordinator({projectRoot:f.root,scope:'isolated',sourceReader:reader,navigationContextReader:nav,now});
 const note=await coordinator.handle({mode:'chat',message:'老白第3课笔记：我还没理解视线关系，这次不要保存。',requestId:'shared-note-nosave-01',history:[],skipSave:true},{runModel:async()=> '先保留这个疑问。<learning_updates>{"version":1,"saveReason":"none","capture":{"kind":"none"}}</learning_updates>'});assert.equal(note.body.saved,false);assert.equal(calls,0);
 const result=await buildLearningContext({projectRoot:f.root,scope:'isolated',snapshot,task:null,payload:{mode:'plan',message:'今天十分钟，帮我安排一小步。'},sourceReader:reader,navigationContextReader:nav,now});assert.equal(calls,1);assert.equal(result.contextSnapshot.sharedBackground.status,'unavailable');assert.match(result.warnings.join(' '),/未能核对领航/);assert.match(result.systemContext,/没有核对领航中的后续更正/);
});
test('共享背景经协调器进入模型和保存来源；不能改旧任务目标或认证能力',async t=>{
 const f=await fixture(t);const task={taskId:'task-shared-existing',goalRevision:2,title:'动作衔接',purpose:'检查动作因果',courseId:'C002',allowedHelp:'AI只给提示',observationPoints:['动作连接清楚'],knownPerformance:'未知',stopPoint:'原停点',nextStep:'原下一步',status:'paused',evidenceRefs:[],candidates:[],updatedAt:'2026-10-04T01:00:00Z',lastRequestId:'seed-shared-task-01'};
 await fs.mkdir(path.join(f.root,'运行记录/学习记录'),{recursive:true});await fs.writeFile(path.join(f.root,'运行记录/学习记录/2026-10-04.md'),encodeTaskMetadata(task));let sent;
 const c=new LearningCoordinator({projectRoot:f.root,scope:'isolated',sourceReader:reader,navigationContextReader:async()=>shared(),now});
 const updates={version:1,saveReason:'plan',task:{title:'动作衔接',purpose:'错误地随领航改成求职',courseId:'C002',allowedHelp:'AI只给提示',observationPoints:task.observationPoints},facts:[],observations:[{text:'已经掌握',evidenceIds:['navigation-profile:corrected-001']}],candidates:[],adoptedChanges:[]};
 const response=await c.handle({requestId:'shared-plan-existing-01',mode:'plan',message:'今天只有十分钟，接着这项任务帮我安排一下。',history:[],context:{taskId:task.taskId}},{runModel:async messages=>{sent=messages;return '这次只观察一处动作连接。<learning_updates>'+JSON.stringify(updates)+'</learning_updates>';}});
 assert.equal(response.body.saved,true);assert.match(sent[0].content,/最近一周希望每次先做二十分钟/);assert.equal(response.body.task.purpose,task.purpose);assert.equal(response.body.task.goalRevision,task.goalRevision);assert.equal(response.body.task.knownPerformance,'未知');
 const journal=await c.committer.lookup('shared-plan-existing-01');assert.equal(journal.contextSnapshot.sharedBackground.revision,2);assert.equal(journal.sourceCoverage.find(s=>s.sourceKind==='personal_context').sourceDate,'2026-10-04');assert.doesNotMatch(await fs.readFile(path.join(f.root,'运行记录/能力依据.md'),'utf8'),/已经掌握/);
});
