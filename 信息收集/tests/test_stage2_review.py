import copy
import hashlib
import json
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest.mock import patch

from helpers import ScopedTemp
from opportunities.model import empty_document, normalize
from opportunities.review import ReviewManager, validate_record
from opportunities.storage import Store
from opportunities.workspace import records


ROOT = Path(__file__).resolve().parents[1]


class ReviewTests(unittest.TestCase):
    def setUp(self):
        self.temp = ScopedTemp(ROOT / "output", "test-stage2-review-")
        self.store = Store(ROOT, Path(self.temp.name) / "opportunities.sqlite3", seed=False)
        self.manager = ReviewManager(self.store)
        self.candidate_id = "a" * 24
        self.store.save_candidate({"id": self.candidate_id, "source_id": "libtv", "official_url": "https://www.liblib.tv/activity/991", "edition": "2026 / 活动991", "title": "AI短片征集", "evidence": {"list_url": "https://www.liblib.tv/activity", "article_state": "partial_text"}, "body": "官方原文：截止2026-10-05 24:00；现金总奖池20万元。"})

    def tearDown(self):
        self.temp.cleanup()

    def fields(self):
        return {"title": "AI短片征集", "platform": "LibTV", "edition": "2026 / 活动991", "kind": "competition", "official_url": "https://www.liblib.tv/activity/991", "summary": "原创AI短片征集", "excerpt": "官方原文：征集原创AI短片。", "eligibility": "全球个人或团队", "work_requirements": "至少2分钟", "rewards": [{"type": "cash", "amount": 200000, "currency": "CNY", "scope": "现金总奖池，非个人保证收益", "label": "官方总奖池"}]}

    def preview(self, fields=None):
        return self.manager.preview({"candidate_id": self.candidate_id, "action": "create", "fields": fields or self.fields()})

    def confirm(self, preview):
        return self.manager.confirm({"token": preview["token"], "operation_id": preview["operation_id"]})

    def test_preview_is_read_only_and_does_not_confirm_time_or_qualification(self):
        with self.store.connection() as conn:
            before = [tuple(row) for row in conn.execute("SELECT * FROM discovery_candidates")]
        preview = self.preview()
        self.assertEqual(self.store.items(), [])
        self.assertFalse(preview["preview"]["time"]["confirmed"])
        self.assertEqual(preview["preview"]["verification"], "partial")
        self.assertEqual(preview["preview"]["assessment"]["personal_eligibility"], "未核")
        with self.store.connection() as conn:
            self.assertEqual(before, [tuple(row) for row in conn.execute("SELECT * FROM discovery_candidates")])

    def test_confirm_creates_one_entry_and_idempotent_receipt_survives_restart(self):
        preview = self.preview()
        first = self.confirm(preview)
        second = self.confirm(preview)
        self.assertEqual(first, second)
        self.assertEqual(len(self.store.items()), 1)
        self.assertEqual(self.store.candidates()[0]["review_state"], "known")
        self.assertEqual(len(records(self.store, "candidate_links")), 1)
        restarted = ReviewManager(Store(ROOT, self.store.db_path, seed=False))
        self.assertEqual(restarted.receipt(preview["operation_id"]), first)
        with self.assertRaises(ValueError):
            restarted.confirm({"token": preview["token"], "operation_id": preview["operation_id"]})

    def test_parallel_confirm_has_one_rule_version(self):
        preview = self.preview()
        with ThreadPoolExecutor(max_workers=4) as pool:
            results = list(pool.map(lambda _: self.confirm(preview), range(4)))
        self.assertTrue(all(result == results[0] for result in results))
        with self.store.connection() as conn:
            self.assertEqual(conn.execute("SELECT COUNT(*) FROM versions").fetchone()[0], 1)

    def test_candidate_changed_after_preview_rejects_without_partial_write(self):
        preview = self.preview()
        self.store.candidate_review(self.candidate_id, "dismissed")
        with self.assertRaises(ValueError):
            self.confirm(preview)
        self.assertEqual(self.store.items(), [])
        self.assertEqual(records(self.store, "review_receipts"), [])

    def test_wrong_expired_token_and_payload_fields_rejected(self):
        preview = self.preview()
        with self.assertRaises(ValueError):
            self.manager.confirm({"token": "wrong", "operation_id": preview["operation_id"]})
        self.manager.previews[preview["token"]]["expires"] = 0
        with self.assertRaises(ValueError):
            self.confirm(preview)
        fields = self.fields()
        fields["verification"] = "complete"
        with self.assertRaises(ValueError):
            self.preview(fields)

    def test_no_machine_text_can_substitute_for_human_excerpt(self):
        fields = self.fields()
        fields["excerpt"] = ""
        with self.assertRaises(ValueError):
            self.preview(fields)

    def test_time_confirm_requires_excerpt_and_never_assumes_permanent(self):
        fields = self.fields()
        fields.update(time_verified=True, mechanism="ongoing")
        with self.assertRaises(ValueError):
            self.preview(fields)
        fields["time_excerpt"] = "官方明确常年开放，申请需审核。"
        preview = self.preview(fields)
        self.assertTrue(preview["preview"]["time"]["confirmed"])
        self.assertEqual(preview["preview"]["time"]["mechanism"], "ongoing")

    def test_24_hour_deadline_preserves_original_and_month_precision(self):
        fields = self.fields()
        fields.update(deadline="2026-10-05 24:00", timezone="+08:00", mechanism="fixed", time_verified=True, time_excerpt="10月5日24时截止")
        preview = self.preview(fields)
        self.assertEqual(preview["preview"]["time"]["deadline"], "2026-10-06T00:00:00")
        self.assertEqual(preview["preview"]["time"]["deadline_raw"], "2026-10-05 24:00")
        fields = self.fields()
        fields.update(month_start="2026-07", month_end="2026-12", mechanism="fixed")
        preview = self.preview(fields)
        self.assertEqual(preview["preview"]["time"]["month_period"], {"start": "2026-07", "end": "2026-12"})
        self.assertIsNone(preview["preview"]["time"]["deadline"])

    def test_invalid_urls_and_reward_amounts_rejected(self):
        for change in ({"official_url": "https://127.0.0.1/rules"}, {"entry_url": "file:///C:/rules"}, {"official_url": "javascript:alert(1)"}, {"rewards": [{"type": "cash", "amount": True, "label": "奖励"}]}, {"rewards": [{"type": "cash", "amount": -1, "label": "奖励"}]}):
            fields = self.fields()
            fields.update(change)
            with self.subTest(change=change), self.assertRaises(ValueError):
                self.preview(fields)

    def test_link_preserves_target_rule_star_note_and_disallows_other_year(self):
        doc = empty_document("other", "同届AI短片", "官方", "https://www.bilibili.com/opus/991", "2026 / 同届")
        self.store.upsert(doc)
        item_id = normalize(doc)["id"]
        self.store.preference(item_id, starred=True, note="我的准备笔记")
        before = self.store.details(item_id)
        preview = self.manager.preview({"candidate_id": self.candidate_id, "action": "link", "target_id": item_id})
        self.confirm(preview)
        after = self.store.details(item_id)
        self.assertEqual(before["versions"], after["versions"])
        self.assertEqual(after["note"], "我的准备笔记")
        self.assertTrue(after["starred"])
        old = empty_document("other", "上届", "官方", "https://www.bilibili.com/opus/992", "2025")
        self.store.upsert(old)
        with self.assertRaises(ValueError):
            self.manager.preview({"candidate_id": self.candidate_id, "action": "link", "target_id": normalize(old)["id"]})

    def test_target_note_changed_invalidates_link_preview(self):
        doc = empty_document("other", "同届", "官方", "https://www.bilibili.com/opus/991", "2026")
        self.store.upsert(doc)
        item_id = normalize(doc)["id"]
        preview = self.manager.preview({"candidate_id": self.candidate_id, "action": "link", "target_id": item_id})
        self.store.preference(item_id, note="预览后修改")
        with self.assertRaises(ValueError):
            self.confirm(preview)

    def test_same_year_different_known_round_or_title_year_cannot_link(self):
        with self.store.connection() as conn:
            conn.execute("UPDATE discovery_candidates SET title='2026第二届AI征集',edition='2026 / 第2届' WHERE id=?", (self.candidate_id,))
        doc = empty_document("other", "第三届AI征集", "官方", "https://www.bilibili.com/opus/992", "2026 / 第3届")
        self.store.upsert(doc)
        with self.assertRaises(ValueError):
            self.manager.preview({"candidate_id": self.candidate_id, "action": "link", "target_id": normalize(doc)["id"]})
        with self.store.connection() as conn:
            conn.execute("UPDATE discovery_candidates SET title='2025年第2届AI征集',edition='2026 / 第2届' WHERE id=?", (self.candidate_id,))
        with self.assertRaises(ValueError):
            self.manager.preview({"candidate_id": self.candidate_id, "action": "link", "target_id": normalize(doc)["id"]})

    def test_changed_official_url_warns_candidate_body_is_not_new_page_evidence(self):
        fields = self.fields()
        fields["official_url"] = "https://www.bilibili.com/opus/999"
        preview = self.preview(fields)
        self.assertTrue(any("原候选列表" in warning for warning in preview["warnings"]))
        self.assertEqual(preview["preview"]["evidence"][0]["url"], fields["official_url"])

    def test_database_failure_rolls_back_entry_and_candidate(self):
        preview = self.preview()
        with patch("opportunities.review.put_record", side_effect=ValueError("模拟提交失败")):
            with self.assertRaises(ValueError):
                self.confirm(preview)
        self.assertEqual(self.store.items(), [])
        self.assertEqual(self.store.candidates()[0]["review_state"], "pending")
        self.confirm(preview)
        self.assertEqual(len(self.store.items()), 1)

    def test_history_reads_full_old_versions_and_body_change_without_rule_overwrite(self):
        receipt = self.confirm(self.preview())
        old = self.store.details(receipt["item_id"])
        doc = copy.deepcopy(old)
        doc["eligibility"] = ["仅高校学生"]
        self.store.upsert(doc, "资格改变", protect_manual=False)
        self.store.observe("libtv", doc["official_url"], "旧原文：全球个人", "0" * 64, "test", "text_complete")
        self.store.observe("libtv", doc["official_url"], "新原文：仅高校学生", "1" * 64, "test", "text_complete")
        history = self.manager.history(receipt["item_id"])
        self.assertEqual(len(history["versions"]), 2)
        self.assertEqual(history["versions"][1]["snapshot"]["eligibility"], ["全球个人或团队"])
        self.assertIn("旧原文", history["page_changes"][0]["before_body"])
        self.assertIn("新原文", history["page_changes"][0]["after_body"])
        change_id = history["page_changes"][0]["id"]
        review = self.manager.review_change({"item_id": receipt["item_id"], "change_id": change_id, "state": "needs_review", "note": "需向主办方确认适用资格，未修改当前条款。"})
        self.assertEqual(review["data"]["origin"], "personal_judgment")
        self.assertEqual(self.store.details(receipt["item_id"])["version"], 2)
        self.assertEqual(self.manager.history(receipt["item_id"])["page_changes"][0]["review"]["data"]["state"], "needs_review")

    def test_latest_manual_judgment_is_append_order_even_with_same_second_and_reverse_random_ids(self):
        receipt = self.confirm(self.preview())
        item_id = receipt["item_id"]
        url = self.store.details(item_id)["official_url"]
        self.store.observe("libtv", url, "旧原文", "0" * 64, "test", "text_complete")
        self.store.observe("libtv", url, "新原文", "1" * 64, "test", "text_complete")
        change_id = self.manager.history(item_id)["page_changes"][0]["id"]
        with patch("opportunities.review.utcnow", return_value="2026-09-30T12:00:00+00:00"), patch("opportunities.review.secrets.token_hex", side_effect=["f" * 32, "b" * 32]):
            self.manager.review_change({"item_id": item_id, "change_id": change_id, "state": "reviewed", "note": "第一条"})
            self.manager.review_change({"item_id": item_id, "change_id": change_id, "state": "needs_review", "note": "第二条进一步发现缺口"})
        current = self.manager.history(item_id)["page_changes"][0]["review"]["data"]
        self.assertEqual(current["sequence"], 2)
        self.assertEqual(current["note"], "第二条进一步发现缺口")


if __name__ == "__main__":
    unittest.main()
