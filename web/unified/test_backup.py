"""Run with existing Python. All records are synthetic and stay below 验证/三系统整合."""
from pathlib import Path
import hashlib, json, os, sqlite3, subprocess, sys, unittest, uuid, zipfile
import backup

RUN = backup.ISOLATION / ('four-system-backup-test-' + uuid.uuid4().hex[:8])
RUN.mkdir(parents=True)

def directory_link(target, link):
    if os.name == 'nt':
        subprocess.run(['pwsh','-NoProfile','-Command','New-Item -ItemType Junction -Path $env:BACKUP_TEST_LINK -Target $env:BACKUP_TEST_TARGET | Out-Null'],env={**os.environ,'BACKUP_TEST_LINK':str(link),'BACKUP_TEST_TARGET':str(target)},check=True)
    else: os.symlink(target,link,target_is_directory=True)

def write(root, name, value):
    file = root / name; file.parent.mkdir(parents=True, exist_ok=True)
    file.write_bytes(value if isinstance(value, bytes) else json.dumps(value, ensure_ascii=False).encode('utf8') if isinstance(value, (dict, list)) else value.encode('utf8'))
    return file

def fixture():
    root = RUN / uuid.uuid4().hex; root.mkdir()
    for name in backup.DATABASES:
        file = root / name; file.parent.mkdir(parents=True)
        db = sqlite3.connect(file); db.execute('CREATE TABLE test_record(id TEXT PRIMARY KEY, body TEXT)')
        db.execute('INSERT INTO test_record VALUES (?,?)', ('stable-item-id', '合成记录，不是本人经历')); db.commit(); db.close()
    for name in ('个人情况', '当前状态', '课程记录', '阶段安排', '观影记录', '能力依据'): write(root, '运行记录/' + name + '.md', '# 隔离演练\n')
    write(root, '运行记录/.自然记录/intake_fixture01.json', {'status': 'committed', 'fixture': True})
    write(root, '运行记录/.学习提交/learning_fixture01.json', {'status': 'committed', 'fixture': True})
    write(root, '运行记录/我的内容/content_fixture01.json', {'fixture': True, '原话': '合成原话', 'AI': '合成解释'})
    write(root, '运行记录/学习记录/2026-10-05.md', '# 合成课程笔记\n原话与AI分别保存\n')
    write(root, '运行记录/.自然记录/ignored.tmp', '暂存文件不归档')
    write(root, '学习小岛/data/ui-state.json', {'scope': 'isolated', 'storeId': 'ui-fixture-id', 'revision': 7, 'state': {'draft': '合成草稿'}})
    workspace={'schemaVersion':1,'storeId':'workspace_'+str(uuid.uuid4()),'projectRoot':str(root),'canonicalPath':str(root/backup.WORKSPACE_FILE),'scope':'isolated','revision':3,'stateRevision':4,'relations':[],'state':{'lastRegion':None,'regions':{},'recent':[]},'submissions':[],'createdAt':'2026-10-05T00:00:00Z','updatedAt':'2026-10-05T00:00:00Z'}
    write(root, backup.WORKSPACE_FILE, workspace)
    nav = root / '领航原址'
    write(root, 'navigation-connection.json', {'schemaVersion':1,'navigationRoot':str(nav)})
    state={'schema':'xiaomo.navigation-state/v2','revision':2,'focus':{},'decisions':[],'applied_events':['fixture-save-1'],'records':[{'id':'R-fixture','kind':'user_report','content':'仅为恢复演练的原话','journey_document':{'entry_id':'R-fixture','file':'依据/记录.md'}}],'resources':[],'routes':[]}
    write(nav, '状态/领航状态.json', state)
    write(nav, '状态/备份/old.json', {'shouldNotBeIncluded':True})
    write(nav, '依据/记录.md', '# 合成关联文档\n')
    write(nav, '依据/原始转写/source.txt', '嗯，保留原始转写语气。')
    write(nav, '当前处境.md', '# 合成处境\n'); write(nav, '人生罗盘.md', '# 合成罗盘\n')
    write(nav, 'connections.json', {'schema':'xiaomo.navigation-connections/v1','systems':{}})
    write(root, 'web/.env', 'TOKEN=never-export-this-fixture')
    return root

