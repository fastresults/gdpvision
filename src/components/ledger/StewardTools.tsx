import { useState } from "react";
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  getReconciliationReport,
  getSourceHealth,
  getPublishGate,
  runSourceHealthChecks,
  saveReconciliationNote,
} from "@/lib/ledger.functions";

function reconQuery(cc: string) {
  return queryOptions({
    queryKey: ["recon-report", cc],
    queryFn: () => getReconciliationReport({ data: { countryCode: cc } }),
  });
}
function healthQuery(cc: string) {
  return queryOptions({
    queryKey: ["source-health", cc],
    queryFn: () => getSourceHealth({ data: { countryCode: cc } }),
  });
}
function gateQuery(cc: string) {
  return queryOptions({
    queryKey: ["publish-gate", cc],
    queryFn: () => getPublishGate({ data: { countryCode: cc } }),
  });
}

export function StewardTools({ countryCode }: { countryCode: string }) {
  return (
    <div className="mt-20 space-y-16">
      <ReconciliationSection countryCode={countryCode} />
      <SourceHealthSection countryCode={countryCode} />
      <PublishGateSection countryCode={countryCode} />
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">{children}</h3>
  );
}

function ReconciliationSection({ countryCode }: { countryCode: string }) {
  const qc = useQueryClient();
  const q = useQuery(reconQuery(countryCode));
  const saveFn = useServerFn(saveReconciliationNote);
  const save = useMutation({
    mutationFn: saveFn,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recon-report", countryCode] }),
  });
  const [active, setActive] = useState<string | null>(null);
  const [note, setNote] = useState("");

  if (!q.data) return null;
  const { issues, notes, isSteward } = q.data;

  return (
    <section>
      <div className="flex items-baseline justify-between">
        <Eyebrow>Reconciliation checker</Eyebrow>
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
          {issues.length} issue{issues.length === 1 ? "" : "s"}
        </span>
      </div>
      {issues.length === 0 ? (
        <p className="mt-6 max-w-xl text-sm text-ink-500">
          All sector shares and capital flow residuals reconcile within tolerance.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-line-200 border-t border-line-200">
          {issues.map((iss) => (
            <li key={iss.subject_key} className="py-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-ink-950">
                    <span
                      className={`mr-2 inline-block h-2 w-2 rounded-full ${
                        iss.severity === "error" ? "bg-red-600" : "bg-gold-500"
                      }`}
                    />
                    {iss.label}
                  </p>
                  <p className="mt-1 text-xs text-ink-500">{iss.detail}</p>
                </div>
                {isSteward ? (
                  <button
                    type="button"
                    onClick={() =>
                      setActive(active === iss.subject_key ? null : iss.subject_key)
                    }
                    className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-950 underline underline-offset-4"
                  >
                    {active === iss.subject_key ? "Cancel" : "Add note"}
                  </button>
                ) : null}
              </div>
              {active === iss.subject_key ? (
                <div className="mt-4 border-l-2 border-gold-500 pl-4">
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    className="w-full border border-line-200 bg-white px-3 py-2 font-mono text-xs"
                    placeholder="Explain the residual and the reconciliation plan…"
                  />
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      disabled={save.isPending || note.trim().length < 3}
                      onClick={() =>
                        save.mutate(
                          {
                            data: {
                              countryCode,
                              subjectKind: iss.kind,
                              subjectKey: iss.subject_key,
                              residualPct: iss.residual_pct ?? null,
                              note: note.trim(),
                            },
                          },
                          {
                            onSuccess: () => {
                              setNote("");
                              setActive(null);
                            },
                          },
                        )
                      }
                      className="border border-ink-950 bg-ink-950 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-white disabled:opacity-40"
                    >
                      {save.isPending ? "Saving…" : "Save note"}
                    </button>
                  </div>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {notes.length > 0 ? (
        <div className="mt-8">
          <Eyebrow>Recent steward notes</Eyebrow>
          <ul className="mt-4 space-y-3">
            {notes.slice(0, 6).map((n) => (
              <li key={n.id} className="border-l border-line-200 pl-3 text-sm text-ink-500">
                <div className="font-mono text-[11px] uppercase tracking-widest text-ink-500">
                  {n.subject_key} · {new Date(n.created_at).toISOString().slice(0, 10)}
                  {n.residual_pct !== null ? ` · residual ${n.residual_pct.toFixed(1)}%` : ""}
                </div>
                <p className="mt-1 text-ink-950">{n.note}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function SourceHealthSection({ countryCode }: { countryCode: string }) {
  const qc = useQueryClient();
  const q = useQuery(healthQuery(countryCode));
  const runFn = useServerFn(runSourceHealthChecks);
  const run = useMutation({
    mutationFn: runFn,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["source-health", countryCode] }),
  });

  if (!q.data) return null;
  const { rows, isSteward, lastRunAt } = q.data;
  const broken = rows.filter((r) => r.last_ok === false || (r.last_status && r.last_status !== "ok" && r.last_status !== "pending"));

  return (
    <section>
      <div className="flex items-baseline justify-between">
        <Eyebrow>Source health</Eyebrow>
        <div className="flex items-center gap-4">
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
            {rows.length} sources · {broken.length} unreachable
            {lastRunAt ? ` · last ${new Date(lastRunAt).toISOString().slice(0, 16).replace("T", " ")}` : ""}
          </span>
          {isSteward ? (
            <button
              type="button"
              disabled={run.isPending}
              onClick={() => run.mutate({ data: { countryCode } })}
              className="border border-ink-950 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-950 disabled:opacity-40"
            >
              {run.isPending ? "Checking…" : "Run health check"}
            </button>
          ) : null}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-ink-500">No active sources registered for this instance.</p>
      ) : (
        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="border-b border-line-200 text-left text-xs uppercase tracking-widest text-ink-500">
              <th className="py-2 font-normal">Source</th>
              <th className="py-2 font-normal">Status</th>
              <th className="py-2 text-right font-normal">Latency</th>
              <th className="py-2 text-right font-normal">7d checks</th>
              <th className="py-2 text-right font-normal">Failures</th>
              <th className="py-2 pl-4 font-normal">Last check</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const bad =
                r.last_ok === false ||
                (r.last_status && r.last_status !== "ok" && r.last_status !== "pending");
              return (
                <tr key={r.source_id} className="border-b border-line-200/60 align-top">
                  <td className="py-3">
                    <div className="text-ink-950">{r.title || r.org}</div>
                    {r.url ? (
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-0.5 block truncate font-mono text-[11px] text-ink-500 hover:underline"
                        style={{ maxWidth: 380 }}
                      >
                        {r.url}
                      </a>
                    ) : null}
                    {r.last_error ? (
                      <div className="mt-1 font-mono text-[11px] text-red-700">{r.last_error}</div>
                    ) : null}
                  </td>
                  <td className="py-3">
                    <span
                      className={`inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest ${
                        bad ? "text-red-700" : "text-emerald-700"
                      }`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${bad ? "bg-red-600" : "bg-emerald-600"}`}
                      />
                      {r.last_status ?? "unknown"}
                    </span>
                  </td>
                  <td className="py-3 text-right font-mono tabular-nums text-ink-500">
                    {r.latency_ms !== null ? `${r.latency_ms}ms` : "—"}
                  </td>
                  <td className="py-3 text-right font-mono tabular-nums">{r.checks_last_7d}</td>
                  <td className="py-3 text-right font-mono tabular-nums">
                    {r.failures_last_7d}
                  </td>
                  <td className="py-3 pl-4 font-mono text-[11px] text-ink-500">
                    {r.last_fetched_at
                      ? new Date(r.last_fetched_at).toISOString().slice(0, 16).replace("T", " ")
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

function PublishGateSection({ countryCode }: { countryCode: string }) {
  const q = useQuery(gateQuery(countryCode));
  if (!q.data) return null;
  const { green, checks } = q.data;

  return (
    <section>
      <div className="flex items-baseline justify-between">
        <Eyebrow>Publish gate</Eyebrow>
        <span
          className={`font-mono text-[11px] uppercase tracking-[0.2em] ${
            green ? "text-emerald-700" : "text-red-700"
          }`}
        >
          {green ? "Green — ready" : "Blocked"}
        </span>
      </div>
      <ul className="mt-6 divide-y divide-line-200 border-t border-line-200">
        {checks.map((c) => (
          <li key={c.key} className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm text-ink-950">
                <span
                  className={`mr-2 inline-block h-2 w-2 rounded-full ${
                    c.pass ? "bg-emerald-600" : "bg-red-600"
                  }`}
                />
                {c.label}
              </p>
              <p className="mt-0.5 font-mono text-[11px] text-ink-500">{c.detail}</p>
            </div>
            <span
              className={`font-mono text-[11px] uppercase tracking-widest ${
                c.pass ? "text-emerald-700" : "text-red-700"
              }`}
            >
              {c.pass ? "Pass" : "Fail"}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
