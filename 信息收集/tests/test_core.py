import copy
import json
import tempfile
import threading
import unittest
from helpers import ScopedTemp
from datetime import datetime, timezone
from pathlib import Path
from opportunities.collect import UpdateManager, candidate, labelled_window, libtv_data, parse_page, update_once
from opportunities.model import decorate, empty_document, identity, normalize, temporal_status
from opportunities.storage import AlreadyRunning, ProcessLock, Store

ROOT = Path(__file__).resolve().parents[1]
NOW = datetime(2026, 9, 30, 10, tzinfo=timezone.utc)

def document(kind="competition"):
    return empty_document("libtv", "AI短片征集", "LibTV", "https://www.liblib.tv/activity/999", "2026 / 活动999", kind)

class TimeTests(unittest.TestCase):
    def test_missing_deadline_never_means_evergreen_or_closed(self):
        doc = document()
        doc["time"].update(confirmed=True, mechanism="fixed", start="2026-01-01")
        self.assertEqual(temporal_status(doc, NOW)["code"], "unknown")
    def test_new_and_upcoming_are_independent(self):
        doc = document()
        doc["publication_at"] = "2026-09-29T10:00:00+00:00"
        doc["time"].update(confirmed=True, mechanism="fixed", start="2026-10-01", deadline="2026-11-01", timezone="UTC")
        rules = json.loads((ROOT / "config/rules.json").read_text(encoding="utf-8"))
        value = decorate(doc, rules, NOW)
        self.assertTrue(value["is_new_publication"])
        self.assertEqual(value["status"]["code"], "upcoming")
    def test_old_announcement_can_be_open(self):
        doc = document()
        doc["publication_at"] = "2026-01-01"
        doc["time"].update(confirmed=True, mechanism="fixed", start="2026-08-01", deadline="2026-11-01")
        rules = json.loads((ROOT / "config/rules.json").read_text(encoding="utf-8"))
        result = decorate(doc, rules, NOW)
        self.assertFalse(result["is_new_publication"])
        self.assertEqual(result["status"]["code"], "window")
    def test_unconfirmed_body_cannot_prove_closed(self):
        doc = document()
        doc["time"].update(deadline="2020-01-01", confirmed=False)
        self.assertEqual(temporal_status(doc, NOW)["code"], "unknown")
    def test_unknown_timezone_boundary_is_uncertain(self):
        doc = document()
        doc["time"].update(confirmed=True, mechanism="fixed", start="2026-09-01", deadline="2026-09-30T12:00:00")
        self.assertEqual(temporal_status(doc, NOW)["code"], "uncertain")
    def test_official_ongoing_and_batched_are_different(self):
        doc = document("creator_program")
        doc["time"].update(confirmed=True, mechanism="ongoing", evidence="官方明示常年开放")
        self.assertEqual(temporal_status(doc, NOW)["code"], "open")
        doc["time"]["mechanism"] = "batches"
        self.assertEqual(temporal_status(doc, NOW)["code"], "unknown")
    def test_policy_and_reward_validity_do_not_become_deadlines(self):
        doc = document("rule_update")
        doc["time"].update(confirmed=True, policy_effective="2026-05-01")
        doc["rewards"] = [{"type":"credits","label":"积分","validity":"3个月"}]
        self.assertEqual(temporal_status(doc, NOW)["code"], "effective")
        self.assertIsNone(doc["time"]["deadline"])
    def test_different_year_round_identity(self):
        a, b = document(), document()
        b["edition"] = "2027 / 活动999"
        self.assertNotEqual(identity(a), identity(b))
        b["edition"] = "2026 / 第2期"
        self.assertNotEqual(identity(a), identity(b))
    def test_non_https_evidence_link_is_rejected(self):
        doc = document()
        doc["official_url"] = "javascript:alert(1)"
        with self.assertRaises(ValueError):
            normalize(doc)
    def test_past_activity_metadata_is_possible_expiry_not_archive(self):
        doc = document()
        doc['time']['source_window']={'end':'2026-01-01T00:00:00+00:00'}
        result=temporal_status(doc,NOW)
        self.assertEqual(result['code'],'uncertain')
        self.assertTrue(result['possible_expired'])

class ParserTests(unittest.TestCase):
    def test_flight_string_records_without_newline_and_no_script_execution(self):
        body = "## 作品要求\nAI横版视频\n## 版权\n著作权授权待核\n"
        metadata = {"activityId":999,"name":"AI短片大赛","description":"$a","rewardDescription":"积分","startAt":1790000000000}
        flight = "a:T" + format(len(body.encode()), "x") + "," + body + "b:" + json.dumps(["$","component",None,{"items":[metadata]}], ensure_ascii=False)
        raw = "<h1>官方活动</h1><script>evil(); self.__next_f.push(" + json.dumps([1,flight],ensure_ascii=False) + ");</script>"
        parser = parse_page(raw)
        self.assertNotIn("evil", parser.text)
        items = libtv_data(parser)
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["description"], body)
    def test_dates_only_in_labelled_submission_context(self):
        self.assertIsNone(labelled_window("奖励积分有效期2026-01-01至2026-12-31"))
        self.assertEqual(labelled_window("**征稿期**：2026年9月21日15:00 - 2026年11月22日23:59:59")[:2], ("2026-09-21T15:00:00", "2026-11-22T23:59:59"))
        self.assertEqual(labelled_window("**征稿期**：2026年9月21日 15:00 —— 2026年11月22日 23:59:59")[:2], ("2026-09-21T15:00:00", "2026-11-22T23:59:59"))
    def test_metadata_window_does_not_fabricate_registration(self):
        source = {"id":"libtv","platform":"LibTV","url":"https://www.liblib.tv/activity"}
        rules = json.loads((ROOT / "config/rules.json").read_text(encoding="utf-8"))
        meta = {"activityId":999,"name":"AI限时福利","description":"图片规则","rewardDescription":"积分","startAt":1790000000000,"endAt":1790500000000}
        doc, complete = candidate(source,meta,rules)
        self.assertFalse(complete)
        self.assertFalse(doc["time"]["confirmed"])
        self.assertIn(temporal_status(doc,NOW)["code"],("unknown","uncertain"))
        self.assertNotEqual(temporal_status(doc,NOW)["code"],"closed")

