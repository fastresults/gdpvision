// Attachment chip with per-file status for the Console composer.

import { FileText, ImageIcon, Loader2, Music, X, Check, AlertTriangle } from "lucide-react";
import type { ConsoleUpload } from "@/hooks/useConsoleUploads";

function iconFor(mime: string) {
  if (mime.startsWith("image/")) return <ImageIcon size={14} />;
  if (mime.startsWith("audio/")) return <Music size={14} />;
  return <FileText size={14} />;
}

function statusText(s: ConsoleUpload["status"]) {
  if (s === "uploading") return "Uploading";
  if (s === "reading") return "Reading";
  if (s === "ready") return "Ready";
  return "Failed";
}

function statusIcon(s: ConsoleUpload["status"]) {
  if (s === "uploading" || s === "reading") return <Loader2 size={12} className="animate-spin" />;
  if (s === "ready") return <Check size={12} />;
  return <AlertTriangle size={12} />;
}

export function AttachmentChip({
  upload,
  onRemove,
}: {
  upload: ConsoleUpload;
  onRemove: (id: string) => void;
}) {
  const tone =
    upload.status === "ready"
      ? "border-line-200 bg-paper-0 text-ink-950"
      : upload.status === "failed"
        ? "border-[var(--signal-caution)] bg-paper-0 text-[var(--signal-caution)]"
        : "border-line-200 bg-paper-0 text-ink-500";
  return (
    <span
      className={`inline-flex max-w-full items-center gap-2 border px-3 py-2 text-xs ${tone}`}
    >
      <span className="shrink-0 text-ink-500">{iconFor(upload.mime)}</span>
      <span className="truncate max-w-[200px] font-serif text-sm text-ink-950">
        {upload.name}
      </span>
      <span className="ml-1 flex shrink-0 items-center gap-1 font-mono text-[10px] uppercase tracking-[0.18em]">
        {statusIcon(upload.status)} {statusText(upload.status)}
      </span>
      <button
        type="button"
        onClick={() => onRemove(upload.id)}
        aria-label={`Remove ${upload.name}`}
        className="ml-1 shrink-0 rounded-full p-1 text-ink-500 hover:bg-paper-50 hover:text-ink-950"
      >
        <X size={12} />
      </button>
    </span>
  );
}
