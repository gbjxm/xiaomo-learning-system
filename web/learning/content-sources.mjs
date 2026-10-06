import { createNavigationBridge } from '../navigation/bridge.mjs';
import { ContentError } from '../content/store.mjs';

const PREFIX='navigation_';
const sortItems=items=>items.sort((a,b)=>(b.updatedAt??'').localeCompare(a.updatedAt??'')||a.id.localeCompare(b.id));
function sourceItem(entry,{full=false}={}){
 const original=full?entry.content:entry.preview;
 const body=[original??'',full&&entry.rawTranscript?'原始转写（保留原文）\n\n'+entry.rawTranscript:''].filter(Boolean).join('\n\n');
 return {id:PREFIX+entry.id,kind:'creation',subtype:'idea',title:entry.title||'原来的创作想法',body,
  date:entry.date??null,domains:[],nextStep:'',links:[],createdAt:null,updatedAt:null,version:0,history:[],readOnly:true,
  source:{kind:'navigation-idea',label:entry.contentKind==='mixed_document'?'领航室原整理（原话与当时理解分层保留）':'领航室原灵感',path:'领航室原位记录 · '+entry.id},
  resumeUrl:'/navigation/?view=journey'};
}

// The shared screen references the Navigation room; it never writes or copies its records.
export function withContentSources(store,{projectRoot,env,bridge}={}){
 const navigation=bridge??createNavigationBridge({projectRoot,env});
 async function ideas(){
  try{const result=await navigation.call('list',{type:'idea'});return {items:(result.entries??[]).filter(entry=>entry.type==='idea').map(entry=>sourceItem(entry)),warnings:[]};}
  catch(error){return {items:[],warnings:[{code:error.code??'CONTENT_SOURCE_UNAVAILABLE',message:'领航里的原灵感暂未读到；创作和观看记录仍可使用。'}]};}
 }
 async function combined(resultPromise,filter={}){
  const [result,external]=await Promise.all([resultPromise,ideas()]);
  const query=(filter.q??'').toLocaleLowerCase(),extra=!['all','creation'].includes(filter.kind??'all')?[]:external.items.filter(item=>!query||[item.title,item.body].join('\n').toLocaleLowerCase().includes(query));
  return {...result,items:sortItems([...result.items,...extra]),warnings:[...(result.warnings??[]),...external.warnings]};
 }
 return {
  bootstrap:()=>combined(store.bootstrap()),
  list:(filter={})=>combined(store.list(filter),filter),
  async detail(id){
   if(typeof id!=='string'||!id.startsWith(PREFIX))return store.detail(id);
   const originalId=id.slice(PREFIX.length);
   if(!/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(originalId))throw new ContentError('CONTENT_INVALID_INPUT','原灵感编号无效。');
   const [base,result]=await Promise.all([store.list({kind:'creation'}),navigation.call('detail',{id:originalId})]);
   if(result.entry?.type!=='idea')throw new ContentError('CONTENT_NOT_FOUND','这份记录不是原灵感条目。',404);
   return {identity:base.identity,scope:base.scope,revision:base.revision,item:sourceItem(result.entry,{full:true}),warnings:[...(base.warnings??[]),...(result.warnings??[])]};
  },
  save:payload=>store.save(payload)
 };
}
