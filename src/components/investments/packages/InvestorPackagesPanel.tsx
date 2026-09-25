// Investor materials for one project: teaser, information memorandum,
// data-room index and deck. Mounted in the project workspace's "Investor
// materials" tab.
//
// Drafts can be generated at any stage. Approval is a status change the
// database guards (two-person rule, approver role, approved project, current
// project version); this panel shows why the button is disabled rather than
// hiding it.

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { Explain } from "@/components/explain/Explain";
import {
  approvePackage,
  generatePackage,
  listPackages,
  type PackageSummary,
} from "@/lib/investments/packages.functions";
import { PACKAGE_KINDS, PACKAGE_KIND_LABEL, type PackageKind } from "@/lib/syndication/db";
import { cn } from "@/lib/utils";
import "@/lib/explain/packages-entries";

const KIND_NOTE: Record<PackageKind, string> = {
  teaser: "One page. Drafted by the model from the project facts; every number checked.",
  memorandum: "Full document in twelve sections. Drafted by the model; every number checked.",
  data_room: "Folder index built by rule from the project record. No model involved.",
  deck: "Eight to ten 16:9 slides. Figures are drawn from the facts, not typed by the model.",
};

const STATUS_LABEL: Record<PackageSummary["status"], string> = {
  draft: "Draft",
  approved: "Approved",
  superseded: "Superseded",
};

