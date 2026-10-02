"""Conservative time semantics, evidence completeness, matching and identity."""
from __future__ import annotations
import copy
import hashlib
import json
import math
import re
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

UTC = timezone.utc
KINDS = {"competition": "比赛征集", "creator_program": "长期创作者计划", "limited_benefit": "限时福利", "rule_update": "平台规则更新"}
MECHANISMS = {"fixed": "明确起止", "ongoing": "官方明确常年开放", "batches": "分批 / 分期", "unspecified": "官方未说明"}
REWARDS = {"cash": "现金", "credits": "积分", "compute": "算力", "traffic": "流量", "promotion": "推广", "screening": "展映", "other": "其他"}
DATE_TIME = re.compile(r"\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,6})?)?(?:Z|[+-]\d{2}:\d{2})?)?\Z")
FIXED_OFFSET = re.compile(r"([+-])(\d{2}):(\d{2})\Z")


def _offset_zone(value):
    match = FIXED_OFFSET.fullmatch(value)
    if not match:
        raise ValueError("UTC 偏移须使用 ±HH:MM")
    hours, minutes = int(match[2]), int(match[3])
    if hours >= 24 or minutes >= 60:
        raise ValueError("UTC 偏移小时须小于24，分钟须小于60")
    return timezone(timedelta(minutes=(hours * 60 + minutes) * (1 if match[1] == "+" else -1)))


def _parse_datetime(value):
    if not isinstance(value, str) or not DATE_TIME.fullmatch(value):
        raise ValueError("日期须为YYYY-MM-DD，时刻须使用完整日期与HH:MM，可附秒和UTC偏移")
    offset = re.search(r"[+-]\d{2}:\d{2}\Z", value)
    if offset:
        _offset_zone(offset[0])
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _zone(value):
    if value == "UTC":
        return UTC
    if not isinstance(value, str) or not value:
        raise ValueError("时区必须为非空名称或UTC偏移")
    if value.startswith(("+", "-")):
        return _offset_zone(value)
    try:
        return ZoneInfo(value)
    except (ZoneInfoNotFoundError, ValueError, TypeError) as error:
        raise ValueError("此 Python 环境不支持该时区；可填写官方 UTC 偏移") from error


def _text(value, label, nullable=True):
    if value is None and nullable:
        return
    if not isinstance(value, str):
        raise ValueError(f"{label}必须是文本" + "或null" * nullable)


def _string_list(value, label):
    if not isinstance(value, list) or any(not isinstance(item, str) for item in value):
        raise ValueError(f"{label}必须为文本数组")


def _object_list(value, label):
    if not isinstance(value, list) or any(not isinstance(item, dict) for item in value):
        raise ValueError(f"{label}必须为对象数组")


def _amount(value, label, nullable=True):
    if value is None and nullable:
        return
    try:
        valid = type(value) in (int, float) and math.isfinite(value) and value >= 0
    except OverflowError:
        valid = False
    if not valid:
        raise ValueError(f"{label}必须是非负有限数字" + "或null" * nullable)

def utcnow():
    return datetime.now(UTC).isoformat(timespec="seconds")

def json_text(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)

def canonical_url(url):
    parts = urlsplit(str(url))
    if parts.scheme != "https" or not parts.hostname or parts.username or parts.password or parts.port not in (None, 443):
        raise ValueError("官方链接必须是无凭据的 HTTPS URL")
    query = [(k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True) if not k.lower().startswith("utm_") and k.lower() not in {"spm", "from", "share_source"}]
    return urlunsplit(("https", parts.hostname.lower(), parts.path or "/", urlencode(query), ""))

def identity(doc):
    key = [doc["source_id"], canonical_url(doc["official_url"]), doc["edition"]]
    return hashlib.sha256(json_text(key).encode()).hexdigest()[:24]

def empty_document(source_id, title, platform, url, edition="轮次未核", kind="competition"):
    return {"source_id": source_id, "title": title, "platform": platform, "organizer": None, "official_url": canonical_url(url), "entry_url": None, "edition": edition, "kind": kind,
            "summary": "", "tags": [], "publication_at": None,
            "time": {"mechanism": "unspecified", "start": None, "deadline": None, "timezone": None, "absolute_start": None, "absolute_deadline": None, "confirmed": False, "evidence": None, "batches": [], "policy_effective": None, "policy_end": None, "policy_version": None},
            "rewards": [], "eligibility": [], "work_requirements": [], "steps": [], "risks": [],
            "program": {"join": None, "revenue": None, "settlement": None, "ongoing_requirements": None, "exit": None, "effective_version": None},
            "evidence": [], "verified_at": None, "verification": "partial", "origin": "live_fetch"}

