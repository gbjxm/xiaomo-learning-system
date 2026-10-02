import base64
import copy
import json
import os
import unittest
from pathlib import Path
from unittest.mock import patch

from helpers import ScopedTemp
from opportunities.evidence import EvidenceManager, MAX_FILE_BYTES, validate_record
from opportunities.model import empty_document, normalize
from opportunities.storage import Store
from opportunities.workspace import get_record, records, validate_all_records
from test_visuals import png


ROOT = Path(__file__).resolve().parents[1]


class EvidenceTests(unittest.TestCase):
    def setUp(self):
        self.temp = ScopedTemp(ROOT / "output", "test-stage2-evidence-")
        self.store = Store(ROOT, Path(self.temp.name) / "opportunities.sqlite3", seed=False)
        self.manager = EvidenceManager(self.store)
        doc = empty_document("libtv", "征集", "LibTV", "https://www.liblib.tv/activity/991", "2026")
        self.store.upsert(doc)
        self.item_id = normalize(doc)["id"]

    def tearDown(self):
        self.temp.cleanup()

    def payload(self, content="官方规定：2分钟以上。".encode("utf-8"), name="规则.txt"):
        return {"item_id": self.item_id, "name": name, "content_base64": base64.b64encode(content).decode(), "source_url": "https://www.liblib.tv/activity/991", "observed_at": "2026-09-30", "verification": "unverified", "upload_id": "a" * 32}

    def test_text_import_is_hash_addressed_readable_append_only_and_download_not_inline(self):
        payload = self.payload()
        first = self.manager.import_file(payload)
        second = self.manager.import_file(payload)
        self.assertEqual(first, second)
        self.assertEqual(len(records(self.store, "attachments")), 1)
        self.assertEqual(first["data"]["text_state"], "plain_text")
        self.assertNotIn("storage_name", first["data"])
        raw, mime, filename = self.manager.file(first["id"])
        self.assertEqual(raw.decode(), "官方规定：2分钟以上。")
        self.assertEqual(mime, "application/octet-stream")
        self.assertTrue(filename.endswith(".txt"))
        record = get_record(self.store, "attachments", first["id"])
        self.assertTrue((self.store.db_path.parent / "attachments" / record["data"]["storage_name"]).is_file())

    def test_pdf_and_image_no_text_do_not_claim_ocr(self):
        for name, content in (("规则.pdf", b"%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n"), ("截图.png", png())):
            payload = self.payload(content, name)
            payload.pop("upload_id")
            record = self.manager.import_file(payload)
            self.assertEqual(record["data"]["text_state"], "no_text")
            self.assertIsNone(record["data"]["text"])
        payload = self.payload(png(), "截图.png")
        payload["text"] = "用户手工摘录：版权归作者。"
        record = self.manager.import_file(payload)
        self.assertEqual(record["data"]["text_state"], "user_supplied")

    def test_unsafe_names_types_magic_and_encoding_rejected(self):
        cases = [("../规则.txt", b"text"), ("C:\\规则.txt", b"text"), ("CON.txt", b"text"), ("规则.html", b"<script>alert(1)</script>"), ("规则.svg", b"<svg/>"), ("伪图.png", b"<html>fake</html>"), ("伪PDF.pdf", b"text"), ("二进制.txt", b"\x00\x00"), ("乱码.txt", b"\xff")]
        for name, content in cases:
            with self.subTest(name=name), self.assertRaises(ValueError):
                self.manager.import_file(self.payload(content, name))
        self.assertEqual(records(self.store, "attachments"), [])

    def test_large_empty_base64_and_nonpublic_source_rejected(self):
        for change in ({"content_base64": "!bad!"}, {"content_base64": ""}, {"content_base64": "a" * (4 * ((MAX_FILE_BYTES + 2) // 3) + 4)}, {"source_url": "https://127.0.0.1/rules"}, {"verification": "manual_checked", "note": ""}):
            payload = self.payload()
            payload.update(change)
            with self.subTest(change=list(change)), self.assertRaises(ValueError):
                self.manager.import_file(payload)

    def test_same_upload_id_cannot_be_reused_for_other_bytes_or_fields(self):
        self.manager.import_file(self.payload())
        payload = self.payload(b"new rules")
        with self.assertRaises(ValueError):
            self.manager.import_file(payload)
        self.assertEqual(len(records(self.store, "attachments")), 1)

    def test_changed_cached_file_rejected_not_silently_replaced(self):
        record = self.manager.import_file(self.payload())
        data = get_record(self.store, "attachments", record["id"])["data"]
        path = self.store.db_path.parent / "attachments" / data["storage_name"]
        path.write_bytes(b"tampered")
        with self.assertRaises(ValueError):
            self.manager.file(record["id"])
        payload = self.payload()
        payload["upload_id"] = "b" * 32
        with self.assertRaises(ValueError):
            self.manager.import_file(payload)
        self.assertEqual(path.read_bytes(), b"tampered")

    def test_field_evidence_is_bound_to_version_and_never_changes_official_rules(self):
        attachment = self.manager.import_file(self.payload())
        payload = {"item_id": self.item_id, "field": "work_requirements", "excerpt": "2分钟以上", "attachment_id": attachment["id"], "page": "第1页", "status": "manual_checked"}
        first = self.manager.save_field(payload)
        second = self.manager.save_field(payload)
        self.assertNotEqual(first["id"], second["id"])
        self.assertEqual(first["data"]["item_version"], 1)
        self.assertEqual(self.store.details(self.item_id)["work_requirements"], [])
        self.assertEqual(self.store.details(self.item_id)["version"], 1)
        with self.store.connection() as conn:
            self.assertEqual(validate_all_records(conn)["field_evidence"], 2)

    def test_other_item_attachment_cannot_be_cited(self):
        attachment = self.manager.import_file(self.payload())
        doc = empty_document("other", "另项", "官方", "https://www.bilibili.com/opus/992", "2026")
        self.store.upsert(doc)
        with self.assertRaises(ValueError):
            self.manager.save_field({"item_id": normalize(doc)["id"], "field": "risks", "excerpt": "版权归作者", "attachment_id": attachment["id"]})

    def test_annotation_needs_actual_source_and_no_unsupported_field(self):
        for change in ({"excerpt": ""}, {"field": "qualification_passed"}, {"source_url": "file:///C:/rules"}, {"source_url": "", "attachment_id": ""}):
            payload = {"item_id": self.item_id, "field": "time", "excerpt": "截止10月5日", "source_url": "https://www.liblib.tv/activity/991"}
            payload.update(change)
            with self.subTest(change=change), self.assertRaises(ValueError):
                self.manager.save_field(payload)

    def test_portable_metadata_validation_rejects_tampered_path_and_text_source(self):
        saved = self.manager.import_file(self.payload())
        original = get_record(self.store, "attachments", saved["id"])["data"]
        for change in ({"storage_name": "../rules.txt"}, {"sha256": "b" * 64}, {"size": True}, {"text_state": "no_text"}, {"source_url": "https://localhost/rules"}):
            data = copy.deepcopy(original)
            data.update(change)
            with self.subTest(change=change), self.assertRaises(ValueError):
                validate_record("attachments", data)

    def test_import_does_not_fetch_any_source_url(self):
        with patch("urllib.request.urlopen", side_effect=AssertionError("network forbidden")):
            self.manager.import_file(self.payload())
        self.assertEqual(len(self.manager.list(self.item_id)["attachments"]), 1)


if __name__ == "__main__":
    unittest.main()
