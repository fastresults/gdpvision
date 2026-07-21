// Chamber 07 · Research Programs index.
// First-class list of every research program (project) for a country with
// per-program synthesis status and a prominent "New program" CTA.

import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Archive,
  ArrowUpRight,
  CheckCircle2,
  FolderPlus,
  Loader2,
  MoreHorizontal,
  Pencil,
  PlayCircle,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useRef, useState } from "react";

import {
  archiveProject,
  createProject,
  deleteProject,
  listProjects,
  renameProject,
} from "@/lib/personas/projects.functions";
import { projectsQuery } from "./ProjectSwitcher";

type Project = Awaited<ReturnType<typeof listProjects>>[number];

function relTime(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const s = Math.round(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function statusOf(p: Project): {
  label: string;
  tone: "ok" | "run" | "draft" | "muted";
} {
  if (p.status === "archived") return { label: "Archived", tone: "muted" };
  if (p.has_program_memo) return { label: "Synthesized", tone: "ok" };
  if (p.studies_total > 0 && p.studies_done < p.studies_total)
    return { label: "In progress", tone: "run" };
  if (p.studies_total === 0) return { label: "Draft", tone: "draft" };
  return { label: "Ready", tone: "ok" };
}

export function ProgramsIndex({ code }: { code: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const q = useQuery(projectsQuery(code));
  const projects = q.data ?? [];

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");

  const createFn = useServerFn(createProject);
  const create = useMutation({
    mutationFn: (t: string) => createFn({ data: { countryCode: code, title: t } }),
    onSuccess: async (result) => {
      // Server-fn result may be the row or `{ data: row }` depending on wrapping.
      const row = (result && typeof result === "object" && "id" in (result as Record<string, unknown>)
        ? (result as { id?: string })
        : ((result as { data?: { id?: string } } | undefined)?.data ?? { id: undefined }));
      let projectId = row?.id;
      await qc.invalidateQueries({ queryKey: ["persona-projects", code] });
      if (!projectId) {
        // Fall back to the freshest project for this country.
        const list = qc.getQueryData<Project[]>(["persona-projects", code]) ?? [];
        projectId = list[0]?.id;
      }
      setTitle("");
      setShowForm(false);
      if (!code || !projectId) {
        console.error("[programs] navigate skipped — missing code or projectId", { code, projectId, result });
        return;
      }
      try {
        await navigate({
          to: "/admin/countries/$code/personas/studies",
          params: { code },
          search: { project: projectId },
        });
      } catch (err) {
        console.error("[programs] navigate failed", { code, projectId, err });
      }

    },
  });


  const empty = projects.length === 0;

  return (
    <section className="border border-ink-950 bg-paper-0">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center border border-ink-950 bg-ink-950 text-paper-0">
            <Sparkles size={12} />
          </span>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">
              Research programs
            </p>
            <p className="font-serif text-lg leading-tight text-ink-950">
              {projects.length === 0
                ? "No programs yet"
                : `${projects.length} program${projects.length === 1 ? "" : "s"}`}
            </p>
          </div>
        </div>
        {!empty && (
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-1.5 border border-ink-950 bg-ink-950 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-paper-0 hover:bg-ink-700"
          >
            <FolderPlus size={11} /> New program
          </button>
        )}
      </header>

      {(showForm || empty) && (
        <div className="border-b border-line-200 bg-paper-100/40 px-4 py-4">
          {empty && (
            <p className="mb-2 max-w-xl text-sm text-ink-700">
              A research program bundles segments, studies, and one consolidated synthesis memo.
              Give it a name and the studio will auto-run end-to-end.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Investor confidence — H2"
              onKeyDown={(e) => {
                if (e.key === "Enter" && title.trim().length >= 2) create.mutate(title.trim());
                if (e.key === "Escape") {
                  setTitle("");
                  setShowForm(false);
                }
              }}
              className="min-w-[280px] flex-1 border border-line-200 bg-paper-0 px-2 py-1.5 text-sm text-ink-950 focus:border-ink-950 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => title.trim().length >= 2 && create.mutate(title.trim())}
              disabled={create.isPending || title.trim().length < 2}
              className="inline-flex items-center gap-1.5 border border-ink-950 bg-ink-950 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-paper-0 hover:bg-ink-700 disabled:opacity-40"
            >
              {create.isPending ? (
                <>
                  <Loader2 size={11} className="animate-spin" /> Creating…
                </>
              ) : empty ? (
                <>
                  <Sparkles size={11} /> Start your first program
                </>
              ) : (
                "Create program"
              )}
            </button>
            {!empty && (
              <button
                type="button"
                onClick={() => {
                  setTitle("");
                  setShowForm(false);
                }}
                className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500 hover:text-ink-950"
              >
                Cancel
              </button>
            )}
          </div>
          {create.isError && (
            <p className="mt-2 text-[11px] text-rose-600">{(create.error as Error).message}</p>
          )}
        </div>
      )}

      {!empty && (
        <ul className="divide-y divide-line-200">
          {projects.map((p) => (
            <ProgramRow key={p.id} p={p} code={code} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ProgramRow({ p, code }: { p: Project; code: string }) {
  const qc = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(p.title);
  const menuRef = useRef<HTMLDivElement>(null);
  const status = statusOf(p);
  const pct =
    p.studies_total > 0 ? Math.round((p.studies_done / p.studies_total) * 100) : 0;

  const renameFn = useServerFn(renameProject);
  const archiveFn = useServerFn(archiveProject);
  const deleteFn = useServerFn(deleteProject);
  const rename = useMutation({
    mutationFn: (t: string) => renameFn({ data: { projectId: p.id, title: t } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["persona-projects", code] });
      setRenaming(false);
    },
  });
  const archive = useMutation({
    mutationFn: (archived: boolean) => archiveFn({ data: { projectId: p.id, archived } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["persona-projects", code] }),
  });
  const remove = useMutation({
    mutationFn: () => deleteFn({ data: { projectId: p.id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["persona-projects", code] }),
  });

  const toneClass =
    status.tone === "ok"
      ? "border-emerald-600 text-emerald-700"
      : status.tone === "run"
        ? "border-ink-950 text-ink-950"
        : status.tone === "draft"
          ? "border-amber-500 text-amber-700"
          : "border-line-200 text-ink-500";

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            {renaming ? (
              <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && title.trim().length >= 2) rename.mutate(title.trim());
                  if (e.key === "Escape") {
                    setTitle(p.title);
                    setRenaming(false);
                  }
                }}
                onBlur={() => {
                  if (title.trim() && title.trim() !== p.title) rename.mutate(title.trim());
                  else {
                    setTitle(p.title);
                    setRenaming(false);
                  }
                }}
                className="min-w-[240px] border border-ink-950 bg-paper-0 px-2 py-0.5 font-serif text-base text-ink-950 focus:outline-none"
              />
            ) : (
              <Link
                to="/admin/countries/$code/personas/studies"
                params={{ code }}
                search={{ project: p.id }}
                className="font-serif text-base text-ink-950 hover:underline"
              >
                {p.title}
              </Link>
            )}
            <span
              className={`inline-flex items-center gap-1 border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] ${toneClass}`}
            >
              {status.tone === "ok" && <CheckCircle2 size={10} />}
              {status.tone === "run" && <Loader2 size={10} className="animate-spin" />}
              {status.label}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
            <span className="tabular-nums">
              {p.studies_done}/{p.studies_total} studies
            </span>
            <span>·</span>
            <span className="tabular-nums">
              {p.segments_total} segment{p.segments_total === 1 ? "" : "s"}
            </span>
            <span>·</span>
            <span>Updated {relTime(p.updated_at)}</span>
          </div>
          {p.studies_total > 0 && (
            <div className="mt-2 h-[3px] w-full max-w-[360px] overflow-hidden bg-line-200">
              <div
                className={`h-full transition-[width] duration-500 ${
                  pct === 100 ? "bg-emerald-600" : "bg-ink-950"
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {p.has_program_memo ? (
            <Link
              to="/admin/countries/$code/personas/studies"
              params={{ code }}
              search={{ project: p.id }}
              className="inline-flex items-center gap-1 border border-emerald-600 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-700 hover:bg-emerald-600 hover:text-paper-0"
            >
              Open report <ArrowUpRight size={11} />
            </Link>
          ) : (
            <Link
              to="/admin/countries/$code/personas/studies"
              params={{ code }}
              search={{ project: p.id }}
              className="inline-flex items-center gap-1 border border-ink-950 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-950 hover:bg-ink-950 hover:text-paper-0"
            >
              <PlayCircle size={11} /> Continue
            </Link>
          )}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="border border-line-200 p-1 text-ink-500 hover:border-ink-950 hover:text-ink-950"
              aria-label="More actions"
            >
              <MoreHorizontal size={14} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-[calc(100%+4px)] z-20 min-w-[160px] border border-ink-950 bg-paper-0 shadow-lg">
                <button
                  type="button"
                  onClick={() => {
                    setRenaming(true);
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left font-mono text-[10px] uppercase tracking-[0.18em] text-ink-950 hover:bg-paper-100"
                >
                  <Pencil size={11} /> Rename
                </button>
                <button
                  type="button"
                  onClick={() => {
                    archive.mutate(p.status !== "archived");
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left font-mono text-[10px] uppercase tracking-[0.18em] text-ink-950 hover:bg-paper-100"
                >
                  <Archive size={11} /> {p.status === "archived" ? "Unarchive" : "Archive"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
