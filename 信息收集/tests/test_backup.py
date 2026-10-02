import copy
import hashlib
import json
import sqlite3
import threading
import unittest
import zipfile
from contextlib import closing
from pathlib import Path
from unittest.mock import patch

from helpers import ScopedTemp
from opportunities.backup import BackupError, BackupManager, FILES, _read_rows
from opportunities.model import empty_document, identity, json_text, utcnow
from opportunities.storage import AlreadyRunning, ProcessLock, Store


ROOT = Path(__file__).resolve().parents[1]


class BackupTests(unittest.TestCase):
    def setUp(self):
        self.temp = ScopedTemp(ROOT / "output", "test-backup-")
        self.root = Path(self.temp.name)
        (self.root / "config").mkdir()
        for name in ("sources.json", "rules.json"):
            (self.root / "config" / name).write_bytes((ROOT / "config" / name).read_bytes())
        self.store = Store(self.root, seed=False)
        self.manager = BackupManager(self.store)
        self.doc = empty_document("libtv", "完整备份验证", "LibTV", "https://www.liblib.tv/activity/987654", "2026 / 备份测试")
        self.store.upsert(self.doc, "第一版人工记录")
        self.doc["summary"] = "第二版已核说明"
        self.store.upsert(self.doc, "第二版人工记录")
        self.item_id = identity(self.doc)
        self.store.preference(self.item_id, starred=True, note="保留个人关注、中文笔记和全部历史\n第二行")
        self.store.start_run("backup-test-run")
        self.store.observe("libtv", self.doc["official_url"], "第一份正文", "raw1", "backup-test-run", "text_complete", {"article": {"state": "text_complete"}})
        self.store.observe("libtv", self.doc["official_url"], "第二份正文", "raw2", "backup-test-run", "text_complete", {"article": {"state": "text_complete"}})
        self.store.record_attempt("backup-test-run", self.store.source_config[0], {"status": "success", "message": "隔离检查", "pages": 1, "changed": 1}, utcnow())
        self.store.finish_run("backup-test-run", {"counts": {"success": 1}})
        unknown = copy.deepcopy(self.store.source_config[0])
        unknown["id"] = "previous_source_unknown_to_config"
        unknown["name"] = "旧来源完整保留"
        with self.store.connection() as conn:
            conn.execute("INSERT INTO settings VALUES(?,?)", ("work_profile", json_text({"interests": ["动画", "短片"]})))
            conn.execute("INSERT INTO sources(id,config) VALUES(?,?)", (unknown["id"], json_text(unknown)))
            conn.execute("UPDATE opportunities SET archived_at=? WHERE id=?", (utcnow(), self.item_id))
            conn.execute("INSERT INTO discovery_candidates VALUES(?,?,?,?,?,?,?,?,?,?,?)", ("a" * 24, "libtv", "https://www.liblib.tv/activity/987655", "2026 / 候选", "待复核候选", utcnow(), utcnow(), json_text({"url": "https://www.liblib.tv/activity", "excerpt": "官方首页卡片"}), "候选正文", "pending", None))

    def tearDown(self):
        self.temp.cleanup()

    def state(self):
        with self.store.connection() as conn:
            rows = _read_rows(conn)
        configs = {name: (self.root / name).read_bytes() for name in FILES[1:]}
        return rows, configs

    def change_current(self):
        self.store.preference(self.item_id, starred=False, note="恢复之前的新笔记")
        changed = copy.deepcopy(self.doc)
        changed["summary"] = "当前第三版"
        self.store.upsert(changed, "备份后变化")
        extra = empty_document("libtv", "备份后新条目", "LibTV", "https://www.liblib.tv/activity/987656", "2026 / 后增")
        self.store.upsert(extra)
        rules_path = self.root / "config" / "rules.json"
        rules = json.loads(rules_path.read_text(encoding="utf-8"))
        rules["new_publication_days"] += 1
        rules_path.write_text(json_text(rules), encoding="utf-8")
        self.store.rules = rules
        source_path = self.root / "config" / "sources.json"
        sources = json.loads(source_path.read_text(encoding="utf-8"))
        sources[0]["note"] = "备份之后修改的来源说明"
        source_path.write_text(json_text(sources), encoding="utf-8")
        self.store.source_config = sources
        with self.store.connection() as conn:
            conn.execute("UPDATE settings SET value='after' WHERE key='work_profile'")
            conn.execute("UPDATE discovery_candidates SET review_state='dismissed'")

    def rewrite(self, backup_id, mutate):
        path = self.manager.path(backup_id)
        with zipfile.ZipFile(path) as archive:
            payload = {name: archive.read(name) for name in archive.namelist()}
        mutate(payload)
        with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_STORED) as archive:
            for name, value in payload.items():
                archive.writestr(name, value)

    def rewrite_database(self, backup_id, mutate):
        def transform(payload):
            database = self.root / "malicious-test.sqlite3"
            database.write_bytes(payload[FILES[0]])
            with closing(sqlite3.connect(database)) as conn:
                with conn:
                    conn.execute("PRAGMA journal_mode=DELETE")
                    mutate(conn)
            payload[FILES[0]] = database.read_bytes()
            manifest = json.loads(payload["manifest.json"])
            manifest["files"][FILES[0]] = {"sha256": hashlib.sha256(payload[FILES[0]]).hexdigest(), "size": len(payload[FILES[0]])}
            payload["manifest.json"] = json_text(manifest).encode("utf-8")
        self.rewrite(backup_id, transform)

    def rewrite_config(self, backup_id, mutate):
        def transform(payload):
            sources = json.loads(payload["config/sources.json"])
            mutate(sources)
            payload["config/sources.json"] = json_text(sources).encode("utf-8")
            manifest = json.loads(payload["manifest.json"])
            manifest["files"]["config/sources.json"] = {"sha256": hashlib.sha256(payload["config/sources.json"]).hexdigest(), "size": len(payload["config/sources.json"])}
            payload["manifest.json"] = json_text(manifest).encode("utf-8")
        self.rewrite(backup_id, transform)

    def test_complete_restore_keeps_every_table_history_preferences_and_config(self):
        original = self.state()
        backup = self.manager.create()
        self.assertEqual(backup["schema_version"], 3)
        self.assertEqual(backup["counts"]["versions"], 2)
        self.assertEqual(backup["counts"]["notes"], 1)
        self.assertEqual(backup["counts"]["discovery_candidates"], 1)
        self.change_current()
        before_restore = self.state()
        preview = self.manager.preview(backup["id"])
        self.assertEqual(preview["impact"]["opportunities_removed"], 1)
        self.assertTrue(preview["impact"]["config_changed"])
        result = self.manager.restore(backup["id"], preview["confirm_token"])
        self.assertTrue(result["restored"])
        self.assertEqual(self.state(), original)
        detail = self.store.details(self.item_id)
        self.assertTrue(detail["starred"])
        self.assertIn("中文笔记", detail["note"])
        self.assertEqual(len(detail["versions"]), 2)
        self.assertEqual(len(detail["observations"]), 2)
        self.assertEqual(len(detail["page_changes"]), 1)
        self.assertIn("previous_source_unknown_to_config", {source["id"] for source in self.store.sources()})
        self.assertEqual(self.store.rules, json.loads(original[1]["config/rules.json"]))
        self.assertEqual(self.store.source_config, json.loads(original[1]["config/sources.json"]))
        self.assertEqual(len(self.manager.list()), 2)
        pre = self.manager._read_archive(result["pre_restore_backup"])
        self.assertEqual(pre["rows"], before_restore[0])
        self.assertEqual(pre["configs"], before_restore[1])
        self.assertEqual(pre["manifest"]["reason"], "pre_restore")

    def test_preview_and_cancel_do_not_write_current_or_create_restore_snapshot(self):
        backup = self.manager.create()
        self.change_current()
        before = self.state()
        preview = self.manager.preview(backup["id"])
        self.assertEqual(self.state(), before)
        self.assertEqual(len(self.manager.list()), 1)
        self.assertTrue(preview["confirm_token"])
        for confirmation in (None, "", "yes", True, []):
            with self.subTest(confirmation=confirmation):
                with self.assertRaises(BackupError):
                    self.manager.restore(backup["id"], confirmation)
        self.assertEqual(self.state(), before)
        self.assertEqual(len(self.manager.list()), 1)

    def test_repeated_confirmation_wrong_backup_and_restart_rejected(self):
        first, second = self.manager.create(), self.manager.create()
        self.change_current()
        preview = self.manager.preview(first["id"])
        with self.assertRaises(BackupError):
            self.manager.restore(second["id"], preview["confirm_token"])
        with self.assertRaises(BackupError):
            BackupManager(self.store).restore(first["id"], preview["confirm_token"])
        self.manager.restore(first["id"], preview["confirm_token"])
        after = self.state()
        with self.assertRaises(BackupError):
            self.manager.restore(first["id"], preview["confirm_token"])
        self.assertEqual(self.state(), after)

    def test_expired_confirmation_rejected(self):
        backup = self.manager.create()
        preview = self.manager.preview(backup["id"])
        self.manager._tokens[preview["confirm_token"]]["expires"] = 0
        before = self.state()
        with self.assertRaises(BackupError):
            self.manager.restore(backup["id"], preview["confirm_token"])
        self.assertEqual(self.state(), before)

    def test_cross_connection_preference_after_preview_invalidates_confirmation(self):
        backup = self.manager.create()
        preview = self.manager.preview(backup["id"])
        with closing(sqlite3.connect(self.store.db_path)) as conn:
            with conn:
                conn.execute("UPDATE opportunities SET note='另一个进程的笔记' WHERE id=?", (self.item_id,))
        before = self.state()
        with self.assertRaisesRegex(BackupError, "当前数据或配置已改变"):
            self.manager.restore(backup["id"], preview["confirm_token"])
        self.assertEqual(self.state(), before)
        self.assertEqual(len(self.manager.list()), 1)

    def test_config_after_preview_invalidates_confirmation(self):
        backup = self.manager.create()
        preview = self.manager.preview(backup["id"])
        path = self.root / "config" / "rules.json"
        path.write_bytes(path.read_bytes() + b"\n")
        before = self.state()
        with self.assertRaisesRegex(BackupError, "当前数据或配置已改变"):
            self.manager.restore(backup["id"], preview["confirm_token"])
        self.assertEqual(self.state(), before)

    def test_changed_archive_invalidates_confirmation_even_when_valid(self):
        backup = self.manager.create()
        preview = self.manager.preview(backup["id"])
        def mutate(payload):
            manifest = json.loads(payload["manifest.json"])
            manifest["created_at"] = "2026-09-29T00:00:00+00:00"
            payload["manifest.json"] = json_text(manifest).encode()
        self.rewrite(backup["id"], mutate)
        before = self.state()
        with self.assertRaisesRegex(BackupError, "备份内容已改变"):
            self.manager.restore(backup["id"], preview["confirm_token"])
        self.assertEqual(self.state(), before)

    def test_update_lock_blocks_preview_restore_but_consistent_create_is_allowed(self):
        backup = self.manager.create()
        preview = self.manager.preview(backup["id"])
        before = self.state()
        with ProcessLock(self.store.db_path.parent / "update.lock"):
            with self.assertRaises(AlreadyRunning):
                self.manager.preview(backup["id"])
            with self.assertRaises(AlreadyRunning):
                self.manager.restore(backup["id"], preview["confirm_token"])
            self.assertEqual(self.manager.create()["counts"], backup["counts"])
        self.assertEqual(self.state(), before)

    def test_preference_waits_for_restore_and_is_preserved_after_it(self):
        backup = self.manager.create()
        self.change_current()
        preview = self.manager.preview(backup["id"])
        entered, release, preference_done = threading.Event(), threading.Event(), threading.Event()
        errors = []
        original = self.manager._pre_restore_snapshot
        def delayed(rows, configs):
            entered.set()
            if not release.wait(3):
                raise RuntimeError("test did not release restore")
            return original(rows, configs)
        def restore():
            try:
                self.manager.restore(backup["id"], preview["confirm_token"])
            except Exception as exc:
                errors.append(exc)
        def preference():
            try:
                self.store.preference(self.item_id, note="恢复完成后的新笔记")
                preference_done.set()
            except Exception as exc:
                errors.append(exc)
        with patch.object(self.manager, "_pre_restore_snapshot", side_effect=delayed):
            worker = threading.Thread(target=restore)
            writer = threading.Thread(target=preference)
            worker.start()
            self.assertTrue(entered.wait(3))
            writer.start()
            self.assertFalse(preference_done.wait(0.05))
            release.set()
            worker.join(5)
            writer.join(5)
        self.assertFalse(worker.is_alive())
        self.assertFalse(writer.is_alive())
        self.assertEqual(errors, [])
        self.assertEqual(self.store.details(self.item_id)["note"], "恢复完成后的新笔记")

    def test_independent_sqlite_writer_waits_for_restore_transaction(self):
        backup = self.manager.create()
        self.change_current()
        preview = self.manager.preview(backup["id"])
        entered, release, attempted, done = (threading.Event() for _ in range(4))
        errors = []
        original = self.manager._pre_restore_snapshot
        def delayed(rows, configs):
            entered.set()
            if not release.wait(3):
                raise RuntimeError("test did not release restore")
            return original(rows, configs)
        def restore():
            try:
                self.manager.restore(backup["id"], preview["confirm_token"])
            except Exception as exc:
                errors.append(exc)
        def independent_writer():
            try:
                with closing(sqlite3.connect(self.store.db_path, timeout=5)) as conn:
                    attempted.set()
                    with conn:
                        conn.execute("UPDATE opportunities SET note='独立连接在恢复之后保存的笔记' WHERE id=?", (self.item_id,))
                    done.set()
            except Exception as exc:
                errors.append(exc)
        with patch.object(self.manager, "_pre_restore_snapshot", side_effect=delayed):
            worker = threading.Thread(target=restore)
            writer = threading.Thread(target=independent_writer)
            worker.start()
            self.assertTrue(entered.wait(3))
            writer.start()
            self.assertTrue(attempted.wait(3))
            self.assertFalse(done.wait(0.05))
            release.set()
            worker.join(5)
            writer.join(5)
        self.assertFalse(worker.is_alive())
        self.assertFalse(writer.is_alive())
        self.assertEqual(errors, [])
        self.assertTrue(done.is_set())
        self.assertEqual(self.store.details(self.item_id)["note"], "独立连接在恢复之后保存的笔记")

    def test_online_backup_keeps_multi_table_generation_consistent_during_collection(self):
        entered, release = threading.Event(), threading.Event()
        errors = []
        with self.store.connection() as conn:
            conn.execute("UPDATE opportunities SET note='generation-0'")
            conn.execute("UPDATE settings SET value='generation-0' WHERE key='work_profile'")
        def collector():
            try:
                with ProcessLock(self.store.db_path.parent / "update.lock"):
                    with closing(sqlite3.connect(self.store.db_path, timeout=5)) as conn:
                        for generation in range(1, 100):
                            value = "generation-" + str(generation)
                            with conn:
                                conn.execute("BEGIN IMMEDIATE")
                                conn.execute("UPDATE opportunities SET note=?", (value,))
                                conn.execute("UPDATE settings SET value=? WHERE key='work_profile'", (value,))
                            if generation == 1:
                                entered.set()
                                if not release.wait(3):
                                    raise RuntimeError("test did not release collector")
            except Exception as exc:
                errors.append(exc)
        worker = threading.Thread(target=collector)
        worker.start()
        self.assertTrue(entered.wait(3))
        release.set()
        try:
            backup = self.manager.create()
        finally:
            worker.join(5)
        self.assertFalse(worker.is_alive())
        self.assertEqual(errors, [])
        rows = self.manager._read_archive(backup["id"])["rows"]
        generation = next(row["value"] for row in rows["settings"] if row["key"] == "work_profile")
        self.assertEqual(rows["opportunities"][0]["note"], generation)

    def test_config_write_failure_rolls_back_db_and_first_config(self):
        backup = self.manager.create()
        self.change_current()
        preview = self.manager.preview(backup["id"])
        before = self.state()
        original = self.manager._replace_config
        def fail_rules(name, value):
            if name == "config/rules.json":
                raise OSError("simulated config write failure")
            original(name, value)
        with patch.object(self.manager, "_replace_config", side_effect=fail_rules):
            with self.assertRaisesRegex(BackupError, "原数据库及配置已保留"):
                self.manager.restore(backup["id"], preview["confirm_token"])
        self.assertEqual(self.state(), before)
        self.assertEqual(len(self.manager.list()), 2)

    def test_path_ids_and_missing_backups_rejected(self):
        for bad in ("../backup", "..\\backup", "C:\\outside.zip", "/tmp/file.zip", "backup.zip", "backup-" + "a" * 24, None, []):
            with self.subTest(backup_id=bad):
                with self.assertRaises(BackupError):
                    self.manager.preview(bad)
        with self.assertRaises(BackupError):
            self.manager.preview("backup-20260930T000000Z-" + "0" * 32)

    def test_corrupt_hash_and_invalid_archive_rejected(self):
        backup = self.manager.create()
        self.rewrite(backup["id"], lambda payload: payload.__setitem__("config/rules.json", payload["config/rules.json"] + b" "))
        before = self.state()
        with self.assertRaisesRegex(BackupError, "哈希"):
            self.manager.preview(backup["id"])
        self.manager.path(backup["id"]).write_bytes(b"not a zip")
        with self.assertRaises(BackupError):
            self.manager.preview(backup["id"])
        self.assertFalse(self.manager.list()[0]["valid"])
        self.assertEqual(self.state(), before)

    def test_malicious_executable_or_changed_schema_rejected(self):
        mutations = (lambda conn: conn.execute("CREATE TRIGGER malicious BEFORE DELETE ON opportunities BEGIN DELETE FROM versions; END"), lambda conn: conn.execute("CREATE VIEW malicious_view AS SELECT * FROM settings"), lambda conn: conn.execute("CREATE TABLE unexpected(payload TEXT)"), lambda conn: conn.execute("CREATE INDEX unexpected_index ON opportunities(note)"), lambda conn: conn.execute("PRAGMA user_version=99"))
        before = self.state()
        for mutation in mutations:
            with self.subTest(mutation=mutation):
                backup = self.manager.create()
                self.rewrite_database(backup["id"], mutation)
                with self.assertRaises(BackupError):
                    self.manager.preview(backup["id"])
        self.assertEqual(self.state(), before)

    def test_wrong_types_dangling_relations_and_invalid_json_rejected(self):
        mutations = (lambda conn: conn.execute("UPDATE opportunities SET starred=7"), lambda conn: conn.execute("UPDATE opportunities SET version='bad'"), lambda conn: conn.execute("UPDATE opportunities SET version=9223372036854775807"), lambda conn: conn.execute("UPDATE versions SET snapshot='[]'"), lambda conn: conn.execute("UPDATE versions SET opportunity_id='missing'"), lambda conn: conn.execute("UPDATE page_changes SET before_id=999999"), lambda conn: conn.execute("UPDATE observations SET body='changed without matching hash'"), lambda conn: conn.execute("UPDATE discovery_candidates SET known_item_id='missing'"))
        before = self.state()
        for mutation in mutations:
            with self.subTest(mutation=mutation):
                backup = self.manager.create()
                self.rewrite_database(backup["id"], mutation)
                with self.assertRaises(BackupError):
                    self.manager.preview(backup["id"])
        self.assertEqual(self.state(), before)

    def test_private_script_url_host_mismatch_and_unknown_adapter_rejected(self):
        mutations = (lambda sources: sources[0].update(url="javascript:alert(1)"), lambda sources: sources[0].update(url="https://127.0.0.1/internal", allowed_hosts=["127.0.0.1"]), lambda sources: sources[0].update(url="https://localhost/internal", allowed_hosts=["localhost"]), lambda sources: sources[0].update(url="https://www.other-domain.com/"), lambda sources: sources[0].update(adapter="execute_script"), lambda sources: sources[0].update(discovery={"path_re": "(a+)+"}))
        for mutation in mutations:
            with self.subTest(mutation=mutation):
                backup = self.manager.create()
                self.rewrite_config(backup["id"], mutation)
                with self.assertRaises(BackupError):
                    self.manager.preview(backup["id"])

    def test_zip_traversal_and_bomb_rejected_without_extracting_files(self):
        backup = self.manager.create()
        path = self.manager.path(backup["id"])
        with zipfile.ZipFile(path, "a") as archive:
            archive.writestr("../../escape.txt", "evil")
        with self.assertRaises(BackupError):
            self.manager.preview(backup["id"])
        self.assertFalse((self.root / "escape.txt").exists())
        backup = self.manager.create()
        path = self.manager.path(backup["id"])
        with zipfile.ZipFile(path) as archive:
            payload = {name: archive.read(name) for name in archive.namelist()}
        payload[FILES[0]] = b"0" * (2 * 1024 * 1024)
        with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for name, value in payload.items():
                archive.writestr(name, value)
        with self.assertRaisesRegex(BackupError, "压缩率异常"):
            self.manager.preview(backup["id"])

    def test_invalid_database_and_manifest_version_rejected(self):
        backup = self.manager.create()
        def damage_database(payload):
            payload[FILES[0]] = b"not sqlite"
            manifest = json.loads(payload["manifest.json"])
            manifest["files"][FILES[0]] = {"sha256": hashlib.sha256(payload[FILES[0]]).hexdigest(), "size": len(payload[FILES[0]])}
            payload["manifest.json"] = json_text(manifest).encode()
        self.rewrite(backup["id"], damage_database)
        with self.assertRaises(BackupError):
            self.manager.preview(backup["id"])
        backup = self.manager.create()
        def wrong_version(payload):
            manifest = json.loads(payload["manifest.json"])
            manifest["format_version"] = 900
            payload["manifest.json"] = json_text(manifest).encode()
        self.rewrite(backup["id"], wrong_version)
        with self.assertRaises(BackupError):
            self.manager.preview(backup["id"])


if __name__ == "__main__":
    unittest.main()
