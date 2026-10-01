-- Team experiment records. Rows are never overwritten; deleting only sets deleted_at so the history stays.
CREATE TABLE IF NOT EXISTS records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  saved_at TEXT NOT NULL,
  data TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS records_live ON records (deleted_at, id);
