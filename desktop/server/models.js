/**
 * Shared model data — faith traditions, mood weather, default heroes, etc.
 * Port of Python models.py data constants.
 */

const FAITH_TRADITIONS = {
  traditional_catholic: {
    label: "Traditional Catholic",
    description: "Latin Mass, devotion to the Saints, Rosary, sacramental life.",
    figures: ["St. Thomas Aquinas", "St. Augustine", "St. Thérèse of Lisieux", "St. Padre Pio", "Our Lady"],
    practices: ["Daily Rosary", "Examination of Conscience", "Confession", "Eucharistic Adoration", "Liturgy of the Hours"],
  },
  roman_catholic: {
    label: "Roman Catholic",
    description: "Novus Ordo, parish life, social teaching, sacraments.",
    figures: ["St. Francis of Assisi", "St. Teresa of Calcutta", "St. John Paul II", "St. Ignatius of Loyola"],
    practices: ["Mass", "Rosary", "Lectio Divina", "Works of Mercy", "Confession"],
  },
  eastern_orthodox: {
    label: "Eastern Orthodox",
    description: "Divine Liturgy, icons, the Jesus Prayer, theosis.",
    figures: ["St. John Chrysostom", "St. Seraphim of Sarov", "St. Theophan the Recluse"],
    practices: ["Jesus Prayer", "Fasting", "Divine Liturgy", "Icon veneration", "Confession"],
  },
  protestant: {
    label: "Protestant / Evangelical",
    description: "Scripture-centered, personal relationship with Christ, community.",
    figures: ["Dietrich Bonhoeffer", "C.S. Lewis", "Charles Spurgeon", "Corrie ten Boom"],
    practices: ["Bible study", "Prayer", "Worship", "Small groups", "Devotionals"],
  },
  jewish: {
    label: "Jewish",
    description: "Torah, Talmud, mitzvot, the rhythm of Shabbat and holy days.",
    figures: ["Rabbi Nachman of Breslov", "Maimonides", "Viktor Frankl", "Abraham Joshua Heschel"],
    practices: ["Shabbat", "Torah study", "Prayer", "Tikkun olam", "Musar"],
  },
  buddhist: {
    label: "Buddhist",
    description: "The Eightfold Path, mindfulness, compassion, letting go of attachment.",
    figures: ["Thich Nhat Hanh", "Pema Chödrön", "The Dalai Lama", "Shunryu Suzuki"],
    practices: ["Meditation", "Mindfulness", "Right speech", "Loving-kindness", "Sangha"],
  },
  muslim: {
    label: "Muslim",
    description: "The Five Pillars, Quran, surrender to God, community (ummah).",
    figures: ["Rumi", "Imam al-Ghazali", "Malcolm X"],
    practices: ["Salah (prayer)", "Quran recitation", "Dhikr", "Fasting", "Charity"],
  },
  stoic_philosophical: {
    label: "Stoic / Philosophical",
    description: "Virtue ethics, focus on what you can control, rational self-examination.",
    figures: ["Marcus Aurelius", "Epictetus", "Seneca", "Viktor Frankl"],
    practices: ["Morning reflection", "Evening review", "Negative visualization", "Journaling", "Memento mori"],
  },
  spiritual_not_religious: {
    label: "Spiritual but Not Religious",
    description: "Higher Power as you understand it. The 12-step tradition of open spirituality.",
    figures: ["Bill W.", "Carl Jung", "Joseph Campbell", "Ram Dass"],
    practices: ["Meditation", "Gratitude", "Prayer to Higher Power", "Service", "Step work"],
  },
  secular: {
    label: "Secular / Non-Religious",
    description: "Recovery through reason, community, personal responsibility, and human connection.",
    figures: ["Albert Camus", "Viktor Frankl", "Brené Brown", "Jordan Peterson"],
    practices: ["Journaling", "Cognitive reframing", "Community service", "Self-reflection", "Rational self-analysis"],
  },
  other: {
    label: "Other",
    description: "A tradition not listed here. You can describe it and the AI will adapt.",
    figures: [],
    practices: [],
  },
};

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

