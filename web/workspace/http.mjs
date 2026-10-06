import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { WorkspaceStore, WorkspaceError, DEFAULT_WORKSPACE_FILE } from './store.mjs';
import { createEntityCatalog } from './entities.mjs';

const source=path.dirname(fileURLToPath(import.meta.url)),preview=path.resolve(source,'../preview/public');
const allowed=new Set(['style.css','app.js','bridge.js','scene.js','observatory-polish.css','observatory-polish.js','information-polish.css','information-polish.js']);
const owned=new Set(['relations.js','relations.css','overview.js','overview.css']);
const headers=type=>({'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; media-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"});
const json=(res,status,data)=>{res.writeHead(status,headers('application/json; charset=utf-8'));res.end(JSON.stringify(data));};
async function body(req){if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']??''))throw new WorkspaceError('WORKSPACE_INVALID_INPUT','保存需要application/json。',415);let bytes=0,chunks=[];for await(const c of req){bytes+=c.length;if(bytes>1024*1024+8192)throw new WorkspaceError('WORKSPACE_TOO_LARGE','工作台请求超过限制。',413);chunks.push(c);}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new WorkspaceError('WORKSPACE_INVALID_INPUT','请求不是有效JSON。');}}
function shell(region,scope){const names={learning:'学习小岛',observatory:'素材观察室',information:'信息收集'};return `<header class="preview-header"><a class="preview-brand" href="/explore/"><span class="preview-mark" aria-hidden="true">⌂</span><span>小陌的个人空间<small>走走看看，再慢慢开始</small></span></a><nav class="preview-nav" aria-label="个人终端区域"><a href="/explore/">← 自由探索</a>${Object.entries(names).map(([id,label])=>`<a href="/${id}/?space=daily" data-preview-region-link="${id}"${region===id?' aria-current="page"':''}>${label}</a>`).join('')}</nav><div class="preview-actions"><button id="previewTools" type="button" aria-expanded="true">工作栏</button><span class="preview-badge">${scope==='isolated'?'隔离测试资料':'正式本机资料'}</span><a id="previewFormal" href="/${region}/">原页面</a></div></header><div class="preview-feedback" id="previewFeedback" role="status" hidden></div>`;}
export function decorateDaily(html,region,scope){if(!/<body\b[^>]*>/i.test(html))throw new Error('模块HTML不符合布局约定');const polish=region==='learning'?'':region+'-polish';if(!html.includes('/terminal/shell.js'))html=html.replace('</head>','<link rel="stylesheet" href="/terminal/shell.css"><script src="/terminal/shell.js" defer></script></head>');
 for(const module of ['learning','observatory','information'])html=html.replaceAll(`href="/${module}/"`,`href="/${module}/?space=daily"`);return html.replace('</head>',`<link rel="stylesheet" href="/workspace/style.css">${polish?`<link rel="stylesheet" href="/workspace/${polish}.css">`:''}<link rel="stylesheet" href="/workspace/relations.css"></head>`).replace(/<body\b([^>]*)>/i,(_match,attributes)=>`<body${attributes.replace(/\sdata-(?:preview-region|space-mode)=(["']).*?\1/gi,'')} data-preview-region="${region}" data-space-mode="${scope}">${shell(region,scope)}`).replace('</body>',`<script src="/workspace/bridge.js" defer></script>${polish?`<script src="/workspace/${polish}.js" defer></script>`:''}<script src="/workspace/relations.js" defer></script></body>`);}
export function createWorkspaceHandler({projectRoot,env,uiStore,informationManager}){
 const scope=env.WORKSPACE_MODE??env.LEARNING_UI_MODE??'production',token=randomUUID();
 const store=new WorkspaceStore({projectRoot,scope,stateFile:env.WORKSPACE_STATE_PATH??DEFAULT_WORKSPACE_FILE});
 const catalog=createEntityCatalog({projectRoot,uiStore,env,informationManager,scope});
 return async(req,res,url)=>{
  const p=url.pathname;
  if(req.method==='GET'&&p.startsWith('/workspace/')){const name=p.slice(11);if(!allowed.has(name)&&!owned.has(name))return false;try{let content=await fs.readFile(path.join(owned.has(name)?path.join(source,'public'):preview,name),'utf8');if(name==='app.js')content=content.replaceAll("'/preview/api/summary'","'/api/workspace/summary'");res.writeHead(200,headers(name.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8'));res.end(content);}catch{json(res,404,{ok:false,error:{code:'WORKSPACE_ASSET_MISSING',message:'工作台资源尚未就绪。'}});}return true;}
  if(req.method==='GET'&&['/explore','/explore/'].includes(p)){let html=await fs.readFile(path.join(preview,'index.html'),'utf8');html=html.replaceAll('/preview/','/workspace/').replaceAll('href="/workspace/"','href="/explore/"').replace('class="explore-body"',`class="explore-body" data-space-mode="${scope}"`).replace('界面预览',scope==='isolated'?'隔离测试资料':'正式本机资料').replace('http://127.0.0.1:8787/','/').replace('正式使用 ↗','原页面').replace('</head>','<link rel="stylesheet" href="/workspace/overview.css"><link rel="stylesheet" href="/terminal/shell.css"><script src="/terminal/shell.js" defer></script></head>').replace('</body>','<script src="/workspace/overview.js" defer></script></body>').replace('aria-label="个人终端区域"','aria-label="个人空间入口"').replace('</nav><div class="preview-actions">','<a href="/navigation/">领航室</a></nav><div class="preview-actions">');for(const region of ['learning','observatory','information'])html=html.replaceAll(`href="/${region}/"`,`href="/${region}/?space=daily"`);res.writeHead(200,headers('text/html; charset=utf-8'));res.end(html);return true;}
  if(req.method==='GET'&&url.searchParams.get('space')==='daily'&&/^\/(learning|observatory|information)\/(?:index.html)?$/.test(p)){const region=p.split('/')[1],file=region==='information'?path.join(path.dirname(path.dirname(informationManager.status().databasePath)),'static/index.html'):path.join(projectRoot,'web/public',region,'index.html');const html=await fs.readFile(file,'utf8');if(region==='information')await informationManager.verify();res.writeHead(200,headers('text/html; charset=utf-8'));res.end(decorateDaily(html,region,scope));return true;}
  if(!p.startsWith('/api/workspace/'))return false;
  try{
   const route=p.slice(15);let result;
   if(req.method==='GET'&&route==='summary'){const r=await catalog.list();json(res,200,{ok:true,materials:r.items.filter(x=>x.ref.kind==='material').length,opportunities:r.items.filter(x=>x.ref.kind==='opportunity').length,errors:r.errors});return true;}
   if(req.method==='GET'&&route==='catalog')result=await catalog.list({query:url.searchParams.get('query')??'',kind:url.searchParams.get('kind')??''});
   else if(req.method==='GET'&&route==='bootstrap')result={...await store.read(),token,scope};
   else if(req.method==='GET'&&route==='relations'){
    const ref=Object.fromEntries(['module','kind','storeId','id'].map(k=>[k,url.searchParams.get(k)]));const r=await store.listRelations(ref);
    result={...r,ref,relations:await Promise.all(r.relations.map(async edge=>{const otherRef=edge.other;try{return{edgeId:edge.edgeId,otherRef,...await catalog.resolve(otherRef)};}catch(e){return{edgeId:edge.edgeId,otherRef,title:'区域暂不可用 · '+otherRef.id,href:null,availability:'missing',currentRevision:null,kindLabel:otherRef.kind};}}))};
   }else if(req.method==='POST'&&['action','state'].includes(route)){
    const count=req.rawHeaders.filter((_,i)=>i%2===0&&req.rawHeaders[i].toLowerCase()==='x-workspace-token').length;
    if(count!==1||req.headers['x-workspace-token']!==token)throw new WorkspaceError('WORKSPACE_ACCESS_DENIED','工作台令牌过期，请重读。',403);
    const input=await body(req);
    if(route==='action'){result=await store.apply(input,{validateNewLink:async refs=>{await catalog.resolve(refs.a,{required:true});await catalog.resolve(refs.b,{required:true});}});}
    else result=await store.saveState(input);
   }else throw new WorkspaceError('WORKSPACE_NOT_FOUND','工作台接口不存在。',404);
   json(res,200,{ok:true,data:result});
  }catch(e){json(res,e.status??503,{ok:false,error:{code:e.code??'WORKSPACE_UNAVAILABLE',message:e.message,retryable:!!e.retryable,details:e.details??{}}});}return true;
 };
}
