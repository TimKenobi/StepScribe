"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Sparkles, MessageCircle, Plus, X, ChevronDown } from "lucide-react";
import { conversationApi, settingsApi } from "@/lib/api";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

interface ConvoBrief {
  id: string;
  messages: ChatMsg[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const STEPS = [
  { num: 1, name: "Honesty", short: "Admitted we were powerless" },
  { num: 2, name: "Hope", short: "Came to believe" },
  { num: 3, name: "Faith", short: "Made a decision to turn over" },
  { num: 4, name: "Courage", short: "Searching moral inventory" },
  { num: 5, name: "Integrity", short: "Admitted the nature of our wrongs" },
  { num: 6, name: "Willingness", short: "Entirely ready" },
  { num: 7, name: "Humility", short: "Humbly asked" },
  { num: 8, name: "Brotherly Love", short: "Made a list of persons harmed" },
  { num: 9, name: "Justice", short: "Made direct amends" },
  { num: 10, name: "Perseverance", short: "Continued personal inventory" },
  { num: 11, name: "Spiritual Awareness", short: "Prayer and meditation" },
  { num: 12, name: "Service", short: "Carry the message" },
];

export default function SponsorPage() {
  const [conversations, setConversations] = useState<ConvoBrief[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [showStepPicker, setShowStepPicker] = useState(false);
  const [templates, setTemplates] = useState<Record<string, any>>({});
  const [showTemplates, setShowTemplates] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadConversations();
    conversationApi.templates().then(setTemplates).catch(() => {});
    settingsApi.getCurrentStep().then((r) => setCurrentStep(r.current_step || 0)).catch(() => {});
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadConversations = async () => {
    try {
      const convos = await conversationApi.list();
      setConversations(convos);
      // Load the most recent active conversation
      const active = convos.find((c: ConvoBrief) => c.is_active);
      if (active) {
        setConversationId(active.id);
        setMessages(active.messages || []);
      }
    } catch {}
  };

  const startNewConversation = () => {
    setConversationId(null);
    setMessages([]);
    setShowTemplates(false);
    setShowHistory(false);
  };

  const loadConversation = (convo: ConvoBrief) => {
    setConversationId(convo.id);
    setMessages(convo.messages || []);
    setShowHistory(false);
  };

  const selectStep = async (step: number) => {
    setCurrentStep(step);
    setShowStepPicker(false);
    try { await settingsApi.setCurrentStep(step); } catch {}
  };

  const sendMessage = async (text: string, templateKey?: string) => {
    if (!text.trim() && !templateKey) return;
    const userText = text.trim();

    if (userText) {
      setMessages((prev) => [...prev, { role: "user", content: userText }]);
    }
    setInput("");
    setShowTemplates(false);
    setLoading(true);

    try {
      const result = await conversationApi.send({
        conversation_id: conversationId || undefined,
        message: userText || templateKey || "",
        template_key: templateKey,
        current_step: currentStep || undefined,
      });
      setConversationId(result.conversation_id);
      setMessages(result.messages || []);
    } catch (err: any) {
      const errMsg = err?.message || "";
      let userMsg = "I'm having trouble connecting right now. But I'm here — try again in a moment.";
      if (errMsg.includes("AI provider error")) {
        // Extract the actual error from the server
        try {
          const parsed = JSON.parse(errMsg.replace(/^API error \d+: /, ""));
          userMsg = `I couldn't reach the AI provider: ${parsed.detail || errMsg}\n\nCheck your AI settings to make sure the connection is configured correctly.`;
        } catch {
          userMsg = `I couldn't reach the AI provider. ${errMsg}\n\nCheck your AI settings to make sure the connection is configured correctly.`;
        }
      }
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: userMsg },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleTemplate = (key: string) => {
    sendMessage("", key);
  };

  const endConversation = async () => {
    if (!conversationId) return;
    try {
      await conversationApi.end(conversationId);
      startNewConversation();
      loadConversations();
    } catch {}
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  return (
    <div className="h-full flex flex-col p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
            AI Sponsor
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            A companion, not a clinician. Say what&apos;s real. Conversations are saved and help your AI learn about you.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="p-2 rounded-lg text-xs flex items-center gap-1"
            style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
            title="Past conversations"
          >
            <MessageCircle size={14} />
            {conversations.length > 0 && <span>{conversations.length}</span>}
          </button>
          <button
            onClick={startNewConversation}
            className="p-2 rounded-lg"
            style={{ backgroundColor: "var(--accent)", color: "#fff" }}
            title="New conversation"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Step selector */}
      <div className="mb-4 relative">
        <button
          onClick={() => setShowStepPicker(!showStepPicker)}
          className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm transition-colors"
          style={{
            backgroundColor: currentStep ? "var(--accent-muted, rgba(139,92,246,0.1))" : "var(--bg-secondary)",
            color: currentStep ? "var(--accent)" : "var(--text-muted)",
            border: "1px solid var(--border)",
          }}
        >
          <span>
            {currentStep
              ? `Step ${currentStep}: ${STEPS[currentStep - 1].name} — ${STEPS[currentStep - 1].short}`
              : "Select a step to work on (optional)"}
          </span>
          <ChevronDown size={16} className={`transition-transform ${showStepPicker ? "rotate-180" : ""}`} />
        </button>
        {showStepPicker && (
          <div
            className="absolute z-10 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border shadow-lg"
            style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--border)" }}
          >
            <button
              onClick={() => selectStep(0)}
              className="w-full text-left px-4 py-2.5 text-sm transition-colors border-b"
              style={{
                borderColor: "var(--border)",
                color: "var(--text-muted)",
                backgroundColor: currentStep === 0 ? "var(--bg-tertiary)" : "transparent",
              }}
            >
              No specific step
            </button>
            {STEPS.map((s) => (
              <button
                key={s.num}
                onClick={() => selectStep(s.num)}
                className="w-full text-left px-4 py-2.5 text-sm transition-colors border-b last:border-b-0"
                style={{
                  borderColor: "var(--border)",
                  backgroundColor: currentStep === s.num ? "var(--accent-muted, rgba(139,92,246,0.1))" : "transparent",
                  color: currentStep === s.num ? "var(--accent)" : "var(--text-primary)",
                }}
              >
                <span className="font-medium">Step {s.num}: {s.name}</span>
                <span className="ml-2" style={{ color: "var(--text-muted)" }}>— {s.short}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Conversation history dropdown */}
      {showHistory && conversations.length > 0 && (
        <div
          className="mb-4 max-h-48 overflow-y-auto rounded-lg border"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)" }}
        >
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => loadConversation(c)}
              className="w-full text-left px-4 py-3 border-b last:border-b-0 transition-colors"
              style={{
                borderColor: "var(--border)",
                backgroundColor: c.id === conversationId ? "var(--bg-tertiary)" : "transparent",
              }}
            >
              <div className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>
                {c.messages?.[0]?.content?.slice(0, 80) || "Conversation"}
                {!c.is_active && <span style={{ color: "var(--text-muted)" }}> (ended)</span>}
              </div>
              <div className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                {formatDate(c.updated_at)} · {c.messages?.length || 0} messages
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 min-h-0 flex flex-col rounded-lg border" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)" }}>
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
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)" }}
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
                className="max-w-[80%] rounded-lg px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap"
                style={{
                  backgroundColor: msg.role === "user" ? "var(--accent-muted, rgba(139,92,246,0.1))" : "var(--bg-tertiary)",
                  color: "var(--text-primary)",
                }}
              >
                {msg.content}
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
          {conversationId && messages.length > 0 && (
            <div className="flex justify-end mt-2">
              <button
                onClick={endConversation}
                className="text-[10px] px-2 py-1 rounded"
                style={{ color: "var(--text-muted)" }}
              >
                End conversation
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
