import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { adminDeepScrape, adminListSeries, adminSyncApply, adminSyncPreview } from "@/lib/events/admin-toolkit.functions";

export const Route = createFileRoute("/_authenticated/events-admin/sync")({
  head: () => ({ meta: [{ title: "Site sync — Events Admin" }, { name: "description", content: "Refresh editions from each summit website." }, { property: "og:title", content: "Site sync — Events Admin" }, { property: "og:description", content: "Refresh from summit websites." }] }),
  component: SyncPage,
});

function SyncPage() {
  const fn = useServerFn(adminListSeries);
  const q = useQuery({ queryKey: ["admin", "event-series"], queryFn: () => fn() });
  return (
    <div className="space-y-6">
      <h1 className="ev-display text-[56px]">Site sync</h1>
      <p className="max-w-2xl text-[15px]">Re-read a summit website and compare it with its latest edition here. Nothing is saved until you choose which changes to apply.</p>
      <div className="space-y-4">
        {(q.data ?? []).map((s) => <SyncRow key={s.id} id={s.id} name={s.name} site={s.site_url} last={s.last_synced_at} />)}
      </div>
    </div>
  );
}

function SyncRow({ id, name, site, last }: { id: string; name: string; site: string; last: string | null }) {
  const preview = useServerFn(adminSyncPreview);
  const apply = useServerFn(adminSyncApply);
  const qc = useQueryClient();
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const pm = useMutation({ mutationFn: () => preview({ data: { series_id: id } }), onSuccess: () => { setPicked({}); void qc.invalidateQueries({ queryKey: ["admin", "event-series"] }); } });
  const am = useMutation({
    mutationFn: () => {
      const r = pm.data!;
      if (!r.ok || !r.event) throw new Error("No edition to update.");
      return apply({ data: { event_id: r.event.id, snapshot_id: r.snapshot_id, summary: picked.summary ? r.found.description ?? undefined : undefined, hero_url: picked.hero_url ? r.found.image ?? undefined : undefined } });
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["admin", "events"] }); pm.reset(); },
  });
  const deep = useServerFn(adminDeepScrape);
  const dm = useMutation({ mutationFn: () => deep({ data: { series_id: id } }), onSuccess: () => { void qc.invalidateQueries({ queryKey: ["admin", "event-series"] }); } });
  const d = dm.data;
  const r = pm.data;
  return (
    <section className="rounded-2xl border-4 border-ev-ink bg-paper-0 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="ev-display text-[28px]">{name}</h2>
          <a href={site} target="_blank" rel="noreferrer" className="text-[13px] underline">{site.replace("https://", "")}</a>
          <span className="ml-3 text-[12px] opacity-70">{last ? `Last read ${new Date(last).toUTCString().slice(5, 22)}` : "Not read yet"}</span>
        </div>
        <button type="button" className="ev-btn-dark !py-2 !text-[14px]" disabled={pm.isPending} onClick={() => pm.mutate()}>
          {pm.isPending ? "Reading…" : "Refresh from site"}
        </button>
        <button type="button" className="ev-btn-dark !py-2 !text-[14px]" disabled={dm.isPending} onClick={() => dm.mutate()}>
          {dm.isPending ? "Reading every page…" : "Deep scrape"}
        </button>
      </div>
      {d && !d.ok && <p className="mt-3 text-signal-red">{d.error}</p>}
      {d && d.ok && (
        <div className="mt-4 rounded-xl border-2 border-ev-ink p-3 text-[14px]">
          <p className="font-bold">
            Read {d.found.pages} pages · {d.found.sessions} sessions · {d.found.speakers} speakers · {d.found.partners} partners · {d.found.photos} photos · {d.brain_records} Second Brain records updated
          </p>
          {d.found.conflicts.length > 0 && (
            <ul className="mt-2 list-disc pl-5">{d.found.conflicts.map((c) => <li key={c}>{c}</li>)}</ul>
          )}
          <p className="mt-2 text-[12px] opacity-70">Only empty fields are filled; nothing already set is overwritten. Re-runs update, never duplicate.</p>
        </div>
      )}
      {pm.error && <p className="mt-3 text-signal-red">{(pm.error as Error).message}</p>}
      {r && !r.ok && <p className="mt-3 text-signal-red">{r.error}</p>}
      {r && r.ok && (
        <div className="mt-4 space-y-3">
          {r.changes.length === 0 ? (
            <p className="text-[14px] font-semibold">No differences found against {r.event?.title ?? "this series"}.</p>
          ) : (
            r.changes.map((c) => (
              <div key={c.field} className="rounded-xl border-2 border-ev-ink p-3 text-[14px]">
                <div className="flex items-center gap-2 font-bold">
                  {c.field !== "date_text" && (
                    <input type="checkbox" aria-label={`Apply ${c.label}`} checked={!!picked[c.field]} onChange={(e) => setPicked((p) => ({ ...p, [c.field]: e.target.checked }))} />
                  )}
                  {c.label}
                  {c.field === "date_text" && <span className="text-[12px] font-normal">(update dates by hand in Events)</span>}
                </div>
                <div className="mt-1 grid gap-2 md:grid-cols-2">
                  <div><span className="text-[11px] font-bold uppercase">Here now</span><p className="break-words">{c.current ?? "—"}</p></div>
                  <div><span className="text-[11px] font-bold uppercase">On the website</span><p className="break-words">{c.found}</p></div>
                </div>
              </div>
            ))
          )}
          {r.changes.some((c) => c.field !== "date_text") && (
            <button type="button" className="ev-btn-primary !py-2 !text-[14px]" disabled={am.isPending || !Object.values(picked).some(Boolean)} onClick={() => am.mutate()}>
              Apply selected changes
            </button>
          )}
          {am.error && <p className="text-signal-red">{(am.error as Error).message}</p>}
        </div>
      )}
    </section>
  );
}
