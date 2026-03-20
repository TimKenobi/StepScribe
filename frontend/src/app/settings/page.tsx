"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { settingsApi, onboardingApi, ollamaApi } from "@/lib/api";
import {
  Check, Loader2, CheckCircle, XCircle, Trash2, RotateCcw,
  Download, RefreshCw, Server, Sparkles, ExternalLink,
} from "lucide-react";

declare global {
  interface Window {
    stepscribe?: { platform?: string; isDesktop?: boolean; openExternal?: (url: string) => Promise<void> };
  }
}

const PROVIDERS = [
  { key: "grok", label: "Grok (xAI)", url: "https://console.x.ai/", modelDefault: "grok-3",
    models: ["grok-4-1-fast-reasoning", "grok-3", "grok-3-mini", "grok-3-fast", "grok-2", "grok-2-mini"] },
  { key: "openai", label: "OpenAI (GPT-4)", url: "https://platform.openai.com/api-keys", modelDefault: "gpt-4o",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano", "gpt-4-turbo", "gpt-4", "o3", "o3-mini", "o4-mini"] },
  { key: "anthropic", label: "Anthropic (Claude)", url: "https://console.anthropic.com/", modelDefault: "claude-sonnet-4-20250514",
    models: ["claude-sonnet-4-20250514", "claude-opus-4-20250514", "claude-3-7-sonnet-20250219", "claude-3-5-haiku-20241022"] },
  { key: "ollama", label: "Ollama (Local)", url: "https://ollama.ai", modelDefault: "llama3",
    models: [] },
  { key: "custom", label: "Custom Endpoint", url: "", modelDefault: "", models: [] },
];

export default function SettingsPage() {
  const router = useRouter();
  const [aiProvider, setAiProvider] = useState("grok");
  const [apiKey, setApiKey] = useState("");
  const [aiModel, setAiModel] = useState("");
  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434");
  const [customUrl, setCustomUrl] = useState("");
  const [customKey, setCustomKey] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "ok" | "error">("idle");
  const [testMessage, setTestMessage] = useState("");
  const [maskedKeys, setMaskedKeys] = useState<Record<string, string>>({});
  const [resetting, setResetting] = useState(false);

  // Ollama state
  const [ollamaStatus, setOllamaStatus] = useState<"idle" | "checking" | "connected" | "not-running" | "disconnected">("idle");
  const [ollamaVersion, setOllamaVersion] = useState("");
  const [localModels, setLocalModels] = useState<string[]>([]);
  const [recommendedModels, setRecommendedModels] = useState<any[]>([]);
  const [pulling, setPulling] = useState(false);
  const [pullModel, setPullModel] = useState("");
  const [pullProgress, setPullProgress] = useState("");
  const [pullPercent, setPullPercent] = useState(0);
  const [pullDone, setPullDone] = useState(false);
  const [creatingCompanion, setCreatingCompanion] = useState(false);
  const [companionCreated, setCompanionCreated] = useState(false);
  const [installInfo, setInstallInfo] = useState<any>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const c = await settingsApi.getAI();
      if (c.ai_provider) setAiProvider(c.ai_provider);
      // Set model based on active provider only
      if (c.ai_provider === "openai" && c.openai_model) setAiModel(c.openai_model);
      else if (c.ai_provider === "anthropic" && c.anthropic_model) setAiModel(c.anthropic_model);
      else if (c.ai_provider === "grok" && c.grok_model) setAiModel(c.grok_model);
      else if (c.ai_provider === "ollama" && c.ollama_model) setAiModel(c.ollama_model);
      else if (c.ai_provider === "custom" && c.custom_ai_model) setCustomModel(c.custom_ai_model);
      if (c.ollama_base_url) setOllamaUrl(c.ollama_base_url);
      if (c.custom_ai_base_url) setCustomUrl(c.custom_ai_base_url);
      if (c.custom_ai_model) setCustomModel(c.custom_ai_model);
      const masks: Record<string, string> = {};
      if (c.openai_api_key_masked) masks.openai = c.openai_api_key_masked;
      if (c.anthropic_api_key_masked) masks.anthropic = c.anthropic_api_key_masked;
      if (c.grok_api_key_masked) masks.grok = c.grok_api_key_masked;
      if (c.custom_ai_api_key_masked) masks.custom = c.custom_ai_api_key_masked;
      setMaskedKeys(masks);
      // Auto-check Ollama if that's the current provider
      if (c.ai_provider === "ollama") {
        checkOllama();
      }
    } catch {};
  };

  const checkOllama = useCallback(async () => {
    setOllamaStatus("checking");
    // Sync URL and provider to backend so server uses correct settings
    try { await settingsApi.updateAI({ ai_provider: "ollama", ollama_base_url: ollamaUrl }); } catch {}
    let lastStatus: any = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const status = await ollamaApi.status();
        lastStatus = status;
        if (status.reachable) {
          setOllamaStatus("connected");
          setOllamaVersion(status.version);
          const modelsResp = await ollamaApi.models();
          const models = (modelsResp.models || []).map((m: any) => m.name);
          setLocalModels(models);
          // Validate and auto-fix the model selection
          try {
            const validation = await ollamaApi.validateModel();
            if (validation.status === "auto-fixed" || validation.status === "ok") {
              setAiModel(validation.model);
            } else if (validation.status === "no-models" && models.length > 0) {
              const chatModel = models.find((m: string) => !m.includes("embed") && !m.includes("nomic")) || models[0];
              setAiModel(chatModel);
              try { await settingsApi.updateAI({ ai_provider: "ollama", ollama_base_url: ollamaUrl, ollama_model: chatModel }); } catch {}
            }
          } catch {}
          try { const rec = await ollamaApi.recommended(); setRecommendedModels(rec.models || []); } catch {}
          try { setInstallInfo(await ollamaApi.installInstructions()); } catch {}
          return;
        }
        if (attempt < 2) await new Promise(r => setTimeout(r, 2000));
      } catch {
        if (attempt < 2) await new Promise(r => setTimeout(r, 2000));
      }
    }
    // Distinguish "installed but not running" from "not installed"
    setOllamaStatus(lastStatus?.installed ? "not-running" : "disconnected");
    try { setInstallInfo(await ollamaApi.installInstructions()); } catch {}
    try { const rec = await ollamaApi.recommended(); setRecommendedModels(rec.models || []); } catch {}
  }, [ollamaUrl, aiModel]);

  const handlePullModel = async (modelName: string) => {
    setPulling(true); setPullDone(false); setPullModel(modelName);
    setPullProgress("Starting download..."); setPullPercent(0);
    try {
      const resp = await ollamaApi.pull(modelName);
      if (!resp.body) { setPulling(false); return; }
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            setPullProgress(data.status || "");
            if (data.total && data.completed) setPullPercent(Math.round((data.completed / data.total) * 100));
            if (data.status === "success") setPullDone(true);
          } catch {}
        }
      }
      setPullDone(true); setPulling(false);
      await new Promise(r => setTimeout(r, 1000));
      const modelsResp = await ollamaApi.models();
      setLocalModels((modelsResp.models || []).map((m: any) => m.name));
    } catch (e: any) {
      setPullProgress(`Error: ${e.message}`); setPulling(false);
    }
  };

  const handleCreateCompanion = async () => {
    setCreatingCompanion(true); setCompanionCreated(false);
    try {
      const baseModel = aiModel || "llama3";
      const resp = await ollamaApi.createStepCompanion("stepcompanion", baseModel);
      if (!resp.body) { setCreatingCompanion(false); return; }
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try { const data = JSON.parse(line); if (data.status === "success") setCompanionCreated(true); } catch {}
        }
      }
      setCompanionCreated(true); setCreatingCompanion(false);
      await new Promise(r => setTimeout(r, 1000));
      const modelsResp = await ollamaApi.models();
      setLocalModels((modelsResp.models || []).map((m: any) => m.name));
    } catch { setCreatingCompanion(false); }
  };

  const openDownloadPage = () => {
    const url = installInfo?.download_url || "https://ollama.ai/download";
    if (window.stepscribe?.openExternal) {
      window.stepscribe.openExternal(url);
    } else {
      window.open(url, "_blank");
    }
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
    if (!confirm("Reset onboarding? This will clear your faith, about me, and heroes. You will be taken to the setup wizard.")) return;
    setResetting(true);
    try {
      await onboardingApi.complete({
        faith_tradition: "",
        faith_notes: "",
        about_me: "",
        heroes: [],
        reset: true,
      });
      router.push("/setup");
    } catch (e) {
      alert("Failed to reset onboarding.");
      setResetting(false);
    }
  };

  const selectedProvider = PROVIDERS.find((p) => p.key === aiProvider);
  const needsKey = aiProvider !== "ollama" && aiProvider !== "custom";
  const currentMask = maskedKeys[aiProvider];
  const hasCompanion = localModels.some(m => m.toLowerCase().startsWith("stepcompanion"));

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
                  if (p.key !== "ollama") setAiModel(p.modelDefault);
                  setApiKey("");
                  setTestStatus("idle");
                  setTestMessage("");
                  if (p.key === "ollama") checkOllama();
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

          {/* ═══ Ollama Full Management ═══ */}
          {aiProvider === "ollama" && (
            <div className="space-y-4 mb-3">
              {/* Ollama Status */}
              <div className="p-3 rounded-lg border" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)" }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Server size={14} style={{ color: "var(--accent)" }} />
                    <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>Ollama Status</span>
                  </div>
                  <button onClick={() => checkOllama()} className="text-[10px] flex items-center gap-1 px-2 py-1 rounded"
                    style={{ color: "var(--accent)", backgroundColor: "var(--bg-tertiary)" }}>
                    <RefreshCw size={10} /> Recheck
                  </button>
                </div>
                {ollamaStatus === "idle" && (
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>Click Recheck to test connection.</p>
                )}
                {ollamaStatus === "checking" && (
                  <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
                    <Loader2 size={12} className="animate-spin" /> Checking...
                  </div>
                )}
                {ollamaStatus === "connected" && (
                  <div className="flex items-center gap-2 text-xs" style={{ color: "var(--success, #4ade80)" }}>
                    <CheckCircle size={12} /> Connected {ollamaVersion && `(v${ollamaVersion})`}
                    {localModels.length > 0 && <span style={{ color: "var(--text-muted)" }}>&mdash; {localModels.length} model{localModels.length !== 1 ? "s" : ""} installed</span>}
                  </div>
                )}
                {ollamaStatus === "not-running" && (
                  <div>
                    <div className="flex items-center gap-2 text-xs mb-2" style={{ color: "#fbbf24" }}>
                      <XCircle size={12} /> Ollama is installed but not running
                    </div>
                    <p className="text-xs mb-2" style={{ color: "var(--text-secondary)" }}>
                      Please start the Ollama app, then click &quot;Recheck&quot; above.
                    </p>
                    <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                      On macOS: Open Ollama from Applications, or run <code>ollama serve</code> in Terminal.
                    </p>
                  </div>
                )}
                {ollamaStatus === "disconnected" && (
                  <div>
                    <div className="flex items-center gap-2 text-xs mb-2" style={{ color: "#f87171" }}>
                      <XCircle size={12} /> Not connected
                    </div>
                    <div className="p-2.5 rounded-lg" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                      <p className="text-xs mb-2" style={{ color: "var(--text-secondary)" }}>
                        Ollama doesn&apos;t appear to be running. To use local AI:
                      </p>
                      <ol className="text-xs space-y-1 list-decimal list-inside mb-2" style={{ color: "var(--text-muted)" }}>
                        <li>Download and install Ollama from ollama.ai</li>
                        <li>Launch the Ollama app (it runs in the background)</li>
                        <li>Click &quot;Recheck&quot; above</li>
                      </ol>
                      <button onClick={openDownloadPage}
                        className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                        style={{ backgroundColor: "var(--accent)", color: "#fff" }}>
                        <ExternalLink size={12} /> Download Ollama
                      </button>
                      {installInfo?.command && (
                        <div className="mt-2">
                          <p className="text-[10px] mb-1" style={{ color: "var(--text-muted)" }}>Or install via terminal:</p>
                          <code className="block text-[10px] px-2 py-1.5 rounded font-mono select-all" style={{
                            backgroundColor: "var(--bg-primary)", color: "var(--accent)", border: "1px solid var(--border)",
                          }}>{installInfo.command}</code>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Ollama URL */}
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-muted)" }}>Ollama URL</label>
                <input value={ollamaUrl} onChange={(e) => setOllamaUrl(e.target.value)}
                  placeholder="http://localhost:11434"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none font-mono"
                  style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
              </div>

              {/* Active Model selector — uses real installed models */}
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-muted)" }}>Active Model</label>
                {localModels.length > 0 ? (
                  <select value={aiModel} onChange={(e) => setAiModel(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none font-mono appearance-none cursor-pointer"
                    style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
                    {localModels.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                ) : (
                  <div className="px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                    {ollamaStatus === "connected" ? "No models installed — download one below" : "Connect to Ollama to see available models"}
                  </div>
                )}
              </div>

              {/* Download Models Section */}
              {ollamaStatus === "connected" && (
                <div className="p-3 rounded-lg border" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)" }}>
                  <h4 className="text-xs font-medium mb-2 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                    <Download size={12} /> Download Models
                  </h4>
                  <p className="text-[10px] mb-3" style={{ color: "var(--text-muted)" }}>
                    Models optimized for recovery support and therapeutic conversations.
                  </p>
                  <div className="space-y-2">
                    {recommendedModels.map((model: any) => {
                      const isInstalled = localModels.some(m => m.toLowerCase().startsWith(model.name.toLowerCase()));
                      return (
                        <div key={model.name} className="flex items-center justify-between p-2 rounded-lg"
                          style={{ backgroundColor: "var(--bg-secondary)" }}>
                          <div className="flex-1 min-w-0 mr-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>
                                {model.label || model.name}
                              </span>
                              {isInstalled && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0" style={{ backgroundColor: "var(--success, #4ade80)", color: "#000" }}>installed</span>
                              )}
                            </div>
                            <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>
                              {model.description} {model.size && `\u2022 ${model.size}`}
                            </p>
                          </div>
                          {!isInstalled && (
                            <button
                              onClick={() => handlePullModel(model.name)}
                              disabled={pulling}
                              className="text-[10px] px-2.5 py-1 rounded shrink-0 flex items-center gap-1"
                              style={{ backgroundColor: "var(--accent)", color: "#fff", opacity: pulling ? 0.5 : 1 }}>
                              <Download size={10} /> Pull
                            </button>
                          )}
                          {isInstalled && aiModel !== model.name && (
                            <button
                              onClick={() => {
                                const found = localModels.find(m => m.toLowerCase().startsWith(model.name.toLowerCase()));
                                if (found) setAiModel(found);
                              }}
                              className="text-[10px] px-2.5 py-1 rounded shrink-0"
                              style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--accent)", border: "1px solid var(--accent)" }}>
                              Use
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Custom model pull */}
                  <div className="mt-3 flex gap-2">
                    <input
                      value={pullModel}
                      onChange={(e) => setPullModel(e.target.value)}
                      placeholder="Or enter any model name (e.g. phi4)"
                      disabled={pulling}
                      className="flex-1 px-2.5 py-1.5 rounded-lg text-xs outline-none font-mono"
                      style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                    />
                    <button
                      onClick={() => pullModel && handlePullModel(pullModel)}
                      disabled={pulling || !pullModel}
                      className="text-[10px] px-3 py-1.5 rounded-lg flex items-center gap-1 shrink-0"
                      style={{ backgroundColor: "var(--accent)", color: "#fff", opacity: pulling || !pullModel ? 0.5 : 1 }}>
                      <Download size={10} /> Pull
                    </button>
                  </div>

                  {/* Pull progress */}
                  {pulling && (
                    <div className="mt-2">
                      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${pullPercent}%`, backgroundColor: "var(--accent)" }} />
                      </div>
                      <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                        {pullProgress} {pullPercent > 0 && `(${pullPercent}%)`}
                      </p>
                    </div>
                  )}
                  {pullDone && !pulling && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs" style={{ color: "var(--success, #4ade80)" }}>
                      <CheckCircle size={12} /> Model downloaded successfully
                    </div>
                  )}
                </div>
              )}

              {/* StepCompanion Creation */}
              {ollamaStatus === "connected" && localModels.length > 0 && (
                <div className="p-3 rounded-lg border" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)" }}>
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles size={14} style={{ color: "var(--accent)" }} />
                    <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>StepCompanion</span>
                    {hasCompanion && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--success, #4ade80)", color: "#000" }}>created</span>
                    )}
                  </div>
                  <p className="text-[10px] mb-2" style={{ color: "var(--text-muted)" }}>
                    A customized model with 12-step recovery knowledge, Big Book principles, and crisis-aware boundaries.
                    Built on top of your selected active model.
                  </p>
                  {!hasCompanion && (
                    <button onClick={handleCreateCompanion} disabled={creatingCompanion}
                      className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5"
                      style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--accent)", border: "1px solid var(--accent)", opacity: creatingCompanion ? 0.6 : 1 }}>
                      {creatingCompanion ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                      {creatingCompanion ? "Creating..." : "Create StepCompanion"}
                    </button>
                  )}
                  {companionCreated && (
                    <div className="flex items-center gap-1.5 text-xs mt-1" style={{ color: "var(--success, #4ade80)" }}>
                      <CheckCircle size={12} /> StepCompanion created! Select it from the Active Model dropdown above.
                    </div>
                  )}
                </div>
              )}
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
            Your journal data is stored locally on your machine.
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
