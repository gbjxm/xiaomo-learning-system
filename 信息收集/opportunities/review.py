"""Human review of discovered notices; a saved entry is never a qualification verdict."""
from __future__ import annotations

import copy
import hashlib
import json
import re
import secrets
import threading
import time
from datetime import datetime, timedelta

from .model import KINDS, MECHANISMS, REWARDS, decorate, empty_document, field_changes, json_text, normalize, utcnow
from .workspace import get_record, put_record, records, public_url, write_document


FIELDS = {"title", "platform", "organizer", "edition", "kind", "official_url", "entry_url", "summary", "publication_at", "mechanism", "start", "deadline", "timezone", "time_excerpt", "time_verified", "deadline_tentative", "conflict", "month_start", "month_end", "eligibility", "work_requirements", "steps", "rewards", "rights", "excerpt", "review_note", "ai_policy"}
IMPORTANT = ("time", "eligibility", "work_requirements", "rewards", "risks", "program")
FIELD_LABELS = {"time": "截止 / 开放时间", "eligibility": "参与资格", "work_requirements": "作品 / AI要求", "rewards": "奖励及条件", "risks": "版权 / 独家", "program": "长期机制与结算"}


def text(value, label, maximum=5000, nullable=True):
    if value is None and nullable:
        return None
    if not isinstance(value, str) or len(value) > maximum or any(0xD800 <= ord(c) <= 0xDFFF or ord(c) < 32 and c not in "\n\r\t" for c in value):
        raise ValueError(f"{label}须为不超过{maximum}字的文本")
    return value.strip() or None if nullable else value.strip()


def lines(value, label):
    if isinstance(value, str):
        value = [line.strip() for line in value.splitlines() if line.strip()]
    if value is None:
        return []
    if not isinstance(value, list) or len(value) > 60:
        raise ValueError(f"{label}最多60项")
    return [text(line, label, 3000, False) for line in value]


def fingerprint(value):
    return hashlib.sha256(json_text(value).encode("utf-8")).hexdigest()


def _item(conn, item_id):
    row = conn.execute("SELECT * FROM opportunities WHERE id=?", (item_id,)).fetchone()
    if not row:
        raise ValueError("正式条目不存在，请刷新后重试")
    return dict(row)


def _candidate(conn, candidate_id):
    if not isinstance(candidate_id, str) or not re.fullmatch(r"[a-f0-9]{24}", candidate_id):
        raise ValueError("线索标识无效")
    row = conn.execute("SELECT * FROM discovery_candidates WHERE id=?", (candidate_id,)).fetchone()
    if not row:
        raise ValueError("线索不存在")
    return dict(row)


def _day_end(value):
    """Preserve 24:00 wording while normalizing it to next-day midnight."""
    if not value:
        return value
    match = re.fullmatch(r"(\d{4}-\d{2}-\d{2})[T ]24:00(?::00)?(Z|[+-]\d{2}:\d{2})?", value)
    if match:
        day = datetime.fromisoformat(match[1]) + timedelta(days=1)
        return day.strftime("%Y-%m-%dT00:00:00") + (match[2] or "")
    return value


