import { createContext, useContext } from "react";

/**
 * Supplies the live context every rationale's `derive` runs against, plus an
 * optional hook for "see the full trace" so the modal can hand the reader back
 * to the machine-readable record on the page.
 */
export interface ExplainContextValue {
  ctx: unknown;
  onTrace?: () => void;
  traceLabel?: string;
}

const Ctx = createContext<ExplainContextValue>({ ctx: undefined });

export const ExplainProvider = Ctx.Provider;

export function useExplainContext(): ExplainContextValue {
  return useContext(Ctx);
}
