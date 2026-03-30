const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`API error ${res.status}: ${error}`);
  }
  return res.json();
}

// Journal
export const journalApi = {
  list: (userId = "default", limit = 50) =>
    request<any[]>(`/api/journal/entries?user_id=${userId}&limit=${limit}`),
  get: (id: string) => request<any>(`/api/journal/entries/${id}`),
  create: (data: any) =>
    request<any>("/api/journal/entries", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: any) =>
    request<any>(`/api/journal/entries/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<any>(`/api/journal/entries/${id}`, { method: "DELETE" }),
};

// AI
export const aiApi = {
  chat: (data: { message: string; conversation_history?: any[]; hero_names?: string[]; template_key?: string }) =>
    request<{ response: string }>("/api/ai/chat", { method: "POST", body: JSON.stringify(data) }),
  templates: () => request<Record<string, any>>("/api/ai/templates"),
  generatePrompt: (context: string, heroNames: string[] = []) =>
    request<{ prompt: string }>("/api/ai/generate-prompt", {
      method: "POST",
      body: JSON.stringify({ context, hero_names: heroNames }),
    }),
  streamChat: (data: { message: string; conversation_history?: any[]; hero_names?: string[]; template_key?: string }) => {
    return fetch(`${API_BASE}/api/ai/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  },
};

