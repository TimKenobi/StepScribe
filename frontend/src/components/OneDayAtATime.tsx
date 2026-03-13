"use client";

import { useMemo } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday } from "date-fns";

interface OneDayAtATimeProps {
  journaledDates: string[]; // ISO date strings of days with entries
  currentMonth?: Date;
  onDayClick?: (dateStr: string) => void;
  selectedDate?: string | null;
}

/**
 * One Day at a Time — NOT a streak counter.
 *
 * Shows a gentle calendar where each day you journaled gets a quiet marker.
 * No streaks, no penalties for missing days. Just "today" matters.
 * Empty days aren't failures — they're just days you haven't filled yet.
 */
export default function OneDayAtATime({
  journaledDates,
  currentMonth = new Date(),
  onDayClick,
  selectedDate,
}: OneDayAtATimeProps) {
  const days = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const journaledSet = useMemo(
    () => new Set(journaledDates.map((d) => format(new Date(d), "yyyy-MM-dd"))),
    [journaledDates]
  );

  const totalDays = journaledSet.size;

  return (
    <div>
      {/* Today's focus */}
      <div className="mb-6 p-5 rounded-lg border" style={{ borderColor: "var(--accent-muted)", backgroundColor: "var(--bg-secondary)" }}>
        <p className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>
          Today is {format(new Date(), "EEEE, MMMM d")}
        </p>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          Just today. That&apos;s all you need to think about.
        </p>
      </div>

      {/* Month header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
          {format(currentMonth, "MMMM yyyy")}
        </h3>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          {totalDays} {totalDays === 1 ? "day" : "days"} you showed up
        </p>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={i} className="text-center text-xs py-1" style={{ color: "var(--text-muted)" }}>
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Offset for start day */}
        {Array.from({ length: days[0].getDay() }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}

        {days.map((day) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const hasEntry = journaledSet.has(dateStr);
          const today = isToday(day);
          const isSelected = selectedDate === dateStr;

          return (
            <button
              key={dateStr}
              onClick={() => onDayClick?.(dateStr)}
              className="aspect-square flex items-center justify-center rounded-lg text-xs relative transition-colors"
              style={{
                backgroundColor: isSelected
                  ? "var(--accent-muted, rgba(139,92,246,0.15))"
                  : today
                  ? "var(--bg-tertiary)"
                  : "transparent",
                border: isSelected
                  ? "1px solid var(--accent)"
                  : today
                  ? "1px solid var(--accent-muted, var(--border))"
                  : "1px solid transparent",
                color: hasEntry ? "var(--text-primary)" : "var(--text-muted)",
                cursor: onDayClick ? "pointer" : "default",
              }}
            >
              {day.getDate()}
              {/* Quiet dot for days you showed up */}
              {hasEntry && (
                <div
                  className="absolute bottom-1 w-1 h-1 rounded-full"
                  style={{ backgroundColor: "var(--accent)" }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Gentle message */}
      <p className="text-xs mt-4 text-center italic" style={{ color: "var(--text-muted)" }}>
        No streaks. No pressure. Every day is a fresh start.
      </p>
    </div>
  );
}
