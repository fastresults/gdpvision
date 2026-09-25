// One PRD section: its text (rendered, or a textarea while editing), its
// status, the draft / redraft action, and the provenance rail — the context
// lines the model saw and the ones it cited.

import { useEffect, useState } from "react";

import { CitedMarkdown } from "@/components/citations/CitedMarkdown";
import { Explain } from "@/components/explain/Explain";
import type { CitationRow, SectionRow } from "@/lib/egov/db";
import { EGOV_STAGE_BY_KEY } from "@/lib/egov/stages";
import { cn } from "@/lib/utils";

import { MICRO, SECTION_META, formatWhen } from "./labels";

/** Markdown styling for a section body: light surfaces, hierarchy by type and rules only. */
export const MD_CLASS =
  "mt-6 max-w-none text-[15px] leading-relaxed text-ink-950 [&_h3]:mt-7 [&_h3]:font-display [&_h3]:text-lg [&_h3]:text-ink-950 [&_h4]:mt-5 [&_h4]:font-mono [&_h4]:text-[11px] [&_h4]:uppercase [&_h4]:tracking-[0.15em] [&_h4]:text-ink-500 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mt-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mt-1 [&_table]:mt-4 [&_table]:w-full [&_table]:border-t [&_table]:border-line-200 [&_table]:text-sm [&_th]:border-b [&_th]:border-line-200 [&_th]:py-1.5 [&_th]:pr-3 [&_th]:text-left [&_th]:font-mono [&_th]:text-[10px] [&_th]:uppercase [&_th]:tracking-[0.2em] [&_th]:text-ink-500 [&_td]:border-b [&_td]:border-line-200 [&_td]:py-1.5 [&_td]:pr-3 [&_td]:align-top [&_blockquote]:mt-4 [&_blockquote]:border-l-2 [&_blockquote]:border-signal-negative [&_blockquote]:pl-4 [&_blockquote]:text-ink-700 [&_strong]:text-ink-950 [&_a]:underline [&_a]:decoration-line-200 [&_a]:underline-offset-4";

