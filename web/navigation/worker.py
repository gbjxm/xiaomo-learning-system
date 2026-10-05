"""Read the existing navigation room and append records through its own CAS store.

No database is initialized here. Existing journey documents remain in their room.
"""
from __future__ import annotations

import argparse
from copy import deepcopy
from datetime import date
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import sys
from profile_view import SCHEMA as PROFILE_SCHEMA, SECTIONS as PROFILE_SECTIONS, build_profile, analysis_items, current_projection, profile_metadata

sys.dont_write_bytecode = True
LEARNING_ROOT = Path(__file__).resolve().parents[2]
PRODUCTION_ROOM = Path("D:/codex/2026-10-03/new-chat/outputs/小陌的领航室")
MAX_INPUT = 96 * 1024
MAX_SOURCE = 1024 * 1024
ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$")
TYPES = {"life", "idea", "note"}
LEGACY = (
    {"id": "legacy-life-20261003", "title": "10 月 3 日生活记录与反思", "date": "2026-10-03", "type": "life",
     "file": "依据/2026-10-03_生活记录与反思.md", "transcript": None,
     "recordIds": ["R-20261003-daily-life", "R-20261004-pro-cost-and-quota", "R-20261004-practice-capacity-feeling", "R-20261004-night-development-intention", "R-20261003-recent-development-evidence", "R-20261004-navigation-first-daily-use", "R-20261004-quota-opportunity-cost-hypothesis"]},
    {"id": "legacy-idea-20260910", "title": "9 月 10 日短片灵感：机器人与 AI 内部世界", "date": "2026-09-10", "type": "idea",
     "file": "依据/2026-09-10_短片灵感_机器人与AI内部世界.md", "transcript": "依据/原始转写/2026-09-10_短片灵感_原始转写.txt",
     "recordIds": ["R-20260910-robot-idea-context", "R-20260910-robot-ai-world-idea", "R-20260910-robot-idea-feeling", "R-20261004-robot-transcription-reading"]},
)


class NavigationError(Exception):
    def __init__(self, code, message, status=400, *, details=None, retryable=False):
        super().__init__(message)
        self.code, self.status, self.details, self.retryable = code, status, details or {}, retryable


def fail(code, message, status=400, **kw):
    raise NavigationError(code, message, status, **kw)


def within(child, parent):
    return child == parent or parent in child.parents


def text(value, label, limit, *, empty=False):
    if not isinstance(value, str) or len(value) > limit or (not empty and not value.strip()):
        fail("NAV_INVALID_INPUT", f"{label}不能为空或超过长度限制。")
    return value


def identifier(value, label="id"):
    if not isinstance(value, str) or not ID.fullmatch(value):
        fail("NAV_INVALID_INPUT", f"{label}格式无效。")
    return value


def calendar(value, label, optional=False):
    if value is None and optional:
        return None
    try:
        if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
            raise ValueError()
        date.fromisoformat(value)
    except ValueError:
        fail("NAV_INVALID_INPUT", f"{label}必须是有效的YYYY-MM-DD日期。")
    return value


def fields(value, allowed, label):
    if not isinstance(value, dict) or set(value) - set(allowed):
        fail("NAV_INVALID_INPUT", f"{label}含有不支持的字段。")


