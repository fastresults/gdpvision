import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { ExternalLink } from "lucide-react";
import { hasCitableUrl, hostFromUrl } from "@/lib/citations/hygiene";

export type CitationRef = {
  n?: number;
  url?: string;
  title?: string;
  org?: string | null;
  label?: string;
  kind?: string;
  ref?: string;
  excerpt?: string;
  quote?: string | null;
  domain?: string | null;
  published_at?: string | null;
};

export function CitationSup({ n, citation }: { n: number; citation?: CitationRef }) {
  const [open, setOpen] = useState(false);
  if (!hasCitableUrl(citation)) return null;

  const url = citation.url;
  const host = citation.domain ?? hostFromUrl(url);
  const heading = citation?.title || citation?.label || (host ? host : `Source ${n}`);
  const org = citation?.org ?? host ?? undefined;
  const excerpt = citation?.excerpt ?? citation?.quote ?? undefined;

  return (
    <>
      <HoverCard openDelay={120} closeDelay={80}>
        <HoverCardTrigger asChild>
          <sup>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setOpen(true);
              }}
              className="ml-0.5 inline-flex min-w-[16px] cursor-pointer items-center justify-center rounded-sm bg-ink-100 px-[3px] font-mono text-[9px] leading-[14px] text-ink-800 no-underline hover:bg-ink-950 hover:text-paper-0 focus:outline-none focus:ring-1 focus:ring-ink-950"
              aria-label={`Open citation ${n}${heading ? `: ${heading}` : ""}`}
              title={`Open citation ${n}`}
            >
              {n}
            </button>
          </sup>
        </HoverCardTrigger>
        <HoverCardContent
          side="top"
          align="center"
          className="w-[320px] rounded-none border border-line-200 bg-paper-0 p-0 text-ink-950 shadow-lg"
        >
          <div className="border-b border-line-200 px-3 py-2">
            <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-ink-500">
              Source [{n}]{org ? ` · ${org}` : ""}
            </p>
            <p className="mt-0.5 line-clamp-3 font-serif text-[13px] leading-snug text-ink-950">
              {heading}
            </p>
          </div>
          {excerpt && (
            <p className="border-b border-line-200 px-3 py-2 text-[12px] italic leading-relaxed text-ink-700">
              "{excerpt}"
            </p>
          )}
          <div className="flex items-center justify-between px-3 py-2">
            <span className="truncate pr-2 font-mono text-[10px] text-ink-500">
              {url}
            </span>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="inline-flex shrink-0 items-center gap-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-950 hover:underline"
            >
              Details
            </button>
          </div>
        </HoverCardContent>
      </HoverCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto rounded-none border border-line-200 bg-paper-0 text-ink-950">
          <DialogHeader>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">
              Source [{n}]{org ? ` · ${org}` : ""}
            </p>
            <DialogTitle className="font-serif text-xl leading-tight text-ink-950">
              {heading}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm leading-relaxed text-ink-700">
            {excerpt && (
              <blockquote className="border-l-2 border-line-200 pl-3 italic">
                "{excerpt}"
              </blockquote>
            )}
            <dl className="grid gap-3 border border-line-200 bg-paper-50 p-3 sm:grid-cols-2">
              {citation?.kind && (
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">Type</dt>
                  <dd className="mt-1 text-ink-950">{citation.kind}</dd>
                </div>
              )}
              {citation?.ref && (
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">Reference</dt>
                  <dd className="mt-1 break-all text-ink-950">{citation.ref}</dd>
                </div>
              )}
              {citation?.published_at && (
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">Published</dt>
                  <dd className="mt-1 text-ink-950">{new Date(citation.published_at).toISOString().slice(0, 10)}</dd>
                </div>
              )}
              <div className="sm:col-span-2">
                <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">URL</dt>
                <dd className="mt-1 break-all text-ink-950">{url}</dd>
              </div>
            </dl>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 border border-ink-950 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-950 hover:bg-ink-950 hover:text-paper-0"
            >
              Open source <ExternalLink size={12} />
            </a>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
