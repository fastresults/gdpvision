// Overview: the four indexes at a glance, what needs doing next, and run controls.

import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { clearTestReleases, runIndicesNow } from "@/lib/indices/indices.functions";
import type { IndicesOverview } from "@/lib/indices/review.functions";
import { SextantRadar } from "./SextantRadar";
import {
  Eyebrow,
  Section,
  Stat,
  Tag,
  daysAgo,
  releaseTone,
  runStatusTone,
  when,
} from "./shared";

export type Goto = (
  tab: "overview" | "runs" | "evidence" | "method",
  opts?: { run?: string; licence?: boolean },
) => void;

interface Action {
  key: string;
  tone: "bad" | "warn" | "quiet";
  text: string;
  cta: string;
  go: () => void;
}

export function nextActions(o: IndicesOverview, goto: Goto): Action[] {
  const out: Action[] = [];
  const latest = o.runs.find((r) => r.mode !== "test");
  const lastComplete = o.runs.find((r) => r.status === "complete" && r.mode !== "test");
  const lastWatch = o.runs.find((r) => r.status === "complete" && r.mode === "watch");

  if (latest?.status === "failed")
    out.push({
      key: "failed",
      tone: "bad",
      text: `The latest run failed: ${latest.error ?? "no error recorded"}.`,
      cta: "Open run",
      go: () => goto("runs", { run: latest.id }),
    });
  const draftEd = o.runs.find(
    (r) =>
      r.release?.kind === "edition" &&
      r.release.status !== "published" &&
      r.release.status !== "withdrawn",
  );
  if (draftEd)
    out.push({
      key: "edition",
      tone: "warn",
      text: `${draftEd.release!.label} is drafted and waiting for review and sign-off.`,
      cta: "Review edition",
      go: () => goto("runs", { run: draftEd.id }),
    });
  if (o.evidence.unverified)
    out.push({
      key: "evidence",
      tone: "warn",
      text: `${o.evidence.unverified} evidence entr${o.evidence.unverified === 1 ? "y needs" : "ies need"} a second person to verify before they can feed a run.`,
      cta: "Verify evidence",
      go: () => goto("evidence"),
    });
  const failed = lastComplete?.stats?.sources?.failed ?? [];
  if (failed.length)
    out.push({
      key: "sources",
      tone: "warn",
      text: `${failed.length} source${failed.length === 1 ? "" : "s"} did not answer in the last run (${failed
        .slice(0, 3)
        .map((f) => f.indicator)
        .join(", ")}${failed.length > 3 ? "…" : ""}).`,
      cta: "See run",
      go: () => goto("runs", { run: lastComplete!.id }),
    });
  const watchAge = daysAgo(lastWatch?.started_at);
  if (watchAge == null || watchAge > 8)
    out.push({
      key: "watch",
      tone: "quiet",
      text:
        watchAge == null
          ? "No watch run yet. A watch run pulls every source and scores privately; nothing is published."
          : `The last watch run was ${watchAge} days ago; the weekly schedule may have stopped.`,
      cta: "See runs",
      go: () => goto("runs"),
    });
  const unlicensed = o.indicators.filter(
    (i) => i.status === "active" && i.licence_status !== "confirmed",
  );
  if (unlicensed.length)
    out.push({
      key: "licence",
      tone: "warn",
      text: `${unlicensed.length} active indicator${unlicensed.length === 1 ? " uses" : "s use"} a licence still to confirm. An edition cannot be published while any of them feeds it.`,
      cta: "Review licences",
      go: () => goto("method", { licence: true }),
    });
  const drafts = o.specs.filter((s) => s.method_status !== "frozen");
  if (drafts.length)
    out.push({
      key: "method",
      tone: "quiet",
      text: `The method is still a draft for ${drafts.map((d) => d.code).join(", ")}. It is frozen by migration after the methodology panel ratifies the goalposts.`,
      cta: "View method",
      go: () => goto("method"),
    });
  return out;
}

