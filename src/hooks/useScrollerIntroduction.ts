import { useCallback, useEffect, useRef } from "react";

/** A single measured step on entry; manual navigation always wins. */
export function useScrollerIntroduction<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const consumed = useRef(false);
  const stop = useRef<(() => void) | null>(null);
  const cancel = useCallback(() => {
    consumed.current = true;
    stop.current?.();
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let checking = 0;
    let running = false;
    let start = 0;
    let target = 0;
    const settle = () => {
      cancelAnimationFrame(frame);
      if (!running) return;
      running = false;
      el.scrollLeft =
        Math.abs(el.scrollLeft - start) < Math.abs(target - el.scrollLeft) ? start : target;
      el.style.scrollSnapType = "";
      el.dispatchEvent(new Event("scroll"));
      el.removeAttribute("data-introducing");
    };
    stop.current = settle;
    const visible = () => {
      const rect = el.getBoundingClientRect();
      const overlap = Math.max(
        0,
        Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0),
      );
      return overlap >= Math.min(rect.height, window.innerHeight) * 0.45;
    };
    const check = () => {
      checking = 0;
      if (running && !visible()) settle();
      if (consumed.current || !visible()) return;
      consumed.current = true;
      if (motion.matches || el.matches(":hover") || el.contains(document.activeElement)) return;
      const first = el.children.item(0);
      const second = el.children.item(1);
      if (!(first instanceof HTMLElement) || !(second instanceof HTMLElement)) return;
      const step = second.offsetLeft - first.offsetLeft;
      start = el.scrollLeft;
      target = Math.min(start + step, el.scrollWidth - el.clientWidth);
      if (step <= 0 || target <= start) return;
      running = true;
      el.style.scrollSnapType = "none";
      el.setAttribute("data-introducing", "true");
      const began = performance.now();
      const tick = (now: number) => {
        const progress = Math.min(1, (now - began) / 2400);
        el.scrollLeft = start + (target - start) * progress * progress * (3 - 2 * progress);
        if (progress < 1) frame = requestAnimationFrame(tick);
        else settle();
      };
      frame = requestAnimationFrame(tick);
    };
    const schedule = () => {
      if (!checking) checking = requestAnimationFrame(check);
    };
    const wheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaX) > 0 || event.shiftKey) cancel();
    };
    const key = (event: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", "Home", "End", " "].includes(event.key)) cancel();
    };
    el.addEventListener("pointerdown", cancel);
    el.addEventListener("touchstart", cancel, { passive: true });
    el.addEventListener("focusin", cancel);
    el.addEventListener("wheel", wheel, { passive: true });
    el.addEventListener("keydown", key);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", cancel);
    motion.addEventListener("change", cancel);
    schedule();
    return () => {
      settle();
      cancelAnimationFrame(checking);
      stop.current = null;
      el.removeEventListener("pointerdown", cancel);
      el.removeEventListener("touchstart", cancel);
      el.removeEventListener("focusin", cancel);
      el.removeEventListener("wheel", wheel);
      el.removeEventListener("keydown", key);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", cancel);
      motion.removeEventListener("change", cancel);
    };
  }, [cancel]);
  return { ref, cancel };
}
