"use client";

import { useState, useEffect } from "react";
import { faithApi } from "@/lib/api";
import { CheckCircle } from "lucide-react";

export default function FaithPage() {
  const [tradition, setTradition] = useState("");
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const faith = await faithApi.get();
      if (faith) {
        setTradition(faith.faith_tradition || "");
        setNotes(faith.faith_notes || "");
      }
    } catch {}
  };

  const handleSave = async () => {
    try {
      await faithApi.set({ faith_tradition: tradition, faith_notes: notes });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
  };

  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="text-2xl font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
        Faith &amp; Tradition
      </h1>
      <p className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>
        Describe your faith, spiritual tradition, or philosophy in your own words. Like AA, we don&apos;t
        dictate a higher power — that&apos;s your journey. Your AI companion will adapt to speak in a way
        that resonates with you.
      </p>

      {/* Tradition name */}
      <div className="mb-6">
        <label className="text-sm font-medium block mb-2" style={{ color: "var(--text-primary)" }}>
          Your Tradition
        </label>
        <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
          A brief label for your faith, spiritual path, or philosophy.
        </p>
        <input
          type="text"
          value={tradition}
          onChange={(e) => setTradition(e.target.value)}
          placeholder="e.g., Catholic, Buddhist, Stoic, Spiritual but not religious, Secular, etc."
          className="w-full px-3 py-2 rounded-lg text-sm outline-none"
          style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
        />
      </div>

      {/* Personal description */}
      <div className="mb-6">
        <label className="text-sm font-medium block mb-2" style={{ color: "var(--text-primary)" }}>
          Describe Your Faith
        </label>
        <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
          Tell your AI companion about your beliefs, practices, and spiritual journey in your own words.
          This is private and only used to personalize your experience.
        </p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={"Describe your faith, beliefs, practices, or philosophy...\n\ne.g., I attend AA meetings and pray to a Higher Power as I understand Him. I find strength in meditation and the Serenity Prayer."}
          rows={6}
          className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
          style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
        />
      </div>

      <button
        onClick={handleSave}
        className="px-6 py-2.5 rounded-lg text-sm inline-flex items-center gap-2"
        style={{ backgroundColor: "var(--accent)", color: "#fff" }}
      >
        {saved ? (
          <>
            <CheckCircle size={14} /> Saved
          </>
        ) : (
          "Save"
        )}
      </button>
    </div>
  );
}
