"""Local work profiles and evidence-backed, deliberately limited fit checks.

``fit_rules`` is a mapping from a supported rule name to
``{value, evidence: {url, verified_at, scope, official: True}}``.  Evidence
scope must equal the document's edition; a rule from another edition or track
cannot reject a work.  ``applies_to`` defaults to ``work``; account and program
conditions remain unresolved.  No rule is inferred from free-form text.
"""
from __future__ import annotations

import copy
import json
import math
from datetime import datetime, timezone

from .model import canonical_url, json_text


PROFILE_FIELDS = (
    "duration_seconds", "is_student", "ai_tools", "is_published",
    "uses_ai", "ai_percent",
)
BOOLEAN_FIELDS = ("is_student", "is_published", "uses_ai")
LABELS = {
    "duration_min_seconds": "最低作品时长",
    "duration_max_seconds": "最高作品时长",
    "student_required": "学生身份",
    "required_tools": "指定工具",
    "published_allowed": "已公开作品",
    "ai_allowed": "AI 使用限制",
    "ai_required": "AI 使用要求",
    "ai_min_percent": "最低 AI 占比",
    "ai_max_percent": "最高 AI 占比",
}
STATUS_LABELS = {
    "matched": "符合已核作品条件",
    "mismatched": "不符合已核作品条件",
    "unknown": "待确认",
}
FIT_NOTE = "仅比较带官方出处的作品条件；账号资格、报名审核、首次入选及长期履约条件仍待确认。"


def _number(value):
    return type(value) is int or (type(value) is float and math.isfinite(value))


def normalize_profile(payload):
    """Validate a complete replacement profile; missing fields stay unknown."""
    if not isinstance(payload, dict):
        raise ValueError("作品条件必须是 JSON 对象")
    extra = set(payload) - set(PROFILE_FIELDS)
    if extra:
        raise ValueError("未知作品条件字段：" + "、".join(sorted(map(str, extra))))
    result = {name: None for name in PROFILE_FIELDS}
    result.update(copy.deepcopy(payload))
    for name in BOOLEAN_FIELDS:
        if result[name] is not None and type(result[name]) is not bool:
            raise ValueError(f"{name} 必须是 true、false 或 null（待确认）")
    duration = result["duration_seconds"]
    if duration is not None and (not _number(duration) or duration <= 0):
        raise ValueError("作品时长必须是大于 0 的有限秒数，或 null（待确认）")
    percent = result["ai_percent"]
    if percent is not None and (not _number(percent) or not 0 <= percent <= 100):
        raise ValueError("AI 占比必须是 0 至 100 的有限数字，或 null（待确认）")
    tools = result["ai_tools"]
    if tools is not None:
        if not isinstance(tools, list) or len(tools) > 30:
            raise ValueError("AI 工具必须是最多 30 个名称的数组，或 null（待确认）")
        normalized, seen = [], set()
        for tool in tools:
            if not isinstance(tool, str) or not tool.strip() or len(tool.strip()) > 100:
                raise ValueError("每个 AI 工具名称须为 1 至 100 个字符")
            name = tool.strip()
            if name.casefold() not in seen:
                normalized.append(name)
                seen.add(name.casefold())
        result["ai_tools"] = normalized
    if result["uses_ai"] is False and (result["ai_tools"] or (percent is not None and percent > 0)):
        raise ValueError("未使用 AI 与已填写的 AI 工具或占比冲突，请核对作品条件")
    return result


def get_profile(store):
    """Read only local settings. An unreadable profile cannot confirm any fact."""
    with store.connection() as conn:
        row = conn.execute("SELECT value FROM settings WHERE key='work_profile'").fetchone()
    if row:
        try:
            return normalize_profile(json.loads(row[0]))
        except (ValueError, TypeError, json.JSONDecodeError):
            pass
    return normalize_profile({})


def save_profile(store, payload):
    """Atomically replace the local profile after all validation succeeds."""
    profile = normalize_profile(payload)
    with store.connection() as conn:
        conn.execute(
            "INSERT INTO settings(key,value) VALUES('work_profile',?) "
            "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            (json_text(profile),),
        )
    return profile


