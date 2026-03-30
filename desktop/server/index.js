/**
 * Express API server — complete port of the FastAPI backend to Node.js.
 * Runs inside Electron's process. No Docker, no Python.
 * Uses embedded PostgreSQL via PGlite (WASM) — all queries are async.
 */
const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { getOne, getAll, run, getClient, uuid, now } = require("./db");
const ai = require("./ai");
const { getSystemPrompt, getSystemPromptWithHeroes, getTemplate, getAllTemplates, getStepContext } = require("./sponsor");
const {
  FAITH_TRADITIONS, MOOD_WEATHER, DEFAULT_HEROES, MEMORY_CATEGORIES,
  RECOMMENDED_MODELS, STEP_COMPANION_MODELFILE,
} = require("./models");

// ── Multer for file uploads ──
const multer = require("multer");

const ALLOWED_TYPES = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/heic", "image/heif",
  "application/pdf", "text/plain", "text/markdown",
]);
const AUDIO_TYPES = new Set([
  "audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav", "audio/x-wav",
  "audio/mp3", "audio/flac", "audio/x-m4a", "video/webm",
]);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

/** Wrap async route handlers so Express catches errors */
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function createApp({ dataDir, uploadDir, exportDir, frontendDir }) {
  const app = express();

  // Ensure directories exist
  for (const d of [dataDir, uploadDir, exportDir]) {
    fs.mkdirSync(d, { recursive: true });
  }

  // Configure multer
  const upload = multer({
    storage: multer.diskStorage({
      destination: uploadDir,
      filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase() || "";
        cb(null, `${crypto.randomUUID().replace(/-/g, "")}${ext}`);
      },
    }),
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (req, file, cb) => {
      cb(null, ALLOWED_TYPES.has(file.mimetype));
    },
  });

  // Middleware
  app.use(express.json({ limit: "50mb" }));
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Expose-Headers", "X-Conversation-Id");
    if (req.method === "OPTIONS") return res.sendStatus(200);
    next();
  });

  // ══════════════════════════════════════
  // Health
  // ══════════════════════════════════════
  app.get("/health", (req, res) => res.json({ status: "ok", app: "StepScribe" }));

  // ══════════════════════════════════════
  // Journal Entries
  // ══════════════════════════════════════
  app.post("/api/journal/entries", asyncHandler(async (req, res) => {
    const { user_id = "default", title = "", content = "", content_html = "", prompt_used = null, is_draft = true, sections_included = null, entry_date = null } = req.body;
    const id = uuid();
    const ts = now();
    await run(`INSERT INTO journal_entries (id, user_id, title, content, content_html, prompt_used, is_draft, sections_included, entry_date, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [id, user_id, title, content, content_html, prompt_used, !!is_draft, sections_included ? JSON.stringify(sections_included) : null, entry_date || null, ts, ts]);
    const entry = await getOne("SELECT * FROM journal_entries WHERE id = $1", [id]);
    res.json(formatEntry(entry));
  }));

  app.get("/api/journal/entries", asyncHandler(async (req, res) => {
    const { user_id = "default", limit = "50", offset = "0" } = req.query;
    const entries = await getAll("SELECT * FROM journal_entries WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
      [user_id, parseInt(limit), parseInt(offset)]);
    res.json(entries.map(formatEntry));
  }));

  app.get("/api/journal/entries/:id", asyncHandler(async (req, res) => {
    const entry = await getOne("SELECT * FROM journal_entries WHERE id = $1", [req.params.id]);
    if (!entry) return res.status(404).json({ detail: "Entry not found" });
    res.json(formatEntry(entry));
  }));

  app.patch("/api/journal/entries/:id", asyncHandler(async (req, res) => {
    const entry = await getOne("SELECT * FROM journal_entries WHERE id = $1", [req.params.id]);
    if (!entry) return res.status(404).json({ detail: "Entry not found" });
    const wasDraft = entry.is_draft;
    const updates = req.body;
    const fields = [];
    const values = [];
    let paramIdx = 1;
    for (const [k, v] of Object.entries(updates)) {
      if (k === "sections_included") { fields.push(`${k} = $${paramIdx++}`); values.push(v ? JSON.stringify(v) : null); }
      else if (k === "is_draft") { fields.push(`${k} = $${paramIdx++}`); values.push(!!v); }
      else if (["title", "content", "content_html", "entry_date"].includes(k)) { fields.push(`${k} = $${paramIdx++}`); values.push(v); }
    }
    fields.push(`updated_at = $${paramIdx++}`);
    values.push(now());
    values.push(req.params.id);
    await run(`UPDATE journal_entries SET ${fields.join(", ")} WHERE id = $${paramIdx}`, values);
    const updated = await getOne("SELECT * FROM journal_entries WHERE id = $1", [req.params.id]);

    // Extract memories when publishing
    if (wasDraft && !updated.is_draft && updated.content) {
      extractMemories(updated.content, updated.user_id, "journal", updated.id).catch(() => {});
    }

    res.json(formatEntry(updated));
  }));

  app.delete("/api/journal/entries/:id", asyncHandler(async (req, res) => {
    const entry = await getOne("SELECT * FROM journal_entries WHERE id = $1", [req.params.id]);
    if (!entry) return res.status(404).json({ detail: "Entry not found" });
    await run("DELETE FROM journal_entries WHERE id = $1", [req.params.id]);
    res.json({ deleted: true });
  }));

  // ══════════════════════════════════════
  // Mood
  // ══════════════════════════════════════
  app.get("/api/mood/weather-options", (req, res) => res.json(MOOD_WEATHER));

  app.post("/api/mood/", asyncHandler(async (req, res) => {
    const { user_id = "default", entry_id = null, weather, note = "", energy_level = 5 } = req.body;
    if (!MOOD_WEATHER[weather]) return res.status(422).json({ detail: "Invalid weather" });
    if (energy_level < 1 || energy_level > 10) return res.status(422).json({ detail: "Energy 1-10" });
    const id = uuid();
    await run("INSERT INTO mood_entries (id, user_id, entry_id, weather, note, energy_level, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      [id, user_id, entry_id, weather, note, energy_level, now()]);
    const mood = await getOne("SELECT * FROM mood_entries WHERE id = $1", [id]);
    res.json(formatMood(mood));
  }));

  app.get("/api/mood/by-entry/:entryId", asyncHandler(async (req, res) => {
    const mood = await getOne("SELECT * FROM mood_entries WHERE entry_id = $1 ORDER BY created_at DESC LIMIT 1", [req.params.entryId]);
    if (!mood) return res.json(null);
    res.json(formatMood(mood));
  }));

  app.get("/api/mood/history", asyncHandler(async (req, res) => {
    const { user_id = "default", limit = "30" } = req.query;
    const moods = await getAll("SELECT * FROM mood_entries WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2",
      [user_id, parseInt(limit)]);
    res.json(moods.map(formatMood));
  }));

  app.patch("/api/mood/:id", asyncHandler(async (req, res) => {
    const mood = await getOne("SELECT * FROM mood_entries WHERE id = $1", [req.params.id]);
    if (!mood) return res.status(404).json({ detail: "Mood entry not found" });
    const { weather, note, energy_level } = req.body;
    if (weather !== undefined) {
      if (!MOOD_WEATHER[weather]) return res.status(422).json({ detail: "Invalid weather" });
      await run("UPDATE mood_entries SET weather = $1 WHERE id = $2", [weather, req.params.id]);
    }
    if (note !== undefined) await run("UPDATE mood_entries SET note = $1 WHERE id = $2", [note, req.params.id]);
    if (energy_level !== undefined) {
      if (energy_level < 1 || energy_level > 10) return res.status(422).json({ detail: "Energy 1-10" });
      await run("UPDATE mood_entries SET energy_level = $1 WHERE id = $2", [energy_level, req.params.id]);
    }
    const updated = await getOne("SELECT * FROM mood_entries WHERE id = $1", [req.params.id]);
    res.json(formatMood(updated));
  }));

  app.delete("/api/mood/:id", asyncHandler(async (req, res) => {
    const mood = await getOne("SELECT * FROM mood_entries WHERE id = $1", [req.params.id]);
    if (!mood) return res.status(404).json({ detail: "Mood entry not found" });
    await run("DELETE FROM mood_entries WHERE id = $1", [req.params.id]);
    res.json({ deleted: true });
  }));

  // ══════════════════════════════════════
  // Heroes
  // ══════════════════════════════════════
  app.get("/api/heroes/defaults", (req, res) => res.json(DEFAULT_HEROES));

  app.get("/api/heroes/", asyncHandler(async (req, res) => {
    const { user_id = "default" } = req.query;
    const heroes = await getAll("SELECT * FROM user_heroes WHERE user_id = $1 ORDER BY sort_order", [user_id]);
    res.json(heroes.map(h => {
      let quotes = [];
      try { quotes = typeof h.quotes === "string" ? JSON.parse(h.quotes) : (h.quotes || []); } catch {}
      if (!Array.isArray(quotes)) quotes = [];
      return { ...h, is_active: !!h.is_active, quotes };
    }));
  }));

  app.post("/api/heroes/", asyncHandler(async (req, res) => {
    const { user_id = "default", name, description = "" } = req.body;
    const id = uuid();
    await run("INSERT INTO user_heroes (id, user_id, name, description) VALUES ($1, $2, $3, $4)", [id, user_id, name, description]);
    const hero = await getOne("SELECT * FROM user_heroes WHERE id = $1", [id]);
    res.json({ ...hero, is_active: !!hero.is_active, quotes: [] });
  }));

  app.delete("/api/heroes/:id", asyncHandler(async (req, res) => {
    const hero = await getOne("SELECT * FROM user_heroes WHERE id = $1", [req.params.id]);
    if (!hero) return res.status(404).json({ detail: "Hero not found" });
    await run("DELETE FROM user_heroes WHERE id = $1", [req.params.id]);
    res.json({ deleted: true });
  }));

  app.patch("/api/heroes/:id/toggle", asyncHandler(async (req, res) => {
    const hero = await getOne("SELECT * FROM user_heroes WHERE id = $1", [req.params.id]);
    if (!hero) return res.status(404).json({ detail: "Hero not found" });
    const newVal = !hero.is_active;
    await run("UPDATE user_heroes SET is_active = $1 WHERE id = $2", [newVal, req.params.id]);
    res.json({ id: hero.id, is_active: newVal });
  }));

  // Hero quotes + standalone user quotes — return all for the rotator
  app.get("/api/heroes/quotes", asyncHandler(async (req, res) => {
    const { user_id = "default" } = req.query;
    const heroes = await getAll("SELECT * FROM user_heroes WHERE user_id = $1 AND is_active = TRUE ORDER BY sort_order", [user_id]);
    const quotes = [];
    for (const hero of heroes) {
      let heroQuotes = [];
      try { heroQuotes = typeof hero.quotes === "string" ? JSON.parse(hero.quotes) : (hero.quotes || []); } catch {}
      for (const q of heroQuotes) {
        if (q && q.text) {
          quotes.push({ author: hero.name, text: q.text, source: q.source || "" });
        }
      }
    }
    // Also include standalone user quotes
    const userQuotes = await getAll("SELECT * FROM user_quotes WHERE user_id = $1 AND is_active = TRUE ORDER BY created_at DESC", [user_id]);
    for (const uq of userQuotes) {
      quotes.push({ author: uq.author || "", text: uq.text, source: uq.source || "" });
    }
    res.json(quotes);
  }));

  // Search quotes for a hero via Goodreads scraping (real verified quotes)
  app.post("/api/heroes/search-quotes", asyncHandler(async (req, res) => {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ detail: "Hero name is required" });
    try {
      const searchUrl = `https://www.goodreads.com/quotes/search?q=${encodeURIComponent(name.trim())}`;
      const resp = await fetch(searchUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
      });
      if (!resp.ok) throw new Error(`Goodreads returned ${resp.status}`);
      const html = await resp.text();

      // Parse quotes from Goodreads HTML — quotes live in <div class="quoteText">
      // Goodreads uses &ldquo; / &rdquo; HTML entities for curly quotes
      const quotes = [];
      const quoteBlocks = html.split('class="quoteText"');
      for (let i = 1; i < quoteBlocks.length && quotes.length < 8; i++) {
        const block = quoteBlocks[i];
        // Match text between &ldquo; ... &rdquo; HTML entities
        const textMatch = block.match(/&ldquo;([\s\S]*?)&rdquo;/);
        if (!textMatch) continue;
        const text = textMatch[1]
          .replace(/<br\s*\/?>/gi, " ")
          .replace(/<[^>]+>/g, "")
          .replace(/&ldquo;/g, "\u201C").replace(/&rdquo;/g, "\u201D")
          .replace(/&lsquo;/g, "\u2018").replace(/&rsquo;/g, "\u2019")
          .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
          .replace(/&#39;/g, "'").replace(/&quot;/g, '"')
          .replace(/&mdash;/g, "\u2014").replace(/&ndash;/g, "\u2013")
          .replace(/\s+/g, " ").trim();
        if (!text || text.length < 10) continue;

        // Extract source (book title) from <em> inside authorOrTitle link
        let source = "";
        const sourceMatch = block.match(/<em[^>]*>([^<]+)<\/em>/i);
        if (sourceMatch) source = sourceMatch[1].replace(/&amp;/g, "&").trim();

        quotes.push({ text, source });
      }

      if (quotes.length > 0) {
        return res.json({ quotes });
      }
      // If Goodreads didn't return results, fall back to AI
      throw new Error("No quotes found on Goodreads");
    } catch (goodreadsErr) {
      // Fallback: try AI search
      try {
        const prompt = `Find 5 real, famous, verified quotes by "${name.trim()}".
Only include quotes that are genuinely attributed to this person.
If this person is not a public figure or you cannot find verified quotes, return an empty array.
Do NOT make up quotes. Do NOT attribute quotes to the wrong person.

Return ONLY a JSON array of objects with "text" and "source" fields. Example:
[{"text": "The quote text here.", "source": "Book or Speech name"}]

If no verified quotes exist, return: []`;
        const response = await ai.chat([{ role: "user", content: prompt }], 0.2);
        let cleaned = response.trim();
        if (cleaned.startsWith("```")) cleaned = cleaned.split("\n").slice(1).join("\n").replace(/```/g, "");
        const parsed = JSON.parse(cleaned);
        if (!Array.isArray(parsed)) return res.json({ quotes: [] });
        const safeQuotes = parsed.slice(0, 10).filter(q => q && q.text).map(q => ({
          text: String(q.text).slice(0, 500),
          source: String(q.source || "").slice(0, 200),
        }));
        res.json({ quotes: safeQuotes });
      } catch {
        res.json({ quotes: [] });
      }
    }
  }));

  // Save quotes on a hero
  app.patch("/api/heroes/:id/quotes", asyncHandler(async (req, res) => {
    const hero = await getOne("SELECT * FROM user_heroes WHERE id = $1", [req.params.id]);
    if (!hero) return res.status(404).json({ detail: "Hero not found" });
    const quotes = (req.body.quotes || []).slice(0, 20).filter(q => q && q.text).map(q => ({
      text: String(q.text).slice(0, 500),
      source: String(q.source || "").slice(0, 200),
    }));
    await run("UPDATE user_heroes SET quotes = $1 WHERE id = $2", [JSON.stringify(quotes), req.params.id]);
    res.json({ id: hero.id, quotes });
  }));

  // ══════════════════════════════════════
  // Standalone Quotes / Passages
  // ══════════════════════════════════════
  app.get("/api/quotes/", asyncHandler(async (req, res) => {
    const { user_id = "default" } = req.query;
    const quotes = await getAll("SELECT * FROM user_quotes WHERE user_id = $1 ORDER BY created_at DESC", [user_id]);
    res.json(quotes);
  }));

  app.post("/api/quotes/", asyncHandler(async (req, res) => {
    const { user_id = "default", text, author = "", source = "", category = "general" } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ detail: "Quote text is required" });
    const id = crypto.randomUUID();
    await run(
      "INSERT INTO user_quotes (id, user_id, text, author, source, category) VALUES ($1, $2, $3, $4, $5, $6)",
      [id, user_id, String(text).slice(0, 1000), String(author).slice(0, 200), String(source).slice(0, 300), String(category).slice(0, 50)]
    );
    res.json({ id, user_id, text, author, source, category, is_active: true });
  }));

  app.delete("/api/quotes/:id", asyncHandler(async (req, res) => {
    await run("DELETE FROM user_quotes WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  }));

  app.patch("/api/quotes/:id/toggle", asyncHandler(async (req, res) => {
    const q = await getOne("SELECT * FROM user_quotes WHERE id = $1", [req.params.id]);
    if (!q) return res.status(404).json({ detail: "Quote not found" });
    const newVal = !q.is_active;
    await run("UPDATE user_quotes SET is_active = $1 WHERE id = $2", [newVal, req.params.id]);
    res.json({ id: q.id, is_active: newVal });
  }));

  // ══════════════════════════════════════
  // Faith
  // ══════════════════════════════════════
  // No pre-filled traditions — users describe their faith in their own words
  app.get("/api/faith/traditions", (req, res) => {
    res.json({});
  });

  app.get("/api/faith/", asyncHandler(async (req, res) => {
    const { user_id = "default" } = req.query;
    const prefs = await getOne("SELECT * FROM user_preferences WHERE user_id = $1", [user_id]);
    if (!prefs || (!prefs.faith_tradition && !prefs.faith_notes)) return res.json(null);
    res.json({
      faith_tradition: prefs.faith_tradition || "",
      faith_notes: prefs.faith_notes || "",
      tradition_label: prefs.faith_tradition || "",
      tradition_description: prefs.faith_notes || "",
      figures: [],
      practices: [],
    });
  }));

  app.put("/api/faith/", asyncHandler(async (req, res) => {
    const { user_id = "default", faith_tradition = "", faith_notes = "" } = req.body;
    const existing = await getOne("SELECT * FROM user_preferences WHERE user_id = $1", [user_id]);
    if (existing) {
      await run("UPDATE user_preferences SET faith_tradition = $1, faith_notes = $2, updated_at = $3 WHERE user_id = $4",
        [faith_tradition, faith_notes, now(), user_id]);
    } else {
      await run("INSERT INTO user_preferences (id, user_id, faith_tradition, faith_notes) VALUES ($1, $2, $3, $4)",
        [uuid(), user_id, faith_tradition, faith_notes]);
    }
    res.json({ faith_tradition, tradition_label: faith_tradition, saved: true });
  }));

  // ══════════════════════════════════════
  // Onboarding
  // ══════════════════════════════════════
  app.get("/api/onboarding/status", asyncHandler(async (req, res) => {
    const { user_id = "default" } = req.query;
    const prefs = await getOne("SELECT * FROM user_preferences WHERE user_id = $1", [user_id]);
    const heroRow = await getOne("SELECT COUNT(*) as cnt FROM user_heroes WHERE user_id = $1 AND is_active = TRUE", [user_id]);
    const heroCount = heroRow?.cnt || 0;
    if (!prefs) return res.json({ onboarding_complete: false, faith_tradition: "", faith_label: "", hero_count: parseInt(heroCount) });
    res.json({
      onboarding_complete: !!prefs.onboarding_complete,
      faith_tradition: prefs.faith_tradition || "",
      faith_label: prefs.faith_tradition || "",
      hero_count: parseInt(heroCount),
    });
  }));

  app.post("/api/onboarding/complete", asyncHandler(async (req, res) => {
    const { user_id = "default", faith_tradition = "", faith_notes = "", about_me = "", heroes = null, reset = false } = req.body;
    if (reset) {
      const existing = await getOne("SELECT * FROM user_preferences WHERE user_id = $1", [user_id]);
      if (existing) {
        await run("UPDATE user_preferences SET faith_tradition = '', faith_notes = '', about_me = '', onboarding_complete = FALSE, updated_at = $1 WHERE user_id = $2", [now(), user_id]);
      } else {
        await run("INSERT INTO user_preferences (id, user_id, onboarding_complete) VALUES ($1, $2, FALSE)", [uuid(), user_id]);
      }
      await run("DELETE FROM user_heroes WHERE user_id = $1", [user_id]);
      return res.json({ onboarding_complete: false, message: "Onboarding has been reset" });
    }
    const existing = await getOne("SELECT * FROM user_preferences WHERE user_id = $1", [user_id]);
    if (existing) {
      await run("UPDATE user_preferences SET faith_tradition = $1, faith_notes = $2, about_me = $3, onboarding_complete = TRUE, updated_at = $4 WHERE user_id = $5",
        [faith_tradition, faith_notes, about_me, now(), user_id]);
    } else {
      await run("INSERT INTO user_preferences (id, user_id, faith_tradition, faith_notes, about_me, onboarding_complete) VALUES ($1, $2, $3, $4, $5, TRUE)",
        [uuid(), user_id, faith_tradition, faith_notes, about_me]);
    }
    if (heroes !== null) {
      await run("DELETE FROM user_heroes WHERE user_id = $1", [user_id]);
      const client = await getClient();
      try {
        await client.query("BEGIN");
        for (let i = 0; i < heroes.length; i++) {
          const h = heroes[i];
          await client.query(
            "INSERT INTO user_heroes (id, user_id, name, description, sort_order) VALUES ($1, $2, $3, $4, $5)",
            [uuid(), user_id, h.name, h.description || "", i]
          );
        }
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    }
    // Clear old onboarding memories
    await run("DELETE FROM ai_memories WHERE user_id = $1 AND source = 'onboarding'", [user_id]);
    if (about_me?.trim()) {
      await run("INSERT INTO ai_memories (id, user_id, category, content, source) VALUES ($1, $2, 'preference', $3, 'onboarding')",
        [uuid(), user_id, `User shared during onboarding: ${about_me.trim()}`]);
    }
    if (faith_notes?.trim()) {
      await run("INSERT INTO ai_memories (id, user_id, category, content, source) VALUES ($1, $2, 'preference', $3, 'onboarding')",
        [uuid(), user_id, `Faith background: ${faith_notes.trim()}`]);
    }
    const t = {};
    res.json({ onboarding_complete: true, suggested_figures: t.figures || [], suggested_practices: t.practices || [] });
  }));

  // ══════════════════════════════════════
  // AI Memory
  // ══════════════════════════════════════
  app.get("/api/memory/", asyncHandler(async (req, res) => {
    const { user_id = "default", category, limit = "100" } = req.query;
    let sql = "SELECT * FROM ai_memories WHERE user_id = $1";
    const params = [user_id];
    let paramIdx = 2;
    if (category) { sql += ` AND category = $${paramIdx++}`; params.push(category); }
    sql += ` ORDER BY updated_at DESC LIMIT $${paramIdx}`;
    params.push(parseInt(limit));
    const memories = await getAll(sql, params);
    res.json(memories.map(m => ({ ...m, is_active: !!m.is_active })));
  }));

  app.post("/api/memory/", asyncHandler(async (req, res) => {
    const { user_id = "default", category, content, source = "manual" } = req.body;
    const id = uuid();
    const ts = now();
    await run("INSERT INTO ai_memories (id, user_id, category, content, source, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      [id, user_id, category, content, source, ts, ts]);
    const memory = await getOne("SELECT * FROM ai_memories WHERE id = $1", [id]);
    res.json({ ...memory, is_active: !!memory.is_active });
  }));

  app.delete("/api/memory/:id", asyncHandler(async (req, res) => {
    const memory = await getOne("SELECT * FROM ai_memories WHERE id = $1", [req.params.id]);
    if (!memory) return res.status(404).json({ detail: "Memory not found" });
    await run("DELETE FROM ai_memories WHERE id = $1", [req.params.id]);
    res.json({ deleted: true });
  }));

  app.patch("/api/memory/:id/toggle", asyncHandler(async (req, res) => {
    const memory = await getOne("SELECT * FROM ai_memories WHERE id = $1", [req.params.id]);
    if (!memory) return res.status(404).json({ detail: "Memory not found" });
    const newVal = !memory.is_active;
    await run("UPDATE ai_memories SET is_active = $1 WHERE id = $2", [newVal, req.params.id]);
    res.json({ id: memory.id, is_active: newVal });
  }));

  // Memory compaction — uses AI to merge and summarize related memories
  app.post("/api/memory/compact", asyncHandler(async (req, res) => {
    const { user_id = "default", category } = req.body;
    let sql = "SELECT * FROM ai_memories WHERE user_id = $1 AND is_active = TRUE";
    const params = [user_id];
    let paramIdx = 2;
    if (category) { sql += ` AND category = $${paramIdx++}`; params.push(category); }
    sql += " ORDER BY category, created_at";
    const memories = await getAll(sql, params);
    if (memories.length < 3) {
      return res.json({ status: "skip", message: "Not enough memories to compact (need at least 3).", before: memories.length, after: memories.length });
    }
    // Group by category
    const byCat = {};
    for (const m of memories) { (byCat[m.category] = byCat[m.category] || []).push(m); }
    const COMPACT_PROMPT = `You are a memory compaction system. Given a list of memories about a person in recovery, merge duplicates, remove redundancies, and summarize related items into fewer, denser memories.

Rules:
- Preserve all important information — don't lose facts, just compress.
- Merge memories that say similar things into one richer statement.
- Keep the same category for each output memory.
- Write in third person: "They..." or "He/She..."
- Return a JSON array of objects with "category" and "content" fields.
- Return ONLY the JSON array, no explanation.
- Aim to reduce the count by roughly 30-50% while keeping all key details.`;

    let totalBefore = 0;
    let totalAfter = 0;
    const ts = now();
    const errors = [];

    for (const [cat, catMemories] of Object.entries(byCat)) {
      if (catMemories.length < 2) continue; // skip categories with only 1 memory
      totalBefore += catMemories.length;
      const memoryList = catMemories.map((m, i) => `${i + 1}. [${m.category}] ${m.content}`).join("\n");
      try {
        const response = await ai.chat([
          { role: "system", content: COMPACT_PROMPT },
          { role: "user", content: `Compact these ${catMemories.length} memories in the "${cat}" category:\n\n${memoryList}` },
        ], 0.2);
        let cleaned = response.trim();
        if (cleaned.startsWith("```")) cleaned = cleaned.split("\n").slice(1).join("\n").replace(/```$/, "");
        const compacted = JSON.parse(cleaned);
        if (!Array.isArray(compacted) || compacted.length === 0) {
          errors.push(`${cat}: AI returned invalid result`);
          continue;
        }
        // Delete old memories in this category for this user
        const ids = catMemories.map(m => m.id);
        await run("DELETE FROM ai_memories WHERE id = ANY($1)", [ids]);
        // Insert compacted memories
        for (const item of compacted) {
          if (!item.content) continue;
          await run("INSERT INTO ai_memories (id, user_id, category, content, source, source_id, created_at, updated_at) VALUES ($1, $2, $3, $4, 'compacted', NULL, $5, $6)",
            [uuid(), user_id, item.category || cat, item.content, ts, ts]);
        }
        totalAfter += compacted.length;
      } catch (e) {
        errors.push(`${cat}: ${e.message}`);
        totalBefore -= catMemories.length; // don't count failed categories
      }
    }
    // Count untouched memories (categories with < 2 items)
    const untouched = memories.length - totalBefore;
    res.json({
      status: errors.length ? "partial" : "ok",
      before: totalBefore + untouched,
      after: totalAfter + untouched,
      reduced: totalBefore - totalAfter,
      errors: errors.length ? errors : undefined,
    });
  }));

  // ══════════════════════════════════════
  // AI Chat (simple — not conversation-persistent)
  // ══════════════════════════════════════
  app.post("/api/ai/chat", async (req, res) => {
    const { message, conversation_history = [], hero_names = [], template_key, faith_tradition = "", faith_notes = "" } = req.body;
    try {
      const system = getSystemPromptWithHeroes(hero_names, faith_tradition, faith_notes);
      const messages = [{ role: "system", content: system }, ...conversation_history];
      if (template_key) {
        const tmpl = getTemplate(template_key);
        if (tmpl) messages.push({ role: "assistant", content: tmpl.prompt });
      }
      messages.push({ role: "user", content: message });
      const response = await ai.chat(messages);
      res.json({ response });
    } catch (e) {
      res.status(502).json({ detail: `AI provider error: ${e.message}` });
    }
  });

  app.post("/api/ai/chat/stream", async (req, res) => {
    const { message, conversation_history = [], hero_names = [], template_key, faith_tradition = "", faith_notes = "" } = req.body;
    try {
      const system = getSystemPromptWithHeroes(hero_names, faith_tradition, faith_notes);
      const messages = [{ role: "system", content: system }, ...conversation_history];
      if (template_key) {
        const tmpl = getTemplate(template_key);
        if (tmpl) messages.push({ role: "assistant", content: tmpl.prompt });
      }
      messages.push({ role: "user", content: message });
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      for await (const chunk of ai.stream(messages)) {
        res.write(`data: ${chunk}\n\n`);
      }
      res.write("data: [DONE]\n\n");
      res.end();
    } catch (e) {
      res.write(`data: [ERROR] ${e.message}\n\n`);
      res.end();
    }
  });

  app.get("/api/ai/templates", (req, res) => res.json(getAllTemplates()));

  app.post("/api/ai/generate-prompt", async (req, res) => {
    const { context, hero_names = [] } = req.body;
    try {
      const metaPrompt = "You are helping create a journaling prompt for someone in recovery. Based on what they're dealing with, write ONE thoughtful prompt that will help them dig into what matters. Write it in second person, conversational, warm but direct. Don't explain it — just write the prompt itself. Keep it to 2-4 sentences.";
      const messages = [{ role: "system", content: metaPrompt }, { role: "user", content: `What I'm dealing with: ${context}` }];
      const prompt = await ai.chat(messages, 0.8);
      res.json({ prompt });
    } catch (e) {
      res.status(502).json({ detail: `AI provider error: ${e.message}` });
    }
  });

  // ══════════════════════════════════════
  // Conversations (persistent chat)
  // ══════════════════════════════════════
  app.get("/api/conversations/", asyncHandler(async (req, res) => {
    const { user_id = "default", entry_id, limit = "20" } = req.query;
    let sql = "SELECT * FROM conversations WHERE user_id = $1";
    const params = [user_id];
    let paramIdx = 2;
    if (entry_id) { sql += ` AND entry_id = $${paramIdx++}`; params.push(entry_id); }
    sql += ` ORDER BY updated_at DESC LIMIT $${paramIdx}`;
    params.push(parseInt(limit));
    const convos = await getAll(sql, params);
    res.json(convos.map(formatConversation));
  }));

  app.get("/api/conversations/templates/list", (req, res) => res.json(getAllTemplates()));

  app.get("/api/conversations/:id", asyncHandler(async (req, res) => {
    const convo = await getOne("SELECT * FROM conversations WHERE id = $1", [req.params.id]);
    if (!convo) return res.status(404).json({ detail: "Conversation not found" });
    res.json(formatConversation(convo));
  }));

  app.post("/api/conversations/send", asyncHandler(async (req, res) => {
    const { user_id = "default", conversation_id, entry_id, message, template_key, current_step } = req.body;
    try {
      let convo = conversation_id ? await getOne("SELECT * FROM conversations WHERE id = $1", [conversation_id]) : null;
      if (!convo) {
        const newId = uuid();
        const createTs = now();
        await run("INSERT INTO conversations (id, user_id, entry_id, messages, created_at, updated_at) VALUES ($1, $2, $3, '[]', $4, $5)",
          [newId, user_id, entry_id || null, createTs, createTs]);
        convo = await getOne("SELECT * FROM conversations WHERE id = $1", [newId]);
      }
      const memCtx = await getMemoryContext(user_id);
      const prefs = await getOne("SELECT * FROM user_preferences WHERE user_id = $1", [user_id]);
      const heroNames = (await getAll("SELECT name FROM user_heroes WHERE user_id = $1 AND is_active = TRUE", [user_id])).map(h => h.name);
      let system = getSystemPromptWithHeroes(heroNames, prefs?.faith_tradition || "", prefs?.faith_notes || "", memCtx.heroQuotes || {});
      if (memCtx.text) system += "\n\n" + memCtx.text;
      if (current_step) system += getStepContext(current_step);
      const eid = entry_id || convo.entry_id;
      if (eid) {
        const entry = await getOne("SELECT * FROM journal_entries WHERE id = $1", [eid]);
        if (entry?.content) system += `\n\nCURRENT JOURNAL ENTRY (what the person has written so far):\nTitle: ${entry.title}\n${entry.content}`;
      }
      const existingMsgs = JSON.parse(convo.messages || "[]");
      const aiMessages = [{ role: "system", content: system }];
      for (const m of existingMsgs) aiMessages.push({ role: m.role, content: m.content });
      if (template_key && existingMsgs.length === 0) {
        const tmpl = getTemplate(template_key);
        if (tmpl) aiMessages.push({ role: "assistant", content: tmpl.prompt });
      }
      aiMessages.push({ role: "user", content: message });
      const response = await ai.chat(aiMessages);
      const ts = now();
      const newMsgs = [...existingMsgs];
      if (template_key && existingMsgs.length === 0) {
        const tmpl = getTemplate(template_key);
        if (tmpl) newMsgs.push({ role: "assistant", content: tmpl.prompt, timestamp: ts });
      }
      newMsgs.push({ role: "user", content: message, timestamp: ts });
      newMsgs.push({ role: "assistant", content: response, timestamp: ts });
      await run("UPDATE conversations SET messages = $1, updated_at = $2 WHERE id = $3",
        [JSON.stringify(newMsgs), ts, convo.id]);
      extractMemories(`User said: ${message}\nAI responded: ${response}`, user_id, "conversation", convo.id)
        .then(() => maybeAutoCompact(user_id))
        .catch((e) => console.error("[Memory] post-conversation error:", e.message));
      res.json({ conversation_id: convo.id, response, messages: newMsgs });
    } catch (e) {
      const s = ai.getSettings();
      console.error(`[conversations/send] AI error — provider: ${s.ai_provider}, model: ${s.ollama_model || s.openai_model}, base_url: ${s.ollama_base_url}, error:`, e.message);
      res.status(502).json({ detail: `AI provider error: ${e.message}` });
    }
  }));

  app.post("/api/conversations/send/stream", asyncHandler(async (req, res) => {
    const { user_id = "default", conversation_id, entry_id, message, template_key, current_step } = req.body;
    try {
      let convo = conversation_id ? await getOne("SELECT * FROM conversations WHERE id = $1", [conversation_id]) : null;
      if (!convo) {
        const newId = uuid();
        const createTs = now();
        await run("INSERT INTO conversations (id, user_id, entry_id, messages, created_at, updated_at) VALUES ($1, $2, $3, '[]', $4, $5)",
          [newId, user_id, entry_id || null, createTs, createTs]);
        convo = await getOne("SELECT * FROM conversations WHERE id = $1", [newId]);
      }
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Conversation-Id", convo.id);
      const memCtx = await getMemoryContext(user_id);
      const prefs = await getOne("SELECT * FROM user_preferences WHERE user_id = $1", [user_id]);
      const heroNames = (await getAll("SELECT name FROM user_heroes WHERE user_id = $1 AND is_active = TRUE", [user_id])).map(h => h.name);
      let system = getSystemPromptWithHeroes(heroNames, prefs?.faith_tradition || "", prefs?.faith_notes || "", memCtx.heroQuotes || {});
      if (memCtx.text) system += "\n\n" + memCtx.text;
      if (current_step) system += getStepContext(current_step);
      const eid = entry_id || convo.entry_id;
      if (eid) {
        const entry = await getOne("SELECT * FROM journal_entries WHERE id = $1", [eid]);
        if (entry?.content) system += `\n\nCURRENT JOURNAL ENTRY:\nTitle: ${entry.title}\n${entry.content}`;
      }
      const existingMsgs = JSON.parse(convo.messages || "[]");
      const aiMessages = [{ role: "system", content: system }];
      for (const m of existingMsgs) aiMessages.push({ role: m.role, content: m.content });
      if (template_key && existingMsgs.length === 0) {
        const tmpl = getTemplate(template_key);
        if (tmpl) aiMessages.push({ role: "assistant", content: tmpl.prompt });
      }
      aiMessages.push({ role: "user", content: message });
      let fullResponse = "";
      for await (const chunk of ai.stream(aiMessages)) {
        fullResponse += chunk;
        res.write(`data: ${chunk}\n\n`);
      }
      res.write("data: [DONE]\n\n");
      res.end();
      // Persist after stream
      const ts = now();
      const newMsgs = [...existingMsgs];
      if (template_key && existingMsgs.length === 0) {
        const tmpl = getTemplate(template_key);
        if (tmpl) newMsgs.push({ role: "assistant", content: tmpl.prompt, timestamp: ts });
      }
      newMsgs.push({ role: "user", content: message, timestamp: ts });
      newMsgs.push({ role: "assistant", content: fullResponse, timestamp: ts });
      await run("UPDATE conversations SET messages = $1, updated_at = $2 WHERE id = $3",
        [JSON.stringify(newMsgs), ts, convo.id]);
      extractMemories(`User said: ${message}\nAI responded: ${fullResponse}`, user_id, "conversation", convo.id)
        .then(() => maybeAutoCompact(user_id))
        .catch((e) => console.error("[Memory] post-stream error:", e.message));
    } catch (e) {
      if (!res.headersSent) {
        res.setHeader("Content-Type", "text/event-stream");
      }
      res.write(`data: [ERROR] ${e.message}\n\n`);
      res.end();
    }
  }));

  app.post("/api/conversations/:id/end", asyncHandler(async (req, res) => {
    const convo = await getOne("SELECT * FROM conversations WHERE id = $1", [req.params.id]);
    if (!convo) return res.status(404).json({ detail: "Conversation not found" });
    await run("UPDATE conversations SET is_active = FALSE, updated_at = $1 WHERE id = $2", [now(), req.params.id]);
    res.json({ id: convo.id, ended: true });
  }));

  // ══════════════════════════════════════
  // Uploads
  // ══════════════════════════════════════
  app.post("/api/uploads/", upload.single("file"), asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ detail: "No file or invalid type" });
    const { user_id = "default", entry_id, caption = "" } = req.body;
    const id = uuid();
    await run("INSERT INTO attachments (id, user_id, entry_id, filename, original_name, content_type, size_bytes, caption, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
      [id, user_id, entry_id || null, req.file.filename, req.file.originalname, req.file.mimetype, req.file.size, caption, now()]);
    const att = await getOne("SELECT * FROM attachments WHERE id = $1", [id]);
    res.json(formatAttachment(att));
  }));

  app.get("/api/uploads/file/:filename", (req, res) => {
    const safe = path.basename(req.params.filename);
    const filePath = path.join(uploadDir, safe);
    if (!fs.existsSync(filePath)) return res.status(404).json({ detail: "File not found" });
    res.sendFile(filePath);
  });

  app.get("/api/uploads/", asyncHandler(async (req, res) => {
    const { user_id = "default", entry_id, limit = "50" } = req.query;
    let sql = "SELECT * FROM attachments WHERE user_id = $1";
    const params = [user_id];
    let paramIdx = 2;
    if (entry_id) { sql += ` AND entry_id = $${paramIdx++}`; params.push(entry_id); }
    sql += ` ORDER BY created_at DESC LIMIT $${paramIdx}`;
    params.push(parseInt(limit));
    res.json((await getAll(sql, params)).map(formatAttachment));
  }));

  app.patch("/api/uploads/:id", asyncHandler(async (req, res) => {
    const att = await getOne("SELECT * FROM attachments WHERE id = $1", [req.params.id]);
    if (!att) return res.status(404).json({ detail: "Attachment not found" });
    const { entry_id, caption } = req.body;
    if (entry_id !== undefined) await run("UPDATE attachments SET entry_id = $1 WHERE id = $2", [entry_id, req.params.id]);
    if (caption !== undefined) await run("UPDATE attachments SET caption = $1 WHERE id = $2", [caption, req.params.id]);
    const updated = await getOne("SELECT * FROM attachments WHERE id = $1", [req.params.id]);
    res.json(formatAttachment(updated));
  }));

  app.delete("/api/uploads/:id", asyncHandler(async (req, res) => {
    const att = await getOne("SELECT * FROM attachments WHERE id = $1", [req.params.id]);
    if (!att) return res.status(404).json({ detail: "Attachment not found" });
    const filePath = path.join(uploadDir, att.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await run("DELETE FROM attachments WHERE id = $1", [req.params.id]);
    res.json({ deleted: true });
  }));

  // ══════════════════════════════════════
  // Voice Transcription
  // ══════════════════════════════════════
  const audioUpload = multer({
    storage: multer.diskStorage({
      destination: uploadDir,
      filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase() || ".webm";
        cb(null, `voice_${crypto.randomUUID().replace(/-/g, "")}${ext}`);
      },
    }),
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (req, file, cb) => {
      cb(null, AUDIO_TYPES.has(file.mimetype));
    },
  });

  app.post("/api/transcribe", audioUpload.single("audio"), asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ detail: "No audio file or unsupported type" });
    const audioPath = path.join(uploadDir, req.file.filename);
    try {
      const s = ai.getSettings();
      // Determine which OpenAI-compatible endpoint + key to use for Whisper
      let apiKey = "";
      let baseURL;
      if (s.openai_api_key) {
        apiKey = s.openai_api_key;
        // default OpenAI base URL
      } else if (s.ai_provider === "custom" && s.custom_ai_base_url && s.custom_ai_api_key) {
        apiKey = s.custom_ai_api_key;
        baseURL = s.custom_ai_base_url;
      } else if (s.grok_api_key) {
        apiKey = s.grok_api_key;
        baseURL = s.grok_base_url || "https://api.x.ai/v1";
      }

      if (!apiKey) {
        return res.status(400).json({ detail: "Voice transcription requires an OpenAI API key. Add one in Settings → AI Provider (you can still use any provider for chat)." });
      }

      const OpenAI = require("openai");
      const client = new OpenAI({ apiKey, baseURL });
      const transcription = await client.audio.transcriptions.create({
        file: fs.createReadStream(audioPath),
        model: "whisper-1",
      });
      res.json({ text: transcription.text || "" });
    } finally {
      // Clean up temp audio file
      try { fs.unlinkSync(audioPath); } catch {}
    }
  }));

  // ══════════════════════════════════════
  // Groups
  // ══════════════════════════════════════
  app.post("/api/groups/", asyncHandler(async (req, res) => {
    const { name, description = "", created_by = "default" } = req.body;
    const id = uuid();
    const inviteCode = crypto.randomBytes(9).toString("base64url");
    await run("INSERT INTO group_journals (id, name, description, created_by, invite_code, created_at) VALUES ($1, $2, $3, $4, $5, $6)",
      [id, name, description, created_by, inviteCode, now()]);
    await run("INSERT INTO group_members (id, group_id, user_id, role) VALUES ($1, $2, $3, 'sponsor')",
      [uuid(), id, created_by]);
    const group = await getOne("SELECT * FROM group_journals WHERE id = $1", [id]);
    // Sync to Supabase if configured
    await supabaseSync("groups", "POST", { id, name, description, created_by, invite_code: inviteCode, created_at: now() });
    await supabaseSync("group_members", "POST", { id: uuid(), group_id: id, user_id: created_by, display_name: await getSupabaseDisplayName(), role: "sponsor", joined_at: now() });
    group.share_code = await makeShareCode(inviteCode);
    res.json(group);
  }));

  app.post("/api/groups/join", asyncHandler(async (req, res) => {
    const { user_id, invite_code: rawCode, role = "member" } = req.body;

    // Try to decode as composite share code (contains Supabase URL + key + invite code)
    let actualCode = rawCode;
    const composite = parseShareCode(rawCode);
    if (composite) {
      actualCode = composite.c;
      // Auto-configure Supabase if not already set up
      const existingConfig = await getSupabaseConfig();
      if (!existingConfig) {
        await run(
          `UPDATE app_config SET supabase_url = $1, supabase_anon_key = $2 WHERE id = 'default'`,
          [composite.u, composite.k]);
      }
    }

    // Try local first
    let group = await getOne("SELECT * FROM group_journals WHERE invite_code = $1", [actualCode]);
    if (!group) {
      // Try pulling from Supabase
      const remoteGroup = await supabaseFetch("groups", `?invite_code=eq.${encodeURIComponent(actualCode)}&limit=1`);
      if (remoteGroup && remoteGroup.length > 0) {
        const rg = remoteGroup[0];
        await run("INSERT INTO group_journals (id, name, description, created_by, invite_code, created_at) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING",
          [rg.id, rg.name, rg.description || "", rg.created_by, rg.invite_code, rg.created_at || now()]);
        group = await getOne("SELECT * FROM group_journals WHERE id = $1", [rg.id]);
      }
    }
    if (!group) return res.status(404).json({ detail: "Invalid invite code" });
    const existing = await getOne("SELECT * FROM group_members WHERE group_id = $1 AND user_id = $2", [group.id, user_id]);
    if (existing) return res.status(400).json({ detail: "Already a member" });
    const memberId = uuid();
    await run("INSERT INTO group_members (id, group_id, user_id, role) VALUES ($1, $2, $3, $4)", [memberId, group.id, user_id, role]);
    await supabaseSync("group_members", "POST", { id: memberId, group_id: group.id, user_id, display_name: await getSupabaseDisplayName(), role, joined_at: now() });
    res.json({ joined: true, group_name: group.name });
  }));

  app.post("/api/groups/share", asyncHandler(async (req, res) => {
    const { entry_id, group_id, shared_by, title = "", content = "" } = req.body;
    const shareId = uuid();
    await run("INSERT INTO shared_entries (id, entry_id, group_id, shared_by, shared_at) VALUES ($1, $2, $3, $4, $5)",
      [shareId, entry_id, group_id, shared_by, now()]);
    // Sync shared entry content to Supabase (just title + content, not the full entry)
    const entry = await getOne("SELECT title, content FROM journal_entries WHERE id = $1", [entry_id]);
    await supabaseSync("shared_entries", "POST", {
      id: shareId, group_id, shared_by, display_name: await getSupabaseDisplayName(),
      title: title || entry?.title || "Untitled", content: content || entry?.content || "",
      shared_at: now(),
    });
    res.json({ shared: true });
  }));

  app.get("/api/groups/:userId", asyncHandler(async (req, res) => {
    const groups = await getAll("SELECT g.* FROM group_journals g JOIN group_members m ON m.group_id = g.id WHERE m.user_id = $1",
      [req.params.userId]);
    for (const g of groups) {
      g.share_code = await makeShareCode(g.invite_code);
    }
    res.json(groups);
  }));

  // Pull shared entries from Supabase for a group
  app.get("/api/groups/:groupId/shared", asyncHandler(async (req, res) => {
    const remote = await supabaseFetch("shared_entries", `?group_id=eq.${req.params.groupId}&order=shared_at.desc&limit=50`);
    if (remote && remote.length > 0) return res.json(remote);
    // Fallback to local
    const local = await getAll(
      `SELECT se.*, je.title, je.content FROM shared_entries se LEFT JOIN journal_entries je ON je.id = se.entry_id WHERE se.group_id = $1 ORDER BY se.shared_at DESC`,
      [req.params.groupId]
    );
    res.json(local);
  }));

  // Pull group members from Supabase
  app.get("/api/groups/:groupId/members", asyncHandler(async (req, res) => {
    const remote = await supabaseFetch("group_members", `?group_id=eq.${req.params.groupId}&order=joined_at`);
    if (remote && remote.length > 0) return res.json(remote);
    const local = await getAll("SELECT * FROM group_members WHERE group_id = $1 ORDER BY joined_at", [req.params.groupId]);
    res.json(local);
  }));

  // Sync all groups from Supabase (pull)
  app.post("/api/groups/sync/pull", asyncHandler(async (req, res) => {
    const { user_id = "default" } = req.body;
    const config = await getOne("SELECT supabase_url, supabase_anon_key FROM app_config WHERE id = 'default'", []);
    if (!config?.supabase_url || !config?.supabase_anon_key) return res.json({ synced: false, reason: "Supabase not configured" });

    // Pull groups where I'm a member
    const myMemberships = await supabaseFetch("group_members", `?user_id=eq.${encodeURIComponent(user_id)}`);
    if (!myMemberships || !myMemberships.length) return res.json({ synced: true, groups: 0 });

    let count = 0;
    for (const m of myMemberships) {
      const remoteGroups = await supabaseFetch("groups", `?id=eq.${m.group_id}`);
      if (remoteGroups && remoteGroups.length > 0) {
        const rg = remoteGroups[0];
        await run("INSERT INTO group_journals (id, name, description, created_by, invite_code, created_at) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO UPDATE SET name = $2, description = $3",
          [rg.id, rg.name, rg.description || "", rg.created_by, rg.invite_code, rg.created_at || now()]);
        const existingMember = await getOne("SELECT id FROM group_members WHERE group_id = $1 AND user_id = $2", [rg.id, user_id]);
        if (!existingMember) {
          await run("INSERT INTO group_members (id, group_id, user_id, role) VALUES ($1, $2, $3, $4)", [uuid(), rg.id, user_id, m.role || "member"]);
        }
        count++;
      }
    }
    res.json({ synced: true, groups: count });
  }));

  // ══════════════════════════════════════
  // Supabase Cloud Sync Helper
  // ══════════════════════════════════════

  // Composite share codes embed Supabase URL+key+invite_code so joining users auto-configure
  async function makeShareCode(inviteCode) {
    const config = await getSupabaseConfig();
    if (!config) return inviteCode; // No Supabase = plain code
    const payload = JSON.stringify({ u: config.url, k: config.key, c: inviteCode });
    return Buffer.from(payload).toString("base64url");
  }

  function parseShareCode(code) {
    try {
      const json = Buffer.from(code, "base64url").toString("utf8");
      const parsed = JSON.parse(json);
      if (parsed.u && parsed.k && parsed.c) return parsed;
    } catch {}
    return null; // Not a composite code
  }

  async function getSupabaseConfig() {
    const config = await getOne("SELECT supabase_url, supabase_anon_key, supabase_display_name FROM app_config WHERE id = 'default'", []);
    if (!config?.supabase_url || !config?.supabase_anon_key) return null;
    return { url: config.supabase_url.replace(/\/$/, ""), key: config.supabase_anon_key, displayName: config.supabase_display_name || "Anonymous" };
  }

  async function getSupabaseDisplayName() {
    const config = await getSupabaseConfig();
    return config?.displayName || "Anonymous";
  }

  async function supabaseSync(table, method, data) {
    try {
      const config = await getSupabaseConfig();
      if (!config) return null;
      const res = await fetch(`${config.url}/rest/v1/${table}`, {
        method,
        headers: {
          "apikey": config.key,
          "Authorization": `Bearer ${config.key}`,
          "Content-Type": "application/json",
          "Prefer": "return=minimal",
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const text = await res.text();
        console.log(`[Supabase] ${method} ${table} failed: ${res.status} ${text}`);
      }
      return res.ok;
    } catch (e) {
      console.log(`[Supabase] sync error: ${e.message}`);
      return null;
    }
  }

  async function supabaseFetch(table, query = "") {
    try {
      const config = await getSupabaseConfig();
      if (!config) return null;
      const res = await fetch(`${config.url}/rest/v1/${table}${query}`, {
        headers: {
          "apikey": config.key,
          "Authorization": `Bearer ${config.key}`,
        },
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  // Supabase settings endpoints
  app.get("/api/settings/supabase", asyncHandler(async (req, res) => {
    const config = await getOne("SELECT supabase_url, supabase_anon_key, supabase_display_name FROM app_config WHERE id = 'default'", []);
    res.json({
      supabase_url: config?.supabase_url || "",
      supabase_anon_key: config?.supabase_anon_key ? "••••••••" + (config.supabase_anon_key.slice(-8) || "") : "",
      supabase_display_name: config?.supabase_display_name || "",
      configured: !!(config?.supabase_url && config?.supabase_anon_key),
    });
  }));

  app.post("/api/settings/supabase", asyncHandler(async (req, res) => {
    const { supabase_url, supabase_anon_key, supabase_display_name } = req.body;
    const updates = [];
    const values = [];
    let idx = 1;
    if (supabase_url !== undefined) { updates.push(`supabase_url = $${idx++}`); values.push(supabase_url); }
    if (supabase_anon_key !== undefined && !supabase_anon_key.includes("••")) { updates.push(`supabase_anon_key = $${idx++}`); values.push(supabase_anon_key); }
    if (supabase_display_name !== undefined) { updates.push(`supabase_display_name = $${idx++}`); values.push(supabase_display_name); }
    if (updates.length) {
      await run(`UPDATE app_config SET ${updates.join(", ")} WHERE id = 'default'`, values);
    }
    res.json({ saved: true });
  }));

  app.post("/api/settings/supabase/test", asyncHandler(async (req, res) => {
    let { supabase_url, supabase_anon_key } = req.body;
    const url = (supabase_url || "").replace(/\/$/, "");

    // If key is masked (from the GET endpoint), use the stored key from DB
    if (supabase_anon_key && supabase_anon_key.includes("••")) {
      const saved = await getOne("SELECT supabase_anon_key FROM app_config WHERE id = 'default'", []);
      if (saved?.supabase_anon_key) {
        supabase_anon_key = saved.supabase_anon_key;
      } else {
        return res.json({ ok: false, error: "No saved API key found. Please re-enter your Supabase anon key." });
      }
    }

    if (!url || !supabase_anon_key) return res.json({ ok: false, error: "URL and key are required" });
    try {
      const r = await fetch(`${url}/rest/v1/groups?limit=1`, {
        headers: { "apikey": supabase_anon_key, "Authorization": `Bearer ${supabase_anon_key}` },
      });
      if (r.ok) return res.json({ ok: true });
      const text = await r.text();
      if (r.status === 404 || text.includes("does not exist")) {
        return res.json({ ok: false, error: "Connected, but tables not found. Run the SQL setup in Supabase first." });
      }
      return res.json({ ok: false, error: `HTTP ${r.status}: ${text.slice(0, 200)}` });
    } catch (e) {
      if (e.cause?.code === "ENOTFOUND" || e.message?.includes("ENOTFOUND")) {
        return res.json({ ok: false, error: "Could not reach Supabase. The project may be paused or the URL is incorrect." });
      }
      if (e.cause?.code === "ECONNREFUSED" || e.message?.includes("ECONNREFUSED")) {
        return res.json({ ok: false, error: "Connection refused. The Supabase project may be paused — check your Supabase dashboard." });
      }
      return res.json({ ok: false, error: e.message || "Unknown connection error" });
    }
  }));

  // ══════════════════════════════════════
  // Sync
  // ══════════════════════════════════════
  app.get("/api/sync/export", asyncHandler(async (req, res) => {
    const { user_id = "default" } = req.query;
    const entries = await getAll("SELECT * FROM journal_entries WHERE user_id = $1 ORDER BY created_at", [user_id]);
    const syncEntries = [];
    for (const e of entries) {
      const mood = await getOne("SELECT * FROM mood_entries WHERE entry_id = $1", [e.id]);
      syncEntries.push({
        id: e.id, title: e.title, content: e.content, content_html: e.content_html,
        prompt_used: e.prompt_used, is_draft: !!e.is_draft,
        sections_included: e.sections_included ? JSON.parse(e.sections_included) : null,
        entry_date: e.entry_date, created_at: e.created_at, updated_at: e.updated_at,
        mood_weather: mood?.weather || null, mood_note: mood?.note || "", mood_energy: mood?.energy_level || 5,
      });
    }
    const moods = await getAll("SELECT * FROM mood_entries WHERE user_id = $1 ORDER BY created_at", [user_id]);
    const convos = (await getAll("SELECT * FROM conversations WHERE user_id = $1 ORDER BY created_at", [user_id])).map(formatConversation);
    const memories = (await getAll("SELECT * FROM ai_memories WHERE user_id = $1 ORDER BY created_at", [user_id])).map(m => ({ ...m, is_active: !!m.is_active }));
    const heroes = (await getAll("SELECT * FROM user_heroes WHERE user_id = $1 ORDER BY sort_order", [user_id])).map(h => ({ ...h, is_active: !!h.is_active }));
    const atts = await getAll("SELECT * FROM attachments WHERE user_id = $1 ORDER BY created_at", [user_id]);
    const prefs = await getOne("SELECT * FROM user_preferences WHERE user_id = $1", [user_id]);
    res.json({
      entries: syncEntries, moods, conversations: convos, memories, heroes, attachments: atts,
      preferences: prefs ? { faith_tradition: prefs.faith_tradition, faith_notes: prefs.faith_notes, about_me: prefs.about_me, onboarding_complete: !!prefs.onboarding_complete } : null,
      exported_at: now(),
    });
  }));

  app.post("/api/sync/import", asyncHandler(async (req, res) => {
    const { user_id = "default", entries = [], moods = [], conversations = [], memories = [], heroes = [], attachments = [], preferences } = req.body;
    const counts = { entries_imported: 0, entries_updated: 0, moods: 0, conversations: 0, memories: 0, heroes: 0, attachments: 0 };
    const client = await getClient();
    try {
      await client.query("BEGIN");

      // --- Journal entries + inline mood data ---
      for (const se of entries) {
        if (se.id) {
          const { rows } = await client.query("SELECT * FROM journal_entries WHERE id = $1", [se.id]);
          if (rows[0]) {
            await client.query("UPDATE journal_entries SET title = $1, content = $2, content_html = $3, prompt_used = $4, is_draft = $5, updated_at = $6 WHERE id = $7",
              [se.title, se.content, se.content_html, se.prompt_used, !!se.is_draft, now(), se.id]);
            counts.entries_updated++;
            continue;
          }
        }
        const entryId = se.id || uuid();
        await client.query("INSERT INTO journal_entries (id, user_id, title, content, content_html, prompt_used, is_draft, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
          [entryId, user_id, se.title, se.content, se.content_html, se.prompt_used, !!se.is_draft, se.created_at || now(), now()]);
        if (se.mood_weather) {
          await client.query("INSERT INTO mood_entries (id, user_id, entry_id, weather, note, energy_level, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING",
            [uuid(), user_id, entryId, se.mood_weather, se.mood_note || "", se.mood_energy || 5, now()]);
        }
        counts.entries_imported++;
      }

      // --- Standalone mood entries ---
      for (const m of moods) {
        if (!m.id) continue;
        await client.query(
          "INSERT INTO mood_entries (id, user_id, entry_id, weather, note, energy_level, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO UPDATE SET weather = $4, note = $5, energy_level = $6",
          [m.id, user_id, m.entry_id || null, m.weather, m.note || "", m.energy_level ?? 5, m.created_at || now()]);
        counts.moods++;
      }

      // --- Conversations ---
      for (const c of conversations) {
        if (!c.id) continue;
        const msgs = typeof c.messages === "string" ? c.messages : JSON.stringify(c.messages || []);
        await client.query(
          "INSERT INTO conversations (id, user_id, entry_id, messages, is_active, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO UPDATE SET messages = $4, is_active = $5, updated_at = $7",
          [c.id, user_id, c.entry_id || null, msgs, c.is_active !== false, c.created_at || now(), now()]);
        counts.conversations++;
      }

      // --- AI memories ---
      for (const m of memories) {
        if (!m.id) continue;
        await client.query(
          "INSERT INTO ai_memories (id, user_id, category, content, source, source_id, is_active, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO UPDATE SET category = $3, content = $4, is_active = $7, updated_at = $9",
          [m.id, user_id, m.category, m.content, m.source || "conversation", m.source_id || null, m.is_active !== false, m.created_at || now(), now()]);
        counts.memories++;
      }

      // --- Heroes ---
      for (const h of heroes) {
        if (!h.id) continue;
        await client.query(
          "INSERT INTO user_heroes (id, user_id, name, description, is_active, sort_order) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO UPDATE SET name = $3, description = $4, is_active = $5, sort_order = $6",
          [h.id, user_id, h.name, h.description || "", h.is_active !== false, h.sort_order ?? 0]);
        counts.heroes++;
      }

      // --- Attachments (metadata only — files must exist) ---
      for (const a of attachments) {
        if (!a.id) continue;
        await client.query(
          "INSERT INTO attachments (id, user_id, entry_id, filename, original_name, content_type, size_bytes, caption, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO NOTHING",
          [a.id, user_id, a.entry_id || null, a.filename, a.original_name, a.content_type, a.size_bytes || 0, a.caption || "", a.created_at || now()]);
        counts.attachments++;
      }

      // --- User preferences ---
      if (preferences) {
        await client.query(
          `UPDATE user_preferences SET faith_tradition = COALESCE($1, faith_tradition), faith_notes = COALESCE($2, faith_notes), about_me = COALESCE($3, about_me), onboarding_complete = $4, updated_at = $5 WHERE user_id = $6`,
          [preferences.faith_tradition || "", preferences.faith_notes || "", preferences.about_me || "", !!preferences.onboarding_complete, now(), user_id]);
      }

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
    res.json({ imported: counts.entries_imported, updated: counts.entries_updated, ...counts });
  }));

  // ══════════════════════════════════════
  // Export (PDF via HTML — Electron uses printToPDF)
  // ══════════════════════════════════════
  app.post("/api/export/journal-book", asyncHandler(async (req, res) => {
    const { user_id = "default", title, author, year, dedication = "", start_date, end_date,
      include_conversations = true, include_heroes = true, include_memories = true,
      include_photos = true, include_statistics = true, format = "html" } = req.body;
    const entries = await getAll("SELECT * FROM journal_entries WHERE user_id = $1 AND is_draft = FALSE ORDER BY created_at", [user_id]);
    if (!entries.length) return res.status(404).json({ detail: "No published entries to export" });

    const opts = { user_id, title, author, year, dedication, start_date, end_date,
      include_conversations, include_heroes, include_memories, include_photos, include_statistics,
      uploadDir };

    if (format === "markdown" || format === "md") {
      const md = await buildBookMarkdown(entries, opts);
      res.setHeader("Content-Type", "text/markdown; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="recovery-journal-${year || new Date().getFullYear()}.md"`);
      res.send(md);
    } else {
      const html = await buildBookHtml(entries, opts);
      res.setHeader("Content-Type", "text/html");
      res.send(html);
    }
  }));

  app.get("/api/export/entries-json", asyncHandler(async (req, res) => {
    const { user_id = "default" } = req.query;
    const entries = await getAll("SELECT * FROM journal_entries WHERE user_id = $1 ORDER BY created_at", [user_id]);
    res.json(entries.map(e => ({
      id: e.id, title: e.title, content: e.content, content_html: e.content_html,
      prompt_used: e.prompt_used, is_draft: !!e.is_draft, created_at: e.created_at, updated_at: e.updated_at,
    })));
  }));

  // ══════════════════════════════════════
  // Settings
  // ══════════════════════════════════════
  const CONFIG_FIELDS = [
    "ai_provider", "openai_api_key", "openai_model",
    "anthropic_api_key", "anthropic_model",
    "grok_api_key", "grok_model", "grok_base_url",
    "ollama_base_url", "ollama_model",
    "custom_ai_base_url", "custom_ai_api_key", "custom_ai_model",
  ];
  const KEY_FIELDS = new Set(["openai_api_key", "anthropic_api_key", "grok_api_key", "custom_ai_api_key"]);

  function maskKey(key) {
    if (!key || key.length < 16) return key ? "••••••••" : "";
    return key.slice(0, 8) + "•".repeat(key.length - 12) + key.slice(-4);
  }

  function checkProviderReady(provider) {
    const s = ai.getSettings();
    if (provider === "openai") return !!s.openai_api_key;
    if (provider === "anthropic") return !!s.anthropic_api_key;
    if (provider === "grok") return !!s.grok_api_key;
    if (provider === "ollama") return !!s.ollama_base_url;
    if (provider === "custom") return !!s.custom_ai_base_url;
    return false;
  }

  app.get("/api/settings/ai", (req, res) => {
    const s = ai.getSettings();
    res.json({
      ai_provider: s.ai_provider,
      openai_api_key_set: !!s.openai_api_key,
      openai_api_key_masked: maskKey(s.openai_api_key),
      openai_model: s.openai_model || "gpt-4o",
      anthropic_api_key_set: !!s.anthropic_api_key,
      anthropic_api_key_masked: maskKey(s.anthropic_api_key),
      anthropic_model: s.anthropic_model || "claude-sonnet-4-20250514",
      grok_api_key_set: !!s.grok_api_key,
      grok_api_key_masked: maskKey(s.grok_api_key),
      grok_model: s.grok_model || "grok-3",
      grok_base_url: s.grok_base_url || "https://api.x.ai/v1",
      ollama_base_url: s.ollama_base_url || "http://localhost:11434",
      ollama_model: s.ollama_model || "llama3",
      custom_ai_base_url: s.custom_ai_base_url || "",
      custom_ai_api_key_set: !!s.custom_ai_api_key,
      custom_ai_api_key_masked: maskKey(s.custom_ai_api_key),
      custom_ai_model: s.custom_ai_model || "",
      active_provider: s.ai_provider,
      provider_ready: checkProviderReady(s.ai_provider),
    });
  });

  app.put("/api/settings/ai", asyncHandler(async (req, res) => {
    let config = await getOne("SELECT * FROM app_config WHERE id = 'default'");
    if (!config) {
      await run("INSERT INTO app_config (id) VALUES ('default')");
      config = await getOne("SELECT * FROM app_config WHERE id = 'default'");
    }
    const updates = [];
    const values = [];
    let paramIdx = 1;
    for (const field of CONFIG_FIELDS) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${paramIdx++}`);
        values.push(req.body[field]);
      }
    }
    if (updates.length) {
      updates.push(`updated_at = $${paramIdx++}`);
      values.push(now());
      await run(`UPDATE app_config SET ${updates.join(", ")} WHERE id = 'default'`, values);
    }
    // Apply to runtime
    const newConfig = await getOne("SELECT * FROM app_config WHERE id = 'default'");
    const settingsUpdate = {};
    for (const f of CONFIG_FIELDS) { if (newConfig[f]) settingsUpdate[f] = newConfig[f]; }
    ai.updateSettings(settingsUpdate);
    res.json({ status: "ok", active_provider: ai.getSettings().ai_provider, provider_ready: checkProviderReady(ai.getSettings().ai_provider) });
  }));

  app.post("/api/settings/ai/test", async (req, res) => {
    const s = ai.getSettings();
    if (!checkProviderReady(s.ai_provider)) {
      return res.json({ status: "error", provider: s.ai_provider, message: `Provider '${s.ai_provider}' is not configured.` });
    }
    try {
      const response = await ai.chat([{ role: "user", content: "Say 'Connection successful' in exactly two words." }], 0.1);
      res.json({ status: "ok", provider: s.ai_provider, message: response.trim().slice(0, 200) });
    } catch (e) {
      res.json({ status: "error", provider: s.ai_provider, message: e.message.slice(0, 300) });
    }
  });

  // ══════════════════════════════════════
  // Factory Reset — clears all user data, preserves AI config
  // ══════════════════════════════════════
  app.post("/api/settings/reset-all", asyncHandler(async (req, res) => {
    const { confirmation } = req.body;
    if (confirmation !== "RESET") {
      return res.status(400).json({ detail: "Type RESET to confirm factory reset." });
    }
    const tables = [
      "conversations", "ai_memories", "mood_entries", "shared_entries",
      "attachments", "group_members", "group_journals", "user_heroes",
    ];
    for (const table of tables) {
      await run(`DELETE FROM ${table}`);
    }
    // Delete journal entries (conversations reference them via entry_id already deleted)
    await run("DELETE FROM journal_entries");
    // Reset preferences but keep the row
    await run("UPDATE user_preferences SET faith_tradition = '', faith_notes = '', about_me = '', onboarding_complete = FALSE");
    // Clear password but keep AI config
    await run("UPDATE app_config SET app_password_hash = '' WHERE id = 'default'");
    // Clean up upload files
    try {
      const files = fs.readdirSync(uploadDir);
      for (const file of files) {
        fs.unlinkSync(path.join(uploadDir, file));
      }
    } catch {}
    res.json({ status: "ok", message: "All data has been reset." });
  }));

  // ══════════════════════════════════════
  // Password Protection
  // ══════════════════════════════════════
  app.get("/api/settings/password", asyncHandler(async (req, res) => {
    const config = await getOne("SELECT app_password_hash FROM app_config WHERE id = 'default'");
    res.json({ has_password: !!(config && config.app_password_hash) });
  }));

  app.post("/api/settings/password", asyncHandler(async (req, res) => {
    const { password, current_password } = req.body;
    if (!password || password.length < 4) {
      return res.status(400).json({ detail: "Password must be at least 4 characters." });
    }
    // If there's an existing password, verify it first
    const config = await getOne("SELECT app_password_hash FROM app_config WHERE id = 'default'");
    if (config && config.app_password_hash) {
      if (!current_password) return res.status(400).json({ detail: "Current password required." });
      const [salt, hash] = config.app_password_hash.split(":");
      const check = crypto.pbkdf2Sync(current_password, salt, 100000, 64, "sha512").toString("hex");
      if (check !== hash) return res.status(403).json({ detail: "Current password is incorrect." });
    }
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
    let existing = await getOne("SELECT * FROM app_config WHERE id = 'default'");
    if (!existing) {
      await run("INSERT INTO app_config (id, app_password_hash) VALUES ('default', $1)", [`${salt}:${hash}`]);
    } else {
      await run("UPDATE app_config SET app_password_hash = $1 WHERE id = 'default'", [`${salt}:${hash}`]);
    }
    res.json({ status: "ok", has_password: true });
  }));

  app.post("/api/settings/verify-password", asyncHandler(async (req, res) => {
    const { password } = req.body;
    const config = await getOne("SELECT app_password_hash FROM app_config WHERE id = 'default'");
    if (!config || !config.app_password_hash) {
      return res.json({ verified: true }); // No password set
    }
    if (!password) return res.json({ verified: false });
    const [salt, hash] = config.app_password_hash.split(":");
    const check = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
    res.json({ verified: check === hash });
  }));

  app.delete("/api/settings/password", asyncHandler(async (req, res) => {
    const { password } = req.body;
    const config = await getOne("SELECT app_password_hash FROM app_config WHERE id = 'default'");
    if (!config || !config.app_password_hash) {
      return res.json({ status: "ok", has_password: false });
    }
    if (!password) return res.status(400).json({ detail: "Password required to remove protection." });
    const [salt, hash] = config.app_password_hash.split(":");
    const check = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
    if (check !== hash) return res.status(403).json({ detail: "Incorrect password." });
    await run("UPDATE app_config SET app_password_hash = '' WHERE id = 'default'");
    res.json({ status: "ok", has_password: false });
  }));

  // ── Step tracking ──
  app.get("/api/settings/current-step", asyncHandler(async (req, res) => {
    const userId = req.query.user_id || "default";
    const prefs = await getOne("SELECT current_step FROM user_preferences WHERE user_id = $1", [userId]);
    res.json({ current_step: prefs?.current_step || 0 });
  }));

  app.put("/api/settings/current-step", asyncHandler(async (req, res) => {
    const userId = req.body.user_id || "default";
    const step = req.body.step;
    if (typeof step !== "number" || step < 0 || step > 12) {
      return res.status(400).json({ detail: "Step must be 0-12." });
    }
    const existing = await getOne("SELECT * FROM user_preferences WHERE user_id = $1", [userId]);
    if (existing) {
      await run("UPDATE user_preferences SET current_step = $1, updated_at = $2 WHERE user_id = $3", [step, now(), userId]);
    } else {
      await run("INSERT INTO user_preferences (id, user_id, current_step) VALUES ($1, $2, $3)", [uuid(), userId, step]);
    }
    res.json({ current_step: step });
  }));

  // ══════════════════════════════════════
  // Ollama Management
  // ══════════════════════════════════════
  app.get("/api/ollama/status", async (req, res) => {
    const url = ai.getSettings().ollama_base_url || "http://localhost:11434";
    // Check if Ollama binary is installed on the system
    let binaryInstalled = false;
    try {
      const { execSync } = require("child_process");
      if (process.platform === "win32") {
        execSync("where ollama", { stdio: "ignore" });
        binaryInstalled = true;
      } else {
        // Check common locations
        binaryInstalled = fs.existsSync("/usr/local/bin/ollama") || fs.existsSync("/usr/bin/ollama");
        if (!binaryInstalled) {
          try { execSync("which ollama", { stdio: "ignore" }); binaryInstalled = true; } catch {}
        }
      }
    } catch {}
    try {
      const resp = await fetch(`${url}/api/version`, { signal: AbortSignal.timeout(5000) });
      if (resp.ok) {
        const data = await resp.json();
        return res.json({ reachable: true, installed: true, url, version: data.version || "unknown", error: "" });
      }
      const resp2 = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (resp2.ok) return res.json({ reachable: true, installed: true, url, version: "detected", error: "" });
    } catch (e) {
      return res.json({ reachable: false, installed: binaryInstalled, url, version: "", error: binaryInstalled ? "Ollama is installed but not running. Please start Ollama." : e.message.slice(0, 200) });
    }
    res.json({ reachable: false, installed: binaryInstalled, url, version: "", error: binaryInstalled ? "Ollama is installed but not running. Please start Ollama." : "Ollama not responding" });
  });

  app.get("/api/ollama/models", async (req, res) => {
    const url = ai.getSettings().ollama_base_url || "http://localhost:11434";
    try {
      const resp = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(10000) });
      const data = await resp.json();
      const models = (data.models || []).map(m => ({
        name: m.name || "", size: m.size > 0 ? `${(m.size / 1073741824).toFixed(1)} GB` : "",
        modified_at: m.modified_at || "", digest: (m.digest || "").slice(0, 12),
      }));
      res.json({ models });
    } catch (e) {
      res.json({ models: [], error: e.message.slice(0, 200) });
    }
  });

  app.get("/api/ollama/recommended", (req, res) => {
    res.json({ models: Object.values(RECOMMENDED_MODELS) });
  });

  app.post("/api/ollama/pull", async (req, res) => {
    const url = ai.getSettings().ollama_base_url || "http://localhost:11434";
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    try {
      const resp = await fetch(`${url}/api/pull`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: req.body.model, stream: true }),
        signal: AbortSignal.timeout(600000),
      });
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            res.write(JSON.stringify({ status: data.status || "", total: data.total || 0, completed: data.completed || 0, digest: data.digest || "" }) + "\n");
          } catch { /* skip */ }
        }
      }
    } catch (e) {
      res.write(JSON.stringify({ status: `error: ${e.message}`, total: 0, completed: 0 }) + "\n");
    }
    res.end();
  });

  app.post("/api/ollama/create-stepcompanion", async (req, res) => {
    const { name = "stepcompanion", base_model = "llama3.3:8b" } = req.body;
    const url = ai.getSettings().ollama_base_url || "http://localhost:11434";
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    try {
      const modelfile = STEP_COMPANION_MODELFILE(base_model);
      const resp = await fetch(`${url}/api/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, modelfile, stream: true }),
        signal: AbortSignal.timeout(300000),
      });
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try { res.write(JSON.parse(line).status ? line + "\n" : ""); } catch { /* skip */ }
        }
      }
    } catch (e) {
      res.write(JSON.stringify({ status: `error: ${e.message}` }) + "\n");
    }
    res.end();
  });

  // Validate and auto-fix Ollama model — called at startup and when settings change
  app.post("/api/ollama/validate-model", asyncHandler(async (req, res) => {
    const s = ai.getSettings();
    if (s.ai_provider !== "ollama") return res.json({ status: "not-ollama" });
    const url = s.ollama_base_url || "http://localhost:11434";
    try {
      const resp = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(5000) });
      const data = await resp.json();
      const installed = (data.models || []).map(m => m.name);
      if (!installed.length) return res.json({ status: "no-models", model: s.ollama_model });
      // Check if current model exists (case-insensitive, with or without :latest)
      const currentModel = s.ollama_model || "";
      const match = installed.find(m =>
        m.toLowerCase() === currentModel.toLowerCase() ||
        m.toLowerCase() === `${currentModel.toLowerCase()}:latest` ||
        m.toLowerCase().replace(/:latest$/, "") === currentModel.toLowerCase().replace(/:latest$/, "")
      );
      if (match) return res.json({ status: "ok", model: match });
      // Model doesn't exist — pick first non-embed model, or first model
      const chatModel = installed.find(m => !m.includes("embed") && !m.includes("nomic")) || installed[0];
      console.log(`[StepScribe] Ollama model "${currentModel}" not found. Auto-switching to "${chatModel}". Available: ${installed.join(", ")}`);
      // Update DB and runtime
      ai.updateSettings({ ollama_model: chatModel });
      let config = await getOne("SELECT * FROM app_config WHERE id = 'default'");
      if (!config) { await run("INSERT INTO app_config (id) VALUES ('default')"); }
      await run("UPDATE app_config SET ollama_model = $1, updated_at = $2 WHERE id = 'default'", [chatModel, now()]);
      res.json({ status: "auto-fixed", model: chatModel, was: currentModel, available: installed });
    } catch (e) {
      res.json({ status: "error", error: e.message });
    }
  }));

  app.get("/api/ollama/install-instructions", (req, res) => {
    const plat = process.platform;
    if (plat === "darwin") {
      res.json({ platform: "macOS", method: "script", command: "curl -fsSL https://ollama.com/install.sh | sh", download_url: "https://ollama.com/download/mac", notes: "After install, Ollama runs automatically in the background." });
    } else if (plat === "win32") {
      res.json({ platform: "Windows", method: "installer", command: "", download_url: "https://ollama.com/download/windows", notes: "Download and run the installer." });
    } else {
      res.json({ platform: "Linux", method: "script", command: "curl -fsSL https://ollama.com/install.sh | sh", download_url: "https://ollama.com/download/linux", notes: "After install, run: ollama serve" });
    }
  });

  // ══════════════════════════════════════
  // Serve static frontend (production)
  // ══════════════════════════════════════
  if (frontendDir && fs.existsSync(frontendDir)) {
    app.use(express.static(frontendDir));
    // SPA fallback — serve index.html for all non-API routes
    app.get("*", (req, res) => {
      if (req.path.startsWith("/api/")) return res.status(404).json({ detail: "Not found" });
      // Try the exact path first (for /mood, /settings, etc.)
      const htmlPath = path.join(frontendDir, req.path, "index.html");
      if (fs.existsSync(htmlPath)) return res.sendFile(htmlPath);
      // Fallback to root index
      const rootIndex = path.join(frontendDir, "index.html");
      if (fs.existsSync(rootIndex)) return res.sendFile(rootIndex);
      res.status(404).send("Not found");
    });
  }

  // ══════════════════════════════════════
  // Helper functions
  // ══════════════════════════════════════

  function formatEntry(e) {
    return {
      id: e.id, user_id: e.user_id, title: e.title, content: e.content,
      content_html: e.content_html, prompt_used: e.prompt_used,
      is_draft: !!e.is_draft,
      sections_included: e.sections_included ? JSON.parse(e.sections_included) : null,
      entry_date: e.entry_date || null,
      created_at: e.created_at, updated_at: e.updated_at,
    };
  }

  function formatMood(m) {
    const info = MOOD_WEATHER[m.weather] || {};
    return {
      id: m.id, user_id: m.user_id, entry_id: m.entry_id,
      weather: m.weather, note: m.note, energy_level: m.energy_level,
      created_at: m.created_at,
      weather_label: info.label || "", weather_description: info.description || "",
    };
  }

  function formatConversation(c) {
    return {
      id: c.id, user_id: c.user_id, entry_id: c.entry_id,
      messages: typeof c.messages === "string" ? JSON.parse(c.messages) : c.messages,
      is_active: !!c.is_active,
      created_at: c.created_at, updated_at: c.updated_at,
    };
  }

  function formatAttachment(a) {
    return {
      id: a.id, user_id: a.user_id, entry_id: a.entry_id,
      filename: a.filename, original_name: a.original_name,
      content_type: a.content_type, size_bytes: a.size_bytes,
      caption: a.caption, url: `/api/uploads/file/${a.filename}`,
      created_at: a.created_at,
    };
  }

  // ── Memory extraction (async, best-effort) ──
  const EXTRACT_PROMPT = `Analyze this recovery journal text. Extract key insights as JSON.
Return ONLY a JSON object with an "insights" array. Each item has:
- "category": one of: struggle, strength, pattern, relationship, trigger, insight, preference, milestone, background
- "content": a concise 1-2 sentence summary in third person ("He/They...")
Rules: Only extract what's actually stated. Maximum 5 insights. If nothing meaningful, return {"insights": []}.
Example: {"insights": [{"category": "struggle", "content": "He struggles with alcohol and has relapsed multiple times."}]}`;

  function parseInsightsFromResponse(response) {
    let cleaned = response.trim();
    // Strip markdown code fences
    if (cleaned.startsWith("```")) cleaned = cleaned.split("\n").slice(1).join("\n").replace(/```\s*$/, "").trim();
    // Try parsing the whole response as JSON
    try {
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) return parsed;
      // Handle {insights: [...]} wrapper
      if (parsed.insights && Array.isArray(parsed.insights)) return parsed.insights;
      // Handle any key that contains an array
      for (const val of Object.values(parsed)) {
        if (Array.isArray(val) && val.length > 0 && val[0].category) return val;
      }
      return [];
    } catch {}
    // Try to find a JSON array in the text
    const arrayMatch = cleaned.match(/\[\s*\{[\s\S]*?\}\s*\]/);
    if (arrayMatch) {
      try { return JSON.parse(arrayMatch[0]); } catch {}
    }
    return null;
  }

  async function extractMemories(text, userId, source, sourceId) {
    try {
      // Use format:"json" for Ollama to force structured output
      const options = ai.getSettings().ai_provider === "ollama" ? { format: "json" } : {};
      const response = await ai.chat([{ role: "system", content: EXTRACT_PROMPT }, { role: "user", content: text }], 0.3, options);
      const insights = parseInsightsFromResponse(response);
      if (!insights || insights.length === 0) {
        console.log("[Memory] No insights extracted from text");
        return 0;
      }
      const ts = now();
      let count = 0;
      for (const item of insights.slice(0, 5)) {
        if (!item.category || !item.content || !MEMORY_CATEGORIES.includes(item.category)) continue;
        await run("INSERT INTO ai_memories (id, user_id, category, content, source, source_id, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
          [uuid(), userId, item.category, item.content, source, sourceId || null, ts, ts]);
        count++;
      }
      console.log(`[Memory] Extracted ${count} memories from ${source}`);
      return count;
    } catch (e) {
      console.error("[Memory] Extraction failed:", e.message);
      return 0;
    }
  }

  // ── Auto-compaction: runs after memory extraction if count is high ──
  async function maybeAutoCompact(userId) {
    try {
      const countRow = await getOne("SELECT COUNT(*) as cnt FROM ai_memories WHERE user_id = $1 AND is_active = TRUE", [userId]);
      const count = parseInt(countRow?.cnt) || 0;
      if (count < 30) return; // Only compact when there are enough memories
      console.log(`[Memory] Auto-compacting ${count} memories for user ${userId}`);
      // Group by category and compact categories with > 8 entries
      for (const cat of MEMORY_CATEGORIES) {
        const catMemories = await getAll("SELECT * FROM ai_memories WHERE user_id = $1 AND category = $2 AND is_active = TRUE ORDER BY updated_at DESC", [userId, cat]);
        if (catMemories.length <= 8) continue;
        const contents = catMemories.map(m => m.content).join("\n- ");
        const compactPrompt = `Merge these related memories about a person into 3-5 concise, non-redundant summaries. Return a JSON object: {"merged": ["summary1", "summary2", ...]}\n\nMemories:\n- ${contents}`;
        const options = ai.getSettings().ai_provider === "ollama" ? { format: "json" } : {};
        const resp = await ai.chat([{ role: "system", content: compactPrompt }], 0.3, options);
        let merged;
        try {
          const parsed = JSON.parse(resp.trim());
          merged = parsed.merged || parsed.summaries || (Array.isArray(parsed) ? parsed : null);
        } catch { continue; }
        if (!merged || !Array.isArray(merged) || merged.length === 0) continue;
        // Deactivate old, insert merged
        const ids = catMemories.map(m => m.id);
        await run("UPDATE ai_memories SET is_active = FALSE WHERE id = ANY($1)", [ids]);
        const ts = now();
        for (const summary of merged.slice(0, 5)) {
          if (typeof summary === "string" && summary.trim()) {
            await run("INSERT INTO ai_memories (id, user_id, category, content, source, source_id, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
              [uuid(), userId, cat, summary.trim(), "compaction", null, ts, ts]);
          }
        }
        console.log(`[Memory] Compacted ${cat}: ${catMemories.length} → ${merged.length}`);
      }
    } catch (e) {
      console.error("[Memory] Auto-compaction error:", e.message);
    }
  }

  // ── Memory context builder ──
  async function getMemoryContext(userId) {
    const parts = [];
    const prefs = await getOne("SELECT * FROM user_preferences WHERE user_id = $1", [userId]);
    if (prefs?.about_me) parts.push(`ABOUT THIS PERSON (their own words): "${prefs.about_me}"`);
    if (prefs?.faith_tradition) {
      let s = `FAITH: ${prefs.faith_tradition}.`;
      if (prefs.faith_notes) s += ` They shared: "${prefs.faith_notes}"`;
      parts.push(s);
    }
    const heroes = await getAll("SELECT name, quotes FROM user_heroes WHERE user_id = $1 AND is_active = TRUE ORDER BY sort_order", [userId]);
    if (heroes.length) {
      parts.push(`HEROES THEY DRAW INSPIRATION FROM: ${heroes.map(h => h.name).join(", ")}. Reference their wisdom when it fits naturally.`);
    }
    // Build hero quotes map for system prompt
    const heroQuotesMap = {};
    for (const h of heroes) {
      let parsed = [];
      try { parsed = typeof h.quotes === "string" ? JSON.parse(h.quotes) : (h.quotes || []); } catch {}
      if (Array.isArray(parsed) && parsed.length > 0) heroQuotesMap[h.name] = parsed;
    }
    // Include standalone user quotes/passages
    const userQuotes = await getAll("SELECT * FROM user_quotes WHERE user_id = $1 AND is_active = TRUE ORDER BY created_at DESC LIMIT 20", [userId]);
    if (userQuotes.length) {
      const qList = userQuotes.map(q => {
        let s = `"${q.text}"`;
        if (q.author) s += ` — ${q.author}`;
        if (q.source) s += ` (${q.source})`;
        return s;
      });
      parts.push(`QUOTES & PASSAGES THEY'VE SAVED (these resonate with them — reference naturally when relevant):\n${qList.join("\n")}`);
    }
    const memories = await getAll("SELECT * FROM ai_memories WHERE user_id = $1 AND is_active = TRUE ORDER BY updated_at DESC LIMIT 50", [userId]);
    if (memories.length) {
      const byCat = {};
      for (const m of memories) { (byCat[m.category] = byCat[m.category] || []).push(m.content); }
      const labels = { struggle: "Struggles", strength: "Strengths", pattern: "Patterns", relationship: "Relationships", trigger: "Triggers", insight: "Insights they've had", preference: "Preferences", milestone: "Milestones", background: "Background" };
      const lines = ["WHAT YOU KNOW ABOUT THIS PERSON (learned over time):"];
      for (const cat of MEMORY_CATEGORIES) {
        const items = byCat[cat];
        if (items?.length) lines.push(`  ${labels[cat] || cat}: ${items.slice(0, 5).join(" | ")}`);
      }
      parts.push(lines.join("\n"));
    }
    const moods = await getAll("SELECT * FROM mood_entries WHERE user_id = $1 ORDER BY created_at DESC LIMIT 7", [userId]);
    if (moods.length) {
      const trend = moods.reverse().map(m => {
        const info = MOOD_WEATHER[m.weather] || {};
        return `${info.label || m.weather} (energy ${m.energy_level}/10)`;
      });
      parts.push(`RECENT MOOD TREND (last ${moods.length} entries): ${trend.join(" → ")}`);
    }
    return { text: parts.join("\n\n"), heroQuotes: heroQuotesMap };
  }

  // ── Simple book HTML builder ──
  async function buildBookHtml(entries, opts) {
    const escHtml = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const bookTitle = escHtml(opts.title || "My Recovery Journal");
    const bookAuthor = escHtml(opts.author || "");
    const bookYear = escHtml(opts.year || new Date().getFullYear().toString());

    // Filter by date range if provided
    let filtered = entries;
    if (opts.start_date) filtered = filtered.filter(e => e.created_at >= opts.start_date);
    if (opts.end_date) filtered = filtered.filter(e => e.created_at <= opts.end_date + "T23:59:59");

    let dedicationHtml = "";
    if (opts.dedication) {
      dedicationHtml = `<div style="text-align:center;padding:80px 40px;font-style:italic;"><p>${escHtml(opts.dedication)}</p></div><div style="page-break-after:always;"></div>`;
    }

    // Heroes section
    let heroesHtml = "";
    if (opts.include_heroes) {
      const heroes = await getAll("SELECT * FROM user_heroes WHERE user_id = $1 AND is_active = TRUE ORDER BY sort_order", [opts.user_id || "default"]);
      if (heroes.length) {
        const heroCards = heroes.map(h => `<div style="margin-bottom:12px;"><strong>${escHtml(h.name)}</strong>${h.description ? ` — ${escHtml(h.description)}` : ""}</div>`).join("");
        heroesHtml = `<div style="page-break-before:always;padding-top:40px;"><h2>My Recovery Heroes</h2>${heroCards}</div>`;
      }
    }

    let chaptersHtml = "";
    for (let i = 0; i < filtered.length; i++) {
      const e = filtered[i];
      const mood = await getOne("SELECT * FROM mood_entries WHERE entry_id = $1", [e.id]);
      const moodInfo = mood ? (MOOD_WEATHER[mood.weather] || {}) : null;
      let moodBlock = "";
      if (moodInfo) {
        const el = Math.max(0, Math.min(10, parseInt(mood.energy_level) || 5));
        moodBlock = `<div style="background:#f8f8f8;padding:12px;border-radius:8px;margin-bottom:16px;font-style:italic;">
          <strong>${escHtml(moodInfo.label)}</strong> — ${escHtml(moodInfo.description)}
          ${mood.note ? `<br/>"${escHtml(mood.note)}"` : ""}
          <br/>Energy: ${"●".repeat(el)}${"○".repeat(10 - el)}
        </div>`;
      }

      // Conversations for this entry
      let convoBlock = "";
      if (opts.include_conversations) {
        const convos = await getAll("SELECT * FROM conversations WHERE entry_id = $1 ORDER BY created_at", [e.id]);
        for (const c of convos) {
          let msgs = [];
          try { msgs = typeof c.messages === "string" ? JSON.parse(c.messages) : (c.messages || []); } catch {}
          if (msgs.length) {
            const msgHtml = msgs.map(m => `<div style="margin-bottom:8px;"><strong style="color:${m.role === "user" ? "#333" : "#666"};">${m.role === "user" ? "You" : "AI Companion"}:</strong> ${escHtml(m.content)}</div>`).join("");
            convoBlock += `<div style="background:#fafafa;padding:16px;border-radius:8px;margin-top:16px;border:1px solid #eee;"><h4 style="margin:0 0 8px;">Conversation</h4>${msgHtml}</div>`;
          }
        }
      }

      chaptersHtml += `
        <div style="page-break-before:always;padding-top:40px;">
          <h2 style="margin-bottom:4px;">${escHtml(e.title || "Untitled")}</h2>
          <div style="color:#888;margin-bottom:16px;font-size:0.9em;">${escHtml(e.created_at)}</div>
          ${moodBlock}
          <div>${e.content_html || `<p>${escHtml(e.content)}</p>`}</div>
          ${convoBlock}
        </div>`;
    }

    // Memories / insights section
    let memoriesHtml = "";
    if (opts.include_memories) {
      const memories = await getAll("SELECT * FROM ai_memories WHERE user_id = $1 AND is_active = TRUE ORDER BY category, updated_at DESC LIMIT 30", [opts.user_id || "default"]);
      if (memories.length) {
        const byCat = {};
        for (const m of memories) { (byCat[m.category] = byCat[m.category] || []).push(m.content); }
        const labels = { struggle: "Struggles", strength: "Strengths", pattern: "Patterns", relationship: "Relationships", trigger: "Triggers", insight: "Insights", milestone: "Milestones" };
        let memItems = "";
        for (const [cat, items] of Object.entries(byCat)) {
          memItems += `<h4>${escHtml(labels[cat] || cat)}</h4><ul>`;
          for (const item of items.slice(0, 5)) memItems += `<li>${escHtml(item)}</li>`;
          memItems += `</ul>`;
        }
        memoriesHtml = `<div style="page-break-before:always;padding-top:40px;"><h2>AI Insights &amp; Reflections</h2><p style="font-style:italic;color:#666;">What your AI companion learned about your journey.</p>${memItems}</div>`;
      }
    }

    // Statistics
    let statsHtml = "";
    if (opts.include_statistics) {
      const totalEntries = filtered.length;
      const moods = await getAll("SELECT weather FROM mood_entries WHERE user_id = $1", [opts.user_id || "default"]);
      const moodCounts = {};
      for (const m of moods) { moodCounts[m.weather] = (moodCounts[m.weather] || 0) + 1; }
      const topMood = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0];
      statsHtml = `<div style="page-break-before:always;padding-top:40px;"><h2>Journey at a Glance</h2>
        <p><strong>Total Entries:</strong> ${totalEntries}</p>
        <p><strong>Total Mood Records:</strong> ${moods.length}</p>
        ${topMood ? `<p><strong>Most Common Weather:</strong> ${escHtml((MOOD_WEATHER[topMood[0]] || {}).label || topMood[0])} (${topMood[1]} times)</p>` : ""}
      </div>`;
    }

    return `<!DOCTYPE html><html><head><meta charset="utf-8">
      <style>body{font-family:Georgia,serif;max-width:700px;margin:0 auto;padding:40px 20px;color:#222;line-height:1.7;}
      h1{text-align:center;} h2{color:#333;} .cover{text-align:center;padding:100px 0;}</style>
      </head><body>
      <div class="cover"><h1>${bookTitle}</h1><p>A Recovery Journal</p><p>${bookAuthor}</p><p>${bookYear}</p></div>
      ${dedicationHtml}
      ${heroesHtml}
      ${chaptersHtml}
      ${memoriesHtml}
      ${statsHtml}
      </body></html>`;
  }

  // ── Simple book Markdown builder ──
  async function buildBookMarkdown(entries, opts) {
    const bookTitle = opts.title || "My Recovery Journal";
    const bookAuthor = opts.author || "";
    const bookYear = opts.year || new Date().getFullYear().toString();

    // Filter by date range if provided
    let filtered = entries;
    if (opts.start_date) filtered = filtered.filter(e => e.created_at >= opts.start_date);
    if (opts.end_date) filtered = filtered.filter(e => e.created_at <= opts.end_date + "T23:59:59");

    let md = `# ${bookTitle}\n\n*A Recovery Journal*\n\n`;
    if (bookAuthor) md += `**${bookAuthor}**\n\n`;
    md += `${bookYear}\n\n`;
    if (opts.dedication) md += `> ${opts.dedication}\n\n`;
    md += `---\n\n`;

    // Heroes section
    if (opts.include_heroes) {
      const heroes = await getAll("SELECT * FROM user_heroes WHERE user_id = $1 AND is_active = TRUE ORDER BY sort_order", [opts.user_id || "default"]);
      if (heroes.length) {
        md += `## My Recovery Heroes\n\n`;
        for (const h of heroes) {
          md += `**${h.name}**`;
          if (h.description) md += ` — ${h.description}`;
          md += `\n\n`;
        }
        md += `---\n\n`;
      }
    }

    for (let i = 0; i < filtered.length; i++) {
      const e = filtered[i];
      md += `## ${e.title || "Untitled"}\n\n`;
      md += `*${e.created_at}*\n\n`;

      const mood = await getOne("SELECT * FROM mood_entries WHERE entry_id = $1", [e.id]);
      const moodInfo = mood ? (MOOD_WEATHER[mood.weather] || {}) : null;
      if (moodInfo) {
        const el = Math.max(0, Math.min(10, parseInt(mood.energy_level) || 5));
        md += `> **${moodInfo.label}** — ${moodInfo.description}`;
        if (mood.note) md += `\n> "${mood.note}"`;
        md += `\n> Energy: ${"●".repeat(el)}${"○".repeat(10 - el)}\n\n`;
      }

      // Use plain text content; strip basic HTML tags if only HTML is available
      if (e.content) {
        md += `${e.content}\n\n`;
      } else if (e.content_html) {
        const text = e.content_html
          .replace(/<br\s*\/?>/gi, "\n")
          .replace(/<\/p>/gi, "\n\n")
          .replace(/<[^>]+>/g, "")
          .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
          .trim();
        md += `${text}\n\n`;
      }

      // Conversations for this entry
      if (opts.include_conversations) {
        const convos = await getAll("SELECT * FROM conversations WHERE entry_id = $1 ORDER BY created_at", [e.id]);
        for (const c of convos) {
          let msgs = [];
          try { msgs = typeof c.messages === "string" ? JSON.parse(c.messages) : (c.messages || []); } catch {}
          if (msgs.length) {
            md += `### Conversation\n\n`;
            for (const m of msgs) {
              md += `**${m.role === "user" ? "You" : "AI Companion"}:** ${m.content}\n\n`;
            }
          }
        }
      }

      md += `---\n\n`;
    }

    // Memories / insights section
    if (opts.include_memories) {
      const memories = await getAll("SELECT * FROM ai_memories WHERE user_id = $1 AND is_active = TRUE ORDER BY category, updated_at DESC LIMIT 30", [opts.user_id || "default"]);
      if (memories.length) {
        md += `## AI Insights & Reflections\n\n*What your AI companion learned about your journey.*\n\n`;
        const byCat = {};
        for (const m of memories) { (byCat[m.category] = byCat[m.category] || []).push(m.content); }
        const labels = { struggle: "Struggles", strength: "Strengths", pattern: "Patterns", relationship: "Relationships", trigger: "Triggers", insight: "Insights", milestone: "Milestones" };
        for (const [cat, items] of Object.entries(byCat)) {
          md += `### ${labels[cat] || cat}\n\n`;
          for (const item of items.slice(0, 5)) md += `- ${item}\n`;
          md += `\n`;
        }
        md += `---\n\n`;
      }
    }

    // Statistics
    if (opts.include_statistics) {
      const totalEntries = filtered.length;
      const moods = await getAll("SELECT weather FROM mood_entries WHERE user_id = $1", [opts.user_id || "default"]);
      const moodCounts = {};
      for (const m of moods) { moodCounts[m.weather] = (moodCounts[m.weather] || 0) + 1; }
      const topMood = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0];
      md += `## Journey at a Glance\n\n`;
      md += `- **Total Entries:** ${totalEntries}\n`;
      md += `- **Total Mood Records:** ${moods.length}\n`;
      if (topMood) md += `- **Most Common Weather:** ${(MOOD_WEATHER[topMood[0]] || {}).label || topMood[0]} (${topMood[1]} times)\n`;
      md += `\n`;
    }

    return md;
  }

  // ── JSON error handler for API routes ──
  app.use("/api", (err, req, res, _next) => {
    console.error("[StepScribe API Error]", err.message || err);
    res.status(err.status || 500).json({ detail: err.message || "Internal server error" });
  });

  return app;
}

module.exports = { createApp };
