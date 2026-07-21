import { Link, useMatchRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check, FileText, FlaskConical, Layers, Lock, Users } from "lucide-react";

import { listPersonas, listSegments } from "@/lib/personas/generate.functions";
import { listStudies } from "@/lib/personas/study.functions";
import { cn } from "@/lib/utils";

type StageKey = "brief" | "cast" | "group" | "rehearse";

export function StudioStepper({
  code,
  active,
  activeProjectId,
  autoStatus,
  rehearseStatus,
  briefCommitted = true,
}: {
  code: string;
  active?: StageKey;
  activeProjectId?: string;
  autoStatus?: string;
  rehearseStatus?: string;
  briefCommitted?: boolean;
}) {
  const matchRoute = useMatchRoute();
  const personas = useQuery({
    queryKey: ["personas", code, activeProjectId ?? "none"],
    queryFn: () => activeProjectId ? listPersonas({ data: { countryCode: code, projectId: activeProjectId } }) : Promise.resolve([]),
    enabled: !!activeProjectId,
  });
  const segments = useQuery({
    queryKey: ["persona-segments", code, activeProjectId ?? "none"],
    queryFn: () => activeProjectId ? listSegments({ data: { countryCode: code, projectId: activeProjectId } }) : Promise.resolve([]),
    enabled: !!activeProjectId,
  });
  const studies = useQuery({
    queryKey: ["studies", code, activeProjectId ?? "none"],
    queryFn: () => activeProjectId ? listStudies({ data: { countryCode: code, projectId: activeProjectId } }) : Promise.resolve([]),
    enabled: !!activeProjectId,
  });

  const onIndex = !!matchRoute({
    to: "/admin/countries/$code/personas",
    params: { code },
    fuzzy: false,
  });
  const onSegments = !!matchRoute({
    to: "/admin/countries/$code/personas/segments",
    params: { code },
    fuzzy: true,
  });
  const onStudies = !!matchRoute({
    to: "/admin/countries/$code/personas/studies",
    params: { code },
    fuzzy: true,
  });

  const pCount = Array.isArray(personas.data) ? personas.data.length : 0;
  const sCount = Array.isArray(segments.data) ? segments.data.length : 0;
  const stCount = Array.isArray(studies.data) ? studies.data.length : 0;

  const nodes: Array<{
    key: StageKey;
    n: number;
    label: string;
    sub: string;
    count: number;
    countLabel: string;
    icon: typeof Users;
    isActive: boolean;
    to: "/admin/countries/$code/personas" | "/admin/countries/$code/personas/segments" | "/admin/countries/$code/personas/studies";
    exact: boolean;
    locked?: boolean;
    complete?: boolean;
  }> = [
    {
      key: "brief",
      n: 0,
      label: "Brief",
      sub: "Intake",
      count: briefCommitted ? 1 : 0,
      countLabel: briefCommitted ? "committed" : "required",
      icon: FileText,
      isActive: active === "brief",
      to: "/admin/countries/$code/personas",
      exact: true,
      complete: briefCommitted,
    },
    {
      key: "cast",
      n: 1,
      label: "Cast",
      sub: "Personas",
      count: pCount,
      countLabel: pCount === 1 ? "persona" : "personas",
      icon: Users,
      isActive: active === "cast" || (active === undefined && onIndex),
      to: "/admin/countries/$code/personas",
      exact: true,
      locked: !briefCommitted,
    },
    {
      key: "group",
      n: 2,
      label: "Group",
      sub: "Segments",
      count: sCount,
      countLabel: sCount === 1 ? "segment" : "segments",
      icon: Layers,
      isActive: active === "group" || (active === undefined && onSegments),
      to: "/admin/countries/$code/personas/segments",
      exact: false,
      locked: !briefCommitted,
    },
    {
      key: "rehearse",
      n: 3,
      label: "Rehearse",
      sub: "Studies",
      count: stCount,
      countLabel: stCount === 1 ? "study" : "studies",
      icon: FlaskConical,
      isActive: active === "rehearse" || (active === undefined && onStudies),
      to: "/admin/countries/$code/personas/studies",
      exact: false,
      locked: !briefCommitted,
    },
  ];

  return (
    <nav
      aria-label="Studio stages"
      className="sticky top-0 z-20 -mx-6 border-b border-line-200 bg-paper-0/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-paper-0/80"
    >
      <ol className="grid grid-cols-4 gap-2">
        {nodes.map((s) => {
          const Icon = s.icon;
          const complete = s.count > 0;
          return (
            <li key={s.key}>
              <Link
                to={s.to}
                params={{ code }}
                search={activeProjectId ? { project: activeProjectId, open: 1 } : undefined}
                activeOptions={{ exact: s.exact }}
                className={cn(
                  "group flex items-start gap-3 border-l-2 py-1 pl-3 transition-colors",
                  s.isActive
                    ? "border-ink-950"
                    : complete
                      ? "border-emerald-500/60 hover:border-ink-950"
                      : "border-line-200 hover:border-ink-500",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border font-mono text-[11px] tabular-nums",
                    s.isActive
                      ? "border-ink-950 bg-ink-950 text-paper-0"
                      : complete
                        ? "border-emerald-500 bg-emerald-500 text-paper-0"
                        : "border-line-200 text-ink-500",
                  )}
                >
                  {complete && !s.isActive ? (
                    <Check size={12} strokeWidth={3} />
                  ) : (
                    s.n.toString().padStart(2, "0")
                  )}
                </span>
                <span className="min-w-0">
                  <span
                    className={cn(
                      "flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em]",
                      s.isActive ? "text-ink-950" : "text-ink-500",
                    )}
                  >
                    <Icon size={11} /> Stage {s.n.toString().padStart(2, "0")} · {s.sub}
                  </span>
                  <span className="mt-0.5 block font-serif text-[15px] leading-tight text-ink-950">
                    {s.label}
                  </span>
                  <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
                    {s.count} {s.countLabel}
                    {autoStatus && s.key === "group" && (
                      <span className="ml-2 border border-ink-950/40 bg-paper-100 px-1.5 py-0.5 text-[9px] tracking-[0.14em] text-ink-950">
                        {autoStatus}
                      </span>
                    )}
                    {rehearseStatus && s.key === "rehearse" && (
                      <span className="ml-2 border border-ink-950/40 bg-paper-100 px-1.5 py-0.5 text-[9px] tracking-[0.14em] text-ink-950">
                        {rehearseStatus}
                      </span>
                    )}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