def resolve_roots(args):
    project = Path(args.project_root).resolve(strict=True)
    mode = args.mode
    if mode == "production":
        if project != LEARNING_ROOT.resolve():
            fail("NAV_INVALID_ROOT", "正式领航只允许当前正式个人终端。", 403)
        config_path = (project / "navigation-connection.json").resolve(strict=True)
        if not within(config_path, project):
            fail("NAV_INVALID_ROOT", "领航连接配置不在个人终端内。", 403)
        config = json.loads(config_path.read_text(encoding="utf-8-sig"))
        if config.get("schemaVersion") != 1 or not isinstance(config.get("navigationRoot"), str):
            fail("NAV_INVALID_ROOT", "领航连接配置无效。", 503)
        configured = Path(config["navigationRoot"]).resolve(strict=True)
        if args.root and Path(args.root).resolve(strict=True) != configured:
            fail("NAV_INVALID_ROOT", "领航根与已配置的正式目录不一致。", 403)
        root = configured
    else:
        if project == LEARNING_ROOT.resolve() or not args.root:
            fail("NAV_INVALID_ROOT", "隔离领航必须指定独立个人终端与领航目录。", 403)
        root = Path(args.root).resolve(strict=True)
        if root == PRODUCTION_ROOM.resolve() or root == project or not within(root, project):
            fail("NAV_INVALID_ROOT", "隔离领航目录必须在该隔离个人终端内，不能落到正式资料。", 403)
    if not root.is_dir():
        fail("NAV_INVALID_ROOT", "没有读到领航室目录。", 503)
    return project, root


def local(root, relative, optional=False):
    candidate = root / relative
    try:
        actual = candidate.resolve(strict=True)
    except FileNotFoundError:
        if optional:
            return None
        fail("NAV_SOURCE_MISSING", "未读到已登记资料，原文件没有被补造。", 503, details={"source": relative})
    if not within(actual, root) or not actual.is_file() or actual.stat().st_size > MAX_SOURCE:
        fail("NAV_INVALID_PATH", "资料路径或大小不在领航允许范围内。", 403)
    return actual.read_text(encoding="utf-8-sig")


def modules(root):
    path = (root / "tools/room.py").resolve(strict=True)
    continuation = (root / "tools/continuity.py").resolve(strict=True)
    if not within(path, root) or not within(continuation, root):
        fail("NAV_INVALID_PATH", "领航工具路径越界。", 403)
    spec = importlib.util.spec_from_file_location("room", path)
    room = importlib.util.module_from_spec(spec)
    sys.modules["room"] = room
    spec.loader.exec_module(room)
    spec = importlib.util.spec_from_file_location("navigation_continuity", continuation)
    continuity = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(continuity)
    return room, continuity


