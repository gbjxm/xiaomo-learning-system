"""Durable, conservative per-run summaries of structured opportunity changes."""
from __future__ import annotations

import copy
import json
from datetime import datetime, timezone

from .model import field_changes, json_text, temporal_status, time_bounds, utcnow


CATEGORIES = ("new", "extended", "shortened", "rules_changed", "expired", "failed", "review_pending", "status_changed", "candidate_new")
LABELS = {"new": "新增条目", "extended": "时间延期", "shortened": "时间提前 / 缩短", "rules_changed": "奖励 / 规则字段变更", "expired": "到期 / 核验确认已截止", "failed": "核验失败", "review_pending": "页面变化待复核", "status_changed": "状态变化", "candidate_new": "新增待核线索"}
RULE_FIELDS = ("organizer", "official_url", "entry_url", "eligibility", "work_requirements", "steps", "risks", "program", "relations", "cash_tiers", "canvas_requirements", "fees", "reward_conflict", "entry_status", "contact_email")
TIME_FIELDS = ("mechanism", "start", "deadline", "timezone", "absolute_start", "absolute_deadline", "confirmed", "batches", "policy_effective", "policy_end", "policy_version", "month_period", "deadline_tentative", "conflict")


def _moment(value=None):
    if isinstance(value, datetime):
        result = value
    else:
        result = datetime.fromisoformat((value or utcnow()).replace("Z", "+00:00"))
    return result.replace(tzinfo=timezone.utc) if result.tzinfo is None else result.astimezone(timezone.utc)


def _timestamp(value=None):
    return _moment(value).isoformat(timespec="seconds")


def _sorted(values):
    return sorted(copy.deepcopy(values), key=json_text)


def _rules(document):
    """Only terms, never refresh timestamps, excerpts, summaries or page furniture."""
    result = {key: copy.deepcopy(document.get(key)) for key in RULE_FIELDS}
    for key in ('cash_tiers','canvas_requirements','fees'):
        result[key]=result.get(key) or []
    # Structured gates affect filtering; evidence refresh timestamps do not
    # themselves revise the underlying condition.
    result['fit_rules']={key:{name:copy.deepcopy(value) for name,value in rule.items() if name!='evidence'} if isinstance(rule,dict) else copy.deepcopy(rule) for key,rule in (document.get('fit_rules') or {}).items()}
    result["risks"] = _sorted(result.get("risks") or [])
    result["relations"] = _sorted(result.get("relations") or [])
    result["time"] = {key: copy.deepcopy(document.get("time", {}).get(key)) for key in TIME_FIELDS}
    rewards = {}
    for reward in document.get("rewards", []):
        facts = {key: copy.deepcopy(value) for key, value in reward.items() if key not in ("source_excerpt", "observed_at", "evidence")}
        rewards.setdefault(reward.get("type", "other"), []).append(facts)
    result["rewards"] = {kind: _sorted(rows) for kind, rows in rewards.items()}
    return result


def capture_before(store, at=None):
    """Capture raw documents and status at one instant before a run mutates them."""
    stamp = _timestamp(at)
    with store.connection() as conn:
        rows = conn.execute("SELECT id,document,version,added_at,changed_at,archived_at FROM opportunities").fetchall()
        pages = [row[0] for row in conn.execute("SELECT id FROM page_changes")]
    items = {}
    for row in rows:
        document = json.loads(row["document"])
        items[row["id"]] = {
            "document": document, "version": row["version"], "added_at": row["added_at"],
            "changed_at": row["changed_at"], "archived_at": row["archived_at"],
            "status": temporal_status(document, _moment(stamp)),
        }
    return {"captured_at": stamp, "items": items, "page_change_ids": pages}


def _evidence_urls(document):
    return sorted({row["url"] for row in document.get("evidence", []) if isinstance(row.get("url"), str) and row["url"].startswith("https://")})


