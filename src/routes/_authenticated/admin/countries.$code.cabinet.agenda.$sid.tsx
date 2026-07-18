import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Suspense, useState } from "react";
import { ArrowLeft, Trash2, Sparkles, Save, ChevronUp, ChevronDown, Wand2, Plus, X } from "lucide-react";

import { SuperAdminShell } from "@/components/admin/SuperAdminShell";
import {
  getSession, saveAgendaItem, deleteAgendaItem, reorderAgenda, generateAgendaBrief, saveAttendance,
  type AgendaItem, type DossierRef,
} from "@/lib/cabinet.functions";

function sessionQuery(sid: string) {
  return queryOptions({
    queryKey: ["cabinet","session", sid],
    queryFn: () => getSession({ data: { sessionId: sid } }),
  });
}

export const Route = createFileRoute("/_authenticated/admin/countries/$code/cabinet/agenda/$sid")({
  head: ({ params }) => ({ meta: [{ title: `Agenda · ${params.code} — GDPVision` }, { name: "robots", content: "noindex" }] }),
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(sessionQuery(params.sid));
  },
  errorComponent: ({ error }) => (
    <div className="min-h-dvh grid place-items-center p-8"><p className="max-w-md text-sm text-red-600">{error.message}</p></div>
  ),
  component: AgendaEditor,
});

function AgendaEditor() {
  const { code, sid } = Route.useParams();
  const { data } = useSuspenseQuery(sessionQuery(sid));
  const nav = useNavigate();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(data.items[0]?.id ?? null);
  const selected = data.items.find((i) => i.id === selectedId) ?? null;

  const reorder = useServerFn(reorderAgenda);
  const del = useServerFn(deleteAgendaItem);
  const save = useServerFn(saveAgendaItem);
  const attend = useServerFn(saveAttendance);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["cabinet","session", sid] });
  const delMut = useMutation({ mutationFn: (id: string) => del({ data: { id } }), onSuccess: () => { setSelectedId(null); invalidate(); } });
  const reorderMut = useMutation({
    mutationFn: (ids: string[]) => reorder({ data: { sessionId: sid, orderedIds: ids }}),
    onSuccess: invalidate,
  });
  const createMut = useMutation({
    mutationFn: () => save({ data: {
      sessionId: sid, countryCode: code, title: "New agenda item",
      classification: "restricted", timeBoxMin: 10, motionKind: "approve", dossier: [],
    }}),
    onSuccess: ({ id }) => { setSelectedId(id); invalidate(); },
  });

  const attendMut = useMutation({
    mutationFn: (rows: Array<{ attendee_name: string; role: string | null; is_chair: boolean; present: boolean }>) =>
      attend({ data: { sessionId: sid, countryCode: code, rows } }),
    onSuccess: invalidate,
  });

  const move = (idx: number, dir: -1 | 1) => {
    const ids = data.items.map((i) => i.id);
    const j = idx + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    reorderMut.mutate(ids);
  };

  return (
    <SuperAdminShell crumbs={[
      { label: "Countries", to: "/admin/countries" },
      { label: code, to: "/admin/countries/$code/onboard", params: { code } },
      { label: "Cabinet", to: "/admin/countries/$code/cabinet", params: { code } },
      { label: data.session?.title ?? "Agenda" },
    ]}>
      <div className="min-h-dvh bg-paper-0">
        <div className="border-b border-line-200 bg-paper-0">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 md:px-10">
            <Link to="/admin/countries/$code/cabinet" params={{ code }} className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500 hover:text-ink-950">
              <ArrowLeft size={12} /> Room
            </Link>
            <div className="text-center">
              <div className="font-serif text-lg">{data.session?.title}</div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
                {data.session?.classification} · {data.items.length} items
              </div>
            </div>
            <button
              onClick={() => nav({ to: "/admin/countries/$code/cabinet/session/$sid", params: { code, sid } })}
              className="inline-flex items-center gap-2 border border-ink-950 bg-ink-950 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-paper-0">
              <Sparkles size={12} /> Enter Session Mode
            </button>
          </div>
        </div>

        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-6 py-6 md:grid-cols-[320px,1fr] md:px-10">
          {/* left rail */}
          <aside className="space-y-3">
            <button onClick={() => createMut.mutate()}
              className="w-full inline-flex items-center justify-center gap-2 border border-line-200 bg-paper-0 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] hover:border-ink-950">
              <Plus size={12} /> Add item
            </button>
            <ul className="space-y-1">
              {data.items.map((it, idx) => (
                <li key={it.id}>
                  <button onClick={() => setSelectedId(it.id)}
                    className={`w-full border px-3 py-2 text-left transition ${selectedId === it.id ? "border-ink-950 bg-ink-950/5" : "border-line-200 bg-paper-0 hover:border-ink-950"}`}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">Item {idx + 1} · {it.time_box_min}m</span>
                      <ReadinessDot score={it.readiness_score} />
                    </div>
                    <div className="mt-1 truncate text-sm">{it.title}</div>
                    <div className="mt-1 flex items-center gap-1">
                      <button onClick={(e) => { e.stopPropagation(); move(idx, -1); }} className="p-0.5 text-ink-500 hover:text-ink-950"><ChevronUp size={12} /></button>
                      <button onClick={(e) => { e.stopPropagation(); move(idx, 1); }} className="p-0.5 text-ink-500 hover:text-ink-950"><ChevronDown size={12} /></button>
                      <button onClick={(e) => { e.stopPropagation(); if (window.confirm("Delete this item?")) delMut.mutate(it.id); }}
                        className="ml-auto p-0.5 text-ink-500 hover:text-red-600"><Trash2 size={12} /></button>
                    </div>
                  </button>
                </li>
              ))}
              {data.items.length === 0 && <li className="rounded border border-dashed border-line-200 p-4 text-center text-sm text-ink-500">No items yet.</li>}
            </ul>

            <div className="mt-6 border border-line-200 p-3">
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">Attendance</div>
              <AttendanceEditor
                initial={data.attendance.map((a: { attendee_name: string; role: string | null; is_chair: boolean; present: boolean }) => ({ attendee_name: a.attendee_name, role: a.role, is_chair: a.is_chair, present: a.present }))}
                onSave={(rows) => attendMut.mutate(rows)}
                saving={attendMut.isPending}
              />
            </div>
          </aside>

          {/* editor */}
          <section className="min-w-0">
            <Suspense fallback={null}>
              {selected ? (
                <ItemEditor key={selected.id} item={selected} code={code} sid={sid}
                  ministries={data.ministries as { id: string; name: string }[]}
                  onSaved={invalidate} />
              ) : (
                <div className="grid h-64 place-items-center border border-dashed border-line-200 text-sm text-ink-500">
                  Select or add an item to edit.
                </div>
              )}
            </Suspense>
          </section>
        </div>
      </div>
    </SuperAdminShell>
  );
}

