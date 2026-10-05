import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createNavigationHandler } from './http.mjs';

// In-memory HTTP request/response objects: no socket, real navigation room,
// filesystem fixture, provider credentials, or private record is used.
async function request(handler, route, input, token, overrides = {}) {
  const req = Readable.from(input === undefined ? [] : [Buffer.from(JSON.stringify(input))]);
  req.method = input === undefined ? 'GET' : 'POST';
  req.headers = input === undefined ? {} : { 'content-type':'application/json', 'x-navigation-token':token };
  req.rawHeaders = input === undefined ? [] : ['Content-Type','application/json','X-Navigation-Token',token];
  Object.assign(req,overrides);
  let status, content = '';
  const res = { headersSent:false, writeHead(code){status=code;this.headersSent=true;}, end(value=''){content+=value;} };
  await handler(req,res,new URL('/api/navigation/'+route,'http://isolated.invalid'));
  return { status,body:JSON.parse(content) };
}
function material(input, large = false) {
  const journeys = [{id:'J-1',date:'2026-09-10',content:'旧日原话'}, {id:'J-2',date:'2026-10-03',content:large?'原话'.repeat(10000):'最近原话'}].filter(item=>(!input.since||item.date>=input.since)&&(!input.until||item.date<=input.until));
  const evidence = journeys.map(item=>({id:'R-'+item.id,kind:'user_report',occurred_on:item.date,source:'隔离本人原话',content:item.content}));
  return {revision:7,instructions:[{name:'navigate-personal-development',content:'隔离领航规则'}],background:[],profile:{sections:[{id:'current',items:[{id:'P-1',text:'本人明确更正：现在不采用旧方向。',kind:'user_report'}]}]},profileEvidence:[{id:'P-1',kind:'user_report',content:'现在不采用旧方向。'}],pack:{context:{profile:'旧方向，仅为历史背景'},journeys,evidence,coverage:{from:input.since??null,to:input.until??null,note:'未记录不等于没有经历。'}},sourceRefs:evidence.map(item=>({id:item.id,kind:item.kind,date:item.occurred_on,source:item.source})),warnings:[]};
}
async function fixture(options = {}) {
  const calls=[],modelCalls=[];
  const bridge={async call(command,input={}){calls.push({command,input:structuredClone(input)});if(command==='bootstrap')return{revision:7,identity:'navigation-isolated',journeys:[]};if(command==='prompt')return material(input,options.large);return{command,input,revision:7,saved:command==='profile-correction'};}};
  const handler=createNavigationHandler({bridge,env:{WORKSPACE_MODE:'isolated'},providerStatus:()=>({configured:options.configured!==false,provider:'isolated-mock'}),modelTimeoutMs:options.timeout??1000,runModel:async(messages,metadata)=>{modelCalls.push({messages:structuredClone(messages),metadata});return options.runModel?options.runModel(messages,metadata):'隔离模型文字，尚未保存。';}});
  const token=(await request(handler,'bootstrap?asOf=2026-10-04')).body.data.token;
  return{handler,token,calls,modelCalls,call:(route,input,override=token)=>request(handler,route,input,override)};
}
const input = (message, extra={}) => ({requestId:'period-request-1',mode:'chat',message,asOf:'2026-10-04',...extra});

