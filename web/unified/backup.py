"""Four-system data ZIP. No credentials, no collection, no production overwrite."""
from pathlib import Path, PurePosixPath
import argparse, datetime, hashlib, json, os, shutil, sqlite3, sys, tempfile, time, uuid, zipfile

from backup_scope import inventory, no_links, json_object, navigation_identity, verify_navigation, allowed_member, inspect_restored, NAV_STATE

DEFAULT_ROOT=Path(__file__).resolve().parents[2]
ISOLATION=DEFAULT_ROOT/'验证'/'三系统整合'
MAX_BYTES=4*1024**3
MAX_FILES=10000
DEVICES={'CON','PRN','AUX','NUL','CONIN$','CONOUT$',*(f'COM{i}' for i in range(1,10)),*(f'LPT{i}' for i in range(1,10))}
DATABASES={'信息收集/data/opportunities.sqlite3','素材观察室/data/observatory.sqlite3'}
WORKSPACE_FILE='三系统工作台/data/workspace-state.json'
MAX_WORKSPACE_BYTES=8*1024**2
MAX_WORKSPACE_STATE_BYTES=1024**2

def workspace_record(raw,expected_root=None,expected_path=None):
    """Check a bounded snapshot without initializing or resolving any reference."""
    if not raw or len(raw)>MAX_WORKSPACE_BYTES:raise ValueError('工作台快照为空或超过8MiB')
    def unique(pairs):
        result={}
        for key,value in pairs:
            if key in result:raise ValueError('工作台快照包含重复JSON字段')
            result[key]=value
        return result
    record=json.loads(raw.decode('utf8'),object_pairs_hook=unique)
    fields={'schemaVersion','storeId','projectRoot','canonicalPath','scope','revision','stateRevision','relations','state','submissions','createdAt','updatedAt'}
    if not isinstance(record,dict) or set(record)!=fields:raise ValueError('工作台快照结构不正确')
    if type(record['schemaVersion']) is not int or record['schemaVersion']!=1 or not isinstance(record['storeId'],str) or not record['storeId'].startswith('workspace_'):raise ValueError('工作台快照身份不正确')
    try:uuid.UUID(record['storeId'][10:])
    except (ValueError,TypeError,AttributeError):raise ValueError('工作台快照storeId不正确')
    for name in ['projectRoot','canonicalPath']:
        if not isinstance(record[name],str) or not Path(record[name]).is_absolute() or any(ord(c)<32 for c in record[name]):raise ValueError('工作台快照路径身份不正确')
    same_path=lambda a,b:os.path.normcase(os.path.abspath(a))==os.path.normcase(os.path.abspath(b))
    if not same_path(record['canonicalPath'],Path(record['projectRoot'])/WORKSPACE_FILE):raise ValueError('工作台快照路径与项目身份不一致')
    if expected_root is not None and not same_path(record['projectRoot'],expected_root):raise ValueError('工作台快照不是当前项目的数据')
    if expected_path is not None and not same_path(record['canonicalPath'],expected_path):raise ValueError('工作台快照不是当前工作台路径的数据')
    if record['scope'] not in ['production','isolated'] or any(type(record[k]) is not int or not 1<=record[k]<=2**53-1 for k in ['revision','stateRevision']):raise ValueError('工作台快照范围或版本不正确')
    if not isinstance(record['relations'],list) or len(record['relations'])>2000 or not isinstance(record['submissions'],list) or len(record['submissions'])>4096 or any(not isinstance(r,dict) for r in record['submissions']):raise ValueError('工作台关系或收据结构不正确')
    modules={'learning':{'learning'},'observatory':{'material','topic'},'information':{'opportunity','work'}}
    def ref(value):
        if not isinstance(value,dict) or set(value)!={'module','kind','storeId','id'} or value.get('module') not in modules or value.get('kind') not in modules[value['module']]:raise ValueError('工作台引用结构不正确')
        if any(not isinstance(value[k],str) or not 1<=len(value[k])<=256 for k in ['storeId','id']):raise ValueError('工作台引用身份不正确')
    edges=set()
    for edge in record['relations']:
        if not isinstance(edge,dict) or set(edge)!={'edgeId','a','b','createdAt'} or not isinstance(edge['edgeId'],str) or not edge['edgeId'].startswith('edge_') or len(edge['edgeId'])!=69 or any(c not in '0123456789abcdef' for c in edge['edgeId'][5:]) or edge['edgeId'] in edges:raise ValueError('工作台关系结构不正确')
        edges.add(edge['edgeId']);ref(edge['a']);ref(edge['b'])
    state=record['state']
    if not isinstance(state,dict) or not {'lastRegion','regions','recent'}.issubset(state) or set(state)-{'lastRegion','regions','recent','observatoryRoutes'} or state['lastRegion'] not in [None,*modules] or not isinstance(state['regions'],dict) or not isinstance(state['recent'],list) or len(state['recent'])>20:raise ValueError('工作台阅读状态结构不正确')
    if 'observatoryRoutes' in state and (not isinstance(state['observatoryRoutes'],dict) or len(state['observatoryRoutes'])>40):raise ValueError('工作台素材路线结构不正确')
    for value in state['recent']:ref(value)
    if len(json.dumps(state,ensure_ascii=False,separators=(',',':')).encode('utf8'))>MAX_WORKSPACE_STATE_BYTES:raise ValueError('工作台阅读状态超过1MiB')
    for value in [record['createdAt'],record['updatedAt'],*(e['createdAt'] for e in record['relations'])]:
        if not isinstance(value,str):raise ValueError('工作台时间字段不正确')
        try:datetime.datetime.fromisoformat(value.replace('Z','+00:00'))
        except ValueError:raise ValueError('工作台时间字段不正确')
    return record