def normalize(doc):
    if not isinstance(doc, dict):
        raise ValueError("条目必须是JSON对象")
    doc = copy.deepcopy(doc)
    for key in ("source_id", "title", "platform", "official_url", "edition", "kind"):
        if not isinstance(doc.get(key), str) or not doc[key].strip():
            raise ValueError(f"缺少字段：{key}")
    if doc["kind"] not in KINDS:
        raise ValueError("未知的信息类型")
    defaults = empty_document(doc["source_id"], doc["title"], doc["platform"], doc["official_url"], doc["edition"], doc["kind"])
    for key, val in defaults.items():
        if key not in doc:
            doc[key] = val
    for key in ("time", "program"):
        if not isinstance(doc[key], dict):
            raise ValueError(f"{key}必须是对象")
        doc[key] = {**defaults[key], **doc[key]}
    times = doc["time"]
    if not isinstance(times["mechanism"], str) or times["mechanism"] not in MECHANISMS:
        raise ValueError("未知的时间机制")
    if type(times["confirmed"]) is not bool:
        raise ValueError("confirmed必须是true或false，不能用文本代替")
    if "deadline_tentative" in times and type(times["deadline_tentative"]) is not bool:
        raise ValueError("deadline_tentative必须是true或false")
    for key in ("evidence", "conflict", "deadline_raw", "policy_version", "policy_duration", "provider_phase"):
        if key in times:
            _text(times[key], f"time.{key}")
    _string_list(times["batches"], "time.batches")
    if times["timezone"] is not None:
        _zone(times["timezone"])
    doc["official_url"] = canonical_url(doc["official_url"])
    _text(doc.get("entry_url"), "entry_url")
    if doc.get("entry_url"):
        doc["entry_url"] = canonical_url(doc["entry_url"])
    for key in ("publication_at", "verified_at"):
        if doc.get(key) is not None:
            _parse_datetime(doc[key])
            time_bounds(doc[key])
    for key in ("start", "deadline", "absolute_start", "absolute_deadline", "policy_effective", "policy_end"):
        if times.get(key) is not None:
            _parse_datetime(times[key])
            time_bounds(times[key], times["timezone"], key in ("deadline", "absolute_deadline", "policy_end"))
    if "source_window" in times:
        window = times["source_window"]
        if not isinstance(window, dict):
            raise ValueError("source_window必须为对象")
        for key in ("start", "end"):
            if window.get(key) is not None:
                _parse_datetime(window[key])
                time_bounds(window[key], end=key == "end")
        if "note" in window:
            _text(window["note"], "source_window.note")
    if "month_period" in times:
        months = times["month_period"]
        if not isinstance(months, dict) or set(months) != {"start", "end"}:
            raise ValueError("月份窗口必须包含start和end")
        for value in months.values():
            if not isinstance(value, str) or not re.fullmatch(r"\d{4}-(?:0[1-9]|1[0-2])", value):
                raise ValueError("月份窗口须使用YYYY-MM，不能补造日与时刻")
            _parse_datetime(value + "-01")
        if months["start"] > months["end"]:
            raise ValueError("月份窗口的开始不能晚于结束")
        _month_bounds(months, times["timezone"])
    for key in ("summary",):
        _text(doc[key], key, nullable=False)
    for key in ("origin", "verification"):
        _text(doc[key], key, nullable=False)
    _text(doc.get("organizer"), "organizer")
    for key in ("entry_status", "contact_email", "reward_conflict", "record_context"):
        if key in doc:
            _text(doc[key], key)
    for key in ("tags", "eligibility", "work_requirements", "steps"):
        _string_list(doc[key], key)
    for key in ("rewards", "risks", "evidence"):
        _object_list(doc[key], key)
    for reward in doc["rewards"]:
        if not isinstance(reward.get("type"), str) or reward["type"] not in REWARDS:
            raise ValueError("奖励必须分别标注现金、积分、算力、流量等类别")
        _amount(reward.get("amount"), "奖励数量")
        for key in ("label", "currency", "unit", "scope", "validity", "source_excerpt"):
            if key in reward:
                _text(reward[key], f"rewards.{key}")
    for evidence in doc["evidence"]:
        for key in ("url", "excerpt", "origin", "note", "method"):
            if key in evidence:
                _text(evidence[key], f"evidence.{key}", nullable=key != "url")
        if evidence.get("observed_at") is not None:
            _parse_datetime(evidence["observed_at"])
        for key in ("external_rules", "image_refs"):
            if key in evidence:
                _string_list(evidence[key], f"evidence.{key}")
    for risk in doc["risks"]:
        for key in ("type", "level", "detail"):
            if key in risk:
                _text(risk[key], f"risks.{key}")
    for key in defaults["program"]:
        _text(doc["program"][key], f"program.{key}")
    for key in ("assessment", "importance", "public_review"):
        if key in doc and not isinstance(doc[key], dict):
            raise ValueError(f"{key}必须为对象")
    for key in ("role", "ai_policy", "reason", "personal_eligibility"):
        if key in doc.get("assessment", {}):
            _text(doc["assessment"][key], f"assessment.{key}")
    if "basis" in doc.get("importance", {}):
        _text(doc["importance"]["basis"], "importance.basis")
    review = doc.get("public_review", {})
    if review.get("at") is not None:
        _parse_datetime(review["at"])
    if "method" in review:
        _text(review["method"], "public_review.method")
    for key in ("fields_verified", "remaining"):
        if key in review:
            _string_list(review[key], f"public_review.{key}")
    if "canvas_requirements" in doc:
        _string_list(doc["canvas_requirements"], "canvas_requirements")
    if "source_attachments" in doc:
        _object_list(doc["source_attachments"], "source_attachments")
        for attachment in doc["source_attachments"]:
            _text(attachment.get("label"), "source_attachments.label", nullable=False)
            _text(attachment.get("url"), "source_attachments.url", nullable=False)
            attachment["url"] = canonical_url(attachment["url"])
    if "fees" in doc:
        _object_list(doc["fees"], "fees")
        for fee in doc["fees"]:
            _amount(fee.get("amount"), "费用")
            for key in ("type", "currency", "scope"):
                if key in fee:
                    _text(fee[key], f"fees.{key}")
    if "cash_tiers" in doc:
        _object_list(doc["cash_tiers"], "cash_tiers")
        for tier in doc["cash_tiers"]:
            _text(tier.get("condition"), "cash_tiers.condition", nullable=False)
            for key in ("base", "canvas_bonus"):
                _amount(tier.get(key), f"cash_tiers.{key}", nullable=False)
    if "relations" in doc:
        _object_list(doc["relations"], "关联条目")
        for relation in doc["relations"]:
            if relation.get("type") not in ("under_program", "special_track", "rule_for", "previous_edition") or not isinstance(relation.get("target_id"), str) or not re.fullmatch(r"[0-9a-f]{24}", relation["target_id"]):
                raise ValueError("关联类型或目标ID无效")
            if "note" in relation:
                _text(relation["note"], "relations.note")
    doc["id"] = identity(doc)
    if any(r["target_id"] == doc["id"] for r in doc.get("relations", [])):
        raise ValueError("条目不能关联自身")
    return doc

