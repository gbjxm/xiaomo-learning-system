"""Three-module data ZIP. No credentials, no collection, no production overwrite."""
from pathlib import Path, PurePosixPath
import argparse, datetime, hashlib, json, os, shutil, sqlite3, sys, tempfile, uuid, zipfile

DEFAULT_ROOT=Path(__file__).resolve().parents[2]
ISOLATION=DEFAULT_ROOT/'验证'/'三系统整合'
MAX_BYTES=4*1024**3
MAX_FILES=10000
DEVICES={'CON','PRN','AUX','NUL','CONIN$','CONOUT$',*(f'COM{i}' for i in range(1,10)),*(f'LPT{i}' for i in range(1,10))}
DATABASES={'信息收集/data/opportunities.sqlite3','素材观察室/data/observatory.sqlite3'}
def valid_name(name):
    p=PurePosixPath(name)
    if not name or any(ord(c)<32 for c in name) or '\\' in name or ':' in name or p.is_absolute() or '..' in p.parts or name!=p.as_posix():raise ValueError('包路径不安全')
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
    root=root.resolve()
    if root!=DEFAULT_ROOT and not inside(root,ISOLATION):raise ValueError('测试项目只能在本轮隔离目录内')
    output=root/'备份';output.mkdir(exist_ok=True)
    if output.is_symlink() or output.is_junction():raise ValueError('备份目录不能是链接')
    package=output/('三系统-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S')+'-'+uuid.uuid4().hex[:8]+'.zip')
    part=package.with_suffix('.zip.part')
    manifest={'format':'xiaomo-three-module-data','formatVersion':1,'projectRoot':str(root),'createdAt':datetime.datetime.now().astimezone().isoformat(),'consistency':'每个SQLite分别在线一致性快照；UI状态单次原子文件快照；不声明跨库同时刻事务','containsCredentials':False,'containsSourceCode':False,'containsPriorBackups':False,'files':[],'databaseSnapshots':[],'uiSaved':False,'attachmentReferencesVerified':False}
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
                def progress(status,left,total):
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
        sources=[]
        for name in ['运行记录','信息收集/static/media','信息收集/data/attachments','素材观察室/attachments']:
            directory=root/name
            if directory.exists():
                for p in directory.rglob('*'):
                    if p.is_file() and not p.name.endswith('.part') and '.incoming' not in p.parts:sources.append(p)
        for name in ['sources.json','rules.json','visual_assets.json']:
            p=root/'信息收集/config'/name
            if p.exists():sources.append(p)
        ui=root/'学习小岛/data/ui-state.json'
        if ui.exists():sources.append(ui);manifest['uiSaved']=True
        for source in sorted(set(sources)):
            safe_source(source,root);relative=source.relative_to(root);target=staging/relative;target.parent.mkdir(parents=True,exist_ok=True)
            valid_name(relative.as_posix());estimated=source.stat().st_size;remaining=MAX_BYTES-used_bytes;reserve(estimated)
            # Reading one opened immutable/atomic-replaced file preserves its own complete version.
            with source.open('rb') as incoming,target.open('xb') as outgoing:
                copied=0
                for chunk in iter(lambda:incoming.read(1024*1024),b''):
                    copied+=len(chunk)
                    if copied>remaining:raise ValueError('资料复制增长超过备份资源限制')
                    outgoing.write(chunk)
            used_bytes+=copied-estimated
            if source==ui:
                state=json.loads(target.read_text(encoding='utf8'))
                if state.get('scope') not in ['production','isolated']:raise ValueError('学习UI状态范围不正确')
                manifest['uiIdentity']={**{k:state.get(k) for k in ['storeId','revision','scope']},'canonicalPath':str(ui)}
        for relative,digest,size in referenced:
            target=staging/PurePosixPath(relative)
            if not inside(target,staging) or not target.is_file() or target.stat().st_size!=size or sha(target)!=digest:raise ValueError('快照登记附件或图片丢失、长度或哈希不符：'+relative)
        staged_catalog=staging/'信息收集/config/visual_assets.json'
        if staged_catalog.exists():
            staged_db=staging/'信息收集/data/opportunities.sqlite3';check=sqlite3.connect(staged_db.as_uri()+'?mode=ro',uri=True);check.row_factory=sqlite3.Row
            try:
                rows={'settings':[dict(r) for r in check.execute("SELECT key,value FROM settings WHERE key LIKE 'library:attachments:%'")]}
                staged_assets=information_assets(staging/'信息收集',staged_db,rows,staged_catalog.read_bytes());del staged_assets
            finally:check.close()
        manifest['attachmentReferencesVerified']=True
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
    return {'ok':True,'path':str(package),'sha256':sha(package),'bytes':package.stat().st_size,'files':len(manifest['files']),'uiSaved':manifest['uiSaved'],'consistency':manifest['consistency']}
