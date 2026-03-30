"use client";

import { useState, useEffect } from "react";
import { Lock, Loader2 } from "lucide-react";
import { settingsApi } from "@/lib/api";

interface LockScreenProps {
  children: React.ReactNode;
}

export default function LockScreen({ children }: LockScreenProps) {
  const [locked, setLocked] = useState<boolean | null>(null); // null = checking
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    checkLock();
  }, []);

  const checkLock = async () => {
    try {
      const resp = await settingsApi.hasPassword();
      setLocked(resp.has_password);
    } catch {
      // If API not reachable yet, don't lock
      setLocked(false);
    }
  };

  const handleUnlock = async () => {
    if (!password) return;
    setVerifying(true);
    setError("");
    try {
      const resp = await settingsApi.verifyPassword(password);
      if (resp.verified) {
        setLocked(false);
      } else {
        setError("Incorrect password.");
        setPassword("");
      }
    } catch {
      setError("Could not verify password.");
    } finally {
      setVerifying(false);
    }
  };

  // Still checking
  if (locked === null) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--bg-primary)" }}>
        <Loader2 size={24} className="animate-spin" style={{ color: "var(--accent)" }} />
      </div>
    );
  }

  // Not locked
  if (!locked) {
    return <>{children}</>;
  }

  // Lock screen
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--bg-primary)" }}>
      <div className="w-full max-w-sm p-8 rounded-xl border" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)" }}>
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
            style={{ backgroundColor: "var(--bg-tertiary)" }}>
            <Lock size={24} style={{ color: "var(--accent)" }} />
          </div>
          <h1 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>StepScribe</h1>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Enter your password to continue</p>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); handleUnlock(); }}>
          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(""); }}
            placeholder="Password"
            autoFocus
            className="w-full px-4 py-3 rounded-lg text-sm outline-none mb-3"
            style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", border: `1px solid ${error ? "#f87171" : "var(--border)"}` }}
          />
          {error && <p className="text-xs mb-3" style={{ color: "#f87171" }}>{error}</p>}
          <button
            type="submit"
            disabled={verifying || !password}
            className="w-full py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
            style={{ backgroundColor: "var(--accent)", color: "#fff", opacity: verifying || !password ? 0.6 : 1 }}
          >
            {verifying ? <Loader2 size={14} className="animate-spin" /> : null}
            {verifying ? "Verifying..." : "Unlock"}
          </button>
        </form>
      </div>
    </div>
  );
}
