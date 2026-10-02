import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { ObservatoryStore, DEFAULT_DATA_DIR, ISOLATION_ROOT, PROJECT_ROOT, resolveDataDir } from './store.mjs';
import { executeForHttp, HTTP_STATUS_BY_CODE } from './api.mjs';
import { ObservatoryError, fail, object, id } from './model.mjs';
import { handoff } from './cli.mjs';

const STATIC = new Map([['/observatory/', ['index.html', 'text/html; charset=utf-8']], ['/observatory/index.html', ['index.html', 'text/html; charset=utf-8']], ['/observatory/app.css', ['app.css', 'text/css; charset=utf-8']], ['/observatory/app.js', ['app.js', 'text/javascript; charset=utf-8']]]);
function headers(type) { return { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; media-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; object-src 'none'" }; }
function json(res, status, body, extra = {}) { res.writeHead(status, { ...headers('application/json; charset=utf-8'), ...extra }); res.end(JSON.stringify(body)); }
async function readJson(req) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] ?? '')) fail('INVALID_INPUT', '观察室写入需要 application/json。');
  const chunks = []; let total = 0;
  for await (const chunk of req) { total += chunk.length; if (total > 8 * 1024 * 1024) fail('PAYLOAD_TOO_LARGE', '研究提交超过 8 MiB；保存为结构化文件后用 CLI 分阶段提交。'); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { fail('INVALID_INPUT', '请求不是有效的 UTF-8 JSON。'); }
}
function within(child, root) { const relative = path.relative(root, child); return relative && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative); }
function same(a,b) { return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b; }

