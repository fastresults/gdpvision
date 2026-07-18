import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, ChevronRight, Loader2, Send, ThumbsUp, Radio, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { transitionCommsState } from "@/lib/narrative.functions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const STEPS = ["draft", "review", "approved", "released"] as const;
type State = (typeof STEPS)[number];

const NEXT_META: Record<State, { next: State | null; label: string; icon: React.ComponentType<{ size?: number }>; verb: string; requireNote: boolean }> = {
  draft:    { next: "review",   label: "Send for approval", icon: Send,        verb: "sent for review",  requireNote: false },
  review:   { next: "approved", label: "Approve",           icon: ThumbsUp,    verb: "approved",         requireNote: false },
  approved: { next: "released", label: "Release now",       icon: Radio,       verb: "released",         requireNote: false },
  released: { next: null,       label: "Released",          icon: CheckCircle2, verb: "released",        requireNote: false },
};

const STEP_LABEL: Record<State, string> = {
  draft: "Draft",
  review: "In review",
  approved: "Approved",
  released: "Released",
};

export function WorkflowRail({
  artifactId,
  state,
  scopeKey,
}: {
  artifactId: string;
  state: State;
  scopeKey: string;
}) {
  const qc = useQueryClient();
  const transition = useServerFn(transitionCommsState);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [pendingTo, setPendingTo] = useState<State | null>(null);

  const meta = NEXT_META[state];
  const currentIdx = STEPS.indexOf(state);

  const m = useMutation({
    mutationFn: (to: State) => transition({ data: { id: artifactId, to, note: note || undefined } }),
    onSuccess: (_res, to) => {
      toast.success(`Draft ${NEXT_META[state].verb}`);
      qc.invalidateQueries({ queryKey: ["comms-detail", artifactId] });
      qc.invalidateQueries({ queryKey: ["comms-library", scopeKey] });
      qc.invalidateQueries({ queryKey: ["comms-library-facets", scopeKey] });
      qc.invalidateQueries({ queryKey: ["comms-workflow-counts", scopeKey] });
      setNoteOpen(false);
      setNote("");
      setPendingTo(null);
      void to;
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const advance = (to: State, withNote: boolean) => {
    if (withNote) {
      setPendingTo(to);
      setNoteOpen(true);
    } else {
      m.mutate(to);
    }
  };

  return (
    <div className="border border-line-200 bg-paper-50 p-3 space-y-3">
      {/* Tracker */}
      <ol className="flex items-center gap-1 overflow-x-auto">
        {STEPS.map((s, i) => {
          const done = i < currentIdx;
          const cur = i === currentIdx;
          return (
            <li key={s} className="flex items-center gap-1 shrink-0">
              <span
                className={cn(
                  "flex items-center gap-1.5 border px-2 py-1 font-mono text-[10px] uppercase tracking-widest",
                  cur && "border-ink-950 bg-ink-950 text-paper-0",
                  done && "border-emerald-300 bg-emerald-50 text-emerald-800",
                  !cur && !done && "border-line-200 text-ink-500",
                )}
              >
                {done && <CheckCircle2 size={10} />}
                {STEP_LABEL[s]}
              </span>
              {i < STEPS.length - 1 && <ChevronRight size={12} className="text-ink-400" />}
            </li>
          );
        })}
      </ol>

      {/* Guidance + CTA */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12px] text-ink-700">
          {state === "draft" && "Ready for review? Send this to your Comms Lead."}
          {state === "review" && "Awaiting a reviewer decision — approve or request changes."}
          {state === "approved" && "Approved. Release now, or schedule a publish time."}
          {state === "released" && "Released. Duplicate or save as template for reuse."}
        </p>
        <div className="flex items-center gap-2">
          {state === "review" && (
            <Button
              size="sm"
              variant="outline"
              disabled={m.isPending}
              onClick={() => advance("draft", true)}
            >
              <Undo2 size={12} className="mr-1" /> Request changes
            </Button>
          )}
          {meta.next && (
            <Button
              size="sm"
              disabled={m.isPending}
              onClick={() => advance(meta.next as State, state !== "draft")}
              className="bg-ink-950 text-paper-0 hover:bg-ink-800"
            >
              {m.isPending ? <Loader2 size={12} className="mr-1 animate-spin" /> : <meta.icon size={12} />}
              <span className="ml-1">{meta.label}</span>
            </Button>
          )}
        </div>
      </div>

      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">
              {pendingTo === "draft" ? "Request changes" : `Confirm: ${pendingTo ? NEXT_META[state].label : ""}`}
            </DialogTitle>
          </DialogHeader>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note for the audit trail…"
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteOpen(false)}>Cancel</Button>
            <Button
              onClick={() => pendingTo && m.mutate(pendingTo)}
              disabled={m.isPending}
              className="bg-ink-950 text-paper-0 hover:bg-ink-800"
            >
              {m.isPending && <Loader2 size={12} className="mr-1 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
