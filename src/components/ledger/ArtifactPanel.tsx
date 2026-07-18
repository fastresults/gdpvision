// Inline artifact panel: shows the streamed/loaded expansion beneath an answer.
// Reuses citation popovers from the parent component via passed renderCitations.

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Download, RefreshCw, Wand2, X, Loader2 } from "lucide-react";

import {
  expandLedgerAnswer,
  type FigureCitation,
  type LedgerArtifactKind,
  type LedgerArtifactResult,
} from "@/lib/ledger.functions";

const ARTIFACT_LABEL: Record<LedgerArtifactKind, string> = {
  policy_memo: "Policy Memo",
  exec_brief: "Executive Brief",
  press_release: "Press Release",
  talking_points: "Cabinet Talking Points",
  op_ed: "Op-Ed Draft",
};

export function ArtifactPanel({
  countryCode,
  countryName,
  artifact,
  sourceQuestion,
  sourceAnswer,
  citations,
  onClose,
  renderCitations,
  CitationRow,
}: {
  countryCode: string;
  countryName: string;
  artifact: LedgerArtifactKind;
  sourceQuestion: string;
  sourceAnswer: string;
  citations: FigureCitation[];
  onClose: () => void;
  renderCitations: (text: string, cites: FigureCitation[]) => React.ReactNode;
  CitationRow: React.ComponentType<{ cite: FigureCitation }>;
}) {
  const expandFn = useServerFn(expandLedgerAnswer);
  const [refinement, setRefinement] = useState("");
  const [refineOpen, setRefineOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const draft = useMutation({
    mutationFn: (r?: string) =>
      expandFn({
        data: {
          countryCode,
          countryName,
          artifact,
          sourceQuestion,
          sourceAnswer,
          citations: citations.map((c) => ({
            n: c.n,
            kind: c.kind,
            title: c.title,
            url: c.url,
            org: c.org,
            excerpt: c.excerpt,
          })),
          refinement: r,
        },
      }) as Promise<LedgerArtifactResult>,
  });

  // Auto-fire on mount.
  useState(() => {
    draft.mutate(undefined);
    return null;
  });

  const result = draft.data;

  async function copyMd() {
    if (!result) return;
    const text = `# ${result.title}\n\n${result.body_md}${
      result.citations.length
        ? "\n\n---\n\n**Sources**\n" +
          result.citations
            .map((c) => `- [${c.n}] ${c.title}${c.url ? ` — ${c.url}` : ""}${c.org ? ` (${c.org})` : ""}`)
            .join("\n")
        : ""
    }`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // ignore
    }
  }

  function downloadMd() {
    if (!result) return;
    const text = `# ${result.title}\n\n${result.body_md}`;
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${artifact}-${countryCode}-${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mt-3 animate-fade-in border border-ink-950/20 bg-paper-0">
      <header className="flex items-start justify-between gap-2 border-b border-line-200 bg-paper-50/50 px-3 py-2">
        <div className="min-w-0">
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-500">
            Chained from question · {ARTIFACT_LABEL[artifact]}
          </p>
          <p className="mt-0.5 truncate text-[12px] font-medium text-ink-950">
            {result?.title ?? `${ARTIFACT_LABEL[artifact]} — drafting…`}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close artifact"
          className="flex h-7 w-7 shrink-0 items-center justify-center border border-line-200 text-ink-700 hover:border-ink-950 hover:text-ink-950"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </header>

      <div className="px-3 py-3">
        {draft.isPending && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-2 border border-line-200 bg-paper-50/60 px-3 py-2 text-[12px] text-ink-700"
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Drafting {ARTIFACT_LABEL[artifact]}… may take 20–45 seconds.</span>
          </div>
        )}

        {draft.error && (
          <p className="text-[12px] text-red-700">{(draft.error as Error).message}</p>
        )}

        {result && (
          <>
            <article className="prose-artifact whitespace-pre-wrap text-[13px] leading-relaxed text-ink-950">
              {renderCitations(result.body_md, result.citations)}
            </article>

            {result.citations.length > 0 && (
              <ul className="mt-3 space-y-1 border-t border-line-200 pt-2">
                {result.citations.map((c) => (
                  <li key={c.n}>
                    <CitationRow cite={c} />
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-3 font-mono text-[10px] uppercase tracking-widest text-ink-500">
              <button onClick={copyMd} className="inline-flex items-center gap-1 hover:text-ink-950">
                <Copy className="h-3 w-3" />
                {copied ? "Copied" : "Copy"}
              </button>
              <button onClick={downloadMd} className="inline-flex items-center gap-1 hover:text-ink-950">
                <Download className="h-3 w-3" />
                Download .md
              </button>
              <button
                onClick={() => draft.mutate(refinement || undefined)}
                disabled={draft.isPending}
                className="inline-flex items-center gap-1 hover:text-ink-950 disabled:opacity-40"
              >
                <RefreshCw className="h-3 w-3" />
                Regenerate
              </button>
              <button
                onClick={() => setRefineOpen((v) => !v)}
                className="inline-flex items-center gap-1 hover:text-ink-950"
              >
                <Wand2 className="h-3 w-3" />
                {refineOpen ? "Cancel refine" : "Refine…"}
              </button>
            </div>

            {refineOpen && (
              <div className="mt-2 animate-fade-in space-y-2">
                <textarea
                  value={refinement}
                  onChange={(e) => setRefinement(e.target.value)}
                  rows={2}
                  placeholder="e.g. Make it more concise · add fiscal numbers · target IMF Article IV audience"
                  className="w-full resize-none border border-line-200 bg-paper-0 px-2 py-1.5 text-[12px] text-ink-950 placeholder:text-ink-500 focus:border-ink-950 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    draft.mutate(refinement || undefined);
                    setRefineOpen(false);
                  }}
                  disabled={draft.isPending || !refinement.trim()}
                  className="border border-ink-950 bg-ink-950 px-3 py-1 text-[11px] text-paper-0 hover:opacity-90 disabled:opacity-40"
                >
                  Apply refinement
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
