import { Suspense, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(collapseKey, collapsed ? "1" : "0");
  }, [collapsed, collapseKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(tabKey, tab);
  }, [tab, tabKey]);

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
        <Link
          to="/admin/countries/$code/data"
          params={{ code }}
          search={{ tab }}
          className="shrink-0 px-3 py-1.5 text-[11px] font-mono uppercase tracking-[0.2em] border border-line-200 text-ink-500 hover:text-ink-950"
        >
          Open full view →
        </Link>
      </header>

      {!collapsed && (
        <>
          <nav className="flex flex-wrap gap-1 border-b border-line-200 px-6">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`px-4 py-2 text-[11px] font-mono uppercase tracking-[0.2em] border-b-2 -mb-px ${
                  tab === t.key
                    ? "border-ink-950 text-ink-950"
                    : "border-transparent text-ink-500 hover:text-ink-950"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
          <div className="p-6">
            <Suspense
              fallback={
                <div className="py-12 text-center text-xs font-mono uppercase tracking-[0.2em] text-ink-500">
                  Loading {tab}…
                </div>
              }
            >
              {tab === "sources" && <SourcesTab code={code} />}
              {tab === "kpis" && <KpisTab code={code} />}
              {tab === "dossiers" && <DossiersTab code={code} />}
              {tab === "ministries" && <MinistriesTab code={code} />}
              {tab === "corpus" && (
                <CorpusTab code={code} onGoToSources={() => setTab("sources")} />
              )}
              {tab === "memory" && <MemoryTab code={code} />}
              {tab === "viz" && <GdpVizStudio code={code} />}
            </Suspense>
          </div>
        </>
      )}
    </section>
  );
}
