// Prepare one reviewable immutable UTF-8 request. Never writes the database.
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
const args = {};
for (let i=2;i<process.argv.length;i+=2) {
  const key=process.argv[i];
  if (!['--handoff','--stage','--output','--submission-id'].includes(key) || args[key] || !process.argv[i+1]) throw new Error('参数只允许 --handoff --stage --output [--submission-id]，每项一次。');
  args[key]=process.argv[i+1];
}
for (const key of ['--handoff','--stage','--output']) if (!args[key] || !path.isAbsolute(args[key])) throw new Error(key+' 必须给绝对文件路径。');
function read(file) { const value=JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'')); return value?.ok===true ? value.data : value; }
const handoff=read(args['--handoff']), supplied=read(args['--stage']), stage=supplied.stage??supplied;
if (!handoff?.submissionTemplate || !handoff?.identity || !handoff?.recordId || !Number.isSafeInteger(handoff.currentRevision)) throw new Error('需要真实 handoff-topic JSON；素材交接不能代专题提交。');
for (const key of ['storeId','projectRoot','canonicalDbPath','schemaVersion','scope']) if (handoff.identity[key] === undefined) throw new Error('缺少完整数据身份。');
if (!Array.isArray(handoff.materialVersions) || !stage || typeof stage!=='object' || !stage.focus || !stage.nextStep) throw new Error('需要所据素材版本和明确 stage.focus/nextStep。');
for (const asset of [...(supplied.assets??[]),...(supplied.attachmentsToRegister??[])]) {
  const placeholder=asset.key??asset.placeholder??asset.placeholderId;
  if (placeholder && JSON.stringify(stage).includes(placeholder)) throw new Error('先受控导入原件并替换附件占位 ID，不能省略原件。');
}
const submissionId=args['--submission-id']??randomUUID();
const payload={identity:handoff.identity,submissionId,topicId:handoff.recordId,expectedRevision:handoff.currentRevision,materialVersions:handoff.materialVersions,stage};
const bytes=Buffer.from(JSON.stringify(payload,null,2)+'\n','utf8');
const handle=fs.openSync(args['--output'],'wx');try{fs.writeFileSync(handle,bytes);fs.fsyncSync(handle);}finally{fs.closeSync(handle);}
console.log(JSON.stringify({prepared:args['--output'],sha256:createHash('sha256').update(bytes).digest('hex'),topicId:payload.topicId,expectedRevision:payload.expectedRevision,submissionId,scope:payload.identity.scope,databaseWritePerformed:false,notice:'文件已准备，尚未提交。用原CLI submit-stage --file执行；结果未确认时保留本文件和ID。'}));
