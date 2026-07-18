import { useEffect, useState } from "react";
import { HelpCircle, X } from "lucide-react";

const KEY = (id: string) => `chamber03.coach.${id}`;

export function CoachTip({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(typeof window !== "undefined" && window.localStorage.getItem(KEY(id)) === "1");
  }, [id]);

  if (dismissed && !open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Explain: ${title}`}
        className="inline-grid h-4 w-4 place-items-center text-ink-500 hover:text-ink-950"
      >
        <HelpCircle size={12} />
      </button>
    );
  }

  return (
    <span className="relative inline-block align-middle">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Explain: ${title}`}
        className="inline-grid h-4 w-4 place-items-center text-ink-500 hover:text-ink-950"
      >
        <HelpCircle size={12} />
      </button>
      {open && (
        <span
          role="dialog"
          className="absolute left-0 top-5 z-40 block w-64 border border-ink-950 bg-paper-0 p-3 text-left shadow-lg"
        >
          <span className="flex items-baseline justify-between gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-950">
              {title}
            </span>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                window.localStorage.setItem(KEY(id), "1");
                setDismissed(true);
              }}
              aria-label="Dismiss"
              className="text-ink-500 hover:text-ink-950"
            >
              <X size={11} />
            </button>
          </span>
          <span className="mt-1.5 block text-[11px] leading-relaxed text-ink-700">
            {children}
          </span>
        </span>
      )}
    </span>
  );
}
