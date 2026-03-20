/**
 * Database layer — better-sqlite3 for synchronous SQLite access.
 * Single-user desktop app: no connection pooling needed.
 */
const path = require("path");
const crypto = require("crypto");

let _db = null;

function uuid() {
  return crypto.randomUUID();
}

function now() {
  return new Date().toISOString();
}

function init(dataDir) {
  const Database = require("better-sqlite3");
  const dbPath = path.join(dataDir, "stepscribe.db");
  _db = new Database(dbPath);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  createTables();
  return _db;
}

function db() {
  if (!_db) throw new Error("Database not initialized. Call init(dataDir) first.");
  return _db;
}

function createTables() {
  const d = db();

  d.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1,1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
      username TEXT UNIQUE,
      password_hash TEXT DEFAULT '',
      display_name TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_preferences (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE REFERENCES users(id),
      faith_tradition TEXT DEFAULT '',
      faith_notes TEXT DEFAULT '',
      about_me TEXT DEFAULT '',
      onboarding_complete INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS journal_entries (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      title TEXT DEFAULT '',
      content TEXT DEFAULT '',
      content_html TEXT DEFAULT '',
      prompt_used TEXT,
      is_draft INTEGER DEFAULT 1,
      sections_included TEXT,
      entry_date TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS mood_entries (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      entry_id TEXT REFERENCES journal_entries(id),
      weather TEXT NOT NULL,
      note TEXT DEFAULT '',
      energy_level INTEGER DEFAULT 5,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_heroes (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      is_active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS group_journals (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      created_by TEXT REFERENCES users(id),
      invite_code TEXT UNIQUE,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS group_members (
      id TEXT PRIMARY KEY,
      group_id TEXT REFERENCES group_journals(id),
      user_id TEXT REFERENCES users(id),
      role TEXT DEFAULT 'member',
      joined_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS shared_entries (
      id TEXT PRIMARY KEY,
      entry_id TEXT REFERENCES journal_entries(id),
      group_id TEXT REFERENCES group_journals(id),
      shared_by TEXT REFERENCES users(id),
      shared_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      entry_id TEXT REFERENCES journal_entries(id),
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      content_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      caption TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ai_memories (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      category TEXT NOT NULL,
      content TEXT NOT NULL,
      source TEXT DEFAULT 'conversation',
      source_id TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      entry_id TEXT REFERENCES journal_entries(id),
      messages TEXT DEFAULT '[]',
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS app_config (
      id TEXT PRIMARY KEY DEFAULT 'default',
      ai_provider TEXT DEFAULT '',
      openai_api_key TEXT DEFAULT '',
      openai_model TEXT DEFAULT '',
      anthropic_api_key TEXT DEFAULT '',
      anthropic_model TEXT DEFAULT '',
      grok_api_key TEXT DEFAULT '',
      grok_model TEXT DEFAULT '',
      grok_base_url TEXT DEFAULT '',
      ollama_base_url TEXT DEFAULT '',
      ollama_model TEXT DEFAULT '',
      custom_ai_base_url TEXT DEFAULT '',
      custom_ai_api_key TEXT DEFAULT '',
      custom_ai_model TEXT DEFAULT '',
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Ensure default user exists
  const existing = d.prepare("SELECT id FROM users WHERE id = ?").get("default");
  if (!existing) {
    d.prepare("INSERT INTO users (id, username, display_name) VALUES (?, ?, ?)").run("default", "default", "You");
  }

  // Run migrations for columns that may be missing
  const migrations = [
    ["user_preferences", "about_me", "TEXT DEFAULT ''"],
    ["journal_entries", "sections_included", "TEXT"],
    ["journal_entries", "entry_date", "TEXT"],
  ];
  for (const [table, column, colType] of migrations) {
    try {
      d.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${colType}`);
    } catch {
      // Column already exists
    }
  }
}

module.exports = { init, db, uuid, now };
