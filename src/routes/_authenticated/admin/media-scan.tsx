import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { SuperAdminShell } from "@/components/admin/SuperAdminShell";
import { MediaSourcesPanel } from "@/components/narrative/MediaSourcesPanel";
import { Explain } from "@/components/explain/Explain";
import "@/lib/explain/narrative-entries";
import {
  deleteOutlet,
  discoverCountryOutlets,
  getMediaScanOverview,
  runMediaScan,
  syncSharedOutlets,
  upsertOutlet,
} from "@/lib/media-scan.functions";

export const Route = createFileRoute("/_authenticated/admin/media-scan")({
  head: () => ({
    meta: [
      { title: "Media Scan — GDPVision" },
      { name: "description", content: "Run and monitor the Caribbean press scan for the Narrative Chamber." },
      { property: "og:title", content: "Media Scan — GDPVision" },
      { property: "og:description", content: "Caribbean politics and GDP press coverage control centre." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MediaScanPage,
});

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "—");

function MediaScanPage() {
  const qc = useQueryClient();
  const overview = useServerFn(getMediaScanOverview);
  const run = useServerFn(runMediaScan);
  const sync = useServerFn(syncSharedOutlets);
  const discover = useServerFn(discoverCountryOutlets);
  const save = useServerFn(upsertOutlet);
  const remove = useServerFn(deleteOutlet);
  const q = useQuery({ queryKey: ["admin", "media-scan"], queryFn: () => overview(), refetchInterval: 15_000 });
  const refresh = () => void qc.invalidateQueries({ queryKey: ["admin", "media-scan"] });
  const [msg, setMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<"overview" | "sources">("overview");
  const [country, setCountry] = useState<string>("");
  const [form, setForm] = useState({ name: "", domain: "", feed_url: "", scope: "regional" as "regional" | "international", credibility: 3 });

  const scan = useMutation({
    mutationFn: () => run({ data: { countryCode: country || null } }),
    onSuccess: (r) => {
      setMsg(`Scan finished: ${r.feeds_polled} feeds read, ${r.items_new} new articles, ${r.items_promoted} signals added.`);
      refresh();
    },
    onError: (e) => setMsg((e as Error).message),
  });
  const doSync = useMutation({
    mutationFn: () => sync(),
    onSuccess: (r) => { setMsg(`${r.linked} of ${r.outlets} shared outlets now feed the scan.`); refresh(); },
    onError: (e) => setMsg((e as Error).message),
  });
  const find = useMutation({
    mutationFn: (c: { code: string; name: string }) => discover({ data: c }),
    onSuccess: (r) => { setMsg(`Found ${r.suggested} outlets, added ${r.inserted} new feeds.`); refresh(); },
    onError: (e) => setMsg((e as Error).message),
  });
  const add = useMutation({
    mutationFn: () => save({ data: { ...form, feed_url: form.feed_url || null, active: true } }),
    onSuccess: () => { setForm({ ...form, name: "", domain: "", feed_url: "" }); refresh(); },
    onError: (e) => setMsg((e as Error).message),
  });
  const del = useMutation({ mutationFn: (id: string) => remove({ data: { id } }), onSuccess: refresh });

  const d = q.data;
  return (
    <SuperAdminShell eyebrow="Narrative Chamber" crumbs={[{ label: "Media Scan" }]}>
      <h1 className="font-display text-3xl text-ink-950">Media Scan</h1>
      <p className="mt-2 max-w-3xl text-ink-600">
        Reads every Caribbean, regional and international news feed, keeps politics and GDP stories, checks each link,
        tags it by country and ranks it by{" "}
        <Explain id="narrative.priority-score">importance</Explain>.
      </p>

      <div className="mt-6 flex gap-1" role="tablist">
        {(["overview", "sources"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "btn-primary" : "btn-ghost"} onClick={() => setTab(t)}>
            {t === "overview" ? "Scan & coverage" : "Sources"}
          </button>
        ))}
      </div>

      {tab === "sources" ? (
        <div className="mt-6 mb-16"><MediaSourcesPanel /></div>
      ) : (
      <>
      <section className="mt-6 flex flex-wrap items-end gap-3 border border-line-200 bg-paper-0 p-4">
        <label className="text-sm text-ink-700">
          Scope
          <select className="ml-2 border border-line-200 bg-paper-0 px-2 py-1" value={country} onChange={(e) => setCountry(e.target.value)}>
            <option value="">All countries + shared outlets</option>
            {(d?.coverage ?? []).map((c) => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>
        </label>
        <button className="btn-primary" disabled={scan.isPending || !!d?.running} onClick={() => scan.mutate()}>
          {scan.isPending || d?.running ? "Scanning…" : "Run scan now"}
        </button>
        <button className="btn-secondary" disabled={doSync.isPending} onClick={() => doSync.mutate()}>
          {doSync.isPending ? "Linking outlets…" : "Link shared outlets"}
        </button>
        {d?.running && <span className="text-sm text-ink-600">A scan is running (until {fmt(d.running.expires_at)}).</span>}
        {msg && <p className="w-full text-sm text-ink-800">{msg}</p>}
      </section>

      <section className="mt-8">
        <h2 className="font-display text-xl text-ink-950">Coverage by country (last 7 days)</h2>
        <p className="text-sm text-ink-600">Thinnest coverage first. Rows with fewer than 4 feeds are highlighted.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left font-mono text-[11px] uppercase tracking-wider text-ink-500">
              <tr>
                <th className="py-2">Country</th><th>Feeds</th><th>Failing</th><th>Signals</th><th>Politics</th><th>GDP</th>
                <th><Explain id="narrative.link-status">Broken links</Explain></th><th>S1–S2 sources</th><th>P1–P2 this week</th><th>Last read</th><th />
              </tr>
            </thead>
            <tbody>
              {(d?.coverage ?? []).map((c) => (
                <tr key={c.code} className={`border-t border-line-100 ${c.active_feeds < 4 ? "bg-gold-300/20" : ""}`}>
                  <td className="py-2 text-ink-900">
                    {c.name} <span className="font-mono text-[11px] text-ink-500">{c.code}{c.media_only ? " · media only" : ""}</span>
                  </td>
                  <td className="tabular-nums">{c.active_feeds}</td>
                  <td className="tabular-nums">{c.failing_feeds}</td>
                  <td className="tabular-nums">{c.signals_7d}</td>
                  <td className="tabular-nums">{c.political_7d}</td>
                  <td className="tabular-nums">{c.economic_7d}</td>
                  <td className="tabular-nums">{c.broken_links_7d}</td>
                  <td className="tabular-nums">{c.strong_sources}</td>
                  <td className="tabular-nums">{c.p12_7d}</td>
                  <td className="text-ink-600">{fmt(c.last_polled_at)}</td>
                  <td className="text-right">
                    {c.code !== "CAR" && (
                      <button className="btn-ghost" disabled={find.isPending} onClick={() => find.mutate({ code: c.code, name: c.name })}>
                        Find outlets
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl text-ink-950">Shared regional & international outlets</h2>
        <p className="text-sm text-ink-600">Each article from these is matched to every country it mentions.</p>
        <div className="mt-3 grid gap-2 md:grid-cols-6">
          <input className="border border-line-200 px-2 py-1 md:col-span-1" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="border border-line-200 px-2 py-1 md:col-span-1" placeholder="Website (e.g. medaily.com)" value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} />
          <input className="border border-line-200 px-2 py-1 md:col-span-2" placeholder="Feed link (optional)" value={form.feed_url} onChange={(e) => setForm({ ...form, feed_url: e.target.value })} />
          <select className="border border-line-200 px-2 py-1" value={`${form.scope}:${form.credibility}`} onChange={(e) => { const [s, c] = e.target.value.split(":"); setForm({ ...form, scope: s as "regional" | "international", credibility: Number(c) }); }}>
            {["regional", "international"].flatMap((s) => [3, 4, 5].map((c) => (
              <option key={`${s}:${c}`} value={`${s}:${c}`}>{s} · credibility {c}</option>
            )))}
          </select>
          <button className="btn-primary" disabled={add.isPending || !form.name || !form.domain} onClick={() => add.mutate()}>Add outlet</button>
        </div>
        <table className="mt-4 w-full text-sm">
          <thead className="text-left font-mono text-[11px] uppercase tracking-wider text-ink-500">
            <tr><th className="py-2">Outlet</th><th>Scope</th><th>Credibility</th><th>Feed</th><th>Last linked</th><th /></tr>
          </thead>
          <tbody>
            {(d?.outlets ?? []).map((o) => (
              <tr key={o.id} className="border-t border-line-100">
                <td className="py-2 text-ink-900">{o.name} <span className="text-ink-500">{o.domain}</span></td>
                <td>{o.scope}</td>
                <td className="tabular-nums">{o.credibility}</td>
                <td className="max-w-xs truncate text-ink-600">{o.feed_url ?? o.feed_status ?? "not linked yet"}</td>
                <td className="text-ink-600">{fmt(o.last_synced_at)}</td>
                <td className="text-right"><button className="btn-ghost" onClick={() => del.mutate(o.id)}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-10 mb-16">
        <h2 className="font-display text-xl text-ink-950">Recent scans</h2>
        <table className="mt-3 w-full text-sm">
          <thead className="text-left font-mono text-[11px] uppercase tracking-wider text-ink-500">
            <tr><th className="py-2">Started</th><th>Finished</th><th>By</th><th>Feeds</th><th>Fetched</th><th>New</th><th>Signals</th></tr>
          </thead>
          <tbody>
            {(d?.runs ?? []).map((r) => (
              <tr key={r.id} className="border-t border-line-100 tabular-nums">
                <td className="py-2">{fmt(r.started_at)}</td><td>{fmt(r.finished_at)}</td><td>{r.triggered_by}</td>
                <td>{r.feeds_polled}</td><td>{r.items_fetched}</td><td>{r.items_new}</td><td>{r.items_promoted}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      </>
      )}
    </SuperAdminShell>
  );
}
