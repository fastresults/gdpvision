// Chamber 07 · Stage 00, first beat — the material leads.
//
// Two zones, deliberately unequal. The SOURCE BRIEF is singular: one document,
// one dictation or one link that governs the programme — it is what the AI
// builds the name, scope and instrument from. SUPPORTING CONTEXT is plural:
// anything that colours the brief without overruling it. Both are filed to the
// second brain with their role attached once the programme is opened.

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

export type IngestMaterial = {
  raw: string;
  brief: WizardUpload | null;
  context: WizardUpload[];
};

type Slot = "brief" | "context";

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
  const [brief, setBrief] = useState<WizardUpload | null>(null);
  const [contextItems, setContextItems] = useState<WizardUpload[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState<Slot | null>(null);
  const [briefLink, setBriefLink] = useState("");
  const [contextLink, setContextLink] = useState("");
  const briefFileRef = useRef<HTMLInputElement | null>(null);
  const contextFileRef = useRef<HTMLInputElement | null>(null);

  const briefChars = (brief?.excerpt?.length ?? 0) + raw.trim().length;
  const ready = briefChars >= 40;

  const receive = (slot: Slot, item: WizardUpload) => {
    if (slot === "brief") setBrief(item);
    else setContextItems((list) => [...list, item]);
  };

  const addFiles = async (slot: Slot, files: File[]) => {
    setError(null);
    const list = slot === "brief" ? files.slice(0, 1) : files;
    for (const file of list) {
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
        receive(slot, { name: file.name, path, mime: file.type, size: file.size, excerpt });
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(null);
      }
    }
    if (briefFileRef.current) briefFileRef.current.value = "";
    if (contextFileRef.current) contextFileRef.current.value = "";
  };

  const addLink = async (slot: Slot) => {
    const url = (slot === "brief" ? briefLink : contextLink).trim();
    if (!url) return;
    setError(null);
    setBusy("Reading the link");
    try {
      const doc = await linkFn({ data: { url } });
      receive(slot, doc);
      if (slot === "brief") setBriefLink("");
      else setContextLink("");
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
    mutationFn: () =>
      proposeFn({ data: { countryCode: code, raw, brief, context: contextItems } }),
    onSuccess: (p) =>
      onProposal(p as ProgrammeProposal, { raw, brief, context: contextItems }),
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
              One document governs this programme — the{" "}
              <Explain id="research.intake.brief-precedence">source brief</Explain>. Everything
              else is context around it. The chamber reads both and{" "}
              <Explain id="research.intake.readout">proposes the programme</Explain> — its name,
              its scope, and the instrument it should be asked with.
            </p>
          </div>
          <Illustration src={intakeArt} variant="mark" className="hidden shrink-0 opacity-80 sm:block" />
        </div>
      </header>

      <div className="grid gap-px bg-line-200 lg:grid-cols-[3fr_2fr]">
        {/* ── Zone 1 · the single governing brief ───────────────────────── */}
        <div className="bg-paper-0 px-6 py-7 sm:px-9 sm:py-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">
            01 · The source brief <span className="text-ink-300">· one only</span>
          </p>
          <h3 className="mt-2 font-serif text-xl text-ink-950">
            What are we actually being asked to do?
          </h3>
          <p className="mt-1.5 max-w-lg text-[12.5px] leading-relaxed text-ink-700">
            The RFP, the cabinet memo, the tender notice, the minister's note. This is what the
            programme is built from — scope, objectives, timeframe and instrument all come from
            here.
          </p>

          {brief ? (
            <div className="mt-5 flex items-center gap-3 border border-ink-950 bg-paper-50 px-4 py-3">
              {brief.mime === "text/uri-list" ? <Link2 size={14} /> : <FileText size={14} />}
              <span className="min-w-0 flex-1 truncate font-serif text-sm text-ink-950">
                {brief.name}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
                {(brief.excerpt?.length ?? 0).toLocaleString()} chars read
              </span>
              <button
                type="button"
                aria-label="Remove the source brief"
                onClick={() => setBrief(null)}
                className="text-ink-500 hover:text-ink-950"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ) : (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging("brief");
              }}
              onDragLeave={() => setDragging(null)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(null);
                void addFiles("brief", Array.from(e.dataTransfer.files));
              }}
              className={cn(
                "mt-5 flex flex-col items-center justify-center border border-dashed border-ink-300 px-6 py-10 text-center transition-colors",
                dragging === "brief" && "border-ink-950 bg-paper-50",
              )}
            >
              <UploadCloud size={20} className="text-ink-500" />
              <p className="mt-3 font-serif text-lg text-ink-950">Drop the governing brief here</p>
              <p className="mt-1 text-[12px] text-ink-700">
                PDF · Word · PowerPoint · Excel · image · audio
              </p>
              <button
                type="button"
                onClick={() => briefFileRef.current?.click()}
                className="btn-secondary mt-4"
              >
                Browse for the brief
              </button>
              <input
                ref={briefFileRef}
                type="file"
                accept={ACCEPT}
                className="hidden"
                onChange={(e) => void addFiles("brief", Array.from(e.target.files ?? []))}
              />
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="flex min-w-[240px] flex-1 items-center gap-2 border border-line-200 px-3 py-2 focus-within:border-ink-950">
              <Link2 size={13} className="shrink-0 text-ink-500" />
              <input
                value={briefLink}
                onChange={(e) => setBriefLink(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void addLink("brief");
                  }
                }}
                placeholder="…or paste the brief's link"
                className="w-full bg-transparent text-sm text-ink-950 placeholder:text-ink-300 focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => void addLink("brief")}
              disabled={!briefLink.trim() || !!busy}
              className="btn-secondary disabled:opacity-40"
            >
              Fetch
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
                  <Mic size={12} /> Dictate it
                </>
              )}
            </button>
          </div>

          <div className="mt-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
              {brief ? "Anything the brief doesn't say" : "Or state the ask in your own words"}
            </p>
            <textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              rows={4}
              placeholder="The decision behind this, who must be convinced, the deadline, the sensitivities."
              className="mt-2 w-full resize-y border border-line-200 bg-paper-0 p-3 text-sm leading-relaxed focus:border-ink-950 focus:outline-none"
            />
          </div>
        </div>

        {/* ── Zone 2 · supporting context, many ─────────────────────────── */}
        <div className="bg-paper-0 px-6 py-7 sm:px-9 sm:py-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">
            02 · Supporting context <span className="text-ink-300">· as many as you like</span>
          </p>
          <h3 className="mt-2 font-serif text-xl text-ink-950">What else should it know?</h3>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-700">
            Prior studies, media coverage, budget lines, ministry pages. These colour the reading —
            they never overrule the brief.
          </p>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging("context");
            }}
            onDragLeave={() => setDragging(null)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(null);
              void addFiles("context", Array.from(e.dataTransfer.files));
            }}
            className={cn(
              "mt-5 flex flex-col items-center justify-center border border-dashed border-line-200 px-5 py-7 text-center transition-colors",
              dragging === "context" && "border-ink-950 bg-paper-50",
            )}
          >
            <p className="text-[12.5px] text-ink-700">Drop supporting documents here</p>
            <button
              type="button"
              onClick={() => contextFileRef.current?.click()}
              className="btn-ghost mt-3"
            >
              Browse files
            </button>
            <input
              ref={contextFileRef}
              type="file"
              multiple
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => void addFiles("context", Array.from(e.target.files ?? []))}
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="flex min-w-[200px] flex-1 items-center gap-2 border border-line-200 px-3 py-2 focus-within:border-ink-950">
              <Link2 size={13} className="shrink-0 text-ink-500" />
              <input
                value={contextLink}
                onChange={(e) => setContextLink(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void addLink("context");
                  }
                }}
                placeholder="Paste a supporting link"
                className="w-full bg-transparent text-sm text-ink-950 placeholder:text-ink-300 focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => void addLink("context")}
              disabled={!contextLink.trim() || !!busy}
              className="btn-secondary disabled:opacity-40"
            >
              Fetch
            </button>
          </div>

          {contextItems.length > 0 && (
            <ul className="mt-5 space-y-1.5">
              {contextItems.map((u, i) => (
                <li
                  key={`${u.path}-${i}`}
                  className="flex items-center gap-3 border border-line-200 px-3 py-2 text-[12px] text-ink-700"
                >
                  {u.mime === "text/uri-list" ? <Link2 size={13} /> : <FileText size={13} />}
                  <span className="min-w-0 flex-1 truncate text-ink-950">{u.name}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
                    {(u.excerpt?.length ?? 0).toLocaleString()}
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${u.name}`}
                    onClick={() => setContextItems((list) => list.filter((_, idx) => idx !== i))}
                    className="text-ink-500 hover:text-ink-950"
                  >
                    <Trash2 size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="border-t border-line-200 px-6 py-6 sm:px-10">
        {busy && (
          <p className="flex items-center gap-2 text-[12px] text-ink-700">
            <Loader2 size={12} className="animate-spin" /> {busy}…
          </p>
        )}
        {error && <p className="mt-2 text-[12px] text-rose-600">{error}</p>}

        <div className="mt-4 flex flex-wrap items-center gap-4">
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
          {!ready ? (
            <p className="text-[11px] text-ink-500">
              Drop the source brief, paste its link, dictate it or type the ask to continue.
            </p>
          ) : (
            <p className="text-[11px] text-ink-500">
              1 brief · {contextItems.length} supporting{" "}
              {contextItems.length === 1 ? "item" : "items"} — all filed to the second brain.
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
