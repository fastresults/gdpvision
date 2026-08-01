// Chamber 07 · Stage 00, first beat — the material leads.
//
// This chamber is AI-first, so nothing asks the principal to invent a title on
// a blank line. They give the chamber what they already have — an RFP, a
// cabinet memo, a dictated note, a link — and the AI reads it into a
// programme: name, scope, and the instrument it recommends.

import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  FileText,
  Link2,
  Loader2,
  Mic,
  Sparkles,
  StopCircle,
  Trash2,
  UploadCloud,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { transcribeAudio } from "@/lib/personas/transcribe.functions";
import {
  ingestBriefLink,
  parseUpload,
  signUploadUrl,
} from "@/lib/personas/parse-upload.functions";
import {
  proposeProgrammeFromMaterial,
  type ProgrammeProposal,
} from "@/lib/personas/project-brief.functions";
import type { WizardUpload } from "@/components/personas/StudyWizard/MultimodalInput";
import { Illustration } from "@/components/marketing/Illustration";
import { Explain } from "@/components/explain/Explain";
import "@/lib/explain/personas-entries";
import intakeArt from "@/assets/illustrations/research-field.jpg";
import { cn } from "@/lib/utils";

export type IngestMaterial = { raw: string; uploads: WizardUpload[] };

const ACCEPT =
  ".pdf,.docx,.doc,.txt,.md,.json,.csv,.pptx,.xlsx,.png,.jpg,.jpeg,.webp,.mp3,.wav,.m4a,.webm,.mp4";

