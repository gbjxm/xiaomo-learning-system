"""Local, complete backups with preview-bound, one-use restore confirmation.

Only basename IDs from ``data/backups`` are accepted. Untrusted SQLite files
are read and validated; their schema is never executed against the live store.
"""
from __future__ import annotations

import copy
import base64
import hashlib
import ipaddress
import json
import math
import os
import re
import secrets
import shutil
import sqlite3
import stat
import struct
import threading
import time
import uuid
import zipfile
from contextlib import closing, contextmanager, nullcontext
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlsplit

from .model import canonical_url, json_text, normalize, utcnow
from .storage import AlreadyRunning, ProcessLock, SCHEMA


class BackupError(ValueError):
    """A backup or its explicit restore confirmation failed validation."""


FORMAT = "xiaomo-local-backup"
FORMAT_VERSION = 1
PORTABLE_FORMAT_VERSION = 2
SCHEMA_VERSION = 3
ID_PATTERN = re.compile(r"backup-\d{8}T\d{6}Z-[0-9a-f]{32}\Z")
TABLES = ("settings", "sources", "opportunities", "versions", "runs", "attempts", "observations", "page_changes", "discovery_candidates")
FILES = ("database.sqlite3", "config/sources.json", "config/rules.json")
MAX_DATABASE_BYTES = 256 * 1024 * 1024
MAX_CONFIG_BYTES = 2 * 1024 * 1024
MAX_ARCHIVE_BYTES = MAX_DATABASE_BYTES + 128 * 1024 * 1024 + 3 * MAX_CONFIG_BYTES + 1024 * 1024
MAX_MANIFEST_BYTES = 1024 * 1024
MAX_IMPORT_BYTES = 64 * 1024 * 1024
VISUAL_CONFIG = "config/visual_assets.json"
MAX_ROWS = 1_000_000
MAX_TEXT = 1024 * 1024
CONFIRM_SECONDS = 600
JOURNAL_NAME = ".restore-journal.json"
JOURNAL_FORMAT = "xiaomo-restore-journal"
JOURNAL_MAX_BYTES = 12 * 1024 * 1024
RESTORE_RECEIPT_KEY = "__backup_restore_transaction"
SOURCE_FIELDS = {"id", "name", "platform", "url", "allowed_hosts", "adapter", "scope", "note"}
SOURCE_OPTIONAL = {"discovery", "respect_robots", "capability", "verified_list_at"}
ADAPTERS = {"libtv", "article", "homepage", "image_article", "unadapted", "official_list"}
RULE_FIELDS = {"profile_label", "keywords", "preferred_platforms", "new_publication_days", "stale_verification_days", "request_timeout_seconds", "max_response_bytes", "max_items_per_source", "update_click_cooldown_seconds"}


def _digest(value):
    return hashlib.sha256(value).hexdigest()


def _check_zip_layout(value):
    """Bound central-directory entries before ZipFile allocates ZipInfo objects.

    Backups are far below ZIP64 limits and are ordinary standalone ZIP files;
    split archives, prefixes, trailing executables/data and ZIP64 are excluded.
    """
    marker = value.rfind(b"PK\x05\x06", max(0, len(value)-65557))
    if marker < 0 or marker+22 > len(value):
        raise BackupError("备份ZIP结尾无效")
    _, disk, start_disk, disk_count, count, size, offset, comment = struct.unpack_from("<4s4H2LH", value, marker)
    if (disk or start_disk or disk_count != count or count > 4101 or
            marker+22+comment != len(value) or offset+size != marker or offset == 0xFFFFFFFF or size == 0xFFFFFFFF):
        raise BackupError("备份ZIP分卷、文件数量或目录边界无效")
    position, actual = offset, 0
    while position < marker:
        if actual >= 4101 or position+46 > marker or value[position:position+4] != b"PK\x01\x02":
            raise BackupError("备份ZIP实际目录条数或结构无效")
        name_size, extra_size, comment_size = struct.unpack_from("<3H", value, position+28)
        if struct.unpack_from("<H", value, position+34)[0]:
            raise BackupError("备份ZIP不能是分卷文件")
        position += 46+name_size+extra_size+comment_size
        actual += 1
    if position != marker or actual != count:
        raise BackupError("备份ZIP实际目录与声明数量不符")


def _json_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise BackupError("备份 JSON 不能包含重复键")
        result[key] = value
    return result


def _json(value, expected=None):
    try:
        result = json.loads(value, object_pairs_hook=_json_object, parse_constant=lambda value: (_ for _ in ()).throw(ValueError(value)))
    except (ValueError, TypeError, UnicodeError, RecursionError) as exc:
        raise BackupError("备份中的 JSON 无效") from exc
    if expected is not None and not isinstance(result, expected):
        raise BackupError("备份中的 JSON 类型不符")
    _check_json_size(result)
    return result


def _check_json_size(value, depth=0):
    if depth > 32:
        raise BackupError("备份 JSON 嵌套过深")
    if isinstance(value, str):
        if len(value) > MAX_TEXT or "\x00" in value or any(0xD800 <= ord(char) <= 0xDFFF for char in value):
            raise BackupError("备份文本超出限制或含无效字符")
    elif isinstance(value, (dict, list)):
        if len(value) > 10000:
            raise BackupError("备份 JSON 集合超出限制")
        values = value.items() if isinstance(value, dict) else enumerate(value)
        for key, item in values:
            if isinstance(key, str):
                _check_json_size(key, depth + 1)
            _check_json_size(item, depth + 1)
    elif isinstance(value, float) and not math.isfinite(value):
        raise BackupError("备份 JSON 数值无效")
    elif value is not None and not isinstance(value, (bool, int, float)):
        raise BackupError("备份 JSON 值不符")