def official_datetime(value):
    """Normalize an explicitly dated 24:00 to the next midnight, preserving raw separately."""
    if not isinstance(value, str):
        raise ValueError("官方日期必须为文本")
    match = re.fullmatch(r"(\d{4}-\d{2}-\d{2})[ T]24:00(?::00)?(Z|[+-]\d{2}:\d{2})?", value)
    if match:
        try:
            result = (_parse_datetime(match[1]) + timedelta(days=1)).isoformat(timespec="seconds") + (match[2] or "")
        except OverflowError as error:
            raise ValueError("官方日期超出可表示范围") from error
        _parse_datetime(result)
        return result
    _parse_datetime(value)
    return value.replace(" ", "T")

def time_bounds(value, tz_name=None, end=False):
    if not value:
        return None
    parsed = _parse_datetime(value)
    if len(value) == 10 and end:
        parsed = parsed.replace(hour=23, minute=59, second=59, microsecond=999999)
    try:
        if parsed.tzinfo:
            moment = parsed.astimezone(UTC)
            return moment, moment
        if tz_name:
            tz = _zone(tz_name)
            moments = []
            for fold in (0, 1):
                moment = parsed.replace(tzinfo=tz, fold=fold).astimezone(UTC)
                if moment.astimezone(tz).replace(tzinfo=None) == parsed:
                    moments.append(moment)
            if not moments:
                raise ValueError("该本地时刻不存在于官方时区，须核对原文偏移或更正时间")
            return min(moments), max(moments)
        # No invented timezone: dates are certain only outside all plausible boundaries.
        return (parsed - timedelta(hours=14)).replace(tzinfo=UTC), (parsed + timedelta(hours=12)).replace(tzinfo=UTC)
    except OverflowError as error:
        raise ValueError("日期的UTC边界超出可表示范围") from error


