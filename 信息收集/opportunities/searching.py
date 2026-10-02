"""Read-only, evidence-aware search and saved dynamic filters.

The small local library is searched directly in SQLite; no network request,
external index, HTML execution, or inferred qualification is involved.
"""
from __future__ import annotations

import json
import uuid

from .model import canonical_url


MAX_QUERY = 240
MAX_TERMS = 12
MAX_MATCHES = 8
VIEW_KIND = "saved_views"
FILTERS = {
    "view": {"opportunities", "starred", "archive"},
    "kind": {"all", "competition", "creator_program", "limited_benefit", "rule_update"},
    "status": {"all", "open", "window", "upcoming", "unknown", "effective", "uncertain", "closed", "history"},
    "reward": {"all", "cash", "credits", "compute", "traffic", "promotion", "screening", "other"},
    "sort": {"validity", "deadline", "publication", "match"},
    "fit": {"all", "matched", "mismatched", "unknown"},
}
FIELD_LABELS = {
    "title": "机会名称", "platform": "平台", "organizer": "主办方", "edition": "年度 / 轮次",
    "summary": "简介", "tags": "标签", "eligibility": "参与资格", "work_requirements": "作品要求",
    "steps": "投稿 / 加入步骤", "rewards": "奖励及条件", "cash_tiers": "现金档位",
    "canvas_requirements": "画布加奖条件", "risks": "版权及参与限制", "program": "长期计划条款",
    "time": "官方时间记录", "assessment": "AI资格与用途", "reward_conflict": "奖励口径冲突",
    "fees": "报名费用", "importance": "关注依据", "fit_rules": "已整理作品规则",
    "official_url": "官方页面地址", "entry_url": "报名入口地址",
}


def query_terms(query):
    if not isinstance(query, str) or len(query) > MAX_QUERY:
        raise ValueError(f"搜索词最多 {MAX_QUERY} 字")
    if any(ord(char) < 32 and char not in "\n\r\t" or 0xD800 <= ord(char) <= 0xDFFF for char in query):
        raise ValueError("搜索词含无效字符")
    terms = list(dict.fromkeys(part.casefold() for part in query.strip().split()))
    if len(terms) > MAX_TERMS:
        raise ValueError(f"搜索最多 {MAX_TERMS} 个词；多个词用空格分隔")
    return terms


def _text(value):
    """Only display values are indexed; schema/property names are not evidence."""
    if isinstance(value, str):
        return value
    if type(value) in (int, float):
        return str(value)
    if isinstance(value, list):
        return "\n".join(filter(None, (_text(part) for part in value)))
    if isinstance(value, dict):
        return "\n".join(filter(None, (_text(part) for part in value.values())))
    return ""


def _segment(kind, label, text, *, historical=False, **extra):
    return {"kind": kind, "label": label, "text": str(text or ""), "historical": historical, **extra}


def _document_segments(doc, note="", *, historical=False, version=None, at=None):
    prefix = "旧版记录 · " if historical else "当前记录 · "
    result = [_segment("version" if historical else "record", prefix + label, _text(doc.get(field)),
                       historical=historical, version=version, at=at, source_url=doc.get("official_url"))
              for field, label in FIELD_LABELS.items() if _text(doc.get(field))]
    for evidence in doc.get("evidence", []):
        if not isinstance(evidence, dict):
            continue
        origin = evidence.get("origin", doc.get("origin"))
        method = "人工整理证据" if origin in {"manual_review", "manual_handoff"} else "提取 / 待核证据"
        text = "\n".join(part for part in (evidence.get("excerpt"), evidence.get("note")) if isinstance(part, str))
        result.append(_segment("evidence", ("旧版 · " if historical else "") + method, text,
                               historical=historical, version=version, at=evidence.get("observed_at", at),
                               source_url=evidence.get("url", doc.get("official_url"))))
    if note and not historical:
        result.append(_segment("note", "个人笔记 · 不属于官方规则", note))
    return result


def _safe_canonical(value):
    try:
        return canonical_url(value)
    except (TypeError, ValueError):
        return None


def _snippet(text, terms, length=260):
    lower = text.casefold()
    positions = [lower.find(term) for term in terms if term in lower]
    start = max(0, min(positions, default=0) - 70)
    stop = min(len(text), start + length)
    return ("…" if start else "") + text[start:stop] + ("…" if stop < len(text) else "")


def validate_record(data):
    """Validate saved filter payloads for both writes and portable backups."""
    if not isinstance(data, dict) or set(data) != {"name", "filters"}:
        raise ValueError("保存视图仅接受名称和筛选条件")
    if not isinstance(data["name"], str) or not data["name"].strip() or len(data["name"]) > 60:
        raise ValueError("视图名称须为 1–60 字")
    filters = data["filters"]
    allowed = set(FILTERS) | {"search", "platform", "include_history"}
    if not isinstance(filters, dict) or set(filters) != allowed:
        raise ValueError("保存视图的筛选字段不完整或含未知字段")
    for key, options in FILTERS.items():
        if not isinstance(filters[key], str) or filters[key] not in options:
            raise ValueError("无效筛选条件：" + key)
    if not isinstance(filters["platform"], str) or not filters["platform"].strip() or len(filters["platform"]) > 120:
        raise ValueError("平台筛选须为 1–120 字")
    query_terms(filters["search"])
    if type(filters["include_history"]) is not bool:
        raise ValueError("历史搜索开关必须是布尔值")
    return {"name": data["name"].strip(), "filters": dict(filters)}