def workspace_identity(record):
    return {k:record[k] for k in ['schemaVersion','storeId','projectRoot','canonicalPath','scope','revision','stateRevision']}
def valid_name(name):
    p=PurePosixPath(name)
    if not name or any(ord(c)<32 or c in '<>\"|?*' for c in name) or '\\' in name or ':' in name or p.is_absolute() or '..' in p.parts or name!=p.as_posix() or any(part in ('','.','..') for part in name.split('/')):raise ValueError('包路径不安全')
    for part in p.parts:
        if part.endswith(('.', ' ')) or part.split('.')[0].upper() in DEVICES:raise ValueError('Windows特殊文件名不受支持')
    return p
def sha(p):
    h=hashlib.sha256()
    with p.open('rb') as f:
        for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
    return h.hexdigest()
def inside(p,root):
    return p.resolve().is_relative_to(root.resolve()) and p.resolve()!=root.resolve()
def safe_source(p,root):
    if not inside(p,root):raise ValueError('资料路径逃出项目')
    for part in [p,*p.parents]:
        if part==root:break
        if part.is_symlink() or part.is_junction():raise ValueError('备份不跟随链接目录或文件')
    if not p.is_file():raise ValueError('资料不是普通文件')
def information_assets(module,db,rows,raw):
    sys.path.insert(0,str(DEFAULT_ROOT/'信息收集'))
    from opportunities.portable import _catalog,attachment_records,collect_assets,MAX_ASSET_TOTAL_BYTES,MAX_ASSET_BYTES
    catalog=_catalog(raw)
    total=0
    for record in (catalog or {}).get('assets',{}).values():
        p=module/'static/media'/record['filename'];safe_source(p,module)
        size=p.stat().st_size
        if size>MAX_ASSET_BYTES:raise ValueError('信息图片超过现有单文件限制')
        total+=size
    for record in attachment_records(rows):
        p=db.parent/'attachments'/record['storage_name'];safe_source(p,module);total+=p.stat().st_size
    if total>MAX_ASSET_TOTAL_BYTES:raise ValueError('信息图片与证据超过现有128MiB限制，未载入内存')
    return collect_assets(module,db,rows,raw)[0]
