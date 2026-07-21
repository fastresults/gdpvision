// Chamber 07 · Research projects switcher.
// A single country can run multiple concurrent research programs — this
// switcher surfaces every project and lets the admin open one or launch a new
// one. The active project id is carried in the `?project=` URL search param.

import { useMutation, useQuery, useQueryClient, queryOptions } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, FolderPlus, Loader2 } from "lucide-react";
import { useRef, useState } from "react";

import { createProject, listProjects } from "@/lib/personas/projects.functions";

export function projectsQuery(code: string) {
  return queryOptions({
    queryKey: ["persona-projects", code],
    queryFn: () => listProjects({ data: { countryCode: code } }),
    refetchInterval: 30_000,
  });
}

export function ProjectSwitcher({
  code,
  activeProjectId,
  routeId,
}: {
  code: string;
  activeProjectId?: string;
  routeId:
    | "/admin/countries/$code/personas/studies"
    | "/admin/countries/$code/personas/segments"
    | "/admin/countries/$code/personas/scope";
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const q = useQuery(projectsQuery(code));
  const projects = q.data ?? [];
  const active = projects.find((p) => p.id === activeProjectId) ?? projects[0] ?? null;

  const [open, setOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const detailsRef = useRef<HTMLDetailsElement>(null);

  const createFn = useServerFn(createProject);
  const create = useMutation({
    mutationFn: (title: string) => createFn({ data: { countryCode: code, title } }),
    onSuccess: async (row) => {
      await qc.invalidateQueries({ queryKey: ["persona-projects", code] });
      setNewTitle("");
      setOpen(false);
      if (detailsRef.current) detailsRef.current.open = false;
      // Newly created program → carry `auto=1` so the auto-run pipeline kicks off.
      navigate({
        to: routeId,
        params: { code },
        search: (s: Record<string, unknown>) => ({ ...s, project: row?.id, auto: 1 }),
      });
    },
  });

  const setActive = (id: string) => {
    // Switching projects is a read-only action — never carry `auto` intent.
    navigate({
      to: routeId,
      params: { code },
      search: (s: Record<string, unknown>) => ({ ...s, project: id, auto: undefined }),
    });
    setOpen(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 border border-line-200 bg-paper-100/60 px-3 py-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
        Research project
      </span>

      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 border border-ink-950 bg-paper-0 px-3 py-1.5 font-serif text-[13px] leading-tight text-ink-950 hover:bg-ink-950 hover:text-paper-0"
        >
          <span className="max-w-[220px] truncate">{active?.title ?? "No projects yet"}</span>
          <ChevronDown size={12} />
        </button>
        {open && projects.length > 0 && (
          <div className="absolute left-0 top-[calc(100%+4px)] z-30 min-w-[280px] border border-ink-950 bg-paper-0 shadow-lg">
            <ul className="max-h-[320px] overflow-y-auto">
              {projects.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setActive(p.id)}
                    className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-paper-100 ${
                      p.id === active?.id ? "bg-paper-100" : ""
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-serif text-[13px] text-ink-950">
                        {p.title}
                      </span>
                      <span className="mt-0.5 block font-mono text-[9px] uppercase tracking-[0.16em] text-ink-500">
                        {p.studies_done}/{p.studies_total} studies
                        {p.has_program_memo && " · memo ready"}
                        {p.status === "archived" && " · archived"}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {active && (
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
          {active.studies_done}/{active.studies_total} studies · {active.segments_total} segment
          {active.segments_total === 1 ? "" : "s"}
          {active.has_program_memo && " · memo ready"}
        </span>
      )}

      <div className="ml-auto">
        <details ref={detailsRef} className="group">
          <summary className="inline-flex cursor-pointer items-center gap-1.5 border border-line-200 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-700 hover:border-ink-950 hover:text-ink-950">
            <FolderPlus size={11} /> New project
          </summary>
          <div className="mt-2 flex items-center gap-2 border border-line-200 bg-paper-0 p-2">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Investor confidence — H2"
              className="w-64 border border-line-200 bg-paper-0 px-2 py-1 text-[13px] text-ink-950 focus:border-ink-950 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => newTitle.trim() && create.mutate(newTitle.trim())}
              disabled={create.isPending || newTitle.trim().length < 2}
              className="inline-flex items-center gap-1.5 border border-ink-950 bg-ink-950 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-paper-0 hover:bg-ink-700 disabled:opacity-40"
            >
              {create.isPending ? (
                <><Loader2 size={11} className="animate-spin" /> Creating…</>
              ) : (
                "Create"
              )}
            </button>
          </div>
          {create.isError && (
            <p className="mt-1 text-[11px] text-rose-600">{(create.error as Error).message}</p>
          )}
        </details>
      </div>

      {/* Silences unused warning while keeping the search-param API stable for future filters. */}
      <span className="hidden">{JSON.stringify(search).slice(0, 0)}</span>
    </div>
  );
}
