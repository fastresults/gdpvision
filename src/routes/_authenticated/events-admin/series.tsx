import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { adminListSeries, adminSaveSeries } from "@/lib/events/admin-toolkit.functions";
import { EVENT_COLOURS } from "@/lib/events/rules";
import { COLOUR_BG, COLOUR_TEXT, formatEventDate } from "@/components/events/EventParts";

export const Route = createFileRoute("/_authenticated/events-admin/series")({
  head: () => ({ meta: [{ title: "Series — Events Admin" }, { name: "description", content: "The summit series and their editions." }, { property: "og:title", content: "Series — Events Admin" }, { property: "og:description", content: "Summit series." }] }),
  component: SeriesPage,
});

type S = Awaited<ReturnType<typeof adminListSeries>>[number];

function SeriesPage() {
  const fn = useServerFn(adminListSeries);
  const q = useQuery({ queryKey: ["admin", "event-series"], queryFn: () => fn() });
  const [editing, setEditing] = useState<S | null>(null);
  return (
    <div className="space-y-6">
      <h1 className="ev-display text-[56px]">Summit series</h1>
      {q.isLoading && <p>Loading…</p>}
      <div className="grid gap-6 md:grid-cols-2">
        {(q.data ?? []).map((s) => {
          const eds = ((s.events ?? []) as { id: string; slug: string; title: string; edition_label: string | null; status: string; starts_at: string | null; archived: boolean }[]).filter((e) => !e.archived);
          return (
            <article key={s.id} className={`rounded-2xl border-4 border-ev-ink p-5 ${COLOUR_BG[s.colour]} ${COLOUR_TEXT[s.colour]}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[12px] font-bold uppercase tracking-wider opacity-80">{s.short_name} · {s.sector}</div>
                  <h2 className="ev-display mt-1 text-[32px]">{s.name}</h2>
                  <a href={s.site_url} target="_blank" rel="noreferrer" className="text-[13px] underline">{s.site_url.replace("https://", "")}</a>
                </div>
                <button type="button" className="ev-btn-dark !px-4 !py-2 !text-[13px]" onClick={() => setEditing(s)}>Edit</button>
              </div>
              <ul className="mt-4 space-y-1 text-[14px]">
                {eds.length === 0 && <li>No editions yet.</li>}
                {eds.map((e) => (
                  <li key={e.id} className="flex justify-between gap-3 rounded-lg bg-ev-paper/90 px-3 py-1.5 text-ev-ink">
                    <span className="font-semibold">{e.edition_label ?? e.slug}</span>
                    <span>{formatEventDate(e.starts_at)} · {e.status === "published" ? "Published" : "Draft"}</span>
                  </li>
                ))}
              </ul>
              <Link to="/events/series/$slug" params={{ slug: s.slug }} className="mt-3 inline-block text-[13px] font-semibold underline">Public series page</Link>
            </article>
          );
        })}
      </div>
      {editing && <SeriesEditor s={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function SeriesEditor({ s, onClose }: { s: S; onClose: () => void }) {
  const save = useServerFn(adminSaveSeries);
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: (fd: FormData) => {
      const v = (k: string) => String(fd.get(k) ?? "").trim() || null;
      return save({ data: { id: s.id, slug: s.slug, name: v("name")!, short_name: v("short_name"), site_url: v("site_url")!, sector: v("sector"), colour: String(fd.get("colour")) as "sea", logo_url: v("logo_url"), summary: v("summary"), position: s.position } });
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["admin", "event-series"] }); onClose(); },
  });
  const field = "rounded-lg border-2 border-ev-ink bg-ev-paper px-3 py-2 text-[14px]";
  return (
    <form className="grid gap-3 rounded-2xl border-4 border-ev-ink bg-ev-paper p-6 md:grid-cols-2" onSubmit={(e) => { e.preventDefault(); mut.mutate(new FormData(e.currentTarget)); }}>
      <h2 className="ev-display text-[32px] md:col-span-2">Edit {s.short_name ?? s.name}</h2>
      <label className="grid gap-1 text-[13px] font-semibold">Name<input name="name" defaultValue={s.name} required className={field} /></label>
      <label className="grid gap-1 text-[13px] font-semibold">Short name<input name="short_name" defaultValue={s.short_name ?? ""} className={field} /></label>
      <label className="grid gap-1 text-[13px] font-semibold">Website<input name="site_url" type="url" defaultValue={s.site_url} required className={field} /></label>
      <label className="grid gap-1 text-[13px] font-semibold">Sector<input name="sector" defaultValue={s.sector ?? ""} className={field} /></label>
      <label className="grid gap-1 text-[13px] font-semibold">Logo address<input name="logo_url" defaultValue={s.logo_url ?? ""} className={field} /></label>
      <label className="grid gap-1 text-[13px] font-semibold">Colour
        <select name="colour" defaultValue={s.colour} className={field}>{EVENT_COLOURS.map((c) => <option key={c}>{c}</option>)}</select>
      </label>
      <label className="grid gap-1 text-[13px] font-semibold md:col-span-2">Series story<textarea name="summary" rows={3} defaultValue={s.summary ?? ""} className={field} /></label>
      {mut.error && <p className="text-signal-red md:col-span-2">{(mut.error as Error).message}</p>}
      <div className="flex gap-3 md:col-span-2">
        <button type="submit" className="ev-btn-dark" disabled={mut.isPending}>Save series</button>
        <button type="button" className="ev-btn-primary" onClick={onClose}>Cancel</button>
      </div>
    </form>
  );
}
