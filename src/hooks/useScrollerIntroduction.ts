import { useCallback, useEffect, useRef } from "react";

/** A bounded one-panel pan that reverses with page scrolling; manual input wins. */
export function useScrollerIntroduction<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const manual = useRef(false);
  const stop = useRef<(() => void) | null>(null);
  const cancel = useCallback(() => {
    manual.current = true;
    stop.current?.();
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let checking = 0;
    let running = false;
    let initialized = false;
    let origin = 0;
    let end = 0;
    let target = 0;
    let direction = 1;
    let lastY = window.scrollY;
    let drift = 0;
    const pause = () => {
      cancelAnimationFrame(frame);
      running = false;
      el.removeAttribute("data-introducing");
    };
    const settle = () => {
      pause();
      if (initialized) {
        el.scrollLeft =
          Math.abs(el.scrollLeft - origin) < Math.abs(end - el.scrollLeft) ? origin : end;
        el.style.scrollSnapType = "";
        el.dispatchEvent(new Event("scroll"));
      }
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
    const animate = (destination: number) => {
      if (running && destination === target) return;
      pause();
      target = destination;
      const from = el.scrollLeft;
      const distance = target - from;
      if (Math.abs(distance) < 1) return;
      running = true;
      el.style.scrollSnapType = "none";
      el.setAttribute("data-introducing", "true");
      const began = performance.now();
      const duration = Math.max(300, (2400 * Math.abs(distance)) / (end - origin));
      const tick = (now: number) => {
        const progress = Math.min(1, (now - began) / duration);
        el.scrollLeft = from + distance * progress * progress * (3 - 2 * progress);
        if (progress < 1) frame = requestAnimationFrame(tick);
        else {
          pause();
          el.scrollLeft = target;
          el.style.scrollSnapType = "";
          el.dispatchEvent(new Event("scroll"));
        }
      };
      frame = requestAnimationFrame(tick);
    };
    const check = () => {
      checking = 0;
      if (manual.current || motion.matches) return;
      if (!visible()) {
        if (running) pause();
        return;
      }
      if (!initialized) {
        if (el.matches(":hover") || el.contains(document.activeElement)) return;
        const first = el.children.item(0);
        const second = el.children.item(1);
        if (!(first instanceof HTMLElement) || !(second instanceof HTMLElement)) return;
        const step = second.offsetLeft - first.offsetLeft;
        origin = el.scrollLeft;
        end = Math.min(origin + step, el.scrollWidth - el.clientWidth);
        if (step <= 0 || end <= origin) return;
        initialized = true;
      }
      animate(direction > 0 ? end : origin);
    };
    const schedule = () => {
      if (!checking) checking = requestAnimationFrame(check);
    };
    const scroll = () => {
      const delta = window.scrollY - lastY;
      lastY = window.scrollY;
      if (delta !== 0) {
        drift = Math.sign(delta) === Math.sign(drift) ? drift + delta : delta;
        // Ignore tiny layout/trackpad jitter, but reverse promptly on intentional scrolling.
        if (Math.abs(drift) >= 10) {
          direction = Math.sign(drift);
          drift = 0;
        }
      }
      schedule();
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
    window.addEventListener("scroll", scroll, { passive: true });
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
      window.removeEventListener("scroll", scroll);
      window.removeEventListener("resize", cancel);
      motion.removeEventListener("change", cancel);
    };
  }, [cancel]);
  return { ref, cancel };
}
