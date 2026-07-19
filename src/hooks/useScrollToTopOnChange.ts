import { useEffect, useRef, type RefObject } from "react";

/**
 * Scrolls the referenced element to the top of the viewport whenever `dep` changes.
 * - If the element itself is scrollable, also resets its internal scrollTop to 0.
 * - Honors `prefers-reduced-motion` (forces 'auto' when reduced motion is on).
 * - Skips the initial mount by default so first render isn't yanked.
 */
export function useScrollToTopOnChange(
  ref: RefObject<HTMLElement | null>,
  dep: unknown,
  opts: { behavior?: ScrollBehavior; offset?: number; skipInitial?: boolean } = {},
) {
  const { behavior = "smooth", offset = 0, skipInitial = true } = opts;
  const first = useRef(true);

  useEffect(() => {
    if (skipInitial && first.current) {
      first.current = false;
      return;
    }
    first.current = false;
    if (typeof window === "undefined") return;
    const el = ref.current;
    if (!el) return;

    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const behave: ScrollBehavior = reduce ? "auto" : behavior;

    // Reset the element's own scroll first (if it's a scroll container).
    if (el.scrollHeight > el.clientHeight) {
      el.scrollTo({ top: 0, behavior: behave });
    }

    // Then bring the element's top into view — only if it's currently above the fold.
    const rect = el.getBoundingClientRect();
    const targetY = window.scrollY + rect.top - offset;
    if (targetY < window.scrollY) {
      window.scrollTo({ top: Math.max(0, targetY), behavior: behave });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dep]);
}
