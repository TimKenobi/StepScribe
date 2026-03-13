"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { faithApi, heroesApi, onboardingApi, settingsApi } from "@/lib/api";
import type { FaithTradition } from "@/lib/types";
import { Check, ChevronRight, ChevronLeft, Flame, User, Cpu, Loader2, CheckCircle, XCircle } from "lucide-react";
import confetti from "canvas-confetti";

const PROVIDERS = [
  { key: "grok", label: "Grok (xAI)", desc: "Fast, witty, excellent reasoning. Recommended.", url: "https://console.x.ai/", modelDefault: "grok-3",
    models: ["grok-4-1-fast-reasoning", "grok-3", "grok-3-mini", "grok-3-fast", "grok-2", "grok-2-mini"] },
  { key: "openai", label: "OpenAI (GPT-4)", desc: "Industry standard. Reliable and versatile.", url: "https://platform.openai.com/api-keys", modelDefault: "gpt-4o",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano", "gpt-4-turbo", "gpt-4", "o3", "o3-mini", "o4-mini"] },
  { key: "anthropic", label: "Anthropic (Claude)", desc: "Deep, thoughtful, careful reasoning.", url: "https://console.anthropic.com/", modelDefault: "claude-sonnet-4-20250514",
    models: ["claude-sonnet-4-20250514", "claude-opus-4-20250514", "claude-3-7-sonnet-20250219", "claude-3-5-haiku-20241022"] },
  { key: "ollama", label: "Ollama (Local)", desc: "Run models on your machine. 100% private — nothing leaves your computer.", url: "https://ollama.ai", modelDefault: "llama3",
    models: ["llama3", "llama3.3", "llama3.1", "llama3.2", "mistral", "mixtral", "gemma2", "gemma3", "qwen2.5", "phi3", "deepseek-r1", "command-r"] },
  { key: "custom", label: "Custom Endpoint", desc: "Any OpenAI-compatible API (LM Studio, vLLM, etc).", url: "", modelDefault: "", models: [] },
];

export default function SetupPage() {
  const router = useRouter();
  // Steps: 0=welcome, 1=AI config, 2=faith, 3=about, 4=heroes, 5=done
  const [step, setStep] = useState(0);
  const [traditions, setTraditions] = useState<Record<string, FaithTradition>>({});
  const [selectedFaith, setSelectedFaith] = useState("");
  const [faithNotes, setFaithNotes] = useState("");
  const [aboutMe, setAboutMe] = useState("");
  const [heroes, setHeroes] = useState<Array<{ name: string; description: string; selected: boolean }>>([]);
  const [customHero, setCustomHero] = useState("");
  const [suggestedFigures, setSuggestedFigures] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // AI config state
  const [aiProvider, setAiProvider] = useState("grok");
  const [apiKey, setApiKey] = useState("");
  const [aiModel, setAiModel] = useState("");
  const [ollamaUrl, setOllamaUrl] = useState("http://host.docker.internal:11434");
  const [customUrl, setCustomUrl] = useState("");
  const [customKey, setCustomKey] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "ok" | "error">("idle");
  const [testMessage, setTestMessage] = useState("");
  const [aiConfigLoaded, setAiConfigLoaded] = useState(false);

  useEffect(() => {
    checkStatus();
    loadTraditions();
    loadDefaultHeroes();
    loadAIConfig();
  }, []);

  // Success celebration when reaching done step
  useEffect(() => {
    if (step === 5) {
      const duration = 2500;
      const end = Date.now() + duration;
      const colors = ['#22c55e', '#eab308', '#a855f7', '#3b82f6', 'var(--accent)'];

      const frame = () => {
        confetti({
          particleCount: 7,
          angle: 60,
          spread: 55,
          origin: { x: 0.2 },
          colors,
        });
        confetti({
          particleCount: 7,
          angle: 120,
          spread: 55,
          origin: { x: 0.8 },
          colors,
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };

      frame();
    }
  }, [step]);

  const loadAIConfig = async () => {
    try {
      const config = await settingsApi.getAI();
      if (config.ai_provider) setAiProvider(config.ai_provider);
      if (config.openai_model) setAiModel(config.openai_model);
      if (config.grok_model) setAiModel(config.grok_model);
      if (config.anthropic_model) setAiModel(config.anthropic_model);
      if (config.ollama_base_url) setOllamaUrl(config.ollama_base_url);
      if (config.ollama_model) setAiModel(config.ollama_model);
      if (config.custom_ai_base_url) setCustomUrl(config.custom_ai_base_url);
      if (config.custom_ai_model) setCustomModel(config.custom_ai_model);
      // If they already have a key set from .env, mark as loaded
      if (config.provider_ready) {
        setTestStatus("ok");
        setTestMessage("AI provider already configured.");
      }
      setAiConfigLoaded(true);
    } catch {
      setAiConfigLoaded(true);
    }
  };

  const loadDefaultHeroes = async () => {
    try {
      const defaults = await heroesApi.defaults();
      setHeroes(defaults.map((h: any) => ({ name: h.name, description: h.description, selected: true })));
    } catch {
      setHeroes([
        { name: "St. Augustine", description: "Doctor of the Church. Wrote the Confessions.", selected: true },
        { name: "G.K. Chesterton", description: "Catholic convert, writer, and apologist.", selected: true },
        { name: "Matt Talbot", description: "Patron of addiction recovery.", selected: true },
      ]);
    }
  };

  const checkStatus = async () => {
    try {
      const status = await onboardingApi.status();
      if (status.onboarding_complete) {
        router.push("/");
      }
    } catch {}
  };

  const loadTraditions = async () => {
    try {
      const trads = await faithApi.traditions();
      setTraditions(trads);
    } catch {}
  };

  const saveAIConfig = async () => {
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

    await settingsApi.updateAI(data);
  };

  const testConnection = async () => {
    setTestStatus("testing");
    setTestMessage("");
    try {
      await saveAIConfig();
      const result = await settingsApi.testAI();
      if (result.status === "ok") {
        setTestStatus("ok");
        setTestMessage(result.message || "Connection successful!");
      } else {
        setTestStatus("error");
        setTestMessage(result.message || "Connection failed.");
      }
    } catch (e: any) {
      setTestStatus("error");
      setTestMessage(e.message || "Could not connect.");
    }
  };

  const handleAINext = async () => {
    await saveAIConfig();
    setStep(2);
  };

  const toggleHero = (index: number) => {
    setHeroes((prev) => prev.map((h, i) => (i === index ? { ...h, selected: !h.selected } : h)));
  };

  const addCustomHero = () => {
    if (!customHero.trim()) return;
    setHeroes((prev) => [...prev, { name: customHero, description: "", selected: true }]);
    setCustomHero("");
  };

  const addSuggestedFigure = async (name: string) => {
    if (heroes.some((h) => h.name === name)) return;
    setHeroes((prev) => [...prev, { name, description: "", selected: true }]);
    setSuggestedFigures((prev) => prev.filter((f) => f !== name));
    try {
      await heroesApi.add({ user_id: "default", name, description: "" });
    } catch {}
  };

  const completeOnboarding = async () => {
    setLoading(true);
    try {
      const selectedHeroes = heroes.filter((h) => h.selected).map(({ name, description }) => ({ name, description }));
      const result = await onboardingApi.complete({
        faith_tradition: selectedFaith,
        faith_notes: faithNotes,
        about_me: aboutMe,
        heroes: selectedHeroes,
      });
      if (result.suggested_figures?.length > 0) {
        setSuggestedFigures(result.suggested_figures.filter((f: string) => !heroes.some((h) => h.name === f)));
      }
      setStep(5);
    } catch {
      setStep(5);
    } finally {
      setLoading(false);
    }
  };

  const selectedProvider = PROVIDERS.find((p) => p.key === aiProvider);
  const tradEntries = Object.entries(traditions);
  const needsKey = aiProvider !== "ollama" && aiProvider !== "custom";

  return (
    <div className="min-h-screen flex items-center justify-center p-8" style={{ backgroundColor: "var(--bg-primary)" }}>
      <div className="max-w-xl w-full">

        {/* ═══ Step 0: Welcome ═══ */}
        {step === 0 && (
          <div className="text-center">
            <div className="mb-6 flex justify-center">
              <Flame size={48} style={{ color: "var(--accent)" }} />
            </div>
            <h1 className="text-3xl font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
              Welcome to StepScribe
            </h1>
            <p className="text-sm mb-2" style={{ color: "var(--text-secondary)" }}>
              A journaling companion for the road of recovery.
            </p>
            <p className="text-xs mb-8 leading-relaxed max-w-md mx-auto" style={{ color: "var(--text-muted)" }}>
              Let&apos;s set up a few things so your AI companion can speak your language —
              your faith, your heroes, your way. This only takes a minute.
            </p>
            <button
              onClick={() => setStep(1)}
              className="px-8 py-3 rounded-lg text-sm font-medium inline-flex items-center gap-2"
              style={{ backgroundColor: "var(--accent)", color: "#fff" }}
            >
              Get Started <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* ═══ Step 1: AI Provider & API Key ═══ */}
        {step === 1 && (
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Cpu size={24} style={{ color: "var(--accent)" }} />
              <h2 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
                Connect Your AI
              </h2>
            </div>
            <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
              StepScribe needs an AI provider to power your companion. Choose one and enter your API key.
              {aiConfigLoaded && testStatus === "ok" && (
                <span className="block mt-1 text-xs" style={{ color: "var(--success, #4ade80)" }}>
                  A provider is already configured from your .env file. You can keep it or change it below.
                </span>
              )}
            </p>

            {/* Provider selection */}
            <div className="space-y-2 mb-6">
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
                    backgroundColor: aiProvider === p.key ? "var(--bg-tertiary)" : "var(--bg-secondary)",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium" style={{ color: aiProvider === p.key ? "var(--accent)" : "var(--text-primary)" }}>
                      {p.label}
                    </span>
                    {aiProvider === p.key && <Check size={14} style={{ color: "var(--accent)" }} />}
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{p.desc}</p>
                </button>
              ))}
            </div>

            {/* API Key input */}
            {needsKey && (
              <div className="mb-4">
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-muted)" }}>
                  API Key
                  {selectedProvider?.url && (
                    <a href={selectedProvider.url} target="_blank" rel="noopener noreferrer"
                       className="ml-2 underline" style={{ color: "var(--accent)" }}>
                      Get one here
                    </a>
                  )}
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => { setApiKey(e.target.value); setTestStatus("idle"); }}
                  placeholder={`Paste your ${selectedProvider?.label || ""} API key`}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none font-mono"
                  style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                />
              </div>
            )}

            {/* Ollama URL */}
            {aiProvider === "ollama" && (
              <div className="mb-4 space-y-3">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-muted)" }}>Ollama URL</label>
                  <input
                    value={ollamaUrl}
                    onChange={(e) => setOllamaUrl(e.target.value)}
                    placeholder="http://host.docker.internal:11434"
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none font-mono"
                    style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-muted)" }}>Model</label>
                  <select
                    value={aiModel}
                    onChange={(e) => setAiModel(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none font-mono appearance-none cursor-pointer"
                    style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                  >
                    {(selectedProvider?.models || []).map((m: string) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Custom endpoint */}
            {aiProvider === "custom" && (
              <div className="mb-4 space-y-3">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-muted)" }}>Base URL</label>
                  <input
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    placeholder="http://localhost:1234/v1"
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none font-mono"
                    style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-muted)" }}>API Key (if required)</label>
                  <input
                    type="password"
                    value={customKey}
                    onChange={(e) => setCustomKey(e.target.value)}
                    placeholder="Optional"
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none font-mono"
                    style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-muted)" }}>Model name</label>
                  <input
                    value={customModel}
                    onChange={(e) => setCustomModel(e.target.value)}
                    placeholder="model-name"
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none font-mono"
                    style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                  />
                </div>
              </div>
            )}

            {/* Model field for key-based providers */}
            {needsKey && (
              <div className="mb-4">
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-muted)" }}>Model</label>
                <select
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none font-mono appearance-none cursor-pointer"
                  style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                >
                  {(selectedProvider?.models || []).map((m: string) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Test connection button */}
            <button
              onClick={testConnection}
              disabled={testStatus === "testing"}
              className="w-full py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 mb-3"
              style={{
                backgroundColor: "var(--bg-tertiary)",
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
                opacity: testStatus === "testing" ? 0.6 : 1,
              }}
            >
              {testStatus === "testing" && <Loader2 size={14} className="animate-spin" />}
              {testStatus === "ok" && <CheckCircle size={14} style={{ color: "var(--success, #4ade80)" }} />}
              {testStatus === "error" && <XCircle size={14} style={{ color: "#f87171" }} />}
              {testStatus === "testing" ? "Testing..." : "Test Connection"}
            </button>

            {testMessage && (
              <p className="text-xs mb-4 px-1" style={{ color: testStatus === "ok" ? "var(--success, #4ade80)" : "#f87171" }}>
                {testMessage}
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep(0)}
                className="px-5 py-2.5 rounded-lg text-sm inline-flex items-center gap-1"
                style={{ color: "var(--text-muted)" }}
              >
                <ChevronLeft size={14} /> Back
              </button>
              <button
                onClick={handleAINext}
                className="px-5 py-2.5 rounded-lg text-sm inline-flex items-center gap-1"
                style={{ backgroundColor: "var(--accent)", color: "#fff" }}
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* ═══ Step 2: Faith tradition ═══ */}
        {step === 2 && (
          <div>
            <h2 className="text-xl font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
              Your Faith &amp; Tradition
            </h2>
            <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
              This helps your AI companion speak in a way that resonates with you.
              You can change this anytime. Pick what feels right, or skip if you prefer.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6 max-h-80 overflow-y-auto pr-1">
              {tradEntries.map(([key, trad]) => (
                <button
                  key={key}
                  onClick={() => setSelectedFaith(key)}
                  className="text-left p-3 rounded-lg border transition-colors"
                  style={{
                    borderColor: selectedFaith === key ? "var(--accent)" : "var(--border)",
                    backgroundColor: selectedFaith === key ? "var(--bg-tertiary)" : "var(--bg-secondary)",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium" style={{ color: selectedFaith === key ? "var(--accent)" : "var(--text-primary)" }}>
                      {trad.label}
                    </span>
                    {selectedFaith === key && <Check size={14} style={{ color: "var(--accent)" }} />}
                  </div>
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{trad.description}</p>
                </button>
              ))}
            </div>
            {selectedFaith && (
              <div className="mb-6">
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-muted)" }}>
                  Anything else about your faith? (optional)
                </label>
                <textarea
                  value={faithNotes}
                  onChange={(e) => setFaithNotes(e.target.value)}
                  placeholder="e.g., I attend the Traditional Latin Mass, I'm a revert, I pray the Rosary daily..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
                  style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                />
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="px-5 py-2.5 rounded-lg text-sm inline-flex items-center gap-1"
                style={{ color: "var(--text-muted)" }}
              >
                <ChevronLeft size={14} /> Back
              </button>
              <button
                onClick={() => setStep(3)}
                className="px-5 py-2.5 rounded-lg text-sm inline-flex items-center gap-1"
                style={{ backgroundColor: "var(--accent)", color: "#fff" }}
              >
                {selectedFaith ? "Next" : "Skip"} <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* ═══ Step 3: About You ═══ */}
        {step === 3 && (
          <div>
            <div className="flex items-center gap-3 mb-2">
              <User size={24} style={{ color: "var(--accent)" }} />
              <h2 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
                What Should I Know About You?
              </h2>
            </div>
            <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
              Tell your AI companion about yourself — your situation, what you&apos;re working on,
              anything that would help it understand you. Like meeting a sponsor for the first time.
            </p>
            <textarea
              value={aboutMe}
              onChange={(e) => setAboutMe(e.target.value)}
              placeholder={`For example:\n- I'm a 35-year-old father of two, working as a carpenter\n- I struggle with alcohol — sober 6 months now\n- I attend the Traditional Latin Mass at SSPX chapel\n- My biggest triggers are stress at work and loneliness\n- I pray the Rosary daily and it helps me stay grounded`}
              rows={8}
              className="w-full px-4 py-3 rounded-lg text-sm outline-none resize-none leading-relaxed"
              style={{
                backgroundColor: "var(--bg-primary)",
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
              }}
            />
            <p className="text-xs mt-2 mb-6" style={{ color: "var(--text-muted)" }}>
              This is private and only used to personalize your AI companion. You can edit it anytime in Settings.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="px-5 py-2.5 rounded-lg text-sm inline-flex items-center gap-1"
                style={{ color: "var(--text-muted)" }}
              >
                <ChevronLeft size={14} /> Back
              </button>
              <button
                onClick={() => setStep(4)}
                className="px-5 py-2.5 rounded-lg text-sm inline-flex items-center gap-1"
                style={{ backgroundColor: "var(--accent)", color: "#fff" }}
              >
                {aboutMe.trim() ? "Next" : "Skip"} <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* ═══ Step 4: Heroes ═══ */}
        {step === 4 && (
          <div>
            <h2 className="text-xl font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
              Your Heroes
            </h2>
            <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
              People whose character you want to emulate. Their wisdom will appear in your journal
              and guide your AI companion. Toggle off any you don&apos;t want, or add your own.
            </p>
            <div className="space-y-2 mb-4 max-h-64 overflow-y-auto pr-1">
              {heroes.map((hero, i) => (
                <button
                  key={i}
                  onClick={() => toggleHero(i)}
                  className="w-full text-left flex items-center gap-3 p-3 rounded-lg border transition-colors"
                  style={{
                    borderColor: hero.selected ? "var(--accent)" : "var(--border)",
                    backgroundColor: hero.selected ? "var(--bg-tertiary)" : "var(--bg-secondary)",
                    opacity: hero.selected ? 1 : 0.75,
                  }}
                >
                  <div className="w-5 h-5 rounded flex-shrink-0 flex items-center justify-center"
                    style={{ border: `1px solid ${hero.selected ? "var(--accent)" : "var(--border)"}` }}>
                    {hero.selected && <Check size={12} style={{ color: "var(--accent)" }} />}
                  </div>
                  <div>
                    <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{hero.name}</div>
                    {hero.description && (
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>{hero.description}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
            <div className="flex gap-2 mb-6">
              <input
                type="text"
                value={customHero}
                onChange={(e) => setCustomHero(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCustomHero()}
                placeholder="Add a hero..."
                className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
              />
              <button
                onClick={addCustomHero}
                className="px-4 py-2 rounded-lg text-sm"
                style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
              >
                Add
              </button>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setStep(3)}
                className="px-5 py-2.5 rounded-lg text-sm inline-flex items-center gap-1"
                style={{ color: "var(--text-muted)" }}
              >
                <ChevronLeft size={14} /> Back
              </button>
              <button
                onClick={completeOnboarding}
                disabled={loading}
                className="px-6 py-2.5 rounded-lg text-sm font-medium"
                style={{ backgroundColor: "var(--accent)", color: "#fff", opacity: loading ? 0.7 : 1 }}
              >
                {loading ? "Saving..." : "Complete Setup"}
              </button>
            </div>
          </div>
        )}

        {/* ═══ Step 5: Done ═══ */}
        {step === 5 && (
          <div className="text-center">
            <div className="mb-8 flex justify-center">
              <div className="relative">
                <CheckCircle size={72} style={{ color: "var(--success, #22c55e)" }} />
                <div className="absolute -top-1 -right-1">
                  <Flame size={28} style={{ color: "var(--accent)" }} />
                </div>
              </div>
            </div>
            
            <h2 className="text-3xl font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
              Setup Complete! 🎉
            </h2>
            <p className="text-lg mb-6" style={{ color: "var(--text-secondary)" }}>
              Your AI companion is now personalized and ready to walk with you.
            </p>

            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-3 mb-8 text-center">
              <div className="bg-[var(--bg-secondary)] p-3 rounded-xl border" style={{ borderColor: "var(--border)" }}>
                <div className="text-2xl font-semibold" style={{ color: "var(--accent)" }}>{selectedFaith ? "✓" : "○"}</div>
                <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Faith</div>
              </div>
              <div className="bg-[var(--bg-secondary)] p-3 rounded-xl border" style={{ borderColor: "var(--border)" }}>
                <div className="text-2xl font-semibold" style={{ color: "var(--accent)" }}>{heroes.filter(h => h.selected).length}</div>
                <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Heroes</div>
              </div>
              <div className="bg-[var(--bg-secondary)] p-3 rounded-xl border" style={{ borderColor: "var(--border)" }}>
                <div className="text-2xl font-semibold" style={{ color: "var(--accent)" }}>{aboutMe.trim() ? "✓" : "○"}</div>
                <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>About You</div>
              </div>
            </div>

            <p className="text-xs mb-8 max-w-xs mx-auto" style={{ color: "var(--text-muted)" }}>
              Everything is saved securely. You can update your preferences, heroes, or AI settings anytime from the menu.
            </p>

            {suggestedFigures.length > 0 && (
              <div className="mb-8 p-5 rounded-2xl border text-left" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)" }}>
                <p className="text-xs font-medium mb-3 flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
                  <Flame size={14} /> Suggested figures from your tradition:
                </p>
                <div className="flex flex-wrap gap-2">
                  {suggestedFigures.map((name) => (
                    <button
                      key={name}
                      onClick={() => addSuggestedFigure(name)}
                      className="px-4 py-1.5 rounded-full text-xs font-medium transition-all hover:scale-105"
                      style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
                    >
                      + {name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => router.push("/")}
              className="px-10 py-4 rounded-2xl text-base font-semibold inline-flex items-center gap-3 shadow-lg hover:shadow-xl transition-all active:scale-[0.985]"
              style={{ 
                backgroundColor: "var(--accent)", 
                color: "#fff",
                boxShadow: "0 10px 15px -3px rgb(234 179 8 / 0.2)"
              }}
            >
              Begin Your Journey <Flame size={20} />
            </button>
            
            <p className="text-[10px] mt-6" style={{ color: "var(--text-muted)" }}>
              Your data is stored locally and privately.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
