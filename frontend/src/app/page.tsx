"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus, Save, Trash2, BookOpen, MessageCircle, X,
  ChevronDown, ChevronUp, Send, Sparkles, Eye, EyeOff,
} from "lucide-react";
import Editor from "@/components/Editor";
import MoodWeather from "@/components/MoodWeather";
import VoiceInput from "@/components/VoiceInput";
import HeroQuotes from "@/components/HeroQuotes";
import { journalApi, moodApi, conversationApi } from "@/lib/api";
import { saveOfflineEntry } from "@/lib/storage";
import { isOnline as checkOnline } from "@/lib/storage";

interface Entry {
  id: string;
  title: string;
  content: string;
  content_html: string;
  is_draft: boolean;
  sections_included: Record<string, boolean> | null;
  created_at: string;
  updated_at: string;
}

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

export default function JournalPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [activeEntry, setActiveEntry] = useState<Entry | null>(null);
  const [title, setTitle] = useState("");
  const [html, setHtml] = useState("");
  const [selectedMood, setSelectedMood] = useState("");
  const [energy, setEnergy] = useState(5);
  const [saving, setSaving] = useState(false);
  const [online, setOnline] = useState(true);

  // Section toggles
  const [sections, setSections] = useState<Record<string, boolean>>({
    mood: true, conversation: true, heroes: true,
  });

  // Inline chat
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Record<string, any>>({});
  const [showTemplates, setShowTemplates] = useState(false);

  // Mood section expanded
  const [showMood, setShowMood] = useState(false);

  useEffect(() => {
    loadEntries();
    checkOnline().then(setOnline);
    conversationApi.templates().then(setTemplates).catch(() => {});
  }, []);

  const loadEntries = async () => {
    try { setEntries(await journalApi.list()); } catch {}
  };

  const newEntry = () => {
    setActiveEntry(null); setTitle(""); setHtml("");
    setSelectedMood(""); setEnergy(5);
    setChatMessages([]); setConversationId(null); setShowChat(false);
    setSections({ mood: true, conversation: true, heroes: true });
  };

  const selectEntry = async (entry: Entry) => {
    setActiveEntry(entry); setTitle(entry.title);
    setHtml(entry.content_html || entry.content);
    if (entry.sections_included) setSections(entry.sections_included);
    try {
      const convos = await conversationApi.list("default", entry.id);
      if (convos.length > 0) {
        setChatMessages(convos[0].messages || []);
        setConversationId(convos[0].id);
        setShowChat(true);
      } else {
        setChatMessages([]); setConversationId(null); setShowChat(false);
      }
    } catch { setChatMessages([]); setConversationId(null); }
  };

  const saveEntry = useCallback(async (publish = false) => {
    setSaving(true);
    try {
      const data: any = {
        title, content: html.replace(/<[^>]+>/g, ""), content_html: html,
        is_draft: !publish, sections_included: sections,
      };
      if (!online) { saveOfflineEntry({ ...data, is_draft: !publish }); setSaving(false); return; }
      if (activeEntry) {
        setActiveEntry(await journalApi.update(activeEntry.id, data));
      } else {
        setActiveEntry(await journalApi.create({ ...data, user_id: "default" }));
      }
      if (selectedMood) {
        await moodApi.create({ user_id: "default", weather: selectedMood, energy_level: energy, entry_id: activeEntry?.id });
      }
      loadEntries();
    } catch {}
    setSaving(false);
  }, [title, html, activeEntry, selectedMood, energy, online, sections]);

  const deleteEntry = async () => {
    if (!activeEntry) return;
    try { await journalApi.delete(activeEntry.id); newEntry(); loadEntries(); } catch {}
  };

  const handleVoiceResult = (text: string) => setHtml((prev) => prev + `<p>${text}</p>`);

  const sendChat = async (text: string, templateKey?: string) => {
    if (!text.trim() && !templateKey) return;
    setChatMessages((prev) => [...prev, { role: "user", content: text }]);
    setChatInput(""); setChatLoading(true);
    try {
      const result = await conversationApi.send({
        user_id: "default", conversation_id: conversationId || undefined,
        entry_id: activeEntry?.id || undefined, message: text, template_key: templateKey,
      });
      setConversationId(result.conversation_id);
      setChatMessages(result.messages);
    } catch {
      setChatMessages((prev) => [...prev, { role: "assistant", content: "I'm having trouble connecting. Try again in a moment." }]);
    } finally { setChatLoading(false); }
  };

  const handleTemplate = (key: string) => {
    const t = templates[key];
    if (t) { setChatMessages((prev) => [...prev, { role: "assistant", content: t.prompt }]); setShowTemplates(false); }
  };

  const endConversation = async () => {
    if (conversationId) { try { await conversationApi.end(conversationId); } catch {} }
    setShowChat(false);
  };

  const insertToEditor = (text: string) => setHtml((prev) => prev + `<blockquote><p>${text}</p></blockquote>`);

  const toggleSection = (key: string) => setSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const wordCount = html.replace(/<[^>]+>/g, "").split(/\s+/).filter(Boolean).length;

  return (
    <div className="flex h-screen">
      {/* Entry list sidebar */}
      <div className="w-64 border-r flex flex-col" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)" }}>
        <div className="p-3 border-b flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
          <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Entries</span>
          <button onClick={newEntry} title="New entry"><Plus size={16} style={{ color: "var(--accent)" }} /></button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {entries.map((e) => (
            <button key={e.id} onClick={() => selectEntry(e)} className="w-full text-left px-3 py-2.5 border-b transition-colors"
              style={{ borderColor: "var(--border)", backgroundColor: activeEntry?.id === e.id ? "var(--bg-tertiary)" : "transparent" }}>
              <div className="text-sm truncate" style={{ color: "var(--text-primary)" }}>{e.title || "Untitled"}</div>
              <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                {new Date(e.created_at).toLocaleDateString()}{e.is_draft && " · Draft"}
              </div>
            </button>
          ))}
          {entries.length === 0 && (
            <div className="p-4 text-center">
              <BookOpen size={24} className="mx-auto mb-2" style={{ color: "var(--text-muted)" }} />
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Your journal is empty. Start writing.</p>
            </div>
          )}
        </div>
      </div>

      {/* Main editor area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl w-full mx-auto p-8">
            {sections.heroes && <HeroQuotes refreshInterval={120000} />}

            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="Entry title..." className="w-full text-xl font-semibold mb-4 mt-4 bg-transparent outline-none"
              style={{ color: "var(--text-primary)" }} />

            <Editor content={html} onChange={(h) => setHtml(h)} />

            {/* Section toggles */}
            <div className="mt-4 flex items-center gap-3 flex-wrap">
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>Include:</span>
              {[{ key: "mood", label: "Inner Weather" }, { key: "conversation", label: "AI Chat" }, { key: "heroes", label: "Hero Quotes" }].map(({ key, label }) => (
                <button key={key} onClick={() => toggleSection(key)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-colors"
                  style={{ backgroundColor: sections[key] ? "var(--accent-muted)" : "var(--bg-tertiary)",
                    color: sections[key] ? "var(--accent)" : "var(--text-muted)",
                    border: `1px solid ${sections[key] ? "var(--accent)" : "var(--border)"}` }}>
                  {sections[key] ? <Eye size={12} /> : <EyeOff size={12} />}{label}
                </button>
              ))}
            </div>

            {/* Inline mood */}
            {sections.mood && (
              <div className="mt-6">
                <button onClick={() => setShowMood(!showMood)} className="flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                  {showMood ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  Inner Weather {selectedMood && `· ${selectedMood.replace(/_/g, " ")}`}
                </button>
                {showMood && <div className="mt-3"><MoodWeather selected={selectedMood} onSelect={setSelectedMood} energyLevel={energy} onEnergyChange={setEnergy} /></div>}
              </div>
            )}

            {/* Actions bar */}
            <div className="mt-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <VoiceInput onTranscript={handleVoiceResult} />
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>{wordCount} words</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowChat(!showChat)} className="p-2 rounded-lg transition-colors"
                  style={{ backgroundColor: showChat ? "var(--accent-muted)" : "var(--bg-tertiary)", color: showChat ? "var(--accent)" : "var(--text-secondary)" }}
                  title="Talk to AI Sponsor"><MessageCircle size={16} /></button>
                {activeEntry && <button onClick={deleteEntry} className="p-2 rounded" title="Delete entry"><Trash2 size={16} style={{ color: "var(--danger)" }} /></button>}
                <button onClick={() => saveEntry(false)} disabled={saving} className="px-4 py-2 rounded-lg text-sm inline-flex items-center gap-1.5"
                  style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-secondary)" }}>
                  <Save size={14} /> {saving ? "Saving..." : "Save Draft"}
                </button>
                <button onClick={() => saveEntry(true)} disabled={saving} className="px-4 py-2 rounded-lg text-sm"
                  style={{ backgroundColor: "var(--accent)", color: "#fff" }}>Publish</button>
              </div>
            </div>
          </div>
        </div>

        {/* Inline AI Chat Panel */}
        {showChat && sections.conversation && (
          <div className="border-t flex flex-col" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)", height: "40%", minHeight: "250px" }}>
            <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: "var(--border)" }}>
              <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>AI Sponsor</span>
              <div className="flex items-center gap-2">
                {conversationId && <button onClick={endConversation} className="text-xs px-2 py-1 rounded" style={{ color: "var(--text-muted)" }}>End conversation</button>}
                <button onClick={() => setShowChat(false)}><X size={14} style={{ color: "var(--text-muted)" }} /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatMessages.length === 0 && (
                <div className="text-center py-6">
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>Say what&apos;s on your mind, or pick a prompt.</p>
                  <button onClick={() => setShowTemplates(!showTemplates)} className="mt-3 flex items-center gap-1.5 mx-auto px-3 py-1.5 rounded-lg text-xs"
                    style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--accent)" }}><Sparkles size={12} /> Prompts</button>
                </div>
              )}
              {showTemplates && (
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(templates).map(([key, t]: [string, any]) => (
                    <button key={key} onClick={() => { handleTemplate(key); setShowTemplates(false); }}
                      className="text-left p-2 rounded-lg border text-xs" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)" }}>
                      <div className="font-medium" style={{ color: "var(--text-primary)" }}>{t.name}</div>
                      <div className="mt-0.5" style={{ color: "var(--text-muted)" }}>{t.description}</div>
                    </button>
                  ))}
                </div>
              )}
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className="max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed"
                    style={{ backgroundColor: msg.role === "user" ? "var(--accent-muted)" : "var(--bg-tertiary)", color: "var(--text-primary)" }}>
                    {msg.content}
                    {msg.role === "assistant" && (
                      <button onClick={() => insertToEditor(msg.content)} className="block mt-1 text-[10px] underline" style={{ color: "var(--text-muted)" }}>Add to journal</button>
                    )}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-muted)" }}>
                    <span className="animate-pulse">Thinking...</span>
                  </div>
                </div>
              )}
            </div>
            <div className="p-3 border-t" style={{ borderColor: "var(--border)" }}>
              <div className="flex gap-2">
                <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendChat(chatInput)}
                  placeholder="What's on your mind?" className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
                <button onClick={() => sendChat(chatInput)} disabled={!chatInput.trim() || chatLoading}
                  className="px-3 py-2 rounded-lg" style={{ backgroundColor: "var(--accent)", color: "#fff", opacity: !chatInput.trim() || chatLoading ? 0.5 : 1 }}>
                  <Send size={14} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
