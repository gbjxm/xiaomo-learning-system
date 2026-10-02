"""Read-only, fail-closed local visual assets.

The catalog is a UI asset manifest, not evidence about an opportunity's rules.
Only manually pixel-reviewed raster files may be served. No remote fetch, cache
creation, database mutation, or user-supplied filesystem path happens here.
"""
from __future__ import annotations

import binascii
import datetime as dt
import hashlib
import ipaddress
import json
import os
import re
import stat
import struct
from pathlib import Path
from urllib.parse import urlsplit


CATALOG_VERSION = 1
MAX_ASSET_BYTES = 6 * 1024 * 1024
MAX_CATALOG_BYTES = 2 * 1024 * 1024
MAX_DIMENSION = 16384
MAX_PIXELS = 40_000_000
ASSET_ID = re.compile(r"[A-Za-z0-9][A-Za-z0-9_-]{0,79}\Z", re.ASCII)
ITEM_ID = re.compile(r"[a-f0-9]{24}\Z", re.ASCII)
FILENAME = re.compile(r"([a-f0-9]{64})\.(png|jpe?g|webp)\Z", re.ASCII)
KINDS = {"event_poster", "platform_mark", "organizer_mark"}
MIME_TYPES = {"png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg", "webp": "image/webp"}
TEXT_FIELDS = {
    "applicable_edition": 200,
    "asset_label": 200,
    "rights_note": 2000,
    "observed_at": 100,
    "pixel_review_note": 2000,
}


class _InvalidVisual(ValueError):
    pass


def _text(value, maximum=200, *, allow_empty=False):
    if not isinstance(value, str) or len(value) > maximum or (not allow_empty and not value.strip()):
        raise _InvalidVisual("invalid_text")
    if any(ord(c) < 32 or 0xD800 <= ord(c) <= 0xDFFF for c in value):
        raise _InvalidVisual("invalid_text")
    return value.strip()


