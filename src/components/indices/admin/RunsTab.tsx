// Runs: pick a run, read its league tables, see what changed since the previous
// run, open any country's frozen inputs, and — for an edition — work through the
// publish checklist and sign it off.

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  getIndexRun,
  publishIndexRelease,
  type IndexInputRow,
  type IndexScoreRow,
} from "@/lib/indices/indices.functions";
import {
  compareIndexRuns,
  getReleaseReadiness,
  type IndicesOverview,
} from "@/lib/indices/review.functions";
import type { InputChange, ScoreChange } from "@/lib/indices/review";
import { RunList } from "./OverviewTab";
import {
  Empty,
  Eyebrow,
  INDEX_CODES,
  Section,
  Tag,
  fmt,
  fieldCls,
  releaseTone,
  sextantTone,
  signed,
  type IndexCode,
  toggleCls,
} from "./shared";

export function RunsTab({
  o,
  runId,
  setRunId,
}: {
  o: IndicesOverview;
  runId: string | null;
  setRunId: (id: string | null) => void;
}) {
  const run = o.runs.find((r) => r.id === runId) ?? null;
  return (
    <>
      <Section title="Runs" aside={<Eyebrow>Last {o.runs.length}</Eyebrow>}>
        <RunList runs={o.runs} onOpen={(id) => setRunId(id)} selected={runId} />
      </Section>
      {run && run.status === "complete" && (
        <RunDetail key={run.id} o={o} run={run} onClose={() => setRunId(null)} />
      )}
      {run && run.status !== "complete" && (
        <Section
          title={`Run of ${run.data_cutoff} · ${run.mode}`}
          aside={
            <button type="button" className="btn-ghost" onClick={() => setRunId(null)}>
              Close ✕
            </button>
          }
        >
          <p className="flex items-baseline gap-2 text-sm">
            <Tag tone={run.status === "failed" ? "bad" : "warn"}>{run.status}</Tag>
            {run.status === "failed"
              ? (run.error ?? "The run failed without recording an error.")
              : "Still running. Scores appear here when it completes."}
          </p>
          {run.status === "failed" && (
            <p className="mt-2 text-xs text-ink-500">
              A failed run writes no release and changes nothing public. Fix the cause, then start a
              new run from the overview.
            </p>
          )}
        </Section>
      )}
      {runId && !run && (
        <Section title="Run">
          <Empty>That run is not among the last {o.runs.length}.</Empty>
        </Section>
      )}
    </>
  );
}

type Run = IndicesOverview["runs"][number];

