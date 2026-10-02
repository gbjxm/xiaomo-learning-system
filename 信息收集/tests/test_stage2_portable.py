"""Portable images/evidence and legacy compatibility, in isolated projects."""
from __future__ import annotations

import base64
import copy
import hashlib
import json
import os
import sqlite3
import subprocess
import struct
import sys
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch

from helpers import ScopedTemp
from test_visuals import png
from opportunities.backup import BackupError, BackupManager, FILES, _read_rows, _validate_source
from opportunities.evidence import EvidenceManager
from opportunities.model import empty_document, identity, json_text
from opportunities.storage import Store
from opportunities.visuals import serve_visual

ROOT = Path(__file__).resolve().parents[1]


def project(root):
    root.mkdir(parents=True, exist_ok=True)
    (root / "config").mkdir(exist_ok=True)
    for name in ("sources.json", "rules.json"):
        (root / "config" / name).write_bytes((ROOT / "config" / name).read_bytes())
    return Store(root, seed=False)


def rows(store):
    with store.connection() as conn:
        return _read_rows(conn)


class PortableTests(unittest.TestCase):
    def setUp(self):
        self.temp = ScopedTemp(ROOT / "output", "test-portable-")
        self.root = Path(self.temp.name)
        self.store = project(self.root)
        self.manager = BackupManager(self.store)
        self.doc = empty_document("libtv", "便携测试2026", "LibTV", "https://www.liblib.tv/activity/998866", "2026 / 隔离")
        self.store.upsert(self.doc)
        self.item_id = identity(self.doc)
        self.store.preference(self.item_id, starred=True, note="保持关注与笔记")
        self.image = png()
        digest = hashlib.sha256(self.image).hexdigest()
        self.filename = digest + ".png"
        self.catalog = {"schema_version":1, "assets": {"official-test-2026": {
            "filename":self.filename, "width":4, "height":3, "sha256":digest,
            "kind":"event_poster", "source_page":self.doc["official_url"],
            "image_url":"https://www.liblib.tv/images/example.png", "applicable_edition":"2026",
            "asset_label":"隔离图像夹具", "rights_note":"测试夹具不是线上官方覆盖证明。",
            "observed_at":"2026-09-30T10:00:00Z", "pixel_review_note":"只用于结构验证。", "pixel_reviewed":True}},
            "items":{self.item_id:{"asset_id":"official-test-2026", "label":"隔离标识", "edition":"2026"}}}
        (self.root / "static" / "media").mkdir(parents=True)
        (self.root / "static" / "media" / self.filename).write_bytes(self.image)
        (self.root / "config" / "visual_assets.json").write_text(json_text(self.catalog), encoding="utf8")
        self.text = "公开规则的本地证据，未知资格不假定符合。".encode("utf8")
        self.attachment = EvidenceManager(self.store).import_file({"item_id":self.item_id,"name":"规则.txt","content_base64":base64.b64encode(self.text).decode(),"source_url":self.doc["official_url"],"observed_at":"2026-09-30","verification":"unverified","upload_id":"a"*32})

    def tearDown(self):
        self.temp.cleanup()

    def rewrite(self, backup_id, transform):
        path = self.manager.path(backup_id)
        with zipfile.ZipFile(path) as archive:
            payload = {name:archive.read(name) for name in archive.namelist()}
        transform(payload)
        with zipfile.ZipFile(path,"w",compression=zipfile.ZIP_STORED) as archive:
            for name,value in payload.items():
                archive.writestr(name,value)

    @staticmethod
    def remanifest(payload):
        manifest=json.loads(payload["manifest.json"])
        manifest["files"]={name:{"sha256":hashlib.sha256(value).hexdigest(),"size":len(value)} for name,value in payload.items() if name != "manifest.json"}
        payload["manifest.json"]=json_text(manifest).encode()

    def test_portable_archive_contains_actual_images_attachments_and_catalog(self):
        backup=self.manager.create()
        self.assertEqual(backup["format_version"],2)
        self.assertEqual(backup["portable"]["media_files"],1)
        self.assertEqual(backup["portable"]["attachment_files"],1)
        with zipfile.ZipFile(self.manager.path(backup["id"])) as archive:
            self.assertEqual(archive.read("static/media/"+self.filename),self.image)
            self.assertEqual(archive.read("data/attachments/"+hashlib.sha256(self.text).hexdigest()+".txt"),self.text)
        self.assertTrue(self.manager.list()[0]["valid"])

    def test_fresh_project_import_preview_cancel_restore_preserves_evidence(self):
        backup=self.manager.create()
        target=project(self.root/"new-project")
        manager=BackupManager(target)
        original=rows(target)
        imported=manager.import_archive(self.manager.read(backup["id"]))
        self.assertFalse(imported["restored"])
        self.assertEqual(rows(target),original)
        preview=manager.preview(backup["id"])
        self.assertEqual(rows(target),original)
        self.assertFalse((target.root/"static"/"media").exists())
        result=manager.restore(backup["id"],preview["confirm_token"])
        self.assertTrue(result["restored"])
        self.assertEqual(rows(target),rows(self.store))
        self.assertEqual(EvidenceManager(target).file(self.attachment["id"])[0],self.text)
        self.assertEqual(serve_visual(target.root,"official-test-2026")[0],self.image)
        with self.assertRaises(BackupError):manager.restore(backup["id"],preview["confirm_token"])

    def test_old_core_backup_remains_readable_and_keeps_current_catalog(self):
        with self.store.connection() as conn:
            snapshot=_read_rows(conn)
        config={name:(self.root/name).read_bytes() for name in FILES[1:]}
        legacy=self.manager._write_archive(self.store.db_path.read_bytes(),config,snapshot,"manual")
        self.assertEqual(legacy["format_version"],1)
        preview=self.manager.preview(legacy["id"])
        self.assertEqual(preview["impact"]["media_scope"],"legacy_core_only")
        before=(self.root/"config/visual_assets.json").read_bytes()
        result = self.manager.restore(legacy["id"],preview["confirm_token"])
        self.assertEqual((self.root/"config/visual_assets.json").read_bytes(),before)
        self.assertEqual(EvidenceManager(self.store).file(self.attachment["id"])[0],self.text)
        previous = self.manager._read_archive(result["pre_restore_backup"])
        self.assertEqual(previous["manifest"]["portable"]["attachment_files"],1)
        self.assertEqual(previous["manifest"]["portable"]["media_files"],1)

    def test_import_same_file_idempotent_no_restore(self):
        backup=self.manager.create()
        before=rows(self.store)
        result=self.manager.import_archive(self.manager.read(backup["id"]))
        self.assertFalse(result["imported"])
        self.assertFalse(result["restored"])
        self.assertEqual(rows(self.store),before)

    def test_import_same_id_other_content_rejected(self):
        backup=self.manager.create()
        original=self.manager.read(backup["id"])
        self.assertRaises(BackupError,self.manager.import_archive,original+b"different")
        self.assertEqual(self.manager.read(backup["id"]),original)

    def test_bad_import_removed_without_database_changes(self):
        backup=self.manager.create()
        self.rewrite(backup["id"],lambda payload:payload.update({"../escape.txt":b"x"}))
        content=self.manager.read(backup["id"])
        self.manager.path(backup["id"]).unlink()
        before=rows(self.store)
        with self.assertRaises(BackupError):self.manager.import_archive(content)
        self.assertFalse(self.manager.path(backup["id"]).exists())
        self.assertEqual(rows(self.store),before)

    def test_zip_central_directory_count_and_trailing_payload_rejected_early(self):
        content=struct.pack("<4s4H2LH",b"PK\x05\x06",0,0,65535,65535,0,0,0)
        with self.assertRaises(BackupError):self.manager.import_archive(content)
        backup=self.manager.create()
        with self.assertRaises(BackupError):self.manager.import_archive(self.manager.read(backup["id"])+b"extra payload")
        content=bytearray(self.manager.read(backup["id"]))
        marker=content.rfind(b"PK\x05\x06")
        struct.pack_into("<HH",content,marker+8,1,1)
        with self.assertRaises(BackupError):self.manager.import_archive(bytes(content))

    def test_traversal_absolute_and_unknown_archive_paths_rejected(self):
        for path in ("../oops","/absolute","static/media/../../oops","data/attachments/bad.html","C:/escape"):
            with self.subTest(path=path):
                backup=self.manager.create()
                self.rewrite(backup["id"],lambda payload:payload.update({path:b"x"}))
                with self.assertRaises(BackupError):self.manager.preview(backup["id"])

    def test_archive_symbolic_link_rejected(self):
        backup=self.manager.create()
        path=self.manager.path(backup["id"])
        with zipfile.ZipFile(path) as archive:
            payload={name:archive.read(name) for name in archive.namelist()}
        with zipfile.ZipFile(path,"w",compression=zipfile.ZIP_STORED) as archive:
            for name,value in payload.items():
                info=zipfile.ZipInfo(name)
                if name.startswith("static/media/"):
                    info.external_attr=(0o120777<<16)
                archive.writestr(info,value)
        with self.assertRaises(BackupError):self.manager.preview(backup["id"])

    def test_hash_address_mismatch_rejected_even_rehashed_manifest(self):
        backup=self.manager.create()
        def mutate(payload):
            payload["static/media/"+self.filename]=png(5,3)
            self.remanifest(payload)
        self.rewrite(backup["id"],mutate)
        with self.assertRaises(BackupError):self.manager.preview(backup["id"])

    def test_missing_registered_asset_rejected(self):
        backup=self.manager.create()
        def mutate(payload):
            del payload["static/media/"+self.filename]
            self.remanifest(payload)
        self.rewrite(backup["id"],mutate)
        with self.assertRaises(BackupError):self.manager.preview(backup["id"])

    def test_unreferenced_extra_blob_rejected(self):
        backup=self.manager.create()
        def mutate(payload):
            body=b"unregistered"
            payload["data/attachments/"+hashlib.sha256(body).hexdigest()+".txt"]=body
            self.remanifest(payload)
        self.rewrite(backup["id"],mutate)
        with self.assertRaises(BackupError):self.manager.preview(backup["id"])

    def test_portable_manifest_false_scope_and_bool_count_rejected(self):
        for name,value in (("media_files",2),("attachment_files",True),("visual_catalog",False)):
            backup=self.manager.create()
            def mutate(payload):
                manifest=json.loads(payload["manifest.json"])
                manifest["portable"][name]=value
                payload["manifest.json"]=json_text(manifest).encode()
            self.rewrite(backup["id"],mutate)
            with self.assertRaises(BackupError):self.manager.preview(backup["id"])

    def test_catalog_change_invalidates_confirmation(self):
        backup=self.manager.create()
        preview=self.manager.preview(backup["id"])
        changed=copy.deepcopy(self.catalog)
        changed["items"][self.item_id]["label"]="预览后改变"
        (self.root/"config/visual_assets.json").write_text(json_text(changed),encoding="utf8")
        before=rows(self.store)
        with self.assertRaises(BackupError):self.manager.restore(backup["id"],preview["confirm_token"])
        self.assertEqual(rows(self.store),before)

    def test_failure_after_catalog_write_rolls_back_database_and_catalog(self):
        backup=self.manager.create()
        changed=copy.deepcopy(self.catalog)
        changed["items"][self.item_id]["label"]="恢复前当前标识"
        (self.root/"config/visual_assets.json").write_text(json_text(changed),encoding="utf8")
        self.store.preference(self.item_id,note="恢复前当前笔记")
        before=rows(self.store)
        catalog_before=(self.root/"config/visual_assets.json").read_bytes()
        preview=self.manager.preview(backup["id"])
        original=self.manager._replace_config
        def fail(name,value):
            original(name,value)
            if name=="config/visual_assets.json":raise OSError("isolated injected failure")
        with patch.object(self.manager,"_replace_config",side_effect=fail):
            with self.assertRaises(BackupError):self.manager.restore(backup["id"],preview["confirm_token"])
        self.assertEqual(rows(self.store),before)
        self.assertEqual((self.root/"config/visual_assets.json").read_bytes(),catalog_before)
        self.assertFalse((self.root/"data/backups/.restore-journal.json").exists())

    def test_existing_corrupt_address_file_never_overwritten(self):
        backup=self.manager.create()
        target=project(self.root/"target")
        manager=BackupManager(target)
        manager.import_archive(self.manager.read(backup["id"]))
        (target.root/"static/media").mkdir(parents=True)
        file=target.root/"static/media"/self.filename
        file.write_bytes(b"user data must remain")
        before=rows(target)
        preview=manager.preview(backup["id"])
        with self.assertRaises(BackupError):manager.restore(backup["id"],preview["confirm_token"])
        self.assertEqual(file.read_bytes(),b"user data must remain")
        self.assertEqual(rows(target),before)

    def test_pre_restore_snapshot_can_restore_absent_catalog(self):
        backup=self.manager.create()
        target=project(self.root/"absent-catalog")
        manager=BackupManager(target)
        manager.import_archive(self.manager.read(backup["id"]))
        preview=manager.preview(backup["id"])
        restored=manager.restore(backup["id"],preview["confirm_token"])
        self.assertTrue((target.root/"config/visual_assets.json").exists())
        previous=manager.preview(restored["pre_restore_backup"])
        manager.restore(restored["pre_restore_backup"],previous["confirm_token"])
        self.assertFalse((target.root/"config/visual_assets.json").exists())
        self.assertEqual(rows(target)["opportunities"],[])
        self.assertTrue((target.root/"static/media"/self.filename).exists())

    def test_missing_evidence_file_blocks_complete_backup(self):
        files=list((self.root/"data/attachments").glob("*.txt"))
        files[0].unlink()
        with self.assertRaises((BackupError,ValueError,OSError)):self.manager.create()

    def test_unknown_workspace_namespace_rejected(self):
        with self.store.connection() as conn:
            conn.execute("INSERT INTO settings VALUES(?,?)",("library:future_module:unknown",json_text({"data":{}})))
        with self.assertRaises(ValueError):self.manager.create()

    def test_pagination_validation_matches_real_bounded_contract(self):
        source=next(source for source in self.store.source_config if source["adapter"]=="official_list")
        source=copy.deepcopy(source)
        source["discovery"]["pagination"]={"mode":"next_link","max_pages":3,"path_prefixes":["/10001/list"]}
        _validate_source(source)
        for invalid in ({"mode":"javascript","max_pages":3,"path_prefixes":["/x"]},{"mode":"next_link","max_pages":6,"path_prefixes":["/x"]},{"mode":"next_link","max_pages":True,"path_prefixes":["/x"]},{"mode":"next_link","max_pages":3,"path_prefixes":["/../x"]}):
            source["discovery"]["pagination"]=invalid
            with self.assertRaises(BackupError):_validate_source(source)

    def crash_restore(self, phase):
        backup=self.manager.create()
        target=project(self.root/("crash-"+phase))
        manager=BackupManager(target)
        manager.import_archive(self.manager.read(backup["id"]))
        before=rows(target)
        code = r'''
import os,sys
from pathlib import Path
from opportunities.storage import Store
import opportunities.backup as module
from opportunities.backup import BackupManager
root=Path(sys.argv[1]);backup_id=sys.argv[2];phase=sys.argv[3]
store=Store(root,seed=False);manager=BackupManager(store)
preview=manager.preview(backup_id)
if phase == 'catalog':
    original=manager._replace_config
    def crash(name,value):
        original(name,value)
        if name=='config/visual_assets.json':os._exit(91)
    manager._replace_config=crash
else:
    original=module._recover_pending_locked
    def crash(root,db_path,update_locked=False):
        if update_locked:os._exit(92)
        return original(root,db_path,update_locked)
    module._recover_pending_locked=crash
manager.restore(backup_id,preview['confirm_token'])
raise RuntimeError('isolated crash checkpoint not reached')
'''
        result=subprocess.run([sys.executable,"-X","utf8","-c",code,str(target.root),backup["id"],phase],cwd=ROOT,capture_output=True,text=True,encoding="utf8",timeout=20)
        self.assertEqual(result.returncode,91 if phase=="catalog" else 92,result.stdout+result.stderr)
        restarted=Store(target.root,seed=False)
        self.assertFalse((target.root/"data/backups/.restore-journal.json").exists())
        if phase=="catalog":
            self.assertEqual(rows(restarted),before)
            self.assertFalse((target.root/"config/visual_assets.json").exists())
        else:
            self.assertEqual(rows(restarted),rows(self.store))
            self.assertEqual(serve_visual(target.root,"official-test-2026")[0],self.image)
            self.assertEqual(EvidenceManager(restarted).file(self.attachment["id"])[0],self.text)

    def test_actual_process_exit_after_catalog_rolls_back_absent_catalog(self):
        self.crash_restore("catalog")

    def test_actual_process_exit_after_db_commit_finishes_catalog_and_evidence(self):
        self.crash_restore("commit")


if __name__ == "__main__":
    unittest.main()
