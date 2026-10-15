import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";

import { MarketingShell } from "@/components/marketing/MarketingShell";
import { supabase } from "@/integrations/supabase/client";

type Details = {
  client?: { name?: string; redirect_uri?: string; client_name?: string } | null;
  scope?: string;
  user?: { email?: string } | null;
  redirect_url?: string;
  redirect_to?: string;
} | null;

type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: Details; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: { redirect_url?: string; redirect_to?: string } | null; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: { redirect_url?: string; redirect_to?: string } | null; error: { message: string } | null }>;
};
const oauth = () => (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Approve connection — GDPVision" },
      { name: "description", content: "Approve or deny an app's request to use GDPVision as you." },
      { property: "og:title", content: "Approve connection — GDPVision" },
      { property: "og:description", content: "Approve or deny an app connection to GDPVision." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("This link is missing its authorization request.");
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth", search: { next: location.pathname + location.searchStr } });
  },
  loader: async ({ location }) => {
    const id = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauth().getAuthorizationDetails(id);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    const { data: u } = await supabase.auth.getUser();
    return { details: data, email: u.user?.email ?? null };
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <MarketingShell>
      <main className="mx-auto max-w-md px-6 py-24">
        <h1 className="text-xl font-medium">This connection request can't be opened</h1>
        <p className="mt-2 text-sm text-ink-500">
          {error instanceof Error ? error.message : String(error)} It may have expired — start the connection again from the app.
        </p>
      </main>
    </MarketingShell>
  ),
});

function Consent() {
  const { details, email } = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = details?.client?.name ?? details?.client?.client_name ?? "An app";
  const scopes = (details?.scope ?? "").split(/\s+/).filter(Boolean);
  const label = (s: string) =>
    s === "email" ? "Share your email address" : s === "profile" ? "Share your basic profile" : s === "openid" ? "Confirm who you are" : `Additional permission requested: ${s}`;

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error } = approve
      ? await oauth().approveAuthorization(authorization_id)
      : await oauth().denyAuthorization(authorization_id);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("The sign-in service did not return where to go next. Please try again.");
      return;
    }
    window.location.href = target;
  }

  return (
    <MarketingShell>
      <main className="mx-auto max-w-md px-6 py-24">
        <h1 className="text-2xl font-medium">Connect {name} to GDPVision</h1>
        {email && <p className="mt-1 text-sm text-ink-500">Signed in as {email}</p>}
        <p className="mt-4 text-sm text-ink-700">
          {name} will be able to read GDPVision's public country data — indicators, comparisons, verified public facts and official sources — as you.
        </p>
        {details?.client?.redirect_uri && (
          <p className="mt-2 text-[12px] text-ink-500">Returns to {details.client.redirect_uri}</p>
        )}
        {scopes.length > 0 && (
          <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-ink-700">
            {scopes.map((s) => (
              <li key={s}>{label(s)}</li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-[12px] text-ink-500">This does not bypass GDPVision's permissions. Nothing can be changed or deleted.</p>
        {error && (
          <p role="alert" className="mt-4 text-sm text-signal-negative">
            {error}
          </p>
        )}
        <div className="mt-6 flex gap-3">
          <button type="button" className="btn-primary" disabled={busy} onClick={() => decide(true)}>
            {busy ? "Working…" : "Approve"}
          </button>
          <button type="button" className="btn-secondary" disabled={busy} onClick={() => decide(false)}>
            Cancel connection
          </button>
        </div>
      </main>
    </MarketingShell>
  );
}
