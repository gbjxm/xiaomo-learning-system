"""Small transactional write metadata kept in the existing v3 settings table.

There is no startup backfill or schema change. Older backups start preferences
at revision zero; new backups naturally include revisions and durable receipts.
"""
from __future__ import annotations

import copy
import hashlib
import json
import re

from .model import json_text, utcnow
from .workspace import identifier

PREFERENCE_PREFIX = "write:preference:"
RECEIPT_PREFIX = "write:receipt:"


class WriteConflict(ValueError):
    def __init__(self, message, **details):
        super().__init__(message)
        self.details = details


def submission_id(value):
    if not isinstance(value, str) or not re.fullmatch(r"[a-f0-9]{32}", value):
        raise WriteConflict("页面写入协议已更新；请重新加载页面后核对并保存，草稿保留。", code="refresh_required")
    return value


def revision(value):
    if type(value) is not int or not 0 <= value < 2**53 - 1:
        raise WriteConflict("缺少有效资料版本；请重新加载页面后核对并保存，草稿保留。", code="refresh_required")
    return value


def preference_revision(conn, item_id):
    row = conn.execute("SELECT value FROM settings WHERE key=?", (PREFERENCE_PREFIX + identifier(item_id),)).fetchone()
    if row is None:
        return 0
    try:
        value = json.loads(row[0])
        if not isinstance(value, dict) or set(value) != {"revision"}:
            raise ValueError()
        return revision(value["revision"])
    except (ValueError, TypeError) as error:
        raise ValueError("个人资料版本元数据无效；暂停写入，请核对备份。") from error


def preference_state(conn, item_id):
    row = conn.execute("SELECT starred,note FROM opportunities WHERE id=?", (item_id,)).fetchone()
    if row is None:
        raise ValueError("条目不存在")
    return {"id": item_id, "starred": bool(row[0]), "note": row[1],
            "preference_revision": preference_revision(conn, item_id)}


def set_preference_revision(conn, item_id, value):
    conn.execute("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                 (PREFERENCE_PREFIX + identifier(item_id), json_text({"revision": revision(value)})))


def binding(kind, payload):
    return hashlib.sha256(json_text({"kind": kind, "payload": payload}).encode("utf-8")).hexdigest()


def receipt(conn, operation, kind, request_binding):
    operation = submission_id(operation)
    row = conn.execute("SELECT value FROM settings WHERE key=?", (RECEIPT_PREFIX + operation,)).fetchone()
    if row is None:
        return None
    try:
        value = json.loads(row[0])
        if (not isinstance(value, dict) or set(value) != {"kind", "binding", "target", "at", "result"}
                or value["kind"] not in ("preference", "work_create")
                or not isinstance(value["binding"], str) or not re.fullmatch(r"[a-f0-9]{64}", value["binding"])
                or not isinstance(value["at"], str) or not isinstance(value["result"], dict)
                or len(row[0].encode("utf-8")) > 100000):
            raise ValueError()
        identifier(value["target"])
        result = value["result"]
        if result.get("saved") is not True:
            raise ValueError()
        if value["kind"] == "preference":
            preference = result.get("preference")
            if (set(result) != {"saved", "preference"} or not isinstance(preference, dict)
                    or set(preference) != {"id", "starred", "note", "preference_revision"}
                    or preference["id"] != value["target"] or type(preference["starred"]) is not bool
                    or not isinstance(preference["note"], str) or len(preference["note"]) > 5000):
                raise ValueError()
            revision(preference["preference_revision"])
        else:
            from .workspace import validate_workspace_record
            if set(result) != {"saved", "record"}:
                raise ValueError()
            record = validate_workspace_record("works", result["record"])
            if record["id"] != value["target"]:
                raise ValueError()
    except (ValueError, TypeError) as error:
        raise ValueError("提交回执无效；暂停写入，请核对备份。") from error
    if value["kind"] != kind or value["binding"] != request_binding:
        raise WriteConflict("提交标识已绑定另一份内容；操作未执行，请重新读取并核对。", code="submission_conflict")
    return copy.deepcopy(value)


def save_receipt(conn, operation, kind, request_binding, target, result):
    value = {"kind": kind, "binding": request_binding, "target": identifier(target), "at": utcnow(), "result": result}
    conn.execute("INSERT INTO settings(key,value) VALUES(?,?)", (RECEIPT_PREFIX + submission_id(operation), json_text(value)))
