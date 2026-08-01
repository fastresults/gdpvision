// @domain personas
// @tables programme_briefings,programme_decks
// @ui src/components/personas/field/briefing/BriefingPanel.tsx
//
// Chamber 07 · One durable client address. Used for the dossier and, in the
// same shape, for the presentation. Publishing is only possible once the
// document traces back to the governing brief.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check, Copy, Link2, Loader2, RefreshCw, X } from "lucide-react";

export interface ShareState {
  token: string | null;
  enabled: boolean;
  shared_publicly_at: string | null;
}

export type ShareAction = "create" | "regenerate" | "revoke";

export function ShareBar({
  label,
  idleCopy,
  liveCopy,
  createLabel,
  queryKey,
  read,
  write,
  buildUrl,
  canPublish,
  blockedHint,
}: {
  label: string;
  idleCopy: string;
  liveCopy: string;
  createLabel: string;
  queryKey: unknown[];
  read: () => Promise<ShareState>;
  write: (action: ShareAction) => Promise<ShareState>;
  buildUrl: (token: string) => string;
  canPublish: boolean;
  blockedHint: string;
}) {
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const q = useQuery({ queryKey, queryFn: read });

  const m = useMutation({
    mutationFn: (action: ShareAction) => write(action),
    onSuccess: (state) => {
      setError(null);
      qc.setQueryData(queryKey, state);
    },
    onError: (e: unknown) =>
      setError(e instanceof Error ? e.message : "Could not change the client link."),
  });

  const state = q.data;
  const url =
    state?.enabled && state.token && typeof window !== "undefined" ? buildUrl(state.token) : null;

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
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">{label}</p>
          <p className="mt-1 text-sm text-ink-700">{url ? liveCopy : idleCopy}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!url ? (
            <button
              type="button"
              onClick={() => m.mutate("create")}
              disabled={m.isPending || !canPublish || q.isLoading}
              className="btn-primary inline-flex items-center gap-2"
              title={canPublish ? undefined : blockedHint}
            >
              {m.isPending ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
              {createLabel}
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
