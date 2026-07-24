import { useCallback, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Upload,
  Link2,
  Type as TypeIcon,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Mic,
  Square,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  createOppositionItem,
  signOppositionUpload,
} from "@/lib/narrative/opposition-intake.functions";
import { analyzeOppositionItem } from "@/lib/narrative/opposition-plan.functions";
import { transcribeAudio } from "@/lib/personas/transcribe.functions";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";

function inferKind(mime: string): "meme" | "screenshot" | "story" | "post" {
  if (mime.startsWith("image/")) return mime.includes("gif") ? "meme" : "screenshot";
  if (mime.includes("pdf") || mime.includes("word") || mime.includes("document")) return "story";
  return "post";
}

type UploadStage = "received" | "uploading" | "registering" | "analyzing" | "complete" | "failed";

interface UploadQueueItem {
  id: string;
  name: string;
  type: string;
  size: number;
  stage: UploadStage;
  message?: string;
}

function makeQueueId(file: File) {
  return `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function isSupportedFile(file: File) {
  const mime = file.type || "";
  const name = file.name.toLowerCase();
  return (
    mime.startsWith("image/") ||
    mime === "application/pdf" ||
    mime.startsWith("text/") ||
    name.endsWith(".txt") ||
    name.endsWith(".md") ||
    name.endsWith(".csv")
  );
}

function stageLabel(stage: UploadStage) {
  switch (stage) {
    case "received":
      return "Received";
    case "uploading":
      return "Uploading";
    case "registering":
      return "Registering";
    case "analyzing":
      return "Analyzing";
    case "complete":
      return "Complete";
    case "failed":
      return "Failed";
  }
}

export function OppositionIntakeDropZone({ code, onIntakeCreated }: { code: string; onIntakeCreated?: (id: string) => void }) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [channel, setChannel] = useState("");
  const [brief, setBrief] = useState("");
  const [transcribing, setTranscribing] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);

  const signUpload = useServerFn(signOppositionUpload);
  const createItem = useServerFn(createOppositionItem);
  const analyze = useServerFn(analyzeOppositionItem);
  const transcribe = useServerFn(transcribeAudio);
  const recorder = useVoiceRecorder();

  const updateQueueItem = useCallback((id: string, patch: Partial<UploadQueueItem>) => {
    setUploadQueue((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const processFile = useCallback(
    async (file: File, queueId: string, submitterContext: string | undefined) => {
      setStatus(`Uploading ${file.name}…`);
      updateQueueItem(queueId, { stage: "uploading" });
      const signed = await signUpload({ data: { countryCode: code, filename: file.name } });
      const uploadRes = await fetch(signed.signedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!uploadRes.ok) throw new Error(`Upload failed (${uploadRes.status})`);
      setStatus(`Registering ${file.name}…`);
      updateQueueItem(queueId, { stage: "registering" });
      const { id } = await createItem({
        data: {
          countryCode: code,
          kind: inferKind(file.type || ""),
          title: file.name,
          storagePath: signed.path,
          mimeType: file.type || "application/octet-stream",
          submittedChannel: channel || undefined,
          submitterContext,
        },
      });
      await qc.invalidateQueries({ queryKey: ["opposition-items", code] });
      onIntakeCreated?.(id);
      setStatus(`Analyzing ${file.name}…`);
      updateQueueItem(queueId, { stage: "analyzing" });
      await analyze({ data: { id } }).catch(() => null);
      updateQueueItem(queueId, { stage: "complete" });
      return id;
    },
    [code, channel, signUpload, createItem, analyze, qc, updateQueueItem, onIntakeCreated],
  );

  const m = useMutation({
    mutationFn: async ({
      files,
      queueIds,
      submitterContext,
    }: {
      files: File[];
      queueIds: string[];
      submitterContext: string | undefined;
    }) => {
      const ids: string[] = [];
      for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        const queueId = queueIds[i];
        if (!file || !queueId) continue;
        try {
          ids.push(await processFile(file, queueId, submitterContext));
        } catch (error) {
          const message = error instanceof Error ? error.message : "Upload failed";
          updateQueueItem(queueId, { stage: "failed", message });
          throw error;
        }
      }
      return ids;
    },
    onSuccess: (ids) => {
      toast.success(ids.length === 1 ? "Opposition intake created" : `${ids.length} opposition intakes created`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    },
    onSettled: () => {
      setStatus("");
      qc.invalidateQueries({ queryKey: ["opposition-items", code] });
    },
  });

  const receiveFiles = useCallback(
    (files: File[]) => {
      if (!files.length) return;

      const nextItems = files.map((file) => ({
        id: makeQueueId(file),
        name: file.name,
        type: file.type || "unknown",
        size: file.size,
        stage: isSupportedFile(file) ? ("received" as const) : ("failed" as const),
        message: isSupportedFile(file) ? undefined : "Unsupported file type",
      }));

      setUploadQueue((current) => [...nextItems, ...current].slice(0, 12));

      const acceptedFiles = files.filter(isSupportedFile);
      const acceptedIds = nextItems.filter((item) => item.stage === "received").map((item) => item.id);
      const rejectedCount = files.length - acceptedFiles.length;
      const submitterContext = brief.trim() || undefined;

      if (acceptedFiles.length) {
        const label = acceptedFiles.length === 1 ? "Image received" : `${acceptedFiles.length} files received`;
        setStatus(label);
        toast(label, {
          description: submitterContext
            ? "Brief attached · analysis started."
            : "Upload and analysis have started. Add a brief above to sharpen the response.",
        });
        m.mutate({ files: acceptedFiles, queueIds: acceptedIds, submitterContext });
      }

      if (rejectedCount > 0) {
        toast.error(`${rejectedCount} file${rejectedCount === 1 ? "" : "s"} not supported`);
      }
    },
    [m, brief],
  );

  const submitUrl = useMutation({
    mutationFn: async () => {
      setStatus("Registering link…");
      const { id } = await createItem({
        data: {
          countryCode: code,
          kind: "link",
          title: url,
          sourceUrl: url,
          submittedChannel: channel || undefined,
          submitterContext: brief.trim() || undefined,
        },
      });
      setStatus("Analyzing link…");
      await analyze({ data: { id } }).catch(() => null);
      return id;
    },
    onSuccess: () => {
      setUrl("");
    },
    onSettled: () => {
      setStatus("");
      qc.invalidateQueries({ queryKey: ["opposition-items", code] });
    },
  });

  const submitText = useMutation({
    mutationFn: async () => {
      setStatus("Registering text…");
      const { id } = await createItem({
        data: {
          countryCode: code,
          kind: "text",
          title: text.slice(0, 80),
          rawText: text,
          submittedChannel: channel || undefined,
          submitterContext: brief.trim() || undefined,
        },
      });
      setStatus("Analyzing text…");
      await analyze({ data: { id } }).catch(() => null);
      return id;
    },
    onSuccess: () => {
      setText("");
    },
    onSettled: () => {
      setStatus("");
      qc.invalidateQueries({ queryKey: ["opposition-items", code] });
    },
  });

  const busy = m.isPending || submitUrl.isPending || submitText.isPending;

  const handleMicPress = useCallback(async () => {
    if (recorder.state === "recording") {
      const clip = await recorder.stop();
      if (!clip) return;
      setTranscribing(true);
      try {
        const { text: transcript } = await transcribe({
          data: { base64: clip.base64, mimeType: clip.mime },
        });
        if (transcript?.trim()) {
          setBrief((prev) => (prev.trim() ? `${prev.trim()}\n${transcript.trim()}` : transcript.trim()));
          toast.success("Brief transcribed");
        } else {
          toast.error("Nothing transcribed — try again.");
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Transcription failed");
      } finally {
        setTranscribing(false);
      }
    } else {
      await recorder.start();
    }
  }, [recorder, transcribe]);

  const recording = recorder.state === "recording";

  return (
    <div className="space-y-5">
      {/* ─── Brief · shared context for the batch ─────────────────────────── */}
      <div className="border border-line-200 bg-paper-0 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
              Step 1 · Brief the analyst
            </h3>
            <p className="mt-1 text-sm text-ink-700">
              Say or type who is depicted, when this was captured, and what makes it hostile.
              Example: <em>“Meme shows former PM Douglas next to a burning barrel — circulating on WhatsApp since Monday, mocking the fuel-subsidy pause.”</em>
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={handleMicPress}
              disabled={transcribing || busy}
              aria-pressed={recording}
              className={recording ? "btn-primary" : "btn-secondary"}
              title={recording ? "Stop recording" : "Record voice brief"}
            >
              {recording ? <Square size={14} /> : <Mic size={14} />}
              <span className="ml-1">
                {recording ? "Stop" : transcribing ? "Transcribing…" : "Record"}
              </span>
            </button>
            {brief && (
              <button
                type="button"
                onClick={() => setBrief("")}
                disabled={busy || transcribing}
                className="btn-ghost"
                title="Clear brief"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          rows={3}
          placeholder="Who / what / when / why it matters. This context is passed to the OCR, motivation, and counter-campaign passes."
          className="mt-3 w-full resize-y border border-line-200 px-3 py-2 text-sm focus:border-ink-950 focus:outline-none"
        />
        {recording && (
          <div className="mt-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
            <span className="inline-block h-2 w-2 rounded-full bg-signal-negative animate-pulse" />
            Recording · {Math.round(recorder.level * 100)}% level · press Stop when done
          </div>
        )}
        {recorder.error && (
          <p className="mt-2 text-xs text-signal-negative">{recorder.error}</p>
        )}
      </div>

      {/* ─── Drop zone · Step 2 ─────────────────────────────────────────── */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          const files = Array.from(e.dataTransfer.files);
          receiveFiles(files);
        }}
        className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed p-8 text-center transition ${
          dragActive ? "border-ink-950 bg-paper-100 shadow-sm" : "border-line-200 bg-paper-0"
        }`}
      >
        <Upload size={22} className={dragActive ? "text-ink-950" : "text-ink-500"} />
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">Step 2 · Drop the artefact</p>
        <p className="text-sm text-ink-700">
          {dragActive
            ? "Release to receive these files."
            : brief.trim()
              ? "Brief attached — drop memes, screenshots, PDFs, or forwarded stories."
              : "Drop opposition memes, screenshots, PDFs, or forwarded stories here."}
        </p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="btn-secondary"
        >
          Choose files
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,application/pdf,text/*"
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            receiveFiles(files);
            e.target.value = "";
          }}
        />
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
          Images · PDFs · plain text · up to 20MB per file
        </p>
      </div>

      {uploadQueue.length > 0 && (
        <div className="border border-line-200 bg-paper-0">
          <div className="flex items-center justify-between border-b border-line-200 px-4 py-3">
            <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
              Intake queue
            </h3>
            <span className="text-xs text-ink-500">{uploadQueue.length} recent</span>
          </div>
          <ul className="divide-y divide-line-200">
            {uploadQueue.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink-950">{item.name}</p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
                    {item.type} · {(item.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  {item.message && <p className="mt-1 text-xs text-ink-700">{item.message}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
                  {item.stage === "complete" ? (
                    <CheckCircle2 size={14} className="text-signal-positive" />
                  ) : item.stage === "failed" ? (
                    <AlertCircle size={14} className="text-signal-negative" />
                  ) : (
                    <Loader2 size={14} className="animate-spin" />
                  )}
                  {stageLabel(item.stage)}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            <Link2 size={11} className="inline mr-1" /> Paste a link
          </span>
          <div className="mt-1 flex gap-2">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              className="flex-1 border border-line-200 px-3 py-2 text-sm focus:border-ink-950 focus:outline-none"
            />
            <button
              type="button"
              className="btn-primary"
              disabled={!url.trim() || busy}
              onClick={() => submitUrl.mutate()}
            >
              Ingest
            </button>
          </div>
        </label>
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            Channel it came from (optional)
          </span>
          <input
            type="text"
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            placeholder="WhatsApp · X · TikTok · Facebook · SMS"
            className="mt-1 w-full border border-line-200 px-3 py-2 text-sm focus:border-ink-950 focus:outline-none"
          />
        </label>
      </div>

      <label className="block">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
          <TypeIcon size={11} className="inline mr-1" /> Or paste opposition text / a forwarded message
        </span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder="Paste the message body verbatim…"
          className="mt-1 w-full resize-y border border-line-200 px-3 py-2 text-sm focus:border-ink-950 focus:outline-none"
        />
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            className="btn-primary"
            disabled={!text.trim() || busy}
            onClick={() => submitText.mutate()}
          >
            Ingest text
          </button>
        </div>
      </label>

      {(busy || status) && (
        <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500">
          <Loader2 size={12} className={busy ? "animate-spin" : ""} />
          {status || "Working…"}
        </p>
      )}
      {(m.error || submitUrl.error || submitText.error) && (
        <p className="text-sm text-rose-600">
          {((m.error ?? submitUrl.error ?? submitText.error) as Error).message}
        </p>
      )}
    </div>
  );
}
