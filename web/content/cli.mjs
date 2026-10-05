import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { LEARNING_ROOT, readLearningFile } from '../learning/records.mjs';
import { ContentStore } from './store.mjs';
import { withContentSources } from '../learning/content-sources.mjs';

async function readStore(native) {
  // A command must not inherit a stale/foreign NAVIGATION_ROOT from the shell.
  // Production resolves the fixed connection file in the existing bridge;
  // isolated commands may reference only their own explicit connection file.
  const {NAVIGATION_ROOT:unusedNavigationRoot,...inherited}=process.env;
  const env={...inherited,WORKSPACE_MODE:native.scope};
  if(native.scope==='isolated') {
    env.NAVIGATION_ROOT='';
    try {
      const raw=await readLearningFile(native.root,'navigation-connection.json');
      const config=raw===null?null:JSON.parse(raw.replace(/^\uFEFF/,''));
      if(config?.schemaVersion===1&&typeof config.navigationRoot==='string')env.NAVIGATION_ROOT=config.navigationRoot;
    }catch { /* The shared source wrapper reports the unavailable source as a warning. */ }
  }
  return withContentSources(native,{projectRoot:native.root,env});
}

export async function runCLI(args=process.argv.slice(2)) {
  const command=args.shift(),options={};
  while(args.length){const key=args.shift();if(!['--root','--scope','--kind','--query','--id','--input'].includes(key)||!args.length)throw new Error('参数无效。用法：node web/content/cli.mjs bootstrap|list|detail|save [--root 绝对目录 --scope isolated] [--id 编号] [--kind all|creation|watch] [--query 关键词] [--input JSON文件]');options[key.slice(2)]=args.shift();}
  const native=new ContentStore({projectRoot:options.root??LEARNING_ROOT,scope:options.scope??'production'});
  if(command==='save'){if(!options.input)throw new Error('save需要 --input JSON文件（含identity、expectedRevision、submissionId、item及可选action）；不自动补观看日期。');return native.save(JSON.parse(await fs.readFile(options.input,'utf8')));}
  const store=await readStore(native);
  if(command==='bootstrap')return store.bootstrap();
  if(command==='list')return store.list({kind:options.kind??'all',q:options.query??''});
  if(command==='detail')return store.detail(options.id);
  throw new Error('支持命令：bootstrap、list、detail、save。');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)runCLI().then(result=>process.stdout.write(JSON.stringify(result,null,2)+'\n')).catch(error=>{process.stderr.write(JSON.stringify({error:{code:error.code??'CONTENT_CLI_FAILED',message:error.message,details:error.details??{}}})+'\n');process.exitCode=1;});
