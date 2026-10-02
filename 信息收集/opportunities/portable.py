"""Bounded, content-addressed assets for portable local backups.

This module never fetches URLs. Restoring blobs only adds verified immutable
files; a failed database restore can leave unreferenced blobs, never remove or
overwrite a user's files. The mutable catalog belongs to the restore journal.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import stat
import uuid
from datetime import datetime
from pathlib import Path

from .visuals import (ASSET_ID, ITEM_ID, FILENAME, KINDS, MAX_ASSET_BYTES,
                      TEXT_FIELDS, _dimensions, _no_links, _official_url,
                      _read_local, _text, _windows_handle_path)


CATALOG_PATH = "config/visual_assets.json"
MAX_ASSET_TOTAL_BYTES = 128 * 1024 * 1024
MAX_FILES = 4096
MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024
MEDIA_PATH = re.compile(r"static/media/([a-f0-9]{64})\.(png|jpe?g|webp)\Z")
ATTACHMENT_PATH = re.compile(r"data/attachments/([a-f0-9]{64})\.(pdf|png|jpe?g|txt)\Z")


def _object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("便携清单不能含重复JSON键")
        result[key] = value
    return result


def _catalog(raw):
    if raw is None:
        return None
    if not isinstance(raw, bytes) or len(raw) > 2 * 1024 * 1024:
        raise ValueError("标识清单无效或超出2MB")
    catalog = json.loads(raw.decode("utf8"), object_pairs_hook=_object,
                         parse_constant=lambda _: (_ for _ in ()).throw(ValueError("无效数字")))
    if (not isinstance(catalog, dict) or set(catalog) != {"schema_version", "assets", "items"} or
            type(catalog["schema_version"]) is not int or catalog["schema_version"] != 1 or
            not isinstance(catalog["assets"], dict) or not isinstance(catalog["items"], dict) or
            len(catalog["assets"]) > 2048 or len(catalog["items"]) > 10000):
        raise ValueError("标识清单结构或版本不兼容")
    for asset_id, record in catalog["assets"].items():
        if not ASSET_ID.fullmatch(asset_id) or not isinstance(record, dict):
            raise ValueError("标识条目无效")
        match = FILENAME.fullmatch(record.get("filename", ""))
        if match is None or record.get("sha256") != match[1] or record.get("kind") not in KINDS or record.get("pixel_reviewed") is not True:
            raise ValueError("标识文件名、类型或像素核验记录无效")
        if type(record.get("width")) is not int or type(record.get("height")) is not int:
            raise ValueError("标识尺寸无效")
        for name, maximum in TEXT_FIELDS.items():
            _text(record.get(name), maximum)
        datetime.fromisoformat(record["observed_at"].replace("Z", "+00:00"))
        _official_url(record.get("source_page"))
        _official_url(record.get("image_url"))
        for value in record.values():
            if isinstance(value, str) and (len(value) > 12000 or "\x00" in value or any(0xD800 <= ord(c) <= 0xDFFF for c in value)):
                raise ValueError("标识元数据含无效文本")
    for item_id, record in catalog["items"].items():
        if (not ITEM_ID.fullmatch(item_id) or not isinstance(record, dict) or set(record) != {"asset_id", "label", "edition"} or
                record["asset_id"] not in catalog["assets"]):
            raise ValueError("机会与标识映射无效")
        _text(record["label"], 200)
        _text(record["edition"], 200)
    return catalog


def attachment_records(rows):
    result = []
    for row in rows["settings"]:
        if row["key"].startswith("library:attachments:"):
            outer = json.loads(row["value"], object_pairs_hook=_object)
            if not isinstance(outer, dict) or not isinstance(outer.get("data"), dict):
                raise ValueError("附件登记结构无效")
            data = outer["data"]
            name = data.get("storage_name")
            match = ATTACHMENT_PATH.fullmatch("data/attachments/" + name) if isinstance(name, str) else None
            if match is None or data.get("sha256") != match[1] or type(data.get("size")) is not int or not 0 < data["size"] <= MAX_ATTACHMENT_BYTES:
                raise ValueError("附件登记文件名、哈希或大小无效")
            result.append(data)
    return result


def asset_limit(name):
    if MEDIA_PATH.fullmatch(name):
        return MAX_ASSET_BYTES
    if ATTACHMENT_PATH.fullmatch(name):
        return MAX_ATTACHMENT_BYTES
    raise ValueError("便携备份含不允许的文件路径")


def validate_assets(payload, catalog_raw, rows):
    """Validate exact references, hashes, types and aggregate limits in memory."""
    if not isinstance(payload, dict) or len(payload) > MAX_FILES:
        raise ValueError("便携文件数量超限")
    catalog = _catalog(catalog_raw)
    attachments = attachment_records(rows)
    expected = {"static/media/" + record["filename"] for record in (catalog or {}).get("assets", {}).values()}
    expected.update("data/attachments/" + record["storage_name"] for record in attachments)
    if set(payload) != expected:
        raise ValueError("便携文件清单与图片、附件登记不一致")
    if sum(len(value) for value in payload.values()) > MAX_ASSET_TOTAL_BYTES:
        raise ValueError("图片与附件总大小超过128MB")
    for name, content in payload.items():
        if not isinstance(content, bytes) or not 0 < len(content) <= asset_limit(name):
            raise ValueError("便携文件大小无效")
        match = MEDIA_PATH.fullmatch(name) or ATTACHMENT_PATH.fullmatch(name)
        if hashlib.sha256(content).hexdigest() != match[1]:
            raise ValueError("便携文件内容与地址哈希不符")
        if MEDIA_PATH.fullmatch(name):
            _dimensions(content, match[2])
        else:
            # Evidence imports and backup restores share the same format policy.
            from .evidence import _validate_content
            _validate_content(content, match[2])
    for record in (catalog or {}).get("assets", {}).values():
        name = "static/media/" + record["filename"]
        if _dimensions(payload[name], record["filename"].rsplit(".", 1)[1]) != (record["width"], record["height"]):
            raise ValueError("图片尺寸与清单不符")
    for record in attachments:
        if len(payload["data/attachments/" + record["storage_name"]]) != record["size"]:
            raise ValueError("附件长度与登记不符")
        if record["storage_name"].endswith(".txt"):
            from .evidence import _validate_content
            if record.get("text_state") != "plain_text" or record.get("text") != _validate_content(payload["data/attachments/" + record["storage_name"]], "txt"):
                raise ValueError("TXT正文与可检索原文登记不符")
    return {"version": 1, "visual_catalog": catalog_raw is not None,
            "media_files": sum(bool(MEDIA_PATH.fullmatch(name)) for name in payload),
            "attachment_files": sum(bool(ATTACHMENT_PATH.fullmatch(name)) for name in payload),
            "asset_bytes": sum(map(len, payload.values()))}


def collect_assets(root, db_path, rows, catalog_raw):
    catalog = _catalog(catalog_raw)
    payload = {}
    for record in (catalog or {}).get("assets", {}).values():
        name = record["filename"]
        payload["static/media/" + name] = _read_local(root, ("static", "media", name), MAX_ASSET_BYTES)
    for record in attachment_records(rows):
        name = record["storage_name"]
        payload["data/attachments/" + name] = _read_local(Path(db_path).parent, ("attachments", name), MAX_ATTACHMENT_BYTES)
    return payload, validate_assets(payload, catalog_raw, rows)


def _directory(root, parts):
    current = Path(root).resolve(strict=True)
    _no_links(current)
    for part in parts:
        current /= part
        current.mkdir(exist_ok=True)
        _no_links(current)
    if current.resolve(strict=True) != current:
        raise ValueError("便携文件目录不是普通项目目录")
    return current


def install_assets(root, db_path, payload):
    """Install content-addressed blobs; never overwrite/delete existing blobs."""
    installed = 0
    for name, content in payload.items():
        if MEDIA_PATH.fullmatch(name):
            base, parts = Path(root).resolve(), ("static", "media")
        elif ATTACHMENT_PATH.fullmatch(name):
            base, parts = Path(db_path).parent.resolve(), ("attachments",)
        else:
            raise ValueError("便携文件路径无效")
        directory = _directory(base, parts)
        filename = name.rsplit("/", 1)[1]
        destination = directory / filename
        if destination.exists() or destination.is_symlink():
            if _read_local(base, (*parts, filename), asset_limit(name)) != content:
                raise ValueError("现有内容地址文件损坏或不匹配，拒绝覆盖")
            continue
        pending = directory / (".portable-" + uuid.uuid4().hex)
        try:
            with pending.open("xb") as target:
                opened = os.fstat(target.fileno())
                opened_path = _windows_handle_path(target.fileno())
                if not stat.S_ISREG(opened.st_mode) or opened.st_nlink != 1 or opened_path is not None and opened_path != pending:
                    raise ValueError("便携临时文件位置无效")
                target.write(content)
                target.flush()
                os.fsync(target.fileno())
            _no_links(directory)
            # link is an atomic create-if-absent operation on Windows and POSIX.
            # The temporary alias is removed immediately, leaving one ordinary
            # file. Unlike replace/rename, it cannot overwrite a racing writer.
            try:
                os.link(pending, destination)
                installed += 1
            except FileExistsError:
                pass
        finally:
            pending.unlink(missing_ok=True)
        if _read_local(base, (*parts, filename), asset_limit(name)) != content:
            raise ValueError("便携文件安装完整性校验失败")
    return installed
