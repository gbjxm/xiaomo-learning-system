import binascii
import copy
import hashlib
import json
import os
import struct
import unittest
import zlib
from pathlib import Path
from unittest.mock import patch

from helpers import ScopedTemp
from opportunities.visuals import MAX_ASSET_BYTES, serve_visual, visual_metadata


ROOT = Path(__file__).resolve().parents[1]
ITEM_ID = "a" * 24
SECOND_ID = "b" * 24


def png(width=4, height=3, *, animated=False):
    def chunk(kind, payload):
        return (struct.pack(">I", len(payload)) + kind + payload +
                struct.pack(">I", binascii.crc32(kind + payload) & 0xFFFFFFFF))
    result = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
    if animated:
        result += chunk(b"acTL", struct.pack(">II", 2, 0))
    # Real, small RGBA pixels with valid zlib data and CRCs; no decoder dependency.
    payload = (b"\x00" + b"\x40\x70\xc0\xff" * width) * height
    return result + chunk(b"IDAT", zlib.compress(payload)) + chunk(b"IEND", b"")


def jpeg(width=4, height=3):
    # Minimal structural fixture for the image header parser. Actual cached
    # assets separately require manual viewing; this is not a visual claim.
    sof = struct.pack(">BHHB", 8, height, width, 1) + b"\x01\x11\x00"
    sos = b"\x01\x01\x00\x00\x3f\x00"
    return (b"\xff\xd8\xff\xc0" + struct.pack(">H", len(sof) + 2) + sof +
            b"\xff\xda" + struct.pack(">H", len(sos) + 2) + sos + b"\x00\xff\xd9")


def webp(width=4, height=3, *, extended=False, lossy=False, animated=False):
    def chunk(kind, payload):
        return kind + struct.pack("<I", len(payload)) + payload + (b"\0" if len(payload) & 1 else b"")
    payload = b""
    if extended or animated:
        payload += chunk(b"VP8X", bytes([2 if animated else 0, 0, 0, 0]) +
                         (width - 1).to_bytes(3, "little") + (height - 1).to_bytes(3, "little"))
    if animated:
        payload += chunk(b"ANMF", b"\0" * 16)
    elif lossy:
        payload += chunk(b"VP8 ", b"\0\0\0\x9d\x01\x2a" + struct.pack("<HH", width, height))
    else:
        bits = (width - 1) | ((height - 1) << 14)
        payload += chunk(b"VP8L", b"\x2f" + struct.pack("<I", bits))
    return b"RIFF" + struct.pack("<I", len(payload) + 4) + b"WEBP" + payload


