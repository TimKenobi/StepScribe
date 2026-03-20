"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { faithApi, heroesApi, onboardingApi, settingsApi, ollamaApi } from "@/lib/api";
import type { FaithTradition } from "@/lib/types";
import {
  Check, ChevronRight, ChevronLeft, Flame, User, Cpu, Loader2,
  CheckCircle, XCircle, Download, Monitor, Cloud, AlertTriangle,
  Server, RefreshCw, Sparkles, Shield,
} from "lucide-react";
import confetti from "canvas-confetti";

/* ══════════════════════════════════════════════════════════════
   Provider definitions (Cloud API providers)
   ══════════════════════════════════════════════════════════════ */
const PROVIDERS = [
  { key: "grok", label: "Grok (xAI)", desc: "Fast, witty, excellent reasoning. Recommended.", url: "https://console.x.ai/", modelDefault: "grok-3",
    models: ["grok-4-1-fast-reasoning", "grok-3", "grok-3-mini", "grok-3-fast", "grok-2", "grok-2-mini"] },
  { key: "openai", label: "OpenAI (GPT-4)", desc: "Industry standard. Reliable and versatile.", url: "https://platform.openai.com/api-keys", modelDefault: "gpt-4o",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano", "gpt-4-turbo", "gpt-4", "o3", "o3-mini", "o4-mini"] },
  { key: "anthropic", label: "Anthropic (Claude)", desc: "Deep, thoughtful, careful reasoning.", url: "https://console.anthropic.com/", modelDefault: "claude-sonnet-4-20250514",
    models: ["claude-sonnet-4-20250514", "claude-opus-4-20250514", "claude-3-7-sonnet-20250219", "claude-3-5-haiku-20241022"] },
  { key: "custom", label: "Custom Endpoint", desc: "Any OpenAI-compatible API (LM Studio, vLLM, etc).", url: "", modelDefault: "", models: [] },
];

/* ══════════════════════════════════════════════════════════════
   AI Disclaimer Text
   ══════════════════════════════════════════════════════════════ */
const AI_DISCLAIMER = `StepScribe uses AI to provide a conversational companion for journaling and reflection. \
This AI is NOT a licensed therapist, counselor, psychologist, or medical professional. \
It cannot diagnose conditions, prescribe treatments, or replace professional mental health care.

The AI companion is designed as a journaling aid and recovery support tool — like talking to a wise friend, \
not a doctor. If you are experiencing a mental health crisis, suicidal thoughts, or need professional help:

\u2022 Call 988 (Suicide & Crisis Lifeline) \u2014 available 24/7
\u2022 Text HOME to 741741 (Crisis Text Line)
\u2022 Call 911 for immediate danger
\u2022 Contact SAMHSA at 1-800-662-4357

Always consult qualified professionals for medical or mental health advice. \
Your recovery journey deserves real human support alongside this tool.`;

export default function SetupPage() {
  const router = useRouter();
  /*
   * Steps:
   * 0 = Welcome + Disclaimer
   * 1 = Choose AI mode (local vs cloud)
   * 2 = Ollama Setup (if local)  OR  API Key Config (if cloud)
   * 3 = Faith tradition
   * 4 = About you
   * 5 = Heroes
   * 6 = Done
   */
  const [step, setStep] = useState(0);
  const [aiMode, setAiMode] = useState<"local" | "cloud" | "">("");
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);

  // Faith / About / Heroes
  const [traditions, setTraditions] = useState<Record<string, FaithTradition>>({});
  const [selectedFaith, setSelectedFaith] = useState("");
  const [faithNotes, setFaithNotes] = useState("");
  const [aboutMe, setAboutMe] = useState("");
  const [heroes, setHeroes] = useState<Array<{ name: string; description: string; selected: boolean }>>([]);
  const [customHero, setCustomHero] = useState("");
  const [suggestedFigures, setSuggestedFigures] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // ── Cloud AI config ──
  const [aiProvider, setAiProvider] = useState("grok");
  const [apiKey, setApiKey] = useState("");
  const [aiModel, setAiModel] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const [customKey, setCustomKey] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "ok" | "error">("idle");
  const [testMessage, setTestMessage] = useState("");
  const [aiConfigLoaded, setAiConfigLoaded] = useState(false);

  // ── Ollama local config ──
  const [ollamaStatus, setOllamaStatus] = useState<"checking" | "installed" | "not-running" | "not-installed" | "error">("checking");
  const [ollamaVersion, setOllamaVersion] = useState("");
  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434");
  const [installInstructions, setInstallInstructions] = useState<any>(null);
  const [recommendedModels, setRecommendedModels] = useState<any[]>([]);
  const [localModels, setLocalModels] = useState<string[]>([]);
  const [selectedLocalModel, setSelectedLocalModel] = useState("samantha-mistral");
  const [pullProgress, setPullProgress] = useState<string>("");
  const [pullPercent, setPullPercent] = useState(0);
  const [pulling, setPulling] = useState(false);
  const [pullDone, setPullDone] = useState(false);
  const [creatingCompanion, setCreatingCompanion] = useState(false);
  const [companionCreated, setCompanionCreated] = useState(false);

  /* ── Load initial data ── */
  useEffect(() => {
    onboardingApi.status().then((status) => {
      if (status.onboarding_complete) router.push("/");
    }).catch(() => {});
    loadTraditions();
    loadDefaultHeroes();
    loadAIConfig();
  }, [router]);

  /* ── Confetti on completion ── */
  useEffect(() => {
    if (step === 6) {
      const end = Date.now() + 2500;
      const colors = ["#22c55e", "#eab308", "#a855f7", "#3b82f6"];
      const frame = () => {
        confetti({ particleCount: 7, angle: 60, spread: 55, origin: { x: 0.2 }, colors });
        confetti({ particleCount: 7, angle: 120, spread: 55, origin: { x: 0.8 }, colors });
        if (Date.now() < end) requestAnimationFrame(frame);
      };
      frame();
    }
  }, [step]);

  /* ── Data loaders ── */
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
      if (config.provider_ready) {
        setTestStatus("ok");
        setTestMessage("AI provider already configured.");
      }
      setAiConfigLoaded(true);
    } catch {
      setAiConfigLoaded(true);
    }
  };

  const loadTraditions = async () => {
    try { setTraditions(await faithApi.traditions()); } catch {}
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

  /* ── Ollama helpers ── */
  const checkOllama = useCallback(async (retries = 2) => {
    setOllamaStatus("checking");
    // Sync current URL and provider to backend so server-side endpoints use the right address
    try { await settingsApi.updateAI({ ai_provider: "ollama", ollama_base_url: ollamaUrl }); } catch {}
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const status = await ollamaApi.status();
        if (status.reachable) {
          setOllamaStatus("installed");
          setOllamaVersion(status.version);
          const modelsResp = await ollamaApi.models();
          setLocalModels((modelsResp.models || []).map((m: any) => m.name));
          // Validate and auto-fix model selection
          try { await ollamaApi.validateModel(); } catch {}
          break;
        } else if (attempt >= retries) {
          // Ollama binary is on disk but service isn't running
          setOllamaStatus(status.installed ? "not-running" : "not-installed");
        } else {
          await new Promise(r => setTimeout(r, 2000));
        }
      } catch {
        if (attempt >= retries) setOllamaStatus("not-installed");
        else await new Promise(r => setTimeout(r, 2000));
      }
    }
    try { const rec = await ollamaApi.recommended(); setRecommendedModels(rec.models || []); } catch {}
    try { setInstallInstructions(await ollamaApi.installInstructions()); } catch {}
  }, [ollamaUrl]);

  const pullModel = async (modelName: string) => {
    setPulling(true); setPullDone(false);
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
      // Small delay to let Ollama register the model, then refresh list
      await new Promise(r => setTimeout(r, 1000));
      const modelsResp = await ollamaApi.models();
      setLocalModels((modelsResp.models || []).map((m: any) => m.name));
    } catch (e: any) {
      setPullProgress(`Error: ${e.message}`); setPulling(false);
    }
  };

  const createStepCompanion = async () => {
    setCreatingCompanion(true); setCompanionCreated(false);
    try {
      const resp = await ollamaApi.createStepCompanion("stepcompanion", selectedLocalModel);
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
    } catch { setCreatingCompanion(false); }
  };

  /* ── Cloud AI helpers ── */
  const saveAIConfig = async () => {
    const data: Record<string, string> = { ai_provider: aiMode === "local" ? "ollama" : aiProvider };
    if (aiMode === "local") {
      // For Docker, the backend uses host.docker.internal; for native use localhost
      data.ollama_base_url = ollamaUrl;
      data.ollama_model = companionCreated ? "stepcompanion" : selectedLocalModel;
    } else if (aiProvider === "openai") {
      if (apiKey) data.openai_api_key = apiKey;
      if (aiModel) data.openai_model = aiModel;
    } else if (aiProvider === "anthropic") {
      if (apiKey) data.anthropic_api_key = apiKey;
      if (aiModel) data.anthropic_model = aiModel;
    } else if (aiProvider === "grok") {
      if (apiKey) data.grok_api_key = apiKey;
      if (aiModel) data.grok_model = aiModel;
    } else if (aiProvider === "custom") {
      data.custom_ai_base_url = customUrl;
      if (customKey) data.custom_ai_api_key = customKey;
      if (customModel) data.custom_ai_model = customModel;
    }
    await settingsApi.updateAI(data);
  };

  const testConnection = async () => {
    setTestStatus("testing"); setTestMessage("");
    try {
      await saveAIConfig();
      const result = await settingsApi.testAI();
      if (result.status === "ok") { setTestStatus("ok"); setTestMessage(result.message || "Connection successful!"); }
      else { setTestStatus("error"); setTestMessage(result.message || "Connection failed."); }
    } catch (e: any) { setTestStatus("error"); setTestMessage(e.message || "Could not connect."); }
  };

  /* ── Navigation helpers ── */
  const handleAIModeNext = async () => {
    if (aiMode === "local") { await checkOllama(); }
    setStep(2);
  };
  const handleAIConfigNext = async () => { await saveAIConfig(); setStep(3); };

  /* ── Heroes ── */
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
    try { await heroesApi.add({ user_id: "default", name, description: "" }); } catch {}
  };

  const completeOnboarding = async () => {
    setLoading(true);
    try {
      const selectedHeroes = heroes.filter((h) => h.selected).map(({ name, description }) => ({ name, description }));
      const result = await onboardingApi.complete({
        faith_tradition: selectedFaith, faith_notes: faithNotes, about_me: aboutMe, heroes: selectedHeroes,
      });
      if (result.suggested_figures?.length > 0) {
        setSuggestedFigures(result.suggested_figures.filter((f: string) => !heroes.some((h) => h.name === f)));
      }
      setStep(6);
    } catch { setStep(6); }
    finally { setLoading(false); }
  };

  const selectedCloudProvider = PROVIDERS.find((p) => p.key === aiProvider);
  const tradEntries = Object.entries(traditions);
  const needsKey = aiProvider !== "custom";
  const detectedOS = installInstructions?.platform?.toLowerCase() || "macos";
  const osInstructions = installInstructions ? {
    label: installInstructions.platform || "Your OS",
    steps: [
      installInstructions.command ? `Run: ${installInstructions.command}` : `Download from ${installInstructions.download_url || "https://ollama.com/download"}`,
      installInstructions.notes || "After installing, click Recheck above.",
    ],
    command: installInstructions.command || "",
  } : null;
  const modelAlreadyPulled = localModels.some((m) => m.toLowerCase().startsWith(selectedLocalModel.toLowerCase()));

  return (
    <div className="min-h-screen flex items-center justify-center p-8" style={{ backgroundColor: "var(--bg-primary)" }}>
      <div className="max-w-xl w-full">

        {/* ═══ Step 0: Welcome + AI Disclaimer ═══ */}
        {step === 0 && (
          <div className="text-center">
            <div className="mb-6 flex justify-center">
              <Flame size={48} style={{ color: "var(--accent)" }} />
            </div>
            <h1 className="text-3xl font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
              Welcome to StepScribe
            </h1>
            <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
              A journaling companion for the road of recovery.
            </p>

            {/* AI Disclaimer */}
            <div className="text-left p-5 rounded-xl border mb-6" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)" }}>
              <div className="flex items-center gap-2 mb-3">
                <Shield size={18} style={{ color: "#f59e0b" }} />
                <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  Important: AI Companion Disclaimer
                </span>
              </div>
              <p className="text-xs leading-relaxed whitespace-pre-line mb-4" style={{ color: "var(--text-secondary)" }}>
                {AI_DISCLAIMER}
              </p>
              <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg transition-colors"
                style={{ backgroundColor: disclaimerAccepted ? "var(--accent-muted, rgba(234,179,8,0.1))" : "var(--bg-tertiary)" }}>
                <input type="checkbox" checked={disclaimerAccepted}
                  onChange={(e) => setDisclaimerAccepted(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-[var(--accent)]" />
                <span className="text-xs leading-relaxed" style={{ color: "var(--text-primary)" }}>
                  I understand that StepScribe&apos;s AI is a journaling companion, not a therapist or medical professional.
                  I will seek qualified professionals for mental health or medical needs.
                </span>
              </label>
            </div>

            <button onClick={() => setStep(1)} disabled={!disclaimerAccepted}
              className="px-8 py-3 rounded-lg text-sm font-medium inline-flex items-center gap-2 transition-opacity"
              style={{ backgroundColor: "var(--accent)", color: "#fff", opacity: disclaimerAccepted ? 1 : 0.4, cursor: disclaimerAccepted ? "pointer" : "not-allowed" }}>
              Get Started <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* ═══ Step 1: Choose AI Mode ═══ */}
        {step === 1 && (
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Cpu size={24} style={{ color: "var(--accent)" }} />
              <h2 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>How Do You Want to Run AI?</h2>
            </div>
            <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
              StepScribe can run AI completely on your computer (private, no data leaves your machine)
              or use a cloud API (faster, more powerful models).
            </p>

            <div className="space-y-3 mb-8">
              <button onClick={() => setAiMode("local")}
                className="w-full text-left p-5 rounded-xl border-2 transition-all"
                style={{ borderColor: aiMode === "local" ? "var(--accent)" : "var(--border)", backgroundColor: aiMode === "local" ? "var(--bg-tertiary)" : "var(--bg-secondary)" }}>
                <div className="flex items-center gap-3 mb-2">
                  <Monitor size={22} style={{ color: aiMode === "local" ? "var(--accent)" : "var(--text-secondary)" }} />
                  <span className="text-base font-semibold" style={{ color: aiMode === "local" ? "var(--accent)" : "var(--text-primary)" }}>
                    Run Locally with Ollama
                  </span>
                  {aiMode === "local" && <Check size={16} style={{ color: "var(--accent)" }} />}
                </div>
                <p className="text-xs leading-relaxed ml-[34px]" style={{ color: "var(--text-muted)" }}>
                  100% private — nothing leaves your computer. Uses Ollama to run AI models locally.
                  We&apos;ll help you install it and download a model optimized for recovery support.
                  Requires ~8 GB RAM and ~5 GB disk space.
                </p>
                <div className="flex flex-wrap gap-2 mt-3 ml-[34px]">
                  <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-muted)" }}>samantha-mistral</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-muted)" }}>ALIENTELLIGENCE/psychologist</span>
                </div>
              </button>

              <button onClick={() => setAiMode("cloud")}
                className="w-full text-left p-5 rounded-xl border-2 transition-all"
                style={{ borderColor: aiMode === "cloud" ? "var(--accent)" : "var(--border)", backgroundColor: aiMode === "cloud" ? "var(--bg-tertiary)" : "var(--bg-secondary)" }}>
                <div className="flex items-center gap-3 mb-2">
                  <Cloud size={22} style={{ color: aiMode === "cloud" ? "var(--accent)" : "var(--text-secondary)" }} />
                  <span className="text-base font-semibold" style={{ color: aiMode === "cloud" ? "var(--accent)" : "var(--text-primary)" }}>
                    Use Cloud API
                  </span>
                  {aiMode === "cloud" && <Check size={16} style={{ color: "var(--accent)" }} />}
                </div>
                <p className="text-xs leading-relaxed ml-[34px]" style={{ color: "var(--text-muted)" }}>
                  More powerful models (GPT-4, Claude, Grok). Requires an API key.
                  Your conversations are sent to the provider&apos;s servers.
                  Most providers offer free tiers or low-cost access.
                </p>
              </button>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(0)} className="px-5 py-2.5 rounded-lg text-sm inline-flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                <ChevronLeft size={14} /> Back
              </button>
              <button onClick={handleAIModeNext} disabled={!aiMode}
                className="px-5 py-2.5 rounded-lg text-sm inline-flex items-center gap-1 transition-opacity"
                style={{ backgroundColor: "var(--accent)", color: "#fff", opacity: aiMode ? 1 : 0.4 }}>
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* ═══ Step 2 (Local): Ollama Setup ═══ */}
        {step === 2 && aiMode === "local" && (
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Server size={24} style={{ color: "var(--accent)" }} />
              <h2 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>Local AI Setup</h2>
            </div>

            {/* Ollama status */}
            <div className="p-4 rounded-xl border mb-6" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)" }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Ollama Status</span>
                <button onClick={() => checkOllama()} className="text-xs flex items-center gap-1 px-2 py-1 rounded"
                  style={{ color: "var(--accent)", backgroundColor: "var(--bg-tertiary)" }}>
                  <RefreshCw size={10} /> Recheck
                </button>
              </div>

              {ollamaStatus === "checking" && (
                <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
                  <Loader2 size={14} className="animate-spin" /> Checking if Ollama is running...
                </div>
              )}
              {ollamaStatus === "installed" && (
                <div className="flex items-center gap-2 text-xs" style={{ color: "var(--success, #4ade80)" }}>
                  <CheckCircle size={14} /> Ollama is running {ollamaVersion && `(v${ollamaVersion})`}
                </div>
              )}
              {ollamaStatus === "not-running" && (
                <div>
                  <div className="flex items-center gap-2 text-xs mb-2" style={{ color: "#fbbf24" }}>
                    <AlertTriangle size={14} /> Ollama is installed but not running
                  </div>
                  <p className="text-xs mb-2" style={{ color: "var(--text-secondary)" }}>
                    Please start the Ollama app, then click &quot;Recheck&quot; above.
                  </p>
                  <div className="text-[10px] p-2 rounded" style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-muted)" }}>
                    On macOS: Open Ollama from Applications, or run <code>ollama serve</code> in Terminal.
                  </div>
                </div>
              )}
              {(ollamaStatus === "not-installed" || ollamaStatus === "error") && (
                <div>
                  <div className="flex items-center gap-2 text-xs mb-3" style={{ color: "#f87171" }}>
                    <XCircle size={14} /> Ollama is not running or not installed
                  </div>
                  {osInstructions && (
                    <div className="p-3 rounded-lg" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                      <p className="text-xs font-medium mb-2" style={{ color: "var(--text-primary)" }}>
                        Install Ollama ({osInstructions.label}):
                      </p>
                      <ol className="text-xs space-y-1.5 list-decimal list-inside" style={{ color: "var(--text-secondary)" }}>
                        {osInstructions.steps?.map((s: string, i: number) => <li key={i}>{s}</li>)}
                      </ol>
                      {osInstructions.command && (
                        <div className="mt-3">
                          <p className="text-[10px] mb-1" style={{ color: "var(--text-muted)" }}>Quick install command:</p>
                          <code className="block text-xs px-3 py-2 rounded font-mono select-all" style={{
                            backgroundColor: "var(--bg-primary)", color: "var(--accent)", border: "1px solid var(--border)",
                          }}>{osInstructions.command}</code>
                        </div>
                      )}
                      <p className="text-[10px] mt-3" style={{ color: "var(--text-muted)" }}>
                        After installing, click &quot;Recheck&quot; above to detect Ollama.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Model selection — when Ollama is installed */}
            {ollamaStatus === "installed" && (
              <>
                <div className="mb-6">
                  <h3 className="text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>
                    Choose a Model for Recovery Support
                  </h3>
                  <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
                    These models are optimized for empathetic, therapeutic-style conversations.
                    We&apos;ll also create a &quot;StepCompanion&quot; version tuned for 12-step recovery.
                  </p>
                  <div className="space-y-2">
                    {recommendedModels.map((model: any) => (
                      <button key={model.name} onClick={() => setSelectedLocalModel(model.name)}
                        className="w-full text-left p-3 rounded-lg border transition-colors"
                        style={{
                          borderColor: selectedLocalModel === model.name ? "var(--accent)" : "var(--border)",
                          backgroundColor: selectedLocalModel === model.name ? "var(--bg-tertiary)" : "var(--bg-secondary)",
                        }}>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium" style={{ color: selectedLocalModel === model.name ? "var(--accent)" : "var(--text-primary)" }}>
                            {model.label || model.name}
                          </span>
                          {selectedLocalModel === model.name && <Check size={14} style={{ color: "var(--accent)" }} />}
                          {localModels.some((m) => m.toLowerCase().startsWith(model.name.toLowerCase())) && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--success, #4ade80)", color: "#000" }}>installed</span>
                          )}
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                          {model.description} {model.size && `\u2022 ${model.size}`}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pull model */}
                {!modelAlreadyPulled && (
                  <div className="mb-4">
                    <button onClick={() => pullModel(selectedLocalModel)} disabled={pulling}
                      className="w-full py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                      style={{ backgroundColor: "var(--accent)", color: "#fff", opacity: pulling ? 0.7 : 1 }}>
                      {pulling ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                      {pulling ? "Downloading..." : `Download ${selectedLocalModel}`}
                    </button>
                    {pulling && (
                      <div className="mt-2">
                        <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                          <div className="h-full rounded-full transition-all" style={{ width: `${pullPercent}%`, backgroundColor: "var(--accent)" }} />
                        </div>
                        <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                          {pullProgress} {pullPercent > 0 && `(${pullPercent}%)`}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Create StepCompanion */}
                {(modelAlreadyPulled || pullDone) && !companionCreated && (
                  <div className="mb-4 p-4 rounded-xl border" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)" }}>
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles size={16} style={{ color: "var(--accent)" }} />
                      <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Create StepCompanion Model</span>
                    </div>
                    <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
                      We&apos;ll create a customized version with 12-step recovery knowledge,
                      Big Book principles, and crisis-aware boundaries built in.
                    </p>
                    <button onClick={createStepCompanion} disabled={creatingCompanion}
                      className="w-full py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                      style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--accent)", border: "1px solid var(--accent)", opacity: creatingCompanion ? 0.7 : 1 }}>
                      {creatingCompanion ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                      {creatingCompanion ? "Creating..." : "Create StepCompanion"}
                    </button>
                    <p className="text-[10px] mt-2 text-center" style={{ color: "var(--text-muted)" }}>
                      Optional — you can skip this and use the base model directly.
                    </p>
                  </div>
                )}

                {companionCreated && (
                  <div className="mb-4 p-3 rounded-lg flex items-center gap-2" style={{ backgroundColor: "rgba(74,222,128,0.1)", border: "1px solid var(--success, #4ade80)" }}>
                    <CheckCircle size={16} style={{ color: "var(--success, #4ade80)" }} />
                    <span className="text-xs" style={{ color: "var(--success, #4ade80)" }}>StepCompanion model created successfully!</span>
                  </div>
                )}

                {/* Ollama URL (advanced) */}
                <div className="mb-4">
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-muted)" }}>Ollama URL (advanced)</label>
                  <input value={ollamaUrl} onChange={(e) => setOllamaUrl(e.target.value)} placeholder="http://localhost:11434"
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none font-mono"
                    style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
                </div>
              </>
            )}

            <div className="flex gap-3 mt-6">
              <button onClick={() => setStep(1)} className="px-5 py-2.5 rounded-lg text-sm inline-flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                <ChevronLeft size={14} /> Back
              </button>
              {ollamaStatus === "installed" && (modelAlreadyPulled || pullDone) && (
                <button onClick={handleAIConfigNext} className="px-5 py-2.5 rounded-lg text-sm inline-flex items-center gap-1"
                  style={{ backgroundColor: "var(--accent)", color: "#fff" }}>
                  Next <ChevronRight size={14} />
                </button>
              )}
              <button onClick={() => { setAiMode("cloud"); setStep(2); }} className="px-5 py-2.5 rounded-lg text-sm" style={{ color: "var(--text-muted)" }}>
                Skip to Cloud API instead
              </button>
            </div>
          </div>
        )}

        {/* ═══ Step 2 (Cloud): API Key Config ═══ */}
        {step === 2 && aiMode === "cloud" && (
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Cloud size={24} style={{ color: "var(--accent)" }} />
              <h2 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>Connect Your AI</h2>
            </div>
            <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
              Choose a provider and enter your API key. All providers work great with StepScribe.
              {aiConfigLoaded && testStatus === "ok" && (
                <span className="block mt-1 text-xs" style={{ color: "var(--success, #4ade80)" }}>
                  A provider is already configured. You can keep it or change it below.
                </span>
              )}
            </p>

            <div className="space-y-2 mb-6">
              {PROVIDERS.map((p) => (
                <button key={p.key} onClick={() => { setAiProvider(p.key); setAiModel(p.modelDefault); setApiKey(""); setTestStatus("idle"); setTestMessage(""); }}
                  className="w-full text-left p-3 rounded-lg border transition-colors"
                  style={{ borderColor: aiProvider === p.key ? "var(--accent)" : "var(--border)", backgroundColor: aiProvider === p.key ? "var(--bg-tertiary)" : "var(--bg-secondary)" }}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium" style={{ color: aiProvider === p.key ? "var(--accent)" : "var(--text-primary)" }}>{p.label}</span>
                    {aiProvider === p.key && <Check size={14} style={{ color: "var(--accent)" }} />}
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{p.desc}</p>
                </button>
              ))}
            </div>

            {needsKey && (
              <div className="mb-4">
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-muted)" }}>
                  API Key
                  {selectedCloudProvider?.url && (
                    <a href={selectedCloudProvider.url} target="_blank" rel="noopener noreferrer" className="ml-2 underline" style={{ color: "var(--accent)" }}>Get one here</a>
                  )}
                </label>
                <input type="password" value={apiKey} onChange={(e) => { setApiKey(e.target.value); setTestStatus("idle"); }}
                  placeholder={`Paste your ${selectedCloudProvider?.label || ""} API key`}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none font-mono"
                  style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
              </div>
            )}

            {aiProvider === "custom" && (
              <div className="mb-4 space-y-3">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-muted)" }}>Base URL</label>
                  <input value={customUrl} onChange={(e) => setCustomUrl(e.target.value)} placeholder="http://localhost:1234/v1"
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none font-mono"
                    style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-muted)" }}>API Key (if required)</label>
                  <input type="password" value={customKey} onChange={(e) => setCustomKey(e.target.value)} placeholder="Optional"
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none font-mono"
                    style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-muted)" }}>Model name</label>
                  <input value={customModel} onChange={(e) => setCustomModel(e.target.value)} placeholder="model-name"
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none font-mono"
                    style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
                </div>
              </div>
            )}

            {needsKey && aiProvider !== "custom" && (
              <div className="mb-4">
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-muted)" }}>Model</label>
                <select value={aiModel} onChange={(e) => setAiModel(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none font-mono appearance-none cursor-pointer"
                  style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
                  {(selectedCloudProvider?.models || []).map((m: string) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            )}

            <button onClick={testConnection} disabled={testStatus === "testing"}
              className="w-full py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 mb-3"
              style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-primary)", border: "1px solid var(--border)", opacity: testStatus === "testing" ? 0.6 : 1 }}>
              {testStatus === "testing" && <Loader2 size={14} className="animate-spin" />}
              {testStatus === "ok" && <CheckCircle size={14} style={{ color: "var(--success, #4ade80)" }} />}
              {testStatus === "error" && <XCircle size={14} style={{ color: "#f87171" }} />}
              {testStatus === "testing" ? "Testing..." : "Test Connection"}
            </button>
            {testMessage && <p className="text-xs mb-4 px-1" style={{ color: testStatus === "ok" ? "var(--success, #4ade80)" : "#f87171" }}>{testMessage}</p>}

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="px-5 py-2.5 rounded-lg text-sm inline-flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                <ChevronLeft size={14} /> Back
              </button>
              <button onClick={handleAIConfigNext} className="px-5 py-2.5 rounded-lg text-sm inline-flex items-center gap-1"
                style={{ backgroundColor: "var(--accent)", color: "#fff" }}>
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* ═══ Step 3: Faith ═══ */}
        {step === 3 && (
          <div>
            <h2 className="text-xl font-semibold mb-2" style={{ color: "var(--text-primary)" }}>Your Faith &amp; Tradition</h2>
            <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
              This helps your AI companion speak in a way that resonates with you. Pick what feels right, or skip.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6 max-h-80 overflow-y-auto pr-1">
              {tradEntries.map(([key, trad]) => (
                <button key={key} onClick={() => setSelectedFaith(key)} className="text-left p-3 rounded-lg border transition-colors"
                  style={{ borderColor: selectedFaith === key ? "var(--accent)" : "var(--border)", backgroundColor: selectedFaith === key ? "var(--bg-tertiary)" : "var(--bg-secondary)" }}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium" style={{ color: selectedFaith === key ? "var(--accent)" : "var(--text-primary)" }}>{trad.label}</span>
                    {selectedFaith === key && <Check size={14} style={{ color: "var(--accent)" }} />}
                  </div>
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{trad.description}</p>
                </button>
              ))}
            </div>
            {selectedFaith && (
              <div className="mb-6">
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-muted)" }}>Anything else about your faith? (optional)</label>
                <textarea value={faithNotes} onChange={(e) => setFaithNotes(e.target.value)}
                  placeholder="e.g., I attend the Traditional Latin Mass, I'm a revert, I pray the Rosary daily..."
                  rows={2} className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
                  style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="px-5 py-2.5 rounded-lg text-sm inline-flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                <ChevronLeft size={14} /> Back
              </button>
              <button onClick={() => setStep(4)} className="px-5 py-2.5 rounded-lg text-sm inline-flex items-center gap-1"
                style={{ backgroundColor: "var(--accent)", color: "#fff" }}>
                {selectedFaith ? "Next" : "Skip"} <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* ═══ Step 4: About You ═══ */}
        {step === 4 && (
          <div>
            <div className="flex items-center gap-3 mb-2">
              <User size={24} style={{ color: "var(--accent)" }} />
              <h2 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>What Should I Know About You?</h2>
            </div>
            <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
              Tell your AI companion about yourself — your situation, what you&apos;re working on. Like meeting a sponsor for the first time.
            </p>
            <textarea value={aboutMe} onChange={(e) => setAboutMe(e.target.value)}
              placeholder={`For example:\n- I'm a 35-year-old father of two, working as a carpenter\n- I struggle with alcohol — sober 6 months now\n- I attend the Traditional Latin Mass\n- My biggest triggers are stress at work and loneliness\n- I pray the Rosary daily and it helps me stay grounded`}
              rows={8} className="w-full px-4 py-3 rounded-lg text-sm outline-none resize-none leading-relaxed"
              style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
            <p className="text-xs mt-2 mb-6" style={{ color: "var(--text-muted)" }}>
              This is private and only used to personalize your AI companion. You can edit it anytime in Settings.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setStep(3)} className="px-5 py-2.5 rounded-lg text-sm inline-flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                <ChevronLeft size={14} /> Back
              </button>
              <button onClick={() => setStep(5)} className="px-5 py-2.5 rounded-lg text-sm inline-flex items-center gap-1"
                style={{ backgroundColor: "var(--accent)", color: "#fff" }}>
                {aboutMe.trim() ? "Next" : "Skip"} <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* ═══ Step 5: Heroes ═══ */}
        {step === 5 && (
          <div>
            <h2 className="text-xl font-semibold mb-2" style={{ color: "var(--text-primary)" }}>Your Heroes</h2>
            <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
              People whose character you want to emulate. Their wisdom will appear in your journal and guide your AI companion.
            </p>
            <div className="space-y-2 mb-4 max-h-64 overflow-y-auto pr-1">
              {heroes.map((hero, i) => (
                <button key={i} onClick={() => toggleHero(i)}
                  className="w-full text-left flex items-center gap-3 p-3 rounded-lg border transition-colors"
                  style={{ borderColor: hero.selected ? "var(--accent)" : "var(--border)", backgroundColor: hero.selected ? "var(--bg-tertiary)" : "var(--bg-secondary)", opacity: hero.selected ? 1 : 0.75 }}>
                  <div className="w-5 h-5 rounded flex-shrink-0 flex items-center justify-center"
                    style={{ border: `1px solid ${hero.selected ? "var(--accent)" : "var(--border)"}` }}>
                    {hero.selected && <Check size={12} style={{ color: "var(--accent)" }} />}
                  </div>
                  <div>
                    <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{hero.name}</div>
                    {hero.description && <p className="text-xs" style={{ color: "var(--text-muted)" }}>{hero.description}</p>}
                  </div>
                </button>
              ))}
            </div>
            <div className="flex gap-2 mb-6">
              <input type="text" value={customHero} onChange={(e) => setCustomHero(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCustomHero()} placeholder="Add a hero..."
                className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
              <button onClick={addCustomHero} className="px-4 py-2 rounded-lg text-sm"
                style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-secondary)" }}>Add</button>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(4)} className="px-5 py-2.5 rounded-lg text-sm inline-flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                <ChevronLeft size={14} /> Back
              </button>
              <button onClick={completeOnboarding} disabled={loading}
                className="px-6 py-2.5 rounded-lg text-sm font-medium"
                style={{ backgroundColor: "var(--accent)", color: "#fff", opacity: loading ? 0.7 : 1 }}>
                {loading ? "Saving..." : "Complete Setup"}
              </button>
            </div>
          </div>
        )}

        {/* ═══ Step 6: Done ═══ */}
        {step === 6 && (
          <div className="text-center">
            <div className="mb-8 flex justify-center">
              <div className="relative">
                <CheckCircle size={72} style={{ color: "var(--success, #22c55e)" }} />
                <div className="absolute -top-1 -right-1"><Flame size={28} style={{ color: "var(--accent)" }} /></div>
              </div>
            </div>
            <h2 className="text-3xl font-semibold mb-2" style={{ color: "var(--text-primary)" }}>Setup Complete!</h2>
            <p className="text-lg mb-6" style={{ color: "var(--text-secondary)" }}>
              Your AI companion is now personalized and ready to walk with you.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8 text-center">
              <div className="p-3 rounded-xl border" style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--border)" }}>
                <div className="flex justify-center" style={{ color: "var(--accent)" }}>
                  {aiMode === "local" ? <Monitor size={24} /> : <Cloud size={24} />}
                </div>
                <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{aiMode === "local" ? "Local AI" : "Cloud AI"}</div>
              </div>
              <div className="p-3 rounded-xl border" style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--border)" }}>
                <div className="text-2xl font-semibold" style={{ color: "var(--accent)" }}>{selectedFaith ? "\u2713" : "\u25CB"}</div>
                <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Faith</div>
              </div>
              <div className="p-3 rounded-xl border" style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--border)" }}>
                <div className="text-2xl font-semibold" style={{ color: "var(--accent)" }}>{heroes.filter(h => h.selected).length}</div>
                <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Heroes</div>
              </div>
              <div className="p-3 rounded-xl border" style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--border)" }}>
                <div className="text-2xl font-semibold" style={{ color: "var(--accent)" }}>{aboutMe.trim() ? "\u2713" : "\u25CB"}</div>
                <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>About You</div>
              </div>
            </div>

            {/* Disclaimer reminder */}
            <div className="p-4 rounded-xl border mb-6 text-left" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)" }}>
              <div className="flex items-start gap-2">
                <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" style={{ color: "#f59e0b" }} />
                <p className="text-[10px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  Remember: StepScribe&apos;s AI companion is a journaling aid, not a therapist.
                  For mental health support, please reach out to qualified professionals.
                  Crisis: call 988 or text HOME to 741741.
                </p>
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
                    <button key={name} onClick={() => addSuggestedFigure(name)}
                      className="px-4 py-1.5 rounded-full text-xs font-medium transition-all hover:scale-105"
                      style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                      + {name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button onClick={() => router.push("/")}
              className="px-10 py-4 rounded-2xl text-base font-semibold inline-flex items-center gap-3 shadow-lg hover:shadow-xl transition-all active:scale-[0.985]"
              style={{ backgroundColor: "var(--accent)", color: "#fff", boxShadow: "0 10px 15px -3px rgb(234 179 8 / 0.2)" }}>
              Begin Your Journey <Flame size={20} />
            </button>

            <p className="text-[10px] mt-6" style={{ color: "var(--text-muted)" }}>Your data is stored locally and privately.</p>
          </div>
        )}
      </div>
    </div>
  );
}