def _evidence(rule, doc):
    evidence = rule.get("evidence")
    if not isinstance(evidence, dict) or evidence.get("official") is not True:
        return None, "缺少已核官方规则出处，不据此排除作品"
    try:
        url = canonical_url(evidence.get("url", ""))
        verified_at = evidence.get("verified_at")
        if not isinstance(verified_at, str) or len(verified_at) < 10:
            raise ValueError("missing date")
        verified = datetime.fromisoformat(verified_at.replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return None, "官方出处的链接或核验日期无效，需复核"
    scope = evidence.get("scope")
    if not isinstance(scope, str) or not scope.strip():
        return None, "官方出处未注明适用届次或赛道，需复核"
    safe = {**copy.deepcopy(evidence), "url": url}
    if verified.date() > datetime.now(timezone.utc).date():
        return safe, "核验日期晚于当前日期，不能作为已核规则排除作品"
    if not doc.get("edition") or scope != doc["edition"]:
        return safe, "规则适用届次或赛道与此条目不一致，需复核"
    linked = {doc.get("official_url")}
    linked.update(item.get("url") for item in doc.get("evidence", []) if isinstance(item, dict))
    official_urls = set()
    for candidate in linked:
        try:
            official_urls.add(canonical_url(candidate))
        except (ValueError, TypeError):
            pass
    if url not in official_urls:
        return safe, "规则出处尚未关联到此活动，不能只凭相同年份排除作品"
    return safe, None


def _ai_use(profile):
    if profile["uses_ai"] is not None:
        return profile["uses_ai"]
    # Listing an AI tool or a positive AI proportion explicitly confirms use.
    # An empty tool list alone does not establish that a work has no AI use.
    if profile["ai_tools"] or (profile["ai_percent"] is not None and profile["ai_percent"] > 0):
        return True
    return None


def _check(field, rule, doc, profile):
    user_field = {
        "duration_min_seconds": "duration_seconds", "duration_max_seconds": "duration_seconds",
        "student_required": "is_student", "required_tools": "ai_tools",
        "published_allowed": "is_published", "ai_allowed": "uses_ai",
        "ai_required": "uses_ai", "ai_min_percent": "ai_percent", "ai_max_percent": "ai_percent",
    }.get(field)
    actual = profile.get(user_field) if user_field else None
    if field in ("ai_allowed", "ai_required"):
        actual = _ai_use(profile)
    result = {
        "field": field, "status": "unknown", "label": LABELS.get(field, "其他条件"),
        "user_value": copy.deepcopy(actual),
        "rule_value": copy.deepcopy(rule.get("value")) if isinstance(rule, dict) else copy.deepcopy(rule),
        "evidence": None, "expected": None, "applicable": True,
    }
    if not isinstance(rule, dict):
        return {**result, "reason": "规则缺少结构化值与官方出处，需复核"}
    evidence, issue = _evidence(rule, doc)
    result["evidence"] = evidence
    applies_to = rule.get("applies_to", "work")
    if applies_to in ("account", "program"):
        return {**result, "applicable": False, "reason": "账号或长期计划条件不能仅凭作品资料判断"}
    if applies_to not in ("work", "profile"):
        return {**result, "reason": "规则适用对象未明确，不能默认忽略此条件"}
    unsupported = set(rule) - {"value", "evidence", "applies_to", "inclusive", "mode"}
    if unsupported:
        return {**result, "reason": "规则还含未能自动核对的限定条件（" + "、".join(sorted(map(str, unsupported))) + "），需确认赛道、资格日期或工具名称"}
    if issue:
        return {**result, "reason": issue}
    if field not in LABELS:
        return {**result, "reason": "此条件尚未建立可核对的作品字段，需另行确认"}
    expected = rule.get("value")
    if field.startswith("duration_") or field in ("ai_min_percent", "ai_max_percent"):
        duration_rule = field.startswith("duration_")
        valid = _number(expected) and (expected >= 0 if duration_rule else 0 <= expected <= 100)
        inclusive = rule.get("inclusive", True)
        if not valid or type(inclusive) is not bool:
            return {**result, "reason": "规则数值或边界含义无效，需复核"}
        minimum = field in ("duration_min_seconds", "ai_min_percent")
        unit = "seconds" if duration_rule else "percent"
        result["expected"] = {f"{'min' if minimum else 'max'}_{unit}": expected, "inclusive": inclusive}
        if actual is None:
            return {**result, "reason": "尚未确认作品时长" if duration_rule else "尚未确认作品 AI 占比"}
        accepted = (actual >= expected if inclusive else actual > expected) if minimum else (actual <= expected if inclusive else actual < expected)
        return {**result, "status": "matched" if accepted else "mismatched", "reason": "已填写数值符合官方边界" if accepted else "已填写数值超出官方允许范围"}
    if field == "required_tools":
        mode = rule.get("mode", "all")
        if not isinstance(expected, list) or not expected or any(not isinstance(tool, str) or not tool.strip() for tool in expected) or mode not in ("all", "any"):
            return {**result, "reason": "指定工具或组合规则不明确，需复核"}
        names = [tool.strip() for tool in expected]
        result["expected"] = {"tools": names, "mode": mode}
        if actual is None:
            return {**result, "reason": "尚未确认作品使用的工具"}
        actual_names = {tool.casefold() for tool in actual}
        found = [tool.casefold() in actual_names for tool in names]
        accepted = all(found) if mode == "all" else any(found)
        missing = [tool for tool in names if tool.casefold() not in actual_names]
        return {**result, "status": "matched" if accepted else "mismatched", "reason": "已填写工具符合官方要求" if accepted else "已填写工具未满足官方要求：" + "、".join(missing)}
    if type(expected) is not bool:
        return {**result, "reason": "规则必须明确为允许或禁止，需复核"}
    result["expected"] = {"required": expected} if field in ("student_required", "ai_required") else {"allowed": expected}
    # An explicitly permissive rule covers both possible profile values.
    restrictive = expected if field in ("student_required", "ai_required") else not expected
    if not restrictive:
        return {**result, "status": "matched", "reason": "官方此项不设限制"}
    if actual is None:
        return {**result, "reason": "个人作品条件尚未确认"}
    accepted = actual if field in ("student_required", "ai_required") else not actual
    return {**result, "status": "matched" if accepted else "mismatched", "reason": "已填写条件符合官方要求" if accepted else "已填写条件与官方要求不符"}


def evaluate_fit(doc, profile):
    """Return work fit only, never a score or a declaration of admission."""
    profile = normalize_profile(profile)
    rules = doc.get("fit_rules")
    if not isinstance(rules, dict) or not rules:
        checks = [{
            "field": "rules", "status": "unknown", "label": "作品条件",
            "user_value": None, "rule_value": None, "evidence": None,
            "expected": None, "applicable": True,
            "reason": "没有带官方出处且适用于此届次或赛道的结构化作品规则",
        }]
    else:
        checks = []
        for field, rule in rules.items():
            if field == "alternatives":
                checks.append({
                    "field": field, "status": "unknown", "label": "赛道条件",
                    "user_value": None, "rule_value": copy.deepcopy(rule), "evidence": None,
                    "expected": None, "applicable": True,
                    "reason": "不同赛道的条件需分别核对；尚未确认适用赛道，不合并门槛或默认任选赛道",
                })
            else:
                checks.append(_check(field, rule, doc, profile))
        # Contradictory limits may be a merge of separate tracks. Neither is a
        # safe exclusion until the rule collection has been reviewed.
        for lower, upper in (("duration_min_seconds", "duration_max_seconds"), ("ai_min_percent", "ai_max_percent")):
            bounds = {check["field"]: check for check in checks if check["field"] in (lower, upper) and check["evidence"] and check["expected"]}
            if lower in bounds and upper in bounds:
                lo, hi = bounds[lower], bounds[upper]
                impossible = lo["rule_value"] > hi["rule_value"] or (lo["rule_value"] == hi["rule_value"] and (not lo["expected"]["inclusive"] or not hi["expected"]["inclusive"]))
                if impossible:
                    for check in (lo, hi):
                        check.update(status="unknown", reason="官方结构化上下限互相冲突，需复核适用赛道")
        ai_rules = {check["field"]: check for check in checks if check["field"] in ("ai_required", "ai_allowed", "ai_min_percent") and check["evidence"] and check["expected"]}
        if "ai_required" in ai_rules and "ai_allowed" in ai_rules and ai_rules["ai_required"]["rule_value"] is True and ai_rules["ai_allowed"]["rule_value"] is False:
            for check in ai_rules.values():
                check.update(status="unknown", reason="AI 必须参与与禁止参与的规则互相冲突，需复核适用赛道")
        if "ai_allowed" in ai_rules and "ai_min_percent" in ai_rules and ai_rules["ai_allowed"]["rule_value"] is False and ai_rules["ai_min_percent"]["rule_value"] > 0:
            for check in (ai_rules["ai_allowed"], ai_rules["ai_min_percent"]):
                check.update(status="unknown", reason="禁止 AI 参与与最低 AI 占比互相冲突，需复核适用赛道")
    # Free-form official requirements cannot be established by these six input
    # fields. Keep successful checks, but do not turn their partial coverage
    # into a declaration that all known work requirements have been satisfied.
    work_requirements = doc.get("work_requirements")
    if isinstance(work_requirements, list) and work_requirements:
        checks.append({
            "field": "work_coverage", "status": "unknown", "label": "其他作品要求待确认",
            "user_value": None, "rule_value": copy.deepcopy(work_requirements),
            "evidence": None, "expected": None, "applicable": True,
            "reason": "已填写条件可逐项对照；作品题材、规格、创作方式、权属或其他要求未被这六项资料完整覆盖，仍需按官方全文确认。",
        })
    applicable = [check for check in checks if check["applicable"]]
    status = "mismatched" if any(check["status"] == "mismatched" for check in applicable) else "matched" if applicable and all(check["status"] == "matched" for check in applicable) else "unknown"
    label = "已填条件相符，其他待确认" if status == "unknown" and any(check["status"] == "matched" for check in applicable) else STATUS_LABELS[status]
    return {"status": status, "label": label, "checks": checks, "account_status": "unknown", "note": FIT_NOTE}
