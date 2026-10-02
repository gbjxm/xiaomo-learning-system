"""Versioned local workspace records, stored alongside the original library.

No network fetches occur here. Writes participate in the caller's SQLite
transaction, so a rule version and its review receipt can commit together.
"""
from __future__ import annotations

import copy
import importlib
import ipaddress
import json
import math
import re
import sqlite3
from contextlib import contextmanager
from urllib.parse import urlsplit

from .model import canonical_url, field_changes, json_text, normalize, utcnow

KINDS = {
    'review_receipts', 'change_reviews', 'attachments', 'field_evidence',
    'candidate_links', 'saved_views', 'works', 'applications', 'merges', 'merge_ops',
}
PREFIX = 'library:'
MAX_RECORD_BYTES = 1024 * 1024


def validated_text(value, label='文本', max_length=5000, nullable=False):
    if value is None and nullable:
        return None
    if not isinstance(value, str) or len(value) > max_length:
        raise ValueError(f'{label}须为不超过{max_length}字的文本')
    if any(ord(c) < 32 and c not in '\n\r\t' or 0xD800 <= ord(c) <= 0xDFFF for c in value):
        raise ValueError(f'{label}含无效字符')
    return value.strip()


def identifier(value):
    if not isinstance(value, str) or not re.fullmatch(r'[a-zA-Z0-9_-]{1,80}', value):
        raise ValueError('本地记录标识无效')
    return value


def public_url(value):
    value = validated_text(value, '公开网址', 4000)
    from .backup import _public_url
    _public_url(value)
    parsed = urlsplit(value)
    if parsed.scheme not in ('http', 'https') or not parsed.hostname or parsed.username is not None or parsed.password is not None:
        raise ValueError('仅允许不含账号密码的公开HTTPS网址')
    try:
        port = parsed.port
    except ValueError as exc:
        raise ValueError('网址端口无效') from exc
    host = parsed.hostname.rstrip('.').lower()
    if port not in (None, 80, 443) or host == 'localhost' or '.' not in host or host.endswith(('.localhost', '.local', '.internal', '.test', '.invalid', '.example')):
        raise ValueError('不能使用本机、内网或非公开网址')
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        address = None
    if address is not None and not address.is_global:
        raise ValueError('不能使用本机或内网地址')
    # Numeric alternative encodings may resolve to loopback in a browser.
    if re.fullmatch(r'(?:0x[0-9a-f]+|[0-9.]+)', host):
        if address is None:
            raise ValueError('不能使用非标准数字主机地址')
    return canonical_url(value)


def _key(kind, record_id):
    if kind not in KINDS:
        raise ValueError('未知的本地记录类型')
    return PREFIX + kind + ':' + identifier(record_id)


def _connection(value):
    return isinstance(value, sqlite3.Connection)


def validate_workspace_record(kind, record):
    if kind not in KINDS or not isinstance(record, dict) or set(record) != {'id', 'revision', 'created_at', 'updated_at', 'data'}:
        raise ValueError('本地扩展记录格式或版本不兼容')
    identifier(record['id'])
    if type(record['revision']) is not int or record['revision'] < 1:
        raise ValueError('扩展记录修订号无效')
    for name in ('created_at', 'updated_at'):
        from .model import time_bounds
        validated_text(record[name], name, 100)
        time_bounds(record[name])
    if not isinstance(record['data'], dict) or len(json_text(record).encode()) > MAX_RECORD_BYTES:
        raise ValueError('扩展记录正文无效或过大')
    def safe(value, depth=0):
        if depth > 32:
            raise ValueError('扩展记录嵌套过深')
        if isinstance(value, str):
            validated_text(value, '记录内容', MAX_RECORD_BYTES)
        elif isinstance(value, dict):
            for key, val in value.items():
                validated_text(key, '字段名', 200)
                safe(val, depth+1)
        elif isinstance(value, list):
            if len(value) > 10000:
                raise ValueError('扩展记录列表过长')
            for val in value:safe(val, depth+1)
        elif type(value) is float and not math.isfinite(value):
            raise ValueError('扩展记录数值必须有限')
        elif value is not None and type(value) not in (int, float, bool):
            raise ValueError('扩展记录值无效')
    safe(record['data'])
    module = ('searching' if kind == 'saved_views' else 'works' if kind in ('works', 'applications') else 'merging' if kind in ('merges', 'merge_ops') else 'evidence' if kind in ('attachments', 'field_evidence') else 'review')
    try:
        validator = getattr(importlib.import_module('.'+module, __package__), 'validate_record', None)
        if validator:
            if kind == 'saved_views':validator(record['data'])
            else:validator(kind, record['data'])
    except ModuleNotFoundError as error:
        if error.name != __package__+'.'+module:
            raise
    return record