def backup(root):
    no_links(root.absolute());root=root.resolve()
    if root!=DEFAULT_ROOT and not inside(root,ISOLATION):raise ValueError('测试项目只能在本轮隔离目录内')
    sources,navigation=inventory(root,ISOLATION,DEFAULT_ROOT)
    for source,source_root in sources.values():safe_source(source,source_root)
    if len(sources)+2>MAX_FILES or sum(source.stat().st_size for source,_ in sources.values())>MAX_BYTES:raise ValueError('备份超过4GiB或10000文件限制，未开始复制')
    baseline={name:sha(source) for name,(source,_) in sources.items()}
    output=root/'备份';output.mkdir(exist_ok=True)
    if output.is_symlink() or output.is_junction():raise ValueError('备份目录不能是链接')
    package=output/('个人终端-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S')+'-'+uuid.uuid4().hex[:8]+'.zip')
    part=package.with_suffix('.zip.part')
    manifest={'format':'xiaomo-personal-system-data','formatVersion':2,'projectRoot':str(root),'createdAt':datetime.datetime.now().astimezone().isoformat(),'consistency':'每个SQLite分别在线一致性快照；业务文件在复制前后逐文件核对未变；SQLite各自在线一致；不声明跨库同时刻事务','containsCredentials':False,'containsSourceCode':False,'containsPriorBackups':False,'files':[],'databaseSnapshots':[],'uiSaved':False,'workspaceSaved':False,'attachmentReferencesVerified':False,'navigationSaved':navigation is not None,'dataFileStabilityVerified':False,'scopeNote':'领航当前状态、原话和依据文档；学习含自然记录和学习提交回执；不含旧备份、源码、知识树、正式媒体库或凭据'}
    with tempfile.TemporaryDirectory(prefix='three-module-',dir=output) as tmp:
        staging=Path(tmp)
        used_bytes=0;used_files=0
        def reserve(size):
            nonlocal used_bytes,used_files
            if size<0 or used_files+1>MAX_FILES or used_bytes+size>MAX_BYTES:raise ValueError('备份超过4GiB或10000文件限制，未继续复制')
            used_bytes+=size;used_files+=1
        referenced=[]
        for name in ['信息收集/data/opportunities.sqlite3','素材观察室/data/observatory.sqlite3']:
            source=root/name;safe_source(source,root)
            target=staging/name;target.parent.mkdir(parents=True,exist_ok=True)
            src=sqlite3.connect(source.as_uri()+'?mode=ro',uri=True);dst=sqlite3.connect(target)
            try:
                src.execute('PRAGMA query_only=ON')
                page_size=src.execute('PRAGMA page_size').fetchone()[0];estimated=src.execute('PRAGMA page_count').fetchone()[0]*page_size
                remaining=MAX_BYTES-used_bytes;reserve(estimated)
                deadline=time.monotonic()+30
                def progress(status,left,total):
                    if time.monotonic()>deadline:raise ValueError('数据库一致性快照超过30秒；请结束正在进行的数据库操作后重试')
                    if total*page_size>remaining:raise ValueError('数据库快照增长超过备份资源限制')
                src.backup(dst,pages=256,progress=progress)
                used_bytes+=target.stat().st_size-estimated
                if used_bytes>MAX_BYTES:raise ValueError('数据库快照超限')
                if dst.execute('PRAGMA quick_check').fetchone()[0]!='ok':raise ValueError('数据库快照校验失败')
                tables=[r[0] for r in dst.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")]
                counts={t:dst.execute('SELECT count(*) FROM "'+t.replace('"','""')+'"').fetchone()[0] for t in tables}
                if name.startswith('素材观察室') and 'attachments' in tables:
                    for relative,digest,size in dst.execute('SELECT relative_path,sha256,byte_length FROM attachments'):
                        referenced.append(('素材观察室/attachments/'+relative,digest,size))
                    known={r[0] for r in dst.execute('SELECT id FROM attachments')}
                    for table in ['materials','stage_records']:
                        for row in dst.execute('SELECT body_json FROM '+table):
                            record=json.loads(row[0]);ids=record.get('attachmentIds',[])
                            ids+= [v['attachmentId'] for v in record.get('segments',[]) if v.get('attachmentId')]
                            ids+= [v['attachmentId'] for v in record.get('sources',[]) if v.get('attachmentId')]
                            ids+= [v for paragraph in record.get('paragraphs',[]) for v in paragraph.get('attachmentIds',[])]
                            if not set(ids).issubset(known):raise ValueError('素材快照包含未登记附件引用')
                    if dst.execute('PRAGMA foreign_key_check').fetchone():raise ValueError('素材数据库快照关联不一致')
                if name.startswith('信息收集') and 'settings' in tables:
                    for key,value in dst.execute("SELECT key,value FROM settings WHERE key LIKE 'library:attachments:%'"):
                        record=json.loads(value)['data'];relative='信息收集/data/attachments/'+record['storage_name']
                        referenced.append((relative,record['sha256'],record['size']))
                    catalog=root/'信息收集/config/visual_assets.json'
                    if catalog.exists():
                        dst.row_factory=sqlite3.Row
                        rows={'settings':[dict(r) for r in dst.execute("SELECT key,value FROM settings WHERE key LIKE 'library:attachments:%'")]}
                        assets=information_assets(root/'信息收集',root/name,rows,catalog.read_bytes())
                        for asset,content in assets.items():referenced.append(('信息收集/'+asset,hashlib.sha256(content).hexdigest(),len(content)))
                        del assets
            finally:src.close();dst.close()
            manifest['databaseSnapshots'].append({'path':name,'quickCheck':'ok','counts':counts})
        ui=root/'学习小岛/data/ui-state.json'
        workspace=root/WORKSPACE_FILE
        manifest['uiSaved']=ui.exists();manifest['workspaceSaved']=workspace.exists()
        for name,(source,source_root) in sorted(sources.items()):
            safe_source(source,source_root);relative=PurePosixPath(name);target=staging/relative;target.parent.mkdir(parents=True,exist_ok=True)
            valid_name(relative.as_posix());estimated=source.stat().st_size;remaining=MAX_BYTES-used_bytes;reserve(estimated)
            if source==workspace and estimated>MAX_WORKSPACE_BYTES:raise ValueError('工作台快照超过8MiB，未继续读取')
            # Reading one opened immutable/atomic-replaced file preserves its own complete version.
            with source.open('rb') as incoming,target.open('xb') as outgoing:
                copied=0
                for chunk in iter(lambda:incoming.read(1024*1024),b''):
                    copied+=len(chunk)
                    if copied>remaining:raise ValueError('资料复制增长超过备份资源限制')
                    if source==workspace and copied>MAX_WORKSPACE_BYTES:raise ValueError('工作台快照增长超过8MiB')
                    outgoing.write(chunk)
            used_bytes+=copied-estimated
            if source==ui:
                state=json.loads(target.read_text(encoding='utf8'))
                if state.get('scope') not in ['production','isolated']:raise ValueError('学习UI状态范围不正确')
                manifest['uiIdentity']={**{k:state.get(k) for k in ['storeId','revision','scope']},'canonicalPath':str(ui)}
            if source==workspace:manifest['workspaceIdentity']=workspace_identity(workspace_record(target.read_bytes(),root,workspace))
            if name==NAV_STATE:manifest['navigationIdentity']=navigation_identity(target.read_bytes(),navigation)
        for relative,digest,size in referenced:
            target=staging/PurePosixPath(relative)
            if not inside(target,staging) or not target.is_file() or target.stat().st_size!=size or sha(target)!=digest:raise ValueError('快照登记附件或图片丢失、长度或哈希不符：'+relative)
        staged_catalog=staging/'信息收集/config/visual_assets.json'
        if staged_catalog.exists():
            # This is the completed, closed staging snapshot, never the live
            # source. immutable avoids WAL/SHM sidecars on this second read.
            staged_db=staging/'信息收集/data/opportunities.sqlite3';check=sqlite3.connect(staged_db.as_uri()+'?mode=ro&immutable=1',uri=True);check.row_factory=sqlite3.Row
            try:
                rows={'settings':[dict(r) for r in check.execute("SELECT key,value FROM settings WHERE key LIKE 'library:attachments:%'")]}
                staged_assets=information_assets(staging/'信息收集',staged_db,rows,staged_catalog.read_bytes());del staged_assets
            finally:check.close()
        manifest['attachmentReferencesVerified']=True
        final_sources,final_navigation=inventory(root,ISOLATION,DEFAULT_ROOT)
        if final_navigation!=navigation or set(final_sources)!=set(sources):raise ValueError('备份期间资料列表或领航连接发生变化，请保存完成后重试')
        for name,(source,_) in final_sources.items():
            if sha(source)!=baseline[name] or sha(staging/PurePosixPath(name))!=baseline[name]:raise ValueError('备份期间资料发生变化，请保存完成后重试：'+name)
        manifest['dataFileStabilityVerified']=True
        verify_navigation(lambda name:(staging/PurePosixPath(name)).read_bytes(),set(sources),manifest)
        files=[p for p in staging.rglob('*') if p.is_file()]
        if len(files)>MAX_FILES or sum(p.stat().st_size for p in files)>MAX_BYTES:raise ValueError('备份超过4GiB或10000文件限制')
        for p in sorted(files):manifest['files'].append({'path':p.relative_to(staging).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p)})
        try:
            with zipfile.ZipFile(part,'x',compression=zipfile.ZIP_STORED) as archive:
                for p in sorted(files):archive.write(p,p.relative_to(staging).as_posix())
                archive.writestr('manifest.json',json.dumps(manifest,ensure_ascii=False,indent=2))
            validate(part);os.replace(part,package)
        except BaseException:
            if part.exists():part.unlink()
            raise
    return {'ok':True,'path':str(package),'sha256':sha(package),'bytes':package.stat().st_size,'files':len(manifest['files']),'uiSaved':manifest['uiSaved'],'workspaceSaved':manifest['workspaceSaved'],'navigationSaved':manifest['navigationSaved'],'consistency':manifest['consistency']}