function RunDetail({ o, run, onClose }: { o: IndicesOverview; run: Run; onClose: () => void }) {
  const getRun = useServerFn(getIndexRun);
  const compare = useServerFn(compareIndexRuns);
  const [index, setIndex] = useState<IndexCode>("CHX");
  const [country, setCountry] = useState<string | null>(null);

  const scoresQ = useQuery({
    queryKey: ["index-run", run.id],
    queryFn: () => getRun({ data: { runId: run.id } }),
  });
  const diffQ = useQuery({
    queryKey: ["index-run-diff", run.id],
    queryFn: () => compare({ data: { runId: run.id } }),
  });

  const names = useMemo(() => new Map(o.countries.map((c) => [c.code, c.name])), [o.countries]);
  const changeBy = useMemo(() => {
    const m = new Map<string, ScoreChange>();
    for (const c of diffQ.data?.diff?.scores ?? []) m.set(`${c.index_code}|${c.country_code}`, c);
    return m;
  }, [diffQ.data]);

  const rows = (scoresQ.data?.scores ?? []).filter((s) => s.index_code === index);
  const scored = rows.filter((r) => r.status === "scored");
  const notScored = rows.filter((r) => r.status !== "scored");
  const spec = o.specs.find((s) => s.code === index);

  return (
    <>
      <Section
        title={`Run of ${run.data_cutoff} · ${run.mode}`}
        aside={
          <button type="button" className="btn-ghost" onClick={onClose}>
            Close ✕
          </button>
        }
      >
        {run.release && <ReleasePanel o={o} release={run.release} />}

        <div className="mt-6 flex flex-wrap gap-2">
          {INDEX_CODES.map((c) => {
            const st = run.stats?.indexes?.[c];
            return (
              <button
                key={c}
                type="button"
                className={toggleCls(index === c)}
                aria-pressed={index === c}
                onClick={() => setIndex(c)}
              >
                {c} {st ? `· ${st.scored} scored` : ""}
              </button>
            );
          })}
        </div>
        {spec && (
          <p className="mt-2 text-sm text-ink-500">
            {spec.name} — {spec.question}
          </p>
        )}

        <WhatChanged q={diffQ} index={index} names={names} />

        <h3 className="mt-8 font-serif text-lg">League table</h3>
        {scoresQ.isLoading && <Empty>Loading scores…</Empty>}
        {scoresQ.error && (
          <p className="text-sm text-red-700">{(scoresQ.error as Error).message}</p>
        )}
        {scoresQ.data && (
          <LeagueTable
            rows={scored}
            names={names}
            changeBy={changeBy}
            index={index}
            onCountry={(c) => setCountry(c === country ? null : c)}
            selected={country}
            pillars={o.pillars.filter((p) => p.index_code === index)}
          />
        )}
        {notScored.length > 0 && (
          <div className="mt-6">
            <Eyebrow>Not scored ({notScored.length}) — shown, never hidden</Eyebrow>
            <ul className="mt-2 space-y-1 text-sm">
              {notScored.map((r) => (
                <li key={r.country_code}>
                  <button
                    type="button"
                    className="hover:underline"
                    onClick={() => setCountry(r.country_code === country ? null : r.country_code)}
                  >
                    {names.get(r.country_code) ?? r.country_code}
                  </button>{" "}
                  <span className="text-xs text-ink-500">
                    — {r.not_scored_reason ?? "below coverage"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      {country && (
        <CountryInputs
          runId={run.id}
          country={country}
          name={names.get(country) ?? country}
          index={index}
          o={o}
          score={rows.find((r) => r.country_code === country) ?? null}
          onClose={() => setCountry(null)}
        />
      )}
    </>
  );
}

function LeagueTable({
  rows,
  names,
  changeBy,
  index,
  onCountry,
  selected,
  pillars,
}: {
  rows: IndexScoreRow[];
  names: Map<string, string>;
  changeBy: Map<string, ScoreChange>;
  index: string;
  onCountry: (c: string) => void;
  selected: string | null;
  pillars: IndicesOverview["pillars"];
}) {
  if (!rows.length) return <Empty>No state is scored on this index in this run.</Empty>;
  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full text-sm" data-numeric>
        <thead>
          <tr className="border-b border-line-200 text-left text-xs uppercase tracking-widest text-ink-500">
            <th className="py-2 font-normal">Rank</th>
            <th className="py-2 font-normal">State</th>
            <th className="py-2 text-right font-normal">Score</th>
            <th className="py-2 text-right font-normal">Since last run</th>
            {pillars.map((p) => (
              <th key={p.code} className="py-2 text-right font-normal">
                {p.name}
              </th>
            ))}
            <th className="py-2 pl-4 font-normal">Sextant</th>
            <th className="py-2 font-normal">Weakest grade</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const ch = changeBy.get(`${index}|${r.country_code}`);
            return (
              <tr
                key={r.country_code}
                className={`cursor-pointer border-b border-line-200/60 ${selected === r.country_code ? "outline outline-1 outline-ink-950" : ""}`}
                onClick={() => onCountry(r.country_code)}
              >
                <td className="py-2 tabular-nums">{r.rank ?? "—"}</td>
                <td className="py-2">
                  {names.get(r.country_code) ?? r.country_code}
                  <span className="ml-1 font-mono text-[10px] text-ink-500">{r.country_code}</span>
                </td>
                <td className="py-2 text-right font-mono tabular-nums">{fmt(r.score)}</td>
                <td className="py-2 text-right font-mono text-xs tabular-nums">
                  {!ch ? (
                    <span className="text-ink-500">—</span>
                  ) : ch.kind === "newly_scored" ? (
                    <Tag tone="good">newly scored</Tag>
                  ) : ch.kind === "new_country" ? (
                    <Tag>first run</Tag>
                  ) : (
                    <>
                      {signed(ch.score_delta)}
                      {ch.rank_delta
                        ? ` · ${ch.rank_delta > 0 ? "▲" : "▼"}${Math.abs(ch.rank_delta)}`
                        : ""}
                    </>
                  )}
                </td>
                {pillars.map((p) => (
                  <td key={p.code} className="py-2 text-right font-mono tabular-nums text-ink-700">
                    {fmt(r.pillar_scores?.[p.code] ?? null)}
                  </td>
                ))}
                <td className="py-2 pl-4">
                  <Tag tone={sextantTone(r.sextant_band)}>
                    {r.sextant_band ?? "—"} {r.sextant != null ? fmt(r.sextant, 0) : ""}
                  </Tag>
                </td>
                <td className="py-2 font-mono">{r.weakest_grade ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-ink-500">
        Select a state to see every input behind its score.
      </p>
    </div>
  );
}

const INPUT_KIND: Record<InputChange["kind"], string> = {
  value_changed: "value revised",
  period_changed: "newer year",
  now_included: "now counts",
  now_excluded: "dropped out",
  exclusion_changed: "still out, new reason",
  added: "new input",
  removed: "removed",
};

function WhatChanged({
  q,
  index,
  names,
}: {
  q: { data?: Awaited<ReturnType<typeof compareIndexRuns>>; isLoading: boolean; error: unknown };
  index: string;
  names: Map<string, string>;
}) {
  const [all, setAll] = useState(false);
  if (q.isLoading)
    return (
      <div className="mt-6">
        <Empty>Comparing with the previous run…</Empty>
      </div>
    );
  if (q.error) return <p className="mt-6 text-sm text-red-700">{(q.error as Error).message}</p>;
  if (!q.data?.base || !q.data.diff)
    return (
      <div className="mt-6 border-l-2 border-line-200 pl-3">
        <Eyebrow>What changed</Eyebrow>
        <p className="text-sm text-ink-500">
          This is the first complete run, so there is nothing to compare with.
        </p>
      </div>
    );
  const { base, diff } = q.data;
  const sum = diff.summary[index];
  const scoreCh = diff.scores.filter((c) => c.index_code === index && c.kind !== "new_country");
  const inputCh = diff.inputs.filter((c) => c.index_code === index);
  const shownInputs = all ? inputCh : inputCh.slice(0, 12);

  return (
    <div className="mt-6 border-l-2 border-accent pl-4">
      <Eyebrow>
        What changed since the {base.mode} run of {base.data_cutoff}
      </Eyebrow>
      {sum && (
        <p className="mt-1 text-sm text-ink-950">
          {sum.moved} moved · {sum.newly_scored} newly scored · {sum.no_longer_scored} lost their
          score · {sum.inputs_changed} input{sum.inputs_changed === 1 ? "" : "s"} changed
          {sum.largest_move != null && ` · largest move ${signed(sum.largest_move)}`}
        </p>
      )}
      {scoreCh.length === 0 && inputCh.length === 0 && (
        <p className="mt-1 text-sm text-ink-500">Nothing changed on this index.</p>
      )}
      {scoreCh.length > 0 && (
        <ul className="mt-3 grid gap-1 text-sm md:grid-cols-2">
          {scoreCh.slice(0, 10).map((c) => (
            <li key={c.country_code}>
              <span className="text-ink-950">{names.get(c.country_code) ?? c.country_code}</span>{" "}
              <span className="font-mono text-xs text-ink-700">
                {c.kind === "moved" &&
                  `${fmt(c.score_before)} → ${fmt(c.score_after)} (${signed(c.score_delta)})`}
                {c.kind === "newly_scored" && `now scored at ${fmt(c.score_after)}`}
                {c.kind === "no_longer_scored" && `no longer scored (was ${fmt(c.score_before)})`}
                {c.kind === "dropped_country" && "not in this run"}
              </span>
            </li>
          ))}
        </ul>
      )}
      {inputCh.length > 0 && (
        <details className="mt-3" open={inputCh.length <= 6}>
          <summary className="cursor-pointer text-sm text-ink-700">
            Inputs that changed ({inputCh.length})
          </summary>
          <table className="mt-2 w-full text-xs" data-numeric>
            <tbody>
              {shownInputs.map((c) => (
                <tr
                  key={`${c.country_code}|${c.indicator_code}`}
                  className="border-b border-line-200/60"
                >
                  <td className="py-1 pr-3">{c.country_code}</td>
                  <td className="py-1 pr-3 font-mono">{c.indicator_code}</td>
                  <td className="py-1 pr-3">
                    <Tag
                      tone={c.kind === "now_excluded" || c.kind === "removed" ? "warn" : "quiet"}
                    >
                      {INPUT_KIND[c.kind]}
                    </Tag>
                  </td>
                  <td className="py-1 font-mono tabular-nums text-ink-700">
                    {c.before
                      ? `${fmt(c.before.value, 2)}${c.before.period ? ` (${c.before.period})` : ""}${c.before.excluded_reason ? ` · ${c.before.excluded_reason}` : ""}`
                      : "—"}
                    {" → "}
                    {c.after
                      ? `${fmt(c.after.value, 2)}${c.after.period ? ` (${c.after.period})` : ""}${c.after.excluded_reason ? ` · ${c.after.excluded_reason}` : ""}`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {inputCh.length > 12 && (
            <button type="button" className="btn-ghost mt-2" onClick={() => setAll(!all)}>
              {all ? "Show fewer" : `Show all ${inputCh.length}`}
            </button>
          )}
        </details>
      )}
    </div>
  );
}

function CountryInputs({
  runId,
  country,
  name,
  index,
  o,
  score,
  onClose,
}: {
  runId: string;
  country: string;
  name: string;
  index: string;
  o: IndicesOverview;
  score: IndexScoreRow | null;
  onClose: () => void;
}) {
  const getRun = useServerFn(getIndexRun);
  const q = useQuery({
    queryKey: ["index-run", runId, country],
    queryFn: () => getRun({ data: { runId, country } }),
  });
  const indName = new Map(
    o.indicators.filter((i) => i.index_code === index).map((i) => [i.code, i]),
  );
  const inputs: IndexInputRow[] = (q.data?.inputs ?? [])
    .filter((i) => i.index_code === index)
    .sort((a, b) => {
      const pa = indName.get(a.indicator_code)?.pillar_code ?? "";
      const pb = indName.get(b.indicator_code)?.pillar_code ?? "";
      return (
        pa.localeCompare(pb) ||
        (indName.get(a.indicator_code)?.position ?? 0) -
          (indName.get(b.indicator_code)?.position ?? 0)
      );
    });

  return (
    <Section
      title={`${name} · ${index} inputs`}
      aside={
        <button type="button" className="btn-ghost" onClick={onClose}>
          Close ✕
        </button>
      }
    >
      {score && (
        <p className="text-sm text-ink-700">
          {score.status === "scored"
            ? `Score ${fmt(score.score)} · rank ${score.rank}`
            : `Not scored — ${score.not_scored_reason ?? "below coverage"}`}{" "}
          · coverage {score.coverage?.present ?? "?"}/{score.coverage?.specified ?? "?"} · Sextant{" "}
          {score.sextant_band ?? "—"}
        </p>
      )}
      {q.isLoading && <Empty>Loading inputs…</Empty>}
      {q.error && <p className="text-sm text-red-700">{(q.error as Error).message}</p>}
      {q.data && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs" data-numeric>
            <thead>
              <tr className="border-b border-line-200 text-left uppercase tracking-widest text-ink-500">
                <th className="py-2 font-normal">Pillar</th>
                <th className="py-2 font-normal">Indicator</th>
                <th className="py-2 text-right font-normal">Value</th>
                <th className="py-2 font-normal pl-3">Year</th>
                <th className="py-2 text-right font-normal">Score</th>
                <th className="py-2 font-normal pl-3">Grade</th>
                <th className="py-2 font-normal">Source · licence</th>
                <th className="py-2 font-normal">Status</th>
              </tr>
            </thead>
            <tbody>
              {inputs.map((i) => {
                const meta = indName.get(i.indicator_code);
                return (
                  <tr key={i.indicator_code} className="border-b border-line-200/60 align-top">
                    <td className="py-1.5 text-ink-500">{meta?.pillar_code ?? ""}</td>
                    <td className="py-1.5">{meta?.name ?? i.indicator_code}</td>
                    <td className="py-1.5 text-right font-mono tabular-nums">
                      {fmt(i.value_used, 2)} <span className="text-ink-500">{meta?.unit}</span>
                    </td>
                    <td className="py-1.5 pl-3 tabular-nums">{i.period ?? "—"}</td>
                    <td className="py-1.5 text-right font-mono tabular-nums">{fmt(i.score)}</td>
                    <td className="py-1.5 pl-3 font-mono">{i.grade ?? "—"}</td>
                    <td className="py-1.5">
                      {i.source_url ? (
                        <a
                          href={i.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="underline"
                        >
                          {i.source_org ?? "source"}
                        </a>
                      ) : (
                        (i.source_org ?? "—")
                      )}
                      <span className="text-ink-500"> · {i.licence ?? "—"}</span>
                    </td>
                    <td className="py-1.5">
                      {i.excluded_reason ? (
                        <Tag tone="warn">{i.excluded_reason.replace(/_/g, " ")}</Tag>
                      ) : (
                        <Tag tone="good">used</Tag>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

function ReleasePanel({
  o,
  release,
}: {
  o: IndicesOverview;
  release: NonNullable<Run["release"]>;
}) {
  const qc = useQueryClient();
  const readiness = useServerFn(getReleaseReadiness);
  const publish = useServerFn(publishIndexRelease);
  const [notes, setNotes] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const q = useQuery({
    queryKey: ["index-release-readiness", release.id],
    queryFn: () => readiness({ data: { releaseId: release.id } }),
    enabled: release.kind === "edition", // trackers are never published
  });

  const isEdition = release.kind === "edition";
  const published = release.status === "published";

  async function go() {
    setBusy(true);
    try {
      await publish({ data: { releaseId: release.id, notes: notes || undefined } });
      toast.success(`${release.label} published. GDP Advisor will serve it from the partner API.`);
      await qc.invalidateQueries({ queryKey: ["indices-overview"] });
      await qc.invalidateQueries({ queryKey: ["index-release-readiness", release.id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border border-line-200 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <Eyebrow>{isEdition ? "Official edition" : "Tracker (private)"}</Eyebrow>
          <h3 className="font-serif text-lg">{release.label}</h3>
        </div>
        <Tag tone={releaseTone(release.status)}>{release.status}</Tag>
      </div>
      {!isEdition && (
        <p className="mt-2 text-sm text-ink-500">
          Trackers are provisional and stay private to governments. They are never published to GDP
          Advisor.
        </p>
      )}
      {isEdition && (
        <>
          {q.isLoading && <Empty>Checking readiness…</Empty>}
          {q.error && <p className="text-sm text-red-700">{(q.error as Error).message}</p>}
          {q.data && (
            <ul className="mt-3 space-y-2">
              {q.data.checks.map((c) => (
                <li key={c.code} className="text-sm">
                  <span className="flex items-baseline gap-2">
                    <Tag tone={c.ok ? "good" : c.blocking ? "bad" : "warn"}>
                      {c.ok ? "pass" : c.blocking ? "blocks" : "warning"}
                    </Tag>
                    <span className="text-ink-950">{c.label}</span>
                  </span>
                  {!c.ok && c.detail && (
                    <p className="ml-1 mt-0.5 text-xs text-ink-700">{c.detail}</p>
                  )}
                  {!c.ok && c.items && c.items.length > 0 && (
                    <details className="ml-1 mt-0.5">
                      <summary className="cursor-pointer text-xs text-ink-500">
                        {c.items.length} item{c.items.length === 1 ? "" : "s"}
                      </summary>
                      <ul className="mt-1 list-disc pl-5 text-xs text-ink-700">
                        {c.items.map((it) => (
                          <li key={it}>{it}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          )}
          {!published && q.data && (
            <div className="mt-4 space-y-2 border-t border-line-200 pt-4">
              {!o.me.isAdmin ? (
                <p className="text-sm text-ink-500">An admin signs off and publishes editions.</p>
              ) : (
                <>
                  <textarea
                    className={`${fieldCls} min-h-[4rem]`}
                    placeholder="Release notes — what is new in this edition, and any corrections (shown in the edition archive)"
                    value={notes}
                    maxLength={2000}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                  <label className="flex items-start gap-2 text-xs text-ink-700">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={confirm}
                      onChange={(e) => setConfirm(e.target.checked)}
                    />
                    I have reviewed what changed, and each government has had its 10-working-day
                    factual-correction window on its own inputs.
                  </label>
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={!q.data.ready || !confirm || busy}
                    onClick={go}
                  >
                    {busy ? "Publishing…" : "Sign off and publish"}
                  </button>
                  {!q.data.ready && (
                    <p className="text-xs text-red-700">
                      Resolve every “blocks” item above first. Published editions are never
                      overwritten.
                    </p>
                  )}
                </>
              )}
            </div>
          )}
          {published && (
            <p className="mt-3 text-sm text-ink-700">
              Published{" "}
              {release.published_at
                ? new Date(release.published_at).toLocaleDateString("en-GB")
                : ""}
              . Corrections go out as a new, numbered edition.
            </p>
          )}
        </>
      )}
    </div>
  );
}