class SearchService:
    def __init__(self, store):
        self.store = store

    def search(self, query, include_history=False):
        terms = query_terms(query)
        if type(include_history) is not bool:
            raise ValueError("历史搜索开关必须是布尔值")
        from .workspace import records
        with self.store.connection() as conn:
            # A coherent read transaction also excludes a mixed before/after view
            # when another local process imports documents during this search.
            conn.execute("BEGIN")
            items = [dict(row) for row in conn.execute("SELECT id,document,version,note FROM opportunities ORDER BY id")]
            observations = [dict(row) for row in conn.execute("SELECT id,source_id,url,body,last_seen_at,quality FROM observations ORDER BY last_seen_at DESC,id DESC")]
            versions = ([dict(row) for row in conn.execute("SELECT opportunity_id,version,at,snapshot FROM versions ORDER BY version DESC")]
                        if include_history else [])
            attachments = records(conn, "attachments")
            field_evidence = records(conn, "field_evidence")
            merge_records = records(conn, "merges")
        by_url = {}
        for observation in observations:
            key = (observation["source_id"], _safe_canonical(observation["url"]))
            if key[1]:
                by_url.setdefault(key, []).append(observation)
        by_item_versions = {}
        for version in versions:
            by_item_versions.setdefault(version["opportunity_id"], []).append(version)
        by_item_attachments, by_item_evidence = {}, {}
        for record in attachments:
            by_item_attachments.setdefault(record["data"]["item_id"], []).append(record)
        for record in field_evidence:
            by_item_evidence.setdefault(record["data"]["item_id"], []).append(record)
        results, attachment_count, missing_text = [], 0, 0
        for item in items:
            doc, version = json.loads(item["document"]), item["version"]
            segments = _document_segments(doc, item["note"], version=version)
            links = {doc.get("official_url"), doc.get("entry_url")} | {value.get("url") for value in doc.get("evidence", []) if isinstance(value, dict)}
            urls = {value for value in (_safe_canonical(url) for url in links) if value}
            linked_keys = [(doc["source_id"], url) for url in sorted(urls)]
            # Explicit evidence links may come from another registered source.
            # Exact URL equality is required; same-platform/homepage guesses are
            # deliberately not used as evidence bindings.
            linked_keys += [key for key in by_url if key[1] in urls and key not in linked_keys]
            for key in linked_keys:
                for index, observation in enumerate(by_url.get(key, [])):
                    if index and not include_history:
                        break
                    segments.append(_segment("observation", "旧抓取正文 · 非现行规则" if index else "最近抓取正文 · 机器提取未代替规则核验",
                                             observation["body"], historical=bool(index), at=observation["last_seen_at"],
                                             source_url=observation["url"], observation_id=observation["id"], quality=observation["quality"]))
            for record in by_item_attachments.get(item["id"], []):
                data = record["data"]
                historical = data.get("item_version") != version
                if historical and not include_history:
                    continue
                attachment_count += 1
                content = data.get("text") if data.get("text_state") in {"user_supplied", "plain_text"} else ""
                if not isinstance(content, str) or not content.strip():
                    missing_text += 1
                    content = ""
                label = ("旧版附件 · " if historical else "附件 · ") + str(data.get("filename", "未命名附件"))
                label += " · 个人转录" if data.get("text_state") == "user_supplied" else " · 可读文本" if content else " · 无可检索正文"
                if data.get("verification") != "manual_checked":
                    label += " · 待核"
                segments.append(_segment("attachment", label, "\n".join(filter(None, (data.get("filename"), content, data.get("note")))),
                                         historical=historical, at=data.get("observed_at"), source_url=data.get("source_url"),
                                         attachment_id=record["id"], version=data.get("item_version"), text_state=data.get("text_state")))
            for record in by_item_evidence.get(item["id"], []):
                data = record["data"]
                historical = data.get("item_version") != version
                if historical and not include_history:
                    continue
                label = ("旧版字段证据 · " if historical else "字段证据 · ") + str(data.get("field", "待核字段"))
                label += " · 人工标注已核" if data.get("status") == "manual_checked" else " · 人工标注待核"
                if data.get("page"):
                    label += " · 页码 / 定位 " + str(data["page"])
                segments.append(_segment("field_evidence", label, "\n".join(filter(None, (data.get("excerpt"), data.get("note")))),
                                         historical=historical, version=data.get("item_version"), source_url=data.get("source_url"), at=data.get("observed_at"),
                                         evidence_id=record["id"], attachment_id=data.get("attachment_id")))
            for old in by_item_versions.get(item["id"], []):
                if old["version"] < version:
                    segments.extend(_document_segments(json.loads(old["snapshot"]), historical=True, version=old["version"], at=old["at"]))
            if not terms:
                continue
            full = "\n".join(segment["text"] for segment in segments).casefold()
            if not all(term in full for term in terms):
                continue
            current = "\n".join(segment["text"] for segment in segments if not segment["historical"]).casefold()
            matched = [segment for segment in segments if any(term in segment["text"].casefold() for term in terms)]
            matched.sort(key=lambda segment: (segment["historical"], -sum(term in segment["text"].casefold() for term in terms)))
            historical_only = not all(term in current for term in terms)
            if historical_only:
                needed = [term for term in terms if term not in current]
                # The evidence causing a history-only match must remain visible
                # even when many current fields also happen to contain a term.
                matched.sort(key=lambda segment: (-sum(term in segment["text"].casefold() for term in needed), segment["historical"]))
            hits = [{**segment, "text": _snippet(segment["text"], terms)} for segment in matched[:MAX_MATCHES]]
            results.append({"id": item["id"], "title": doc["title"], "historical_only": historical_only,
                            "matches": hits, "more_matches": max(0, len(matched) - len(hits))})
        # A merged source remains a separate, immutable record. Link its search
        # hits to the visible primary without silently claiming the source's
        # text was chosen as the primary's current rule.
        indexed = {item["id"]: item for item in results}
        titles = {item["id"]: json.loads(item["document"])["title"] for item in items}
        aliases = {record["data"]["source_id"]: record["data"]["target_id"] for record in merge_records if record["data"].get("status") == "active"}
        for original in list(results):
            target, visited = original["id"], set()
            while target in aliases and target not in visited:
                visited.add(target)
                target = aliases[target]
            if target == original["id"] or target in visited or target not in titles:
                continue
            linked = [{**match, "related_item_id": original["id"],
                       "label": "关联来源记录 · " + match["label"] + "（不替代统一现行条款）"} for match in original["matches"]]
            if target not in indexed:
                indexed[target] = {"id": target, "title": titles[target], "historical_only": original["historical_only"],
                                   "matches": linked[:MAX_MATCHES], "more_matches": original["more_matches"], "linked_source_match": True}
                results.append(indexed[target])
            else:
                primary = indexed[target]
                combined = primary["matches"] + linked
                primary["matches"] = combined[:MAX_MATCHES]
                primary["more_matches"] += max(0, len(combined) - MAX_MATCHES) + original["more_matches"]
                primary["historical_only"] = primary["historical_only"] and original["historical_only"]
                primary["linked_source_match"] = True
        results.sort(key=lambda item: (item["historical_only"], item["title"].casefold(), item["id"]))
        notice = (f"{missing_text} 个附件没有可检索正文；图片和未转录 PDF 仅可按文件名、备注查找。" if missing_text
                  else "检索已保存记录、笔记、机器提取正文与可读证据；不会在线抓取。")
        return {"query": query.strip(), "include_history": include_history, "terms": terms, "items": results,
                "counts": {"items": len(results), "historical_only": sum(item["historical_only"] for item in results),
                           "attachments": attachment_count, "attachments_without_text": missing_text}, "attachment_notice": notice,
                "history_note": "包含旧版记录与旧抓取，历史命中不代表现行规则。" if include_history else "只搜索当前记录与最近抓取；旧版与旧附件默认不参与。"}

    def list_views(self):
        from .workspace import records
        with self.store.connection() as conn:
            values = records(conn, VIEW_KIND)
        return sorted(values, key=lambda record: (record["data"]["name"].casefold(), record["id"]))

    def save_view(self, data, record_id=None, expected_revision=None):
        from .workspace import records, put_record
        data = validate_record(data)
        with self.store.connection() as conn:
            conn.execute("BEGIN IMMEDIATE")
            values = records(conn, VIEW_KIND)
            if any(record["id"] != record_id and record["data"]["name"].casefold() == data["name"].casefold() for record in values):
                raise ValueError("已有同名视图；请选择其他名称或明确更新原视图")
            # New views explicitly require an absent ID. Existing views must
            # carry the revision read by the UI; blind overwrites are refused.
            if record_id and (type(expected_revision) is not int or expected_revision < 1):
                raise ValueError("更新保存视图需要当前版本号；请重读后再操作")
            if not record_id and expected_revision is not None and (type(expected_revision) is not int or expected_revision != 0):
                raise ValueError("新视图不能携带已有版本号")
            return put_record(conn, VIEW_KIND, record_id or uuid.uuid4().hex, data, expected_revision=expected_revision if record_id else 0)

    def remove_view(self, record_id, expected_revision):
        from .workspace import delete_record
        if type(expected_revision) is not int or expected_revision < 1:
            raise ValueError("移除保存视图需要当前版本号；请重读后再操作")
        with self.store.connection() as conn:
            conn.execute("BEGIN IMMEDIATE")
            return delete_record(conn, VIEW_KIND, record_id, expected_revision=expected_revision)
