import { Link, useNavigate } from "@tanstack/react-router";
import { type ReactNode } from "react";

import { Wordmark } from "@/components/marketing/Wordmark";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  eyebrow?: string;
  crumbs?: Array<{ label: string; to?: string; params?: Record<string, string> }>;
  children: ReactNode;
};

const NAV = [
  { to: "/admin/countries", label: "Countries" },
  { to: "/admin/brain", label: "Second brain" },
  { to: "/admin", label: "Users" },
  { to: "/admin/activity", label: "Activity" },
  { to: "/config", label: "Configuration" },
  { to: "/admin/audits/log", label: "Audit log" },
] as const;

export function SuperAdminShell({ eyebrow, crumbs, children }: Props) {
  const navigate = useNavigate();

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-dvh bg-paper-0 text-ink-950">
      <header className="flex items-center justify-between border-b border-line-200 px-8 py-5">
        <div className="flex items-center gap-10">
          <Link to="/admin/countries"><Wordmark /></Link>
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
            Super admin
          </span>
        </div>
        <nav className="flex items-center gap-6 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: n.to === "/admin" }}
              activeProps={{ className: "text-ink-950" }}
              className="hover:text-ink-950"
            >
              {n.label}
            </Link>
          ))}
          <button onClick={signOut} className="hover:text-ink-950">
            Sign out
          </button>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-8 py-10">
        {(eyebrow || crumbs?.length) && (
          <div className="mb-6 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
            {crumbs?.map((c, i) => (
              <span key={i} className="flex items-center gap-3">
                {c.to ? (
                  <Link
                    to={c.to}
                    params={c.params as never}
                    className="hover:text-ink-950"
                  >
                    {c.label}
                  </Link>
                ) : (
                  <span className="text-ink-950">{c.label}</span>
                )}
                {i < (crumbs.length - 1) && <span>/</span>}
              </span>
            ))}
            {eyebrow && !crumbs?.length && <span>{eyebrow}</span>}
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
