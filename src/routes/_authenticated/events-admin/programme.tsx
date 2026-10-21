import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { adminDeleteProgrammeItem, adminGetProgramme, adminSaveProgrammeItem, adminSpeakerLibrary } from "@/lib/events/admin-toolkit.functions";
import { EventPicker } from "@/components/events/admin/EventPicker";

export const Route = createFileRoute("/_authenticated/events-admin/programme")({
  head: () => ({ meta: [{ title: "Agenda, speakers & media — Events Admin" }, { name: "description", content: "Build each edition's agenda, speakers, partners and media." }, { property: "og:title", content: "Agenda, speakers & media — Events Admin" }, { property: "og:description", content: "Programme builder." }] }),
  component: ProgrammePage,
});

type Kind = "sessions" | "speakers" | "partners" | "media";
type FieldDef = { name: string; label: string; type?: string; required?: boolean; options?: string[] };

const FORMS: Record<Kind, { title: string; fields: FieldDef[]; show: (r: any) => string }> = {
  sessions: {
    title: "Agenda",
    fields: [
      { name: "title", label: "Session title", required: true },
      { name: "starts_at", label: "Starts (UTC)", type: "datetime-local" },
      { name: "speaker_names", label: "Speakers (comma separated)" },
      { name: "description", label: "Description" },
    ],
    show: (r) => `${r.starts_at ? new Date(r.starts_at).toUTCString().slice(5, 22) + " · " : ""}${r.title}`,
  },
  speakers: {
    title: "Speakers",
    fields: [
      { name: "name", label: "Name", required: true },
      { name: "role", label: "Role" },
      { name: "organisation", label: "Organisation" },
      { name: "photo_url", label: "Photo address" },
    ],
    show: (r) => [r.name, r.role, r.organisation].filter(Boolean).join(" · "),
  },
  partners: {
    title: "Partners & sponsors",
    fields: [
      { name: "name", label: "Name", required: true },
      { name: "tier", label: "Tier (e.g. Patron, Gold)" },
      { name: "logo_url", label: "Logo address" },
      { name: "url", label: "Website" },
    ],
    show: (r) => [r.name, r.tier].filter(Boolean).join(" · "),
  },
  media: {
    title: "Photos, recordings & decks",
    fields: [
      { name: "kind", label: "Type", options: ["photo", "recording", "deck"] },
      { name: "url", label: "Address", type: "url", required: true },
      { name: "caption", label: "Caption" },
      { name: "credit", label: "Credit" },
    ],
    show: (r) => `${r.kind} · ${r.caption ?? r.url}`,
  },
};

function ProgrammePage() {
  const [eventId, setEventId] = useState("");
  return (
    <div className="space-y-6">
      <h1 className="ev-display text-[56px]">Agenda, speakers &amp; media</h1>
      <EventPicker value={eventId} onChange={setEventId} />
      {eventId ? <Programme eventId={eventId} /> : <p className="text-[15px]">Choose an edition to build its programme.</p>}
    </div>
  );
}

function Programme({ eventId }: { eventId: string }) {
  const fn = useServerFn(adminGetProgramme);
  const q = useQuery({ queryKey: ["events-admin", "programme", eventId], queryFn: () => fn({ data: { event_id: eventId } }) });
  if (q.isLoading) return <p>Loading…</p>;
  if (q.error) return <p className="text-signal-red">{(q.error as Error).message}</p>;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {(Object.keys(FORMS) as Kind[]).map((k) => (
        <Panel key={k} kind={k} eventId={eventId} rows={(q.data as any)[k] ?? []} />
      ))}
    </div>
  );
}

function Panel({ kind, eventId, rows }: { kind: Kind; eventId: string; rows: any[] }) {
  const def = FORMS[kind];
  const save = useServerFn(adminSaveProgrammeItem);
  const del = useServerFn(adminDeleteProgrammeItem);
  const libFn = useServerFn(adminSpeakerLibrary);
  const lib = useQuery({ queryKey: ["events-admin", "speaker-library"], queryFn: () => libFn(), enabled: kind === "speakers" });
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["events-admin", "programme", eventId] });
  const saveMut = useMutation({
    mutationFn: (item: Record<string, unknown>) => save({ data: { kind, event_id: eventId, position: rows.length, item } }),
    onSuccess: refresh,
  });
  const delMut = useMutation({ mutationFn: (id: string) => del({ data: { kind, id } }), onSuccess: refresh });
  const field = "rounded-lg border-2 border-ev-ink bg-ev-paper px-3 py-2 text-[14px]";

  return (
    <section className="rounded-2xl border-4 border-ev-ink bg-paper-0 p-5">
      <h2 className="ev-display text-[32px]">{def.title}</h2>
      <ul className="mt-3 divide-y-2 divide-ev-ink/10">
        {rows.length === 0 && <li className="py-2 text-[14px] opacity-70">Nothing added yet.</li>}
        {rows.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-[14px]">
            <span>{def.show(r)}</span>
            <button type="button" className="btn-ghost" onClick={() => window.confirm("Remove this item?") && delMut.mutate(r.id)}>Remove</button>
          </li>
        ))}
      </ul>
      {kind === "speakers" && (lib.data ?? []).length > 0 && (
        <label className="mt-3 flex items-center gap-2 text-[13px] font-semibold">
          From speaker library
          <select
            className={field}
            value=""
            onChange={(e) => {
              const s = (lib.data ?? []).find((x: any) => x.name === e.target.value);
              if (s) saveMut.mutate({ name: s.name, role: s.role, organisation: s.organisation, photo_url: s.photo_url });
            }}
          >
            <option value="">Add an existing speaker…</option>
            {(lib.data ?? []).map((s: any) => <option key={s.name} value={s.name}>{s.name}</option>)}
          </select>
        </label>
      )}
      <form
        className="mt-4 grid gap-2 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const item: Record<string, unknown> = {};
          for (const f of def.fields) {
            const v = String(fd.get(f.name) ?? "").trim();
            if (f.name === "speaker_names") item[f.name] = v ? v.split(",").map((x) => x.trim()).filter(Boolean) : [];
            else if (f.type === "datetime-local") item[f.name] = v ? new Date(v + "Z").toISOString() : null;
            else item[f.name] = v || null;
          }
          saveMut.mutate(item, { onSuccess: () => (e.target as HTMLFormElement).reset() });
        }}
      >
        {def.fields.map((f) =>
          f.options ? (
            <select key={f.name} name={f.name} aria-label={f.label} className={field}>{f.options.map((o) => <option key={o}>{o}</option>)}</select>
          ) : (
            <input key={f.name} name={f.name} type={f.type ?? "text"} required={f.required} placeholder={f.label} aria-label={f.label} className={field} />
          ),
        )}
        {saveMut.error && <p className="text-signal-red sm:col-span-2">{(saveMut.error as Error).message}</p>}
        <button type="submit" className="ev-btn-dark sm:col-span-2 justify-self-start !py-2 !text-[14px]" disabled={saveMut.isPending}>Add</button>
      </form>
    </section>
  );
}
