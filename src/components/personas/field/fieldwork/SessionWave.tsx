// Chamber 07 · Stage 04 · a sessions wave.
//
// Focus groups, depth interviews and expert panels. Four beats: seat the rooms,
// hold them, capture what was said, close the wave. The slates composed in
// Participants are the starting point — the operator schedules a room that
// already exists — and a wave is finished only when every session held has its
// transcript filed to the second brain.

import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CalendarPlus,
  CheckCircle2,
  FileText,
  Loader2,
  Mic,
  PlusCircle,
  Users,
} from "lucide-react";
import { useState } from "react";

import { IngestPanel } from "./IngestPanel";
import { WaveShell } from "./WaveShell";

import { Flash } from "../kit/Flash";
import { Hint } from "../kit/Hint";
import { Panel } from "../kit/Panel";
import { StepLadder, StepRow, type StepState } from "../kit/StepRow";
import { sessionPhase } from "../kit/StatusPill";
import { methodLabel, plural } from "../kit/labels";
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
  const [note, setNote] = useState<{ tone: "done" | "attention"; text: string } | null>(null);
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState("");
  const [transcriptFor, setTranscriptFor] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");

  const scheduleFn = useServerFn(scheduleFromSlate);
  const sessionFn = useServerFn(upsertSession);
  const transcriptFn = useServerFn(attachSessionTranscript);

  const method = state.wave.sessionMethod ?? "other";
  const label = methodLabel(method);
  const mine = board.sessions.filter((s) => s.method === method);
  const openSlates = board.slates.filter((s) => !s.scheduledSessionId);

  const ok = (text: string) => {
    setNote({ tone: "done", text });
    refresh();
  };
  const bad = (e: Error) => setNote({ tone: "attention", text: e.message });

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
      return `${slate.name} is seated with ${r.seated} ${plural(r.seated, "participant")}.`;
    },
    onSuccess: ok,
    onError: bad,
  });

  const addBlank = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("Give the room a name before scheduling it.");
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
      return "Room scheduled. Seat it from Participants, or record it as held once it happens.";
    },
    onSuccess: ok,
    onError: bad,
  });

  const markHeld = useMutation({
    mutationFn: async (s: { id: string; title: string }) => {
      await sessionFn({ data: { id: s.id, studyId, title: s.title, method, status: "held" } });
      return `${s.title} marked as held — file its transcript to close it out.`;
    },
    onSuccess: ok,
    onError: bad,
  });

  const saveTranscript = useMutation({
    mutationFn: async () => {
      await transcriptFn({
        data: { sessionId: transcriptFor as string, transcript, ingest: true },
      });
      setTranscript("");
      setTranscriptFor(null);
      return "Transcript filed to the second brain with the session's provenance.";
    },
    onSuccess: ok,
    onError: bad,
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
  const scheduled = state.counts["scheduled"] ?? 0;
  const planned = Math.max(mine.length, state.wave.target ?? 0, openSlates.length);
  const held = mine.filter((s) => s.status === "held" && !s.hasTranscript);
  const complete = state.status === "complete";

  const s1: StepState = mine.length > 0 ? "done" : "live";
  const s2: StepState = mine.length === 0 ? "locked" : held.length > 0 || captured > 0 ? "done" : "live";
  const s3: StepState = mine.length === 0 ? "locked" : "live";
  const s4: StepState = complete ? "done" : captured > 0 ? "live" : "locked";

  const nextMove = complete
    ? null
    : mine.length === 0
      ? openSlates.length > 0
        ? `Schedule the ${openSlates.length} ${plural(openSlates.length, "slate")} already composed in Participants.`
        : `Schedule the first ${label.toLowerCase()} for this wave.`
      : held.length > 0
        ? `${held.length} ${plural(held.length, "room")} held without a transcript — capture what was said.`
        : captured < planned
          ? "Hold the remaining rooms, then record them as held and file their transcripts."
          : "Every room is captured — the wave will score itself as complete.";

  const goToNext = () =>
    document
      .getElementById(`wave-${state.wave.id}-ladder`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });

  return (
    <WaveShell
      index={index}
      state={state}
      phase={sessionPhase({ complete, scheduled, captured, planned })}
      done={captured}
      target={planned}
      produces={`A filed transcript for every ${label.toLowerCase()} held, readable in Evidence and searchable in the second brain.`}
      nextMove={nextMove}
      onGoToNext={goToNext}
      meter={
        captured === 0
          ? `Nothing captured yet · ${planned || mine.length} planned · ${scheduled} scheduled`
          : `${captured} of ${planned || mine.length} captured · ${scheduled} scheduled`
      }
    >
      <div id={`wave-${state.wave.id}-ladder`}>
        <StepLadder>
          {/* ① Seat the rooms */}
          <StepRow
            index={1}
            state={s1}
            title="Seat the rooms"
            instruction={`Schedule each ${label.toLowerCase()} this wave needs. Slates composed in Participants come through already seated.`}
            hint={{
              what: "Creates the session record and seats the people on the slate.",
              then: "Nothing is sent to participants here — scheduling is an internal act.",
            }}
            summary={
              mine.length > 0
                ? `${mine.length} ${plural(mine.length, "room")} scheduled${
                    openSlates.length > 0 ? ` · ${openSlates.length} slate still unscheduled` : ""
                  }`
                : undefined
            }
          >
            <div className="space-y-3">
              {openSlates.length > 0 ? (
                <div className="border border-line-200 bg-paper-50 p-3">
                  <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
                    <Users className="h-3 w-3" /> Slates composed in Participants
                    <Hint
                      what="Groups you already balanced in Stage 02."
                      then="Scheduling one carries its members across as seated attendees."
                    />
                  </p>
                  <ul className="mt-2 space-y-2">
                    {openSlates.map((s) => (
                      <li key={s.id} className="flex flex-wrap items-center gap-2">
                        <span className="text-[13px] text-ink-900">{s.name}</span>
                        <span className="font-mono text-[11px] tabular-nums text-ink-500">
                          {s.members.length} to seat
                        </span>
                        <button
                          type="button"
                          className="btn-secondary ml-auto min-h-11"
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

              <Panel
                icon={PlusCircle}
                title="Schedule a room by hand"
                purpose="For a session that was not composed from a slate."
                hint={{
                  what: "Creates an empty session you can seat and capture later.",
                  then: "Use this when the room was arranged outside the system.",
                }}
              >
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="block">
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
                      Name this room
                    </span>
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={`${label} · north coast operators`}
                      className="mt-1 w-full border border-line-200 bg-paper-0 p-2 text-[13px] focus:border-ink-950 focus:outline-none"
                    />
                  </label>
                  <label className="block">
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
                      When (optional)
                    </span>
                    <input
                      type="datetime-local"
                      value={when}
                      onChange={(e) => setWhen(e.target.value)}
                      className="mt-1 w-full border border-line-200 bg-paper-0 p-2 text-[13px] focus:border-ink-950 focus:outline-none"
                    />
                  </label>
                </div>
                <button
                  type="button"
                  className="btn-secondary mt-2 min-h-11"
                  disabled={addBlank.isPending || title.trim().length === 0}
                  onClick={() => addBlank.mutate()}
                >
                  {addBlank.isPending ? "Scheduling…" : "Schedule this room"}
                </button>
              </Panel>
            </div>
          </StepRow>

          {/* ② + ③ Hold and capture — the roster carries both */}
          <StepRow
            index={2}
            state={s2}
            title="Hold the rooms"
            instruction="As each session happens, record it as held. That is what tells the wave a room is done being arranged."
            hint={{
              what: "Moves the session from scheduled to held.",
              then: "A held room without a transcript is the wave's outstanding work.",
            }}
            unlocks="a room is scheduled"
            summary={
              s2 === "done"
                ? `${captured} captured · ${held.length} held awaiting a transcript`
                : undefined
            }
          />

          <StepRow
            index={3}
            state={s3}
            title="Capture what was said"
            instruction="File a transcript against each room held — typed here, or dropped in as a recording or document for the AI to transcribe and map."
            hint={{
              what: "Files the record of the session and archives it to the second brain.",
              then: "A room only counts as captured once its transcript is filed.",
            }}
            unlocks="a room is scheduled"
          >
            <div className="space-y-3">
              {mine.length > 0 ? (
                <ul className="divide-y divide-line-100 border border-line-200 bg-paper-0">
                  {mine.map((s) => (
                    <li key={s.id} className="p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[14px] text-ink-950">{s.title}</span>
                        <span className="font-mono text-[11px] text-ink-500">
                          {s.scheduled_at
                            ? new Date(s.scheduled_at).toLocaleString()
                            : "no date set"}{" "}
                          · {s.attendees.length} seated
                        </span>
                        <span
                          className={
                            s.hasTranscript
                              ? "ml-auto border border-ink-950 bg-ink-950 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-paper-0"
                              : "ml-auto border border-line-200 bg-paper-50 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-600"
                          }
                        >
                          {s.hasTranscript ? "captured" : s.status}
                        </span>
                      </div>

                      {!s.hasTranscript ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {s.status === "scheduled" ? (
                            <button
                              type="button"
                              className="btn-ghost min-h-11"
                              disabled={markHeld.isPending}
                              onClick={() => markHeld.mutate({ id: s.id, title: s.title })}
                            >
                              <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />
                              Record as held
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="btn-secondary min-h-11"
                            onClick={() => setTranscriptFor(transcriptFor === s.id ? null : s.id)}
                          >
                            <FileText className="mr-1 inline h-3.5 w-3.5" />
                            {transcriptFor === s.id ? "Cancel" : "Type the transcript"}
                          </button>
                        </div>
                      ) : null}

                      {transcriptFor === s.id ? (
                        <div className="animate-in fade-in-0 slide-in-from-top-1 mt-2 duration-150">
                          <textarea
                            rows={6}
                            value={transcript}
                            onChange={(e) => setTranscript(e.target.value)}
                            className="w-full border border-line-200 bg-paper-0 p-2 text-[13px] focus:border-ink-950 focus:outline-none"
                            placeholder="Paste or type what was said. It is filed to the second brain with this session's provenance."
                            aria-label={`Transcript for ${s.title}`}
                          />
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              className="btn-primary min-h-11"
                              disabled={saveTranscript.isPending || transcript.trim().length < 40}
                              onClick={() => saveTranscript.mutate()}
                            >
                              {saveTranscript.isPending ? "Filing…" : "File this transcript"}
                            </button>
                            {transcript.trim().length > 0 && transcript.trim().length < 40 ? (
                              <span className="text-[12px] text-ink-600">
                                A little more — 40 characters is the minimum for a usable record.
                              </span>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}

              <Panel
                icon={Mic}
                title="Drop in a recording or write-up"
                purpose="Audio, video, notes or a moderator's document. The AI transcribes it and proposes which room it belongs to."
                attention={held.length > 0}
                badge={held.length > 0 ? `${held.length} awaiting` : undefined}
                hint={{
                  what: "Extracts a transcript from whatever you drop and stages it for your review.",
                  then: "Nothing is filed until you approve the mapping.",
                }}
              >
                <IngestPanel
                  studyId={studyId}
                  countryCode={board.countryCode}
                  waveId={state.wave.id}
                  expect="narrative"
                  questionIds={[]}
                  refresh={refresh}
                />
              </Panel>
            </div>
          </StepRow>

          {/* ④ Close */}
          <StepRow
            index={4}
            state={s4}
            title="Close the wave"
            instruction="The wave closes itself once every planned room is captured. Nothing to press."
            hint={{
              what: "Scored from transcripts filed against planned rooms.",
              then: "The stage advances when every wave the plan obliges is complete.",
            }}
            unlocks="a transcript is filed"
            summary={complete ? `Closed · ${captured} ${plural(captured, "room")} captured` : undefined}
          />
        </StepLadder>
      </div>

      <Flash
        tone={note?.tone ?? "done"}
        message={note?.text ?? null}
        onClear={() => setNote(null)}
      />
    </WaveShell>
  );
}
