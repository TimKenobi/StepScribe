"use client";

import { useState } from "react";
import { BookOpen, FileJson, Upload } from "lucide-react";
import { exportApi, syncApi } from "@/lib/api";
import { downloadJson, importJsonFile } from "@/lib/storage";

export default function ExportPage() {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [dedication, setDedication] = useState("");
  const [generating, setGenerating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");

  const generateBook = async () => {
    setGenerating(true);
    setMessage("");
    try {
      const blob = await exportApi.journalBook({ title: title || undefined, author: author || undefined, dedication });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `recovery-journal-${new Date().getFullYear()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage("Your journal book has been downloaded.");
    } catch (err: any) {
      setMessage("Could not generate book. Make sure you have published entries.");
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

  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="text-2xl font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
        Journal Book
      </h1>
      <p className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>
        Turn your journal into a book. Like StoryWorth — a year of writing, bound together.
        Your published entries become chapters, complete with dates and inner weather.
      </p>

      {/* Book generator */}
      <div className="p-6 rounded-lg border mb-8" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)" }}>
        <h2 className="text-lg font-medium mb-4 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
          <BookOpen size={20} />
          Generate Your Journal Book
        </h2>

        <div className="space-y-4">
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
          <button
            onClick={generateBook}
            disabled={generating}
            className="px-6 py-2.5 rounded-lg text-sm"
            style={{ backgroundColor: "var(--accent)", color: "#fff", opacity: generating ? 0.5 : 1 }}
          >
            {generating ? "Generating..." : "Generate PDF Book"}
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
