from __future__ import annotations
import copy
import difflib
import hashlib
import json
import sqlite3
import threading
import time
from contextlib import contextmanager
from pathlib import Path
from .model import decorate, field_changes, json_text, normalize, temporal_status, utcnow
from .seeds import handed_over

SCHEMA = """
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sources(id TEXT PRIMARY KEY,config TEXT NOT NULL,last_attempt_at TEXT,last_fetched_at TEXT,last_success_at TEXT,status TEXT NOT NULL DEFAULT 'pending',message TEXT NOT NULL DEFAULT '尚未运行单次检查');
CREATE TABLE IF NOT EXISTS opportunities(id TEXT PRIMARY KEY,source_id TEXT NOT NULL,official_url TEXT NOT NULL,edition TEXT NOT NULL,document TEXT NOT NULL,version INTEGER NOT NULL,added_at TEXT NOT NULL,changed_at TEXT NOT NULL,archived_at TEXT,last_observed_at TEXT,starred INTEGER NOT NULL DEFAULT 0,note TEXT NOT NULL DEFAULT '',UNIQUE(source_id,official_url,edition));
CREATE TABLE IF NOT EXISTS versions(opportunity_id TEXT NOT NULL,version INTEGER NOT NULL,at TEXT NOT NULL,reason TEXT NOT NULL,snapshot TEXT NOT NULL,changes TEXT NOT NULL,PRIMARY KEY(opportunity_id,version));
CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY,started_at TEXT NOT NULL,finished_at TEXT,status TEXT NOT NULL,summary TEXT);
CREATE TABLE IF NOT EXISTS attempts(id INTEGER PRIMARY KEY,run_id TEXT NOT NULL,source_id TEXT NOT NULL,attempted_at TEXT NOT NULL,finished_at TEXT NOT NULL,status TEXT NOT NULL,message TEXT NOT NULL,new_count INTEGER NOT NULL DEFAULT 0,changed_count INTEGER NOT NULL DEFAULT 0,pages INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS observations(id INTEGER PRIMARY KEY,source_id TEXT NOT NULL,url TEXT NOT NULL,text_hash TEXT NOT NULL,raw_hash TEXT NOT NULL,body TEXT NOT NULL,retrieved_at TEXT NOT NULL,last_seen_at TEXT NOT NULL,quality TEXT NOT NULL,run_id TEXT NOT NULL,UNIQUE(source_id,url,text_hash));
CREATE TABLE IF NOT EXISTS page_changes(id INTEGER PRIMARY KEY,source_id TEXT NOT NULL,url TEXT NOT NULL,at TEXT NOT NULL,before_id INTEGER NOT NULL,after_id INTEGER NOT NULL,diff TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'review_pending');
CREATE INDEX IF NOT EXISTS observations_by_url ON observations(source_id,url,last_seen_at);
CREATE TABLE IF NOT EXISTS discovery_candidates(id TEXT PRIMARY KEY,source_id TEXT NOT NULL,official_url TEXT NOT NULL,edition TEXT NOT NULL,title TEXT NOT NULL,first_seen_at TEXT NOT NULL,last_seen_at TEXT NOT NULL,evidence TEXT NOT NULL,body TEXT NOT NULL DEFAULT '',review_state TEXT NOT NULL DEFAULT 'pending',known_item_id TEXT,UNIQUE(source_id,official_url,edition));
"""

def comparable(doc):
    value = copy.deepcopy(doc)
    value.pop("verified_at", None)
    for item in value.get("evidence", []):
        item.pop("observed_at", None)
    return value

