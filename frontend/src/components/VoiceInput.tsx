"use client";

import { useEffect, useRef } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { useVoice } from "@/hooks/useVoice";

interface VoiceInputProps {
  onTranscript: (text: string) => void;
}

export default function VoiceInput({ onTranscript }: VoiceInputProps) {
  const { isListening, transcript, startListening, stopListening, resetTranscript, isSupported, isTranscribing, error } = useVoice();
  const deliveredRef = useRef(false);

  // Auto-deliver transcript once transcription completes
  useEffect(() => {
    if (transcript && !isTranscribing && !deliveredRef.current) {
      deliveredRef.current = true;
      onTranscript(transcript);
      resetTranscript();
    }
    if (isListening || isTranscribing) {
      deliveredRef.current = false;
    }
  }, [transcript, isTranscribing, isListening, onTranscript, resetTranscript]);

  if (!isSupported) return null;

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={isListening ? stopListening : startListening}
        disabled={isTranscribing}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors"
        style={{
          backgroundColor: isListening ? "var(--danger)" : "var(--bg-tertiary)",
          color: "var(--text-primary)",
          border: `1px solid ${isListening ? "var(--danger)" : "var(--border)"}`,
          opacity: isTranscribing ? 0.6 : 1,
        }}
      >
        {isTranscribing ? <Loader2 size={16} className="animate-spin" /> : isListening ? <MicOff size={16} /> : <Mic size={16} />}
        {isTranscribing ? "Transcribing..." : isListening ? "Stop Recording" : "Voice to Text"}
      </button>
      {isListening && (
        <span className="text-xs animate-pulse" style={{ color: "var(--danger)" }}>
          Recording...
        </span>
      )}
      {error && (
        <span className="text-xs" style={{ color: "var(--danger)" }}>
          {error}
        </span>
      )}
    </div>
  );
}
