"""Time and document-shape counterexamples, using isolated state and no network."""
import copy
import hashlib
import io
import json
import sqlite3
import struct
import unittest
import zipfile
from contextlib import closing
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from helpers import ScopedTemp
from opportunities.backup import BackupError, BackupManager
from opportunities.model import decorate, empty_document, identity, json_text, normalize, official_datetime, temporal_status, time_bounds
from opportunities.storage import Store


ROOT = Path(__file__).resolve().parents[1]
UTC = timezone.utc
NOW = datetime(2026, 9, 30, 12, tzinfo=UTC)
RULES = json.loads((ROOT / "config/rules.json").read_text(encoding="utf-8"))


def document(kind="competition"):
    doc = empty_document("libtv", "隔离时间边界", "LibTV", "https://www.liblib.tv/activity/987321", "2026 / 时间回归", kind)
    doc.update(origin="manual_review", verified_at="2026-09-29T12:00:00Z", evidence=[{"url": doc["official_url"], "excerpt": "当届官方公开规则"}])
    doc["time"].update(confirmed=True, mechanism="fixed", start="2026-09-01T00:00:00Z", deadline="2026-11-01T23:59:00Z", evidence="当届报名起止")
    return doc


class DocumentValidationTests(unittest.TestCase):
    def test_confirmation_and_tentative_flags_are_boolean_not_truthy_values(self):
        for name in ("confirmed", "deadline_tentative"):
            for value in ("false", "true", 0, 1, [], {}, None):
                with self.subTest(name=name, value=value):
                    doc = document()
                    doc["time"][name] = value
                    with self.assertRaises(ValueError):
                        normalize(doc)

    def test_invalid_containers_fail_cleanly_before_details_or_decoration(self):
        mutations = [
            ("time", []), ("program", None), ("assessment", []), ("importance", "high"),
            ("public_review", None), ("tags", {}), ("rewards", [None]), ("risks", ["text"]),
            ("evidence", [None]), ("relations", {}), ("source_attachments", {"length": 1}),
            ("source_attachments", [None]), ("fees", [None]), ("cash_tiers", {}),
            ("origin", {"toString": None}), ("verification", []), ("entry_url", []),
        ]
        for name, value in mutations:
            with self.subTest(name=name, value=value):
                doc = document()
                doc[name] = value
                with self.assertRaises(ValueError):
                    normalize(doc)
        for name, value in (("source_window", []), ("source_window", None), ("batches", "round1")):
            with self.subTest(name=name):
                doc = document()
                doc["time"][name] = value
                with self.assertRaises(ValueError):
                    normalize(doc)
        with self.assertRaises(ValueError):
            normalize([])

    def test_nested_text_arrays_and_detail_metadata_reject_crashing_objects(self):
        mutations = [
            lambda d: d["assessment"].update(role={"toString": None}),
            lambda d: d.update(entry_status={"toString": None}),
            lambda d: d.update(contact_email=[]),
            lambda d: d.update(reward_conflict={}),
            lambda d: d.update(public_review={"fields_verified": [None]}),
            lambda d: d["evidence"][0].update(external_rules="https://example.com"),
            lambda d: d.update(relations=[{"type": "under_program", "target_id": "a" * 24, "note": {}}]),
            lambda d: d.update(source_attachments=[{"label": [], "url": d["official_url"]}]),
            lambda d: d.update(source_attachments=[{"label": "附件", "url": "javascript:alert(1)"}]),
        ]
        for index, mutate in enumerate(mutations):
            with self.subTest(index=index):
                doc = document()
                doc["assessment"] = {}
                mutate(doc)
                with self.assertRaises(ValueError):
                    normalize(doc)

    def test_fixed_offsets_validate_minutes_hours_and_explicit_timestamp_offsets(self):
        for value in ("+24:00", "-24:00", "+08:99", "+00:60", "+8:00", "UTC+08:00", 8, False):
            with self.subTest(value=value):
                doc = document()
                doc["time"]["timezone"] = value
                with self.assertRaises(ValueError):
                    normalize(doc)
        for value in ("2026-10-01T12:00:00+08:99", "2026-10-01T12:00:00+24:00"):
            doc = document()
            doc["time"]["deadline"] = value
            with self.assertRaises(ValueError):
                normalize(doc)
        for value, offset in (("+05:45", timedelta(hours=5, minutes=45)), ("-03:30", -timedelta(hours=3, minutes=30)), ("+23:59", timedelta(hours=23, minutes=59))):
            with self.subTest(valid=value):
                doc = document()
                doc["time"]["timezone"] = value
                normalize(doc)
                expected = datetime(2026, 10, 1, 12, tzinfo=UTC) - offset
                self.assertEqual(time_bounds("2026-10-01T12:00:00", value), (expected, expected))

    def test_unsupported_named_timezone_is_rejected_without_inventing_utc(self):
        doc = document()
        doc["time"]["timezone"] = "Audit/Missing"
        with patch("opportunities.model.ZoneInfo", side_effect=ZoneInfoNotFoundError("Audit/Missing")):
            with self.assertRaises(ValueError):
                normalize(doc)

    def test_dates_preserve_precision_and_reject_compact_or_impossible_formats(self):
        for value in ("20261001", "2026-W40-4", "2026-10-01T12", "2026-02-30", "0000-01-01", "2026-10", "2026-10-01T12:00:00.1234567"):
            with self.subTest(value=value):
                doc = document()
                doc["time"]["deadline"] = value
                with self.assertRaises(ValueError):
                    normalize(doc)
        for value in ("2028-02-29", "2026-10-01T12:30", "2026-10-01T12:30:40.123456+05:45"):
            doc = document()
            doc["time"]["deadline"] = value
            self.assertEqual(normalize(doc)["time"]["deadline"], value)

    def test_month_period_is_complete_ordered_and_representable(self):
        for value in ({}, {"start": "2026-10"}, {"start": "2026-12", "end": "2026-10"}, {"start": "2026-13", "end": "2027-01"}, {"start": "0000-01", "end": "2026-12"}, {"start": "9999-12", "end": "9999-12"}, {"start": "2026-10", "end": "2026-12", "extra": "day"}, None, []):
            with self.subTest(value=value):
                doc = document()
                doc["time"]["month_period"] = value
                with self.assertRaises(ValueError):
                    normalize(doc)

    def test_reward_fee_and_cash_tier_amounts_are_nonnegative_finite_numbers(self):
        for value in (-1, float("nan"), float("inf"), -float("inf"), True, "100", 10 ** 1000):
            for field in ("rewards", "fees", "cash_tiers"):
                with self.subTest(value_type=type(value).__name__, field=field):
                    doc = document()
                    doc[field] = [{"type": "cash", "amount": value}] if field != "cash_tiers" else [{"condition": "合格作品", "base": value, "canvas_bonus": 0}]
                    with self.assertRaises(ValueError):
                        normalize(doc)
        doc = document()
        doc["rewards"] = [{"type": "cash", "amount": 0}, {"type": "credits", "amount": None, "validity": "3个月"}]
        self.assertEqual(normalize(doc)["rewards"], doc["rewards"])
        with self.assertRaises(ValueError):
            json_text({"amount": float("nan")})

    def test_normalize_keeps_raw_source_identity_and_input_unchanged(self):
        doc = document("creator_program")
        doc["time"].update(start=None, deadline=None, mechanism="unspecified", month_period={"start": "2026-10", "end": "2026-12"}, deadline_raw="2026年第四季度，日时未说明")
        original = copy.deepcopy(doc)
        normalized = normalize(doc)
        temporal_status(normalized, datetime(2026, 11, 1, tzinfo=UTC))
        self.assertEqual(doc, original)
        self.assertEqual(normalized["id"], identity(original))
        self.assertEqual(normalized["time"]["month_period"], original["time"]["month_period"])
        self.assertIsNone(normalized["time"]["deadline"])
        self.assertIsNone(normalized["time"]["start"])

    def test_dated_24_hour_midnight_keeps_explicit_offsets_and_date_rollover(self):
        cases = {"2026-09-30 24:00": "2026-10-01T00:00:00", "2026-12-31T24:00:00Z": "2027-01-01T00:00:00Z", "2026-09-30T24:00+08:00": "2026-10-01T00:00:00+08:00"}
        for raw, expected in cases.items():
            self.assertEqual(official_datetime(raw), expected)
        self.assertEqual(time_bounds(official_datetime("2026-09-30T24:00+08:00"))[0], datetime(2026, 9, 30, 16, tzinfo=UTC))
        for raw in ("2026-09-30T24:01", "2026-09-30T24:00:01", "9999-12-31T24:00Z", "2026-09-30T24:00+08:99"):
            with self.assertRaises(ValueError):
                official_datetime(raw)