export function createObservatoryHandler({ projectRoot = PROJECT_ROOT, env = process.env } = {}) {
  const token = randomUUID(); let configurationError; let store; let mode;
  try {
    mode = env.OBSERVATORY_MODE ?? 'production';
    const dataDir = resolveDataDir(env.OBSERVATORY_DATA_DIR ?? DEFAULT_DATA_DIR);
    if (mode === 'production' && !same(dataDir, DEFAULT_DATA_DIR)) fail('INVALID_DATA_PATH', '正式模式只允许固定正式数据目录；隔离验收须 OBSERVATORY_MODE=isolated。');
    if (mode === 'isolated' && !within(dataDir, ISOLATION_ROOT)) fail('INVALID_DATA_PATH', '隔离数据必须在 验证/素材观察室 内。');
    if (!['production','isolated'].includes(mode)) fail('INVALID_INPUT', 'OBSERVATORY_MODE 只允许 production 或 isolated。');
    store = new ObservatoryStore({ dataDir });
  } catch (error) { configurationError = error; }
  async function identity() {
    if (configurationError) throw configurationError;
    const actual = await store.identity();
    if ((mode === 'production' && actual.scope !== 'production') || (mode === 'isolated' && !['isolated','demo'].includes(actual.scope))) fail('STORE_IDENTITY_MISMATCH', '服务模式与数据库身份范围不同，停止观察室操作。');
    return actual;
  }
  return async function handle(req, res, url) {
    const pathname = url.pathname;
    if (pathname === '/observatory' && req.method === 'GET') { res.writeHead(302,{Location:'/observatory/'});res.end();return true; }
    if (STATIC.has(pathname) && req.method === 'GET') {
      const [name,type] = STATIC.get(pathname); const filename = path.join(projectRoot,'web','public','observatory',name);
      try { const content=fs.readFileSync(filename);res.writeHead(200,headers(type));res.end(content); } catch { if (!res.headersSent) json(res,404,{ok:false,error:{code:'NOT_FOUND',message:'页面文件尚未就绪。',retryable:false,details:{}}});else res.end(); }
      return true;
    }
    if (!pathname.startsWith('/api/observatory/')) return false;
    try {
      const actual = await identity();
      if (req.method === 'POST' && req.headers['x-observatory-token'] !== token) fail('ACCESS_DENIED','当前页面令牌缺失或已过期，请重新加载页面后再提交。');
      const route = pathname.slice('/api/observatory/'.length);
      if (req.method === 'GET' && route === 'bootstrap') {
        const { UPLOAD_LIMITS } = await import('./attachments.mjs');
        json(res,200,{ok:true,data:{identity:actual,token,limits:UPLOAD_LIMITS,attachmentsDir:path.join(path.dirname(store.dataDir),'attachments'),mode}}); return true;
      }
      if (req.method === 'GET' && route === 'identity') {json(res,200,{ok:true,data:actual});return true;}
      if (req.method === 'POST' && route === 'action') {
        const body = object(await readJson(req),'request',['action','input']);
        if (body.action === 'register-attachment') fail('ACCESS_DENIED','附件只能通过受控上传登记。');
        const result = await executeForHttp(body.action,body.input,{dataDir:store.dataDir});json(res,result.status,result.body,result.headers);return true;
      }
      if (req.method === 'GET' && route === 'materials') {json(res,200,{ok:true,data:await store.listMaterials({query:url.searchParams.get('query')??'',tag:url.searchParams.get('tag')??'',status:url.searchParams.get('status')??'active',uncategorized:url.searchParams.get('uncategorized')==='true'})});return true;}
      if (req.method === 'GET' && route === 'topics') {json(res,200,{ok:true,data:await store.listTopics({query:url.searchParams.get('query')??'',status:url.searchParams.get('status')??'all'})});return true;}
      if (req.method === 'GET' && /^materials\/[^/]+$/.test(route)) {json(res,200,{ok:true,data:await store.readMaterial(decodeURIComponent(route.slice(10)))});return true;}
      if (req.method === 'GET' && /^topics\/[^/]+$/.test(route)) {json(res,200,{ok:true,data:await store.readTopic(decodeURIComponent(route.slice(7)))});return true;}
      if (req.method === 'GET' && route === 'handoff') {
        const kind = url.searchParams.get('kind'); if (!['material','topic'].includes(kind)) fail('INVALID_INPUT','handoff kind 必须是 material 或 topic。');
        json(res,200,{ok:true,data:await handoff(store,`handoff-${kind}`,id(url.searchParams.get('id')))});return true;
      }
      if (req.method === 'POST' && route === 'upload') {
        if (req.headers['x-store-id'] !== actual.storeId) fail('STORE_IDENTITY_MISMATCH','上传未携带当前 storeId；请重新加载后重试。');
        const { receiveUpload } = await import('./attachments.mjs');
        json(res,200,{ok:true,data:await receiveUpload(req,store,{identity:actual,submissionId:id(req.headers['x-submission-id'],'submissionId'),permissionStatus:'user_supplied_unverified'})});return true;
      }
      if (req.method === 'GET' && route === 'attachments') {json(res,200,{ok:true,data:await store.listAttachments()});return true;}
      if (req.method === 'GET' && /^attachments\/[^/]+(?:\/(?:download|info))?$/.test(route)) {
        const parts = route.split('/');const attachmentId = decodeURIComponent(parts[1]); const mod = await import('./attachments.mjs');
        if (parts[2] === 'info') json(res,200,{ok:true,data:await mod.getAttachmentInfo(store,attachmentId)});
        else await mod.attachmentResponse(req,res,store,attachmentId,{download:parts[2]==='download'});
        return true;
      }
      if (req.method === 'POST' && route === 'backup') {object(await readJson(req),'backup request',[]);json(res,200,{ok:true,data:await (await import('./portable.mjs')).createBackup(store)});return true;}
      if (req.method === 'POST' && route === 'export') {const body=object(await readJson(req),'export request',['kind','id']);if (!['material','topic'].includes(body.kind)) fail('INVALID_INPUT','export kind 非法。');json(res,200,{ok:true,data:await (await import('./portable.mjs')).exportRecord(store,body.kind,id(body.id))});return true;}
      if (req.method === 'GET' && route === 'backups') {json(res,200,{ok:true,data:await (await import('./portable.mjs')).listPackages(store,'backup')});return true;}
      if (req.method === 'GET' && /^downloads\/[^/]+$/.test(route)) {
        const kind=url.searchParams.get('kind')??'export';if (!['backup','export'].includes(kind))fail('INVALID_INPUT','下载 kind 非法。');
        await (await import('./portable.mjs')).packageResponse(req,res,store,decodeURIComponent(route.slice(10)),kind);return true;
      }
      json(res,404,{ok:false,error:{code:'NOT_FOUND',message:'未找到观察室接口。',retryable:false,details:{}}});return true;
    } catch (error) {
      const safe = error instanceof ObservatoryError ? error : new ObservatoryError('STORAGE_ERROR','素材观察室操作未完成，请保留输入并检查错误。',{cause:error.message});
      if (!res.headersSent) json(res,HTTP_STATUS_BY_CODE[safe.code]??({ACCESS_DENIED:403,PAYLOAD_TOO_LARGE:413,FILE_TOO_LARGE:413,UNSUPPORTED_FILE:415}[safe.code]??500),{ok:false,error:safe.toJSON()},safe.retryable?{'Retry-After':'2'}:{});else res.end();
      return true;
    }
  };
}
