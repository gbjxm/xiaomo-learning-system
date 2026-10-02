import copy
import json
import unittest
from pathlib import Path

from helpers import ScopedTemp
from opportunities.fit import evaluate_fit, get_profile, normalize_profile, save_profile
from opportunities.model import empty_document
from opportunities.storage import Store


ROOT = Path(__file__).resolve().parents[1]


def document(**rules):
    doc = empty_document("libtv", "短片征集", "LibTV", "https://www.liblib.tv/activity/999", "2026 / 活动999")
    doc["fit_rules"] = {field: rule(value, doc) for field, value in rules.items()}
    return doc


def rule(value, doc, **extra):
    return {"value": value, "evidence": {"url": doc["official_url"], "verified_at": "2026-09-30", "scope": doc["edition"], "official": True}, **extra}


class ProfileTests(unittest.TestCase):
    def test_defaults_are_unknown_not_suggested_student_or_four_minutes(self):
        self.assertTrue(all(value is None for value in normalize_profile({}).values()))

    def test_tools_are_trimmed_deduplicated_and_never_infer_profile_values(self):
        payload = {"ai_tools": [" Kling ", "Kling", "LibTV"]}
        normalized = normalize_profile(payload)
        self.assertEqual(normalized["ai_tools"], ["Kling", "LibTV"])
        self.assertIsNone(normalized["uses_ai"])
        self.assertEqual(payload["ai_tools"][0], " Kling ")
        self.assertEqual(normalize_profile({"ai_tools": []})["ai_tools"], [])

    def test_unknown_fields_and_non_object_are_rejected(self):
        for payload in ({"score": 90}, {"duration_minutes": 4}, [], None):
            with self.subTest(payload=payload), self.assertRaises(ValueError):
                normalize_profile(payload)

    def test_numeric_and_boolean_values_are_strict(self):
        for field, value in (("duration_seconds", 0), ("duration_seconds", -1), ("duration_seconds", True), ("duration_seconds", "240"), ("duration_seconds", float("inf")), ("duration_seconds", float("nan")), ("ai_percent", -0.1), ("ai_percent", 100.1), ("ai_percent", False), ("is_student", "true"), ("is_published", 1), ("uses_ai", "unknown")):
            with self.subTest(field=field, value=value), self.assertRaises(ValueError):
                normalize_profile({field: value})
        self.assertEqual(normalize_profile({"duration_seconds": 240.5, "ai_percent": 100})["duration_seconds"], 240.5)
        self.assertEqual(normalize_profile({"ai_percent": 0})["ai_percent"], 0)
        self.assertEqual(normalize_profile({"duration_seconds": 10 ** 400})["duration_seconds"], 10 ** 400)

    def test_tools_and_conflicting_ai_values_are_rejected(self):
        for payload in ({"ai_tools": "Kling"}, {"ai_tools": [""]}, {"ai_tools": [1]}, {"ai_tools": ["x" * 101]}, {"ai_tools": ["x"] * 31}, {"uses_ai": False, "ai_tools": ["Kling"]}, {"uses_ai": False, "ai_percent": 1}):
            with self.subTest(payload=payload), self.assertRaises(ValueError):
                normalize_profile(payload)