def get_record(store_or_conn, kind, record_id, conn=None):
    key = _key(kind, record_id)
    if conn is None and not _connection(store_or_conn):
        with store_or_conn.connection() as connection:
            return get_record(connection, kind, record_id)
    connection = conn if conn is not None else store_or_conn
    row = connection.execute('SELECT value FROM settings WHERE key=?', (key,)).fetchone()
    return validate_workspace_record(kind, json.loads(row[0])) if row else None


def records(store_or_conn, kind):
    if kind not in KINDS:
        raise ValueError('未知的本地记录类型')
    if not _connection(store_or_conn):
        with store_or_conn.connection() as conn:return records(conn, kind)
    prefix = PREFIX+kind+':'
    rows = store_or_conn.execute('SELECT key,value FROM settings WHERE key LIKE ? ORDER BY key', (prefix+'%',)).fetchall()
    result = []
    for key, value in rows:
        record = validate_workspace_record(kind, json.loads(value))
        if key != prefix+record['id']:
            raise ValueError('本地记录键与内容不一致')
        result.append(record)
    return result


def put_record(conn, kind, record_id, payload, expected_revision=None):
    key = _key(kind, record_id)
    current = get_record(conn, kind, record_id)
    if expected_revision is not None:
        if type(expected_revision) is not int or expected_revision < 0 or (current['revision'] if current else 0) != expected_revision:
            raise ValueError('记录在读取后已变化，请刷新后重新保存')
    now = utcnow()
    record = {'id':record_id, 'revision':current['revision']+1 if current else 1,
              'created_at':current['created_at'] if current else now, 'updated_at':now, 'data':copy.deepcopy(payload)}
    validate_workspace_record(kind, record)
    conn.execute('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', (key,json_text(record)))
    return record


def delete_record(conn, kind, record_id, expected_revision=None):
    key = _key(kind, record_id)
    current = get_record(conn, kind, record_id)
    if not current:
        raise ValueError('记录不存在')
    if expected_revision is not None and (type(expected_revision) is not int or current['revision'] != expected_revision):
        raise ValueError('记录已变化，不能删除旧版本')
    conn.execute('DELETE FROM settings WHERE key=?', (key,))
    return {'deleted':True, 'id':record_id}


def write_document(conn, document, reason):
    from .storage import comparable
    doc, now = normalize(document), utcnow()
    row = conn.execute('SELECT * FROM opportunities WHERE id=?', (doc['id'],)).fetchone()
    if row:
        old = json.loads(row['document'])
        if comparable(old) == comparable(doc):
            return {'status':'unchanged', 'id':doc['id'], 'version':row['version']}
        version = row['version']+1
        changes = field_changes(comparable(old), comparable(doc))
        conn.execute('UPDATE opportunities SET document=?,version=?,changed_at=?,archived_at=NULL WHERE id=?', (json_text(doc),version,now,doc['id']))
        status = 'changed'
    else:
        version, changes, status = 1, [], 'new'
        conn.execute('INSERT INTO opportunities(id,source_id,official_url,edition,document,version,added_at,changed_at) VALUES(?,?,?,?,?,?,?,?)', (doc['id'],doc['source_id'],doc['official_url'],doc['edition'],json_text(doc),version,now,now))
    conn.execute('INSERT INTO versions VALUES(?,?,?,?,?,?)', (doc['id'],version,now,validated_text(reason,'版本原因',1000),json_text(doc),json_text(changes)))
    return {'status':status, 'id':doc['id'], 'version':version}


