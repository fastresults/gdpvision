import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import {
  addBinding,
  grantRole,
  inviteUser,
  listAdminUsers,
  listCountries,
  listInstanceConfig,
  removeBinding,
  revokeRole,
  setDefaultBinding,
  setInstanceConfig,
} from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { Wordmark } from "@/components/marketing/Wordmark";

const usersQuery = queryOptions({ queryKey: ["admin-users"], queryFn: () => listAdminUsers() });
const countriesQuery = queryOptions({ queryKey: ["admin-countries"], queryFn: () => listCountries() });
const configQuery = queryOptions({ queryKey: ["admin-config"], queryFn: () => listInstanceConfig() });


const ROLES = ["admin", "cabinet_secretary", "principal", "line_minister", "advisor", "comms_director", "steward", "data_steward"] as const;

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Admin — GDPVision" },
      { name: "robots", content: "noindex" },
      { name: "description", content: "Instance administration: users, roles, and country bindings." },
    ],
  }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(usersQuery),
      context.queryClient.ensureQueryData(countriesQuery),
      context.queryClient.ensureQueryData(configQuery),
    ]);
  },
  component: AdminPage,
});

function AdminPage() {
  const { data: users } = useSuspenseQuery(usersQuery);
  const { data: countries } = useSuspenseQuery(countriesQuery);
  const { data: config } = useSuspenseQuery(configQuery);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const grant = useServerFn(grantRole);
  const revoke = useServerFn(revokeRole);
  const bind = useServerFn(addBinding);
  const unbind = useServerFn(removeBinding);
  const setDefault = useServerFn(setDefaultBinding);
  const invite = useServerFn(inviteUser);
  const saveConfig = useServerFn(setInstanceConfig);

  const mut = useMutation({
    mutationFn: async (fn: () => Promise<unknown>) => fn(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });
  const inviteMut = useMutation({
    mutationFn: (v: { email: string; displayName?: string }) => invite({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });
  const configMut = useMutation({
    mutationFn: (v: { key: string; valueJson: unknown }) => saveConfig({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-config"] }),
  });

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-paper-0 text-ink-950">
      <header className="flex items-center justify-between border-b border-line-200 px-8 py-5">
        <div className="flex items-center gap-10">
          <Link to="/instrument"><Wordmark /></Link>
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">Admin</span>
        </div>
        <div className="flex items-center gap-6 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
          <Link to="/config" className="hover:text-ink-950">Configuration</Link>
          <Link to="/admin/audits/keying" className="hover:text-ink-950">Keying audit</Link>
          <Link to="/admin/audits/log" className="hover:text-ink-950">Audit log</Link>
          <Link to="/codex" className="hover:text-ink-950">Codex</Link>
          <button onClick={signOut} className="hover:text-ink-950">Sign out</button>
        </div>
      </header>


      <main className="mx-auto max-w-7xl px-8 py-16">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">Instance administration</p>
        <h1 className="mt-2 font-serif text-4xl">Users, roles &amp; bindings</h1>
        <p className="mt-3 max-w-2xl text-sm text-ink-500">
          Grant portfolio roles, wire ministers to their country instance, and confirm each principal's default nation.
        </p>

        <div className="mt-12 space-y-8">
          {users.map((u) => (
            <UserCard
              key={u.user_id}
              user={u}
              countries={countries}
              onGrant={(role, cc) => mut.mutate(() => grant({ data: { userId: u.user_id, role, countryCode: cc } }))}
              onRevoke={(role, cc) => mut.mutate(() => revoke({ data: { userId: u.user_id, role, countryCode: cc } }))}
              onBind={(cc) => mut.mutate(() => bind({ data: { userId: u.user_id, countryCode: cc } }))}
              onUnbind={(cc) => mut.mutate(() => unbind({ data: { userId: u.user_id, countryCode: cc } }))}
              onDefault={(cc) => mut.mutate(() => setDefault({ data: { userId: u.user_id, countryCode: cc } }))}
            />
          ))}
          {users.length === 0 && (
            <p className="border border-line-200 p-12 text-center text-sm text-ink-500">
              No users yet. Invite principals from the auth console to populate this list.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

function UserCard({
  user,
  countries,
  onGrant,
  onRevoke,
  onBind,
  onUnbind,
  onDefault,
}: {
  user: { user_id: string; display_name: string | null; roles: Array<{ role: string; country_code: string | null }>; bindings: Array<{ country_code: string; is_default: boolean }> };
  countries: Array<{ code: string; name: string }>;
  onGrant: (role: typeof ROLES[number], cc?: string) => void;
  onRevoke: (role: string, cc?: string) => void;
  onBind: (cc: string) => void;
  onUnbind: (cc: string) => void;
  onDefault: (cc: string) => void;
}) {
  const [role, setRole] = useState<typeof ROLES[number]>("advisor");
  const [cc, setCc] = useState<string>("");
  const [bindCc, setBindCc] = useState<string>(countries[0]?.code ?? "");

  return (
    <section className="border border-line-200 p-6">
      <header className="flex items-baseline justify-between">
        <h2 className="font-serif text-xl">{user.display_name ?? "(unnamed)"}</h2>
        <span className="font-mono text-[10px] uppercase tracking-widest text-ink-500">{user.user_id.slice(0, 8)}</span>
      </header>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div>
          <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">Roles</h3>
          <ul className="mt-3 space-y-1 text-sm">
            {user.roles.length === 0 && <li className="text-ink-500">None</li>}
            {user.roles.map((r, i) => (
              <li key={i} className="flex items-center justify-between">
                <span>{r.role}{r.country_code ? ` · ${r.country_code}` : ""}</span>
                <button
                  className="font-mono text-[10px] uppercase tracking-widest text-ink-500 hover:text-red-600"
                  onClick={() => onRevoke(r.role, r.country_code ?? undefined)}
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex gap-2 text-sm">
            <select value={role} onChange={(e) => setRole(e.target.value as typeof ROLES[number])} className="border border-line-200 px-2 py-1">
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <input
              placeholder="country (opt)"
              value={cc}
              onChange={(e) => setCc(e.target.value.toUpperCase())}
              className="w-28 border border-line-200 px-2 py-1"
            />
            <button
              className="border border-ink-950 px-3 py-1 font-mono text-[10px] uppercase tracking-widest hover:bg-ink-950 hover:text-paper-0"
              onClick={() => onGrant(role, cc || undefined)}
            >
              Grant
            </button>
          </div>
        </div>

        <div>
          <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">Country bindings</h3>
          <ul className="mt-3 space-y-1 text-sm">
            {user.bindings.length === 0 && <li className="text-ink-500">None</li>}
            {user.bindings.map((b) => (
              <li key={b.country_code} className="flex items-center justify-between">
                <span>{b.country_code}{b.is_default ? " · default" : ""}</span>
                <span className="flex gap-3 font-mono text-[10px] uppercase tracking-widest">
                  {!b.is_default && (
                    <button className="text-ink-500 hover:text-ink-950" onClick={() => onDefault(b.country_code)}>Set default</button>
                  )}
                  <button className="text-ink-500 hover:text-red-600" onClick={() => onUnbind(b.country_code)}>Remove</button>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex gap-2 text-sm">
            <select value={bindCc} onChange={(e) => setBindCc(e.target.value)} className="border border-line-200 px-2 py-1">
              {countries.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
            </select>
            <button
              className="border border-ink-950 px-3 py-1 font-mono text-[10px] uppercase tracking-widest hover:bg-ink-950 hover:text-paper-0"
              onClick={() => bindCc && onBind(bindCc)}
            >
              Bind
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
