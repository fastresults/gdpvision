import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Calendar, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { scheduleComms } from "@/lib/narrative.functions";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export function ScheduleDialog({
  artifactId,
  scopeKey,
  current,
}: {
  artifactId: string;
  scopeKey: string;
  current: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(current ? current.slice(0, 16) : "");
  const qc = useQueryClient();
  const fn = useServerFn(scheduleComms);

  const m = useMutation({
    mutationFn: (iso: string | null) => fn({ data: { id: artifactId, scheduledFor: iso } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["comms-detail", artifactId] });
      qc.invalidateQueries({ queryKey: ["comms-library", scopeKey] });
      qc.invalidateQueries({ queryKey: ["comms-workflow-counts", scopeKey] });
      toast.success("Schedule updated");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Calendar size={12} className="mr-1" /> {current ? "Reschedule" : "Schedule"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-serif">Schedule release</DialogTitle>
        </DialogHeader>
        <label className="block text-[11px] text-ink-700 space-y-1">
          <span className="font-mono text-[10px] uppercase tracking-widest text-ink-500">Publish at</span>
          <Input
            type="datetime-local"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </label>
        <DialogFooter className="gap-2">
          {current && (
            <Button variant="outline" onClick={() => m.mutate(null)} disabled={m.isPending}>
              Clear
            </Button>
          )}
          <Button
            onClick={() => value && m.mutate(new Date(value).toISOString())}
            disabled={!value || m.isPending}
            className="bg-ink-950 text-paper-0 hover:bg-ink-800"
          >
            {m.isPending && <Loader2 size={12} className="mr-1 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
