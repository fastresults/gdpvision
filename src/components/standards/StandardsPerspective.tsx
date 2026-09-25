import {
  createContext,
  type FocusEvent,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Pin, X } from "lucide-react";

import { Explain } from "@/components/explain/Explain";
import { cn } from "@/lib/utils";

export type StandardsPerspective = {
  id: string;
  title: string;
  summary: string;
  direction: string;
  exposure: string;
  action: string;
  caution: string;
};

type PerspectiveContextValue = {
  active: StandardsPerspective | null;
  pinned: boolean;
  schedule: (perspective: StandardsPerspective) => void;
  clear: () => void;
  show: (perspective: StandardsPerspective) => void;
  togglePin: (perspective: StandardsPerspective) => void;
  close: () => void;
};

const PerspectiveContext = createContext<PerspectiveContextValue | null>(null);
const HOVER_DELAY_MS = 2_000;
const CLEAR_DELAY_MS = 120;

export function StandardsPerspectiveProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<StandardsPerspective | null>(null);
  const [pinned, setPinned] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const schedule = useCallback(
    (perspective: StandardsPerspective) => {
      cancelTimer();
      if (pinned) return;
      timer.current = setTimeout(() => setActive(perspective), HOVER_DELAY_MS);
    },
    [cancelTimer, pinned],
  );

  const clear = useCallback(() => {
    cancelTimer();
    if (pinned) return;
    timer.current = setTimeout(() => setActive(null), CLEAR_DELAY_MS);
  }, [cancelTimer, pinned]);

  const show = useCallback(
    (perspective: StandardsPerspective) => {
      cancelTimer();
      if (!pinned) setActive(perspective);
    },
    [cancelTimer, pinned],
  );

  const togglePin = useCallback(
    (perspective: StandardsPerspective) => {
      cancelTimer();
      if (pinned && active?.id === perspective.id) {
        setPinned(false);
        setActive(null);
        return;
      }
      setActive(perspective);
      setPinned(true);
    },
    [active?.id, cancelTimer, pinned],
  );

  const close = useCallback(() => {
    cancelTimer();
    setPinned(false);
    setActive(null);
  }, [cancelTimer]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      cancelTimer();
    };
  }, [cancelTimer, close]);

  const value = useMemo(
    () => ({ active, pinned, schedule, clear, show, togglePin, close }),
    [active, pinned, schedule, clear, show, togglePin, close],
  );

  return (
    <PerspectiveContext.Provider value={value}>
      {children}
      {active ? <PerspectivePanel perspective={active} pinned={pinned} onClose={close} /> : null}
    </PerspectiveContext.Provider>
  );
}

export function useStandardsPerspective(perspective: StandardsPerspective) {
  const context = useContext(PerspectiveContext);
  if (!context) throw new Error("useStandardsPerspective must be used inside its provider");
  const active = context.active?.id === perspective.id;

  return {
    tabIndex: 0,
    "data-perspective-active": active ? "true" : undefined,
    onMouseEnter: () => context.schedule(perspective),
    onMouseLeave: () => context.clear(),
    onFocus: (_event: FocusEvent<HTMLElement>) => context.show(perspective),
    onBlur: (event: FocusEvent<HTMLElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget)) context.clear();
    },
    onClick: (event: MouseEvent<HTMLElement>) => {
      if ((event.target as HTMLElement).closest("a,button")) return;
      context.togglePin(perspective);
    },
  };
}

function PerspectivePanel({
  perspective,
  pinned,
  onClose,
}: {
  perspective: StandardsPerspective;
  pinned: boolean;
  onClose: () => void;
}) {
  return (
    <aside
      aria-live="polite"
      aria-label={`Executive perspective: ${perspective.title}`}
      className={cn(
        "fixed inset-x-3 bottom-3 z-[80] max-h-[72vh] overflow-y-auto border border-line-200 bg-paper-0 shadow-xl motion-safe:animate-fade-in sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[min(560px,calc(100vw-3rem))] sm:-translate-x-1/2 sm:-translate-y-1/2",
        pinned ? "pointer-events-auto" : "pointer-events-none",
      )}
    >
      <header className="flex items-start justify-between gap-4 border-b border-line-200 px-5 py-4">
        <div>
          <p className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.18em] text-ink-500">
            {pinned ? <Pin size={11} aria-hidden /> : null}
            {pinned ? "Pinned · executive perspective" : "Executive perspective"}
          </p>
          <h3 className="mt-1 font-serif text-2xl font-normal text-ink-950">{perspective.title}</h3>
        </div>
        {pinned ? (
          <button
            type="button"
            className="btn-ghost h-8 w-8 p-0"
            onClick={onClose}
            aria-label="Close executive perspective"
          >
            <X size={14} aria-hidden />
          </button>
        ) : null}
      </header>
      <Explain
        id="standards.executive-perspective"
        ctx={perspective}
        mark={false}
        className="block"
      >
        <div className="grid gap-4 px-5 py-4 text-sm leading-relaxed text-ink-700 sm:grid-cols-2">
          <PerspectiveRow label="Executive summary" value={perspective.summary} wide />
          <PerspectiveRow label="Direction" value={perspective.direction} />
          <PerspectiveRow label="Priority exposure" value={perspective.exposure} />
          <PerspectiveRow label="Decision relevance" value={perspective.action} />
          <PerspectiveRow label="Coverage & caution" value={perspective.caution} />
        </div>
      </Explain>
      {!pinned ? (
        <p className="border-t border-line-100 px-5 py-2 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-500">
          Click or tap the measure to keep this perspective open
        </p>
      ) : null}
    </aside>
  );
}

function PerspectiveRow({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-500">{label}</p>
      <p className="mt-1">{value}</p>
    </div>
  );
}
