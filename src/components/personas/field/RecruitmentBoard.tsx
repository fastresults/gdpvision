// Chamber 07 · Stage 02 · The recruitment board.
//
// AI-first: the chamber derives a recruitment frame from the brief and the
// approved plan, researches real named individuals against each persona, and
// hands the admin a slate to accept, edit, add to or reject. Nothing here is
// a blank form — the blank form is the fallback, not the entrance.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Check,
  CheckCheck,
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

import { useResolveAction } from "./stage-bus";
import { Explain } from "@/components/explain/Explain";

import {
  acceptCandidates,
  addParticipant,
  composeFocusGroups,
  deriveRecruitmentBrief,
  getRecruitment,
  rejectCandidate,
  updateCandidate,
} from "@/lib/personas/recruitment.functions";
import { researchCandidates } from "@/lib/personas/recruitment.functions";
import { cn } from "@/lib/utils";

interface Persona {
  label: string;
  who: string;
  why?: string;
  sector?: string | null;
  seniority?: string | null;
  region?: string | null;
  survey_target: number;
  focus_group: boolean;
  where_to_look?: string[];
}

interface Frame {
  summary: string;
  personas: Persona[];
  screening?: string[];
  exclusions?: string[];
}

interface Person {
  id: string;
  full_name: string;
  email: string | null;
  organisation: string | null;
  role_title: string | null;
  consent_status: string;
  opted_out_at: string | null;
  status: string | null;
  persona_label: string | null;
  fit_reason: string | null;
  confidence: string | null;
  source_url: string | null;
  suggested_for: string[] | null;
  project_id: string | null;
}

const CONF_TONE: Record<string, string> = {
  high: "border-emerald-600/40 text-emerald-700",
  medium: "border-gold-500/50 text-ink-700",
  low: "border-line-200 text-ink-500",
};

