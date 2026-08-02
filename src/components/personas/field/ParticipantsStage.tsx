// Chamber 07 · Stage 02 · Participants.
//
// The contact book for this programme: who exists, who consented, and which of
// them form the panel this field work will actually hear from.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronRight, Loader2, UserPlus, Users } from "lucide-react";
import { useMemo, useState } from "react";

import { RecruitmentBoard } from "./RecruitmentBoard";
import { useDirtyRegistration } from "./stage-bus";
import { EmptyAction } from "./StageFrame";
import { ShowTheDetail, StageWizard } from "./StageWizard";

import {
  createPanel,
  importContacts,
  listContacts,
  listPanels,
  setContactOptOut,
  setPanelMembers,
} from "@/lib/personas/crm.functions";
import { cn } from "@/lib/utils";

type Contact = {
  id: string;
  full_name: string;
  email: string | null;
  organisation: string | null;
  role_title: string | null;
  consent_status: string;
  opted_out_at: string | null;
};

/** name, email, organisation, role — one per line, comma or tab separated. */
function parseRoster(text: string) {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const cells = line
        .split(/\t|,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
        .map((c) => c.trim().replace(/^"|"$/g, ""));
      const [full_name, email, organisation, role_title] = cells;
      return {
        full_name: (full_name ?? "").slice(0, 200),
        email: email || null,
        organisation: organisation || null,
        role_title: role_title || null,
      };
    })
    .filter((r) => r.full_name.length > 1 && !/^(name|full[_ ]?name)$/i.test(r.full_name));
}

/** A user-controlled collapse: header stays visible, body folds away. */
function Collapse({
  title,
  aside,
  defaultOpen = true,
  children,
}: {
  title: React.ReactNode;
  aside?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-line-200 bg-paper-0">
      <div className="flex flex-wrap items-center justify-between gap-3 p-3">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500 transition-colors hover:text-ink-950"
        >
          <ChevronRight
            size={12}
            className={cn("shrink-0 transition-transform", open && "rotate-90")}
          />
          <span className="min-w-0 truncate">{title}</span>
        </button>
        {aside}
      </div>
      {open ? <div className="border-t border-line-200">{children}</div> : null}
    </div>
  );
}

