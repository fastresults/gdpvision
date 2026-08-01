// Chamber 07 · Stage 04 · the questionnaire wave.
//
// Four beats, always in the same order: open the field, reach the participants,
// collect what comes back, close the wave. Steps behind you compress to a
// ticked line; steps ahead say what will unlock them. Every control states what
// it does before it is pressed.

import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ClipboardList,
  Copy,
  DoorOpen,
  Inbox,
  Link2,
  Loader2,
  Mail,
  Send,
  Share2,
} from "lucide-react";
import { useState } from "react";

import { IngestPanel } from "./IngestPanel";
import { WaveShell } from "./WaveShell";

import { DeployPanel } from "../DeployPanel";
import { ConfirmAction } from "../kit/ConfirmAction";
import { Flash, useCopyFeedback } from "../kit/Flash";
import { Hint } from "../kit/Hint";
import { Panel } from "../kit/Panel";
import { StepLadder, StepRow, type StepState } from "../kit/StepRow";
import { plural } from "../kit/labels";
import { collectionPhase } from "../kit/StatusPill";
import { useDirtyRegistration } from "../stage-bus";

import { importResponses } from "@/lib/personas/field-collection.functions";
import {
  closeWave,
  inviteWave,
  openWave,
  sendWaveInvites,
} from "@/lib/personas/fieldwork.functions";
import type { FieldworkBoard, WaveState } from "@/lib/personas/fieldwork-plan.server";

