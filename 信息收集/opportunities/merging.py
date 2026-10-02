"""Conservative, reversible cross-source grouping. Originals are never deleted.

Preview tokens are deliberately process-local. Completed writes have durable receipts,
so a lost HTTP response can be checked without applying the operation twice.
"""
from __future__ import annotations

import copy
import difflib
import hashlib
import json
import re
import secrets
import threading
import time
from datetime import datetime, timedelta, timezone

from .model import canonical_url, field_changes, json_text, normalize, utcnow
from .workspace import get_record, public_url, put_record, records, write_document

VERSION = 1
PREVIEW_SECONDS = 600
MAX_PREVIEWS = 200
MAX_COMPARE_ITEMS = 1000
ID = re.compile(r"[0-9a-f]{24}\Z")
OPERATION = re.compile(r"[0-9a-f]{32}\Z")
PROTECTED = {"id", "source_id", "official_url", "edition", "kind", "origin", "verification", "verified_at", "public_review", "evidence", "source_attachments"}
FIELDS = {"title", "platform", "organizer", "entry_url", "summary", "tags", "publication_at", "time", "rewards", "eligibility", "work_requirements", "steps", "risks", "program", "assessment", "importance", "fit_rules", "canvas_requirements", "cash_tiers", "fees", "relations", "entry_status", "contact_email", "reward_conflict", "record_context"}
CRITICAL = {"time", "rewards", "eligibility", "work_requirements", "steps", "risks", "program", "fit_rules", "canvas_requirements", "cash_tiers", "fees", "relations", "entry_status", "reward_conflict", "record_context"}
UNKNOWN_EDITION = {"未知", "轮次未知", "届次未核", "待核", "unspecified", "unknown", ""}


def _id(value, label="条目"):
    if not isinstance(value, str) or not ID.fullmatch(value):
        raise ValueError(f"{label} ID 无效")
    return value


def _operation(value):
    if not isinstance(value, str) or not OPERATION.fullmatch(value):
        raise ValueError("操作标识无效")
    return value


def _edition(doc):
    return re.sub(r"[\s，,。·/\\：:（）()_-]+", "", doc.get("edition", "")).lower()


def _years(doc):
    return set(re.findall(r"(?<!\d)(?:19|20)\d{2}(?!\d)", doc.get("edition", "") + " " + doc.get("title", "")))


def _title(doc):
    return re.sub(r"[\W_]+", "", doc.get("title", "")).lower()


def _rounds(doc):
    text = doc.get("edition", "") + " " + doc.get("title", "")
    # Keep Arabic/Chinese phase numbers distinct rather than guessing equivalence.
    return set(re.findall(r"第[一二三四五六七八九十百\d]+(?:届|轮|期|季)|(?:春季|夏季|秋季|冬季|上半年|下半年)", text))


def _blockers(target, source):
    result = []
    if target["id"] == source["id"]:
        result.append("不能归并同一条记录")
    if target["kind"] != source["kind"]:
        result.append("信息类型不同，比赛、父计划和限时子活动应分别保留")
    editions = [_edition(target), _edition(source)]
    if any(value in UNKNOWN_EDITION or "未核" in value or "未知" in value for value in editions):
        result.append("年度或轮次尚未核实；请先核实两条记录的届次")
    elif editions[0] != editions[1]:
        result.append("届次不一致；不同年度或轮次不能归并，请先核对并更正届次")
    years = [_years(target), _years(source)]
    if years[0] and years[1] and years[0] != years[1]:
        result.append("名称或届次中的年度不同，须独立保留")
    rounds = [_rounds(target), _rounds(source)]
    if any(rounds) and rounds[0] != rounds[1]:
        result.append("名称中的届次、期次或季节不同，须独立保留")
    for doc, other in ((target, source), (source, target)):
        if any(value.get("target_id") == other["id"] for value in doc.get("relations", [])):
            result.append("两条存在父子或历史届次关系，不能归并")
            break
    return result


def _fields(target, source):
    result = []
    for key in sorted(FIELDS):
        left, right = target.get(key), source.get(key)
        if isinstance(left, dict) and isinstance(right, dict) and key in ("time", "program"):
            for name in sorted(set(left) | set(right)):
                if left.get(name) != right.get(name):
                    result.append({"field": key + "." + name, "target": copy.deepcopy(left.get(name)), "source": copy.deepcopy(right.get(name)), "critical": key in CRITICAL})
        elif left != right:
            result.append({"field": key, "target": copy.deepcopy(left), "source": copy.deepcopy(right), "critical": key in CRITICAL})
    return result