def _event(category, row, at, previous=None, changes=None):
    document = row["document"]
    old_document = previous["document"] if previous else None
    return {
        "category": category, "label": LABELS[category], "item_id": document.get("id"),
        "title": document["title"], "source_id": document["source_id"], "official_url": document["official_url"],
        "official_url_before": old_document.get("official_url") if old_document else None,
        "at": at, "changes": changes or [], "status_before": previous.get("status") if previous else None,
        "status_after": row.get("status"), "version_before": previous.get("version") if previous else None,
        "version_after": row.get("version"), "verification": document.get("verification"),
        "origin": document.get("origin"), "evidence_urls": _evidence_urls(document),
        "evidence_urls_before": _evidence_urls(old_document) if old_document else [],
        "time_source": {
            "basis": "official_confirmed_time" if document.get("time", {}).get("confirmed") else "time_unconfirmed",
            "official_url": document["official_url"], "time": copy.deepcopy(document.get("time", {})),
            "observed_at": at, "version_recorded_at": row.get("changed_at"),
        },
    }


def _movement(previous, current, key, end=False):
    old_time, new_time = previous.get("time", {}), current.get("time", {})
    if not old_time.get("confirmed") or not new_time.get("confirmed"):
        return None
    if any(value.get("conflict") or value.get("deadline_tentative") for value in (old_time, new_time)):
        return None
    absolute = {"start": "absolute_start", "deadline": "absolute_deadline"}.get(key)
    old = (old_time.get(absolute) or old_time.get(key)) if absolute else old_time.get(key)
    new = (new_time.get(absolute) or new_time.get(key)) if absolute else new_time.get(key)
    if not old or not new:
        return None
    old_local = datetime.fromisoformat(old.replace("Z", "+00:00"))
    new_local = datetime.fromisoformat(new.replace("Z", "+00:00"))
    # Moving a local deadline within the same unspecified timezone still has a
    # definite direction. This never declares the current window open or closed.
    if old_local.tzinfo is None and new_local.tzinfo is None and old_time.get("timezone") == new_time.get("timezone"):
        if end:
            if len(old) == 10:
                old_local = old_local.replace(hour=23, minute=59, second=59, microsecond=999999)
            if len(new) == 10:
                new_local = new_local.replace(hour=23, minute=59, second=59, microsecond=999999)
        return "later" if new_local > old_local else "earlier" if new_local < old_local else None
    old_bounds = time_bounds(old, old_time.get("timezone"), end)
    new_bounds = time_bounds(new, new_time.get("timezone"), end)
    if new_bounds[0] > old_bounds[1]:
        return "later"
    if new_bounds[1] < old_bounds[0]:
        return "earlier"
    return None


def _item_events(previous, row, at, include_expiry=True):
    if previous is None:
        # A newly discovered old edition is a discovery, not a new expiry.
        return [_event("new", row, row.get("added_at") or at)]
    before, after = previous["document"], row["document"]
    changes = field_changes(_rules(before), _rules(after))
    groups = {"extended": [], "shortened": [], "rules_changed": []}
    directions = {}
    for key in ("start", "deadline", "policy_effective", "policy_end"):
        direction = _movement(before, after, key, key in ("deadline", "policy_end"))
        if direction:
            fields = {f"time.{key}"}
            if key in ("start", "deadline"):
                fields.add(f"time.absolute_{key}")
            for field in fields:
                directions[field] = ("extended" if direction == "later" else "shortened", direction)
    for change in changes:
        category, direction = directions.get(change["field"], ("rules_changed", None))
        if direction:
            change = {**change, "direction": direction}
        groups[category].append(change)
    changed_at = row.get("changed_at") or at
    events = [_event(category, row, changed_at, previous, values) for category, values in groups.items() if values]
    old_status, new_status = previous.get("status", {}), row.get("status", {})
    if include_expiry and old_status.get("code") != "closed" and new_status.get("code") == "closed":
        expiry = _event("expired", row, at, previous, [{"field": "status", "before": old_status, "after": new_status}])
        expiry["time_source"]["transition"] = "confirmed_by_rule_update" if changes else "clock_crossed_confirmed_boundary"
        events.append(expiry)
    elif old_status.get("code") != new_status.get("code"):
        events.append(_event("status_changed", row, at, previous, [{"field": "status", "before": old_status, "after": new_status}]))
    if before.get("verification") != after.get("verification"):
        value = {"field": "verification", "before": before.get("verification"), "after": after.get("verification")}
        status_event = next((event for event in events if event["category"] == "status_changed"), None)
        if status_event:
            status_event["changes"].append(value)
        else:
            events.append(_event("status_changed", row, at, previous, [value]))
    return events


