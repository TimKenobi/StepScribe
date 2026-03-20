"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Pencil, Trash2, Check, X } from "lucide-react";
import MoodWeather from "@/components/MoodWeather";
import { moodApi } from "@/lib/api";
import { MoodEntry, WEATHER_OPTIONS, WEATHER_COLORS } from "@/lib/types";

// Parse server datetime (UTC without Z suffix) to local Date
function parseUTCDate(isoStr: string): Date {
  // Ensure UTC interpretation by appending Z if missing
  const s = isoStr.endsWith("Z") ? isoStr : isoStr + "Z";
  return new Date(s);
}

export default function MoodPage() {
  const [history, setHistory] = useState<MoodEntry[]>([]);
  const [selectedMood, setSelectedMood] = useState("");
  const [energyLevel, setEnergyLevel] = useState(5);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editWeather, setEditWeather] = useState("");
  const [editEnergy, setEditEnergy] = useState(5);
  const [editNote, setEditNote] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const data = await moodApi.history();
      setHistory(data);
    } catch {}
  };

  const saveMood = async () => {
    if (!selectedMood) return;
    setSaving(true);
    try {
      await moodApi.create({ weather: selectedMood, energy_level: energyLevel, note });
      setSelectedMood("");
      setNote("");
      setEnergyLevel(5);
      loadHistory();
    } catch {}
    setSaving(false);
  };

  const startEdit = (mood: MoodEntry) => {
    setEditingId(mood.id);
    setEditWeather(mood.weather);
    setEditEnergy(mood.energy_level);
    setEditNote(mood.note || "");
    setDeleteConfirmId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditWeather("");
    setEditEnergy(5);
    setEditNote("");
  };

  const saveEdit = async () => {
    if (!editingId || !editWeather) return;
    setEditSaving(true);
    try {
      await moodApi.update(editingId, { weather: editWeather, energy_level: editEnergy, note: editNote });
      setEditingId(null);
      loadHistory();
    } catch {}
    setEditSaving(false);
  };

  const deleteMood = async (id: string) => {
    try {
      await moodApi.delete(id);
      setDeleteConfirmId(null);
      loadHistory();
    } catch {}
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-2xl font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
        Inner Weather
      </h1>
      <p className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>
        Check in with yourself. No right answers — just honest ones.
      </p>

      {/* Mood selector */}
      <MoodWeather
        selected={selectedMood}
        onSelect={setSelectedMood}
        energyLevel={energyLevel}
        onEnergyChange={setEnergyLevel}
      />

      {/* Optional note */}
      {selectedMood && (
        <div className="mt-6">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Anything you want to add about how you're feeling? (optional)"
            rows={3}
            className="w-full px-4 py-3 rounded-lg text-sm outline-none resize-none"
            style={{
              backgroundColor: "var(--bg-secondary)",
              color: "var(--text-primary)",
              border: "1px solid var(--border)",
            }}
          />
          <button
            onClick={saveMood}
            disabled={saving}
            className="mt-3 px-6 py-2.5 rounded-lg text-sm"
            style={{ backgroundColor: "var(--accent)", color: "#fff" }}
          >
            {saving ? "Saving..." : "Log Today's Weather"}
          </button>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="mt-12">
          <h2 className="text-lg font-medium mb-4" style={{ color: "var(--text-primary)" }}>
            Weather History
          </h2>
          <div className="space-y-3">
            {history.map((mood) => (
              <div key={mood.id}>
                {editingId === mood.id ? (
                  /* Inline edit mode */
                  <div className="p-4 rounded-lg border space-y-3"
                    style={{ borderColor: "var(--accent)", backgroundColor: "var(--bg-secondary)" }}>
                    <MoodWeather selected={editWeather} onSelect={setEditWeather}
                      energyLevel={editEnergy} onEnergyChange={setEditEnergy} />
                    <textarea value={editNote} onChange={(e) => setEditNote(e.target.value)}
                      placeholder="Note (optional)" rows={2}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
                      style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
                    <div className="flex items-center gap-2">
                      <button onClick={saveEdit} disabled={editSaving}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs"
                        style={{ backgroundColor: "var(--accent)", color: "#fff" }}>
                        <Check size={12} /> {editSaving ? "Saving..." : "Save"}
                      </button>
                      <button onClick={cancelEdit}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs"
                        style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-secondary)" }}>
                        <X size={12} /> Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Normal display mode */
                  <div className="flex items-center gap-4 p-4 rounded-lg border"
                    style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)" }}>
                    <div className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: WEATHER_COLORS[mood.weather] || "var(--text-muted)" }} />
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                          {WEATHER_OPTIONS[mood.weather]?.label || mood.weather}
                        </span>
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                          Energy: {mood.energy_level}/10
                        </span>
                      </div>
                      {mood.note && (
                        <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>{mood.note}</p>
                      )}
                    </div>
                    <span className="text-xs flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                      {format(parseUTCDate(mood.created_at), "MMM d")}
                    </span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => startEdit(mood)} className="p-1.5 rounded transition-colors hover:bg-black/10"
                        title="Edit" style={{ color: "var(--text-muted)" }}>
                        <Pencil size={13} />
                      </button>
                      {deleteConfirmId === mood.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => deleteMood(mood.id)}
                            className="px-2 py-1 rounded text-[10px]"
                            style={{ backgroundColor: "var(--danger)", color: "#fff" }}>Delete</button>
                          <button onClick={() => setDeleteConfirmId(null)}
                            className="px-2 py-1 rounded text-[10px]"
                            style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-secondary)" }}>No</button>
                        </div>
                      ) : (
                        <button onClick={() => setDeleteConfirmId(mood.id)} className="p-1.5 rounded transition-colors hover:bg-black/10"
                          title="Delete" style={{ color: "var(--text-muted)" }}>
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