class TemporalCounterexampleTests(unittest.TestCase):
    def test_month_metadata_never_shadows_expired_policy_or_precise_deadline(self):
        doc = document("creator_program")
        doc["time"].update(mechanism="ongoing", start=None, deadline=None, month_period={"start": "2026-01", "end": "2026-12"}, policy_end="2026-09-01T00:00:00Z")
        item = decorate(normalize(doc), RULES, NOW)
        self.assertEqual(item["status"]["code"], "closed")
        self.assertEqual(item["priority"]["group"], 5)
        self.assertIsNone(item["deadline_urgency"])
        doc = document()
        doc["time"].update(deadline="2026-09-29T23:00:00Z", month_period={"start": "2026-01", "end": "2026-12"})
        self.assertEqual(temporal_status(normalize(doc), NOW)["code"], "closed")

    def test_month_metadata_never_shadows_future_start_or_refined_active_window(self):
        doc = document()
        doc["time"].update(start="2026-10-02T00:00:00Z", month_period={"start": "2026-01", "end": "2026-12"})
        self.assertEqual(temporal_status(normalize(doc), NOW)["code"], "upcoming")
        doc["time"]["start"] = "2026-09-01T00:00:00Z"
        self.assertEqual(temporal_status(normalize(doc), NOW)["code"], "open")
        doc = document("rule_update")
        doc["time"].update(start=None, deadline=None, policy_effective="2026-10-02T00:00:00Z", month_period={"start": "2026-01", "end": "2026-12"})
        self.assertEqual(temporal_status(normalize(doc), NOW)["code"], "upcoming")

    def test_incompatible_time_constraints_are_uncertain_and_policy_termination_wins(self):
        changes = [
            {"start": "2026-10-10T00:00:00Z", "deadline": "2026-10-05T00:00:00Z"},
            {"month_period": {"start": "2027-01", "end": "2027-02"}},
            {"absolute_deadline": "2026-11-10T23:59:00Z"},
            {"absolute_start": "2026-09-10T00:00:00Z"},
        ]
        for change in changes:
            with self.subTest(change=change):
                doc = document()
                doc["time"].update(change)
                item = decorate(normalize(doc), RULES, NOW)
                self.assertEqual(item["status"]["code"], "uncertain")
                self.assertEqual(item["priority"]["group"], 3)
                self.assertIsNone(item["deadline_urgency"])
        doc["time"]["policy_end"] = "2026-09-15T00:00:00Z"
        self.assertEqual(temporal_status(normalize(doc), NOW)["code"], "closed")

    def test_month_unknown_timezone_boundaries_are_envelopes_not_invented_days(self):
        doc = document("creator_program")
        doc["time"].update(start=None, deadline=None, mechanism="unspecified", timezone=None, month_period={"start": "2026-10", "end": "2026-12"})
        normalized = normalize(doc)
        cases = [(datetime(2026, 9, 30, 9, 59, tzinfo=UTC), "upcoming"), (datetime(2026, 9, 30, 10, tzinfo=UTC), "uncertain"), (datetime(2026, 10, 1, 12, tzinfo=UTC), "window"), (datetime(2026, 12, 31, 10, tzinfo=UTC), "uncertain"), (datetime(2027, 1, 1, 12, tzinfo=UTC), "uncertain")]
        for at, code in cases:
            self.assertEqual(temporal_status(normalized, at)["code"], code)
        self.assertTrue(temporal_status(normalized, cases[-1][0])["possible_expired"])
        self.assertIsNone(normalized["time"]["deadline"])

    def test_date_only_deadline_keeps_whole_day_and_unknown_timezone_envelope(self):
        low, high = time_bounds("2026-09-30", "UTC", end=True)
        expected = datetime(2026, 9, 30, 23, 59, 59, 999999, tzinfo=UTC)
        self.assertEqual((low, high), (expected, expected))
        doc = document()
        doc["time"].update(deadline="2026-09-30", timezone="UTC")
        self.assertEqual(temporal_status(normalize(doc), NOW)["code"], "window")
        self.assertEqual(temporal_status(normalize(doc), expected + timedelta(microseconds=1))["code"], "closed")
        doc["time"]["timezone"] = None
        self.assertEqual(temporal_status(normalize(doc), datetime(2026, 10, 1, 0, tzinfo=UTC))["code"], "uncertain")
        self.assertEqual(temporal_status(normalize(doc), datetime(2026, 10, 1, 12, tzinfo=UTC))["code"], "closed")

    def test_unconfirmed_cycle_end_preserves_date_precision_without_archiving(self):
        doc = document()
        doc["time"].update(confirmed=False, source_window={"end": "2026-09-30"})
        self.assertEqual(temporal_status(normalize(doc), NOW)["code"], "unknown")
        later = temporal_status(normalize(doc), datetime(2026, 10, 1, 12, tzinfo=UTC))
        self.assertEqual(later["code"], "uncertain")
        self.assertTrue(later["possible_expired"])
        self.assertNotEqual(later["code"], "closed")

    def test_tentative_absolute_deadline_is_hint_never_verified_expiry(self):
        doc = document()
        doc["time"].update(deadline=None, absolute_deadline="2026-09-29T00:00:00Z", deadline_tentative=True)
        item = decorate(normalize(doc), RULES, NOW)
        self.assertEqual(item["status"]["code"], "uncertain")
        self.assertTrue(item["status"]["possible_expired"])
        self.assertEqual(item["priority"]["group"], 3)
        self.assertIsNone(item["priority"]["deadline_order"])
        self.assertIsNone(item["deadline_urgency"])

    def test_future_verification_and_live_fetch_do_not_claim_reviewed_countdown(self):
        for fields in ({"verified_at": "2026-10-01T00:00:00Z"}, {"origin": "live_fetch"}, {"verified_at": "2020-01-01T00:00:00Z"}):
            with self.subTest(fields=fields):
                doc = document()
                doc.update(fields)
                doc["time"]["deadline"] = "2026-10-02T00:00:00Z"
                item = decorate(normalize(doc), RULES, NOW)
                self.assertEqual(item["priority"]["group"], 3)
                self.assertFalse(item["priority"]["public_time_reviewed"])
                self.assertIn("待复核", item["deadline_urgency"])
        self.assertTrue(decorate(normalize(doc), RULES, NOW)["stale"])

    def test_policy_closed_urgency_and_personal_unknown_are_independent(self):
        doc = document("creator_program")
        doc["time"].update(deadline="2026-10-02T00:00:00Z", policy_end="2026-09-29T00:00:00Z")
        self.assertIsNone(decorate(normalize(doc), RULES, NOW)["deadline_urgency"])
        doc = document("creator_program")
        doc["time"].update(start=None, deadline=None, mechanism="ongoing")
        doc["assessment"] = {"role": "candidate", "personal_eligibility": "not_checked", "ai_policy": "unspecified"}
        item = decorate(normalize(doc), RULES, NOW.replace(tzinfo=None))
        self.assertEqual(item["status"]["code"], "open")
        self.assertEqual(item["priority"]["group"], 0)
        child = document("limited_benefit")
        child["time"].update(start="2026-01-01T00:00:00Z", deadline="2026-03-31T23:59:00Z")
        self.assertEqual(decorate(normalize(child), RULES, NOW)["priority"]["group"], 5)
        self.assertIsNone(doc["time"]["deadline"])


