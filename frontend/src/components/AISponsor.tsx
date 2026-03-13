"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Sparkles } from "lucide-react";
import { aiApi } from "@/lib/api";

interface AISponsorProps {
  heroNames?: string[];
  onInsertToEditor?: (text: string) => void;
}

export default function AISponsor({ heroNames = [], onInsertToEditor }: AISponsorProps) {
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<Record<string, any>>({});
  const [showTemplates, setShowTemplates] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    aiApi.templates().then(setTemplates).catch(() => {});
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text: string, templateKey?: string) => {
    if (!text.trim()) return;

    const userMessage = { role: "user" as const, content: text };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const result = await aiApi.chat({
        message: text,
        conversation_history: messages,
        hero_names: heroNames,
        template_key: templateKey,
      });
      setMessages((prev) => [...prev, { role: "assistant", content: result.response }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "I'm having trouble connecting right now. But I'm here — try again in a moment." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleTemplate = (key: string) => {
    const template = templates[key];
    if (template) {
      setMessages((prev) => [...prev, { role: "assistant", content: template.prompt }]);
      setShowTemplates(false);
    }
  };

  return (
    <div className="flex flex-col h-full rounded-lg border" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)" }}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              This is a safe space. Say what&apos;s on your mind.
            </p>
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className="mt-4 flex items-center gap-2 mx-auto px-4 py-2 rounded-lg text-sm transition-colors"
              style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--accent)" }}
            >
              <Sparkles size={16} />
              Or pick a prompt to get started
            </button>
          </div>
        )}

        {/* Template picker */}
        {showTemplates && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2">
            {Object.entries(templates).map(([key, t]: [string, any]) => (
              <button
                key={key}
                onClick={() => handleTemplate(key)}
                className="text-left p-3 rounded-lg border transition-colors"
                style={{
                  borderColor: "var(--border)",
                  backgroundColor: "var(--bg-primary)",
                }}
              >
                <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  {t.name}
                </div>
                <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                  {t.description}
                </div>
              </button>
            ))}
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className="max-w-[80%] rounded-lg px-4 py-3 text-sm leading-relaxed"
              style={{
                backgroundColor: msg.role === "user" ? "var(--accent-muted)" : "var(--bg-tertiary)",
                color: "var(--text-primary)",
              }}
            >
              {msg.content}
              {msg.role === "assistant" && onInsertToEditor && (
                <button
                  onClick={() => onInsertToEditor(msg.content)}
                  className="block mt-2 text-xs underline"
                  style={{ color: "var(--text-muted)" }}
                >
                  Add to journal
                </button>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="rounded-lg px-4 py-3 text-sm" style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-muted)" }}>
              <span className="animate-pulse">Thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t p-4" style={{ borderColor: "var(--border)" }}>
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
            placeholder="What's on your mind?"
            className="flex-1 px-4 py-2.5 rounded-lg text-sm outline-none"
            style={{
              backgroundColor: "var(--bg-primary)",
              color: "var(--text-primary)",
              border: "1px solid var(--border)",
            }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            className="px-4 py-2.5 rounded-lg transition-colors"
            style={{
              backgroundColor: "var(--accent)",
              color: "#fff",
              opacity: !input.trim() || loading ? 0.5 : 1,
            }}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
