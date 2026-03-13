"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Save, Trash2, BookOpen } from "lucide-react";
import Editor from "@/components/Editor";
import MoodWeather from "@/components/MoodWeather";
import VoiceInput from "@/components/VoiceInput";
import HeroQuotes from "@/components/HeroQuotes";
import { journalApi, moodApi } from "@/lib/api";
import { saveOfflineEntry, getSettings } from "@/lib/storage";
import { isOnline as checkOnline } from "@/lib/storage";

interface Entry {
  id: string;
  title: string;
  content: string;
  content_html: string;
  is_draft: boolean;
  created_at: string;
  updated_at: string;
}

export default function JournalPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [activeEntry, setActiveEntry] = useState<Entry | null>(null);
  const [title, setTitle] = useState("");
  const [html, setHtml] = useState("");
  const [selectedMood, setSelectedMood] = useState("");
  const [energy, setEnergy] = useState(5);
  const [saving, setSaving] = useState(false);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    loadEntries();
    checkOnline().then(setOnline);
  }, []);

  const loadEntries = async () => {
    try {
      const data = await journalApi.list();
      setEntries(data);
    } catch {}
  };

  const newEntry = () => {
    setActiveEntry(null);
    setTitle("");
    setHtml("");
    setSelectedMood("");
    setEnergy(5);
  };

  const selectEntry = (entry: Entry) => {
    setActiveEntry(entry);
    setTitle(entry.title);
    setHtml(entry.content_html || entry.content);
  };

  const saveEntry = useCallback(async (publish = false) => {
    setSaving(true);
    try {
      const data = {
        title,
        content: html.replace(/<[^>]+>/g, ""),
        content_html: html,
        is_draft: !publish,
      };
      if (!online) {
        saveOfflineEntry({ ...data, is_draft: !publish });
        setSaving(false);
        return;
      }
      if (activeEntry) {
        await journalApi.update(activeEntry.id, data);
      } else {
        const created = await journalApi.create({ ...data, user_id: "default" });
        setActiveEntry(created);
      }
      if (selectedMood) {
        await moodApi.create({
          user_id: "default",
          weather: selectedMood,
          energy_level: energy,
          entry_id: activeEntry?.id,
        });
      }
      loadEntries();
    } catch {}
    setSaving(false);
  }, [title, html, activeEntry, selectedMood, energy, online]);

  const deleteEntry = async () => {
    if (!activeEntry) return;
    try {
      await journalApi.delete(activeEntry.id);
      newEntry();
      loadEntries();
    } catch {}
  };

  const handleVoiceResult = (text: string) => {
    setHtml((prev) => prev + `<p>${text}</p>`);
  };

  const wordCount = html.replace(/<[^>]+>/g, "").split(/\s+/).filter(Boolean).length;

  return (
    <div className="flex h-screen">
      {/* Entry list sidebar */}
      <div className="w-64 border-r flex flex-col" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)" }}>
        <div className="p-3 border-b flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
          <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Entries</span>
          <button onClick={newEntry} title="New entry">
            <Plus size={16} style={{ color: "var(--accent)" }} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {entries.map((e) => (
            <button
              key={e.id}
              onClick={() => selectEntry(e)}
              className="w-full text-left px-3 py-2.5 border-b transition-colors"
              style={{
                borderColor: "var(--border)",
                backgroundColor: activeEntry?.id === e.id ? "var(--bg-tertiary)" : "transparent",
              }}
            >
              <div className="text-sm truncate" style={{ color: "var(--text-primary)" }}>
                {e.title || "Untitled"}
              </div>
              <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                {new Date(e.created_at).toLocaleDateString()}
                {e.is_draft && " · Draft"}
              </div>
            </button>
          ))}
          {entries.length === 0 && (
            <div className="p-4 text-center">
              <BookOpen size={24} className="mx-auto mb-2" style={{ color: "var(--text-muted)" }} />
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Your journal is empty. Start writing.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Main editor area */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        <div className="max-w-3xl w-full mx-auto p-8 flex-1">
          {/* Hero quote */}
          <HeroQuotes refreshInterval={120000} />

          {/* Title */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Entry title..."
            className="w-full text-xl font-semibold mb-4 bg-transparent outline-none"
            style={{ color: "var(--text-primary)" }}
          />

          {/* Editor */}
          <Editor content={html} onChange={(h) => setHtml(h)} />

          {/* Below editor: mood + voice + actions */}
          <div className="mt-6 space-y-4">
            <MoodWeather
              selected={selectedMood}
              onSelect={setSelectedMood}
              energyLevel={energy}
              onEnergyChange={setEnergy}
            />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <VoiceInput onTranscript={handleVoiceResult} />
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>{wordCount} words</span>
              </div>
              <div className="flex items-center gap-2">
                {activeEntry && (
                  <button onClick={deleteEntry} className="p-2 rounded" title="Delete entry">
                    <Trash2 size={16} style={{ color: "var(--danger)" }} />
                  </button>
                )}
                <button
                  onClick={() => saveEntry(false)}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg text-sm inline-flex items-center gap-1.5"
                  style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
                >
                  <Save size={14} /> {saving ? "Saving..." : "Save Draft"}
                </button>
                <button
                  onClick={() => saveEntry(true)}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg text-sm"
                  style={{ backgroundColor: "var(--accent)", color: "#fff" }}
                >
                  Publish
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
