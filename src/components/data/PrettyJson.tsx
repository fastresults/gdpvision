import { useState } from "react";
import { humanizeKey, formatNumber, splitCitations, linkifyParts } from "./humanize";

type Json = null | string | number | boolean | Json[] | { [k: string]: Json };

const TITLE_KEYS = ["title", "name", "label", "heading"];

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
      {refs.length > 0 && (
        <sup className="ml-1 text-[9px] font-mono text-ink-400 tracking-wider">
          [{refs.join(",")}]
        </sup>
      )}
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

  // Single scalar field → inline definition
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

export function PrettyJson({ value, showRaw = true }: { value: Json; showRaw?: boolean }) {
  const [open, setOpen] = useState(false);
  if (isEmpty(value)) return <p className="text-sm text-ink-400">No data.</p>;
  return (
    <div className="space-y-3">
      <Node value={value} />
      {showRaw && (
        <details className="mt-2" open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
          <summary className="cursor-pointer text-[10px] font-mono uppercase tracking-widest text-ink-400 hover:text-ink-700">
            View raw JSON
          </summary>
          <pre className="mt-2 text-[11px] whitespace-pre-wrap max-h-64 overflow-y-auto bg-paper-50 border border-line-200 p-2 rounded-sm">
            {JSON.stringify(value, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}
