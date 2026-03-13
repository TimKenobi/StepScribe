export interface JournalEntry {
  id: string;
  user_id: string;
  title: string;
  content: string;
  content_html: string;
  prompt_used: string | null;
  is_draft: boolean;
  sections_included: Record<string, boolean> | null;
  created_at: string;
  updated_at: string;
}

export interface MoodWeather {
  label: string;
  description: string;
  intensity: number;
}

export interface MoodEntry {
  id: string;
  user_id: string;
  entry_id: string | null;
  weather: string;
  weather_label: string;
  weather_description: string;
  note: string;
  energy_level: number;
  created_at: string;
}

export interface Hero {
  id: string;
  user_id: string;
  name: string;
  description: string;
  is_active: boolean;
  sort_order: number;
}

export interface Quote {
  author: string;
  text: string;
  source: string;
}

export interface PromptTemplate {
  name: string;
  description: string;
  prompt: string;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  invite_code: string;
  created_by: string;
  created_at: string;
}

export interface SyncEntry {
  id?: string;
  title: string;
  content: string;
  content_html: string;
  prompt_used?: string | null;
  is_draft: boolean;
  created_at?: string;
  updated_at?: string;
  mood_weather?: string;
  mood_note?: string;
  mood_energy?: number;
}

export interface FaithTradition {
  label: string;
  description: string;
}

export interface UserFaith {
  faith_tradition: string;
  faith_notes: string;
  tradition_label: string;
  tradition_description: string;
  figures: string[];
  practices: string[];
}

export interface OnboardingStatus {
  onboarding_complete: boolean;
  faith_tradition: string;
  faith_label: string;
  hero_count: number;
}

export interface AIMemory {
  id: string;
  category: string;
  content: string;
  source: string;
  source_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  entry_id: string | null;
  messages: ConversationMessage[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Inner Weather options — no emojis, just meaningful descriptions
export const WEATHER_OPTIONS: Record<string, MoodWeather> = {
  first_light: { label: "First Light", description: "Hopeful. A new beginning on the horizon.", intensity: 8 },
  clear_skies: { label: "Clear Skies", description: "Peaceful and content. Steady ground.", intensity: 9 },
  gentle_breeze: { label: "Gentle Breeze", description: "Light and easy. Things feel manageable.", intensity: 7 },
  still_waters: { label: "Still Waters", description: "Calm, reflective. A quiet strength.", intensity: 6 },
  partly_cloudy: { label: "Partly Cloudy", description: "Mixed feelings. Some sun, some shadow.", intensity: 5 },
  overcast: { label: "Overcast", description: "Heavy. Carrying a weight today.", intensity: 4 },
  fog: { label: "Fog", description: "Uncertain. Hard to see the path ahead.", intensity: 3 },
  light_rain: { label: "Light Rain", description: "Sad but not lost. Letting things fall.", intensity: 3 },
  rough_seas: { label: "Rough Seas", description: "Anxious. Waves crashing, hard to stay upright.", intensity: 2 },
  storm: { label: "Storm", description: "Crisis. Everything feels overwhelming.", intensity: 1 },
  calm_after_storm: { label: "Calm After Storm", description: "Exhausted but relieved. The worst has passed.", intensity: 5 },
  dawn_breaking: { label: "Dawn Breaking", description: "Coming through darkness. Light is returning.", intensity: 7 },
};

// Weather colors mapped by intensity (dark mode friendly, muted tones)
export const WEATHER_COLORS: Record<string, string> = {
  first_light: "#c4956a",
  clear_skies: "#6b8aaf",
  gentle_breeze: "#7a9a7a",
  still_waters: "#5a7a8a",
  partly_cloudy: "#8a8a6a",
  overcast: "#6a6a6a",
  fog: "#555566",
  light_rain: "#5a6a7a",
  rough_seas: "#7a5a5a",
  storm: "#6a4a4a",
  calm_after_storm: "#6a7a6a",
  dawn_breaking: "#b89a6a",
};
