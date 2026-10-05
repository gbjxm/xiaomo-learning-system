import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';

const PROJECT_ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','..');
export class InformationError extends Error{constructor(code,message,status=503){super(message);this.code=code;this.status=status;}}
const fail=(...args)=>{throw new InformationError(...args);};
function inside(child,parent){const r=path.relative(parent,child);return !!r&&r!=='..'&&!r.startsWith(`..${path.sep}`)&&!path.isAbsolute(r);}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function requestJSON(port,pathname,{method='GET',body,token,timeout=2500,maxBytes=16384}={}){return new Promise((resolve,reject)=>{const data=body===undefined?undefined:Buffer.from(JSON.stringify(body));const req=http.request({agent:false,hostname:'127.0.0.1',port,path:pathname,method,headers:{Host:`127.0.0.1:${port}`,...(data?{'Content-Type':'application/json','Content-Length':data.length}:{}),...(token?{'X-Local-Token':token}:{})}},res=>{const chunks=[];let bytes=0;res.on('data',c=>{bytes+=c.length;if(bytes>maxBytes){res.destroy();reject(new InformationError('INFORMATION_IDENTITY_INVALID','信息服务身份响应异常过大。'));}else chunks.push(c);});res.on('end',()=>{try{resolve({status:res.statusCode,body:JSON.parse(Buffer.concat(chunks).toString('utf8'))});}catch{reject(new InformationError('INFORMATION_IDENTITY_INVALID','端口响应不是可识别的信息库身份。'));}});res.on('error',reject);});req.setTimeout(timeout,()=>req.destroy(new InformationError('INFORMATION_TIMEOUT','信息服务响应超时。')));req.on('error',reject);req.end(data);});}
export function createInformationManager({root=path.join(PROJECT_ROOT,'信息收集'),port=8765,scope='production',spawnImpl=spawn}={}){
 const informationRoot=path.resolve(root);if(!Number.isInteger(port)||port<1024||port>65535)fail('INFORMATION_CONFIG_INVALID','信息服务端口无效。');
 if(scope==='production'&&informationRoot!==path.join(PROJECT_ROOT,'信息收集'))fail('INFORMATION_CONFIG_INVALID','正式信息服务须使用已有固定目录。');
 if(scope==='isolated'&&!inside(informationRoot,path.join(PROJECT_ROOT,'验证','三系统整合')))fail('INFORMATION_CONFIG_INVALID','隔离信息根目录须在本轮验证目录内。');
 if(!['production','isolated'].includes(scope))fail('INFORMATION_CONFIG_INVALID','信息服务运行范围无效。');
 const databasePath=path.join(informationRoot,'data','opportunities.sqlite3');let owned;let starting;let state={status:'not_started',ownership:'none',port,databasePath,scope};
 function expected(){if(!fs.existsSync(databasePath)||!fs.statSync(databasePath).isFile())fail('INFORMATION_DATABASE_MISSING','原信息数据库不存在，统一应用不会静默创建空库。');const actual=fs.realpathSync(databasePath);return{databasePath:actual,marker:createHash('sha256').update(actual).digest('hex').slice(0,16)};}
 async function verify(){const wanted=expected();let health;try{health=await requestJSON(port,'/api/health');}catch(e){if(e.code==='ECONNREFUSED')fail('INFORMATION_NOT_RUNNING','信息服务尚未启动。');throw e;}if(health.status!==200||health.body.app!=='xiaomo-opportunities'||health.body.marker!==wanted.marker||health.body.local_only!==true)fail('INFORMATION_IDENTITY_MISMATCH','信息端口不是本项目的指定数据库，已拒绝代理及复用。',409);state={...state,status:'ready',ownership:owned?'owned':'reused',...wanted,app:health.body.app};return state;}
 async function ensureStarted(){if(starting)return starting;starting=(async()=>{try{return await verify();}catch(e){if(e.code!=='INFORMATION_NOT_RUNNING')throw e;}expected();const worker=fileURLToPath(new URL('./information-worker.py',import.meta.url));owned=spawnImpl('python',['-X','utf8',worker,'--root',informationRoot,'--port',String(port)],{cwd:informationRoot,windowsHide:true,shell:false,stdio:['ignore','pipe','pipe']});let output='';owned.stdout.on('data',c=>{output=(output+c.toString('utf8')).slice(-16000);});owned.stderr.on('data',c=>{output=(output+c.toString('utf8')).slice(-16000);});let startError;owned.once('error',e=>{startError=e;});const child=owned;child.once('exit',()=>{if(owned===child){owned=null;state={...state,status:'stopped',ownership:'none'};}});for(let i=0;i<40;i++){if(startError||child.exitCode!==null)fail('INFORMATION_START_FAILED','信息服务没有启动；保留其他模块使用。'+(startError?' Python不可用。':''));try{const ready=await verify();state={...ready,pid:child.pid};return state;}catch(e){if(e.code!=='INFORMATION_NOT_RUNNING')throw e;}await sleep(150);}fail('INFORMATION_START_TIMEOUT','信息服务启动未完成，其他模块可继续使用。');})();try{return await starting;}catch(e){state={...state,status:'error',error:{code:e.code??'INFORMATION_START_FAILED',message:e.message}};if(owned){owned.kill();owned=null;}throw e;}finally{starting=null;}}
 async function stopOwned(){
  const child=owned;
  if(!child)return{stopped:false,ownership:state.ownership,reason:'已有或未知信息服务不由统一应用停止'};
  let graceful=true,stopError;
  try{await verify();const boot=await requestJSON(port,'/api/state',{maxBytes:8*1024*1024});if(boot.status!==200||typeof boot.body.token!=='string')fail('INFORMATION_STOP_UNVERIFIED','无法确认已启动子服务的停止凭证。');await requestJSON(port,'/api/stop',{method:'POST',body:{},token:boot.body.token,timeout:4000});}
  catch(e){graceful=false;stopError={code:e.code??'INFORMATION_STOP_FAILED',message:e.message};}
  for(let i=0;i<30&&child.exitCode===null&&graceful;i++)await sleep(100);
  // This is the exact spawn handle owned by this host, never a port-derived PID.
  // If identity changed, do not POST stop to that port; only terminate our child.
  if(child.exitCode===null){graceful=false;child.kill();for(let i=0;i<20&&child.exitCode===null;i++)await sleep(50);}
  owned=null;state={...state,status:'stopped',ownership:'none'};
  return{stopped:true,ownership:'owned',graceful,...(stopError?{error:stopError}:{})};
 }
 async function proxy(req,res,pathname,search=''){
   await verify();if(!['GET','POST','HEAD'].includes(req.method))fail('INFORMATION_METHOD_REJECTED','不支持的信息接口方法。',405);if(!pathname.startsWith('/information/'))fail('INFORMATION_PATH_REJECTED','信息请求前缀不正确。',400);
   const target=pathname.slice('/information'.length)+search;if(!target.startsWith('/')||target.startsWith('//')||/[\x00-\x1f\\]/.test(target))fail('INFORMATION_PATH_REJECTED','信息代理路径不合法。',400);
   const maxRequest=96*1024*1024,maxResponse=256*1024*1024;const length=req.headers['content-length'];if(length!==undefined&&(!/^\d+$/.test(length)||Number(length)>maxRequest))fail('INFORMATION_PAYLOAD_TOO_LARGE','信息请求超过96MiB限制。',413);
   const upstreamHeaders={Host:`127.0.0.1:${port}`};for(const name of ['content-type','content-length','x-local-token','range','accept','if-none-match'])if(req.headers[name]!==undefined)upstreamHeaders[name]=req.headers[name];if(req.headers.origin)upstreamHeaders.Origin=`http://127.0.0.1:${port}`;
   await new Promise((resolve,reject)=>{const upstream=http.request({agent:false,hostname:'127.0.0.1',port,path:target,method:req.method,headers:upstreamHeaders},async response=>{try{const declared=Number(response.headers['content-length']??0);if(declared>maxResponse){response.destroy();throw new InformationError('INFORMATION_RESPONSE_TOO_LARGE','信息下载超过256MiB限制。',502);}const h={};for(const name of ['content-type','content-length','content-disposition','cache-control','x-content-type-options','referrer-policy','cross-origin-resource-policy','cross-origin-opener-policy','content-security-policy','accept-ranges','content-range','etag','retry-after'])if(response.headers[name]!==undefined)h[name]=response.headers[name];res.writeHead(response.statusCode??502,h);let received=0;const counter=new Transform({transform(c,e,cb){received+=c.length;cb(received>maxResponse?new InformationError('INFORMATION_RESPONSE_TOO_LARGE','信息下载超过256MiB限制。',502):null,c);}});await pipeline(response,counter,res);resolve();}catch(e){upstream.destroy();reject(e);}});let total=0;const count=new Transform({transform(c,e,cb){total+=c.length;cb(total>maxRequest?new InformationError('INFORMATION_PAYLOAD_TOO_LARGE','信息请求超过96MiB限制。',413):null,c);}});const timer=setTimeout(()=>upstream.destroy(new InformationError('INFORMATION_TIMEOUT','信息请求总耗时超过120秒，提交结果未确认。',504)),120000);upstream.setTimeout(15000,()=>upstream.destroy(new InformationError('INFORMATION_TIMEOUT','信息服务连续15秒无响应，提交结果未确认。',504)));const done=()=>clearTimeout(timer);upstream.on('error',e=>{done();reject(e);});upstream.on('close',done);res.on('close',()=>{if(!res.writableFinished)upstream.destroy();});pipeline(req,count,upstream).catch(e=>{upstream.destroy();reject(e);});});
 }
 async function read(route){
  if(!/^\/api\/(?:state|works|search(?:\?q=[^#]*&history=0)?)$/.test(route))fail('INFORMATION_PATH_REJECTED','工作台只读接口不受支持。',400);
  await verify();const r=await requestJSON(port,route,{maxBytes:12*1024*1024,timeout:8000});
  if(r.status!==200)fail('INFORMATION_READ_FAILED','信息区域读取未完成。',r.status);return r.body;
 }
 return{verify,ensureStarted,stopOwned,proxy,read,status:()=>({...state}),expected};
}
