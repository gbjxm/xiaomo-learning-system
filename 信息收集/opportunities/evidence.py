"""Append-only local evidence attachments and field annotations.

Uploaded files are downloaded as attachments, never mounted as an application
page. Text provided by a user is labelled transcription, never claimed as OCR.
"""
from __future__ import annotations

import base64
import binascii
import hashlib
import os
import re
import secrets
import stat
from datetime import datetime
from pathlib import Path

from .model import utcnow
from .review import text
from .visuals import _dimensions, _no_links, _read_local, _windows_handle_path
from .workspace import get_record, put_record, records, public_url


MAX_FILE_BYTES = 8 * 1024 * 1024
MAX_TEXT_CHARS = 120000
FILE_PATTERN = re.compile(r"[a-f0-9]{64}\.(pdf|png|jpg|jpeg|txt)\Z")
FIELDS = {"time", "eligibility", "work_requirements", "steps", "rewards", "risks", "program", "summary", "organizer", "entry_url", "publication_at", "assessment"}
MIMES = {"pdf": "application/pdf", "png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg", "txt": "text/plain; charset=utf-8"}


def _name(value):
    value = text(value, "附件文件名", 180, False)
    if (not value or any(char in value for char in '<>:"/\\|?*') or any(ord(char) < 32 for char in value) or value.endswith((".", " ")) or value.startswith(".") or re.fullmatch(r"(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?", value, re.I)):
        raise ValueError("附件须使用普通文件名，不能含路径或系统保留名称")
    extension = Path(value).suffix.lower()[1:]
    if extension not in MIMES:
        raise ValueError("仅接受 PDF、PNG、JPEG 或 UTF-8 TXT；HTML、SVG和可执行文件不允许导入")
    return value, extension


def _validate_content(content, extension):
    if not content or len(content) > MAX_FILE_BYTES:
        raise ValueError("附件不能为空，单个最多8MB")
    extracted = None
    if extension == "pdf":
        if not re.match(rb"%PDF-[12]\.\d", content[:8]) or b"%%EOF" not in content[-2048:]:
            raise ValueError("文件不是可识别的PDF，不能仅修改扩展名")
    elif extension in ("png", "jpg", "jpeg"):
        try:
            _dimensions(content, extension)
        except ValueError as error:
            raise ValueError("图片结构、尺寸或类型无效；请导入静态PNG/JPEG") from error
    else:
        try:
            extracted = content.decode("utf-8-sig")
        except UnicodeDecodeError as error:
            raise ValueError("TXT请保存为UTF-8编码") from error
        text(extracted, "TXT正文", MAX_TEXT_CHARS, False)
        if "\x00" in extracted:
            raise ValueError("TXT含二进制内容")
    return extracted


def _observed(value):
    if not value:
        return None
    value = text(value, "证据日期", 100, False)
    try:
        datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise ValueError("证据日期须为完整日期或ISO时刻，不填则明确未知") from error
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})?)?", value):
        raise ValueError("证据日期格式无效")
    return value


def _row(conn, item_id):
    row = conn.execute("SELECT id,version FROM opportunities WHERE id=?", (item_id,)).fetchone()
    if not row:
        raise ValueError("正式条目不存在")
    return row


