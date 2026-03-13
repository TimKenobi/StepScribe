const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8100";

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
};

// Heroes
export const heroesApi = {
  list: (userId = "default") => request<any[]>(`/api/heroes/?user_id=${userId}`),
  defaults: () => request<any[]>("/api/heroes/defaults"),
  add: (data: any) =>
    request<any>("/api/heroes/", { method: "POST", body: JSON.stringify(data) }),
  remove: (id: string) => request<any>(`/api/heroes/${id}`, { method: "DELETE" }),
  toggle: (id: string) => request<any>(`/api/heroes/${id}/toggle`, { method: "PATCH" }),
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
  share: (data: { entry_id: string; group_id: string; shared_by: string }) =>
    request<any>("/api/groups/share", { method: "POST", body: JSON.stringify(data) }),
};

// Sync
export const syncApi = {
  export: (userId = "default") => request<any>(`/api/sync/export?user_id=${userId}`),
  import: (data: { user_id?: string; entries: any[] }) =>
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
