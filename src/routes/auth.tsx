import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { SectionHeader } from "@/components/marketing/SectionHeader";
import { Illustration } from "@/components/marketing/Illustration";
import illLamp from "@/assets/illustrations/section-lamp.jpg.asset.json";



async function postSignInRedirect(): Promise<"/home"> {
  return "/home";
}

type Mode = "sign-in" | "forgot";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — GDPVision" },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { mode?: Mode; blocked?: number } => {
    const m = search.mode;
    const blocked = search.blocked === 1 || search.blocked === "1" ? 1 : undefined;
    return {
      ...(m === "forgot" || m === "sign-in" ? { mode: m } : {}),
      ...(blocked ? { blocked } : {}),
    };
  },
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const search = Route.useSearch();
  const [mode, setMode] = useState<Mode>(search.mode ?? "sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // If already signed in, get out of the way.
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) navigate({ to: await postSignInRedirect() });
    });
  }, [navigate]);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setNotice(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (mode === "sign-in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.invalidate();
        navigate({ to: await postSignInRedirect() });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setNotice("Check your email for a link to reset your password.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const title = mode === "sign-in" ? "Sign in" : "Reset password";
  const cta = busy ? "Working…" : mode === "sign-in" ? "Sign in" : "Send reset link";

  return (
    <MarketingShell>
      <div className="mx-auto max-w-md px-6 py-24">
        <SectionHeader eyebrow="Instrument access" title={title} />

        <div className="mt-6 border-l-2 border-gold-500 bg-paper-100 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
              By invitation only
            </div>
            <Link
              to="/"
              className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500 underline underline-offset-4 hover:text-ink-950"
            >
              ← Back to gdpvision.com
            </Link>
          </div>
          <p className="mt-2 text-sm text-ink-950">
            GDPVision is a sovereign instrument reserved for Heads of Government,
            Cabinet Secretaries, and designated advisors. Accounts are provisioned
            by administrators — new accounts cannot be self-created.
          </p>
          <p className="mt-2 text-xs text-ink-500">
            If you have received an invitation email, open the link in that
            message to activate your credentials. All other requests must be
            routed through your administrator.
          </p>
        </div>

        {search.blocked ? (
          <div className="mt-4 border-l-2 border-signal-negative bg-paper-100 p-4 text-sm text-ink-950">
            This account is not authorised for GDPVision. Access is invitation
            only — please contact your administrator.
          </div>
        ) : null}

        <form onSubmit={onSubmit} className="mt-10 space-y-6">
          <label className="block">
            <span className="text-xs uppercase tracking-wider text-ink-500">Email</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 w-full border-b border-line-200 bg-transparent py-2 text-lg focus:border-ink-950 focus:outline-none"
            />
          </label>
          {mode !== "forgot" && (
            <label className="block">
              <div className="flex items-baseline justify-between">
                <span className="text-xs uppercase tracking-wider text-ink-500">Password</span>
                {mode === "sign-in" && (
                  <button
                    type="button"
                    onClick={() => switchMode("forgot")}
                    className="text-xs text-ink-500 underline underline-offset-4 hover:text-ink-950"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <input
                type="password"
                autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-2 w-full border-b border-line-200 bg-transparent py-2 text-lg focus:border-ink-950 focus:outline-none"
              />
            </label>
          )}
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
            {cta}
          </button>
        </form>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 text-sm text-ink-500">
          {mode === "forgot" ? (
            <button
              type="button"
              onClick={() => switchMode("sign-in")}
              className="underline underline-offset-4 hover:text-ink-950"
            >
              Back to sign in
            </button>
          ) : (
            <span className="text-xs text-ink-500">
              Google sign-in is only offered from within your personal
              invitation link.
            </span>
          )}
        </div>
      </div>
    </MarketingShell>
  );
}

