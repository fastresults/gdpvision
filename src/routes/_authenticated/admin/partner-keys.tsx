import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";

import { SuperAdminShell } from "@/components/admin/SuperAdminShell";
import { API_SCOPES, API_SCOPE_LABEL } from "@/lib/egov/api-keys.functions";
import { GDP_EVENTS_PRESET, PARTNER_EXTRA_LABEL, PARTNER_EXTRA_SCOPES } from "@/lib/public-data/partner-scopes";
import { createPartnerKey, listPartnerKeys, revokePartnerKey } from "@/lib/public-data/partner-keys.functions";

export const Route = createFileRoute("/_authenticated/admin/partner-keys")({
  head: () => ({
    meta: [
      { title: "Partner API keys — GDPVision" },
      { name: "description", content: "Issue and revoke keys for companion sites such as GDP Advisor." },
      { property: "og:title", content: "Partner API keys — GDPVision" },
      { property: "og:description", content: "Public data access for companion sites." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PartnerKeysPage,
});

function PartnerKeysPage() {
  const qc = useQueryClient();
  const list = useServerFn(listPartnerKeys);
  const create = useServerFn(createPartnerKey);
  const revoke = useServerFn(revokePartnerKey);
  const keys = useQuery({ queryKey: ["admin", "partner-keys"], queryFn: () => list() });
  const [partner, setPartner] = useState("GDP Advisor");
  const [label, setLabel] = useState("Production website");
  const [countries, setCountries] = useState("*");
  const [origins, setOrigins] = useState("");
  const [scopes, setScopes] = useState<string[]>([...API_SCOPES]);
  const [issued, setIssued] = useState<string | null>(null);
  const [eventsPreset, setEventsPreset] = useState(false);
  const originsRef = useRef<HTMLInputElement>(null);

  const make = useMutation({
    mutationFn: () =>
      create({
        data: {
          partner,
          label,
          countries: countries.split(",").map((s) => s.trim()).filter(Boolean),
          scopes: scopes as ((typeof API_SCOPES)[number] | (typeof PARTNER_EXTRA_SCOPES)[number])[],
          allowedOrigins: origins.split(",").map((s) => s.trim()).filter(Boolean),
          expiresInDays: 365,
        },
      }),
    onSuccess: (r) => {
      setIssued(r.key);
      void qc.invalidateQueries({ queryKey: ["admin", "partner-keys"] });
    },
  });
  const kill = useMutation({
    mutationFn: (id: string) => revoke({ data: { id } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin", "partner-keys"] }),
  });
  const base = typeof window !== "undefined" ? `${window.location.origin}/api/public/v2` : "/api/public/v2";

  return (
    <SuperAdminShell crumbs={[{ label: "Admin", to: "/admin/countries" }, { label: "Partner API" }]}>
      <div className="space-y-8">
        <header>
          <h1 className="text-2xl font-medium">Partner API</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-500">
            Give a companion site such as GDP Advisor read-only access to public, approved data across
            countries. Drafts, private records and protected Second Brain contents are never shared.
          </p>
        </header>

        <section className="space-y-3 border border-line-200 bg-paper-50 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-medium">Issue a key</h2>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setPartner("GDP Events");
                setLabel("GDP Events website");
                setCountries("*");
                setScopes([...GDP_EVENTS_PRESET]);
                setEventsPreset(true);
                setIssued(null);
                setTimeout(() => originsRef.current?.focus(), 0);
              }}
            >
              Set up for GDP Events site
            </button>
          </div>
          {eventsPreset && (
            <p className="border-l-2 border-gold-500 bg-paper-0 px-3 py-2 text-[13px] text-ink-700">
              Filled in for the GDP Events website: summits, news, sector figures and sign-ups only.
              Add the site's web address under "Allowed website origins" (for example
              https://events.gdpvision.com), then click Issue key.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Partner" value={partner} onChange={setPartner} />
            <Field label="Label" value={label} onChange={setLabel} />
            <Field label="Countries (* = all, or codes like ATG,BRB)" value={countries} onChange={setCountries} />
            <Field
              label="Allowed website origins (comma separated, optional)"
              value={origins}
              onChange={setOrigins}
              inputRef={originsRef}
            />
          </div>
          <div className="flex flex-wrap gap-3">
            {API_SCOPES.map((s) => (
              <label key={s} className="flex items-center gap-1.5 text-[13px] text-ink-700" title={API_SCOPE_LABEL[s]}>
                <input
                  type="checkbox"
                  checked={scopes.includes(s)}
                  onChange={(e) => setScopes((p) => (e.target.checked ? [...p, s] : p.filter((x) => x !== s)))}
                />
                {s}
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 border-t border-line-200 pt-3">
            <span className="text-[12px] text-ink-500">Partner-only:</span>
            {PARTNER_EXTRA_SCOPES.map((s) => (
              <label key={s} className="flex items-center gap-1.5 text-[13px] text-ink-700" title={PARTNER_EXTRA_LABEL[s]}>
                <input
                  type="checkbox"
                  checked={scopes.includes(s)}
                  onChange={(e) => setScopes((p) => (e.target.checked ? [...p, s] : p.filter((x) => x !== s)))}
                />
                {s}
              </label>
            ))}
          </div>
          <div className="pt-1">
            <button type="button" className="btn-primary" disabled={make.isPending} onClick={() => make.mutate()}>
              {make.isPending ? "Issuing…" : "Issue key"}
            </button>
          </div>
          {make.error && <p className="text-sm text-signal-negative">{(make.error as Error).message}</p>}
          {issued && (
            <div className="border border-gold-500 bg-paper-0 p-3 text-sm">
              <p className="font-medium">Copy this key now — it will not be shown again.</p>
              <code className="mt-1 block break-all font-mono text-[12px]">{issued}</code>
            </div>
          )}
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-medium">Keys</h2>
          {keys.isPending ? (
            <p className="text-sm text-ink-500">Loading…</p>
          ) : keys.error ? (
            <p className="text-sm text-signal-negative">{(keys.error as Error).message}</p>
          ) : (keys.data ?? []).length === 0 ? (
            <p className="text-sm text-ink-500">No partner keys yet.</p>
          ) : (
            <ul className="divide-y divide-line-200 border border-line-200">
              {(keys.data ?? []).map((k) => (
                <li key={k.id} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
                  <div>
                    <p className="font-medium">
                      {k.partner} · {k.label} <span className="font-mono text-ink-500">…{k.key_hint}</span>
                    </p>
                    <p className="text-[12px] text-ink-500">
                      {k.countries.join(", ")} · {k.scopes.length} resources · {k.request_count} requests
                      {k.last_used_at ? ` · last used ${new Date(k.last_used_at).toLocaleString()}` : ""}
                      {k.revoked_at ? " · revoked" : ` · expires ${new Date(k.expires_at).toLocaleDateString()}`}
                    </p>
                  </div>
                  {!k.revoked_at && (
                    <button type="button" className="btn-secondary" onClick={() => kill.mutate(k.id)}>
                      Revoke
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-2 text-sm text-ink-700">
          <h2 className="font-medium">For the GDP Advisor team</h2>
          <p>Send the key as <code className="font-mono">Authorization: Bearer gdpp_…</code>. Every reply is JSON.</p>
          <ul className="list-disc space-y-1 pl-5 font-mono text-[12px]">
            <li>GET {base}/countries</li>
            <li>GET {base}/countries/ATG/kpis?since=2026-01-01</li>
            <li>GET {base}/search?q=tourism&amp;country=ATG,BRB</li>
            <li>GET {base}/compare?metric=gdp&amp;countries=ATG,BRB,DMA</li>
            <li>GET {base}/indices</li>
            <li>GET {base}/indices/CHX?edition=latest</li>
            <li>GET {base}/countries/KNA/indices</li>
          </ul>
          <p className="text-[12px] text-ink-500">
            Caribbean Indices contract and visual routes: docs/api/gdp-advisor-caribbean-indices.md in the GDPVision repo.
          </p>
          <p className="text-[12px] text-ink-500">Resources: {API_SCOPES.join(", ")}.</p>
        </section>
      </div>
    </SuperAdminShell>
  );
}

function Field({
  label,
  value,
  onChange,
  inputRef,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  return (
    <label className="block text-[12px] text-ink-500">
      {label}
      <input
        ref={inputRef}
        className="mt-1 w-full border border-line-200 bg-paper-0 px-2 py-1.5 text-sm text-ink-900"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
