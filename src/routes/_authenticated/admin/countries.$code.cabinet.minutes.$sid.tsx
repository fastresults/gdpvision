import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";

import { SuperAdminShell } from "@/components/admin/SuperAdminShell";
import { getMinutes, type MinutesData } from "@/lib/cabinet.functions";
import { CopyButton } from "@/components/ui/copy-button";

function minutesQuery(sid: string) {
  return queryOptions({
    queryKey: ["cabinet","minutes", sid],
    queryFn: () => getMinutes({ data: { sessionId: sid } }),
  });
}

export const Route = createFileRoute("/_authenticated/admin/countries/$code/cabinet/minutes/$sid")({
  head: ({ params }) => ({ meta: [{ title: `Minutes · ${params.code} — GDPVision` }, { name: "robots", content: "noindex" }] }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(minutesQuery(params.sid)),
  errorComponent: ({ error }) => (<div className="min-h-dvh grid place-items-center p-8"><p className="text-sm text-red-600">{error.message}</p></div>),
  component: MinutesPage,
});

function MinutesPage() {
  const { code, sid } = Route.useParams();
  const { data } = useSuspenseQuery(minutesQuery(sid));
  const md = buildMinutesMarkdown(data);

  return (
    <SuperAdminShell crumbs={[
      { label: "Countries", to: "/admin/countries" },
      { label: code, to: "/admin/countries/$code/onboard", params: { code } },
      { label: "Cabinet", to: "/admin/countries/$code/cabinet", params: { code } },
      { label: "Minutes" },
    ]}>
      <div className="min-h-dvh bg-paper-0">
        <div className="border-b border-line-200">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
            <Link to="/admin/countries/$code/cabinet" params={{ code }} className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500 hover:text-ink-950">
              <ArrowLeft size={12} /> Room
            </Link>
            <div className="flex items-center gap-2">
              <CopyButton value={md} label="Copy minutes" variant="chip" />
              <button onClick={() => window.print()} className="inline-flex items-center gap-2 border border-line-200 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] hover:border-ink-950">
                <Printer size={12} /> Print
              </button>
            </div>
          </div>
        </div>

        <article className="mx-auto max-w-4xl px-6 py-10 print:px-0">
          <header>
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-500">
              {data.session.classification} · {data.session.held_at ? new Date(data.session.held_at).toLocaleString() : "—"}
            </div>
            <h1 className="mt-2 font-serif text-3xl">{data.session.title}</h1>
            {data.session.chair_name && (
              <div className="mt-2 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
                Signed by {data.session.chair_name}{data.session.chair_signed_at ? ` · ${new Date(data.session.chair_signed_at).toLocaleString()}` : ""}
              </div>
            )}
          </header>

          {data.attendance.length > 0 && (
            <section className="mt-8">
              <h2 className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-500">Attendance</h2>
              <ul className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
                {data.attendance.map((a, i) => (
                  <li key={i} className="text-sm">
                    <span className={a.present ? "" : "line-through text-ink-500"}>{a.attendee_name}</span>
                    {a.role && <span className="ml-2 text-ink-500">— {a.role}</span>}
                    {a.is_chair && <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.2em] text-gold-500">Chair</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="mt-8 space-y-8">
            {data.items.map((it, i) => (
              <article key={it.id} className="border-t border-line-200 pt-6">
                <div className="flex items-baseline justify-between">
                  <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-500">Item {i + 1} · {it.classification} · {it.time_box_min} min</div>
                  {it.decision && (
                    <span className={`inline-block border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] ${
                      it.decision.motion_kind === "approve" ? "border-emerald-600 text-emerald-700"
                      : it.decision.motion_kind === "note" ? "border-line-200 text-ink-500"
                      : "border-gold-500 text-gold-500"
                    }`}>{it.decision.motion_kind}</span>
                  )}
                </div>
                <h3 className="mt-1 font-serif text-xl">{it.title}</h3>
                {it.sponsor_ministry_name && <div className="text-sm text-ink-500">Sponsor: {it.sponsor_ministry_name}</div>}
                {it.recommendation && (
                  <div className="mt-3 border-l-2 border-line-200 pl-3 text-sm">
                    <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">Recommendation · </span>
                    {it.recommendation}
                  </div>
                )}
                {it.brief_md && (
                  <p className="mt-3 whitespace-pre-wrap font-serif text-sm leading-relaxed text-ink-950">{it.brief_md}</p>
                )}
                {it.decision && (
                  <div className="mt-4 border border-line-200 p-3">
                    <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">Decision</div>
                    <div className="mt-1 font-serif">{it.decision.title}</div>
                    {it.decision.body && <p className="mt-1 text-sm text-ink-500">{it.decision.body}</p>}
                    {it.vote && (
                      <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500 tabular-nums">
                        Vote — For {it.vote.for_count} · Against {it.vote.against_count} · Abstain {it.vote.abstain_count}
                      </div>
                    )}
                  </div>
                )}
                {it.commitments.length > 0 && (
                  <div className="mt-3">
                    <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">Commitments</div>
                    <ul className="mt-1 space-y-1 text-sm">
                      {it.commitments.map((c) => (
                        <li key={c.id} className="flex items-baseline justify-between gap-2">
                          <span>{c.title}</span>
                          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
                            {c.ministry_name ?? "unassigned"}{c.due_at ? ` · due ${new Date(c.due_at).toLocaleDateString()}` : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {it.dossier.length > 0 && (
                  <ol className="mt-3 space-y-0.5 text-xs text-ink-500">
                    {it.dossier.map((d, di) => (
                      <li key={di}>[{di+1}] {d.label}{d.href ? ` — ${d.href}` : ""}</li>
                    ))}
                  </ol>
                )}
              </article>
            ))}
          </section>
        </article>
      </div>
    </SuperAdminShell>
  );
}

function buildMinutesMarkdown(m: MinutesData): string {
  const lines: string[] = [];
  lines.push(`# ${m.session.title}`);
  lines.push(`_${m.session.classification} · held ${m.session.held_at ?? "—"}_`);
  if (m.session.chair_name) lines.push(`Chair: **${m.session.chair_name}**`);
  if (m.attendance.length) {
    lines.push("\n## Attendance");
    for (const a of m.attendance) lines.push(`- ${a.attendee_name}${a.role ? ` — ${a.role}` : ""}${a.is_chair ? " (Chair)" : ""}${a.present ? "" : " [absent]"}`);
  }
  m.items.forEach((it, i) => {
    lines.push(`\n## Item ${i+1}. ${it.title}`);
    if (it.sponsor_ministry_name) lines.push(`_Sponsor: ${it.sponsor_ministry_name}_`);
    if (it.recommendation) lines.push(`**Recommendation.** ${it.recommendation}`);
    if (it.brief_md) lines.push(`\n${it.brief_md}`);
    if (it.decision) {
      lines.push(`\n**Decision (${it.decision.motion_kind}).** ${it.decision.title}`);
      if (it.decision.body) lines.push(it.decision.body);
      if (it.vote) lines.push(`_Vote — For ${it.vote.for_count} · Against ${it.vote.against_count} · Abstain ${it.vote.abstain_count}_`);
    }
    if (it.commitments.length) {
      lines.push(`\n**Commitments:**`);
      for (const c of it.commitments) lines.push(`- ${c.title}${c.ministry_name ? ` — ${c.ministry_name}` : ""}${c.due_at ? ` (due ${new Date(c.due_at).toLocaleDateString()})` : ""}`);
    }
    if (it.dossier.length) {
      lines.push(`\n_Evidence:_`);
      it.dossier.forEach((d, di) => lines.push(`  [${di+1}] ${d.label}${d.href ? ` — ${d.href}` : ""}`));
    }
  });
  return lines.join("\n");
}