def _set(doc, path, value):
    if "." in path:
        prefix, key = path.split(".", 1)
        if value is None and prefix == "time" and key in {"month_period", "source_window", "deadline_tentative"}:
            doc.setdefault(prefix, {}).pop(key, None)
        else:
            doc.setdefault(prefix, {})[key] = copy.deepcopy(value)
    elif value is None and path in {"assessment", "importance", "fit_rules", "canvas_requirements", "cash_tiers", "fees", "relations", "entry_status", "contact_email", "reward_conflict", "record_context"}:
        doc.pop(path, None)
    else:
        doc[path] = copy.deepcopy(value)


def _union(left, right):
    result, seen = [], set()
    for value in [*left, *right]:
        key = json_text(value)
        if key not in seen:
            seen.add(key)
            result.append(copy.deepcopy(value))
    return result


def _digest(value):
    return hashlib.sha256(json_text(value).encode("utf-8")).hexdigest()


def _safe_document(document):
    doc = normalize(document)
    for value in (doc["official_url"], doc.get("entry_url")):
        if value:
            public_url(value)
    for evidence in doc.get("evidence", []):
        if evidence.get("url"):
            public_url(evidence["url"])
        for key in ("external_rules", "image_refs"):
            for value in evidence.get(key, []):
                public_url(value)
    for attachment in doc.get("source_attachments", []):
        public_url(attachment["url"])
    return doc


def _write_version(conn, document, reason):
    result = write_document(conn, document, reason)
    if result["status"] == "unchanged":
        # Even an association with identical fields is an auditable new version.
        version, now = result["version"] + 1, utcnow()
        conn.execute("UPDATE opportunities SET version=?,changed_at=? WHERE id=?", (version, now, result["id"]))
        conn.execute("INSERT INTO versions VALUES(?,?,?,?,?,?)", (result["id"], version, now, reason, json_text(document), "[]"))
        result = {**result, "status": "changed", "version": version}
    return result


def validate_record(kind, data):
    """Called by workspace/backup validation; no code or paths can be imported."""
    if not isinstance(data, dict) or data.get("version") != VERSION:
        raise ValueError("归并资料版本无效")
    if kind == "merge_ops":
        if set(data) != {"version", "action", "request_hash", "result"} or data["action"] not in ("merge", "undo"):
            raise ValueError("归并回执格式无效")
        if not isinstance(data["request_hash"], str) or not re.fullmatch(r"[0-9a-f]{64}", data["request_hash"]):
            raise ValueError("归并回执校验值无效")
        result = data["result"]
        if not isinstance(result, dict) or set(result) != {"completed", "action", "group_id", "target_id", "source_id", "target_version", "operation_id"}:
            raise ValueError("归并结果格式无效")
        if result["completed"] is not True or result["action"] != data["action"]:
            raise ValueError("归并回执状态无效")
        for field in ("group_id", "target_id", "source_id"):
            _id(result[field], field)
        _operation(result["operation_id"])
        if type(result["target_version"]) is not int or result["target_version"] < 1:
            raise ValueError("归并回执条目版本无效")
        return copy.deepcopy(data)
    if kind != "merges":
        raise ValueError("未知归并资料类型")
    required = {"version", "target_id", "source_id", "status", "merged_at", "merged_version", "source_version", "target_before", "target_after", "choices", "critical_pending", "operation_id"}
    if not required <= set(data) or set(data) - required - {"undone_at", "undone_version", "undo_operation_id"}:
        raise ValueError("归并资料字段无效")
    if data["status"] not in ("active", "undone"):
        raise ValueError("归并状态无效")
    _id(data["target_id"])
    _id(data["source_id"])
    if data["target_id"] == data["source_id"]:
        raise ValueError("归并目标和原记录不能相同")
    _operation(data["operation_id"])
    for name in ("merged_version", "source_version"):
        if type(data[name]) is not int or data[name] < 1:
            raise ValueError("归并条目版本无效")
    for name in ("merged_at", "undone_at"):
        if name in data:
            try:
                moment = datetime.fromisoformat(data[name].replace("Z", "+00:00"))
                if moment.tzinfo is None:
                    raise ValueError()
            except (TypeError, ValueError, AttributeError) as error:
                raise ValueError("归并时间无效") from error
    for name in ("target_before", "target_after"):
        if _safe_document(data[name]) != data[name] or data[name]["id"] != data["target_id"]:
            raise ValueError("归并快照身份或内容无效")
    if not isinstance(data["choices"], dict) or any(not isinstance(key, str) or key.split(".")[0] not in FIELDS or value not in ("target", "source") for key, value in data["choices"].items()):
        raise ValueError("归并字段选择无效")
    if not isinstance(data["critical_pending"], list) or any(not isinstance(value, str) or value.split(".")[0] not in CRITICAL for value in data["critical_pending"]):
        raise ValueError("归并待复核字段无效")
    if data["status"] == "undone":
        if not {"undone_at", "undone_version", "undo_operation_id"} <= set(data):
            raise ValueError("撤销归并缺少回执")
        if type(data["undone_version"]) is not int or data["undone_version"] < data["merged_version"]:
            raise ValueError("撤销归并版本无效")
        _operation(data["undo_operation_id"])
    return copy.deepcopy(data)


