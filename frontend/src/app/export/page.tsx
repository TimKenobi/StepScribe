"use client";

import { useState } from "react";
import { BookOpen, FileJson, Upload, Calendar, Settings2, FileText } from "lucide-react";
import { exportApi, syncApi } from "@/lib/api";
import { downloadJson, importJsonFile } from "@/lib/storage";

declare global {
  interface Window {
    stepscribe?: { platform?: string; isDesktop?: boolean; openExternal?: (url: string) => Promise<void>; printToPDF?: (html: string) => Promise<string> };
  }
}

export default function ExportPage() {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [dedication, setDedication] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [includeConversations, setIncludeConversations] = useState(true);
  const [includeHeroes, setIncludeHeroes] = useState(true);
  const [includeMemories, setIncludeMemories] = useState(true);
  const [includePhotos, setIncludePhotos] = useState(true);
  const [includeStatistics, setIncludeStatistics] = useState(true);
  const [exportFormat, setExportFormat] = useState<"pdf" | "markdown">("pdf");
  const [generating, setGenerating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");

  const generateBook = async () => {
    setGenerating(true);
    setMessage("");
    try {
      const payload = {
        title: title || undefined,
        author: author || undefined,
        dedication,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        include_conversations: includeConversations,
        include_heroes: includeHeroes,
        include_memories: includeMemories,
        include_photos: includePhotos,
        include_statistics: includeStatistics,
      };
      const year = new Date().getFullYear();
      if (exportFormat === "markdown") {
        const blob = await exportApi.journalBookMarkdown(payload);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `recovery-journal-${year}.md`;
        a.click();
        URL.revokeObjectURL(url);
        setMessage("Your journal has been exported as Markdown.");
      } else {
        // PDF: Server returns HTML, then Electron converts to PDF via printToPDF IPC
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/api/export/journal-book`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const errBody = await res.json().catch(() => null);
          throw new Error(errBody?.detail || `Server returned ${res.status}`);
        }
        const html = await res.text();
        if (window.stepscribe?.printToPDF) {
          try {
            const pdfPath = await window.stepscribe.printToPDF(html);
            if (pdfPath) {
              setMessage(`Your journal book has been saved as PDF.`);
            } else {
              setMessage("Export cancelled.");
            }
          } catch (pdfErr: any) {
            throw new Error(`PDF generation failed: ${pdfErr.message || "Unknown error"}`);
          }
        } else {
          // Fallback for non-Electron: download as HTML
          const blob = new Blob([html], { type: "text/html" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `recovery-journal-${year}.html`;
          a.click();
          URL.revokeObjectURL(url);
          setMessage("Your journal book has been downloaded as HTML. Open it in a browser and print to PDF.");
        }
      }
    } catch (err: any) {
      setMessage(err.message || "Could not generate book. Make sure you have published entries.");
    }
    setGenerating(false);
  };

  const exportJson = async () => {
    try {
      const data = await syncApi.export();
      downloadJson(data, `recoveryai-backup-${new Date().toISOString().slice(0, 10)}.json`);
      setMessage("Backup exported successfully.");
    } catch {
      setMessage("Export failed.");
    }
  };

  const importJson = async () => {
    setImporting(true);
    try {
      const data = await importJsonFile() as any;
      if (data.entries) {
        await syncApi.import(data);
        setMessage(`Imported ${data.entries.length} entries.`);
      } else {
        setMessage("Invalid backup file format.");
      }
    } catch (err: any) {
      setMessage(err.message || "Import failed.");
    }
    setImporting(false);
  };

  const Toggle = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) => (
    <label className="flex items-center gap-2 cursor-pointer text-sm" style={{ color: "var(--text-secondary)" }}>
      <div
        onClick={() => onChange(!checked)}
        className="w-9 h-5 rounded-full relative transition-colors"
        style={{ backgroundColor: checked ? "var(--accent)" : "var(--bg-tertiary)" }}
      >
        <div
          className="w-4 h-4 rounded-full absolute top-0.5 transition-all"
          style={{ backgroundColor: "#fff", left: checked ? "18px" : "2px" }}
        />
      </div>
      {label}
    </label>
  );

  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="text-2xl font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
        Journal Book
      </h1>
      <p className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>
        Turn your journal into a professionally formatted book. Your published entries
        become chapters — complete with inner weather, conversations, photos, and the
        insights your AI guide has gathered along the way.
      </p>

      {/* Book generator */}
      <div className="p-6 rounded-lg border mb-6" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)" }}>
        <h2 className="text-lg font-medium mb-4 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
          <BookOpen size={20} />
          Generate Your Journal Book
        </h2>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs block mb-1" style={{ color: "var(--text-muted)" }}>Book Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="My Recovery Journal"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
              />
            </div>
            <div>
              <label className="text-xs block mb-1" style={{ color: "var(--text-muted)" }}>Author</label>
              <input
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Your name"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
              />
            </div>
          </div>

          <div>
            <label className="text-xs block mb-1" style={{ color: "var(--text-muted)" }}>Dedication (optional)</label>
            <textarea
              value={dedication}
              onChange={(e) => setDedication(e.target.value)}
              placeholder="For those who helped me find my way..."
              rows={2}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
              style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
            />
          </div>

          {/* Date range */}
          <div>
            <label className="text-xs flex items-center gap-1 mb-2" style={{ color: "var(--text-muted)" }}>
              <Calendar size={12} /> Date Range (optional — leave blank for all entries)
            </label>
            <div className="grid grid-cols-2 gap-4">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
              />
            </div>
          </div>

          {/* Section toggles */}
          <div>
            <label className="text-xs flex items-center gap-1 mb-2" style={{ color: "var(--text-muted)" }}>
              <Settings2 size={12} /> Include in Book
            </label>
            <div className="grid grid-cols-2 gap-3 p-3 rounded-lg" style={{ backgroundColor: "var(--bg-primary)", border: "1px solid var(--border)" }}>
              <Toggle label="AI Conversations" checked={includeConversations} onChange={setIncludeConversations} />
              <Toggle label="Recovery Heroes" checked={includeHeroes} onChange={setIncludeHeroes} />
              <Toggle label="AI Insights & Memories" checked={includeMemories} onChange={setIncludeMemories} />
              <Toggle label="Photos & Attachments" checked={includePhotos} onChange={setIncludePhotos} />
              <Toggle label="Journey Statistics" checked={includeStatistics} onChange={setIncludeStatistics} />
            </div>
          </div>

          {/* Format selector */}
          <div>
            <label className="text-xs flex items-center gap-1 mb-2" style={{ color: "var(--text-muted)" }}>
              <FileText size={12} /> Export Format
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => setExportFormat("pdf")}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-center transition-colors"
                style={{
                  backgroundColor: exportFormat === "pdf" ? "var(--accent)" : "var(--bg-primary)",
                  color: exportFormat === "pdf" ? "#fff" : "var(--text-secondary)",
                  border: `1px solid ${exportFormat === "pdf" ? "var(--accent)" : "var(--border)"}`,
                }}
              >
                PDF Book
              </button>
              <button
                onClick={() => setExportFormat("markdown")}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-center transition-colors"
                style={{
                  backgroundColor: exportFormat === "markdown" ? "var(--accent)" : "var(--bg-primary)",
                  color: exportFormat === "markdown" ? "#fff" : "var(--text-secondary)",
                  border: `1px solid ${exportFormat === "markdown" ? "var(--accent)" : "var(--border)"}`,
                }}
              >
                Markdown
              </button>
            </div>
          </div>

          <button
            onClick={generateBook}
            disabled={generating}
            className="px-6 py-2.5 rounded-lg text-sm font-medium"
            style={{ backgroundColor: "var(--accent)", color: "#fff", opacity: generating ? 0.5 : 1 }}
          >
            {generating ? "Generating..." : exportFormat === "markdown" ? "Export Markdown" : "Generate PDF Book"}
          </button>
        </div>
      </div>

      {/* Import / Export */}
      <div className="p-6 rounded-lg border" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)" }}>
        <h2 className="text-lg font-medium mb-4" style={{ color: "var(--text-primary)" }}>
          Backup &amp; Restore
        </h2>
        <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
          Export your data for offline use or as a backup. Import to restore or sync from another device.
        </p>
        <div className="flex gap-3">
          <button
            onClick={exportJson}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm"
            style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
          >
            <FileJson size={16} />
            Export JSON Backup
          </button>
          <button
            onClick={importJson}
            disabled={importing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm"
            style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
          >
            <Upload size={16} />
            {importing ? "Importing..." : "Import from File"}
          </button>
        </div>
      </div>

      {message && (
        <p className="mt-4 text-sm" style={{ color: "var(--accent)" }}>
          {message}
        </p>
      )}
    </div>
  );
}