def _month_bounds(months, tz_name=None):
    first = _parse_datetime(months["start"] + "-01")
    last = _parse_datetime(months["end"] + "-01")
    try:
        after = last.replace(year=last.year + 1, month=1) if last.month == 12 else last.replace(month=last.month + 1)
    except ValueError as error:
        raise ValueError("月份窗口超出可表示范围") from error
    return time_bounds(first.isoformat(), tz_name), time_bounds(after.isoformat(), tz_name)


def _time_conflict(times, start, end, policy_start, policy_end, month_bounds):
    for raw_key, absolute_key in (("start", "absolute_start"), ("deadline", "absolute_deadline")):
        raw, absolute = times.get(raw_key), times.get(absolute_key)
        if not raw or not absolute:
            continue
        lower = time_bounds(raw, times.get("timezone"))[0]
        upper = time_bounds(raw, times.get("timezone"), len(raw) == 10)[1]
        explicit = time_bounds(absolute, times.get("timezone"), raw_key == "deadline")
        if explicit[1] < lower or explicit[0] > upper:
            return "官方原始时间与绝对时间不一致，须复核后再确认开放状态"
    starts = [bounds for bounds in (start, policy_start, month_bounds[0] if month_bounds else None) if bounds]
    ends = [bounds for bounds in (end, policy_end, month_bounds[1] if month_bounds else None) if bounds]
    if starts and ends and max(bounds[0] for bounds in starts) > min(bounds[1] for bounds in ends):
        return "报名、政策或月份范围不存在共同有效窗口，须复核各项官方时间"
    return None

