import copy
import unittest

from opportunities.fit import evaluate_fit
from opportunities.model import empty_document


def document(**values):
    doc = empty_document("fixture", "对抗性隔离样本", "Fixture", "https://event-a.example/rules", "2026")
    doc["fit_rules"] = {name: {"value": value, "evidence": {"official": True, "url": doc["official_url"], "verified_at": "2026-09-30", "scope": doc["edition"]}} for name, value in values.items()}
    return doc


class AdversarialFitTests(unittest.TestCase):
    def test_permissive_publication_rule_does_not_cover_unmodeled_video_specs(self):
        doc = document(published_allowed=True)
        doc["work_requirements"] = ["可提交已公开作品", "视频时长、格式和提交端规格仍未核清"]
        result = evaluate_fit(doc, {"duration_seconds": 240, "is_published": False})
        self.assertEqual(result["status"], "unknown")
        self.assertEqual(result["checks"][0]["status"], "matched")
        self.assertEqual(result["checks"][-1]["field"], "work_coverage")
        self.assertEqual(result["label"], "已填条件相符，其他待确认")

    def test_known_unmodeled_work_requirement_remains_unresolved(self):
        doc = document(ai_max_percent=30)
        doc["work_requirements"] = ["实拍为主体，生成影像不超过30%"]
        self.assertEqual(evaluate_fit(doc, {"ai_percent": 20})["status"], "unknown")
        self.assertEqual(evaluate_fit(doc, {"ai_percent": 40})["status"], "mismatched")

    def test_explicit_gate_failure_is_not_weakened_by_coverage_gap(self):
        doc = document(duration_max_seconds=180)
        doc["work_requirements"] = ["其他画面规格尚待确认"]
        self.assertEqual(evaluate_fit(doc, {"duration_seconds": 240})["status"], "mismatched")

    def test_other_event_evidence_cannot_exclude_on_shared_edition(self):
        doc = document(duration_max_seconds=30)
        evidence = doc["fit_rules"]["duration_max_seconds"]["evidence"]
        evidence["url"] = "https://event-b.example/rules"
        self.assertEqual(evaluate_fit(doc, {"duration_seconds": 240})["status"], "unknown")
        doc["evidence"].append({"url": evidence["url"], "excerpt": "此活动关联的外部官方规则"})
        self.assertEqual(evaluate_fit(doc, {"duration_seconds": 240})["status"], "mismatched")

    def test_unhandled_track_date_or_alias_qualifier_never_becomes_hard_failure(self):
        for qualifier, value in (("track", "micro-only"), ("as_of", "2027-06-01"), ("aliases", {"ToolA": ["Tool A"]})):
            doc = document(required_tools=["ToolA"])
            doc["fit_rules"]["required_tools"][qualifier] = value
            with self.subTest(qualifier=qualifier):
                self.assertEqual(evaluate_fit(doc, {"ai_tools": ["Tool A"]})["status"], "unknown")

    def test_unknown_applicability_is_not_silently_ignored(self):
        doc = document(duration_max_seconds=300, student_required=True)
        doc["fit_rules"]["student_required"]["applies_to"] = "wrok"
        self.assertEqual(evaluate_fit(doc, {"duration_seconds": 240, "is_student": False})["status"], "unknown")

    def test_future_verification_cannot_confirm_a_rule(self):
        doc = document(duration_max_seconds=30)
        doc["fit_rules"]["duration_max_seconds"]["evidence"]["verified_at"] = "9999-12-31"
        self.assertEqual(evaluate_fit(doc, {"duration_seconds": 240})["status"], "unknown")

    def test_positive_ai_minimum_conflicts_with_ai_prohibition(self):
        doc = document(ai_allowed=False, ai_min_percent=50)
        for profile in ({"uses_ai": True, "ai_percent": 80}, {"uses_ai": False, "ai_percent": 0}):
            with self.subTest(profile=profile):
                result = evaluate_fit(doc, profile)
                self.assertEqual(result["status"], "unknown")
                self.assertTrue(all(check["status"] == "unknown" for check in result["checks"]))

    def test_unknown_and_zero_values_are_preserved(self):
        doc = document(ai_min_percent=50)
        self.assertEqual(evaluate_fit(doc, {"ai_percent": None})["status"], "unknown")
        self.assertEqual(evaluate_fit(doc, {"ai_percent": 0})["status"], "mismatched")
        self.assertEqual(evaluate_fit(document(ai_required=True), {"uses_ai": False})["status"], "mismatched")
        self.assertEqual(evaluate_fit(document(required_tools=["ToolA"]), {"ai_tools": []})["status"], "mismatched")


if __name__ == "__main__":
    unittest.main()