class Store:
    def __init__(self, root, db_path=None, seed=True):
        self.root = Path(root).resolve()
        self.mutation_lock = threading.RLock()
        self.db_path = Path(db_path) if db_path else self.root / "data" / "opportunities.sqlite3"
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        # Recover an interrupted DB/config restore before reading configuration
        # or synchronizing it into sources. This lock also excludes other Store
        # instances while startup registers sources and seeds local records.
        from .backup import configuration_fingerprint, store_startup_guard
        with store_startup_guard(self.root, self.db_path):
            self.rules = json.loads((self.root / "config" / "rules.json").read_text(encoding="utf-8"))
            self.source_config = json.loads((self.root / "config" / "sources.json").read_text(encoding="utf-8"))
            self._configuration_fingerprint = configuration_fingerprint({name: (self.root / name).read_bytes() for name in ("config/sources.json", "config/rules.json")})
            with self.connection() as conn:
                conn.executescript(SCHEMA)
                conn.execute("BEGIN IMMEDIATE")
                for table, columns in {"sources": {"coverage": "TEXT", "last_article_success_at": "TEXT"}, "attempts": {"coverage": "TEXT"}, "observations": {"coverage": "TEXT"}}.items():
                    existing = {row[1] for row in conn.execute(f"PRAGMA table_info({table})")}
                    for name, declaration in columns.items():
                        if name not in existing:
                            conn.execute(f"ALTER TABLE {table} ADD COLUMN {name} {declaration}")
                conn.execute("PRAGMA user_version=3")
                for source in self.source_config:
                    conn.execute("INSERT INTO sources(id,config) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET config=excluded.config", (source["id"], json_text(source)))
                imported = conn.execute("SELECT value FROM settings WHERE key='seeds_imported'").fetchone()
            if seed and not imported:
                for doc in handed_over():
                    self.upsert(doc, "前序人工核验移交 / 用户线索")
                with self.connection() as conn:
                    conn.execute("INSERT OR IGNORE INTO settings VALUES('seeds_imported','1')")
                self.archive_expired()
        # If a previous process stopped during a run, that run is interrupted, never success.

    @contextmanager
    def connection(self):
        with self.mutation_lock:
            with self._connection() as conn:
                yield conn

    @contextmanager
    def _connection(self):
        conn = sqlite3.connect(self.db_path, timeout=15)
        conn.row_factory = sqlite3.Row
        try:
            conn.execute("PRAGMA busy_timeout=15000")
            for attempt in range(3):
                try:
                    mode = conn.execute("PRAGMA journal_mode").fetchone()[0]
                    if mode.lower() != "wal":
                        conn.execute("PRAGMA journal_mode=WAL")
                    break
                except sqlite3.OperationalError as exc:
                    if "locked" not in str(exc).lower() or attempt == 2:
                        raise
                    time.sleep(0.05 * (attempt + 1))
            with conn:
                yield conn
        finally:
            conn.close()

    def upsert(self, document, reason="实时提取（需复核）", protect_manual=True):
        doc = normalize(document)
        now = utcnow()
        with self.connection() as conn:
            conn.execute("BEGIN IMMEDIATE")
            row = conn.execute("SELECT * FROM opportunities WHERE id=?", (doc["id"],)).fetchone()
            if row:
                old = json.loads(row["document"])
                if protect_manual and doc["origin"] == "live_fetch" and old["origin"] in ("manual_handoff", "manual_review", "user_hint"):
                    conn.execute("UPDATE opportunities SET last_observed_at=? WHERE id=?", (now, doc["id"]))
                    return "unchanged"
                if comparable(old) == comparable(doc):
                    conn.execute("UPDATE opportunities SET last_observed_at=? WHERE id=?", (now, doc["id"]))
                    return "unchanged"
                version = row["version"] + 1
                changes = field_changes(comparable(old), comparable(doc))
                conn.execute("UPDATE opportunities SET document=?,version=?,changed_at=?,last_observed_at=?,archived_at=NULL WHERE id=?", (json_text(doc), version, now, now, doc["id"]))
                result = "changed"
            else:
                version, changes = 1, []
                conn.execute("INSERT INTO opportunities(id,source_id,official_url,edition,document,version,added_at,changed_at,last_observed_at) VALUES(?,?,?,?,?,?,?,?,?)", (doc["id"], doc["source_id"], doc["official_url"], doc["edition"], json_text(doc), version, now, now, now if doc["origin"] == "live_fetch" else None))
                result = "new"
            conn.execute("INSERT INTO versions VALUES(?,?,?,?,?,?)", (doc["id"], version, now, reason, json_text(doc), json_text(changes)))
            return result

    def existing(self, source_id, url, edition):
        with self.connection() as conn:
            row = conn.execute("SELECT document FROM opportunities WHERE source_id=? AND official_url=? AND edition=?", (source_id, url, edition)).fetchone()
        return json.loads(row[0]) if row else None

    def items(self):
        from .write_protocol import preference_revision
        with self.connection() as conn:
            rows = conn.execute("SELECT * FROM opportunities").fetchall()
            preference_revisions = {row["id"]: preference_revision(conn, row["id"]) for row in rows}
        result = []
        for row in rows:
            doc = decorate(json.loads(row["document"]), self.rules)
            doc.update(version=row["version"], added_at=row["added_at"], changed_at=row["changed_at"], archived_at=row["archived_at"], starred=bool(row["starred"]), note=row["note"], last_observed_at=row["last_observed_at"], preference_revision=preference_revisions[row["id"]])
            result.append(doc)
        return result

    def details(self, item_id):
        items = self.items()
        item = next((item for item in items if item["id"] == item_id), None)
        if not item:
            return None
        indexed = {value["id"]: value for value in items}
        item["related_items"] = []
        for relation in item.get("relations", []):
            target = indexed.get(relation["target_id"])
            if target:
                item["related_items"].append({**relation, "id": target["id"], "title": target["title"], "direction": "parent", "status": target["status"]["label"]})
        for value in items:
            for relation in value.get("relations", []):
                if relation["target_id"] == item_id:
                    item["related_items"].append({**relation, "id": value["id"], "title": value["title"], "direction": "child", "status": value["status"]["label"]})
        with self.connection() as conn:
            item["versions"] = [dict(row) for row in conn.execute("SELECT version,at,reason,changes FROM versions WHERE opportunity_id=? ORDER BY version DESC", (item_id,))]
            item["observations"] = [dict(row) for row in conn.execute("SELECT id,retrieved_at,last_seen_at,quality,raw_hash,body,coverage FROM observations WHERE source_id=? AND url=? ORDER BY last_seen_at DESC,id DESC LIMIT 5", (item["source_id"], item["official_url"]))]
            item["page_changes"] = [dict(row) for row in conn.execute("SELECT id,at,diff,state FROM page_changes WHERE source_id=? AND url=? ORDER BY id DESC LIMIT 10", (item["source_id"], item["official_url"]))]
        for observation in item["observations"]:
            observation["coverage"] = json.loads(observation["coverage"]) if observation["coverage"] else None
        for version in item["versions"]:
            version["changes"] = json.loads(version["changes"])
        return item

    def preference(self, item_id, starred=None, note=None, *, expected_revision=None, submission_id=None, require_cas=False):
        from .write_protocol import (WriteConflict, binding, preference_state, receipt,
                                     revision, save_receipt, set_preference_revision,
                                     submission_id as validate_submission)
        from .workspace import identifier
        item_id = identifier(item_id)
        if starred is not None and type(starred) is not bool:
            raise ValueError("关注状态须为布尔值")
        if note is not None and (not isinstance(note, str) or len(note) > 5000):
            raise ValueError("笔记最多5000字")
        if starred is None and note is None:
            raise ValueError("没有要保存的个人资料")
        guarded = require_cas or expected_revision is not None or submission_id is not None
        request_binding = None
        if guarded:
            expected_revision = revision(expected_revision)
            submission_id = validate_submission(submission_id)
            request_binding = binding("preference", {"id": item_id, "starred": starred, "note": note, "expectedPreferenceRevision": expected_revision})
        with self.connection() as conn:
            conn.execute("BEGIN IMMEDIATE")
            current = preference_state(conn, item_id)
            if guarded:
                previous = receipt(conn, submission_id, "preference", request_binding)
                if previous:
                    original = previous["result"].get("preference")
                    if not isinstance(original, dict) or original.get("id") != item_id:
                        raise ValueError("个人资料提交回执不完整；暂停写入")
                    if current != original:
                        raise WriteConflict("该次提交已完成，但之后个人资料又有变化；请重新读取核对，草稿保留。", code="completed_then_changed", committed=True, preference=current)
                    return {**previous["result"], "already_completed": True}
                if expected_revision != current["preference_revision"]:
                    raise WriteConflict("个人资料已被另一页面修改；本次未保存，请重新读取核对，草稿保留。", code="revision_conflict", preference=current)
            if starred is not None:
                conn.execute("UPDATE opportunities SET starred=? WHERE id=?", (int(bool(starred)), item_id))
            if note is not None:
                conn.execute("UPDATE opportunities SET note=? WHERE id=?", (note, item_id))
            set_preference_revision(conn, item_id, current["preference_revision"] + 1)
            result = {"saved": True, "preference": preference_state(conn, item_id)}
            if guarded:
                save_receipt(conn, submission_id, "preference", request_binding, item_id, result)
            return result

    def archive_expired(self, now=None):
        count = 0
        with self.connection() as conn:
            for row in conn.execute("SELECT id,document,archived_at FROM opportunities").fetchall():
                closed = temporal_status(json.loads(row["document"]), now)["code"] == "closed"
                if closed and not row["archived_at"]:
                    conn.execute("UPDATE opportunities SET archived_at=? WHERE id=?", (utcnow(), row["id"]))
                    count += 1
                elif not closed and row["archived_at"]:
                    conn.execute("UPDATE opportunities SET archived_at=NULL WHERE id=?", (row["id"],))
        return count

    def observe(self, source_id, url, text, raw_hash, run_id, quality, coverage=None):
        text = text[:120000]
        text_hash = hashlib.sha256(text.encode()).hexdigest()
        now = utcnow()
        with self.connection() as conn:
            conn.execute("BEGIN IMMEDIATE")
            previous = conn.execute("SELECT * FROM observations WHERE source_id=? AND url=? ORDER BY last_seen_at DESC,id DESC LIMIT 1", (source_id, url)).fetchone()
            conn.execute("INSERT INTO observations(source_id,url,text_hash,raw_hash,body,retrieved_at,last_seen_at,quality,run_id,coverage) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(source_id,url,text_hash) DO UPDATE SET last_seen_at=excluded.last_seen_at,raw_hash=excluded.raw_hash,quality=excluded.quality,run_id=excluded.run_id,coverage=excluded.coverage", (source_id, url, text_hash, raw_hash, text, now, now, quality, run_id, json_text(coverage) if coverage else None))
            current = conn.execute("SELECT id FROM observations WHERE source_id=? AND url=? AND text_hash=?", (source_id, url, text_hash)).fetchone()[0]
            changed = bool(previous and previous["text_hash"] != text_hash)
            if changed:
                diff = "\n".join(difflib.unified_diff(previous["body"].splitlines(), text.splitlines(), fromfile="上次提取", tofile="本次提取", lineterm=""))[:40000]
                conn.execute("INSERT INTO page_changes(source_id,url,at,before_id,after_id,diff) VALUES(?,?,?,?,?,?)", (source_id, url, now, previous["id"], current, diff))
        return changed

    def sources(self):
        with self.connection() as conn:
            rows = conn.execute("SELECT * FROM sources").fetchall()
        return [{**json.loads(row["config"]), **{key: row[key] for key in ("last_attempt_at", "last_fetched_at", "last_success_at", "last_article_success_at", "status", "message")}, "coverage": json.loads(row["coverage"]) if row["coverage"] else None} for row in rows]

    def save_candidate(self, item):
        now = utcnow()
        with self.connection() as conn:
            conn.execute("BEGIN IMMEDIATE")
            previous = conn.execute("SELECT review_state FROM discovery_candidates WHERE id=?", (item['id'],)).fetchone()
            state = previous[0] if previous else 'known' if item.get('known_item_id') else 'pending'
            conn.execute("INSERT INTO discovery_candidates(id,source_id,official_url,edition,title,first_seen_at,last_seen_at,evidence,body,review_state,known_item_id) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET last_seen_at=excluded.last_seen_at,title=excluded.title,evidence=excluded.evidence,body=CASE WHEN excluded.body='' THEN discovery_candidates.body ELSE excluded.body END,known_item_id=COALESCE(excluded.known_item_id,discovery_candidates.known_item_id)", (item['id'],item['source_id'],item['official_url'],item['edition'],item['title'],now,now,json_text(item['evidence']),item.get('body','')[:120000],state,item.get('known_item_id')))
            return not previous

    def candidates(self):
        with self.connection() as conn:
            rows = conn.execute("SELECT * FROM discovery_candidates ORDER BY last_seen_at DESC,id").fetchall()
        return [{**dict(row),'evidence':json.loads(row['evidence'])} for row in rows]

    def candidate_review(self, item_id, state):
        if state not in ('pending','dismissed'):
            raise ValueError('只可将线索暂存待核或暂不关注，不能凭点击确认规则')
        with self.connection() as conn:
            if not conn.execute('SELECT 1 FROM discovery_candidates WHERE id=?',(item_id,)).fetchone():
                raise ValueError('线索不存在')
            conn.execute('UPDATE discovery_candidates SET review_state=? WHERE id=?',(state,item_id))

    def start_run(self, run_id):
        with self.connection() as conn:
            conn.execute("UPDATE runs SET status='interrupted',finished_at=? WHERE status='running'", (utcnow(),))
            conn.execute("INSERT INTO runs(id,started_at,status) VALUES(?,?,'running')", (run_id, utcnow()))

    def record_attempt(self, run_id, source, result, attempted_at):
        now = utcnow()
        with self.connection() as conn:
            conn.execute("INSERT INTO attempts(run_id,source_id,attempted_at,finished_at,status,message,new_count,changed_count,pages,coverage) VALUES(?,?,?,?,?,?,?,?,?,?)", (run_id, source["id"], attempted_at, now, result["status"], result["message"], result.get("new", 0), result.get("changed", 0), result.get("pages", 0), json_text(result.get("coverage")) if result.get("coverage") else None))
            conn.execute("UPDATE sources SET last_attempt_at=?,status=?,message=?,coverage=? WHERE id=?", (attempted_at, result["status"], result["message"], json_text(result.get("coverage")) if result.get("coverage") else None, source["id"]))
            if result.get("pages", 0):
                conn.execute("UPDATE sources SET last_fetched_at=? WHERE id=?", (now, source["id"]))
            if result["status"] in ("success_zero", "success"):
                conn.execute("UPDATE sources SET last_success_at=? WHERE id=?", (now, source["id"]))
            if result.get("coverage", {}).get("article", {}).get("state") == "text_complete":
                conn.execute("UPDATE sources SET last_article_success_at=? WHERE id=?", (now, source["id"]))

    def finish_run(self, run_id, summary, status="finished"):
        with self.connection() as conn:
            conn.execute("UPDATE runs SET finished_at=?,status=?,summary=? WHERE id=?", (utcnow(), status, json_text(summary), run_id))

    def runs(self):
        with self.connection() as conn:
            runs = [dict(row) for row in conn.execute("SELECT * FROM runs ORDER BY started_at DESC,rowid DESC LIMIT 20")]
            for run in runs:
                run["summary"] = json.loads(run["summary"]) if run["summary"] else None
                run["attempts"] = [dict(row) for row in conn.execute("SELECT * FROM attempts WHERE run_id=? ORDER BY id", (run["id"],))]
                for attempt in run["attempts"]:
                    attempt["coverage"] = json.loads(attempt["coverage"]) if attempt["coverage"] else None
        return runs

    def changes(self):
        from .review import FIELD_LABELS, IMPORTANT
        from .workspace import records
        with self.connection() as conn:
            pages = [dict(row) for row in conn.execute("SELECT * FROM page_changes ORDER BY id DESC LIMIT 100")]
            versions = [dict(row) for row in conn.execute("SELECT v.opportunity_id,v.version,v.at,v.reason,v.changes,o.document FROM versions v JOIN opportunities o ON v.opportunity_id=o.id WHERE v.version>1 ORDER BY v.at DESC LIMIT 100")]
            documents = [json.loads(row[0]) for row in conn.execute("SELECT document FROM opportunities")]
            reviews = records(conn, "change_reviews")
        latest = {}
        for record in sorted(reviews, key=lambda value: (value["data"].get("sequence", 0), value["data"]["at"], value["id"])):
            data = record["data"]
            latest[(data["item_id"], data["change_id"])] = {**data, "review_id": record["id"]}
        for page in pages:
            page["linked_items"] = [{"id": doc["id"], "title": doc["title"], "edition": doc["edition"]} for doc in documents if doc["source_id"] == page["source_id"] and doc["official_url"] == page["url"]]
            page["latest_reviews"] = [latest[(item["id"], page["id"])] for item in page["linked_items"] if (item["id"], page["id"]) in latest]
        for row in versions:
            row["title"] = json.loads(row.pop("document"))["title"]
            row["changes"] = json.loads(row["changes"])
            row["important_fields"] = [FIELD_LABELS[name] for name in IMPORTANT if any(change.get("field", "").split(".")[0] == name for change in row["changes"])]
        return {"pages": pages, "versions": versions}

    def bootstrap(self):
        from .fit import get_profile, evaluate_fit
        from .digest import summarize_run
        profile=get_profile(self)
        items=self.items()
        for item in items:
            item['fit']=evaluate_fit(item,profile)
        return {"items": items, "sources": self.sources(), "runs": self.runs(), "changes": self.changes(), "profile": self.rules, "work_profile":profile, "digest":summarize_run(self), "candidates": self.candidates(), "write_protocol_version": 1}

    def export(self):
        with self.connection() as conn:
            docs = [json.loads(row[0]) for row in conn.execute("SELECT document FROM opportunities ORDER BY added_at,id")]
            versions = [dict(row) for row in conn.execute("SELECT * FROM versions ORDER BY opportunity_id,version")]
            observations = [dict(row) for row in conn.execute("SELECT * FROM observations ORDER BY id")]
            changes = [dict(row) for row in conn.execute("SELECT * FROM page_changes ORDER BY id")]
        for version in versions:
            version["snapshot"] = json.loads(version["snapshot"])
            version["changes"] = json.loads(version["changes"])
        for observation in observations:
            observation["coverage"] = json.loads(observation["coverage"]) if observation["coverage"] else None
        return {"schema_version": 3, "exported_at": utcnow(), "documents": docs, "versions": versions, "observations": observations, "page_changes": changes, "library": self.bootstrap()}

class AlreadyRunning(Exception):
    pass

class ProcessLock:
    """OS lock; auto-released on crashes. A leftover file never implies a live lock."""
    def __init__(self, path):
        self.path, self.file = Path(path), None
    def __enter__(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.file = open(self.path, "a+b")
        self.file.seek(0, 2)
        if self.file.tell() == 0:
            self.file.write(b"0")
            self.file.flush()
        self.file.seek(0)
        try:
            if __import__("os").name == "nt":
                import msvcrt
                msvcrt.locking(self.file.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(self.file.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError as exc:
            self.file.close()
            self.file = None
            raise AlreadyRunning("已有一次检查正在执行，请等待当前检查完成") from exc
        return self
    def __exit__(self, *args):
        if self.file:
            if __import__("os").name == "nt":
                import msvcrt
                self.file.seek(0)
                msvcrt.locking(self.file.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                import fcntl
                fcntl.flock(self.file.fileno(), fcntl.LOCK_UN)
            self.file.close()