class FitTests(unittest.TestCase):
    def check(self, doc, profile):
        return evaluate_fit(doc, profile)["checks"][0]

    def test_no_structured_rule_or_unknown_profile_cannot_exclude(self):
        self.assertEqual(evaluate_fit(document(), {})["status"], "unknown")
        doc = document(duration_max_seconds=300, student_required=True)
        result = evaluate_fit(doc, {})
        self.assertEqual(result["status"], "unknown")
        self.assertTrue(all(check["status"] == "unknown" for check in result["checks"]))

    def test_duration_inclusive_boundaries_and_exclusive_rule(self):
        doc = document(duration_min_seconds=30, duration_max_seconds=300)
        for duration, expected in ((29.9, "mismatched"), (30, "matched"), (240, "matched"), (300, "matched"), (300.1, "mismatched")):
            with self.subTest(duration=duration):
                self.assertEqual(evaluate_fit(doc, {"duration_seconds": duration})["status"], expected)
        doc["fit_rules"]["duration_max_seconds"]["inclusive"] = False
        self.assertEqual(evaluate_fit(doc, {"duration_seconds": 300})["status"], "mismatched")
        self.assertEqual(self.check(document(duration_max_seconds=300), {"duration_seconds": 240})["expected"], {"max_seconds": 300, "inclusive": True})

    def test_student_and_publication_constraints(self):
        for field, user_field, allowed_value in (("student_required", "is_student", True), ("published_allowed", "is_published", False)):
            doc = document(**{field: field == "student_required"})
            self.assertEqual(evaluate_fit(doc, {user_field: allowed_value})["status"], "matched")
            self.assertEqual(evaluate_fit(doc, {user_field: not allowed_value})["status"], "mismatched")
            self.assertEqual(evaluate_fit(doc, {})["status"], "unknown")

    def test_explicit_permission_covers_unknown_values(self):
        doc = document(published_allowed=True, student_required=False, ai_allowed=True)
        self.assertEqual(evaluate_fit(doc, {})["status"], "matched")

    def test_multiple_tools_all_any_and_unknown(self):
        doc = document(required_tools=["Kling", "LibTV"])
        self.assertEqual(evaluate_fit(doc, {"ai_tools": [" kling ", "LibTV", "Other"]})["status"], "matched")
        self.assertEqual(evaluate_fit(doc, {"ai_tools": ["Kling"]})["status"], "mismatched")
        self.assertEqual(evaluate_fit(doc, {"ai_tools": []})["status"], "mismatched")
        self.assertEqual(evaluate_fit(doc, {})["status"], "unknown")
        doc["fit_rules"]["required_tools"]["mode"] = "any"
        self.assertEqual(evaluate_fit(doc, {"ai_tools": ["Kling"]})["status"], "matched")
        doc["fit_rules"]["required_tools"]["mode"] = "guess"
        self.assertEqual(evaluate_fit(doc, {"ai_tools": ["Other"]})["status"], "unknown")

    def test_ai_use_requirement_and_proportion_are_distinct(self):
        doc = document(ai_allowed=False)
        self.assertEqual(evaluate_fit(doc, {"uses_ai": False})["status"], "matched")
        self.assertEqual(evaluate_fit(doc, {"ai_tools": ["Kling"]})["status"], "mismatched")
        self.assertEqual(evaluate_fit(doc, {"ai_percent": 20})["status"], "mismatched")
        self.assertEqual(evaluate_fit(doc, {"ai_tools": []})["status"], "unknown")
        doc = document(ai_required=True, ai_min_percent=30, ai_max_percent=80)
        self.assertEqual(evaluate_fit(doc, {"uses_ai": True})["status"], "unknown")
        for percent, expected in ((29, "mismatched"), (30, "matched"), (80, "matched"), (81, "mismatched")):
            with self.subTest(percent=percent):
                self.assertEqual(evaluate_fit(doc, {"uses_ai": True, "ai_percent": percent})["status"], expected)

    def test_invalid_or_cross_edition_evidence_never_excludes(self):
        original = document(duration_max_seconds=1)
        for change in ({"official": False}, {"url": "javascript:alert(1)"}, {"verified_at": "yesterday"}, {"verified_at": None}, {"scope": "2025 / 活动999"}, {"scope": ""}):
            doc = copy.deepcopy(original)
            doc["fit_rules"]["duration_max_seconds"]["evidence"].update(change)
            with self.subTest(change=change):
                self.assertEqual(evaluate_fit(doc, {"duration_seconds": 240})["status"], "unknown")
        original["fit_rules"]["duration_max_seconds"].pop("evidence")
        self.assertEqual(evaluate_fit(original, {"duration_seconds": 240})["status"], "unknown")

    def test_bad_rule_types_are_unknown(self):
        for field, value in (("duration_max_seconds", -1), ("duration_max_seconds", "300"), ("duration_max_seconds", True), ("ai_max_percent", 101), ("student_required", "yes"), ("required_tools", "Kling"), ("required_tools", [])):
            with self.subTest(field=field, value=value):
                self.assertEqual(evaluate_fit(document(**{field: value}), {"duration_seconds": 240, "is_student": False, "ai_tools": []})["status"], "unknown")

    def test_conflicting_bounds_are_review_needed_not_exclusion(self):
        doc = document(duration_min_seconds=300, duration_max_seconds=100)
        self.assertEqual(evaluate_fit(doc, {"duration_seconds": 240})["status"], "unknown")
        doc = document(ai_min_percent=80, ai_max_percent=20)
        self.assertEqual(evaluate_fit(doc, {"ai_percent": 50})["status"], "unknown")
        doc = document(duration_min_seconds=100, duration_max_seconds=100)
        doc["fit_rules"]["duration_max_seconds"]["inclusive"] = False
        self.assertEqual(evaluate_fit(doc, {"duration_seconds": 100})["status"], "unknown")
        doc = document(ai_required=True, ai_allowed=False)
        self.assertEqual(evaluate_fit(doc, {"uses_ai": True})["status"], "unknown")

    def test_verified_failed_gate_remains_failure_with_other_unknowns(self):
        doc = document(duration_max_seconds=180, student_required=True)
        self.assertEqual(evaluate_fit(doc, {"duration_seconds": 240})["status"], "mismatched")

    def test_account_and_long_term_program_qualification_stay_unknown(self):
        doc = document(ai_required=True)
        doc["kind"] = "creator_program"
        doc["fit_rules"]["first_selection_required"] = rule(True, doc, applies_to="account")
        result = evaluate_fit(doc, {"uses_ai": True})
        self.assertEqual(result["status"], "matched")
        self.assertEqual(result["account_status"], "unknown")
        self.assertEqual(result["checks"][1]["status"], "unknown")
        self.assertFalse(result["checks"][1]["applicable"])
        self.assertIn("首次入选", result["note"])
        self.assertNotIn("score", result)

    def test_track_alternatives_are_not_combined_or_assumed(self):
        doc = document(duration_max_seconds=300)
        doc["fit_rules"]["alternatives"] = [{"name": "开放赛道", "rules": {}}, {"name": "命题赛道", "rules": {"required_tools": ["Kling"]}}]
        self.assertEqual(evaluate_fit(doc, {"duration_seconds": 240, "ai_tools": []})["status"], "unknown")

    def test_check_contract_and_inputs_are_preserved(self):
        doc = document(duration_max_seconds=300)
        before = copy.deepcopy(doc)
        profile = {"duration_seconds": 240}
        check = self.check(doc, profile)
        self.assertTrue({"field", "status", "label", "user_value", "rule_value", "evidence", "expected", "reason"} <= check.keys())
        self.assertEqual(check["user_value"], 240)
        self.assertEqual(check["rule_value"], 300)
        self.assertEqual(check["evidence"]["scope"], doc["edition"])
        self.assertEqual(doc, before)
        self.assertEqual(profile, {"duration_seconds": 240})