// Mood
export const moodApi = {
  options: () => request<Record<string, any>>("/api/mood/weather-options"),
  create: (data: any) =>
    request<any>("/api/mood/", { method: "POST", body: JSON.stringify(data) }),
  history: (userId = "default", limit = 30) =>
    request<any[]>(`/api/mood/history?user_id=${userId}&limit=${limit}`),
  getByEntry: (entryId: string) =>
    request<any | null>(`/api/mood/by-entry/${entryId}`),
  update: (id: string, data: any) =>
    request<any>(`/api/mood/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<any>(`/api/mood/${id}`, { method: "DELETE" }),
};

// Heroes
export const heroesApi = {
  list: (userId = "default") => request<any[]>(`/api/heroes/?user_id=${userId}`),
  defaults: () => request<any[]>("/api/heroes/defaults"),
  add: (data: any) =>
    request<any>("/api/heroes/", { method: "POST", body: JSON.stringify(data) }),
  remove: (id: string) => request<any>(`/api/heroes/${id}`, { method: "DELETE" }),
  toggle: (id: string) => request<any>(`/api/heroes/${id}/toggle`, { method: "PATCH" }),
  quotes: () => request<any[]>("/api/heroes/quotes"),
  searchQuotes: (name: string) =>
    request<{ quotes: any[] }>("/api/heroes/search-quotes", { method: "POST", body: JSON.stringify({ name }) }),
  updateQuotes: (id: string, quotes: any[]) =>
    request<any>(`/api/heroes/${id}/quotes`, { method: "PATCH", body: JSON.stringify({ quotes }) }),
};

// Standalone Quotes / Passages
export const quotesApi = {
  list: (userId = "default") => request<any[]>(`/api/quotes/?user_id=${userId}`),
  add: (data: { text: string; author?: string; source?: string; category?: string }) =>
    request<any>("/api/quotes/", { method: "POST", body: JSON.stringify(data) }),
  remove: (id: string) => request<any>(`/api/quotes/${id}`, { method: "DELETE" }),
  toggle: (id: string) => request<any>(`/api/quotes/${id}/toggle`, { method: "PATCH" }),
};

// Export
export const exportApi = {
  journalBook: async (data: any) => {
    const res = await fetch(`${API_BASE}/api/export/journal-book`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Export failed");
    return res.blob();
  },
  journalBookMarkdown: async (data: any) => {
    const res = await fetch(`${API_BASE}/api/export/journal-book`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, format: "markdown" }),
    });
    if (!res.ok) throw new Error("Export failed");
    return res.blob();
  },
  entriesJson: (userId = "default") =>
    request<any[]>(`/api/export/entries-json?user_id=${userId}`),
};

// Groups
export const groupsApi = {
  list: (userId = "default") => request<any[]>(`/api/groups/${userId}`),
  create: (data: any) =>
    request<any>("/api/groups/", { method: "POST", body: JSON.stringify(data) }),
  join: (data: { user_id: string; invite_code: string; role?: string }) =>
    request<any>("/api/groups/join", { method: "POST", body: JSON.stringify(data) }),
  share: (data: { entry_id: string; group_id: string; shared_by: string; title?: string; content?: string }) =>
    request<any>("/api/groups/share", { method: "POST", body: JSON.stringify(data) }),
  shared: (groupId: string) => request<any[]>(`/api/groups/${groupId}/shared`),
  members: (groupId: string) => request<any[]>(`/api/groups/${groupId}/members`),
  syncPull: (userId = "default") =>
    request<any>("/api/groups/sync/pull", { method: "POST", body: JSON.stringify({ user_id: userId }) }),
};

// Supabase config
export const supabaseApi = {
  get: () => request<any>("/api/settings/supabase"),
  save: (data: { supabase_url?: string; supabase_anon_key?: string; supabase_display_name?: string }) =>
    request<any>("/api/settings/supabase", { method: "POST", body: JSON.stringify(data) }),
  test: (data: { supabase_url: string; supabase_anon_key: string }) =>
    request<any>("/api/settings/supabase/test", { method: "POST", body: JSON.stringify(data) }),
};

// Sync
export const syncApi = {
  export: (userId = "default") => request<any>(`/api/sync/export?user_id=${userId}`),
  import: (data: { user_id?: string; entries?: any[]; moods?: any[]; conversations?: any[]; memories?: any[]; heroes?: any[]; attachments?: any[]; preferences?: any }) =>
    request<any>("/api/sync/import", { method: "POST", body: JSON.stringify(data) }),
};

// Faith
export const faithApi = {
  traditions: () => request<Record<string, { label: string; description: string }>>("/api/faith/traditions"),
  get: (userId = "default") => request<any>(`/api/faith/?user_id=${userId}`),
  set: (data: { user_id?: string; faith_tradition: string; faith_notes?: string }) =>
    request<any>("/api/faith/", { method: "PUT", body: JSON.stringify(data) }),
};

// Onboarding
export const onboardingApi = {
  status: (userId = "default") => request<any>(`/api/onboarding/status?user_id=${userId}`),
  complete: (data: any) =>
    request<any>("/api/onboarding/complete", { method: "POST", body: JSON.stringify(data) }),
};

// AI Memory
export const memoryApi = {
  list: (userId = "default", category?: string) => {
    let url = `/api/memory/?user_id=${userId}`;
    if (category) url += `&category=${category}`;
    return request<any[]>(url);
  },
  add: (data: { user_id?: string; category: string; content: string; source?: string }) =>
    request<any>("/api/memory/", { method: "POST", body: JSON.stringify(data) }),
  delete: (id: string) => request<any>(`/api/memory/${id}`, { method: "DELETE" }),
  toggle: (id: string) => request<any>(`/api/memory/${id}/toggle`, { method: "PATCH" }),
  compact: (userId = "default", category?: string) =>
    request<{ status: string; before: number; after: number; reduced: number; message?: string; errors?: string[] }>(
      "/api/memory/compact",
      { method: "POST", body: JSON.stringify({ user_id: userId, category: category || undefined }) },
    ),
};

// Uploads
export const uploadsApi = {
  upload: async (file: File, userId = "default", entryId?: string, caption?: string) => {
    const form = new FormData();
    form.append("file", file);
    form.append("user_id", userId);
    if (entryId) form.append("entry_id", entryId);
    if (caption) form.append("caption", caption);
    const res = await fetch(`${API_BASE}/api/uploads/`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Upload error ${res.status}: ${error}`);
    }
    return res.json();
  },
  list: (userId = "default", entryId?: string) => {
    let url = `/api/uploads/?user_id=${userId}`;
    if (entryId) url += `&entry_id=${entryId}`;
    return request<any[]>(url);
  },
  update: (id: string, data: { entry_id?: string; caption?: string }) =>
    request<any>(`/api/uploads/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: string) => request<any>(`/api/uploads/${id}`, { method: "DELETE" }),
  fileUrl: (filename: string) => `${API_BASE}/api/uploads/file/${filename}`,
};

// Conversations
export const conversationApi = {
  list: (userId = "default", entryId?: string) => {
    let url = `/api/conversations/?user_id=${userId}`;
    if (entryId) url += `&entry_id=${entryId}`;
    return request<any[]>(url);
  },
  get: (id: string) => request<any>(`/api/conversations/${id}`),
  send: (data: {
    user_id?: string;
    conversation_id?: string;
    entry_id?: string;
    message: string;
    template_key?: string;
    current_step?: number;
  }) =>
    request<{ conversation_id: string; response: string; messages: any[] }>(
      "/api/conversations/send",
      { method: "POST", body: JSON.stringify(data) }
    ),
  sendStream: (data: {
    user_id?: string;
    conversation_id?: string;
    entry_id?: string;
    message: string;
    template_key?: string;
    current_step?: number;
  }) =>
    fetch(`${API_BASE}/api/conversations/send/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  end: (id: string) =>
    request<any>(`/api/conversations/${id}/end`, { method: "POST" }),
  templates: () => request<Record<string, any>>("/api/conversations/templates/list"),
};

