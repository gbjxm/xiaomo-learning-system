import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createLearningServer } from '../server.mjs';
import { ContentStore } from '../content/store.mjs';
import { LearningCommitter } from '../learning/commit.mjs';

const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const fixtureParent=path.join(project,'验证/三系统整合');
const navigationSource='D:/codex/2026-10-03/new-chat/outputs/小陌的领航室';
const sha=value=>createHash('sha256').update(value).digest('hex');
const run=promisify(execFile);
async function hashTree(root){
  const values={};
  async function walk(folder){for(const entry of await fs.readdir(folder,{withFileTypes:true})){const file=path.join(folder,entry.name);if(entry.isDirectory())await walk(file);else if(entry.isFile())values[path.relative(root,file).replaceAll('\\','/')]=sha(await fs.readFile(file));}}
  await walk(root);return values;
}
async function fixture(t,{unavailableNavigation=false}={}){
  const root=path.join(fixtureParent,'content-host-'+randomUUID()),navigationRoot=path.join(root,'领航室');
  await fs.mkdir(navigationRoot,{recursive:true});
  t.after(async()=>{
    const actual=await fs.realpath(root),allowed=await fs.realpath(fixtureParent),relative=path.relative(allowed,actual);
    assert.ok(relative.startsWith('content-host-')&&!relative.includes(path.sep),'fixture cleanup stays in exact isolated root');
    await fs.rm(actual,{recursive:true});
  });
  for(const name of ['tools','方法','.agents','00_开始这里.md','当前处境.md','人生罗盘.md','系统约定.md','核心架构.md','connections.json','状态/领航状态.json','依据']){
    const target=path.join(navigationRoot,name);await fs.mkdir(path.dirname(target),{recursive:true});await fs.cp(path.join(navigationSource,name),target,{recursive:true});
  }
  await fs.cp(path.join(project,'运行记录'),path.join(root,'运行记录'),{recursive:true});
  await fs.cp(path.join(project,'web/public/learning/content'),path.join(root,'web/public/learning/content'),{recursive:true});
  await fs.writeFile(path.join(root,'AGENTS.md'),'PRIVATE_FIXTURE_MARKER_873149');
  const env={WORKSPACE_MODE:'isolated',LEARNING_UI_MODE:'isolated',NAVIGATION_ROOT:unavailableNavigation?path.join(root,'missing-navigation'):navigationRoot,
    LEARNING_UI_STATE_PATH:path.join(root,'学习小岛/data/ui-state.json'),WORKSPACE_STATE_PATH:path.join(root,'三系统工作台/data/workspace-state.json')};
  const modelCalls=[];
  const server=createLearningServer({projectRoot:root,learningScope:'isolated',env,
    informationOptions:{root:path.join(root,'信息收集'),scope:'isolated',port:28765},
    providerAdapter:{kind:'mock',async complete(){modelCalls.push('unexpected');throw new Error('These tests must not call a model.');}}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  t.after(async()=>{server.closeAllConnections?.();await new Promise(resolve=>server.close(resolve));assert.equal(modelCalls.length,0);});
  async function request(route,{method='GET',body,token,headers={}}={}){
    const response=await fetch(origin+route,{method,headers:{Origin:origin,...(body===undefined?{}:{'Content-Type':'application/json'}),...(token?{'X-Content-Token':token}:{}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)}),redirect:'manual'});
    const text=await response.text();let data;try{data=JSON.parse(text);}catch{}return {status:response.status,headers:response.headers,text,data};
  }
  return {root,navigationRoot,origin,request,server,modelCalls};
}
async function bootstrap(f){const result=await f.request('/api/learning/content/bootstrap');assert.equal(result.status,200,result.text);assert.equal(typeof result.data.token,'string');assert.equal(typeof result.data.identity,'string');return result.data;}
const saveRequest=(boot,item,extra={})=>({identity:boot.identity,expectedRevision:boot.revision,submissionId:'host_'+randomUUID(),item,...extra});
async function rawRequest(origin,pathname,headers){const url=new URL(origin);return new Promise((resolve,reject)=>{const req=http.request({hostname:url.hostname,port:url.port,path:pathname,headers},res=>{let text='';res.on('data',chunk=>text+=chunk);res.on('end',()=>resolve({status:res.statusCode,text}));});req.on('error',reject);req.end();});}

test('host serves shared content page and bootstrap without initializing or writing records',async t=>{
  const f=await fixture(t),before=await hashTree(f.root);
  for(const route of ['/learning/content/','/learning/content/app.js','/learning/content/style.css']){
    const result=await f.request(route);assert.equal(result.status,200,result.text);assert.equal(result.headers.get('x-content-type-options'),'nosniff');assert.match(result.headers.get('content-security-policy'),/script-src 'self'/);
  }
  const boot=await bootstrap(f);assert.ok(boot.items.length>=4);
  assert.deepEqual(await hashTree(f.root),before);
  await assert.rejects(fs.stat(path.join(f.root,'运行记录/我的内容')),{code:'ENOENT'});
  await assert.rejects(fs.stat(path.join(f.root,'学习小岛/data/ui-state.json')),{code:'ENOENT'});
});

test('host combines four original watch rows with read-only navigation ideas, excludes life entries',async t=>{
  const f=await fixture(t),before=await hashTree(f.root),boot=await bootstrap(f);
  assert.deepEqual(boot.items.filter(item=>/^W\d+$/.test(item.id)).map(item=>item.id).sort(),['W001','W002','W003','W004']);
  for(const item of boot.items.filter(item=>/^W\d+$/.test(item.id)))assert.equal(item.date,null);
  const ideas=boot.items.filter(item=>item.source?.kind==='navigation-idea');assert.ok(ideas.length>0,'original saved idea is projected');
  assert.ok(ideas.every(item=>item.readOnly&&item.kind==='creation'));
  assert.ok(ideas.some(item=>item.date==='2026-09-10'));
  assert.ok(!ideas.some(item=>/科目四|朋友游戏|生活记录与反思/.test(item.title)));
  const detail=await f.request('/api/learning/content/items/'+encodeURIComponent(ideas[0].id));assert.equal(detail.status,200,detail.text);assert.equal(detail.data.item.id,ideas[0].id);assert.ok(detail.data.item.body.length>=ideas[0].body.length);assert.equal(detail.data.item.readOnly,true);
  assert.deepEqual(await hashTree(f.root),before);
});

test('host requires content token, performs CAS and reads back same-ID updates and retries',async t=>{
  const f=await fixture(t),boot=await bootstrap(f),beforeWatch=await fs.readFile(path.join(f.root,'运行记录/观影记录.md'),'utf8'),beforeNavigation=await hashTree(f.navigationRoot);
  const request=saveRequest(boot,{kind:'watch',title:'隔离测试片名',body:'',date:null,watch:{status:'unknown',progress:''}});
  assert.equal((await f.request('/api/learning/content/save',{method:'POST',body:request})).status,403);
  const first=await f.request('/api/learning/content/save',{method:'POST',token:boot.token,body:request});assert.equal(first.status,200,first.text);assert.equal(first.data.item.id,'W005');assert.equal(first.data.item.date,null);assert.equal(first.data.item.watch.status,'unknown');
  const retry=await f.request('/api/learning/content/save',{method:'POST',token:boot.token,body:request});assert.equal(retry.status,200,retry.text);assert.equal(retry.data.duplicate,true);
  const stale=await f.request('/api/learning/content/save',{method:'POST',token:boot.token,body:saveRequest(boot,{kind:'creation',title:'冲突时保留原稿',body:'',date:null})});assert.equal(stale.status,409);assert.equal(stale.data.error.code,'CONTENT_REVISION_CONFLICT');
  const update=saveRequest({...boot,revision:first.data.revision},{id:'W005',kind:'watch',title:'隔离测试片名',body:'  追加本人原话  ',date:null,watch:{status:'unknown',progress:''}});
  const saved=await f.request('/api/learning/content/save',{method:'POST',token:boot.token,body:update});assert.equal(saved.status,200,saved.text);
  const detail=await f.request('/api/learning/content/items/W005');assert.equal(detail.data.item.body,'  追加本人原话  ');assert.equal(detail.data.item.history.length,2);
  assert.ok((await fs.readFile(path.join(f.root,'运行记录/观影记录.md'),'utf8')).startsWith(beforeWatch));
  assert.deepEqual(await hashTree(f.navigationRoot),beforeNavigation);
});

test('host denies traversal and foreign Host/Origin before exposing content data',async t=>{
  const f=await fixture(t),before=await hashTree(f.root);
  for(const route of ['/learning/content/..%5c..%5c..%5cAGENTS.md','/learning/content/%2e%2e%2f%2e%2e%2fAGENTS.md','/learning/content/%00index.html','/api/learning/content/items/%2e%2e%2fAGENTS.md']){
    const result=await f.request(route);assert.ok(result.status>=400,route+': '+result.text);assert.doesNotMatch(result.text,/PRIVATE_FIXTURE_MARKER_873149/);
  }
  assert.equal((await f.request('/api/learning/content/bootstrap',{headers:{Origin:'https://foreign.example'}})).status,403);
  assert.equal((await rawRequest(f.origin,'/api/learning/content/bootstrap',['Host','foreign.example'])).status,403);
  const host=new URL(f.origin).host;assert.equal((await rawRequest(f.origin,'/api/learning/content/bootstrap',['Host',host,'Host',host])).status,403);
  assert.deepEqual(await hashTree(f.root),before);
});

test('unavailable external idea source warns while local viewing and creation remain usable',async t=>{
  const f=await fixture(t,{unavailableNavigation:true}),boot=await bootstrap(f);
  assert.equal(boot.items.filter(item=>item.kind==='watch').length,4);assert.ok(boot.warnings.some(warning=>/领航.*暂未读到/.test(warning.message??warning)));
  const result=await f.request('/api/learning/content/save',{method:'POST',token:boot.token,body:saveRequest(boot,{kind:'creation',title:'本地仍可保存',body:'只在测试副本',date:null})});assert.equal(result.status,200,result.text);
  const list=await f.request('/api/learning/content/items?kind=creation');assert.equal(list.status,200,list.text);assert.ok(list.data.items.some(item=>item.id===result.data.item.id));assert.ok(list.data.warnings.length>0);
});

test('content saves wait for the original LearningCommitter lock and use its owner format',async t=>{
  const f=await fixture(t,{unavailableNavigation:true}),store=new ContentStore({projectRoot:f.root,scope:'isolated'}),boot=await store.bootstrap();
  let entered,unblock;const acquired=new Promise(resolve=>entered=resolve),gate=new Promise(resolve=>unblock=resolve);
  const committer=new LearningCommitter({projectRoot:f.root,scope:'isolated',faultInjector:async point=>{if(point==='after_lock_publish:.lock'){entered();await gate;}}});
  const journal=committer.recordModelResult({payload:{requestId:'lock_'+randomUUID(),mode:'chat',message:'隔离提交锁检查',history:[]},reply:'固定测试数据，没有调用模型',kind:'reflection'});
  await acquired;
  const owner=JSON.parse(await fs.readFile(path.join(f.root,'运行记录/.学习提交/.lock'),'utf8'));assert.equal(owner.pid,process.pid);assert.equal(typeof owner.token,'string');assert.match(owner.ownerName,/^\.owner_/);
  let completed=false;const save=store.save(saveRequest(boot,{kind:'creation',title:'等待锁',body:'隔离原稿',date:null})).then(value=>{completed=true;return value;});
  await new Promise(resolve=>setTimeout(resolve,80));assert.equal(completed,false,'content must not bypass the existing committer lock');
  unblock();await journal;assert.equal((await save).saved,true);
  await assert.rejects(fs.stat(path.join(f.root,'运行记录/.学习提交/.lock')),{code:'ENOENT'});
});

test('CLI uses the same read-only navigation projection and ignores inherited navigation root',async t=>{
  const f=await fixture(t),cli=fileURLToPath(new URL('../content/cli.mjs',import.meta.url));
  await fs.writeFile(path.join(f.root,'navigation-connection.json'),JSON.stringify({schemaVersion:1,navigationRoot:f.navigationRoot}));
  const before=await hashTree(f.root),env={...process.env,NAVIGATION_ROOT:navigationSource,WORKSPACE_MODE:'production'};
  const args=['--root',f.root,'--scope','isolated'];
  const boot=JSON.parse((await run(process.execPath,[cli,'bootstrap',...args],{env})).stdout);
  const ideas=boot.items.filter(item=>item.source?.kind==='navigation-idea');assert.ok(ideas.length>0);assert.ok(ideas.every(item=>item.readOnly));
  const listed=JSON.parse((await run(process.execPath,[cli,'list',...args,'--kind','creation'],{env})).stdout);assert.ok(listed.items.some(item=>item.id===ideas[0].id));
  const detail=JSON.parse((await run(process.execPath,[cli,'detail',...args,'--id',ideas[0].id],{env})).stdout);assert.equal(detail.item.id,ideas[0].id);assert.equal(detail.item.readOnly,true);assert.ok(detail.item.body.length>=ideas[0].body.length);
  assert.deepEqual(await hashTree(f.root),before);
  // A config inside the fixture cannot authorize reading the real navigation root.
  await fs.writeFile(path.join(f.root,'navigation-connection.json'),JSON.stringify({schemaVersion:1,navigationRoot:navigationSource}));
  const denied=JSON.parse((await run(process.execPath,[cli,'list',...args],{env})).stdout);assert.ok(!denied.items.some(item=>item.source?.kind==='navigation-idea'));assert.ok(denied.warnings.some(item=>/领航.*暂未读到/.test(item.message??item)));assert.equal(denied.items.filter(item=>item.kind==='watch').length,4);
});
