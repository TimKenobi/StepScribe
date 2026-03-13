"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { faithApi, heroesApi, onboardingApi } from "@/lib/api";
import type { FaithTradition } from "@/lib/types";
import { Check, ChevronRight, ChevronLeft, Flame, User } from "lucide-react";

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState(0); // 0=welcome, 1=faith, 2=about, 3=heroes, 4=done
  const [traditions, setTraditions] = useState<Record<string, FaithTradition>>({});
  const [selectedFaith, setSelectedFaith] = useState("");
  const [faithNotes, setFaithNotes] = useState("");
  const [aboutMe, setAboutMe] = useState("");
  const [heroes, setHeroes] = useState<Array<{ name: string; description: string; selected: boolean }>>([]);
  const [customHero, setCustomHero] = useState("");
  const [suggestedFigures, setSuggestedFigures] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkStatus();
    loadTraditions();
    loadDefaultHeroes();
  }, []);

  const loadDefaultHeroes = async () => {
    try {
      const defaults = await heroesApi.defaults();
      setHeroes(defaults.map((h: any) => ({ name: h.name, description: h.description, selected: true })));
    } catch {
      // Fallback minimal list
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

  const toggleHero = (index: number) => {
    setHeroes((prev) => prev.map((h, i) => (i === index ? { ...h, selected: !h.selected } : h)));
  };

  const addCustomHero = () => {
    if (!customHero.trim()) return;
    setHeroes((prev) => [...prev, { name: customHero, description: "", selected: true }]);
    setCustomHero("");
  };

  const addSuggestedFigure = (name: string) => {
    if (heroes.some((h) => h.name === name)) return;
    setHeroes((prev) => [...prev, { name, description: "", selected: true }]);
    setSuggestedFigures((prev) => prev.filter((f) => f !== name));
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
      setStep(4);
    } catch {
      setStep(4);
    } finally {
      setLoading(false);
    }
  };

  const tradEntries = Object.entries(traditions);

  return (
    <div className="min-h-screen flex items-center justify-center p-8" style={{ backgroundColor: "var(--bg-primary)" }}>
      <div className="max-w-xl w-full">

        {/* Step 0: Welcome */}
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

        {/* Step 1: Faith tradition */}
        {step === 1 && (
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
                onClick={() => setStep(0)}
                className="px-5 py-2.5 rounded-lg text-sm inline-flex items-center gap-1"
                style={{ color: "var(--text-muted)" }}
              >
                <ChevronLeft size={14} /> Back
              </button>
              <button
                onClick={() => setStep(2)}
                className="px-5 py-2.5 rounded-lg text-sm inline-flex items-center gap-1"
                style={{ backgroundColor: "var(--accent)", color: "#fff" }}
              >
                {selectedFaith ? "Next" : "Skip"} <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: About You */}
        {step === 2 && (
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
                {aboutMe.trim() ? "Next" : "Skip"} <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Heroes */}
        {step === 3 && (
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
                    opacity: hero.selected ? 1 : 0.5,
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
                onClick={() => setStep(2)}
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

        {/* Step 4: Done */}
        {step === 4 && (
          <div className="text-center">
            <div className="mb-6 flex justify-center">
              <Flame size={48} style={{ color: "var(--accent)" }} />
            </div>
            <h2 className="text-xl font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
              You&apos;re all set.
            </h2>
            <p className="text-sm mb-2" style={{ color: "var(--text-secondary)" }}>
              Your companion knows your tradition, your heroes, and a bit about you.
            </p>
            <p className="text-xs mb-6" style={{ color: "var(--text-muted)" }}>
              You can change any of this anytime in Settings, Heroes, Faith &amp; Tradition, or AI Memory.
            </p>

            {/* If the tradition suggested figures, offer to add them */}
            {suggestedFigures.length > 0 && (
              <div className="mb-6 p-4 rounded-lg border text-left" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)" }}>
                <p className="text-xs font-medium mb-2" style={{ color: "var(--text-muted)" }}>
                  Suggested figures from your tradition:
                </p>
                <div className="flex flex-wrap gap-2">
                  {suggestedFigures.map((name) => (
                    <button
                      key={name}
                      onClick={() => addSuggestedFigure(name)}
                      className="px-3 py-1 rounded text-xs"
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
              className="px-8 py-3 rounded-lg text-sm font-medium"
              style={{ backgroundColor: "var(--accent)", color: "#fff" }}
            >
              Start Journaling
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
