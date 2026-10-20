import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { SuperAdminShell } from "@/components/admin/SuperAdminShell";
import {
  adminAddEventLink,
  adminDeleteEvent,
  adminListEvents,
  adminListHostEnquiries,
  adminListRegistrations,
  adminRemoveEventLink,
  adminSaveEvent,
  adminUpdateRegistration,
} from "@/lib/events/admin.functions";
import { EVENT_COLOURS } from "@/lib/events/rules";

export const Route = createFileRoute("/_authenticated/admin/events")({
  head: () => ({
    meta: [
      { title: "Events — GDPVision admin" },
      { name: "description", content: "Create GDP Events, link Second Brain items and manage attendees." },
      { property: "og:title", content: "Events — GDPVision admin" },
      { property: "og:description", content: "Manage GDP Events." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminEventsPage,
});

type Ev = Awaited<ReturnType<typeof adminListEvents>>[number];

const toLocal = (iso: string | null | undefined) => (iso ? new Date(iso).toISOString().slice(0, 16) : "");
const fromLocal = (v: FormDataEntryValue | null) => (v && String(v) ? new Date(String(v) + "Z").toISOString() : null);

function AdminEventsPage() {
  const qc = useQueryClient();
  const list = useServerFn(adminListEvents);
  const enquiriesFn = useServerFn(adminListHostEnquiries);
  const events = useQuery({ queryKey: ["admin", "events"], queryFn: () => list() });
  const enquiries = useQuery({ queryKey: ["admin", "event-enquiries"], queryFn: () => enquiriesFn() });
  const [editing, setEditing] = useState<Ev | "new" | null>(null);
  const [attendeesFor, setAttendeesFor] = useState<Ev | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "events"] });

  return (
    <SuperAdminShell crumbs={[{ label: "Admin", to: "/admin/countries" }, { label: "Events" }]}>
      <div className="space-y-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-[32px] text-ink-950">GDP Events</h1>
            <p className="mt-1 text-[14px] text-ink-700">
              Events shown at <Link to="/events" className="underline">/events</Link>. Only published events are public.
            </p>
          </div>
          <button type="button" className="btn-primary" onClick={() => setEditing("new")}>New event</button>
        </header>

        {events.isLoading && <p className="text-ink-500">Loading…</p>}
        {events.error && <p className="text-signal-red">{(events.error as Error).message}</p>}

        <div className="overflow-x-auto rounded-lg border border-line-200">
          <table className="w-full text-[13.5px]">
            <thead className="bg-paper-100 text-left font-mono text-[11px] uppercase tracking-[0.14em] text-ink-500">
              <tr>
                <th className="p-3">Event</th>
                <th className="p-3">Date</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Confirmed / waitlist / cap</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {(events.data ?? []).map((e) => {
                const regs = (e.event_registrations ?? []) as { status: string }[];
                const c = regs.filter((r) => r.status === "confirmed").length;
                const w = regs.filter((r) => r.status === "waitlist").length;
                return (
                  <tr key={e.id} className="border-t border-line-100">
                    <td className="p-3">
                      <div className="font-medium text-ink-950">{e.title}</div>
                      <div className="text-[12px] text-ink-500">/{e.slug}{e.is_placeholder ? " · sample" : ""}</div>
                    </td>
                    <td className="p-3 text-ink-700">{new Date(e.starts_at).toUTCString().slice(5, 16)}</td>
                    <td className="p-3 text-ink-700">{e.status}</td>
                    <td className="p-3 text-right tabular-nums text-ink-700">{c} / {w} / {e.capacity ?? "—"}</td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <button type="button" className="btn-ghost" onClick={() => setAttendeesFor(e)}>Attendees</button>
                      <button type="button" className="btn-secondary ml-2" onClick={() => setEditing(e)}>Edit</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {editing && <EventEditor ev={editing === "new" ? null : editing} onClose={() => { setEditing(null); void refresh(); }} />}
        {attendeesFor && <Attendees ev={attendeesFor} onClose={() => setAttendeesFor(null)} />}

        <section>
          <h2 className="font-serif text-[22px] text-ink-950">Host enquiries</h2>
          {(enquiries.data ?? []).length === 0 ? (
            <p className="mt-2 text-[14px] text-ink-500">No enquiries yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line-100 rounded-lg border border-line-200">
              {(enquiries.data ?? []).map((q) => (
                <li key={q.id} className="p-4 text-[13.5px]">
                  <div className="font-medium text-ink-950">{q.name} · {q.email}</div>
                  <div className="text-ink-500">{[q.organisation, q.country].filter(Boolean).join(" · ")} · {new Date(q.created_at).toUTCString().slice(5, 22)}</div>
                  <p className="mt-2 whitespace-pre-wrap text-ink-700">{q.message}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </SuperAdminShell>
  );
}

function EventEditor({ ev, onClose }: { ev: Ev | null; onClose: () => void }) {
  const save = useServerFn(adminSaveEvent);
  const del = useServerFn(adminDeleteEvent);
  const addLink = useServerFn(adminAddEventLink);
  const removeLink = useServerFn(adminRemoveEventLink);
  const qc = useQueryClient();
  const [links, setLinks] = useState(((ev?.event_links ?? []) as { id: string; kind: string; ref: string; label: string | null }[]));

  const saveMut = useMutation({
    mutationFn: (fd: FormData) => {
      const s = (k: string) => (String(fd.get(k) ?? "").trim() || null);
      const cap = s("capacity");
      return save({
        data: {
          id: ev?.id,
          slug: String(fd.get("slug")),
          title: String(fd.get("title")),
          tagline: s("tagline"),
          summary: s("summary"),
          body: s("body"),
          status: String(fd.get("status")) as "draft" | "published",
          format: String(fd.get("format")) as "in_person",
          theme: s("theme"),
          country_code: s("country_code"),
          city: s("city"),
          venue: s("venue"),
          starts_at: fromLocal(fd.get("starts_at"))!,
          ends_at: fromLocal(fd.get("ends_at")),
          registration_close: fromLocal(fd.get("registration_close")),
          capacity: cap ? Number(cap) : null,
          hero_url: s("hero_url"),
          colour: String(fd.get("colour")) as "sea",
          is_placeholder: fd.get("is_placeholder") === "on",
        },
      });
    },
    onSuccess: onClose,
  });
  const delMut = useMutation({ mutationFn: () => del({ data: { id: ev!.id } }), onSuccess: onClose });
  const linkMut = useMutation({
    mutationFn: (d: { kind: string; ref: string; label: string }) => addLink({ data: { event_id: ev!.id, ...(d as { kind: "page"; ref: string; label: string }) } }),
    onSuccess: async () => {
      const fresh = await qc.fetchQuery({ queryKey: ["admin", "events"], queryFn: () => adminListEvents() });
      const me = fresh.find((x) => x.id === ev!.id);
      setLinks((me?.event_links ?? []) as typeof links);
    },
  });


  return (
    <section className="rounded-lg border border-line-200 bg-paper-50 p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-[22px] text-ink-950">{ev ? `Edit: ${ev.title}` : "New event"}</h2>
        <button type="button" className="btn-ghost" onClick={onClose}>Close</button>
      </div>
      <form
        className="mt-5 grid gap-4 md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          saveMut.mutate(new FormData(e.currentTarget));
        }}
      >
        <F name="title" label="Title" required defaultValue={ev?.title} />
        <F name="slug" label="Web address (slug)" required pattern="[a-z0-9-]+" defaultValue={ev?.slug} />
        <F name="tagline" label="Tagline" defaultValue={ev?.tagline ?? ""} />
        <F name="theme" label="Theme" defaultValue={ev?.theme ?? ""} />
        <label className="grid gap-1 text-[12px] font-mono uppercase tracking-[0.12em] text-ink-500 md:col-span-2">
          Summary
          <textarea name="summary" rows={2} defaultValue={ev?.summary ?? ""} className="rounded border border-line-200 bg-paper-0 px-2 py-1.5 font-sans text-[14px] normal-case tracking-normal text-ink-950" />
        </label>
        <label className="grid gap-1 text-[12px] font-mono uppercase tracking-[0.12em] text-ink-500 md:col-span-2">
          Description
          <textarea name="body" rows={4} defaultValue={ev?.body ?? ""} className="rounded border border-line-200 bg-paper-0 px-2 py-1.5 font-sans text-[14px] normal-case tracking-normal text-ink-950" />
        </label>
        <F name="starts_at" label="Starts (UTC)" type="datetime-local" required defaultValue={toLocal(ev?.starts_at)} />
        <F name="ends_at" label="Ends (UTC)" type="datetime-local" defaultValue={toLocal(ev?.ends_at)} />
        <F name="registration_close" label="Registration closes (UTC)" type="datetime-local" defaultValue={toLocal(ev?.registration_close)} />
        <F name="capacity" label="Places (blank = unlimited)" type="number" min={0} defaultValue={ev?.capacity ?? ""} />
        <F name="venue" label="Venue" defaultValue={ev?.venue ?? ""} />
        <F name="city" label="City" defaultValue={ev?.city ?? ""} />
        <F name="country_code" label="Country code" maxLength={4} defaultValue={ev?.country_code ?? ""} />
        <F name="hero_url" label="Photo address" defaultValue={ev?.hero_url ?? ""} />
        <label className="grid gap-1 text-[12px] font-mono uppercase tracking-[0.12em] text-ink-500">
          Format
          <select name="format" defaultValue={ev?.format ?? "in_person"} className="rounded border border-line-200 bg-paper-0 px-2 py-1.5 text-[14px] text-ink-950">
            <option value="in_person">In person</option><option value="hybrid">Hybrid</option><option value="online">Online</option>
          </select>
        </label>
        <label className="grid gap-1 text-[12px] font-mono uppercase tracking-[0.12em] text-ink-500">
          Colour
          <select name="colour" defaultValue={ev?.colour ?? "sea"} className="rounded border border-line-200 bg-paper-0 px-2 py-1.5 text-[14px] text-ink-950">
            {EVENT_COLOURS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-[12px] font-mono uppercase tracking-[0.12em] text-ink-500">
          Status
          <select name="status" defaultValue={ev?.status ?? "draft"} className="rounded border border-line-200 bg-paper-0 px-2 py-1.5 text-[14px] text-ink-950">
            <option value="draft">Draft (hidden)</option><option value="published">Published</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-[13px] text-ink-700">
          <input type="checkbox" name="is_placeholder" defaultChecked={ev?.is_placeholder ?? false} /> Mark as sample event
        </label>
        {saveMut.error && <p className="text-signal-red md:col-span-2">{(saveMut.error as Error).message}</p>}
        <div className="flex gap-3 md:col-span-2">
          <button type="submit" className="btn-primary" disabled={saveMut.isPending}>{saveMut.isPending ? "Saving…" : "Save event"}</button>
          {ev && (
            <button
              type="button"
              className="btn-ghost"
              onClick={() => window.confirm("Delete this event and all its registrations?") && delMut.mutate()}
            >
              Delete
            </button>
          )}
        </div>
      </form>

      {ev && (
        <div className="mt-8 border-t border-line-200 pt-6">
          <h3 className="font-serif text-[18px] text-ink-950">Second Brain links</h3>
          <ul className="mt-3 flex flex-wrap gap-2">
            {links.map((l) => (
              <li key={l.id} className="flex items-center gap-2 rounded-full border border-line-200 bg-paper-0 px-3 py-1 text-[13px]">
                <span className="font-mono text-[11px] uppercase text-ink-500">{l.kind}</span> {l.label ?? l.ref}
                <button
                  type="button"
                  aria-label={`Remove ${l.label ?? l.ref}`}
                  className="text-ink-500 hover:text-ink-950"
                  onClick={async () => {
                    await removeLink({ data: { id: l.id } });
                    setLinks((v) => v.filter((x) => x.id !== l.id));
                  }}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          <form
            className="mt-4 flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              linkMut.mutate({ kind: String(fd.get("kind")), ref: String(fd.get("ref")), label: String(fd.get("label") ?? "") });
              e.currentTarget.reset();
            }}
          >
            <select name="kind" className="rounded border border-line-200 bg-paper-0 px-2 py-1.5 text-[14px] text-ink-950">
              <option value="chamber">Chamber (01–10)</option>
              <option value="index">Index (CGX, CHX, CGV, CCX)</option>
              <option value="country">Country (code)</option>
              <option value="op_ed">Op-ed (slug)</option>
              <option value="page">Page (path)</option>
            </select>
            <input name="ref" required placeholder="Reference" className="rounded border border-line-200 bg-paper-0 px-2 py-1.5 text-[14px] text-ink-950" />
            <input name="label" placeholder="Label shown" className="rounded border border-line-200 bg-paper-0 px-2 py-1.5 text-[14px] text-ink-950" />
            <button type="submit" className="btn-secondary">Add link</button>
          </form>
        </div>
      )}
    </section>
  );
}

function F({ name, label, ...p }: { name: string; label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="grid gap-1 text-[12px] font-mono uppercase tracking-[0.12em] text-ink-500">
      {label}
      <input name={name} {...p} className="rounded border border-line-200 bg-paper-0 px-2 py-1.5 font-sans text-[14px] normal-case tracking-normal text-ink-950" />
    </label>
  );
}

function Attendees({ ev, onClose }: { ev: Ev; onClose: () => void }) {
  const list = useServerFn(adminListRegistrations);
  const update = useServerFn(adminUpdateRegistration);
  const qc = useQueryClient();
  const key = ["admin", "event-regs", ev.id];
  const regs = useQuery({ queryKey: key, queryFn: () => list({ data: { event_id: ev.id } }) });
  const mut = useMutation({
    mutationFn: (d: { id: string; status?: "confirmed" | "waitlist" | "cancelled"; attended?: boolean }) => update({ data: d }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: key });
      void qc.invalidateQueries({ queryKey: ["admin", "events"] });
    },
  });

  const exportCsv = () => {
    const rows = regs.data ?? [];
    const head = ["name", "email", "organisation", "role", "country", "needs", "status", "attended", "registered"];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [head.join(","), ...rows.map((r) => [r.name, r.email, r.organisation, r.role, r.country, r.needs, r.status, r.attended, r.created_at].map(esc).join(","))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `${ev.slug}-attendees.csv`;
    a.click();
  };

  return (
    <section className="rounded-lg border border-line-200 bg-paper-50 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-[22px] text-ink-950">Attendees: {ev.title}</h2>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary" onClick={exportCsv} disabled={!regs.data?.length}>Export CSV</button>
          <button type="button" className="btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
      {(regs.data ?? []).length === 0 ? (
        <p className="mt-4 text-[14px] text-ink-500">{regs.isLoading ? "Loading…" : "No registrations yet."}</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-[13.5px]">
            <thead className="text-left font-mono text-[11px] uppercase tracking-[0.14em] text-ink-500">
              <tr><th className="p-2">Name</th><th className="p-2">Organisation</th><th className="p-2">Needs</th><th className="p-2">Status</th><th className="p-2">Attended</th></tr>
            </thead>
            <tbody>
              {(regs.data ?? []).map((r) => (
                <tr key={r.id} className="border-t border-line-100">
                  <td className="p-2"><div className="text-ink-950">{r.name}</div><div className="text-[12px] text-ink-500">{r.email}</div></td>
                  <td className="p-2 text-ink-700">{[r.organisation, r.role, r.country].filter(Boolean).join(" · ")}</td>
                  <td className="p-2 text-ink-700">{r.needs}</td>
                  <td className="p-2">
                    <select
                      value={r.status}
                      onChange={(e) => mut.mutate({ id: r.id, status: e.target.value as "confirmed" })}
                      className="rounded border border-line-200 bg-paper-0 px-2 py-1 text-[13px] text-ink-950"
                    >
                      <option value="confirmed">Confirmed</option><option value="waitlist">Waitlist</option><option value="cancelled">Cancelled</option>
                    </select>
                  </td>
                  <td className="p-2">
                    <input type="checkbox" aria-label={`${r.name} attended`} checked={r.attended} onChange={(e) => mut.mutate({ id: r.id, attended: e.target.checked })} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
