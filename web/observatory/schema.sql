PRAGMA foreign_keys = ON;

CREATE TABLE store_meta (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  store_id TEXT NOT NULL UNIQUE,
  schema_version INTEGER NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('isolated', 'demo', 'production')),
  project_root TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE materials (
  id TEXT PRIMARY KEY,
  revision INTEGER NOT NULL CHECK (revision > 0),
  status TEXT NOT NULL CHECK (status IN ('active', 'archived', 'deleted')),
  body_json TEXT NOT NULL CHECK (json_valid(body_json)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE topics (
  id TEXT PRIMARY KEY,
  revision INTEGER NOT NULL CHECK (revision > 0),
  status TEXT NOT NULL CHECK (status IN ('draft', 'researching', 'paused', 'stage_complete', 'archived', 'deleted')),
  body_json TEXT NOT NULL CHECK (json_valid(body_json)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE topic_materials (
  topic_id TEXT NOT NULL REFERENCES topics(id),
  material_id TEXT NOT NULL REFERENCES materials(id),
  PRIMARY KEY (topic_id, material_id)
);
CREATE TABLE stage_records (
  id TEXT PRIMARY KEY,
  topic_id TEXT NOT NULL REFERENCES topics(id),
  topic_revision INTEGER NOT NULL,
  body_json TEXT NOT NULL CHECK (json_valid(body_json)),
  created_at TEXT NOT NULL,
  UNIQUE (topic_id, topic_revision)
);
CREATE TABLE attachments (
  id TEXT PRIMARY KEY,
  original_filename TEXT NOT NULL,
  relative_path TEXT NOT NULL UNIQUE,
  sha256 TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  byte_length INTEGER NOT NULL,
  permission_status TEXT NOT NULL DEFAULT 'unknown',
  status TEXT NOT NULL CHECK (status IN ('registered', 'unavailable'))
);
CREATE TABLE submissions (
  submission_id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  payload_sha256 TEXT NOT NULL,
  receipt_json TEXT NOT NULL CHECK (json_valid(receipt_json)),
  created_at TEXT NOT NULL
);
