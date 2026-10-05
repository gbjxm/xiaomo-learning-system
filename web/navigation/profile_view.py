"""Read-only personal profile projections over the existing source files and room.

This module owns no data store. User corrections remain normal room records,
with a narrow source pointer; source Markdown and adopted routes are never edited.
"""
from __future__ import annotations

from copy import deepcopy
from datetime import date, datetime, timedelta, timezone
import hashlib
import re

SCHEMA = "xiaomo.profile-correction/v1"
SECTIONS = {"about": "关于我", "values": "我在意什么", "current": "目前情况"}
SOURCES = (
    {"id": "learning-personal", "system": "learning", "path": "运行记录/个人情况.md", "label": "学习系统 · 个人情况", "default": "about"},
    {"id": "navigation-current", "system": "navigation", "path": "当前处境.md", "label": "领航室 · 当前处境", "default": "current"},
    {"id": "navigation-values", "system": "navigation", "path": "人生罗盘.md", "label": "领航室 · 人生罗盘", "default": "values"},
)
MAINTENANCE = re.compile(r"更新方式|维护约定|建设范围|系统状态|^本次已明确$|^当前明确的系统期待$|^当前开放的内容$|^尚未建立的判断$|读写规则|保存协议")
DATE = re.compile(r"(?<!\d)(\d{4}-\d{2}-\d{2})(?!\d)")


def digest(value):
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def explicit_date(value):
    for found in DATE.findall(value):
        try:
            date.fromisoformat(found)
            return found
        except ValueError:
            continue
    return None


def record_date(record):
    if explicit_date(record.get("occurred_on") or ""):
        return record["occurred_on"], "经历/补充日期"
    received = record.get("received_at")
    try:
        instant = datetime.fromisoformat(received.replace("Z", "+00:00"))
        if instant.tzinfo is None:
            return None, "日期未注明"
        return instant.astimezone(timezone(timedelta(hours=8))).date().isoformat(), "保存日期（北京时间）"
    except (AttributeError, ValueError, TypeError):
        return None, "日期未注明"


def plain(value):
    value = re.sub(r"^\s*(?:[-*+]\s+|\d+[.)]\s+|>\s?)", "", value)
    value = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", value)
    return value.replace("**", "").replace("`", "").strip()


def section_for(source, heading):
    if source["id"] == "navigation-values":
        return "values"
    if re.search(r"偏好|兴趣|动机|在意|价值|希望获得|未来方向|工作取舍", heading):
        return "values"
    if re.search(r"当前|现实|投入|预算|资金|阶段|近期|后续打算|主要课程|观看经历", heading):
        return "current"
    return source["default"]


