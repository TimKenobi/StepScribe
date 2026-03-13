"use client";

import { useState, useEffect } from "react";
import { saveSetting, getSettings } from "@/lib/storage";

export default function SettingsPage() {
  const [aiProvider, setAiProvider] = useState("openai");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const s = getSettings();
    if (s.aiProvider) setAiProvider(s.aiProvider as string);
  }, []);

  const handleSave = () => {
    saveSetting("aiProvider", aiProvider);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
        Settings
      </h1>
      <p className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>
        Configure your journaling companion.
      </p>

      <div className="space-y-6">
        {/* AI Provider */}
        <div className="p-4 rounded-lg border" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)" }}>
          <h3 className="text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>AI Provider</h3>
          <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
            Set in your .env file. Current options: OpenAI, Anthropic, Grok (xAI), Ollama (local), or any OpenAI-compatible endpoint.
          </p>
          <select
            value={aiProvider}
            onChange={(e) => setAiProvider(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
          >
            <option value="openai">OpenAI (GPT-4)</option>
            <option value="anthropic">Anthropic (Claude)</option>
            <option value="grok">Grok (xAI)</option>
            <option value="ollama">Ollama (Local)</option>
            <option value="custom">Custom Endpoint</option>
          </select>
        </div>

        {/* Data */}
        <div className="p-4 rounded-lg border" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)" }}>
          <h3 className="text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>Data &amp; Privacy</h3>
          <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            Your journal data is stored locally in Docker volumes mapped to your machine.
            Nothing leaves your computer unless you choose to use a cloud AI provider.
            For maximum privacy, use Ollama with a local model — your words never leave your machine.
          </p>
        </div>

        {/* About */}
        <div className="p-4 rounded-lg border" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)" }}>
          <h3 className="text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>About StepScribe</h3>
          <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            An AI journaling companion for 12-step recovery and personal growth.
            The AI acts as a wise, compassionate companion — not a therapist, not a chatbot.
            It draws on your faith tradition, Stoic philosophy, the wisdom of your chosen heroes,
            and 12-step principles to help you journal honestly, let go, and grow — one day at a time.
          </p>
        </div>

        <button
          onClick={handleSave}
          className="px-6 py-2.5 rounded-lg text-sm"
          style={{ backgroundColor: "var(--accent)", color: "#fff" }}
        >
          {saved ? "Saved" : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
