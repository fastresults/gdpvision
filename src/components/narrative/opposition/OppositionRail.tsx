import { Link } from "@tanstack/react-router";
import { AlertTriangle, Image as ImageIcon, Link2, FileText, Loader2 } from "lucide-react";

import type { OppositionItem } from "@/lib/narrative/opposition-intake.functions";

function kindIcon(kind: string) {
  if (kind === "meme" || kind === "screenshot") return <ImageIcon size={11} />;
  if (kind === "link") return <Link2 size={11} />;
  return <FileText size={11} />;
}

export function OppositionRail({
  items,
  code,
  activeId,
}: {
  items: OppositionItem[];
  code: string;
  activeId?: string;
}) {
  if (items.length === 0) {
    return (
      <div className="border border-dashed border-line-200 p-3 text-xs text-ink-500">
        Nothing captured yet. Drop a meme or forwarded story to open the tray.
      </div>
    );
  }
  return (
    <ul className="space-y-1.5">
      {items.map((it) => {
        const active = it.id === activeId;
        return (
          <li key={it.id}>
            <Link
              to="/admin/countries/$code/narrative/opposition/$id"
              params={{ code, id: it.id }}
              className={`block border px-2.5 py-2 transition ${
                active
                  ? "border-ink-950 bg-paper-50"
                  : "border-line-200 hover:border-ink-950 hover:bg-paper-50"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="line-clamp-2 text-[12px] leading-snug text-ink-950">
                  {it.title || it.motivation_summary || it.source_url || "Untitled"}
                </p>
                {typeof it.severity === "number" && it.severity >= 4 && (
                  <AlertTriangle size={12} className="mt-0.5 flex-none text-rose-600" />
                )}
              </div>
              <div className="mt-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">
                <span className="inline-flex items-center gap-1">
                  {kindIcon(it.kind)} {it.kind}
                </span>
                <span>·</span>
                <span>{new Date(it.created_at).toLocaleDateString()}</span>
                {it.status !== "analyzed" && (
                  <>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      {it.status === "analyzing" && <Loader2 size={9} className="animate-spin" />}
                      {it.status}
                    </span>
                  </>
                )}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
