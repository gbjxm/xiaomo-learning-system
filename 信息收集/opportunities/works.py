"""Local work archives and submission preparation; never submits anything.

All writes use the shared workspace optimistic revision records. Official
requirements are immutable snapshots; checklist completion is a personal fact.
"""
from __future__ import annotations

import copy
import hashlib
import json
import uuid

from .fit import evaluate_fit, normalize_profile
from .model import empty_document, json_text, normalize
from .workspace import records, get_record, put_record, delete_record, identifier, public_url, validated_text


STATUSES = {
    "considering": "考虑中", "needs_review": "待核规则 / 资格", "preparing": "准备材料",
    "submitted": "个人标记已投", "withdrawn": "暂不参加",
}
RULE_FIELDS = ("title", "edition", "official_url", "entry_url", "time", "eligibility", "work_requirements", "steps", "rewards", "risks", "fit_rules", "program", "canvas_requirements", "cash_tiers", "fees", "entry_status", "reward_conflict", "record_context", "relations")


def _object(value, allowed, label):
    if not isinstance(value, dict) or set(value) - set(allowed):
        raise ValueError(label + "字段无效")
    return value


def _revision(payload):
    value = payload.get("revision", 0)
    if type(value) is not int or value < 0:
        raise ValueError("记录版本须为非负整数")
    return value


def _text(value, label, limit, allow_empty=True):
    value = validated_text(value, label, limit)
    if not allow_empty and not value:
        raise ValueError(label + "不能为空")
    return value


def _work_data(value):
    value = _object(value, ("name", "profile"), "作品")
    profile = normalize_profile(value.get("profile", {}))
    if profile["duration_seconds"] is not None and profile["duration_seconds"] > 604800:
        raise ValueError("作品时长最多 7 天，请核对秒数")
    return {"name": _text(value.get("name"), "作品名称", 160, False), "profile": profile}


def _opportunity(conn, value):
    value = identifier(value)
    row = conn.execute("SELECT document,version FROM opportunities WHERE id=?", (value,)).fetchone()
    if not row:
        raise ValueError("机会不存在或已经变更，请重新选择")
    return value, json.loads(row["document"]), row["version"]


def _work(conn, value):
    value = identifier(value)
    record = get_record(conn, "works", value)
    if not record:
        raise ValueError("作品不存在，请先保存作品档案")
    return record


def _rule_hash(fields):
    def meaningful(value):
        if isinstance(value, dict):
            return {key: meaningful(item) for key, item in value.items() if key not in ("verified_at", "observed_at", "retrieved_at", "last_seen_at")}
        if isinstance(value, list):
            return [meaningful(item) for item in value]
        return value
    return hashlib.sha256(json_text(meaningful(fields)).encode("utf-8")).hexdigest()


def _rule_snapshot(document, version):
    fields = {field: copy.deepcopy(document.get(field)) for field in RULE_FIELDS}
    digest = _rule_hash(fields)
    return {"version": version, "hash": digest, "fields": fields,
            "verified_at": document.get("verified_at"), "verification": document.get("verification"),
            "notice": "记录当时已保存的规则，仍可能缺字段；不代表报名或账号资格已核实。"}


def _validate_snapshot(value):
    value = _object(value, ("version", "hash", "fields", "verified_at", "verification", "notice"), "规则快照")
    if type(value.get("version")) is not int or value["version"] < 1:
        raise ValueError("规则快照版本无效")
    fields = value.get("fields")
    if not isinstance(fields, dict) or set(fields) != set(RULE_FIELDS) or len(json_text(fields)) > 300000:
        raise ValueError("规则快照字段不完整或过大")
    digest = _rule_hash(fields)
    if value.get("hash") != digest:
        raise ValueError("规则快照哈希不匹配")
    for field in ("title", "edition"):
        _text(fields.get(field), field, 1000, False)
    public_url(fields.get("official_url"))
    if fields.get("entry_url") is not None:
        public_url(fields["entry_url"])
    for field in ("eligibility", "work_requirements", "steps"):
        values = fields.get(field)
        if not isinstance(values, list) or len(values) > 200:
            raise ValueError("规则快照列表无效")
        for text in values:
            _text(text, "规则内容", 12000)
    if not isinstance(fields.get("time"), dict) or not isinstance(fields.get("rewards"), list):
        raise ValueError("规则时间或奖励快照无效")
    if fields.get("fit_rules") is not None and not isinstance(fields["fit_rules"], dict):
        raise ValueError("作品条件快照无效")
    if fields.get("program") is not None and not isinstance(fields["program"], dict):
        raise ValueError("长期机制快照无效")
    for name in ("verified_at", "verification", "notice"):
        if value.get(name) is not None:
            _text(value[name], "快照核验说明", 1000)
    candidate = empty_document("snapshot", fields["title"], "规则快照", fields["official_url"], fields["edition"])
    candidate.update({key: val for key, val in fields.items() if val is not None or key not in ("canvas_requirements", "cash_tiers", "fees", "relations")})
    normalize(candidate)
    return copy.deepcopy(value)


