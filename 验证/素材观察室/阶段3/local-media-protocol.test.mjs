import assert from 'node:assert/strict';
import fsp from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { PROJECT_ROOT, ObservatoryStore } from '../../../web/observatory/store.mjs';
import { createObservatoryHandler } from '../../../web/observatory/http.mjs';
import { inspectAttachment, localCommand } from '../../../web/observatory/attachments.mjs';

const phase3=path.join(PROJECT_ROOT,'验证','素材观察室','阶段3');
const metadata=JSON.parse(await fsp.readFile(path.join(phase3,'media-formats-latest.json'),'utf8'));
const existing=JSON.parse(await fsp.readFile(metadata.evidencePath,'utf8'));
const original=JSON.parse(await fsp.readFile(path.join(phase3,'media-portable-latest.json'),'utf8'));
const fixtureRoot=path.join(original.runRoot,'TEST_FIXTURES');
const store=new ObservatoryStore({dataDir:existing.dataDir});const identity=await store.identity();assert.equal(identity.scope,'isolated');
const handler=createObservatoryHandler({env:{OBSERVATORY_MODE:'isolated',OBSERVATORY_DATA_DIR:existing.dataDir}});
const server=http.createServer(async(req,res)=>{if(!await handler(req,res,new URL(req.url,'http://127.0.0.1'))){res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}/api/observatory/`;
const {data:{token}}=await(await fetch(base+'bootstrap')).json();const passed=[];const records=[];
try{
  const source=await fsp.readFile(path.join(PROJECT_ROOT,'web','observatory','attachments.mjs'),'utf8');
  assert.match(source,/'ffprobe', \['-v', 'error', '-protocol_whitelist', 'file,pipe'/);
  assert.match(source,/'-protocol_whitelist', 'file,pipe', '-i', filename/);
  passed.push('FFprobe限制作用于输入；FFmpeg限制位于-i之前，未修改全局配置');
  for(const [name,mime] of [['TEST_PURPLE_IMAGE.png','image/png'],['TEST_MOVING_COLOUR.mp4','video/mp4']]){
    const filename=path.join(fixtureRoot,name);const info=await inspectAttachment(filename,name);assert.equal(info.integrity,'local_decode_checked');assert.equal(info.preview,true);
    assert.equal(info.inspectionScope,'file_integrity_only');assert.equal(info.researchReadingScope,'see_topic_sources.verificationScope');
    passed.push(`${mime}在file,pipe协议约束下实际探测与完整技术解码通过`);
    const response=await fetch(base+'upload',{method:'POST',headers:{'Content-Type':mime,'X-File-Name':encodeURIComponent(name),'X-Store-Id':identity.storeId,'X-Submission-Id':'protocol_'+randomUUID(),'X-Observatory-Token':token},body:await fsp.readFile(filename)});
    const result=await response.json();assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.data.verification.persistedSubmission,true);assert.equal(result.data.capabilities.integrity,'local_decode_checked');assert.equal(result.data.capabilities.read,false);
    const actual=await store.readAttachment(result.data.receipt.recordId);assert.equal(actual.record.sha256,result.data.attachment.sha256);
    passed.push(`${mime}真实HTTP上传→协议受限检查→持久化登记与回读通过`);records.push({attachmentId:actual.record.attachmentId,fixture:filename,sha256:actual.record.sha256,capabilities:result.data.capabilities});
  }
  for(const executable of ['ffprobe','ffmpeg']){
    const args=executable==='ffprobe'?['-v','error','-protocol_whitelist','file,pipe','http://127.0.0.1:1/MUST_NOT_CONNECT.mp4']:['-nostdin','-v','error','-protocol_whitelist','file,pipe','-i','http://127.0.0.1:1/MUST_NOT_CONNECT.mp4','-f','null','-'];
    const result=await localCommand(executable,args,{timeoutMs:5000});assert.notEqual(result.code,0);assert.match(result.stderr,/not on whitelist|not on the whitelist/i);passed.push(`${executable}显式http输入因协议白名单拒绝，未尝试连接`);
  }
  const evidence={verifiedAt:new Date().toISOString(),nodeVersion:process.version,scope:'isolated',existingDataDir:existing.dataDir,identity,protocolWhitelist:['file','pipe'],inputConfiguration:{ffprobe:'-protocol_whitelist file,pipe before input filename',ffmpeg:'-protocol_whitelist file,pipe before -i'},records,passed,limits:'技术解码不代表媒体含义读取或真实研究；实际研究读取范围以专题sources.verificationScope为准'};
  await fsp.writeFile(path.join(phase3,'本地媒体协议白名单-验收证据.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify({passed:passed.length,evidencePath:path.join(phase3,'本地媒体协议白名单-验收证据.json')}));
}finally{await new Promise(resolve=>server.close(resolve));}