def _build_document(candidate, fields):
    if not isinstance(fields, dict) or set(fields) - FIELDS:
        raise ValueError("核验表单含未知字段")
    required = {}
    for name in ("title", "platform", "edition", "kind", "official_url"):
        required[name] = text(fields.get(name), name, 4000 if name == "official_url" else 300, False)
        if not required[name]:
            raise ValueError("请填写名称、平台、轮次、类型与官方原文；其他字段可以保留未知")
    if required["kind"] not in KINDS:
        raise ValueError("记录类型无效")
    required["official_url"] = public_url(required["official_url"])
    doc = empty_document(candidate["source_id"], required["title"], required["platform"], required["official_url"], required["edition"], required["kind"])
    doc["organizer"] = text(fields.get("organizer"), "主办方", 1000)
    doc["entry_url"] = public_url(fields["entry_url"]) if fields.get("entry_url") else None
    doc["summary"] = text(fields.get("summary"), "简介", 5000, False) or "尚未补核比赛简介；请阅读官方原文。"
    doc["publication_at"] = text(fields.get("publication_at"), "发布日期", 100)
    mechanism = fields.get("mechanism", "unspecified")
    if mechanism not in MECHANISMS:
        raise ValueError("时间机制无效")
    confirmed = fields.get("time_verified", False)
    tentative = fields.get("deadline_tentative", False)
    if type(confirmed) is not bool or type(tentative) is not bool:
        raise ValueError("时间核验须明确选择；不能用文字自动确认")
    time_excerpt = text(fields.get("time_excerpt"), "时间原文依据")
    if confirmed and not time_excerpt:
        raise ValueError("确认时间机制前请填写对应官方摘录；不确定时保留未核")
    start = text(fields.get("start"), "开始", 100)
    deadline = text(fields.get("deadline"), "截止", 100)
    if confirmed and mechanism == "fixed" and not (start or deadline or fields.get("month_start")):
        raise ValueError("明确起止需至少填写已核日期或月份窗口")
    doc["time"].update(mechanism=mechanism, start=_day_end(start), deadline=_day_end(deadline), timezone=text(fields.get("timezone"), "时区", 100), confirmed=confirmed, evidence=time_excerpt, deadline_tentative=tentative)
    if deadline and deadline != _day_end(deadline):
        doc["time"]["deadline_raw"] = deadline
    conflict = text(fields.get("conflict"), "时间冲突")
    if conflict:
        doc["time"]["conflict"] = conflict
    if fields.get("month_start") or fields.get("month_end"):
        doc["time"]["month_period"] = {"start": text(fields.get("month_start"), "开始月份", 7, False), "end": text(fields.get("month_end"), "截止月份", 7, False)}
    for field in ("eligibility", "work_requirements", "steps"):
        doc[field] = lines(fields.get(field), field)
    rewards = fields.get("rewards", [])
    if not isinstance(rewards, list) or len(rewards) > 20:
        raise ValueError("奖励最多20项，现金、积分与流量分别填写")
    for reward in rewards:
        if not isinstance(reward, dict) or set(reward) - {"type", "label", "amount", "currency", "unit", "scope", "validity", "source_excerpt"} or reward.get("type") not in REWARDS:
            raise ValueError("奖励项无效")
        checked = {key: text(value, "奖励说明", 3000) for key, value in reward.items() if key != "amount"}
        checked["amount"] = reward.get("amount")
        if not checked.get("scope"):
            checked["scope"] = "口径待核；不是个人保证收益"
        if not checked.get("label") and checked["amount"] is None:
            raise ValueError("奖励需填写数量或说明；未知奖励请留空")
        doc["rewards"].append(checked)
    doc["risks"] = [{"type": "manual_terms", "level": "high", "detail": term} for term in lines(fields.get("rights"), "版权 / 独家条款")]
    ai_policy = fields.get("ai_policy", "unspecified")
    if ai_policy not in ("allowed", "limited", "prohibited", "unspecified"):
        raise ValueError("AI作品资格选择无效")
    doc["assessment"] = {"role": "candidate", "ai_policy": ai_policy, "reason": "人工录入；具体作品及账号资格未核验", "personal_eligibility": "未核"}
    excerpt = text(fields.get("excerpt"), "原文摘录", 12000)
    if not excerpt:
        raise ValueError("请填写本次已阅读的原文依据；自动正文不等于人工核验")
    doc["evidence"] = [{"url": doc["official_url"], "excerpt": excerpt, "origin": "manual_review", "observed_at": utcnow(), "method": "user_review_form", "note": text(fields.get("review_note"), "核验说明")}]
    doc["origin"], doc["verification"], doc["verified_at"] = "manual_review", "partial", utcnow()
    doc["public_review"] = {"at": utcnow(), "method": "用户核验表单；仅填写的字段有人工依据，账号资格另核", "fields_verified": [], "remaining": ["个人账号与具体作品资格", "未填写或未确认的规则字段"]}
    return normalize(doc)


