/**
 * Database layer — Embedded PostgreSQL via PGlite (WASM).
 * No external database server needed. Data stored in app's user data directory.
 * Pure JavaScript/WASM: no native C++ modules, works on all platforms.
 */
const { PGlite } = require("@electric-sql/pglite");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");

let db = null;

function uuid() {
  return crypto.randomUUID();
}

function now() {
  return new Date().toISOString();
}

async function init(dataDir) {
  const dbPath = path.join(dataDir, "pgdata");
  fs.mkdirSync(dbPath, { recursive: true });

  db = new PGlite(dbPath);
  await db.query("SELECT 1");
  console.log(`[StepScribe] Embedded PostgreSQL ready: ${dbPath}`);

  await createTables();
  return db;
}

/** Run a query and return the full result */
async function run(sql, params = []) {
  return db.query(sql, params);
}

/** Run a query and return the first row or null */
async function getOne(sql, params = []) {
  const { rows } = await db.query(sql, params);
  return rows[0] || null;
}

/** Run a query and return all rows */
async function getAll(sql, params = []) {
  const { rows } = await db.query(sql, params);
  return rows;
}

/** Get a pseudo-client for transactions (BEGIN/COMMIT/ROLLBACK via query) */
async function getClient() {
  return {
    query: async (sql, params) => db.query(sql, params),
    release: () => {},
  };
}

async function createTables() {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE,
      password_hash TEXT DEFAULT '',
      display_name TEXT DEFAULT '',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS user_preferences (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE REFERENCES users(id),
      faith_tradition TEXT DEFAULT '',
      faith_notes TEXT DEFAULT '',
      about_me TEXT DEFAULT '',
      onboarding_complete BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS journal_entries (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      title TEXT DEFAULT '',
      content TEXT DEFAULT '',
      content_html TEXT DEFAULT '',
      prompt_used TEXT,
      is_draft BOOLEAN DEFAULT TRUE,
      sections_included TEXT,
      entry_date TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS mood_entries (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      entry_id TEXT REFERENCES journal_entries(id),
      weather TEXT NOT NULL,
      note TEXT DEFAULT '',
      energy_level INTEGER DEFAULT 5,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS user_heroes (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      is_active BOOLEAN DEFAULT TRUE,
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS group_journals (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      created_by TEXT REFERENCES users(id),
      invite_code TEXT UNIQUE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS group_members (
      id TEXT PRIMARY KEY,
      group_id TEXT REFERENCES group_journals(id),
      user_id TEXT REFERENCES users(id),
      role TEXT DEFAULT 'member',
      joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS shared_entries (
      id TEXT PRIMARY KEY,
      entry_id TEXT REFERENCES journal_entries(id),
      group_id TEXT REFERENCES group_journals(id),
      shared_by TEXT REFERENCES users(id),
      shared_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS ai_memories (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      category TEXT NOT NULL,
      content TEXT NOT NULL,
      source TEXT DEFAULT 'conversation',
      source_id TEXT,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      entry_id TEXT REFERENCES journal_entries(id),
      messages TEXT DEFAULT '[]',
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  // Ensure default user exists
  const existing = await getOne("SELECT id FROM users WHERE id = $1", ["default"]);
  if (!existing) {
    await run(
      "INSERT INTO users (id, username, display_name) VALUES ($1, $2, $3)",
      ["default", "default", "You"]
    );
  }

  // Run migrations for columns that may be missing (IF NOT EXISTS requires PostgreSQL 9.6+)
  const migrations = [
    ["user_preferences", "about_me", "TEXT DEFAULT ''"],
    ["journal_entries", "sections_included", "TEXT"],
    ["journal_entries", "entry_date", "TEXT"],
  ];
  for (const [table, column, colType] of migrations) {
    try {
      await run(
        `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} ${colType}`
      );
    } catch {
      /* column already exists */
    }
  }
}

async function close() {
  if (db) {
    await db.close();
    db = null;
  }
}

module.exports = {
  init,
  run,
  getOne,
  getAll,
  getClient,
  uuid,
  now,
  close,
};
