"use client";

import { useState, useCallback, useRef } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

interface UseVoiceReturn {
  isListening: boolean;
  transcript: string;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
  isSupported: boolean;
  isTranscribing: boolean;
  error: string;
}

export function useVoice(): UseVoiceReturn {
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const isSupported = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

  const startListening = useCallback(async () => {
    if (!isSupported) return;
    setError("");
    setTranscript("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Prefer webm/opus, fall back to whatever the browser supports
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        // Stop all tracks so the mic indicator goes away
        stream.getTracks().forEach((t) => t.stop());

        if (chunksRef.current.length === 0) return;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        chunksRef.current = [];

        // Send to backend for transcription
        setIsTranscribing(true);
        try {
          const form = new FormData();
          form.append("audio", blob, "recording.webm");
          const resp = await fetch(`${API_BASE}/api/transcribe`, { method: "POST", body: form });
          if (!resp.ok) {
            const err = await resp.json().catch(() => ({ detail: "Transcription failed" }));
            setError(err.detail || "Transcription failed");
            return;
          }
          const data = await resp.json();
          if (data.text) setTranscript(data.text);
          else setError("No speech detected");
        } catch {
          setError("Could not connect to transcription service");
        } finally {
          setIsTranscribing(false);
        }
      };

      recorder.onerror = () => {
        stream.getTracks().forEach((t) => t.stop());
        setIsListening(false);
        setError("Recording failed");
      };

      mediaRecorderRef.current = recorder;
      recorder.start(1000); // collect data every second
      setIsListening(true);
    } catch (e: any) {
      if (e.name === "NotAllowedError") {
        setError("Microphone access denied. Check your system permissions.");
      } else {
        setError("Could not access microphone");
      }
    }
  }, [isSupported]);

  const stopListening = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsListening(false);
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript("");
    setError("");
  }, []);

  return { isListening, transcript, startListening, stopListening, resetTranscript, isSupported, isTranscribing, error };
}