class ReviewManager:
    def __init__(self, store):
        self.store = store
        self.lock = threading.RLock()
        self.previews = {}

    def candidate(self, candidate_id):
        with self.store.connection() as conn:
            candidate = _candidate(conn, candidate_id)
        candidate["evidence"] = json.loads(candidate["evidence"])
        source = next((s for s in self.store.source_config if s["id"] == candidate["source_id"]), {})
        return {"candidate": candidate, "suggestions": {"title": candidate["title"], "edition": candidate["edition"], "platform": source.get("platform") or source.get("name") or candidate["source_id"], "official_url": candidate["official_url"]}, "note": "机器建议只含公告标题、轮次和来源；奖励、时间及资格不自动确认。"}

    def preview(self, payload):
        if not isinstance(payload, dict) or set(payload) - {"candidate_id", "action", "fields", "target_id"}:
            raise ValueError("核验预览请求无效")
        action = payload.get("action")
        if action not in ("create", "link"):
            raise ValueError("只支持核验入库或关联已有条目")
        with self.store.connection() as conn:
            candidate = _candidate(conn, payload.get("candidate_id"))
            if action == "create":
                document = _build_document(candidate, payload.get("fields"))
                if conn.execute("SELECT 1 FROM opportunities WHERE id=? OR (source_id=? AND official_url=? AND edition=?)", (document["id"], document["source_id"], document["official_url"], document["edition"])).fetchone():
                    raise ValueError("同来源、网址和轮次已存在；请关联已有条目，不重复入库")
                target = None
                preview = decorate(document, self.store.rules)
                warnings = ["正式入库只表示已保存，不代表规则完整核实、当前开放或本账号符合。", "奖励总池、名额与个人可领金额必须按填写口径分别理解。"]
                if document["official_url"] != candidate["official_url"]:
                    warnings.append("官方原文网址已由候选页改为另一页：本次人工摘录须对应填写的新网址。原候选列表与正文仅保留为发现线索，不能冒充新页证据。")
            else:
                target = _item(conn, payload.get("target_id"))
                document = None
                target_doc = json.loads(target["document"])
                from .merging import _years, _rounds
                candidate_years, target_years = _years(candidate), _years(target_doc)
                candidate_rounds, target_rounds = _rounds(candidate), _rounds(target_doc)
                if len(candidate_years) > 1 or len(target_years) > 1 or candidate_years and target_years and candidate_years != target_years:
                    raise ValueError("年度不同，不能关联为同一届活动；请分别保存")
                if candidate_rounds and target_rounds and candidate_rounds != target_rounds:
                    raise ValueError("已知届次、轮次或季节不同，不能关联为同一活动")
                preview = {"id": target["id"], "title": target_doc["title"], "edition": target_doc["edition"], "official_url": target_doc["official_url"], "candidate_title": candidate["title"], "candidate_url": candidate["official_url"]}
                warnings = ["仅保存此线索与现有条目的关联，不合并或覆盖任何规则、笔记、关注与历史。"]
                if not candidate_years or not target_years or not candidate_rounds or not target_rounds:
                    warnings.append("至少一侧年度或轮次信息不足：相同年份不能证明同一活动。请人工核对公告名称、主办方、报名入口及届次后再确认关联。")
        operation_id, token = secrets.token_hex(16), secrets.token_urlsafe(32)
        entry = {"operation_id": operation_id, "action": action, "candidate_id": candidate["id"], "candidate_fingerprint": fingerprint(candidate), "target_id": target["id"] if target else None, "target_fingerprint": fingerprint(target) if target else None, "document": document, "expires": time.monotonic() + 1200}
        with self.lock:
            self.previews = {key: value for key, value in self.previews.items() if value["expires"] > time.monotonic()}
            if len(self.previews) >= 128:
                raise ValueError("待确认预览过多，请关闭旧表单或稍后重试")
            self.previews[token] = entry
        return {"token": token, "operation_id": operation_id, "action": action, "preview": preview, "warnings": warnings, "expires_in_seconds": 1200}

    def confirm(self, payload):
        if not isinstance(payload, dict) or set(payload) != {"token", "operation_id"}:
            raise ValueError("确认请求无效，请重新预览")
        operation_id, token = payload["operation_id"], payload["token"]
        if not isinstance(operation_id, str) or not re.fullmatch(r"[a-f0-9]{32}", operation_id) or not isinstance(token, str):
            raise ValueError("确认凭证无效")
        with self.lock:
            entry = self.previews.get(token)
            if not entry or entry["operation_id"] != operation_id:
                # Persistent receipts are read through receipt(), never used to
                # accept an unknown token after process restart.
                raise ValueError("预览已失效；请先查询结果或重新预览，勿重复猜测提交")
            with self.store.connection() as conn:
                conn.execute("BEGIN IMMEDIATE")
                existing = get_record(self.store, "review_receipts", operation_id, conn=conn)
                if existing:
                    return existing["data"]
                if entry["expires"] <= time.monotonic():
                    raise ValueError("预览已过期，请重新核对")
                candidate = _candidate(conn, entry["candidate_id"])
                if fingerprint(candidate) != entry["candidate_fingerprint"]:
                    raise ValueError("线索在预览后变化，请刷新并重新预览")
                if entry["action"] == "create":
                    doc = entry["document"]
                    if conn.execute("SELECT 1 FROM opportunities WHERE id=?", (doc["id"],)).fetchone():
                        raise ValueError("正式条目已存在，请重新预览关联")
                    write_document(conn, doc, "用户核验候选入库；未核字段保留")
                    target_id = doc["id"]
                else:
                    target = _item(conn, entry["target_id"])
                    if fingerprint(target) != entry["target_fingerprint"]:
                        raise ValueError("目标条目在预览后变化，请重新比较")
                    target_id = target["id"]
                conn.execute("UPDATE discovery_candidates SET review_state='known',known_item_id=? WHERE id=?", (target_id, candidate["id"]))
                link_record = {"candidate_id": candidate["id"], "item_id": target_id, "source_id": candidate["source_id"], "official_url": candidate["official_url"], "edition": candidate["edition"], "action": entry["action"], "candidate_snapshot": candidate, "reviewed_at": utcnow()}
                put_record(conn, "candidate_links", operation_id, link_record)
                result = {"status": "confirmed", "operation_id": operation_id, "action": entry["action"], "candidate_id": candidate["id"], "item_id": target_id, "at": utcnow(), "note": "条目已保存；规则完整度、开放状态和个人资格继续独立判断。"}
                put_record(conn, "review_receipts", operation_id, result)
                return result

    def receipt(self, operation_id):
        if not isinstance(operation_id, str) or not re.fullmatch(r"[a-f0-9]{32}", operation_id):
            raise ValueError("操作标识无效")
        receipt = get_record(self.store, "review_receipts", operation_id)
        return receipt["data"] if receipt else {"operation_id": operation_id, "status": "unknown", "note": "未找到已提交收据。请核对线索与正式条目后重新预览，不自动重复提交。"}

    def history(self, item_id):
        with self.store.connection() as conn:
            item = _item(conn, item_id)
            versions = [dict(row) for row in conn.execute("SELECT * FROM versions WHERE opportunity_id=? ORDER BY version DESC", (item_id,))]
            doc = json.loads(item["document"])
            changes = [dict(row) for row in conn.execute("SELECT p.*,b.body before_body,a.body after_body FROM page_changes p JOIN observations b ON b.id=p.before_id JOIN observations a ON a.id=p.after_id WHERE p.source_id=? AND p.url=? ORDER BY p.id DESC LIMIT 100", (doc["source_id"], doc["official_url"]))]
        review_records = {}
        for record in sorted(records(self.store, "change_reviews"), key=lambda row: (row["data"].get("sequence", 0), row["data"]["at"], row["id"])):
            if record["data"].get("item_id") == item_id:
                review_records[record["data"]["change_id"]] = record
        for version in versions:
            version["snapshot"], version["changes"] = json.loads(version["snapshot"]), json.loads(version["changes"])
            version["important_fields"] = [FIELD_LABELS[name] for name in IMPORTANT if any(change.get("field", "").split(".")[0] == name for change in version["changes"])]
        for change in changes:
            change["review"] = review_records.get(change["id"])
            change["note"] = "网页文字变化不等于规则生效；请重点核对截止、资格、奖励条件与版权。"
        return {"item_id": item_id, "current_version": item["version"], "versions": versions, "page_changes": changes, "note": "原始全文以纯文本显示；旧版本不作为当前适用规则，人工判断单独留存。"}

    def review_change(self, payload):
        if not isinstance(payload, dict) or set(payload) - {"item_id", "change_id", "state", "note"}:
            raise ValueError("变化复核请求无效")
        if payload.get("state") not in ("reviewed", "needs_review") or type(payload.get("change_id")) is not int:
            raise ValueError("复核状态或变化标识无效")
        note = text(payload.get("note"), "人工判断说明", 5000, False)
        if not note:
            raise ValueError("请记录复核依据；不能仅点击视为规则已核实")
        with self.store.connection() as conn:
            conn.execute("BEGIN IMMEDIATE")
            row = _item(conn, payload.get("item_id"))
            doc = json.loads(row["document"])
            if not conn.execute("SELECT 1 FROM page_changes WHERE id=? AND source_id=? AND url=?", (payload["change_id"], doc["source_id"], doc["official_url"])).fetchone():
                raise ValueError("正文变化与当前条目不对应")
            sequence = 1 + max((entry["data"].get("sequence", 0) for entry in records(conn, "change_reviews") if entry["data"].get("item_id") == row["id"] and entry["data"].get("change_id") == payload["change_id"]), default=0)
            data = {"item_id": row["id"], "item_version": row["version"], "change_id": payload["change_id"], "state": payload["state"], "note": note, "origin": "personal_judgment", "at": utcnow(), "sequence": sequence}
            record = put_record(conn, "change_reviews", secrets.token_hex(16), data)
            # Current review label is derived from the latest append-only review.
            return record


