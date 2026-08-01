// Chamber 07 · Instrument deployment.
//
// The instrument has to be answerable wherever the fieldwork actually happens.
// Three routes out, all stamped with the version so returns can never be filed
// against the wrong draft: an anonymous open link, a printable paper form, and
// a machine-readable pack for tooling already in use.

import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, FileSpreadsheet, Globe, Loader2, Printer } from "lucide-react";
import { useState } from "react";

import { buildDeployPacks, setOpenAccess } from "@/lib/personas/instrument-deploy.functions";

function download(filename: string, mime: string, body: string) {
  const url = URL.createObjectURL(new Blob([body], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function DeployPanel({
  instrumentId,
  collectionId,
  openToken,
  openEnabled,
  refresh,
}: {
  instrumentId: string | null;
  collectionId?: string | null;
  openToken?: string | null;
  openEnabled?: boolean;
  refresh?: () => void;
}) {
  const [note, setNote] = useState<string | null>(null);
  const packsFn = useServerFn(buildDeployPacks);
  const openFn = useServerFn(setOpenAccess);
  const origin = typeof window === "undefined" ? "" : window.location.origin;

  const packs = useMutation({
    mutationFn: async (which: "csv" | "json" | "form") => {
      if (!instrumentId) throw new Error("Draft the instrument first.");
      const p = await packsFn({ data: { instrumentId } });
      const pack = p[which];
      download(pack.filename, pack.mime, pack.body);
      return `${pack.filename} downloaded — version ${p.version}.`;
    },
    onSuccess: (m) => setNote(m),
    onError: (e: Error) => setNote(e.message),
  });

  const toggle = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (!collectionId) throw new Error("Open the field first.");
      const r = await openFn({ data: { collectionId, enabled } });
      return r.enabled ? "Open link published." : "Open link withdrawn.";
    },
    onSuccess: (m) => {
      setNote(m);
      refresh?.();
    },
    onError: (e: Error) => setNote(e.message),
  });

  const link = openToken ? `${origin}/f/${openToken}` : null;

  return (
    <details className="border border-line-200">
      <summary className="cursor-pointer p-2 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-600">
        Deploy this instrument
      </summary>
      <div className="space-y-3 p-3">
        <p className="text-[13px] leading-relaxed text-ink-700">
          Take the questions to where the fieldwork happens. Every route carries the instrument
          version, so whatever comes back can be filed against exactly what was asked.
        </p>

        {collectionId ? (
          <div className="border border-line-200 bg-paper-50 p-2">
            <div className="flex flex-wrap items-center gap-2">
              <Globe className="h-3.5 w-3.5 shrink-0 text-ink-500" />
              <span className="text-[13px] text-ink-900">
                Anonymous open link — anyone with the address can answer once.
              </span>
              <button
                type="button"
                className="btn-secondary ml-auto"
                disabled={toggle.isPending}
                onClick={() => toggle.mutate(!openEnabled)}
              >
                {toggle.isPending ? (
                  <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />
                ) : null}
                {openEnabled ? "Withdraw link" : "Publish open link"}
              </button>
            </div>
            {openEnabled && link ? (
              <div className="mt-2 flex items-center gap-2">
                <code className="truncate font-mono text-[11px] text-ink-700">{link}</code>
                <button
                  type="button"
                  className="btn-ghost ml-auto shrink-0"
                  onClick={() => void navigator.clipboard.writeText(link)}
                >
                  <Copy className="mr-1 inline h-3.5 w-3.5" />
                  Copy
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary"
            disabled={packs.isPending || !instrumentId}
            onClick={() => packs.mutate("form")}
          >
            <Printer className="mr-1 inline h-3.5 w-3.5" />
            Printable form
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={packs.isPending || !instrumentId}
            onClick={() => packs.mutate("csv")}
          >
            <FileSpreadsheet className="mr-1 inline h-3.5 w-3.5" />
            Return-sheet template
          </button>
          <button
            type="button"
            className="btn-ghost"
            disabled={packs.isPending || !instrumentId}
            onClick={() => packs.mutate("json")}
          >
            Export for external tooling
          </button>
        </div>

        <p className="text-[12px] text-ink-600">
          Answers collected on any of these routes come back through “Collected elsewhere” below —
          the chamber matches the columns and asks you to confirm before filing.
        </p>

        {note ? <p className="text-[12px] text-ink-700">{note}</p> : null}
      </div>
    </details>
  );
}
