// Chamber 07 · The save contract, in one hook.
//
// A stage editor holds local state that must never be silently overwritten by a
// background refetch. This hook owns the local-vs-server diff: it adopts the
// server copy while the editor is clean, and when the server copy moves under a
// dirty editor it raises a conflict instead of clobbering the user's words.

import { useCallback, useEffect, useRef, useState } from "react";

function stable(v: unknown): string {
  try {
    return JSON.stringify(v ?? null);
  } catch {
    return String(v);
  }
}

export interface DirtyState<T> {
  /** The editable value. Undefined until the server copy first arrives. */
  value: T | undefined;
  /** Update the editable value (accepts a value or an updater). */
  set: (next: T | ((prev: T) => T)) => void;
  /** True when the editable value differs from the copy we last saw saved. */
  dirty: boolean;
  /** True when the stored copy changed while this editor had unsaved work. */
  conflict: boolean;
  /** Take the stored copy, discarding local edits. */
  takeServer: () => void;
  /** Keep local edits and stop warning about the conflict. */
  keepMine: () => void;
  /** Call after a successful save: the current value becomes the clean baseline. */
  markSaved: () => void;
  /** ISO timestamp of the last markSaved() in this session. */
  savedAt: string | null;
}

export function useDirtyState<T>(server: T | undefined): DirtyState<T> {
  const [value, setValue] = useState<T | undefined>(server);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  // The copy we consider "saved" — edits are dirty relative to this.
  const baseRef = useRef<string>(stable(server));
  const serverRef = useRef<T | undefined>(server);

  const dirty = value !== undefined && stable(value) !== baseRef.current;

  useEffect(() => {
    if (server === undefined) return;
    serverRef.current = server;
    const incoming = stable(server);
    if (incoming === baseRef.current) return;
    // The stored copy moved. Adopt it when nothing local is at risk.
    if (!dirty) {
      baseRef.current = incoming;
      setValue(server);
      setConflict(false);
    } else {
      setConflict(true);
    }
    // `dirty` is derived; recomputing on server change is what we want.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stable(server)]);

  const set = useCallback((next: T | ((prev: T) => T)) => {
    setValue((prev) =>
      typeof next === "function" ? (next as (p: T) => T)(prev as T) : next,
    );
  }, []);

  const takeServer = useCallback(() => {
    const s = serverRef.current;
    baseRef.current = stable(s);
    setValue(s);
    setConflict(false);
  }, []);

  const keepMine = useCallback(() => setConflict(false), []);

  const markSaved = useCallback(() => {
    setValue((current) => {
      baseRef.current = stable(current);
      return current;
    });
    setSavedAt(new Date().toISOString());
    setConflict(false);
  }, []);

  return { value, set, dirty, conflict, takeServer, keepMine, markSaved, savedAt };
}
