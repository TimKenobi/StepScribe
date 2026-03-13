"use client";

import { Mic, MicOff } from "lucide-react";
import { useVoice } from "@/hooks/useVoice";

interface VoiceInputProps {
  onTranscript: (text: string) => void;
}

export default function VoiceInput({ onTranscript }: VoiceInputProps) {
  const { isListening, transcript, startListening, stopListening, resetTranscript, isSupported } = useVoice();

  if (!isSupported) return null;

  const handleStop = () => {
    stopListening();
    if (transcript) {
      onTranscript(transcript);
      resetTranscript();
    }
  };

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={isListening ? handleStop : startListening}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors"
        style={{
          backgroundColor: isListening ? "var(--danger)" : "var(--bg-tertiary)",
          color: "var(--text-primary)",
          border: `1px solid ${isListening ? "var(--danger)" : "var(--border)"}`,
        }}
      >
        {isListening ? <MicOff size={16} /> : <Mic size={16} />}
        {isListening ? "Stop Recording" : "Voice to Text"}
      </button>
      {isListening && (
        <span className="text-xs animate-pulse" style={{ color: "var(--danger)" }}>
          Listening...
        </span>
      )}
      {transcript && !isListening && (
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          Transcript ready
        </span>
      )}
    </div>
  );
}
