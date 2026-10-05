import copy
import json
import shutil
import threading
import unittest
import urllib.error
import urllib.request
from pathlib import Path
from unittest.mock import patch

from helpers import ScopedTemp
from opportunities.backup import BackupManager
from opportunities.model import empty_document
from opportunities.server import make_server
from opportunities.storage import Store
from opportunities.works import delete_work, list_workspace, save_work
from opportunities.write_protocol import WriteConflict

ROOT = Path(__file__).resolve().parents[1]


class WriteProtocolTests(unittest.TestCase):
    def setUp(self):
        self.temp = ScopedTemp(ROOT / "output" / "tests", "test-write-protocol-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / "config").mkdir()
        for name in ("sources.json", "rules.json"):
            shutil.copyfile(ROOT / "config" / name, self.root / "config" / name)
        self.store = Store(self.root, seed=False)
        document = empty_document("libtv", "隔离保存协议", "LibTV", "https://www.liblib.tv/activity/999997", "2026 / 隔离")
        self.store.upsert(document)
        self.id = self.store.items()[0]["id"]

    def preference(self, revision=0, operation="a" * 32, **patch):
        return self.store.preference(self.id, expected_revision=revision, submission_id=operation, require_cas=True, **patch)

    def work_payload(self, operation="b" * 32):
        return {"revision": 0, "data": {"name": "隔离作品", "profile": {}}, "submissionId": operation}

    def test_old_data_defaults_to_zero_without_backfill_or_schema_change(self):
        self.assertEqual(self.store.details(self.id)["preference_revision"], 0)
        with self.store.connection() as conn:
            self.assertEqual(conn.execute("PRAGMA user_version").fetchone()[0], 3)
            self.assertEqual(conn.execute("SELECT count(*) FROM settings WHERE key LIKE 'write:%'").fetchone()[0], 0)

    def test_stale_tab_cannot_overwrite_note_or_star_and_legacy_increments_revision(self):
        saved = self.preference(note="首个页面的笔记")
        self.assertEqual(saved["preference"]["preference_revision"], 1)
        with self.assertRaises(WriteConflict):
            self.preference(operation="c" * 32, starred=True)
        self.assertFalse(self.store.details(self.id)["starred"])
        self.store.preference(self.id, starred=True)
        self.assertEqual(self.store.details(self.id)["preference_revision"], 2)
        with self.assertRaises(WriteConflict):
            self.preference(revision=1, operation="d" * 32, note="旧页面覆盖")
        self.assertEqual(self.store.details(self.id)["note"], "首个页面的笔记")

    def test_same_submission_replays_without_new_revision_and_changed_payload_rejected(self):
        first = self.preference(note="丢响应后重试")
        again = self.preference(note="丢响应后重试")
        self.assertTrue(again["already_completed"])
        self.assertEqual(first["preference"], again["preference"])
        with self.assertRaises(WriteConflict):
            self.preference(note="同 ID 换内容")
        self.assertEqual(self.store.details(self.id)["preference_revision"], 1)

    def test_receipt_replay_after_later_edit_never_applies_old_result(self):
        self.preference(note="先保存")
        self.store.preference(self.id, note="后来保存")
        with self.assertRaises(WriteConflict) as caught:
            self.preference(note="先保存")
        self.assertTrue(caught.exception.details["committed"])
        self.assertEqual(self.store.details(self.id)["note"], "后来保存")

    def test_receipt_failure_rolls_back_values_and_revision(self):
        with patch("opportunities.write_protocol.save_receipt", side_effect=RuntimeError("模拟提交前中断")):
            with self.assertRaises(RuntimeError):
                self.preference(starred=True, note="不可部分保存")
        current = self.store.details(self.id)
        self.assertEqual((current["starred"], current["note"], current["preference_revision"]), (False, "", 0))

    def test_concurrent_connections_only_one_expected_revision_commits(self):
        second = Store(self.root, seed=False)
        barrier = threading.Barrier(2)
        results = []
        def write(store, operation):
            barrier.wait()
            try:
                store.preference(self.id, note=operation, expected_revision=0, submission_id=operation * 32, require_cas=True)
                results.append("saved")
            except WriteConflict:
                results.append("conflict")
        threads = [threading.Thread(target=write, args=(store, operation)) for store, operation in ((self.store, "c"), (second, "d"))]
        for thread in threads: thread.start()
        for thread in threads: thread.join(10)
        self.assertCountEqual(results, ["saved", "conflict"])
        self.assertEqual(self.store.details(self.id)["preference_revision"], 1)

    def test_work_create_retry_and_receipt_collision(self):
        payload = self.work_payload()
        first = save_work(self.store, payload, require_submission=True)
        second = save_work(self.store, payload, require_submission=True)
        self.assertEqual(first["record"], second["record"])
        self.assertTrue(second["already_completed"])
        self.assertEqual(len(list_workspace(self.store)["works"]), 1)
        changed = copy.deepcopy(payload)
        changed["data"]["name"] = "另一作品"
        with self.assertRaises(WriteConflict): save_work(self.store, changed, require_submission=True)
        delete_work(self.store, {"id": first["record"]["id"], "revision": 1, "confirmed": True})
        with self.assertRaises(WriteConflict) as caught: save_work(self.store, payload, require_submission=True)
        self.assertTrue(caught.exception.details["committed"])
        self.assertEqual(list_workspace(self.store)["works"], [])

    def test_old_and_new_v3_backup_restore_and_receipt_replay(self):
        backups = BackupManager(self.store)
        old = backups.create()
        self.preference(note="随备份保留")
        new = backups.create()
        self.store.preference(self.id, note="后改")
        preview = backups.preview(new["id"])
        backups.restore(new["id"], preview["confirm_token"])
        self.assertTrue(self.preference(note="随备份保留")["already_completed"])
        preview = backups.preview(old["id"])
        backups.restore(old["id"], preview["confirm_token"])
        self.assertEqual(self.store.details(self.id)["preference_revision"], 0)

    def test_http_old_client_is_rejected_and_new_contract_is_exposed(self):
        server = make_server(self.store, port=0)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        self.addCleanup(server.server_close)
        self.addCleanup(server.shutdown)
        origin = "http://127.0.0.1:" + str(server.server_address[1])
        with urllib.request.urlopen(origin + "/api/state", timeout=10) as response: state = json.load(response)
        self.assertEqual(state["write_protocol_version"], 1)
        def post(path, payload):
            request = urllib.request.Request(origin + path, data=json.dumps(payload).encode(), headers={"Content-Type": "application/json", "X-Local-Token": state["token"], "Origin": origin})
            try:
                with urllib.request.urlopen(request, timeout=10) as response: return response.status, json.load(response)
            except urllib.error.HTTPError as error: return error.code, json.load(error)
        status, response = post("/api/preference", {"id": self.id, "note": "旧页面不能写"})
        self.assertEqual((status, response["code"]), (409, "refresh_required"))
        self.assertEqual(post("/api/works/save", {"revision": 0, "data": {"name": "旧页面", "profile": {}}})[0], 409)
        status, response = post("/api/preference", {"id": self.id, "note": "新页面保存", "expectedPreferenceRevision": 0, "submissionId": "e" * 32})
        self.assertEqual((status, response["preference"]["preference_revision"]), (200, 1))

    def test_global_changes_use_latest_manual_review_per_item_without_changing_page_state(self):
        from opportunities.review import ReviewManager
        current = self.store.details(self.id)
        second = empty_document("libtv", "同页另一年度", "LibTV", current["official_url"], "2027 / 隔离")
        self.store.upsert(second)
        second_id = next(item["id"] for item in self.store.items() if item["edition"] == "2027 / 隔离")
        self.store.observe("libtv", current["official_url"], "旧正文", "0" * 64, "test", "text_complete")
        self.store.observe("libtv", current["official_url"], "新正文", "1" * 64, "test", "text_complete")
        manager = ReviewManager(self.store)
        change_id = manager.history(self.id)["page_changes"][0]["id"]
        with patch("opportunities.review.utcnow", return_value="2026-10-02T12:00:00+00:00"), patch("opportunities.review.secrets.token_hex", side_effect=["f" * 32, "b" * 32]):
            manager.review_change({"item_id": self.id, "change_id": change_id, "state": "reviewed", "note": "第一判断"})
            manager.review_change({"item_id": self.id, "change_id": change_id, "state": "needs_review", "note": "后来发现缺口"})
        page = self.store.changes()["pages"][0]
        self.assertEqual(page["state"], "review_pending")
        self.assertCountEqual([item["id"] for item in page["linked_items"]], [self.id, second_id])
        self.assertEqual([(review["item_id"], review["state"], review["sequence"]) for review in page["latest_reviews"]], [(self.id, "needs_review", 2)])


if __name__ == "__main__":
    unittest.main()
