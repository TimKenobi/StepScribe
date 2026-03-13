"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import MoodWeather from "@/components/MoodWeather";
import { moodApi } from "@/lib/api";
import { MoodEntry, WEATHER_OPTIONS, WEATHER_COLORS } from "@/lib/types";

export default function MoodPage() {
  const [history, setHistory] = useState<MoodEntry[]>([]);
  const [selectedMood, setSelectedMood] = useState("");
  const [energyLevel, setEnergyLevel] = useState(5);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

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
              <div
                key={mood.id}
                className="flex items-center gap-4 p-4 rounded-lg border"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)" }}
              >
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: WEATHER_COLORS[mood.weather] || "var(--text-muted)" }}
                />
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
                    <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                      {mood.note}
                    </p>
                  )}
                </div>
                <span className="text-xs flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                  {format(new Date(mood.created_at), "MMM d")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
