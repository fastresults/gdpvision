import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ingestSignalFromUrl } from "@/lib/narrative-chamber.functions";

export function AddSignalDialog({ code }: { code: string }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [raw, setRaw] = useState("");
  const qc = useQueryClient();
  const nav = useNavigate();
  const ingest = useServerFn(ingestSignalFromUrl);

  const m = useMutation({
    mutationFn: async () =>
      ingest({ data: { countryCode: code, url: url.trim() || undefined, raw: raw.trim() || undefined } }),
    onSuccess: async ({ id }) => {
      await qc.invalidateQueries({ queryKey: ["narrative-signals", code] });
      setOpen(false);
      setUrl(""); setRaw("");
      nav({ to: "/admin/countries/$code/narrative/signal/$id", params: { code, id } });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between border border-ink-950 bg-ink-950 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-paper-0 hover:bg-ink-800"
        >
          <span className="flex items-center gap-2"><Sparkles size={13} /> New signal</span>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">Ingest a new signal</DialogTitle>
          <DialogDescription>
            Paste a news URL or drop raw text. AI will classify scope, sector, severity, reach and sentiment,
            then draft a 4-bullet dossier grounded in web sources.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">Source URL</span>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              className="mt-1 w-full border border-line-200 px-3 py-2 text-sm focus:border-ink-950 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">Or raw signal text</span>
            <textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              rows={5}
              placeholder="Paste an intercepted quote, wire copy, or intel note…"
              className="mt-1 w-full resize-y border border-line-200 px-3 py-2 text-sm focus:border-ink-950 focus:outline-none"
            />
          </label>
          {m.error && <p className="text-sm text-rose-600">{(m.error as Error).message}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={m.isPending}>Cancel</Button>
          <Button
            onClick={() => m.mutate()}
            disabled={m.isPending || (!url.trim() && !raw.trim())}
          >
            {m.isPending ? "Analyzing…" : "Ingest signal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