def source_items(source, content):
    """Use existing headings and exact text, not inferred personal attributes."""
    items, headings, block, start, provenance_date, last_section_date = [], [], [], 0, None, None
    occurrences = {}
    initial_match = re.search(r"(?:初始资料日期\s*[:：]|建立于\s*)(\d{4}-\d{2}-\d{2})", content)
    updated_match = re.search(r"(?:最近补充(?:日期)?|最近更新)\s*[:：为]?\s*(\d{4}-\d{2}-\d{2})", content)
    initial_date = explicit_date(initial_match[1]) if initial_match else None
    updated_date = explicit_date(updated_match[1]) if updated_match else None

    def emit():
        nonlocal block
        if not block:
            return
        raw = "\n".join(block).strip()
        block = []
        heading = " / ".join(title for _, title in headings)
        if any(MAINTENANCE.search(title) for _, title in headings):
            return
        value = "\n".join(plain(line) for line in raw.splitlines()).strip()
        if not value or re.match(r"^(?:来源|原权威来源|最近更新|首次整理|初始资料日期|建立于|本页|本文|以上|更新方式|原话见|关键原话见)", value):
            return
        if not any(level >= 2 for level, _ in headings) and re.match(r"^(?:用来保留|用于保存|用于记录|这份资料|本文件)", value):
            return
        if len(value) > 16000:
            # Keep a large paragraph as a bounded excerpt and mark the limitation.
            shown, excerpted = value[:16000], True
        else:
            shown, excerpted = value, False
        anchor = source["id"] + "\n" + heading + "\n" + value
        occurrence = occurrences.get(anchor, 0)
        occurrences[anchor] = occurrence + 1
        key = "profile-source-" + digest(anchor + "\n" + str(occurrence))[:28]
        heading_day = next((explicit_date(title) for _, title in reversed(headings) if explicit_date(title)), None)
        source_day = heading_day or provenance_date or initial_date
        date_basis = "原小节明示日期" if heading_day else "来源说明明示日期" if provenance_date else "资料初始日期（不等于经历日期）" if initial_date else "来源未注明日期"
        items.append({"id": key, "text": shown, "source": source["label"] + (" · " + heading if heading else "") + f" · L{start}",
                      "sourceDate": source_day, "dateBasis": date_basis, "kind": "source_summary",
                      "sectionId": section_for(source, heading), "canCorrect": not excerpted, "current": True, "supersededBy": [],
                      "excerpted": excerpted,
                      "sourceRef": {"system": source["system"], "sourceId": source["id"], "path": source["path"], "heading": heading,
                                    "line": start, "textHash": digest(value), "initialDate": initial_date, "lastUpdatedDate": updated_date}})

    for number, line in enumerate(content.splitlines(), 1):
        heading_match = re.match(r"^(#{1,6})\s+(.+?)\s*$", line)
        if heading_match:
            emit()
            level, title = len(heading_match[1]), heading_match[2]
            last_section_date = next((explicit_date(old_title) for _, old_title in reversed(headings) if explicit_date(old_title)), None) or provenance_date or initial_date
            if level <= 2:
                provenance_date = None
            headings = [(old_level, old_title) for old_level, old_title in headings if old_level < level] + [(level, title)]
            continue
        if not line.strip() or line.strip() == "---":
            emit()
            continue
        if line.strip().startswith("来源同上"):
            emit()
            provenance_date = last_section_date
            line = re.sub(r"^\s*来源同上[^。]*。\s*", "", line, count=1)
            if not line.strip() or line.strip().startswith("来源同上"):
                continue
        if re.match(r"^\s*(?:来源|原权威来源|最近更新|最近补充|首次整理|初始资料日期|建立于)[:：\s]", line):
            emit()
            # A file's latest edit is freshness metadata, not each statement's date.
            if not re.search(r"最近补充|最近更新|初始资料日期|建立于", line):
                provenance_date = explicit_date(line) or provenance_date
            continue
        if re.match(r"^\s*(?:[-*+]\s+|\d+[.)]\s+)", line):
            emit()
        if not block:
            start = number
        block.append(line)
    emit()
    return items


def profile_metadata(record):
    meta = record.get("profile")
    if (not isinstance(meta, dict) or meta.get("schema") != SCHEMA or meta.get("sectionId") not in SECTIONS
            or record.get("kind") != "user_report" or not isinstance(meta.get("targetId"), (str, type(None)))):
        return None
    return meta


def personal_record_item(record):
    day, basis = record_date(record)
    meta = profile_metadata(record)
    return {"id": record["id"], "text": record["content"], "source": record["source"], "sourceDate": day, "dateBasis": basis,
            "receivedAt": record.get("received_at"), "kind": record["kind"], "sectionId": meta["sectionId"] if meta else "current",
            "canCorrect": record["kind"] == "user_report", "current": True, "supersededBy": [],
            "sourceRef": {"system": "navigation", "recordId": record["id"]},
            **({"targetId": meta.get("targetId"), "changeType": "correction" if meta.get("targetId") else "supplement",
                "target": deepcopy(meta.get("target"))} if meta else {})}


def analysis_items(state, since=None, until=None, query=""):
    entries = []
    for record in state["records"]:
        if record.get("kind") != "ai_inference":
            continue
        day, basis = record_date(record)
        if since and (not day or day < since) or until and (not day or day > until):
            continue
        if query and query.casefold() not in (record["content"] + "\n" + record["source"]).casefold():
            continue
        entries.append({"id": record["id"], "text": record["content"], "kind": "ai_inference", "source": record["source"],
                        "sourceDate": day, "dateBasis": basis, "receivedAt": record.get("received_at"),
                        "relatedIds": list(record.get("related_ids", []))})
    entries.sort(key=lambda item: (item["sourceDate"] or "", item["receivedAt"] or "", item["id"]), reverse=True)
    return entries


