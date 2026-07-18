import { Suspense, useEffect, useState, useTransition, type ReactNode } from "react";

import { GdpVizStudio } from "@/components/viz/GdpVizStudio";
import {
  SourcesTab,
  KpisTab,
  DossiersTab,
  MinistriesTab,
  CorpusTab,
  MemoryTab,
} from "@/routes/_authenticated/admin/countries.$code.data";

export type DataTabKey =
  | "sources"
  | "kpis"
  | "dossiers"
  | "ministries"
  | "corpus"
  | "memory"
  | "viz";

const TABS: Array<{ key: DataTabKey; label: string }> = [
  { key: "sources", label: "Sources" },
  { key: "kpis", label: "KPIs" },
  { key: "dossiers", label: "Sector dossiers" },
  { key: "ministries", label: "Ministries" },
  { key: "corpus", label: "Corpus" },
  { key: "memory", label: "Second brain" },
  { key: "viz", label: "GDP Visualizations" },
];

function TabSkeleton({ label }: { label: string }) {
  return (
    <div className="space-y-3" aria-label={`Loading ${label}`}>
      <div className="h-6 w-48 bg-paper-100 animate-pulse" />
      <div className="h-4 w-full bg-paper-100 animate-pulse" />
      <div className="h-4 w-11/12 bg-paper-100 animate-pulse" />
      <div className="h-4 w-10/12 bg-paper-100 animate-pulse" />
      <div className="h-64 w-full bg-paper-100 animate-pulse" />
    </div>
  );
}

function TabPane({
  active,
  label,
  mounted,
  children,
}: {
  active: boolean;
  label: string;
  mounted: boolean;
  children: ReactNode;
}) {
  // Keep mounted tabs in the tree; hide inactive ones with CSS so their
  // state and query cache survive across switches (no unmount = no flash).
  if (!mounted) return null;
  return (
    <div
      role="tabpanel"
      hidden={!active}
      className={active ? "" : "hidden"}
    >
      <Suspense fallback={<TabSkeleton label={label} />}>{children}</Suspense>
    </div>
  );
}

export function DataStoresPanel({
  code,
  countryName,
  initialTab,
}: {
  code: string;
  countryName: string;
  initialTab?: DataTabKey;
}) {
  const collapseKey = `gdpv:onboard:datastores:collapsed:${code}`;
  const tabKey = `gdpv:onboard:datastores:tab:${code}`;

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(collapseKey) === "1";
  });
  const [tab, setTab] = useState<DataTabKey>(() => {
    if (initialTab) return initialTab;
    if (typeof window === "undefined") return "sources";
    const stored = window.localStorage.getItem(tabKey) as DataTabKey | null;
    return stored && TABS.some((t) => t.key === stored) ? stored : "sources";
  });
  const [mounted, setMounted] = useState<Set<DataTabKey>>(() => new Set([tab]));
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(collapseKey, collapsed ? "1" : "0");
  }, [collapsed, collapseKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(tabKey, tab);
  }, [tab, tabKey]);

  function selectTab(next: DataTabKey) {
    if (next === tab) return;
    // Ensure the target is in the mounted set BEFORE we flip `tab`, so its
    // Suspense boundary owns the fallback (not the surrounding page).
    setMounted((prev) => {
      if (prev.has(next)) return prev;
      const copy = new Set(prev);
      copy.add(next);
      return copy;
    });
    startTransition(() => setTab(next));
  }

  // Warm-mount a tab on hover so the first real click has zero perceived
  // latency for tabs the user is about to visit.
  function warmTab(next: DataTabKey) {
    if (mounted.has(next)) return;
    setMounted((prev) => {
      const copy = new Set(prev);
      copy.add(next);
      return copy;
    });
  }

  return (
    <section className="border border-line-200 bg-paper-0">
      <header className="flex items-start justify-between gap-4 p-6 pb-4">
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-expanded={!collapsed}
          className="flex items-start gap-3 text-left min-w-0 flex-1 group"
        >
          <span
            aria-hidden
            className={`mt-2 inline-block text-ink-500 transition-transform ${collapsed ? "" : "rotate-90"}`}
          >
            ›
          </span>
          <div className="min-w-0">
            <h2 className="font-serif text-2xl text-ink-950">
              {countryName} · Data stores
            </h2>
            {collapsed ? (
              <p className="mt-1 text-xs font-mono uppercase tracking-[0.18em] text-ink-500">
                {TABS.length} tabs · click to expand
              </p>
            ) : (
              <p className="mt-1 text-sm text-ink-500">
                Manage the ingested corpus, KPIs, dossiers, ministries, and second-brain
                memory that the AI reads when acting for {countryName}.
              </p>
            )}
          </div>
        </button>
        {/* Opens the standalone data page in a NEW tab so an accidental
            click can't yank the admin off the onboarding page. */}
        <a
          href={`/admin/countries/${code}/data?tab=${tab}`}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 px-3 py-1.5 text-[11px] font-mono uppercase tracking-[0.2em] border border-line-200 text-ink-500 hover:text-ink-950"
        >
          Open full view ↗
        </a>
      </header>

      {!collapsed && (
        <>
          <nav
            role="tablist"
            aria-label="Data stores"
            className="flex flex-wrap gap-1 border-b border-line-200 px-6"
          >
            {TABS.map((t) => {
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onMouseEnter={() => warmTab(t.key)}
                  onFocus={() => warmTab(t.key)}
                  onClick={() => selectTab(t.key)}
                  className={`px-4 py-2 text-[11px] font-mono uppercase tracking-[0.2em] border-b-2 -mb-px transition-colors ${
                    active
                      ? "border-ink-950 text-ink-950"
                      : "border-transparent text-ink-500 hover:text-ink-950"
                  } ${isPending && active ? "opacity-70" : ""}`}
                >
                  {t.label}
                </button>
              );
            })}
          </nav>
          <div className="p-6">
            <TabPane active={tab === "sources"} label="Sources" mounted={mounted.has("sources")}>
              <SourcesTab code={code} />
            </TabPane>
            <TabPane active={tab === "kpis"} label="KPIs" mounted={mounted.has("kpis")}>
              <KpisTab code={code} />
            </TabPane>
            <TabPane active={tab === "dossiers"} label="Sector dossiers" mounted={mounted.has("dossiers")}>
              <DossiersTab code={code} />
            </TabPane>
            <TabPane active={tab === "ministries"} label="Ministries" mounted={mounted.has("ministries")}>
              <MinistriesTab code={code} />
            </TabPane>
            <TabPane active={tab === "corpus"} label="Corpus" mounted={mounted.has("corpus")}>
              <CorpusTab code={code} onGoToSources={() => selectTab("sources")} embedded />
            </TabPane>
            <TabPane active={tab === "memory"} label="Second brain" mounted={mounted.has("memory")}>
              <MemoryTab code={code} embedded />
            </TabPane>
            <TabPane active={tab === "viz"} label="GDP Visualizations" mounted={mounted.has("viz")}>
              <GdpVizStudio code={code} />
            </TabPane>
          </div>
        </>
      )}
    </section>
  );
}