class StorageTests(unittest.TestCase):
    def setUp(self):
        (ROOT / "output").mkdir(exist_ok=True)
        self.temp = ScopedTemp(ROOT / "output","test-")
        self.path = Path(self.temp.name) / "opportunities.sqlite3"
        self.store = Store(ROOT,self.path,seed=False)
    def tearDown(self):
        self.temp.cleanup()
    def test_versions_dedup_and_program_rule_history(self):
        doc = document("creator_program")
        doc["program"]["revenue"] = "收益规则A"
        self.assertEqual(self.store.upsert(doc),"new")
        self.assertEqual(self.store.upsert(doc),"unchanged")
        doc["program"]["revenue"] = "收益规则B"
        self.assertEqual(self.store.upsert(doc),"changed")
        detail = self.store.details(identity(doc))
        self.assertEqual(detail["version"],2)
        self.assertEqual(detail["versions"][0]["changes"][0]["field"],"program.revenue")
    def test_refresh_does_not_overwrite_manual_terms_or_notes(self):
        doc = document();doc["origin"] = "manual_handoff";doc["summary"] = "已核版权限制"
        self.store.upsert(doc)
        self.store.preference(identity(doc),starred=True,note="个人想法")
        incoming = copy.deepcopy(doc);incoming.update(origin="live_fetch",summary="只有标题")
        self.store.upsert(incoming)
        restarted = Store(ROOT,self.path,seed=False)
        item = restarted.items()[0]
        self.assertEqual(item["summary"],"已核版权限制")
        self.assertTrue(item["starred"])
        self.assertEqual(item["note"],"个人想法")
    def test_observation_differences_are_pending_and_repeat_is_not_change(self):
        self.assertFalse(self.store.observe("libtv","https://www.liblib.tv/activity/999","规则A","hash1","run","partial"))
        self.assertTrue(self.store.observe("libtv","https://www.liblib.tv/activity/999","规则B","hash2","run","partial"))
        self.assertFalse(self.store.observe("libtv","https://www.liblib.tv/activity/999","规则B","hash3","run","partial"))
        self.assertEqual(len(self.store.changes()["pages"]),1)
        self.assertEqual(self.store.changes()["pages"][0]["state"],"review_pending")
    def test_failure_keeps_last_success_and_never_reports_zero(self):
        source = self.store.source_config[0]
        self.store.record_attempt("older",source,{"status":"success_zero","message":"完整检查","pages":1},"2026-09-01")
        success = next(s for s in self.store.sources() if s["id"]==source["id"])["last_success_at"]
        def fail(*args):raise OSError("离线")
        result = update_once(self.store,fetcher=fail,source_ids={"libtv"})
        self.assertEqual(result["counts"]["failed"],1)
        self.assertEqual(result["counts"]["success_zero"],0)
        current = next(s for s in self.store.sources() if s["id"]==source["id"])
        self.assertEqual(current["last_success_at"],success)
        self.assertEqual(current["status"],"failed")
    def test_unknown_deadline_not_archived_and_real_expiry_is(self):
        unknown, old = document(), document()
        old["edition"] = "2025 / 活动999"
        old["time"].update(confirmed=True,deadline="2025-09-01")
        self.store.upsert(unknown);self.store.upsert(old)
        self.assertEqual(self.store.archive_expired(NOW),1)
        self.assertIsNone(next(x for x in self.store.items() if x["edition"]==unknown["edition"])["archived_at"])
    def test_complete_empty_selection_is_success_zero(self):
        # Valid public activities, none matches the configured film profile.
        self.store.rules["keywords"] = ["绝不匹配的关键词"]
        frame="a:"+json.dumps({"items":[{"activityId":999,"name":"其他主题","description":"其他内容"}]})
        raw="<script>self.__next_f.push("+json.dumps([1,frame])+");</script>"
        result=update_once(self.store,fetcher=lambda *args:(raw,"hash"),source_ids={"libtv"})
        self.assertEqual(result["counts"]["success_zero"],1)
    def test_process_lock_blocks_second_and_recovers(self):
        path = self.path.parent / "lock"
        with ProcessLock(path):
            with self.assertRaises(AlreadyRunning):
                with ProcessLock(path):pass
        with ProcessLock(path):pass
    def test_concurrent_clicks_reuse_task_and_cooldown(self):
        entered, release, calls = threading.Event(),threading.Event(),[]
        def runner(store,**kwargs):
            calls.append(kwargs["run_id"]);entered.set();release.wait(3);return {"done":True}
        manager = UpdateManager(self.store,runner=runner)
        first, started = manager.start();self.assertTrue(started);entered.wait(1)
        second, started = manager.start();self.assertFalse(started)
        self.assertEqual(first["run_id"],second["run_id"])
        release.set();manager.thread.join(3)
        self.assertEqual(len(calls),1)
        self.assertTrue(manager.start()[0]["cooldown"])

if __name__ == "__main__":
    unittest.main()
