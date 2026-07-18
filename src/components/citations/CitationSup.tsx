import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { ExternalLink } from "lucide-react";

export type CitationRef = {
  url?: string;
  title?: string;
  org?: string | null;
  label?: string;
  excerpt?: string;
};

function hostOf(url?: string): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function CitationSup({ n, citation }: { n: number; citation?: CitationRef }) {
  const url = citation?.url;
  const host = hostOf(url);
  const heading = citation?.title || citation?.label || (host ? host : `Source ${n}`);
  const org = citation?.org ?? host ?? undefined;

  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <sup>
          <a
            href={url || "#"}
            target={url ? "_blank" : undefined}
            rel={url ? "noopener noreferrer" : undefined}
            onClick={(e) => {
              if (!url) e.preventDefault();
            }}
            className="ml-0.5 inline-flex min-w-[16px] items-center justify-center rounded-sm bg-ink-100 px-[3px] font-mono text-[9px] leading-[14px] text-ink-800 no-underline hover:bg-ink-950 hover:text-paper-0 focus:outline-none focus:ring-1 focus:ring-ink-950"
            aria-label={`Citation ${n}${citation?.title ? `: ${citation.title}` : ""}`}
          >
            {n}
          </a>
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
        {citation?.excerpt && (
          <p className="border-b border-line-200 px-3 py-2 text-[12px] italic leading-relaxed text-ink-700">
            "{citation.excerpt}"
          </p>
        )}
        <div className="flex items-center justify-between px-3 py-2">
          <span className="truncate pr-2 font-mono text-[10px] text-ink-500">
            {url || "No URL on file"}
          </span>
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-950 hover:underline"
            >
              Open <ExternalLink size={10} />
            </a>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