def _public_host(host):
    if not isinstance(host, str) or host != host.lower() or len(host) > 253:
        raise BackupError("来源域名格式无效")
    try:
        ipaddress.ip_address(host)
    except ValueError:
        pass
    else:
        raise BackupError("来源必须使用公网域名，不能使用 IP 地址")
    labels = host.split(".")
    if len(labels) < 2 or any(not re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?", label) for label in labels):
        raise BackupError("来源域名格式无效")
    if labels[-1] in {"localhost", "local", "internal", "test", "invalid", "example", "onion"} or host.endswith(".home.arpa"):
        raise BackupError("来源地址必须是公网域名")
    return host


def _public_url(value, hosts=None):
    if not isinstance(value, str) or len(value) > 8192 or any(ord(ch) < 32 for ch in value) or "\\" in value:
        raise BackupError("备份 URL 无效")
    try:
        canonical_url(value)
        host = _public_host(urlsplit(value).hostname)
    except (ValueError, TypeError, AttributeError) as exc:
        raise BackupError("备份链接必须是无凭据的公网 HTTPS URL") from exc
    if hosts is not None and host not in hosts:
        raise BackupError("来源 URL 域名未列入 allowed_hosts")


def _validate_source(source):
    if not isinstance(source, dict) or not SOURCE_FIELDS <= set(source) or set(source) - SOURCE_FIELDS - SOURCE_OPTIONAL:
        raise BackupError("来源配置字段不符")
    if not isinstance(source["id"], str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,100}", source["id"]):
        raise BackupError("来源 ID 无效")
    for name in ("name", "platform", "scope", "note"):
        if not isinstance(source[name], str) or len(source[name]) > 10000:
            raise BackupError("来源文字字段无效")
    if not source["name"] or not source["platform"] or not isinstance(source["adapter"], str) or source["adapter"] not in ADAPTERS:
        raise BackupError("来源名称、平台或适配器无效")
    hosts = source["allowed_hosts"]
    if not isinstance(hosts, list) or not 1 <= len(hosts) <= 50 or any(not isinstance(host, str) for host in hosts) or len(set(hosts)) != len(hosts):
        raise BackupError("来源域名列表无效")
    for host in hosts:
        _public_host(host)
    _public_url(source["url"], hosts)
    if "respect_robots" in source and source["respect_robots"] is not True:
        raise BackupError("本项目备份不能关闭官方 robots 访问限制")
    if "capability" in source and source["capability"] not in ("automatic_discovery", "known_page", "manual", "unavailable"):
        raise BackupError("来源能力标记无效")
    if "verified_list_at" in source:
        try:
            if not isinstance(source["verified_list_at"], str) or len(source["verified_list_at"]) > 64:
                raise ValueError("invalid timestamp")
            datetime.fromisoformat(source["verified_list_at"].replace("Z", "+00:00"))
        except ValueError as exc:
            raise BackupError("来源列表核验时间无效") from exc
    discovery = source.get("discovery")
    if source["adapter"] == "official_list" and discovery is None:
        raise BackupError("官方列表缺少发现配置")
    if discovery is not None:
        required = {"path_prefixes", "path_suffix", "minimum_entries", "max_candidates", "opportunity_words", "creative_words", "exclude_title"}
        if not isinstance(discovery, dict) or not required <= set(discovery) or set(discovery) - required - {"list_label", "pagination"}:
            raise BackupError("列表发现配置字段无效")
        prefixes = discovery["path_prefixes"]
        if not isinstance(prefixes, list) or not 1 <= len(prefixes) <= 10 or any(not isinstance(value, str) or not value.startswith("/") or len(value) > 200 or any(char in value for char in "\\\x00?#") for value in prefixes):
            raise BackupError("列表路径前缀无效")
        suffix = discovery["path_suffix"]
        if not isinstance(suffix, str) or len(suffix) > 30 or any(char in suffix for char in "\\\x00?#"):
            raise BackupError("列表路径后缀无效")
        for name, maximum in (("minimum_entries", 100), ("max_candidates", 20)):
            if type(discovery[name]) is not int or not 1 <= discovery[name] <= maximum:
                raise BackupError("列表发现数量限制无效")
        for name in ("opportunity_words", "creative_words", "exclude_title"):
            values = discovery[name]
            if not isinstance(values, list) or len(values) > 30 or any(not isinstance(value, str) or not value or len(value) > 40 for value in values):
                raise BackupError("列表发现词表无效")
        if "list_label" in discovery and (not isinstance(discovery["list_label"], str) or len(discovery["list_label"]) > 120):
            raise BackupError("列表名称无效")
        if "pagination" in discovery:
            page = discovery["pagination"]
            if (not isinstance(page, dict) or set(page) != {"mode", "max_pages", "path_prefixes"} or
                    page["mode"] not in ("next_link", "bjiff_static") or type(page["max_pages"]) is not int or not 1 <= page["max_pages"] <= 5):
                raise BackupError("分页模式或页数限制无效")
            values = page["path_prefixes"]
            if not isinstance(values, list) or not 1 <= len(values) <= 8 or any(not isinstance(value, str) or not value.startswith("/") or len(value) > 200 or ".." in value or any(char in value for char in "\\\x00?#") for value in values):
                raise BackupError("分页路径范围无效")


def _validate_configs(configs):
    sources = _json(configs["config/sources.json"], list)
    rules = _json(configs["config/rules.json"], dict)
    if len(sources) > 10000:
        raise BackupError("来源数超出限制")
    for source in sources:
        _validate_source(source)
    if len({source["id"] for source in sources}) != len(sources):
        raise BackupError("来源 ID 重复")
    if set(rules) != RULE_FIELDS or not isinstance(rules["profile_label"], str) or len(rules["profile_label"]) > 300:
        raise BackupError("规则配置字段无效")
    for name in ("keywords", "preferred_platforms"):
        values = rules[name]
        if not isinstance(values, list) or not 1 <= len(values) <= 100 or any(not isinstance(value, str) or not value or len(value) > 200 for value in values):
            raise BackupError("规则关键词或平台配置无效")
    limits = {"new_publication_days": (1, 3650), "stale_verification_days": (1, 3650), "request_timeout_seconds": (1, 120), "max_response_bytes": (1024, 16 * 1024 * 1024), "max_items_per_source": (1, 1000), "update_click_cooldown_seconds": (1, 3600)}
    for name, (minimum, maximum) in limits.items():
        if type(rules[name]) is not int or not minimum <= rules[name] <= maximum:
            raise BackupError("规则数值超出允许范围")
    return sources, rules


def _create_schema(conn):
    conn.executescript(SCHEMA)
    for table, columns in {"sources": ("coverage", "last_article_success_at"), "attempts": ("coverage",), "observations": ("coverage",)}.items():
        existing = {row[1] for row in conn.execute(f"PRAGMA table_info({table})")}
        for column in columns:
            if column not in existing:
                conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} TEXT")
    conn.execute(f"PRAGMA user_version={SCHEMA_VERSION}")


def _schema_rows(conn):
    return [(kind, name, table, re.sub(r"\s+", " ", sql).strip() if sql else None) for kind, name, table, sql in conn.execute("SELECT type,name,tbl_name,sql FROM sqlite_schema ORDER BY type,name")]


with closing(sqlite3.connect(":memory:")) as _reference:
    _create_schema(_reference)
    EXPECTED_SCHEMA = _schema_rows(_reference)
    COLUMNS = {table: list(_reference.execute(f"PRAGMA table_info({table})")) for table in TABLES}


def _read_rows(conn):
    rows, total = {}, 0
    for table in TABLES:
        count = conn.execute(f"SELECT count(*) FROM {table}").fetchone()[0]
        total += count
        if total > MAX_ROWS:
            raise BackupError("备份记录数超出限制")
        names = [column[1] for column in COLUMNS[table]]
        rows[table] = [dict(zip(names, row)) for row in conn.execute(f"SELECT {','.join(names)} FROM {table} ORDER BY {','.join(names)}")]
    return rows


