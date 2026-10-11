import { useCallback, useState, type MouseEvent } from "react";

/**
 * Click-to-pause: one click on an element pauses (`commit(value)`),
 * a second click on it resumes (`release()`).
 */
export function useHoverIntent<T>(commit: (value: T) => void, release: () => void) {
  const [held, setHeld] = useState<T | null>(null);

  const hover = useCallback(
    (value: T) => ({
      "data-held": held === value ? true : undefined,
      onClick: (_e: MouseEvent) => {
        if (held === value) {
          setHeld(null);
          release();
        } else {
          setHeld(value);
          commit(value);
        }
      },
    }),
    [held, commit, release],
  );

  return { hover, held };
}
