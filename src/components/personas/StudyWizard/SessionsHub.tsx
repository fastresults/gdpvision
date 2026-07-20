// Chamber 07 · Research Studio · Sessions Hub — list / resume / rename / duplicate / delete drafts.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, FileText, MoreVertical, Pencil, Play, Plus, Trash2, Users } from "lucide-react";

import {
  deleteDraft, duplicateDraft, listDrafts, renameDraft,
} from "@/lib/personas/wizard.functions";

type Props = {
  countryCode: string;
  onResume: (draftId: string) => void;
  onStartNew: () => void;
};

const STEP_LABEL: Record<string, string> = {
  brief: "01 · Brief",
  outcome: "02 · Outcome",
  cast: "03 · Cast",
  preview: "04 · Preview",
  launch: "05 · Launch",
};

function relative(iso: string): string {
  const d = new Date(iso).getTime();
  const s = Math.round((Date.now() - d) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

export function SessionsHub({ countryCode, onResume, onStartNew }: Props) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["study-drafts", countryCode],
    queryFn: () => listDrafts({ data: { countryCode } }),
    refetchOnWindowFocus: true,
  });
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["study-drafts", countryCode] });

  const del = useMutation({
    mutationFn: (id: string) => deleteDraft({ data: { id } }),
    onSuccess: invalidate,
  });
  const dup = useMutation({
    mutationFn: (id: string) => duplicateDraft({ data: { id } }),
    onSuccess: invalidate,
  });
  const rename = useMutation({
    mutationFn: (v: { id: string; title: string }) => renameDraft({ data: v }),
    onSuccess: () => { setRenaming(null); invalidate(); },
  });

  const drafts = data ?? [];

  return (
    <section className="border border-line-200 bg-paper-0">
      <header className="flex items-center justify-between border-b border-line-200 px-4 py-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            Research Studio · Sessions
          </p>
          <h3 className="mt-0.5 font-serif text-lg text-ink-950">
            Studio assets · {drafts.length}
          </h3>
          <p className="mt-0.5 text-[11px] text-ink-500">
            Every brief, outcome blueprint, and cast draft persists here. Resume, fork, or archive.
          </p>
        </div>
        <button
          type="button"
          onClick={onStartNew}
          className="inline-flex items-center gap-1.5 border border-ink-950 bg-ink-950 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-paper-0 hover:bg-ink-700"
        >
          <Plus size={12} /> New session
        </button>
      </header>

      {isLoading ? (
        <p className="p-6 text-sm text-ink-500">Loading sessions…</p>
      ) : drafts.length === 0 ? (
        <div className="p-8 text-center">
          <FileText className="mx-auto text-ink-300" size={28} />
          <p className="mt-3 font-serif text-base text-ink-950">No studio sessions yet</p>
          <p className="mt-1 text-[12px] text-ink-500">
            Launch a new session to capture a brief, define the outcome, and cast personas & instruments.
          </p>
          <button
            type="button"
            onClick={onStartNew}
            className="mt-4 inline-flex items-center gap-1.5 border border-ink-950 bg-ink-950 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-paper-0 hover:bg-ink-700"
          >
            <Plus size={12} /> Start your first study
          </button>
        </div>
      ) : (
        <ul className="divide-y divide-line-200">
          {drafts.map((d) => {
            const title = d.title?.trim() || "Untitled brief";
            const isRenaming = renaming?.id === d.id;
            return (
              <li key={d.id} className="group relative flex items-start gap-3 px-4 py-3 hover:bg-paper-50">
                <button
                  type="button"
                  onClick={() => onResume(d.id)}
                  className="grid h-9 w-9 shrink-0 place-items-center border border-line-200 text-ink-950 hover:border-ink-950"
                  aria-label={`Resume ${title}`}
                >
                  <Play size={14} />
                </button>
                <div className="min-w-0 flex-1">
                  {isRenaming ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (renaming!.title.trim()) rename.mutate({ id: d.id, title: renaming!.title.trim() });
                      }}
                      className="flex items-center gap-2"
                    >
                      <input
                        autoFocus
                        value={renaming!.title}
                        onChange={(e) => setRenaming({ id: d.id, title: e.target.value })}
                        onBlur={() => setRenaming(null)}
                        className="w-full border border-ink-950 bg-paper-0 px-2 py-1 font-serif text-sm text-ink-950 focus:outline-none"
                      />
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onResume(d.id)}
                      className="block w-full truncate text-left font-serif text-sm text-ink-950 hover:underline"
                    >
                      {title}
                    </button>
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">
                    <span className="border border-line-200 bg-paper-0 px-1.5 py-0.5 text-ink-700">
                      {STEP_LABEL[d.step] ?? d.step}
                    </span>
                    <span>{relative(d.updated_at)}</span>
                    {d.deliverable_count > 0 && <span>{d.deliverable_count} deliverables</span>}
                    {d.persona_count > 0 && (
                      <span className="inline-flex items-center gap-1"><Users size={10} /> {d.persona_count}</span>
                    )}
                    {d.segment_count > 0 && <span>{d.segment_count} segments</span>}
                    {d.instrument_count > 0 && <span>{d.instrument_count} instruments</span>}
                    {d.upload_count > 0 && <span>{d.upload_count} uploads</span>}
                  </div>
                  {d.brief_raw && (
                    <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-ink-700">
                      {d.brief_raw}
                    </p>
                  )}
                </div>
                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setMenuFor(menuFor === d.id ? null : d.id)}
                    className="grid h-8 w-8 place-items-center text-ink-500 hover:bg-paper-100 hover:text-ink-950"
                    aria-label="Actions"
                  >
                    <MoreVertical size={14} />
                  </button>
                  {menuFor === d.id && (
                    <div
                      className="absolute right-0 top-9 z-10 w-40 border border-line-200 bg-paper-0 py-1 shadow-lg"
                      onMouseLeave={() => setMenuFor(null)}
                    >
                      <MenuItem icon={Pencil} label="Rename" onClick={() => { setMenuFor(null); setRenaming({ id: d.id, title: title }); }} />
                      <MenuItem icon={Copy} label="Duplicate" onClick={() => { setMenuFor(null); dup.mutate(d.id); }} />
                      <MenuItem
                        icon={Trash2}
                        label="Delete"
                        destructive
                        onClick={() => { setMenuFor(null); if (confirm(`Delete "${title}"? This cannot be undone.`)) del.mutate(d.id); }}
                      />
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function MenuItem({
  icon: Icon, label, onClick, destructive,
}: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; onClick: () => void; destructive?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] hover:bg-paper-50 ${
        destructive ? "text-rose-600" : "text-ink-950"
      }`}
    >
      <Icon size={12} /> {label}
    </button>
  );
}
