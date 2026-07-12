import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { SectionHeader } from "@/components/marketing/SectionHeader";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — GDPVision" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Supabase parses the recovery token from the URL hash and fires a
  // PASSWORD_RECOVERY event. We wait for it before allowing submit.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    // If arriving with an already-established recovery session, unblock too.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setNotice("Password updated. Redirecting…");
      setTimeout(() => navigate({ to: "/instrument" }), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <MarketingShell>
      <div className="mx-auto max-w-md px-6 py-24">
        <SectionHeader eyebrow="Instrument access" title="Set a new password" />
        {!ready ? (
          <p className="mt-10 text-sm text-ink-500">
            Verifying your reset link… If nothing happens, request a new link from the{" "}
            <Link to="/auth" className="underline underline-offset-4 hover:text-ink-950">
              sign-in page
            </Link>
            .
          </p>
        ) : (
          <form onSubmit={onSubmit} className="mt-10 space-y-6">
            <label className="block">
              <span className="text-xs uppercase tracking-wider text-ink-500">New password</span>
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
            <label className="block">
              <span className="text-xs uppercase tracking-wider text-ink-500">Confirm new password</span>
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
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
              {busy ? "Working…" : "Update password"}
            </button>
          </form>
        )}
      </div>
    </MarketingShell>
  );
}