const DEFAULT_HEROES = [
  { name: "St. Augustine", description: "Bishop of Hippo, convert, Doctor of the Church. Wrote the Confessions — the original recovery story. 'Our hearts are restless until they rest in Thee.'" },
  { name: "St. Thomas Aquinas", description: "The Angelic Doctor. Synthesized faith and reason. Proved that thinking deeply and believing deeply are not opposites." },
  { name: "St. Padre Pio", description: "Capuchin friar, mystic, bearer of the stigmata. Knew suffering intimately and turned it into intercession. 'Pray, hope, and don't worry.'" },
  { name: "St. Francis de Sales", description: "Bishop of Geneva, Doctor of the Church. Wrote Introduction to the Devout Life — practical holiness for ordinary people living in the world." },
  { name: "St. John of the Cross", description: "Carmelite mystic and Doctor of the Church. The Dark Night of the Soul is the recovery journey in mystical language — purification through darkness." },
  { name: "Matt Talbot", description: "Dublin laborer, severe alcoholic, converted at 28. Lived 40+ years of heroic penance and prayer. Patron of addiction recovery." },
  { name: "J.R.R. Tolkien", description: "Devout Catholic. Called The Lord of the Rings 'a fundamentally religious and Catholic work.' Credited the Blessed Sacrament for everything good in his writing and life." },
  { name: "G.K. Chesterton", description: "Catholic convert, writer, and apologist. Believed that gratitude is the highest form of thought, and that wonder is the beginning of wisdom." },
  { name: "Hilaire Belloc", description: "Catholic historian, essayist, and poet. Fierce defender of the Faith. 'The Faith is Europe, and Europe is the Faith.'" },
  { name: "Peter Kreeft", description: "Catholic philosopher at Boston College. Modern-day Socrates — makes ancient wisdom accessible and alive. Convert from Calvinism." },
  { name: "Fulton Sheen", description: "Archbishop, television evangelist, Servant of God. Could explain the deepest theology in language anyone could understand. Master of the examined life." },
  { name: "Flannery O'Connor", description: "Catholic fiction writer. Grace in the grotesque. Unflinching honesty about human nature and the violent mercy of God." },
  { name: "Scott Weeman", description: "Founder of Catholics in Recovery. Bridges the 12 Steps and the Sacraments. Living proof that the Church and recovery work together." },
  { name: "Blaise Pascal", description: "Mathematician, physicist, Catholic philosopher. The Pensées are fragments of brilliance on faith, reason, and the human condition." },
  { name: "Fr. Walter Ciszek, SJ", description: "American Jesuit imprisoned in Soviet gulags for 23 years. Wrote He Leadeth Me — ultimate trust in God under unbearable pressure." },
  { name: "Jacques Philippe", description: "French priest and spiritual writer. Interior Freedom and Searching for and Maintaining Peace — deeply practical Catholic wisdom for the interior life." },
  { name: "Dom Prosper Guéranger", description: "Restorer of Benedictine monastic life in France. Champion of the traditional liturgy. Founded Solesmes Abbey." },
  { name: "Archbishop Marcel Lefebvre", description: "Founder of the SSPX. Stood firm for Tradition when the world moved on. 'We must keep the Faith.'" },
  { name: "C.S. Lewis", description: "Anglican author and apologist. Close friend of Tolkien. Wrote honestly about grief, faith, and the painful process of becoming who you're meant to be." },
  { name: "Marcus Aurelius", description: "Roman Emperor and Stoic philosopher. Wrote Meditations as a private journal — reminders to himself about what matters and what doesn't." },
  { name: "Epictetus", description: "Born a slave, became a great Stoic teacher. Core teaching: focus only on what you can control — your thoughts, your choices, your responses." },
  { name: "Seneca", description: "Stoic philosopher and statesman. Wrote about anger, grief, and the shortness of life with unflinching honesty and practical wisdom." },
  { name: "Viktor Frankl", description: "Holocaust survivor. Man's Search for Meaning — found purpose inside suffering. 'He who has a why to live can bear almost any how.'" },
  { name: "Aleksandr Solzhenitsyn", description: "Russian Nobel laureate. Survived the Gulag. 'The line between good and evil runs through every human heart.'" },
];

const MEMORY_CATEGORIES = [
  "struggle", "strength", "pattern", "relationship", "trigger",
  "insight", "preference", "milestone", "background",
];

const RECOMMENDED_MODELS = {
  "samantha-mistral": {
    name: "samantha-mistral", label: "Samantha (Mistral-based)",
    description: "Empathetic, conversational AI assistant. Great for journaling and emotional support.",
    size: "~4.1 GB", parameters: "7B",
  },
  "alientelligence/psychologist": {
    name: "alientelligence/psychologist", label: "Psychologist (ALIENTELLIGENCE)",
    description: "Designed for therapeutic-style conversations. Understands mental health context.",
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