def _suggestions(snapshot):
    """Quoted local fields only; no materials or eligibility are inferred."""
    result = []
    for field, caption in (("steps", "官方投稿步骤"), ("work_requirements", "官方作品要求"), ("canvas_requirements", "官方画布要求")):
        entries = snapshot["fields"].get(field)
        if not isinstance(entries, list):
            continue
        for index, value in enumerate(entries[:60]):
            if not isinstance(value, str) or not value.strip():
                continue
            text = value.strip()
            if len(text) > 2000:
                # Do not silently truncate a rule into a misleading requirement.
                continue
            result.append({"id": "official-" + hashlib.sha256((snapshot["hash"] + field + str(index)).encode()).hexdigest()[:24],
                           "label": text, "done": False, "origin": "official_suggestion",
                           "rule_field": field, "rule_version": snapshot["version"], "rule_hash": snapshot["hash"], "caption": caption})
    return result


def application_id(work_id, opportunity_id):
    return "application-" + hashlib.sha256(json_text([work_id, opportunity_id]).encode()).hexdigest()[:24]


def list_workspace(store):
    with store.connection() as conn:
        works = records(conn, "works")
        applications = records(conn, "applications")
        items = {row["id"]: (json.loads(row["document"]), row["version"]) for row in conn.execute("SELECT id,document,version FROM opportunities")}
    enriched = []
    for record in applications:
        record = copy.deepcopy(record)
        current = items.get(record["data"]["opportunity_id"])
        if current:
            snapshot = _rule_snapshot(*current)
            record["rule_changed"] = snapshot["hash"] != record["data"]["rule_snapshot"]["hash"]
            record["opportunity_title"] = current[0].get("title", "机会")
            record["current_rule_version"] = current[1]
        else:
            record["rule_changed"] = True
            record["opportunity_missing"] = True
        enriched.append(record)
    return {"works": works, "applications": enriched, "status_labels": STATUSES,
            "note": "全部只保存本机准备情况；没有投稿、报名或接受授权。"}


def save_work(store, payload, *, require_submission=False):
    from .write_protocol import WriteConflict, binding, receipt, save_receipt, submission_id
    payload = _object(payload, ("id", "revision", "data", "submissionId"), "作品请求")
    creating = payload.get("id") is None
    operation = payload.get("submissionId")
    if creating and (require_submission or operation is not None):
        operation = submission_id(operation)
    value = "work-" + uuid.uuid4().hex if payload.get("id") is None else payload["id"]
    value = identifier(value)
    data = _work_data(payload.get("data"))
    expected_revision = _revision(payload)
    request_binding = binding("work_create", {"revision": expected_revision, "data": data}) if creating and operation else None
    with store.connection() as conn:
        conn.execute("BEGIN IMMEDIATE")
        if request_binding:
            previous = receipt(conn, operation, "work_create", request_binding)
            if previous:
                original = previous["result"].get("record")
                current = get_record(conn, "works", previous["target"])
                if not isinstance(original, dict) or original.get("id") != previous["target"]:
                    raise ValueError("作品提交回执不完整；暂停写入")
                if current != original:
                    raise WriteConflict("该次作品新建已完成，但作品后来已修改或删除；请重新读取核对，草稿保留。", code="completed_then_changed", committed=True, record=current)
                return {**previous["result"], "already_completed": True}
        saved = put_record(conn, "works", value, data, expected_revision)
        result = {"saved": True, "record": saved}
        if request_binding:
            save_receipt(conn, operation, "work_create", request_binding, value, result)
    return result


def delete_work(store, payload):
    payload = _object(payload, ("id", "revision", "confirmed"), "删除作品请求")
    if payload.get("confirmed") is not True:
        raise ValueError("删除作品需要明确确认")
    value = identifier(payload.get("id"))
    with store.connection() as conn:
        conn.execute("BEGIN IMMEDIATE")
        if any(record["data"]["work_id"] == value for record in records(conn, "applications")):
            raise ValueError("作品仍有投稿准备记录；请先保留或移除关联记录")
        delete_record(conn, "works", value, _revision(payload))
    return {"deleted": True}


def prepare_application(store, work_id, opportunity_id):
    with store.connection() as conn:
        work = _work(conn, work_id)
        opportunity_id, document, version = _opportunity(conn, opportunity_id)
        current = get_record(conn, "applications", application_id(work["id"], opportunity_id))
    snapshot = _rule_snapshot(document, version)
    return {"work": work, "opportunity_id": opportunity_id, "rule_snapshot": snapshot,
            "suggestions": _suggestions(snapshot), "application": current,
            "saved_suggestions": _suggestions(current["data"]["rule_snapshot"]) if current else [],
            "rule_changed": bool(current and current["data"]["rule_snapshot"]["hash"] != snapshot["hash"]),
            "fit": evaluate_fit(document, work["data"]["profile"]), "account_status": "unknown"}


