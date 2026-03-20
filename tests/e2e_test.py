#!/usr/bin/env python3
"""
End-to-end test script for StepScribe.
Simulates a user clicking every button by exercising all API endpoints.

Usage:
    python tests/e2e_test.py [BASE_URL]

Default BASE_URL: http://localhost:8100
"""

import sys
import json
import urllib.request
import urllib.error
import time

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8100"
PASS = 0
FAIL = 0
ERRORS = []


def api(method: str, path: str, body=None, expect_status=200):
    global PASS, FAIL
    url = f"{BASE}{path}"
    data = json.dumps(body).encode() if body else None
    headers = {"Content-Type": "application/json"} if body else {}
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        resp = urllib.request.urlopen(req)
        result = json.loads(resp.read().decode())
        if resp.status == expect_status:
            PASS += 1
        else:
            FAIL += 1
            ERRORS.append(f"{method} {path}: expected {expect_status}, got {resp.status}")
        return result
    except urllib.error.HTTPError as e:
        if e.code == expect_status:
            PASS += 1
            try:
                return json.loads(e.read().decode())
            except Exception:
                return {}
        FAIL += 1
        ERRORS.append(f"{method} {path}: HTTP {e.code} — {e.read().decode()[:200]}")
        return None
    except Exception as e:
        FAIL += 1
        ERRORS.append(f"{method} {path}: {e}")
        return None


def test(name: str, condition: bool, detail: str = ""):
    global PASS, FAIL
    if condition:
        PASS += 1
        print(f"  ✓ {name}")
    else:
        FAIL += 1
        msg = f"  ✗ {name}" + (f" — {detail}" if detail else "")
        print(msg)
        ERRORS.append(msg)


print("=" * 60)
print("StepScribe E2E Test Suite")
print(f"Target: {BASE}")
print("=" * 60)

# ─── Health Check ───
print("\n── Health ──")
health = api("GET", "/health")
test("Health endpoint", health and health.get("status") == "ok")

# ─── Onboarding ───
print("\n── Onboarding ──")
status = api("GET", "/api/onboarding/status?user_id=default")
test("Onboarding status loads", status is not None)

# ─── Journal CRUD ───
print("\n── Journal Entry CRUD ──")

# Create entry 1
entry1 = api("POST", "/api/journal/entries", {
    "user_id": "default",
    "title": "Test Entry 1",
    "content": "First test content",
    "content_html": "<p>First test content</p>",
    "is_draft": True,
    "entry_date": "2025-01-15",
})
test("Create entry 1", entry1 and "id" in entry1)
test("Entry 1 has entry_date", entry1 and entry1.get("entry_date") == "2025-01-15")
entry1_id = entry1["id"] if entry1 else None

# Create entry 2 (same day — should NOT override entry 1!)
entry2 = api("POST", "/api/journal/entries", {
    "user_id": "default",
    "title": "Test Entry 2",
    "content": "Second test content",
    "content_html": "<p>Second test content</p>",
    "is_draft": True,
    "entry_date": "2025-01-15",
})
test("Create entry 2 (same date)", entry2 and "id" in entry2)
entry2_id = entry2["id"] if entry2 else None
test("Entry 2 is different from entry 1", entry1_id != entry2_id)

# List entries — both should exist
entries = api("GET", "/api/journal/entries?user_id=default")
test("List entries returns data", entries is not None and len(entries) >= 2)
ids = [e["id"] for e in (entries or [])]
test("Entry 1 still exists", entry1_id in ids)
test("Entry 2 still exists", entry2_id in ids)

# Update entry
if entry1_id:
    updated = api("PATCH", f"/api/journal/entries/{entry1_id}", {
        "title": "Updated Title",
        "is_draft": False,
        "entry_date": "2025-01-14",
    })
    test("Update entry", updated and updated.get("title") == "Updated Title")
    test("Update entry_date", updated and updated.get("entry_date") == "2025-01-14")

# Get single entry
if entry1_id:
    got = api("GET", f"/api/journal/entries/{entry1_id}")
    test("Get entry by ID", got and got.get("id") == entry1_id)

# ─── Mood / Inner Weather ───
print("\n── Mood / Inner Weather ──")
options = api("GET", "/api/mood/weather-options")
test("Weather options loads", options is not None)
test("Has new positive moods", options and "radiant" in options and "golden_hour" in options)
test("Has original moods", options and "storm" in options and "clear_skies" in options)
test("16 total moods", options and len(options) == 16)

# Create mood (standalone)
mood1 = api("POST", "/api/mood/", {
    "user_id": "default",
    "weather": "radiant",
    "note": "Best day ever!",
    "energy_level": 9,
})
test("Create standalone mood", mood1 and "id" in mood1)

