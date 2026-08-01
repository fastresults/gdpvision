// @domain personas
// @ui src/routes/_authenticated/admin/countries.$code.personas.field.$step.tsx
//
// Chamber 07 · The internal project tracker board. Three ways to look at the
// same work — by phase, by owner, and what is due — plus the roster of people
// staffed on the engagement. Agency-only; nothing here reaches the client.

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, Plus, Trash2, Users } from "lucide-react";

import {
  getProgrammeTracker,
  removeTeamMember,
  updateTrackerItem,
  upsertTeamMember,
} from "@/lib/personas/programme-tracker.functions";
import {
  dueLabel,
  isOverdue,
  nextStatus,
  STATUS_LABEL,
  TEAM_ROLES,
  type ItemStatus,
  type TrackerData,
  type TrackerItem,
} from "@/lib/personas/tracker-shared";
import { cn } from "@/lib/utils";

type View = "phase" | "owner" | "due";

interface ItemPatch {
  kind: "milestone" | "deliverable";
  itemId: string;
  status?: ItemStatus;
  assigneeId?: string | null;
  blockedReason?: string | null;
  dueOn?: string | null;
  note?: string;
}

const VIEWS: { key: View; label: string }[] = [
  { key: "phase", label: "By phase" },
  { key: "owner", label: "By owner" },
  { key: "due", label: "What's due" },
];

function statusClass(s: string): string {
  return s === "done"
    ? "border-ink-950 bg-ink-950 text-paper-0"
    : s === "blocked"
      ? "border-gold-500 text-gold-500"
      : s === "in_progress"
        ? "border-ink-950 text-ink-950"
        : "border-line-200 text-ink-500";
}