export function CollectionWave({
  index,
  state,
  board,
  projectId,
  studyId,
  refresh,
}: {
  index: number;
  state: WaveState;
  board: FieldworkBoard;
  projectId: string;
  studyId: string;
  refresh: () => void;
}) {
  const [rows, setRows] = useState("");
  const [note, setNote] = useState<{ tone: "done" | "attention"; text: string } | null>(null);
  const [copied, copy] = useCopyFeedback();

  const openFn = useServerFn(openWave);
  const inviteFn = useServerFn(inviteWave);
  const sendFn = useServerFn(sendWaveInvites);
  const closeFn = useServerFn(closeWave);
  const importFn = useServerFn(importResponses);

  const collection = board.collection;
  const target = state.counts["target"] ?? 0;
  const returned = state.counts["returned"] ?? 0;
  const invited = state.counts["invited"] ?? 0;
  const opened = state.counts["opened"] ?? 0;
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const complete = state.status === "complete";

  const act = (fn: () => Promise<string>) =>
    useMutation({
      mutationFn: fn,
      onSuccess: (text) => {
        setNote({ tone: "done", text });
        refresh();
      },
      onError: (e: Error) => setNote({ tone: "attention", text: e.message }),
    });

  const open = act(async () => {
    await openFn({ data: { studyId, targetN: state.wave.target ?? null } });
    return "The field is open — the hosted questionnaire is live and its participant links exist.";
  });
  const invite = act(async () => {
    if (!collection) throw new Error("Open the field first.");
    return (await inviteFn({ data: { collectionId: collection.id, projectId } })).message;
  });
  const send = act(async () => {
    if (!collection) throw new Error("Open the field first.");
    return (await sendFn({ data: { collectionId: collection.id, origin, purpose: "invite" } }))
      .message;
  });
  const remind = act(async () => {
    if (!collection) throw new Error("Open the field first.");
    return (await sendFn({ data: { collectionId: collection.id, origin, purpose: "reminder" } }))
      .message;
  });
  const close = act(async () => {
    if (!collection) throw new Error("Nothing to close.");
    await closeFn({ data: { collectionId: collection.id } });
    return "Wave closed. No further returns can be filed against it.";
  });
  const importRows = act(async () => {
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
    const r = await importFn({ data: { studyId, source: "paste", rows: parsed } });
    setRows("");
    return `${r.inserted ?? parsed.length} ${plural(parsed.length, "return")} filed.`;
  });

  useDirtyRegistration("fieldwork-returns", rows.trim().length > 0, "pasted returns", async () => {
    await importRows.mutateAsync();
  });

  const busy =
    open.isPending ||
    invite.isPending ||
    send.isPending ||
    remind.isPending ||
    close.isPending ||
    importRows.isPending;

  // ── The four beats ───────────────────────────────────────────────────────
  const s1: StepState = collection ? "done" : "live";
  const s2: StepState = !collection ? "locked" : invited > 0 || returned > 0 ? "done" : "live";
  const s3: StepState = !collection ? "locked" : s2 === "done" ? "live" : "locked";
  const s4: StepState = complete ? "done" : returned > 0 || invited > 0 ? "live" : "locked";

  const nextMove = complete
    ? null
    : !collection
      ? "Open the field so the questionnaire and its participant links exist."
      : invited === 0
        ? `Issue participant links to the ${board.uninvited || invited} people recruited in Participants.`
        : returned === 0
          ? board.mailConfigured
            ? "Send the invitations, then watch returns arrive against the target."
            : "Copy the prepared links from the invitation register and get them to participants."
          : returned < target
            ? "Chase the non-responders, or file returns collected elsewhere."
            : "The target is met — close the wave to score it.";

  const phase = collectionPhase({ complete, opened: !!collection, invited, returned, target });
  const surveyInstrument = board.instruments.find((i) => i.kind === "survey");
  const goToNext = () =>
    document
      .getElementById(`wave-${state.wave.id}-ladder`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });

  return (
    <WaveShell
      index={index}
      state={state}
      phase={phase}
      done={returned}
      target={target}
      produces={
        target > 0
          ? `${target} filed returns, each tagged to the questionnaire version they answered.`
          : "Filed returns, each tagged to the questionnaire version they answered."
      }
      nextMove={nextMove}
      onGoToNext={goToNext}
      meter={
        target > 0
          ? returned === 0
            ? `No returns yet · target ${target} · ${invited} invited · ${opened} opened`
            : `${returned}/${target} returns · ${invited} invited · ${opened} opened`
          : `${returned} ${plural(returned, "return")} · ${invited} invited · ${opened} opened`
      }
    >
      <div id={`wave-${state.wave.id}-ladder`}>
        <StepLadder>
          {/* ① Open the field */}
          <StepRow
            index={1}
            state={s1}
            title="Open the field"
            instruction="Creates the hosted questionnaire and its per-participant links. Nothing is sent to anyone yet."
            hint={{
              what: "Creates the collection record and the participant links behind it.",
              then: "Nothing leaves the building until you issue and send invitations at step 2.",
            }}
            summary={
              collection
                ? `Field open · hosted questionnaire live${target > 0 ? ` · target ${target}` : ""}`
                : undefined
            }
          >
            {!collection ? (
              <button
                type="button"
                className="btn-primary"
                disabled={busy}
                onClick={() => open.mutate()}
              >
                {open.isPending ? (
                  <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />
                ) : (
                  <DoorOpen className="mr-1 inline h-3.5 w-3.5" />
                )}
                {open.isPending ? "Opening…" : "Open the field"}
              </button>
            ) : null}
          </StepRow>

          {/* ② Reach participants */}
          <StepRow
            index={2}
            state={s2}
            title="Reach the participants"
            instruction="Issue a private link to everyone recruited in Participants, then send the invitations."
            hint={{
              what: "Each recruited person gets their own single-use link, so returns are attributable.",
              then: board.mailConfigured
                ? "Sending writes to the comms log and dispatches the email."
                : "Mail is not connected here, so invitations are written to the comms log with their links for you to copy.",
            }}
            unlocks="the field is open"
            summary={
              s2 === "done"
                ? `${invited} invited · ${opened} opened · ${returned} returned`
                : undefined
            }
          >
            <div className="space-y-3">
              <div className="border border-line-200 bg-paper-0 p-3">
                <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
                  <Send className="h-3 w-3" /> Recruited panel
                  <Hint
                    what="The named people accepted in Stage 02 · Participants."
                    then="Anyone added there later can be issued links with the same button."
                  />
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-secondary min-h-11"
                    disabled={busy || (board.uninvited === 0 && invited > 0)}
                    onClick={() => invite.mutate()}
                  >
                    {invite.isPending ? (
                      <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Link2 className="mr-1 inline h-3.5 w-3.5" />
                    )}
                    Issue links to {board.uninvited > 0 ? board.uninvited : invited} recruited
                  </button>
                  <button
                    type="button"
                    className="btn-primary min-h-11"
                    disabled={busy || invited === 0}
                    onClick={() => send.mutate()}
                  >
                    {send.isPending ? (
                      <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Mail className="mr-1 inline h-3.5 w-3.5" />
                    )}
                    {board.mailConfigured ? "Send invitations" : "Prepare invitations"}
                  </button>
                  {returned > 0 && returned < target ? (
                    <button
                      type="button"
                      className="btn-ghost min-h-11"
                      disabled={busy}
                      onClick={() => remind.mutate()}
                    >
                      Remind non-responders
                      <Hint
                        what="Writes a second, gentler note to everyone who has not returned."
                        then="People who already answered are never contacted again."
                      />
                    </button>
                  ) : null}
                </div>
              </div>

              {board.invitations.length > 0 ? (
                <Panel
                  icon={ClipboardList}
                  title="Invitation register"
                  purpose="Every person invited, their state, and their private link."
                  badge={`${board.invitations.length} issued`}
                  hint={{
                    what: "One row per invitation, with the link you can pass on by hand.",
                    then: "States run pending → invited → opened → returned.",
                  }}
                >
                  <ul className="max-h-64 divide-y divide-line-100 overflow-y-auto">
                    {board.invitations.map((i) => (
                      <li key={i.id} className="flex items-center gap-2 p-2 text-[12px]">
                        <span className="flex-1 truncate text-ink-800">{i.name}</span>
                        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">
                          {i.completed_at ? "returned" : i.opened_at ? "opened" : i.status}
                        </span>
                        <button
                          type="button"
                          className="btn-ghost shrink-0"
                          aria-label={`Copy the participant link for ${i.name}`}
                          onClick={() => copy(`${origin}/f/${i.token}`)}
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                  {copied ? (
                    <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-700">
                      Link copied
                    </p>
                  ) : null}
                </Panel>
              ) : null}
            </div>
          </StepRow>

          {/* ③ Collect returns */}
          <StepRow
            index={3}
            state={s3}
            title="Collect what comes back"
            instruction="Returns arrive on their own from the links. Anything answered outside this system comes back through the panels below."
            hint={{
              what: "Three routes in: the hosted links, an uploaded file, or a pasted line.",
              then: "Whatever the route, every return is filed against the instrument version it answered.",
            }}
            unlocks="participants have been reached"
          >
            <div className="space-y-3">
              {collection ? (
                <>
                  <Panel
                    icon={Share2}
                    title="Deploy this instrument"
                    purpose="Take the questions to where the fieldwork actually happens — paper, another tool, or an open link."
                    badge={collection.open_enabled ? "open link live" : undefined}
                    hint={{
                      what: "Produces a printable form, a return-sheet template, a tooling export, or a public link.",
                      then: "Every route is stamped with the instrument version.",
                    }}
                  >
                    <DeployPanel
                      instrumentId={collection.instrument_id ?? surveyInstrument?.id ?? null}
                      collectionId={collection.id}
                      openToken={collection.open_token}
                      openEnabled={collection.open_enabled}
                      refresh={refresh}
                    />
                  </Panel>

                  <IngestPanel
                    studyId={studyId}
                    countryCode={board.countryCode}
                    waveId={state.wave.id}
                    collectionId={collection.id}
                    expect="tabular"
                    questionIds={surveyInstrument?.questionIds ?? []}
                    refresh={refresh}
                  />

                  <Panel
                    icon={Inbox}
                    title="Paste returns line by line"
                    purpose="For a handful of answers taken down by hand. One return per line."
                    hint={{
                      what: "Files each line as its own return.",
                      then: "JSON is read as a full answer set; plain text is read as one open answer.",
                    }}
                  >
                    <textarea
                      rows={4}
                      value={rows}
                      onChange={(e) => setRows(e.target.value)}
                      className="w-full border border-line-200 bg-paper-0 p-2 font-mono text-[12px] focus:border-ink-950 focus:outline-none"
                      placeholder={'{"q1":"Yes","q2":4}'}
                      aria-label="Returns, one per line"
                    />
                    <button
                      type="button"
                      className="btn-secondary mt-2 min-h-11"
                      disabled={busy || rows.trim().length === 0}
                      onClick={() => importRows.mutate()}
                    >
                      {importRows.isPending ? "Filing…" : "File these returns"}
                    </button>
                  </Panel>
                </>
              ) : null}
            </div>
          </StepRow>

          {/* ④ Close the wave */}
          <StepRow
            index={4}
            state={s4}
            title="Close the wave"
            instruction="Ends collection and scores the wave at whatever has landed."
            hint={{
              what: "Marks the collection closed so no further returns can be filed.",
              then: "The stage advances once every wave the plan obliges is closed.",
            }}
            unlocks="the field has been reached"
            summary={complete ? `Closed at ${returned}${target > 0 ? ` of ${target}` : ""}` : undefined}
          >
            {!complete ? (
              <ConfirmAction
                label="Close this wave"
                consequence={`No further returns can be filed. The wave will be scored at ${returned}${
                  target > 0 ? ` of ${target}` : ""
                }.`}
                disabled={busy}
                busy={close.isPending}
                onConfirm={() => close.mutate()}
              />
            ) : null}
          </StepRow>
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