def _counts(rows, sources):
    return {**{table: len(rows[table]) for table in TABLES}, "starred": sum(row["starred"] == 1 for row in rows["opportunities"]), "notes": sum(bool(row["note"]) for row in rows["opportunities"]), "configured_sources": len(sources)}


def _workspace_impact(before, after):
    from .workspace import KINDS
    result=[]
    for kind in sorted(KINDS):
        prefix='library:'+kind+':'
        old={row['key']:row['value'] for row in before['settings'] if row['key'].startswith(prefix)}
        new={row['key']:row['value'] for row in after['settings'] if row['key'].startswith(prefix)}
        result.append({'kind':kind,'before':len(old),'after':len(new),'added':len(new.keys()-old.keys()),'removed':len(old.keys()-new.keys()),'changed':sum(old[key]!=new[key] for key in old.keys()&new.keys())})
    return result


def _fingerprint(rows, configs):
    digest = hashlib.sha256()
    digest.update(str(SCHEMA_VERSION).encode())
    for table in TABLES:
        digest.update(table.encode())
        for row in rows[table]:
            digest.update(json_text(row).encode("utf-8"))
            digest.update(b"\n")
    for name in sorted(configs):
        digest.update(name.encode())
        digest.update(configs[name] if configs[name] is not None else b"\x00absent")
    return digest.hexdigest()


def _validate_document(value, item_id):
    doc = _json(value, dict)
    for name in ("time", "program"):
        if not isinstance(doc.get(name), dict):
            raise BackupError("条目时间或计划字段无效")
    for name in ("tags", "rewards", "eligibility", "work_requirements", "steps", "risks", "evidence"):
        if not isinstance(doc.get(name), list):
            raise BackupError("条目数组字段无效")
    if any(not isinstance(value, dict) for value in doc["rewards"] + doc["evidence"]):
        raise BackupError("条目奖励或证据字段无效")
    try:
        normalized = normalize(doc)
    except (ValueError, TypeError, KeyError, AttributeError) as exc:
        raise BackupError("备份条目未通过规范校验") from exc
    if normalized["id"] != item_id or doc.get("id") != item_id:
        raise BackupError("条目 ID 与内容不符")
    _public_url(doc["official_url"])
    if doc.get("entry_url"):
        _public_url(doc["entry_url"])
    for evidence in doc["evidence"]:
        if evidence.get("url"):
            _public_url(evidence["url"])
    return doc


def _validate_rows(rows, configs):
    sources, rules = _validate_configs(configs)
    if any(row["key"] == RESTORE_RECEIPT_KEY for row in rows["settings"]):
        raise BackupError("备份含仅供恢复事务使用的保留设置")
    for table in TABLES:
        for row in rows[table]:
            for _, name, declaration, required, _, primary in COLUMNS[table]:
                value = row[name]
                if value is None:
                    if required or primary:
                        raise BackupError("备份必填列为空")
                elif declaration == "INTEGER":
                    if type(value) is not int or value < 0 or value > 2**63 - 1:
                        raise BackupError("备份整数列无效")
                elif not isinstance(value, str) or len(value) > MAX_TEXT or "\x00" in value:
                    raise BackupError("备份文本列无效")
    source_ids = {row["id"] for row in rows["sources"]}
    for source in sources:
        if source["id"] not in source_ids:
            raise BackupError("配置来源未在备份来源表中登记")
    for row in rows["sources"]:
        source = _json(row["config"], dict)
        _validate_source(source)
        if source["id"] != row["id"]:
            raise BackupError("来源表 ID 与配置不符")
    documents = {}
    for row in rows["opportunities"]:
        doc = _validate_document(row["document"], row["id"])
        if row["source_id"] not in source_ids or any(doc[key] != row[key] for key in ("source_id", "official_url", "edition")):
            raise BackupError("条目来源或身份字段不符")
        if row["version"] < 1 or row["starred"] not in (0, 1) or len(row["note"]) > 5000:
            raise BackupError("条目版本、关注或笔记字段无效")
        documents[row["id"]] = doc
    item_rows = {row["id"]: row for row in rows["opportunities"]}
    version_numbers = {item_id: [] for item_id in documents}
    for row in rows["versions"]:
        item_id = row["opportunity_id"]
        if item_id not in documents or row["version"] < 1:
            raise BackupError("版本历史引用无效")
        snapshot = _validate_document(row["snapshot"], item_id)
        _json(row["changes"], list)
        version_numbers[item_id].append(row["version"])
        if row["version"] == item_rows[item_id]["version"] and snapshot != documents[item_id]:
            raise BackupError("最新历史快照与条目内容不符")
    for item_id, versions in version_numbers.items():
        if len(versions) != item_rows[item_id]["version"] or any(number != index for index, number in enumerate(sorted(versions), 1)):
            raise BackupError("条目版本历史不完整")
    for doc in documents.values():
        if any(relation["target_id"] not in documents for relation in doc.get("relations", [])):
            raise BackupError("关联条目的目标不存在")
    observation_rows = {row["id"]: row for row in rows["observations"]}
    for table in ("attempts", "observations", "page_changes"):
        for row in rows[table]:
            if row["id"] < 1 or row["source_id"] not in source_ids:
                raise BackupError("核验记录来源或 ID 无效")
    for row in rows["observations"]:
        _public_url(row["url"])
        if len(row["body"]) > 120000 or row["text_hash"] != _digest(row["body"].encode("utf-8")):
            raise BackupError("正文观察内容与哈希不符")
    for row in rows["page_changes"]:
        _public_url(row["url"])
        before, after = observation_rows.get(row["before_id"]), observation_rows.get(row["after_id"])
        if not before or not after or before["id"] == after["id"] or any(value["source_id"] != row["source_id"] or value["url"] != row["url"] for value in (before, after)):
            raise BackupError("页面变更引用无效")
    for table in ("sources", "attempts", "observations"):
        for row in rows[table]:
            if row["coverage"] is not None:
                _json(row["coverage"], dict)
    for row in rows["runs"]:
        if row["summary"] is not None:
            _json(row["summary"], dict)
    for row in rows["discovery_candidates"]:
        if row["source_id"] not in source_ids or not re.fullmatch(r"[0-9a-f]{24}", row["id"]) or row["review_state"] not in ("pending", "known", "dismissed"):
            raise BackupError("发现候选来源、ID 或复核状态无效")
        _public_url(row["official_url"])
        _json(row["evidence"], (dict, list))
        if len(row["body"]) > 120000 or (row["known_item_id"] is not None and row["known_item_id"] not in documents):
            raise BackupError("发现候选正文或条目引用无效")
    # Store.observe/record_attempt allow historical run IDs without a runs row.
    # Preserve these records; the schema intentionally has no run foreign keys.
    return sources, rules