def build_profile(state, identity, as_of, read_source):
    items, warnings = [], []
    for source in SOURCES:
        content = read_source(source)
        if content is None:
            warnings.append({"code": "PROFILE_SOURCE_MISSING", "message": source["label"] + "暂未读到；没有补造个人背景。", "sourceId": source["id"]})
            continue
        parsed = source_items(source, content)
        items.extend(parsed)
        if any(item["excerpted"] for item in parsed):
            warnings.append({"code": "PROFILE_SOURCE_EXCERPT", "message": source["label"] + "存在较长段落，页面仅显示有标记的节选；不能按节选更正整段。"})
    corrections = []
    for record in state["records"]:
        meta = profile_metadata(record)
        if not meta:
            # Historical experiences, ideas and feelings remain journey evidence.
            # Only deliberate profile additions belong to the current personal view.
            continue
        item = personal_record_item(record)
        if item["sourceDate"] and item["sourceDate"] > as_of:
            continue
        items.append(item)
        corrections.append(item)
    item_map = {item["id"]: item for item in items}
    for correction in corrections:
        target_id = correction.get("targetId")
        if not target_id:
            continue
        target = item_map.get(target_id)
        if target is None and isinstance(correction.get("target"), dict):
            target = deepcopy(correction["target"])
            target.update(id=target_id, canCorrect=False, current=False, supersededBy=[], sourceChanged=True)
            if target.get("sectionId") in SECTIONS and isinstance(target.get("text"), str):
                items.append(target)
                item_map[target_id] = target
            else:
                target = None
        if target:
            target["supersededBy"].append(correction["id"])
            target["current"], target["canCorrect"] = False, False
    # The room's native same-kind correction relation also keeps older reports historical.
    for record in state["records"]:
        if record["id"] in item_map and record.get("corrects_id") in item_map:
            target = item_map[record["corrects_id"]]
            if record["id"] not in target["supersededBy"]:
                target["supersededBy"].append(record["id"])
            target["current"], target["canCorrect"] = False, False
    for route in state.get("routes", []):
        if route.get("status") != "adopted":
            continue
        items.append({"id": "profile-route-" + route["id"], "text": route["title"] + "\n" + route.get("purpose", ""),
                      "source": "领航室 · 已采用阶段（只读；不通过资料更正改变采用状态）", "sourceDate": explicit_date(route.get("updated_at", "")) or explicit_date(route.get("created_at", "")),
                      "kind": "adopted_stage", "sectionId": "current", "canCorrect": False, "current": True, "supersededBy": [],
                      "sourceRef": {"system": "navigation", "routeId": route["id"]}})
    for item in items:
        if not item.get("current", True):
            item["status"] = "historical"
        else:
            item["status"] = "current"
    return {"revision": state["revision"], "identity": identity, "asOf": as_of,
            "sections": [{"id": key, "title": title, "items": sorted((item for item in items if item["sectionId"] == key),
                           key=lambda item: (not bool(item.get("changeType")), not item.get("current", True), item.get("sourceDate") or ""))} for key, title in SECTIONS.items()],
            "corrections": sorted(corrections, key=lambda item: (item["sourceDate"] or "", item.get("receivedAt") or "", item["id"]), reverse=True),
            "analyses": analysis_items(state, until=as_of), "warnings": warnings}


def current_projection(profile, section=None, source_id=None):
    """Only the latest specific assertions are current; no group-wide replacement."""
    lines = ["个人资料只读视图：来源摘要不是已核事实；本人补充按所示日期理解。",
             "已更正的原条目留在历史，不作为与更正同等的当前结论；不凭一条补充覆盖整组资料。"]
    latest = [item for item in profile["corrections"] if item.get("current", True) and (not section or item["sectionId"] == section)]
    if latest:
        lines.append("【本人最新补充/更正；优先核对其指向的旧条目】")
    for item in latest:
        relation = "；更正 " + item["targetId"] if item.get("targetId") else "；独立补充"
        lines.append(f"[{item['id']} | {item['kind']} | {item.get('sourceDate') or '日期未注明'}{relation}] {item['text']}\n来源：{item['source']}")
    for block in profile["sections"]:
        if section and block["id"] != section:
            continue
        chosen = [item for item in block["items"] if item.get("current", True) and not item.get("changeType") and
                  (not source_id or item.get("sourceRef", {}).get("sourceId") == source_id)]
        if chosen:
            lines.append("【" + block["title"] + "】")
        for item in chosen:
            relation = "；更正 " + item["targetId"] if item.get("targetId") else ""
            lines.append(f"[{item['id']} | {item['kind']} | {item.get('sourceDate') or '日期未注明'}{relation}] {item['text']}\n来源：{item['source']}")
    return "\n\n".join(lines)
