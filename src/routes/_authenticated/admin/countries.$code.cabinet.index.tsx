import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Suspense, useState, useMemo } from "react";
import {
  ArrowUpRight, Calendar, CheckCircle2, Clock, Landmark, PlusCircle,
  ShieldAlert, Sparkles, Activity, ChevronRight, TrendingUp, AlertTriangle, Users,
} from "lucide-react";

import { SuperAdminShell } from "@/components/admin/SuperAdminShell";
import {
  getRoomOverview, createCabinetSession, addSignalToAgenda, listRegister, updateCommitment,
  type SignalRow, type RegisterRow,
} from "@/lib/cabinet.functions";
import { SituationHero } from "@/components/cabinet/SituationHero";
import { StateOfNationBrief, briefQuery } from "@/components/cabinet/StateOfNationBrief";
import { SituationBoard } from "@/components/cabinet/SituationBoard";
import { DecisionQueue, decisionQueueQuery } from "@/components/cabinet/DecisionQueue";
import { MinistryReadinessMatrix, readinessQuery } from "@/components/cabinet/MinistryReadinessMatrix";
import { CommitmentsCockpit, cockpitQuery } from "@/components/cabinet/CommitmentsCockpit";

function overviewQuery(code: string) {
  return queryOptions({
    queryKey: ["cabinet","overview", code],
    queryFn: () => getRoomOverview({ data: { countryCode: code } }),
  });
}
function registerQuery(code: string) {
  return queryOptions({
    queryKey: ["cabinet","register", code],
    queryFn: () => listRegister({ data: { countryCode: code } }),
  });
}

