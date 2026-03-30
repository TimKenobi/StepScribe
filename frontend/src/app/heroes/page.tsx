"use client";

import { useState, useEffect } from "react";
import { Plus, X, ToggleLeft, ToggleRight, Search, Loader2, Check } from "lucide-react";
import HeroQuotes from "@/components/HeroQuotes";
import { heroesApi } from "@/lib/api";
import { Hero } from "@/lib/types";

export default function HeroesPage() {
  const [heroes, setHeroes] = useState<Hero[]>([]);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [searchingQuotes, setSearchingQuotes] = useState<string | null>(null);
  const [foundQuotes, setFoundQuotes] = useState<Record<string, any[]>>({});
  const [savingQuotes, setSavingQuotes] = useState<string | null>(null);

  useEffect(() => {
    loadHeroes();
  }, []);

  const loadHeroes = async () => {
    try {
      const data = await heroesApi.list();
      setHeroes(data);
    } catch {}
  };

  const addHero = async () => {
    if (!newName.trim()) return;
    try {
      await heroesApi.add({ name: newName, description: newDesc });
      setNewName("");
      setNewDesc("");
      setShowAdd(false);
      loadHeroes();
    } catch {}
  };

  const removeHero = async (id: string) => {
    try {
      await heroesApi.remove(id);
      loadHeroes();
    } catch {}
  };

  const toggleHero = async (id: string) => {
    try {
      await heroesApi.toggle(id);
      loadHeroes();
    } catch {}
  };

  const searchQuotes = async (hero: Hero) => {
    setSearchingQuotes(hero.id);
    try {
      const resp = await heroesApi.searchQuotes(hero.name);
      setFoundQuotes((prev) => ({ ...prev, [hero.id]: resp.quotes || [] }));
    } catch {
      setFoundQuotes((prev) => ({ ...prev, [hero.id]: [] }));
    } finally {
      setSearchingQuotes(null);
    }
  };

  const saveQuotes = async (heroId: string, quotes: any[]) => {
    setSavingQuotes(heroId);
    try {
      await heroesApi.updateQuotes(heroId, quotes);
      // Merge into existing hero quotes
      loadHeroes();
      setFoundQuotes((prev) => { const copy = { ...prev }; delete copy[heroId]; return copy; });
    } catch {} finally {
      setSavingQuotes(null);
    }
  };

  const activeHeroes = heroes.filter((h) => h.is_active);

  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="text-2xl font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
        Heroes &amp; Wisdom
      </h1>
      <p className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>
        The people whose character you want to emulate. Their words will appear throughout your journal.
      </p>

      {/* Daily quote */}
      <HeroQuotes refreshInterval={60000} />

      {/* Hero list */}
      <div className="mt-8 space-y-3">
        {heroes.map((hero) => (
          <div
            key={hero.id}
            className="p-4 rounded-lg border"
            style={{
              borderColor: "var(--border)",
              backgroundColor: "var(--bg-secondary)",
              opacity: hero.is_active ? 1 : 0.5,
            }}
          >
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  {hero.name}
                </div>
                {hero.description && (
                  <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    {hero.description}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => searchQuotes(hero)}
                  disabled={searchingQuotes === hero.id}
                  title="Find quotes"
                  className="p-1.5 rounded-lg hover:bg-black/5"
                  style={{ color: "var(--accent)" }}
                >
                  {searchingQuotes === hero.id ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                </button>
                <button onClick={() => toggleHero(hero.id)} title={hero.is_active ? "Disable" : "Enable"}>
                  {hero.is_active ? (
                    <ToggleRight size={20} style={{ color: "var(--accent)" }} />
                  ) : (
                    <ToggleLeft size={20} style={{ color: "var(--text-muted)" }} />
                  )}
                </button>
                <button onClick={() => removeHero(hero.id)} style={{ color: "var(--danger)" }}>
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Existing saved quotes */}
            {hero.quotes && hero.quotes.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {hero.quotes.map((q: any, i: number) => (
                  <div key={i} className="text-xs italic px-3 py-1.5 rounded" style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-secondary)" }}>
                    &ldquo;{q.text}&rdquo; {q.source && <span style={{ color: "var(--text-muted)" }}>— {q.source}</span>}
                  </div>
                ))}
              </div>
            )}

            {/* Found quotes from AI search */}
            {foundQuotes[hero.id] && foundQuotes[hero.id].length > 0 && (
              <div className="mt-3 p-3 rounded-lg" style={{ backgroundColor: "var(--bg-primary)", border: "1px solid var(--border)" }}>
                <p className="text-xs font-medium mb-2" style={{ color: "var(--text-primary)" }}>Found quotes — select to save:</p>
                <div className="space-y-1.5">
                  {foundQuotes[hero.id].map((q: any, i: number) => (
                    <label key={i} className="flex items-start gap-2 text-xs cursor-pointer">
                      <input type="checkbox" defaultChecked className="mt-0.5" data-hero={hero.id} data-idx={i} />
                      <span style={{ color: "var(--text-secondary)" }}>
                        <em>&ldquo;{q.text}&rdquo;</em>
                        {q.source && <span style={{ color: "var(--text-muted)" }}> — {q.source}</span>}
                      </span>
                    </label>
                  ))}
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => {
                      const checks = document.querySelectorAll<HTMLInputElement>(`input[data-hero="${hero.id}"]:checked`);
                      const selected = Array.from(checks).map((el) => {
                        const idx = parseInt(el.dataset.idx || "0");
                        return foundQuotes[hero.id][idx];
                      });
                      const merged = [...(hero.quotes || []), ...selected];
                      saveQuotes(hero.id, merged);
                    }}
                    disabled={savingQuotes === hero.id}
                    className="px-3 py-1.5 rounded-lg text-xs flex items-center gap-1"
                    style={{ backgroundColor: "var(--accent)", color: "#fff", opacity: savingQuotes === hero.id ? 0.6 : 1 }}
                  >
                    {savingQuotes === hero.id ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                    Save Selected
                  </button>
                  <button
                    onClick={() => setFoundQuotes((prev) => { const copy = { ...prev }; delete copy[hero.id]; return copy; })}
                    className="px-3 py-1.5 rounded-lg text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}
            {foundQuotes[hero.id] && foundQuotes[hero.id].length === 0 && searchingQuotes !== hero.id && (
              <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
                No verified quotes found for {hero.name}. They may be a personal hero — you can add quotes manually.
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Add hero */}
      {showAdd ? (
        <div className="mt-4 p-4 rounded-lg border" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)" }}>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Hero's name"
            className="w-full px-3 py-2 rounded-lg text-sm outline-none mb-3"
            style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
          />
          <textarea
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Why do they inspire you? (optional)"
            rows={2}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none mb-3"
            style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
          />
          <div className="flex gap-2">
            <button onClick={addHero} className="px-4 py-2 rounded-lg text-sm" style={{ backgroundColor: "var(--accent)", color: "#fff" }}>
              Add Hero
            </button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-lg text-sm" style={{ color: "var(--text-muted)" }}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="mt-4 flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm"
          style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
        >
          <Plus size={16} />
          Add a Hero
        </button>
      )}
    </div>
  );
}
