// The handshake between GDPVision and the country's e-government platform:
// API keys (shown once), what each may read, and the exact configuration the
// platform needs. Creating and revoking need the PRD approver role.

import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  API_SCOPES,
  API_SCOPE_LABEL,
  createApiKey,
  listApiKeys,
  revokeApiKey,
  type ApiScope,
} from "@/lib/egov/api-keys.functions";
import { cn } from "@/lib/utils";

import { MICRO, formatWhen } from "./labels";

const field =
  "border border-line-200 bg-paper-0 px-2 py-1.5 text-xs text-ink-950 focus:border-ink-950 focus:outline-none";

export function ConnectionPanel({
  code,
  prdId,
  approved,
}: {
  code: string;
  prdId: string;
  approved: boolean;
}) {
  const qc = useQueryClient();
  const fetchKeys = useServerFn(listApiKeys);
  const create = useServerFn(createApiKey);
  const revoke = useServerFn(revokeApiKey);
  const q = useQuery({
    queryKey: ["egov-api-keys", code],
    queryFn: () => fetchKeys({ data: { code } }),
  });

  const [label, setLabel] = useState("");
  const [origins, setOrigins] = useState("");
  const [scopes, setScopes] = useState<ApiScope[]>([...API_SCOPES]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fresh, setFresh] = useState<{ key: string; label: string; baseUrl: string } | null>(null);
  const [open, setOpen] = useState(false);

  const toggle = (s: ApiScope) =>
    setScopes((xs) => (xs.includes(s) ? xs.filter((x) => x !== s) : [...xs, s]));

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await create({
        data: {
          code,
          prdId,
          label,
          scopes,
          allowedOrigins: origins
            .split(/[\s,]+/)
            .map((s) => s.trim())
            .filter(Boolean),
        },
      });
      setFresh({ key: r.key, label: r.label, baseUrl: r.baseUrl });
      setLabel("");
      setOrigins("");
      setOpen(false);
      await qc.invalidateQueries({ queryKey: ["egov-api-keys", code] });
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
      await qc.invalidateQueries({ queryKey: ["egov-api-keys", code] });
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const base = q.data?.baseUrl ?? "https://gdpvision.com/api/public/v1";

  return (
    <aside className="border-t border-line-200 pt-4" aria-label="Platform connection">
      <div className={MICRO}>Platform connection</div>
      <p className="mt-1 text-xs text-ink-700">
        The e-government platform built from this PRD reads GDPVision through a keyed, read-only
        API: indicators, commitments, ministries, sectors, the open-data register, procurement,
        approved projects, the second brain and sources — plus the brand payload (tokens, flag,
        imagery rules).
      </p>

      <dl className="mt-3 space-y-1 font-mono text-[11px] text-ink-700">
        <div>
          <dt className="inline text-ink-500">Base · </dt>
          <dd className="inline break-all">{base}</dd>
        </div>
        <div>
          <dt className="inline text-ink-500">Handshake · </dt>
          <dd className="inline">GET /handshake</dd>
        </div>
        <div>
          <dt className="inline text-ink-500">Resource · </dt>
          <dd className="inline">GET /countries/{code}/&lt;resource&gt;?since=…</dd>
        </div>
        <div>
          <dt className="inline text-ink-500">Auth · </dt>
          <dd className="inline">Authorization: Bearer gdpv_{code.toLowerCase()}_…</dd>
        </div>
      </dl>

      {!approved && (
        <p className="mt-3 text-xs text-ink-500">
          Keys can be issued at any time; the platform sees approved material only, so approve the
          PRD before the build reads its brand payload.
        </p>
      )}

      {q.data?.canManage && !open && (
        <button
          type="button"
          className="btn-secondary mt-3 px-3 py-1.5 text-xs"
          onClick={() => setOpen(true)}
        >
          Issue a key
        </button>
      )}

      {open && (
        <form onSubmit={onCreate} className="mt-3 space-y-3">
          <label className="block">
            <span className="block text-[10px] text-ink-500">For</span>
            <input
              className={cn(field, "w-full")}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. gov.ag production"
              required
              minLength={2}
              maxLength={120}
            />
          </label>
          <label className="block">
            <span className="block text-[10px] text-ink-500">
              Allowed browser origins (optional, space-separated)
            </span>
            <input
              className={cn(field, "w-full")}
              value={origins}
              onChange={(e) => setOrigins(e.target.value)}
              placeholder="https://gov.ag https://staging.gov.ag"
            />
          </label>
          <fieldset>
            <legend className="text-[10px] text-ink-500">Resources</legend>
            <div className="mt-1 grid grid-cols-1 gap-1">
              {API_SCOPES.map((s) => (
                <label key={s} className="flex items-start gap-2 text-xs text-ink-950">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={scopes.includes(s)}
                    onChange={() => toggle(s)}
                  />
                  <span>
                    <span className="font-mono">{s}</span>
                    <span className="text-ink-500"> — {API_SCOPE_LABEL[s]}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="btn-primary px-3 py-1.5 text-xs"
              disabled={busy || scopes.length === 0}
            >
              {busy ? "Issuing…" : "Issue key"}
            </button>
            <button
              type="button"
              className="btn-ghost px-3 py-1.5 text-xs"
              onClick={() => setOpen(false)}
              disabled={busy}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {fresh && (
        <div className="mt-3 border-l-2 border-gold-500 py-1 pl-3">
          <div className="text-xs text-ink-500">
            Key for {fresh.label} — shown once; put it in the platform's server environment now.
          </div>
          <code className="mt-1 block break-all text-xs text-ink-950">{fresh.key}</code>
          <pre className="mt-2 overflow-x-auto border border-line-200 bg-paper-0 p-2 font-mono text-[11px] leading-relaxed text-ink-700">{`GDPVISION_BASE_URL=${fresh.baseUrl}
GDPVISION_COUNTRY=${code}
GDPVISION_API_KEY=${fresh.key}`}</pre>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-signal-negative">{error}</p>}

      {q.data && q.data.keys.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {q.data.keys.map((k) => (
            <li key={k.id} className="flex items-baseline justify-between gap-2 text-xs">
              <span className="min-w-0 truncate text-ink-950">
                {k.label} <span className="font-mono text-ink-500">…{k.key_hint}</span>
                <span className="text-ink-500">
                  {" "}
                  · {k.scopes.length} of {API_SCOPES.length} resources
                </span>
              </span>
              <span
                className={cn(
                  "shrink-0",
                  k.status === "active" ? "text-signal-positive" : "text-ink-400",
                )}
              >
                {k.status} · {k.request_count} call{k.request_count === 1 ? "" : "s"}
                {k.last_used_at ? ` · last ${formatWhen(k.last_used_at)}` : ""}
              </span>
              {k.status === "active" && q.data.canManage && (
                <button
                  type="button"
                  className="btn-ghost shrink-0 px-2 py-0.5 text-xs"
                  onClick={() => onRevoke(k.id)}
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
