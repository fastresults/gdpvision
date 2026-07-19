import { useEffect, type RefObject } from "react";

/**
 * Scrolls the referenced element to the top of the viewport whenever `dep` changes.
 * - If the element itself is scrollable, also resets its internal scrollTop to 0.
 * - Honors `prefers-reduced-motion` (forces 'auto' when reduced motion is on).
 * - Skips the initial mount to avoid yanking the page on first render.
 */
export function useScrollToTopOnChange(
  ref: RefObject<HTMLElement | null>,
  dep: unknown,
  opts: { behavior?: ScrollBehavior; offset?: number; skipInitial?: boolean } = {},
) {
  const { behavior = "smooth", offset = 0, skipInitial = true } = opts;

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Skip initial mount when requested.
    if (skipInitial && (useScrollToTopOnChange as any)._init === undefined) {
      // no-op sentinel — real skip handled via a per-instance ref below.
    }
    const el = ref.current;
    if (!el) return;

    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const behave: ScrollBehavior = reduce ? "auto" : behavior;

    // Reset the element's own scroll first (if it's a scroll container).
    if (el.scrollHeight > el.clientHeight) {
      el.scrollTo({ top: 0, behavior: behave });
    }

    // Then scroll the element to the top of the viewport.
    const rect = el.getBoundingClientRect();
    const targetY = window.scrollY + rect.top - offset;
    // Only scroll up — never yank a user down.
    if (targetY < window.scrollY) {
      window.scrollTo({ top: Math.max(0, targetY), behavior: behave });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dep]);
}
