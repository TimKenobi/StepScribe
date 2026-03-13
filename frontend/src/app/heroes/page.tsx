"use client";

import { useState, useEffect } from "react";
import { Plus, X, ToggleLeft, ToggleRight } from "lucide-react";
import HeroQuotes from "@/components/HeroQuotes";
import { heroesApi } from "@/lib/api";
import { Hero } from "@/lib/types";

export default function HeroesPage() {
  const [heroes, setHeroes] = useState<Hero[]>([]);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [showAdd, setShowAdd] = useState(false);

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
            className="flex items-start gap-4 p-4 rounded-lg border"
            style={{
              borderColor: "var(--border)",
              backgroundColor: "var(--bg-secondary)",
              opacity: hero.is_active ? 1 : 0.5,
            }}
          >
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
