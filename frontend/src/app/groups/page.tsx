"use client";

import { useState, useEffect } from "react";
import { Plus, Users, Copy, LogIn, AlertTriangle } from "lucide-react";
import { groupsApi } from "@/lib/api";
import { Group } from "@/lib/types";

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupDesc, setGroupDesc] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [joinRole, setJoinRole] = useState("member");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      const data = await groupsApi.list();
      setGroups(data);
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
    try {
      await groupsApi.join({ user_id: "default", invite_code: inviteCode, role: joinRole });
      setInviteCode("");
      setShowJoin(false);
      loadGroups();
    } catch {}
  };

  const copyInvite = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="text-2xl font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
        Group Journaling
      </h1>
      <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
        Recovery works better with others. Share your journey with sponsors and trusted companions.
      </p>

      {/* Local-only notice */}
      <div className="p-4 rounded-lg border mb-8 flex gap-3" style={{ borderColor: "#f59e0b40", backgroundColor: "#f59e0b08" }}>
        <AlertTriangle size={18} style={{ color: "#f59e0b", flexShrink: 0, marginTop: 2 }} />
        <div>
          <p className="text-sm font-medium" style={{ color: "#f59e0b" }}>Desktop-Only Limitation</p>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            Group journaling requires a shared server to sync between devices. In this desktop version,
            groups are stored locally and invite codes only work on the same machine.
            A future update will add cloud sync options. For now, you can use groups to organize your own journal
            entries by category (e.g., &quot;Step Work&quot;, &quot;Gratitude&quot;, &quot;Sponsor Notes&quot;).
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 mb-8">
        <button
          onClick={() => { setShowCreate(true); setShowJoin(false); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm"
          style={{ backgroundColor: "var(--accent)", color: "#fff" }}
        >
          <Plus size={16} />
          Create Group
        </button>
        <button
          onClick={() => { setShowJoin(true); setShowCreate(false); }}
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
            <label className="text-sm" style={{ color: "var(--text-secondary)" }}>Join as:</label>
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
          <div className="flex gap-2">
            <button onClick={joinGroup} className="px-4 py-2 rounded-lg text-sm" style={{ backgroundColor: "var(--accent)", color: "#fff" }}>Join</button>
            <button onClick={() => setShowJoin(false)} className="px-4 py-2 rounded-lg text-sm" style={{ color: "var(--text-muted)" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Group list */}
      <div className="space-y-3">
        {groups.map((group) => (
          <div
            key={group.id}
            className="p-4 rounded-lg border"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)" }}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Users size={16} style={{ color: "var(--accent)" }} />
                  <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{group.name}</span>
                </div>
                {group.description && (
                  <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>{group.description}</p>
                )}
              </div>
              <button
                onClick={() => copyInvite(group.invite_code)}
                className="flex items-center gap-1 px-3 py-1.5 rounded text-xs"
                style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
              >
                <Copy size={12} />
                {copied === group.invite_code ? "Copied!" : "Invite Code"}
              </button>
            </div>
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
