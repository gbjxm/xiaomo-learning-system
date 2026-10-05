import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {LEARNING_ROOT} from './records.mjs';
import {LearningCoordinator,validateLearningContext} from './coordinator.mjs';

export async function runIntakeCLI(argv,{stdout=value=>process.stdout.write(value+'\n')}={}){
  const args=[...argv],command=args.shift()??'help',positionals=[],options={};
  while(args.length){const a=args.shift();if(a.startsWith('--')){if(!['--input','--project-root','--scope'].includes(a)||!args.length||options[a]!==undefined)throw new Error('未知、缺值或重复参数：'+a);options[a]=args.shift();}else positionals.push(a);}
  if(['help','--help','-h'].includes(command)){stdout('自然记录 CLI\nprepare --input 请求JSON\ncommit --input 提交JSON（payload、reply、capture、contextSnapshot）\nrequest <requestId>\nprepare只读、不调用模型；commit保存当次实际原话与答复。隔离测试加 --project-root <隔离根> --scope isolated；同一请求重试沿用requestId。');return;}
  const coordinator=new LearningCoordinator({projectRoot:options['--project-root']?path.resolve(options['--project-root']):LEARNING_ROOT,scope:options['--scope']??'production'}),intake=coordinator.intake;
  if(command==='request'){stdout(JSON.stringify(await intake.requestStatus(positionals[0]),null,2));return;}
  if(!['prepare','commit'].includes(command)||!options['--input'])throw new Error('需要prepare或commit及--input文件。');
  const file=path.resolve(options['--input']),stat=await fs.stat(file);if(!stat.isFile()||stat.size>2*1024*1024)throw new Error('输入必须是不超过2MiB的JSON文件。');
  const input=JSON.parse((await fs.readFile(file,'utf8')).replace(/^\uFEFF/,'')),p=input.payload??input;
  if(!p||!['chat','question','progress','wrap','plan'].includes(p.mode)||!Array.isArray(p.history??[])||(p.history??[]).some(x=>!['user','assistant'].includes(x.role)||typeof x.content!=='string'))throw new Error('请求模式或历史无效。');
  const payload={...p,history:p.history??[],context:validateLearningContext(p.context),skipSave:!!p.skipSave};
  const result=command==='prepare'?await intake.prepare(payload):await intake.commit({...input,payload});stdout(JSON.stringify(result,null,2));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))runIntakeCLI(process.argv.slice(2)).catch(e=>{process.stderr.write(JSON.stringify({ok:false,error:e.message,code:e.code??'INTAKE_CLI_ERROR'})+'\n');process.exitCode=1;});
