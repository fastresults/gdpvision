import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  Mail,
  Phone,
  Globe,
  Twitter,
  Linkedin,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

import { getPortfolio } from "@/lib/scenarios.functions";
import { listMinistryProfiles } from "@/lib/country-data/manage.functions";
import { getVizOverview } from "@/lib/country-viz/viz.functions";
import { CANONICAL_SECTORS } from "@/lib/caricom-registry";

// Delivery-track thresholds (variance vs target, respecting direction).
const ON_TRACK_PCT = 5;
const NEAR_TRACK_PCT = 15;

function portfolioQuery(code: string, slug: string) {
  return queryOptions({
    queryKey: ["portfolio", code, slug],
    queryFn: () => getPortfolio({ data: { countryCode: code, slug } }),
  });
}
function profilesQuery(code: string) {
  return queryOptions({
    queryKey: ["portfolio-minister-profiles", code],
    queryFn: () => listMinistryProfiles({ data: { countryCode: code } }),
  });
}
function vizQuery(code: string) {
  return queryOptions({
    queryKey: ["viz-overview", code],
    queryFn: () => getVizOverview({ data: { countryCode: code } }),
  });
}

export const Route = createFileRoute("/_authenticated/admin/countries/$code/portfolio/$ministry")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.ministry} · Portfolio · ${params.code} — GDPVision` },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: async ({ context, params }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(portfolioQuery(params.code, params.ministry)),
      context.queryClient.ensureQueryData(profilesQuery(params.code)),
      context.queryClient.ensureQueryData(vizQuery(params.code)),
    ]);
  },
  errorComponent: ({ error }) => (
    <div className="px-8 py-16 text-sm text-red-600">{error.message}</div>
  ),
  notFoundComponent: () => (
    <div className="px-8 py-16 text-sm text-ink-500">Portfolio not found.</div>
  ),
  component: PortfolioDetail,
});

type MinisterProfile = {
  name?: string | null;
  title?: string | null;
  party?: string | null;
  appointed_at?: string | null;
  bio?: string | null;
  portrait_url?: string | null;
  contact?: {
    email?: string | null;
    office_phone?: string | null;
    website?: string | null;
    office_address?: string | null;
  };
  socials?: { twitter?: string | null; linkedin?: string | null };
};

type Programme = { name?: string; objective?: string; status?: string };
type Citation = { title?: string; url?: string; domain?: string };

type TrackStatus = "on" | "near" | "off" | "no-target";

function classifyTrack(
  latest: number | null | undefined,
  target: number | null | undefined,
  direction?: string | null,
): TrackStatus {
  if (latest == null || target == null || target === 0) return "no-target";
  const dir = (direction ?? "higher").toLowerCase();
  const raw = ((latest - target) / Math.abs(target)) * 100;
  // For "higher is better", positive variance is good. For "lower", flip sign.
  const signed = dir.startsWith("lower") ? -raw : raw;
  const absv = Math.abs(signed);
  if (signed >= 0 || absv <= ON_TRACK_PCT) return "on";
  if (absv <= NEAR_TRACK_PCT) return "near";
  return "off";
}

const TRACK_META: Record<TrackStatus, { label: string; cls: string; dot: string }> = {
  on: { label: "On track", cls: "text-emerald-700 border-emerald-300 bg-emerald-50", dot: "bg-emerald-500" },
  near: { label: "At risk", cls: "text-amber-700 border-amber-300 bg-amber-50", dot: "bg-amber-500" },
  off: { label: "Off track", cls: "text-red-700 border-red-300 bg-red-50", dot: "bg-red-500" },
  "no-target": { label: "No target", cls: "text-ink-500 border-line-200 bg-paper-100", dot: "bg-ink-500/40" },
};

function TrackPill({ status }: { status: TrackStatus }) {
  const m = TRACK_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${m.cls}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

function ScorecardTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="border border-line-200 bg-paper-0 p-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">{label}</p>
      <p className="mt-2 font-serif text-3xl tabular-nums text-ink-950">{value}</p>
      {hint && <p className="mt-1 text-[11px] text-ink-500">{hint}</p>}
    </div>
  );
}

// Render a text with [N] markers, turning refs into anchors when citations exist.
function CitedText({ text, citations }: { text: string; citations: Citation[] }) {
  const parts = text.split(/(\[\d+\])/g);
  return (
    <>
      {parts.map((p, i) => {
        const m = p.match(/^\[(\d+)\]$/);
        if (!m) return <span key={i}>{p}</span>;
        const n = Number(m[1]);
        const c = citations[n - 1];
        if (!c?.url) return <sup key={i} className="text-ink-500">[{n}]</sup>;
        return (
          <a
            key={i}
            href={c.url}
            target="_blank"
            rel="noreferrer"
            title={c.title ?? c.url}
            className="align-super text-[10px] text-ink-700 underline underline-offset-2 hover:text-ink-950"
          >
            [{n}]
          </a>
        );
      })}
    </>
  );
}

function PortfolioDetail() {
  const { code, ministry } = Route.useParams();
  const { data } = useSuspenseQuery(portfolioQuery(code, ministry));
  const { data: profiles } = useSuspenseQuery(profilesQuery(code));
  const { data: viz } = useSuspenseQuery(vizQuery(code));

  const profileRow = profiles.find((p) => p.ministry_slug === ministry) as
    | (Record<string, unknown> & {
        minister_profile?: MinisterProfile;
        mandate?: string | null;
        programmes?: Programme[] | null;
        citations?: Citation[] | null;
      })
    | undefined;

  const minister = (profileRow?.minister_profile ?? {}) as MinisterProfile;
  const mandate = (profileRow?.mandate ?? "").trim();
  const programmes = Array.isArray(profileRow?.programmes) ? (profileRow!.programmes as Programme[]) : [];
  const citations = Array.isArray(profileRow?.citations) ? (profileRow!.citations as Citation[]) : [];

  const sectorCodes = new Set(data.ministry.sectors.map((s) => s.sector_code));
  const scopedSeries = viz.sectorKpiSeries.filter((s) => sectorCodes.has(s.sector_code));
  const kpiIndex = new Map(viz.allKpis.map((k) => [k.kpi_code, k]));

  // Delivery rows for the KPI performance panel.
  const kpiRows = useMemo(() => {
    return scopedSeries.map((s) => {
      const meta = kpiIndex.get(s.kpi_code);
      const track = classifyTrack(s.latest, s.target, meta?.direction);
      const variance =
        s.latest != null && s.target != null && s.target !== 0
          ? ((s.latest - s.target) / Math.abs(s.target)) * 100
          : null;
      const lastPeriod = s.points.at(-1)?.period ?? meta?.latest_period ?? null;
      return {
        sector_code: s.sector_code,
        kpi_code: s.kpi_code,
        label: s.label,
        unit: s.unit,
        latest: s.latest,
        target: s.target,
        direction: meta?.direction ?? "higher",
        provenance: meta?.provenance ?? null,
        freshness: meta?.freshness_status ?? null,
        lastPeriod,
        variance,
        track,
      };
    }).sort((a, b) => {
      // Off/near float to top.
      const order: Record<TrackStatus, number> = { off: 0, near: 1, "no-target": 2, on: 3 };
      if (order[a.track] !== order[b.track]) return order[a.track] - order[b.track];
      return Math.abs(b.variance ?? 0) - Math.abs(a.variance ?? 0);
    });
  }, [scopedSeries, kpiIndex]);

  // Aggregate for scorecard.
  const trackCounts = { on: 0, near: 0, off: 0, "no-target": 0 } as Record<TrackStatus, number>;
  kpiRows.forEach((r) => trackCounts[r.track]++);
  const kpiTotal = kpiRows.length;
  const withCitedSource = kpiRows.filter(
    (r) => r.provenance && r.provenance !== "unknown" && r.provenance !== "",
  ).length;
  const evidenceCoverage = kpiTotal > 0 ? Math.round((withCitedSource / kpiTotal) * 100) : 0;
  const gdpShareTotal = data.composition.reduce((sum, c) => sum + c.share_pct, 0);

  // Per-sector track pill: worst status across sector's KPIs.
  const sectorTrack = new Map<string, TrackStatus>();
  for (const r of kpiRows) {
    const cur = sectorTrack.get(r.sector_code);
    const rank: Record<TrackStatus, number> = { off: 0, near: 1, "no-target": 2, on: 3 };
    if (!cur || rank[r.track] < rank[cur]) sectorTrack.set(r.sector_code, r.track);
  }

  const [evidenceOpen, setEvidenceOpen] = useState(false);

  return (
    <div className="px-8 py-10">
      <div className="flex items-baseline justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">
            {code} · Delivery dossier
          </p>
          <h2 className="mt-1 font-serif text-3xl text-ink-950">{data.ministry.name}</h2>
        </div>
        <Link
          to="/admin/countries/$code/data"
          params={{ code }}
          search={{ tab: "ministries" }}
          className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500 hover:text-ink-950"
        >
          Edit in Data Stores →
        </Link>
      </div>

      {/* Minister & mandate header */}
      <section className="mt-8 grid grid-cols-1 gap-6 border border-line-200 bg-paper-0 p-6 md:grid-cols-[120px_1fr]">
        <div>
          {minister.portrait_url ? (
            <img
              src={minister.portrait_url}
              alt={minister.name ?? "Minister portrait"}
              className="h-28 w-28 border border-line-200 object-cover"
            />
          ) : (
            <div className="grid h-28 w-28 place-items-center border border-line-200 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
              No portrait
            </div>
          )}
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">
            Minister {minister.appointed_at ? `· Appointed ${minister.appointed_at}` : ""}
          </p>
          <p className="mt-1 font-serif text-xl text-ink-950">
            {minister.name ?? "Not on record"}
          </p>
          {(minister.title || minister.party) && (
            <p className="mt-1 text-xs text-ink-500">
              {[minister.title, minister.party].filter(Boolean).join(" · ")}
            </p>
          )}
          {mandate && (
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-ink-800">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
                Mandate ·{" "}
              </span>
              <CitedText text={mandate} citations={citations} />
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-4 font-mono text-[11px] text-ink-500">
            {minister.contact?.email && (
              <a href={`mailto:${minister.contact.email}`} className="inline-flex items-center gap-1 hover:text-ink-950">
                <Mail size={12} /> {minister.contact.email}
              </a>
            )}
            {minister.contact?.office_phone && (
              <span className="inline-flex items-center gap-1">
                <Phone size={12} /> {minister.contact.office_phone}
              </span>
            )}
            {minister.contact?.website && (
              <a href={minister.contact.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-ink-950">
                <Globe size={12} /> Website
              </a>
            )}
            {minister.socials?.twitter && (
              <a href={minister.socials.twitter} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-ink-950">
                <Twitter size={12} /> Twitter
              </a>
            )}
            {minister.socials?.linkedin && (
              <a href={minister.socials.linkedin} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-ink-950">
                <Linkedin size={12} /> LinkedIn
              </a>
            )}
          </div>
        </div>
      </section>

      {/* Portfolio scorecard */}
      <section className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
        <ScorecardTile
          label="GDP owned"
          value={`${gdpShareTotal.toFixed(1)}%`}
          hint={`${data.ministry.sectors.length} sector${data.ministry.sectors.length === 1 ? "" : "s"}`}
        />
        <ScorecardTile
          label="KPIs tracked"
          value={String(kpiTotal)}
          hint={kpiTotal ? `${withCitedSource} with cited source` : "None mapped yet"}
        />
        <ScorecardTile
          label="Delivery"
          value={
            kpiTotal
              ? `${trackCounts.on}/${trackCounts.near}/${trackCounts.off}`
              : "—"
          }
          hint="On · At risk · Off"
        />
        <ScorecardTile
          label="Evidence coverage"
          value={kpiTotal ? `${evidenceCoverage}%` : "—"}
          hint="Share of KPIs with a source"
        />
      </section>

      {/* Sectors table */}
      <section className="mt-12">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">
          Sectors in this portfolio ({data.ministry.sectors.length})
        </h3>
        {data.ministry.sectors.length === 0 ? (
          <p className="mt-4 text-sm text-ink-500">No sectors mapped to this ministry yet.</p>
        ) : (
          <table className="mt-4 w-full text-sm" data-numeric>
            <thead>
              <tr className="border-b border-line-200 text-left text-xs uppercase tracking-widest text-ink-500">
                <th className="py-2 font-normal">Sector</th>
                <th className="py-2 font-normal">Delivery</th>
                <th className="py-2 text-right font-normal">GDP share</th>
                <th className="py-2 text-right font-normal">Weight</th>
                <th className="py-2 text-right font-normal">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {data.ministry.sectors.map((s) => {
                const meta = CANONICAL_SECTORS.find((c) => c.slug === s.sector_code);
                const comp = data.composition.find((c) => c.sector_code === s.sector_code);
                const track = sectorTrack.get(s.sector_code) ?? "no-target";
                return (
                  <tr key={s.sector_code} className="border-b border-line-200/60">
                    <td className="py-3">
                      <span
                        className="mr-3 inline-block h-3 w-1 align-middle"
                        style={{ backgroundColor: `var(${meta?.cssVar ?? "--ink-500"})` }}
                      />
                      {meta?.label ?? s.sector_code}
                    </td>
                    <td className="py-3"><TrackPill status={track} /></td>
                    <td className="py-3 text-right font-mono">
                      {comp ? `${comp.share_pct.toFixed(1)}%` : "—"}
                    </td>
                    <td className="py-3 text-right font-mono text-ink-500">
                      {s.weight.toFixed(0)}
                    </td>
                    <td className="py-3 text-right font-mono text-ink-500">
                      {comp?.confidence_grade ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* KPI delivery panel */}
      {kpiRows.length > 0 && (
        <section className="mt-12">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">
            KPI performance ({kpiRows.length})
          </h3>
          <p className="mt-1 text-xs text-ink-500">Sorted by delivery risk. Off- and at-risk KPIs float to the top.</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm" data-numeric>
              <thead>
                <tr className="border-b border-line-200 text-left text-xs uppercase tracking-widest text-ink-500">
                  <th className="py-2 font-normal">KPI</th>
                  <th className="py-2 font-normal">Status</th>
                  <th className="py-2 text-right font-normal">Latest</th>
                  <th className="py-2 text-right font-normal">Target</th>
                  <th className="py-2 text-right font-normal">Variance</th>
                  <th className="py-2 font-normal">As of</th>
                  <th className="py-2 font-normal">Source</th>
                </tr>
              </thead>
              <tbody>
                {kpiRows.map((r) => (
                  <tr key={`${r.sector_code}-${r.kpi_code}`} className="border-b border-line-200/60">
                    <td className="py-3">
                      <p className="text-ink-950">{r.label}</p>
                      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-500">
                        {r.sector_code} · {r.kpi_code}
                      </p>
                    </td>
                    <td className="py-3"><TrackPill status={r.track} /></td>
                    <td className="py-3 text-right font-mono tabular-nums">
                      {r.latest != null ? `${r.latest.toFixed(2)}${r.unit ? " " + r.unit : ""}` : "—"}
                    </td>
                    <td className="py-3 text-right font-mono tabular-nums text-ink-500">
                      {r.target != null ? r.target.toFixed(2) : "—"}
                    </td>
                    <td className="py-3 text-right font-mono tabular-nums">
                      {r.variance != null ? `${r.variance > 0 ? "+" : ""}${r.variance.toFixed(1)}%` : "—"}
                    </td>
                    <td className="py-3 font-mono text-[11px] text-ink-500">{r.lastPeriod ?? "—"}</td>
                    <td className="py-3 font-mono text-[11px] text-ink-500">
                      {r.provenance ? r.provenance : <span className="text-red-600">missing</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Programmes & commitments */}
      {programmes.length > 0 && (
        <section className="mt-12">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">
            Programmes &amp; commitments ({programmes.length})
          </h3>
          <ul className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {programmes.map((p, i) => (
              <li key={i} className="border border-line-200 bg-paper-0 p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-serif text-base text-ink-950">{p.name ?? "Untitled programme"}</p>
                  {p.status && (
                    <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
                      {p.status}
                    </span>
                  )}
                </div>
                {p.objective && (
                  <p className="mt-2 text-sm leading-relaxed text-ink-700">
                    <CitedText text={p.objective} citations={citations} />
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Evidence rail */}
      {citations.length > 0 && (
        <section className="mt-12 border-t border-line-200 pt-6">
          <button
            onClick={() => setEvidenceOpen((v) => !v)}
            className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500 hover:text-ink-950"
          >
            {evidenceOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            Evidence rail ({citations.length} sources)
          </button>
          {evidenceOpen && (
            <ol className="mt-4 grid grid-cols-1 gap-x-8 gap-y-2 text-sm md:grid-cols-2">
              {citations.map((c, i) => (
                <li key={i} className="flex gap-2 text-ink-700">
                  <span className="font-mono text-[10px] text-ink-500">[{i + 1}]</span>
                  {c.url ? (
                    <a href={c.url} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ink-950">
                      {c.title ?? c.url}
                    </a>
                  ) : (
                    <span>{c.title ?? "(no title)"}</span>
                  )}
                  {c.domain && <span className="ml-auto font-mono text-[10px] text-ink-500">{c.domain}</span>}
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      {/* Chamber 03 cross-link — a single, quiet handoff. */}
      <section className="mt-16 flex items-center justify-between border-t border-line-200 pt-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">
            Want to test a change?
          </p>
          <p className="mt-1 text-sm text-ink-700">
            Chamber 02 is the record of what <em>is</em>. Model what <em>could be</em> in the Scenario Engine.
          </p>
        </div>
        <Link
          to="/admin/countries/$code/scenarios/new"
          params={{ code }}
          search={{ ministry: data.ministry.slug }}
          className="inline-flex items-center gap-1.5 border border-ink-950 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-950 hover:bg-ink-950 hover:text-paper-0"
        >
          Model a change to this portfolio <ArrowUpRight size={12} />
        </Link>
      </section>
    </div>
  );
}