def _backup_directory(root):
    root = Path(root).resolve()
    directory = root / "data" / "backups"
    if not directory.resolve().is_relative_to(root):
        raise BackupError("备份目录必须位于项目内")
    directory.mkdir(parents=True, exist_ok=True)
    return directory.resolve()


def _config_lock_path(root):
    root = Path(root).resolve()
    path = root / "data" / "backup-config.lock"
    if path.is_symlink() or not path.resolve().is_relative_to(root):
        raise BackupError("备份配置锁必须位于项目内")
    return path


def _config_path(root, name):
    if name not in (*FILES[1:], VISUAL_CONFIG):
        raise BackupError("恢复配置文件名无效")
    root = Path(root).resolve()
    path = root / name
    if path.is_symlink() or not path.resolve().is_relative_to(root):
        raise BackupError("配置文件必须位于项目内")
    return path


def _bounded_read(path, maximum, allowed_root):
    # fstat and read use the same opened object, including when a pathname is
    # replaced between the earlier basename check and this open.
    parent = path.parent.resolve()
    if not parent.is_relative_to(Path(allowed_root)):
        raise BackupError("本地备份文件路径超出范围")
    with path.open("rb") as stream:
        opened = os.fstat(stream.fileno())
        current = path.stat()
        if path.is_symlink() or path.resolve().parent != parent or not path.resolve().is_relative_to(Path(allowed_root)) or not stat.S_ISREG(opened.st_mode) or (opened.st_dev, opened.st_ino) != (current.st_dev, current.st_ino):
            raise BackupError("本地备份文件路径或对象在读取前改变")
        if opened.st_size > maximum:
            raise BackupError("本地备份文件超出大小限制")
        value = stream.read(maximum + 1)
    if len(value) > maximum:
        raise BackupError("本地备份文件超出大小限制")
    return value


def _read_config_bytes(root):
    return {name: _bounded_read(_config_path(root, name), MAX_CONFIG_BYTES, root) for name in FILES[1:]}


def _read_configs(root):
    configs = _read_config_bytes(root)
    _validate_configs(configs)
    return configs


def _with_visual_config(root, configs):
    result = dict(configs)
    path = _config_path(root, VISUAL_CONFIG)
    result[VISUAL_CONFIG] = _bounded_read(path, MAX_CONFIG_BYTES, root) if path.exists() else None
    return result


def configuration_fingerprint(configs):
    digest = hashlib.sha256()
    for name in FILES[1:]:
        digest.update(name.encode("utf-8"))
        digest.update(configs[name])
    return digest.hexdigest()


def _atomic_bytes(path, value, prefix):
    pending = path.parent / (prefix + uuid.uuid4().hex)
    try:
        with pending.open("xb") as stream:
            stream.write(value)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(pending, path)
    finally:
        pending.unlink(missing_ok=True)


def _write_config(root, name, value):
    if name == VISUAL_CONFIG and value is None:
        _config_path(root, name).unlink(missing_ok=True)
        return
    if not isinstance(value, bytes) or len(value) > MAX_CONFIG_BYTES:
        raise BackupError("恢复配置内容超出限制")
    _atomic_bytes(_config_path(root, name), value, ".restore-")


def _database_marker(db_path):
    return _digest(str(Path(db_path).resolve()).encode("utf-8"))


def _pack_configs(configs):
    return {name: None if value is None else {"data": base64.b64encode(value).decode("ascii"), "sha256": _digest(value), "size": len(value)} for name, value in configs.items()}