export const Route = createFileRoute("/_authenticated/admin/countries/$code/cabinet/")({
  head: ({ params }) => ({
    meta: [
      { title: `Cabinet Room · ${params.code} — GDPVision` },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: async ({ context, params }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(overviewQuery(params.code)),
      context.queryClient.ensureQueryData(registerQuery(params.code)),
      context.queryClient.ensureQueryData(briefQuery(params.code)),
      context.queryClient.ensureQueryData(decisionQueueQuery(params.code)),
      context.queryClient.ensureQueryData(readinessQuery(params.code)),
      context.queryClient.ensureQueryData(cockpitQuery(params.code)),
    ]);
  },
  errorComponent: ({ error }) => (
    <div className="min-h-dvh grid place-items-center bg-paper-0 p-8 text-center">
      <p className="max-w-md text-sm text-red-600">{error.message}</p>
    </div>
  ),
  component: CabinetRoomPage,
});


type TabKey = "room" | "signals" | "register" | "sessions";

function CabinetRoomPage() {
  const { code } = Route.useParams();
  const [tab, setTab] = useState<TabKey>("room");
  return (
    <SuperAdminShell
      crumbs={[
        { label: "Countries", to: "/admin/countries" },
        { label: code, to: "/admin/countries/$code/onboard", params: { code } },
        { label: "Cabinet" },
      ]}
    >
      <div className="min-h-dvh bg-paper-0 text-ink-950">
        <Header code={code} />
        <nav className="sticky top-0 z-10 border-b border-line-200 bg-paper-0/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl gap-1 px-6 md:px-10">
            {(["room","signals","register","sessions"] as TabKey[]).map((k) => (
              <button key={k} onClick={() => setTab(k)}
                className={`relative px-4 py-3 font-mono text-[10px] uppercase tracking-[0.25em] ${
                  tab === k ? "text-ink-950" : "text-ink-500 hover:text-ink-950"
                }`}
              >
                {k === "room" ? "The Room" : k === "signals" ? "Signals" : k === "register" ? "Register" : "Sessions"}
                {tab === k && <span className="absolute inset-x-2 bottom-0 h-[2px] bg-ink-950" />}
              </button>
            ))}
          </div>
        </nav>
        <main className="mx-auto max-w-7xl px-6 py-8 md:px-10">
          <Suspense fallback={<div className="h-96 animate-pulse rounded border border-line-200 bg-paper-0" />}>
            {tab === "room" && <RoomTab code={code} />}
            {tab === "signals" && <SignalsTab code={code} />}
            {tab === "register" && <RegisterTab code={code} />}
            {tab === "sessions" && <SessionsTab code={code} />}
          </Suspense>
        </main>
      </div>
    </SuperAdminShell>
  );
}

function Header({ code }: { code: string }) {
  return (
    <header className="relative overflow-hidden border-b border-line-200 bg-gradient-to-br from-paper-0 via-paper-0 to-[color-mix(in_oklab,var(--color-gold-500)_6%,transparent)]">
      <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-[color-mix(in_oklab,var(--color-gold-500)_10%,transparent)] blur-3xl" aria-hidden />
      <div className="mx-auto max-w-7xl px-6 py-10 md:px-10">
        <div className="flex items-center justify-between">
          <Link to="/admin/countries/$code/onboard" params={{ code }}
            className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-500 hover:text-ink-950">
            ← {code}
          </Link>
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-ink-500">
            <Landmark size={12} strokeWidth={1.5} />
            Chamber 06 · The Cabinet Room
          </div>
        </div>
        <div className="mt-6">
          <h1 className="font-serif text-4xl leading-tight md:text-5xl">The Cabinet Room</h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-500">
            One place to prepare, hold, and follow through on cabinet business — signal-linked agendas,
            evidence-anchored briefs, live decision capture, and a tracked commitments register.
          </p>
        </div>
      </div>
    </header>
  );
}

/* ────────── ROOM TAB — Prime-Time Situation Room ────────── */

function RoomTab({ code }: { code: string }) {
  const { data: overview } = useSuspenseQuery(overviewQuery(code));
  const nav = useNavigate();
  const qc = useQueryClient();
  const create = useServerFn(createCabinetSession);
  const [posture, setPosture] = useState<Record<string, string>>({});

  const createMut = useMutation({
    mutationFn: (title: string) => create({ data: {
      countryCode: code,
      title,
      scheduledFor: new Date(Date.now() + 7*24*3600*1000).toISOString(),
      classification: "restricted",
    }}),
    onSuccess: ({ id }) => {
      qc.invalidateQueries({ queryKey: ["cabinet"] });
      nav({ to: "/admin/countries/$code/cabinet/agenda/$sid", params: { code, sid: id } });
    },
  });

  return (
    <div className="-mx-6 md:-mx-10">
      <SituationHero code={code} overview={overview} posture={posture}
        onSchedule={() => {
          const t = window.prompt("Session title", `Cabinet — ${new Date().toLocaleDateString()}`);
          if (t) createMut.mutate(t);
        }} />

      <div className="mx-auto max-w-7xl space-y-10 px-6 py-8 md:px-10">
        <Suspense fallback={<div className="h-40 animate-pulse border border-line-200" />}>
          <StateOfNationBrief code={code} onPosture={setPosture} />
        </Suspense>

        <Suspense fallback={<div className="h-72 animate-pulse border border-line-200" />}>
          <SituationBoard code={code} />
        </Suspense>

        <Suspense fallback={<div className="h-64 animate-pulse border border-line-200" />}>
          <DecisionQueue code={code} overview={overview} />
        </Suspense>

        <Suspense fallback={<div className="h-64 animate-pulse border border-line-200" />}>
          <MinistryReadinessMatrix code={code} />
        </Suspense>

        <Suspense fallback={<div className="h-64 animate-pulse border border-line-200" />}>
          <CommitmentsCockpit code={code} />
        </Suspense>
      </div>
    </div>
  );
}


function Stat({ label, value, hint, icon }: { label: string; value: string; hint: string; icon: React.ReactNode }) {
  return (
    <div className="border border-line-200 bg-paper-0 p-4">
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-ink-500">
        {icon}{label}
      </div>
      <div className="mt-2 font-serif text-2xl tabular-nums">{value}</div>
      <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">{hint}</div>
    </div>
  );
}

function Panel({ title, eyebrow, children }: { title: string; eyebrow?: string; children: React.ReactNode }) {
  return (
    <div className="border border-line-200 bg-paper-0 p-5">
      {eyebrow && <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-500">{eyebrow}</div>}
      <h3 className="font-serif text-lg">{title}</h3>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function ReadinessBar({ pct }: { pct: number }) {
  return (
    <div>
      <div className="h-2 w-full overflow-hidden rounded-full border border-line-200 bg-paper-0">
        <div className="h-full bg-ink-950" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
        {pct}% of items brief-ready
      </div>
    </div>
  );
}

function Sparkbar({ data }: { data: number[] }) {
  const max = Math.max(1, ...data);
  return (
    <div className="flex h-14 items-end gap-1">
      {data.map((v, i) => (
        <div key={i} className="flex-1 bg-ink-950/80" style={{ height: `${(v / max) * 100}%`, minHeight: v ? 2 : 1 }} title={String(v)} />
      ))}
    </div>
  );
}

function HeatBar({ heat }: { heat: Record<string, number> }) {
  const order: Array<[string, string]> = [
    ["open", "bg-ink-500/30"],
    ["in_progress", "bg-gold-500/60"],
    ["delivered", "bg-emerald-500/60"],
    ["blocked", "bg-red-500/60"],
    ["cancelled", "bg-ink-500/20"],
  ];
  const total = order.reduce((s, [k]) => s + (heat[k] ?? 0), 0) || 1;
  return (
    <div className="space-y-3">
      <div className="flex h-3 w-full overflow-hidden rounded border border-line-200">
        {order.map(([k, cls]) => (
          <div key={k} className={cls} style={{ width: `${((heat[k] ?? 0)/total)*100}%` }} title={`${k}: ${heat[k] ?? 0}`} />
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[11px] text-ink-500 sm:grid-cols-3">
        {order.map(([k]) => (
          <li key={k} className="flex justify-between">
            <span className="uppercase tracking-[0.18em]">{k.replace("_"," ")}</span>
            <span className="tabular-nums text-ink-950">{heat[k] ?? 0}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SignalList({ signals }: { signals: SignalRow[] }) {
  if (!signals.length) return <p className="text-sm text-ink-500">Nothing urgent — good work.</p>;
  return (
    <ul className="divide-y divide-line-200">
      {signals.map((s) => (
        <li key={`${s.kind}-${s.id}`} className="py-2">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm text-ink-950">{s.title}</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">{s.meta}{s.priority ? ` · ${s.priority}` : ""}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ────────── SIGNALS TAB ────────── */

function SignalsTab({ code }: { code: string }) {
  const { data } = useSuspenseQuery(overviewQuery(code));
  const qc = useQueryClient();
  const addToAgenda = useServerFn(addSignalToAgenda);
  const create = useServerFn(createCabinetSession);
  const [busy, setBusy] = useState<string | null>(null);

  const activeSession = data.nextSession;

  const addMut = useMutation({
    mutationFn: async (s: SignalRow) => {
      let sessionId = activeSession?.id;
      if (!sessionId) {
        const { id } = await create({ data: {
          countryCode: code,
          title: `Cabinet — ${new Date().toLocaleDateString()}`,
          scheduledFor: new Date(Date.now() + 7*24*3600*1000).toISOString(),
          classification: "restricted",
        }});
        sessionId = id;
      }
      return addToAgenda({ data: {
        countryCode: code,
        sessionId,
        signal: { kind: s.kind, id: s.id, title: s.title, meta: s.meta ?? null },
      }});
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cabinet"] }),
  });

  return (
    <div className="space-y-6">
      <div className="border border-line-200 bg-paper-0 p-4">
        <div className="flex items-baseline justify-between">
          <div>
            <h3 className="font-serif text-lg">Signals inbox</h3>
            <p className="mt-1 text-sm text-ink-500">
              Anything from Narrative, Studio, Scenarios or the Ledger that a PM should see this week.
              Add to next agenda in one click.
            </p>
          </div>
          {activeSession
            ? <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">Target: {activeSession.title}</span>
            : <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">No session — one will be scheduled</span>}
        </div>
      </div>

      {data.signals.length === 0 ? (
        <p className="text-sm text-ink-500">No new signals today.</p>
      ) : (
        <ul className="divide-y divide-line-200 border-y border-line-200">
          {data.signals.map((s) => {
            const key = `${s.kind}-${s.id}`;
            return (
              <li key={key} className="grid grid-cols-[auto,1fr,auto] items-center gap-4 py-3">
                <SignalIcon kind={s.kind} />
                <div className="min-w-0">
                  <div className="truncate text-sm text-ink-950">{s.title}</div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
                    {s.meta}{s.priority ? ` · ${s.priority}` : ""} · {s.hint}
                  </div>
                </div>
                <button
                  disabled={busy === key || addMut.isPending}
                  onClick={() => { setBusy(key); addMut.mutate(s, { onSettled: () => setBusy(null) }); }}
                  className="inline-flex items-center gap-2 border border-ink-950 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-950 hover:bg-ink-950 hover:text-paper-0 disabled:opacity-50">
                  <PlusCircle size={12} /> Add to agenda
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function SignalIcon({ kind }: { kind: SignalRow["kind"] }) {
  const map = {
    narrative: <Activity size={14} />,
    strategy: <ShieldAlert size={14} />,
    scenario: <Sparkles size={14} />,
    grade: <AlertTriangle size={14} />,
  } as const;
  return (
    <span className="grid h-8 w-8 place-items-center border border-line-200 text-ink-950">
      {map[kind]}
    </span>
  );
}

/* ────────── REGISTER TAB ────────── */

function RegisterTab({ code }: { code: string }) {
  const { data } = useSuspenseQuery(registerQuery(code));
  const [filter, setFilter] = useState<"all"|"decision"|"commitment"|"overdue">("all");
  const qc = useQueryClient();
  const update = useServerFn(updateCommitment);
  const statusMut = useMutation({
    mutationFn: (v: { id: string; status: "open"|"in_progress"|"delivered"|"blocked"|"cancelled" }) =>
      update({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cabinet","register", code] }),
  });

  const rows = useMemo(() => {
    if (filter === "all") return data;
    if (filter === "overdue") return data.filter((r) => r.overdue);
    return data.filter((r) => r.kind === filter);
  }, [data, filter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {(["all","decision","commitment","overdue"] as const).map((k) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] ${
              filter === k ? "border-ink-950 bg-ink-950 text-paper-0" : "border-line-200 text-ink-500 hover:border-ink-950 hover:text-ink-950"
            }`}>
            {k} <span className="ml-1 tabular-nums opacity-70">
              {k === "all" ? data.length : k === "overdue" ? data.filter(r=>r.overdue).length : data.filter(r=>r.kind===k).length}
            </span>
          </button>
        ))}
      </div>

      <div className="overflow-hidden border border-line-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line-200 bg-paper-0/60 text-left font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
              <th className="px-3 py-2">Kind</th>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Owner</th>
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-ink-500">Nothing here yet.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={`${r.kind}-${r.id}`} className={`border-b border-line-200 ${r.overdue ? "bg-red-50/50" : ""}`}>
                <td className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">{r.kind}</td>
                <td className="px-3 py-2">{r.title}</td>
                <td className="px-3 py-2 text-ink-500">{r.ministry_name ?? "—"}</td>
                <td className="px-3 py-2 tabular-nums text-ink-500">{r.when ? new Date(r.when).toLocaleDateString() : "—"}</td>
                <td className="px-3 py-2">
                  {r.kind === "commitment" ? (
                    <select
                      value={r.status}
                      onChange={(e) => statusMut.mutate({ id: r.id, status: e.target.value as RegisterRow["status"] as "open"|"in_progress"|"delivered"|"blocked"|"cancelled" })}
                      className="border border-line-200 bg-paper-0 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.2em]">
                      {["open","in_progress","delivered","blocked","cancelled"].map(s => <option key={s}>{s}</option>)}
                    </select>
                  ) : (
                    <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">{r.status}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ────────── SESSIONS TAB ────────── */

function SessionsTab({ code }: { code: string }) {
  const { data } = useSuspenseQuery(overviewQuery(code));
  const nav = useNavigate();
  const qc = useQueryClient();
  const create = useServerFn(createCabinetSession);
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState<string>(() => new Date(Date.now() + 7*24*3600*1000).toISOString().slice(0,16));
  const createMut = useMutation({
    mutationFn: () => create({ data: {
      countryCode: code,
      title: title.trim() || `Cabinet — ${new Date().toLocaleDateString()}`,
      scheduledFor: new Date(when).toISOString(),
      classification: "restricted",
    }}),
    onSuccess: ({ id }) => {
      setTitle("");
      qc.invalidateQueries({ queryKey: ["cabinet"] });
      nav({ to: "/admin/countries/$code/cabinet/agenda/$sid", params: { code, sid: id } });
    },
  });

  return (
    <div className="space-y-8">
      <form onSubmit={(e) => { e.preventDefault(); createMut.mutate(); }}
        className="grid grid-cols-1 gap-3 border border-line-200 bg-paper-0 p-4 md:grid-cols-[1fr,auto,auto]">
        <input value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="New session title"
          className="border border-line-200 bg-paper-0 px-3 py-2 text-sm focus:border-ink-950 focus:outline-none" />
        <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)}
          className="border border-line-200 bg-paper-0 px-3 py-2 text-sm font-mono" />
        <button className="inline-flex items-center gap-2 border border-ink-950 bg-ink-950 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-paper-0 hover:opacity-90" disabled={createMut.isPending}>
          <PlusCircle size={14} /> Schedule
        </button>
      </form>

      <ul className="divide-y divide-line-200 border-y border-line-200">
        {data.sessions.length === 0 && <li className="py-8 text-center text-sm text-ink-500">No sessions yet.</li>}
        {data.sessions.map((s) => (
          <li key={s.id} className="grid grid-cols-[1fr,auto,auto] items-center gap-4 py-3">
            <div className="min-w-0">
              <div className="truncate text-sm text-ink-950">{s.title}</div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
                {s.classification} · {s.agenda_count} items · {s.closed_at ? "closed" : s.held_at ? "held" : s.scheduled_for ? new Date(s.scheduled_for).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "draft"}
              </div>
            </div>
            <LinkBtn to="/admin/countries/$code/cabinet/agenda/$sid" params={{ code, sid: s.id }} icon={<ChevronRight size={12} />}>
              Agenda
            </LinkBtn>
            {s.closed_at ? (
              <LinkBtn to="/admin/countries/$code/cabinet/minutes/$sid" params={{ code, sid: s.id }} icon={<Users size={12} />}>
                Minutes
              </LinkBtn>
            ) : (
              <LinkBtn to="/admin/countries/$code/cabinet/session/$sid" params={{ code, sid: s.id }} primary icon={<Sparkles size={12} />}>
                Session Mode
              </LinkBtn>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ────────── Shared ────────── */

function LinkBtn({ to, params, primary, icon, children }: {
  to: string; params: Record<string,string>; primary?: boolean; icon?: React.ReactNode; children: React.ReactNode;
}) {
  const cls = primary
    ? "inline-flex items-center gap-2 border border-ink-950 bg-ink-950 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-paper-0 hover:opacity-90"
    : "inline-flex items-center gap-2 border border-line-200 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-950 hover:border-ink-950";
  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <Link to={to as any} params={params as any} className={cls}>
      {children}{icon ?? <ArrowUpRight size={12} />}
    </Link>
  );
}