export function ProgrammeIngest({
  code,
  onProposal,
  onSkip,
}: {
  code: string;
  onProposal: (proposal: ProgrammeProposal, material: IngestMaterial) => void;
  onSkip: () => void;
}) {
  const rec = useVoiceRecorder();
  const signFn = useServerFn(signUploadUrl);
  const parseFn = useServerFn(parseUpload);
  const linkFn = useServerFn(ingestBriefLink);
  const transcribeFn = useServerFn(transcribeAudio);
  const proposeFn = useServerFn(proposeProgrammeFromMaterial);

  const [raw, setRaw] = useState("");
  const [uploads, setUploads] = useState<WizardUpload[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  const material = raw.trim().length + uploads.reduce((s, u) => s + (u.excerpt?.length ?? 0), 0);
  const ready = material >= 40;

  const addFiles = async (files: File[]) => {
    setError(null);
    for (const file of files) {
      setBusy(`Reading ${file.name}`);
      try {
        const { path, signedUrl, token } = await signFn({
          data: { countryCode: code, filename: file.name },
        });
        const { error: upErr } = await supabase.storage
          .from("study-artifacts")
          .uploadToSignedUrl(path, token, file, { contentType: file.type });
        if (upErr && signedUrl) {
          await fetch(signedUrl, {
            method: "PUT",
            body: file,
            headers: { "Content-Type": file.type },
          });
        }
        const { excerpt } = await parseFn({
          data: { path, mimeType: file.type, countryCode: code },
        });
        setUploads((u) => [
          ...u,
          { name: file.name, path, mime: file.type, size: file.size, excerpt },
        ]);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(null);
      }
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const addLink = async () => {
    const url = linkUrl.trim();
    if (!url) return;
    setError(null);
    setBusy("Reading the link");
    try {
      const doc = await linkFn({ data: { url } });
      setUploads((u) => [...u, doc]);
      setLinkUrl("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const toggleMic = async () => {
    setError(null);
    if (rec.state === "recording") {
      const clip = await rec.stop();
      if (!clip) return;
      setBusy("Transcribing");
      try {
        const { text } = await transcribeFn({
          data: { base64: clip.base64, mimeType: clip.mime },
        });
        setRaw((v) => (v ? `${v.trim()}\n\n` : "") + text.trim());
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(null);
      }
    } else {
      await rec.start();
    }
  };

  const propose = useMutation({
    mutationFn: () => proposeFn({ data: { countryCode: code, raw, uploads } }),
    onSuccess: (p) => onProposal(p as ProgrammeProposal, { raw, uploads }),
    onError: (e) => setError((e as Error).message),
  });

  return (
    <section className="border border-ink-950 bg-paper-0">
      <header className="border-b border-ink-950 px-6 py-7 sm:px-10 sm:py-10">
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">
              Stage 00 · Intake
            </p>
            <h2 className="mt-3 max-w-2xl font-serif text-[2rem] leading-[1.1] text-ink-950 sm:text-4xl">
              Give the chamber the material.
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-700">
              Drop the RFP, the cabinet memo, the tender notice or the article. Dictate the ask.
              Paste a link. The chamber reads all of it and{" "}
              <Explain id="research.intake.readout">proposes the programme</Explain> — its name,
              its scope, and the instrument it should be asked with.
            </p>
          </div>
          <Illustration src={intakeArt} variant="mark" className="hidden shrink-0 opacity-80 sm:block" />
        </div>
      </header>

      <div className="px-6 py-7 sm:px-10 sm:py-9">
        {/* Drop zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void addFiles(Array.from(e.dataTransfer.files));
          }}
          className={cn(
            "flex flex-col items-center justify-center border border-dashed border-line-200 px-6 py-10 text-center transition-colors",
            dragging && "border-ink-950 bg-paper-50",
          )}
        >
          <UploadCloud size={20} className="text-ink-500" />
          <p className="mt-3 font-serif text-lg text-ink-950">Drop the source material here</p>
          <p className="mt-1 text-[12px] text-ink-700">
            PDF · Word · PowerPoint · Excel · images · audio — as many as you like
          </p>
          <button type="button" onClick={() => fileRef.current?.click()} className="btn-secondary mt-4">
            Browse files
          </button>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => void addFiles(Array.from(e.target.files ?? []))}
          />
        </div>

        {/* Link row */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="flex min-w-[260px] flex-1 items-center gap-2 border border-line-200 px-3 py-2 focus-within:border-ink-950">
            <Link2 size={13} className="shrink-0 text-ink-500" />
            <input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void addLink();
                }
              }}
              placeholder="Paste a link — tender notice, article, ministry page"
              className="w-full bg-transparent text-sm text-ink-950 placeholder:text-ink-300 focus:outline-none"
            />
          </div>
          <button type="button" onClick={() => void addLink()} disabled={!linkUrl.trim() || !!busy} className="btn-secondary disabled:opacity-40">
            Fetch link
          </button>
          <button
            type="button"
            onClick={() => void toggleMic()}
            disabled={!!busy && rec.state !== "recording"}
            className={cn("btn-secondary", rec.state === "recording" && "btn-accent")}
          >
            {rec.state === "recording" ? (
              <>
                <StopCircle size={12} /> Stop · {(rec.level * 100).toFixed(0)}%
              </>
            ) : (
              <>
                <Mic size={12} /> Dictate
              </>
            )}
          </button>
        </div>

        {/* Captured sources */}
        {uploads.length > 0 && (
          <ul className="mt-5 space-y-1.5">
            {uploads.map((u, i) => (
              <li
                key={`${u.path}-${i}`}
                className="flex items-center gap-3 border border-line-200 px-3 py-2 text-[12px] text-ink-700"
              >
                {u.mime === "text/uri-list" ? <Link2 size={13} /> : <FileText size={13} />}
                <span className="min-w-0 flex-1 truncate text-ink-950">{u.name}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
                  {(u.excerpt?.length ?? 0).toLocaleString()} chars read
                </span>
                <button
                  type="button"
                  aria-label={`Remove ${u.name}`}
                  onClick={() => setUploads((list) => list.filter((_, idx) => idx !== i))}
                  className="text-ink-500 hover:text-ink-950"
                >
                  <Trash2 size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Typed context */}
        <div className="mt-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            Anything the documents don't say
          </p>
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={4}
            placeholder="Optional — the decision behind this, who must be convinced, the deadline, the sensitivities."
            className="mt-2 w-full resize-y border border-line-200 bg-paper-0 p-3 text-sm leading-relaxed focus:border-ink-950 focus:outline-none"
          />
        </div>

        {busy && (
          <p className="mt-4 flex items-center gap-2 text-[12px] text-ink-700">
            <Loader2 size={12} className="animate-spin" /> {busy}…
          </p>
        )}
        {error && <p className="mt-4 text-[12px] text-rose-600">{error}</p>}

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => propose.mutate()}
            disabled={!ready || propose.isPending || !!busy}
            className="btn-primary disabled:opacity-40"
          >
            {propose.isPending ? (
              <>
                <Loader2 size={11} className="animate-spin" /> Reading the material…
              </>
            ) : (
              <>
                <Sparkles size={11} /> Read this and build the programme
              </>
            )}
          </button>
          {!ready && (
            <p className="text-[11px] text-ink-500">
              Drop a document, paste a link, dictate or type a line to continue.
            </p>
          )}
        </div>
      </div>

      <footer className="border-t border-line-200 px-6 py-4 sm:px-10">
        <p className="text-[12px] text-ink-700">
          Nothing to hand?{" "}
          <button type="button" onClick={onSkip} className="underline underline-offset-2 hover:text-ink-950">
            Start from a blank brief and choose the instrument yourself.
          </button>
        </p>
      </footer>
    </section>
  );
}