class BackupTests(unittest.TestCase):
    def setUp(self): self.root = fixture()
    def package(self): return Path(backup.backup(self.root)['path'])
    def test_full_restore_content_and_identity(self):
        package=self.package(); manifest=backup.validate(package)
        self.assertTrue(manifest['navigationSaved']); self.assertEqual(manifest['navigationIdentity']['revision'],2)
        target=self.root/'new-restore'; result=backup.restore(package,target)
        self.assertTrue(result['contentVerified']); self.assertFalse(result['enabledAsProduction'])
        for item in manifest['files']: self.assertEqual(backup.sha(target/item['path']),item['sha256'])
        self.assertEqual((target/'领航室/依据/原始转写/source.txt').read_text('utf8'),'嗯，保留原始转写语气。')
        self.assertEqual(json.loads((target/backup.WORKSPACE_FILE).read_text('utf8'))['storeId'],manifest['workspaceIdentity']['storeId'])
        report=json.loads((target/'RECOVERY_VERIFICATION.json').read_text('utf8')); self.assertEqual(len(report['databases']),2)
        self.assertEqual(report['navigation']['ids']['records'],['R-fixture'])
        names={f['path'] for f in manifest['files']}
        self.assertTrue({'运行记录/.自然记录/intake_fixture01.json','运行记录/.学习提交/learning_fixture01.json','运行记录/学习记录/2026-10-05.md'}.issubset(names))
        self.assertFalse(any('.tmp' in name or name.startswith('web/') or '/备份/' in name for name in names))
    def test_existing_target_rejected(self):
        with self.assertRaises(ValueError): backup.restore(self.package(),self.root)
    def test_formal_target_rejected(self):
        with self.assertRaises(ValueError): backup.restore(self.package(),backup.DEFAULT_ROOT/'forbidden')
    def test_missing_navigation_document_rejected(self):
        (self.root/'领航原址/依据/记录.md').unlink()
        with self.assertRaises(ValueError): self.package()
    def test_navigation_external_reference_rejected(self):
        file=self.root/'领航原址/状态/领航状态.json'; state=json.loads(file.read_text('utf8'));state['records'][0]['journey_document']['file']='../../outside.md';write(self.root,file.relative_to(self.root),state)
        with self.assertRaises(ValueError): self.package()
    def test_navigation_external_root_in_test_rejected(self):
        write(self.root,'navigation-connection.json',{'schemaVersion':1,'navigationRoot':str(backup.DEFAULT_ROOT)})
        with self.assertRaises(ValueError): self.package()
    def test_config_with_credentials_rejected(self):
        write(self.root,'navigation-connection.json',{'schemaVersion':1,'navigationRoot':str(self.root/'领航原址'),'apiKey':'fixture-only'})
        with self.assertRaises(ValueError): self.package()
    def test_active_save_rejected_without_touching_lock(self):
        file=write(self.root,'运行记录/.自然记录/active-request.lock','active')
        with self.assertRaises(ValueError): self.package()
        self.assertEqual(file.read_text(),'active')
    def test_pending_recovery_journal_is_preserved_and_reported(self):
        write(self.root,'运行记录/.学习提交/pending-request.json',{'status':'interrupted','targets':[{'relative':'运行记录/学习记录/2026-10-05.md','newText':'合成冻结写入'}]})
        result=backup.restore(self.package(),self.root/'pending-restore')
        report=json.loads((Path(result['target'])/'RECOVERY_VERIFICATION.json').read_text('utf8'))
        self.assertEqual(report['pendingLearningRequests'][0]['status'],'interrupted')
    def test_live_wal_included_and_uncommitted_excluded(self):
        file=self.root/'信息收集/data/opportunities.sqlite3'; db=sqlite3.connect(file); db.execute('PRAGMA journal_mode=WAL');db.execute('PRAGMA wal_autocheckpoint=0')
        db.execute('INSERT INTO test_record VALUES (?,?)',('committed-WAL','原库WAL已提交'));db.commit();db.execute('INSERT INTO test_record VALUES (?,?)',('uncommitted','不可进入快照'))
        try:
            target=self.root/'wal-restore';backup.restore(self.package(),target)
            with sqlite3.connect(target/'信息收集/data/opportunities.sqlite3') as restored:
                ids={r[0] for r in restored.execute('SELECT id FROM test_record')}
            self.assertIn('committed-WAL',ids);self.assertNotIn('uncommitted',ids)
        finally: db.rollback();db.close()
    def test_live_wal_with_visual_catalog_second_read_creates_no_sidecars(self):
        # Use the existing asset validator, with a synthetic empty catalog. The
        # catalog's presence must take the real second-read validation branch.
        runtime=next(parent for parent in Path(__file__).resolve().parents if (parent/'信息收集/opportunities/portable.py').is_file())
        sys.path.insert(0,str(runtime/'信息收集'))
        write(self.root,'信息收集/config/visual_assets.json',{'schema_version':1,'assets':{},'items':{}})
        file=self.root/'信息收集/data/opportunities.sqlite3';db=sqlite3.connect(file)
        db.execute('PRAGMA journal_mode=WAL');db.execute('PRAGMA wal_autocheckpoint=0')
        db.execute('CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT)')
        db.execute('INSERT INTO test_record VALUES (?,?)',('catalog-WAL-committed','必须进入快照'));db.commit()
        db.execute('INSERT INTO test_record VALUES (?,?)',('catalog-WAL-uncommitted','不得进入快照'))
        try:
            package=self.package();manifest=backup.validate(package)
            names={item['path'] for item in manifest['files']}
            self.assertIn('信息收集/config/visual_assets.json',names)
            self.assertFalse(any(name.endswith(('-wal','-shm','-journal')) for name in names))
            target=self.root/'catalog-wal-restored';backup.restore(package,target)
            with sqlite3.connect((target/'信息收集/data/opportunities.sqlite3').as_uri()+'?mode=ro&immutable=1',uri=True) as restored:
                ids={row[0] for row in restored.execute('SELECT id FROM test_record')}
            self.assertIn('catalog-WAL-committed',ids);self.assertNotIn('catalog-WAL-uncommitted',ids)
            self.assertTrue(Path(str(file)+'-wal').exists(),'active source WAL must remain intact')
        finally:db.rollback();db.close()
    def test_copy_change_rejected(self):
        real_sha=backup.sha; file=self.root/'运行记录/个人情况.md';seen=0
        def changed(path):
            nonlocal seen
            if path==file:
                seen+=1
                if seen==2: file.write_text('合成并发改动','utf8')
            return real_sha(path)
        backup.sha=changed
        try:
            with self.assertRaisesRegex(ValueError,'发生变化'):self.package()
        finally:backup.sha=real_sha
    def test_path_traversal_devices_and_ads_rejected(self):
        for name in ('../outside','C:/outside','a\\b','a/./b','a//b','NUL.txt','a/CON','a:stream','a.','a?b','.'):
            with self.subTest(name=name),self.assertRaises(ValueError):backup.valid_name(name)
    def test_symlink_root_and_restore_ancestor_rejected(self):
        source=self.root/'linked';directory_link(self.root/'领航原址',source)
        with self.assertRaises(ValueError):backup.backup(source)
        source.rmdir() if source.is_junction() else source.unlink()
        package=self.package();directory_link(self.root/'领航原址',source)
        with self.assertRaises(ValueError):backup.restore(package,source/'new')
    def test_nested_symlink_rejected(self):
        directory_link(self.root/'领航原址',self.root/'运行记录/redirect')
        with self.assertRaises(ValueError):self.package()
    def test_archive_tamper_rejected(self):
        package=self.package();evil=self.root/'tampered.zip'
        with zipfile.ZipFile(package) as src,zipfile.ZipFile(evil,'w') as dst:
            for name in src.namelist():dst.writestr(name,b'changed' if name=='领航室/依据/记录.md' else src.read(name))
        with self.assertRaises(ValueError):backup.validate(evil)
    def test_missing_database_rejected(self):
        package=self.package();evil=self.root/'missing-db.zip'
        with zipfile.ZipFile(package) as src,zipfile.ZipFile(evil,'w') as dst:
            for name in src.namelist():
                if name!='信息收集/data/opportunities.sqlite3':dst.writestr(name,src.read(name))
        with self.assertRaises(ValueError):backup.validate(evil)
    def test_legacy_three_module_package_supported(self):
        package=self.package();legacy=self.root/'legacy.zip'
        with zipfile.ZipFile(package) as src,zipfile.ZipFile(legacy,'w') as dst:
            manifest=json.loads(src.read('manifest.json'));manifest.update(format='xiaomo-three-module-data',formatVersion=1)
            manifest.pop('navigationSaved');manifest.pop('navigationIdentity')
            manifest['files']=[f for f in manifest['files'] if not f['path'].startswith('领航室/') and f['path']!='navigation-connection.json']
            for item in manifest['files']:dst.writestr(item['path'],src.read(item['path']))
            dst.writestr('manifest.json',json.dumps(manifest))
        restored=backup.restore(legacy,self.root/'legacy-restore');self.assertFalse(restored['navigationSaved'])
    def test_reserved_recovery_names_rejected_for_legacy_packages(self):
        package=self.package()
        for reserved in ('RESTORED_ISOLATED.json','recovery_verification.JSON'):
            evil=self.root/(reserved+'.zip'); content=b'{}'
            with zipfile.ZipFile(package) as src,zipfile.ZipFile(evil,'w') as dst:
                manifest=json.loads(src.read('manifest.json'));manifest.update(format='xiaomo-three-module-data',formatVersion=1)
                manifest['files'].append({'path':reserved,'bytes':len(content),'sha256':hashlib.sha256(content).hexdigest()})
                for name in src.namelist():
                    if name!='manifest.json':dst.writestr(name,src.read(name))
                dst.writestr(reserved,content);dst.writestr('manifest.json',json.dumps(manifest))
            with self.assertRaisesRegex(ValueError,'保留文件名'):backup.validate(evil)

if __name__=='__main__':
    suite=unittest.defaultTestLoader.loadTestsFromTestCase(BackupTests)
    result=unittest.TextTestRunner(verbosity=2).run(suite)
    write(RUN,'evidence.json',{'syntheticOnly':True,'tests':result.testsRun,'failures':len(result.failures),'errors':len(result.errors),'ok':result.wasSuccessful(),'runDirectory':str(RUN)})
    print(json.dumps({'ok':result.wasSuccessful(),'tests':result.testsRun,'runDirectory':str(RUN)},ensure_ascii=False))
    raise SystemExit(not result.wasSuccessful())
