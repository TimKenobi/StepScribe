"use client";

import { useState, useEffect } from "react";
import { Quote } from "@/lib/types";

// Quotes are loaded from the backend, but we include a small set for offline use
const FALLBACK_QUOTES: Quote[] = [
  { author: "Marcus Aurelius", text: "You have power over your mind — not outside events. Realize this, and you will find strength.", source: "Meditations" },
  { author: "J.R.R. Tolkien", text: "There is some good in this world, Mr. Frodo, and it's worth fighting for.", source: "The Two Towers" },
  { author: "C.S. Lewis", text: "There are far, far better things ahead than any we leave behind.", source: "Letters" },
  { author: "Epictetus", text: "It's not what happens to you, but how you react to it that matters.", source: "Discourses" },
  { author: "G.K. Chesterton", text: "Hope is the power of being cheerful in circumstances which we know to be desperate.", source: "Heretics" },
  { author: "Seneca", text: "Begin at once to live, and count each separate day as a separate life.", source: "Letters to Lucilius" },
];

interface HeroQuotesProps {
  quotes?: Quote[];
  refreshInterval?: number; // ms between quote changes
}

export default function HeroQuotes({ quotes, refreshInterval = 30000 }: HeroQuotesProps) {
  const allQuotes = quotes && quotes.length > 0 ? quotes : FALLBACK_QUOTES;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fading, setFading] = useState(false);

  // Randomize starting quote client-side only to avoid hydration mismatch
  useEffect(() => { setCurrentIndex(Math.floor(Math.random() * allQuotes.length)); }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % allQuotes.length);
        setFading(false);
      }, 500);
    }, refreshInterval);
    return () => clearInterval(interval);
  }, [allQuotes.length, refreshInterval]);

  const quote = allQuotes[currentIndex];

  return (
    <div
      className="p-6 rounded-lg border transition-opacity duration-500"
      style={{
        borderColor: "var(--border)",
        backgroundColor: "var(--bg-secondary)",
        opacity: fading ? 0.3 : 1,
      }}
    >
      <blockquote className="text-base leading-relaxed italic" style={{ color: "var(--text-primary)" }}>
        &ldquo;{quote.text}&rdquo;
      </blockquote>
      <div className="mt-3 flex items-center gap-2">
        <div className="w-6 h-px" style={{ backgroundColor: "var(--accent-muted)" }} />
        <cite className="text-sm not-italic" style={{ color: "var(--text-secondary)" }}>
          {quote.author}
        </cite>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          — {quote.source}
        </span>
      </div>
    </div>
  );
}