// Ollama Management
export const ollamaApi = {
  status: () => request<any>('/api/ollama/status'),
  models: () => request<any>('/api/ollama/models'),
  recommended: () => request<any>('/api/ollama/recommended'),
  pull: (model: string) =>
    fetch(`${API_BASE}/api/ollama/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model }),
    }),
  createStepCompanion: (name = 'stepcompanion', baseModel = 'llama3.3:8b') =>
    fetch(`${API_BASE}/api/ollama/create-stepcompanion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, base_model: baseModel }),
    }),
  installInstructions: () => request<any>('/api/ollama/install-instructions'),
  validateModel: () => request<any>('/api/ollama/validate-model', { method: 'POST' }),
};

// App Settings (AI config)
export const settingsApi = {
  getAI: () => request<any>("/api/settings/ai"),
  updateAI: (data: Record<string, string>) =>
    request<any>("/api/settings/ai", { method: "PUT", body: JSON.stringify(data) }),
  testAI: () =>
    request<{ status: string; provider: string; message: string }>("/api/settings/ai/test", { method: "POST" }),
  resetAll: (confirmation: string) =>
    request<any>("/api/settings/reset-all", { method: "POST", body: JSON.stringify({ confirmation }) }),
  hasPassword: () => request<{ has_password: boolean }>("/api/settings/password"),
  setPassword: (password: string, currentPassword?: string) =>
    request<any>("/api/settings/password", {
      method: "POST",
      body: JSON.stringify({ password, current_password: currentPassword }),
    }),
  verifyPassword: (password: string) =>
    request<{ verified: boolean }>("/api/settings/verify-password", {
      method: "POST",
      body: JSON.stringify({ password }),
    }),
  removePassword: (password: string) =>
    request<any>("/api/settings/password", {
      method: "DELETE",
      body: JSON.stringify({ password }),
    }),
  getCurrentStep: () =>
    request<{ current_step: number }>("/api/settings/current-step"),
  setCurrentStep: (step: number) =>
    request<{ current_step: number }>("/api/settings/current-step", {
      method: "PUT",
      body: JSON.stringify({ step }),
    }),
  checkForUpdates: async () => {
    const res = await fetch("https://api.github.com/repos/TimKenobi/StepScribe/releases/latest");
    if (!res.ok) throw new Error("Could not check for updates");
    return res.json();
  },
};
