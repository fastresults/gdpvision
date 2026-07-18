import { formatDistanceToNow } from "date-fns";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Undo2, GitCommit, MessageSquare } from "lucide-react";
import { toast } from "sonner";

import { restoreCommsRevision } from "@/lib/narrative.functions";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";

type Approval = { from?: string; to?: string; actor_id?: string; note?: string | null; at?: string };
type Revision = { id: string; edited_at: string; editor_id: string | null; body: string };

export function UnifiedTimeline({
  artifactId,
  scopeKey,
  approvals,
  revisions,
}: {
  artifactId: string;
  scopeKey: string;
  approvals: Approval[];
  revisions: Revision[];
}) {
  const qc = useQueryClient();
  const restore = useServerFn(restoreCommsRevision);
  const m = useMutation({
    mutationFn: (revisionId: string) => restore({ data: { artifactId, revisionId } }),
    onSuccess: () => {
      toast.success("Restored earlier version");
      qc.invalidateQueries({ queryKey: ["comms-detail", artifactId] });
      qc.invalidateQueries({ queryKey: ["comms-library", scopeKey] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  type Entry =
    | { kind: "approval"; at: string; a: Approval }
    | { kind: "revision"; at: string; r: Revision };

  const entries: Entry[] = [
    ...approvals.filter((a) => a.at).map<Entry>((a) => ({ kind: "approval", at: a.at as string, a })),
    ...revisions.map<Entry>((r) => ({ kind: "revision", at: r.edited_at, r })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  if (entries.length === 0) {
    return <p className="p-3 text-[12px] text-ink-500">No activity yet.</p>;
  }

  return (
    <ol className="space-y-3 p-3">
      {entries.map((e, i) => (
        <li key={i} className="flex gap-3">
          <div className="mt-0.5 shrink-0">
            {e.kind === "approval"
              ? <MessageSquare size={12} className="text-sky-700" />
              : <GitCommit size={12} className="text-ink-500" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] text-ink-950">
              {e.kind === "approval"
                ? <><b>{e.a.from ?? "—"}</b> → <b>{e.a.to ?? "—"}</b></>
                : <>Edited body</>}
              <span className="ml-2 font-mono text-[10px] uppercase tracking-widest text-ink-500">
                {formatDistanceToNow(new Date(e.at), { addSuffix: true })}
              </span>
            </p>
            {e.kind === "approval" && e.a.note && (
              <p className="mt-0.5 text-[11px] text-ink-700 italic">"{e.a.note}"</p>
            )}
            {e.kind === "revision" && (
              <div className="mt-1 flex items-center gap-2">
                <span className="text-[11px] text-ink-500 line-clamp-1 flex-1">
                  {e.r.body.slice(0, 120).replace(/[#*_>`]/g, "")}…
                </span>
                <CopyButton
                  value={e.r.body}
                  variant="ghost"
                  label="Copy"
                  iconSize={10}
                  className="text-[10px] font-mono uppercase tracking-widest"
                  title="Copy this revision"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-[10px]"
                  onClick={() => m.mutate(e.r.id)}
                  disabled={m.isPending}
                >
                  <Undo2 size={10} className="mr-1" /> Restore
                </Button>
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
