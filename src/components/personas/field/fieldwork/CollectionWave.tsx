// Chamber 07 · Stage 04 · the questionnaire wave.
//
// Open the field, invite the recruited panel, watch the returns arrive against
// the target the plan set, and close it. Every route out to a participant is a
// real one: a hosted link they can answer, an email we actually send, or a file
// of returns collected elsewhere.

import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Link2, Loader2, Mail, Upload } from "lucide-react";
import { useState } from "react";

import { IngestPanel } from "./IngestPanel";
import { WaveShell } from "./WaveShell";

import { DeployPanel } from "../DeployPanel";

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
  const [note, setNote] = useState<string | null>(null);

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

  const useAct = (fn: () => Promise<unknown>) =>
    useMutationFactory(fn, (msg) => setNote(msg), refresh);

  const open = useAct(async () => {
    await openFn({ data: { studyId, targetN: state.wave.target ?? null } });
    return "The field is open.";
  });
  const invite = useAct(async () => {
    if (!collection) throw new Error("Open the field first.");
    const r = await inviteFn({ data: { collectionId: collection.id, projectId } });
    return r.message;
  });
  const send = useAct(async () => {
    if (!collection) throw new Error("Open the field first.");
    const r = await sendFn({ data: { collectionId: collection.id, origin, purpose: "invite" } });
    return r.message;
  });
  const remind = useAct(async () => {
    if (!collection) throw new Error("Open the field first.");
    const r = await sendFn({ data: { collectionId: collection.id, origin, purpose: "reminder" } });
    return r.message;
  });

  const close = useAct(async () => {
    if (!collection) throw new Error("Nothing to close.");
    await closeFn({ data: { collectionId: collection.id } });
    return "Wave closed.";
  });
  const importRows = useAct(async () => {
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
    return `${r.inserted ?? parsed.length} return${parsed.length === 1 ? "" : "s"} filed.`;
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

  return (
    <WaveShell
      index={index}
      state={state}
      done={returned}
      target={target}
      meter={
        target > 0
          ? `${returned}/${target} returns · ${invited} invited · ${opened} opened`
          : `${returned} returns · ${invited} invited · ${opened} opened`
      }
    >
      {!collection ? (
        <div>
          <p className="text-[13px] leading-relaxed text-ink-700">
            Opening the field creates the hosted questionnaire and its participant links. Nothing is
            sent until you invite.
          </p>
          <button
            type="button"
            className="btn-primary mt-3"
            disabled={busy}
            onClick={() => open.mutate()}
          >
            {open.isPending ? "Opening…" : "Open the field"}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-secondary"
              disabled={busy || (board.uninvited === 0 && invited > 0)}
              onClick={() => invite.mutate()}
            >
              {invite.isPending ? (
                <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />
              ) : null}
              Issue links to {board.uninvited > 0 ? board.uninvited : invited} recruited
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={busy || invited === 0}
              onClick={() => send.mutate()}
            >
              <Mail className="mr-1 inline h-3.5 w-3.5" />
              {send.isPending
                ? "Sending…"
                : board.mailConfigured
                  ? "Send invitations"
                  : "Prepare invitations"}
            </button>
            {returned > 0 && returned < target ? (
              <button
                type="button"
                className="btn-ghost"
                disabled={busy}
                onClick={() => remind.mutate()}
              >
                Remind non-responders
              </button>
            ) : null}
            {state.status !== "complete" ? (
              <button
                type="button"
                className="btn-ghost"
                disabled={busy}
                onClick={() => close.mutate()}
              >
                Close this wave
              </button>
            ) : null}
          </div>

          {collection.public_token ? (
            <div className="flex items-center gap-2 border border-line-200 bg-paper-50 p-2">
              <Link2 className="h-3.5 w-3.5 shrink-0 text-ink-500" />
              <code className="truncate font-mono text-[11px] text-ink-700">
                {origin}/f/{collection.public_token}
              </code>
              <button
                type="button"
                className="btn-ghost ml-auto shrink-0"
                onClick={() =>
                  void navigator.clipboard.writeText(`${origin}/f/${collection.public_token}`)
                }
              >
                <Copy className="mr-1 inline h-3.5 w-3.5" />
                Copy open link
              </button>
            </div>
          ) : null}

          {board.invitations.length > 0 ? (
            <details className="border border-line-200">
              <summary className="cursor-pointer p-2 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-600">
                Invitation register · {board.invitations.length}
              </summary>
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
                      onClick={() => void navigator.clipboard.writeText(`${origin}/f/${i.token}`)}
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          <DeployPanel
            instrumentId={collection.instrument_id}
            collectionId={collection.id}
            openToken={collection.open_token}
            openEnabled={collection.open_enabled}
            refresh={refresh}
          />

          <IngestPanel
            studyId={studyId}
            countryCode={board.countryCode}
            waveId={state.wave.id}
            collectionId={collection.id}
            expect="tabular"
            questionIds={[]}
            refresh={refresh}
          />

          <details className="border border-line-200">
            <summary className="cursor-pointer p-2 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-600">
              Paste returns line by line
            </summary>
            <div className="p-2">
              <p className="text-[12px] text-ink-600">
                One return per line — JSON, or plain text for a single open answer.
              </p>
              <textarea
                rows={4}
                value={rows}
                onChange={(e) => setRows(e.target.value)}
                className="mt-2 w-full border border-line-200 bg-paper-0 p-2 font-mono text-[12px] focus:border-ink-950 focus:outline-none"
                placeholder='{"q1":"Yes","q2":4}'
              />
              <button
                type="button"
                className="btn-secondary mt-2"
                disabled={busy || rows.trim().length === 0}
                onClick={() => importRows.mutate()}
              >
                <Upload className="mr-1 inline h-3.5 w-3.5" />
                File these returns
              </button>
            </div>
          </details>
        </div>
      )}

      {note ? <p className="mt-3 text-[12px] text-ink-700">{note}</p> : null}
    </WaveShell>
  );
}

/** Small helper so each action reports plainly and refreshes the board. */
function useMutationFactory(
  fn: () => Promise<unknown>,
  say: (msg: string) => void,
  refresh: () => void,
) {
  return useMutation({
    mutationFn: fn,
    onSuccess: (msg) => {
      if (typeof msg === "string") say(msg);
      refresh();
    },
    onError: (e: Error) => say(e.message),
  });
}
