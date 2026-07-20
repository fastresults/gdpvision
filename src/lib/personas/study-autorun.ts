// Shared client-side study auto-run loop.
// Used by Stage 02 (Group) and Stage 03 (Rehearse) so both surfaces draft
// studies through the same idempotent, lock-guarded, cancelable pipeline.

import { createStudy } from "./study.functions";
import { composeStudyForSegment } from "./compose-study.functions";

export const AUTO_STUDIES_LOCK = new Set<string>();
export const AUTO_STUDIES_FLAG_KEY = (code: string) => `ch07:auto-studies:${code}`;

export interface StudyDraftTarget {
  id: string;
  label: string;
}

export interface StudyDraftResult {
  drafted: number;
  failed: Array<{ label: string; reason: string }>;
}

export interface StudyDraftProgress {
  index: number;
  total: number;
  segmentId: string;
  segmentLabel: string;
}

export async function draftStudiesForSegments({
  code,
  targets,
  cancelRef,
  onProgress,
  onOneComplete,
}: {
  code: string;
  targets: StudyDraftTarget[];
  cancelRef: { current: boolean };
  onProgress?: (p: StudyDraftProgress) => void;
  onOneComplete?: () => void;
}): Promise<StudyDraftResult> {
  const failed: Array<{ label: string; reason: string }> = [];
  let drafted = 0;
  const handled = new Set<string>();

  for (let i = 0; i < targets.length; i++) {
    if (cancelRef.current) return { drafted, failed };
    const seg = targets[i];
    if (handled.has(seg.id)) continue;
    handled.add(seg.id);

    onProgress?.({
      index: i + 1,
      total: targets.length,
      segmentId: seg.id,
      segmentLabel: seg.label,
    });

    try {
      const proposal = await composeStudyForSegment({
        data: { countryCode: code, segmentId: seg.id },
      });
      if (!proposal.ok) {
        failed.push({ label: seg.label, reason: proposal.reason });
        continue;
      }
      // createStudy is idempotent per (country, segment) draft — safe for
      // retries, tab re-entry, and StrictMode double-mounts.
      await createStudy({
        data: {
          countryCode: code,
          segmentId: seg.id,
          kind: proposal.kind,
          title: proposal.title,
          objective: proposal.objective,
        },
      });
      drafted += 1;
      onOneComplete?.();
      // Let the UI paint between items.
      await new Promise((r) => setTimeout(r, 250));
    } catch (e) {
      failed.push({ label: seg.label, reason: (e as Error).message });
      // Brief backoff on error (429/timeouts).
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  return { drafted, failed };
}
