"""Loopback API regression tests; all writable state belongs to an isolated root."""
import copy
import io
import json
import sqlite3
import threading
import unittest
import urllib.error
import urllib.request
import uuid
import zipfile
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode

from helpers import ScopedTemp
from opportunities.collect import UpdateManager
from opportunities.digest import capture_before, finalize_digest
from opportunities.discovery import candidate_identity
from opportunities.model import empty_document, identity, json_text
from opportunities.server import make_server
from opportunities.storage import Store


ROOT = Path(__file__).resolve().parents[1]
NOW = datetime(2026, 9, 30, 12, tzinfo=timezone.utc)
PROFILE_FIELDS = {
    "duration_seconds", "is_student", "ai_tools", "is_published", "uses_ai", "ai_percent",
}


class EnhancementApiTests(unittest.TestCase):
    def setUp(self):
        self.temp = ScopedTemp(ROOT / "output", "http-test-enhancement-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / "config").mkdir()
        for name in ("sources.json", "rules.json"):
            (self.root / "config" / name).write_bytes((ROOT / "config" / name).read_bytes())
        self.path = self.root / "data" / "opportunities.sqlite3"
        self.store = Store(self.root, self.path, seed=False)
        self.assertNotEqual(self.store.root, ROOT)
        self.assertEqual(self.store.db_path.parent.parent, self.root)
        self.doc = empty_document(
            "libtv", "2026 API隔离测试短片", "LibTV",
            "https://www.liblib.tv/activity/987001", "2026 / API隔离测试",
        )
        self.doc.update(origin="manual_review", summary="人工条款与个人笔记应独立保留")
        self.doc["fit_rules"] = {
            "duration_max_seconds": {
                "value": 300,
                "evidence": {
                    "url": self.doc["official_url"], "verified_at": "2026-09-30",
                    "scope": self.doc["edition"], "official": True,
                },
            },
        }
        self.store.upsert(self.doc)
        self.item_id = identity(self.doc)
        self.calls = []
        self.entered = threading.Event()
        self.release = threading.Event()
        # Never use system proxies, and never call the real public collector.
        self.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        self.server = None
        self.addCleanup(self.stop_server)
        self.start_server()

    def runner(self, store, **kwargs):
        self.calls.append(kwargs["run_id"])
        self.entered.set()
        if not self.release.wait(15):
            raise RuntimeError("isolated runner was not released")
        return {"fixture": True}

    def start_server(self):
        self.release.clear()
        self.entered.clear()
        self.manager = UpdateManager(self.store, runner=self.runner)
        self.server = make_server(self.store, 0, self.manager)
        self.thread = threading.Thread(
            target=lambda: self.server.serve_forever(poll_interval=0.01), daemon=True,
        )
        self.thread.start()
        self.base = f"http://127.0.0.1:{self.server.server_address[1]}"
        self.token = None
        self.token = self.ok("/api/state")["token"]

    def stop_server(self):
        if self.server is None:
            return
        self.release.set()
        self.manager.stop()
        self.server.shutdown()
        self.thread.join(3)
        self.server.server_close()
        self.server = None
        self.assertFalse(self.thread.is_alive())

    def request(self, path, body=None, *, token=True, origin=None):
        self.assertTrue(path.startswith("/"))
        headers = {}
        if body is not None:
            headers["Content-Type"] = "application/json"
        credential = self.token if token is True else token
        if credential:
            headers["X-Local-Token"] = credential
        if origin is not None:
            headers["Origin"] = origin
        request = urllib.request.Request(
            self.base + path,
            data=json.dumps(body, ensure_ascii=False).encode("utf-8") if body is not None else None,
            headers=headers,
        )
        try:
            response = self.opener.open(request, timeout=5)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            self.last_headers = response.headers
            raw = response.read()
            payload = json.loads(raw.decode("utf-8")) if "application/json" in response.headers.get("Content-Type", "") else raw
            return response.code, payload

    def ok(self, path, body=None):
        if body is not None and path == '/api/preference':
            body = copy.deepcopy(body)
            latest = self.ok('/api/detail?' + urlencode({'id':body['id']}))
            body.setdefault('expectedPreferenceRevision', latest['preference_revision'])
            body.setdefault('submissionId', uuid.uuid4().hex)
        elif body is not None and path == '/api/works/save' and body.get('id') is None:
            body = copy.deepcopy(body)
            body.setdefault('revision', 0)
            body.setdefault('submissionId', uuid.uuid4().hex)
        status, payload = self.request(path, body)
        self.assertEqual(status, 200, payload)
        return payload

    def snapshot(self):
        """Compare all persisted rows, rather than computed wall-clock UI fields."""
        with self.store.connection() as conn:
            names = [row[0] for row in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
            )]
            rows = {}
            for name in names:
                quoted = name.replace('"', '""')
                rows[name] = sorted(
                    [dict(row) for row in conn.execute(f'SELECT * FROM "{quoted}"')], key=json_text,
                )
        configs = {name: (self.root / "config" / name).read_bytes() for name in ("sources.json", "rules.json")}
        return rows, configs

    def candidate(self, *, known=False):
        url = self.doc["official_url"] if known else "https://www.liblib.tv/activity/987002"
        title = "2026 API已收录公告" if known else "2026 API待核创作线索"
        identifier, edition = candidate_identity("libtv", url, title)
        item = {
            "id": identifier, "source_id": "libtv", "official_url": url,
            "edition": edition, "title": title,
            "evidence": {
                "list_url": "https://www.liblib.tv/activity", "listed_title": title,
                "observed_at": "2026-09-30", "article_state": "not_checked",
            },
            "body": "只有公告线索，资格、开放期和奖励尚待核验",
            "known_item_id": self.item_id if known else None,
        }
        self.store.save_candidate(item)
        return item

    def test_default_profile_and_get_requests_do_not_claim_fit_or_start_collection(self):
        before = self.snapshot()
        state = self.ok("/api/state")
        self.assertEqual(set(state["work_profile"]), PROFILE_FIELDS)
        self.assertTrue(all(value is None for value in state["work_profile"].values()))
        self.assertEqual(state["items"][0]["fit"]["status"], "unknown")
        detail = self.ok("/api/detail?" + urlencode({"id": self.item_id}))
        self.assertEqual(detail["fit"]["account_status"], "unknown")
        self.assertIsNone(detail["verified_at"])
        self.assertTrue(self.ok("/api/digest")["limited"])
        self.assertEqual(self.ok("/api/backups"), [])
        self.assertEqual(self.snapshot(), before)
        self.assertEqual(self.calls, [])
        self.assertFalse(self.manager.status()["running"])
        self.assertEqual(self.server.server_address[0], "127.0.0.1")

    def test_direct_profile_save_errors_preserve_it_and_server_restart_persists_it(self):
        payload = {
            "duration_seconds": 240, "is_student": True, "ai_tools": [" Kling ", "kling", "LibTV"],
            "is_published": False, "uses_ai": True, "ai_percent": 50,
        }
        result = self.ok("/api/profile", payload)
        expected = {**payload, "ai_tools": ["Kling", "LibTV"]}
        self.assertTrue(result["saved"])
        self.assertEqual(result["work_profile"], expected)
        self.assertEqual(result["fits"][self.item_id]["status"], "matched")
        self.assertEqual(result["fits"][self.item_id]["account_status"], "unknown")
        self.assertEqual(self.ok("/api/detail?" + urlencode({"id": self.item_id}))["fit"]["status"], "matched")
        before = self.snapshot()
        invalid = (
            {"duration_seconds": -1}, {"is_student": "true"}, {"ai_percent": 101},
            {"uses_ai": False, "ai_tools": ["Kling"]}, {"unrecognized": True},
        )
        for bad in invalid:
            with self.subTest(payload=bad):
                status, error = self.request("/api/profile", bad)
                self.assertEqual(status, 400, error)
                self.assertIn("error", error)
                self.assertEqual(self.ok("/api/state")["work_profile"], expected)
                self.assertEqual(self.snapshot(), before)
        old_token = self.token
        self.stop_server()
        self.store = Store(self.root, self.path, seed=False)
        self.start_server()
        self.assertNotEqual(self.token, old_token)
        self.assertEqual(self.ok("/api/state")["work_profile"], expected)
        self.assertEqual(self.calls, [])

    def test_candidate_review_is_idempotent_and_rediscovery_preserves_manual_state(self):
        candidate = self.candidate()
        original = self.ok("/api/export")["documents"]
        for review in ("dismissed", "dismissed", "pending", "pending", "dismissed"):
            self.assertTrue(self.ok("/api/candidate/review", {"id": candidate["id"], "state": review})["saved"])
            selected = self.ok("/api/state")["candidates"][0]
            self.assertEqual(selected["review_state"], review)
            self.assertIsNone(selected["known_item_id"])
        first_seen = selected["first_seen_at"]
        self.assertFalse(self.store.save_candidate({**candidate, "body": ""}))
        repeated = self.ok("/api/state")["candidates"]
        self.assertEqual(len(repeated), 1)
        self.assertEqual(repeated[0]["first_seen_at"], first_seen)
        self.assertEqual(repeated[0]["review_state"], "dismissed")
        self.assertEqual(repeated[0]["body"], candidate["body"])
        self.assertEqual(self.ok("/api/export")["documents"], original)

    def test_known_candidate_can_return_to_pending_without_becoming_verified(self):
        candidate = self.candidate(known=True)
        state = self.ok("/api/state")
        self.assertEqual(state["candidates"][0]["review_state"], "known")
        before = self.ok("/api/export")
        self.ok("/api/candidate/review", {"id": candidate["id"], "state": "pending"})
        state = self.ok("/api/state")
        self.assertEqual(state["candidates"][0]["review_state"], "pending")
        self.assertEqual(state["candidates"][0]["known_item_id"], self.item_id)
        for review in ("verified", "known", "complete"):
            status, error = self.request("/api/candidate/review", {"id": candidate["id"], "state": review})
            self.assertEqual(status, 400, error)
        status, error = self.request("/api/candidate/review", {"id": "0" * 24, "state": "pending"})
        self.assertEqual(status, 400, error)
        after = self.ok("/api/export")
        self.assertEqual(after["documents"], before["documents"])
        self.assertEqual(after["versions"], before["versions"])
        self.assertEqual(after["library"]["candidates"][0]["review_state"], "pending")
        self.assertIsNone(after["documents"][0]["verified_at"])
        self.assertEqual(after["documents"][0]["verification"], "partial")

    def test_digest_get_keeps_a_historical_batch_separate_from_newer_changes(self):
        before = capture_before(self.store, NOW)
        self.store.start_run("api-history")
        historical = copy.deepcopy(self.doc)
        historical["entry_url"] = "https://www.liblib.tv/submit/second"
        self.store.upsert(historical)
        saved = finalize_digest(self.store, "api-history", before, NOW)
        self.store.finish_run("api-history", {"digest": saved})
        before_new = capture_before(self.store, NOW)
        self.store.start_run("api-newer")
        current = copy.deepcopy(historical)
        current["entry_url"] = "https://www.liblib.tv/submit/third"
        self.store.upsert(current)
        newer = finalize_digest(self.store, "api-newer", before_new, NOW)
        self.store.finish_run("api-newer", {"digest": newer})
        before_get = self.snapshot()
        result = self.ok("/api/digest?" + urlencode({"id": "api-history"}))
        self.assertEqual(result["run"]["id"], "api-history")
        self.assertFalse(result["limited"])
        self.assertEqual(result["events"], saved["events"])
        change = next(change for event in result["events"] for change in event["changes"] if change["field"] == "entry_url")
        self.assertEqual(change["after"], historical["entry_url"])
        self.assertEqual(self.ok("/api/digest")["run"]["id"], "api-newer")
        missing = self.ok("/api/digest?" + urlencode({"id": "does-not-exist"}))
        self.assertTrue(missing["limited"])
        self.assertEqual(missing["events"], [])
        self.assertEqual(self.snapshot(), before_get)
        self.assertEqual(self.calls, [])

    def test_backup_create_list_download_preview_and_unconfirmed_restore_do_not_modify_data(self):
        before = self.snapshot()
        backup = self.ok("/api/backup/create", {})
        self.assertEqual(backup["reason"], "manual")
        self.assertEqual(backup["counts"]["opportunities"], 1)
        listed = self.ok("/api/backups")
        self.assertEqual([row["id"] for row in listed], [backup["id"]])
        self.assertTrue(listed[0]["valid"])
        raw = self.ok("/api/backup/download?" + urlencode({"id": backup["id"]}))
        self.assertEqual(self.last_headers["Content-Type"], "application/zip")
        self.assertIn(backup["id"] + ".zip", self.last_headers["Content-Disposition"])
        with zipfile.ZipFile(io.BytesIO(raw)) as archive:
            self.assertEqual(set(archive.namelist()), {"manifest.json", "database.sqlite3", "config/sources.json", "config/rules.json"})
        preview = self.ok("/api/backup/preview", {"id": backup["id"]})
        self.assertTrue(preview["confirm_token"])
        self.assertTrue(preview["impact"]["overwrites_current_data"])
        for confirmed in (False, None, "true", 1):
            with self.subTest(confirmed=confirmed):
                status, error = self.request("/api/backup/restore", {
                    "id": backup["id"], "confirm_token": preview["confirm_token"], "confirmed": confirmed,
                })
                self.assertEqual(status, 400, error)
                self.assertEqual(self.snapshot(), before)
                self.assertEqual(len(self.ok("/api/backups")), 1)

    def test_confirmed_restore_preserves_all_rows_and_creates_a_pre_restore_snapshot(self):
        self.doc["summary"] = "第二版人工记录"
        self.store.upsert(self.doc, "第二版人工规则")
        self.ok("/api/preference", {"id": self.item_id, "starred": True, "note": "备份中的笔记\n第二行"})
        self.ok("/api/profile", {"duration_seconds": 240, "uses_ai": True})
        candidate = self.candidate()
        self.store.observe("libtv", self.doc["official_url"], "人工证据正文A", "raw-a", "api-evidence", "partial")
        self.store.observe("libtv", self.doc["official_url"], "人工证据正文B", "raw-b", "api-evidence", "partial")
        original = self.snapshot()
        backup = self.ok("/api/backup/create", {})
        self.ok("/api/preference", {"id": self.item_id, "starred": False, "note": "恢复前最新笔记"})
        self.ok("/api/profile", {"duration_seconds": 180})
        self.ok("/api/candidate/review", {"id": candidate["id"], "state": "dismissed"})
        extra = empty_document("libtv", "备份后新增记录", "LibTV", "https://www.liblib.tv/activity/987003", "2026 / 后增")
        self.store.upsert(extra)
        rules_path = self.root / "config" / "rules.json"
        rules = json.loads(rules_path.read_text(encoding="utf-8"))
        rules["new_publication_days"] += 1
        rules_path.write_text(json_text(rules), encoding="utf-8")
        current = self.snapshot()
        preview = self.ok("/api/backup/preview", {"id": backup["id"]})
        self.assertEqual(preview["impact"]["opportunities_removed"], 1)
        self.assertTrue(preview["impact"]["config_changed"])
        self.assertEqual(self.snapshot(), current)
        body = {"id": backup["id"], "confirm_token": preview["confirm_token"], "confirmed": True}
        restored = self.ok("/api/backup/restore", body)
        self.assertTrue(restored["restored"])
        self.assertEqual(restored["id"], backup["id"])
        self.assertEqual(self.snapshot(), original)
        state = self.ok("/api/state")
        self.assertTrue(state["items"][0]["starred"])
        self.assertEqual(state["items"][0]["note"], "备份中的笔记\n第二行")
        self.assertEqual(state["work_profile"]["duration_seconds"], 240)
        self.assertEqual(state["candidates"][0]["review_state"], "pending")
        detail = self.ok("/api/detail?" + urlencode({"id": self.item_id}))
        self.assertEqual(len(detail["versions"]), 2)
        self.assertEqual(len(detail["observations"]), 2)
        self.assertEqual(len(detail["page_changes"]), 1)
        listed = self.ok("/api/backups")
        self.assertEqual(len(listed), 2)
        pre_id = restored["pre_restore_backup"]
        self.assertEqual(next(row for row in listed if row["id"] == pre_id)["reason"], "pre_restore")
        raw = self.ok("/api/backup/download?" + urlencode({"id": pre_id}))
        with zipfile.ZipFile(io.BytesIO(raw)) as archive:
            self.assertEqual(json.loads(archive.read("manifest.json"))["reason"], "pre_restore")
            self.assertEqual(archive.read("config/rules.json"), current[1]["rules.json"])
            pre_db = self.root / "pre-restore-inspection.sqlite3"
            pre_db.write_bytes(archive.read("database.sqlite3"))
        with closing(sqlite3.connect(pre_db)) as conn:
            self.assertEqual(conn.execute("SELECT note FROM opportunities WHERE id=?", (self.item_id,)).fetchone()[0], "恢复前最新笔记")
            self.assertEqual(conn.execute("SELECT COUNT(*) FROM opportunities").fetchone()[0], 2)
            profile = json.loads(conn.execute("SELECT value FROM settings WHERE key='work_profile'").fetchone()[0])
            self.assertEqual(profile["duration_seconds"], 180)
        status, error = self.request("/api/backup/restore", body)
        self.assertEqual(status, 400, error)
        self.assertEqual(self.snapshot(), original)
        self.assertEqual(len(self.ok("/api/backups")), 2)

    def test_restore_rejects_a_note_saved_after_preview_without_creating_a_snapshot(self):
        backup = self.ok("/api/backup/create", {})
        preview = self.ok("/api/backup/preview", {"id": backup["id"]})
        self.ok("/api/preference", {"id": self.item_id, "note": "预览之后新保存，不得被旧确认覆盖"})
        changed = self.snapshot()
        status, error = self.request("/api/backup/restore", {
            "id": backup["id"], "confirm_token": preview["confirm_token"], "confirmed": True,
        })
        self.assertEqual(status, 400, error)
        self.assertIn("改变", error["error"])
        self.assertEqual(self.snapshot(), changed)
        self.assertEqual(len(self.ok("/api/backups")), 1)

    def test_restore_rejects_config_changes_after_preview(self):
        backup = self.ok("/api/backup/create", {})
        preview = self.ok("/api/backup/preview", {"id": backup["id"]})
        path = self.root / "config" / "rules.json"
        path.write_bytes(path.read_bytes() + b"\n")
        changed = self.snapshot()
        status, error = self.request("/api/backup/restore", {
            "id": backup["id"], "confirm_token": preview["confirm_token"], "confirmed": True,
        })
        self.assertEqual(status, 400, error)
        self.assertIn("改变", error["error"])
        self.assertEqual(self.snapshot(), changed)
        self.assertEqual(len(self.ok("/api/backups")), 1)

    def test_backup_download_distinguishes_missing_ids_from_path_traversal(self):
        before = self.snapshot()
        nonexistent = "backup-20260930T000000Z-" + "0" * 32
        status, error = self.request("/api/backup/download?" + urlencode({"id": nonexistent}))
        self.assertEqual(status, 404, error)
        for identifier in ("../config/rules.json", "..\\config\\rules.json", "C:\\outside.zip", "/tmp/outside.zip", nonexistent + ".zip"):
            with self.subTest(identifier=identifier):
                status, error = self.request("/api/backup/download?" + urlencode({"id": identifier}))
                self.assertEqual(status, 400, error)
        self.assertEqual(self.snapshot(), before)
        self.assertEqual(self.ok("/api/backups"), [])

    def test_external_origins_and_missing_tokens_cannot_mutate_new_endpoints(self):
        candidate = self.candidate()
        backup = self.ok("/api/backup/create", {})
        preview = self.ok("/api/backup/preview", {"id": backup["id"]})
        before = self.snapshot()
        mutations = (
            ("/api/profile", {"duration_seconds": 120}),
            ("/api/candidate/review", {"id": candidate["id"], "state": "dismissed"}),
            ("/api/backup/create", {}),
            ("/api/backup/preview", {"id": backup["id"]}),
            ("/api/backup/restore", {"id": backup["id"], "confirm_token": preview["confirm_token"], "confirmed": True}),
            ("/api/preference", {"id": self.item_id, "starred": True}),
            ("/api/update", {}),
        )
        for path, body in mutations:
            for options in ({"origin": "https://foreign.example"}, {"token": False}):
                with self.subTest(path=path, options=options):
                    status, error = self.request(path, body, **options)
                    self.assertEqual(status, 403, error)
        for path in ("/api/state", "/api/digest", "/api/backups", "/api/backup/download?" + urlencode({"id": backup["id"]})):
            with self.subTest(path=path):
                status, error = self.request(path, origin="https://foreign.example")
                self.assertEqual(status, 403, error)
        self.assertEqual(self.snapshot(), before)
        self.assertEqual(len(self.ok("/api/backups")), 1)
        self.assertEqual(self.calls, [])

    def test_running_collector_blocks_preview_and_restore_but_not_consistent_backup(self):
        backup = self.ok("/api/backup/create", {})
        preview = self.ok("/api/backup/preview", {"id": backup["id"]})
        before = self.snapshot()
        status, update = self.request("/api/update", {})
        self.assertEqual(status, 202, update)
        self.assertTrue(self.entered.wait(3))
        self.assertTrue(self.manager.status()["running"])
        for path, body in (
            ("/api/backup/preview", {"id": backup["id"]}),
            ("/api/backup/restore", {"id": backup["id"], "confirm_token": preview["confirm_token"], "confirmed": True}),
        ):
            status, error = self.request(path, body)
            self.assertEqual(status, 409, error)
        self.assertEqual(self.snapshot(), before)
        self.assertEqual(len(self.ok("/api/backups")), 1)
        self.assertEqual(self.ok("/api/backup/create", {})["counts"], backup["counts"])
        self.release.set()
        self.manager.thread.join(3)
        self.assertFalse(self.manager.status()["running"])
        self.assertEqual(len(self.calls), 1)
        self.assertTrue(self.ok("/api/backup/restore", {
            "id": backup["id"], "confirm_token": preview["confirm_token"], "confirmed": True,
        })["restored"])
        self.assertEqual(self.snapshot(), before)


if __name__ == "__main__":
    unittest.main()