const STATUS_CLASS: Record<PackageSummary["status"], string> = {
  draft: "text-draft-state",
  approved: "text-signal-positive",
  superseded: "text-ink-400",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function InvestorPackagesPanel({
  code,
  projectId,
  projectApproved,
  projectVersion,
  canApprove,
}: {
  code: string;
  projectId: string;
  projectApproved: boolean;
  projectVersion: number;
  canApprove: boolean;
}) {
  const list = useServerFn(listPackages);
  const generate = useServerFn(generatePackage);
  const approve = useServerFn(approvePackage);
  const qc = useQueryClient();
  const queryKey = ["investment-packages", code, projectId, projectVersion];

  const q = useQuery({
    queryKey,
    queryFn: () => list({ data: { code, projectId } }),
  });

  const [errors, setErrors] = useState<Partial<Record<PackageKind, string>>>({});
  const [notices, setNotices] = useState<Partial<Record<PackageKind, string>>>({});

  const gen = useMutation({
    mutationFn: (kind: PackageKind) => generate({ data: { code, projectId, kind } }),
    onMutate: (kind) => {
      setErrors((e) => ({ ...e, [kind]: undefined }));
      setNotices((n) => ({ ...n, [kind]: undefined }));
    },
    onSuccess: (r, kind) => {
      setNotices((n) => ({
        ...n,
        [kind]:
          kind === "data_room"
            ? `Version ${r.version} built.`
            : r.warnings > 0
              ? `Version ${r.version} drafted with ${r.warnings} unverified ${r.warnings === 1 ? "number" : "numbers"} — open it to review.`
              : `Version ${r.version} drafted. Every number matched the facts.`,
      }));
      void qc.invalidateQueries({ queryKey: ["investment-packages", code, projectId] });
    },
    onError: (err, kind) => setErrors((e) => ({ ...e, [kind]: (err as Error).message })),
  });

  const appr = useMutation({
    mutationFn: (p: { id: string; kind: PackageKind }) =>
      approve({ data: { code, packageId: p.id } }),
    onMutate: (p) => setErrors((e) => ({ ...e, [p.kind]: undefined })),
    onSuccess: (_r, p) => {
      setNotices((n) => ({
        ...n,
        [p.kind]: "Approved. The previous approved version, if any, is now superseded.",
      }));
      void qc.invalidateQueries({ queryKey: ["investment-packages", code, projectId] });
    },
    onError: (err, p) => setErrors((e) => ({ ...e, [p.kind]: (err as Error).message })),
  });

  const packages = q.data?.packages ?? [];
  const aiAvailable = q.data?.aiAvailable ?? true;

  return (
    <section aria-labelledby="investor-materials-heading" className="space-y-5">
      <header className="border-t-2 border-gold-500 pt-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">
          Investor materials
        </div>
        <h2
          id="investor-materials-heading"
          className="mt-1.5 font-display text-[24px] leading-tight text-ink-950"
        >
          Packages for investors
        </h2>
        <p className="mt-2 max-w-[70ch] text-[14px] leading-relaxed text-ink-700">
          Drafts can be prepared at any stage;{" "}
          <Explain id="packages.approval">approval requires an approved project</Explain> and a
          second person. Each draft is written only from the project&apos;s facts, and{" "}
          <Explain id="packages.number_guard">every number is checked against them</Explain>.
        </p>
        {!aiAvailable ? (
          <p className="mt-2 text-[13px] text-signal-caution">
            Drafting is unavailable on this server: the AI gateway key is not configured. The
            data-room index can still be built.
          </p>
        ) : null}
      </header>

      {q.isLoading ? <p className="text-[13px] text-ink-500">Loading packages…</p> : null}
      {q.error ? (
        <p className="text-[13px] text-signal-negative">{(q.error as Error).message}</p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {PACKAGE_KINDS.map((kind) => {
          const versions = packages
            .filter((p) => p.kind === kind)
            .sort((a, b) => b.version - a.version);
          const latest = versions[0];
          const approved = versions.find((p) => p.status === "approved");
          const isAi = kind !== "data_room";
          const generating = gen.isPending && gen.variables === kind;
          const approving = appr.isPending && appr.variables?.kind === kind;
          const stale = latest ? latest.project_version !== projectVersion : false;

          let approveReason: string | null = null;
          if (!latest) approveReason = "Nothing to approve yet.";
          else if (latest.status !== "draft") approveReason = null;
          else if (!canApprove)
            approveReason = "You need an investment-approver role for this country to approve.";
          else if (!projectApproved)
            approveReason =
              "Approval requires an approved project. Drafts can be prepared at any stage.";
          else if (stale)
            approveReason =
              "Out of date: generate a new version from the current project before approving.";
          else if (latest.drafted_by_me)
            approveReason = "You drafted this version, so a second person must approve it.";
          const canApproveLatest = !!latest && latest.status === "draft" && approveReason === null;

          return (
            <article key={kind} className="flex flex-col border border-line-200 bg-paper-0 p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-display text-[19px] leading-tight text-ink-950">
                  {PACKAGE_KIND_LABEL[kind]}
                </h3>
                {latest ? (
                  <span
                    className={cn(
                      "font-mono text-[10px] uppercase tracking-[0.18em]",
                      STATUS_CLASS[latest.status],
                    )}
                  >
                    v{latest.version} · {STATUS_LABEL[latest.status]}
                  </span>
                ) : (
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-400">
                    Not drafted
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-[12.5px] leading-snug text-ink-500">{KIND_NOTE[kind]}</p>

              {latest ? (
                <dl className="mt-4 space-y-1.5 border-t border-line-200 pt-3 text-[13px]">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <dt className="text-ink-500">Built from</dt>
                    <dd className="text-ink-950">project version {latest.project_version}</dd>
                    {stale ? (
                      <dd className="text-signal-caution">
                        <Explain id="packages.stale">
                          out of date — project is now at version {projectVersion}
                        </Explain>
                      </dd>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <dt className="text-ink-500">Numbers</dt>
                    <dd className={latest.warnings > 0 ? "text-signal-caution" : "text-ink-950"}>
                      {!isAi ? (
                        "Built by rule; no model-written figures"
                      ) : (
                        <Explain id="packages.number_guard">
                          {latest.warnings > 0
                            ? `${latest.warnings} unverified ${latest.warnings === 1 ? "number" : "numbers"}`
                            : "All matched to the facts"}
                        </Explain>
                      )}
                    </dd>
                  </div>
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <dt className="text-ink-500">Created</dt>
                    <dd className="text-ink-950">
                      {fmtDate(latest.created_at)}
                      {latest.drafted_by_me ? " · by you" : ""}
                    </dd>
                  </div>
                  {approved && approved.id !== latest.id ? (
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <dt className="text-ink-500">Approved version</dt>
                      <dd className="text-signal-positive">
                        v{approved.version}, {fmtDate(approved.approved_at)}
                      </dd>
                    </div>
                  ) : null}
                  {latest.status === "approved" ? (
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <dt className="text-ink-500">Approved</dt>
                      <dd className="text-signal-positive">{fmtDate(latest.approved_at)}</dd>
                    </div>
                  ) : null}
                </dl>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-secondary px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.16em]"
                  disabled={generating || (isAi && !aiAvailable) || q.isLoading}
                  onClick={() => gen.mutate(kind)}
                >
                  {generating
                    ? isAi
                      ? "Drafting…"
                      : "Building…"
                    : latest
                      ? "Regenerate"
                      : "Generate"}
                </button>
                {latest ? (
                  <Link
                    to="/admin/countries/$code/investments/$id/package/$packageId"
                    params={{ code, id: projectId, packageId: latest.id }}
                    target="_blank"
                    rel="noopener"
                    className="btn-ghost px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.16em]"
                  >
                    Open ↗
                  </Link>
                ) : null}
                {latest && latest.status === "draft" ? (
                  <button
                    type="button"
                    className="btn-primary px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.16em]"
                    disabled={!canApproveLatest || approving}
                    aria-describedby={approveReason ? `approve-reason-${kind}` : undefined}
                    onClick={() => latest && appr.mutate({ id: latest.id, kind })}
                  >
                    {approving ? "Approving…" : `Approve v${latest.version}`}
                  </button>
                ) : null}
              </div>
              {generating && isAi ? (
                <p className="mt-2 text-[12.5px] text-ink-500">
                  Drafting from the project facts. This can take up to a minute.
                </p>
              ) : null}
              {latest && latest.status === "draft" && approveReason ? (
                <p
                  id={`approve-reason-${kind}`}
                  className="mt-2 text-[12.5px] leading-snug text-ink-500"
                >
                  {approveReason}
                </p>
              ) : null}
              {notices[kind] ? (
                <p className="mt-2 text-[12.5px] leading-snug text-signal-positive">
                  {notices[kind]}
                </p>
              ) : null}
              {errors[kind] ? (
                <p role="alert" className="mt-2 text-[12.5px] leading-snug text-signal-negative">
                  {errors[kind]}
                </p>
              ) : null}

              {versions.length > 1 ? (
                <details className="mt-4 border-t border-line-200 pt-3">
                  <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
                    Version history ({versions.length})
                  </summary>
                  <ol className="mt-2 divide-y divide-line-200">
                    {versions.map((v) => (
                      <li
                        key={v.id}
                        className="flex flex-wrap items-baseline gap-x-3 py-1.5 text-[12.5px]"
                      >
                        <span className="font-mono text-ink-950">v{v.version}</span>
                        <span className={STATUS_CLASS[v.status]}>{STATUS_LABEL[v.status]}</span>
                        <span className="text-ink-500">project v{v.project_version}</span>
                        <span className="text-ink-500">{fmtDate(v.created_at)}</span>
                        {v.kind !== "data_room" && v.warnings > 0 ? (
                          <span className="text-signal-caution">{v.warnings} unverified</span>
                        ) : null}
                        <Link
                          to="/admin/countries/$code/investments/$id/package/$packageId"
                          params={{ code, id: projectId, packageId: v.id }}
                          target="_blank"
                          rel="noopener"
                          className="ml-auto text-ink-700 underline decoration-line-200 underline-offset-4 hover:text-ink-950"
                        >
                          Open
                        </Link>
                      </li>
                    ))}
                  </ol>
                </details>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