def _unpack_configs(payload):
    if not isinstance(payload, dict) or set(payload) not in (set(FILES[1:]), set(FILES[1:]) | {VISUAL_CONFIG}):
        raise BackupError("恢复日志配置列表无效")
    result = {}
    for name, item in payload.items():
        if item is None and name == VISUAL_CONFIG:
            result[name] = None
            continue
        if not isinstance(item, dict) or set(item) != {"data", "sha256", "size"} or type(item["size"]) is not int or not 0 <= item["size"] <= MAX_CONFIG_BYTES or not isinstance(item["data"], str) or len(item["data"]) > ((MAX_CONFIG_BYTES + 2) // 3) * 4:
            raise BackupError("恢复日志配置内容无效")
        try:
            value = base64.b64decode(item["data"], validate=True)
        except (ValueError, TypeError) as exc:
            raise BackupError("恢复日志配置编码无效") from exc
        if len(value) != item["size"] or _digest(value) != item["sha256"]:
            raise BackupError("恢复日志配置哈希不符")
        result[name] = value
    _validate_configs(result)
    if VISUAL_CONFIG in result:
        from .portable import _catalog
        try:
            _catalog(result[VISUAL_CONFIG])
        except (ValueError, TypeError, KeyError, RecursionError) as exc:
            raise BackupError("恢复日志标识清单无效") from exc
    return result


def _journal_path(root):
    directory = _backup_directory(root)
    path = directory / JOURNAL_NAME
    if path.is_symlink() or path.resolve().parent != directory:
        raise BackupError("恢复日志路径无效")
    return path


def _write_journal(root, journal):
    value = json_text(journal).encode("utf-8")
    if len(value) > JOURNAL_MAX_BYTES:
        raise BackupError("恢复日志超出大小限制")
    _atomic_bytes(_journal_path(root), value, ".journal-")


def _read_journal(root, db_path):
    path = _journal_path(root)
    if not path.exists():
        return None
    try:
        value = json.loads(_bounded_read(path, JOURNAL_MAX_BYTES, root), object_pairs_hook=_json_object)
    except (ValueError, TypeError, UnicodeError, RecursionError, OSError) as exc:
        raise BackupError("恢复日志损坏，未修改当前数据库或配置") from exc
    fields = {"format", "version", "restore_id", "database_marker", "backup_id", "pre_restore_backup", "phase", "before", "after"}
    if not isinstance(value, dict) or set(value) != fields or value["format"] != JOURNAL_FORMAT or type(value["version"]) is not int or value["version"] != 1 or not isinstance(value["restore_id"], str) or not re.fullmatch(r"[0-9a-f]{32}", value["restore_id"]) or value["phase"] not in ("prepared", "committed"):
        raise BackupError("恢复日志格式无效，未修改当前数据库或配置")
    if value["database_marker"] != _database_marker(db_path):
        raise BackupError("另一数据文件有未完成的恢复，请先使用原数据文件完成恢复")
    if any(not isinstance(value[key], str) or not ID_PATTERN.fullmatch(value[key]) for key in ("backup_id", "pre_restore_backup")):
        raise BackupError("恢复日志备份 ID 无效")
    value["decoded_before"] = _unpack_configs(value["before"])
    value["decoded_after"] = _unpack_configs(value["after"])
    if set(value["decoded_before"]) != set(value["decoded_after"]):
        raise BackupError("恢复日志前后配置范围不同")
    return value


def _receipt(journal):
    return json_text({"restore_id": journal["restore_id"], "database_marker": journal["database_marker"]})


def _recover_pending_locked(root, db_path, update_locked=False):
    """Called with the project configuration lock held; never replaces DB rows."""
    journal = _read_journal(root, db_path)
    if journal is None:
        return None
    guard = nullcontext() if update_locked else ProcessLock(Path(db_path).parent / "update.lock")
    with guard:
        try:
            with closing(sqlite3.connect(Path(db_path).resolve().as_uri() + "?mode=rw", uri=True, timeout=15)) as conn:
                conn.execute("PRAGMA trusted_schema=OFF")
                conn.execute("BEGIN IMMEDIATE")
                try:
                    if _schema_rows(conn) != EXPECTED_SCHEMA or conn.execute("PRAGMA user_version").fetchone()[0] != SCHEMA_VERSION:
                        raise BackupError("未完成恢复对应的数据库结构不符，恢复日志已保留")
                    row = conn.execute("SELECT value FROM settings WHERE key=?", (RESTORE_RECEIPT_KEY,)).fetchone()
                    if row and row[0] != _receipt(journal):
                        raise BackupError("恢复事务收据与日志不符，未修改数据")
                    committed = journal["phase"] == "committed" or bool(row)
                    desired = journal["decoded_after"] if committed else journal["decoded_before"]
                    current = {name: _bounded_read(_config_path(root, name), MAX_CONFIG_BYTES, root) if _config_path(root, name).exists() else None for name in desired}
                    if any(value is not None and value not in (journal["decoded_before"][name], journal["decoded_after"][name]) for name, value in current.items()):
                        raise BackupError("未完成恢复期间配置被外部修改，日志已保留，请先保存当前配置并核对恢复前快照")
                    for name in desired:
                        if current[name] != desired[name]:
                            _write_config(root, name, desired[name])
                    checked = _read_configs(root)
                    if VISUAL_CONFIG in desired:
                        checked = _with_visual_config(root, checked)
                    if checked != desired:
                        raise BackupError("恢复日志配置写入校验失败")
                    if committed and journal["phase"] != "committed":
                        persisted = {key: value for key, value in journal.items() if not key.startswith("decoded_")}
                        persisted["phase"] = "committed"
                        _write_journal(root, persisted)
                    if row:
                        conn.execute("DELETE FROM settings WHERE key=? AND value=?", (RESTORE_RECEIPT_KEY, _receipt(journal)))
                    conn.commit()
                except BaseException:
                    conn.rollback()
                    raise
            _journal_path(root).unlink()
            return {"committed": committed, "configs": desired}
        except (sqlite3.Error, OSError) as exc:
            raise BackupError("未完成恢复的收尾失败，持久日志及恢复前快照已保留") from exc


@contextmanager
def store_startup_guard(root, db_path):
    """Recover before Store reads configuration, registers sources or seeds rows."""
    deadline = time.monotonic() + 3
    while True:
        lock = ProcessLock(_config_lock_path(root))
        try:
            lock.__enter__()
            break
        except AlreadyRunning:
            if time.monotonic() >= deadline:
                raise AlreadyRunning("备份或恢复仍在处理，请稍后重新打开信息库")
            time.sleep(0.02)
    try:
        _recover_pending_locked(root, db_path)
        yield
    finally:
        lock.__exit__(None, None, None)


@contextmanager
def collection_guard(store):
    """Refresh a pre-existing Store after a different instance restored config.

    Acquire configuration before update, then release configuration for the
    collection itself. This retains online-backup concurrency with collection.
    """
    update_lock = ProcessLock(store.db_path.parent / "update.lock")
    with ProcessLock(_config_lock_path(store.root)):
        update_lock.__enter__()
        try:
            _recover_pending_locked(store.root, store.db_path, update_locked=True)
            configs = _read_config_bytes(store.root)
            marker = configuration_fingerprint(configs)
            if marker != getattr(store, "_configuration_fingerprint", None):
                sources, rules = _validate_configs(configs)
                with store.connection() as conn:
                    for source in sources:
                        conn.execute("INSERT INTO sources(id,config) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET config=excluded.config", (source["id"], json_text(source)))
                    store.source_config, store.rules = sources, rules
                    store._configuration_fingerprint = marker
        except BaseException:
            update_lock.__exit__(None, None, None)
            raise
    try:
        yield
    finally:
        update_lock.__exit__(None, None, None)


class BackupManager:
    def __init__(self, store):
        self.store = store
        self.root = Path(store.root).resolve()
        self.directory = _backup_directory(self.root)
        self._lock = threading.RLock()
        self._mutation_lock = getattr(store, "mutation_lock", None) or threading.RLock()
        self._tokens = {}

    def path(self, backup_id):
        """Resolve a validated ID for a local download; never accepts a path."""
        if not isinstance(backup_id, str) or not ID_PATTERN.fullmatch(backup_id):
            raise BackupError("备份 ID 无效；不能传入文件路径")
        path = self.directory / (backup_id + ".zip")
        if path.is_symlink() or path.resolve().parent != self.directory or not self.directory.is_relative_to(self.root):
            raise BackupError("备份路径超出项目备份目录")
        return path

    def read(self, backup_id):
        """Read a basename backup through one bounded, identity-checked handle."""
        return _bounded_read(self.path(backup_id), MAX_ARCHIVE_BYTES, self.directory)

    def _configs(self):
        return _read_configs(self.root)

    @contextmanager
    def _config_guard(self):
        with ProcessLock(_config_lock_path(self.root)):
            recovered = _recover_pending_locked(self.root, self.store.db_path)
            if recovered:
                self.store.source_config, self.store.rules = _validate_configs(recovered["configs"])
                self.store._configuration_fingerprint = configuration_fingerprint(recovered["configs"])
            yield

    @contextmanager
    def _workspace(self, prefix):
        # Windows' mkdir(mode=0700), used by tempfile, removes the inherited
        # sandbox ACL. Ordinary mkdir inherits the project's access correctly.
        path = self.directory / (prefix + uuid.uuid4().hex)
        path.mkdir()
        try:
            yield path
        finally:
            if path.is_symlink() or path.resolve().parent != self.directory:
                raise BackupError("临时备份目录超出范围，未清理")
            shutil.rmtree(path)

    @contextmanager
    def _restore_guard(self):
        # The configuration lock serializes creators, restorers and startup
        # across Store instances. Collection acquires the same order, releasing
        # configuration before its network work so online backups can proceed.
        with self._config_guard():
            with ProcessLock(self.store.db_path.parent / "update.lock"):
                with self._mutation_lock:
                    yield

    def _validate_database(self, path, configs):
        if path.stat().st_size > MAX_DATABASE_BYTES:
            raise BackupError("备份数据库超出限制")
        deadline = time.monotonic() + 15
        try:
            conn = sqlite3.connect(path.resolve().as_uri() + "?mode=ro&immutable=1", uri=True)
            try:
                conn.execute("PRAGMA trusted_schema=OFF")
                conn.execute("PRAGMA query_only=ON")
                conn.set_progress_handler(lambda: int(time.monotonic() > deadline), 10000)
                if conn.execute("PRAGMA user_version").fetchone()[0] != SCHEMA_VERSION:
                    raise BackupError("备份数据库版本不兼容")
                # Reject triggers, views, virtual tables, extra indexes/tables,
                # altered constraints and executable schema before reading rows.
                if _schema_rows(conn) != EXPECTED_SCHEMA:
                    raise BackupError("备份数据库结构不符或含不允许的可执行对象")
                if [row[0] for row in conn.execute("PRAGMA quick_check")] != ["ok"]:
                    raise BackupError("备份数据库完整性检查失败")
                rows = _read_rows(conn)
                sources, rules = _validate_rows(rows, configs)
                from .workspace import validate_all_records
                validate_all_records(conn)
                return rows, sources, rules
            finally:
                conn.close()
        except (sqlite3.Error, OSError) as exc:
            raise BackupError("备份数据库损坏、不可读或超出校验时间") from exc

    def _read_archive(self, backup_id):
        path = self.path(backup_id)
        try:
            archive_bytes = self.read(backup_id)
            _check_zip_layout(archive_bytes)
            import io
            with zipfile.ZipFile(io.BytesIO(archive_bytes)) as archive:
                entries = archive.infolist()
                names = [entry.filename for entry in entries]
                if len(entries) > 4101 or len(set(names)) != len(names) or not set(FILES) | {"manifest.json"} <= set(names):
                    raise BackupError("备份包文件列表不符")
                if sum(entry.file_size for entry in entries) > MAX_ARCHIVE_BYTES:
                    raise BackupError("备份解压后总大小超限")
                asset_entries = [entry for entry in entries if entry.filename not in (*FILES, VISUAL_CONFIG, "manifest.json")]
                if sum(entry.file_size for entry in asset_entries) > 128 * 1024 * 1024:
                    raise BackupError("备份图片与附件解压后总大小超限")
                payload = {}
                from .portable import asset_limit
                for entry in entries:
                    if entry.filename == "manifest.json":
                        limit = MAX_MANIFEST_BYTES
                    elif entry.filename == FILES[0]:
                        limit = MAX_DATABASE_BYTES
                    elif entry.filename in (*FILES[1:], VISUAL_CONFIG):
                        limit = MAX_CONFIG_BYTES
                    else:
                        limit = asset_limit(entry.filename)
                    if entry.orig_filename != entry.filename or entry.flag_bits & 1 or entry.is_dir() or entry.compress_type not in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED) or entry.file_size > limit or entry.file_size > max(1, entry.compress_size) * 200:
                        raise BackupError("备份压缩项无效、超限或压缩率异常")
                    if (entry.external_attr >> 16) & 0o170000 == 0o120000:
                        raise BackupError("备份包不能含符号链接")
                    with archive.open(entry) as stream:
                        value = stream.read(limit + 1)
                    if len(value) != entry.file_size or len(value) > limit:
                        raise BackupError("备份压缩项长度不符")
                    payload[entry.filename] = value
            manifest = _json(payload.pop("manifest.json"), dict)
            base_fields = {"format", "format_version", "schema_version", "id", "created_at", "reason", "files", "counts"}
            version = manifest.get("format_version")
            if (version not in (FORMAT_VERSION, PORTABLE_FORMAT_VERSION) or type(version) is not int or
                    set(manifest) != base_fields | ({"portable"} if version == PORTABLE_FORMAT_VERSION else set()) or
                    manifest["format"] != FORMAT or type(manifest["schema_version"]) is not int or manifest["schema_version"] != SCHEMA_VERSION):
                raise BackupError("备份格式或版本不兼容")
            if (manifest["id"] != backup_id or manifest["reason"] not in ("manual", "pre_restore") or
                    not isinstance(manifest["files"], dict) or set(manifest["files"]) != set(payload) or
                    (version == FORMAT_VERSION and set(payload) != set(FILES))):
                raise BackupError("备份清单无效")
            try:
                created = datetime.fromisoformat(manifest["created_at"])
                if created.tzinfo is None:
                    raise ValueError("missing timezone")
            except (TypeError, ValueError) as exc:
                raise BackupError("备份时间无效") from exc
            for name in payload:
                info = manifest["files"][name]
                if not isinstance(info, dict) or type(info.get("size")) is not int or info != {"sha256": _digest(payload[name]), "size": len(payload[name])}:
                    raise BackupError("备份文件哈希或长度校验失败")
            configs = {name: payload[name] for name in FILES[1:]}
            if version == PORTABLE_FORMAT_VERSION:
                configs[VISUAL_CONFIG] = payload.get(VISUAL_CONFIG)
            with self._workspace(".validate-") as work:
                database = work / "database.sqlite3"
                database.write_bytes(payload[FILES[0]])
                rows, sources, rules = self._validate_database(database, configs)
            counts = _counts(rows, sources)
            if not isinstance(manifest["counts"], dict) or any(type(value) is not int for value in manifest["counts"].values()) or manifest["counts"] != counts:
                raise BackupError("备份清单记录数不符")
            assets = {name:value for name,value in payload.items() if name not in (*FILES, VISUAL_CONFIG)}
            if version == PORTABLE_FORMAT_VERSION:
                from .portable import validate_assets
                expected = validate_assets(assets, configs[VISUAL_CONFIG], rows)
                if manifest["portable"] != expected or any(type(manifest["portable"].get(name)) is not type(value) for name,value in expected.items()):
                    raise BackupError("便携备份范围、数量或总大小与清单不符")
            return {"manifest": manifest, "rows": rows, "configs": configs, "assets": assets, "sources": sources, "rules": rules, "fingerprint": _digest(archive_bytes)}
        except BackupError:
            raise
        except (OSError, zipfile.BadZipFile, RuntimeError, ValueError, TypeError, KeyError, RecursionError) as exc:
            raise BackupError("备份文件不存在、损坏或格式无效") from exc

    def _write_archive(self, database_bytes, configs, rows, reason):
        if len(database_bytes) > MAX_DATABASE_BYTES:
            raise BackupError("备份数据库超出限制")
        sources, _ = _validate_configs(configs)
        backup_id = "backup-" + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "-" + uuid.uuid4().hex
        payload = {FILES[0]: database_bytes, **{name:value for name,value in configs.items() if value is not None}}
        portable = None
        if VISUAL_CONFIG in configs:
            from .portable import collect_assets
            assets, portable = collect_assets(self.root, self.store.db_path, rows, configs[VISUAL_CONFIG])
            payload.update(assets)
        manifest = {"format": FORMAT, "format_version": PORTABLE_FORMAT_VERSION if portable is not None else FORMAT_VERSION, "schema_version": SCHEMA_VERSION, "id": backup_id, "created_at": utcnow(), "reason": reason, "files": {name: {"sha256": _digest(value), "size": len(value)} for name, value in payload.items()}, "counts": _counts(rows, sources)}
        if portable is not None:
            manifest["portable"] = portable
        path = self.path(backup_id)
        pending = self.directory / (".pending-" + uuid.uuid4().hex)
        try:
            with pending.open("xb") as stream:
                with zipfile.ZipFile(stream, "w", compression=zipfile.ZIP_STORED) as archive:
                    for name, value in payload.items():
                        archive.writestr(name, value)
                    archive.writestr("manifest.json", json_text(manifest).encode("utf-8"))
                stream.flush()
                os.fsync(stream.fileno())
            os.replace(pending, path)
        finally:
            pending.unlink(missing_ok=True)
        return {**manifest, "size_bytes": path.stat().st_size}

    def list(self):
        with self._lock:
            result = []
            for path in self.directory.glob("backup-*.zip"):
                backup_id = path.name[:-4]
                if not ID_PATTERN.fullmatch(backup_id):
                    continue
                try:
                    backup = self._read_archive(backup_id)
                    result.append({**backup["manifest"], "size_bytes": path.stat().st_size, "valid": True})
                except BackupError as exc:
                    result.append({"id": backup_id, "valid": False, "error": str(exc)})
            return sorted(result, key=lambda value: value["id"], reverse=True)

    def create(self):
        # SQLite's online backup gives a consistent snapshot even while another
        # process collects data; in-process preferences/configuration are held.
        with self._lock, self._config_guard(), self._mutation_lock:
            configs = _with_visual_config(self.root, self._configs())
            with self._workspace(".create-") as work:
                database = work / "database.sqlite3"
                with self.store.connection() as source:
                    if source.execute("PRAGMA page_count").fetchone()[0] * source.execute("PRAGMA page_size").fetchone()[0] > MAX_DATABASE_BYTES:
                        raise BackupError("当前数据库超出备份大小限制")
                    with closing(sqlite3.connect(database)) as target:
                        source.backup(target, pages=128, sleep=0.005)
                rows, _, _ = self._validate_database(database, configs)
                if configs[VISUAL_CONFIG] is None:
                    from .portable import attachment_records
                    if not attachment_records(rows):
                        # A project without local assets still emits the exact
                        # legacy core format, preserving older clients/tests.
                        configs.pop(VISUAL_CONFIG)
                return self._write_archive(database.read_bytes(), configs, rows, "manual")

    def import_archive(self, content):
        """Store one verified portable/legacy ZIP, without restoring anything.

        IDs come from the validated inner manifest. Retrying the same file is
        idempotent; another file claiming an existing ID is rejected.
        """
        if not isinstance(content, bytes) or not 0 < len(content) <= MAX_IMPORT_BYTES:
            raise BackupError("网页导入备份不能为空，最多64MB；更大备份可手动拷入data/backups后校验")
        import io
        try:
            _check_zip_layout(content)
            with zipfile.ZipFile(io.BytesIO(content)) as archive:
                matches = [entry for entry in archive.infolist() if entry.filename == "manifest.json"]
                if len(matches) != 1 or matches[0].file_size > MAX_MANIFEST_BYTES:
                    raise BackupError("备份缺少唯一的有效清单")
                entry = matches[0]
                if entry.flag_bits & 1 or entry.compress_type not in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED) or entry.file_size > max(1, entry.compress_size) * 200:
                    raise BackupError("备份清单压缩项无效")
                with archive.open(entry) as stream:
                    manifest_bytes = stream.read(MAX_MANIFEST_BYTES + 1)
                if len(manifest_bytes) != entry.file_size:
                    raise BackupError("备份清单长度不符")
                manifest = _json(manifest_bytes, dict)
                backup_id = manifest.get("id")
                path = self.path(backup_id)
            with self._lock, self._config_guard(), self._mutation_lock:
                existed = path.exists()
                if existed:
                    if self.read(backup_id) != content:
                        raise BackupError("本机已有同ID不同内容的备份，拒绝覆盖")
                else:
                    # Do not trust/extract any filename from the ZIP. Only its
                    # validated backup basename is written, as opaque bytes.
                    with path.open("xb") as target:
                        target.write(content)
                        target.flush()
                        os.fsync(target.fileno())
                try:
                    checked = self._read_archive(backup_id)
                except BaseException:
                    if not existed:
                        path.unlink(missing_ok=True)
                    raise
                return {**checked["manifest"], "size_bytes":len(content), "valid":True, "imported":not existed, "restored":False}
        except BackupError:
            raise
        except (OSError, ValueError, TypeError, KeyError, zipfile.BadZipFile, RuntimeError, RecursionError) as exc:
            raise BackupError("备份导入失败，未恢复或覆盖当前资料") from exc

    def preview(self, backup_id):
        with self._lock, self._restore_guard():
            backup = self._read_archive(backup_id)
            configs = self._configs()
            if VISUAL_CONFIG in backup["configs"]:
                configs = _with_visual_config(self.root, configs)
            with self.store.connection() as conn:
                conn.execute("BEGIN")
                rows = _read_rows(conn)
            sources, _ = _validate_configs(configs)
            current_counts = _counts(rows, sources)
            fingerprint = _fingerprint(rows, configs)
            token = secrets.token_urlsafe(32)
            now = time.monotonic()
            self._tokens = {key: value for key, value in self._tokens.items() if value["expires"] > now}
            # Bound preview memory even if a client keeps requesting tokens.
            if len(self._tokens) >= 100:
                self._tokens.pop(next(iter(self._tokens)))
            self._tokens[token] = {"id": backup_id, "backup": backup["fingerprint"], "current": fingerprint, "expires": now + CONFIRM_SECONDS}
            before = {row["id"]: row for row in rows["opportunities"]}
            after = {row["id"]: row for row in backup["rows"]["opportunities"]}
            impact = {"opportunities_removed": len(before.keys() - after.keys()), "opportunities_added": len(after.keys() - before.keys()), "opportunities_changed": sum(before[key] != after[key] for key in before.keys() & after.keys()), "starred_before": current_counts["starred"], "starred_after": backup["manifest"]["counts"]["starred"], "notes_before": current_counts["notes"], "notes_after": backup["manifest"]["counts"]["notes"], "config_changed": configs != backup["configs"], "overwrites_current_data": True}
            portable = backup["manifest"].get("portable")
            impact["visual_catalog_changed"] = VISUAL_CONFIG in configs and configs.get(VISUAL_CONFIG) != backup["configs"].get(VISUAL_CONFIG)
            impact["media_scope"] = "portable" if portable else "legacy_core_only"
            impact['workspace'] = _workspace_impact(rows, backup['rows'])
            return {"id": backup_id, "created_at": backup["manifest"]["created_at"], "counts": backup["manifest"]["counts"], "current_counts": current_counts, "impact": impact, "portable": portable, "compatibility_note": "含实际图片、附件和标识清单；未引用文件不会删除。" if portable else "旧版核心备份：不含图片、附件文件或标识清单；只恢复数据库与来源规则配置。", "confirm_token": token, "current_fingerprint": fingerprint, "backup_fingerprint": backup["fingerprint"], "expires_at": (datetime.now(timezone.utc) + timedelta(seconds=CONFIRM_SECONDS)).isoformat(timespec="seconds")}

    def _pre_restore_snapshot(self, rows, configs):
        # Using online backup on the same BEGIN IMMEDIATE connection can wait
        # forever. Clone its exact row snapshot into the trusted schema instead.
        with self._workspace(".before-") as work:
            database = work / "database.sqlite3"
            with closing(sqlite3.connect(database)) as conn:
                with conn:
                    _create_schema(conn)
                    self._insert_rows(conn, rows)
            snapshot_configs = configs if VISUAL_CONFIG in configs else _with_visual_config(self.root, configs)
            if VISUAL_CONFIG not in configs and snapshot_configs[VISUAL_CONFIG] is None:
                from .portable import attachment_records
                if not attachment_records(rows):
                    snapshot_configs.pop(VISUAL_CONFIG)
            return self._write_archive(database.read_bytes(), snapshot_configs, rows, "pre_restore")

    @staticmethod
    def _insert_rows(conn, rows):
        for table in TABLES:
            names = [column[1] for column in COLUMNS[table]]
            conn.executemany(f"INSERT INTO {table}({','.join(names)}) VALUES({','.join('?' for _ in names)})", (tuple(row[name] for name in names) for row in rows[table]))

    def _replace_config(self, name, value):
        _write_config(self.root, name, value)

    def restore(self, backup_id, confirm_token):
        with self._lock, self._restore_guard():
            self.path(backup_id)
            confirmation = self._tokens.get(confirm_token) if isinstance(confirm_token, str) else None
            if not confirmation or confirmation["id"] != backup_id or confirmation["expires"] <= time.monotonic():
                raise BackupError("请先预览并明确确认；确认令牌无效或已过期")
            backup = self._read_archive(backup_id)
            if backup["fingerprint"] != confirmation["backup"]:
                self._tokens.pop(confirm_token, None)
                raise BackupError("预览后备份内容已改变，请重新预览")
            configs = self._configs()
            if VISUAL_CONFIG in backup["configs"]:
                configs = _with_visual_config(self.root, configs)
            before = None
            journal = None
            restored = False
            try:
                with self.store.connection() as conn:
                    conn.execute("BEGIN IMMEDIATE")
                    if _schema_rows(conn) != EXPECTED_SCHEMA or conn.execute("PRAGMA user_version").fetchone()[0] != SCHEMA_VERSION:
                        raise BackupError("当前数据库结构不兼容，未执行恢复")
                    configs = self._configs()
                    if VISUAL_CONFIG in backup["configs"]:
                        configs = _with_visual_config(self.root, configs)
                    rows = _read_rows(conn)
                    if _fingerprint(rows, configs) != confirmation["current"]:
                        self._tokens.pop(confirm_token, None)
                        raise BackupError("预览后当前数据或配置已改变，请重新预览")
                    before = self._pre_restore_snapshot(rows, configs)
                    checked_configs = self._configs()
                    if VISUAL_CONFIG in configs:
                        checked_configs = _with_visual_config(self.root, checked_configs)
                    if checked_configs != configs:
                        self._tokens.pop(confirm_token, None)
                        raise BackupError("确认后当前配置被外部修改，请重新预览；数据库未恢复")
                    self._tokens.pop(confirm_token, None)
                    if backup["assets"]:
                        from .portable import install_assets
                        install_assets(self.root, self.store.db_path, backup["assets"])
                    journal = {"format": JOURNAL_FORMAT, "version": 1, "restore_id": uuid.uuid4().hex, "database_marker": _database_marker(self.store.db_path), "backup_id": backup_id, "pre_restore_backup": before["id"], "phase": "prepared", "before": _pack_configs(configs), "after": _pack_configs(backup["configs"])}
                    _write_journal(self.root, journal)
                    for table in reversed(TABLES):
                        conn.execute(f"DELETE FROM {table}")
                    self._insert_rows(conn, backup["rows"])
                    conn.execute("INSERT INTO settings(key,value) VALUES(?,?)", (RESTORE_RECEIPT_KEY, _receipt(journal)))
                    for name in backup["configs"]:
                        self._replace_config(name, backup["configs"][name])
                    checked_configs = self._configs()
                    if VISUAL_CONFIG in backup["configs"]:
                        checked_configs = _with_visual_config(self.root, checked_configs)
                    if checked_configs != backup["configs"]:
                        raise BackupError("恢复写入期间配置被外部修改，未提交数据库；持久日志已保留")
                    # Commit happens on leaving Store.connection, while locks
                    # still prevent preference writes and new collection runs.
                restored = True
                _recover_pending_locked(self.root, self.store.db_path, update_locked=True)
            except Exception as exc:
                if journal is not None:
                    try:
                        recovered = _recover_pending_locked(self.root, self.store.db_path, update_locked=True)
                        restored = restored or bool(recovered and recovered["committed"])
                    except Exception as recovery_exc:
                        error = BackupError(("数据库恢复已提交，" if restored else "数据库未完成恢复，") + "配置或日志收尾未完成；启动会按持久日志处理，恢复前快照 " + before["id"] + "；" + str(recovery_exc))
                        error.restore_committed = restored
                        raise error from exc
                if not restored:
                    if isinstance(exc, BackupError):
                        raise
                    raise BackupError("恢复失败，原数据库及配置已保留") from exc
            self.store.source_config = copy.deepcopy(backup["sources"])
            self.store.rules = copy.deepcopy(backup["rules"])
            self.store._configuration_fingerprint = configuration_fingerprint(backup["configs"])
            self._tokens.clear()
            return {"restored": True, "id": backup_id, "counts": backup["manifest"]["counts"], "pre_restore_backup": before["id"], "pre_restore": before, "config_restored": True, "portable": backup["manifest"].get("portable"), "media_note": "校验后的图片与附件已补入；未引用文件不会删除。" if backup["manifest"].get("portable") else "旧核心备份未恢复图片或附件文件，当前标识清单保留。"}