class DaylightSavingCounterexampleTests(unittest.TestCase):
    def setUp(self):
        # Two 2026 transitions in a small TZif fixture; no installed tzdata required.
        transitions = [int(datetime(2026, 3, 8, 7, tzinfo=UTC).timestamp()), int(datetime(2026, 11, 1, 6, tzinfo=UTC).timestamp())]
        tzif = b"TZif\0" + b"\0" * 15 + struct.pack(">6l", 0, 0, 0, 2, 2, 8)
        tzif += struct.pack(">2l", *transitions) + bytes((1, 0))
        tzif += struct.pack(">lBB", -18000, 0, 0) + struct.pack(">lBB", -14400, 1, 4) + b"EST\0EDT\0"
        self.zone_name = "Audit/EST-EDT-2026"
        self.zone = ZoneInfo.from_file(io.BytesIO(tzif), key=self.zone_name)
        resolver = lambda name: self.zone if name == self.zone_name else ZoneInfo(name)
        self.resolver = patch("opportunities.model.ZoneInfo", side_effect=resolver)
        self.resolver.start()
        self.addCleanup(self.resolver.stop)

    def test_ambiguous_deadline_keeps_both_folds_until_later_boundary(self):
        doc = document()
        doc["time"].update(start="2026-10-01T00:00:00", deadline="2026-11-01T01:30:00", timezone=self.zone_name)
        normalized = normalize(doc)
        self.assertEqual(time_bounds(doc["time"]["deadline"], self.zone_name), (datetime(2026, 11, 1, 5, 30, tzinfo=UTC), datetime(2026, 11, 1, 6, 30, tzinfo=UTC)))
        self.assertEqual(temporal_status(normalized, datetime(2026, 11, 1, 6, tzinfo=UTC))["code"], "uncertain")
        self.assertEqual(temporal_status(normalized, datetime(2026, 11, 1, 6, 31, tzinfo=UTC))["code"], "closed")

    def test_ambiguous_start_does_not_open_at_first_possible_fold(self):
        doc = document()
        doc["time"].update(start="2026-11-01T01:30:00", deadline="2026-12-01T00:00:00", timezone=self.zone_name)
        normalized = normalize(doc)
        self.assertEqual(temporal_status(normalized, datetime(2026, 11, 1, 6, tzinfo=UTC))["code"], "uncertain")
        self.assertEqual(temporal_status(normalized, datetime(2026, 11, 1, 6, 30, tzinfo=UTC))["code"], "open")

    def test_nonexistent_wall_clock_is_rejected_but_explicit_offset_is_exact(self):
        doc = document()
        doc["time"].update(start="2026-03-08T02:30:00", timezone=self.zone_name)
        with self.assertRaises(ValueError):
            normalize(doc)
        exact = "2026-11-01T01:30:00-05:00"
        self.assertEqual(time_bounds(exact, self.zone_name), (datetime(2026, 11, 1, 6, 30, tzinfo=UTC),) * 2)
        doc["time"]["start"] = "2026-03-08T02:30:00-05:00"
        self.assertEqual(normalize(doc)["time"]["start"], doc["time"]["start"])