def validate(package):
    with zipfile.ZipFile(package) as archive:
        entries=archive.infolist()
        if len(entries)>MAX_FILES+1:raise ValueError('包超过资源限制')
        if sum(e.file_size for e in entries if e.filename!='manifest.json')>MAX_BYTES:raise ValueError('数据超过4GiB资源限制')
        names=[]
        for e in entries:
            p=valid_name(e.filename)
            if e.filename.lower() in ('restored_isolated.json','recovery_verification.json'):raise ValueError('包成员不能占用恢复核对收据的保留文件名')
            if e.is_dir() or (e.external_attr>>16)&0o170000 not in [0,0o100000]:raise ValueError('包路径或文件类型不安全')
            names.append(e.filename)
        if len(set(n.lower() for n in names))!=len(names):raise ValueError('包存在重名')
        if archive.getinfo('manifest.json').file_size>1024**2:raise ValueError('清单过大')
        manifest=json_object(archive.read('manifest.json'))
        legacy=manifest.get('format')=='xiaomo-three-module-data' and manifest.get('formatVersion')==1
        current=manifest.get('format')=='xiaomo-personal-system-data' and manifest.get('formatVersion')==2
        if not (legacy or current):raise ValueError('包格式错误')
        if current and (manifest.get('dataFileStabilityVerified') is not True or any(not allowed_member(name) for name in names if name!='manifest.json')):raise ValueError('包超出已确认的业务数据范围或缺少文件稳定核对')
        files=manifest.get('files',[])
        if len({f['path'] for f in files})!=len(files) or set(names)!={'manifest.json',*(f['path'] for f in files)}:raise ValueError('包文件与清单不符')
        snapshots=manifest.get('databaseSnapshots',[])
        if not DATABASES.issubset(set(names)) or len(snapshots)!=2 or {s.get('path') for s in snapshots}!=DATABASES or any(s.get('quickCheck')!='ok' or not isinstance(s.get('counts'),dict) for s in snapshots):raise ValueError('完整包必须包含两份数据库一致性快照和元数据')
        if not isinstance(manifest.get('uiSaved'),bool) or manifest['uiSaved']!=('学习小岛/data/ui-state.json' in names):raise ValueError('学习UI清单不完整')
        if 'workspaceSaved' not in manifest:
            if WORKSPACE_FILE in names or 'workspaceIdentity' in manifest:raise ValueError('工作台快照缺少保存范围清单')
        else:
            if type(manifest['workspaceSaved']) is not bool or manifest['workspaceSaved']!=(WORKSPACE_FILE in names):raise ValueError('工作台保存范围清单不完整')
            if manifest['workspaceSaved']:
                if archive.getinfo(WORKSPACE_FILE).file_size>MAX_WORKSPACE_BYTES:raise ValueError('工作台快照超过8MiB')
                record=workspace_record(archive.read(WORKSPACE_FILE),manifest.get('projectRoot'))
                if manifest.get('workspaceIdentity')!=workspace_identity(record):raise ValueError('工作台快照与身份清单不符')
            elif 'workspaceIdentity' in manifest:raise ValueError('未保存工作台，不能声明工作台身份')
        if current:
            for name,limit in [('navigation-connection.json',16*1024),(NAV_STATE,8*1024**2)]:
                if name in names and archive.getinfo(name).file_size>limit:raise ValueError('领航元数据超过读取上限')
            verify_navigation(archive.read,set(names),manifest)
        for item in files:
            e=archive.getinfo(item['path']);h=hashlib.sha256()
            if e.file_size!=item['bytes']:raise ValueError('文件长度不符')
            with archive.open(e) as f:
                for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
            if h.hexdigest()!=item['sha256']:raise ValueError('包哈希不符')
        return manifest
