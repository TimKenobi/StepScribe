"use client";

import { useState, useEffect } from "react";
import { faithApi } from "@/lib/api";
import type { FaithTradition, UserFaith } from "@/lib/types";
import { Check } from "lucide-react";

export default function FaithPage() {
  const [traditions, setTraditions] = useState<Record<string, FaithTradition>>({});
  const [current, setCurrent] = useState<UserFaith | null>(null);
  const [selected, setSelected] = useState("");
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [trads, faith] = await Promise.all([
        faithApi.traditions(),
        faithApi.get(),
      ]);
      setTraditions(trads);
      if (faith) {
        setCurrent(faith);
        setSelected(faith.faith_tradition);
        setNotes(faith.faith_notes);
      }
    } catch {}
  };

  const handleSave = async () => {
    try {
      await faithApi.set({ faith_tradition: selected, faith_notes: notes });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      loadData();
    } catch {}
  };

  const tradEntries = Object.entries(traditions);

  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="text-2xl font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
        Faith &amp; Tradition
      </h1>
      <p className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>
        Your faith tradition shapes how your AI companion speaks with you. It will draw on the
        language, wisdom, and practices of your tradition — respectfully and naturally.
      </p>

      {/* Current tradition */}
      {current && (
        <div className="mb-8 p-4 rounded-lg border" style={{ borderColor: "var(--accent)", backgroundColor: "var(--bg-secondary)" }}>
          <div className="text-sm font-medium" style={{ color: "var(--accent)" }}>
            Current: {current.tradition_label}
          </div>
          <p className="text-xs mt-1 mb-3" style={{ color: "var(--text-secondary)" }}>
            {current.tradition_description}
          </p>
          {current.figures.length > 0 && (
            <div className="mb-2">
              <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Figures: </span>
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {current.figures.join(", ")}
              </span>
            </div>
          )}
          {current.practices.length > 0 && (
            <div>
              <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Practices: </span>
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {current.practices.join(", ")}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Tradition picker */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        {tradEntries.map(([key, trad]) => (
          <button
            key={key}
            onClick={() => setSelected(key)}
            className="text-left p-4 rounded-lg border transition-colors"
            style={{
              borderColor: selected === key ? "var(--accent)" : "var(--border)",
              backgroundColor: selected === key ? "var(--bg-tertiary)" : "var(--bg-secondary)",
            }}
          >
            <div className="flex items-center gap-2">
              <div className="text-sm font-medium" style={{ color: selected === key ? "var(--accent)" : "var(--text-primary)" }}>
                {trad.label}
              </div>
              {selected === key && <Check size={14} style={{ color: "var(--accent)" }} />}
            </div>
            <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {trad.description}
            </p>
          </button>
        ))}
      </div>

      {/* Personal notes */}
      <div className="mb-6">
        <label className="text-sm font-medium block mb-2" style={{ color: "var(--text-primary)" }}>
          Personal Notes
        </label>
        <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
          Anything you want the AI to know about your faith journey. This is private and only used to
          personalize your experience.
        </p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g., I attend the Traditional Latin Mass, I'm devoted to the Sacred Heart, I pray the Rosary daily..."
          rows={3}
          className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
          style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
        />
      </div>

      <button
        onClick={handleSave}
        className="px-6 py-2.5 rounded-lg text-sm"
        style={{ backgroundColor: "var(--accent)", color: "#fff" }}
      >
        {saved ? "Saved" : "Save Tradition"}
      </button>
    </div>
  );
}
