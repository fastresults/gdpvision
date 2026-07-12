import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import {
  commitGdp,
  commitMinistries,
  commitMinistrySectorMap,
  commitProfile,
  commitSectorComposition,
  getOnboardingStatus,
  runGdpAgent,
  runMinistriesAgent,
  runMinistrySectorMapAgent,
  runProfileAgent,
  runSectorCompositionAgent,
} from "@/lib/country-onboarding/agents.functions";

type Stage = "profile" | "gdp" | "sector_composition" | "ministries" | "ministry_sector_map";

const STAGES: Array<{ key: Stage; label: string; desc: string }> = [
  { key: "profile", label: "1. Profile", desc: "Currency, fiscal year, population, head of government." },
  { key: "gdp", label: "2. GDP", desc: "Nominal GDP USD (cross-checked between WB and IMF)." },
  { key: "sector_composition", label: "3. Sectors", desc: "Share_pct per sector; sums ≈ 100%." },
  { key: "ministries", label: "4. Ministries", desc: "Canonical cabinet ministries with mandate." },
  { key: "ministry_sector_map", label: "5. Ministry×Sector", desc: "Weight matrix from portfolios to sectors." },
];

const statusQuery = (code: string) =>
  queryOptions({
    queryKey: ["onboarding", "status", code],
    queryFn: () => getOnboardingStatus({ data: { countryCode: code } }),
  });

export const Route = createFileRoute("/_authenticated/admin/countries/$code/onboard")({
  head: ({ params }) => ({
    meta: [
      { title: `Onboard ${params.code} — GDPVision` },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(statusQuery(params.code)),
  component: OnboardWizard,
});

function OnboardWizard() {
  const { code } = Route.useParams();
  const { data } = useSuspenseQuery(statusQuery(code));
  const qc = useQueryClient();

  const runners: Record<Stage, any> = {
    profile: useServerFn(runProfileAgent),
    gdp: useServerFn(runGdpAgent),
    sector_composition: useServerFn(runSectorCompositionAgent),
    ministries: useServerFn(runMinistriesAgent),
    ministry_sector_map: useServerFn(runMinistrySectorMapAgent),
  };
  const committers: Record<Stage, any> = {
    profile: useServerFn(commitProfile),
    gdp: useServerFn(commitGdp),
    sector_composition: useServerFn(commitSectorComposition),
    ministries: useServerFn(commitMinistries),
    ministry_sector_map: useServerFn(commitMinistrySectorMap),
  };

  const refresh = () => qc.invalidateQueries({ queryKey: ["onboarding", "status", code] });

  const drafts: any[] = (data as any).drafts ?? [];
  const runs: any[] = (data as any).runs ?? [];
  const country: any = (data as any).country;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 space-y-6">
      <header className="space-y-2">
        <Link to="/_authenticated/admin/countries" className="text-xs text-muted-foreground hover:underline">
          ← All countries
        </Link>
        <h1 className="text-2xl font-semibold">{country?.name}</h1>
        <p className="text-sm text-muted-foreground">
          {country?.iso3 ?? country?.code} · {country?.currency} · fiscal year starts month {country?.fiscal_year_start_month}
          {country?.gdp_current_usd
            ? ` · GDP $${(Number(country.gdp_current_usd) / 1e9).toFixed(2)}B (${country.gdp_year})`
            : ""}
        </p>
      </header>

      {STAGES.map((s) => {
        const draft = drafts.find((d) => d.stage === s.key);
        const lastRun = runs.find((r) => r.stage === s.key);
        return (
          <StageCard
            key={s.key}
            stage={s}
            countryName={country?.name ?? code}
            draft={draft}
            lastRun={lastRun}
            onRun={async () => {
              try {
                await runners[s.key]({ data: { countryCode: code } });
              } catch (e: any) {
                alert(`Agent failed: ${e?.message ?? e}`);
              } finally {
                refresh();
              }
            }}
            onCommit={async (editedPayload) => {
              try {
                await committers[s.key]({ data: { draftId: draft.id, editedPayload } });
              } catch (e: any) {
                alert(`Commit failed: ${e?.message ?? e}`);
              } finally {
                refresh();
              }
            }}
          />
        );
      })}
    </div>
  );
}

function StageCard({
  stage,
  countryName,
  draft,
  lastRun,
  onRun,
  onCommit,
}: {
  stage: { key: Stage; label: string; desc: string };
  countryName: string;
  draft: any;
  lastRun: any;
  onRun: () => Promise<void>;
  onCommit: (editedPayload: unknown) => Promise<void>;
}) {
  const [running, setRunning] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [edited, setEdited] = useState<string>("");

  const committed = lastRun?.status === "committed";
  const payload = draft?.payload;
  const citations: any[] = draft?.citations ?? [];

  return (
    <section className="rounded-lg border border-border p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            {stage.label}
            {committed && <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-600">committed</span>}
            {draft && !committed && <span className="text-xs px-2 py-0.5 rounded bg-amber-500/15 text-amber-600">review</span>}
          </h2>
          <p className="text-xs text-muted-foreground mt-1">{stage.desc}</p>
        </div>
        <button
          type="button"
          className="text-sm px-3 py-1.5 rounded bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
          disabled={running}
          onClick={async () => {
            setRunning(true);
            await onRun();
            setRunning(false);
          }}
        >
          {running ? "Researching…" : draft ? "Re-run agent" : "Run AI research"}
        </button>
      </div>

      {lastRun && (
        <div className="text-xs text-muted-foreground">
          Last run: {new Date(lastRun.started_at).toLocaleString()} · status {lastRun.status}
          {lastRun.error && <span className="text-destructive"> — {lastRun.error}</span>}
        </div>
      )}

      {draft && (
        <>
          <div className="rounded border border-border bg-muted/20 p-3">
            <div className="text-xs text-muted-foreground mb-2">
              Draft payload (edit JSON below to override before commit) · confidence {draft.confidence}
            </div>
            <textarea
              className="w-full font-mono text-xs bg-background border border-border rounded p-2 min-h-[180px]"
              defaultValue={JSON.stringify(payload, null, 2)}
              onChange={(e) => setEdited(e.target.value)}
            />
          </div>

          <div>
            <div className="text-xs font-medium mb-1">Citations ({citations.length})</div>
            {citations.length === 0 ? (
              <div className="text-xs text-destructive">⚠ No citations — cannot commit.</div>
            ) : (
              <ul className="text-xs space-y-1">
                {citations.map((c) => (
                  <li key={c.id}>
                    <a href={c.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                      {c.domain || c.url}
                    </a>
                    {c.title && <span className="text-muted-foreground"> — {c.title}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {!committed && (
            <button
              type="button"
              className="text-sm px-3 py-1.5 rounded border border-emerald-500 text-emerald-600 hover:bg-emerald-500/10 disabled:opacity-50"
              disabled={committing || citations.length === 0}
              onClick={async () => {
                setCommitting(true);
                let parsed: unknown = undefined;
                if (edited) {
                  try {
                    parsed = JSON.parse(edited);
                  } catch {
                    alert("Edited JSON is invalid — commit aborted");
                    setCommitting(false);
                    return;
                  }
                }
                await onCommit(parsed);
                setCommitting(false);
              }}
            >
              {committing ? "Committing…" : `Commit to ${draft.target_table}`}
            </button>
          )}
        </>
      )}

      {!draft && !running && (
        <div className="text-xs text-muted-foreground">
          No draft yet. Click "Run AI research" to have the agent research {countryName} and produce a cited draft.
        </div>
      )}
    </section>
  );
}