class VisualTests(unittest.TestCase):
    def setUp(self):
        self.temp = ScopedTemp(ROOT / "output", "test-visuals-")
        self.root = Path(self.temp.name)
        (self.root / "config").mkdir()
        (self.root / "static" / "media").mkdir(parents=True)
        self.catalog_path = self.root / "config" / "visual_assets.json"
        self.catalog = {"schema_version": 1, "assets": {}, "items": {}}
        self.asset_path = self.add_asset()

    def tearDown(self):
        self.temp.cleanup()

    def add_asset(self, asset_id="event-2026", *, data=None, extension="png", width=4, height=3):
        data = png(width, height) if data is None else data
        digest = hashlib.sha256(data).hexdigest()
        filename = digest + "." + extension
        record = {
            "filename": filename, "width": width, "height": height, "sha256": digest,
            "kind": "event_poster", "source_page": "https://official.example.org/activity/2026",
            "image_url": "https://static.example.org/2026/poster.png", "applicable_edition": "2026",
            "asset_label": "2026官方活动海报", "rights_note": "官方公开素材，本机识别使用；未授予额外商用权。",
            "observed_at": "2026-09-30T10:00:00Z", "pixel_review_note": "人工已查看像素，名称与2026届次一致。",
            "pixel_reviewed": True,
        }
        self.catalog["assets"][asset_id] = record
        self.catalog["items"][ITEM_ID] = {"asset_id": asset_id, "label": "官方活动海报", "edition": "2026"}
        path = self.root / "static" / "media" / filename
        path.write_bytes(data)
        self.save_catalog()
        return path

    def save_catalog(self):
        # Escaped JSON can carry intentionally malformed surrogate strings.
        self.catalog_path.write_text(json.dumps(self.catalog, ensure_ascii=True), encoding="utf-8")

    def invalidate(self, field, value):
        self.catalog["assets"]["event-2026"][field] = value
        self.save_catalog()
        self.assertIsNone(serve_visual(self.root, "event-2026"))
        self.assertNotIn(ITEM_ID, visual_metadata(self.root)["items"])

    def test_valid_static_png_metadata_and_bytes(self):
        metadata = visual_metadata(self.root)
        self.assertEqual(metadata["schema_version"], 1)
        self.assertEqual(metadata["warnings"], [])
        item = metadata["items"][ITEM_ID]
        self.assertEqual(item["asset_id"], "event-2026")
        self.assertEqual(item["media_url"], "/media/event-2026")
        self.assertEqual((item["width"], item["height"]), (4, 3))
        self.assertEqual(item["edition"], "2026")
        self.assertEqual(item["kind"], "event_poster")
        self.assertNotIn("filename", item)
        self.assertNotIn(str(self.root), json.dumps(metadata, ensure_ascii=False))
        self.assertEqual(serve_visual(self.root, "event-2026"), (self.asset_path.read_bytes(), "image/png"))

    def test_item_selection_and_shared_platform_mark(self):
        self.catalog["assets"]["event-2026"]["kind"] = "platform_mark"
        self.catalog["items"][SECOND_ID] = {"asset_id": "event-2026", "label": "平台标识，非赛事专属", "edition": "2025"}
        self.save_catalog()
        selected = visual_metadata(self.root, [SECOND_ID])
        self.assertEqual(set(selected["items"]), {SECOND_ID})
        self.assertEqual(selected["items"][SECOND_ID]["kind"], "platform_mark")
        self.assertEqual(set(visual_metadata(self.root, ITEM_ID)["items"]), {ITEM_ID})
        self.assertEqual(visual_metadata(self.root, [])['items'], {})
        self.assertEqual(visual_metadata(self.root, [[ITEM_ID]])["warnings"][0]["code"], "invalid_item_selection")

    def test_missing_catalog_and_image_use_empty_fallback(self):
        self.catalog_path.unlink()
        self.assertEqual(visual_metadata(self.root), {"schema_version": 1, "assets": {}, "items": {}, "warnings": []})
        self.assertIsNone(serve_visual(self.root, "event-2026"))
        self.save_catalog()
        self.asset_path.unlink()
        self.assertEqual(visual_metadata(self.root)["items"], {})
        self.assertIsNone(serve_visual(self.root, "event-2026"))

    def test_bad_catalog_fails_closed_without_exception(self):
        for raw in (b"not json", b"{", b"[]", b'{"schema_version":true,"assets":{},"items":{}}',
                    b'{"schema_version":2,"assets":{},"items":{}}', b'{"schema_version":1,"assets":[],"items":{}}',
                    b'{"schema_version":1,"assets":{},"assets":{},"items":{}}',
                    b'{"schema_version":1,"assets":{"a":NaN},"items":{}}', b"\xff"):
            with self.subTest(raw=raw):
                self.catalog_path.write_bytes(raw)
                self.assertEqual(visual_metadata(self.root)["items"], {})
                self.assertIsNone(serve_visual(self.root, "event-2026"))

    def test_review_flag_is_boolean_and_required(self):
        for value in (False, "true", 1, None):
            with self.subTest(value=value):
                self.invalidate("pixel_reviewed", value)

    def test_asset_kinds_are_explicit_and_limited(self):
        for kind in ("event_poster", "platform_mark", "organizer_mark"):
            self.catalog["assets"]["event-2026"]["kind"] = kind
            self.save_catalog()
            self.assertEqual(visual_metadata(self.root)["items"][ITEM_ID]["kind"], kind)
        for value in ("official_logo", "html", [], None):
            with self.subTest(value=value):
                self.invalidate("kind", value)

    def test_asset_id_and_filename_are_never_paths(self):
        for value in ("../config/sources.json", "%2e%2e", "event/2026", "event\\2026", "", "中文", "x" * 81, ".poster", None):
            with self.subTest(value=value):
                self.assertIsNone(serve_visual(self.root, value))
        for value in ("../outside.png", "..\\outside.png", "/etc/passwd", "C:\\outside.png", "file.png",
                      "a" * 64 + ".svg", "a" * 64 + ".html", "a" * 64 + ".PNG", "a" * 64 + ".png:stream"):
            with self.subTest(value=value):
                self.invalidate("filename", value)

    def test_unsafe_source_urls_are_rejected(self):
        unsafe = ("http://example.org/x", "javascript:alert(1)", "data:image/png;base64,AA==", "file:///tmp/x",
                  "https://user:pass@example.org/x", "https://example.org:8443/x", "https://example.org:bad/x",
                  "https://localhost/x", "https://localhost.localdomain/x", "https://foo.local/x", "https://foo.internal/x",
                  "https://127.0.0.1/x", "https://127.1/x", "https://2130706433/x", "https://0x7f000001/x",
                  "https://0177.0.0.1/x", "https://[::1]/x", "https://[fc00::1]/x", "https://10.0.0.1/x",
                  "https://169.254.169.254/x", "https://192.168.0.1/x", "https://example.org/\nattack",
                  "https://example.org\\@127.0.0.1/x", "https://example.org/a b", "https://example.org/\ud800")
        for field in ("source_page", "image_url"):
            initial = self.catalog["assets"]["event-2026"][field]
            for value in unsafe:
                with self.subTest(field=field, value=value):
                    self.invalidate(field, value)
            self.catalog["assets"]["event-2026"][field] = initial

    def test_https_standard_port_and_public_host_allowed(self):
        self.catalog["assets"]["event-2026"]["source_page"] = "https://official.example.org:443/rules#section"
        self.catalog["assets"]["event-2026"]["image_url"] = "https://8.8.8.8/a.png"
        self.save_catalog()
        self.assertIn(ITEM_ID, visual_metadata(self.root)["items"])

    def test_tampered_hash_or_dimensions_are_not_advertised(self):
        original = copy.deepcopy(self.catalog)
        for field, value in (("sha256", "0" * 64), ("width", 5), ("height", 0), ("width", True), ("height", "3")):
            with self.subTest(field=field, value=value):
                self.catalog = copy.deepcopy(original)
                self.invalidate(field, value)
        self.catalog = original
        self.save_catalog()
        self.asset_path.write_bytes(self.asset_path.read_bytes() + b"tampered")
        self.assertIsNone(serve_visual(self.root, "event-2026"))
        self.assertEqual(visual_metadata(self.root)["items"], {})

    def test_hash_matching_html_or_svg_cannot_be_served(self):
        for payload in (b"<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>",
                        b"<!doctype html><html><script>alert(1)</script></html>"):
            with self.subTest(payload=payload):
                self.add_asset(data=payload)
                self.assertIsNone(serve_visual(self.root, "event-2026"))
                self.assertEqual(visual_metadata(self.root)["items"], {})

    def test_file_too_large_falls_back(self):
        self.add_asset(data=b"x" * (MAX_ASSET_BYTES + 1))
        self.assertIsNone(serve_visual(self.root, "event-2026"))
        self.assertEqual(visual_metadata(self.root)["items"], {})

    def test_invalid_item_does_not_hide_other_valid_assets(self):
        self.catalog["items"]["../attack"] = {"asset_id": "event-2026", "label": "伪映射", "edition": "2026"}
        self.catalog["items"][SECOND_ID] = {"asset_id": "event-2026", "label": "", "edition": "2026"}
        self.catalog["assets"]["broken"] = {"filename": "../attack"}
        self.save_catalog()
        metadata = visual_metadata(self.root)
        self.assertEqual(set(metadata["items"]), {ITEM_ID})
        self.assertEqual(set(metadata["assets"]), {"event-2026"})
        self.assertTrue(metadata["warnings"])

    def test_surrogate_and_control_metadata_fall_back(self):
        original = copy.deepcopy(self.catalog)
        for field, value in (("asset_label", "\ud800"), ("rights_note", "<img onerror=alert(1)>\n"),
                             ("pixel_review_note", ""), ("observed_at", "not-a-date"), ("applicable_edition", None)):
            with self.subTest(field=field):
                self.catalog = copy.deepcopy(original)
                self.invalidate(field, value)

    def test_metadata_is_plain_text_not_executable_markup(self):
        # The caller must escape metadata when rendering. It is not interpreted
        # as HTML here; filenames and media routes remain separately validated.
        self.catalog["assets"]["event-2026"]["asset_label"] = "<img src=x onerror=alert(1)>"
        self.save_catalog()
        self.assertEqual(visual_metadata(self.root)["items"][ITEM_ID]["asset_label"], "<img src=x onerror=alert(1)>")

    def test_only_fixed_background_token_is_exposed(self):
        self.catalog["assets"]["event-2026"]["image_background"] = "#14212f"
        self.save_catalog()
        self.assertEqual(visual_metadata(self.root)["items"][ITEM_ID]["background"], "dark")
        for value in ("red", "url(https://localhost/)", "#14212f;position:fixed", None, {}):
            self.catalog["assets"]["event-2026"]["image_background"] = value
            self.save_catalog()
            self.assertNotIn("background", visual_metadata(self.root)["items"][ITEM_ID])

    def test_opened_handle_cannot_point_outside_media(self):
        external = self.root / "outside.png"
        external.write_bytes(self.asset_path.read_bytes())
        actual = __import__("opportunities.visuals", fromlist=["_windows_handle_path"])._windows_handle_path
        def opened_path(fd):
            value = actual(fd)
            return external if value == self.asset_path else value
        with patch("opportunities.visuals._windows_handle_path", side_effect=opened_path):
            self.assertIsNone(serve_visual(self.root, "event-2026"))

    def test_broken_catalog_entry_container_does_not_crash_page(self):
        for value in ([], 1, None, "text"):
            self.catalog["assets"]["event-2026"] = value
            self.save_catalog()
            self.assertEqual(visual_metadata(self.root)["items"], {})
            self.assertIsNone(serve_visual(self.root, "event-2026"))

    def test_jpeg_and_webp_have_verified_mime_and_dimensions(self):
        for extension, payload, mime in (("jpg", jpeg(), "image/jpeg"), ("jpeg", jpeg(), "image/jpeg"),
                                         ("webp", webp(), "image/webp"), ("webp", webp(extended=True), "image/webp"),
                                         ("webp", webp(lossy=True), "image/webp")):
            with self.subTest(extension=extension, payload=payload[:24]):
                self.add_asset(data=payload, extension=extension)
                self.assertEqual(serve_visual(self.root, "event-2026"), (payload, mime))
                self.assertIn(ITEM_ID, visual_metadata(self.root)["items"])

    def test_extension_magic_mismatch_truncation_and_polyglot_rejected(self):
        invalid = ((png(), "jpg"), (jpeg(), "webp"), (webp(), "png"),
                   (png()[:-1], "png"), (jpeg()[:-1], "jpg"), (webp()[:-1], "webp"),
                   (png() + b"<html>attack</html>", "png"), (webp() + b"<html>attack</html>", "webp"),
                   (b"\xff\xd8garbage\xff\xd9", "jpg"))
        for payload, extension in invalid:
            with self.subTest(extension=extension, payload=payload[:16]):
                self.add_asset(data=payload, extension=extension)
                self.assertIsNone(serve_visual(self.root, "event-2026"))

    def test_animated_images_require_static_reviewed_copy(self):
        for payload, extension in ((png(animated=True), "png"), (webp(animated=True), "webp")):
            with self.subTest(extension=extension):
                self.add_asset(data=payload, extension=extension)
                self.assertIsNone(serve_visual(self.root, "event-2026"))
                self.assertEqual(visual_metadata(self.root)["items"], {})

    def test_symlink_or_reparse_file_is_rejected(self):
        # This test does not create symlinks (which require an extra Windows
        # privilege). The production guard receives the exact lstat type.
        fake = type("LinkedStat", (), {"st_mode": 0, "st_file_attributes": 0x400})()
        with patch("opportunities.visuals.Path.lstat", return_value=fake):
            self.assertIsNone(serve_visual(self.root, "event-2026"))
            self.assertEqual(visual_metadata(self.root)["items"], {})

    def test_hardlinked_file_is_rejected(self):
        info = self.asset_path.stat()
        fake = type("LinkedStat", (), {"st_mode": info.st_mode, "st_nlink": 2, "st_size": info.st_size,
                                       "st_file_attributes": 0})()
        real_lstat = Path.lstat
        def check(path):
            return fake if path == self.asset_path else real_lstat(path)
        with patch("opportunities.visuals.Path.lstat", check):
            self.assertIsNone(serve_visual(self.root, "event-2026"))

    def test_metadata_and_serve_have_no_network_or_writes(self):
        before = {str(path.relative_to(self.root)): path.read_bytes() for path in self.root.rglob("*") if path.is_file()}
        with patch("urllib.request.urlopen", side_effect=AssertionError("network forbidden")):
            self.assertIn(ITEM_ID, visual_metadata(self.root)["items"])
            self.assertIsNotNone(serve_visual(self.root, "event-2026"))
        after = {str(path.relative_to(self.root)): path.read_bytes() for path in self.root.rglob("*") if path.is_file()}
        self.assertEqual(before, after)


if __name__ == "__main__":
    unittest.main()
