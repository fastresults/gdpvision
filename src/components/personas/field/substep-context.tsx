// Chamber 07 · The sub-step bus.
//
// StageFrame owns which sub-step you are on (it also owns the one footer, so
// there is never a second Continue on the page). StageWizard and the rail read
// that state from here. One owner, one truth.

import { createContext, useContext } from "react";

import type { FieldSubStep } from "@/lib/personas/field-substeps";
import type { FieldStageKey } from "@/lib/personas/field-stages";

export interface SubStepNav {
  stage: FieldStageKey;
  steps: FieldSubStep[];
  /** Zero-based position of the current sub-step. */
  index: number;
  current: FieldSubStep | null;
  /** Move to another sub-step, through the unsaved-work gate. */
  goTo: (key: string) => void;
  isDone: (step: FieldSubStep) => boolean;
}

const Ctx = createContext<SubStepNav | null>(null);

export const SubStepProvider = Ctx.Provider;

export function useSubSteps(): SubStepNav | null {
  return useContext(Ctx);
}
