"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { format, subMonths, addMonths } from "date-fns";
import { ChevronLeft, ChevronRight, BookOpen, X } from "lucide-react";
import OneDayAtATime from "@/components/OneDayAtATime";
import { journalApi, moodApi } from "@/lib/api";
import { WEATHER_OPTIONS, WEATHER_COLORS } from "@/lib/types";

interface EntryBrief {
  id: string;
  title: string;
  created_at: string;
  is_draft: boolean;
}

export default function ProgressPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<EntryBrief[]>([]);
  const [moodHistory, setMoodHistory] = useState<any[]>([]);
  const [currentMonth, setCurrentMonth] = useState<Date | null>(null);
  useEffect(() => { if (!currentMonth) setCurrentMonth(new Date()); }, []);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayEntries, setDayEntries] = useState<EntryBrief[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [entryList, moods] = await Promise.all([
        journalApi.list("default", 365),
        moodApi.history("default", 365),
      ]);
      setEntries(entryList);
      setMoodHistory(moods);
    } catch {}
  };

  const journaledDates = entries.map((e) => e.created_at);

  const handleDayClick = (dateStr: string) => {
    if (selectedDate === dateStr) {
      setSelectedDate(null);
      setDayEntries([]);
      return;
    }
    setSelectedDate(dateStr);
    const matching = entries.filter(
      (e) => format(new Date(e.created_at), "yyyy-MM-dd") === dateStr
    );
    setDayEntries(matching);
  };

  const openEntry = (id: string) => {
    // Navigate to journal page — the main page handles entry selection
    router.push(`/?entry=${id}`);
  };

  // Mood for selected date
  const selectedMood = selectedDate
    ? moodHistory.find((m) => format(new Date(m.created_at), "yyyy-MM-dd") === selectedDate)
    : null;

  // Recent mood trend (last 14)
  const recentMoods = moodHistory.slice(0, 14).reverse();

  // Stats
  const totalEntries = entries.filter((e) => !e.is_draft).length;
  const thisMonthEntries = currentMonth ? entries.filter((e) => {
    const d = new Date(e.created_at);
    return d.getMonth() === currentMonth.getMonth() && d.getFullYear() === currentMonth.getFullYear() && !e.is_draft;
  }).length : 0;

  if (!currentMonth) return null;

  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="text-2xl font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
        One Day at a Time
      </h1>
      <p className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>
        You don&apos;t have to do this perfectly. You just have to keep showing up.
      </p>

      {/* Stats row */}
      <div className="flex gap-4 mb-8">
        <div
          className="flex-1 p-4 rounded-lg border text-center"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)" }}
        >
          <div className="text-2xl font-semibold" style={{ color: "var(--accent)" }}>{totalEntries}</div>
          <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Total entries</div>
        </div>
        <div
          className="flex-1 p-4 rounded-lg border text-center"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)" }}
        >
          <div className="text-2xl font-semibold" style={{ color: "var(--accent)" }}>{thisMonthEntries}</div>
          <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>This month</div>
        </div>
        <div
          className="flex-1 p-4 rounded-lg border text-center"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)" }}
        >
          <div className="text-2xl font-semibold" style={{ color: "var(--accent)" }}>{moodHistory.length}</div>
          <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Mood check-ins</div>
        </div>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => currentMonth && setCurrentMonth(subMonths(currentMonth, 1))}
          className="p-2 rounded-lg"
          style={{ color: "var(--text-muted)" }}
        >
          <ChevronLeft size={18} />
        </button>
        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          {format(currentMonth, "MMMM yyyy")}
        </span>
        <button
          onClick={() => currentMonth && setCurrentMonth(addMonths(currentMonth, 1))}
          className="p-2 rounded-lg"
          style={{ color: "var(--text-muted)" }}
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <OneDayAtATime
        journaledDates={journaledDates}
        currentMonth={currentMonth}
        onDayClick={handleDayClick}
        selectedDate={selectedDate}
      />

      {/* Selected day detail panel */}
      {selectedDate && (
        <div
          className="mt-6 p-4 rounded-lg border"
          style={{ borderColor: "var(--accent-muted, var(--accent))", backgroundColor: "var(--bg-secondary)" }}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              {format(new Date(selectedDate), "EEEE, MMMM d, yyyy")}
            </h3>
            <button onClick={() => { setSelectedDate(null); setDayEntries([]); }}>
              <X size={16} style={{ color: "var(--text-muted)" }} />
            </button>
          </div>

          {/* Mood for that day */}
          {selectedMood && (
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: WEATHER_COLORS[selectedMood.weather] || "var(--bg-tertiary)" }}
              />
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {WEATHER_OPTIONS[selectedMood.weather]?.label || selectedMood.weather}
                {selectedMood.note && ` — ${selectedMood.note}`}
              </span>
            </div>
          )}

          {/* Entries for that day */}
          {dayEntries.length > 0 ? (
            <div className="space-y-2">
              {dayEntries.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => openEntry(entry.id)}
                  className="w-full text-left flex items-center gap-3 p-3 rounded-lg border transition-colors hover:border-[var(--accent)]"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)" }}
                >
                  <BookOpen size={16} style={{ color: "var(--accent)" }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                      {entry.title || "Untitled"}
                    </div>
                    <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                      {entry.is_draft ? "Draft" : "Published"}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              No journal entries on this day.
            </p>
          )}
        </div>
      )}

      {/* Recent inner weather trend */}
      {recentMoods.length > 0 && (
        <div className="mt-12">
          <h2 className="text-lg font-medium mb-4" style={{ color: "var(--text-primary)" }}>
            Recent Inner Weather
          </h2>
          <div className="flex items-end gap-2 h-28">
            {recentMoods.map((mood: any, i: number) => {
              const weather = WEATHER_OPTIONS[mood.weather];
              const height = weather ? (weather.intensity / 10) * 100 : 50;
              const dateStr = format(new Date(mood.created_at), "MMM d");
              return (
                <button
                  key={i}
                  onClick={() => handleDayClick(format(new Date(mood.created_at), "yyyy-MM-dd"))}
                  className="flex-1 flex flex-col items-center gap-1 cursor-pointer group"
                  title={`${weather?.label} — ${dateStr}`}
                >
                  <div
                    className="w-full rounded-t-lg transition-all group-hover:opacity-80"
                    style={{
                      height: `${height}%`,
                      backgroundColor: WEATHER_COLORS[mood.weather] || "var(--bg-tertiary)",
                    }}
                  />
                  <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>
                    {dateStr}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex justify-between mt-2 text-[10px]" style={{ color: "var(--text-muted)" }}>
            <span>Rougher</span>
            <span>Brighter</span>
          </div>
        </div>
      )}
    </div>
  );
}
