"""Independent stage-2 HTTP integration; every write is in a full isolated root.

No collector is started and no public network is contacted. These tests exercise
the API boundary in addition to the individual modules' unit tests.
"""
import base64
import copy
import hashlib
import http.client
import io
import json
import shutil
import sqlite3
import threading
import time
import unittest
import uuid
import zipfile
from contextlib import closing
from pathlib import Path
from urllib.parse import urlencode

from helpers import ScopedTemp
from opportunities.backup import FILES, _read_rows
from opportunities.evidence import MAX_FILE_BYTES
from opportunities.model import empty_document, json_text, normalize
from opportunities.server import make_server
from opportunities.storage import Store
from opportunities.works import _rule_hash


ROOT = Path(__file__).resolve().parents[1]


class NoCollectionManager:
    def __init__(self):
        self.calls = 0
        self.cancel = threading.Event()

    def status(self):
        return {"running": False, "run_id": None, "completed": 0, "total": 0}

    def start(self):
        self.calls += 1
        raise AssertionError("隔离 API 验收禁止启动采集")


class Stage2APITests(unittest.TestCase):
    def setUp(self):
        self.temp = ScopedTemp(ROOT / "output" / "tests", "http-test-stage2-api-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / "config").mkdir()
        for name in ("sources.json", "rules.json", "visual_assets.json"):
            shutil.copyfile(ROOT / "config" / name, self.root / "config" / name)
        shutil.copytree(ROOT / "static", self.root / "static")
        self.store = Store(self.root, seed=False)
        self.target = normalize(empty_document("libtv", "2026隔离API短片征集", "LibTV", "https://www.liblib.tv/activity/987654", "2026"))
        self.source = normalize(empty_document("updream", "2026隔离API短片征集", "LibTV", "https://www.updream.cn/activity/987654", "2026"))
        self.target.update(origin="manual_review", summary="目标简介", steps=["提交成片"], risks=[{"type": "exclusive", "level": "high", "detail": "独家条款须另核"}])
        self.source.update(origin="manual_review", summary="另一官方来源简介")
        self.store.upsert(self.target)
        self.store.upsert(self.source)
        self.target_id, self.source_id = self.target["id"], self.source["id"]
        self.store.preference(self.target_id, starred=True, note="目标独立笔记")
        self.store.preference(self.source_id, note="来源独立笔记")
        self.candidate_id = "a" * 24
        self.store.save_candidate({"id": self.candidate_id, "source_id": "libtv", "official_url": "https://www.liblib.tv/activity/991", "edition": "2026 / 活动991", "title": "隔离新线索", "evidence": {"list_url": "https://www.liblib.tv/activity", "article_state": "partial_text"}, "body": "机器提取：原创短片，现金总奖池二十万元。"})
        self.manager = NoCollectionManager()
        self.server = make_server(self.store, 0, self.manager)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.port = self.server.server_address[1]
        self.origin = f"http://127.0.0.1:{self.port}"
        self.addCleanup(self.close_server)
        self.token = self.call("/api/state")["token"]

    def close_server(self):
        self.server.shutdown()
        self.thread.join(3)
        self.server.server_close()
        self.assertFalse(self.thread.is_alive())
        self.assertEqual(self.manager.calls, 0)

    def request(self, path, body=None, *, token=True, origin=True, headers=None, raw=None, lost=False):
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=15)
        method = "POST" if body is not None or raw is not None else "GET"
        content = raw if raw is not None else json_text(body).encode() if body is not None else None
        pairs = [("Host", f"127.0.0.1:{self.port}")]
        if origin is not False:pairs.append(("Origin", self.origin if origin is True else origin))
        if method == "POST":
            pairs.extend([("Content-Type", "application/json"), ("Content-Length", str(len(content)))])
            if token is not False:pairs.append(("X-Local-Token", self.token if token is True else token))
        pairs.extend(headers or [])
        try:
            conn.putrequest(method, path, skip_host=True, skip_accept_encoding=True)
            for key, value in pairs:conn.putheader(key, value)
            conn.endheaders(content)
            if lost:return None
            response = conn.getresponse()
            raw_body = response.read()
            result = json.loads(raw_body) if response.getheader("Content-Type", "").startswith("application/json") else raw_body
            return response.status, result, dict(response.getheaders())
        finally:
            conn.close()

    def call(self, path, body=None, status=200, **kwargs):
        code, result, _ = self.request(path, body, **kwargs)
        self.assertEqual(code, status, str(result)[:1200])
        return result

    def rows(self):
        with self.store.connection() as conn:return _read_rows(conn)

    def candidate_preview(self):
        return self.call("/api/review/preview", {"candidate_id": self.candidate_id, "action": "create", "fields": {
            "title": "隔离新线索", "platform": "LibTV", "edition": "2026 / 活动991", "kind": "competition", "official_url": "https://www.liblib.tv/activity/991",
            "summary": "人工核读原创短片", "excerpt": "本次实际核读原文摘录（隔离夹具）", "work_requirements": "至少2分钟",
            "rewards": [{"type": "cash", "amount": 200000, "currency": "CNY", "label": "总奖池", "scope": "全部获奖者总池，非个人保证"}],
        }})

    def import_text(self, text="此附件可检索标记：正版授权特记", upload_id="b" * 32):
        return self.call("/api/evidence/import", {"item_id": self.target_id, "name": "规则.txt", "content_base64": base64.b64encode(text.encode()).decode(), "source_url": self.target["official_url"], "observed_at": "2026-09-30", "verification": "unverified", "upload_id": upload_id})

    def create_work(self):
        return self.call("/api/works/save", {"revision": 0, "data": {"name": "隔离作品", "profile": {"duration_seconds": 240}}})["record"]

    def prepare_work(self, work):
        return self.call("/api/works/prepare?" + urlencode({"work_id": work["id"], "opportunity_id": self.target_id}))

    def create_application(self):
        work = self.create_work()
        prepare = self.prepare_work(work)
        result = self.call("/api/applications/save", {"revision": 0, "expected_rule_hash": prepare["rule_snapshot"]["hash"], "data": {
            "work_id": work["id"], "opportunity_id": self.target_id, "status": "preparing", "notes": "独立准备笔记", "checklist": []}})
        return work, result["record"]

    def backup(self):
        backup = self.call("/api/backup/create", {})
        status, content, _ = self.request("/api/backup/download?" + urlencode({"id": backup["id"]}))
        self.assertEqual(status, 200)
        return backup, content

    def forge_archive(self, content, edit_database=None, extra=None):
        with zipfile.ZipFile(io.BytesIO(content)) as archive:
            payload = {name: archive.read(name) for name in archive.namelist()}
        if edit_database:
            database = self.root / ("forged-" + uuid.uuid4().hex + ".sqlite3")
            database.write_bytes(payload[FILES[0]])
            with closing(sqlite3.connect(database)) as conn:
                with conn:edit_database(conn)
            payload[FILES[0]] = database.read_bytes()
        if extra:payload.update(extra)
        manifest = json.loads(payload["manifest.json"])
        manifest["files"] = {name: {"size": len(value), "sha256": hashlib.sha256(value).hexdigest()} for name, value in payload.items() if name != "manifest.json"}
        payload["manifest.json"] = json_text(manifest).encode()
        output = io.BytesIO()
        with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for name, value in payload.items():archive.writestr(name, value)
        return output.getvalue()

    def test_local_read_startup_does_not_collect_or_seed_real_records(self):
        state = self.call("/api/state")
        self.assertEqual(len(state["items"]), 2)
        self.assertEqual(len(state["candidates"]), 1)
        self.assertEqual(state["runs"], [])
        self.assertTrue(all(source["last_attempt_at"] is None for source in state["sources"]))
        self.assertEqual(self.server.server_address[0], "127.0.0.1")

    def test_mutation_requires_correct_token_and_trusted_origin(self):
        before = self.rows()
        for token, origin in ((False, True), ("wrong", True), (True, "https://foreign.example"), (True, "null")):
            with self.subTest(token=token, origin=origin):
                self.call("/api/works/save", {"data": {"name": "拒绝", "profile": {}}}, status=403, token=token, origin=origin)
        self.assertEqual(before, self.rows())
        # Missing Origin is intentionally allowed for local command callers
        # possessing the secret token; it does not authorize foreign websites.
        self.call("/api/works/save", {"data": {"name": "本机命令调用", "profile": {}}}, origin=False)

    def test_duplicate_headers_json_keys_and_ambiguous_query_rejected(self):
        for headers in ([('Host', f'127.0.0.1:{self.port}')], [('Origin', self.origin)], [('X-Local-Token', self.token)]):
            with self.subTest(headers=headers):self.call("/api/works/save", {"data": {"name": "拒绝", "profile": {}}}, status=403, headers=headers)
        self.call("/api/works/save", raw=b'{"data":{"name":"one","name":"two","profile":{}}}', status=400)
        self.call("/api/search?q=a&q=b", status=400)
        self.call("/api/search?q=a&history=false", status=400)
        self.call("/api/works/prepare?work_id=a&work_id=b&opportunity_id=" + self.target_id, status=400)
        self.assertEqual(self.call("/api/works")["works"], [])

    def test_candidate_preview_confirm_repeated_and_receipt(self):
        before = self.rows()
        preview = self.candidate_preview()
        self.assertEqual(before, self.rows())
        self.assertFalse(preview["preview"]["time"]["confirmed"])
        payload = {"token": preview["token"], "operation_id": preview["operation_id"]}
        first = self.call("/api/review/confirm", payload)
        self.assertEqual(self.call("/api/review/confirm", payload), first)
        self.assertEqual(self.call("/api/review/receipt?id=" + preview["operation_id"]), first)
        detail = self.call("/api/detail?id=" + first["item_id"])
        self.assertEqual(detail["verification"], "partial")
        self.assertEqual(detail["version"], 1)
        self.assertEqual(len(self.call("/api/state")["items"]), 3)

    def test_lost_candidate_confirm_response_can_be_checked_without_resubmission(self):
        preview = self.candidate_preview()
        self.request("/api/review/confirm", {"token": preview["token"], "operation_id": preview["operation_id"]}, lost=True)
        receipt = None
        for _ in range(25):
            receipt = self.call("/api/review/receipt?id=" + preview["operation_id"])
            if receipt["status"] == "confirmed":break
            time.sleep(.02)
        self.assertEqual(receipt["status"], "confirmed")
        self.assertEqual(len(self.call("/api/state")["items"]), 3)

    def test_changed_candidate_after_preview_refuses_stale_confirmation(self):
        preview = self.candidate_preview()
        self.call("/api/candidate/review", {"id": self.candidate_id, "state": "dismissed"})
        self.call("/api/review/confirm", {"token": preview["token"], "operation_id": preview["operation_id"]}, status=400)
        self.assertEqual(len(self.call("/api/state")["items"]), 2)
        self.assertEqual(self.call("/api/review/receipt?id=" + preview["operation_id"])["status"], "unknown")

    def test_attachment_download_is_inert_and_same_upload_id_cannot_overwrite(self):
        body = '<script>window.unsafe=true</script>\n正版授权特记'
        attachment = self.import_text(body)
        code, downloaded, headers = self.request(attachment["data"]["download_url"])
        self.assertEqual(code, 200)
        self.assertEqual(downloaded.decode(), body)
        self.assertEqual(headers["Content-Type"], "application/octet-stream")
        self.assertTrue(headers["Content-Disposition"].startswith("attachment;"))
        self.assertEqual(headers["X-Content-Type-Options"], "nosniff")
        self.call("/api/evidence/import", {"item_id": self.target_id, "name": "规则.txt", "content_base64": base64.b64encode(b"replaced").decode(), "upload_id": attachment["id"]}, status=400)
        self.assertEqual(self.request(attachment["data"]["download_url"])[1].decode(), body)

    def test_attachment_file_type_path_size_and_nonpublic_source_rejected(self):
        base = {"item_id": self.target_id, "name": "规则.txt", "content_base64": base64.b64encode(b"plain text").decode()}
        for change in ({"name": "../rule.txt"}, {"name": "rule.html"}, {"name": "fake.png"}, {"source_url": "https://127.0.0.1/rules"}, {"content_base64": "!invalid!"}, {"content_base64": ""}):
            with self.subTest(change=change):self.call("/api/evidence/import", {**base, **change}, status=400)
        self.call("/api/evidence/import", {**base, "content_base64": "a" * (4*((MAX_FILE_BYTES+2)//3)+4)}, status=400)
        self.assertEqual(self.call("/api/evidence?id=" + self.target_id)["attachments"], [])

    def test_field_evidence_current_and_history_search_are_separate(self):
        attachment = self.import_text("历史授权特记")
        annotation = self.call("/api/evidence/field", {"item_id": self.target_id, "field": "risks", "excerpt": "历史授权特记", "attachment_id": attachment["id"], "page": "第1页", "status": "manual_checked"})
        self.assertEqual(annotation["data"]["item_version"], 1)
        result = self.call("/api/search?" + urlencode({"q": "历史授权特记"}))
        self.assertEqual(result["counts"]["items"], 1)
        self.assertTrue(any(match["kind"] == "field_evidence" for match in result["items"][0]["matches"]))
        changed = copy.deepcopy(self.target)
        changed["summary"] = "第二版没有旧授权词"
        self.store.upsert(changed)
        self.assertEqual(self.call("/api/search?" + urlencode({"q": "历史授权特记"}))["counts"]["items"], 0)
        old = self.call("/api/search?" + urlencode({"q": "历史授权特记", "history": "1"}))
        self.assertTrue(old["items"][0]["historical_only"])
        self.assertTrue(all(match["historical"] for match in old["items"][0]["matches"]))
        self.call("/api/evidence/field", {"item_id": self.source_id, "field": "risks", "excerpt": "不能借另一活动附件", "attachment_id": attachment["id"]}, status=400)

    def test_latest_body_search_and_full_old_body_history(self):
        self.store.observe("libtv", self.target["official_url"], "旧正文限定词ABCDE", "hash-old", "isolated", "text_complete")
        self.store.observe("libtv", self.target["official_url"], "新正文限定词FGHIJ", "hash-new", "isolated", "text_complete")
        self.assertEqual(self.call("/api/search?" + urlencode({"q": "旧正文限定词ABCDE"}))["counts"]["items"], 0)
        old = self.call("/api/search?" + urlencode({"q": "旧正文限定词ABCDE", "history": "1"}))
        self.assertTrue(old["items"][0]["historical_only"])
        history = self.call("/api/review/history?id=" + self.target_id)
        self.assertEqual(len(history["page_changes"]), 1)
        self.assertEqual(history["page_changes"][0]["before_body"], "旧正文限定词ABCDE")
        self.assertEqual(history["page_changes"][0]["after_body"], "新正文限定词FGHIJ")

    def test_saved_dynamic_view_delete_requires_confirmation_and_latest_revision(self):
        filters = {"view": "opportunities", "kind": "competition", "search": "原创", "platform": "all", "status": "all", "reward": "cash", "sort": "validity", "fit": "all", "include_history": False}
        saved = self.call("/api/saved-views", {"data": {"name": "我的现金征集", "filters": filters}, "expected_revision": 0})["record"]
        self.assertEqual(len(self.call("/api/state")["items"]), 2)
        self.call("/api/saved-views/remove", {"id": saved["id"], "expected_revision": saved["revision"]}, status=400)
        self.call("/api/saved-views/remove", {"id": saved["id"], "expected_revision": 0, "confirmed": True}, status=400)
        self.assertEqual(len(self.call("/api/saved-views")["views"]), 1)
        self.call("/api/saved-views/remove", {"id": saved["id"], "expected_revision": saved["revision"], "confirmed": True})
        self.assertEqual(self.call("/api/saved-views")["views"], [])

    def test_work_prepare_notes_stale_write_and_submitted_confirmation(self):
        work, application = self.create_application()
        preparation = self.prepare_work(work)
        self.assertEqual(preparation["account_status"], "unknown")
        self.assertTrue(all(item["done"] is False for item in preparation["suggestions"]))
        data = {key: application["data"][key] for key in ("work_id", "opportunity_id", "status", "notes", "checklist")}
        data.update(notes="新个人笔记", status="submitted")
        payload = {"id": application["id"], "revision": 1, "data": data}
        self.call("/api/applications/save", payload, status=400)
        self.call("/api/applications/save", {**payload, "submitted_confirmed": True})
        self.call("/api/applications/save", {**payload, "submitted_confirmed": True}, status=400)
        current = self.call("/api/works")["applications"][0]
        self.assertEqual(current["data"]["notes"], "新个人笔记")
        self.assertEqual(self.call("/api/detail?id=" + self.target_id)["note"], "目标独立笔记")
        self.call("/api/works/delete", {"id": work["id"], "revision": 1, "confirmed": True}, status=400)

    def test_merge_compare_preview_confirm_receipt_and_undo_preserve_originals(self):
        compared = self.call("/api/merge/compare", {"target_id": self.target_id, "source_id": self.source_id})
        self.assertEqual(compared["blockers"], [])
        choices = {field["field"]: "source" if field["field"] == "summary" else "target" for field in compared["fields"]}
        before = self.call("/api/detail?id=" + self.target_id)
        preview = self.call("/api/merge/preview", {"target_id": self.target_id, "source_id": self.source_id, "choices": choices})
        self.assertEqual(self.call("/api/detail?id=" + self.target_id)["version"], before["version"])
        payload = {"confirm_token": preview["confirm_token"], "operation_id": "1" * 32, "same_entity": True}
        result = self.call("/api/merge/confirm", payload)
        self.assertEqual(self.call("/api/merge/confirm", payload), result)
        self.assertEqual(self.call("/api/merge/status?id=" + payload["operation_id"]), result)
        detail = self.call("/api/detail?id=" + self.target_id)
        self.assertEqual(detail["summary"], self.source["summary"])
        self.assertEqual(detail["note"], "目标独立笔记")
        self.assertEqual(self.call("/api/detail?id=" + self.source_id)["note"], "来源独立笔记")
        undo = self.call("/api/merge/undo-preview", {"group_id": result["group_id"]})
        self.call("/api/merge/undo", {"confirm_token": undo["confirm_token"], "operation_id": "2" * 32, "confirmed": False}, status=400)
        self.call("/api/merge/undo", {"confirm_token": undo["confirm_token"], "operation_id": "2" * 32, "confirmed": True})
        final = self.call("/api/detail?id=" + self.target_id)
        self.assertEqual(final["summary"], before["summary"])
        self.assertEqual(final["version"], 3)
        self.assertEqual(final["note"], "目标独立笔记")

    def test_portable_backup_preview_restore_and_repeat_receipt(self):
        self.import_text()
        self.create_application()
        backup, archive = self.backup()
        self.assertGreater(backup["portable"]["media_files"], 0)
        self.assertEqual(backup["portable"]["attachment_files"], 1)
        with zipfile.ZipFile(io.BytesIO(archive)) as zipped:
            self.assertIn("config/visual_assets.json", zipped.namelist())
            self.assertTrue(any(name.startswith("static/media/") for name in zipped.namelist()))
            self.assertTrue(any(name.startswith("data/attachments/") for name in zipped.namelist()))
        self.call("/api/preference", {"id": self.target_id, "note": "恢复前应自动快照"})
        preview = self.call("/api/backup/preview", {"id": backup["id"]})
        payload = {"id": backup["id"], "confirm_token": preview["confirm_token"], "operation_id": "3" * 32, "confirmed": True}
        self.call("/api/backup/restore", {**payload, "confirmed": False}, status=400)
        result = self.call("/api/backup/restore", payload)
        self.assertTrue(result["restored"])
        self.assertEqual(self.call("/api/backup/restore", payload)["pre_restore_backup"], result["pre_restore_backup"])
        self.assertEqual(self.call("/api/backup/restore-status?operation=" + payload["operation_id"])["status"], "completed")
        self.assertEqual(self.call("/api/detail?id=" + self.target_id)["note"], "目标独立笔记")
        self.assertEqual(len(self.call("/api/works")["applications"]), 1)

    def test_malicious_backup_paths_and_forged_application_references_rejected(self):
        _, application = self.create_application()
        _, archive = self.backup()
        before = self.rows()
        malicious = self.forge_archive(archive, extra={"../escape.txt": b"not allowed"})
        self.call("/api/backup/import", {"content_base64": base64.b64encode(malicious).decode()}, status=400)
        for case in ("missing_version", "wrong_id", "forged_snapshot"):
            def edit(conn):
                key = "library:applications:" + application["id"]
                value = json.loads(conn.execute("SELECT value FROM settings WHERE key=?", (key,)).fetchone()[0])
                if case == "missing_version":value["data"]["rule_snapshot"]["version"] = 999
                elif case == "wrong_id":value["id"] = "application-forged"
                else:
                    snapshot = value["data"]["rule_snapshot"]
                    snapshot["fields"]["steps"] = ["虚构已经获奖"]
                    snapshot["hash"] = _rule_hash(snapshot["fields"])
                conn.execute("UPDATE settings SET key=?,value=? WHERE key=?", ("library:applications:" + value["id"], json_text(value), key))
            with self.subTest(case=case):
                forged = self.forge_archive(archive, edit_database=edit)
                self.call("/api/backup/import", {"content_base64": base64.b64encode(forged).decode()}, status=400)
        self.assertEqual(self.rows(), before)
        self.assertFalse((self.root.parent / "escape.txt").exists())


if __name__ == "__main__":
    unittest.main()