def temporal_status(doc, now=None):
    now = now or datetime.now(UTC)
    if now.tzinfo is None:
        now = now.replace(tzinfo=UTC)
    times = doc["time"]
    result = {"code": "unknown", "label": "开放状态待核验", "note": "没有足够官方时间证据", "deadline": times.get("deadline"), "timezone": times.get("timezone")}
    if times.get("conflict"):
        return {**result, "code": "uncertain", "label": "官方信息冲突 · 待复核", "note": times["conflict"]}
    if times.get("deadline_tentative"):
        end = time_bounds(times.get("absolute_deadline") or times.get("deadline"), times.get("timezone"), True)
        return {**result, "code": "uncertain", "label": "可能已结束 · 截止暂定" if end and now > end[1] else "开放线索 · 截止暂定", "possible_expired": bool(end and now > end[1]), "note": "官方正文将截止列为暂定；需要复核，不据此自动归档"}
    if times.get("confirmed") is not True:
        cycle_end = time_bounds(times.get("source_window", {}).get("end"), end=True)
        if cycle_end and now > cycle_end[1]:
            return {**result, "code": "uncertain", "label": "可能已结束 · 截止待核", "possible_expired": True, "note": "官方活动周期元数据已过，但报名截止 / 正文尚未核全；不自动归档"}
        return result
    tz = times.get("timezone")
    start = time_bounds(times.get("absolute_start") or times.get("start"), tz)
    end = time_bounds(times.get("absolute_deadline") or times.get("deadline"), tz, True)
    policy_start = time_bounds(times.get("policy_effective"), tz)
    policy_end = time_bounds(times.get("policy_end"), tz, True)
    months = times.get("month_period")
    month_bounds = _month_bounds(months, tz) if months else None
    if policy_end and now > policy_end[1]:
        return {**result, "code": "closed", "label": "政策已失效", "note": "官方明确的政策有效期已结束"}
    if policy_end and policy_end[0] < now <= policy_end[1]:
        return {**result, "code": "uncertain", "label": "政策有效期边界 · 时间待核", "note": "原文时区或本地时刻换算不唯一，不能确认仍有效或已失效"}
    conflict = _time_conflict(times, start, end, policy_start, policy_end, month_bounds)
    if conflict:
        return {**result, "code": "uncertain", "label": "官方时间组合冲突 · 待复核", "note": conflict}
    if end and now > end[1]:
        return {**result, "code": "closed", "label": "已截止", "note": "依据已核官方截止时间归档"}
    if end and end[0] < now <= end[1]:
        return {**result, "code": "uncertain", "label": "可能已截止", "note": "原文时区或本地时刻换算不唯一，处于截止边界"}
    if policy_start and now < policy_start[0]:
        return {**result, "code": "upcoming", "label": "尚未生效", "note": "政策生效日期在未来"}
    if policy_start and policy_start[0] <= now < policy_start[1]:
        return {**result, "code": "uncertain", "label": "政策生效边界 · 时间待核", "note": "原文时区或本地时刻换算不唯一，不能确认已经生效"}
    if start and now < start[0]:
        return {**result, "code": "upcoming", "label": "尚未开始", "note": "公告已发布，报名尚未开始"}
    if start and start[0] <= now < start[1]:
        return {**result, "code": "uncertain", "label": "可能刚开放", "note": "原文时区或本地时刻换算不唯一，处于开始边界"}
    if month_bounds:
        # Envelopes stay in memory; no invented day/time is saved or displayed.
        beginning, ending = month_bounds
        if now < beginning[0]:
            return {**result, "code": "upcoming", "label": "月份窗口尚未开始", "note": "官方只有月份，具体起始日与时刻未说明"}
        if beginning[0] <= now < beginning[1] or ending[0] <= now < ending[1]:
            return {**result, "code": "uncertain", "label": "月份边界 · 时间待核", "note": "时区或本地时刻存在歧义，不推定开放或截止"}
        if now >= ending[1]:
            return {**result, "code": "uncertain", "label": "月份窗口已过 · 截止待核", "possible_expired": True, "note": "只有月份精度，不据此生成截止时刻或自动归档"}
        refined = (times["mechanism"] == "ongoing" and times.get("evidence")) or (times["mechanism"] in ("fixed", "batches") and start and end) or (doc["kind"] == "rule_update" and policy_start)
        if not refined:
            return {**result, "code": "window", "label": "官方月份范围内 · 开放待核", "note": "只有月份精度；不表示已确认开放申请，加入仍需审核"}
    mechanism = times["mechanism"]
    if mechanism == "ongoing" and times.get("evidence"):
        return {**result, "code": "open", "label": "常年开放（官方明确）", "note": "仍需核对当前资格与生效规则"}
    if mechanism in ("fixed", "batches") and start and end:
        precise = all(len(value) > 10 and (datetime.fromisoformat(value.replace("Z", "+00:00")).tzinfo or tz) for value in (times.get("absolute_start") or times.get("start"), times.get("absolute_deadline") or times.get("deadline")))
        if not precise:
            return {**result, "code": "window", "label": "公告日期范围内 · 开放待核", "note": "官方日期支持处于范围内，但日时/时区精度不足，不冒充已确认开放"}
        return {**result, "code": "open", "label": "已核报名窗口内" if mechanism == "fixed" else "已核本期窗口内", "note": "依据官方明确时间；作品和账号资格另核"}
    if doc["kind"] == "rule_update" and policy_start:
        return {**result, "code": "effective", "label": "规则已生效", "note": "后续有效期未说明时仍需定期人工核对"}
    return {**result, "note": "时间机制未说明或本期起止不全；不推断无限期开放"}

def missing_fields(doc):
    checks = [("主办方", doc.get("organizer")), ("报名 / 加入入口", doc.get("entry_url")), ("公告发布时间", doc.get("publication_at")), ("资格", doc.get("eligibility")), ("操作步骤", doc.get("steps")), ("奖励细则", doc.get("rewards")), ("版权 / 首发条款", doc.get("risks")), ("本条核验时刻", doc.get("verified_at"))]
    times = doc["time"]
    checks.append(("开放时间机制的官方依据", times.get("confirmed")))
    if times["mechanism"] in ("fixed", "batches", "unspecified"):
        checks.extend([("开始时间", times.get("start")), ("截止时间", times.get("deadline"))])
    checks.append(("原文时区", times.get("timezone")))
    if doc["kind"] == "competition":
        checks.append(("作品要求", doc.get("work_requirements")))
    if doc["kind"] in ("creator_program", "rule_update"):
        checks.extend([("规则生效时间", times.get("policy_effective")), ("规则版本", times.get("policy_version"))])
    if doc["kind"] == "creator_program":
        names = {"join": "加入方式", "revenue": "收益计算", "settlement": "结算", "ongoing_requirements": "持续达标", "exit": "退出条件", "effective_version": "生效版本"}
        checks.extend((label, doc["program"].get(key)) for key, label in names.items())
    missing = [label for label, value in checks if not value]
    score = round(100 * (len(checks) - len(missing)) / len(checks))
    return missing, score

