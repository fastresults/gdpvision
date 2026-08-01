// @domain personas
// @tables programme_briefings
// @ui src/components/personas/field/briefing/BriefingPanel.tsx
//
// Chamber 07 · The client link. One durable address that opens the dossier and
// its presentation with no account and no platform chrome. Publishing is only
// possible once every section traces back to the governing brief.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Check, Copy, Link2, Loader2, RefreshCw, X } from "lucide-react";

import {
  getDossierShare,
  setDossierShare,
  type DossierShareState,
} from "@/lib/personas/commencement-briefing.functions";
import { browserPublicOrigin, dossierLink } from "@/lib/personas/public-origin";

export function ShareLinkBar({
  briefingId,
  canPublish,
}: {
  briefingId: string;
  canPublish: boolean;
}) {
  const qc = useQueryClient();
  const readFn = useServerFn(getDossierShare);
  const writeFn = useServerFn(setDossierShare);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const key = ["dossier-share", briefingId];

  const q = useQuery({
    queryKey: key,
    queryFn: (): Promise<DossierShareState> => readFn({ data: { briefingId } }),
  });

  const m = useMutation({
    mutationFn: (action: "create" | "regenerate" | "revoke") =>
      writeFn({ data: { briefingId, action } }),
    onSuccess: (state) => {
      setError(null);
      qc.setQueryData(key, state);
    },
    onError: (e: unknown) =>
      setError(e instanceof Error ? e.message : "Could not change the client link."),
  });

  const state = q.data;
  const url =
    state?.enabled && state.token && typeof window !== "undefined"
      ? dossierLink(browserPublicOrigin(), state.token)
      : null;

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Copy the address from the field above.");
    }
  };

  return (
    <div className="border border-line-200 bg-paper-0 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            Client link
          </p>
          <p className="mt-1 text-sm text-ink-700">
            {url
              ? "Anyone with this address can read the dossier and the presentation. No sign-in, nothing internal."
              : "Publish a single address the client can open — the dossier and the presentation, nothing else."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!url ? (
            <button
              type="button"
              onClick={() => m.mutate("create")}
              disabled={m.isPending || !canPublish || q.isLoading}
              className="btn-primary inline-flex items-center gap-2"
              title={canPublish ? undefined : "The dossier must pass its provenance check first."}
            >
              {m.isPending ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
              Create client link
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => m.mutate("regenerate")}
                disabled={m.isPending}
                className="btn-ghost inline-flex items-center gap-2"
              >
                <RefreshCw size={14} /> New address
              </button>
              <button
                type="button"
                onClick={() => m.mutate("revoke")}
                disabled={m.isPending}
                className="btn-ghost inline-flex items-center gap-2"
              >
                <X size={14} /> Revoke
              </button>
            </>
          )}
        </div>
      </div>

      {url && (
        <div className="mt-3 flex items-center gap-2">
          <input
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 border border-line-200 bg-paper-50 px-3 py-2 font-mono text-[12px] text-ink-800"
          />
          <button
            type="button"
            onClick={() => void copy()}
            className="btn-secondary inline-flex items-center gap-2"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-signal-negative">{error}</p>}
    </div>
  );
}
