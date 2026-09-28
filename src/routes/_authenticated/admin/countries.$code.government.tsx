import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { SuperAdminShell } from "@/components/admin/SuperAdminShell";
import {
  BodiesTable,
  MICRO,
  OfficesTable,
  type Action,
  type BodyDraft,
  type OfficeDraft,
} from "@/components/government/MachineryTables";
import {
  getGovernment,
  saveBody,
  saveOffice,
  setMachineryStatus,
} from "@/lib/government/machinery.functions";
import {
  backfillGovernment,
  researchOffices,
  researchStatutoryBodies,
  type FillResult,
} from "@/lib/government/research.functions";

export const Route = createFileRoute("/_authenticated/admin/countries/$code/government")({
  head: ({ params }) => ({
    meta: [
      { title: `Government record · ${params.code} — GDPVision` },
      {
        name: "description",
        content: `Head of State, Prime Minister, Cabinet and statutory bodies for ${params.code}: researched, verified, and published to the country's platform.`,
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GovernmentPage,
});

const orNull = (s: string) => (s.trim() ? s.trim() : null);

function GovernmentPage() {
  const { code } = Route.useParams();
  const qc = useQueryClient();
  const fetchGov = useServerFn(getGovernment);
  const setStatus = useServerFn(setMachineryStatus);
  const saveO = useServerFn(saveOffice);
  const saveB = useServerFn(saveBody);
  const backfill = useServerFn(backfillGovernment);
  const resOffices = useServerFn(researchOffices);
  const resBodies = useServerFn(researchStatutoryBodies);
  const key = ["government", code];
  const q = useQuery({ queryKey: key, queryFn: () => fetchGov({ data: { code } }) });
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const data = q.data;
  const refresh = () => qc.invalidateQueries({ queryKey: key });

  async function run(label: string, fn: () => Promise<FillResult>) {
    setBusy(label);
    setError(null);
    setNotice(`${label}…`);
    try {
      const r = await fn();
      setNotice(
        `${label}: ${r.inserted} added, ${r.updated} drafts updated${r.heldVerified ? `, ${r.heldVerified} verified record${r.heldVerified === 1 ? "" : "s"} left unchanged` : ""}${r.sources != null ? ` · ${r.sources} source${r.sources === 1 ? "" : "s"}${r.tier ? ` (${r.tier})` : ""}` : ""}. Review, then verify and publish.`,
      );
      await refresh();
    } catch (e) {
      setNotice(null);
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function onAction(table: "office" | "body", ids: string[], action: Action) {
    setError(null);
    try {
      await setStatus({ data: { code, table, ids, action } });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function onSaveOffice(d: OfficeDraft) {
    await saveO({
      data: {
        code,
        office: {
          id: d.id,
          office_key: d.office_key,
          title: d.title,
          holder_name: d.holder_name,
          ministry_slug: d.ministry_slug,
          portfolio: d.portfolio,
          party: d.party,
          appointed_on: orNull(d.appointed_on),
          portrait_url: orNull(d.portrait_url),
          source_url: orNull(d.source_url),
        },
      },
    });
    await refresh();
  }

  async function onSaveBody(d: BodyDraft) {
    const year = Number.parseInt(d.act_year, 10);
    await saveB({
      data: {
        code,
        body: {
          id: d.id,
          name: d.name,
          acronym: d.acronym,
          kind: d.kind,
          parent_ministry_slug: d.parent_ministry_slug,
          enabling_act: d.enabling_act,
          act_year: Number.isFinite(year) ? year : null,
          mandate: d.mandate,
          head_name: d.head_name,
          head_title: d.head_title,
          board_chair: d.board_chair,
          sector_code: d.sector_code,
          services: d.services
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
          website: orNull(d.website),
          source_url: orNull(d.source_url),
        },
      },
    });
    await refresh();
  }

  const count = (rows: Array<{ status: string; visibility: string }>) => ({
    public: rows.filter((r) => r.status === "verified" && r.visibility === "public").length,
    draft: rows.filter((r) => r.status === "draft").length,
  });
  const oc = data ? count(data.offices) : null;
  const bc = data ? count(data.bodies) : null;
  const pm = data?.offices.find(
    (o) => o.office_key === "head_of_government" && o.status !== "retired",
  );

  return (
    <SuperAdminShell
      crumbs={[
        { label: "Countries", to: "/admin/countries" },
        { label: code, to: "/admin/countries/$code/onboard", params: { code } },
        { label: "Government record" },
      ]}
    >
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className={MICRO}>{code} · Machinery of government</div>
          <h1 className="mt-1 font-display text-3xl text-ink-950">Government record</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-700">
            The Head of State, the Prime Minister, Cabinet in order of precedence, and every
            statutory body under its ministry. Research and back-fill arrive as drafts; only what a
            person verifies and publishes reaches the PRD, the Sector Studio and the country's
            platform (API resource <span className="font-mono text-xs">government</span>).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/admin/countries/$code/egov"
            params={{ code }}
            className="btn-ghost px-3 py-2 text-xs"
          >
            Digital Government Studio
          </Link>
          {data?.canEdit && (
            <>
              <button
                type="button"
                className="btn-ghost px-3 py-2 text-xs"
                disabled={busy != null}
                onClick={() => run("Back-fill from the corpus", () => backfill({ data: { code } }))}
              >
                Back-fill from corpus
              </button>
              {data.researchAvailable && (
                <>
                  <button
                    type="button"
                    className="btn-secondary px-3 py-2 text-xs"
                    disabled={busy != null}
                    onClick={() =>
                      run("Research: offices of state and Cabinet", () =>
                        resOffices({ data: { code } }),
                      )
                    }
                  >
                    Research Cabinet
                  </button>
                  <button
                    type="button"
                    className="btn-primary px-3 py-2 text-xs"
                    disabled={busy != null}
                    onClick={() =>
                      run("Research: statutory bodies", () => resBodies({ data: { code } }))
                    }
                  >
                    Research statutory bodies
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {q.isLoading && <div className="h-24 animate-pulse bg-paper-50" aria-busy="true" />}
      {q.error && (
        <p className="border-l-2 border-signal-negative py-2 pl-4 text-sm text-signal-negative">
          The record could not be loaded: {(q.error as Error).message}
        </p>
      )}
      {notice && (
        <p className="mb-4 border-l-2 border-gold-500 py-1 pl-3 text-sm text-ink-700">{notice}</p>
      )}
      {error && (
        <p className="mb-4 border-l-2 border-signal-negative py-1 pl-3 text-sm text-signal-negative">
          {error}
        </p>
      )}

      {data && oc && bc && (
        <>
          <dl className="mb-8 grid gap-4 border-y border-line-200 py-4 sm:grid-cols-3">
            <div>
              <dt className={MICRO}>Head of Government</dt>
              <dd className="mt-1 text-sm text-ink-950">
                {pm?.holder_name ?? <span className="text-signal-negative">Not recorded</span>}
                {pm && pm.visibility !== "public" && (
                  <span className="ml-2 text-xs text-ink-500">(not yet public)</span>
                )}
              </dd>
            </div>
            <div>
              <dt className={MICRO}>Offices and Cabinet</dt>
              <dd className="mt-1 text-sm text-ink-950">
                {oc.public} public · {oc.draft} to review
              </dd>
            </div>
            <div>
              <dt className={MICRO}>Statutory bodies</dt>
              <dd className="mt-1 text-sm text-ink-950">
                {bc.public} public · {bc.draft} to review
              </dd>
            </div>
          </dl>

          <section aria-labelledby="offices" className="mb-12">
            <h2 id="offices" className="mb-2 font-display text-xl text-ink-950">
              Offices of state and Cabinet
            </h2>
            {data.offices.length === 0 ? (
              <p className="border-l-2 border-line-200 py-4 pl-4 text-sm text-ink-500">
                Nothing recorded yet. Back-fill from the corpus, then research the Cabinet.
              </p>
            ) : null}
            <OfficesTable
              offices={data.offices}
              ministries={data.ministries}
              canEdit={data.canEdit}
              onAction={(ids, a) => onAction("office", ids, a)}
              onSave={onSaveOffice}
            />
          </section>

          <section aria-labelledby="bodies">
            <h2 id="bodies" className="mb-2 font-display text-xl text-ink-950">
              Statutory bodies
            </h2>
            {data.bodies.length === 0 ? (
              <p className="border-l-2 border-line-200 py-4 pl-4 text-sm text-ink-500">
                No statutory bodies recorded yet. Research them, or add them by hand.
              </p>
            ) : null}
            <BodiesTable
              bodies={data.bodies}
              ministries={data.ministries}
              sectors={data.sectors}
              canEdit={data.canEdit}
              onAction={(ids, a) => onAction("body", ids, a)}
              onSave={onSaveBody}
            />
          </section>
        </>
      )}
    </SuperAdminShell>
  );
}
