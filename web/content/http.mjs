import { randomUUID } from 'node:crypto';
import { ContentStore, ContentError } from './store.mjs';

const PREFIX='/api/learning/content/';
const HEADERS={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
function send(res,status,value){res.writeHead(status,HEADERS);res.end(JSON.stringify(value));}
function count(req,name){return (req.rawHeaders??[]).filter((_,i)=>i%2===0&&req.rawHeaders[i].toLowerCase()===name).length;}
async function input(req){if(count(req,'content-type')!==1||!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']??''))throw new ContentError('CONTENT_INVALID_INPUT','保存需要单一application/json请求类型。',415);let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>2*1024*1024)throw new ContentError('CONTENT_TOO_LARGE','本次保存超过2MiB，请先保留原稿。',413);chunks.push(chunk);}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new ContentError('CONTENT_INVALID_INPUT','保存请求不是完整JSON。');}}

// Host and Origin validation is deliberately owned by the enclosing local server.
export function createContentHandler({store,projectRoot,scope='production',uiStateReader,token=randomUUID()}={}){
  const content=store??new ContentStore({projectRoot,scope,uiStateReader});
  return async function handle(req,res,url){
    if(!url.pathname.startsWith(PREFIX))return false;
    try{
      const route=url.pathname.slice(PREFIX.length);let result;
      if(req.method==='POST'&&(count(req,'x-content-token')!==1||req.headers['x-content-token']!==token))throw new ContentError('CONTENT_ACCESS_DENIED','保存令牌缺失或已失效，请重新读取。',403);
      if(req.method==='GET'&&route==='bootstrap')result={...await content.bootstrap(),token};
      else if(req.method==='GET'&&route==='items')result=await content.list({kind:url.searchParams.get('kind')??'all',q:url.searchParams.get('q')??''});
      else if(req.method==='GET'&&/^items\/[^/]+$/.test(route)){let id;try{id=decodeURIComponent(route.slice(6));}catch{throw new ContentError('CONTENT_INVALID_INPUT','内容编号编码无效。');}result=await content.detail(id);}
      else if(req.method==='POST'&&route==='save')result=await content.save(await input(req));
      else throw new ContentError('CONTENT_NOT_FOUND','未找到这个内容接口。',404);
      send(res,200,result);
    }catch(error){const status=error.status??(error.code?.startsWith('LEARNING_')?503:500);send(res,status,{error:{code:error.code??'CONTENT_FAILED',message:status===500&&!(error instanceof ContentError)?'内容暂时无法读取或保存，请保留原稿。':error.message,details:error.details??{}}});}
    return true;
  };
}
