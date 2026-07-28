// Country Console layout — country-user chrome. Minimal: header + content +
// a persistent 4-rail bottom tab bar. No hamburger, no drawer.

import { createFileRoute, Link, Outlet, useParams, useRouterState } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { FileText, Home, MessageCircle, Send } from "lucide-react";

import { getMyCountryStatus } from "@/lib/country-admin.functions";
import { CARICOM_OECS_REGISTRY, flagUrl } from "@/lib/caricom-registry";
import { Wordmark } from "@/components/marketing/Wordmark";
import { CountryChip } from "@/components/console/CountryChip";
import { useImpersonation } from "@/lib/impersonation";

const statusQuery = queryOptions({
  queryKey: ["my-country-status"],
  queryFn: () => getMyCountryStatus(),
});

export const Route = createFileRoute("/_authenticated/console")({
  head: () => ({
    meta: [
      { title: "Your console — GDPVision" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(statusQuery);
    return null;
  },
  component: ConsoleLayout,
});

function countryLabel(code: string): string | null {
  return CARICOM_OECS_REGISTRY.find((n) => n.code === code.toUpperCase())?.name ?? null;
}

function ConsoleLayout() {
  const { data: status } = useSuspenseQuery(statusQuery);
  const params = useParams({ strict: false }) as { code?: string };
  const { state: viewAs } = useImpersonation();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const code =
    params.code ??
    viewAs?.country_code ??
    status.bindings.find((b) => b.is_default)?.country_code ??
    status.bindings[0]?.country_code ??
    null;

  const countryName =
    status.bindings.find((b) => b.country_code === code)?.name ??
    (code ? countryLabel(code) : null);
  const flag = code ? flagUrl(code, "w160") : null;
  const isAgency = status.isGlobalAdmin && !viewAs;


  type Tab = {
    to:
      | "/console/$code"
      | "/console/$code/study"
      | "/console/$code/ask"
      | "/console/$code/request/new";
    label: string;
    icon: typeof Home;
    isActive: boolean;
    primary?: boolean;
  };
  const tabs: Tab[] = code
    ? [
        {
          to: "/console/$code",
          label: "Brief",
          icon: Home,
          isActive: pathname === `/console/${code}`,
        },
        {
          to: "/console/$code/study",
          label: "Study",
          icon: FileText,
          isActive:
            pathname.startsWith(`/console/${code}/study`) ||
            pathname.startsWith(`/console/${code}/requests`),
        },
        {
          to: "/console/$code/ask",
          label: "Ask",
          icon: MessageCircle,
          isActive: pathname.startsWith(`/console/${code}/ask`),
        },
        {
          to: "/console/$code/request/new",
          label: "Send",
          icon: Send,
          isActive: pathname.startsWith(`/console/${code}/request/`),
          primary: true,
        },
      ]
    : [];


  return (
    <div className="flex min-h-dvh flex-col bg-paper-50 text-ink-950">
      <header className="sticky top-0 z-20 border-b border-line-200 bg-paper-0/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <Link
            to="/console/$code"
            params={{ code: code ?? "" }}
            className="flex min-w-0 items-center gap-2 sm:gap-3"
          >
            <Wordmark className="text-ink-950" />
            {code && <CountryChip flagUrl={flag} code={code} name={countryName} className="ml-1" />}
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-28 sm:px-6 sm:py-10 sm:pb-28">
        <Outlet />
      </main>

      {/* Persistent bottom tab bar — 4 rails, no menus */}
      {code && (
        <nav
          aria-label="Primary"
          className="fixed inset-x-0 bottom-0 z-30 border-t border-line-200 bg-paper-0/95 backdrop-blur"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="mx-auto grid max-w-6xl grid-cols-4">
            {tabs.map((t) => {
              const Icon = t.icon;
              const base =
                "flex min-h-[64px] flex-col items-center justify-center gap-1 px-2 py-2 text-[10px] font-mono uppercase tracking-[0.18em] transition-colors";
              if (t.primary) {
                return (
                  <Link
                    key={t.to}
                    to={t.to}
                    params={{ code }}
                    className={`${base} btn-primary rounded-none border-0`}
                  >
                    <Icon size={18} strokeWidth={2} />
                    <span>{t.label}</span>
                  </Link>
                );
              }
              return (
                <Link
                  key={t.to}
                  to={t.to}
                  params={{ code }}
                  className={`${base} ${
                    t.isActive
                      ? "text-ink-950 border-t-2 border-ink-950 -mt-px"
                      : "text-ink-500 hover:text-ink-950"
                  }`}
                >
                  <Icon size={18} strokeWidth={1.75} />
                  <span>{t.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
