// Chamber 07 · The bus between a field stage, its frame and the rail.
//
// A stage knows two things the surrounding chrome needs: whether it holds
// unsaved work, and what single action would clear its blocker. It publishes
// both here. The provider sits ABOVE both the rail (the stepper) and the stage
// frame, so *every* way out of a stage — rail, sticky bar, amend menu, tab —
// passes through the same save-or-discard gate.

import { Loader2 } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

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
  /** Everything currently unsaved, in registration order. */
  dirtyEntries: DirtyEntry[];
  /** The one action that clears the current stage's blocker. */
  resolveAction: ResolveAction | null;
  /** Run `run` — after saving or discarding unsaved work, if there is any. */
  guardedGo: (run: () => void) => void;
}

const noop: Bus = {
  setDirty: () => {},
  setResolve: () => {},
  dirtyEntries: [],
  resolveAction: null,
  guardedGo: (run) => run(),
};

const FieldStageBusContext = createContext<Bus>(noop);

export function useFieldStageBus(): Bus {
  return useContext(FieldStageBusContext);
}

/** Navigate through the unsaved-work gate. */
export function useGuardedGo(): (run: () => void) => void {
  return useFieldStageBus().guardedGo;
}

/**
 * Wraps the whole field programme surface — rail included — and owns the
 * unsaved-work gate.
 */
export function FieldStageProvider({ children }: { children: React.ReactNode }) {
  const [dirtyMap, setDirtyMap] = useState<Record<string, DirtyEntry>>({});
  const [resolveMap, setResolveMap] = useState<Record<string, ResolveAction>>({});
  const dirtyRef = useRef(dirtyMap);
  dirtyRef.current = dirtyMap;

  const [pendingNav, setPendingNav] = useState<null | (() => void)>(null);
  const [saving, setSaving] = useState(false);
  const [navError, setNavError] = useState<string | null>(null);

  const setDirty = useCallback((id: string, entry: DirtyEntry | null) => {
    setDirtyMap((prev) => {
      if (!entry) {
        if (!(id in prev)) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return { ...prev, [id]: entry };
    });
  }, []);

  const setResolve = useCallback((id: string, action: ResolveAction | null) => {
    setResolveMap((prev) => {
      if (!action) {
        if (!(id in prev)) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return { ...prev, [id]: action };
    });
  }, []);

  // Moving forward (or back, or sideways) SAVES. No question, no modal. The
  // gate only becomes visible if a save actually fails.
  const runSaveAllAndGo = useCallback(async (run: () => void) => {
    setSaving(true);
    setNavError(null);
    try {
      for (const entry of Object.values(dirtyRef.current)) await entry.save();
      setPendingNav(null);
      run();
    } catch (err) {
      setNavError(err instanceof Error ? err.message : "Could not save.");
      setPendingNav(() => run);
    } finally {
      setSaving(false);
    }
  }, []);

  const guardedGo = useCallback(
    (run: () => void) => {
      if (Object.keys(dirtyRef.current).length > 0) {
        void runSaveAllAndGo(run);
        return;
      }
      run();
    },
    [runSaveAllAndGo],
  );

  const dirtyEntries = useMemo(() => Object.values(dirtyMap), [dirtyMap]);
  const resolveAction = useMemo(() => Object.values(resolveMap)[0] ?? null, [resolveMap]);
  const hasDirty = dirtyEntries.length > 0;

  useEffect(() => {
    if (!hasDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasDirty]);

  const value = useMemo(
    () => ({ setDirty, setResolve, dirtyEntries, resolveAction, guardedGo }),
    [setDirty, setResolve, dirtyEntries, resolveAction, guardedGo],
  );

  return (
    <FieldStageBusContext.Provider value={value}>
      {children}

      {saving && !navError ? (
        <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center pb-20">
          <p className="flex items-center gap-2 border border-line-200 bg-paper-0 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-700 shadow-lg">
            <Loader2 size={11} className="animate-spin" /> Saving your work…
          </p>
        </div>
      ) : null}

      {pendingNav && navError ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/40 p-4">
          <div className="w-full max-w-md border border-line-200 bg-paper-0 p-5">
            <p className="font-serif text-lg text-ink-950">That didn't save.</p>
            <p className="mt-1 text-[13px] text-ink-700">
              Unsaved · {dirtyEntries.map((d) => d.label).join(", ")}. Try again, or move on and
              leave it behind.
            </p>
            <p className="mt-2 text-[12px] text-rose-600">{navError}</p>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="btn-ghost"
                disabled={saving}
                onClick={() => {
                  setPendingNav(null);
                  setNavError(null);
                }}
              >
                Stay here
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={saving}
                onClick={() => {
                  const run = pendingNav;
                  setPendingNav(null);
                  setNavError(null);
                  setDirtyMap({});
                  run?.();
                }}
              >
                Discard and continue
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={saving}
                onClick={() => {
                  const run = pendingNav;
                  if (run) void runSaveAllAndGo(run);
                }}
              >
                {saving ? <Loader2 size={11} className="animate-spin" /> : null}
                Try saving again
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </FieldStageBusContext.Provider>
  );
}

/**
 * Publish unsaved-work state. Any navigation — rail included — will offer
 * "Save and continue", running `save` before it moves.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bus.setDirty, id, dirty, label]);
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
    bus.setResolve(id, label ? { label, run: () => runRef.current?.(), pending } : null);
    return () => bus.setResolve(id, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bus.setResolve, id, label, pending]);
}
