import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { SectionHeader } from "@/components/marketing/SectionHeader";
import { lovable } from "@/integrations/lovable";
import { getMyCountryStatus } from "@/lib/country-admin.functions";

async function postSignInRedirect(): Promise<"/admin/countries" | "/instrument"> {
  try {
    const status = await getMyCountryStatus();
    return status.isGlobalAdmin ? "/admin/countries" : "/instrument";
  } catch {
    return "/instrument";
  }
}

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — GDPVision" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

type Mode = "sign-in" | "sign-up" | "forgot";

function AuthPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // If already signed in, get out of the way.
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/instrument" });
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
        navigate({ to: "/instrument" });
      } else if (mode === "sign-up") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/instrument`,
            data: { display_name: displayName || email },
          },
        });
        if (error) throw error;
        router.invalidate();
        navigate({ to: "/instrument" });
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

  const title = mode === "sign-in" ? "Sign in" : mode === "sign-up" ? "Create account" : "Reset password";
  const cta = busy
    ? "Working…"
    : mode === "sign-in"
    ? "Sign in"
    : mode === "sign-up"
    ? "Create instrument account"
    : "Send reset link";

  return (
    <MarketingShell>
      <div className="mx-auto max-w-md px-6 py-24">
        <SectionHeader eyebrow="Instrument access" title={title} />
        <form onSubmit={onSubmit} className="mt-10 space-y-6">
          {mode === "sign-up" && (
            <label className="block">
              <span className="text-xs uppercase tracking-wider text-ink-500">Name</span>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="mt-2 w-full border-b border-line-200 bg-transparent py-2 text-lg focus:border-ink-950 focus:outline-none"
                placeholder="Adam Anderson"
              />
            </label>
          )}
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
        {mode !== "forgot" && (
          <div className="mt-6 space-y-4">
            <div className="flex items-center gap-3 text-[10px] font-mono uppercase tracking-[0.2em] text-ink-500">
              <span className="h-px flex-1 bg-line-200" />
              or
              <span className="h-px flex-1 bg-line-200" />
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setError(null);
                setBusy(true);
                try {
                  const result = await lovable.auth.signInWithOAuth("google", {
                    redirect_uri: window.location.origin,
                  });
                  if (result.error) throw result.error;
                  if (result.redirected) return;
                  router.invalidate();
                  navigate({ to: "/instrument" });
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Google sign-in failed");
                } finally {
                  setBusy(false);
                }
              }}
              className="flex w-full items-center justify-center gap-3 border border-line-200 bg-paper-0 py-3 text-sm text-ink-950 transition-colors hover:bg-paper-100 disabled:opacity-50"
            >
              <GoogleGlyph />
              Continue with Google
            </button>
          </div>
        )}
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
            <button
              type="button"
              onClick={() => switchMode(mode === "sign-in" ? "sign-up" : "sign-in")}
              className="underline underline-offset-4 hover:text-ink-950"
            >
              {mode === "sign-in" ? "Create an account" : "I already have an account"}
            </button>
          )}
          <Link to="/" className="hover:text-ink-950">
            Back to gdpvision.com
          </Link>
        </div>
      </div>
    </MarketingShell>
  );
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.17-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.92v2.32A9 9 0 0 0 9 18Z"/>
      <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.96H.92A9 9 0 0 0 0 9c0 1.45.35 2.82.92 4.04l3.05-2.32Z"/>
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .92 4.96l3.05 2.32C4.68 5.16 6.66 3.58 9 3.58Z"/>
    </svg>
  );
}
