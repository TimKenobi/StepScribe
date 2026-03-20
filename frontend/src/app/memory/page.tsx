"use client";

import { useState, useEffect } from "react";
import {
  Brain, ToggleLeft, ToggleRight, Trash2, Plus, Search,
  ChevronDown, ChevronUp, Filter, Zap,
} from "lucide-react";
import { memoryApi } from "@/lib/api";
import type { AIMemory } from "@/lib/types";

const CATEGORY_META: Record<string, { label: string; description: string }> = {
  struggle: { label: "Struggles", description: "Things you're fighting" },
  strength: { label: "Strengths", description: "What keeps you going" },
  pattern: { label: "Patterns", description: "Recurring behaviors the AI has noticed" },
  relationship: { label: "Relationships", description: "Key people and dynamics" },
  trigger: { label: "Triggers", description: "What sets you off" },
  insight: { label: "Insights", description: "Breakthroughs and realizations" },
  preference: { label: "Preferences", description: "How you like to be spoken with" },
  milestone: { label: "Milestones", description: "Achievements and turning points" },
  background: { label: "Background", description: "Life context and history" },
};

const CATEGORIES = Object.keys(CATEGORY_META);

export default function MemoryPage() {
  const [memories, setMemories] = useState<AIMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newCategory, setNewCategory] = useState("insight");
  const [newContent, setNewContent] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(CATEGORIES));
  const [compacting, setCompacting] = useState(false);
  const [compactMessage, setCompactMessage] = useState("");

  useEffect(() => {
    loadMemories();
  }, [filterCategory]);

  const loadMemories = async () => {
    setLoading(true);
    try {
      const data = await memoryApi.list("default", filterCategory || undefined);
      setMemories(data);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  };

  const addMemory = async () => {
    if (!newContent.trim()) return;
    try {
      await memoryApi.add({ category: newCategory, content: newContent.trim() });
      setNewContent("");
      setShowAdd(false);
      loadMemories();
    } catch {}
  };

  const deleteMemory = async (id: string) => {
    try {
      await memoryApi.delete(id);
      setMemories((prev) => prev.filter((m) => m.id !== id));
    } catch {}
  };

  const toggleMemory = async (id: string) => {
    try {
      await memoryApi.toggle(id);
      setMemories((prev) =>
        prev.map((m) => (m.id === id ? { ...m, is_active: !m.is_active } : m))
      );
    } catch {}
  };

  const toggleCategoryExpand = (cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const compactMemories = async () => {
    setCompacting(true);
    setCompactMessage("");
    try {
      const result = await memoryApi.compact("default", filterCategory || undefined);
      if (result.status === "skip") {
        setCompactMessage(result.message || "Not enough memories to compact.");
      } else {
        setCompactMessage(`Compacted ${result.before} memories → ${result.reduced > 0 ? result.after : result.before}${result.reduced > 0 ? ` (removed ${result.reduced} duplicates)` : " (no duplicates found)"}`);
        loadMemories();
      }
    } catch {
      setCompactMessage("Compaction failed — check your AI provider is configured.");
    } finally {
      setCompacting(false);
      setTimeout(() => setCompactMessage(""), 5000);
    }
  };

  // Filter and group
  const filtered = memories.filter((m) =>
    !searchQuery || m.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const grouped: Record<string, AIMemory[]> = {};
  for (const m of filtered) {
    if (!grouped[m.category]) grouped[m.category] = [];
    grouped[m.category].push(m);
  }

  const activeCount = memories.filter((m) => m.is_active).length;
  const totalCount = memories.length;

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  const sourceLabel = (source: string) => {
    const map: Record<string, string> = {
      journal: "Journal",
      conversation: "Conversation",
      manual: "You",
      mood: "Mood",
    };
    return map[source] || source;
  };

  return (
    <div className="max-w-3xl mx-auto p-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <Brain size={24} style={{ color: "var(--accent)" }} />
        <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
          AI Memory
        </h1>
      </div>
      <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
        Everything your AI companion has learned about you. It uses these memories to
        give you better, more personal guidance — like a sponsor who truly knows you.
      </p>

      {/* Stats bar */}
      <div
        className="flex items-center gap-4 p-3 rounded-lg mb-6 text-xs"
        style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}
      >
        <span style={{ color: "var(--text-muted)" }}>
          {totalCount} {totalCount === 1 ? "memory" : "memories"}
        </span>
        <span style={{ color: "var(--accent)" }}>
          {activeCount} active
        </span>
        {totalCount - activeCount > 0 && (
          <span style={{ color: "var(--text-muted)" }}>
            {totalCount - activeCount} disabled
          </span>
        )}
        <div className="flex-1" />
        <button
          onClick={compactMemories}
          disabled={compacting || totalCount < 3}
          className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-opacity"
          style={{
            backgroundColor: "var(--accent)",
            color: "#fff",
            opacity: compacting || totalCount < 3 ? 0.4 : 1,
          }}
          title="Use AI to merge duplicate and related memories into fewer, denser ones"
        >
          <Zap size={12} />
          {compacting ? "Compacting..." : "Compact"}
        </button>
      </div>

      {compactMessage && (
        <div
          className="px-3 py-2 rounded-lg mb-4 text-xs"
          style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
        >
          {compactMessage}
        </div>
      )}

      {/* Search + filter bar */}
      <div className="flex gap-3 mb-6">
        <div
          className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg"
          style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}
        >
          <Search size={14} style={{ color: "var(--text-muted)" }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search memories..."
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: "var(--text-primary)" }}
          />
        </div>
        <div className="relative">
          <select
            value={filterCategory || ""}
            onChange={(e) => setFilterCategory(e.target.value || null)}
            className="px-3 py-2 rounded-lg text-sm outline-none appearance-none pr-8 cursor-pointer"
            style={{
              backgroundColor: "var(--bg-secondary)",
              color: "var(--text-primary)",
              border: "1px solid var(--border)",
            }}
          >
            <option value="">All categories</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {CATEGORY_META[cat].label}
              </option>
            ))}
          </select>
          <Filter
            size={12}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: "var(--text-muted)" }}
          />
        </div>
      </div>

      {/* Add memory button / form */}
      {showAdd ? (
        <div
          className="mb-6 p-4 rounded-lg border"
          style={{ borderColor: "var(--accent)", backgroundColor: "var(--bg-secondary)" }}
        >
          <div className="text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>
            Add a memory manually
          </div>
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none mb-3"
            style={{
              backgroundColor: "var(--bg-primary)",
              color: "var(--text-primary)",
              border: "1px solid var(--border)",
            }}
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {CATEGORY_META[cat].label} — {CATEGORY_META[cat].description}
              </option>
            ))}
          </select>
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="What should the AI remember about you?"
            rows={3}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none mb-3"
            style={{
              backgroundColor: "var(--bg-primary)",
              color: "var(--text-primary)",
              border: "1px solid var(--border)",
            }}
          />
          <div className="flex gap-2">
            <button
              onClick={addMemory}
              className="px-4 py-2 rounded-lg text-sm"
              style={{ backgroundColor: "var(--accent)", color: "#fff" }}
            >
              Save Memory
            </button>
            <button
              onClick={() => { setShowAdd(false); setNewContent(""); }}
              className="px-4 py-2 rounded-lg text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="mb-6 flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm"
          style={{
            backgroundColor: "var(--bg-tertiary)",
            color: "var(--text-secondary)",
            border: "1px solid var(--border)",
          }}
        >
          <Plus size={16} />
          Add a Memory
        </button>
      )}

      {/* Memory groups */}
      {loading ? (
        <div className="text-center py-12 text-sm" style={{ color: "var(--text-muted)" }}>
          Loading memories...
        </div>
      ) : totalCount === 0 ? (
        <div className="text-center py-16">
          <Brain size={40} className="mx-auto mb-4" style={{ color: "var(--text-muted)", opacity: 0.3 }} />
          <p className="text-sm mb-1" style={{ color: "var(--text-secondary)" }}>
            No memories yet
          </p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            As you journal and talk with your AI companion, it will learn about you
            and store memories here. You can also add them manually.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-sm" style={{ color: "var(--text-muted)" }}>
          No memories match your search.
        </div>
      ) : (
        <div className="space-y-4">
          {CATEGORIES.filter((cat) => grouped[cat]?.length).map((cat) => {
            const items = grouped[cat];
            const isExpanded = expandedCategories.has(cat);
            const activeInCat = items.filter((m) => m.is_active).length;

            return (
              <div
                key={cat}
                className="rounded-lg border overflow-hidden"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)" }}
              >
                {/* Category header */}
                <button
                  onClick={() => toggleCategoryExpand(cat)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left"
                  style={{ backgroundColor: "var(--bg-secondary)" }}
                >
                  <div>
                    <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                      {CATEGORY_META[cat].label}
                    </span>
                    <span className="text-xs ml-2" style={{ color: "var(--text-muted)" }}>
                      {items.length} · {activeInCat} active
                    </span>
                  </div>
                  {isExpanded ? (
                    <ChevronUp size={16} style={{ color: "var(--text-muted)" }} />
                  ) : (
                    <ChevronDown size={16} style={{ color: "var(--text-muted)" }} />
                  )}
                </button>

                {/* Items */}
                {isExpanded && (
                  <div className="border-t" style={{ borderColor: "var(--border)" }}>
                    {items.map((mem) => (
                      <div
                        key={mem.id}
                        className="flex items-start gap-3 px-4 py-3 border-b last:border-b-0"
                        style={{
                          borderColor: "var(--border)",
                          opacity: mem.is_active ? 1 : 0.45,
                        }}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
                            {mem.content}
                          </p>
                          <div className="flex items-center gap-3 mt-1.5">
                            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                              {sourceLabel(mem.source)}
                            </span>
                            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                              {formatDate(mem.created_at)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                          <button
                            onClick={() => toggleMemory(mem.id)}
                            title={mem.is_active ? "Disable — AI will ignore this" : "Enable — AI will use this"}
                          >
                            {mem.is_active ? (
                              <ToggleRight size={18} style={{ color: "var(--accent)" }} />
                            ) : (
                              <ToggleLeft size={18} style={{ color: "var(--text-muted)" }} />
                            )}
                          </button>
                          <button
                            onClick={() => deleteMemory(mem.id)}
                            title="Delete permanently"
                            style={{ color: "var(--danger, #c44)" }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
