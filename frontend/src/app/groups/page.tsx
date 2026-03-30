"use client";

import { useState, useEffect } from "react";
import {
  Plus, Users, Copy, LogIn, Cloud, CloudOff, Settings, ChevronDown, ChevronUp,
  Loader2, CheckCircle, XCircle, ExternalLink, RefreshCw, Share2, BookOpen,
} from "lucide-react";
import { groupsApi, supabaseApi } from "@/lib/api";
import { Group } from "@/lib/types";

declare global {
  interface Window {
    stepscribe?: { platform?: string; isDesktop?: boolean; openExternal?: (url: string) => Promise<void>; printToPDF?: (html: string) => Promise<string> };
  }
}

const SUPABASE_SQL = `-- Run this in your Supabase SQL Editor (one time setup)

CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  created_by TEXT NOT NULL,
  invite_code TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS group_members (
  id TEXT PRIMARY KEY,
  group_id TEXT REFERENCES groups(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  display_name TEXT DEFAULT '',
  role TEXT DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shared_entries (
  id TEXT PRIMARY KEY,
  group_id TEXT REFERENCES groups(id) ON DELETE CASCADE,
  shared_by TEXT NOT NULL,
  display_name TEXT DEFAULT '',
  title TEXT DEFAULT '',
  content TEXT DEFAULT '',
  shared_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_entries ENABLE ROW LEVEL SECURITY;

-- Allow access with the anon key (private group, shared credentials)
CREATE POLICY "anon_groups" ON groups FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_members" ON group_members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_shared" ON shared_entries FOR ALL USING (true) WITH CHECK (true);`;

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupDesc, setGroupDesc] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [joinRole, setJoinRole] = useState("member");
  const [copied, setCopied] = useState<string | null>(null);
  const [joinError, setJoinError] = useState("");

  // Supabase config
  const [showSetup, setShowSetup] = useState(false);
  const [supabaseUrl, setSupabaseUrl] = useState("");
  const [supabaseKey, setSupabaseKey] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [supabaseConfigured, setSupabaseConfigured] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const [sqlCopied, setSqlCopied] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Group detail
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [sharedEntries, setSharedEntries] = useState<Record<string, any[]>>({});
  const [members, setMembers] = useState<Record<string, any[]>>({});

  useEffect(() => {
    loadGroups();
    loadSupabaseConfig();
  }, []);

  const loadGroups = async () => {
    try {
      const data = await groupsApi.list();
      setGroups(data);
    } catch {}
  };

  const loadSupabaseConfig = async () => {
    try {
      const config = await supabaseApi.get();
      setSupabaseConfigured(config.configured);
      if (config.supabase_url) setSupabaseUrl(config.supabase_url);
      if (config.supabase_anon_key) setSupabaseKey(config.supabase_anon_key);
      if (config.supabase_display_name) setDisplayName(config.supabase_display_name);
    } catch {}
  };

  const createGroup = async () => {
    if (!groupName.trim()) return;
    try {
      await groupsApi.create({ name: groupName, description: groupDesc });
      setGroupName("");
      setGroupDesc("");
      setShowCreate(false);
      loadGroups();
    } catch {}
  };

  const joinGroup = async () => {
    if (!inviteCode.trim()) return;
    setJoinError("");
    try {
      await groupsApi.join({ user_id: "default", invite_code: inviteCode, role: joinRole });
      setInviteCode("");
      setShowJoin(false);
      loadGroups();
    } catch (e: any) {
      setJoinError(e?.message || "Could not join group. Check the invite code.");
    }
  };

  const copyInvite = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await supabaseApi.test({ supabase_url: supabaseUrl, supabase_anon_key: supabaseKey });
      setTestResult(result);
    } catch {
      setTestResult({ ok: false, error: "Connection failed" });
    } finally {
      setTesting(false);
    }
  };

  const saveSupabase = async () => {
    setSaving(true);
    try {
      await supabaseApi.save({ supabase_url: supabaseUrl, supabase_anon_key: supabaseKey, supabase_display_name: displayName });
      setSupabaseConfigured(true);
      setShowSetup(false);
    } catch {} finally {
      setSaving(false);
    }
  };

  const syncGroups = async () => {
    setSyncing(true);
    try {
      await groupsApi.syncPull();
      await loadGroups();
    } catch {} finally {
      setSyncing(false);
    }
  };

  const toggleGroup = async (groupId: string) => {
    if (expandedGroup === groupId) {
      setExpandedGroup(null);
      return;
    }
    setExpandedGroup(groupId);
    try {
      const [s, m] = await Promise.all([groupsApi.shared(groupId), groupsApi.members(groupId)]);
      setSharedEntries(prev => ({ ...prev, [groupId]: s }));
      setMembers(prev => ({ ...prev, [groupId]: m }));
    } catch {}
  };

  const openExternal = (url: string) => {
    if (window.stepscribe?.openExternal) {
      window.stepscribe.openExternal(url);
    } else {
      window.open(url, "_blank");
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="text-2xl font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
        Group Journaling
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
        Recovery works better with others. Share your journey with sponsors and trusted companions.
      </p>

      {/* Cloud Sync Status */}
      <div className="p-4 rounded-lg border mb-6 flex items-center justify-between"
        style={{ borderColor: supabaseConfigured ? "var(--accent)" : "var(--border)", backgroundColor: "var(--bg-secondary)" }}>
        <div className="flex items-center gap-3">
          {supabaseConfigured ? (
            <Cloud size={20} style={{ color: "var(--accent)" }} />
          ) : (
            <CloudOff size={20} style={{ color: "var(--text-muted)" }} />
          )}
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              {supabaseConfigured ? "Cloud Sync Active" : "Cloud Sync Not Set Up"}
            </p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {supabaseConfigured
                ? "Groups sync across devices via Supabase. Invite codes work for anyone with the connection."
                : "Groups are local-only. Set up Supabase (free) to sync with others."}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {supabaseConfigured && (
            <button onClick={syncGroups} disabled={syncing}
              className="p-2 rounded-lg" style={{ color: "var(--accent)" }} title="Sync now">
              {syncing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            </button>
          )}
          <button onClick={() => setShowSetup(!showSetup)}
            className="p-2 rounded-lg" style={{ color: "var(--text-secondary)" }} title="Setup">
            <Settings size={16} />
          </button>
        </div>
      </div>

      {/* Supabase Setup Panel */}
      {showSetup && (
        <div className="mb-6 p-5 rounded-lg border" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)" }}>
          <h3 className="text-sm font-medium mb-4 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <Cloud size={16} style={{ color: "var(--accent)" }} />
            Supabase Cloud Sync Setup
          </h3>

          {/* Step 1 */}
          <div className="mb-5">
            <p className="text-xs font-medium mb-1" style={{ color: "var(--accent)" }}>Step 1: Create a Free Supabase Project</p>
            <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
              Go to supabase.com, sign up free, and create a new project. The free tier includes 500MB storage — more than enough for group journaling.
            </p>
            <button onClick={() => openExternal("https://supabase.com/dashboard")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs"
              style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--accent)", border: "1px solid var(--border)" }}>
              <ExternalLink size={12} /> Open Supabase Dashboard
            </button>
          </div>

          {/* Step 2 */}
          <div className="mb-5">
            <p className="text-xs font-medium mb-1" style={{ color: "var(--accent)" }}>Step 2: Run This SQL in the SQL Editor</p>
            <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
              In your Supabase project, go to SQL Editor, paste this, and click &quot;Run&quot;. This creates the tables for group sync.
            </p>
            <div className="relative">
              <pre className="text-xs p-3 rounded-lg overflow-auto max-h-48"
                style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                {SUPABASE_SQL}
              </pre>
              <button onClick={() => { navigator.clipboard.writeText(SUPABASE_SQL); setSqlCopied(true); setTimeout(() => setSqlCopied(false), 2000); }}
                className="absolute top-2 right-2 px-2 py-1 rounded text-xs"
                style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-secondary)" }}>
                {sqlCopied ? "Copied!" : "Copy SQL"}
              </button>
            </div>
          </div>

          {/* Step 3 */}
          <div className="mb-5">
            <p className="text-xs font-medium mb-1" style={{ color: "var(--accent)" }}>Step 3: Enter Your Project Credentials</p>
            <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
              Find these in Settings → API in your Supabase dashboard. Use the Project URL and the &quot;anon public&quot; key.
            </p>
            <div className="space-y-3">
              <input
                value={supabaseUrl}
                onChange={(e) => { setSupabaseUrl(e.target.value); setTestResult(null); }}
                placeholder="https://your-project.supabase.co"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
              />
              <input
                value={supabaseKey}
                onChange={(e) => { setSupabaseKey(e.target.value); setTestResult(null); }}
                placeholder="eyJhbGciOiJIUzI1NiIs... (anon public key)"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
              />
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your display name (shown to group members)"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
              />
            </div>
          </div>

          {/* Test + Save */}
          <div className="flex items-center gap-3">
            <button onClick={testConnection} disabled={testing || !supabaseUrl || !supabaseKey}
              className="px-4 py-2 rounded-lg text-sm flex items-center gap-1.5"
              style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-primary)", border: "1px solid var(--border)", opacity: (!supabaseUrl || !supabaseKey) ? 0.5 : 1 }}>
              {testing ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
              Test Connection
            </button>
            <button onClick={saveSupabase} disabled={saving || !supabaseUrl || !supabaseKey}
              className="px-4 py-2 rounded-lg text-sm flex items-center gap-1.5"
              style={{ backgroundColor: "var(--accent)", color: "#fff", opacity: (!supabaseUrl || !supabaseKey) ? 0.5 : 1 }}>
              {saving ? <Loader2 size={12} className="animate-spin" /> : null}
              Save
            </button>
            <button onClick={() => setShowSetup(false)} className="px-3 py-2 rounded-lg text-sm" style={{ color: "var(--text-muted)" }}>Cancel</button>
          </div>
          {testResult && (
            <div className="flex items-center gap-2 mt-3 text-xs" style={{ color: testResult.ok ? "var(--success, #22c55e)" : "#f87171" }}>
              {testResult.ok ? <CheckCircle size={14} /> : <XCircle size={14} />}
              {testResult.ok ? "Connected! Tables found." : testResult.error}
            </div>
          )}

          {/* Sharing info */}
          <div className="mt-4 p-3 rounded-lg text-xs" style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
            <p className="font-medium mb-1" style={{ color: "var(--text-secondary)" }}>How to share with your group:</p>
            <p>Everyone in your group enters the same Supabase URL and anon key. Then create a group and share the invite code.
            Each person&apos;s StepScribe will sync through the shared Supabase project. Only entries you explicitly share are visible to others — your private journal stays private.</p>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={() => { setShowCreate(true); setShowJoin(false); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm"
          style={{ backgroundColor: "var(--accent)", color: "#fff" }}
        >
          <Plus size={16} />
          Create Group
        </button>
        <button
          onClick={() => { setShowJoin(true); setShowCreate(false); setJoinError(""); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm"
          style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
        >
          <LogIn size={16} />
          Join Group
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="mb-6 p-4 rounded-lg border" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)" }}>
          <h3 className="text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>New Group</h3>
          <input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Group name"
            className="w-full px-3 py-2 rounded-lg text-sm outline-none mb-3"
            style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
          />
          <textarea
            value={groupDesc}
            onChange={(e) => setGroupDesc(e.target.value)}
            placeholder="What's this group about?"
            rows={2}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none mb-3"
            style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
          />
          <div className="flex gap-2">
            <button onClick={createGroup} className="px-4 py-2 rounded-lg text-sm" style={{ backgroundColor: "var(--accent)", color: "#fff" }}>Create</button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg text-sm" style={{ color: "var(--text-muted)" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Join form */}
      {showJoin && (
        <div className="mb-6 p-4 rounded-lg border" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)" }}>
          <h3 className="text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>Join a Group</h3>
          <input
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            placeholder="Paste invite code"
            className="w-full px-3 py-2 rounded-lg text-sm outline-none mb-3"
            style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
          />
          <div className="flex items-center gap-3 mb-3">
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Join as:</span>
            <select
              value={joinRole}
              onChange={(e) => setJoinRole(e.target.value)}
              className="px-3 py-1.5 rounded text-sm outline-none"
              style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
            >
              <option value="member">Member</option>
              <option value="sponsor">Sponsor</option>
            </select>
          </div>
          {joinError && <p className="text-xs mb-2" style={{ color: "#f87171" }}>{joinError}</p>}
          <div className="flex gap-2">
            <button onClick={joinGroup} className="px-4 py-2 rounded-lg text-sm" style={{ backgroundColor: "var(--accent)", color: "#fff" }}>Join</button>
            <button onClick={() => setShowJoin(false)} className="px-4 py-2 rounded-lg text-sm" style={{ color: "var(--text-muted)" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Group list */}
      <div className="space-y-3">
        {groups.map((group) => (
          <div key={group.id} className="rounded-lg border overflow-hidden"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)" }}>
            <div className="p-4">
              <div className="flex items-start justify-between">
                <button onClick={() => toggleGroup(group.id)} className="flex items-center gap-2 text-left flex-1">
                  <Users size={16} style={{ color: "var(--accent)" }} />
                  <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{group.name}</span>
                  {expandedGroup === group.id ? <ChevronUp size={14} style={{ color: "var(--text-muted)" }} /> : <ChevronDown size={14} style={{ color: "var(--text-muted)" }} />}
                </button>
                <button
                  onClick={() => copyInvite(group.invite_code)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded text-xs shrink-0"
                  style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
                >
                  <Copy size={12} />
                  {copied === group.invite_code ? "Copied!" : "Invite Code"}
                </button>
              </div>
              {group.description && (
                <p className="text-xs mt-1 ml-6" style={{ color: "var(--text-secondary)" }}>{group.description}</p>
              )}
            </div>

            {/* Expanded group detail */}
            {expandedGroup === group.id && (
              <div className="border-t px-4 pb-4 pt-3" style={{ borderColor: "var(--border)" }}>
                {/* Members */}
                {members[group.id] && members[group.id].length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-medium mb-2" style={{ color: "var(--text-secondary)" }}>Members</p>
                    <div className="flex flex-wrap gap-2">
                      {members[group.id].map((m: any) => (
                        <span key={m.id} className="px-2 py-1 rounded-full text-xs"
                          style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-secondary)" }}>
                          {m.display_name || m.user_id} {m.role === "sponsor" && "· Sponsor"}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Shared entries */}
                <p className="text-xs font-medium mb-2" style={{ color: "var(--text-secondary)" }}>Shared Entries</p>
                {sharedEntries[group.id] && sharedEntries[group.id].length > 0 ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {sharedEntries[group.id].map((entry: any) => (
                      <div key={entry.id} className="p-3 rounded-lg" style={{ backgroundColor: "var(--bg-primary)", border: "1px solid var(--border)" }}>
                        <div className="flex items-center gap-2 mb-1">
                          <BookOpen size={12} style={{ color: "var(--accent)" }} />
                          <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{entry.title || "Untitled"}</span>
                        </div>
                        <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                          {(entry.content || "").slice(0, 300)}{(entry.content || "").length > 300 ? "..." : ""}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                            {entry.display_name || entry.shared_by} · {new Date(entry.shared_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs py-3" style={{ color: "var(--text-muted)" }}>
                    No entries shared yet. Share an entry from the journal page using the share button.
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
        {groups.length === 0 && (
          <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>
            No groups yet. Create one or join with an invite code.
          </p>
        )}
      </div>
    </div>
  );
}
