import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";

/**
 * Hover-to-pause with intent: the mouse must rest on an element for `delay` ms
 * before `commit(value)` runs; leaving clears the timer and calls `release()`.
 * Touch/pen pointers are ignored (taps keep their existing click behaviour).
 */
export function useHoverIntent<T>(commit: (value: T) => void, release: () => void, delay = 1500) {
  const timer = useRef<number | null>(null);
  const [pending, setPending] = useState<T | null>(null);
  const clear = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => clear, []);

  const hover = useCallback(
    (value: T) => ({
      "data-intent": pending === value ? "pending" : undefined,
      onPointerEnter: (e: PointerEvent) => {
        if (e.pointerType !== "mouse") return;
        clear();
        setPending(value);
        timer.current = window.setTimeout(() => {
          timer.current = null;
          setPending(null);
          commit(value);
        }, delay);
      },
      onPointerLeave: (e: PointerEvent) => {
        if (e.pointerType !== "mouse") return;
        clear();
        setPending(null);
        release();
      },
    }),
    [pending, delay, commit, release],
  );

  return { hover, pending };
}
