// Chamber 07 · The bus between a field stage and its frame.
//
// A stage knows two things the frame needs: whether it holds unsaved work, and
// what single action would clear its blocker. It publishes both here; the frame
// guards navigation with the first and puts the second on the sticky bar.

import { createContext, useContext, useEffect, useRef } from "react";

export interface DirtyEntry {
  /** Plain-language name of what is unsaved, e.g. "the instrument". */
  label: string;
  /** Persist the work. Resolves when saved, rejects on failure. */
  save: () => Promise<unknown>;
}

export interface ResolveAction {
  /** Imperative label, e.g. "Draft the instrument". */
  label: string;
  run: () => void;
  pending?: boolean;
}

interface Bus {
  setDirty: (id: string, entry: DirtyEntry | null) => void;
  setResolve: (id: string, action: ResolveAction | null) => void;
}

const noop: Bus = { setDirty: () => {}, setResolve: () => {} };

export const FieldStageBus = createContext<Bus>(noop);

export function useFieldStageBus(): Bus {
  return useContext(FieldStageBus);
}

/**
 * Publish unsaved-work state to the frame. The frame will offer "Save and
 * continue" on navigation, running `save` before it moves.
 */
export function useDirtyRegistration(
  id: string,
  dirty: boolean,
  label: string,
  save: () => Promise<unknown>,
) {
  const bus = useFieldStageBus();
  const saveRef = useRef(save);
  saveRef.current = save;

  useEffect(() => {
    bus.setDirty(id, dirty ? { label, save: () => saveRef.current() } : null);
    return () => bus.setDirty(id, null);
  }, [bus, id, dirty, label]);
}

/** Publish the one action that clears this stage's blocker. */
export function useResolveAction(
  id: string,
  action: { label: string; run: () => void; pending?: boolean } | null,
) {
  const bus = useFieldStageBus();
  const runRef = useRef(action?.run);
  runRef.current = action?.run;
  const label = action?.label ?? null;
  const pending = action?.pending ?? false;

  useEffect(() => {
    bus.setResolve(
      id,
      label ? { label, run: () => runRef.current?.(), pending } : null,
    );
    return () => bus.setResolve(id, null);
  }, [bus, id, label, pending]);
}
