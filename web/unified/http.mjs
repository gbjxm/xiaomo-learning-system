import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { UIStateStore, UIError, UI_MAX_BYTES, DEFAULT_UI_FILE } from './ui-state.mjs';

const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2','.glb':'model/gltf-binary','.gltf':'model/gltf+json','.mp3':'audio/mpeg','.wav':'audio/wav'};
function headers(type){return{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; media-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"};}
function json(res,status,body){res.writeHead(status,headers('application/json; charset=utf-8'));res.end(JSON.stringify(body));}
async function bodyJSON(req){if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']??''))throw new UIError('INVALID_UI_REQUEST','请提供application/json。');const chunks=[];let n=0;for await(const c of req){n+=c.length;if(n>UI_MAX_BYTES+4096)throw new UIError('UI_STATE_TOO_LARGE','界面请求超过限制。',413);chunks.push(c);}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new UIError('INVALID_UI_REQUEST','请求不是有效JSON。');}}
function inside(child,parent){const r=path.relative(parent,child);return !!r&&r!=='..'&&!r.startsWith(`..${path.sep}`)&&!path.isAbsolute(r);}
export function createUnifiedHandler({projectRoot,env,informationManager,onStop}={}){
 const token=randomUUID();let store;let error;const appId='xiaomo-personal-unified';
 try{store=new UIStateStore({projectRoot,stateFile:env.LEARNING_UI_STATE_PATH??DEFAULT_UI_FILE,scope:env.LEARNING_UI_MODE??'production'});}catch(e){error=e;}
 return async function handle(req,res,url){
  const pathname=url.pathname;
  if(req.method==='GET'&&['/','/index.html','/learning','/information'].includes(pathname)){res.writeHead(302,{Location:pathname==='/information'?'/information/':'/learning/','Cache-Control':'no-store'});res.end();return true;}
  if(pathname.startsWith('/learning/')&&req.method==='GET'){
   try{const relative=decodeURIComponent(pathname.slice(10))||'index.html';if(relative.includes('\\')||relative.includes('\0')||relative.split('/').some(p=>p==='..'||p==='.')||(!relative.endsWith('.html')&&!Object.hasOwn(TYPES,path.extname(relative))))throw new UIError('NOT_FOUND','页面资源不存在。',404);if(relative.endsWith('.html')&&relative!=='index.html')throw new UIError('NOT_FOUND','页面资源不存在。',404);const root=path.join(projectRoot,'web','public','learning');const requested=path.resolve(root,relative);const actual=await fs.realpath(requested);if(!inside(actual,await fs.realpath(root)))throw new UIError('NOT_FOUND','资源路径不受支持。',404);const content=await fs.readFile(actual);res.writeHead(200,headers(TYPES[path.extname(relative)]));res.end(content);}catch(e){json(res,e.status??404,{ok:false,error:{code:e.code??'NOT_FOUND',message:'学习小岛资源尚不可用。',retryable:false,details:{}}});}return true;
  }
  if(pathname.startsWith('/information/')){try{await informationManager.proxy(req,res,pathname,url.search);}catch(e){if(!res.headersSent)json(res,e.status??503,{ok:false,error:{code:e.code??'INFORMATION_UNAVAILABLE',message:e.message,retryable:true,details:{}}});else res.destroy();}return true;}
  if(req.method==='GET'&&pathname==='/api/app/bootstrap'){json(res,200,{ok:true,data:{app:appId,projectRoot,pid:process.pid,token,information:informationManager.status()}});return true;}
  if(req.method==='POST'&&pathname==='/api/app/stop'){try{if(req.headers['x-learning-token']!==token)throw new UIError('ACCESS_DENIED','应用停止凭证过期。',403);const body=await bodyJSON(req);if(body.confirmation!=='stop-local-app')throw new UIError('INVALID_UI_REQUEST','需要明确停止本机应用。');json(res,200,{ok:true,data:{stopping:true}});setTimeout(()=>onStop?.(),30);}catch(e){json(res,e.status??500,{ok:false,error:{code:e.code??'APP_STOP_FAILED',message:e.message,retryable:false,details:{}}});}return true;}
  if(!['/api/learning/ui-state','/api/learning/ui-state/init'].includes(pathname))return false;
  try{if(error)throw error;let result;if(req.method==='GET'&&pathname==='/api/learning/ui-state'){const r=await store.read();result={identity:store.identity(r),revision:r.revision,state:r.state,exists:true};}
   else if(req.method==='POST'){if(req.headers['x-learning-token']!==token)throw new UIError('ACCESS_DENIED','界面保存凭证过期，请重新读取状态。',403);const input=await bodyJSON(req);if(pathname.endsWith('/init')){if(!input||Object.keys(input).some(k=>k!=='state'))throw new UIError('INVALID_UI_REQUEST','初始化只接受state。');result=await store.initialize(input.state);}else result=await store.write(input);}
   else throw new UIError('METHOD_NOT_ALLOWED','界面状态只支持GET/POST。',405);
   json(res,200,{ok:true,data:{...result,token}});
  }catch(e){json(res,e.status??500,{ok:false,error:{code:e.code??'UI_STORAGE_ERROR',message:e.message,retryable:!!e.retryable,details:{...(e.details??{}),...(e.code==='UI_STATE_MISSING'?{token}:{})}}});}return true;
 };
}
