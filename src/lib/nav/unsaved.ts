// Global unsaved-work registry. Any editor marks itself dirty; one guard in the
// root blocks navigation (links, Back, tab close) while anything is dirty.

import { useEffect, useId } from "react";

const dirty = new Set<string>();

export function hasUnsavedWork() {
  return dirty.size > 0;
}
export function clearUnsavedWork() {
  dirty.clear();
}

/** Mark the calling component as holding unsaved work while `isDirty` is true. */
export function useUnsavedWork(isDirty: boolean) {
  const id = useId();
  useEffect(() => {
    if (isDirty) dirty.add(id);
    else dirty.delete(id);
    return () => {
      dirty.delete(id);
    };
  }, [id, isDirty]);
}