test('natural date is filtered before prompt; original request and range are reused',async()=>{
  const fx=await fixture(),payload=input('看看最近一周的变化');
  const first=await fx.call('chat',payload);assert.equal(first.status,200);assert.equal(first.body.data.period.since,'2026-09-28');assert.equal(first.body.data.period.until,'2026-10-04');assert.equal(first.body.data.coverage.sourceSince,'2026-10-03');assert.equal(first.body.data.coverage.journeyCount,1);assert.equal(first.body.data.saved,false);
  const prompt=fx.calls.find(item=>item.command==='prompt');assert.deepEqual(prompt.input,{message:payload.message,mode:'chat',asOf:'2026-10-04',since:'2026-09-28',until:'2026-10-04'});
  assert.deepEqual((await fx.call('chat',payload)).body.data,first.body.data);assert.equal(fx.modelCalls.length,1);
  const receipt=await fx.call('requests/'+payload.requestId);assert.deepEqual(receipt.body.data.period,first.body.data.period);assert.deepEqual(receipt.body.data.coverage,first.body.data.coverage);
  assert.equal((await fx.call('chat',{...payload,asOf:'2026-10-05'})).status,409);
});
test('vague and ordinary future chat retain existing context without an invented duration',async()=>{
  for(const message of ['最近有点迷茫','看看这段时间有什么变化','下周怎么安排','我9月10日去看了展，今天想聊方向']){
    const fx=await fixture(),answer=await fx.call('chat',input(message));assert.equal(answer.status,200);assert.equal(answer.body.data.period.since,null);assert.equal(answer.body.data.period.until,null);assert.equal(answer.body.data.coverage.journeyCount,2);const prompt=fx.calls.find(item=>item.command==='prompt');assert(!Object.hasOwn(prompt.input,'since'));assert(!Object.hasOwn(prompt.input,'until'));
  }
});
test('unparseable requested dates return one clarification without reading or calling a model',async()=>{
  const fx=await fixture({configured:false}),payload=input('回看9月31日到10月3日');
  const first=await fx.call('chat',payload);assert.equal(first.status,200);assert.equal(first.body.data.requiresClarification,true);assert.equal(first.body.data.coverage.journeyCount,0);assert.equal(fx.modelCalls.length,0);assert(!fx.calls.some(item=>item.command==='prompt'));assert.equal(first.body.data.saved,false);
  assert.deepEqual((await fx.call('chat',payload)).body.data,first.body.data);assert.equal((await fx.call('requests/'+payload.requestId)).body.data.status,'completed');
});
test('legacy review bounds remain authoritative and one-sided bounds stay open',async()=>{
  const fx=await fixture();const answer=await fx.call('chat',input('回看最近一周',{mode:'review',since:'2026-09-10',until:'2026-09-10'}));assert.equal(answer.status,200);assert.equal(answer.body.data.coverage.sourceSince,'2026-09-10');assert.equal(fx.calls.find(item=>item.command==='prompt').input.mode,'review');
  const other=await fx.call('chat',input('回看',{requestId:'open-review-2',mode:'review',since:'2026-09-10'}));assert.equal(other.body.data.period.until,null);
});
test('provider failure retry reuses frozen prompt material and period',async()=>{
  let attempts=0;const fx=await fixture({runModel:async()=>{attempts++;if(attempts===1)throw new Error('isolated failure');return'第二次取得答复，未保存。';}}),payload=input('回看最近3天');
  assert.equal((await fx.call('chat',payload)).status,502);const second=await fx.call('chat',payload);assert.equal(second.status,200);assert.equal(fx.calls.filter(item=>item.command==='prompt').length,1);assert.equal(fx.modelCalls.length,2);assert.deepEqual(fx.modelCalls[0].messages,fx.modelCalls[1].messages);assert.equal(second.body.data.period.since,'2026-10-02');
});
test('temporary provider unavailability does not discard a failed request fingerprint',async()=>{
  let attempts=0;const options={runModel:async()=>{if(++attempts===1)throw new Error('isolated failure');return'恢复后的同一答复';}};const fx=await fixture(options),payload=input('回看昨天');
  assert.equal((await fx.call('chat',payload)).status,502);options.configured=false;assert.equal((await fx.call('chat',payload)).status,503);assert.equal((await fx.call('chat',{...payload,message:'另一条内容'})).status,409);
  options.configured=true;assert.equal((await fx.call('chat',payload)).status,200);assert.equal(fx.calls.filter(item=>item.command==='prompt').length,1);
});
test('timeout retry never starts a second model and receipt keeps the same metadata',async()=>{
  let release;const fx=await fixture({timeout:5,runModel:()=>new Promise(resolve=>{release=resolve;})}),payload=input('回看昨天');
  assert.equal((await fx.call('chat',payload)).status,504);assert.equal((await fx.call('chat',payload)).status,504);assert.equal(fx.modelCalls.length,1);release('同一次未保存答复');const final=await fx.call('chat',payload);assert.equal(final.status,200);assert.equal(final.body.data.period.since,'2026-10-03');
});
test('budget excerpts disclose selected count and never claim full supplied text',async()=>{
  const fx=await fixture({large:true}),answer=await fx.call('chat',input('回看昨天'));assert.equal(answer.body.data.coverage.excerpted,true);assert.equal(answer.body.data.coverage.journeyCount,1);assert(answer.body.data.warnings.some(item=>item.includes('节选')));assert.match(answer.body.data.coverage.countBasis,/不代表每条原文均已完整提供/);assert.match(fx.modelCalls[0].messages[0].content,/明确保存的本人补充或更正/);assert.match(fx.modelCalls[0].messages[0].content,/现在不采用旧方向/);
});
test('profile endpoints forward the worker contract; correction needs the original token',async()=>{
  const fx=await fixture();assert.equal((await fx.call('profile?asOf=2026-10-04')).body.data.command,'profile');assert.deepEqual((await fx.call('analyses?since=2026-09-10&until=2026-10-03&query=idea')).body.data.input,{since:'2026-09-10',until:'2026-10-03',query:'idea'});
  const correction={identity:'navigation-isolated',eventId:'E-correction',expectedRevision:7,id:'P-correction',sectionId:'current',content:'  本人更正原话\n保持换行  ',asOf:'2026-10-04'};
  assert.equal((await fx.call('profile-correction',correction,'wrong')).status,403);const saved=await fx.call('profile-correction',correction);assert.equal(saved.status,200);assert.deepEqual(saved.body.data.input,correction);assert.equal(fx.modelCalls.length,0);
});
