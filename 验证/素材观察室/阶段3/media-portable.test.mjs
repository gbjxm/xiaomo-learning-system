import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { Readable } from 'node:stream';
import { createHash } from 'node:crypto';
import { PROJECT_ROOT, initStore, ObservatoryStore } from '../../../web/observatory/store.mjs';
import { createObservatoryHandler } from '../../../web/observatory/http.mjs';
import { localCommand, UPLOAD_LIMITS, receiveUpload, getAttachmentInfo, hashFile, attachmentRoot } from '../../../web/observatory/attachments.mjs';
import { createBackup, restoreBackup, exportRecord, readExportMarkdown, getPackageMetadata, listPackages } from '../../../web/observatory/portable.mjs';

const phase3 = path.join(PROJECT_ROOT, '验证', '素材观察室', '阶段3');
const phase5 = path.join(PROJECT_ROOT, '验证', '素材观察室', '阶段5');
await fsp.mkdir(phase5, { recursive: true });
const runRoot = path.join(phase3, `media-run-${new Date().toISOString().replace(/[:.]/g, '-')}`); await fsp.mkdir(runRoot, { recursive: true });
const dataDir = path.join(runRoot, 'data'); const identity = await initStore({ dataDir, scope: 'isolated' }); const store = new ObservatoryStore({ dataDir });
const fixtures = path.join(runRoot, 'TEST_FIXTURES'); await fsp.mkdir(fixtures);
const passed = []; const evidences = { description: '自制测试图/短视频/文字，只验证本地文件与持久化，不是真实作品或媒体研究', runRoot, dataDir, identity, nodeVersion: process.version, limits: UPLOAD_LIMITS, passed };
async function check(name, fn) { await fn(); passed.push(name); console.log(`PASS ${name}`); }
const fixturePng = path.join(fixtures, 'TEST_PURPLE_IMAGE.png');
const fixtureVideo = path.join(fixtures, 'TEST_MOVING_COLOUR.mp4');
for (const args of [
  ['-nostdin','-v','error','-f','lavfi','-i','color=c=purple:s=96x64','-frames:v','1','-threads','1',fixturePng],
  ['-nostdin','-v','error','-f','lavfi','-i','testsrc2=size=128x72:rate=10','-t','1','-c:v','libx264','-pix_fmt','yuv420p','-threads','1','-metadata','title=TEST FIXTURE ONLY',fixtureVideo]
]) { const r = await localCommand('ffmpeg',args); assert.equal(r.code,0,r.stderr); }
const handler = createObservatoryHandler({ env: { OBSERVATORY_MODE: 'isolated', OBSERVATORY_DATA_DIR: dataDir } });
const server = http.createServer(async (req,res) => { if (!await handler(req,res,new URL(req.url,'http://127.0.0.1'))) { res.writeHead(404); res.end(); } });
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve)); const base = `http://127.0.0.1:${server.address().port}/api/observatory/`;
const bootstrap = await (await fetch(base+'bootstrap')).json(); assert.equal(bootstrap.ok,true); const token = bootstrap.data.token;
async function upload(filename, bytes, submissionId, type) {
  const r = await fetch(base+'upload',{method:'POST',headers:{'Content-Type':type,'X-File-Name':encodeURIComponent(filename),'X-Submission-Id':submissionId,'X-Store-Id':identity.storeId,'X-Observatory-Token':token},body:bytes});
  return { status:r.status,body:await r.json() };
}
let png, video, text;
try {
  await check('真实HTTP上传PNG→本地解码→登记及回读',async()=>{png=await upload('测试图_ONLY.png',await fsp.readFile(fixturePng),'test_png_1','image/png');assert.equal(png.body.ok,true,JSON.stringify(png));assert.equal(png.body.data.verification.persistedSubmission,true);assert.equal(png.body.data.capabilities.preview,true);assert.equal(png.body.data.capabilities.read,false);});
  await check('真实HTTP上传H264 MP4→登记，技术能力与研究分开',async()=>{video=await upload('测试短片_ONLY.mp4',await fsp.readFile(fixtureVideo),'test_video_1','video/mp4');assert.equal(video.body.ok,true,JSON.stringify(video));assert.equal(video.body.data.capabilities.preview,true);assert.equal(video.body.data.capabilities.integrity,'local_decode_checked');assert.equal(video.body.data.capabilities.researched,false);});
  await check('同上传submission相同内容仅登记一次',async()=>{const retry=await upload('测试图_ONLY.png',await fsp.readFile(fixturePng),'test_png_1','image/png');assert.equal(retry.body.ok,true);assert.equal(retry.body.data.receipt.recordId,png.body.data.receipt.recordId);assert.equal((await store.listAttachments()).records.length,2);});
  await check('有效UTF8文字原件可安全预览和下载',async()=>{text=await upload('TEST_NOTE.txt',Buffer.from('这是测试原话。<script>globalThis.invalidInjected = true</script>'),'test_text_1','text/plain');assert.equal(text.body.ok,true);assert.equal(text.body.data.capabilities.previewKind,'text');});
  await check('同上传submission不同内容拒绝且保留已完整原件供诊断',async()=>{const bad=await upload('TEST_NOTE.txt',Buffer.from('不同测试正文'),'test_text_1','text/plain');assert.equal(bad.body.ok,false);assert.equal(bad.body.error.code,'SUBMISSION_ID_CONFLICT');assert.ok(bad.body.error.details.storedFile);assert.equal((await store.listAttachments()).records.length,3);});
  await check('不支持文件类型、伪装类型、损坏PNG、二进制伪文字均明确拒绝',async()=>{
    for (const [name,data,mime,code] of [['TEST.exe',Buffer.from('fake executable'),'application/octet-stream','UNSUPPORTED_FILE_TYPE'],['TEST.png',Buffer.from('not an image'),'image/png','FILE_TYPE_MISMATCH'],['TEST.png',Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]),'image/png','DAMAGED_FILE'],['TEST.txt',Buffer.from([255,0,1]),'text/plain','INVALID_TEXT_ENCODING']]) {const r=await upload(name,data,'bad_'+code,mime);assert.equal(r.body.ok,false);assert.equal(r.body.error.code,code);assert.notEqual(r.status,200);}
  });
  await check('真实HTTP文字超限拒绝，不产生附件记录',async()=>{const r=await upload('TOO_BIG.txt',Buffer.alloc(UPLOAD_LIMITS.text+1,65),'bad_size','text/plain');assert.equal(r.body.ok,false);assert.equal(r.body.error.code,'UPLOAD_TOO_LARGE');assert.equal((await store.listAttachments()).records.length,3);});
  await check('文件名路径穿越拒绝，不以原名生成磁盘路径',async()=>{const r=await upload('../SECRET.txt',Buffer.from('safe'),'bad_path','text/plain');assert.equal(r.body.ok,false);assert.equal(r.body.error.code,'INVALID_FILENAME');});
  await check('上传中断清理临时文件并保持登记数',async()=>{
    const malformed=Readable.from((async function*(){yield Buffer.from('start');throw new Error('TEST stream interrupted');})());malformed.headers={'x-file-name':'TEST_ABORT.txt','content-type':'text/plain'};
    await assert.rejects(receiveUpload(malformed,store,{identity,submissionId:'bad_abort'}),e=>e.code==='UPLOAD_INTERRUPTED');assert.equal((await store.listAttachments()).records.length,3);assert.deepEqual(await fsp.readdir(path.join(attachmentRoot(identity),'.incoming')),[]);
  });
  const pngId=png.body.data.receipt.recordId,videoId=video.body.data.receipt.recordId,textId=text.body.data.receipt.recordId;
  await check('原图下载SHA与上传完全一致、下载文件名及nosniff',async()=>{const r=await fetch(base+`attachments/${pngId}/download`);assert.equal(r.status,200);assert.equal(r.headers.get('x-content-type-options'),'nosniff');assert.match(r.headers.get('content-disposition'),/attachment/);assert.equal(createHash('sha256').update(Buffer.from(await r.arrayBuffer())).digest('hex'),await hashFile(fixturePng));});
  await check('视频Range 206、suffix与416符合规范',async()=>{
    const full=await fsp.readFile(fixtureVideo);let r=await fetch(base+`attachments/${videoId}`,{headers:{Range:'bytes=0-31'}});assert.equal(r.status,206);assert.equal(r.headers.get('content-range'),`bytes 0-31/${full.length}`);assert.deepEqual(Buffer.from(await r.arrayBuffer()),full.subarray(0,32));
    r=await fetch(base+`attachments/${videoId}`,{headers:{Range:'bytes=-10'}});assert.equal(r.status,206);assert.deepEqual(Buffer.from(await r.arrayBuffer()),full.subarray(-10));
    r=await fetch(base+`attachments/${videoId}`,{headers:{Range:`bytes=${full.length}-`}});assert.equal(r.status,416);r=await fetch(base+`attachments/${videoId}`,{headers:{Range:'bytes=0-1,4-5'}});assert.equal(r.status,416);
  });
  await check('文字预览以text/plain呈现，不执行HTML',async()=>{const r=await fetch(base+`attachments/${textId}`);assert.match(r.headers.get('content-type'),/^text\/plain/);assert.match(await r.text(),/<script>/);assert.match(r.headers.get('content-security-policy'),/sandbox/);});
  await check('附件原件被篡改时hash拒绝读取；还原后可读',async()=>{const a=(await store.readAttachment(pngId)).record;const filename=path.join(attachmentRoot(identity),a.relativePath);const original=await fsp.readFile(filename);await fsp.writeFile(filename,Buffer.alloc(original.length));await assert.rejects(getAttachmentInfo(store,pngId),e=>e.code==='ATTACHMENT_UNAVAILABLE');await fsp.writeFile(filename,original);assert.equal((await getAttachmentInfo(store,pngId)).record.sha256,a.sha256);});
  const material=(await store.createMaterial({identity,submissionId:'mat_full',material:{title:'测试：附件及用户原话',original:{kind:'mixed',text:'TEST 原始素材，不是真实收藏',url:'https://example.com/test-unread'},originalImpression:'TEST 最初让我有感觉的原话',tags:['测试','紫色','用途-氛围'],segments:[{kind:'time',startSeconds:0.1,endSeconds:0.6,note:'测试关注半秒',attachmentId:videoId},{kind:'image',text:'左上紫色局部',attachmentId:pngId}],attachmentIds:[pngId,videoId,textId]}})).receipt.snapshot;
  const changed=(await store.updateMaterial({identity,submissionId:'mat_impression',materialId:material.materialId,expectedRevision:1,actor:'user',patch:{currentImpression:'TEST 修改后的当前原话',addNote:'TEST 新备注'}})).receipt.snapshot;
  const topics=[];for(let i=0;i<2;i++)topics.push((await store.createTopic({identity,submissionId:`topic_${i}`,topic:{title:`TEST 共享专题 ${i}`,question:'TEST 紫色局部为什么吸引我',scope:'自制测试图，只测保存不是真实研究',materialIds:[changed.materialId]}})).receipt.snapshot);
  const stagePayload={identity,submissionId:'test_stage_full',topicId:topics[0].topicId,expectedRevision:1,materialVersions:[{materialId:changed.materialId,revision:changed.revision}],stage:{focus:'TEST 只围绕自制色块的兴趣',confirmed:['TEST 用户原话原件必须保留'],candidates:['TEST 尚未采用：观察颜色与节奏'],unknown:['TEST 真实创作效果未评估'],nextStep:'TEST 下次实际观察更具体片段',limitations:['自制夹具，不是实际媒体研究'],paragraphs:[{paragraphId:'p_test1',heading:'TEST 完整图文段落',markdown:'TEST 正文完整保存。AI 假设不是用户采用。',basisKind:'demo',sourceRefs:[{sourceId:'s_test1',locator:'TEST_IMAGE整体',note:'只验证图文引用不是真实结论'}],attachmentIds:[pngId]}],sources:[{sourceId:'s_test1',kind:'attachment',attachmentId:pngId,title:'自制 TEST 色块',locator:'整体',verificationScope:'fixture_for_software_test',licenseStatus:'test_owned'}],researchStatus:'paused'}};
  const staged=(await store.submitStage(stagePayload)).receipt.snapshot;
  await store.updateTopic({identity,submissionId:'topic_soft_delete',topicId:topics[1].topicId,expectedRevision:1,patch:{status:'deleted'}});
  await check('素材被两专题共享，删除其中一个专题不移除原件',async()=>{assert.equal((await store.readTopic(topics[1].topicId)).record.status,'deleted');assert.equal((await store.readTopic(topics[0].topicId)).record.materialIds[0],changed.materialId);assert.equal((await getAttachmentInfo(store,pngId)).capabilities.preview,true);});
  await check('解除当前关联保留历史阶段所据素材ID及版本',async()=>{await store.updateTopic({identity,submissionId:'topic_unlink_after_stage',topicId:topics[0].topicId,expectedRevision:2,patch:{materialIds:[]}});const latest=(await store.readTopic(topics[0].topicId)).record;assert.deepEqual(latest.materialIds,[]);assert.equal(latest.stages[0].materialVersions[0].materialId,changed.materialId);});
  let exported;
  await check('完整Markdown/来源/版本/历史及可移植附件导出真实生成',async()=>{exported=await exportRecord(store,'topic',staged.topicId);const single=await readExportMarkdown(store,exported.packageId);assert.match(single.markdown,/TEST 正文完整保存/);assert.match(single.markdown,/s_test1/);assert.match(single.markdown,/未知与待核查/);assert.match(single.markdown,/assets\/[a-f0-9]{64}\.png/);assert.equal(exported.manifest.recordRevision,3);const inspect=await localCommand('python',['-X','utf8','-c',"import json,sys,zipfile; p=json.load(sys.stdin); z=zipfile.ZipFile(p['path']); names=set(z.namelist()); m=z.read(p['material']).decode('utf-8'); print(json.dumps({'names':list(names),'material':m},ensure_ascii=False))"],{input:JSON.stringify({path:exported.path,material:`materials/${changed.materialId}.md`})});const data=JSON.parse(inspect.stdout);assert.match(data.material,/TEST 最初让我有感觉的原话/);assert.match(data.material,/TEST 修改后的当前原话/);assert.match(data.material,/修改前/);assert.match(data.material,/TEST 新备注/);for(const asset of exported.manifest.portableAssets)assert.ok(data.names.includes(asset.exportedPath));assert.ok(data.names.includes('sources.json'));});
  let backup, restored;
  await check('SQLite一致快照＋全附件及待登记原件完整ZIP备份',async()=>{backup=await createBackup(store);assert.equal(backup.manifest.completeDataBackup,true);assert.equal(backup.manifest.recordCounts.materials,1);assert.equal(backup.manifest.recordCounts.topics,2);assert.equal(backup.manifest.recordCounts.attachments,3);assert.equal(backup.manifest.pendingOriginals.length,1);assert.equal((await getPackageMetadata(store,backup.packageId,'backup')).sha256,backup.sha256);assert.equal((await listPackages(store,'backup')).records[0].packageId,backup.packageId);});
  const restoreDir=path.join(phase5,`restored-${path.basename(runRoot)}`,'data');
  await check('全新隔离目录真实恢复；记录、原话历史、共享关联与完整阶段一致',async()=>{restored=await restoreBackup(backup.path,restoreDir);assert.equal(restored.identity.scope,'isolated');assert.equal(restored.identity.storeId,identity.storeId);assert.equal(restored.verification.allAttachmentHashesVerified,true);const restoredStore=new ObservatoryStore({dataDir:restoreDir});assert.deepEqual((await restoredStore.readMaterial(changed.materialId)).record,(await store.readMaterial(changed.materialId)).record);for(const topic of topics)assert.deepEqual((await restoredStore.readTopic(topic.topicId)).record,(await store.readTopic(topic.topicId)).record);assert.deepEqual((await restoredStore.listAttachments()).records,(await store.listAttachments()).records);});
  await check('恢复禁止覆盖已存在目标或正式数据路径',async()=>{await assert.rejects(restoreBackup(backup.path,restoreDir),e=>e.code==='RESTORE_TARGET_NOT_EMPTY');await assert.rejects(restoreBackup(backup.path,path.join(PROJECT_ROOT,'素材观察室','data')),e=>e.code==='RESTORE_TARGET_NOT_EMPTY');});
  await check('附件丢失时完整备份明确失败，不产出假成功包',async()=>{const a=(await store.readAttachment(textId)).record;const file=path.join(attachmentRoot(identity),a.relativePath);const bytes=await fsp.readFile(file);await fsp.unlink(file);await assert.rejects(createBackup(store),e=>e.code==='ATTACHMENT_UNAVAILABLE');await fsp.writeFile(file,bytes,{flag:'wx'});});
  await check('恶意ZIP路径、压缩炸弹、manifest哈希不符都拒绝且无恢复目标',async()=>{
    const evilRoot=path.join(runRoot,'EVIL_TEST_PACKAGES');await fsp.mkdir(evilRoot);
    const script="import json,sys,zipfile; p=json.load(sys.stdin); o=p['root']; b=p['backup']; z=zipfile.ZipFile(b); entries={n:z.read(n) for n in z.namelist()};\nfor kind in ['path','hash','bomb']:\n f=o+'/'+kind+'.zip'; w=zipfile.ZipFile(f,'w',compression=zipfile.ZIP_DEFLATED);\n for n,data in entries.items():\n  if kind=='hash' and n=='data/observatory.sqlite3': data=data+b'TAMPER';\n  w.writestr(n,data)\n if kind=='path': w.writestr('../escape.txt',b'bad')\n if kind=='bomb': w.writestr('bomb.txt',b'0'*3000000)\n w.close()\nprint(json.dumps({'created':True}))";
    const r=await localCommand('python',['-X','utf8','-c',script],{input:JSON.stringify({root:evilRoot,backup:backup.path})});assert.equal(r.code,0,r.stderr);
    for(const kind of ['path','hash','bomb']){const target=path.join(phase5,`${kind}-${path.basename(runRoot)}`,'data');await assert.rejects(restoreBackup(path.join(evilRoot,kind+'.zip'),target),e=>e.code==='PACKAGE_VALIDATION_FAILED');assert.equal(fs.existsSync(path.dirname(target)),false);}
  });
  Object.assign(evidences,{attachmentIds:[pngId,videoId,textId],materialId:changed.materialId,topicIds:topics.map(t=>t.topicId),stageId:staged.stages[0].stageId,exported,backup,restored,allPassed:passed.length});
  await fsp.writeFile(path.join(runRoot,'evidence.json'),JSON.stringify(evidences,null,2));
  await fsp.writeFile(path.join(phase3,'media-portable-latest.json'),JSON.stringify({runRoot,evidencePath:path.join(runRoot,'evidence.json'),passed:passed.length},null,2));
  console.log(JSON.stringify({allPassed:passed.length,evidencePath:path.join(runRoot,'evidence.json')}));
} finally { await new Promise(resolve=>server.close(resolve)); }
