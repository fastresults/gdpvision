import { useEffect, useRef, useState } from "react";
import { useBlocker, useRouter } from "@tanstack/react-router";
import { ArrowLeft, History } from "lucide-react";

import { getTrail, parentPath, startTrail, truncateTo, useTrail } from "@/lib/nav/trail";
import { clearUnsavedWork, hasUnsavedWork } from "@/lib/nav/unsaved";

/** Mount once in the root: starts the journey trail and the unsaved-work guard. */
export function NavRuntime() {
  const router = useRouter();
  useEffect(() => startTrail(router), [router]);
  useBlocker({
    shouldBlockFn: () => {
      if (!hasUnsavedWork()) return false;
      const leave = window.confirm("You have unsaved changes. Leave this page and lose them?");
      if (leave) clearUnsavedWork();
      return !leave;
    },
    enableBeforeUnload: () => hasUnsavedWork(),
  });
  return null;
}

/** Go back to where the user actually came from, or up to the page's parent. */
export function useSmartBack() {
  const router = useRouter();
  return () => {
    const t = getTrail();
    if (t.length >= 2) router.history.back();
    else router.navigate({ to: parentPath(router, router.state.location.pathname) as never });
  };
}

export function NavControls({ className = "" }: { className?: string }) {
  const router = useRouter();
  const back = useSmartBack();
  const trail = useTrail();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const hasHistory = trail.length >= 2;
  const previous = hasHistory ? trail[trail.length - 2] : null;
  const recent = trail.slice(0, -1).map((e, i) => ({ e, i })).reverse().slice(0, 10);

  function jump(i: number) {
    const steps = trail.length - 1 - i;
    setOpen(false);
    if (steps <= 0) return;
    // Step through real browser history so Forward still works.
    router.history.go(-steps);
    setTimeout(() => {
      if (getTrail().length > i + 1) truncateTo(i);
    }, 400);
  }

  return (
    <div ref={ref} className={`relative flex items-center gap-1 ${className}`}>
      <button
        type="button"
        onClick={back}
        className="flex h-8 items-center gap-1.5 border border-line-200 px-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500 hover:border-ink-950 hover:text-ink-950"
        aria-label={previous ? `Back to ${previous.title || previous.pathname}` : "Up to parent page"}
        title={previous ? `Back to ${previous.title || previous.pathname}` : "Up to parent page"}
      >
        <ArrowLeft size={12} />
        <span className="hidden sm:inline">{hasHistory ? "Back" : "Up"}</span>
      </button>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={!recent.length}
        className="grid h-8 w-8 place-items-center border border-line-200 text-ink-500 hover:border-ink-950 hover:text-ink-950 disabled:opacity-40"
        aria-label="Where I've been"
        aria-expanded={open}
        title="Where I've been"
      >
        <History size={12} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-10 z-50 w-80 border border-line-200 bg-paper-0 py-1 shadow-lg"
        >
          <p className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            Where I’ve been
          </p>
          {recent.map(({ e, i }) => (
            <button
              key={`${e.href}-${i}`}
              type="button"
              role="menuitem"
              onClick={() => jump(i)}
              className="block w-full px-3 py-2 text-left hover:bg-paper-100"
            >
              <span className="block truncate text-sm text-ink-950">{e.title || e.pathname}</span>
              <span className="block truncate font-mono text-[10px] text-ink-500">{e.pathname}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