def _official_url(value):
    value = _text(value, 4000)
    if any(c.isspace() for c in value) or "\\" in value:
        raise _InvalidVisual("invalid_source_url")
    try:
        parsed = urlsplit(value)
        host = parsed.hostname
        port = parsed.port
    except ValueError as exc:
        raise _InvalidVisual("invalid_source_url") from exc
    if (parsed.scheme != "https" or not host or parsed.username is not None or
            parsed.password is not None or port not in (None, 443)):
        raise _InvalidVisual("invalid_source_url")
    host = host.lower().rstrip(".")
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        if (len(host) > 253 or "." not in host or host.endswith((".localhost", ".local", ".lan", ".internal", ".home")) or
                host in {"localhost", "localhost.localdomain"}):
            raise _InvalidVisual("invalid_source_url")
        labels = host.split(".")
        if any(not re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?", label, re.ASCII) for label in labels):
            raise _InvalidVisual("invalid_source_url")
        # Browsers accept several shortened, decimal, octal and hexadecimal IP
        # spellings. A domain ending in a numeric label is not a safe source URL.
        if re.fullmatch(r"(?:0x[0-9a-f]+|[0-9]+)", labels[-1], re.ASCII):
            raise _InvalidVisual("invalid_source_url")
    else:
        if not address.is_global:
            raise _InvalidVisual("invalid_source_url")
    return value


def _no_links(path):
    info = path.lstat()
    if stat.S_ISLNK(info.st_mode) or getattr(info, "st_file_attributes", 0) & 0x400:
        raise _InvalidVisual("linked_path")
    return info


def _windows_handle_path(fd):
    if os.name != "nt":
        return None
    # Validate the opened handle, not only a pathname checked before opening.
    # This also closes a junction/symlink replacement race on the target system.
    import ctypes
    import msvcrt
    function = ctypes.WinDLL("kernel32", use_last_error=True).GetFinalPathNameByHandleW
    function.argtypes = [ctypes.c_void_p, ctypes.c_wchar_p, ctypes.c_uint32, ctypes.c_uint32]
    function.restype = ctypes.c_uint32
    buffer = ctypes.create_unicode_buffer(32768)
    count = function(msvcrt.get_osfhandle(fd), buffer, len(buffer), 0)
    if count == 0 or count >= len(buffer):
        raise _InvalidVisual("unresolved_file_handle")
    result = buffer.value
    if result.startswith("\\\\?\\UNC\\"):
        result = "\\\\" + result[8:]
    elif result.startswith("\\\\?\\"):
        result = result[4:]
    return Path(result)


def _read_local(root, relative, maximum):
    base = Path(root).resolve(strict=True)
    path = base.joinpath(*relative)
    current = base
    for part in relative:
        current /= part
        _no_links(current)
    before = _no_links(path)
    if not stat.S_ISREG(before.st_mode) or before.st_nlink != 1 or before.st_size > maximum:
        raise _InvalidVisual("invalid_file")
    if path.resolve(strict=True) != path or not path.is_relative_to(base):
        raise _InvalidVisual("outside_asset_root")
    flags = os.O_RDONLY | getattr(os, "O_BINARY", 0) | getattr(os, "O_NOFOLLOW", 0)
    fd = os.open(path, flags)
    with os.fdopen(fd, "rb") as source:
        opened = os.fstat(source.fileno())
        if (opened.st_dev, opened.st_ino) != (before.st_dev, before.st_ino):
            raise _InvalidVisual("file_replaced")
        opened_path = _windows_handle_path(source.fileno())
        if opened_path is not None and opened_path != path:
            raise _InvalidVisual("outside_asset_root")
        data = source.read(maximum + 1)
        after = os.fstat(source.fileno())
        if (len(data) > maximum or (opened.st_size, opened.st_mtime_ns) != (after.st_size, after.st_mtime_ns)):
            raise _InvalidVisual("file_changed")
    for part_count in range(1, len(relative) + 1):
        _no_links(base.joinpath(*relative[:part_count]))
    final = path.stat()
    if (final.st_dev, final.st_ino) != (opened.st_dev, opened.st_ino):
        raise _InvalidVisual("file_replaced")
    return data


def _png_dimensions(data):
    if not data.startswith(b"\x89PNG\r\n\x1a\n"):
        raise _InvalidVisual("invalid_png")
    offset, dimensions, saw_data, ended = 8, None, False, False
    while offset + 12 <= len(data):
        length = int.from_bytes(data[offset:offset + 4], "big")
        kind = data[offset + 4:offset + 8]
        end = offset + 12 + length
        if end > len(data):
            raise _InvalidVisual("invalid_png")
        payload = data[offset + 8:offset + 8 + length]
        expected_crc = int.from_bytes(data[offset + 8 + length:end], "big")
        if binascii.crc32(kind + payload) & 0xFFFFFFFF != expected_crc:
            raise _InvalidVisual("invalid_png")
        if offset == 8 and kind != b"IHDR":
            raise _InvalidVisual("invalid_png")
        if kind == b"IHDR":
            if dimensions is not None or length != 13:
                raise _InvalidVisual("invalid_png")
            width, height, depth, color, compression, filtering, interlace = struct.unpack(">IIBBBBB", payload)
            depths = {0: {1, 2, 4, 8, 16}, 2: {8, 16}, 3: {1, 2, 4, 8}, 4: {8, 16}, 6: {8, 16}}
            if depth not in depths.get(color, set()) or compression or filtering or interlace not in (0, 1):
                raise _InvalidVisual("invalid_png")
            dimensions = (width, height)
        elif kind == b"IDAT":
            saw_data = True
        elif kind == b"acTL":
            raise _InvalidVisual("animated_image_requires_static_copy")
        elif kind == b"IEND":
            if length != 0 or end != len(data):
                raise _InvalidVisual("invalid_png")
            ended = True
            break
        offset = end
    if dimensions is None or not saw_data or not ended:
        raise _InvalidVisual("invalid_png")
    return dimensions


def _jpeg_dimensions(data):
    if not data.startswith(b"\xff\xd8") or not data.endswith(b"\xff\xd9"):
        raise _InvalidVisual("invalid_jpeg")
    offset = 2
    dimensions = None
    sof = {0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF}
    while offset < len(data):
        if data[offset] != 0xFF:
            raise _InvalidVisual("invalid_jpeg")
        while offset < len(data) and data[offset] == 0xFF:
            offset += 1
        if offset >= len(data):
            break
        marker = data[offset]
        offset += 1
        if marker in {0xD8, 0xD9, 0x00}:
            raise _InvalidVisual("invalid_jpeg")
        if marker == 0x01 or 0xD0 <= marker <= 0xD7:
            continue
        if offset + 2 > len(data):
            raise _InvalidVisual("invalid_jpeg")
        length = int.from_bytes(data[offset:offset + 2], "big")
        end = offset + length
        if length < 2 or end > len(data):
            raise _InvalidVisual("invalid_jpeg")
        if marker in sof:
            if dimensions is not None or length < 8:
                raise _InvalidVisual("invalid_jpeg")
            height = int.from_bytes(data[offset + 3:offset + 5], "big")
            width = int.from_bytes(data[offset + 5:offset + 7], "big")
            dimensions = (width, height)
        if marker == 0xDA:
            if dimensions is None or length < 6:
                raise _InvalidVisual("invalid_jpeg")
            return dimensions
        offset = end
    raise _InvalidVisual("invalid_jpeg")


def _webp_dimensions(data):
    if (len(data) < 20 or data[:4] != b"RIFF" or data[8:12] != b"WEBP" or
            int.from_bytes(data[4:8], "little") + 8 != len(data)):
        raise _InvalidVisual("invalid_webp")
    offset = 12
    dimensions = None
    has_frame = False
    while offset + 8 <= len(data):
        kind = data[offset:offset + 4]
        length = int.from_bytes(data[offset + 4:offset + 8], "little")
        end = offset + 8 + length
        if end > len(data):
            raise _InvalidVisual("invalid_webp")
        payload = data[offset + 8:end]
        if kind == b"VP8X":
            if dimensions is not None or length != 10 or offset != 12 or payload[0] & 0x02:
                raise _InvalidVisual("invalid_webp")
            dimensions = (1 + int.from_bytes(payload[4:7], "little"), 1 + int.from_bytes(payload[7:10], "little"))
        elif kind == b"VP8L":
            if len(payload) < 5 or payload[0] != 0x2F:
                raise _InvalidVisual("invalid_webp")
            bits = int.from_bytes(payload[1:5], "little")
            if bits >> 29:
                raise _InvalidVisual("invalid_webp")
            dimensions = dimensions or ((bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1)
            has_frame = True
        elif kind == b"VP8 ":
            if len(payload) < 10 or payload[0] & 1 or payload[3:6] != b"\x9d\x01\x2a":
                raise _InvalidVisual("invalid_webp")
            dimensions = dimensions or (int.from_bytes(payload[6:8], "little") & 0x3FFF,
                                        int.from_bytes(payload[8:10], "little") & 0x3FFF)
            has_frame = True
        elif kind == b"ANMF":
            raise _InvalidVisual("animated_image_requires_static_copy")
        offset = end + (length & 1)
    if dimensions is None or not has_frame or offset != len(data):
        raise _InvalidVisual("invalid_webp")
    return dimensions


def _dimensions(data, extension):
    dimensions = (_png_dimensions(data) if extension == "png" else
                  _jpeg_dimensions(data) if extension in ("jpg", "jpeg") else _webp_dimensions(data))
    width, height = dimensions
    if not 1 <= width <= MAX_DIMENSION or not 1 <= height <= MAX_DIMENSION or width * height > MAX_PIXELS:
        raise _InvalidVisual("invalid_dimensions")
    return dimensions


def _unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise _InvalidVisual("duplicate_catalog_key")
        result[key] = value
    return result


def _catalog(root):
    try:
        raw = _read_local(root, ("config", "visual_assets.json"), MAX_CATALOG_BYTES)
        data = json.loads(raw.decode("utf-8"), object_pairs_hook=_unique_object,
                          parse_constant=lambda _: (_ for _ in ()).throw(_InvalidVisual("invalid_json_number")))
        if (not isinstance(data, dict) or type(data.get("schema_version")) is not int or
                data["schema_version"] != CATALOG_VERSION or not isinstance(data.get("assets"), dict) or
                not isinstance(data.get("items"), dict) or len(data["assets"]) > 2048 or len(data["items"]) > 10000):
            raise _InvalidVisual("invalid_catalog")
        return data, []
    except FileNotFoundError:
        return None, []
    except (OSError, UnicodeError, ValueError, RecursionError) as exc:
        return None, [{"code": str(exc) if isinstance(exc, _InvalidVisual) else "catalog_unreadable"}]


def _asset(root, asset_id, record):
    if not isinstance(asset_id, str) or not ASSET_ID.fullmatch(asset_id) or not isinstance(record, dict):
        raise _InvalidVisual("invalid_asset_id")
    if record.get("pixel_reviewed") is not True or record.get("kind") not in KINDS:
        raise _InvalidVisual("pixel_review_required")
    filename = record.get("filename")
    match = FILENAME.fullmatch(filename) if isinstance(filename, str) else None
    digest = record.get("sha256")
    if match is None or digest != match[1]:
        raise _InvalidVisual("invalid_filename")
    width, height = record.get("width"), record.get("height")
    if type(width) is not int or type(height) is not int:
        raise _InvalidVisual("invalid_dimensions")
    metadata = {"asset_id": asset_id, "media_url": "/media/" + asset_id, "width": width, "height": height,
                "kind": record["kind"], "sha256": digest, "pixel_reviewed": True}
    # A single fixed presentation token is allowed; never forward a manifest
    # string into inline CSS or an arbitrary style/background declaration.
    if record.get("image_background") == "#14212f":
        metadata["background"] = "dark"
    metadata.update({name: _text(record.get(name), limit) for name, limit in TEXT_FIELDS.items()})
    try:
        dt.datetime.fromisoformat(metadata["observed_at"].replace("Z", "+00:00"))
    except ValueError as exc:
        raise _InvalidVisual("invalid_observed_at") from exc
    metadata.update({name: _official_url(record.get(name)) for name in ("source_page", "image_url")})
    data = _read_local(root, ("static", "media", filename), MAX_ASSET_BYTES)
    if hashlib.sha256(data).hexdigest() != digest:
        raise _InvalidVisual("hash_mismatch")
    if _dimensions(data, match[2]) != (width, height):
        raise _InvalidVisual("dimensions_mismatch")
    return metadata, data, MIME_TYPES[match[2]]


def visual_metadata(root, item_ids=None):
    """Return validated public manifest metadata; missing/bad assets fall back.

    ``item_ids`` optionally limits item mappings. Source URLs are attribution
    only; ``media_url`` is the sole runtime image address. No filesystem path is
    returned. Each call verifies local file hashes, so stale/corrupted files are
    removed from the manifest rather than advertised as reliable images.
    """
    result = {"schema_version": CATALOG_VERSION, "assets": {}, "items": {}, "warnings": []}
    catalog, warnings = _catalog(root)
    result["warnings"] = warnings
    if catalog is None:
        return result
    try:
        selected = None if item_ids is None else ({item_ids} if isinstance(item_ids, str) else set(item_ids))
    except (TypeError, ValueError):
        result["warnings"].append({"code": "invalid_item_selection"})
        return result
    validated = {}
    for asset_id, record in catalog["assets"].items():
        try:
            metadata, _, _ = _asset(root, asset_id, record)
            validated[asset_id] = metadata
        except (OSError, ValueError, TypeError, OverflowError) as exc:
            if len(result["warnings"]) < 100:
                warning = {"code": str(exc) if isinstance(exc, _InvalidVisual) else "asset_unreadable"}
                if isinstance(asset_id, str) and ASSET_ID.fullmatch(asset_id):
                    warning["asset_id"] = asset_id
                result["warnings"].append(warning)
    for item_id, mapping in catalog["items"].items():
        if selected is not None and item_id not in selected:
            continue
        try:
            if not ITEM_ID.fullmatch(item_id) or not isinstance(mapping, dict):
                raise _InvalidVisual("invalid_item_mapping")
            asset_id = mapping.get("asset_id")
            if not isinstance(asset_id, str) or asset_id not in validated:
                raise _InvalidVisual("missing_item_asset")
            label, edition = _text(mapping.get("label"), 200), _text(mapping.get("edition"), 200)
            metadata = {**validated[asset_id], "label": label, "edition": edition}
            result["items"][item_id] = metadata
            result["assets"][asset_id] = validated[asset_id]
        except (ValueError, TypeError) as exc:
            if len(result["warnings"]) < 100:
                warning = {"code": str(exc) if isinstance(exc, _InvalidVisual) else "invalid_item_mapping"}
                if isinstance(item_id, str) and ITEM_ID.fullmatch(item_id):
                    warning["item_id"] = item_id
                result["warnings"].append(warning)
    return result


def serve_visual(root, asset_id):
    """Return ``(verified_bytes, image_mime)`` or None, never a remote image.

    The only file address comes from a catalog entry with a hash filename.
    ``asset_id`` is a strict opaque identifier, not a path or filename.
    """
    if not isinstance(asset_id, str) or not ASSET_ID.fullmatch(asset_id):
        return None
    catalog, _ = _catalog(root)
    if catalog is None or asset_id not in catalog["assets"]:
        return None
    try:
        _, data, mime = _asset(root, asset_id, catalog["assets"][asset_id])
        return data, mime
    except (OSError, ValueError, TypeError, OverflowError):
        return None
