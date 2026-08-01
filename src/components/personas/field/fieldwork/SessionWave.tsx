// Chamber 07 · Stage 04 · a sessions wave.
//
// Focus groups, depth interviews and expert panels. The slates composed in
// Participants are the starting point — the admin schedules a room that already
// exists rather than inventing one — and a wave is only finished when every
// session held has its transcript filed to the second brain.

import { useMutation } from "@tanstack/react-query";
import { CalendarPlus, CheckCircle2, FileText, Loader2, Users } from "lucide-react";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { IngestPanel } from "./IngestPanel";
import { WaveShell } from "./WaveShell";

import { useDirtyRegistration } from "../stage-bus";

import { attachSessionTranscript, upsertSession } from "@/lib/personas/field-sessions.functions";
import { scheduleFromSlate } from "@/lib/personas/fieldwork.functions";
import type { FieldworkBoard, WaveState } from "@/lib/personas/fieldwork-plan.server";

export function SessionWave({
  index,
  state,
  board,
  studyId,
  refresh,
}: {
  index: number;
  state: WaveState;
  board: FieldworkBoard;
  studyId: string;
  refresh: () => void;
}) {
  const [note, setNote] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState("");
  const [transcriptFor, setTranscriptFor] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [intakeFor, setIntakeFor] = useState("");

  const scheduleFn = useServerFn(scheduleFromSlate);
  const sessionFn = useServerFn(upsertSession);
  const transcriptFn = useServerFn(attachSessionTranscript);

  const method = state.wave.sessionMethod ?? "other";
  const mine = board.sessions.filter((s) => s.method === method);
  const openSlates = board.slates.filter((s) => !s.scheduledSessionId);

  const useRun = (fn: () => Promise<string>) =>
    useMutation({
      mutationFn: fn,
      onSuccess: (m) => {
        setNote(m);
        refresh();
      },
      onError: (e: Error) => setNote(e.message),
    });

  const fromSlate = useMutation({
    mutationFn: async (slate: FieldworkBoard["slates"][number]) => {
      const r = await scheduleFn({
        data: {
          studyId,
          slateId: slate.id,
          title: slate.name,
          method,
          scheduled_at: when ? new Date(when).toISOString() : null,
        },
      });
      return `${slate.name} scheduled with ${r.seated} seated.`;
    },
    onSuccess: (m) => {
      setNote(m);
      refresh();
    },
    onError: (e: Error) => setNote(e.message),
  });

  const addBlank = useRun(async () => {
    if (!title.trim()) throw new Error("Give the session a name.");
    await scheduleFn({
      data: {
        studyId,
        slateId: null,
        title: title.trim(),
        method,
        scheduled_at: when ? new Date(when).toISOString() : null,
      },
    });
    setTitle("");
    setWhen("");
    return "Session scheduled.";
  });

  const markHeld = useMutation({
    mutationFn: async (s: { id: string; title: string }) => {
      await sessionFn({ data: { id: s.id, studyId, title: s.title, method, status: "held" } });
      return "Marked as held — file the transcript to close it out.";
    },
    onSuccess: (m) => {
      setNote(m);
      refresh();
    },
    onError: (e: Error) => setNote(e.message),
  });

  const saveTranscript = useMutation({
    mutationFn: async () => {
      await transcriptFn({
        data: { sessionId: transcriptFor as string, transcript, ingest: true },
      });
      setTranscript("");
      setTranscriptFor(null);
      return "Transcript filed to the second brain.";
    },
    onSuccess: (m) => {
      setNote(m);
      refresh();
    },
    onError: (e: Error) => setNote(e.message),
  });

  useDirtyRegistration(
    `fieldwork-transcript-${method}`,
    !!transcriptFor && transcript.trim().length > 0,
    "a transcript",
    async () => {
      await saveTranscript.mutateAsync();
    },
  );

  const captured = state.counts["captured"] ?? 0;
  const planned = Math.max(mine.length, state.wave.target ?? 0, openSlates.length);

  return (
    <WaveShell
      index={index}
      state={state}
      done={captured}
      target={planned}
      meter={`${captured} of ${planned || mine.length} sessions captured · ${state.counts["scheduled"] ?? 0} scheduled`}
    >
      <div className="space-y-4">
        {openSlates.length > 0 ? (
          <div className="border border-line-200 bg-paper-50 p-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
              Slates composed in Participants
            </p>
            <ul className="mt-2 space-y-2">
              {openSlates.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-2">
                  <Users className="h-3.5 w-3.5 shrink-0 text-ink-500" />
                  <span className="text-[13px] text-ink-900">{s.name}</span>
                  <span className="font-mono text-[11px] tabular-nums text-ink-500">
                    {s.members.length} seated
                  </span>
                  <button
                    type="button"
                    className="btn-secondary ml-auto"
                    disabled={fromSlate.isPending}
                    onClick={() => fromSlate.mutate(s)}
                  >
                    {fromSlate.isPending ? (
                      <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CalendarPlus className="mr-1 inline h-3.5 w-3.5" />
                    )}
                    Schedule this room
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {mine.length > 0 ? (
          <ul className="divide-y divide-line-100 border border-line-200">
            {mine.map((s) => (
              <li key={s.id} className="p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[14px] text-ink-950">{s.title}</span>
                  <span className="font-mono text-[11px] text-ink-500">
                    {s.scheduled_at ? new Date(s.scheduled_at).toLocaleString() : "no date set"} ·{" "}
                    {s.attendees.length} seated
                  </span>
                  <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.16em] text-ink-600">
                    {s.hasTranscript ? "captured" : s.status}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {s.status === "scheduled" ? (
                    <button
                      type="button"
                      className="btn-ghost"
                      disabled={markHeld.isPending}
                      onClick={() => markHeld.mutate({ id: s.id, title: s.title })}
                    >
                      <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />
                      Mark held
                    </button>
                  ) : null}
                  {!s.hasTranscript ? (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setTranscriptFor(transcriptFor === s.id ? null : s.id)}
                    >
                      <FileText className="mr-1 inline h-3.5 w-3.5" />
                      {transcriptFor === s.id ? "Cancel" : "File transcript"}
                    </button>
                  ) : null}
                </div>
                {transcriptFor === s.id ? (
                  <div className="mt-2">
                    <textarea
                      rows={6}
                      value={transcript}
                      onChange={(e) => setTranscript(e.target.value)}
                      className="w-full border border-line-200 bg-paper-0 p-2 text-[13px] focus:border-ink-950 focus:outline-none"
                      placeholder="Paste the transcript. It is filed to the second brain with the session's provenance."
                    />
                    <button
                      type="button"
                      className="btn-primary mt-2"
                      disabled={saveTranscript.isPending || transcript.trim().length < 40}
                      onClick={() => saveTranscript.mutate()}
                    >
                      {saveTranscript.isPending ? "Filing…" : "File transcript"}
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="border border-line-200 bg-paper-50 p-2">
          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
              File uploaded material against
            </span>
            <select
              value={intakeFor}
              onChange={(e) => setIntakeFor(e.target.value)}
              className="mt-1 w-full border border-line-200 bg-paper-0 p-2 text-[13px] focus:border-ink-950 focus:outline-none"
            >
              <option value="">A new session, named from the material</option>
              {mine
                .filter((s) => !s.hasTranscript)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
            </select>
          </label>
        </div>

        <IngestPanel
          key={intakeFor || "new"}
          sessionId={intakeFor || null}
          studyId={studyId}
          countryCode={board.countryCode}
          waveId={state.wave.id}
          expect="narrative"
          questionIds={
            board.instruments.find((i) => i.kind === "discussion_guide")?.questionIds ?? []
          }
          refresh={refresh}
        />

        <div className="flex flex-wrap items-end gap-2">
          <label className="flex-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
              Add a session
            </span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`${state.wave.title} — room 1`}
              className="mt-1 w-full border border-line-200 bg-paper-0 p-2 text-[13px] focus:border-ink-950 focus:outline-none"
            />
          </label>
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="border border-line-200 bg-paper-0 p-2 text-[13px] focus:border-ink-950 focus:outline-none"
          />
          <button
            type="button"
            className="btn-secondary"
            disabled={addBlank.isPending}
            onClick={() => addBlank.mutate()}
          >
            Schedule
          </button>
        </div>
      </div>

      {note ? <p className="mt-3 text-[12px] text-ink-700">{note}</p> : null}
    </WaveShell>
  );
}
