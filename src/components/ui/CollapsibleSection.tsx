import { useEffect, useState, type ReactNode } from "react";

export function CollapsibleSection({
  title,
  storageKey,
  defaultOpen = true,
  right,
  children,
}: {
  title: ReactNode;
  storageKey?: string;
  defaultOpen?: boolean;
  right?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState<boolean>(() => {
    if (typeof window === "undefined" || !storageKey) return defaultOpen;
    const v = window.localStorage.getItem(storageKey);
    return v == null ? defaultOpen : v === "1";
  });

  useEffect(() => {
    if (typeof window === "undefined" || !storageKey) return;
    window.localStorage.setItem(storageKey, open ? "1" : "0");
  }, [open, storageKey]);

  return (
    <section className="border border-line-200 bg-paper-0">
      <header className="flex items-center justify-between gap-3 px-4 py-2 border-b border-line-200 bg-paper-100/40">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex items-center gap-2 text-left min-w-0 flex-1"
        >
          <span
            aria-hidden
            className={`inline-block text-ink-500 transition-transform ${open ? "rotate-90" : ""}`}
          >
            ›
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-700 truncate">
            {title}
          </span>
        </button>
        {right ? <div className="shrink-0">{right}</div> : null}
      </header>
      {open ? <div className="p-4">{children}</div> : null}
    </section>
  );
}