export function TrackerBoard({ code, projectId }: { code: string; projectId: string }) {
  const qc = useQueryClient();
  const [view, setView] = useState<View>("phase");
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const trackerQ = useQuery({
    queryKey: ["programme-tracker", projectId],
    queryFn: (): Promise<TrackerData> => getProgrammeTracker({ data: { projectId } }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["programme-tracker", projectId] });
  const onErr = (e: unknown) =>
    setError(e instanceof Error ? e.message : "That change could not be saved.");

  const updateFn = useServerFn(updateTrackerItem);
  const upsertFn = useServerFn(upsertTeamMember);
  const removeFn = useServerFn(removeTeamMember);

  const update = useMutation({
    mutationFn: (v: ItemPatch) => updateFn({ data: v }),
    onSuccess: () => {
      setError(null);
      void invalidate();
    },
    onError: onErr,
  });
  const addMember = useMutation({
    mutationFn: (v: { name: string; email: string; role: string }) =>
      upsertFn({ data: { projectId, countryCode: code, ...v } }),
    onSuccess: () => {
      setError(null);
      void invalidate();
    },
    onError: onErr,
  });
  const dropMember = useMutation({
    mutationFn: (id: string) => removeFn({ data: { id } }),
    onSuccess: () => void invalidate(),
    onError: onErr,
  });

  const data = trackerQ.data;
  const nameOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of data?.team ?? []) m.set(t.id, t.name);
    return m;
  }, [data]);

  const groups = useMemo(() => {
    const items = data?.items ?? [];
    if (view === "owner") {
      const out = new Map<string, TrackerItem[]>();
      for (const i of items) {
        const k = i.assigneeId ? (nameOf.get(i.assigneeId) ?? "Unassigned") : "Unassigned";
        out.set(k, [...(out.get(k) ?? []), i]);
      }
      return [...out.entries()];
    }
    if (view === "due") {
      const live = items
        .filter((i) => i.status !== "done")
        .sort((a, b) => (a.dueOn ?? "9999").localeCompare(b.dueOn ?? "9999"));
      return [
        ["Overdue", live.filter(isOverdue)],
        ["Ahead", live.filter((i) => !isOverdue(i))],
        ["Done", items.filter((i) => i.status === "done")],
      ] as [string, TrackerItem[]][];
    }
    const out = new Map<string, TrackerItem[]>();
    for (const i of items) {
      const k = i.phase ?? (i.kind === "deliverable" ? "Deliverables" : "Unphased");
      out.set(k, [...(out.get(k) ?? []), i]);
    }
    return [...out.entries()];
  }, [data, view, nameOf]);

  if (trackerQ.isLoading) return <p className="text-sm text-ink-500">Reading the programme…</p>;
  if (!data?.planId)
    return (
      <p className="text-sm text-ink-700">
        The tracker opens once the programme plan is approved — its phases, milestones and
        deliverables are what there is to track.
      </p>
    );

  const done = data.items.filter((i) => i.status === "done").length;
  const blocked = data.items.filter((i) => i.status === "blocked").length;
  const overdue = data.items.filter(isOverdue).length;

  return (
    <div className="space-y-5">
      {/* Standing state of the engagement */}
      <div className="grid grid-cols-2 gap-px border border-line-200 bg-line-200 sm:grid-cols-4">
        {[
          { k: "Complete", v: `${done}/${data.items.length}` },
          { k: "Blocked", v: String(blocked) },
          { k: "Overdue", v: String(overdue) },
          {
            k: "Field",
            v: `${data.field.responses} returns · ${data.field.held}/${data.field.sessions} sessions`,
          },
        ].map((s) => (
          <div key={s.k} className="bg-paper-0 px-3 py-2">
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-500">{s.k}</p>
            <p className="mt-0.5 text-sm tabular-nums text-ink-950">{s.v}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => setView(v.key)}
            className={cn(
              "border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em]",
              view === v.key
                ? "border-ink-950 bg-ink-950 text-paper-0"
                : "border-line-200 text-ink-500 hover:border-ink-950",
            )}
          >
            {v.label}
          </button>
        ))}
      </div>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <div className="space-y-4">
        {groups.map(([label, items]) =>
          items.length === 0 ? null : (
            <section key={label}>
              <h4 className="mb-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
                <CalendarClock size={11} /> {label}
              </h4>
              <ul className="divide-y divide-line-200 border border-line-200">
                {items.map((i) => (
                  <li key={i.id} className="bg-paper-0">
                    <div className="flex flex-wrap items-center gap-2 px-3 py-2">
                      <button
                        type="button"
                        title="Cycle status"
                        onClick={() => {
                          const s = nextStatus(i.status) as ItemStatus;
                          update.mutate({ kind: i.kind, itemId: i.id, status: s });
                        }}
                        className={cn(
                          "border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em]",
                          statusClass(i.status),
                        )}
                      >
                        {STATUS_LABEL[i.status as ItemStatus] ?? i.status}
                      </button>
                      <button
                        type="button"
                        onClick={() => setOpenItem(openItem === i.id ? null : i.id)}
                        className="min-w-0 flex-1 text-left text-sm text-ink-950 hover:underline"
                      >
                        {i.title}
                        <span className="ml-2 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-500">
                          {i.kind}
                        </span>
                      </button>
                      <select
                        value={i.assigneeId ?? ""}
                        onChange={(e) =>
                          update.mutate({
                            kind: i.kind,
                            itemId: i.id,
                            assigneeId: e.target.value || null,
                          })
                        }
                        className="border border-line-200 bg-paper-0 px-2 py-1 text-[11px] text-ink-950"
                      >
                        <option value="">Unassigned</option>
                        {data.team.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                      <span
                        className={cn(
                          "w-20 text-right font-mono text-[10px] tabular-nums",
                          isOverdue(i) ? "text-gold-500" : "text-ink-500",
                        )}
                      >
                        {dueLabel(i.dueOn)}
                      </span>
                    </div>

                    {openItem === i.id ? (
                      <ItemDetail
                        item={i}
                        onSave={(patch) => update.mutate({ kind: i.kind, itemId: i.id, ...patch })}
                        saving={update.isPending}
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ),
        )}
      </div>

      <Roster
        team={data.team}
        onAdd={(v) => addMember.mutate(v)}
        onRemove={(id) => dropMember.mutate(id)}
        busy={addMember.isPending}
      />
    </div>
  );
}

function ItemDetail({
  item,
  onSave,
  saving,
}: {
  item: TrackerItem;
  onSave: (patch: { dueOn?: string | null; blockedReason?: string | null; note?: string }) => void;
  saving: boolean;
}) {
  const [note, setNote] = useState("");
  const [reason, setReason] = useState(item.blockedReason ?? "");

  return (
    <div className="space-y-3 border-t border-line-200 bg-paper-50 px-3 py-3">
      {item.detail ? <p className="text-[13px] text-ink-700">{item.detail}</p> : null}

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-[11px] text-ink-500">
          <span className="block font-mono text-[9px] uppercase tracking-[0.16em]">Due</span>
          <input
            type="date"
            defaultValue={item.dueOn ?? ""}
            onBlur={(e) => onSave({ dueOn: e.target.value || null })}
            className="mt-1 border border-line-200 bg-paper-0 px-2 py-1 text-ink-950"
          />
        </label>
        <label className="min-w-[220px] flex-1 text-[11px] text-ink-500">
          <span className="block font-mono text-[9px] uppercase tracking-[0.16em]">
            Blocked because
          </span>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onBlur={() => onSave({ blockedReason: reason || null })}
            placeholder="Nothing is holding this up"
            className="mt-1 w-full border border-line-200 bg-paper-0 px-2 py-1 text-ink-950"
          />
        </label>
      </div>

      {item.notes.length ? (
        <ul className="space-y-1">
          {item.notes.map((n, idx) => (
            <li key={idx} className="text-[12px] text-ink-700">
              <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-500">
                {dueLabel(n.at)}
              </span>{" "}
              {n.body}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex gap-2">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note for the team"
          className="flex-1 border border-line-200 bg-paper-0 px-2 py-1 text-[13px] text-ink-950"
        />
        <button
          type="button"
          disabled={!note.trim() || saving}
          onClick={() => {
            onSave({ note });
            setNote("");
          }}
          className="btn-secondary"
        >
          Note
        </button>
      </div>
    </div>
  );
}

function Roster({
  team,
  onAdd,
  onRemove,
  busy,
}: {
  team: TrackerData["team"];
  onAdd: (v: { name: string; email: string; role: string }) => void;
  onRemove: (id: string) => void;
  busy: boolean;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>(TEAM_ROLES[2]);

  return (
    <section className="border border-line-200 p-3">
      <h4 className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
        <Users size={11} /> Who is on this engagement
      </h4>
      <ul className="mb-3 divide-y divide-line-200">
        {team.map((t) => (
          <li key={t.id} className="flex items-center gap-2 py-1.5">
            <span className="flex-1 text-sm text-ink-950">
              {t.name}
              {t.email ? <span className="ml-2 text-[11px] text-ink-500">{t.email}</span> : null}
            </span>
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-500">
              {t.role}
            </span>
            <button
              type="button"
              aria-label={`Remove ${t.name}`}
              onClick={() => onRemove(t.id)}
              className="btn-ghost px-1"
            >
              <Trash2 size={12} />
            </button>
          </li>
        ))}
        {team.length === 0 ? (
          <li className="py-1.5 text-sm text-ink-500">Nobody staffed yet.</li>
        ) : null}
      </ul>
      <div className="flex flex-wrap gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          className="min-w-[140px] flex-1 border border-line-200 bg-paper-0 px-2 py-1 text-[13px]"
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email (optional)"
          className="min-w-[160px] flex-1 border border-line-200 bg-paper-0 px-2 py-1 text-[13px]"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="border border-line-200 bg-paper-0 px-2 py-1 text-[13px]"
        >
          {TEAM_ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={name.trim().length < 2 || busy}
          onClick={() => {
            onAdd({ name: name.trim(), email: email.trim(), role });
            setName("");
            setEmail("");
          }}
          className="btn-secondary inline-flex items-center gap-1"
        >
          <Plus size={12} /> Add
        </button>
      </div>
    </section>
  );
}
