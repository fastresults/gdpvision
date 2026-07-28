import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

const SCROLL_THRESHOLD = 300;

/**
 * Floating back-to-top affordance for long, single-page public surfaces.
 * Appears once the user has scrolled past a threshold, then smooth-scrolls
 * back to the document top on click. Respects prefers-reduced-motion.
 */
export function FloatingBackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onScroll = () => {
      setVisible(window.scrollY > SCROLL_THRESHOLD);
    };

    setVisible(window.scrollY > SCROLL_THRESHOLD);
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const handleClick = () => {
    if (typeof window === "undefined") return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <button
      type="button"
      aria-label="Back to top"
      onClick={handleClick}
      className={`fixed bottom-6 right-6 z-50 btn-primary rounded-full p-3 shadow-lg transition-all duration-300 ease-out motion-reduce:transition-none md:bottom-8 md:right-8 ${
        visible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0 pointer-events-none"
      }`}
    >
      <ArrowUp size={20} strokeWidth={1.5} />
    </button>
  );
}
