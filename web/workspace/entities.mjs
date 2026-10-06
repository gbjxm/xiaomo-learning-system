import { ObservatoryStore, DEFAULT_DATA_DIR } from '../observatory/store.mjs';
import { ContentStore } from '../content/store.mjs';
import { LEARNING_ROOT } from '../learning/records.mjs';
import { WorkspaceError, normalizeRef } from './store.mjs';

const key=r=>JSON.stringify([r.module,r.kind,r.storeId,r.id]);
export function createEntityCatalog({projectRoot=LEARNING_ROOT,uiStore,env,informationManager,scope}){
 const obs=new ObservatoryStore({dataDir:env.OBSERVATORY_DATA_DIR??DEFAULT_DATA_DIR});
 const fail=(code,message)=>{throw new WorkspaceError(code,message,409);};
 function entity(ref,title,currentRevision,availability='available',kindLabel=ref.kind){
  let href;
  if(ref.module==='observatory')href='/observatory/?space=daily#'+ref.kind+'/'+encodeURIComponent(ref.id);
  else href='/'+ref.module+'/?space=daily&kind='+ref.kind+'&focus='+encodeURIComponent(ref.id);
  return{ref,title:String(title??ref.id),href,currentRevision,availability,kindLabel};
 }
 async function learningUI(query=''){
  const r=await uiStore.read(),identity=uiStore.identity(r),s=r.state.islandState??{};
  if(identity.scope!==scope)fail('WORKSPACE_SOURCE_IDENTITY','学习区域身份不符合此入口。');
  const ref=id=>({module:'learning',kind:'learning',storeId:identity.storeId,id});
  const names={home:'主岛',story:'叙事岛',visual:'视觉岛',post:'后期岛'};
  const items=Object.entries(names).map(([id,title])=>entity(ref('island:'+id),title,r.revision,'available','学习区域'));
  for(const a of Object.values(s.activities??{}))if(a?.id)items.push(entity(ref('activity:'+a.id),a.title??a.id,r.revision,'available','手动活动'));
  for(const a of s.records??[])if(a?.id)items.push(entity(ref('record:'+a.id),a.title??a.id,r.revision,'available','界面书签'));
  return items.filter(x=>!query||x.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
 }
 async function learningRecords(query=''){
  // UI references have their own identity and failure boundary. This source
  // reads only the existing formal stores; it never initializes missing data.
  const store=new ContentStore({projectRoot,scope,uiStateReader:async()=>null});
  const data=await store.list({q:query});
  if(data.scope!==scope)fail('WORKSPACE_SOURCE_IDENTITY','学习记录身份不符合此入口。');
  const labels={'learning-note':'学习笔记','learning-task':'学习任务','personal-content':'创作与想法','watch-ledger':'观看记录'};
  const items=data.items.filter(item=>item.workspaceRef).map(item=>({
   ...entity(item.workspaceRef,item.title,item.version||item.sourceRevision||data.revision,'available',labels[item.source?.kind]??'学习记录'),
   href:'/learning/content/?item='+encodeURIComponent(item.id)
  }));
  return {items,warnings:data.warnings??[]};
 }
 async function observatory(query=''){
  const identity=await obs.identity();
  if(scope==='production'?identity.scope!=='production':!['isolated','demo'].includes(identity.scope))fail('WORKSPACE_SOURCE_IDENTITY','素材区域身份不符合此入口。');
  const [m,t]=await Promise.all([obs.listMaterials({query,status:'all'}),obs.listTopics({query,status:'all'})]);
  const availability=x=>x.status==='deleted'?'deleted':x.status==='archived'?'archived':'available';
  return [...m.records.map(x=>entity({module:'observatory',kind:'material',storeId:identity.storeId,id:x.materialId},x.title,x.revision,availability(x),'素材')),
   ...t.records.map(x=>entity({module:'observatory',kind:'topic',storeId:identity.storeId,id:x.topicId},x.title,x.revision,availability(x),'研究专题'))];
 }
 async function information(query=''){
  const status=await informationManager.verify();if(status.scope!==scope)fail('WORKSPACE_SOURCE_IDENTITY','信息区域身份不符合此入口。');
  const [s,w,search]=await Promise.all([informationManager.read('/api/state'),informationManager.read('/api/works'),query?informationManager.read('/api/search?q='+encodeURIComponent(query)+'&history=0'):Promise.resolve(null)]);
  const ref=(kind,id)=>({module:'information',kind,storeId:status.marker,id});
  let items=s.items??[];
  if(query){const ids=new Set((search?.results??search?.items??[]).map(x=>x.item_id??x.itemId??x.id));items=items.filter(x=>ids.has(x.id)||JSON.stringify(x).toLocaleLowerCase().includes(query.toLocaleLowerCase()));}
  return [...items.map(x=>entity(ref('opportunity',x.id),x.title??x.name,x.revision??null,x.archived?'archived':'available','创作机会')),
   ...(w.works??[]).filter(x=>!query||JSON.stringify(x).toLocaleLowerCase().includes(query.toLocaleLowerCase())).map(x=>entity(ref('work',x.id),x.data?.name??x.data?.title??x.name??x.title,x.revision??null,x.deleted?'deleted':'available','作品档案'))];
 }
 const sources=[{module:'learning',source:'ui',load:learningUI},{module:'learning',source:'records',load:learningRecords},{module:'observatory',load:observatory},{module:'information',load:information}];
 const loaders={observatory,information};
 async function list({query='',kind=''}={}){
  if(typeof query!=='string'||query.length>2000||typeof kind!=='string'||!['','learning','material','topic','opportunity','work'].includes(kind))throw new WorkspaceError('WORKSPACE_INVALID_QUERY','搜索条件无效。');
  const results=await Promise.allSettled(sources.map(({load})=>load(query))),items=[],errors=[];
  results.forEach((r,i)=>{
   const source={module:sources[i].module,...(sources[i].source?{source:sources[i].source}:{})};
   if(r.status==='fulfilled'){
    items.push(...(Array.isArray(r.value)?r.value:r.value.items));
    for(const warning of r.value.warnings??[])errors.push({...source,code:warning.code??'SOURCE_PARTIAL',message:typeof warning==='string'?warning:warning.message});
   }else errors.push({...source,code:r.reason.code??'SOURCE_UNAVAILABLE',message:r.reason.message});
  });
  return{items:items.filter(x=>!kind||x.ref.kind===kind),errors,query};
 }
 async function resolve(input,{required=false}={}){
  const ref=normalizeRef(input),loader=ref.module==='learning'?(/^(note|task|content):/.test(ref.id)?learningRecords:learningUI):loaders[ref.module],loaded=await loader(),items=Array.isArray(loaded)?loaded:loaded.items;const found=items.find(x=>key(x.ref)===key(ref));
  if(found&&found.availability!=='deleted')return found;
  if(found&&!required)return{...found,href:null};
  if(required)fail('WORKSPACE_ENTITY_UNAVAILABLE','关联对象已移除或资料身份变化，请重新读取。');
  return{ref,title:'对象已不可用 · '+ref.id,href:null,availability:'missing',currentRevision:null,kindLabel:ref.kind};
 }
 return{list,resolve};
}
