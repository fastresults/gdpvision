import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Inbox, ExternalLink, Loader2 } from "lucide-react";

import { getMyCountryStatus } from "@/lib/country-admin.functions";
import {
  listAgencyRequests,
  updateRequestStatus,
  attachDeliverable,
} from "@/lib/concierge/concierge.functions";
import { LEXICON, type ChamberId } from "@/lib/concierge/minister-lexicon";

export const Route = createFileRoute("/_authenticated/agency/")({
  head: () => ({
    meta: [
      { title: "Agency Console · GDPVision" },
      { name: "description", content: "Internal queue of Concierge requests across countries." },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: ({ error, reset }) => (
    <div className="mx-auto max-w-xl p-12">
      <h1 className="font-serif text-2xl">Something went wrong.</h1>
      <p className="mt-2 text-sm text-ink-500">{error.message}</p>
      <button onClick={reset} className="mt-4 text-sm underline">Try again</button>
    </div>
  ),
  notFoundComponent: () => <div className="p-12">Not found.</div>,
  component: AgencyConsole,
});

const statusQuery = queryOptions({
  queryKey: ["my-country-status"],
  queryFn: () => getMyCountryStatus(),
});

const STATUSES = ["new", "triaged", "in_progress", "review", "ready", "delivered", "accepted", "closed"] as const;
type Status = typeof STATUSES[number];

function AgencyConsole() {
  const { data: status } = useSuspenseQuery(statusQuery);
  const canAgency = status.isGlobalAdmin || status.adminScopes.length > 0;

  const [countryFilter, setCountryFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<Status | "">("");

  const listQ = useSuspenseQuery(
    queryOptions({
      queryKey: ["concierge", "agency", countryFilter],
      queryFn: () =>
        listAgencyRequests({
          data: countryFilter ? { country_code: countryFilter } : {},
        }),
      refetchInterval: 20000,
    }),
  );

  const rows = useMemo(() => {
    return (listQ.data ?? []).filter((r) => !statusFilter || (r.status as string) === statusFilter);
  }, [listQ.data, statusFilter]);

  if (!canAgency) {
    return (
      <div className="mx-auto max-w-xl p-12 text-center">
        <h1 className="font-serif text-2xl">Not available.</h1>
        <p className="mt-3 text-sm text-ink-500">The Agency Console is only for our internal team.</p>
      </div>
    );
  }

  const countries = status.isGlobalAdmin
    ? [] // no restriction — show any country the RLS returns
    : status.adminScopes;

  return (
    <div className="mx-auto max-w-7xl px-6 py-14">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line-200 pb-6">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-ink-500">Agency Console</p>
          <h1 className="mt-2 font-serif text-3xl text-ink-950">Concierge queue</h1>
          <p className="mt-2 text-sm text-ink-500">
            Live queue of every request submitted from a Minister's Study. Internal vocabulary allowed here.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {countries.length > 0 ? (
            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="border border-line-300 bg-transparent px-3 py-2 text-sm"
            >
              <option value="">All my countries</option>
              {countries.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          ) : (
            <input
              placeholder="Filter by ISO code"
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value.toUpperCase().slice(0, 4))}
              className="border border-line-300 bg-transparent px-3 py-2 text-sm"
            />
          )}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as Status | "")}
            className="border border-line-300 bg-transparent px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </header>

      {rows.length === 0 ? (
        <div className="mt-12 border border-dashed border-line-300 p-16 text-center">
          <Inbox size={28} className="mx-auto text-ink-500" strokeWidth={1.2} />
          <p className="mt-4 text-ink-500">Nothing in the queue matches these filters.</p>
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {rows.map((r) => (
            <AgencyRow key={r.id as string} row={r as Record<string, unknown>} />
          ))}
        </ul>
      )}
    </div>
  );
}

