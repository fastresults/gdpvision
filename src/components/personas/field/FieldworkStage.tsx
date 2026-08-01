// Chamber 07 · Stage 04 · Fieldwork.
//
// Two ways evidence arrives: a hosted collection with invited participants, and
// sessions held in the room. Both are shown side by side so nothing is hidden
// behind a tab the user never opens.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarPlus, Loader2, Mail, PlayCircle, Upload } from "lucide-react";
import { useState } from "react";

import { EmptyAction } from "./StageFrame";
import { useDirtyRegistration, useResolveAction } from "./stage-bus";

import { listContacts, listPanels } from "@/lib/personas/crm.functions";
import {
  getCollection,
  importResponses,
  inviteContacts,
  openCollection,
} from "@/lib/personas/field-collection.functions";
import { getInstruments } from "@/lib/personas/field-instrument.functions";
import {
  attachSessionTranscript,
  listSessions,
  upsertSession,
} from "@/lib/personas/field-sessions.functions";

export function FieldworkStage({
  code,
  projectId,
  studyId,
  onChanged,
}: {
  code: string;
  projectId: string;
  studyId: string | null;
  onChanged: () => void;
}) {
  const qc = useQueryClient();
  const [sessionTitle, setSessionTitle] = useState("");
  const [sessionAt, setSessionAt] = useState("");
  const [transcriptFor, setTranscriptFor] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [rows, setRows] = useState("");

  const openFn = useServerFn(openCollection);
  const inviteFn = useServerFn(inviteContacts);
  const importFn = useServerFn(importResponses);
  const sessionFn = useServerFn(upsertSession);
  const transcriptFn = useServerFn(attachSessionTranscript);

  const collectionQ = useQuery({
    queryKey: ["field-collection", studyId],
    queryFn: () => getCollection({ data: { studyId: studyId as string } }),
    enabled: !!studyId,
  });
  const sessionsQ = useQuery({
    queryKey: ["field-sessions", studyId],
    queryFn: () => listSessions({ data: { studyId: studyId as string } }),
    enabled: !!studyId,
  });
  const instrumentQ = useQuery({
    queryKey: ["field-instrument", studyId],
    queryFn: () => getInstruments({ data: { studyId: studyId as string } }),
    enabled: !!studyId,
  });
  const panelsQ = useQuery({
    queryKey: ["research-panels", code],
    queryFn: () => listPanels({ data: { countryCode: code } }),
  });
  const panelId = (panelsQ.data ?? []).find((p) => p.project_id === projectId)?.id as
    | string
    | undefined;
  const panelContactsQ = useQuery({
    queryKey: ["research-contacts", code, panelId],
    queryFn: () => listContacts({ data: { countryCode: code, panelId, limit: 500 } }),
    enabled: !!panelId,
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["field-collection", studyId] });
    void qc.invalidateQueries({ queryKey: ["field-sessions", studyId] });
    onChanged();
  };

  const collection = collectionQ.data?.collection as { id: string; status: string } | null;
  const invitations = collectionQ.data?.invitations ?? [];
  const responseCount = collectionQ.data?.responseCount ?? 0;

  const open = useMutation({
    mutationFn: async () =>
      openFn({
        data: {
          studyId: studyId as string,
          instrumentId:
            (
              instrumentQ.data?.instruments.find((i) => i.kind === "survey") ??
              instrumentQ.data?.instruments[0]
            )?.id ?? null,
          access: "invited",
        },
      }),
    onSuccess: refresh,
  });

  const invite = useMutation({
    mutationFn: async () => {
      const ids = (panelContactsQ.data ?? []).map((c) => c.id as string);
      if (!collection) throw new Error("Open the collection first.");
      if (ids.length === 0) throw new Error("The panel is empty — go back to Participants.");
      return inviteFn({ data: { collectionId: collection.id, contactIds: ids } });
    },
    onSuccess: refresh,
  });

  const importRows = useMutation({
    mutationFn: async () => {
      const parsed = rows
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => {
          try {
            return JSON.parse(l) as Record<string, unknown>;
          } catch {
            return { answer: l } as Record<string, unknown>;
          }
        });
      if (parsed.length === 0) throw new Error("Nothing to import.");
      return importFn({ data: { studyId: studyId as string, source: "paste", rows: parsed } });
    },
    onSuccess: () => {
      setRows("");
      refresh();
    },
  });

  const addSession = useMutation({
    mutationFn: async () =>
      sessionFn({
        data: {
          studyId: studyId as string,
          title: sessionTitle.trim() || "Field session",
          scheduled_at: sessionAt ? new Date(sessionAt).toISOString() : null,
        },
      }),
    onSuccess: () => {
      setSessionTitle("");
      setSessionAt("");
      refresh();
    },
  });

  const markHeld = useMutation({
    mutationFn: async (s: { id: string; title: string }) =>
      sessionFn({ data: { id: s.id, studyId: studyId as string, title: s.title, status: "held" } }),
    onSuccess: refresh,
  });

  const saveTranscript = useMutation({
    mutationFn: async () =>
      transcriptFn({
        data: { sessionId: transcriptFor as string, transcript, ingest: true },
      }),
    onSuccess: () => {
      setTranscript("");
      setTranscriptFor(null);
      refresh();
    },
  });

  // Unsaved work here is text sitting in a box: a transcript, or pasted returns.
  const heldCount = (sessionsQ.data ?? []).filter(
    (s) => (s as { status?: string }).status === "held",
  ).length;
  useDirtyRegistration(
    "fieldwork-transcript",
    !!transcriptFor && transcript.trim().length > 0,
    "a transcript",
    async () => {
      await saveTranscript.mutateAsync();
    },
  );
  useDirtyRegistration("fieldwork-returns", rows.trim().length > 0, "pasted returns", async () => {
    await importRows.mutateAsync();
  });

  useResolveAction(
    "fieldwork",
    !collection
      ? {
          label: "Open the collection",
          run: () => open.mutate(),
          pending: open.isPending,
        }
      : responseCount === 0 && heldCount === 0
        ? {
            label: invitations.length === 0 ? "Invite the panel" : "Import returns",
            run: () => (invitations.length === 0 ? invite.mutate() : importRows.mutate()),
            pending: invite.isPending || importRows.isPending,
          }
        : null,
  );

  if (!studyId) {
    return (
      <EmptyAction
        title="Nothing to run yet."
        body="Approve the programme plan, then draft an instrument — fieldwork collects against both."
      />
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {/* Hosted collection */}
      <div className="border border-line-200 bg-paper-0 p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
          Hosted collection
        </p>
        {!collection ? (
          <>
            <p className="mt-1 text-[13px] text-ink-700">
              Open the instrument to invited participants. Each gets a coded link; consent is
              enforced at enrolment.
            </p>
            <button
              type="button"
              className="btn-primary mt-3"
              disabled={open.isPending}
              onClick={() => open.mutate()}
            >
              {open.isPending ? (
                <Loader2 size={11} className="animate-spin" />
              ) : (
                <PlayCircle size={12} />
              )}
              Open the collection
            </button>
          </>
        ) : (
          <>
            <p className="mt-1 font-serif text-lg text-ink-950">
              {collection.status === "open" ? "Collecting" : collection.status}
            </p>
            <p className="font-mono text-[11px] tabular-nums text-ink-600">
              {invitations.length} invited · {responseCount} returned
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-secondary"
                disabled={invite.isPending}
                onClick={() => invite.mutate()}
              >
                {invite.isPending ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : (
                  <Mail size={12} />
                )}
                Invite the panel
              </button>
            </div>
            {invite.isError ? (
              <p className="mt-2 text-[11px] text-rose-600">{(invite.error as Error).message}</p>
            ) : null}

            <div className="mt-4 border-t border-line-200 pt-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
                Collected off-platform? Paste the returns
              </p>
              <textarea
                value={rows}
                onChange={(e) => setRows(e.target.value)}
                rows={3}
                placeholder="One return per line — JSON object, or plain text for a single open answer."
                className="mt-1 w-full border border-line-200 bg-paper-0 p-2 font-mono text-[11px] focus:border-ink-950 focus:outline-none"
              />
              <button
                type="button"
                className="btn-secondary mt-2"
                disabled={importRows.isPending}
                onClick={() => importRows.mutate()}
              >
                {importRows.isPending ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : (
                  <Upload size={12} />
                )}
                Import returns
              </button>
              {importRows.isError ? (
                <p className="mt-2 text-[11px] text-rose-600">
                  {(importRows.error as Error).message}
                </p>
              ) : null}
            </div>
          </>
        )}
      </div>

      {/* Sessions */}
      <div className="border border-line-200 bg-paper-0 p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
          Sessions in the room
        </p>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <input
            value={sessionTitle}
            onChange={(e) => setSessionTitle(e.target.value)}
            placeholder="Session title"
            className="min-w-[10rem] flex-1 border border-line-200 bg-paper-0 px-2 py-1 text-[13px] focus:border-ink-950 focus:outline-none"
          />
          <input
            type="datetime-local"
            value={sessionAt}
            onChange={(e) => setSessionAt(e.target.value)}
            className="border border-line-200 bg-paper-0 px-2 py-1 text-[13px] focus:border-ink-950 focus:outline-none"
          />
          <button
            type="button"
            className="btn-secondary"
            disabled={addSession.isPending}
            onClick={() => addSession.mutate()}
          >
            {addSession.isPending ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <CalendarPlus size={12} />
            )}
            Schedule
          </button>
        </div>

        <ul className="mt-3 divide-y divide-line-200">
          {(sessionsQ.data ?? []).map((s) => {
            const row = s as {
              id: string;
              title: string;
              status: string;
              scheduled_at: string | null;
            };
            return (
              <li key={row.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[13px] text-ink-950">{row.title}</p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">
                      {row.scheduled_at
                        ? new Date(row.scheduled_at).toLocaleString()
                        : "unscheduled"}{" "}
                      · {row.status}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {row.status !== "held" ? (
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => markHeld.mutate({ id: row.id, title: row.title })}
                      >
                        Mark held
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => setTranscriptFor(transcriptFor === row.id ? null : row.id)}
                    >
                      Transcript
                    </button>
                  </div>
                </div>
                {transcriptFor === row.id ? (
                  <div className="mt-2">
                    <textarea
                      value={transcript}
                      onChange={(e) => setTranscript(e.target.value)}
                      rows={4}
                      placeholder="Paste the transcript — it is filed to the second brain with the session's provenance."
                      className="w-full border border-line-200 bg-paper-0 p-2 text-[12px] focus:border-ink-950 focus:outline-none"
                    />
                    <button
                      type="button"
                      className="btn-primary mt-2"
                      disabled={saveTranscript.isPending || transcript.trim().length === 0}
                      onClick={() => saveTranscript.mutate()}
                    >
                      {saveTranscript.isPending ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : null}
                      File the transcript
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
        {(sessionsQ.data ?? []).length === 0 ? (
          <p className="mt-3 text-[12px] text-ink-600">
            No sessions yet. Schedule one above, or run the whole programme as a hosted collection.
          </p>
        ) : null}
      </div>
    </div>
  );
}