def restore(package,target):
    target=target.absolute();no_links(target)
    if not inside(target,ISOLATION) or target.exists():raise ValueError('恢复只允许本轮全新隔离目录；不覆盖正式或已有目录')
    manifest=validate(package)
    target.mkdir(parents=True,exist_ok=False)
    if not inside(target,ISOLATION) or target.is_symlink() or target.is_junction():raise ValueError('恢复目录实际路径不安全')
    with zipfile.ZipFile(package) as archive:
        for item in manifest['files']:
            p=target/PurePosixPath(item['path']);p.parent.mkdir(parents=True,exist_ok=True)
            with archive.open(item['path']) as src,p.open('xb') as dst:shutil.copyfileobj(src,dst,1024*1024)
            if sha(p)!=item['sha256']:raise ValueError('恢复文件哈希不符')
        verification=inspect_restored(target,manifest)
        (target/'RECOVERY_VERIFICATION.json').write_text(json.dumps(verification,ensure_ascii=False,indent=2),encoding='utf8')
        (target/'RESTORED_ISOLATED.json').write_text(json.dumps({'enabledAsProduction':False,'originalProjectRoot':manifest['projectRoot'],'scope':'backup_verification_only','manifest':manifest},ensure_ascii=False,indent=2),encoding='utf8')
    return {'ok':True,'target':str(target),'files':len(manifest['files']),'hashesVerified':True,'workspaceSaved':manifest.get('workspaceSaved',False),'navigationSaved':manifest.get('navigationSaved',False),'contentVerified':True,'enabledAsProduction':False,'note':'完整文件恢复校验；工作台引用与阅读状态若有则原样保留，未修改各模块身份或将副本接入运行。旧包不含的新数据不会补出。正式切换由明确恢复任务分别受控完成。'}
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--project-root',type=Path,default=DEFAULT_ROOT);parser.add_argument('--verify',type=Path);parser.add_argument('--restore-target',type=Path)
    args=parser.parse_args()
    try:
        if args.restore_target and not args.verify:raise ValueError('恢复必须同时指定--verify包')
        if args.restore_target:result=restore(args.verify,args.restore_target)
        elif args.verify:
            verified=validate(args.verify);result={'ok':True,'verifiedFiles':len(verified['files']),'workspaceSaved':verified.get('workspaceSaved',False),'navigationSaved':verified.get('navigationSaved',False)}
        else:result=backup(args.project_root)
        print(json.dumps(result,ensure_ascii=False))
    except Exception as error:print(json.dumps({'ok':False,'error':str(error)},ensure_ascii=False));raise SystemExit(1)
