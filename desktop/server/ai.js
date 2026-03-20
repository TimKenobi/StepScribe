/**
 * AI Service — Strategy pattern for multiple AI providers.
 * Port of Python ai_service.py to Node.js.
 * Supports OpenAI, Anthropic, Grok/xAI, Ollama, and any OpenAI-compatible endpoint.
 */

// Runtime settings (loaded from DB on startup, overridden by config changes)
const _settings = {
  ai_provider: "openai",
  openai_api_key: "",
  openai_model: "gpt-4o",
  anthropic_api_key: "",
  anthropic_model: "claude-sonnet-4-20250514",
  grok_api_key: "",
  grok_model: "grok-3",
  grok_base_url: "https://api.x.ai/v1",
  ollama_base_url: "http://localhost:11434",
  ollama_model: "llama3",
  custom_ai_base_url: "",
  custom_ai_api_key: "",
  custom_ai_model: "",
};

function getSettings() {
  return _settings;
}

function updateSettings(newSettings) {
  for (const [k, v] of Object.entries(newSettings)) {
    if (k in _settings && v) _settings[k] = v;
  }
}

// ── OpenAI-compatible provider (OpenAI, Grok, Custom) ──

async function openaiChat(apiKey, baseUrl, model, messages, temperature = 0.7) {
  const OpenAI = require("openai");
  const client = new OpenAI({ apiKey: apiKey || "no-key", baseURL: baseUrl || undefined });
  const response = await client.chat.completions.create({
    model, messages, temperature,
  });
  return response.choices[0].message.content || "";
}

async function* openaiStream(apiKey, baseUrl, model, messages, temperature = 0.7) {
  const OpenAI = require("openai");
  const client = new OpenAI({ apiKey: apiKey || "no-key", baseURL: baseUrl || undefined });
  const stream = await client.chat.completions.create({
    model, messages, temperature, stream: true,
  });
  for await (const chunk of stream) {
    if (chunk.choices?.[0]?.delta?.content) {
      yield chunk.choices[0].delta.content;
    }
  }
}

// ── Anthropic provider ──

async function anthropicChat(apiKey, model, messages, temperature = 0.7) {
  const Anthropic = require("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey });
  let systemMsg = "";
  const userMessages = [];
  for (const m of messages) {
    if (m.role === "system") systemMsg = m.content;
    else userMessages.push(m);
  }
  const response = await client.messages.create({
    model, system: systemMsg, messages: userMessages,
    max_tokens: 2048, temperature,
  });
  return response.content[0].text;
}

async function* anthropicStream(apiKey, model, messages, temperature = 0.7) {
  const Anthropic = require("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey });
  let systemMsg = "";
  const userMessages = [];
  for (const m of messages) {
    if (m.role === "system") systemMsg = m.content;
    else userMessages.push(m);
  }
  const stream = client.messages.stream({
    model, system: systemMsg, messages: userMessages,
    max_tokens: 2048, temperature,
  });
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta?.text) {
      yield event.delta.text;
    }
  }
}

// ── Ollama provider ──

async function ollamaChat(baseUrl, model, messages, temperature = 0.7, options = {}) {
  console.log(`[Ollama] chat request — model: "${model}", url: ${baseUrl}/api/chat`);
  const body = { model, messages, stream: false, options: { temperature } };
  if (options.format) body.format = options.format;
  const resp = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120000),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Ollama error ${resp.status}: ${text}`);
  }
  const data = await resp.json();
  return data.message?.content || "";
}

async function* ollamaStream(baseUrl, model, messages, temperature = 0.7) {
  const resp = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, stream: true, options: { temperature } }),
    signal: AbortSignal.timeout(120000),
  });
  if (!resp.ok) throw new Error(`Ollama error: ${resp.status}`);
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const data = JSON.parse(line);
        if (data.message?.content) yield data.message.content;
      } catch { /* skip malformed */ }
    }
  }
}

// ── Unified interface ──

async function chat(messages, temperature = 0.7, options = {}) {
  const s = _settings;
  switch (s.ai_provider) {
    case "openai":
      return openaiChat(s.openai_api_key, undefined, s.openai_model, messages, temperature);
    case "anthropic":
      return anthropicChat(s.anthropic_api_key, s.anthropic_model, messages, temperature);
    case "grok":
      return openaiChat(s.grok_api_key, s.grok_base_url, s.grok_model, messages, temperature);
    case "ollama":
      return ollamaChat(s.ollama_base_url, s.ollama_model, messages, temperature, options);
    case "custom":
      return openaiChat(s.custom_ai_api_key, s.custom_ai_base_url, s.custom_ai_model, messages, temperature);
    default:
      throw new Error(`Unknown AI provider: ${s.ai_provider}`);
  }
}

async function* stream(messages, temperature = 0.7) {
  const s = _settings;
  switch (s.ai_provider) {
    case "openai":
      yield* openaiStream(s.openai_api_key, undefined, s.openai_model, messages, temperature);
      break;
    case "anthropic":
      yield* anthropicStream(s.anthropic_api_key, s.anthropic_model, messages, temperature);
      break;
    case "grok":
      yield* openaiStream(s.grok_api_key, s.grok_base_url, s.grok_model, messages, temperature);
      break;
    case "ollama":
      yield* ollamaStream(s.ollama_base_url, s.ollama_model, messages, temperature);
      break;
    case "custom":
      yield* openaiStream(s.custom_ai_api_key, s.custom_ai_base_url, s.custom_ai_model, messages, temperature);
      break;
    default:
      throw new Error(`Unknown AI provider: ${s.ai_provider}`);
  }
}

module.exports = { getSettings, updateSettings, chat, stream };
