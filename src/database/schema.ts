export const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('admin','participant')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS instructors (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  expertise  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workshops (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  title         TEXT NOT NULL,
  description   TEXT,
  instructor_id INTEGER NOT NULL REFERENCES instructors(id),
  created_by    INTEGER NOT NULL REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  workshop_id  INTEGER NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  starts_at    TEXT NOT NULL,
  location     TEXT NOT NULL,
  capacity     INTEGER NOT NULL CHECK (capacity > 0),
  seats_taken  INTEGER NOT NULL DEFAULT 0 CHECK (seats_taken <= capacity),
  status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','cancelled','completed'))
);

CREATE TABLE IF NOT EXISTS registrations (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id    INTEGER NOT NULL REFERENCES sessions(id),
  user_id       INTEGER NOT NULL REFERENCES users(id),
  status        TEXT NOT NULL DEFAULT 'registered' CHECK (status IN ('registered','cancelled','attended')),
  registered_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (session_id, user_id)
);
`;
