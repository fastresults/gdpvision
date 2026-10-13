// Chamber 05 · pin ("keep in view") and flag ("needs action") on a signal.
// Signals older than 30 days are deleted daily unless pinned or flagged, so
// removing the last mark from an old signal asks for confirmation first.
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Flag, Pin } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { toggleSignalMark, type SignalRow } from "@/lib/narrative-chamber.functions";
import { isPastWindow } from "@/lib/narrative-priority";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Mark = "pin" | "flag";

export function SignalMarks({ signal, size = 12 }: { signal: SignalRow; size?: number }) {
  const qc = useQueryClient();
  const toggle = useServerFn(toggleSignalMark);
  const [pinned, setPinned] = useState(!!signal.pinned_at);
  const [flagged, setFlagged] = useState(!!signal.flagged_at);
  const [confirm, setConfirm] = useState<Mark | null>(null);

  const mut = useMutation({
    mutationFn: (v: { mark: Mark; on: boolean; confirmLoss?: boolean }) =>
      toggle({ data: { id: signal.id, ...v } }),
    onMutate: (v) => (v.mark === "pin" ? setPinned(v.on) : setFlagged(v.on)),
    onSuccess: (res, v) => {
      if (!res.ok && res.willExpire) {
        v.mark === "pin" ? setPinned(true) : setFlagged(true);
        setConfirm(v.mark);
        return;
      }
      qc.invalidateQueries({ queryKey: ["narrative-signals"] });
      qc.invalidateQueries({ queryKey: ["narrative-signals-at-priority"] });
      qc.invalidateQueries({ queryKey: ["narrative-retention"] });
    },
    onError: (e, v) => {
      v.mark === "pin" ? setPinned(!v.on) : setFlagged(!v.on);
      toast.error((e as Error).message);
    },
  });

  const old = isPastWindow(signal.created_at);
  const ageDays = Math.floor((Date.now() - new Date(signal.created_at).getTime()) / 86_400_000);

  const click = (mark: Mark) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const current = mark === "pin" ? pinned : flagged;
    const other = mark === "pin" ? flagged : pinned;
    if (current && old && !other) {
      setConfirm(mark);
      return;
    }
    mut.mutate({ mark, on: !current });
  };

  return (
    <>
      <span className="inline-flex items-center gap-0.5">
        <button
          type="button"
          onClick={click("pin")}
          aria-pressed={pinned}
          aria-label={pinned ? "Unpin signal" : "Pin signal — keep in view"}
          title={pinned ? "Pinned — kept in view" : "Pin to keep in view"}
          className={cn(
            "p-1 transition",
            pinned ? "text-ink-950" : "text-ink-300 hover:text-ink-950",
          )}
        >
          <Pin size={size} className={pinned ? "fill-current" : undefined} />
        </button>
        <button
          type="button"
          onClick={click("flag")}
          aria-pressed={flagged}
          aria-label={flagged ? "Remove flag" : "Flag signal — needs action"}
          title={flagged ? "Flagged — needs action" : "Flag as needing action"}
          className={cn(
            "p-1 transition",
            flagged ? "text-rose-600" : "text-ink-300 hover:text-rose-600",
          )}
        >
          <Flag size={size} className={flagged ? "fill-current" : undefined} />
        </button>
      </span>

      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === "pin" ? "Unpin" : "Remove flag from"} this {ageDays}-day-old story?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Signals older than 30 days are kept only while they are pinned or flagged. If you
              continue, “{signal.topic}” will be permanently deleted at the next daily cleanup and
              cannot be recovered.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirm) mut.mutate({ mark: confirm, on: false, confirmLoss: true });
                setConfirm(null);
              }}
            >
              Remove and allow deletion
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
