"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { faithApi, onboardingApi } from "@/lib/api";
import type { FaithTradition } from "@/lib/types";
import { Check, ChevronRight, ChevronLeft, Flame } from "lucide-react";

const DEFAULT_HEROES = [
  { name: "J.R.R. Tolkien", description: "Showed that ordinary people can carry extraordinary burdens." },
  { name: "G.K. Chesterton", description: "Believed gratitude is the highest form of thought." },
  { name: "C.S. Lewis", description: "Wrote honestly about grief, faith, and becoming who you're meant to be." },
  { name: "Marcus Aurelius", description: "Stoic emperor. Focus on what matters and what doesn't." },
  { name: "Epictetus", description: "Born a slave. Focus only on what you can control." },
  { name: "Seneca", description: "Wrote about anger, grief, and life with unflinching honesty." },
];

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState(0); // 0=welcome, 1=faith, 2=heroes, 3=done
  const [traditions, setTraditions] = useState<Record<string, FaithTradition>>({});
  const [selectedFaith, setSelectedFaith] = useState("");
  const [faithNotes, setFaithNotes] = useState("");
  const [heroes, setHeroes] = useState(DEFAULT_HEROES.map((h) => ({ ...h, selected: true })));
  const [customHero, setCustomHero] = useState("");
  const [suggestedFigures, setSuggestedFigures] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkStatus();
    loadTraditions();
  }, []);

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
        heroes: selectedHeroes,
      });
      if (result.suggested_figures?.length > 0) {
        setSuggestedFigures(result.suggested_figures.filter((f: string) => !heroes.some((h) => h.name === f)));
      }
      setStep(3);
    } catch {
      setStep(3);
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

        {/* Step 2: Heroes */}
        {step === 2 && (
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
                onClick={() => setStep(1)}
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

        {/* Step 3: Done */}
        {step === 3 && (
          <div className="text-center">
            <div className="mb-6 flex justify-center">
              <Flame size={48} style={{ color: "var(--accent)" }} />
            </div>
            <h2 className="text-xl font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
              You&apos;re all set.
            </h2>
            <p className="text-sm mb-2" style={{ color: "var(--text-secondary)" }}>
              Your companion knows your tradition and your heroes.
            </p>
            <p className="text-xs mb-6" style={{ color: "var(--text-muted)" }}>
              You can change any of this anytime in Settings, Heroes, or Faith &amp; Tradition.
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
