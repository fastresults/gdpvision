import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { SectionHeader } from "@/components/marketing/SectionHeader";
import { lovable } from "@/integrations/lovable";
import {
  acceptInvitation,
  getInvitationByToken,
} from "@/lib/invitations.functions";

type Search = { token?: string };

export const Route = createFileRoute("/auth/invite")({
  head: () => ({
    meta: [
      { title: "Accept invitation — GDPVision" },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): Search =>
    typeof s.token === "string" ? { token: s.token } : {},
  component: InvitePage,
});

const PENDING_KEY = "gdpv.pending_invite_token";

function InvitePage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const router = useRouter();

  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "invalid"; reason: string }
    | {
        kind: "ready";
        invitation: {
          email: string;
          role: string;
          country_code: string | null;
          note: string | null;
          expires_at: string;
        };
      }
  >({ kind: "loading" });

  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) {
      setState({ kind: "invalid", reason: "missing" });
      return;
    }
    (async () => {
      try {
        const res = await getInvitationByToken({ data: { token } });
        if (!res.ok) setState({ kind: "invalid", reason: res.reason });
        else setState({ kind: "ready", invitation: res.invitation });
      } catch (e) {
        setState({
          kind: "invalid",
          reason: e instanceof Error ? e.message : "error",
        });
      }
    })();
  }, [token]);

  // If a user returns from OAuth already signed in with a pending token, accept.
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      const pending =
        token ?? (typeof window !== "undefined"
          ? window.sessionStorage.getItem(PENDING_KEY)
          : null);
      if (!pending) return;
      try {
        await acceptInvitation({ data: { token: pending } });
        window.sessionStorage.removeItem(PENDING_KEY);
        router.invalidate();
        navigate({ to: "/home" });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not accept invitation");
      }
    })();
  }, [token, navigate, router]);

  async function onEmailSignup(e: React.FormEvent) {
    e.preventDefault();
    if (state.kind !== "ready" || !token) return;
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const email = state.invitation.email;
      const { data: existing } = await supabase.auth.getUser();
      if (!existing.user) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/invite?token=${encodeURIComponent(
              token,
            )}`,
            data: { display_name: displayName || email },
          },
        });
        if (error) throw error;
        const { data: after } = await supabase.auth.getUser();
        if (!after.user) {
          setNotice(
            "Check your email to confirm your address, then return to this invitation link to finish.",
          );
          return;
        }
      }
      await acceptInvitation({ data: { token } });
      router.invalidate();
      navigate({ to: "/home" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle() {
    if (!token) return;
    setError(null);
    setBusy(true);
    try {
      window.sessionStorage.setItem(PENDING_KEY, token);
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/auth/invite?token=${encodeURIComponent(
          token,
        )}`,
      });
      if (result.error) throw result.error;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
      setBusy(false);
    }
  }

  return (
    <MarketingShell>
      <div className="mx-auto max-w-md px-6 py-24">
        <SectionHeader eyebrow="Invitation" title="Accept your invitation" />

        {state.kind === "loading" && (
          <p className="mt-8 text-sm text-ink-500">Verifying invitation…</p>
        )}

        {state.kind === "invalid" && (
          <div className="mt-10 space-y-4">
            <p className="text-sm text-signal-negative">
              {state.reason === "missing" && "No invitation token provided."}
              {state.reason === "not_found" && "This invitation link is not valid."}
              {state.reason === "revoked" && "This invitation has been revoked."}
              {state.reason === "accepted" && "This invitation has already been used."}
              {state.reason === "expired" && "This invitation has expired."}
              {!["missing", "not_found", "revoked", "accepted", "expired"].includes(
                state.reason,
              ) && state.reason}
            </p>
            <p className="text-sm text-ink-500">
              Please contact your administrator to request a new invitation.
            </p>
            <Link
              to="/auth"
              className="inline-block underline underline-offset-4 hover:text-ink-950"
            >
              Back to sign in
            </Link>
          </div>
        )}

        {state.kind === "ready" && (
          <div className="mt-10 space-y-6">
            <div className="border-l-2 border-gold-500 pl-4">
              <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
                Invited to
              </div>
              <div className="mt-1 text-lg text-ink-950">
                {state.invitation.email}
              </div>
              <div className="mt-2 text-xs text-ink-500">
                Role: {state.invitation.role}
                {state.invitation.country_code
                  ? ` · Country: ${state.invitation.country_code}`
                  : " · Global"}
              </div>
              {state.invitation.note && (
                <div className="mt-3 text-sm text-ink-700">
                  {state.invitation.note}
                </div>
              )}
            </div>

            <form onSubmit={onEmailSignup} className="space-y-6">
              <label className="block">
                <span className="text-xs uppercase tracking-wider text-ink-500">
                  Display name
                </span>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="mt-2 w-full border-b border-line-200 bg-transparent py-2 text-lg focus:border-ink-950 focus:outline-none"
                  placeholder="Your full name"
                />
              </label>
              <label className="block">
                <span className="text-xs uppercase tracking-wider text-ink-500">
                  Choose a password
                </span>
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-2 w-full border-b border-line-200 bg-transparent py-2 text-lg focus:border-ink-950 focus:outline-none"
                />
              </label>
              {error && (
                <p className="text-sm text-signal-negative" role="alert">
                  {error}
                </p>
              )}
              {notice && (
                <p className="text-sm text-ink-700" role="status">
                  {notice}
                </p>
              )}
              <button
                type="submit"
                disabled={busy}
                className="w-full border-l-2 border-gold-500 bg-ink-950 py-3 text-sm uppercase tracking-widest text-paper-0 transition-colors hover:bg-ink-700 disabled:opacity-50"
              >
                {busy ? "Working…" : "Accept & create account"}
              </button>
            </form>

            <div className="space-y-4">
              <div className="flex items-center gap-3 text-[10px] font-mono uppercase tracking-[0.2em] text-ink-500">
                <span className="h-px flex-1 bg-line-200" />
                or
                <span className="h-px flex-1 bg-line-200" />
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={onGoogle}
                className="w-full border border-line-200 bg-paper-0 py-3 text-sm text-ink-950 transition-colors hover:bg-paper-100 disabled:opacity-50"
              >
                Continue with Google ({state.invitation.email})
              </button>
              <p className="text-[11px] text-ink-500">
                You must sign in with{" "}
                <span className="font-mono">{state.invitation.email}</span>. Any
                other address will be rejected.
              </p>
            </div>
          </div>
        )}
      </div>
    </MarketingShell>
  );
}