function AgencyRow({ row }: { row: Record<string, unknown> }) {
  const qc = useQueryClient();
  const id = row.id as string;
  const chamber = (row.internal_chamber as ChamberId | null) ?? null;
  const lex = chamber ? LEXICON[chamber] : null;
  const status = (row.status as Status) ?? "new";
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [ministerBody, setMinisterBody] = useState("");
  const [deliverTitle, setDeliverTitle] = useState("");

  async function changeStatus(next: Status) {
    setBusy(true);
    try {
      await updateRequestStatus({
        data: { id, status: next, internal_note: note || undefined },
      });
      setNote("");
      await qc.invalidateQueries({ queryKey: ["concierge", "agency"] });
    } finally {
      setBusy(false);
    }
  }

  async function submitDeliverable() {
    if (!deliverTitle.trim() || !ministerBody.trim() || !chamber) return;
    setBusy(true);
    try {
      await attachDeliverable({
        data: {
          request_id: id,
          title: deliverTitle,
          minister_body_md: ministerBody,
          chamber,
        },
      });
      setDeliverTitle("");
      setMinisterBody("");
      setOpen(false);
      await qc.invalidateQueries({ queryKey: ["concierge", "agency"] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="border border-line-200 bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-ink-500">
            <span className="border border-line-300 px-1.5 py-0.5 font-mono uppercase tracking-[0.15em]">
              {row.country_code as string}
            </span>
            {lex && <span className="font-mono uppercase tracking-[0.15em]">{lex.requestShapeShort}</span>}
            <span className="font-mono uppercase tracking-[0.15em]">{status}</span>
            {row.submitted_at ? (
              <time className="text-ink-500" dateTime={row.submitted_at as string}>
                {new Date(row.submitted_at as string).toLocaleString()}
              </time>
            ) : null}
          </div>
          <p className="mt-2 font-serif text-lg text-ink-950">
            {(row.question as string) || (row.minister_summary as string) || "Untitled"}
          </p>
          {row.why_it_matters ? (
            <p className="mt-1 text-sm text-ink-500 line-clamp-2">{row.why_it_matters as string}</p>
          ) : null}
        </div>
        <Link
          to="/concierge/$id"
          params={{ id }}
          target="_blank"
          className="flex items-center gap-1 text-xs uppercase tracking-[0.15em] text-ink-500 hover:text-ink-950"
        >
          Minister view <ExternalLink size={12} />
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {STATUSES.filter((s) => s !== status).slice(0, 5).map((s) => (
          <button
            key={s}
            onClick={() => changeStatus(s)}
            disabled={busy}
            className="border border-line-300 px-2.5 py-1 text-[11px] uppercase tracking-[0.15em] text-ink-500 hover:border-ink-950 hover:text-ink-950 disabled:opacity-40"
          >
            → {s}
          </button>
        ))}
        <button
          onClick={() => setOpen((o) => !o)}
          className="ml-auto border border-ink-950 bg-ink-950 px-3 py-1 text-[11px] uppercase tracking-[0.15em] text-paper-50 hover:opacity-90"
        >
          {open ? "Cancel" : "Attach deliverable"}
        </button>
      </div>

      {open && (
        <div className="mt-4 border-t border-line-200 pt-4">
          <input
            value={deliverTitle}
            onChange={(e) => setDeliverTitle(e.target.value)}
            placeholder="Title (e.g. Q3 economic brief)"
            className="w-full border border-line-300 bg-transparent px-3 py-2 text-sm"
          />
          <textarea
            value={ministerBody}
            onChange={(e) => setMinisterBody(e.target.value)}
            placeholder="Minister-facing markdown body… (internal jargon will be scrubbed automatically)"
            rows={6}
            className="mt-2 w-full border border-line-300 bg-transparent p-3 text-sm"
          />
          <div className="mt-2 flex justify-end">
            <button
              onClick={submitDeliverable}
              disabled={busy || !deliverTitle.trim() || !ministerBody.trim()}
              className="flex items-center gap-2 bg-ink-950 px-4 py-2 text-xs uppercase tracking-[0.15em] text-paper-50 disabled:opacity-40"
            >
              {busy && <Loader2 size={12} className="animate-spin" />}
              Deliver to Minister
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