# Create mood linked to entry
if entry1_id:
    mood2 = api("POST", "/api/mood/", {
        "user_id": "default",
        "weather": "golden_hour",
        "note": "Grateful today",
        "energy_level": 8,
        "entry_id": entry1_id,
    })
    test("Create entry-linked mood", mood2 and mood2.get("entry_id") == entry1_id)

# Mood history
history = api("GET", "/api/mood/history?user_id=default")
test("Mood history loads", history is not None and len(history) >= 1)

# Get mood by entry
if entry1_id:
    entry_mood = api("GET", f"/api/mood/by-entry/{entry1_id}")
    test("Mood by entry loads", entry_mood is not None and entry_mood.get("entry_id") == entry1_id)

# Update mood
mood1_id = mood1["id"] if mood1 else None
if mood1_id:
    updated = api("PATCH", f"/api/mood/{mood1_id}", {"weather": "golden_hour", "energy_level": 7})
    test("Update mood", updated and updated.get("weather") == "golden_hour" and updated.get("energy_level") == 7)

# Delete mood (standalone one)
if mood1_id:
    deleted = api("DELETE", f"/api/mood/{mood1_id}")
    test("Delete mood", deleted and deleted.get("deleted") is True)

# ─── Conversations ───
print("\n── Conversations ──")
templates = api("GET", "/api/conversations/templates/list?user_id=default")
test("Templates load", templates is not None)

# Send message (may fail without AI key — just test the endpoint exists)
conv = api("POST", "/api/conversations/send", {
    "user_id": "default",
    "message": "Hello, testing",
    "entry_id": entry1_id,
})
# This might fail if no AI key is configured, which is OK
if conv and "conversation_id" in conv:
    test("Conversation created", True)
    conv_id = conv["conversation_id"]

    # List conversations
    convos = api("GET", f"/api/conversations/?user_id=default&entry_id={entry1_id}")
    test("List conversations", convos is not None and len(convos) >= 1)
else:
    print("  ⚠ AI conversation skipped (no API key configured)")

# ─── Heroes ───
print("\n── Heroes ──")
heroes = api("GET", "/api/heroes/?user_id=default")
test("Heroes list loads", heroes is not None)

defaults = api("GET", "/api/heroes/defaults")
test("Default heroes loads", defaults is not None)

# ─── Faith ───
print("\n── Faith ──")
traditions = api("GET", "/api/faith/traditions")
test("Faith traditions loads", traditions is not None)

faith = api("GET", "/api/faith/?user_id=default")
test("Get user faith", faith is not None)

# ─── Memory ───
print("\n── AI Memory ──")
memories = api("GET", "/api/memory/?user_id=default")
test("Memories list loads", memories is not None)

# ─── Sync / Backup ───
print("\n── Backup / Sync ──")
backup = api("GET", "/api/sync/export?user_id=default")
test("Export backup", backup is not None)
if backup:
    test("Backup has entries", "entries" in backup)
    test("Backup has moods", "moods" in backup)
    test("Backup has conversations", "conversations" in backup)
    test("Backup has memories", "memories" in backup)
    test("Backup has heroes", "heroes" in backup)
    test("Backup has attachments", "attachments" in backup)
    test("Backup has preferences", "preferences" in backup)
    test("Backup has exported_at", "exported_at" in backup)

# ─── Export ───
print("\n── Export / Book ──")
entries_json = api("GET", "/api/export/entries-json?user_id=default")
test("Entries JSON export", entries_json is not None)

# ─── Settings ───
print("\n── Settings ──")
settings = api("GET", "/api/settings/ai")
test("Settings loads", settings is not None)

# ─── Cleanup ───
print("\n── Cleanup ──")
if entry2_id:
    deleted = api("DELETE", f"/api/journal/entries/{entry2_id}")
    test("Delete entry 2", deleted and deleted.get("deleted"))
if entry1_id:
    deleted = api("DELETE", f"/api/journal/entries/{entry1_id}")
    test("Delete entry 1", deleted and deleted.get("deleted"))

# Verify deletion
if entry1_id:
    api("GET", f"/api/journal/entries/{entry1_id}", expect_status=404)
    test("Entry 1 confirmed deleted", True)

# ─── Summary ───
print("\n" + "=" * 60)
print(f"Results: {PASS} passed, {FAIL} failed")
if ERRORS:
    print("\nFailures:")
    for e in ERRORS:
        print(f"  {e}")
print("=" * 60)

sys.exit(1 if FAIL > 0 else 0)