export function ParticipantsStage({

  code,
  projectId,
  onChanged,
}: {
  code: string;
  projectId: string;
  onChanged: () => void;
}) {
  const qc = useQueryClient();
  const [roster, setRoster] = useState("");
  const [panelName, setPanelName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const importFn = useServerFn(importContacts);
  const createPanelFn = useServerFn(createPanel);
  const setMembersFn = useServerFn(setPanelMembers);
  const optOutFn = useServerFn(setContactOptOut);

  const contactsQ = useQuery({
    queryKey: ["research-contacts", code],
    queryFn: () => listContacts({ data: { countryCode: code, limit: 500 } }),
  });
  const panelsQ = useQuery({
    queryKey: ["research-panels", code],
    queryFn: () => listPanels({ data: { countryCode: code } }),
  });

  const contacts = (contactsQ.data ?? []) as Contact[];
  const projectPanels = useMemo(
    () => (panelsQ.data ?? []).filter((p) => p.project_id === projectId),
    [panelsQ.data, projectId],
  );
  const programmePanelId = projectPanels[0]?.id as string | undefined;
  const panelContactsQ = useQuery({
    queryKey: ["research-contacts", code, "panel", programmePanelId],
    queryFn: () =>
      listContacts({ data: { countryCode: code, panelId: programmePanelId, limit: 500 } }),
    enabled: !!programmePanelId,
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["research-contacts", code] });
    void qc.invalidateQueries({ queryKey: ["research-panels", code] });
    onChanged();
  };

  const doImport = useMutation({
    mutationFn: async () => {
      const rows = parseRoster(roster);
      if (rows.length === 0) throw new Error("No readable rows — one person per line.");
      return importFn({ data: { countryCode: code, source: "paste", rows } });
    },
    onSuccess: () => {
      setRoster("");
      refresh();
    },
  });

  const buildPanel = useMutation({
    mutationFn: async () => {
      const ids = [...selected];
      if (ids.length === 0) throw new Error("Select at least one contact for the panel.");
      const existing = projectPanels[0];
      if (existing) {
        return setMembersFn({
          data: { panelId: existing.id as string, countryCode: code, contactIds: ids },
        });
      }
      return createPanelFn({
        data: {
          countryCode: code,
          projectId,
          name: panelName.trim() || "Programme panel",
          contactIds: ids,
        },
      });
    },
    onSuccess: () => {
      setPanelName("");
      refresh();
    },
  });

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  useDirtyRegistration(
    "participants-roster",
    roster.trim().length > 0,
    "a pasted roster",
    async () => {
      await doImport.mutateAsync();
    },
  );

  const panelBlock =
    projectPanels.length > 0 ? (
      <div className="border border-line-200 bg-paper-0 p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
          This programme's panel
        </p>
        {projectPanels.map((p) => (
          <p key={p.id as string} className="mt-1 font-serif text-lg text-ink-950">
            {String(p.name)}{" "}
            <span className="font-mono text-[11px] tabular-nums text-ink-500">
              · {String((p as { member_count?: number }).member_count ?? 0)} members
            </span>
          </p>
        ))}
      </div>
    ) : null;

  // The paste-a-roster card — the manual way in, kept for when AI recruitment
  // isn't the right instrument.
  const rosterBlock = (
    <div className="border border-line-200 bg-paper-0 p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
        Add people · paste a roster
      </p>
      <p className="mt-1 text-[12px] text-ink-600">
        One person per line — name, email, organisation, role. Duplicates merge on email.
      </p>
      <textarea
        value={roster}
        onChange={(e) => setRoster(e.target.value)}
        rows={4}
        placeholder={"Marcia Adams, marcia@gov.gd, Ministry of Finance, Permanent Secretary"}
        className="mt-2 w-full border border-line-200 bg-paper-0 p-2 font-mono text-[12px] focus:border-ink-950 focus:outline-none"
      />
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          className="btn-secondary"
          disabled={doImport.isPending}
          onClick={() => doImport.mutate()}
        >
          {doImport.isPending ? (
            <Loader2 size={11} className="animate-spin" />
          ) : (
            <UserPlus size={12} />
          )}
          Add to the contact book
        </button>
        {doImport.isSuccess ? (
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-emerald-700">
            {doImport.data.inserted} added · {doImport.data.merged} merged
          </span>
        ) : null}
        {doImport.isError ? (
          <span className="text-[11px] text-rose-600">{(doImport.error as Error).message}</span>
        ) : null}
      </div>
    </div>
  );

  const panelMembers = projectPanels.reduce(
    (n, p) => n + Number((p as { member_count?: number }).member_count ?? 0),
    0,
  );
  const panelContacts = (panelContactsQ.data ?? []) as Contact[];
  const live = panelContacts.filter((c) => !c.opted_out_at && c.consent_status !== "declined");
  const reachable = live.filter((c) => !!c.email);
  const unreachable = live.filter((c) => !c.email);
  const optedOut = panelContacts.filter(
    (c) => !!c.opted_out_at || c.consent_status === "declined",
  );

  // The contact book — who we could hear from. On the panel screen it is the
  // picker; the button that forms the panel lives in the action head, so the
  // screen never offers the same move twice.
  const contactBook = (withPicker: boolean) =>
    contactsQ.isLoading ? (
      <p className="text-sm text-ink-500">Reading the contact book…</p>
    ) : contacts.length === 0 ? (
      <EmptyAction
        title="No contacts yet."
        body="A field programme needs real people. Research candidates on the previous screen, or paste a roster by hand."
      />
    ) : (
      <div className="border border-line-200 bg-paper-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-200 p-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            Contact book · {contacts.length}
            {withPicker ? ` · ${selected.size} selected` : null}
          </p>
          {withPicker && projectPanels.length === 0 ? (
            <input
              value={panelName}
              onChange={(e) => setPanelName(e.target.value)}
              placeholder="Panel name"
              className="border border-line-200 bg-paper-0 px-2 py-1 text-[12px] focus:border-ink-950 focus:outline-none"
            />
          ) : null}
        </div>
        <ul className="divide-y divide-line-200">
          {contacts.map((c) => {
            const out = !!c.opted_out_at || c.consent_status === "declined";
            return (
              <li key={c.id} className="flex items-center gap-3 p-3">
                {withPicker ? (
                  <input
                    type="checkbox"
                    checked={selected.has(c.id)}
                    disabled={out}
                    onChange={() => toggle(c.id)}
                    aria-label={`Select ${c.full_name}`}
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className={cn("text-[13px] text-ink-950", out && "line-through opacity-50")}>
                    {c.full_name}
                    {c.role_title ? <span className="text-ink-500"> — {c.role_title}</span> : null}
                  </p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">
                    {c.organisation ?? "—"} · {c.email ?? "no email"} · consent {c.consent_status}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => optOutFn({ data: { id: c.id, optedOut: !out } }).then(refresh)}
                >
                  {out ? "Restore" : "Opt out"}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );

  /** The consent screen asks one thing only: can we actually reach these people? */
  const reachabilityBlock =
    panelMembers === 0 ? (
      <EmptyAction
        title="Nobody to check yet."
        body="Form the panel first — reachability is checked against the people this programme will approach."
      />
    ) : panelContactsQ.isLoading ? (
      <p className="text-sm text-ink-500">Checking the programme panel…</p>
    ) : (
      <div className="border border-line-200 bg-paper-0">
        <div className="grid grid-cols-3 divide-x divide-line-200 border-b border-line-200">
          {[
            { label: "Reachable", n: reachable.length },
            { label: "No channel", n: unreachable.length },
            { label: "Opted out", n: optedOut.length },
          ].map((s) => (
            <div key={s.label} className="p-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
                {s.label}
              </p>
              <p className="mt-0.5 font-serif text-2xl tabular-nums text-ink-950">{s.n}</p>
            </div>
          ))}
        </div>
        {unreachable.length > 0 ? (
          <ul className="divide-y divide-line-200">
            {unreachable.map((c) => (
              <li key={c.id} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-ink-950">{c.full_name}</p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">
                    No email on file — an invitation would have nowhere to go.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => optOutFn({ data: { id: c.id, optedOut: true } }).then(refresh)}
                >
                  Opt out
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-3 text-[13px] text-ink-700">
            Everyone still in play has a channel we can send an invitation to.
          </p>
        )}
      </div>
    );

  return (
    <StageWizard
      actions={{
        find: {
          instruction:
            "Research candidates against the brief, then accept the ones worth approaching.",
          outstanding: contacts.length === 0 ? "nobody accepted into the contact book yet" : null,
          doneNote: `${contacts.length} ${contacts.length === 1 ? "person" : "people"} on file`,
        },
        panel: {
          instruction: "Tick the people this programme will approach, then form the panel.",
          outstanding:
            panelMembers === 0
              ? selected.size === 0
                ? "no one selected yet"
                : `${selected.size} selected — not yet formed into a panel`
              : null,
          doneNote: `Panel formed · ${panelMembers} ${panelMembers === 1 ? "member" : "members"}`,
          error: buildPanel.isError ? (buildPanel.error as Error).message : null,
          action:
            panelMembers === 0 || selected.size > 0
              ? {
                  label: projectPanels.length > 0 ? "Set the panel" : "Form the panel",
                  onClick: () => buildPanel.mutate(),
                  pending: buildPanel.isPending,
                  disabled: selected.size === 0,
                  icon: <Users size={12} />,
                  note: "This fixes who this programme fields to.",
                }
              : null,
        },
        consent: {
          instruction:
            "Confirm every panel member can be reached, and opt out anyone who has declined.",
          outstanding:
            optedOut.length > 0
              ? `${optedOut.length} panel ${optedOut.length === 1 ? "member has" : "members have"} declined`
              : unreachable.length > 0
                ? `${unreachable.length} panel ${unreachable.length === 1 ? "member has" : "members have"} no way to be reached`
                : reachable.length !== panelMembers
                  ? "the programme panel has not been fully checked"
                  : null,
          doneNote: `${reachable.length} reachable · ${optedOut.length} opted out`,
        },
      }}
      panels={{
        // ── Step 1 · Find candidates ──────────────────────────────────────
        find: (
          <div className="space-y-5">
            <RecruitmentBoard code={code} projectId={projectId} onChanged={refresh} />
            <ShowTheDetail label={`Add people by hand · ${contacts.length} on file`}>
              {rosterBlock}
            </ShowTheDetail>
          </div>
        ),

        // ── Step 2 · Form the panel ───────────────────────────────────────
        panel: (
          <div className="space-y-5">
            {panelBlock}
            {contactBook(true)}
            <ShowTheDetail label="Add more people by hand">{rosterBlock}</ShowTheDetail>
          </div>
        ),

        // ── Step 3 · Record consent ───────────────────────────────────────
        consent: (
          <div className="space-y-5">
            {panelBlock}
            {reachabilityBlock}
            <ShowTheDetail label={`Show the whole contact book · ${contacts.length}`}>
              {contactBook(false)}
            </ShowTheDetail>
          </div>
        ),
      }}
    />
  );
}
