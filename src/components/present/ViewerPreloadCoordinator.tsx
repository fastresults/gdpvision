import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { CHAMBERS } from "@/lib/chambers";
import { GDP_EVENTS } from "@/lib/present/events";

export type ViewerPreloadState = "pending" | "requested" | "ready" | "signin" | "slow" | "failed";

const EXPECTED_VIEWERS = [
  "sovereign-corpus",
  "antigua-brain",
  ...CHAMBERS.map((chamber) => `chamber-${chamber.index}`),
  "egov",
  ...GDP_EVENTS.filter((event) => event.url).map((event) => `event-${event.id}`),
] as const;

type ViewerRegistry = Record<string, ViewerPreloadState>;

interface ViewerPreloadContextValue {
  states: ViewerRegistry;
  expected: number;
  update: (id: string, state: ViewerPreloadState) => void;
}

const ViewerPreloadContext = createContext<ViewerPreloadContextValue | null>(null);

export function ViewerPreloadProvider({ children }: { children: ReactNode }) {
  const [states, setStates] = useState<ViewerRegistry>(() =>
    Object.fromEntries(EXPECTED_VIEWERS.map((id) => [id, "pending"])),
  );
  const update = useCallback((id: string, state: ViewerPreloadState) => {
    setStates((current) => (current[id] === state ? current : { ...current, [id]: state }));
  }, []);
  const value = useMemo(
    () => ({ states, expected: EXPECTED_VIEWERS.length, update }),
    [states, update],
  );

  return <ViewerPreloadContext.Provider value={value}>{children}</ViewerPreloadContext.Provider>;
}

export function useViewerPreload() {
  const context = useContext(ViewerPreloadContext);
  if (!context) throw new Error("useViewerPreload must be used inside ViewerPreloadProvider");
  return context;
}
