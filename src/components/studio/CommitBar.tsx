import { CheckCircle2, GitBranch, Save } from "lucide-react";
import { cn } from "@/lib/utils";

export function CommitBar({
  dirty,
  saving,
  promoting,
  onSaveDraft,
  onPromotePackages,
  onPromoteScenario,
  promoted,
}: {
  dirty: boolean;
  saving: boolean;
  promoting: null | "packages" | "scenario";
  onSaveDraft: () => void;
  onPromotePackages: () => void;
  onPromoteScenario: () => void;
  promoted: { packages: boolean; scenarioId: string | null };
}) {
  return (
    <div className="sticky bottom-0 z-10 -mx-8 border-t border-line-200 bg-paper-0/95 px-8 py-4 backdrop-blur">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <p className="mr-auto font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
          {dirty ? "Unsaved changes" : "All saved"}
        </p>
        <button
          type="button"
          disabled={saving}
          onClick={onSaveDraft}
          className="inline-flex items-center gap-1.5 border border-line-200 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-950 hover:border-ink-950 disabled:opacity-50"
        >
          <Save size={13} />
          {saving ? "Saving…" : "Save draft"}
        </button>
        <button
          type="button"
          disabled={!!promoting || dirty || promoted.packages}
          onClick={onPromotePackages}
          className={cn(
            "inline-flex items-center gap-1.5 border px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em]",
            promoted.packages
              ? "border-emerald-500 bg-emerald-50 text-emerald-700"
              : "border-ink-950 bg-ink-950 text-paper-0 disabled:opacity-40",
          )}
          title={dirty ? "Save first" : "Promote to plan of record"}
        >
          {promoted.packages ? <CheckCircle2 size={13} /> : null}
          {promoting === "packages"
            ? "Promoting…"
            : promoted.packages
            ? "Promoted to plan"
            : "Promote to plan of record"}
        </button>
        <button
          type="button"
          disabled={!!promoting || dirty}
          onClick={onPromoteScenario}
          className="inline-flex items-center gap-1.5 border border-line-200 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-950 hover:border-ink-950 disabled:opacity-40"
        >
          <GitBranch size={13} />
          {promoting === "scenario" ? "Modeling…" : "Model as scenario"}
        </button>
      </div>
    </div>
  );
}
