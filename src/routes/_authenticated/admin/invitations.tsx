import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";

import { SuperAdminShell } from "@/components/admin/SuperAdminShell";
import {
  createInvitation,
  listInvitations,
  revokeInvitation,
  type InvitationRow,
} from "@/lib/invitations.functions";

const invitationsQuery = queryOptions({
  queryKey: ["invitations"],
  queryFn: () => listInvitations(),
});

export const Route = createFileRoute("/_authenticated/admin/invitations")({
  head: () => ({
    meta: [
      { title: "Invitations — GDPVision" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(invitationsQuery),
  component: InvitationsPage,
  errorComponent: ({ error }) => (
    <SuperAdminShell crumbs={[{ label: "Invitations" }]}>
      <p className="text-sm text-red-600">{error.message}</p>
    </SuperAdminShell>
  ),
  notFoundComponent: () => (
    <SuperAdminShell crumbs={[{ label: "Invitations" }]}>
      <p className="text-sm text-ink-500">Not found.</p>
    </SuperAdminShell>
  ),
});

const ROLES = [
  "admin",
  "cabinet_secretary",
  "principal",
  "line_minister",
  "advisor",
  "comms_director",
  "steward",
  "data_steward",
] as const;

function statusOf(inv: InvitationRow): "pending" | "accepted" | "revoked" | "expired" {
  if (inv.revoked_at) return "revoked";
  if (inv.accepted_at) return "accepted";
  if (new Date(inv.expires_at).getTime() < Date.now()) return "expired";
  return "pending";
}

function InvitationsPage() {
  const { data } = useSuspenseQuery(invitationsQuery);
  const qc = useQueryClient();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]>("line_minister");
  const [country, setCountry] = useState("");
  const [note, setNote] = useState("");
  const [expiresDays, setExpiresDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastLink, setLastLink] = useState<string | null>(null);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLastLink(null);
    setBusy(true);
    try {
      const inv = await createInvitation({
        data: {
          email,
          role,
          country_code: country.trim() ? country.trim().toUpperCase() : null,
          note: note.trim() || null,
          expires_in_days: expiresDays,
        },
      });
      const url = `${window.location.origin}/auth/invite?token=${encodeURIComponent(inv.token)}`;
      setLastLink(url);
      setEmail("");
      setNote("");
      await qc.invalidateQueries({ queryKey: ["invitations"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create invitation");
    } finally {
      setBusy(false);
    }
  }

  async function onRevoke(id: string) {
    if (!confirm("Revoke this invitation?")) return;
    try {
      await revokeInvitation({ data: { id } });
      await qc.invalidateQueries({ queryKey: ["invitations"] });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed");
    }
  }

  async function copyLink(token: string) {
    const url = `${window.location.origin}/auth/invite?token=${encodeURIComponent(token)}`;
    await navigator.clipboard.writeText(url);
  }

  return (
    <SuperAdminShell
      eyebrow="Access control"
      crumbs={[{ label: "Invitations" }]}
    >
      <div className="grid gap-10 lg:grid-cols-[380px_1fr]">
        <section>
          <h2 className="font-serif text-xl text-ink-950">Create invitation</h2>
          <p className="mt-2 text-sm text-ink-500">
            The recipient can only sign up with the invited email address.
          </p>
          <form onSubmit={onCreate} className="mt-6 space-y-4">
            <label className="block">
              <span className="text-xs uppercase tracking-wider text-ink-500">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full border-b border-line-200 bg-transparent py-2 text-sm focus:border-ink-950 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="text-xs uppercase tracking-wider text-ink-500">Role</span>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                className="mt-1 w-full border-b border-line-200 bg-transparent py-2 text-sm focus:border-ink-950 focus:outline-none"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs uppercase tracking-wider text-ink-500">
                Country (ISO-3, optional)
              </span>
              <input
                type="text"
                value={country}
                maxLength={3}
                onChange={(e) => setCountry(e.target.value.toUpperCase())}
                placeholder="KNA"
                className="mt-1 w-full border-b border-line-200 bg-transparent py-2 text-sm focus:border-ink-950 focus:outline-none"
              />
              <span className="mt-1 block text-[11px] text-ink-500">
                Leave blank for a global role (admin only).
              </span>
            </label>
            <label className="block">
              <span className="text-xs uppercase tracking-wider text-ink-500">Note (optional)</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="mt-1 w-full border border-line-200 bg-transparent p-2 text-sm focus:border-ink-950 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="text-xs uppercase tracking-wider text-ink-500">Expires in (days)</span>
              <input
                type="number"
                min={1}
                max={365}
                value={expiresDays}
                onChange={(e) => setExpiresDays(Number(e.target.value))}
                className="mt-1 w-32 border-b border-line-200 bg-transparent py-2 text-sm focus:border-ink-950 focus:outline-none"
              />
            </label>
            {error && <p className="text-sm text-signal-negative">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full border-l-2 border-gold-500 bg-ink-950 py-3 text-xs uppercase tracking-widest text-paper-0 hover:bg-ink-700 disabled:opacity-50"
            >
              {busy ? "Creating…" : "Create invitation"}
            </button>
            {lastLink && (
              <div className="border border-line-200 bg-paper-100 p-3 text-xs">
                <div className="text-ink-500 uppercase tracking-wider">Invite link</div>
                <div className="mt-1 break-all font-mono text-ink-950">{lastLink}</div>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(lastLink)}
                  className="mt-2 underline underline-offset-4"
                >
                  Copy link
                </button>
              </div>
            )}
          </form>
        </section>

        <section>
          <h2 className="font-serif text-xl text-ink-950">
            Invitations ({data.length})
          </h2>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-line-200 text-left text-[11px] uppercase tracking-wider text-ink-500">
                  <th className="py-2 pr-3">Email</th>
                  <th className="py-2 pr-3">Role</th>
                  <th className="py-2 pr-3">Country</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Expires</th>
                  <th className="py-2 pr-3"></th>
                </tr>
              </thead>
              <tbody>
                {data.map((inv) => {
                  const s = statusOf(inv);
                  return (
                    <tr key={inv.id} className="border-b border-line-200/60">
                      <td className="py-2 pr-3 text-ink-950">{inv.email}</td>
                      <td className="py-2 pr-3 text-ink-700">{inv.role}</td>
                      <td className="py-2 pr-3 text-ink-700">{inv.country_code ?? "—"}</td>
                      <td className="py-2 pr-3">
                        <span
                          className={
                            s === "accepted"
                              ? "text-signal-positive"
                              : s === "pending"
                                ? "text-ink-950"
                                : "text-ink-500"
                          }
                        >
                          {s}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-ink-500">
                        {new Date(inv.expires_at).toLocaleDateString()}
                      </td>
                      <td className="py-2 pr-3 text-right">
                        {s === "pending" && (
                          <div className="flex justify-end gap-3">
                            <button
                              onClick={() => copyLink(inv.token)}
                              className="text-xs underline underline-offset-4"
                            >
                              Copy link
                            </button>
                            <button
                              onClick={() => onRevoke(inv.id)}
                              className="text-xs text-signal-negative underline underline-offset-4"
                            >
                              Revoke
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {data.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-ink-500">
                      No invitations yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </SuperAdminShell>
  );
}