class NavigationRoom:
    def __init__(self, project, root, room, continuity):
        self.project, self.root, self.room, self.continuity = project, root, room, continuity

    def state(self):
        # internal() checks symlinks too; reads do not initialize or create locks.
        state = self.room.read_json(self.room.internal(self.root, self.room.STATE_PATH))
        self.room.validate_state(state)
        if state["schema"] != self.room.V2:
            fail("NAV_SCHEMA_UNSUPPORTED", "领航记录尚不是支持独立经历的版本，停止网页写入。", 503)
        return state

    def identity(self):
        return "navigation-" + hashlib.sha256(str(self.root).casefold().encode()).hexdigest()[:24]

    def profile_view(self, state, as_of):
        return build_profile(state, self.identity(), as_of,
                             lambda source: local(self.project if source["system"] == "learning" else self.root, source["path"], optional=True))

    def profile(self, value):
        fields(value, {"asOf"}, "个人资料")
        as_of = calendar(value.get("asOf"), "asOf")
        return self.profile_view(self.state(), as_of)

    def analyses(self, value):
        fields(value, {"since", "until", "query"}, "已保存的AI理解")
        since, until = calendar(value.get("since"), "since", True), calendar(value.get("until"), "until", True)
        query = text(value.get("query", ""), "关键词", 2000, empty=True)
        if since and until and since > until:
            fail("NAV_INVALID_INPUT", "开始日期晚于结束日期。")
        state = self.state()
        entries = analysis_items(state, since, until, query)
        return {"revision": state["revision"], "identity": self.identity(), "entries": entries, "matched": len(entries),
                "coverage": {"from": since, "to": until, "count": len(entries), "dateBasis": "优先原记录经历日期；未记经历日期时使用带时区的保存时间折算北京时间。", "kind": "ai_inference"}}

    def profile_correction(self, value):
        fields(value, {"identity", "eventId", "expectedRevision", "id", "sectionId", "content", "asOf", "targetId"}, "个人资料补充更正")
        if value.get("identity") != self.identity():
            fail("NAV_IDENTITY_MISMATCH", "个人资料来源已变化；原输入保留，请重新读取这份资料。", 409)
        event_id, key = identifier(value.get("eventId"), "eventId"), identifier(value.get("id"))
        section = value.get("sectionId")
        if section not in PROFILE_SECTIONS:
            fail("NAV_INVALID_INPUT", "资料分类须为关于我、我在意什么或目前情况。")
        content, as_of = text(value.get("content"), "本人补充原话", 8000), calendar(value.get("asOf"), "asOf")
        target_id = value.get("targetId")
        if target_id is not None:
            target_id = identifier(target_id, "targetId")
        if type(value.get("expectedRevision")) is not int or value["expectedRevision"] < 0:
            fail("NAV_INVALID_INPUT", "expectedRevision必须是当前读取的版本。")
        request = {"identity": self.identity(), "id": key, "eventId": event_id, "sectionId": section,
                   "content": content, "asOf": as_of, "targetId": target_id}
        request_hash = hashlib.sha256(json.dumps(request, ensure_ascii=False, sort_keys=True).encode("utf-8")).hexdigest()
        state = self.state()
        existing = next((record for record in state["records"] if record["id"] == key), None)
        if existing:
            meta = existing.get("profile")
            if (not isinstance(meta, dict) or meta.get("schema") != PROFILE_SCHEMA or meta.get("requestSha256") != request_hash
                    or meta.get("eventId") != event_id):
                fail("NAV_CORRECTION_CONFLICT", "这份资料补充标识已有不同内容；请核对原提交，不能覆盖。", 409)
            # Preserve the original source snapshot for exact retry, even if the Markdown later changes.
            record = {name: deepcopy(item) for name, item in existing.items() if name != "received_at"}
        else:
            profile = self.profile_view(state, as_of)
            target = None
            if target_id:
                native_target = next((item for item in state["records"] if item["id"] == target_id), None)
                if native_target and not profile_metadata(native_target):
                    fail("NAV_PROFILE_TARGET_READ_ONLY", "旅程原记录和AI理解保留在各自历史中；请在个人资料独立补充本人原话。", 400)
                target = next((item for block in profile["sections"] for item in block["items"] if item["id"] == target_id), None)
                if not target or not target.get("current", True):
                    fail("NAV_PROFILE_TARGET_CHANGED", "原资料条目已变化或已有后续更正；请刷新资料并保留本次输入。", 409)
                if not target.get("canCorrect") or target.get("kind") not in {"source_summary", "user_report"}:
                    fail("NAV_PROFILE_TARGET_READ_ONLY", "这个条目不通过个人资料更正改写；可以在所选分类独立补充本人原话。", 400)
                if target["sectionId"] != section:
                    fail("NAV_INVALID_INPUT", "更正分类须与所指的那条资料一致，不能据此改写另一组资料。")
            snapshot = {name: deepcopy(target[name]) for name in ("id", "text", "source", "sourceDate", "dateBasis", "kind", "sectionId", "sourceRef") if name in target} if target else None
            origin = (target["source"] if target["kind"] == "source_summary" else "领航本人原话 " + target["id"]) if target else None
            record = {"id": key, "kind": "user_report", "content": content, "occurred_on": as_of,
                      "source": "小陌在个人终端明确" + ("更正" if target else "补充") + "个人资料 · " + PROFILE_SECTIONS[section]
                                + ("；所指来源：" + origin if target else "；独立补充，不替代整组原资料。"),
                      "profile": {"schema": PROFILE_SCHEMA, "sectionId": section, "asOf": as_of, "targetId": target_id,
                                  "target": snapshot, "eventId": event_id, "requestSha256": request_hash}}
            if target and target.get("sourceRef", {}).get("recordId"):
                record["corrects_id"] = target["sourceRef"]["recordId"]
        result = self.apply({"event_id": event_id, "op": "record", "record": record}, value["expectedRevision"])
        readback = self.state()
        persisted = next((item for item in readback["records"] if item["id"] == key), None)
        if not persisted or any(persisted.get(name) != item for name, item in record.items()):
            fail("NAV_SAVE_UNVERIFIED", "资料补充的保存回读未一致；请保留本次标识并核对，勿新建重复记录。", 503, retryable=True)
        profile = self.profile_view(readback, as_of)
        correction = next((item for item in profile["corrections"] if item["id"] == key), None)
        if correction is None:
            fail("NAV_SAVE_UNVERIFIED", "已提交但尚未从资料视图找回本次补充；请保留原标识核对。", 503, retryable=True)
        return {"saved": True, "duplicate": result["duplicate"], "revision": readback["revision"], "identity": self.identity(),
                "correction": correction, "profile": profile}

    def profile_context(self, state, context, as_of):
        if context.get("revision") != state["revision"]:
            fail("NAV_CONTEXT_CHANGED", "读取期间领航资料有新版本；请重新读取，本次没有写入。", 409, retryable=True)
        if not as_of:
            # Legacy read calls may omit asOf; no server-date assumption is added.
            return context, None
        profile = self.profile_view(state, as_of)
        context = deepcopy(context)
        context["profile"] = current_projection(profile)
        context["compass"] = current_projection(profile, section="values")
        context["profileCorrections"] = deepcopy(profile["corrections"])
        return context, profile

    def entries(self, state):
        records = {r["id"]: r for r in state["records"]}
        result, warnings = [], []
        documents = {}
        for record in state["records"]:
            document = record.get("journey_document")
            if not isinstance(document, dict) or record["kind"] != "observed":
                continue
            entry_id = document.get("entry_id")
            # A saved analysis or an unlinked file name cannot replace a journey.
            if isinstance(entry_id, str) and entry_id in record.get("related_ids", []):
                documents[entry_id] = (record, document)
        for item in LEGACY:
            # Absence in a fixture or moved room is absence, not a new empty diary.
            content = local(self.root, item["file"], optional=True)
            if content is None:
                warnings.append({"id": item["id"], "message": "这份原资料暂未读到；没有复制或补造。"})
                continue
            transcript = local(self.root, item["transcript"], optional=True) if item["transcript"] else None
            keys = [key for key in item["recordIds"] if key in records]
            original = next((records[k]["content"] for k in keys if records[k]["kind"] == "user_report"), content)
            sources = [{"path": item["file"], "label": "原整理文件（含分层理解）"}]
            if item["transcript"]:
                sources.append({"path": item["transcript"], "label": "收到的原始文字转写"})
                if transcript is None:
                    warnings.append({"id": item["id"], "message": "原始转写暂未读到，不能称已取得原转写。"})
            result.append({"id": item["id"], "title": item["title"], "date": item["date"], "occurredOn": item["date"], "type": item["type"],
                           "content": content, "contentKind": "mixed_document", "preview": original[:280],
                           "rawTranscript": transcript, "readOnly": True, "recordIds": keys,
                           "sourceFiles": sources, "source": "复用领航室既有资料，原文没有改写。"})
        for record in state["records"]:
            meta = record.get("journey")
            if not isinstance(meta, dict) or meta.get("type") not in TYPES or not isinstance(meta.get("title"), str):
                continue
            # AI understanding must never be displayed as a new personal journey.
            if record["kind"] != "user_report" or not record.get("occurred_on"):
                continue
            entry = {"id": record["id"], "title": meta["title"], "date": record["occurred_on"], "occurredOn": record["occurred_on"], "type": meta["type"],
                           "content": record["content"], "contentKind": "user_original", "preview": record["content"][:280],
                           "originalContent": record["content"],
                           "rawTranscript": None, "readOnly": True, "recordIds": [record["id"]], "sourceFiles": [],
                           "source": record["source"]}
            if record["id"] in documents:
                association, document = documents[record["id"]]
                entry["recordIds"] = list(dict.fromkeys([record["id"], association["id"], *association.get("related_ids", [])]))
                relative = document.get("file")
                try:
                    if not isinstance(relative, str) or not relative.strip():
                        fail("NAV_INVALID_PATH", "整理文件必须是领航室内的相对 Markdown 路径。", 403)
                    path = Path(relative)
                    if path.is_absolute() or path.drive or ".." in path.parts or path.suffix.casefold() != ".md":
                        fail("NAV_INVALID_PATH", "整理文件必须是领航室内的相对 Markdown 路径。", 403)
                    content = local(self.root, relative)
                except (NavigationError, OSError, ValueError):
                    warnings.append({"id": record["id"], "message": "关联整理文件暂未读到或不在领航室允许范围内，当前显示完整原话。"})
                else:
                    entry.update({"content": content, "contentKind": "mixed_document",
                                  "sourceFiles": [{"path": relative, "label": "关联整理文件（含原话、归纳与分层理解）"}]})
            result.append(entry)
        result.sort(key=lambda item: (item["date"], item["id"]), reverse=True)
        return result, warnings

    def listing(self, value):
        fields(value, {"query", "date", "since", "until", "type"}, "旅程查找")
        query = text(value.get("query", ""), "关键词", 2000, empty=True).casefold()
        day, since, until = (calendar(value.get(key), key, True) for key in ("date", "since", "until"))
        kind = value.get("type", "")
        if kind not in TYPES | {""} or since and until and since > until:
            fail("NAV_INVALID_INPUT", "旅程类型或起止日期无效。")
        state = self.state()
        entries, warnings = self.entries(state)
        matches = [entry for entry in entries if (not day or entry["date"] == day) and (not since or entry["date"] >= since)
                   and (not until or entry["date"] <= until) and (not kind or entry["type"] == kind)
                   and (not query or query in (entry["title"] + "\n" + entry["content"] + "\n" + (entry["rawTranscript"] or "")).casefold())]
        return {"revision": state["revision"], "entries": [self.summary(e) for e in matches], "matched": len(matches), "warnings": warnings}

    @staticmethod
    def summary(entry):
        return {key: deepcopy(value) for key, value in entry.items() if key not in {"content", "originalContent", "rawTranscript"}}

    def detail(self, value):
        fields(value, {"id"}, "旅程详情")
        key = identifier(value.get("id"))
        state = self.state()
        entries, warnings = self.entries(state)
        entry = next((item for item in entries if item["id"] == key), None)
        if entry is None:
            fail("NAV_ENTRY_NOT_FOUND", "未找到这条旅程；若保存结果未知，请保留原内容和提交标识。", 404)
        return {"revision": state["revision"], "entry": entry, "warnings": [warning for warning in warnings if warning["id"] == key]}

    def context(self, value):
        fields(value, {"asOf", "query"}, "领航上下文")
        as_of = calendar(value.get("asOf"), "asOf", True)
        query = text(value.get("query", ""), "关键词", 2000, empty=True)
        context = self.continuity.related_context(self.root, as_of, query or None)
        context, _ = self.profile_context(self.state(), context, as_of)
        return {"revision": context["revision"], "context": context, "profile": context["profile"]}

    def bootstrap(self, value):
        as_of = calendar(value.get("asOf"), "asOf", True)
        state = self.state()
        entries, warnings = self.entries(state)
        context = self.continuity.related_context(self.root, as_of)
        context, _ = self.profile_context(state, context, as_of)
        return {"revision": state["revision"], "identity": self.identity(), "journeys": [self.summary(e) for e in entries],
                "context": context, "warnings": warnings,
                "capabilities": {"text": True, "image": False, "audio": False, "video": False}}

    def apply(self, event, revision):
        if type(revision) is not int or revision < 0:
            fail("NAV_INVALID_INPUT", "expectedRevision必须是当前读取的版本。")
        try:
            result = self.room.commit(self.root, event, revision)
        except self.room.RoomError as error:
            message = str(error)
            if message.startswith("Revision conflict"):
                fail("NAV_REVISION_CONFLICT", "其他页面已更新记录，请读取最新版本并保留原输入后再保存。", 409,
                     details={"currentRevision": self.state()["revision"]})
            if "Event id reused" in message:
                fail("NAV_EVENT_REUSED", "同一提交标识已用于不同内容；请核对原提交，不要覆盖。", 409)
            if "writer is active" in message:
                fail("NAV_WRITE_BUSY", "另一份记录正在保存或原写入需要核对；请保留原提交标识后重试。", 409, retryable=True)
            fail("NAV_SAVE_REJECTED", "领航存储拒绝本次保存，原资料没有被覆盖。", 409, details={"reason": message})
        return result

    def save(self, value):
        fields(value, {"eventId", "expectedRevision", "entry"}, "旅程保存")
        entry = value.get("entry")
        fields(entry, {"id", "title", "date", "type", "content"}, "旅程")
        key, event_id = identifier(entry.get("id")), identifier(value.get("eventId"), "eventId")
        if key.startswith("legacy-"):
            fail("NAV_READ_ONLY_ENTRY", "既有资料只读复用，不能通过新旅程覆盖。", 409)
        # Titles are optional; keep the supplied value for exact retry confirmation.
        title = text(entry.get("title", ""), "标题", 200, empty=True)
        content = text(entry.get("content"), "原文", 64000)
        day = calendar(entry.get("date"), "旅程日期")
        kind = entry.get("type")
        if kind not in TYPES:
            fail("NAV_INVALID_INPUT", "旅程类型须为life、idea或note。")
        record = {"id": key, "kind": "user_report", "content": content, "source": "小陌在个人终端明确保存的原文；未自动分析或验证。",
                  "occurred_on": day, "journey": {"title": title, "type": kind}}
        result = self.apply({"event_id": event_id, "op": "record", "record": record}, value.get("expectedRevision"))
        detail = self.detail({"id": key})
        return {"revision": detail["revision"], "entry": detail["entry"], "duplicate": result["duplicate"], "saved": True}

    def analysis(self, value):
        fields(value, {"eventId", "expectedRevision", "id", "content", "relatedIds"}, "AI回看保存")
        related = value.get("relatedIds", [])
        if not isinstance(related, list) or len(related) > 100:
            fail("NAV_INVALID_INPUT", "relatedIds必须是不重复的现有依据标识。")
        related = [identifier(key) for key in related]
        if len(set(related)) != len(related):
            fail("NAV_INVALID_INPUT", "relatedIds必须是不重复的现有依据标识。")
        existing = {r["id"] for r in self.state()["records"]}
        if not set(related) <= existing:
            fail("NAV_INVALID_INPUT", "AI回看引用的原依据已不存在或标识不正确。")
        record = {"id": identifier(value.get("id")), "kind": "ai_inference", "content": text(value.get("content"), "AI回看", 64000),
                  "source": "小陌在个人终端明确保存的AI回看；理解和原因解释仍是待校正假设。", "related_ids": related}
        result = self.apply({"event_id": identifier(value.get("eventId"), "eventId"), "op": "record", "record": record}, value.get("expectedRevision"))
        return {"revision": result["revision"], "id": record["id"], "kind": "ai_inference", "duplicate": result["duplicate"], "saved": True}

    def review(self, value):
        fields(value, {"asOf", "since", "until"}, "回看")
        as_of = calendar(value.get("asOf"), "asOf", True)
        since, until = calendar(value.get("since"), "since", True), calendar(value.get("until"), "until", True)
        if since and until and since > until:
            fail("NAV_INVALID_INPUT", "回看开始日期晚于结束日期。")
        state = self.state()
        entries, warnings = self.entries(state)
        entries = [e for e in entries if (not since or e["date"] >= since) and (not until or e["date"] <= until)]
        seeds = {key for entry in entries for key in entry["recordIds"]}
        seeds = self.continuity.evidence_closure(state["records"], seeds)
        # A saved AI review is context, not an additional independent life fact.
        for record in state["records"]:
            if record["kind"] == "ai_inference" and set(record.get("related_ids", [])) & seeds:
                seeds.add(record["id"])
        evidence = [deepcopy(r) for r in state["records"] if r["id"] in seeds]
        context = self.continuity.related_context(self.root, as_of)
        context, _ = self.profile_context(state, context, as_of)
        period = f"{since or '已有记录起点'} 至 {until or '已有记录终点'}"
        handoff = (f"在领航室 {self.root} 中回看小陌的旅程（{period}）。\n"
                   f"本次读到 {len(entries)} 条旅程，依据版本 {state['revision']}。原记录ID：{', '.join(e['id'] for e in entries) or '该期间暂未记录'}。\n"
                   "区分小陌原话、本人感受、外部反馈与AI假设；说明变化、仍未知的问题与可纠正的潜在卡点。"
                   "不要把没有记录的日子算作没进展，不要求补打卡或固定日报。涉及学习和正式作品时按各原系统入口接续。"
                   "这份文本是接续提示，复制或读取不代表已经生成分析或保存新结果。")
        return {"revision": state["revision"], "asOf": as_of, "since": since, "until": until, "journeys": entries,
                "evidence": evidence, "context": context, "handoffText": handoff, "generated": False, "warnings": warnings,
                "coverage": {"from": since, "to": until, "asOf": as_of, "journeyCount": len(entries), "recordCount": len(evidence),
                             "recordDates": sorted({r.get("occurred_on") for r in evidence if r.get("occurred_on")}),
                             "journeyDates": sorted({e["date"] for e in entries}),
                             "dateBasis": "旅程按明确事件日期；关联依据保留各自发生与接收日期。",
                             "note": "只反映已保存旅程及其关联依据，未记录不等于没有经历、能力或变化。"}}

    def prompt(self, value):
        # The Node caller has validated conversational history and current question.
        fields(value, {"message", "mode", "asOf", "since", "until"}, "领航请求")
        message = text(value.get("message"), "问题", 16000)
        mode = value.get("mode", "chat")
        if mode not in {"chat", "review"}:
            fail("NAV_INVALID_INPUT", "领航模式无效。")
        pack = self.review({key: value.get(key) for key in ("asOf", "since", "until")})
        state = self.state()
        if state["revision"] != pack["revision"]:
            fail("NAV_CONTEXT_CHANGED", "读取期间领航资料有新版本；请重新读取，本次没有写入。", 409, retryable=True)
        profile = self.profile_view(state, calendar(value.get("asOf"), "asOf"))
        record_map = {record["id"]: record for record in state["records"]}
        profile_evidence = []
        for item in profile["corrections"]:
            if not item.get("current", True):
                continue
            record = record_map[item["id"]]
            evidence = {key: deepcopy(record[key]) for key in ("id", "kind", "content", "source", "occurred_on", "received_at") if key in record}
            evidence.update(profileStatus="current", sectionId=item["sectionId"], targetId=item.get("targetId"))
            profile_evidence.append(evidence)
        superseded = {item["id"]: item["supersededBy"] for block in profile["sections"] for item in block["items"] if item.get("supersededBy")}
        for record in pack["evidence"]:
            if record["id"] in superseded:
                record.update(profileStatus="historical", supersededBy=superseded[record["id"]])
        keys = ["navigate-personal-development"]
        if mode == "review" or re.search("复盘|回看|变化|收获|卡点|总结|反复", message):
            keys.append("review-personal-development")
        if re.search("人生|意义|情怀|珍惜|价值|关系|生活方式|方向", message):
            keys.append("explore-life-directions")
        if re.search("阶段|主线|路线|规划|取舍|选择", message):
            keys.append("plan-personal-stage")
        if re.search("资金|钱|预算|精力|时间|休息|容量|额度|疲劳", message):
            keys.append("assess-personal-resources")
        if re.search("能力|作品|反馈|证据|位置|职业|岗位|验证", message):
            keys.append("calibrate-personal-evidence")
        instructions = [{"name": key, "content": local(self.root, f".agents/skills/{key}/SKILL.md", optional=True)} for key in keys]
        instructions = [item for item in instructions if item["content"] is not None]
        # These are shared read-only references, not a merged personal state store.
        background = []
        for relative in ("运行记录/个人情况.md", "运行记录/当前状态.md", "运行记录/阶段安排.md"):
            content = local(self.project, relative, optional=True)
            if content is not None:
                if relative == "运行记录/个人情况.md":
                    content = current_projection(profile, source_id="learning-personal")
                background.append({"path": relative, "content": content, "role": "原学习系统的带日期背景；未同步或改写"})
        refs = [{"id": record["id"], "kind": record["kind"], "date": record.get("occurred_on"), "source": record["source"]} for record in pack["evidence"]]
        refs += [{"id": record["id"], "kind": record["kind"], "date": record.get("occurred_on"), "source": record["source"]} for record in profile_evidence if record["id"] not in {item["id"] for item in refs}]
        return {"revision": pack["revision"], "instructions": instructions, "background": background,
                "pack": pack, "sourceRefs": refs, "warnings": pack["warnings"] + profile["warnings"],
                "profile": {key: value for key, value in profile.items() if key != "analyses"}, "profileEvidence": profile_evidence}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=("bootstrap", "list", "detail", "context", "save", "analysis", "review", "prompt", "profile", "profile-correction", "analyses"))
    parser.add_argument("--project-root", default=str(LEARNING_ROOT))
    parser.add_argument("--root")
    parser.add_argument("--mode", choices=("production", "isolated"), default="production")
    args = parser.parse_args()
    try:
        raw = sys.stdin.buffer.read(MAX_INPUT + 1)
        if len(raw) > MAX_INPUT:
            fail("NAV_TOO_LARGE", "领航请求超过96KiB。", 413)
        value = json.loads(raw.decode("utf-8")) if raw else {}
        if not isinstance(value, dict):
            fail("NAV_INVALID_INPUT", "领航请求必须是JSON对象。")
        project, root = resolve_roots(args)
        room, continuity = modules(root)
        store = NavigationRoom(project, root, room, continuity)
        method = {"list": "listing", "save": "save", "profile-correction": "profile_correction"}.get(args.command, args.command)
        print(json.dumps({"ok": True, "data": getattr(store, method)(value)}, ensure_ascii=False))
        return 0
    except NavigationError as error:
        print(json.dumps({"ok": False, "error": {"code": error.code, "message": str(error), "status": error.status,
                                               "retryable": error.retryable, "details": error.details}}, ensure_ascii=False))
    except (OSError, ValueError, ImportError) as error:
        print(json.dumps({"ok": False, "error": {"code": "NAV_UNAVAILABLE", "message": "领航资料或工具未就绪，请保留原输入并检查连接配置。",
                                               "status": 503, "retryable": False, "details": {"cause": type(error).__name__}}}, ensure_ascii=False))
    except Exception as error:
        print(json.dumps({"ok": False, "error": {"code": "NAV_STORE_ERROR", "message": "领航资料未通过读取或保存校验，请保留原输入。",
                                               "status": 503, "retryable": False, "details": {"cause": type(error).__name__}}}, ensure_ascii=False))
    return 1


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    raise SystemExit(main())
