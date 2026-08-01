// Chamber 07 · Track rail.
//
// Shown on every programme surface once a track is chosen. On a blended
// programme it switches between the synthetic and field rails; on a
// single-track programme it states the track and offers the other one.

import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Users2, Wand2 } from "lucide-react";

import { setProjectTrack } from "@/lib/personas/projects.functions";
import { TRACK_META, tracksFor, type ResearchTrack } from "@/lib/personas/tracks";
import { cn } from "@/lib/utils";

export function TrackTabs({
  code,
  projectId,
  track,
  active,
  actions,
}: {
  code: string;
  projectId: string;
  track: ResearchTrack;
  active: "synthetic" | "field";
  actions?: ReactNode;
}) {
  const qc = useQueryClient();
  const setTrackFn = useServerFn(setProjectTrack);
  const upgrade = useMutation({
    mutationFn: (next: ResearchTrack) => setTrackFn({ data: { projectId, track: next } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["persona-projects", code] }),
  });
  const rails = tracksFor(track);

  const tabs = [
    {
      key: "synthetic" as const,
      icon: Wand2,
      label: TRACK_META.synthetic.label,
      caption: "Minutes · directional",
      enabled: rails.synthetic,
      to: "/admin/countries/$code/personas" as const,
      params: { code },
    },
    {
      key: "field" as const,
      icon: Users2,
      label: TRACK_META.field.label,
      caption: "Weeks · citable",
      enabled: rails.field,
      to: "/admin/countries/$code/personas/field/$step" as const,
      params: { code, step: "brief" },
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line-200 pb-2">
      {tabs.map((t) => {
        const Icon = t.icon;
        const isActive = active === t.key && t.enabled;
        if (!t.enabled) {
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => upgrade.mutate("blended")}
              disabled={upgrade.isPending}
              className="flex items-center gap-2 border border-dashed border-line-200 px-3 py-1.5 text-left hover:border-ink-950 disabled:opacity-40"
            >
              <Icon size={12} className="text-ink-500" />
              <span>
                <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
                  Add {t.label}
                </span>
                <span className="block font-mono text-[9px] uppercase tracking-[0.16em] text-ink-500">
                  {upgrade.isPending ? "Enabling…" : t.caption}
                </span>
              </span>
            </button>
          );
        }
        return (
          <Link
            key={t.key}
            to={t.to}
            params={t.params as never}
            search={{ project: projectId }}
            className={cn(
              "flex items-center gap-2 border px-3 py-1.5",
              isActive ? "border-ink-950 bg-ink-950 text-paper-0" : "border-line-200 text-ink-950 hover:border-ink-950",
            )}
          >
            <Icon size={12} />
            <span>
              <span className="block font-mono text-[10px] uppercase tracking-[0.18em]">{t.label}</span>
              <span className={cn("block font-mono text-[9px] uppercase tracking-[0.16em]", isActive ? "text-paper-0/70" : "text-ink-500")}>
                {t.caption}
              </span>
            </span>
          </Link>
        );
      })}
      {actions ? <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