def validate_record(kind, data):
    """Portable backup validation: neither infer facts nor execute saved text."""
    if not isinstance(data, dict):
        raise ValueError("核验记录正文无效")
    def opaque(value, length):
        if not isinstance(value, str) or not re.fullmatch(r"[a-f0-9]{" + str(length) + r"}", value):
            raise ValueError("核验记录引用标识无效")
    if kind == "review_receipts":
        expected = {"status", "operation_id", "action", "candidate_id", "item_id", "at", "note"}
        if set(data) != expected or data["status"] != "confirmed" or data["action"] not in ("create", "link"):
            raise ValueError("核验提交收据无效")
        opaque(data["operation_id"], 32)
        opaque(data["candidate_id"], 24)
        opaque(data["item_id"], 24)
        datetime.fromisoformat(text(data["at"], "提交日期", 100, False).replace("Z", "+00:00"))
        text(data["note"], "提交说明", 5000, False)
    elif kind == "change_reviews":
        if set(data) not in ({"item_id", "item_version", "change_id", "state", "note", "origin", "at"}, {"item_id", "item_version", "change_id", "state", "note", "origin", "at", "sequence"}) or data["state"] not in ("reviewed", "needs_review") or data["origin"] != "personal_judgment":
            raise ValueError("正文人工判断记录无效")
        opaque(data["item_id"], 24)
        if type(data["item_version"]) is not int or data["item_version"] < 1 or type(data["change_id"]) is not int or data["change_id"] < 1:
            raise ValueError("正文判断版本引用无效")
        if "sequence" in data and (type(data["sequence"]) is not int or data["sequence"] < 1):
            raise ValueError("正文人工复核顺序无效")
        if not text(data["note"], "复核依据", 5000, False):
            raise ValueError("正文人工判断缺少依据")
        datetime.fromisoformat(text(data["at"], "复核日期", 100, False).replace("Z", "+00:00"))
    elif kind == "candidate_links":
        if set(data) != {"candidate_id", "item_id", "source_id", "official_url", "edition", "action", "candidate_snapshot", "reviewed_at"} or data["action"] not in ("create", "link"):
            raise ValueError("候选关联记录无效")
        opaque(data["candidate_id"], 24)
        opaque(data["item_id"], 24)
        public_url(data["official_url"])
        text(data["source_id"], "来源", 200, False)
        text(data["edition"], "届次", 300, False)
        snapshot = data["candidate_snapshot"]
        expected = {"id", "source_id", "official_url", "edition", "title", "first_seen_at", "last_seen_at", "evidence", "body", "review_state", "known_item_id"}
        if not isinstance(snapshot, dict) or set(snapshot) != expected or snapshot["id"] != data["candidate_id"] or snapshot["source_id"] != data["source_id"] or snapshot["official_url"] != data["official_url"] or snapshot["edition"] != data["edition"]:
            raise ValueError("候选关联原始快照不一致")
        if snapshot["review_state"] not in ("pending", "dismissed", "known"):
            raise ValueError("候选快照审核状态无效")
        if snapshot["known_item_id"] is not None:
            opaque(snapshot["known_item_id"], 24)
        text(snapshot["body"], "候选正文", 120000, False)
        text(snapshot["title"], "候选标题", 1000, False)
        if not isinstance(json.loads(snapshot["evidence"]), dict):
            raise ValueError("候选证据无效")
        datetime.fromisoformat(text(data["reviewed_at"], "关联日期", 100, False).replace("Z", "+00:00"))
    else:
        raise ValueError("未知核验记录类型")
    return data
