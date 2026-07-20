// Chamber 07 · Multimodal input — type / speak / upload rail.
import { useRef, useState } from "react";
import { Mic, StopCircle, Upload, Loader2 } from "lucide-react";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { transcribeAudio } from "@/lib/personas/transcribe.functions";
import { parseUpload, signUploadUrl } from "@/lib/personas/parse-upload.functions";
import { supabase } from "@/integrations/supabase/client";

export type WizardUpload = {
  name: string;
  path: string;
  mime: string;
  size: number;
  excerpt?: string;
};

type Props = {
  countryCode: string;
  value: string;
  onChange: (text: string) => void;
  onUpload?: (upload: WizardUpload) => void;
  uploads?: WizardUpload[];
  placeholder?: string;
  rows?: number;
};

export function MultimodalInput({
  countryCode, value, onChange, onUpload, uploads = [], placeholder, rows = 6,
}: Props) {
  const rec = useVoiceRecorder();
  const [transcribing, setTranscribing] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const toggleMic = async () => {
    setError(null);
    if (rec.state === "recording") {
      const clip = await rec.stop();
      if (!clip) return;
      setTranscribing(true);
      try {
        const { text } = await transcribeAudio({ data: { base64: clip.base64, mimeType: clip.mime } });
        onChange((value ? `${value.trim()}\n\n` : "") + text.trim());
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setTranscribing(false);
      }
    } else {
      await rec.start();
    }
  };

  const onFile = async (file: File) => {
    setError(null);
    setUploading(file.name);
    try {
      const { path, signedUrl, token } = await signUploadUrl({
        data: { countryCode, filename: file.name },
      });
      // Prefer resumable signed URL upload via storage helper for reliability.
      const { error: upErr } = await supabase.storage
        .from("study-artifacts")
        .uploadToSignedUrl(path, token, file, { contentType: file.type });
      if (upErr && signedUrl) {
        // Fallback to raw PUT if helper is unavailable.
        await fetch(signedUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      }
      const { excerpt } = await parseUpload({
        data: { path, mimeType: file.type, countryCode },
      });
      onUpload?.({ name: file.name, path, mime: file.type, size: file.size, excerpt });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder ?? "Type, dictate, or upload…"}
        className="w-full resize-y border border-line-200 bg-paper-0 p-3 text-sm leading-relaxed focus:border-ink-950 focus:outline-none"
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={toggleMic}
          disabled={transcribing}
          className={`inline-flex items-center gap-1.5 border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] ${
            rec.state === "recording"
              ? "border-rose-600 bg-rose-600 text-paper-0"
              : "border-ink-950 bg-paper-0 text-ink-950 hover:bg-ink-950 hover:text-paper-0"
          }`}
        >
          {rec.state === "recording" ? <StopCircle size={12} /> : <Mic size={12} />}
          {rec.state === "recording"
            ? `Stop · ${(rec.level * 100).toFixed(0)}%`
            : transcribing ? "Transcribing…" : "Dictate"}
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={!!uploading}
          className="inline-flex items-center gap-1.5 border border-ink-950 bg-paper-0 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-950 hover:bg-ink-950 hover:text-paper-0 disabled:opacity-50"
        >
          {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
          {uploading ? `Parsing ${uploading}` : "Upload"}
        </button>
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          accept=".pdf,.docx,.doc,.txt,.md,.json,.csv,.png,.jpg,.jpeg,.webp,.mp3,.wav,.m4a,.webm,.mp4"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        />
        {rec.error && <span className="text-[11px] text-rose-600">{rec.error}</span>}
        {error && <span className="text-[11px] text-rose-600">{error}</span>}
      </div>

      {uploads.length > 0 && (
        <ul className="mt-1 space-y-1">
          {uploads.map((u) => (
            <li key={u.path} className="flex items-baseline gap-2 border border-line-200 bg-paper-50 px-2 py-1 text-[11px] text-ink-700">
              <span className="font-mono text-[10px] text-ink-500">{(u.size / 1024).toFixed(0)}KB</span>
              <span className="truncate font-medium">{u.name}</span>
              {u.excerpt && <span className="ml-auto text-ink-500">✓ parsed</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
