"use client";

import { useState, useEffect } from "react";
import { Quote } from "@/lib/types";
import { heroesApi } from "@/lib/api";

// Universal recovery/growth quotes — no specific tradition assumed
const FALLBACK_QUOTES: Quote[] = [
  { author: "Marcus Aurelius", text: "You have power over your mind — not outside events. Realize this, and you will find strength.", source: "Meditations" },
  { author: "J.R.R. Tolkien", text: "There is some good in this world, Mr. Frodo, and it's worth fighting for.", source: "The Two Towers" },
  { author: "C.S. Lewis", text: "There are far, far better things ahead than any we leave behind.", source: "Letters" },
  { author: "Epictetus", text: "It's not what happens to you, but how you react to it that matters.", source: "Discourses" },
  { author: "G.K. Chesterton", text: "Hope is the power of being cheerful in circumstances which we know to be desperate.", source: "Heretics" },
  { author: "Seneca", text: "Begin at once to live, and count each separate day as a separate life.", source: "Letters to Lucilius" },
  { author: "Viktor Frankl", text: "When we are no longer able to change a situation, we are challenged to change ourselves.", source: "Man's Search for Meaning" },
  { author: "Viktor Frankl", text: "Everything can be taken from a man but one thing: the last of the human freedoms — to choose one's attitude.", source: "Man's Search for Meaning" },
  { author: "Brené Brown", text: "Owning our story and loving ourselves through that process is the bravest thing that we'll ever do.", source: "The Gifts of Imperfection" },
  { author: "Carl Jung", text: "I am not what happened to me, I am what I choose to become.", source: "Attributed" },
  { author: "Lao Tzu", text: "A journey of a thousand miles begins with a single step.", source: "Tao Te Ching" },
  { author: "Helen Keller", text: "Although the world is full of suffering, it is also full of the overcoming of it.", source: "Optimism" },
  { author: "Ralph Waldo Emerson", text: "What lies behind us and what lies before us are tiny matters compared to what lies within us.", source: "Essays" },
  { author: "Bill W.", text: "We are not saints. The point is that we are willing to grow along spiritual lines.", source: "Alcoholics Anonymous" },
  { author: "Aleksandr Solzhenitsyn", text: "The line separating good and evil passes not through states, nor between classes, nor between political parties either — but right through every human heart.", source: "The Gulag Archipelago" },
  { author: "Joseph Campbell", text: "The cave you fear to enter holds the treasure you seek.", source: "The Hero with a Thousand Faces" },
];

interface HeroQuotesProps {
  quotes?: Quote[];
  refreshInterval?: number; // ms between quote changes
}

export default function HeroQuotes({ quotes, refreshInterval = 30000 }: HeroQuotesProps) {
  const [heroQuotes, setHeroQuotes] = useState<Quote[]>([]);
  const allQuotes = heroQuotes.length > 0
    ? heroQuotes
    : quotes && quotes.length > 0
      ? quotes
      : FALLBACK_QUOTES;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fading, setFading] = useState(false);

  // Load quotes from user's heroes
  useEffect(() => {
    heroesApi.quotes?.()
      .then((data: Quote[]) => { if (data?.length) setHeroQuotes(data); })
      .catch(() => {});
  }, []);

  // Randomize starting quote client-side only to avoid hydration mismatch
  useEffect(() => { setCurrentIndex(Math.floor(Math.random() * allQuotes.length)); }, [allQuotes.length]);

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
