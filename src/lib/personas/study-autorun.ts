// Shared client-side study auto-run loop.
// Used by Stage 02 (Group) and Stage 03 (Rehearse) so both surfaces draft
// AND fully complete studies (draft questions + run + synthesize) through
// the same idempotent, lock-guarded, cancelable pipeline. The end result is
// that the user sees only completed work products — no manual per-study
// clicks required.

import {
  createStudy,
  draftStudyQuestions,
  runStudy,
  runStudyResponses,
  runStudySynthesis,
  listStudies,
  getStudy,
} from "./study.functions";
import { composeStudyForSegment } from "./compose-study.functions";

export const AUTO_STUDIES_LOCK = new Set<string>();
export const AUTO_STUDIES_FLAG_KEY = (code: string) => `ch07:auto-studies:${code}`;

export type StudyAutoPhase = "composing" | "creating" | "questioning" | "running";

export interface StudyDraftTarget {
  id: string;
  label: string;
}

export interface StudyDraftResult {
  drafted: number;
  completed: number;
  failed: Array<{ label: string; reason: string; phase: StudyAutoPhase }>;
}

export interface StudyDraftProgress {
  index: number;
  total: number;
  segmentId: string;
  segmentLabel: string;
  phase: StudyAutoPhase;
}

async function completeStudyEndToEnd(opts: {
  studyId: string;
  segmentLabel: string;
  index: number;
  total: number;
  onProgress?: (p: StudyDraftProgress) => void;
  segmentId: string;
}): Promise<{ ok: true } | { ok: false; reason: string; phase: StudyAutoPhase }> {
  const { studyId, segmentLabel, index, total, onProgress, segmentId } = opts;

  // Check current state so we don't repeat expensive work.
  let existing: Awaited<ReturnType<typeof getStudy>> | null = null;
  try {
    existing = await getStudy({ data: { id: studyId } });
  } catch {
    existing = null;
  }
  const status = existing?.study?.status;
  const hasQuestions = (existing?.questions?.length ?? 0) > 0;
  const hasReport = !!existing?.report;

  // If the study is already fully synthesized/complete, skip.
  if (hasReport || status === "complete" || status === "synthesized") return { ok: true };

  // 1) Draft questions (idempotent — replaces existing).
  if (!hasQuestions) {
    onProgress?.({ index, total, segmentId, segmentLabel, phase: "questioning" });
    try {
      await draftStudyQuestions({ data: { studyId, count: 8 } });
    } catch (e) {
      return { ok: false, reason: (e as Error).message, phase: "questioning" };
    }
  }

  // 2) Run the study end-to-end (responses/transcript + synthesis report).
  onProgress?.({ index, total, segmentId, segmentLabel, phase: "running" });
  try {
    await runStudy({ data: { studyId } });
  } catch (e) {
    return { ok: false, reason: (e as Error).message, phase: "running" };
  }
  return { ok: true };
}

export async function draftStudiesForSegments({
  code,
  targets,
  cancelRef,
  onProgress,
  onOneComplete,
  fullPipeline = true,
}: {
  code: string;
  targets: StudyDraftTarget[];
  cancelRef: { current: boolean };
  onProgress?: (p: StudyDraftProgress) => void;
  onOneComplete?: () => void;
  fullPipeline?: boolean;
}): Promise<StudyDraftResult> {
  const failed: StudyDraftResult["failed"] = [];
  let drafted = 0;
  let completed = 0;
  const handled = new Set<string>();

  for (let i = 0; i < targets.length; i++) {
    if (cancelRef.current) return { drafted, completed, failed };
    const seg = targets[i];
    if (handled.has(seg.id)) continue;
    handled.add(seg.id);

    onProgress?.({
      index: i + 1,
      total: targets.length,
      segmentId: seg.id,
      segmentLabel: seg.label,
      phase: "composing",
    });

    let studyId: string | null = null;
    try {
      const proposal = await composeStudyForSegment({
        data: { countryCode: code, segmentId: seg.id },
      });
      if (!proposal.ok) {
        failed.push({ label: seg.label, reason: proposal.reason, phase: "composing" });
        continue;
      }
      onProgress?.({
        index: i + 1,
        total: targets.length,
        segmentId: seg.id,
        segmentLabel: seg.label,
        phase: "creating",
      });
      // createStudy is idempotent per (country, segment) draft.
      const row = await createStudy({
        data: {
          countryCode: code,
          segmentId: seg.id,
          kind: proposal.kind,
          title: proposal.title,
          objective: proposal.objective,
        },
      });
      studyId = row.id as string;
      drafted += 1;
      onOneComplete?.();
    } catch (e) {
      failed.push({ label: seg.label, reason: (e as Error).message, phase: "creating" });
      await new Promise((r) => setTimeout(r, 1500));
      continue;
    }

    if (fullPipeline && studyId && !cancelRef.current) {
      const res = await completeStudyEndToEnd({
        studyId,
        segmentLabel: seg.label,
        segmentId: seg.id,
        index: i + 1,
        total: targets.length,
        onProgress,
      });
      if (res.ok) completed += 1;
      else failed.push({ label: seg.label, reason: res.reason, phase: res.phase });
    }

    // Let the UI paint between items.
    await new Promise((r) => setTimeout(r, 200));
  }

  return { drafted, completed, failed };
}

// Finish any studies for a country that are not yet complete — used by
// Stage 03 (Rehearse) so pressing/landing on the review surface guarantees
// every study is question-drafted, run, and synthesized without manual clicks.
export async function completeIncompleteStudies({
  code,
  cancelRef,
  onProgress,
}: {
  code: string;
  cancelRef: { current: boolean };
  onProgress?: (p: StudyDraftProgress) => void;
}): Promise<StudyDraftResult> {
  const failed: StudyDraftResult["failed"] = [];
  let completed = 0;

  const all = await listStudies({ data: { countryCode: code } });
  // Anything not yet synthesized/complete needs finishing.
  const targets = all.filter(
    (s) => s.status !== "complete" && s.status !== "synthesized",
  );
  const total = targets.length;
  for (let i = 0; i < targets.length; i++) {
    if (cancelRef.current) break;
    const s = targets[i];
    const res = await completeStudyEndToEnd({
      studyId: s.id,
      segmentLabel: s.title,
      segmentId: s.segment_id ?? "",
      index: i + 1,
      total,
      onProgress,
    });
    if (res.ok) completed += 1;
    else failed.push({ label: s.title, reason: res.reason, phase: res.phase });
    await new Promise((r) => setTimeout(r, 200));
  }

  return { drafted: 0, completed, failed };
}
