import copy
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

from helpers import ScopedTemp
from opportunities.digest import build_digest, capture_before, finalize_digest, summarize_run
from opportunities.model import empty_document, identity, json_text
from opportunities.storage import Store


ROOT = Path(__file__).resolve().parents[1]
NOW = datetime(2026, 9, 30, 12, tzinfo=timezone.utc)


def document():
    doc = empty_document("libtv", "AI短片征集", "LibTV", "https://www.liblib.tv/activity/998", "2026")
    doc["time"].update(mechanism="fixed", confirmed=True, start="2026-09-01T00:00:00+00:00", deadline="2026-11-01T23:59:00+00:00", evidence="官方投稿窗口")
    doc["evidence"] = [{"url": doc["official_url"], "excerpt": "当届官方规则", "observed_at": "2026-09-29T12:00:00+00:00"}]
    return doc


class DigestTests(unittest.TestCase):
    def setUp(self):
        self.temp = ScopedTemp(ROOT / "output", "test-")
        self.store = Store(ROOT, Path(self.temp.name) / "library.sqlite3", seed=False)

    def tearDown(self):
        self.temp.cleanup()

    def snapshots(self, doc):
        self.store.upsert(doc)
        return capture_before(self.store, NOW)

    def finish(self, before, at=None):
        return build_digest(before, capture_before(self.store, at or NOW), at=at or NOW)

    def test_new_item_is_not_new_expiry_even_when_historical(self):
        before = capture_before(self.store, NOW)
        doc = document()
        doc["time"].update(start="2025-01-01", deadline="2025-09-01")
        self.store.upsert(doc)
        self.store.archive_expired(NOW)
        digest = self.finish(before)
        self.assertEqual(digest["counts"]["new"], 1)
        self.assertEqual(digest["counts"]["expired"], 0)
        event = digest["events"][0]
        self.assertEqual(event["status_after"]["code"], "closed")
        self.assertEqual(event["official_url"], doc["official_url"])
        self.assertEqual(event["version_after"], 1)

    def test_already_closed_and_late_archive_does_not_forge_expiry(self):
        doc = document()
        doc["time"].update(start="2025-01-01", deadline="2025-09-01")
        before = self.snapshots(doc)
        self.assertEqual(self.store.archive_expired(NOW), 1)
        digest = self.finish(before)
        self.assertEqual(digest["counts"]["expired"], 0)
        self.assertEqual(digest["events"], [])

    def test_clock_crossing_confirmed_deadline_is_traceable_and_kept(self):
        doc = document()
        doc["time"]["deadline"] = "2026-09-30T12:00:05+00:00"
        before = self.snapshots(doc)
        self.store.archive_expired(NOW + timedelta(seconds=10))
        digest = self.finish(before, NOW + timedelta(seconds=10))
        self.assertEqual(digest["counts"]["expired"], 1)
        event = next(row for row in digest["events"] if row["category"] == "expired")
        self.assertEqual(event["status_before"]["code"], "open")
        self.assertEqual(event["time_source"]["transition"], "clock_crossed_confirmed_boundary")
        self.assertEqual(event["time_source"]["time"]["deadline"], doc["time"]["deadline"])
        self.assertEqual(len(self.store.items()), 1)

    def test_unconfirmed_tentative_and_conflicting_dates_never_expire(self):
        for overrides in ({"confirmed": False}, {"deadline_tentative": True}, {"conflict": "官方日期冲突"}):
            with self.subTest(overrides=overrides):
                doc = document()
                doc["edition"] = json_text(overrides)
                doc["time"].update(start="2024-01-01", deadline="2025-01-01", **overrides)
                before = self.snapshots(doc)
                digest = self.finish(before, NOW + timedelta(days=2))
                self.assertEqual(digest["counts"]["expired"], 0)
                self.assertIsNone(next(row for row in self.store.items() if row["id"] == identity(doc))["archived_at"])

    def test_unknown_timezone_boundary_is_not_confirmed_expiry(self):
        doc = document()
        doc["time"].update(start="2026-09-01", deadline="2026-09-30T12:00:00", timezone=None)
        before = self.snapshots(doc)
        digest = self.finish(before, NOW + timedelta(hours=1))
        self.assertEqual(digest["counts"]["expired"], 0)
        self.assertEqual(capture_before(self.store, NOW + timedelta(hours=1))["items"][identity(doc)]["status"]["code"], "uncertain")
        later = self.finish(before, NOW + timedelta(days=2))
        self.assertEqual(later["counts"]["expired"], 1)

    def test_confirmed_expired_date_added_by_review_is_not_unknown_expiry(self):
        doc = document()
        doc["time"].update(confirmed=False, deadline=None)
        before = self.snapshots(doc)
        doc["time"].update(confirmed=True, start="2024-01-01", deadline="2025-01-01")
        self.store.upsert(doc)
        digest = self.finish(before)
        self.assertEqual(digest["counts"]["expired"], 1)
        event = next(row for row in digest["events"] if row["category"] == "expired")
        self.assertEqual(event["time_source"]["transition"], "confirmed_by_rule_update")

    def test_reward_types_and_multiple_prizes_are_not_combined_or_double_counted(self):
        doc = document()
        doc["rewards"] = [{"type": "cash", "amount": 100000, "label": "总奖金", "currency": "CNY"}, {"type": "cash", "amount": 50000, "label": "一等奖", "currency": "CNY"}, {"type": "credits", "amount": 10000, "label": "积分池", "validity": "3个月"}]
        before = self.snapshots(doc)
        doc["rewards"][0]["amount"] = 150000
        doc["rewards"][1]["amount"] = 70000
        doc["rewards"][2]["amount"] = 25000
        doc["rewards"][2]["validity"] = "6个月"
        self.store.upsert(doc)
        digest = self.finish(before)
        self.assertEqual(digest["counts"]["rules_changed"], 1)
        event = next(row for row in digest["events"] if row["category"] == "rules_changed")
        diffs = {row["field"]: row for row in event["changes"]}
        self.assertEqual(set(diffs), {"rewards.cash", "rewards.credits"})
        self.assertEqual(len(diffs["rewards.cash"]["before"]), 2)
        self.assertEqual(diffs["rewards.credits"]["before"][0]["amount"], 10000)
        self.assertEqual(diffs["rewards.credits"]["after"][0]["validity"], "6个月")

    def test_refresh_timestamps_excerpts_summary_tags_and_reward_order_are_noise(self):
        doc = document()
        doc["rewards"] = [{"type": "cash", "amount": 10, "label": "奖金", "source_excerpt": "原文A"}, {"type": "credits", "amount": 20, "label": "积分"}]
        before = self.snapshots(doc)
        doc["verified_at"] = "2026-09-30T12:00:00+00:00"
        doc["evidence"][0].update(observed_at="2026-09-30T12:00:00+00:00", excerpt="改写摘要")
        doc["rewards"][0]["source_excerpt"] = "原文A（新排版）"
        doc["rewards"].reverse()
        doc["time"]["evidence"] = "本次更新证据段落"
        doc.update(summary="页面导航文字", tags=["AI", "新导航"])
        self.store.upsert(doc)
        digest = self.finish(before)
        self.assertEqual(digest["counts"]["rules_changed"], 0)
        self.assertEqual(digest["events"], [])

    def test_rule_fields_have_exact_before_and_after(self):
        doc = document()
        doc.update(work_requirements=["时长3分钟"], steps=["官方表单投稿"], risks=[{"type": "licence", "detail": "非独家授权"}])
        doc["program"]["settlement"] = "每月结算"
        before = self.snapshots(doc)
        doc["work_requirements"] = ["时长5分钟"]
        doc["steps"] = ["官方表单投稿", "补交AI使用说明"]
        doc["risks"][0]["detail"] = "独家授权"
        doc["program"]["settlement"] = "每季度结算"
        self.store.upsert(doc)
        diffs = {row["field"]: row for row in self.finish(before)["events"][0]["changes"]}
        self.assertEqual(diffs["work_requirements"]["before"], ["时长3分钟"])
        self.assertEqual(diffs["program.settlement"]["after"], "每季度结算")
        self.assertIn("risks", diffs)

    def test_start_and_deadline_delays_distinguish_advance(self):
        doc = document()
        doc["time"]["start"] = "2026-10-01T00:00:00+00:00"
        before = self.snapshots(doc)
        doc["time"].update(start="2026-10-03T00:00:00+00:00", deadline="2026-10-30T23:59:00+00:00")
        self.store.upsert(doc)
        digest = self.finish(before)
        self.assertEqual(digest["counts"]["extended"], 1)
        self.assertEqual(digest["counts"]["shortened"], 1)
        self.assertEqual(digest["counts"]["rules_changed"], 0)
        fields = {row["category"]: row["changes"][0]["field"] for row in digest["events"]}
        self.assertEqual(fields["extended"], "time.start")
        self.assertEqual(fields["shortened"], "time.deadline")

    def test_changed_timezone_and_metadata_are_not_definite_extension(self):
        doc = document()
        doc["time"].update(deadline="2026-11-01T12:00:00", timezone=None)
        before = self.snapshots(doc)
        doc["time"].update(deadline="2026-11-01T13:00:00", timezone="+08:00", source_window={"end": "2030-01-01"})
        self.store.upsert(doc)
        digest = self.finish(before)
        self.assertEqual(digest["counts"]["extended"], 0)
        self.assertEqual(digest["counts"]["rules_changed"], 1)
        self.assertEqual([row["field"] for row in digest["events"][0]["changes"]], ["time.deadline", "time.timezone"])

    def test_local_official_date_delay_is_clear_even_with_timezone_unknown(self):
        doc = document()
        doc["time"].update(deadline="2026-11-01", timezone=None)
        before = self.snapshots(doc)
        doc["time"]["deadline"] = "2026-11-02"
        self.store.upsert(doc)
        digest = self.finish(before)
        self.assertEqual(digest["counts"]["extended"], 1)
        self.assertEqual(digest["counts"]["expired"], 0)

    def test_pure_builder_keeps_failed_attempts_without_store(self):
        before = capture_before(self.store, NOW)
        result = build_digest(before, before, [{"source_id": "libtv", "status": "failed", "message": "HTTP 403", "finished_at": NOW.isoformat(), "official_url": document()["official_url"]}])
        self.assertEqual(result["counts"]["failed"], 1)
        self.assertEqual(result["events"][0]["official_url"], document()["official_url"])

    def test_absolute_dates_are_compared_by_actual_instants(self):
        doc = document()
        doc["time"].update(deadline="2026-11-01T23:59:00", absolute_deadline="2026-11-01T15:59:00+00:00", timezone="+08:00")
        before = self.snapshots(doc)
        doc["time"].update(deadline="2026-11-01T15:59:00+00:00", absolute_deadline="2026-11-01T15:59:00+00:00")
        self.store.upsert(doc)
        self.assertEqual(self.finish(before)["counts"]["extended"], 0)
        before = capture_before(self.store, NOW)
        doc["time"]["absolute_deadline"] = "2026-11-02T15:59:00+00:00"
        self.store.upsert(doc)
        self.assertEqual(self.finish(before)["counts"]["extended"], 1)

    def test_failures_are_preserved_and_success_zero_has_no_fake_changes(self):
        before = capture_before(self.store, NOW)
        self.store.start_run("attempts")
        source = self.store.source_config[0]
        self.store.record_attempt("attempts", source, {"status": "failed", "message": "HTTP 403；保留已保存内容", "pages": 0}, "2026-09-30T12:00:00+00:00")
        self.store.record_attempt("attempts", source, {"status": "failed", "message": "重试仍受限", "pages": 0}, "2026-09-30T12:01:00+00:00")
        zero = self.store.source_config[1]
        self.store.record_attempt("attempts", zero, {"status": "success_zero", "message": "完整检查零新增", "pages": 1}, "2026-09-30T12:02:00+00:00")
        digest = finalize_digest(self.store, "attempts", before, NOW)
        self.assertEqual(digest["counts"]["failed"], 1)
        self.assertEqual(digest["counts"]["new"], 0)
        self.assertEqual(digest["counts"]["rules_changed"], 0)
        self.assertEqual(digest["events"][0]["message"], "重试仍受限")
        self.assertEqual(digest["events"][0]["official_url"], source["url"])

    def test_raw_page_diffs_stay_pending_and_are_counted_once_per_url(self):
        url = document()["official_url"]
        self.store.observe("libtv", url, "现金100积分200", "a", "old", "partial")
        before = capture_before(self.store, NOW)
        self.store.start_run("raw")
        self.store.observe("libtv", url, "现金100积分200\n导航A", "b", "raw", "partial")
        self.store.observe("libtv", url, "现金100积分200\n导航B", "c", "raw", "partial")
        digest = finalize_digest(self.store, "raw", before, NOW)
        self.assertEqual(digest["counts"]["review_pending"], 1)
        self.assertEqual(digest["counts"]["rules_changed"], 0)
        self.assertEqual(len(digest["events"][0]["page_diffs"]), 2)
        self.assertIn("导航B", digest["events"][0]["page_diffs"][1]["diff"])

    def test_saved_digest_keeps_historical_values_and_additional_categories(self):
        before = self.snapshots(document())
        self.store.start_run("saved")
        doc = document()
        doc["entry_url"] = "https://www.liblib.tv/submit/v2"
        self.store.upsert(doc)
        digest = finalize_digest(self.store, "saved", before, NOW)
        digest["counts"]["candidate_new"] = 3
        self.store.finish_run("saved", {"digest": digest})
        doc["entry_url"] = "https://www.liblib.tv/submit/v3"
        self.store.upsert(doc)
        result = summarize_run(self.store, "saved")
        self.assertFalse(result["limited"])
        self.assertEqual(result["counts"]["candidate_new"], 3)
        self.assertEqual(result["run"]["status"], "finished")
        self.assertEqual(result["events"][0]["changes"][0]["after"], "https://www.liblib.tv/submit/v2")

    def test_manual_verification_status_is_traceable_without_false_rule_change(self):
        doc = document()
        before = self.snapshots(doc)
        self.store.start_run("manual")
        doc.update(verification="reviewed", origin="manual_review", verified_at="2026-09-30T12:00:00+00:00")
        self.store.upsert(doc, "人工核验")
        digest = finalize_digest(self.store, "manual", before, NOW)
        self.assertEqual(digest["counts"]["rules_changed"], 0)
        self.assertEqual(digest["counts"]["status_changed"], 1)
        self.assertEqual(digest["events"][0]["changes"][0]["field"], "verification")

    def test_legacy_run_is_limited_uses_version_snapshot_urls_and_no_expiry(self):
        doc = document()
        doc["time"].update(start="2024-01-01", deadline="2025-01-01")
        self.store.upsert(doc)
        old_url = doc["official_url"]
        doc["entry_url"] = "https://www.liblib.tv/submit/legacy"
        self.store.upsert(doc)
        self.store.archive_expired(NOW)
        with self.store.connection() as conn:
            conn.execute("UPDATE versions SET at='2026-09-29T00:00:00+00:00' WHERE version=1")
            conn.execute("UPDATE versions SET at='2026-09-30T12:00:00+00:00' WHERE version=2")
            conn.execute("INSERT INTO runs VALUES('legacy','2026-09-30T11:00:00+00:00','2026-09-30T13:00:00+00:00','finished','{}')")
            changed_current = copy.deepcopy(doc)
            changed_current["official_url"] = "https://www.liblib.tv/activity/current-url"
            conn.execute("UPDATE opportunities SET document=? WHERE id=?", (json_text(changed_current), identity(doc)))
        result = summarize_run(self.store, "legacy")
        self.assertTrue(result["limited"])
        self.assertEqual(result["counts"]["expired"], 0)
        self.assertEqual(result["counts"]["rules_changed"], 1)
        self.assertEqual(result["events"][0]["official_url"], old_url)
        self.assertEqual(result["events"][0]["version_before"], 1)
        self.assertEqual(result["events"][0]["version_after"], 2)
        self.assertEqual(result["events"][0]["at"], "2026-09-30T12:00:00+00:00")

    def test_empty_and_unknown_runs_return_safe_empty_summary(self):
        self.assertTrue(summarize_run(self.store)["limited"])
        self.assertEqual(summarize_run(self.store, "absent")["events"], [])


if __name__ == "__main__":
    unittest.main()