export function OverviewTab({ o, goto }: { o: IndicesOverview; goto: Goto }) {
  const actions = nextActions(o, goto);
  const lastComplete = o.runs.find((r) => r.status === "complete" && r.mode !== "test");

  return (
    <>
      <Section title="What needs doing">
        {actions.length === 0 ? (
          <p className="text-sm text-ink-700">
            Nothing outstanding. Sources answered, evidence is verified and no edition is waiting.
          </p>
        ) : (
          <ol className="space-y-2">
            {actions.map((a) => (
              <li
                key={a.key}
                className="flex flex-wrap items-center justify-between gap-3 border-l-2 border-line-200 py-1 pl-3"
              >
                <span className="flex items-baseline gap-2 text-sm text-ink-950">
                  <Tag tone={a.tone}>
                    {a.tone === "bad" ? "Fix" : a.tone === "warn" ? "Do" : "Note"}
                  </Tag>
                  {a.text}
                </span>
                <button type="button" className="btn-ghost" onClick={a.go}>
                  {a.cta} →
                </button>
              </li>
            ))}
          </ol>
        )}
      </Section>

      <Section
        title="The four indexes"
        aside={
          lastComplete && (
            <Eyebrow>
              Latest complete run · {lastComplete.mode} · cut-off {lastComplete.data_cutoff}
            </Eyebrow>
          )
        }
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {o.specs.map((s, idx) => {
            const inds = o.indicators.filter((i) => i.index_code === s.code);
            const active = inds.filter((i) => i.status === "active").length;
            const pending = inds.length - active;
            const st = lastComplete?.stats?.indexes?.[s.code];
            return (
              <div key={s.code} className="border border-line-200 p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <Eyebrow>{s.code}</Eyebrow>
                  <Tag tone={s.method_status === "frozen" ? "good" : "warn"}>
                    v{s.method_version} {s.method_status}
                  </Tag>
                </div>
                <h3 className="mt-1 font-serif text-lg leading-tight">{s.name}</h3>
                <p className="mt-1 text-xs text-ink-500">{s.question}</p>
                <div className="mt-4">
                  <SextantRadar
                    score={st?.median_sextant ?? null}
                    parts={st?.median_sextant != null ? (o.sextantParts?.[s.code] ?? null) : null}
                    delay={idx * 700}
                  />
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-2">
                  <Stat
                    label="States scored"
                    value={st ? `${st.scored} of ${st.scored + st.not_scored}` : "—"}
                    sub={
                      st
                        ? st.scored === 0
                          ? "none yet — not a score of 0"
                          : `${st.not_scored} not scored yet`
                        : undefined
                    }
                  />
                  <Stat
                    label="Indicators"
                    value={active}
                    sub={pending ? `${pending} pending` : "all live"}
                  />
                </dl>
                <PillarBlockers o={o} indexCode={s.code} goto={goto} />
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Run now">
        <RunControls o={o} />
      </Section>

      <Section
        title="Recent runs"
        aside={
          <button type="button" className="btn-ghost" onClick={() => goto("runs")}>
            All runs →
          </button>
        }
      >
        <RunList runs={o.runs.slice(0, 5)} onOpen={(id) => goto("runs", { run: id })} />
      </Section>
    </>
  );
}

const MODES = [
  [
    "watch",
    "Watch run",
    "Pulls every source and scores privately. Nothing is drafted or published.",
  ],
  [
    "tracker",
    "Tracker",
    "Drafts a provisional monthly tracker. Trackers stay private to governments.",
  ],
  [
    "edition",
    "Draft an edition",
    "Drafts an official edition for review, sign-off and publication.",
  ],
  [
    "test",
    "Test run",
    "TEST DATA: fills every gap with labelled test values so all four indexes can be reviewed on GDP Advisor's preview. Never published; deleted after 14 days.",
  ],
] as const;

function RunControls({ o }: { o: IndicesOverview }) {
  const qc = useQueryClient();
  const run = useServerFn(runIndicesNow);
  const [busy, setBusy] = useState<string | null>(null);
  const running = o.runs.some((r) => r.status === "running");

  if (!o.me.isAdmin)
    return (
      <p className="text-sm text-ink-500">
        Only admins can start runs. Watch runs happen every Monday and trackers on the 2nd of each
        month.
      </p>
    );

  async function go(mode: (typeof MODES)[number][0]) {
    if (
      mode === "edition" &&
      !window.confirm(
        "Draft an official edition from today's data? It will not be published until someone signs it off.",
      )
    )
      return;
    setBusy(mode);
    const t = toast.loading("Running — this pulls every source and can take a few minutes…");
    try {
      const r = await run({ data: { mode } });
      toast.success(
        `Run complete · ${r.sources.ok} sources answered${r.sources.failed.length ? `, ${r.sources.failed.length} failed` : ""}`,
        { id: t },
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Run failed", { id: t });
    } finally {
      setBusy(null);
      await qc.invalidateQueries({ queryKey: ["indices-overview"] });
    }
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {MODES.map(([mode, label, help]) => (
        <div key={mode} className="border border-line-200 p-4">
          <button
            type="button"
            className={mode === "edition" ? "btn-primary" : "btn-secondary"}
            disabled={busy !== null || running}
            onClick={() => go(mode)}
          >
            {busy === mode ? "Running…" : label}
          </button>
          <p className="mt-2 text-xs text-ink-500">{help}</p>
        </div>
      ))}
      {o.runs.some((r) => r.release?.kind === "test") && <ClearTest />}
      {running && (
        <p className="text-xs text-ink-500 md:col-span-2 xl:col-span-4">
          A run is in progress. Wait for it to finish before starting another.
        </p>
      )}
    </div>
  );
}

function ClearTest() {
  const qc = useQueryClient();
  const clear = useServerFn(clearTestReleases);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-3 border-l-2 border-line-200 pl-3 md:col-span-2 xl:col-span-4">
      <span className="text-xs text-ink-700">
        Test releases are private, never published and delete themselves after 14 days.
      </span>
      <button
        type="button"
        className="btn-ghost"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await clear();
            toast.success(`Cleared ${r.cleared} test release${r.cleared === 1 ? "" : "s"}`);
            await qc.invalidateQueries({ queryKey: ["indices-overview"] });
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Could not clear test releases");
          } finally {
            setBusy(false);
          }
        }}
      >
        Clear test releases now
      </button>
    </div>
  );
}

export function RunList({
  runs,
  onOpen,
  selected,
}: {
  runs: IndicesOverview["runs"];
  onOpen: (id: string) => void;
  selected?: string | null;
}) {
  if (!runs.length) return <p className="text-sm text-ink-500">No runs yet.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" data-numeric>
        <thead>
          <tr className="border-b border-line-200 text-left text-xs uppercase tracking-widest text-ink-500">
            <th className="py-2 font-normal">Started</th>
            <th className="py-2 font-normal">Mode</th>
            <th className="py-2 font-normal">Status</th>
            <th className="py-2 font-normal">Cut-off</th>
            <th className="py-2 text-right font-normal">Sources</th>
            <th className="py-2 font-normal pl-4">Release</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr
              key={r.id}
              className={`border-b border-line-200/60 ${selected === r.id ? "outline outline-1 outline-ink-950" : ""}`}
            >
              <td className="py-2 tabular-nums">{when(r.started_at)}</td>
              <td className="py-2">
                {r.mode}
                <span className="ml-1 text-xs text-ink-500">
                  {r.trigger === "scheduled" ? "· scheduled" : "· manual"}
                </span>
              </td>
              <td className="py-2">
                <Tag tone={runStatusTone(r.status)}>{r.status}</Tag>
              </td>
              <td className="py-2 tabular-nums">{r.data_cutoff}</td>
              <td className="py-2 text-right tabular-nums">
                {r.stats?.sources
                  ? `${r.stats.sources.ok} ok · ${r.stats.sources.failed.length} failed`
                  : "—"}
              </td>
              <td className="py-2 pl-4">
                {r.release ? (
                  <span className="flex items-baseline gap-2">
                    <Tag tone={releaseTone(r.release.status)}>{r.release.status}</Tag>
                    <span className="text-xs">{r.release.label}</span>
                  </span>
                ) : (
                  <span className="text-xs text-ink-500">—</span>
                )}
              </td>
              <td className="py-2 text-right">
                {r.status === "complete" && (
                  <button type="button" className="btn-ghost" onClick={() => onOpen(r.id)}>
                    Review →
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Why an index cannot score yet, pillar by pillar. A pillar needs two-thirds of its
 * live inputs filled; evidence inputs only count once a person has verified them.
 */
function PillarBlockers({ o, indexCode, goto }: { o: IndicesOverview; indexCode: string; goto: Goto }) {
  const n = o.countries.length;
  const cov = new Map(
    o.coverage.map((c) => [`${c.index_code}.${c.indicator_code}`, c]),
  );
  const rows = o.pillars
    .filter((p) => p.index_code === indexCode)
    .map((p) => {
      const inds = o.indicators.filter((i) => i.index_code === indexCode && i.pillar_code === p.code);
      const live = inds.filter((i) => i.status === "active");
      const ev = live.filter((i) => i.source_kind === "evidence");
      const verified = ev.reduce((s, i) => s + (cov.get(`${indexCode}.${i.code}`)?.verified_current ?? 0), 0);
      const toVerify = ev.reduce((s, i) => s + (cov.get(`${indexCode}.${i.code}`)?.unverified ?? 0), 0);
      const need = Math.ceil(live.length * 0.667 - 0.001);
      const apiLive = live.length - ev.length;
      let state: "ok" | "no_source" | "evidence";
      if (!live.length || need > live.length) state = "no_source";
      else if (apiLive >= need) state = "ok";
      else state = verified >= (need - apiLive) * n ? "ok" : "evidence";
      return { p, live: live.length, need, ev: ev.length, verified, toVerify, state };
    });
  const blocked = rows.filter((r) => r.state !== "ok");
  if (!blocked.length) return null;
  return (
    <div className="mt-3 border-t border-line-100 pt-2 text-xs text-ink-700">
      <p className="mb-1 font-medium text-ink-950">What stops states scoring</p>
      <ul className="space-y-1">
        {blocked.map((r) => (
          <li key={r.p.code}>
            <span className="capitalize">{r.p.name ?? r.p.code}</span>:{" "}
            {r.state === "no_source"
              ? "no live source for this pillar yet"
              : `needs ${r.need} of ${r.live} inputs per state; ${r.ev} are documents — ${r.verified} verified, ${r.toVerify} waiting to verify`}
          </li>
        ))}
      </ul>
      {blocked.some((r) => r.state === "evidence") && (
        <button type="button" className="btn-ghost mt-1" onClick={() => goto("evidence")}>
          Verify evidence →
        </button>
      )}
    </div>
  );
}
