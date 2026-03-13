"use client";

import { useState } from "react";
import { WEATHER_OPTIONS, WEATHER_COLORS } from "@/lib/types";

interface MoodWeatherProps {
  selected?: string;
  onSelect: (weather: string) => void;
  energyLevel?: number;
  onEnergyChange?: (level: number) => void;
}

export default function MoodWeather({
  selected,
  onSelect,
  energyLevel = 5,
  onEnergyChange,
}: MoodWeatherProps) {
  return (
    <div>
      <h3 className="text-sm font-medium mb-3" style={{ color: "var(--text-secondary)" }}>
        How are you today? — Your Inner Weather
      </h3>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {Object.entries(WEATHER_OPTIONS).map(([key, weather]) => (
          <button
            key={key}
            onClick={() => onSelect(key)}
            className="weather-card text-left p-4 rounded-lg border transition-all"
            style={{
              borderColor: selected === key ? WEATHER_COLORS[key] : "var(--border)",
              backgroundColor: selected === key ? "var(--bg-tertiary)" : "var(--bg-secondary)",
            }}
          >
            {/* Color indicator bar instead of emoji */}
            <div
              className="w-8 h-1.5 rounded-full mb-3"
              style={{ backgroundColor: WEATHER_COLORS[key] }}
            />
            <div className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>
              {weather.label}
            </div>
            <div className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
              {weather.description}
            </div>
          </button>
        ))}
      </div>

      {/* Energy level */}
      {onEnergyChange && (
        <div className="mt-6">
          <label className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Energy Level: <span style={{ color: "var(--text-primary)" }}>{energyLevel}/10</span>
          </label>
          <input
            type="range"
            min={1}
            max={10}
            value={energyLevel}
            onChange={(e) => onEnergyChange(parseInt(e.target.value))}
            className="w-full mt-2 accent-[var(--accent)]"
            style={{ accentColor: "var(--accent)" }}
          />
          <div className="flex justify-between text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            <span>Running on empty</span>
            <span>Full strength</span>
          </div>
        </div>
      )}
    </div>
  );
}