function ReadinessDot({ score }: { score: number }) {
  const cls = score >= 75 ? "bg-emerald-500" : score >= 40 ? "bg-gold-500" : "bg-red-500/70";
  return <span className={`inline-block h-2 w-2 rounded-full ${cls}`} title={`Readiness ${score}%`} />;
}

function ItemEditor({ item, code, sid, ministries, onSaved }: {
  item: AgendaItem; code: string; sid: string; ministries: { id: string; name: string }[]; onSaved: () => void;
}) {
  const [title, setTitle] = useState(item.title);
  const [sponsor, setSponsor] = useState(item.sponsor_ministry_id ?? "");
  const [timeBox, setTimeBox] = useState(item.time_box_min);
  const [motion, setMotion] = useState<AgendaItem["motion_kind"]>(item.motion_kind);
  const [classification, setClassification] = useState<AgendaItem["classification"]>(item.classification);
  const [recommendation, setRecommendation] = useState(item.recommendation ?? "");
  const [brief, setBrief] = useState(item.brief_md ?? "");
  const [dossier, setDossier] = useState<DossierRef[]>(item.dossier);
  const [newRef, setNewRef] = useState<{ label: string; href: string }>({ label: "", href: "" });

  const save = useServerFn(saveAgendaItem);
  const gen = useServerFn(generateAgendaBrief);

  const saveMut = useMutation({
    mutationFn: () => save({ data: {
      id: item.id, sessionId: sid, countryCode: code,
      title, sponsorMinistryId: sponsor || null,
      classification, timeBoxMin: timeBox, recommendation, motionKind: motion,
      briefMd: brief, dossier,
    }}),
    onSuccess: onSaved,
  });
  const genMut = useMutation({
    mutationFn: () => gen({ data: { agendaItemId: item.id } }),
    onSuccess: ({ brief: b }) => { setBrief(b); onSaved(); },
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr,120px,140px,140px]">
        <input value={title} onChange={(e) => setTitle(e.target.value)}
          className="border border-line-200 bg-paper-0 px-3 py-2 font-serif text-lg focus:border-ink-950 focus:outline-none"
          placeholder="Agenda item title" />
        <input type="number" min={1} max={180} value={timeBox} onChange={(e) => setTimeBox(Number(e.target.value))}
          className="border border-line-200 bg-paper-0 px-3 py-2 text-sm tabular-nums" title="Time box (minutes)" />
        <select value={motion} onChange={(e) => setMotion(e.target.value as AgendaItem["motion_kind"])}
          className="border border-line-200 bg-paper-0 px-2 py-2 font-mono text-[10px] uppercase tracking-[0.2em]">
          {["approve","note","refer","defer"].map(v => <option key={v} value={v}>Motion: {v}</option>)}
        </select>
        <select value={classification} onChange={(e) => setClassification(e.target.value as AgendaItem["classification"])}
          className="border border-line-200 bg-paper-0 px-2 py-2 font-mono text-[10px] uppercase tracking-[0.2em]">
          {["public","internal","restricted","secret"].map(v => <option key={v} value={v}>{v}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <select value={sponsor} onChange={(e) => setSponsor(e.target.value)}
          className="border border-line-200 bg-paper-0 px-3 py-2 text-sm">
          <option value="">Sponsor ministry —</option>
          {ministries.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <input value={recommendation} onChange={(e) => setRecommendation(e.target.value)}
          placeholder="One-line recommendation for cabinet"
          className="border border-line-200 bg-paper-0 px-3 py-2 text-sm" />
      </div>

      <div className="border border-line-200 p-3">
        <div className="flex items-center justify-between">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">Evidence (dossier)</div>
        </div>
        <ul className="mt-2 space-y-1">
          {dossier.map((d, i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500 min-w-[6ch]">[{i+1}] {d.kind}</span>
              <span className="flex-1 truncate">{d.label}</span>
              {d.href && <a href={d.href} target="_blank" rel="noreferrer" className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500 hover:text-ink-950">open</a>}
              <button onClick={() => setDossier(dossier.filter((_, j) => j !== i))} className="text-ink-500 hover:text-red-600"><X size={12} /></button>
            </li>
          ))}
          {!dossier.length && <li className="text-sm text-ink-500">Attach a KPI, scenario, strategy, narrative, or URL.</li>}
        </ul>
        <div className="mt-3 grid grid-cols-[1fr,1fr,auto] gap-2">
          <input value={newRef.label} onChange={(e) => setNewRef({ ...newRef, label: e.target.value })}
            placeholder="Label (e.g. FDI Threat: Sunset of CBI)" className="border border-line-200 bg-paper-0 px-2 py-1.5 text-sm" />
          <input value={newRef.href} onChange={(e) => setNewRef({ ...newRef, href: e.target.value })}
            placeholder="URL (optional)" className="border border-line-200 bg-paper-0 px-2 py-1.5 text-sm" />
          <button onClick={() => {
            if (!newRef.label.trim()) return;
            setDossier([...dossier, { kind: "url", label: newRef.label.trim(), href: newRef.href.trim() || undefined }]);
            setNewRef({ label: "", href: "" });
          }}
            className="inline-flex items-center gap-1 border border-line-200 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] hover:border-ink-950">
            <Plus size={12} /> Add
          </button>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">Cabinet brief</div>
          <button onClick={() => genMut.mutate()} disabled={genMut.isPending}
            className="inline-flex items-center gap-2 border border-ink-950 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-950 hover:bg-ink-950 hover:text-paper-0 disabled:opacity-50">
            <Wand2 size={12} /> {genMut.isPending ? "Drafting…" : "Draft brief with AI"}
          </button>
        </div>
        <textarea value={brief} onChange={(e) => setBrief(e.target.value)}
          rows={10}
          placeholder="Situation · So-what · The ask — 120 words. Use [1], [2] to cite evidence above."
          className="w-full border border-line-200 bg-paper-0 p-3 font-serif text-sm leading-relaxed focus:border-ink-950 focus:outline-none" />
      </div>

      <div className="flex items-center justify-end gap-2">
        <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}
          className="inline-flex items-center gap-2 border border-ink-950 bg-ink-950 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-paper-0 hover:opacity-90 disabled:opacity-50">
          <Save size={12} /> {saveMut.isPending ? "Saving…" : "Save item"}
        </button>
      </div>
    </div>
  );
}

function AttendanceEditor({ initial, onSave, saving }: {
  initial: Array<{ attendee_name: string; role: string | null; is_chair: boolean; present: boolean }>;
  onSave: (rows: typeof initial) => void;
  saving: boolean;
}) {
  const [rows, setRows] = useState(initial);
  return (
    <div className="mt-2 space-y-2">
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-[1fr,1fr,auto,auto] items-center gap-1 text-sm">
          <input value={r.attendee_name} onChange={(e) => { const c = [...rows]; c[i] = { ...c[i], attendee_name: e.target.value }; setRows(c); }}
            placeholder="Name" className="border border-line-200 bg-paper-0 px-2 py-1 text-xs" />
          <input value={r.role ?? ""} onChange={(e) => { const c = [...rows]; c[i] = { ...c[i], role: e.target.value }; setRows(c); }}
            placeholder="Role" className="border border-line-200 bg-paper-0 px-2 py-1 text-xs" />
          <label className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-500">
            <input type="checkbox" checked={r.is_chair} onChange={(e) => { const c = [...rows]; c[i] = { ...c[i], is_chair: e.target.checked }; setRows(c); }} /> Chair
          </label>
          <button onClick={() => setRows(rows.filter((_, j) => j !== i))} className="text-ink-500 hover:text-red-600"><X size={12} /></button>
        </div>
      ))}
      <button onClick={() => setRows([...rows, { attendee_name: "", role: "", is_chair: false, present: true }])}
        className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500 hover:text-ink-950">
        <Plus size={12} /> Add attendee
      </button>
      <button onClick={() => onSave(rows.filter((r) => r.attendee_name.trim()))} disabled={saving}
        className="mt-1 w-full border border-ink-950 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.2em] hover:bg-ink-950 hover:text-paper-0 disabled:opacity-50">
        {saving ? "Saving…" : "Save attendance"}
      </button>
    </div>
  );
}
