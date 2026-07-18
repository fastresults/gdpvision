import { useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Wraps text that may overflow. Shows a truncated preview inline; clicking
 * "Read more" opens a modal with the full markdown-rendered content.
 *
 * Use for: sector labels, action labels, briefing bullets, citations —
 * anywhere text may be visually clipped.
 */
export function ReadMore({
  title,
  text,
  clamp = 2,
  className,
  triggerClassName,
  markdown = true,
}: {
  title: string;
  text: string;
  clamp?: 1 | 2 | 3 | 4;
  className?: string;
  triggerClassName?: string;
  markdown?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const clampClass =
    clamp === 1
      ? "line-clamp-1"
      : clamp === 2
      ? "line-clamp-2"
      : clamp === 3
      ? "line-clamp-3"
      : "line-clamp-4";
  const long = text.length > 120 || text.split(/\s+/).length > 22;
  return (
    <>
      <span className={cn("inline-block align-baseline", className)}>
        <span className={cn(clampClass, "whitespace-normal")}>{text}</span>
        {long && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={cn(
              "ml-1 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500 underline decoration-dotted underline-offset-2 hover:text-ink-950",
              triggerClassName,
            )}
          >
            Read more
          </button>
        )}
      </span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl text-ink-950">{title}</DialogTitle>
          </DialogHeader>
          <div className="prose prose-sm max-w-none text-ink-950">
            {markdown ? <ReactMarkdown>{text}</ReactMarkdown> : <p>{text}</p>}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function CitationChipButton({
  n,
  org,
  title,
  url,
  className,
}: {
  n: number;
  org?: string | null;
  title?: string | null;
  url?: string | null;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center gap-1 border border-line-200 bg-paper-0 px-2 py-0.5 font-mono text-[10px] text-ink-700 hover:border-ink-950 hover:text-ink-950",
          className,
        )}
      >
        [{n}] {org ?? "src"}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg text-ink-950">
              Citation [{n}]
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-ink-950">
            {title && <p className="font-medium leading-snug">{title}</p>}
            {org && (
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
                {org}
              </p>
            )}
            {url ? (
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="block break-all text-xs text-blue-700 underline underline-offset-2"
              >
                {url}
              </a>
            ) : (
              <p className="text-xs text-ink-500">No source URL on record.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
