"use client";

import { useState, useEffect } from "react";
import { settingsApi, onboardingApi } from "@/lib/api";
import { Check, Loader2, CheckCircle, XCircle, Trash2, RotateCcw } from "lucide-react";

const PROVIDERS = [
  { key: "grok", label: "Grok (xAI)", url: "https://console.x.ai/", modelDefault: "grok-3",
    models: ["grok-4-1-fast-reasoning", "grok-3", "grok-3-mini", "grok-3-fast", "grok-2", "grok-2-mini"] },
  { key: "openai", label: "OpenAI (GPT-4)", url: "https://platform.openai.com/api-keys", modelDefault: "gpt-4o",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano", "gpt-4-turbo", "gpt-4", "o3", "o3-mini", "o4-mini"] },
  { key: "anthropic", label: "Anthropic (Claude)", url: "https://console.anthropic.com/", modelDefault: "claude-sonnet-4-20250514",
    models: ["claude-sonnet-4-20250514", "claude-opus-4-20250514", "claude-3-7-sonnet-20250219", "claude-3-5-haiku-20241022"] },
  { key: "ollama", label: "Ollama (Local)", url: "https://ollama.ai", modelDefault: "llama3",
    models: ["llama3", "llama3.3", "llama3.1", "llama3.2", "mistral", "mixtral", "gemma2", "gemma3", "qwen2.5", "phi3", "deepseek-r1", "command-r"] },
  { key: "custom", label: "Custom Endpoint", url: "", modelDefault: "", models: [] },
];

export default function SettingsPage() {
  const [aiProvider, setAiProvider] = useState("grok");
  const [apiKey, setApiKey] = useState("");
  const [aiModel, setAiModel] = useState("");
  const [ollamaUrl, setOllamaUrl] = useState("http://host.docker.internal:11434");
  const [customUrl, setCustomUrl] = useState("");
  const [customKey, setCustomKey] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "ok" | "error">("idle");
  const [testMessage, setTestMessage] = useState("");
  const [maskedKeys, setMaskedKeys] = useState<Record<string, string>>({});
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const c = await settingsApi.getAI();
      if (c.ai_provider) setAiProvider(c.ai_provider);
      if (c.openai_model) setAiModel(c.openai_model);
      if (c.anthropic_model) setAiModel(c.anthropic_model);
      if (c.grok_model) setAiModel(c.grok_model);
      if (c.ollama_model) setAiModel(c.ollama_model);
      if (c.ollama_base_url) setOllamaUrl(c.ollama_base_url);
      if (c.custom_ai_base_url) setCustomUrl(c.custom_ai_base_url);
      if (c.custom_ai_model) setCustomModel(c.custom_ai_model);
      // Collect masked keys for display
      const masks: Record<string, string> = {};
      if (c.openai_api_key_masked) masks.openai = c.openai_api_key_masked;
      if (c.anthropic_api_key_masked) masks.anthropic = c.anthropic_api_key_masked;
      if (c.grok_api_key_masked) masks.grok = c.grok_api_key_masked;
      if (c.custom_ai_api_key_masked) masks.custom = c.custom_ai_api_key_masked;
      setMaskedKeys(masks);
    } catch {}
  };

  const buildPayload = (): Record<string, string> => {
    const data: Record<string, string> = { ai_provider: aiProvider };
    if (aiProvider === "openai") {
      if (apiKey) data.openai_api_key = apiKey;
      if (aiModel) data.openai_model = aiModel;
    } else if (aiProvider === "anthropic") {
      if (apiKey) data.anthropic_api_key = apiKey;
      if (aiModel) data.anthropic_model = aiModel;
    } else if (aiProvider === "grok") {
      if (apiKey) data.grok_api_key = apiKey;
      if (aiModel) data.grok_model = aiModel;
    } else if (aiProvider === "ollama") {
      data.ollama_base_url = ollamaUrl;
      if (aiModel) data.ollama_model = aiModel;
    } else if (aiProvider === "custom") {
      data.custom_ai_base_url = customUrl;
      if (customKey) data.custom_ai_api_key = customKey;
      if (customModel) data.custom_ai_model = customModel;
    }
    return data;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await settingsApi.updateAI(buildPayload());
      setSaved(true);
      setApiKey("");
      setCustomKey("");
      await loadConfig();
      setTimeout(() => setSaved(false), 2000);
    } catch {} finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    setTestStatus("testing");
    setTestMessage("");
    try {
      await settingsApi.updateAI(buildPayload());
      const r = await settingsApi.testAI();
      if (r.status === "ok") {
        setTestStatus("ok");
        setTestMessage(r.message || "Connection successful!");
      } else {
        setTestStatus("error");
        setTestMessage(r.message || "Connection failed.");
      }
    } catch (e: any) {
      setTestStatus("error");
      setTestMessage(e.message || "Could not connect.");
    }
  };

  const resetOnboarding = async () => {
    if (!confirm("Reset onboarding? This will clear your faith, about me, and heroes. You will be taken back to the setup wizard on next visit.")) return;
    setResetting(true);
    try {
      await onboardingApi.complete({
        faith_tradition: "",
        faith_notes: "",
        about_me: "",
        heroes: [],
        reset: true,
      });
      alert("Onboarding has been reset. Refresh the page to start the setup wizard again.");
    } catch (e) {
      alert("Failed to reset onboarding.");
    } finally {
      setResetting(false);
    }
  };

  const selectedProvider = PROVIDERS.find((p) => p.key === aiProvider);
  const needsKey = aiProvider !== "ollama" && aiProvider !== "custom";
  const currentMask = maskedKeys[aiProvider];

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
        Settings
      </h1>
      <p className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>
        Configure your journaling companion.
      </p>

      <div className="space-y-6">
        {/* AI Provider Selection */}
        <div className="p-4 rounded-lg border" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)" }}>
          <h3 className="text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>AI Provider</h3>
          <div className="space-y-2 mb-4">
            {PROVIDERS.map((p) => (
              <button
                key={p.key}
                onClick={() => {
                  setAiProvider(p.key);
                  setAiModel(p.modelDefault);
                  setApiKey("");
                  setTestStatus("idle");
                  setTestMessage("");
                }}
                className="w-full text-left p-3 rounded-lg border transition-colors"
                style={{
                  borderColor: aiProvider === p.key ? "var(--accent)" : "var(--border)",
                  backgroundColor: aiProvider === p.key ? "var(--bg-tertiary)" : "var(--bg-primary)",
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium" style={{ color: aiProvider === p.key ? "var(--accent)" : "var(--text-primary)" }}>
                    {p.label}
                  </span>
                  {aiProvider === p.key && <Check size={14} style={{ color: "var(--accent)" }} />}
                  {maskedKeys[p.key] && (
                    <span className="text-xs px-1.5 py-0.5 rounded ml-auto"
                      style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-muted)" }}>
                      key set
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* API Key input */}
          {needsKey && (
            <div className="mb-3">
              <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-muted)" }}>
                API Key
                {selectedProvider?.url && (
                  <a href={selectedProvider.url} target="_blank" rel="noopener noreferrer"
                     className="ml-2 underline" style={{ color: "var(--accent)" }}>
                    Get one here
                  </a>
                )}
              </label>
              {currentMask && !apiKey && (
                <p className="text-xs mb-1 font-mono" style={{ color: "var(--text-muted)" }}>
                  Current: {currentMask}
                </p>
              )}
              <input
                type="password"
                value={apiKey}
                onChange={(e) => { setApiKey(e.target.value); setTestStatus("idle"); }}
                placeholder={currentMask ? "Enter new key to change" : `Paste your ${selectedProvider?.label || ""} API key`}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none font-mono"
                style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
              />
            </div>
          )}

          {/* Ollama config */}
          {aiProvider === "ollama" && (
            <div className="space-y-3 mb-3">
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-muted)" }}>Ollama URL</label>
                <input value={ollamaUrl} onChange={(e) => setOllamaUrl(e.target.value)}
                  placeholder="http://host.docker.internal:11434"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none font-mono"
                  style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-muted)" }}>Model</label>
                <select value={aiModel} onChange={(e) => setAiModel(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none font-mono appearance-none cursor-pointer"
                  style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
                  {(selectedProvider?.models || []).map((m: string) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Custom endpoint config */}
          {aiProvider === "custom" && (
            <div className="space-y-3 mb-3">
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-muted)" }}>Base URL</label>
                <input value={customUrl} onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="http://localhost:1234/v1"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none font-mono"
                  style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-muted)" }}>API Key (if required)</label>
                <input type="password" value={customKey} onChange={(e) => setCustomKey(e.target.value)}
                  placeholder="Optional"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none font-mono"
                  style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-muted)" }}>Model name</label>
                <input value={customModel} onChange={(e) => setCustomModel(e.target.value)}
                  placeholder="model-name"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none font-mono"
                  style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
              </div>
            </div>
          )}

          {/* Model field for key-based providers */}
          {needsKey && (
            <div className="mb-3">
              <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-muted)" }}>Model</label>
              <select value={aiModel} onChange={(e) => setAiModel(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none font-mono appearance-none cursor-pointer"
                style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
                {(selectedProvider?.models || []).map((m: string) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          )}

          {/* Test + Save */}
          <div className="flex gap-3 mt-4">
            <button onClick={testConnection} disabled={testStatus === "testing"}
              className="px-4 py-2 rounded-lg text-sm flex items-center gap-2"
              style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-primary)", border: "1px solid var(--border)",
                       opacity: testStatus === "testing" ? 0.6 : 1 }}>
              {testStatus === "testing" && <Loader2 size={14} className="animate-spin" />}
              {testStatus === "ok" && <CheckCircle size={14} style={{ color: "var(--success, #4ade80)" }} />}
              {testStatus === "error" && <XCircle size={14} style={{ color: "#f87171" }} />}
              {testStatus === "testing" ? "Testing..." : "Test Connection"}
            </button>
            <button onClick={handleSave} disabled={saving}
              className="px-6 py-2 rounded-lg text-sm"
              style={{ backgroundColor: "var(--accent)", color: "#fff", opacity: saving ? 0.7 : 1 }}>
              {saved ? "Saved!" : saving ? "Saving..." : "Save"}
            </button>
          </div>
          {testMessage && (
            <p className="text-xs mt-2" style={{ color: testStatus === "ok" ? "var(--success, #4ade80)" : "#f87171" }}>
              {testMessage}
            </p>
          )}
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

        {/* Danger Zone */}
        <div className="p-4 rounded-lg border border-red-500/30" style={{ backgroundColor: "var(--bg-secondary)" }}>
          <h3 className="text-sm font-medium mb-3 flex items-center gap-2" style={{ color: "#f87171" }}>
            <Trash2 size={16} /> Danger Zone
          </h3>
          <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
            These actions cannot be undone easily. Use with caution.
          </p>
          <button
            onClick={resetOnboarding}
            disabled={resetting}
            className="w-full py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 border border-red-500/50 hover:bg-red-500/10"
            style={{ color: "#f87171" }}
          >
            {resetting ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
            {resetting ? "Resetting..." : "Reset Onboarding"}
          </button>
        </div>
      </div>
    </div>
  );
}