class EvidenceManager:
    def __init__(self, store):
        self.store = store
        self.base = store.db_path.parent.resolve()

    def list(self, item_id):
        with self.store.connection() as conn:
            item = _row(conn, item_id)
        attachments = [record for record in records(self.store, "attachments") if record["data"].get("item_id") == item_id]
        annotations = [record for record in records(self.store, "field_evidence") if record["data"].get("item_id") == item_id]
        for record in attachments:
            record["data"].pop("storage_name", None)
            record["data"]["download_url"] = "/api/evidence/download?id=" + record["id"]
            record["data"]["current_version"] = record["data"].get("item_version") == item["version"]
        return {"item_id": item_id, "current_version": item["version"], "attachments": attachments, "field_evidence": annotations, "note": "证据与当时条目版本绑定，新增不覆盖旧文件；人工判断不改变官方条款。"}

    def _write_file(self, content, storage_name):
        directory = self.base / "attachments"
        _no_links(self.base)
        directory.mkdir(exist_ok=True)
        _no_links(directory)
        destination = directory / storage_name
        flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_BINARY", 0) | getattr(os, "O_NOFOLLOW", 0)
        try:
            descriptor = os.open(destination, flags, 0o600)
        except FileExistsError:
            if _read_local(self.base, ("attachments", storage_name), MAX_FILE_BYTES) != content:
                raise ValueError("已有附件内容不匹配，拒绝覆盖")
            return
        with os.fdopen(descriptor, "wb") as target:
            opened = os.fstat(target.fileno())
            opened_path = _windows_handle_path(target.fileno())
            if not stat.S_ISREG(opened.st_mode) or opened.st_nlink != 1 or opened_path is not None and opened_path != destination:
                raise ValueError("附件存储位置异常，拒绝写入")
            _no_links(directory)
            target.write(content)
            target.flush()
            os.fsync(target.fileno())
        if _read_local(self.base, ("attachments", storage_name), MAX_FILE_BYTES) != content:
            raise ValueError("附件落盘校验失败，未登记为证据")

    def import_file(self, payload):
        allowed = {"item_id", "name", "content_base64", "source_url", "observed_at", "verification", "note", "text", "upload_id"}
        if not isinstance(payload, dict) or set(payload) - allowed:
            raise ValueError("证据导入请求含未知字段")
        filename, extension = _name(payload.get("name"))
        encoded = payload.get("content_base64")
        if not isinstance(encoded, str) or len(encoded) > 4 * ((MAX_FILE_BYTES + 2) // 3):
            raise ValueError("附件编码无效或超过8MB")
        try:
            content = base64.b64decode(encoded, validate=True)
        except (binascii.Error, ValueError) as error:
            raise ValueError("附件编码无效") from error
        extracted = _validate_content(content, extension)
        supplied_text = text(payload.get("text"), "人工转录", MAX_TEXT_CHARS)
        verification = payload.get("verification", "unverified")
        if verification not in ("unverified", "manual_checked"):
            raise ValueError("附件核验状态无效")
        note = text(payload.get("note"), "证据说明", 5000)
        if verification == "manual_checked" and not note:
            raise ValueError("人工已核附件请填写核验说明；文件存在不等于规则已核")
        digest = hashlib.sha256(content).hexdigest()
        storage_name = digest + "." + extension
        upload_id = payload.get("upload_id") or secrets.token_hex(16)
        if not isinstance(upload_id, str) or not re.fullmatch(r"[a-f0-9]{32}", upload_id):
            raise ValueError("上传操作标识无效")
        data = {"item_id": payload.get("item_id"), "filename": filename, "mime": MIMES[extension], "size": len(content), "sha256": digest, "storage_name": storage_name, "source_url": public_url(payload["source_url"]) if payload.get("source_url") else None, "observed_at": _observed(payload.get("observed_at")), "verification": verification, "note": note, "text": extracted if extracted is not None else supplied_text, "text_state": "plain_text" if extracted is not None else "user_supplied" if supplied_text else "no_text", "origin": "user_import"}
        with self.store.connection() as conn:
            conn.execute("BEGIN IMMEDIATE")
            item = _row(conn, data["item_id"])
            data["item_version"] = item["version"]
            prior = get_record(self.store, "attachments", upload_id, conn=conn)
            if prior:
                if prior["data"] != data:
                    raise ValueError("同一上传标识不能用于其他证据；请重新选择文件")
                result = prior
            else:
                self._write_file(content, storage_name)
                result = put_record(conn, "attachments", upload_id, data)
        result = copy_public(result)
        result["data"]["download_url"] = "/api/evidence/download?id=" + result["id"]
        return result

    def file(self, attachment_id):
        if not isinstance(attachment_id, str) or not re.fullmatch(r"[a-f0-9]{32}", attachment_id):
            raise ValueError("附件标识无效")
        record = get_record(self.store, "attachments", attachment_id)
        if not record:
            raise ValueError("附件不存在")
        data = record["data"]
        name = data.get("storage_name")
        if not isinstance(name, str) or not FILE_PATTERN.fullmatch(name):
            raise ValueError("附件路径无效")
        raw = _read_local(self.base, ("attachments", name), MAX_FILE_BYTES)
        if len(raw) != data.get("size") or hashlib.sha256(raw).hexdigest() != data.get("sha256"):
            raise ValueError("附件完整性校验失败，拒绝下载")
        filename, extension = _name(data.get("filename"))
        _validate_content(raw, extension)
        # The server MUST retain Content-Disposition: attachment. Returning
        # octet-stream additionally prevents inline PDF/plugin execution.
        return raw, "application/octet-stream", "evidence-" + attachment_id + "." + extension

    def save_field(self, payload):
        allowed = {"item_id", "field", "excerpt", "source_url", "page", "attachment_id", "status", "note"}
        if not isinstance(payload, dict) or set(payload) - allowed or payload.get("field") not in FIELDS:
            raise ValueError("字段证据请求无效")
        excerpt = text(payload.get("excerpt"), "官方字段摘录", 12000, False)
        if not excerpt:
            raise ValueError("请填写摘录；缺失规则不能凭空确认")
        status = payload.get("status", "unverified")
        if status not in ("unverified", "manual_checked"):
            raise ValueError("字段证据状态无效")
        page = text(payload.get("page"), "页码 / 位置", 200)
        source_url = public_url(payload["source_url"]) if payload.get("source_url") else None
        attachment_id = payload.get("attachment_id") or None
        if not source_url and not attachment_id:
            raise ValueError("字段证据需关联官方链接或本地证据附件")
        with self.store.connection() as conn:
            conn.execute("BEGIN IMMEDIATE")
            item = _row(conn, payload.get("item_id"))
            if attachment_id:
                attachment = get_record(self.store, "attachments", attachment_id, conn=conn)
                if not attachment or attachment["data"].get("item_id") != item["id"]:
                    raise ValueError("附件与条目不对应")
            data = {"item_id": item["id"], "item_version": item["version"], "field": payload["field"], "excerpt": excerpt, "source_url": source_url, "page": page, "attachment_id": attachment_id, "status": status, "note": text(payload.get("note"), "核验说明", 5000), "origin": "manual_annotation", "observed_at": utcnow()}
            return put_record(conn, "field_evidence", secrets.token_hex(16), data)


def copy_public(record):
    import copy
    record = copy.deepcopy(record)
    record["data"].pop("storage_name", None)
    return record


def validate_record(kind, data):
    if not isinstance(data, dict):
        raise ValueError("证据记录格式无效")
    item_id = data.get("item_id")
    if not isinstance(item_id, str) or not re.fullmatch(r"[a-f0-9]{24}", item_id) or type(data.get("item_version")) is not int or data["item_version"] < 1:
        raise ValueError("证据引用的条目或版本无效")
    if kind == "attachments":
        expected = {"item_id", "item_version", "filename", "mime", "size", "sha256", "storage_name", "source_url", "observed_at", "verification", "note", "text", "text_state", "origin"}
        if set(data) != expected or data["origin"] != "user_import" or data["verification"] not in ("unverified", "manual_checked") or data["text_state"] not in ("plain_text", "user_supplied", "no_text"):
            raise ValueError("附件元信息或状态无效")
        filename, extension = _name(data["filename"])
        digest, storage_name = data["sha256"], data["storage_name"]
        if not isinstance(digest, str) or not re.fullmatch(r"[a-f0-9]{64}", digest) or storage_name != digest + "." + extension or not FILE_PATTERN.fullmatch(storage_name):
            raise ValueError("附件哈希与安全文件名不一致")
        if data["mime"] != MIMES[extension] or type(data["size"]) is not int or not 0 < data["size"] <= MAX_FILE_BYTES:
            raise ValueError("附件类型或大小无效")
        if data["source_url"]:
            public_url(data["source_url"])
        _observed(data["observed_at"])
        note = text(data["note"], "附件核验说明", 5000)
        if data["verification"] == "manual_checked" and not note:
            raise ValueError("人工已核附件缺少核验说明")
        text(data["text"], "附件文字", MAX_TEXT_CHARS)
        if data["text_state"] == "plain_text" and extension != "txt" or data["text_state"] == "no_text" and data["text"] is not None or data["text_state"] != "no_text" and not isinstance(data["text"], str):
            raise ValueError("附件可读文字来源不一致")
    elif kind == "field_evidence":
        if set(data) != {"item_id", "item_version", "field", "excerpt", "source_url", "page", "attachment_id", "status", "note", "origin", "observed_at"} or data["field"] not in FIELDS or data["status"] not in ("unverified", "manual_checked") or data["origin"] != "manual_annotation":
            raise ValueError("字段证据类型或状态无效")
        if not text(data["excerpt"], "字段摘录", 12000, False):
            raise ValueError("字段摘录不能为空")
        text(data["page"], "页码 / 位置", 200)
        text(data["note"], "核验说明", 5000)
        if data["source_url"]:
            public_url(data["source_url"])
        if not data["source_url"] and not data["attachment_id"]:
            raise ValueError("字段摘录缺少来源")
        if data["attachment_id"] is not None and (not isinstance(data["attachment_id"], str) or not re.fullmatch(r"[a-f0-9]{32}", data["attachment_id"])):
            raise ValueError("字段摘录附件标识无效")
        _observed(data["observed_at"])
    else:
        raise ValueError("未知证据记录类型")
    return data