def _source_events(store, attempts, page_changes):
    sources = {row["id"]: row for row in store.source_config} if store is not None else {}
    events = []
    # Retrying a source during one batch does not inflate the failed-source count.
    latest = {}
    for attempt in attempts:
        latest[attempt["source_id"]] = attempt
    for attempt in latest.values():
        details=(attempt.get('coverage') or {}).get('discovery',{}).get('article_failure_details',[])
        for failure in details:
            source=sources.get(attempt['source_id'],{})
            events.append({'category':'failed','label':'候选正文核验失败','item_id':None,'candidate_id':failure.get('candidate_id'),'source_id':attempt['source_id'],'title':failure.get('title') or source.get('name',attempt['source_id']),'official_url':failure.get('official_url'),'at':attempt.get('finished_at') or attempt.get('attempted_at'),'message':failure.get('error','候选正文未取得；不能判定无变化'),'changes':[],'status_before':None,'status_after':{'code':'failed','label':'正文核验失败'},'time_source':{'basis':'source_attempt','observed_at':attempt.get('finished_at') or attempt.get('attempted_at')}})
        if attempt.get("status") != "failed":
            continue
        source = sources.get(attempt["source_id"], {})
        events.append({
            "category": "failed", "label": LABELS["failed"], "item_id": None, "source_id": attempt["source_id"],
            "title": source.get("name", attempt["source_id"]), "official_url": source.get("url") or attempt.get("official_url"),
            "at": attempt.get("finished_at") or attempt.get("attempted_at"), "message": attempt.get("message", ""),
            "changes": [], "status_before": None, "status_after": {"code": "failed", "label": "核验失败"},
            "attempt_id": attempt.get("id"), "coverage": attempt.get("coverage"),
            "time_source": {"basis": "source_attempt", "observed_at": attempt.get("finished_at") or attempt.get("attempted_at")},
        })
    grouped = {}
    for page in page_changes:
        if page.get("state") != "review_pending":
            continue
        key = (page["source_id"], page["url"])
        grouped.setdefault(key, []).append(page)
    for (source_id, url), pages in grouped.items():
        source = sources.get(source_id, {})
        events.append({
            "category": "review_pending", "label": LABELS["review_pending"], "item_id": None,
            "source_id": source_id, "title": source.get("name", source_id), "official_url": url,
            "at": pages[-1]["at"], "changes": [], "status_before": None, "status_after": None,
            "message": "页面原文发生变化，尚未确认属于奖励或规则变更", "page_change_ids": [page["id"] for page in pages],
            "page_diffs": [{"id": page["id"], "at": page["at"], "diff": page["diff"], "state": page["state"]} for page in pages],
            "time_source": {"basis": "page_observation", "observed_at": pages[-1]["at"]},
        })
    return events


def _summary(events, run=None, limited=False, note=""):
    counts = {category: 0 for category in CATEGORIES}
    for category in CATEGORIES:
        identities = {(event.get("item_id") or event.get('candidate_id') or event.get("source_id"), event.get("official_url") if category in ("review_pending","failed") else None) for event in events if event["category"] == category}
        counts[category] = len(identities)
    return {"schema_version": 1, "run": run, "counts": counts, "events": events, "limited": limited, "note": note}


def build_digest(before, after, attempts=None, at=None, run_id=None, store=None, page_changes=None):
    """Compare captured snapshots; a category counts each item once per batch."""
    stamp = _timestamp(at or after.get("captured_at"))
    events = []
    for item_id, row in after.get("items", {}).items():
        previous = before.get("items", {}).get(item_id)
        events.extend(_item_events(previous, row, stamp))
    events.extend(_source_events(store, attempts or [], page_changes or []))
    return _summary(events, {"id": run_id, "started_at": before.get("captured_at"), "finished_at": stamp, "status": "finished"})


