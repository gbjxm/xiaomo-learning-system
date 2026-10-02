import copy
import json
import shutil
import threading
import unittest
from pathlib import Path

from helpers import ScopedTemp
from opportunities.fit import get_profile, save_profile
from opportunities.model import empty_document
from opportunities.storage import Store
from opportunities.works import (
    application_id, delete_application, delete_work, list_workspace,
    prepare_application, save_application, save_work, validate_record,
)
from opportunities.workspace import validate_all_records


ROOT = Path(__file__).resolve().parents[1]


class WorkPreparationTests(unittest.TestCase):
    def setUp(self):
        self.temp = ScopedTemp(ROOT / "output" / "tests", "test-stage2-works-")
        self.root = Path(self.temp.name)
        (self.root / "config").mkdir()
        for name in ("sources.json", "rules.json"):
            shutil.copyfile(ROOT / "config" / name, self.root / "config" / name)
        self.store = Store(self.root, seed=False)
        self.doc = empty_document("libtv", "隔离副本 · 作品征集", "LibTV", "https://www.liblib.tv/activity/99999", "2026 / 测试")
        self.doc.update({"origin": "manual_review", "steps": ["提交成片和海报"], "work_requirements": ["不少于 2 分钟"], "risks": [{"type": "copyright", "level": "review", "detail": "未核完整授权"}]})
        self.addCleanup(self.temp.cleanup)
        self.store.upsert(self.doc)
        self.id = self.store.items()[0]["id"]

    def tearDown(self):
        pass

    def work(self, name="隔离作品", profile=None, id=None):
        return save_work(self.store, {"id": id, "revision": 0, "data": {"name": name, "profile": profile or {}}})["record"]

    def payload(self, work, status="considering", checklist=None):
        preparation = prepare_application(self.store, work["id"], self.id)
        return {"revision": 0, "expected_rule_hash": preparation["rule_snapshot"]["hash"],
                "data": {"work_id": work["id"], "opportunity_id": self.id, "status": status,
                         "notes": "", "checklist": checklist or []}}

    def test_multiple_work_profiles_are_independent_and_do_not_replace_legacy_profile(self):
        save_profile(self.store, {"duration_seconds": 240})
        first = self.work("短片", {"duration_seconds": 180})
        second = self.work("长片", {"duration_seconds": 720})
        self.assertNotEqual(first["id"], second["id"])
        self.assertEqual(len(list_workspace(self.store)["works"]), 2)
        self.assertEqual(get_profile(self.store)["duration_seconds"], 240)
        self.assertEqual(list_workspace(self.store)["applications"], [])

    def test_unknown_work_fields_and_account_stay_unknown(self):
        work = self.work()
        preparation = prepare_application(self.store, work["id"], self.id)
        self.assertTrue(all(value is None for value in work["data"]["profile"].values()))
        self.assertEqual(preparation["fit"]["status"], "unknown")
        self.assertEqual(preparation["account_status"], "unknown")

    def test_work_input_strict_validation_and_failed_writes_leave_no_records(self):
        bad = [{"name": "", "profile": {}}, {"name": "x" * 161, "profile": {}},
               {"name": "x", "profile": {"is_student": "true"}}, {"name": "x", "profile": {"duration_seconds": 604801}},
               {"name": "x", "profile": {"uses_ai": False, "ai_tools": ["即梦"]}},
               {"name": "x\x00", "profile": {}}, {"name": "x", "secret": 1}]
        for data in bad:
            with self.subTest(data=data), self.assertRaises(ValueError):
                save_work(self.store, {"data": data})
        self.assertEqual(list_workspace(self.store)["works"], [])

    def test_work_update_and_delete_use_optimistic_revision(self):
        work = self.work()
        updated = save_work(self.store, {"id": work["id"], "revision": 1, "data": {"name": "新名", "profile": {}}})["record"]
        self.assertEqual(updated["revision"], 2)
        with self.assertRaises(ValueError):
            save_work(self.store, {"id": work["id"], "revision": 1, "data": {"name": "旧写", "profile": {}}})
        with self.assertRaises(ValueError):
            delete_work(self.store, {"id": work["id"], "revision": 1, "confirmed": True})
        self.assertEqual(delete_work(self.store, {"id": work["id"], "revision": 2, "confirmed": True}), {"deleted": True})

    def test_preparation_preview_and_suggestions_do_not_mutate_any_record(self):
        work = self.work()
        before = list_workspace(self.store)
        preparation = prepare_application(self.store, work["id"], self.id)
        self.assertEqual(len(preparation["suggestions"]), 2)
        self.assertTrue(all(item["done"] is False for item in preparation["suggestions"]))
        self.assertEqual(list_workspace(self.store), before)

    def test_initial_record_needs_same_rule_preview_and_duplicate_click_fails(self):
        work = self.work()
        payload = self.payload(work)
        bad = copy.deepcopy(payload)
        bad["expected_rule_hash"] = "wrong"
        with self.assertRaises(ValueError):
            save_application(self.store, bad)
        record = save_application(self.store, payload)["record"]
        with self.assertRaises(ValueError):
            save_application(self.store, payload)
        self.assertEqual(len(list_workspace(self.store)["applications"]), 1)
        self.assertEqual(record["id"], application_id(work["id"], self.id))

    def test_personal_completion_is_separate_from_official_suggestion(self):
        work = self.work()
        preparation = prepare_application(self.store, work["id"], self.id)
        official = {**preparation["suggestions"][0], "done": True}
        personal = {"id": "personal-1", "label": "检查字幕", "done": False, "origin": "personal"}
        record = save_application(self.store, self.payload(work, checklist=[official, personal]))["record"]
        self.assertTrue(record["data"]["checklist"][0]["done"])
        self.assertEqual(record["data"]["checklist"][1]["origin"], "personal")
        self.assertEqual(self.store.details(self.id)["steps"], ["提交成片和海报"])

    def test_forged_official_checklist_and_false_origin_are_rejected(self):
        work = self.work()
        official = prepare_application(self.store, work["id"], self.id)["suggestions"][0]
        cases = [{**official, "label": "主办方保证我获奖"}, {**official, "rule_hash": "bad"},
                 {"id": "personal-1", "label": "自写", "done": False, "origin": "personal", "rule_version": 1},
                 {**official, "done": "true"}, {**official, "origin": "official"}]
        for item in cases:
            with self.subTest(item=item), self.assertRaises(ValueError):
                save_application(self.store, self.payload(work, checklist=[item]))
        self.assertEqual(list_workspace(self.store)["applications"], [])

    def test_duplicate_and_excessive_checklist_items_are_rejected(self):
        work = self.work()
        item = {"id": "personal-1", "label": "材料", "done": False, "origin": "personal"}
        for checklist in ([item, item], [{**item, "id": "personal-" + str(i)} for i in range(121)]):
            with self.assertRaises(ValueError):
                save_application(self.store, self.payload(work, checklist=checklist))

    def test_mark_submitted_requires_explicit_confirmation_and_is_local_only(self):
        work = self.work()
        payload = self.payload(work, status="submitted")
        with self.assertRaises(ValueError):
            save_application(self.store, payload)
        payload["submitted_confirmed"] = True
        saved = save_application(self.store, payload)
        self.assertEqual(saved["record"]["data"]["status"], "submitted")
        self.assertIn("没有", saved["note"])
        self.assertEqual(self.store.items()[0]["version"], 1)

    def test_rule_change_retains_original_snapshot_and_completion(self):
        work = self.work()
        original = prepare_application(self.store, work["id"], self.id)["suggestions"][0]
        record = save_application(self.store, self.payload(work, checklist=[{**original, "done": True}]))["record"]
        changed = copy.deepcopy(self.doc)
        changed["steps"] = ["新版要求新增授权书"]
        self.store.upsert(changed)
        preparation = prepare_application(self.store, work["id"], self.id)
        self.assertTrue(preparation["rule_changed"])
        self.assertTrue(list_workspace(self.store)["applications"][0]["rule_changed"])
        payload = {"id": record["id"], "revision": record["revision"], "data": {key:record["data"][key] for key in ("work_id", "opportunity_id", "status", "notes", "checklist")}}
        payload["data"]["notes"] = "仍按旧清单准备，待核"
        resaved = save_application(self.store, payload)
        self.assertTrue(resaved["rule_changed"])
        self.assertEqual(resaved["record"]["data"]["rule_snapshot"], record["data"]["rule_snapshot"])
        self.assertTrue(resaved["record"]["data"]["checklist"][0]["done"])

    def test_rule_refresh_explicit_and_uses_current_snapshot_with_new_unchecked_items(self):
        work = self.work()
        record = save_application(self.store, self.payload(work))["record"]
        self.doc["steps"] = ["新规则步骤"]
        self.store.upsert(self.doc)
        preparation = prepare_application(self.store, work["id"], self.id)
        payload = {"id": record["id"], "revision": 1, "refresh_rules": True,
                   "data": {key:record["data"][key] for key in ("work_id", "opportunity_id", "status", "notes", "checklist")}}
        with self.assertRaises(ValueError):
            save_application(self.store, payload)
        payload["expected_rule_hash"] = preparation["rule_snapshot"]["hash"]
        payload["data"]["checklist"] = preparation["suggestions"]
        saved = save_application(self.store, payload)
        self.assertFalse(saved["rule_changed"])
        self.assertEqual(saved["record"]["data"]["rule_snapshot"]["version"], 2)
        self.assertFalse(saved["record"]["data"]["checklist"][0]["done"])

    def test_verification_timestamp_only_does_not_raise_false_rule_change(self):
        work = self.work()
        save_application(self.store, self.payload(work))
        with self.store.connection() as conn:
            doc = copy.deepcopy(self.doc)
            doc["verified_at"] = "2026-09-30"
            conn.execute("UPDATE opportunities SET document=?,version=version+1 WHERE id=?", (json.dumps(doc), self.id))
        self.assertFalse(prepare_application(self.store, work["id"], self.id)["rule_changed"])

    def test_rule_evidence_check_time_noise_keeps_adopted_suggestion_version(self):
        self.doc["fit_rules"] = {"duration_min_seconds": {"value": 120, "evidence": {"url": self.doc["official_url"], "verified_at": "2026-09-29", "scope": self.doc["edition"], "official": True}}}
        self.store.upsert(self.doc)
        work = self.work()
        record = save_application(self.store, self.payload(work))["record"]
        self.doc["fit_rules"]["duration_min_seconds"]["evidence"]["verified_at"] = "2026-09-30"
        self.store.upsert(self.doc)
        preparation = prepare_application(self.store, work["id"], self.id)
        self.assertFalse(preparation["rule_changed"])
        self.assertNotEqual(preparation["suggestions"][0]["rule_version"], preparation["saved_suggestions"][0]["rule_version"])
        payload = {"id": record["id"], "revision": record["revision"], "data": {key:record["data"][key] for key in ("work_id", "opportunity_id", "status", "notes", "checklist")}}
        payload["data"]["checklist"] = preparation["saved_suggestions"]
        self.assertTrue(save_application(self.store, payload)["saved"])

    def test_work_with_linked_preparation_cannot_be_deleted(self):
        work = self.work()
        app = save_application(self.store, self.payload(work))["record"]
        with self.assertRaises(ValueError):
            delete_work(self.store, {"id": work["id"], "revision": 1, "confirmed": True})
        delete_application(self.store, {"id": app["id"], "revision": 1, "confirmed": True})
        delete_work(self.store, {"id": work["id"], "revision": 1, "confirmed": True})
        self.assertEqual(list_workspace(self.store)["works"], [])

    def test_delete_requires_confirmation_and_revision(self):
        work = self.work()
        app = save_application(self.store, self.payload(work))["record"]
        for payload in ({"id": app["id"], "revision": 1}, {"id": app["id"], "revision": 0, "confirmed": True}):
            with self.assertRaises(ValueError):
                delete_application(self.store, payload)
        self.assertEqual(len(list_workspace(self.store)["applications"]), 1)

    def test_missing_work_or_opportunity_invalid_status_and_wrong_pair_do_not_write(self):
        work = self.work()
        for field, value in (("work_id", "missing"), ("opportunity_id", "missing"), ("status", "approved")):
            payload = self.payload(work)
            payload["data"][field] = value
            with self.assertRaises(ValueError):
                save_application(self.store, payload)
        payload = self.payload(work)
        payload["id"] = "wrong"
        with self.assertRaises(ValueError):
            save_application(self.store, payload)

    def test_malicious_ids_text_urls_and_snapshot_tampering_rejected(self):
        for value in ("../data", "/tmp/x", "work:x", "x" * 81):
            with self.assertRaises(ValueError):
                self.work(id=value)
        work = self.work()
        record = save_application(self.store, self.payload(work))["record"]
        data = copy.deepcopy(record["data"])
        data["rule_snapshot"]["fields"]["official_url"] = "javascript:alert(1)"
        with self.assertRaises(ValueError):
            validate_record("applications", data)
        with self.store.connection() as conn:
            counts = validate_all_records(conn)
        self.assertEqual(counts["works"], 1)
        self.assertEqual(counts["applications"], 1)

    def test_parallel_duplicate_saves_produce_exactly_one_application(self):
        work = self.work()
        payload = self.payload(work)
        barrier = threading.Barrier(2)
        results = []
        def save():
            barrier.wait()
            try:
                save_application(self.store, payload)
                results.append("saved")
            except ValueError:
                results.append("conflict")
        threads = [threading.Thread(target=save) for _ in range(2)]
        for thread in threads:thread.start()
        for thread in threads:thread.join(10)
        self.assertCountEqual(results, ["saved", "conflict"])
        self.assertEqual(len(list_workspace(self.store)["applications"]), 1)

    def test_restart_preserves_works_and_material_completion(self):
        work = self.work("重启保存作品", {"duration_seconds": 240, "is_student": True})
        item = {"id": "personal-1", "label": "已做海报", "done": True, "origin": "personal"}
        save_application(self.store, self.payload(work, checklist=[item]))
        previous = list_workspace(self.store)
        restarted = Store(self.root, seed=False)
        self.assertEqual(list_workspace(restarted), previous)

    def test_all_real_46_documents_prepare_and_save_in_isolated_copy(self):
        import sqlite3
        with sqlite3.connect("file:" + (ROOT / "data" / "opportunities.sqlite3").as_posix() + "?mode=ro", uri=True) as conn:
            docs = [json.loads(row[0]) for row in conn.execute("SELECT document FROM opportunities ORDER BY id")]
        self.assertEqual(len(docs), 46)
        work = self.work("真实规则结构回归 · 隔离作品", {"duration_seconds": 240})
        for doc in docs:
            with self.subTest(title=doc["title"]):
                self.store.upsert(doc)
                preparation = prepare_application(self.store, work["id"], doc["id"])
                payload = {"revision": 0, "expected_rule_hash": preparation["rule_snapshot"]["hash"],
                           "data": {"work_id": work["id"], "opportunity_id": doc["id"], "status": "needs_review", "notes": "仅隔离演练", "checklist": preparation["suggestions"]}}
                saved = save_application(self.store, payload)["record"]
                self.assertEqual(saved["data"]["rule_snapshot"]["fields"]["risks"], doc["risks"])
                self.assertEqual(preparation["fit"]["account_status"], "unknown")
        self.assertEqual(len(list_workspace(self.store)["applications"]), 46)


if __name__ == "__main__":
    unittest.main()
