import { useEffect, useRef, useState } from "react";
import { useBlocker, useRouter } from "@tanstack/react-router";
import { ArrowLeft, History } from "lucide-react";

import { getTrail, parentPath, startTrail, useTrail, type TrailEntry } from "@/lib/nav/trail";

/** One row per page: collapse consecutive same-page entries (tab/step changes), keeping the latest. */
function pagesBefore(trail: TrailEntry[]): TrailEntry[] {
  const cur = trail[trail.length - 1];
  if (!cur) return [];
  let end = trail.length - 1;
  while (end > 0 && trail[end - 1].pathname === cur.pathname) end--;
  const out: TrailEntry[] = [];
  for (let i = 0; i < end; i++) {
    if (i + 1 < end && trail[i + 1].pathname === trail[i].pathname) continue;
    out.push(trail[i]);
  }
  return out;
}
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
  const recent = pagesBefore(trail).reverse().slice(0, 10);

  function jump(target: TrailEntry) {
    setOpen(false);
    const cur = getTrail()[getTrail().length - 1];
    const delta = cur ? target.idx - cur.idx : 0;
    // Step through real browser history so Forward still works.
    if (delta < 0) router.history.go(delta);
  }

  return (
    <div ref={ref} className={`relative flex items-center gap-1 ${className}`}>
      <button
        type="button"
        onClick={back}
        className="flex h-8 items-center gap-1.5 border border-line-200 px-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500 hover:border-ink-950 hover:text-ink-950"
        aria-label={
          previous ? `Back to ${previous.title || previous.pathname}` : "Up to parent page"
        }
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
          {recent.map((e) => (
            <button
              key={e.idx}
              type="button"
              role="menuitem"
              onClick={() => jump(e)}
              className="block w-full px-3 py-2 text-left hover:bg-paper-100"
            >
              <span className="block truncate text-sm text-ink-950">{e.title || e.pathname}</span>
              <span className="block truncate font-mono text-[10px] text-ink-500">
                {e.pathname}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
