// Read-only share links for an approved PRD. The link is shown once, on
// creation; afterwards only its last four characters identify it.

import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  createPrdShareLink,
  getPrdLinksEnabled,
  listPrdShareLinks,
  revokePrdShareLink,
  setPrdLinksEnabled,
} from "@/lib/egov/share-links.functions";
import { cn } from "@/lib/utils";

import { MICRO, formatWhen } from "./labels";

const field =
  "border border-line-200 bg-paper-0 px-2 py-1.5 text-xs text-ink-950 focus:border-ink-950 focus:outline-none";

export function SharePanel({
  code,
  prdId,
  approved,
  canShare,
}: {
  code: string;
  prdId: string;
  approved: boolean;
  canShare: boolean;
}) {
  const qc = useQueryClient();
  const fetchLinks = useServerFn(listPrdShareLinks);
  const fetchFlag = useServerFn(getPrdLinksEnabled);
  const setFlag = useServerFn(setPrdLinksEnabled);
  const create = useServerFn(createPrdShareLink);
  const revoke = useServerFn(revokePrdShareLink);

  const links = useQuery({
    queryKey: ["egov-links", prdId],
    queryFn: () => fetchLinks({ data: { code, prdId } }),
  });
  const flag = useQuery({ queryKey: ["egov-links-flag"], queryFn: () => fetchFlag() });

  const [label, setLabel] = useState("");
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fresh, setFresh] = useState<{ url: string; label: string } | null>(null);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await create({ data: { code, prdId, label, expiresInDays: days } });
      setFresh({ url: r.url, label: r.label });
      setLabel("");
      await qc.invalidateQueries({ queryKey: ["egov-links", prdId] });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onRevoke(id: string) {
    setError(null);
    try {
      await revoke({ data: { code, id } });
      await qc.invalidateQueries({ queryKey: ["egov-links", prdId] });
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function onToggle(enabled: boolean) {
    setError(null);
    try {
      await setFlag({ data: { enabled } });
      await qc.invalidateQueries({ queryKey: ["egov-links-flag"] });
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <aside className="border-t border-line-200 pt-4" aria-label="Share links">
      <div className={MICRO}>Share links</div>

      {flag.data && !flag.data.enabled && (
        <p className="mt-2 text-xs text-ink-500">
          Public PRD links are switched off for this installation.
          {flag.data.canToggle && (
            <button
              type="button"
              className="btn-ghost ml-2 px-2 py-0.5 text-xs"
              onClick={() => onToggle(true)}
            >
              Switch on
            </button>
          )}
        </p>
      )}
      {flag.data?.enabled && flag.data.canToggle && (
        <p className="mt-2 text-xs text-ink-500">
          Public PRD links are on.
          <button
            type="button"
            className="btn-ghost ml-2 px-2 py-0.5 text-xs"
            onClick={() => onToggle(false)}
          >
            Switch off
          </button>
        </p>
      )}

      {!approved && (
        <p className="mt-2 text-xs text-ink-500">Only an approved PRD can be shared.</p>
      )}

      {approved && canShare && flag.data?.enabled && (
        <form onSubmit={onCreate} className="mt-3 flex flex-wrap items-end gap-2">
          <label className="block">
            <span className="block text-[10px] text-ink-500">For</span>
            <input
              className={cn(field, "w-48")}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. CIO's office"
              required
              minLength={2}
              maxLength={120}
            />
          </label>
          <label className="block">
            <span className="block text-[10px] text-ink-500">Days</span>
            <input
              className={cn(field, "w-16")}
              type="number"
              min={1}
              max={180}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            />
          </label>
          <button type="submit" className="btn-secondary px-3 py-1.5 text-xs" disabled={busy}>
            {busy ? "Creating…" : "Create link"}
          </button>
        </form>
      )}

      {fresh && (
        <div className="mt-3 border-l-2 border-gold-500 py-1 pl-3">
          <div className="text-xs text-ink-500">
            Link for {fresh.label} — shown once; copy it now.
          </div>
          <code className="mt-1 block break-all text-xs text-ink-950">{fresh.url}</code>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-signal-negative">{error}</p>}

      {links.data && links.data.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {links.data.map((l) => (
            <li key={l.id} className="flex items-baseline justify-between gap-2 text-xs">
              <span className="min-w-0 truncate text-ink-950">
                {l.label} <span className="font-mono text-ink-500">…{l.token_hint}</span>
              </span>
              <span
                className={cn(
                  "shrink-0",
                  l.status === "active" ? "text-signal-positive" : "text-ink-400",
                )}
              >
                {l.status} · {l.view_count} view{l.view_count === 1 ? "" : "s"} · until{" "}
                {formatWhen(l.expires_at).slice(0, 11)}
              </span>
              {l.status === "active" && canShare && (
                <button
                  type="button"
                  className="btn-ghost shrink-0 px-2 py-0.5 text-xs"
                  onClick={() => onRevoke(l.id)}
                >
                  Revoke
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