def match_score(doc, rules):
    haystack = json_text({k: doc.get(k) for k in ("title", "summary", "tags", "work_requirements", "platform", "kind")}).lower()
    hits = [word for word in rules["keywords"] if word.lower() in haystack]
    base = 35 if any(p in doc["platform"] for p in rules["preferred_platforms"]) else 15
    return min(100, base + len(hits) * 9), hits

def decorate(doc, rules, now=None):
    now = now or datetime.now(UTC)
    if now.tzinfo is None:
        now = now.replace(tzinfo=UTC)
    status = temporal_status(doc, now)
    missing, evidence_score = missing_fields(doc)
    score, hits = match_score(doc, rules)
    publication = time_bounds(doc.get("publication_at"), doc["time"].get("timezone"))
    new = bool(publication and publication[1] <= now and now - publication[1] <= timedelta(days=rules["new_publication_days"]))
    verified = time_bounds(doc.get("verified_at"))
    stale = bool(verified and now - verified[1] > timedelta(days=rules["stale_verification_days"]))
    future_verified = bool(verified and verified[0] > now)
    urgency = None
    end = time_bounds(doc["time"].get("absolute_deadline") or doc["time"].get("deadline"), doc["time"].get("timezone"), True)
    if end and doc["time"].get("confirmed") is True and not doc["time"].get("deadline_tentative") and not doc["time"].get("conflict") and status["code"] in ("open", "window", "upcoming") and now <= end[0] and end[1] - now <= timedelta(days=7):
        urgency = "7天内截止" if status["code"] == "open" else "公告7天内截止 · 开放待核" if status["code"] == "window" else "截止临近 · 开放条件待核"
    value = {**doc, "status": status, "deadline_urgency": urgency, "is_new_publication": new, "stale": stale, "verification_in_future": future_verified, "missing_fields": missing, "evidence_score": evidence_score, "match_score": score, "match_reasons": hits, "kind_label": KINDS[doc["kind"]], "mechanism_label": MECHANISMS[doc["time"]["mechanism"]]}
    value["priority"] = opportunity_priority(value)
    if urgency == "7天内截止" and not value["priority"]["public_time_reviewed"]:
        value["deadline_urgency"] = "公告7天内截止 · 开放待复核"
    return value

def opportunity_priority(item):
    """Public time/evidence priority; personal eligibility and fetch failures stay separate."""
    code = item["status"]["code"]
    role = item.get("assessment", {}).get("role")
    reviewed = item.get("origin") in ("manual_review", "manual_handoff") and item.get("verified_at") and any(e.get("excerpt") and e.get("url", "").startswith("https://") for e in item.get("evidence", []))
    trusted = bool(reviewed and item["time"].get("confirmed") is True and item["time"].get("evidence") and not item.get("stale") and not item.get("verification_in_future"))
    if code == "closed" or item.get("record_context") == "historical_reference":
        group, label = 5, "已结束 / 历史参考"
    elif role in ("restriction", "not_recommended", "due_diligence", "secondary", "historical"):
        group, label = 4, "限制 / 推广 / 尽调参考"
    elif trusted and code in ("open", "effective"):
        group, label = 0, "官方时间与机制已核"
    elif trusted and code == "window":
        group, label = 1, "公告窗口内 · 开放待核"
    elif trusted and code == "upcoming":
        group, label = 2, "尚未开始 / 生效"
    else:
        group, label = 3, "开放或规则待核"
    bounds = time_bounds(item["time"].get("absolute_deadline") or item["time"].get("deadline"), item["time"].get("timezone"), True)
    deadline = bounds[1].timestamp() if bounds and item["time"].get("confirmed") is True and not item["time"].get("deadline_tentative") and not item["time"].get("conflict") else None
    verified = time_bounds(item.get("verified_at"))
    published = time_bounds(item.get("publication_at"), item["time"].get("timezone"))
    return {"group": group, "label": label, "public_time_reviewed": trusted, "deadline_order": deadline, "verified_order": verified[1].timestamp() if verified else None, "publication_order": published[1].timestamp() if published else None, "note": "公开时间/机制核验与个人账号、AI作品资格分别判断；排序不代表报名通过"}

def field_changes(before, after, path=""):
    changes = []
    for key in sorted(set(before) | set(after)):
        name = f"{path}.{key}" if path else key
        old, new = before.get(key), after.get(key)
        if isinstance(old, dict) and isinstance(new, dict):
            changes.extend(field_changes(old, new, name))
        elif old != new:
            changes.append({"field": name, "before": old, "after": new})
    return changes
