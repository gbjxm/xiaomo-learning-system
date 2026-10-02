"""Destructive/concurrent merge exercises use a new isolated SQLite database."""
import copy
import json
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest.mock import patch

from helpers import ScopedTemp
from opportunities.merging import MergeService, validate_record
from opportunities.model import empty_document, identity, json_text, normalize
from opportunities.storage import Store
from opportunities.workspace import records, validate_all_records

ROOT = Path(__file__).resolve().parents[1]


class MergeTests(unittest.TestCase):
    def setUp(self):
        self.temp = ScopedTemp(ROOT / "output", "test-stage2-merge-")
        self.root = Path(self.temp.name)
        (self.root / "config").mkdir()
        for name in ("sources.json", "rules.json"):
            (self.root / "config" / name).write_bytes((ROOT / "config" / name).read_bytes())
        self.store = Store(self.root, seed=False)
        self.target = empty_document("libtv", "2026测试AI短片创作大赛", "LibTV", "https://www.liblib.tv/activity/987654", "2026")
        self.source = empty_document("updream", "2026测试AI短片创作大赛", "LibTV", "https://www.updream.cn/activity/987654", "2026")
        self.target.update(summary="目标原有简介", origin="manual_review", verified_at="2026-09-30", evidence=[{"url": self.target["official_url"], "excerpt": "目标已核原文"}])
        self.source.update(summary="另一官方来源简介", evidence=[{"url": self.source["official_url"], "excerpt": "另一份原文"}])
        self.store.upsert(self.target, "隔离目标")
        self.store.upsert(self.source, "隔离来源")
        self.target = normalize(self.target)
        self.source = normalize(self.source)
        self.target_id, self.source_id = self.target["id"], self.source["id"]
        self.store.preference(self.target_id, starred=True, note="目标私人草稿\n不得拼接或覆盖")
        self.store.preference(self.source_id, starred=False, note="另一条的独立笔记")
        self.service = MergeService(self.store)

    def tearDown(self):
        self.temp.cleanup()

    def choices(self, source_fields=()):
        return {field["field"]: "source" if field["field"] in source_fields else "target" for field in self.service.compare(self.target_id, self.source_id)["fields"]}

    def merge(self, source_fields=("summary",), op="1" * 32):
        preview = self.service.preview(self.target_id, self.source_id, self.choices(source_fields))
        result = self.service.confirm(preview["confirm_token"], op, True)
        return preview, result

    def raw(self, item_id):
        with self.store.connection() as conn:
            return dict(conn.execute("SELECT * FROM opportunities WHERE id=?", (item_id,)).fetchone())

    def test_suspects_are_suggestions_not_automatic_mutations(self):
        before = [self.raw(self.target_id), self.raw(self.source_id)]
        results = self.service.suspects()
        self.assertEqual(len(results["pairs"]), 1)
        self.assertEqual(before, [self.raw(self.target_id), self.raw(self.source_id)])
        self.assertEqual(results["groups"], [])

    def test_preview_is_read_only_and_every_conflict_requires_a_choice(self):
        before = self.raw(self.target_id)
        with self.assertRaises(ValueError):
            self.service.preview(self.target_id, self.source_id, {})
        with self.assertRaises(ValueError):
            self.service.preview(self.target_id, self.source_id, {**self.choices(), "official_url": "source"})
        preview = self.service.preview(self.target_id, self.source_id, self.choices(("summary",)))
        self.assertEqual(preview["document"]["summary"], self.source["summary"])
        self.assertEqual(before, self.raw(self.target_id))

    def test_merge_retains_both_originals_notes_stars_sources_and_evidence(self):
        original_source = self.raw(self.source_id)
        _, result = self.merge()
        self.assertTrue(result["completed"])
        current = self.raw(self.target_id)
        doc = json.loads(current["document"])
        self.assertEqual(current["note"], "目标私人草稿\n不得拼接或覆盖")
        self.assertEqual(current["starred"], 1)
        self.assertEqual(original_source, self.raw(self.source_id))
        self.assertEqual(doc["official_url"], self.target["official_url"])
        self.assertEqual(doc["source_id"], self.target["source_id"])
        self.assertEqual(len(doc["evidence"]), 2)
        self.assertEqual(self.service.collapsed_item_ids(), [self.source_id])
        groups = self.service.groups()
        self.assertEqual([member["note"] for member in groups[0]["members"]], ["目标私人草稿\n不得拼接或覆盖", "另一条的独立笔记"])
        with self.store.connection() as conn:
            snapshots = [json.loads(row[0]) for row in conn.execute("SELECT snapshot FROM versions WHERE opportunity_id=? ORDER BY version", (self.target_id,))]
            self.assertEqual(snapshots[0], self.target)
            self.assertEqual(snapshots[-1], doc)

    def test_critical_changes_become_pending_not_newly_verified(self):
        source = copy.deepcopy(self.source)
        source["eligibility"] = ["新资格：只限学生"]
        self.store.upsert(source, "隔离来源补规则")
        preview, _ = self.merge(("eligibility",))
        self.assertEqual(preview["critical_pending"], ["eligibility"])
        self.assertIsNone(preview["document"]["verified_at"])
        self.assertEqual(preview["document"]["verification"], "partial")

    def test_merge_does_not_fill_unknown_personal_conditions(self):
        preview, _ = self.merge()
        self.assertNotIn("work_profile", preview["document"])
        self.assertEqual(preview["document"]["time"]["confirmed"], False)

    def test_same_entity_confirmation_is_strict(self):
        preview = self.service.preview(self.target_id, self.source_id, self.choices())
        for confirmed in (False, 1, "true", None):
            with self.subTest(confirmed=confirmed), self.assertRaises(ValueError):
                self.service.confirm(preview["confirm_token"], "2" * 32, confirmed)
        self.assertEqual(self.raw(self.target_id)["version"], 1)

    def test_concurrent_duplicate_confirmation_has_one_durable_write(self):
        preview = self.service.preview(self.target_id, self.source_id, self.choices())
        with ThreadPoolExecutor(max_workers=4) as executor:
            results = list(executor.map(lambda _: self.service.confirm(preview["confirm_token"], "3" * 32, True), range(4)))
        self.assertTrue(all(result == results[0] for result in results))
        self.assertEqual(self.raw(self.target_id)["version"], 2)
        self.assertEqual(len(self.service.groups()), 1)
        self.assertEqual(len(records(self.store, "merge_ops")), 1)

    def test_restart_reads_receipt_without_reusing_a_preview(self):
        preview, result = self.merge()
        restarted = MergeService(self.store)
        self.assertEqual(restarted.status("1" * 32), result)
        self.assertEqual(restarted.confirm(preview["confirm_token"], "1" * 32, True), result)
        self.assertEqual(restarted.status("a" * 32)["status"], "unknown")

    def test_operation_id_cannot_be_reused_for_another_request(self):
        preview, _ = self.merge()
        with self.assertRaises(ValueError):
            self.service.confirm("a-different-token", "1" * 32, True)
        with self.assertRaises(ValueError):
            self.service.confirm(preview["confirm_token"], "b" * 32, True)

    def test_preview_cannot_overwrite_a_new_target_version(self):
        preview = self.service.preview(self.target_id, self.source_id, self.choices())
        doc = copy.deepcopy(self.target)
        doc["summary"] = "预览后新增的有效信息"
        self.store.upsert(doc, "隔离并发更新")
        with self.assertRaises(ValueError):
            self.service.confirm(preview["confirm_token"], "4" * 32, True)
        self.assertEqual(json.loads(self.raw(self.target_id)["document"])["summary"], doc["summary"])
        self.assertEqual(self.service.groups(), [])

    def test_preview_cannot_ignore_a_new_source_version(self):
        preview = self.service.preview(self.target_id, self.source_id, self.choices())
        source = copy.deepcopy(self.source)
        source["summary"] = "来源变了"
        self.store.upsert(source, "隔离更新")
        with self.assertRaises(ValueError):
            self.service.confirm(preview["confirm_token"], "5" * 32, True)

    def test_same_version_restore_cannot_swap_source_under_preview(self):
        preview = self.service.preview(self.target_id, self.source_id, self.choices(("summary",)))
        doc = copy.deepcopy(self.source)
        doc["summary"] = "隔离模拟恢复了同版本、不同内容"
        with self.store.connection() as conn:
            conn.execute("UPDATE opportunities SET document=? WHERE id=?", (json_text(doc), self.source_id))
        with self.assertRaises(ValueError):
            self.service.confirm(preview["confirm_token"], "d" * 32, True)
        self.assertEqual(self.raw(self.target_id)["version"], 1)

    def test_concurrent_preference_changes_are_preserved(self):
        preview = self.service.preview(self.target_id, self.source_id, self.choices())
        self.store.preference(self.target_id, starred=False, note="预览后保存的新笔记")
        self.service.confirm(preview["confirm_token"], "6" * 32, True)
        self.assertEqual(self.raw(self.target_id)["note"], "预览后保存的新笔记")
        self.assertEqual(self.raw(self.target_id)["starred"], 0)

    def test_cancelled_and_expired_previews_never_write(self):
        first = self.service.preview(self.target_id, self.source_id, self.choices())
        self.service.cancel(first["confirm_token"])
        with self.assertRaises(ValueError):
            self.service.confirm(first["confirm_token"], "7" * 32, True)
        second = self.service.preview(self.target_id, self.source_id, self.choices())
        self.service._previews[second["confirm_token"]]["until"] = 0
        with self.assertRaises(ValueError):
            self.service.confirm(second["confirm_token"], "8" * 32, True)
        self.assertEqual(self.raw(self.target_id)["version"], 1)

    def test_different_edition_year_round_kind_and_parent_child_are_blocked(self):
        for changes in ({"edition": "2027", "title": "2027测试AI短片创作大赛"}, {"edition": "2026 第二期"}, {"edition": "轮次未知"}, {"kind": "limited_benefit"}, {"title": "2026第二期测试AI短片创作大赛"}, {"relations": [{"type": "under_program", "target_id": self.target_id}]}):
            with self.subTest(changes=changes):
                doc = copy.deepcopy(self.source)
                doc.update(changes)
                doc["official_url"] = "https://www.updream.cn/activity/" + str(len(changes)) + str(len(json.dumps(changes)))
                self.store.upsert(doc, "隔离不兼容记录")
                compared = self.service.compare(self.target_id, identity(doc))
                self.assertTrue(compared["blockers"])

    def test_identity_fields_are_never_selectable(self):
        fields = {field["field"] for field in self.service.compare(self.target_id, self.source_id)["fields"]}
        self.assertFalse(fields & {"id", "source_id", "official_url", "edition", "kind", "verification", "verified_at", "origin"})

    def test_no_optional_field_can_become_a_wrong_null_type(self):
        doc = copy.deepcopy(self.target)
        doc["assessment"] = {"role": "primary"}
        doc["relations"] = []
        doc["time"]["month_period"] = {"start": "2026-01", "end": "2026-12"}
        self.store.upsert(doc, "隔离可移除字段")
        preview = self.service.preview(self.target_id, self.source_id, self.choices(("assessment", "relations", "time.month_period")))
        self.assertNotIn("assessment", preview["document"])
        self.assertNotIn("month_period", preview["document"]["time"])

    def test_attachment_references_are_preserved_without_fetching(self):
        doc = copy.deepcopy(self.source)
        doc["source_attachments"] = [{"label": "官方章程", "url": "https://www.updream.cn/rules.pdf"}]
        self.store.upsert(doc, "隔离附件链接")
        preview, _ = self.merge()
        self.assertEqual(preview["document"]["source_attachments"], doc["source_attachments"])

    def test_dangerous_external_addresses_cannot_enter_merged_evidence(self):
        for url in ("javascript:alert(1)", "https://127.0.0.1/a", "https://localhost/a", "file:///c:/secret", "https://10.0.0.1/a"):
            with self.subTest(url=url):
                doc = copy.deepcopy(self.source)
                doc["evidence"] = [{"url": url, "excerpt": "不可信链接"}]
                self.store.upsert(doc, "隔离恶意输入")
                with self.assertRaises(ValueError):
                    self.service.preview(self.target_id, self.source_id, self.choices())

    def test_undo_adds_a_version_and_keeps_all_preferences(self):
        _, result = self.merge()
        self.store.preference(self.target_id, note="归并后新笔记")
        self.store.preference(self.source_id, starred=True, note="来源的新笔记")
        preview = self.service.undo_preview(result["group_id"])
        with self.assertRaises(ValueError):
            self.service.undo(preview["confirm_token"], "9" * 32, False)
        undone = self.service.undo(preview["confirm_token"], "9" * 32, True)
        self.assertEqual(json.loads(self.raw(self.target_id)["document"]), self.target)
        self.assertEqual(self.raw(self.target_id)["version"], 3)
        self.assertEqual(self.raw(self.target_id)["note"], "归并后新笔记")
        self.assertEqual(self.raw(self.source_id)["note"], "来源的新笔记")
        self.assertEqual(self.raw(self.source_id)["starred"], 1)
        self.assertEqual(self.service.collapsed_item_ids(), [])
        self.assertEqual(self.service.undo(preview["confirm_token"], "9" * 32, True), undone)
        self.assertEqual(self.service.groups()[0]["status"], "undone")

    def test_later_rule_change_blocks_unsafe_undo_but_original_remains_readable(self):
        _, result = self.merge()
        doc = json.loads(self.raw(self.target_id)["document"])
        doc["summary"] = "归并后新增的新信息"
        self.store.upsert(doc, "隔离后续版本")
        with self.assertRaises(ValueError):
            self.service.undo_preview(result["group_id"])
        self.assertIsNotNone(self.store.details(self.source_id))
        self.assertEqual(json.loads(self.raw(self.target_id)["document"])["summary"], doc["summary"])

    def test_undo_preview_does_not_cover_concurrent_rule_changes(self):
        _, result = self.merge()
        preview = self.service.undo_preview(result["group_id"])
        doc = copy.deepcopy(self.source)
        doc["summary"] = "撤销预览后来源改变"
        self.store.upsert(doc, "隔离并发改变")
        with self.assertRaises(ValueError):
            self.service.undo(preview["confirm_token"], "a" * 32, True)
        self.assertEqual(self.service.groups()[0]["status"], "active")

    def test_identical_field_group_and_undo_still_add_auditable_versions(self):
        doc = copy.deepcopy(self.source)
        doc["summary"] = self.target["summary"]
        doc["evidence"] = self.target["evidence"]
        self.store.upsert(doc, "隔离相同规则")
        _, result = self.merge(())
        self.assertEqual(self.raw(self.target_id)["version"], 2)
        preview = self.service.undo_preview(result["group_id"])
        self.service.undo(preview["confirm_token"], "b" * 32, True)
        self.assertEqual(self.raw(self.target_id)["version"], 3)

    def test_namespace_validation_rejects_tampered_snapshots_and_paths(self):
        _, result = self.merge()
        with self.store.connection() as conn:
            self.assertEqual(validate_all_records(conn)["merges"], 1)
            data = records(conn, "merges")[0]["data"]
        malicious = copy.deepcopy(data)
        malicious["target_before"]["official_url"] = "https://127.0.0.1/private"
        with self.assertRaises(ValueError):
            validate_record("merges", malicious)
        malicious = copy.deepcopy(data)
        malicious["choices"]["../../path"] = "source"
        with self.assertRaises(ValueError):
            validate_record("merges", malicious)
        self.assertEqual(result["group_id"], self.service.groups()[0]["id"])

    def test_injected_failure_rolls_back_document_group_and_receipt_together(self):
        preview = self.service.preview(self.target_id, self.source_id, self.choices(("summary",)))
        before = self.raw(self.target_id)
        with patch("opportunities.merging.put_record", side_effect=OSError("模拟磁盘写入失败")):
            with self.assertRaises(OSError):
                self.service.confirm(preview["confirm_token"], "c" * 32, True)
        self.assertEqual(before, self.raw(self.target_id))
        self.assertEqual(self.service.groups(), [])
        self.assertEqual(self.service.status("c" * 32)["status"], "unknown")


if __name__ == "__main__":
    unittest.main()
