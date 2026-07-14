// AI-first "Why this number?" — Second Brain grounded explanation panel.
// Every figure surfaced in the instrument becomes a click-target that opens
// this sheet. UI contract: never render an ungrounded answer.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type ReactNode } from "react";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { explainFigure, pinFigureSnapshot } from "@/lib/ledger.functions";
import { cn } from "@/lib/utils";

type FigureKind =
  | "sector_share"
  | "cbi_exposure"
  | "series_point"
  | "composition_total"
  | "capital_flow";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  countryCode: string;
  figureKind: FigureKind;
  figureRef: Record<string, string | number | null>;
  label: string;
  value?: number | string | null;
  unit?: string;
  confidenceGrade?: string;
}

export function WhyThisNumberPanel({
  open,
  onOpenChange,
  countryCode,
  figureKind,
  figureRef,
  label,
  value,
  unit,
  confidenceGrade,
}: Props) {
  const explainFn = useServerFn(explainFigure);
  const pinFn = useServerFn(pinFigureSnapshot);
  const qc = useQueryClient();

  const explainQuery = useQuery({
    enabled: open,
    queryKey: ["explain-figure", countryCode, figureKind, figureRef, label],
    queryFn: () =>
      explainFn({
        data: { countryCode, figureKind, figureRef, label, value, unit, confidenceGrade },
      }),
    staleTime: 5 * 60 * 1000,
  });

  const [note, setNote] = useState("");
  const [pinned, setPinned] = useState(false);

  const pinMut = useMutation({
    mutationFn: () =>
      pinFn({
        data: {
          countryCode,
          figureKind,
          figureRef,
          label,
          value: typeof value === "number" ? value : null,
          unit: unit ?? null,
          confidenceGrade: confidenceGrade ?? null,
          scope: "personal",
          note: note || null,
          aiExplanation: explainQuery.data?.answer ?? null,
          citations: (explainQuery.data?.citations ?? []) as unknown as Record<string, unknown>[],
          sourceSnapshot: (explainQuery.data?.citations ?? []).map((c) => ({
            title: c.title, url: c.url, org: c.org, source_id: c.source_id,
          })),
        },
      }),
    onSuccess: () => {
      setPinned(true);
      qc.invalidateQueries({ queryKey: ["figure-snapshots", countryCode] });
    },
  });

  const data = explainQuery.data;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-xl overflow-y-auto bg-paper-0 p-0">
        <div className="border-b border-line-200 px-6 py-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            Why this number? · {countryCode}
          </p>
          <SheetHeader className="mt-1 space-y-0">
            <SheetTitle className="font-serif text-2xl leading-tight text-ink-950">
              {label}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-3 flex flex-wrap items-baseline gap-3">
            {value !== undefined && value !== null && (
              <span className="font-serif text-3xl text-ink-950" data-numeric>
                {typeof value === "number" ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : value}
                {unit && <span className="ml-1 font-mono text-xs uppercase tracking-widest text-ink-500">{unit}</span>}
              </span>
            )}
            {confidenceGrade && (
              <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-widest">
                Grade {confidenceGrade}
              </Badge>
            )}
          </div>
        </div>

        <div className="space-y-8 px-6 py-6">
          <Section title="AI explanation · Second Brain grounded">
            {explainQuery.isLoading && (
              <p className="text-sm text-ink-500">Retrieving evidence from the Second Brain…</p>
            )}
            {explainQuery.error && (
              <p className="text-sm text-red-700">
                {(explainQuery.error as Error).message}
              </p>
            )}
            {data && !data.grounded && (
              <div className="rounded-sm border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                <p className="font-mono text-[10px] uppercase tracking-widest">Ungrounded</p>
                <p className="mt-2">
                  {data.refusal_reason ??
                    "No corpus evidence supports this figure. Ingest a source in Stewardship, then retry."}
                </p>
              </div>
            )}
            {data?.grounded && data.answer && (
              <p className="text-[15px] leading-relaxed text-ink-950">
                {renderWithCitations(data.answer, data.citations)}
              </p>
            )}
          </Section>

          {data && data.citations.length > 0 && (
            <Section title={`Citations (${data.citations.length})`}>
              <ol className="space-y-3 text-sm">
                {data.citations.map((c) => (
                  <li key={`${c.kind}-${c.n}`} className="flex gap-3 border-l-2 border-line-200 pl-3">
                    <span className="mt-0.5 shrink-0 font-mono text-[10px] uppercase tracking-widest text-ink-500">
                      [{c.n}]
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-ink-950">
                        {c.url ? (
                          <a
                            href={c.url}
                            target="_blank"
                            rel="noreferrer"
                            className="underline underline-offset-2 hover:text-ink-700"
                          >
                            {c.title}
                          </a>
                        ) : (
                          c.title
                        )}
                      </p>
                      <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-ink-500">
                        {c.kind}{c.org ? ` · ${c.org}` : ""}
                      </p>
                      <p className="mt-1 text-xs text-ink-700 line-clamp-3">{c.excerpt}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </Section>
          )}

          {data && data.revisions.length > 0 && (
            <Section title={`Revision history (${data.revisions.length})`}>
              <ul className="space-y-2 font-mono text-[11px] text-ink-700">
                {data.revisions.map((r) => (
                  <li key={r.id} className="flex items-baseline justify-between gap-3 border-b border-line-200/60 pb-1.5">
                    <span>
                      {r.period ?? "—"} · {r.previous_value ?? "—"} → {r.new_value ?? "—"}
                    </span>
                    <span className="text-ink-500">{new Date(r.created_at).toISOString().slice(0, 10)}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section title="Pin to snapshot">
            <p className="text-xs text-ink-500">
              Save an immutable copy of this figure — value, grade, sources, and AI paragraph — so
              later revisions don't rewrite history.
            </p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note (why you're pinning this)…"
              rows={2}
              className="mt-3 w-full border-b border-line-200 bg-transparent p-2 text-sm focus:border-ink-950 focus:outline-none"
            />
            <div className="mt-3 flex items-center gap-3">
              <Button
                size="sm"
                variant="outline"
                onClick={() => pinMut.mutate()}
                disabled={pinMut.isPending || pinned || !data}
              >
                {pinned ? "Pinned ✓" : pinMut.isPending ? "Pinning…" : "Pin snapshot"}
              </Button>
              {pinMut.error && (
                <span className="text-xs text-red-700">{(pinMut.error as Error).message}</span>
              )}
            </div>
          </Section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h4 className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">{title}</h4>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function renderWithCitations(
  text: string,
  citations: Array<{ n: number; title: string; url: string | null }>,
): ReactNode[] {
  const parts: ReactNode[] = [];
  const regex = /\[(\d+)\]/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = regex.exec(text))) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const n = Number(match[1]);
    const c = citations.find((x) => x.n === n);
    parts.push(
      <sup key={`c-${key++}`} className="mx-0.5 font-mono">
        {c?.url ? (
          <a
            href={c.url}
            target="_blank"
            rel="noreferrer"
            title={c.title}
            className={cn("underline decoration-dotted underline-offset-2 hover:text-ink-950")}
          >
            [{n}]
          </a>
        ) : (
          <span title={c?.title ?? ""}>[{n}]</span>
        )}
      </sup>,
    );
    last = regex.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}