def _checklist(value, snapshot):
    if not isinstance(value, list) or len(value) > 120:
        raise ValueError("材料清单须为最多 120 项的数组")
    official = {item["id"]: item for item in _suggestions(snapshot)}
    seen, result = set(), []
    for item in value:
        item = _object(item, ("id", "label", "done", "origin", "rule_field", "rule_version", "rule_hash", "caption"), "材料项")
        value_id = identifier(item.get("id"))
        if value_id in seen or type(item.get("done")) is not bool:
            raise ValueError("材料项重复或完成状态无效")
        seen.add(value_id)
        label = _text(item.get("label"), "材料名称", 2000, False)
        origin = item.get("origin")
        if origin == "official_suggestion":
            suggestion = official.get(value_id)
            if not suggestion or label != suggestion["label"] or any(item.get(key) != suggestion[key] for key in ("rule_field", "rule_version", "rule_hash")):
                raise ValueError("官方建议材料与保存的规则快照不一致，请重新核对")
            result.append({**suggestion, "done": item["done"]})
        elif origin == "personal":
            if set(item) - {"id", "label", "done", "origin"}:
                raise ValueError("个人材料不能冒充官方规则来源")
            result.append({"id": value_id, "label": label, "done": item["done"], "origin": "personal"})
        else:
            raise ValueError("材料来源必须明确为个人准备或官方建议")
    return result


def validate_record(kind, value):
    """Strict portable-backup validation without consulting or mutating data."""
    if kind == "works":
        return _work_data(value)
    if kind != "applications":
        raise ValueError("作品记录类型无效")
    value = _object(value, ("work_id", "opportunity_id", "status", "notes", "checklist", "rule_snapshot"), "准备记录")
    if value.get("status") not in STATUSES:
        raise ValueError("准备状态无效")
    snapshot = _validate_snapshot(value.get("rule_snapshot"))
    return {"work_id": identifier(value.get("work_id")), "opportunity_id": identifier(value.get("opportunity_id")),
            "status": value["status"], "notes": _text(value.get("notes", ""), "准备笔记", 12000),
            "checklist": _checklist(value.get("checklist", []), snapshot), "rule_snapshot": snapshot}


def save_application(store, payload):
    payload = _object(payload, ("id", "revision", "data", "expected_rule_hash", "refresh_rules", "submitted_confirmed"), "投稿准备请求")
    data = _object(payload.get("data"), ("work_id", "opportunity_id", "status", "notes", "checklist"), "投稿准备")
    status = data.get("status")
    if status not in STATUSES:
        raise ValueError("投稿准备状态无效")
    refresh = payload.get("refresh_rules", False)
    if type(refresh) is not bool:
        raise ValueError("规则快照刷新必须明确为 true 或 false")
    with store.connection() as conn:
        conn.execute("BEGIN IMMEDIATE")
        work = _work(conn, data.get("work_id"))
        opportunity_id, document, version = _opportunity(conn, data.get("opportunity_id"))
        value_id = application_id(work["id"], opportunity_id)
        if payload.get("id") is not None and payload["id"] != value_id:
            raise ValueError("投稿准备标识与作品及机会不一致")
        previous = get_record(conn, "applications", value_id)
        if status == "submitted" and (not previous or previous["data"]["status"] != "submitted") and payload.get("submitted_confirmed") is not True:
            raise ValueError("已投仅为个人记录；需要明确确认实际已投，不会替你投稿")
        current_snapshot = _rule_snapshot(document, version)
        if not previous or refresh:
            if payload.get("expected_rule_hash") != current_snapshot["hash"]:
                raise ValueError("规则已变化或尚未预览，请重新核对后保存")
            snapshot = current_snapshot
        else:
            snapshot = previous["data"]["rule_snapshot"]
        saved_data = {"work_id": work["id"], "opportunity_id": opportunity_id, "status": status,
                      "notes": _text(data.get("notes", ""), "准备笔记", 12000),
                      "checklist": _checklist(data.get("checklist", []), snapshot), "rule_snapshot": snapshot}
        saved = put_record(conn, "applications", value_id, saved_data, _revision(payload))
    return {"saved": True, "record": saved, "rule_changed": snapshot["hash"] != current_snapshot["hash"],
            "note": "已保存个人准备情况；没有向主办方提交任何内容。"}


def delete_application(store, payload):
    payload = _object(payload, ("id", "revision", "confirmed"), "删除准备记录请求")
    if payload.get("confirmed") is not True:
        raise ValueError("删除准备记录需要明确确认")
    with store.connection() as conn:
        conn.execute("BEGIN IMMEDIATE")
        delete_record(conn, "applications", identifier(payload.get("id")), _revision(payload))
    return {"deleted": True}
