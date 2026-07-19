/**
 * PrettyJson — GLOBAL RULE:
 * Every JSON-shaped value shown to a user MUST render via <PrettyJson>.
 * Raw JSON.stringify(...) in UI is permitted ONLY:
 *   (a) as the value/defaultValue of a <textarea> used for editing, or
 *   (b) inside a collapsed <details> "debug" block whose sibling is <PrettyJson>.
 * No other exceptions. Enforced by eslint (no-restricted-syntax).
 */
import { createContext, useContext, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { humanizeKey, formatNumber, splitCitations, linkifyParts } from "./humanize";
import { citationForNumber, hasCitableUrl, normalizeCitableCitations, sanitizeJsonCitationMarkers } from "@/lib/citations/hygiene";

type Json = null | string | number | boolean | Json[] | { [k: string]: Json };

export interface Citation {
  url?: string | null;
  title?: string | null;
  label?: string | null;
  kind?: string | null;
  ref?: string | null;
  domain?: string | null;
  org?: string | null;
  quote?: string | null;
  excerpt?: string | null;
  published_at?: string | null;
}

const TITLE_KEYS = ["title", "name", "label", "heading"];

interface CitationCtx {
  citations: Citation[];
  open: (refs: number[]) => void;
}
const CitationContext = createContext<CitationCtx | null>(null);

function isEmpty(v: Json): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "object") return Object.keys(v).length === 0;
  return false;
}

function isPrimitive(v: Json): boolean {
  return v === null || ["string", "number", "boolean"].includes(typeof v);
}

function pickTitle(obj: Record<string, Json>): { title?: string; rest: Record<string, Json> } {
  for (const k of TITLE_KEYS) {
    if (typeof obj[k] === "string" && (obj[k] as string).trim()) {
      const { [k]: _, ...rest } = obj;
      return { title: obj[k] as string, rest };
    }
  }
  return { rest: obj };
}

function useHasHover() {
  const [hasHover, setHasHover] = useState(true);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(hover: hover)");
    const update = () => setHasHover(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);
  return hasHover;
}

function dedupeRefs(refs: number[]): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const r of refs) {
    if (!seen.has(r)) {
      seen.add(r);
      out.push(r);
    }
  }
  return out;
}

function CitationCard({ n, citation }: { n: number; citation?: Citation }) {
  if (!hasCitableUrl(citation)) return null;
  return (
    <article className="border border-line-200 p-4 space-y-2">
      <header className="flex items-baseline justify-between gap-3">
        <div className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
          [{n}] · {domainOf(citation)}
        </div>
        {citation.published_at && (
          <div className="font-mono text-[10px] text-ink-400 tabular-nums">
            {new Date(citation.published_at).toISOString().slice(0, 10)}
          </div>
        )}
      </header>
      {(citation.title || citation.label) && (
        citation.url ? (
          <a href={citation.url} target="_blank" rel="noreferrer" className="block font-serif text-base text-ink-950 hover:underline">
            {citation.title ?? citation.label}
          </a>
        ) : (
          <p className="block font-serif text-base text-ink-950">{citation.title ?? citation.label}</p>
        )
      )}
      {(citation.quote || citation.excerpt) && (
        <blockquote className="border-l-2 border-line-200 pl-3 text-sm text-ink-700 italic leading-relaxed">
          {citation.quote ?? citation.excerpt}
        </blockquote>
      )}
      {citation.ref && <p className="font-mono text-[11px] text-ink-500 break-all">{citation.ref}</p>}
      <a href={citation.url} target="_blank" rel="noreferrer" className="block font-mono text-[11px] text-ink-500 hover:text-ink-950 underline break-all">
        {citation.url}
      </a>
    </article>
  );
}

function CitationRef({ refs: rawRefs }: { refs: number[] }) {
  const ctx = useContext(CitationContext);
  const refs = dedupeRefs(rawRefs).filter((n) => !!citationForNumber(ctx?.citations ?? [], n));
  if (refs.length === 0) return null;
  const label = `[${refs.join(",")}]`;
  const hasHover = useHasHover();

  if (!ctx || ctx.citations.length === 0) return null;

  const triggerClasses =
    "ml-0.5 text-[9px] font-mono text-ink-500 tracking-wider align-super hover:text-ink-950 underline decoration-dotted underline-offset-2 cursor-pointer";

  const openModal = () => ctx.open(refs);

  if (!hasHover) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          openModal();
        }}
        className={triggerClasses}
        title={`View source${refs.length > 1 ? "s" : ""} ${label}`}
      >
        {label}
      </button>
    );
  }

  return (
    <HoverCard openDelay={150} closeDelay={100}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            openModal();
          }}
          className={triggerClasses}
          title={`View source${refs.length > 1 ? "s" : ""} ${label}`}
        >
          {label}
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        align="start"
        side="top"
        sideOffset={6}
        collisionPadding={12}
        className="w-[420px] max-w-[calc(100vw-24px)] max-h-[60vh] overflow-y-auto p-3 space-y-3"
      >
        {refs.map((n) => (
          <CitationCard key={n} n={n} citation={citationForNumber(ctx.citations, n)} />
        ))}
      </HoverCardContent>
    </HoverCard>
  );
}

function RichText({ value }: { value: string }) {
  const { text, refs } = splitCitations(value);
  const parts = linkifyParts(text);
  return (
    <span>
      {parts.map((p, i) =>
        p.kind === "url" ? (
          <a key={i} href={p.value} target="_blank" rel="noreferrer" className="font-mono text-[11px] text-ink-500 hover:text-ink-950 underline break-all">
            {p.value}
          </a>
        ) : (
          <span key={i}>{p.value}</span>
        )
      )}
      {refs.length > 0 && <CitationRef refs={refs} />}
    </span>
  );
}