def validate(package):
    with zipfile.ZipFile(package) as archive:
        entries=archive.infolist()
        if len(entries)>MAX_FILES+1:raise ValueError('包超过资源限制')
        if sum(e.file_size for e in entries if e.filename!='manifest.json')>MAX_BYTES:raise ValueError('数据超过4GiB资源限制')
        names=[]
        for e in entries:
            p=valid_name(e.filename)
            if e.is_dir() or (e.external_attr>>16)&0o170000 not in [0,0o100000]:raise ValueError('包路径或文件类型不安全')
            names.append(e.filename)
        if len(set(n.lower() for n in names))!=len(names):raise ValueError('包存在重名')
        if archive.getinfo('manifest.json').file_size>1024**2:raise ValueError('清单过大')
        manifest=json.loads(archive.read('manifest.json'))
        if manifest.get('format')!='xiaomo-three-module-data' or manifest.get('formatVersion')!=1:raise ValueError('包格式错误')
        files=manifest.get('files',[])
        if len({f['path'] for f in files})!=len(files) or set(names)!={'manifest.json',*(f['path'] for f in files)}:raise ValueError('包文件与清单不符')
        snapshots=manifest.get('databaseSnapshots',[])
        if not DATABASES.issubset(set(names)) or len(snapshots)!=2 or {s.get('path') for s in snapshots}!=DATABASES or any(s.get('quickCheck')!='ok' or not isinstance(s.get('counts'),dict) for s in snapshots):raise ValueError('完整包必须包含两份数据库一致性快照和元数据')
        if not isinstance(manifest.get('uiSaved'),bool) or manifest['uiSaved']!=('学习小岛/data/ui-state.json' in names):raise ValueError('学习UI清单不完整')
        for item in files:
            e=archive.getinfo(item['path']);h=hashlib.sha256()
            if e.file_size!=item['bytes']:raise ValueError('文件长度不符')
            with archive.open(e) as f:
                for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
            if h.hexdigest()!=item['sha256']:raise ValueError('包哈希不符')
        return manifest
def restore(package,target):
    target=target.absolute()
    if not inside(target,ISOLATION) or target.exists():raise ValueError('恢复只允许本轮全新隔离目录；不覆盖正式或已有目录')
    manifest=validate(package)
    target.mkdir(parents=True)
    if not inside(target,ISOLATION) or target.is_symlink() or target.is_junction():raise ValueError('恢复目录实际路径不安全')
    with zipfile.ZipFile(package) as archive:
        for item in manifest['files']:
            p=target/PurePosixPath(item['path']);p.parent.mkdir(parents=True,exist_ok=True)
            with archive.open(item['path']) as src,p.open('xb') as dst:shutil.copyfileobj(src,dst,1024*1024)
            if sha(p)!=item['sha256']:raise ValueError('恢复文件哈希不符')
        (target/'RESTORED_ISOLATED.json').write_text(json.dumps({'enabledAsProduction':False,'originalProjectRoot':manifest['projectRoot'],'scope':'backup_verification_only','manifest':manifest},ensure_ascii=False,indent=2),encoding='utf8')
    return {'ok':True,'target':str(target),'files':len(manifest['files']),'hashesVerified':True,'enabledAsProduction':False,'note':'完整文件恢复校验；未修改各模块身份或将副本接入运行。正式切换由明确恢复任务分别受控完成。'}
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--project-root',type=Path,default=DEFAULT_ROOT);parser.add_argument('--verify',type=Path);parser.add_argument('--restore-target',type=Path)
    args=parser.parse_args()
    try:
        if args.restore_target and not args.verify:raise ValueError('恢复必须同时指定--verify包')
        result=restore(args.verify,args.restore_target) if args.restore_target else {'ok':True,'verifiedFiles':len(validate(args.verify)['files'])} if args.verify else backup(args.project_root)
        print(json.dumps(result,ensure_ascii=False))
    except Exception as error:print(json.dumps({'ok':False,'error':str(error)},ensure_ascii=False));raise SystemExit(1)
