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


const ROLES = ["admin", "country_admin", "cabinet_secretary", "principal", "line_minister", "advisor", "comms_director", "steward", "data_steward"] as const;

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
    <div className="min-h-dvh bg-paper-0 text-ink-950">
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
              No users yet. Use the invite form below to bring your first principal onto the instance.
            </p>
          )}
        </div>

        <InviteSection
          pending={inviteMut.isPending}
          error={inviteMut.error as Error | null}
          onInvite={(email, displayName) => inviteMut.mutate({ email, displayName })}
        />

        <ConfigSection
          rows={config}
          pending={configMut.isPending}
          error={configMut.error as Error | null}
          onSave={(key, valueJson) => configMut.mutate({ key, valueJson })}
        />
      </main>
    </div>
  );
}

function InviteSection({ onInvite, pending, error }: { onInvite: (email: string, displayName?: string) => void; pending: boolean; error: Error | null }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  return (
    <section className="mt-20 border-t border-line-200 pt-10">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">Invitations</p>
      <h2 className="mt-2 font-serif text-2xl">Invite a new principal</h2>
      <p className="mt-2 max-w-2xl text-sm text-ink-500">Sends a Lovable Cloud email invitation. Assign roles and country bindings after they accept.</p>
      <div className="mt-6 flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-widest text-ink-500">Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-72 border border-line-200 px-2 py-1" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-widest text-ink-500">Display name (opt)</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-56 border border-line-200 px-2 py-1" />
        </label>
        <button
          type="button"
          disabled={pending || !email}
          onClick={() => onInvite(email, name || undefined)}
          className="border border-ink-950 px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] hover:bg-ink-950 hover:text-paper-0 disabled:opacity-40"
        >
          {pending ? "Sending…" : "Send invite"}
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error.message}</p>}
    </section>
  );
}

function ConfigSection({
  rows,
  onSave,
  pending,
  error,
}: {
  rows: Array<{ key: string; value_json: any; updated_at: string; updated_by: string | null }>;
  onSave: (key: string, valueJson: unknown) => void;
  pending: boolean;
  error: Error | null;
}) {
  return (
    <section className="mt-20 border-t border-line-200 pt-10">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">Instance configuration</p>
      <h2 className="mt-2 font-serif text-2xl">Runtime settings</h2>
      <p className="mt-2 max-w-2xl text-sm text-ink-500">Edit JSON values directly. Changes are audited.</p>
      {error && <p className="mt-3 text-sm text-red-600">{error.message}</p>}
      <ul className="mt-8 space-y-6">
        {rows.length === 0 && <li className="text-sm text-ink-500">No configuration keys defined yet.</li>}
        {rows.map((r) => (
          <ConfigRow key={r.key} row={r} pending={pending} onSave={(v) => onSave(r.key, v)} />
        ))}
      </ul>
    </section>
  );
}

function ConfigRow({ row, onSave, pending }: { row: { key: string; value_json: any; updated_at: string }; onSave: (v: unknown) => void; pending: boolean }) {
  const [text, setText] = useState(() => JSON.stringify(row.value_json, null, 2));
  const [parseErr, setParseErr] = useState<string | null>(null);

  function commit() {
    try {
      const parsed = JSON.parse(text);
      setParseErr(null);
      onSave(parsed);
    } catch (e) {
      setParseErr((e as Error).message);
    }
  }

  return (
    <li className="border border-line-200 p-4">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em]">{row.key}</span>
        <span className="font-mono text-[10px] text-ink-500">updated {new Date(row.updated_at).toLocaleString()}</span>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={Math.min(12, Math.max(3, text.split("\n").length))}
        className="mt-3 w-full border border-line-200 p-2 font-mono text-xs"
      />
      {parseErr && <p className="mt-2 text-xs text-red-600">Invalid JSON: {parseErr}</p>}
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          disabled={pending}
          onClick={commit}
          className="border border-ink-950 px-3 py-1 font-mono text-[10px] uppercase tracking-widest hover:bg-ink-950 hover:text-paper-0 disabled:opacity-40"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </li>
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