function Scalar({ value }: { value: Json }) {
  if (value === null || value === undefined) return <span className="text-ink-400">—</span>;
  if (typeof value === "number") return <span className="tabular-nums">{formatNumber(value)}</span>;
  if (typeof value === "boolean")
    return <span className="font-mono text-[11px] uppercase tracking-widest text-ink-500">{value ? "yes" : "no"}</span>;
  return <RichText value={String(value)} />;
}

function Node({ value, depth = 0 }: { value: Json; depth?: number }) {
  if (isEmpty(value)) return null;
  if (isPrimitive(value)) return <p className="text-sm leading-relaxed"><Scalar value={value} /></p>;

  if (Array.isArray(value)) {
    const items = value.filter((v) => !isEmpty(v));
    if (items.length === 0) return null;
    const allPrim = items.every(isPrimitive);
    const allStr = allPrim && items.every((v) => typeof v === "string");
    if (allStr) {
      return (
        <ul className="list-disc pl-5 space-y-1 text-sm leading-relaxed marker:text-ink-400">
          {items.map((v, i) => (
            <li key={i}><Scalar value={v} /></li>
          ))}
        </ul>
      );
    }
    if (allPrim) {
      return (
        <p className="text-sm leading-relaxed">
          {items.map((v, i) => (
            <span key={i}>
              {i > 0 && <span className="text-ink-400">, </span>}
              <Scalar value={v} />
            </span>
          ))}
        </p>
      );
    }
    return (
      <div className="space-y-3">
        {items.map((v, i) => (
          <div key={i} className="border-l-2 border-line-200 pl-3">
            <Node value={v} depth={depth + 1} />
          </div>
        ))}
      </div>
    );
  }

  // Object
  const obj = value as Record<string, Json>;
  const { title, rest } = pickTitle(obj);
  const entries = Object.entries(rest).filter(([, v]) => !isEmpty(v));

  if (!title && entries.length === 1 && isPrimitive(entries[0][1])) {
    const [k, v] = entries[0];
    return (
      <p className="text-sm leading-relaxed">
        <span className="font-mono text-[10px] uppercase tracking-widest text-ink-500 mr-2">{humanizeKey(k)}</span>
        <Scalar value={v} />
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {title && <h4 className="font-serif text-base">{title}</h4>}
      {entries.map(([k, v]) => {
        if (isPrimitive(v)) {
          return (
            <div key={k} className="text-sm leading-relaxed">
              <div className="font-mono text-[10px] uppercase tracking-widest text-ink-500 mb-0.5">{humanizeKey(k)}</div>
              <div><Scalar value={v} /></div>
            </div>
          );
        }
        return (
          <section key={k} className="space-y-1.5">
            <h5 className="font-mono text-[10px] uppercase tracking-widest text-ink-500">{humanizeKey(k)}</h5>
            <Node value={v} depth={depth + 1} />
          </section>
        );
      })}
    </div>
  );
}

function domainOf(c: Citation): string {
  if (c.org) return c.org;
  if (c.domain) return c.domain;
  if (c.kind) return c.kind;
  try {
    return new URL(c.url ?? "").hostname.replace(/^www\./, "");
  } catch {
    return c.label ?? c.ref ?? "Source";
  }
}

function CitationDialog({
  citations,
  refs,
  open,
  onOpenChange,
}: {
  citations: Citation[];
  refs: number[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">
            Source{refs.length > 1 ? "s" : ""} <span className="font-mono text-sm text-ink-500">[{refs.join(",")}]</span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          {refs.map((n) => (
            <CitationCard key={n} n={n} citation={citationForNumber(citations, n)} />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function PrettyJson({
  value,
  showRaw = true,
  citations = [],
}: {
  value: Json;
  showRaw?: boolean;
  citations?: Citation[];
}) {
  const [rawOpen, setRawOpen] = useState(false);
  const [modalRefs, setModalRefs] = useState<number[] | null>(null);
  const cleanCitations = normalizeCitableCitations(citations as never) as Citation[];
  const cleanValue = sanitizeJsonCitationMarkers(value, cleanCitations) as Json;

  if (isEmpty(cleanValue)) return <p className="text-sm text-ink-400">No data.</p>;

  const ctx: CitationCtx = {
    citations: cleanCitations,
    open: (refs) => setModalRefs(refs),
  };

  return (
    <CitationContext.Provider value={ctx}>
      <div className="space-y-3">
        <Node value={cleanValue} />
        {showRaw && (
          <details className="mt-2" open={rawOpen} onToggle={(e) => setRawOpen((e.target as HTMLDetailsElement).open)}>
            <summary className="cursor-pointer text-[10px] font-mono uppercase tracking-widest text-ink-400 hover:text-ink-700">
              View raw JSON
            </summary>
            <pre className="mt-2 text-[11px] whitespace-pre-wrap max-h-64 overflow-y-auto bg-paper-50 border border-line-200 p-2 rounded-sm">
              {JSON.stringify(cleanValue, null, 2)}
            </pre>
          </details>
        )}
      </div>
      <CitationDialog
        citations={cleanCitations}
        refs={modalRefs ?? []}
        open={modalRefs !== null}
        onOpenChange={(o) => !o && setModalRefs(null)}
      />
    </CitationContext.Provider>
  );
}
