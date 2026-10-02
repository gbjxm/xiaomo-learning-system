import assert from 'node:assert/strict';
import fsp from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { PROJECT_ROOT, initStore, ObservatoryStore } from '../../../web/observatory/store.mjs';
import { createObservatoryHandler } from '../../../web/observatory/http.mjs';
import { attachmentRoot, hashFile, localCommand, getAttachmentInfo } from '../../../web/observatory/attachments.mjs';

const root=path.join(PROJECT_ROOT,'验证','素材观察室','阶段3',`formats-run-${Date.now()}`);await fsp.mkdir(root,{recursive:true});
const dataDir=path.join(root,'data');const identity=await initStore({dataDir,scope:'isolated'});const store=new ObservatoryStore({dataDir});
const handler=createObservatoryHandler({env:{OBSERVATORY_MODE:'isolated',OBSERVATORY_DATA_DIR:dataDir}});
const server=http.createServer(async(req,res)=>{if(!await handler(req,res,new URL(req.url,'http://127.0.0.1'))){res.writeHead(404);res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}/api/observatory/`;
const bootstrap=await(await fetch(base+'bootstrap')).json();const token=bootstrap.data.token;
async function upload(name,bytes,submissionId,mimeType){const response=await fetch(base+'upload',{method:'POST',headers:{'Content-Type':mimeType,'X-File-Name':encodeURIComponent(name),'X-Submission-Id':submissionId,'X-Store-Id':identity.storeId,'X-Observatory-Token':token},body:bytes});return{status:response.status,body:await response.json()};}
const passed=[],records=[];async function check(name,fn){await fn();passed.push(name);console.log('PASS '+name);}
try {
  const formats=[
    {name:'TEST_JPEG.jpg',mime:'image/jpeg',args:['-f','lavfi','-i','color=c=orange:s=96x64','-frames:v','1','-threads','1']},
    {name:'TEST_WEBP.webp',mime:'image/webp',args:['-f','lavfi','-i','color=c=cyan:s=96x64','-frames:v','1','-threads','1']},
    {name:'TEST_GIF.gif',mime:'image/gif',args:['-f','lavfi','-i','color=c=green:s=96x64','-frames:v','1','-threads','1']},
    {name:'TEST_WEBM.webm',mime:'video/webm',args:['-f','lavfi','-i','testsrc2=size=128x72:rate=10','-t','1','-c:v','libvpx-vp9','-threads','1']},
    {name:'TEST_MP3.mp3',mime:'audio/mpeg',args:['-f','lavfi','-i','sine=frequency=440:sample_rate=44100','-t','0.5','-c:a','libmp3lame','-threads','1']},
    {name:'TEST_WAV.wav',mime:'audio/wav',args:['-f','lavfi','-i','sine=frequency=440:sample_rate=44100','-t','0.5','-c:a','pcm_s16le','-threads','1']}
  ];
  for(const format of formats)await check(`${format.mime}实际生成、HTTP上传、格式检查、预览声明及下载hash`,async()=>{
    const filename=path.join(root,format.name);const command=await localCommand('ffmpeg',['-nostdin','-v','error',...format.args,filename]);assert.equal(command.code,0,command.stderr);
    const result=await upload(format.name,await fsp.readFile(filename),'format_'+format.name,format.mime);assert.equal(result.body.ok,true,JSON.stringify(result));assert.equal(result.body.data.capabilities.preview,true);const aid=result.body.data.receipt.recordId;const response=await fetch(base+`attachments/${aid}/download`);assert.equal(response.status,200);await fsp.writeFile(path.join(root,'download-'+format.name),Buffer.from(await response.arrayBuffer()));assert.equal(await hashFile(path.join(root,'download-'+format.name)),await hashFile(filename));records.push({attachmentId:aid,filename,mimeType:format.mime,capabilities:result.body.data.capabilities});
  });
  await check('有效UTF8 Markdown保存及plain-text预览，非HTML执行',async()=>{const result=await upload('TEST_MARKDOWN.md',Buffer.from('# 测试\n\n<script>unsafe()</script>'),'format_md','text/markdown');assert.equal(result.body.ok,true);const response=await fetch(base+`attachments/${result.body.data.receipt.recordId}`);assert.match(response.headers.get('content-type'),/^text\/plain/);assert.match(await response.text(),/unsafe/);});
  await check('有效测试PDF保存与下载，但不宣称完整读取或网页预览',async()=>{
    const lines=['%PDF-1.4\n'];const offsets=[0];let length=Buffer.byteLength(lines[0]);
    for(const object of ['1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n','2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n','3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] >>\nendobj\n']){offsets.push(length);lines.push(object);length+=Buffer.byteLength(object);}
    const xref=length;lines.push('xref\n0 4\n0000000000 65535 f \n'+offsets.slice(1).map(n=>`${String(n).padStart(10,'0')} 00000 n \n`).join('')+`trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    const result=await upload('TEST_BLANK.pdf',Buffer.from(lines.join('')),'format_pdf','application/pdf');assert.equal(result.body.ok,true);assert.equal(result.body.data.capabilities.preview,false);assert.equal(result.body.data.capabilities.read,false);const response=await fetch(base+`attachments/${result.body.data.receipt.recordId}`);assert.match(response.headers.get('content-disposition'),/^attachment/);assert.match(result.body.data.capabilities.limitations[0],/仅检查/);
  });
  await check('HEVC MP4可保存下载，未列为浏览器可播，不谎称播放',async()=>{
    const filename=path.join(root,'TEST_HEVC_DOWNLOAD_ONLY.mp4');const r=await localCommand('ffmpeg',['-nostdin','-v','error','-f','lavfi','-i','color=c=purple:s=64x64:rate=5','-t','0.5','-c:v','libx265','-x265-params','pools=1:frame-threads=1:log-level=error','-threads','1',filename]);assert.equal(r.code,0,r.stderr);
    const result=await upload('TEST_HEVC.mp4',await fsp.readFile(filename),'format_hevc','video/mp4');assert.equal(result.body.ok,true);assert.equal(result.body.data.capabilities.preview,false);assert.equal(result.body.data.capabilities.previewKind,'download');assert.match(result.body.data.capabilities.limitations[0],/下载/);records.push({attachmentId:result.body.data.receipt.recordId,filename,capabilities:result.body.data.capabilities});
  });
  await check('独立SQLite进程真实锁导致附件登记失败；完整原件保留，同ID重试成功',async()=>{
    const code="import { DatabaseSync } from 'node:sqlite'; const db=new DatabaseSync(process.argv[1]); db.exec('BEGIN IMMEDIATE'); console.log('LOCKED'); process.stdin.once('data',()=>{db.exec('ROLLBACK');db.close();process.exit(0);});";
    const lock=spawn(process.execPath,['--input-type=module','-e',code,identity.canonicalDbPath],{shell:false,windowsHide:true,stdio:['pipe','pipe','pipe']});await once(lock.stdout,'data');
    const before=(await store.listAttachments()).records.length;const bytes=Buffer.from('TEST 真实锁等待后的相同提交');let first;
    try {first=await upload('TEST_LOCK.txt',bytes,'format_real_lock','text/plain');assert.equal(first.body.ok,false);assert.equal(first.body.error.code,'DATABASE_BUSY');assert.equal(first.status,503);assert.ok(first.body.error.details.storedFile);assert.equal((await store.listAttachments()).records.length,before);assert.ok(fs.existsSync(path.join(attachmentRoot(identity),first.body.error.details.storedFile)));}
    finally{lock.stdin.write('RELEASE');await once(lock,'close');}
    const retry=await upload('TEST_LOCK.txt',bytes,'format_real_lock','text/plain');assert.equal(retry.body.ok,true);assert.equal(retry.body.data.verification.persistedSubmission,true);assert.equal((await store.listAttachments()).records.length,before+1);
  });
  await check('Windows目录junction逃逸实际拒绝；恢复原始目录后正常读取',async()=>{
    const record=(await store.readAttachment(records[0].attachmentId)).record;const attachments=attachmentRoot(identity);const originalDirectory=path.join(root,'attachments-original');
    const outside=path.join(PROJECT_ROOT,'验证','素材观察室','阶段3',`outside-junction-${path.basename(root)}`);await fsp.mkdir(outside);await fsp.copyFile(path.join(attachments,record.relativePath),path.join(outside,record.relativePath));
    // Windows file symlink creation requires a privilege unavailable in this session.
    // A directory junction is the relevant existing-path escape and needs no privilege change.
    await fsp.rename(attachments,originalDirectory);try{await fsp.symlink(outside,attachments,'junction');assert.equal((await fsp.lstat(attachments)).isSymbolicLink(),true);await assert.rejects(getAttachmentInfo(store,record.attachmentId),e=>e.code==='ATTACHMENT_UNAVAILABLE');}
    finally{if(fs.existsSync(attachments)){assert.equal((await fsp.lstat(attachments)).isSymbolicLink(),true);await fsp.rmdir(attachments);}await fsp.rename(originalDirectory,attachments);}assert.equal((await getAttachmentInfo(store,record.attachmentId)).record.sha256,record.sha256);
  });
  const evidence={scope:'isolated',description:'自制测试文件与独立SQLite锁进程；浏览器实际播放另由UI验收，不以容器解码替代',identity,root,dataDir,nodeVersion:process.version,passed,records};await fsp.writeFile(path.join(root,'evidence.json'),JSON.stringify(evidence,null,2));await fsp.writeFile(path.join(PROJECT_ROOT,'验证','素材观察室','阶段3','media-formats-latest.json'),JSON.stringify({root,evidencePath:path.join(root,'evidence.json'),passed:passed.length},null,2));console.log(JSON.stringify({allPassed:passed.length,evidencePath:path.join(root,'evidence.json')}));
} finally{await new Promise(r=>server.close(r));}
