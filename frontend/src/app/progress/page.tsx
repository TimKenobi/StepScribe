"use client";

import { useState, useEffect } from "react";
import OneDayAtATime from "@/components/OneDayAtATime";
import { journalApi, moodApi } from "@/lib/api";
import { WEATHER_OPTIONS, WEATHER_COLORS } from "@/lib/types";

export default function ProgressPage() {
  const [journaledDates, setJournaledDates] = useState<string[]>([]);
  const [moodHistory, setMoodHistory] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [entries, moods] = await Promise.all([
        journalApi.list("default", 365),
        moodApi.history("default", 365),
      ]);
      setJournaledDates(entries.map((e: any) => e.created_at));
      setMoodHistory(moods);
    } catch {}
  };

  // Recent mood trend (last 7)
  const recentMoods = moodHistory.slice(0, 7).reverse();

  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="text-2xl font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
        One Day at a Time
      </h1>
      <p className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>
        You don&apos;t have to do this perfectly. You just have to keep showing up.
      </p>

      <OneDayAtATime journaledDates={journaledDates} />

      {/* Recent inner weather trend */}
      {recentMoods.length > 0 && (
        <div className="mt-12">
          <h2 className="text-lg font-medium mb-4" style={{ color: "var(--text-primary)" }}>
            Recent Inner Weather
          </h2>
          <div className="flex items-end gap-3 h-24">
            {recentMoods.map((mood: any, i: number) => {
              const weather = WEATHER_OPTIONS[mood.weather];
              const height = weather ? (weather.intensity / 10) * 100 : 50;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t-lg transition-all"
                    style={{
                      height: `${height}%`,
                      backgroundColor: WEATHER_COLORS[mood.weather] || "var(--bg-tertiary)",
                    }}
                    title={weather?.label}
                  />
                  <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                    {weather?.label?.split(" ")[0]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
