import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { SectionHeader } from "@/components/marketing/SectionHeader";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — GDPVision" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

type Mode = "sign-in" | "sign-up";

function AuthPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // If already signed in, get out of the way.
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/instrument" });
    });
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "sign-in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/instrument`,
            data: { display_name: displayName || email },
          },
        });
        if (error) throw error;
      }
      router.invalidate();
      navigate({ to: "/instrument" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <MarketingShell>
      <div className="mx-auto max-w-md px-6 py-24">
        <SectionHeader eyebrow="Instrument access" title="Sign in" />
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
          <label className="block">
            <span className="text-xs uppercase tracking-wider text-ink-500">Password</span>
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
          {error && (
            <p className="text-sm text-signal-negative" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full border-l-2 border-gold-500 bg-ink-950 py-3 text-sm uppercase tracking-widest text-paper-0 transition-colors hover:bg-ink-700 disabled:opacity-50"
          >
            {busy ? "Working…" : mode === "sign-in" ? "Sign in" : "Create instrument account"}
          </button>
        </form>
        <div className="mt-8 flex items-center justify-between text-sm text-ink-500">
          <button
            type="button"
            onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}
            className="underline underline-offset-4 hover:text-ink-950"
          >
            {mode === "sign-in" ? "Create an account" : "I already have an account"}
          </button>
          <Link to="/" className="hover:text-ink-950">
            Back to gdpvision.com
          </Link>
        </div>
      </div>
    </MarketingShell>
  );
}
