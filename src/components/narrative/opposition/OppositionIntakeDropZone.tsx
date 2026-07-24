import { useCallback, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Upload, Link2, Type as TypeIcon, Loader2 } from "lucide-react";

import {
  createOppositionItem,
  signOppositionUpload,
} from "@/lib/narrative/opposition-intake.functions";
import { analyzeOppositionItem } from "@/lib/narrative/opposition-plan.functions";

function inferKind(mime: string): "meme" | "screenshot" | "story" | "post" {
  if (mime.startsWith("image/")) return mime.includes("gif") ? "meme" : "screenshot";
  if (mime.includes("pdf") || mime.includes("word") || mime.includes("document")) return "story";
  return "post";
}

export function OppositionIntakeDropZone({ code }: { code: string }) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [channel, setChannel] = useState("");
  const [status, setStatus] = useState<string>("");

  const signUpload = useServerFn(signOppositionUpload);
  const createItem = useServerFn(createOppositionItem);
  const analyze = useServerFn(analyzeOppositionItem);

  const processFile = useCallback(
    async (file: File) => {
      setStatus(`Uploading ${file.name}…`);
      const signed = await signUpload({ data: { countryCode: code, filename: file.name } });
      const uploadRes = await fetch(signed.signedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!uploadRes.ok) throw new Error(`Upload failed (${uploadRes.status})`);
      setStatus(`Registering ${file.name}…`);
      const { id } = await createItem({
        data: {
          countryCode: code,
          kind: inferKind(file.type || ""),
          title: file.name,
          storagePath: signed.path,
          mimeType: file.type || "application/octet-stream",
          submittedChannel: channel || undefined,
        },
      });
      setStatus(`Analyzing ${file.name}…`);
      await analyze({ data: { id } }).catch(() => null);
      return id;
    },
    [code, channel, signUpload, createItem, analyze],
  );

  const m = useMutation({
    mutationFn: async (files: File[]) => {
      const ids: string[] = [];
      for (const f of files) ids.push(await processFile(f));
      return ids;
    },
    onSettled: () => {
      setStatus("");
      qc.invalidateQueries({ queryKey: ["opposition-items", code] });
    },
  });

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

  return (
    <div className="space-y-5">
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
          if (files.length) m.mutate(files);
        }}
        className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed p-8 text-center transition ${
          dragActive ? "border-ink-950 bg-paper-50" : "border-line-200 bg-paper-0"
        }`}
      >
        <Upload size={22} className="text-ink-500" />
        <p className="text-sm text-ink-700">
          Drop opposition memes, screenshots, videos, or forwarded stories here.
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
            if (files.length) m.mutate(files);
            e.target.value = "";
          }}
        />
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
          Images · PDFs · plain text · up to 20MB per file
        </p>
      </div>

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
