import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";

import { ChambersLauncher } from "@/components/country/ChambersLauncher";

import { Wordmark } from "@/components/marketing/Wordmark";
import { supabase } from "@/integrations/supabase/client";
import {
  decideCountryAccessRequest,
  getCountryAdminOverview,
  listCountryAccessRequests,
  listCountryUsers,
  removeCountryBinding,
  saveMinistries,
  saveSectorComposition,
  setCountryGdp,
  setCountryRole,
} from "@/lib/country-admin.functions";

export const Route = createFileRoute("/_authenticated/admin/country/$code")({
  head: ({ params }) => ({
    meta: [
      { title: `Country admin · ${params.code} — GDPVision` },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: async ({ context, params }) => {
    const overviewQ = queryOptions({
      queryKey: ["country-admin", params.code, "overview"],
      queryFn: () => getCountryAdminOverview({ data: { countryCode: params.code } }),
    });
    const requestsQ = queryOptions({
      queryKey: ["country-admin", params.code, "requests"],
      queryFn: () => listCountryAccessRequests({ data: { countryCode: params.code } }),
    });
    const usersQ = queryOptions({
      queryKey: ["country-admin", params.code, "users"],
      queryFn: () => listCountryUsers({ data: { countryCode: params.code } }),
    });
    await Promise.all([
      context.queryClient.ensureQueryData(overviewQ),
      context.queryClient.ensureQueryData(requestsQ),
      context.queryClient.ensureQueryData(usersQ),
    ]);
  },
  errorComponent: ({ error }) => (
    <div className="min-h-dvh grid place-items-center p-8 text-center">
      <p className="text-sm text-red-600">{error.message}</p>
    </div>
  ),
  component: CountryAdminPage,
});

const COUNTRY_ROLES = [
  "advisor",
  "line_minister",
  "principal",
  "steward",
  "data_steward",
  "cabinet_secretary",
  "comms_director",
  "country_admin",
] as const;

function CountryAdminPage() {
  const params = Route.useParams();
  const code = params.code;
  const qc = useQueryClient();
  const navigate = useNavigate();

  const overviewQ = queryOptions({
    queryKey: ["country-admin", code, "overview"],
    queryFn: () => getCountryAdminOverview({ data: { countryCode: code } }),
  });
  const requestsQ = queryOptions({
    queryKey: ["country-admin", code, "requests"],
    queryFn: () => listCountryAccessRequests({ data: { countryCode: code } }),
  });
  const usersQ = queryOptions({
    queryKey: ["country-admin", code, "users"],
    queryFn: () => listCountryUsers({ data: { countryCode: code } }),
  });
  const { data: overview } = useSuspenseQuery(overviewQ);
  const { data: requests } = useSuspenseQuery(requestsQ);
  const { data: users } = useSuspenseQuery(usersQ);

  const decide = useServerFn(decideCountryAccessRequest);
  const setRoleFn = useServerFn(setCountryRole);
  const removeBind = useServerFn(removeCountryBinding);
  const saveGdp = useServerFn(setCountryGdp);
  const saveComp = useServerFn(saveSectorComposition);
  const saveMins = useServerFn(saveMinistries);

  function invalidate(keys: string[][]) {
    keys.forEach((k) => qc.invalidateQueries({ queryKey: k }));
  }

  const decideMut = useMutation({
    mutationFn: (v: { requestId: string; approve: boolean }) => decide({ data: v }),
    onSuccess: () =>
      invalidate([
        ["country-admin", code, "requests"],
        ["country-admin", code, "users"],
        ["country-admin", code, "overview"],
      ]),
  });
  const roleMut = useMutation({
    mutationFn: (v: { userId: string; role: (typeof COUNTRY_ROLES)[number]; grant: boolean }) =>
      setRoleFn({ data: { countryCode: code, ...v } }),
    onSuccess: () => invalidate([["country-admin", code, "users"]]),
  });
  const unbindMut = useMutation({
    mutationFn: (v: { userId: string }) => removeBind({ data: { countryCode: code, ...v } }),
    onSuccess: () => invalidate([["country-admin", code, "users"], ["country-admin", code, "overview"]]),
  });
  const gdpMut = useMutation({
    mutationFn: (v: { gdpCurrentUsd: number | null; gdpYear: number | null }) =>
      saveGdp({ data: { countryCode: code, ...v } }),
    onSuccess: () => invalidate([["country-admin", code, "overview"]]),
  });
  const compMut = useMutation({
    mutationFn: (rows: Array<{ sector_code: string; share_pct: number; confidence_grade: "A" | "B" | "C" | "D" }>) =>
      saveComp({ data: { countryCode: code, rows } }),
    onSuccess: () => invalidate([["country-admin", code, "overview"]]),
  });
  const minMut = useMutation({
    mutationFn: (ministries: Array<{ id?: string; slug: string; name: string; sort_order: number }>) =>
      saveMins({ data: { countryCode: code, ministries } }),
    onSuccess: () => invalidate([["country-admin", code, "overview"]]),
  });

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-dvh bg-paper-0 text-ink-950">
      <header className="flex items-center justify-between border-b border-line-200 px-8 py-5">
        <div className="flex items-center gap-10">
          <Link to="/instrument"><Wordmark /></Link>
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
            Country admin · {overview.country.name}
          </span>
        </div>
        <div className="flex items-center gap-6 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
          <Link to="/admin" className="hover:text-ink-950">All countries</Link>
          <Link to="/instrument" className="hover:text-ink-950">Instrument</Link>
          <button onClick={signOut} className="hover:text-ink-950">Sign out</button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-8 py-16 space-y-16">
        <section>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
            {overview.country.code} · {overview.country.currency}
          </p>
          <h1 className="mt-2 font-serif text-4xl">{overview.country.name}</h1>
          <p className="mt-3 text-sm text-ink-500">
            {overview.userCount} user{overview.userCount === 1 ? "" : "s"} bound · {overview.pendingCount} pending access request
            {overview.pendingCount === 1 ? "" : "s"}
          </p>
        </section>

        <ChambersLauncher code={code} />

        <Requests
          requests={requests}
          pending={decideMut.isPending}
          error={decideMut.error as Error | null}
          onDecide={(id, approve) => decideMut.mutate({ requestId: id, approve })}
        />

        <Users
          users={users}
          pending={roleMut.isPending || unbindMut.isPending}
          error={(roleMut.error ?? unbindMut.error) as Error | null}
          onGrant={(userId, role) => roleMut.mutate({ userId, role, grant: true })}
          onRevoke={(userId, role) => roleMut.mutate({ userId, role, grant: false })}
          onUnbind={(userId) => unbindMut.mutate({ userId })}
        />

        <GdpEditor
          country={overview.country}
          pending={gdpMut.isPending}
          error={gdpMut.error as Error | null}
          onSave={(g, y) => gdpMut.mutate({ gdpCurrentUsd: g, gdpYear: y })}
        />

        <CompositionEditor
          catalog={overview.sectorCatalog}
          rows={overview.sectorComposition}
          pending={compMut.isPending}
          error={compMut.error as Error | null}
          onSave={(rows) => compMut.mutate(rows)}
        />

        <MinistriesEditor
          ministries={overview.ministries}
          pending={minMut.isPending}
          error={minMut.error as Error | null}
          onSave={(m) => minMut.mutate(m)}
        />
      </main>
    </div>
  );
}


function Requests({
  requests,
  onDecide,
  pending,
  error,
}: {
  requests: Array<{ id: string; user_id: string; display_name: string | null; requested_role: string; note: string | null; created_at: string }>;
  onDecide: (id: string, approve: boolean) => void;
  pending: boolean;
  error: Error | null;
}) {
  return (
    <section>
      <h2 className="font-serif text-2xl">Access requests</h2>
      <p className="mt-2 max-w-2xl text-sm text-ink-500">
        People asking to join this country. Approving binds them to the country and grants their requested role.
      </p>
      {error && <p className="mt-3 text-sm text-red-600">{error.message}</p>}
      <ul className="mt-6 space-y-3">
        {requests.length === 0 && (
          <li className="border border-dashed border-line-200 p-6 text-sm text-ink-500">No pending requests.</li>
        )}
        {requests.map((r) => (
          <li key={r.id} className="border border-line-200 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <p className="font-serif text-lg">{r.display_name ?? "(unnamed)"}</p>
                <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
                  requested {r.requested_role} · {new Date(r.created_at).toLocaleString()}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  disabled={pending}
                  onClick={() => onDecide(r.id, true)}
                  className="border border-ink-950 px-3 py-1 font-mono text-[10px] uppercase tracking-widest hover:bg-ink-950 hover:text-paper-0 disabled:opacity-40"
                >
                  Approve
                </button>
                <button
                  disabled={pending}
                  onClick={() => onDecide(r.id, false)}
                  className="border border-line-200 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-ink-500 hover:text-red-600 disabled:opacity-40"
                >
                  Deny
                </button>
              </div>
            </div>
            {r.note && <p className="mt-3 text-sm text-ink-700">"{r.note}"</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Users({
  users,
  onGrant,
  onRevoke,
  onUnbind,
  pending,
  error,
}: {
  users: Array<{ user_id: string; display_name: string | null; is_default: boolean; roles: string[] }>;
  onGrant: (userId: string, role: (typeof COUNTRY_ROLES)[number]) => void;
  onRevoke: (userId: string, role: (typeof COUNTRY_ROLES)[number]) => void;
  onUnbind: (userId: string) => void;
  pending: boolean;
  error: Error | null;
}) {
  return (
    <section>
      <h2 className="font-serif text-2xl">Users</h2>
      <p className="mt-2 max-w-2xl text-sm text-ink-500">
        Assign or revoke country-scoped roles. Only a super admin can grant the country admin role.
      </p>
      {error && <p className="mt-3 text-sm text-red-600">{error.message}</p>}
      <ul className="mt-6 space-y-3">
        {users.length === 0 && (
          <li className="border border-dashed border-line-200 p-6 text-sm text-ink-500">No users bound yet.</li>
        )}
        {users.map((u) => (
          <UserRow key={u.user_id} user={u} onGrant={onGrant} onRevoke={onRevoke} onUnbind={onUnbind} pending={pending} />
        ))}
      </ul>
    </section>
  );
}

function UserRow({
  user,
  onGrant,
  onRevoke,
  onUnbind,
  pending,
}: {
  user: { user_id: string; display_name: string | null; is_default: boolean; roles: string[] };
  onGrant: (userId: string, role: (typeof COUNTRY_ROLES)[number]) => void;
  onRevoke: (userId: string, role: (typeof COUNTRY_ROLES)[number]) => void;
  onUnbind: (userId: string) => void;
  pending: boolean;
}) {
  const [role, setRole] = useState<(typeof COUNTRY_ROLES)[number]>("advisor");
  return (
    <li className="border border-line-200 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="font-serif text-lg">
            {user.display_name ?? "(unnamed)"}{" "}
            {user.is_default && <span className="ml-2 font-mono text-[10px] uppercase tracking-widest text-gold-500">default</span>}
          </p>
          <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">{user.user_id.slice(0, 8)}</p>
        </div>
        <button
          disabled={pending}
          onClick={() => onUnbind(user.user_id)}
          className="font-mono text-[10px] uppercase tracking-widest text-ink-500 hover:text-red-600 disabled:opacity-40"
        >
          Remove from country
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {user.roles.length === 0 && (
          <span className="font-mono text-[10px] uppercase tracking-widest text-ink-500">No roles</span>
        )}
        {user.roles.map((r) => (
          <span key={r} className="flex items-center gap-2 border border-line-200 px-2 py-1 font-mono text-[10px] uppercase tracking-widest">
            {r}
            <button
              disabled={pending}
              onClick={() => onRevoke(user.user_id, r as (typeof COUNTRY_ROLES)[number])}
              className="text-ink-500 hover:text-red-600 disabled:opacity-40"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="mt-3 flex gap-2 text-sm">
        <select value={role} onChange={(e) => setRole(e.target.value as (typeof COUNTRY_ROLES)[number])} className="border border-line-200 px-2 py-1">
          {COUNTRY_ROLES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <button
          disabled={pending}
          onClick={() => onGrant(user.user_id, role)}
          className="border border-ink-950 px-3 py-1 font-mono text-[10px] uppercase tracking-widest hover:bg-ink-950 hover:text-paper-0 disabled:opacity-40"
        >
          Grant
        </button>
      </div>
    </li>
  );
}

function GdpEditor({
  country,
  onSave,
  pending,
  error,
}: {
  country: { gdp_current_usd: number | null; gdp_year: number | null };
  onSave: (gdp: number | null, year: number | null) => void;
  pending: boolean;
  error: Error | null;
}) {
  const [gdp, setGdp] = useState<string>(country.gdp_current_usd?.toString() ?? "");
  const [year, setYear] = useState<string>(country.gdp_year?.toString() ?? "");
  return (
    <section>
      <h2 className="font-serif text-2xl">GDP baseline</h2>
      <p className="mt-2 max-w-2xl text-sm text-ink-500">
        Current-USD nominal GDP for the reference year. This anchors every downstream ministry and sector estimate.
      </p>
      {error && <p className="mt-3 text-sm text-red-600">{error.message}</p>}
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-widest text-ink-500">GDP (USD)</span>
          <input
            inputMode="decimal"
            value={gdp}
            onChange={(e) => setGdp(e.target.value)}
            className="w-56 border border-line-200 px-2 py-1 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-widest text-ink-500">Year</span>
          <input
            inputMode="numeric"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="w-24 border border-line-200 px-2 py-1 text-sm"
          />
        </label>
        <button
          disabled={pending}
          onClick={() =>
            onSave(
              gdp.trim() === "" ? null : Number(gdp),
              year.trim() === "" ? null : Number(year),
            )
          }
          className="border border-ink-950 px-3 py-1 font-mono text-[10px] uppercase tracking-widest hover:bg-ink-950 hover:text-paper-0 disabled:opacity-40"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </section>
  );
}

function CompositionEditor({
  catalog,
  rows,
  onSave,
  pending,
  error,
}: {
  catalog: Array<{ code: string; name: string }>;
  rows: Array<{ sector_code: string; share_pct: number; confidence_grade: string }>;
  onSave: (rows: Array<{ sector_code: string; share_pct: number; confidence_grade: "A" | "B" | "C" | "D" }>) => void;
  pending: boolean;
  error: Error | null;
}) {
  const [draft, setDraft] = useState<Record<string, { share: string; grade: "A" | "B" | "C" | "D" }>>(
    () => {
      const initial: Record<string, { share: string; grade: "A" | "B" | "C" | "D" }> = {};
      for (const r of rows) {
        initial[r.sector_code] = {
          share: r.share_pct.toString(),
          grade: (["A", "B", "C", "D"].includes(r.confidence_grade) ? r.confidence_grade : "C") as any,
        };
      }
      return initial;
    },
  );

  const total = useMemo(
    () =>
      Object.values(draft).reduce((acc, v) => {
        const n = Number(v.share);
        return acc + (Number.isFinite(n) ? n : 0);
      }, 0),
    [draft],
  );

  function update(code: string, patch: Partial<{ share: string; grade: "A" | "B" | "C" | "D" }>) {
    setDraft((d) => ({ ...d, [code]: { share: d[code]?.share ?? "", grade: d[code]?.grade ?? "C", ...patch } }));
  }

  return (
    <section>
      <h2 className="font-serif text-2xl">GDP sector composition</h2>
      <p className="mt-2 max-w-2xl text-sm text-ink-500">
        Share of nominal GDP by sector. Totals should land near 100 percent — anything else surfaces a data-quality flag.
      </p>
      {error && <p className="mt-3 text-sm text-red-600">{error.message}</p>}
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line-200 text-left font-mono text-[10px] uppercase tracking-widest text-ink-500">
              <th className="py-2 pr-4">Sector</th>
              <th className="py-2 pr-4">Share %</th>
              <th className="py-2 pr-4">Confidence</th>
            </tr>
          </thead>
          <tbody>
            {catalog.map((s) => {
              const v = draft[s.code] ?? { share: "", grade: "C" as const };
              return (
                <tr key={s.code} className="border-b border-line-200/60">
                  <td className="py-2 pr-4">
                    {s.name} <span className="font-mono text-[10px] text-ink-500">({s.code})</span>
                  </td>
                  <td className="py-2 pr-4">
                    <input
                      inputMode="decimal"
                      value={v.share}
                      onChange={(e) => update(s.code, { share: e.target.value })}
                      className="w-24 border border-line-200 px-2 py-1"
                    />
                  </td>
                  <td className="py-2 pr-4">
                    <select
                      value={v.grade}
                      onChange={(e) => update(s.code, { grade: e.target.value as "A" | "B" | "C" | "D" })}
                      className="border border-line-200 px-2 py-1"
                    >
                      {(["A", "B", "C", "D"] as const).map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex items-center justify-between text-sm">
        <span className={total > 100.5 || total < 99.5 ? "text-red-600" : "text-ink-500"}>
          Total: {total.toFixed(2)} %
        </span>
        <button
          disabled={pending}
          onClick={() => {
            const payload = Object.entries(draft)
              .filter(([, v]) => v.share.trim() !== "" && Number(v.share) > 0)
              .map(([sector_code, v]) => ({
                sector_code,
                share_pct: Number(v.share),
                confidence_grade: v.grade,
              }));
            onSave(payload);
          }}
          className="border border-ink-950 px-3 py-1 font-mono text-[10px] uppercase tracking-widest hover:bg-ink-950 hover:text-paper-0 disabled:opacity-40"
        >
          {pending ? "Saving…" : "Save composition"}
        </button>
      </div>
    </section>
  );
}

function MinistriesEditor({
  ministries,
  onSave,
  pending,
  error,
}: {
  ministries: Array<{ id: string; slug: string; name: string; sort_order: number }>;
  onSave: (m: Array<{ id?: string; slug: string; name: string; sort_order: number }>) => void;
  pending: boolean;
  error: Error | null;
}) {
  const [rows, setRows] = useState<Array<{ id?: string; slug: string; name: string; sort_order: number }>>(
    () => ministries.map((m) => ({ id: m.id, slug: m.slug, name: m.name, sort_order: m.sort_order })),
  );

  function update(i: number, patch: Partial<{ slug: string; name: string; sort_order: number }>) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function remove(i: number) {
    setRows((rs) => rs.filter((_, idx) => idx !== i));
  }
  function add() {
    setRows((rs) => [...rs, { slug: "", name: "", sort_order: rs.length }]);
  }

  return (
    <section>
      <h2 className="font-serif text-2xl">Ministries</h2>
      <p className="mt-2 max-w-2xl text-sm text-ink-500">
        The ministries that make up this country's cabinet. Ministry ↔ sector weighting is edited under portfolios (next step in the seeding flow).
      </p>
      {error && <p className="mt-3 text-sm text-red-600">{error.message}</p>}
      <ul className="mt-6 space-y-2">
        {rows.map((r, i) => (
          <li key={r.id ?? `new-${i}`} className="flex flex-wrap items-center gap-2 border border-line-200 p-3">
            <input
              placeholder="slug"
              value={r.slug}
              onChange={(e) => update(i, { slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })}
              className="w-40 border border-line-200 px-2 py-1 font-mono text-xs"
            />
            <input
              placeholder="Ministry name"
              value={r.name}
              onChange={(e) => update(i, { name: e.target.value })}
              className="flex-1 min-w-[200px] border border-line-200 px-2 py-1 text-sm"
            />
            <input
              type="number"
              value={r.sort_order}
              onChange={(e) => update(i, { sort_order: Number(e.target.value) || 0 })}
              className="w-16 border border-line-200 px-2 py-1 text-sm"
            />
            <button
              onClick={() => remove(i)}
              className="font-mono text-[10px] uppercase tracking-widest text-ink-500 hover:text-red-600"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex items-center justify-between">
        <button
          onClick={add}
          className="font-mono text-[10px] uppercase tracking-widest text-ink-500 hover:text-ink-950"
        >
          + Add ministry
        </button>
        <button
          disabled={pending || rows.some((r) => !r.slug || !r.name)}
          onClick={() => onSave(rows)}
          className="border border-ink-950 px-3 py-1 font-mono text-[10px] uppercase tracking-widest hover:bg-ink-950 hover:text-paper-0 disabled:opacity-40"
        >
          {pending ? "Saving…" : "Save ministries"}
        </button>
      </div>
    </section>
  );
}
