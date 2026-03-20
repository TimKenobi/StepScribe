/**
 * Offline storage using localStorage.
 * Entries created offline are stored locally and synced when connection is restored.
 */

import { SyncEntry } from "./types";

const OFFLINE_KEY = "stepscribe_offline_entries";
const SETTINGS_KEY = "stepscribe_settings";

export function getOfflineEntries(): SyncEntry[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(OFFLINE_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function saveOfflineEntry(entry: SyncEntry): void {
  const entries = getOfflineEntries();
  entries.push(entry);
  localStorage.setItem(OFFLINE_KEY, JSON.stringify(entries));
}

export function clearOfflineEntries(): void {
  localStorage.removeItem(OFFLINE_KEY);
}

export function getOfflineCount(): number {
  return getOfflineEntries().length;
}

// Check if the backend is reachable
export async function isOnline(): Promise<boolean> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    const res = await fetch(`${apiUrl}/health`, { method: "GET", signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

// Export all data as a downloadable JSON file
export function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Import JSON file
export function importJsonFile(): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return reject(new Error("No file selected"));
      const text = await file.text();
      try {
        resolve(JSON.parse(text));
      } catch {
        reject(new Error("Invalid JSON file"));
      }
    };
    input.click();
  });
}

// Settings persistence
export function getSettings(): Record<string, unknown> {
  if (typeof window === "undefined") return {};
  const raw = localStorage.getItem(SETTINGS_KEY);
  return raw ? JSON.parse(raw) : {};
}

export function saveSetting(key: string, value: unknown): void {
  const settings = getSettings();
  settings[key] = value;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