def validate_all_records(conn):
    """Validate portable/legacy backups without fetching or executing contents."""
    all_records = {kind:records(conn,kind) for kind in KINDS}
    items = {row[0]:row[1] for row in conn.execute('SELECT id,version FROM opportunities')}
    work_ids = {record['id'] for record in all_records['works']}
    attachments = {record['id']:record for record in all_records['attachments']}
    groups = {record['id']:record for record in all_records['merges']}
    candidates = {row[0] for row in conn.execute('SELECT id FROM discovery_candidates')}
    for key, value in conn.execute("SELECT key,value FROM settings WHERE key LIKE 'library:%'"):
        parts = key.split(':')
        if len(parts) != 3 or parts[1] not in KINDS:
            raise ValueError('备份包含未知扩展记录类型；需要兼容版本')
    for kind, values in all_records.items():
        for record in values:
            data = record['data']
            item_id = data.get('item_id') or data.get('opportunity_id')
            if item_id is not None and item_id not in items:
                raise ValueError('扩展记录引用不存在的机会')
            if data.get('item_version') is not None and not conn.execute('SELECT 1 FROM versions WHERE opportunity_id=? AND version=?',(item_id,data['item_version'])).fetchone():
                raise ValueError('证据引用不存在的规则版本')
            if kind == 'applications' and data.get('work_id') not in work_ids:
                raise ValueError('投稿准备引用不存在的作品')
            if kind == 'applications':
                from .works import application_id, _rule_snapshot
                if record['id'] != application_id(data['work_id'], data['opportunity_id']):
                    raise ValueError('准备记录标识与作品、机会不对应')
                snapshot = data['rule_snapshot']
                row = conn.execute('SELECT snapshot FROM versions WHERE opportunity_id=? AND version=?',(item_id,snapshot['version'])).fetchone()
                if not row or _rule_snapshot(json.loads(row[0]),snapshot['version'])['hash'] != snapshot['hash']:
                    raise ValueError('准备规则快照不对应已保存的真实版本')
            if kind in ('candidate_links', 'review_receipts') and data['candidate_id'] not in candidates:
                raise ValueError('核验收据引用不存在的线索')
            if kind == 'review_receipts' and data['operation_id'] != record['id']:
                raise ValueError('核验收据操作标识不匹配')
            if kind == 'field_evidence' and data.get('attachment_id'):
                attachment = attachments.get(data['attachment_id'])
                if not attachment or attachment['data'].get('item_id') != item_id:
                    raise ValueError('字段摘录与证据附件不对应')
            if kind == 'merges' and (data.get('target_id') not in items or data.get('source_id') not in items or data.get('target_id') == data.get('source_id')):
                raise ValueError('归并引用无效')
            if kind == 'merge_ops':
                result = data['result']
                group = groups.get(result.get('group_id'))
                if not group or result.get('target_id') != group['data']['target_id'] or result.get('source_id') != group['data']['source_id'] or result.get('operation_id') != record['id']:
                    raise ValueError('归并收据与真实关联组不对应')
                if not conn.execute('SELECT 1 FROM versions WHERE opportunity_id=? AND version=?',(result['target_id'],result.get('target_version'))).fetchone():
                    raise ValueError('归并收据引用不存在的目标版本')
            if kind == 'change_reviews':
                row = conn.execute('SELECT source_id,url FROM page_changes WHERE id=?',(data['change_id'],)).fetchone()
                document = json.loads(conn.execute('SELECT document FROM opportunities WHERE id=?',(item_id,)).fetchone()[0])
                if not row or row[0] != document['source_id'] or row[1] != document['official_url']:
                    raise ValueError('人工复核对应的正文差异不存在')
    return {kind:len(values) for kind, values in all_records.items()}


@contextmanager
def mutation_guard(store):
    """Serialize new local writes with cross-process restore/config recovery."""
    from .backup import BackupManager, configuration_fingerprint, _read_config_bytes, _validate_configs
    with BackupManager(store)._config_guard():
        configs = _read_config_bytes(store.root)
        marker = configuration_fingerprint(configs)
        with store.mutation_lock:
            if marker != getattr(store, '_configuration_fingerprint', None):
                sources, rules = _validate_configs(configs)
                with store.connection() as conn:
                    for source in sources:
                        conn.execute('INSERT INTO sources(id,config) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET config=excluded.config',(source['id'],json_text(source)))
                store.source_config, store.rules = sources, rules
                store._configuration_fingerprint = marker
            yield
