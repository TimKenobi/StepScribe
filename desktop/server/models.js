/**
 * Shared model data — mood weather, memory categories, recommended models, etc.
 * Users define their own faith/tradition and heroes during setup — we don't dictate.
 */

// No pre-filled faith traditions. Like AA, we don't dictate a higher power.
// Users describe their faith, spiritual tradition, or philosophy in their own words.
const FAITH_TRADITIONS = {};

const MOOD_WEATHER = {
  radiant: { label: "Radiant", description: "Glowing. Everything feels alive and beautiful.", intensity: 10 },
  golden_hour: { label: "Golden Hour", description: "Grateful and warm. The world feels like a gift.", intensity: 9 },
  mountain_top: { label: "Mountain Top", description: "On top of the world. Strong, accomplished, free.", intensity: 10 },
  abundant: { label: "Abundant", description: "Overflowing. More than enough joy to share.", intensity: 9 },
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

// No pre-filled heroes. Users add their own heroes — people whose character they want to emulate.
const DEFAULT_HEROES = [];

const MEMORY_CATEGORIES = [
  "struggle", "strength", "pattern", "relationship", "trigger",
  "insight", "preference", "milestone", "background",
];

const RECOMMENDED_MODELS = {
  "alientelligence/psychologist": {
    name: "alientelligence/psychologist", label: "Psychologist (ALIENTELLIGENCE)",
    description: "Designed for therapeutic-style conversations. Understands mental health context. Recommended for recovery journaling.",
    size: "~4.1 GB", parameters: "7B",
  },
  "samantha-mistral": {
    name: "samantha-mistral", label: "Samantha (Mistral-based)",
    description: "Empathetic, conversational AI assistant. Great for journaling and emotional support.",
    size: "~4.1 GB", parameters: "7B",
  },
  "llama3.3": {
    name: "llama3.3", label: "Llama 3.3 (Meta)",
    description: "Powerful general-purpose model. Strong reasoning and instruction following.",
    size: "~4.7 GB", parameters: "8B",
  },
  "qwen3:8b": {
    name: "qwen3:8b", label: "Qwen 3 8B",
    description: "Excellent structure and reasoning. Great for guided prompts.",
    size: "~4.9 GB", parameters: "8B",
  },
};

const STEP_COMPANION_MODELFILE = (baseModel) => `FROM ${baseModel}

SYSTEM """
You are StepCompanion, a warm, experienced 12-step sponsor AI inside a private journaling app.
You follow the exact 12 Steps, Traditions, and Big Book language.
You NEVER diagnose, give medical advice, or replace a real sponsor/group/Higher Power.

Core rules:
- Start every response with a short validation of feelings.
- Reference the current step number + Big Book principle when relevant.
- Always end with: 1) One open reflection question 2) Encouragement to journal or call a real person 3) Safety note if appropriate.
- Output ONLY valid JSON when asked for prompts/inventories so the app can render UI nicely.
- Use gentle spiritual language: Higher Power, surrender, amends, inventory, etc.
- If user seems in crisis: "Please reach out to a real human sponsor, your support group, or call 988 (Suicide & Crisis Lifeline) right now. You are not alone."

You have read the entire Big Book and understand all 12 Steps deeply.

YOUR CHARACTER:
- You speak like a trusted friend who has walked a hard road and come out the other side.
- You are warm but honest. You don't sugarcoat, but you never shame.
- You use stories, metaphors, and questions more than instructions.
- You know that real growth comes from the person, not from you. Your job is to hold up a mirror.
- You have a quiet sense of humor — not sarcastic, but the kind that comes from seeing life clearly.
- Match their energy. If they're raw, be gentle. If they're deflecting, be direct.
"""

PARAMETER temperature 0.7
PARAMETER num_ctx 32768
PARAMETER top_p 0.9
`;

module.exports = {
  FAITH_TRADITIONS, MOOD_WEATHER, DEFAULT_HEROES, MEMORY_CATEGORIES,
  RECOMMENDED_MODELS, STEP_COMPANION_MODELFILE,
};
