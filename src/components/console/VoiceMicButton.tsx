// Press-to-record mic button. Encapsulates useVoiceRecorder + transcribeAudio
// and calls back with the transcript so any composer can append it.

import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Square } from "lucide-react";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { transcribeAudio } from "@/lib/personas/transcribe.functions";

type Props = {
  onTranscript: (text: string) => void;
  className?: string;
  label?: string;
};

export function VoiceMicButton({ onTranscript, className, label = "Voice" }: Props) {
  const rec = useVoiceRecorder();
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef<number | null>(null);
  const recording = rec.state === "recording";

  // Live elapsed timer while recording.
  useEffect(() => {
    if (!recording) {
      startedAt.current = null;
      setElapsed(0);
      return;
    }
    startedAt.current = Date.now();
    const iv = window.setInterval(() => {
      if (startedAt.current) {
        setElapsed(Math.floor((Date.now() - startedAt.current) / 1000));
      }
    }, 500);
    return () => window.clearInterval(iv);
  }, [recording]);

  async function toggle() {
    if (busy) return;
    if (recording) {
      const clip = await rec.stop();
      if (!clip) return;
      setBusy(true);
      try {
        const { text } = await transcribeAudio({
          data: { base64: clip.base64, mimeType: clip.mime },
        });
        const t = text.trim();
        if (t) onTranscript(t);
      } catch {
        // Silent — recorder error state can surface separately.
      } finally {
        setBusy(false);
      }
    } else {
      await rec.start();
    }
  }

  const timeStr =
    recording && elapsed > 0 ? ` · 0:${elapsed.toString().padStart(2, "0")}` : "";

  const base =
    "inline-flex min-h-[44px] items-center justify-center gap-2 border px-4 text-xs font-mono uppercase tracking-[0.18em] transition";
  const state = recording
    ? "border-rose-600 bg-rose-600 text-paper-50 animate-pulse"
    : busy
      ? "border-line-200 bg-paper-0 text-ink-500"
      : "border-ink-950 bg-paper-0 text-ink-950 hover:bg-ink-950 hover:text-paper-50";

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-label={recording ? "Stop recording" : "Record voice"}
      className={`${base} ${state} ${className ?? ""}`}
    >
      {busy ? (
        <>
          <Loader2 size={14} className="animate-spin" /> Transcribing
        </>
      ) : recording ? (
        <>
          <Square size={12} fill="currentColor" /> Stop{timeStr}
        </>
      ) : (
        <>
          <Mic size={14} />
          {label ? ` ${label}` : ""}
        </>
      )}
    </button>
  );
}