class MergeService:
    def __init__(self, store):
        self.store = store
        self._previews = {}
        self._lock = threading.RLock()

    def _rows(self, conn, target_id, source_id):
        rows = []
        for item_id in (_id(target_id), _id(source_id)):
            row = conn.execute("SELECT id,document,version,starred,note FROM opportunities WHERE id=?", (item_id,)).fetchone()
            if row is None:
                raise ValueError("归并记录已不存在")
            rows.append({**dict(row), "document": json.loads(row["document"])})
        return rows

    def _active(self, conn=None):
        return [record for record in records(conn if conn is not None else self.store, "merges") if record["data"]["status"] == "active"]

    def _membership_blocker(self, target_id, source_id, conn=None):
        for group in self._active(conn):
            data = group["data"]
            if target_id in (data["target_id"], data["source_id"]) or source_id in (data["target_id"], data["source_id"]):
                return "至少一条已有关联合并；请先查看或撤销已有归并，避免隐式多层归并"
        return None

    def compare(self, target_id, source_id):
        with self.store.connection() as conn:
            target, source = self._rows(conn, target_id, source_id)
            blockers = _blockers(target["document"], source["document"])
            active = self._membership_blocker(target_id, source_id, conn)
            if active:
                blockers.append(active)
        return {"target": target, "source": source, "fields": _fields(target["document"], source["document"]), "blockers": blockers, "preservation": "两条原记录及各自来源、关注、笔记、附件、证据和旧版始终保留；归并只生成目标新版本和关联组，不表示规则已核实。"}

    def suspects(self):
        with self.store.connection() as conn:
            total = conn.execute("SELECT COUNT(*) FROM opportunities").fetchone()[0]
            rows = [{**dict(row), "document": json.loads(row["document"])} for row in conn.execute("SELECT id,document,version FROM opportunities ORDER BY changed_at DESC,id LIMIT ?", (MAX_COMPARE_ITEMS,))]
            active = self._active(conn)
        members = {item_id for group in active for item_id in (group["data"]["target_id"], group["data"]["source_id"])}
        pairs = []
        for index, left in enumerate(rows):
            if left["id"] in members:
                continue
            for right in rows[index + 1:]:
                if right["id"] in members:
                    continue
                a, b = left["document"], right["document"]
                if a["source_id"] == b["source_id"] or _blockers(a, b):
                    continue
                same_url = canonical_url(a["official_url"]) == canonical_url(b["official_url"])
                names = [_title(a), _title(b)]
                similarity = difflib.SequenceMatcher(None, *names, autojunk=False).ratio()
                if not same_url and (min(map(len, names)) < 6 or similarity < 0.70):
                    continue
                pairs.append({"target_id": left["id"], "source_id": right["id"], "target_title": a["title"], "source_title": b["title"], "edition": a["edition"], "reason": "官方原文地址相同，来源登记不同" if same_url else "名称相近且届次一致，仍需逐项人工确认"})
        return {"pairs": pairs[:100], "limited": len(pairs) > 100 or total > MAX_COMPARE_ITEMS, "scanned_items": len(rows), "total_items": total, "groups": self.groups(), "note": "相近名称仅作为线索；不会自动合并。不同年度、轮次、父子活动及未核届次不列为可合并。" + (f"当前比较最近更新的 {len(rows)} / {total} 条记录，最多显示 100 对；其他记录仍可手动选择比较。" if total > MAX_COMPARE_ITEMS or len(pairs) > 100 else "")}

    def groups(self):
        with self.store.connection() as conn:
            groups = records(conn, "merges")
            result = []
            for record in groups:
                data = record["data"]
                members = self._rows(conn, data["target_id"], data["source_id"])
                result.append({"id": record["id"], "revision": record["revision"], **copy.deepcopy(data), "members": members})
        return sorted(result, key=lambda group: (group["merged_at"], group["id"]), reverse=True)

    def collapsed_item_ids(self):
        return [record["data"]["source_id"] for record in self._active()]

    def _remember(self, value):
        with self._lock:
            current = time.monotonic()
            self._previews = {key: item for key, item in self._previews.items() if item["until"] > current}
            if len(self._previews) >= MAX_PREVIEWS:
                raise ValueError("预览过多，请关闭不用的预览后稍后重试")
            token = secrets.token_urlsafe(32)
            self._previews[token] = {**value, "until": current + PREVIEW_SECONDS}
        return token

    def _take(self, token, action):
        if not isinstance(token, str) or len(token) > 100:
            raise ValueError("预览令牌无效")
        with self._lock:
            value = self._previews.get(token)
            if not value or value["until"] <= time.monotonic() or value["action"] != action:
                raise ValueError("预览已失效，请重新比较并预览")
            return copy.deepcopy(value)

    def cancel(self, token):
        with self._lock:
            self._previews.pop(token, None)
        return {"cancelled": True}

    def preview(self, target_id, source_id, choices):
        compared = self.compare(target_id, source_id)
        if compared["blockers"]:
            raise ValueError("；".join(compared["blockers"]))
        fields = {field["field"]: field for field in compared["fields"]}
        if not isinstance(choices, dict) or set(choices) != set(fields) or any(value not in ("target", "source") for value in choices.values()):
            raise ValueError("请对每个差异字段明确选择保留目标或采用来源；不能省略冲突或添加未知字段")
        target, source = compared["target"], compared["source"]
        doc = copy.deepcopy(target["document"])
        pending = []
        for path, choice in choices.items():
            if choice == "source":
                _set(doc, path, fields[path]["source"])
                if fields[path]["critical"]:
                    pending.append(path)
        doc["evidence"] = _union(doc.get("evidence", []), source["document"].get("evidence", []))
        if source["document"].get("source_attachments"):
            doc["source_attachments"] = _union(doc.get("source_attachments", []), source["document"]["source_attachments"])
        if pending:
            # A newly assembled rule is not a human-verified effective version.
            doc["verification"] = "partial"
            doc["verified_at"] = None
            if doc.get("public_review"):
                review = doc["public_review"]
                review["remaining"] = _union(review.get("remaining", []), ["跨来源归并后需复核：" + field for field in pending])
                review["fields_verified"] = [field for field in review.get("fields_verified", []) if not any(field == path or field.startswith(path + ".") or path.startswith(field + ".") for path in pending)]
        doc = _safe_document(doc)
        if doc["id"] != target_id:
            raise ValueError("归并不能改变目标身份")
        value = {"action": "merge", "target_id": target_id, "source_id": source_id, "target_version": target["version"], "source_version": source["version"], "target_before": target["document"], "source_before": source["document"], "document": doc, "choices": copy.deepcopy(choices), "critical_pending": pending}
        token = self._remember(value)
        return {"confirm_token": token, "expires_at": (datetime.now(timezone.utc) + timedelta(seconds=PREVIEW_SECONDS)).isoformat(timespec="seconds"), "target_id": target_id, "source_id": source_id, "document": doc, "differences": field_changes(target["document"], doc), "critical_pending": pending, "preservation": compared["preservation"], "write_effect": "目标生成新版本；来源记录默认折叠，仍可查看、搜索和恢复；两条笔记与关注不被拼接或覆盖。"}

    def _receipt(self, conn, operation_id, action, request_hash):
        receipt = get_record(self.store, "merge_ops", operation_id, conn=conn)
        if receipt:
            data = receipt["data"]
            if data["action"] != action or data["request_hash"] != request_hash:
                raise ValueError("同一操作标识不能用于不同的归并请求")
            return copy.deepcopy(data["result"])
        return None

    def status(self, operation_id):
        _operation(operation_id)
        record = get_record(self.store, "merge_ops", operation_id)
        return copy.deepcopy(record["data"]["result"]) if record else {"completed": False, "status": "unknown", "operation_id": operation_id}

    def confirm(self, confirm_token, operation_id, same_entity=False):
        _operation(operation_id)
        if same_entity is not True:
            raise ValueError("请明确确认两条属于同一活动、同一年度和同一轮次")
        request_hash = _digest({"token": confirm_token, "same_entity": True, "action": "merge"})
        with self.store.connection() as conn:
            conn.execute("BEGIN IMMEDIATE")
            prior = self._receipt(conn, operation_id, "merge", request_hash)
            if prior:
                return prior
            value = self._take(confirm_token, "merge")
            target, source = self._rows(conn, value["target_id"], value["source_id"])
            if target["version"] != value["target_version"] or source["version"] != value["source_version"] or target["document"] != value["target_before"] or source["document"] != value["source_before"]:
                raise ValueError("比较后条目版本已变化，请重新预览；当前内容尚未被归并覆盖")
            blocker = self._membership_blocker(value["target_id"], value["source_id"], conn)
            if blocker or _blockers(target["document"], source["document"]):
                raise ValueError(blocker or "两条身份或届次已变化，请重新核对")
            version = _write_version(conn, value["document"], "人工确认跨来源归并；原记录与全部证据保留")["version"]
            group_id = secrets.token_hex(12)
            data = {"version": VERSION, "target_id": value["target_id"], "source_id": value["source_id"], "status": "active", "merged_at": utcnow(), "merged_version": version, "source_version": source["version"], "target_before": value["target_before"], "target_after": value["document"], "choices": value["choices"], "critical_pending": value["critical_pending"], "operation_id": operation_id}
            validate_record("merges", data)
            put_record(conn, "merges", group_id, data, expected_revision=0)
            result = {"completed": True, "action": "merge", "group_id": group_id, "target_id": value["target_id"], "source_id": value["source_id"], "target_version": version, "operation_id": operation_id}
            put_record(conn, "merge_ops", operation_id, {"version": VERSION, "action": "merge", "request_hash": request_hash, "result": result}, expected_revision=0)
        return result

    def undo_preview(self, group_id):
        _id(group_id, "归并组")
        with self.store.connection() as conn:
            group = get_record(self.store, "merges", group_id, conn=conn)
            if not group or group["data"]["status"] != "active":
                raise ValueError("该归并不存在或已经撤销")
            data = group["data"]
            target, source = self._rows(conn, data["target_id"], data["source_id"])
            if target["version"] != data["merged_version"] or target["document"] != data["target_after"]:
                raise ValueError("目标规则在归并后已修改，不能用旧快照覆盖；请先逐字段复核当前版本。原记录仍保留可查。")
            value = {"action": "undo", "group_id": group_id, "group_revision": group["revision"], "group_hash": _digest(data), "target_id": data["target_id"], "source_id": data["source_id"], "target_version": target["version"], "source_version": source["version"], "source_before": source["document"], "current_document": target["document"], "document": data["target_before"]}
        token = self._remember(value)
        return {"confirm_token": token, "expires_at": (datetime.now(timezone.utc) + timedelta(seconds=PREVIEW_SECONDS)).isoformat(timespec="seconds"), "group_id": group_id, "target_id": data["target_id"], "document": copy.deepcopy(data["target_before"]), "differences": field_changes(target["document"], data["target_before"]), "preservation": "撤销会生成目标新版本并恢复两条在列表的独立显示；新旧版本和两条当前笔记、关注、附件均保留。"}

    def undo(self, confirm_token, operation_id, confirmed=False):
        _operation(operation_id)
        if confirmed is not True:
            raise ValueError("请明确确认撤销预览")
        request_hash = _digest({"token": confirm_token, "confirmed": True, "action": "undo"})
        with self.store.connection() as conn:
            conn.execute("BEGIN IMMEDIATE")
            prior = self._receipt(conn, operation_id, "undo", request_hash)
            if prior:
                return prior
            value = self._take(confirm_token, "undo")
            group = get_record(self.store, "merges", value["group_id"], conn=conn)
            if not group or group["revision"] != value["group_revision"] or group["data"]["status"] != "active" or _digest(group["data"]) != value["group_hash"]:
                raise ValueError("归并状态已变化，请重新预览")
            target, source = self._rows(conn, value["target_id"], value["source_id"])
            if target["version"] != value["target_version"] or source["version"] != value["source_version"] or target["document"] != value["current_document"] or source["document"] != value["source_before"]:
                raise ValueError("撤销预览后条目已变化，请重新预览；当前内容未被覆盖")
            version = _write_version(conn, value["document"], "人工确认撤销跨来源归并；恢复旧字段并生成新版本")["version"]
            data = {**group["data"], "status": "undone", "undone_at": utcnow(), "undone_version": version, "undo_operation_id": operation_id}
            validate_record("merges", data)
            put_record(conn, "merges", value["group_id"], data, expected_revision=group["revision"])
            result = {"completed": True, "action": "undo", "group_id": value["group_id"], "target_id": value["target_id"], "source_id": value["source_id"], "target_version": version, "operation_id": operation_id}
            put_record(conn, "merge_ops", operation_id, {"version": VERSION, "action": "undo", "request_hash": request_hash, "result": result}, expected_revision=0)
        return result
