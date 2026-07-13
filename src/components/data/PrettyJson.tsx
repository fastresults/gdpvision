import { createContext, useContext, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { humanizeKey, formatNumber, splitCitations, linkifyParts } from "./humanize";

type Json = null | string | number | boolean | Json[] | { [k: string]: Json };

export interface Citation {
  url: string;
  title?: string | null;
  domain?: string | null;
  quote?: string | null;
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

function CitationRef({ refs }: { refs: number[] }) {
  const ctx = useContext(CitationContext);
  const label = `[${refs.join(",")}]`;
  if (!ctx || ctx.citations.length === 0) {
    return (
      <sup className="ml-1 text-[9px] font-mono text-ink-400 tracking-wider">{label}</sup>
    );
  }
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        ctx.open(refs);
      }}
      className="ml-0.5 text-[9px] font-mono text-ink-500 tracking-wider align-super hover:text-ink-950 underline decoration-dotted underline-offset-2 cursor-pointer"
      title={`View source${refs.length > 1 ? "s" : ""} ${label}`}
    >
      {label}
    </button>
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
  if (c.domain) return c.domain;
  try {
    return new URL(c.url).hostname.replace(/^www\./, "");
  } catch {
    return c.url;
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
          {refs.map((n) => {
            const c = citations[n - 1];
            if (!c) {
              return (
                <div key={n} className="border border-line-200 p-3">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-ink-500 mb-1">[{n}]</div>
                  <p className="text-sm text-ink-400">Source unavailable</p>
                </div>
              );
            }
            return (
              <article key={n} className="border border-line-200 p-4 space-y-2">
                <header className="flex items-baseline justify-between gap-3">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
                    [{n}] · {domainOf(c)}
                  </div>
                  {c.published_at && (
                    <div className="font-mono text-[10px] text-ink-400 tabular-nums">
                      {new Date(c.published_at).toISOString().slice(0, 10)}
                    </div>
                  )}
                </header>
                {c.title && (
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block font-serif text-base text-ink-950 hover:underline"
                  >
                    {c.title}
                  </a>
                )}
                {c.quote && (
                  <blockquote className="border-l-2 border-line-200 pl-3 text-sm text-ink-700 italic leading-relaxed">
                    {c.quote}
                  </blockquote>
                )}
                <a
                  href={c.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block font-mono text-[11px] text-ink-500 hover:text-ink-950 underline break-all"
                >
                  {c.url}
                </a>
              </article>
            );
          })}
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

  if (isEmpty(value)) return <p className="text-sm text-ink-400">No data.</p>;

  const ctx: CitationCtx = {
    citations,
    open: (refs) => setModalRefs(refs),
  };

  return (
    <CitationContext.Provider value={ctx}>
      <div className="space-y-3">
        <Node value={value} />
        {showRaw && (
          <details className="mt-2" open={rawOpen} onToggle={(e) => setRawOpen((e.target as HTMLDetailsElement).open)}>
            <summary className="cursor-pointer text-[10px] font-mono uppercase tracking-widest text-ink-400 hover:text-ink-700">
              View raw JSON
            </summary>
            <pre className="mt-2 text-[11px] whitespace-pre-wrap max-h-64 overflow-y-auto bg-paper-50 border border-line-200 p-2 rounded-sm">
              {JSON.stringify(value, null, 2)}
            </pre>
          </details>
        )}
      </div>
      <CitationDialog
        citations={citations}
        refs={modalRefs ?? []}
        open={modalRefs !== null}
        onOpenChange={(o) => !o && setModalRefs(null)}
      />
    </CitationContext.Provider>
  );
}