class HashedBackupShapeTests(unittest.TestCase):
    def test_valid_hashes_cannot_authorize_malformed_document_restore(self):
        temp = ScopedTemp(ROOT / "output", "test-model-backup-")
        self.addCleanup(temp.cleanup)
        root = Path(temp.name)
        (root / "config").mkdir()
        for name in ("sources.json", "rules.json"):
            (root / "config" / name).write_bytes((ROOT / "config" / name).read_bytes())
        store = Store(root, seed=False)
        self.assertNotEqual(store.root, ROOT)
        store.upsert(document())
        item_id = identity(document())
        store.preference(item_id, starred=True, note="隔离库中的笔记保持不变")
        manager = BackupManager(store)
        before = store.details(item_id)
        mutations = [
            lambda d: d["time"].update(confirmed="false"),
            lambda d: d["time"].update(timezone="+24:00"),
            lambda d: d["time"].update(month_period={"start": "2026-10"}),
            lambda d: d["time"].update(source_window=[]),
            lambda d: d.update(assessment=[]),
            lambda d: d.update(source_attachments=[None]),
        ]
        for index, mutate in enumerate(mutations):
            with self.subTest(index=index):
                backup_id = manager.create()["id"]
                archive_path = manager.path(backup_id)
                with zipfile.ZipFile(archive_path) as archive:
                    payload = {name: archive.read(name) for name in archive.namelist()}
                database = root / "altered-snapshot.sqlite3"
                database.write_bytes(payload["database.sqlite3"])
                with closing(sqlite3.connect(database)) as conn:
                    with conn:
                        conn.execute("PRAGMA journal_mode=DELETE")
                        row = conn.execute("SELECT document FROM opportunities WHERE id=?", (item_id,)).fetchone()
                        doc = json.loads(row[0])
                        mutate(doc)
                        serialized = json_text(doc)
                        conn.execute("UPDATE opportunities SET document=? WHERE id=?", (serialized, item_id))
                        conn.execute("UPDATE versions SET snapshot=? WHERE opportunity_id=?", (serialized, item_id))
                payload["database.sqlite3"] = database.read_bytes()
                manifest = json.loads(payload["manifest.json"])
                manifest["files"]["database.sqlite3"] = {"sha256": hashlib.sha256(payload["database.sqlite3"]).hexdigest(), "size": len(payload["database.sqlite3"])}
                payload["manifest.json"] = json_text(manifest).encode("utf-8")
                with zipfile.ZipFile(archive_path, "w", compression=zipfile.ZIP_STORED) as archive:
                    for name, value in payload.items():
                        archive.writestr(name, value)
                with self.assertRaises(BackupError):
                    manager.preview(backup_id)
                self.assertEqual(store.details(item_id), before)


if __name__ == "__main__":
    unittest.main()
