import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { type ReactNode } from "react";

import { Wordmark } from "@/components/marketing/Wordmark";
import { supabase } from "@/integrations/supabase/client";
import { getMyCountryStatus } from "@/lib/country-admin.functions";
import { scrollToTop } from "@/lib/utils";

type Props = {
  eyebrow?: string;
  crumbs?: Array<{ label: string; to?: string; params?: Record<string, string> }>;
  /** When true, uses a wider content container for canvas-heavy chambers. */
  wide?: boolean;
  children: ReactNode;
};

const NAV = [
  { to: "/home", label: "Home" },
  { to: "/admin/countries", label: "Countries" },
  { to: "/admin/brain", label: "Second brain" },
  { to: "/admin/proforma", label: "Pro forma" },
  { to: "/admin", label: "Users" },
  { to: "/admin/invitations", label: "Invitations" },
  { to: "/admin/activity", label: "Activity" },
  { to: "/config", label: "Configuration" },
  { to: "/admin/audits/log", label: "Audit log" },
  { to: "/admin/github", label: "GitHub" },

] as const;

export function SuperAdminShell({ eyebrow, crumbs, wide, children }: Props) {
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { code?: string };

  // Country users now enter the chambers through these same routes. They must
  // never see agency navigation — they get a back-to-brief rail instead.
  const { data: status } = useQuery({
    queryKey: ["my-country-status"],
    queryFn: () => getMyCountryStatus(),
    staleTime: 5 * 60_000,
  });
  const audience = status ? (status.isGlobalAdmin ? "agency" : "country") : "unknown";
  const homeTo = audience === "country" && params.code ? "/console/$code" : "/home";
  const homeParams = audience === "country" && params.code ? { code: params.code } : undefined;

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-dvh bg-paper-0 text-ink-950">
      <header className="flex items-center justify-between border-b border-line-200 px-8 py-5">
        <div className="flex items-center gap-10">
          <Link to={homeTo} params={homeParams as never} onClick={() => scrollToTop()}>
            <Wordmark />
          </Link>
          {audience === "agency" && (
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
              Super admin
            </span>
          )}
          {audience === "country" && params.code && (
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
              {params.code}
            </span>
          )}
        </div>
        <nav className="flex items-center gap-6 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
          {audience === "agency" &&
            NAV.map((n) => (
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
          {audience === "country" && params.code && (
            <Link to="/console/$code" params={{ code: params.code }} className="hover:text-ink-950">
              ← Your brief
            </Link>
          )}
          <button onClick={signOut} className="hover:text-ink-950">
            Sign out
          </button>
        </nav>
      </header>

      <main className={`mx-auto ${wide ? "max-w-[1440px]" : "max-w-6xl"} px-8 py-10`}>
        {(eyebrow || crumbs?.length) && (
          <div className="mb-6 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
            {crumbs?.map((c, i) => (
              <span key={i} className="flex items-center gap-3">
                {c.to ? (
                  <Link to={c.to} params={c.params as never} className="hover:text-ink-950">
                    {c.label}
                  </Link>
                ) : (
                  <span className="text-ink-950">{c.label}</span>
                )}
                {i < crumbs.length - 1 && <span>/</span>}
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
