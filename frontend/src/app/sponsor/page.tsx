"use client";

import AISponsor from "@/components/AISponsor";

export default function SponsorPage() {
  return (
    <div className="h-screen flex flex-col p-6">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
          AI Sponsor
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          A companion, not a clinician. Say what&apos;s real.
        </p>
      </div>
      <div className="flex-1 min-h-0">
        <AISponsor />
      </div>
    </div>
  );
}