export function SectionEditor({
  section,
  citations,
  canDraft,
  canEdit,
  busy,
  blockedBy,
  onDraft,
  onSave,
}: {
  section: SectionRow;
  citations: CitationRow[];
  canDraft: boolean;
  canEdit: boolean;
  busy: boolean;
  /** Stages that must be drafted first, by short label. */
  blockedBy: string[];
  onDraft: () => void;
  onSave: (body: string) => Promise<void>;
}) {
  const meta = SECTION_META[section.status];
  const stage = EGOV_STAGE_BY_KEY[section.stage_key];
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(section.body_md);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showContext, setShowContext] = useState(false);

  useEffect(() => {
    setBody(section.body_md);
    setEditing(false);
  }, [section.id, section.body_md]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await onSave(body);
      setEditing(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const draftLabel =
    section.status === "pending"
      ? "Draft this section"
      : section.status === "stale"
        ? "Refresh"
        : "Redraft";

  return (
    <section aria-labelledby={`sec-${section.stage_key}`}>
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line-200 pb-3">
        <div>
          <div className={MICRO}>
            Section {section.ordinal} ·{" "}
            <span className={meta.text}>
              <span
                className={cn(
                  "mr-1 inline-block h-1.5 w-1.5 rounded-full border",
                  meta.border,
                  meta.hollow ? "" : "bg-current",
                )}
              />
              {meta.label}
            </span>
          </div>
          <h2 id={`sec-${section.stage_key}`} className="mt-1 font-display text-2xl text-ink-950">
            {section.heading}
          </h2>
          <p className="mt-1 max-w-2xl text-xs text-ink-500">{stage.desc}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {section.status !== "pending" && !editing && canEdit && (
            <button
              type="button"
              className="btn-ghost px-3 py-1.5 text-xs"
              onClick={() => setEditing(true)}
              disabled={busy}
            >
              Edit
            </button>
          )}
          {canDraft && (
            <button
              type="button"
              className={cn(
                section.status === "pending" ? "btn-primary" : "btn-secondary",
                "px-3 py-1.5 text-xs",
              )}
              onClick={onDraft}
              disabled={busy || blockedBy.length > 0 || editing}
              title={blockedBy.length ? `Draft ${blockedBy.join(", ")} first.` : undefined}
            >
              {busy ? "Drafting…" : draftLabel}
            </button>
          )}
        </div>
      </div>

      {blockedBy.length > 0 && section.status === "pending" && (
        <p className="mt-3 text-xs text-ink-500">
          <Explain id="egov.stage.order">Builds on</Explain> {blockedBy.join(", ")} — draft those
          first.
        </p>
      )}

      {section.status === "stale" && (
        <p className="mt-3 border-l-2 border-signal-caution py-1 pl-3 text-sm text-ink-700">
          <Explain id="egov.section.stale" ctx={{ authoredAt: section.authored_at }}>
            The corpus has changed since this section was written.
          </Explain>{" "}
          Refresh it, or edit it by hand, before approval.
        </p>
      )}

      {editing ? (
        <div className="mt-4">
          <textarea
            className="min-h-[28rem] w-full border border-line-200 bg-paper-0 px-3 py-2 font-mono text-[13px] leading-relaxed text-ink-950 focus:border-ink-950 focus:outline-none"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            aria-label={`Edit ${section.heading}`}
            maxLength={40000}
          />
          {error && <p className="mt-2 text-sm text-signal-negative">{error}</p>}
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              className="btn-primary px-3 py-1.5 text-xs"
              onClick={save}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              className="btn-ghost px-3 py-1.5 text-xs"
              onClick={() => {
                setBody(section.body_md);
                setEditing(false);
              }}
              disabled={saving}
            >
              Cancel
            </button>
            <span className="ml-auto text-xs text-ink-500">
              Markdown. Editing a submitted or approved PRD reopens it.
            </span>
          </div>
        </div>
      ) : section.status === "pending" ? (
        <p className="mt-6 border-l-2 border-line-200 py-4 pl-4 text-sm text-ink-500">
          Not yet drafted.{" "}
          {canDraft ? "Draft it from the corpus, or edit to write it by hand." : ""}
        </p>
      ) : (
        <CitedMarkdown source={section.body_md} className={MD_CLASS} />
      )}

      {section.status !== "pending" && (
        <aside className="mt-8 border-t border-line-200 pt-4" aria-label="Provenance">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className={MICRO}>
              <Explain
                id="egov.section.grounding"
                ctx={{
                  contextLines: section.context?.length ?? 0,
                  citations: citations.length,
                  status: section.status,
                  model: section.model,
                }}
              >
                Provenance
              </Explain>
            </div>
            <div className="text-xs text-ink-500">
              {section.authored_at ? `Drafted ${formatWhen(section.authored_at)}` : ""}
              {section.edited_at ? ` · edited ${formatWhen(section.edited_at)}` : ""}
              {section.model ? ` · ${section.model}` : ""}
            </div>
          </div>

          {citations.length > 0 ? (
            <ul className="mt-3 space-y-1.5">
              {citations.map((c) => (
                <li key={c.id} className="grid grid-cols-[minmax(0,14rem)_1fr] gap-3 text-xs">
                  <span className="truncate text-ink-950" title={c.source_ref}>
                    {c.label}
                  </span>
                  <span className="text-ink-700">{c.excerpt}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-ink-500">
              No context lines were cited for this section.
            </p>
          )}

          {section.context && section.context.length > 0 && (
            <details
              className="mt-3"
              open={showContext}
              onToggle={(e) => setShowContext((e.target as HTMLDetailsElement).open)}
            >
              <summary className="cursor-pointer text-xs text-ink-500 hover:text-ink-950">
                Everything the model was shown ({section.context.length} lines)
              </summary>
              <ol className="mt-2 max-h-80 space-y-1 overflow-auto border-l border-line-200 pl-3 text-[11.5px] leading-snug text-ink-700">
                {section.context.map((l) => (
                  <li key={l.key}>
                    <span className="font-mono text-ink-500">{l.key}</span> — {l.text}
                  </li>
                ))}
              </ol>
            </details>
          )}
        </aside>
      )}
    </section>
  );
}
