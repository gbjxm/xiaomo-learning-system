from pathlib import Path
import subprocess,json,sqlite3,uuid,zipfile,hashlib
ROOT=Path(__file__).resolve().parents[2]
RUN=Path(__file__).resolve().parent/('backup-test-'+uuid.uuid4().hex[:8]);RUN.mkdir()
for module in ['信息收集','素材观察室']:
    p=RUN/module/'data';p.mkdir(parents=True)
    db=sqlite3.connect(p/('opportunities.sqlite3' if module=='信息收集' else 'observatory.sqlite3'))
    db.execute('CREATE TABLE synthetic_fixture(id TEXT PRIMARY KEY,note TEXT)')
    db.execute('INSERT INTO synthetic_fixture VALUES(?,?)',('TEST-'+module,'隔离自造测试，不来自真实用户数据库'));db.commit();db.close()
ui=RUN/'学习小岛/data/ui-state.json';ui.parent.mkdir(parents=True);ui.write_text(json.dumps({'scope':'isolated','storeId':'TEST-UI','revision':3,'state':{'draft':'隔离测试草稿'}},ensure_ascii=False),encoding='utf8')
asset=RUN/'素材观察室/attachments/test.txt';asset.parent.mkdir(parents=True);asset.write_text('自造附件夹具',encoding='utf8')
fixture_db=sqlite3.connect(RUN/'素材观察室/data/observatory.sqlite3')
fixture_db.execute('CREATE TABLE attachments(id TEXT,relative_path TEXT,sha256 TEXT,byte_length INTEGER)')
fixture_db.execute('CREATE TABLE materials(body_json TEXT)');fixture_db.execute('CREATE TABLE stage_records(body_json TEXT)')
fixture_db.execute('INSERT INTO attachments VALUES(?,?,?,?)',('TEST-ATT','test.txt',hashlib.sha256(asset.read_bytes()).hexdigest(),asset.stat().st_size))
fixture_db.execute('INSERT INTO materials VALUES(?)',(json.dumps({'attachmentIds':['TEST-ATT']}),))
fixture_db.commit();fixture_db.close()
config=RUN/'信息收集/config/rules.json';config.parent.mkdir(parents=True);config.write_text('{"test":true}',encoding='utf8')
def invoke(*args,ok=True):
    r=subprocess.run(['python','-X','utf8',str(ROOT/'web/unified/backup.py'),*map(str,args)],capture_output=True,text=True,encoding='utf8')
    j=json.loads(r.stdout)
    assert j['ok'] is ok,j
    return j
created=invoke('--project-root',RUN)
verified=invoke('--verify',created['path'])
target=RUN/'isolated-recovery';restored=invoke('--verify',created['path'],'--restore-target',target)
assert restored['enabledAsProduction'] is False
assert (target/'素材观察室/attachments/test.txt').read_bytes()==asset.read_bytes()
assert json.loads((target/'学习小岛/data/ui-state.json').read_text(encoding='utf8'))['state']['draft']=='隔离测试草稿'
for module in ['信息收集','素材观察室']:
    p=target/module/'data'/('opportunities.sqlite3' if module=='信息收集' else 'observatory.sqlite3')
    db=sqlite3.connect(p.as_uri()+'?mode=ro',uri=True);assert db.execute('PRAGMA quick_check').fetchone()[0]=='ok';assert db.execute('SELECT count(*) FROM synthetic_fixture').fetchone()[0]==1;db.close()
rejected=invoke('--verify',created['path'],'--restore-target',target,ok=False)
unsafe=RUN/'unsafe.zip'
with zipfile.ZipFile(unsafe,'w') as archive:archive.writestr('../escape.txt','unsafe');archive.writestr('manifest.json','{}')
bad=invoke('--verify',unsafe,ok=False)
asset.write_text('故意篡改隔离附件',encoding='utf8')
tampered=invoke('--project-root',RUN,ok=False)
device=RUN/'device.zip'
with zipfile.ZipFile(device,'w') as archive:archive.writestr('NUL.txt','unsafe');archive.writestr('manifest.json','{}')
device_rejected=invoke('--verify',device,ok=False)
empty=RUN/'incomplete.zip'
with zipfile.ZipFile(empty,'w') as archive:archive.writestr('manifest.json',json.dumps({'format':'xiaomo-three-module-data','formatVersion':1,'files':[]}))
empty_rejected=invoke('--verify',empty,ok=False)
report={'fixtureScope':'self_created_synthetic_only','created':created,'verified':verified,'restored':restored,'checks':['twoSQLiteOnlineSnapshots','UIRevisionAndDraft','originalAttachmentBytes','snapshotHashManifest','newIsolatedRestoreOnly','existingTargetRejected','traversalZipRejected','registeredAttachmentMismatchRejected','windowsDeviceRejected','incompletePackageRejected'],'allPassed':True,'existingTargetError':rejected['error'],'unsafeError':bad['error'],'attachmentMismatchError':tampered['error'],'deviceError':device_rejected['error'],'emptyError':empty_rejected['error']}
(RUN/'evidence.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
(Path(__file__).resolve().parent/'统一备份验收.json').write_text(json.dumps({'runDirectory':str(RUN),**report},ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({'ok':True,'checks':len(report['checks']),'runDirectory':str(RUN)},ensure_ascii=False))
