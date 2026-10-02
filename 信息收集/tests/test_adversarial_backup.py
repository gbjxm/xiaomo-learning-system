"""Restore durability uses actual subprocess exits, never caught fake crashes."""
from __future__ import annotations
import copy
import hashlib
import json
import os
import sqlite3
import subprocess
import sys
import threading
import time
import unittest
import zipfile
from contextlib import closing
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from helpers import ScopedTemp
import opportunities.backup as backup_module
from opportunities.backup import BackupError, BackupManager, FILES, JOURNAL_NAME, RESTORE_RECEIPT_KEY
from opportunities.model import empty_document, identity, json_text, utcnow
from opportunities.storage import AlreadyRunning, ProcessLock, Store


def state(store):
    with store.connection() as conn:
        rows = {table: [list(row) for row in conn.execute(f"SELECT * FROM {table} ORDER BY rowid")] for table, in conn.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")}
    return {"rows": rows, "configs": {name: (store.root/name).read_text(encoding="utf-8") for name in FILES[1:]}}


def populate(root):
    root.mkdir(parents=True, exist_ok=True)
    (root/"config").mkdir(exist_ok=True)
    source={"id":"libtv","name":"离线副本","platform":"LibTV","url":"https://www.liblib.tv/activity","allowed_hosts":["www.liblib.tv"],"adapter":"libtv","scope":"隔离测试","note":"backup-generation"}
    (root/"config/sources.json").write_text(json_text([source]),encoding="utf-8")
    rules=json.loads((ROOT/"config/rules.json").read_text(encoding="utf-8"));rules["profile_label"]="backup-generation"
    (root/"config/rules.json").write_text(json_text(rules),encoding="utf-8")
    store=Store(root,seed=False)
    doc=empty_document("libtv","恢复崩溃一致性","LibTV","https://www.liblib.tv/activity/777777","2026 / 隔离")
    store.upsert(doc);doc["summary"]="第二版记录";store.upsert(doc)
    store.preference(identity(doc),starred=True,note="backup-generation")
    store.start_run("isolated-run")
    store.observe("libtv",doc["official_url"],"原文甲","raw-a","isolated-run","partial",{"article":{"state":"partial_text"}})
    store.observe("libtv",doc["official_url"],"原文乙","raw-b","isolated-run","partial",{"article":{"state":"partial_text"}})
    store.record_attempt("isolated-run",source,{"status":"success","message":"隔离检查","pages":2,"coverage":{"article":{"state":"partial_text"}}},utcnow())
    store.finish_run("isolated-run",{"counts":{"success":1}})
    with store.connection() as conn:
        conn.execute("INSERT INTO settings VALUES('seeds_imported','1')")
        conn.execute("INSERT INTO settings VALUES('unknown-setting','原样保留')")
        conn.execute("UPDATE opportunities SET archived_at=?,last_observed_at=?",(utcnow(),utcnow()))
        conn.execute("INSERT INTO discovery_candidates VALUES(?,?,?,?,?,?,?,?,?,?,?)",("d"*24,"libtv","https://www.liblib.tv/activity/777778","2026 / 候选","待核线索",utcnow(),utcnow(),json_text({"list_url":source["url"]}),"线索正文","pending",identity(doc)))
    return store,BackupManager(store),doc


def generation(store,label):
    sources=json.loads((store.root/"config/sources.json").read_text(encoding="utf-8"));sources[0]["note"]=label
    rules=json.loads((store.root/"config/rules.json").read_text(encoding="utf-8"));rules["profile_label"]=label
    (store.root/"config/sources.json").write_text(json_text(sources),encoding="utf-8")
    (store.root/"config/rules.json").write_text(json_text(rules),encoding="utf-8")
    store.source_config,store.rules=sources,rules
    with store.connection() as conn:
        conn.execute("UPDATE sources SET config=? WHERE id='libtv'",(json_text(sources[0]),))
        conn.execute("UPDATE opportunities SET note=?",(label,))


def crash_worker(root,phase):
    store,manager,doc=populate(root)
    target=state(store);backup=manager.create();generation(store,"current-generation");before=state(store)
    (root/"expected.json").write_text(json.dumps({"before":before,"after":target,"backup_id":backup["id"]},ensure_ascii=False),encoding="utf-8")
    preview=manager.preview(backup["id"])
    exit_code=90
    if phase in ("after-journal","after-committed-journal"):
        original=backup_module._write_journal
        def crash_journal(task_root,journal):
            original(task_root,journal)
            if (phase=="after-journal" and journal["phase"]=="prepared") or (phase=="after-committed-journal" and journal["phase"]=="committed"):
                os._exit(exit_code)
        backup_module._write_journal=crash_journal
    elif phase in ("after-first-config","after-both-configs"):
        original=manager._replace_config
        def crash_config(name,value):
            original(name,value)
            if (phase=="after-first-config" and name==FILES[1]) or (phase=="after-both-configs" and name==FILES[2]):
                os._exit(exit_code)
        manager._replace_config=crash_config
    elif phase=="after-db-commit":
        original=backup_module._recover_pending_locked
        def crash_commit(task_root,db_path,update_locked=False):
            if update_locked:
                os._exit(exit_code)
            return original(task_root,db_path,update_locked)
        backup_module._recover_pending_locked=crash_commit
    elif phase=="after-receipt-delete":
        original=Path.unlink
        def crash_delete(path,*args,**kwargs):
            if path.name==JOURNAL_NAME:
                os._exit(exit_code)
            return original(path,*args,**kwargs)
        Path.unlink=crash_delete
    manager.restore(backup["id"],preview["confirm_token"])
    raise RuntimeError("crash checkpoint was not reached")


def create_worker(root):
    store=Store(root,seed=False);manager=BackupManager(store);original=manager._configs
    def delayed():
        value=original();(root/"creator-ready").write_text("ready",encoding="ascii")
        deadline=time.monotonic()+10
        while not (root/"creator-release").exists():
            if time.monotonic()>deadline:
                raise RuntimeError("creator was not released")
            time.sleep(0.01)
        return value
    manager._configs=delayed
    result=manager.create()
    (root/"creator-result.json").write_text(json.dumps(result),encoding="utf-8")


class AdversarialBackupTests(unittest.TestCase):
    def setUp(self):
        self.temp=ScopedTemp(ROOT/"output","test-adversarial-backup-")
        self.root=Path(self.temp.name)

    def tearDown(self):
        self.temp.cleanup()

    def test_real_crash_recovery_at_six_commit_boundaries(self):
        phases=("after-journal","after-first-config","after-both-configs","after-db-commit","after-committed-journal","after-receipt-delete")
        for phase in phases:
            with self.subTest(phase=phase):
                root=self.root/phase
                child=subprocess.run([sys.executable,"-X","utf8",str(__file__),"--crash-worker",str(root),phase],capture_output=True,text=True,timeout=20)
                self.assertEqual(child.returncode,90,child.stdout+child.stderr)
                expected=json.loads((root/"expected.json").read_text(encoding="utf-8"))
                committed=phase in phases[3:]
                # A separate SQLite writer after the original commit must not
                # be lost when startup finishes the interrupted restore.
                if phase=="after-db-commit":
                    with closing(sqlite3.connect(root/"data/opportunities.sqlite3")) as conn:
                        with conn:
                            conn.execute("UPDATE opportunities SET note='保存于原恢复提交之后'")
                    columns=[column[1] for column in backup_module.COLUMNS["opportunities"]]
                    expected["after"]["rows"]["opportunities"][0][columns.index("note")]="保存于原恢复提交之后"
                store=Store(root,seed=False)
                self.assertEqual(state(store),expected["after"] if committed else expected["before"])
                self.assertFalse((root/"data/backups"/JOURNAL_NAME).exists())
                with store.connection() as conn:
                    self.assertIsNone(conn.execute("SELECT 1 FROM settings WHERE key=?",(RESTORE_RECEIPT_KEY,)).fetchone())
                self.assertIn("pre_restore",[item["reason"] for item in BackupManager(store).list()])
                # Recovery can be repeated by another normal startup.
                self.assertEqual(state(Store(root,seed=False)),state(store))

    def test_actual_process_create_excludes_restore_then_retry_succeeds(self):
        store,manager,doc=populate(self.root)
        backup=manager.create();generation(store,"current-generation")
        preview=manager.preview(backup["id"])
        child=subprocess.Popen([sys.executable,"-X","utf8",str(__file__),"--create-worker",str(self.root)],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
        try:
            deadline=time.monotonic()+5
            while not (self.root/"creator-ready").exists():
                if child.poll() is not None or time.monotonic()>deadline:
                    self.fail("creator did not enter configuration snapshot")
                time.sleep(0.01)
            with self.assertRaises(AlreadyRunning):
                manager.restore(backup["id"],preview["confirm_token"])
        finally:
            (self.root/"creator-release").write_text("release",encoding="ascii")
            output,error=child.communicate(timeout=15)
        self.assertEqual(child.returncode,0,output+error)
        created=json.loads((self.root/"creator-result.json").read_text(encoding="utf-8"))
        snapshot=manager._read_archive(created["id"])
        self.assertEqual(snapshot["rows"]["opportunities"][0]["note"],"current-generation")
        self.assertEqual(snapshot["sources"][0]["note"],"current-generation")
        self.assertEqual(snapshot["rules"]["profile_label"],"current-generation")
        self.assertTrue(manager.restore(backup["id"],preview["confirm_token"])["restored"])

    def test_independent_instances_exclude_create_restore(self):
        store,manager,doc=populate(self.root)
        other=Store(self.root,seed=False);restorer=BackupManager(other)
        backup=manager.create();preview=restorer.preview(backup["id"])
        with ProcessLock(backup_module._config_lock_path(self.root)):
            with self.assertRaises(AlreadyRunning):
                manager.create()
            with self.assertRaises(AlreadyRunning):
                restorer.restore(backup["id"],preview["confirm_token"])

    def test_collection_refreshes_existing_instance_after_another_restore(self):
        store,manager,doc=populate(self.root);backup=manager.create()
        generation(store,"current-generation")
        other=Store(self.root,seed=False)
        self.assertEqual(other.rules["profile_label"],"current-generation")
        preview=manager.preview(backup["id"]);manager.restore(backup["id"],preview["confirm_token"])
        with backup_module.collection_guard(other):
            self.assertEqual(other.rules["profile_label"],"backup-generation")
            self.assertEqual(other.source_config[0]["note"],"backup-generation")
            self.assertTrue(manager.create()["id"])
        # No disk change: an intentional in-memory test override is retained.
        other.rules["keywords"]=["隔离模拟关键词"]
        with backup_module.collection_guard(other):
            self.assertEqual(other.rules["keywords"],["隔离模拟关键词"])

    def test_collection_keeps_unchanged_legacy_config_without_new_validation(self):
        store,manager,doc=populate(self.root)
        sources=json.loads((self.root/"config/sources.json").read_text(encoding="utf-8"))
        sources[0]["url"]="https://offline.example/list"
        sources[0]["allowed_hosts"]=["offline.example"]
        (self.root/"config/sources.json").write_text(json_text(sources),encoding="utf-8")
        legacy=Store(self.root,seed=False)
        legacy.rules["keywords"]=["内存模拟关键词"]
        with backup_module.collection_guard(legacy):
            self.assertEqual(legacy.source_config[0]["url"],"https://offline.example/list")
            self.assertEqual(legacy.rules["keywords"],["内存模拟关键词"])
        # A changed disk config must still pass the strict restored-config rules.
        rules=json.loads((self.root/"config/rules.json").read_text(encoding="utf-8"))
        rules["profile_label"]="新磁盘配置"
        (self.root/"config/rules.json").write_text(json_text(rules),encoding="utf-8")
        with self.assertRaises(BackupError):
            with backup_module.collection_guard(legacy):
                self.fail("changed unsafe configuration was not validated")

    def test_external_config_edit_after_fingerprint_is_rejected_and_preserved(self):
        store,manager,doc=populate(self.root);backup=manager.create();preview=manager.preview(backup["id"]);before=state(store)
        original=manager._pre_restore_snapshot
        def external_edit(rows,configs):
            snapshot=original(rows,configs)
            path=self.root/"config/rules.json";rules=json.loads(path.read_text(encoding="utf-8"));rules["profile_label"]="外部编辑必须保留";path.write_text(json_text(rules),encoding="utf-8")
            return snapshot
        with patch.object(manager,"_pre_restore_snapshot",side_effect=external_edit):
            with self.assertRaisesRegex(BackupError,"外部修改"):
                manager.restore(backup["id"],preview["confirm_token"])
        self.assertEqual(state(store)["rows"],before["rows"])
        self.assertEqual(json.loads((self.root/"config/rules.json").read_text(encoding="utf-8"))["profile_label"],"外部编辑必须保留")
        self.assertFalse((self.root/"data/backups"/JOURNAL_NAME).exists())

    def test_same_config_is_published_and_runtime_write_failure_rolls_back(self):
        store,manager,doc=populate(self.root);backup=manager.create();preview=manager.preview(backup["id"])
        writes=[];original=manager._replace_config
        def recorded(name,value):
            writes.append(name);return original(name,value)
        with patch.object(manager,"_replace_config",side_effect=recorded):
            self.assertTrue(manager.restore(backup["id"],preview["confirm_token"])["restored"])
        self.assertEqual(writes,list(FILES[1:]))
        generation(store,"current-generation");preview=manager.preview(backup["id"]);before=state(store)
        def fail_rules(name,value):
            if name==FILES[2]:
                raise OSError("offline second config failure")
            original(name,value)
        with patch.object(manager,"_replace_config",side_effect=fail_rules):
            with self.assertRaises(BackupError):
                manager.restore(backup["id"],preview["confirm_token"])
        self.assertEqual(state(store),before)
        self.assertFalse((self.root/"data/backups"/JOURNAL_NAME).exists())

    def test_archive_growth_after_fstat_is_bounded(self):
        store,manager,doc=populate(self.root);backup=manager.create();path=manager.path(backup["id"])
        original_open=Path.open;limit=path.stat().st_size+10
        class GrowingRead:
            def __init__(self,stream):self.stream=stream
            def __enter__(self):return self
            def __exit__(self,*args):self.stream.close()
            def fileno(self):return self.stream.fileno()
            def read(self,size):
                with original_open(path,"ab") as writer:writer.write(b"X"*2000)
                return self.stream.read(size)
        def opening(task_path,*args,**kwargs):
            stream=original_open(task_path,*args,**kwargs)
            return GrowingRead(stream) if task_path==path and args and args[0]=="rb" else stream
        with patch("opportunities.backup.MAX_ARCHIVE_BYTES",limit),patch.object(Path,"open",new=opening):
            with self.assertRaisesRegex(BackupError,"大小限制"):
                manager._read_archive(backup["id"])

    def test_malformed_documents_in_hashed_db_are_rejected(self):
        for field in ("duplicate", "surrogate", "source_window", "assessment", "month_period", "timezone"):
            with self.subTest(field=field):
                store,manager,doc=populate(self.root/field);backup=manager.create();path=manager.path(backup["id"]);before=state(store)
                with zipfile.ZipFile(path) as archive:payload={name:archive.read(name) for name in archive.namelist()}
                database=store.root/"attack.sqlite3";database.write_bytes(payload[FILES[0]])
                with closing(sqlite3.connect(database)) as conn:
                    with conn:
                        conn.execute("PRAGMA journal_mode=DELETE")
                        value=conn.execute("SELECT document FROM opportunities").fetchone()[0]
                        parsed=json.loads(value)
                        if field=="duplicate":
                            value=value[:-1]+',"title":"重复键攻击"}'
                        else:
                            if field=="surrogate":
                                parsed["summary"]="\ud800"
                            elif field=="source_window":
                                parsed["time"]["source_window"]=[]
                            elif field=="assessment":
                                parsed["assessment"]=[]
                            elif field=="month_period":
                                parsed["time"].update(confirmed=True,month_period={"start":"2026-09"})
                            else:
                                parsed["time"].update(confirmed=True,mechanism="fixed",start="2026-09-01",deadline="2027-01-01",timezone="+99:99")
                            value=json.dumps(parsed,ensure_ascii=True)
                        conn.execute("UPDATE opportunities SET document=?",(value,));conn.execute("UPDATE versions SET snapshot=? WHERE version=2",(value,))
                payload[FILES[0]]=database.read_bytes();manifest=json.loads(payload["manifest.json"]);manifest["files"][FILES[0]]={"sha256":hashlib.sha256(payload[FILES[0]]).hexdigest(),"size":len(payload[FILES[0]])};payload["manifest.json"]=json_text(manifest).encode()
                with zipfile.ZipFile(path,"w",compression=zipfile.ZIP_STORED) as archive:
                    for name,value in payload.items():archive.writestr(name,value)
                with self.assertRaises(BackupError):manager.preview(backup["id"])
                self.assertEqual(state(store),before)

    def test_other_database_cannot_recover_journal_or_overwrite_shared_config(self):
        root=self.root/"pending"
        child=subprocess.run([sys.executable,"-X","utf8",str(__file__),"--crash-worker",str(root),"after-first-config"],capture_output=True,text=True,timeout=20)
        self.assertEqual(child.returncode,90,child.stdout+child.stderr)
        before={name:(root/name).read_bytes() for name in FILES[1:]}
        with self.assertRaisesRegex(BackupError,"另一数据文件"):
            Store(root,db_path=root/"data/other.sqlite3",seed=False)
        self.assertEqual({name:(root/name).read_bytes() for name in FILES[1:]},before)
        self.assertFalse((root/"data/other.sqlite3").exists())
        Store(root,seed=False)


if __name__=="__main__":
    if len(sys.argv)>1 and sys.argv[1]=="--crash-worker":
        crash_worker(Path(sys.argv[2]).resolve(),sys.argv[3])
    elif len(sys.argv)>1 and sys.argv[1]=="--create-worker":
        create_worker(Path(sys.argv[2]).resolve())
    else:
        unittest.main()