export function RecruitmentBoard({
  code,
  projectId,
  onChanged,
}: {
  code: string;
  projectId: string;
  onChanged: () => void;
}) {
  const qc = useQueryClient();
  const [steering, setSteering] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [composeNotice, setComposeNotice] = useState<string | null>(null);
  const [lastPass, setLastPass] = useState<
    Record<string, { proposed: number; found: number; want: number; notes: string[] }>
  >({});

  const deriveFn = useServerFn(deriveRecruitmentBrief);
  const researchFn = useServerFn(researchCandidates);
  const acceptFn = useServerFn(acceptCandidates);
  const rejectFn = useServerFn(rejectCandidate);
  const updateFn = useServerFn(updateCandidate);
  const addFn = useServerFn(addParticipant);
  const groupsFn = useServerFn(composeFocusGroups);

  const stateQ = useQuery({
    queryKey: ["recruitment", projectId],
    queryFn: () => getRecruitment({ data: { projectId } }),
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["recruitment", projectId] });
    void qc.invalidateQueries({ queryKey: ["research-contacts", code] });
    void qc.invalidateQueries({ queryKey: ["research-panels", code] });
    onChanged();
  };

  const frame = (stateQ.data?.frame ?? null) as Frame | null;
  const people = useMemo(
    () => (stateQ.data?.people ?? []) as unknown as Person[],
    [stateQ.data?.people],
  );
  const panels = stateQ.data?.panels ?? [];

  const byPersona = useMemo(() => {
    const map = new Map<string, { proposed: Person[]; accepted: Person[]; rejected: Person[] }>();
    for (const p of frame?.personas ?? []) {
      map.set(p.label, { proposed: [], accepted: [], rejected: [] });
    }
    for (const person of people) {
      if (person.project_id !== projectId) continue;
      const key = person.persona_label ?? "Unassigned";
      if (!map.has(key)) map.set(key, { proposed: [], accepted: [], rejected: [] });
      const bucket = map.get(key)!;
      const status = person.status ?? "proposed";
      if (status === "proposed") bucket.proposed.push(person);
      else if (status === "rejected") bucket.rejected.push(person);
      else bucket.accepted.push(person);
    }
    return map;
  }, [frame, people, projectId]);

  const totals = useMemo(() => {
    let proposed = 0;
    let accepted = 0;
    for (const b of byPersona.values()) {
      proposed += b.proposed.length;
      accepted += b.accepted.length;
    }
    return { proposed, accepted };
  }, [byPersona]);
  const eligibleAccepted = useMemo(
    () => people.filter((person) => person.status === "accepted" && !person.opted_out_at).length,
    [people],
  );

  const derive = useMutation({
    mutationFn: () => deriveFn({ data: { projectId, steering: steering.trim() || null } }),
    onSuccess: () => {
      setSteering("");
      refresh();
    },
  });

  // The recruiter runs as a short, resumable agent loop: each call is one
  // pass (locate listings → read them → widen), so no single request stalls.
  const research = useMutation({
    mutationFn: async (personaLabel: string) => {
      let last: Awaited<ReturnType<typeof researchFn>> | null = null;
      let totalProposed = 0;
      for (let i = 0; i < 6; i += 1) {
        const res = await researchFn({
          data: { projectId, personaLabel, restart: i === 0 ? true : undefined },
        });
        last = res;
        totalProposed = res.totalProposed ?? totalProposed;
        setLastPass((prev) => ({
          ...prev,
          [res.persona]: {
            proposed: totalProposed,
            found: res.found ?? 0,
            want: res.want,
            notes: res.notes ?? [],
          },
        }));
        refresh();
        if (res.done) break;
      }
      return last!;
    },
    onSuccess: () => refresh(),
  });

  const accept = useMutation({
    mutationFn: (args: { ids?: string[]; personaLabel?: string; all?: boolean }) =>
      acceptFn({ data: { projectId, ...args } }),
    onSuccess: refresh,
  });

  const reject = useMutation({
    mutationFn: (args: { id: string; hard?: boolean }) =>
      rejectFn({ data: { id: args.id, hard: args.hard ?? false, reason: null } }),
    onSuccess: refresh,
  });

  const compose = useMutation({
    mutationFn: () => groupsFn({ data: { projectId } }),
    onMutate: () => setComposeNotice(null),
    onSuccess: (result) => {
      setComposeNotice(result.message);
      if (result.ok) refresh();
    },
  });

  // The one action that moves recruitment forward, published to the sticky bar.
  const firstPersona = frame?.personas?.[0]?.label ?? null;
  useResolveAction(
    "participants",
    !frame
      ? { label: "Derive the recruitment frame", run: () => derive.mutate(), pending: derive.isPending }
      : totals.proposed > 0
        ? {
            label: "Accept all recommended",
            run: () => accept.mutate({ all: true }),
            pending: accept.isPending,
          }
        : totals.accepted === 0 && firstPersona
          ? {
              label: "Research candidates",
              run: () => research.mutate(firstPersona),
              pending: research.isPending,
            }
          : null,
  );

  if (stateQ.isLoading) {
    return <p className="text-sm text-ink-500">Reading the recruitment record…</p>;
  }

  if (stateQ.isError) {
    return (
      <div className="border border-signal-red/30 bg-paper-0 p-6" role="alert">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-signal-red">
          Recruitment record unavailable
        </p>
        <p className="mt-2 text-sm text-ink-700">
          {(stateQ.error as Error).message || "The recruitment record could not be loaded."}
        </p>
        <button type="button" className="btn-secondary mt-4" onClick={() => void stateQ.refetch()}>
          Try again
        </button>
      </div>
    );
  }


  // ── No frame yet: the AI-first entrance ─────────────────────────────────
  if (!frame) {
    return (
      <div className="border border-line-200 bg-paper-0 p-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
          Recruitment · who must be heard from
        </p>
        <h3 className="mt-2 font-serif text-2xl text-ink-950">
          Let the chamber read the brief and name the people to recruit.
        </h3>
        <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-ink-700">
          The recruitment frame is derived from your source brief, the approved programme plan and
          this country&rsquo;s second brain — target personas, defensible sample sizes and where such
          people are publicly listed. Then the chamber researches the open web for real, named,
          sourced individuals against each persona. You accept, edit or reject every one.
        </p>
        <textarea
          value={steering}
          onChange={(e) => setSteering(e.target.value)}
          rows={2}
          placeholder="Optional steer — e.g. weight the frame toward the south coast, exclude anyone already consulted in the tourism review."
          className="mt-4 w-full border border-line-200 bg-paper-0 p-2 text-[12px] focus:border-ink-950 focus:outline-none"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="btn-primary"
            disabled={derive.isPending}
            onClick={() => derive.mutate()}
          >
            {derive.isPending ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Sparkles size={12} />
            )}
            {derive.isPending ? "Reading the brief…" : "Derive the recruitment frame"}
          </button>
          <Explain id="research.recruitment.frame">How this frame was set</Explain>
        </div>
        {derive.isError ? (
          <p className="mt-2 text-[12px] text-rose-600">{(derive.error as Error).message}</p>
        ) : null}
      </div>
    );
  }

  // ── The board ───────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Frame masthead */}
      <div className="border border-line-200 bg-paper-0 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
              Recruitment frame · {frame.personas.length} personas
            </p>
            <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-ink-800">
              {frame.summary}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Explain id="research.recruitment.frame">How this frame was set</Explain>
            <button
              type="button"
              className="btn-ghost"
              disabled={derive.isPending}
              onClick={() => derive.mutate()}
            >
              {derive.isPending ? (
                <Loader2 size={11} className="animate-spin" />
              ) : (
                <Sparkles size={11} />
              )}
              Re-derive
            </button>
          </div>
        </div>
        {(frame.screening?.length ?? 0) > 0 || (frame.exclusions?.length ?? 0) > 0 ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {frame.screening?.length ? (
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
                  Screening
                </p>
                <ul className="mt-1 space-y-0.5 text-[12px] text-ink-700">
                  {frame.screening.map((s) => (
                    <li key={s}>· {s}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {frame.exclusions?.length ? (
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
                  Do not recruit
                </p>
                <ul className="mt-1 space-y-0.5 text-[12px] text-ink-700">
                  {frame.exclusions.map((s) => (
                    <li key={s}>· {s}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line-200 pt-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
            {totals.proposed} proposed · {totals.accepted} accepted
          </p>
          {totals.proposed > 0 ? (
            <button
              type="button"
              className="btn-secondary"
              disabled={accept.isPending}
              onClick={() => accept.mutate({ all: true })}
            >
              {accept.isPending ? (
                <Loader2 size={11} className="animate-spin" />
              ) : (
                <CheckCheck size={12} />
              )}
              Accept every recommendation
            </button>
          ) : null}
          <button
            type="button"
            className="btn-ghost"
            disabled={compose.isPending || eligibleAccepted < 3}
            onClick={() => compose.mutate()}
          >
            {compose.isPending ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <Users size={12} />
            )}
            Compose the focus groups
          </button>
          <Explain id="research.recruitment.groups">How groups are balanced</Explain>
        </div>
        {eligibleAccepted < 3 ? (
          <p className="mt-2 text-[12px] text-ink-700">
            Focus groups unlock after at least 3 candidates are accepted. Research candidates, then
            accept {3 - eligibleAccepted} more participant{3 - eligibleAccepted === 1 ? "" : "s"}.
          </p>
        ) : null}
        {composeNotice ? <p className="mt-2 text-[12px] text-ink-700">{composeNotice}</p> : null}
        {compose.isError ? (
          <p className="mt-2 text-[12px] text-rose-600">{(compose.error as Error).message}</p>
        ) : null}
        {accept.isError ? (
          <p className="mt-2 text-[12px] text-rose-600">{(accept.error as Error).message}</p>
        ) : null}
      </div>

      {/* Panels formed so far */}
      {panels.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {panels.map((p) => (
            <div key={p.id as string} className="border border-line-200 bg-paper-0 p-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
                {String(p.kind) === "focus_group" ? "Focus group" : "Survey frame"}
              </p>
              <p className="mt-1 font-serif text-lg text-ink-950">{String(p.name)}</p>
              <p className="font-mono text-[11px] tabular-nums text-ink-500">
                {p.member_ids.length} seated
              </p>
              {p.description ? (
                <p className="mt-1 text-[12px] leading-relaxed text-ink-700">
                  {String(p.description)}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {/* Persona slates */}
      {frame.personas.map((persona) => {
        const bucket = byPersona.get(persona.label) ?? {
          proposed: [],
          accepted: [],
          rejected: [],
        };
        const pass = lastPass[persona.label];
        const researching = research.isPending && research.variables === persona.label;
        return (
          <div key={persona.label} className="border border-line-200 bg-paper-0">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line-200 p-4">
              <div className="min-w-0">
                <p className="font-serif text-xl text-ink-950">{persona.label}</p>
                <p className="mt-0.5 max-w-2xl text-[12px] leading-relaxed text-ink-700">
                  {persona.who}
                </p>
                {persona.why ? (
                  <p className="mt-1 max-w-2xl text-[12px] italic leading-relaxed text-ink-500">
                    {persona.why}
                  </p>
                ) : null}
                <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
                  target {persona.survey_target} · {persona.focus_group ? "group + survey" : "survey only"}
                  {" · "}
                  {bucket.accepted.length} accepted · {bucket.proposed.length} awaiting you
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Explain id="research.recruitment.sourcing">Sourcing standard</Explain>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={research.isPending}
                  onClick={() => research.mutate(persona.label)}
                >
                  {researching ? (
                    <Loader2 size={11} className="animate-spin" />
                  ) : (
                    <Search size={12} />
                  )}
                  {researching
                    ? "Researching…"
                    : bucket.proposed.length + bucket.accepted.length > 0
                      ? "Research more like this"
                      : "Research candidates"}
                </button>
                {bucket.proposed.length > 0 ? (
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={accept.isPending}
                    onClick={() => accept.mutate({ personaLabel: persona.label })}
                  >
                    <CheckCheck size={12} />
                    Accept all {bucket.proposed.length}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setAdding(adding === persona.label ? null : persona.label)}
                >
                  <Plus size={12} />
                  Add by hand
                </button>
              </div>
            </div>

            {pass ? (
              <p className="border-b border-line-200 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">
                last pass · {pass.found} sourced of {pass.want} wanted · {pass.proposed} new
                {pass.notes.length > 0 ? ` · ${pass.notes[0]}` : ""}
              </p>
            ) : null}
            {research.isError && research.variables === persona.label ? (
              <p className="border-b border-line-200 px-4 py-2 text-[12px] text-rose-600">
                {(research.error as Error).message}
              </p>
            ) : null}

            {adding === persona.label ? (
              <AddPersonForm
                onCancel={() => setAdding(null)}
                onSubmit={async (v) => {
                  await addFn({
                    data: {
                      projectId,
                      countryCode: code,
                      persona_label: persona.label,
                      suggested_for: persona.focus_group ? ["survey", "focus_group"] : ["survey"],
                      ...v,
                    },
                  });
                  setAdding(null);
                  refresh();
                }}
              />
            ) : null}

            {bucket.proposed.length === 0 && bucket.accepted.length === 0 ? (
              <p className="p-4 text-[13px] text-ink-500">
                Nobody sourced for this persona yet — run the research pass, or add someone you
                already know.
              </p>
            ) : (
              <ul className="divide-y divide-line-200">
                {[...bucket.proposed, ...bucket.accepted].map((person) => (
                  <li key={person.id} className="p-3">
                    {editing === person.id ? (
                      <EditPersonForm
                        person={person}
                        onCancel={() => setEditing(null)}
                        onSubmit={async (patch) => {
                          await updateFn({ data: { id: person.id, patch } });
                          setEditing(null);
                          refresh();
                        }}
                      />
                    ) : (
                      <div className="flex flex-wrap items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] text-ink-950">
                            {person.full_name}
                            {person.role_title ? (
                              <span className="text-ink-500"> — {person.role_title}</span>
                            ) : null}
                          </p>
                          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">
                            {person.organisation ?? "—"} · {person.email ?? "no published email"} ·{" "}
                            {(person.suggested_for ?? ["survey"]).join(" + ").replace("_", " ")}
                          </p>
                          {person.fit_reason ? (
                            <p className="mt-1 max-w-3xl text-[12px] leading-relaxed text-ink-700">
                              {person.fit_reason}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              "border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em]",
                              CONF_TONE[person.confidence ?? "medium"] ?? CONF_TONE["medium"],
                            )}
                          >
                            {person.confidence ?? "medium"}
                          </span>
                          {person.source_url ? (
                            <a
                              href={person.source_url}
                              target="_blank"
                              rel="noreferrer"
                              className="btn-ghost"
                            >
                              <ExternalLink size={11} />
                              Source
                            </a>
                          ) : null}
                          <button
                            type="button"
                            className="btn-ghost"
                            onClick={() => setEditing(person.id)}
                          >
                            <Pencil size={11} />
                            Edit
                          </button>
                          {(person.status ?? "accepted") === "proposed" ? (
                            <button
                              type="button"
                              className="btn-secondary"
                              disabled={accept.isPending}
                              onClick={() => accept.mutate({ ids: [person.id] })}
                            >
                              <Check size={12} />
                              Accept
                            </button>
                          ) : (
                            <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-emerald-700">
                              accepted
                            </span>
                          )}
                          <button
                            type="button"
                            className="btn-ghost"
                            title="Remove from this programme"
                            onClick={() => reject.mutate({ id: person.id, hard: true })}
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Small forms ────────────────────────────────────────────────────────────

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-500">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-0.5 w-full border border-line-200 bg-paper-0 px-2 py-1 text-[12px] focus:border-ink-950 focus:outline-none"
      />
    </label>
  );
}

function AddPersonForm({
  onCancel,
  onSubmit,
}: {
  onCancel: () => void;
  onSubmit: (v: {
    full_name: string;
    email: string | null;
    organisation: string | null;
    role_title: string | null;
  }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [org, setOrg] = useState("");
  const [role, setRole] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div className="border-b border-line-200 bg-paper-50 p-3">
      <div className="grid gap-2 sm:grid-cols-4">
        <Field label="Full name" value={name} onChange={setName} placeholder="Marcia Adams" />
        <Field label="Role" value={role} onChange={setRole} placeholder="Permanent Secretary" />
        <Field label="Organisation" value={org} onChange={setOrg} placeholder="Ministry of Finance" />
        <Field label="Email" value={email} onChange={setEmail} placeholder="marcia@gov.gd" />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          className="btn-secondary"
          disabled={busy || name.trim().length < 2}
          onClick={async () => {
            setBusy(true);
            try {
              await onSubmit({
                full_name: name.trim(),
                email: email.trim() || null,
                organisation: org.trim() || null,
                role_title: role.trim() || null,
              });
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? <Loader2 size={11} className="animate-spin" /> : <Plus size={12} />}
          Add to the slate
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel}>
          <X size={11} />
          Cancel
        </button>
      </div>
    </div>
  );
}

function EditPersonForm({
  person,
  onCancel,
  onSubmit,
}: {
  person: Person;
  onCancel: () => void;
  onSubmit: (patch: {
    full_name: string;
    email: string | null;
    organisation: string | null;
    role_title: string | null;
    fit_reason: string | null;
    suggested_for: Array<"survey" | "focus_group">;
  }) => Promise<void>;
}) {
  const [name, setName] = useState(person.full_name);
  const [email, setEmail] = useState(person.email ?? "");
  const [org, setOrg] = useState(person.organisation ?? "");
  const [role, setRole] = useState(person.role_title ?? "");
  const [fit, setFit] = useState(person.fit_reason ?? "");
  const [survey, setSurvey] = useState((person.suggested_for ?? ["survey"]).includes("survey"));
  const [group, setGroup] = useState((person.suggested_for ?? []).includes("focus_group"));
  const [busy, setBusy] = useState(false);

  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-4">
        <Field label="Full name" value={name} onChange={setName} />
        <Field label="Role" value={role} onChange={setRole} />
        <Field label="Organisation" value={org} onChange={setOrg} />
        <Field label="Email" value={email} onChange={setEmail} />
      </div>
      <Field label="Why they fit" value={fit} onChange={setFit} />
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-1.5 text-[12px] text-ink-700">
          <input type="checkbox" checked={survey} onChange={(e) => setSurvey(e.target.checked)} />
          Survey
        </label>
        <label className="flex items-center gap-1.5 text-[12px] text-ink-700">
          <input type="checkbox" checked={group} onChange={(e) => setGroup(e.target.checked)} />
          Focus group
        </label>
        <button
          type="button"
          className="btn-secondary"
          disabled={busy || name.trim().length < 2}
          onClick={async () => {
            setBusy(true);
            try {
              const suggested: Array<"survey" | "focus_group"> = [];
              if (survey) suggested.push("survey");
              if (group) suggested.push("focus_group");
              await onSubmit({
                full_name: name.trim(),
                email: email.trim() || null,
                organisation: org.trim() || null,
                role_title: role.trim() || null,
                fit_reason: fit.trim() || null,
                suggested_for: suggested.length ? suggested : ["survey"],
              });
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? <Loader2 size={11} className="animate-spin" /> : <Check size={12} />}
          Save
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel}>
          <X size={11} />
          Cancel
        </button>
      </div>
    </div>
  );
}