def _attempts(conn, run_id):
    rows = [dict(row) for row in conn.execute("SELECT * FROM attempts WHERE run_id=? ORDER BY id", (run_id,))]
    for row in rows:
        if isinstance(row.get("coverage"), str):
            row["coverage"] = json.loads(row["coverage"])
    return rows


def finalize_digest(store, run_id, before, at=None):
    """Return a digest to embed in run.summary; callers own the run transaction."""
    after = capture_before(store, at)
    with store.connection() as conn:
        run = conn.execute("SELECT id,started_at,finished_at,status FROM runs WHERE id=?", (run_id,)).fetchone()
        attempts = _attempts(conn, run_id)
        earlier_pages = set(before.get("page_change_ids", []))
        pages = [dict(row) for row in conn.execute("SELECT * FROM page_changes ORDER BY id") if row["id"] not in earlier_pages]
    result = build_digest(before, after, attempts, run_id=run_id, store=store, page_changes=pages)
    if run:
        result["run"] = {**dict(run), "finished_at": after["captured_at"]}
    return result


def summarize_run(store, run_id=None):
    """Read an immutable digest, or reconstruct explicitly limited old history."""
    with store.connection() as conn:
        if run_id is None:
            row = conn.execute("SELECT * FROM runs ORDER BY started_at DESC,rowid DESC LIMIT 1").fetchone()
        else:
            row = conn.execute("SELECT * FROM runs WHERE id=?", (run_id,)).fetchone()
        if row is None:
            return _summary([], limited=True, note="该批次不存在" if run_id else "尚无更新批次")
        run = {key: row[key] for key in ("id", "started_at", "finished_at", "status")}
        summary = json.loads(row["summary"]) if row["summary"] else {}
        saved = summary.get("digest")
        if isinstance(saved, dict) and isinstance(saved.get("events"), list):
            result = copy.deepcopy(saved)
            result["run"] = run
            result.setdefault("counts", {})
            for category in CATEGORIES:
                result["counts"].setdefault(category, 0)
            result.setdefault("limited", False)
            result.setdefault("note", "")
            return result
        attempts = _attempts(conn, run["id"])
        versions = []
        if run["finished_at"]:
            versions = [dict(version) for version in conn.execute("SELECT * FROM versions WHERE at>=? AND at<=? ORDER BY opportunity_id,version", (run["started_at"], run["finished_at"]))]
        events = []
        # There was no run_id on old versions, so timestamp association is limited.
        grouped = {}
        for version in versions:
            grouped.setdefault(version["opportunity_id"], []).append(version)
        for item_id, values in grouped.items():
            first, last = values[0], values[-1]
            old = conn.execute("SELECT * FROM versions WHERE opportunity_id=? AND version<? ORDER BY version DESC LIMIT 1", (item_id, first["version"])).fetchone()
            document = json.loads(last["snapshot"])
            after = {"document": document, "version": last["version"], "status": temporal_status(document, _moment(last["at"]))}
            before = None
            if old:
                old_document = json.loads(old["snapshot"])
                before = {"document": old_document, "version": old["version"], "status": temporal_status(old_document, _moment(run["started_at"]))}
            found = _item_events(before, after, last["at"], include_expiry=False)
            for event in found:
                event["time_source"]["basis"] = "legacy_version_timestamp"
            events.extend(found)
        # page_changes itself has no run_id; tie its new observation to this run.
        pages = [dict(page) for page in conn.execute("SELECT p.* FROM page_changes p JOIN observations o ON o.id=p.after_id WHERE o.run_id=? AND p.at>=? AND p.at<=? ORDER BY p.id", (run["id"], run["started_at"], run["finished_at"] or run["started_at"]))]
    events.extend(_source_events(store, attempts, pages))
    return _summary(events, run, limited=True, note="历史批次未保存运行前后快照；仅按版本时间及采集尝试恢复，无法确认当时全部状态变化或到期数量。")