class ProfileStorageTests(unittest.TestCase):
    def setUp(self):
        self.temp = ScopedTemp(ROOT / "output", "test-fit-")
        self.path = Path(self.temp.name) / "opportunities.sqlite3"
        self.store = Store(ROOT, self.path, seed=False)

    def tearDown(self):
        self.temp.cleanup()

    def test_profile_round_trip_and_restart_use_settings(self):
        self.assertTrue(all(value is None for value in get_profile(self.store).values()))
        expected = save_profile(self.store, {"duration_seconds": 240, "is_student": True, "ai_tools": ["Kling", "LibTV"], "is_published": False, "uses_ai": True, "ai_percent": 50})
        restarted = Store(ROOT, self.path, seed=False)
        self.assertEqual(get_profile(restarted), expected)
        with restarted.connection() as conn:
            self.assertEqual(json.loads(conn.execute("SELECT value FROM settings WHERE key='work_profile'").fetchone()[0]), expected)

    def test_invalid_save_does_not_overwrite_and_empty_save_clears(self):
        expected = save_profile(self.store, {"duration_seconds": 240})
        with self.assertRaises(ValueError):
            save_profile(self.store, {"duration_seconds": "invalid"})
        self.assertEqual(get_profile(self.store), expected)
        save_profile(self.store, {})
        self.assertTrue(all(value is None for value in get_profile(self.store).values()))

    def test_corrupt_settings_remain_unknown_and_are_not_rewritten(self):
        for stored in ("not json", '["wrong type"]', '{"duration_seconds":-1}', '{"unknown_field":true}'):
            with self.subTest(stored=stored):
                with self.store.connection() as conn:
                    conn.execute("INSERT INTO settings(key,value) VALUES('work_profile',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", (stored,))
                self.assertTrue(all(value is None for value in get_profile(self.store).values()))
                with self.store.connection() as conn:
                    self.assertEqual(conn.execute("SELECT value FROM settings WHERE key='work_profile'").fetchone()[0], stored)


if __name__ == "__main__":
    unittest.main()
