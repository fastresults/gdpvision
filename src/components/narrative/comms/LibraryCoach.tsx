import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { X, Sparkles, Radio, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

const KEY = "comms-library-coach-seen-v1";

export function LibraryCoach({ code }: { code: string }) {
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(KEY) === "1");
    } catch { /* noop */ }
  }, []);
  if (dismissed) return null;
  const close = () => {
    try { localStorage.setItem(KEY, "1"); } catch { /* noop */ }
    setDismissed(true);
  };
  return (
    <div className="relative border border-ink-950 bg-ink-950 text-paper-0 p-4">
      <button
        onClick={close}
        aria-label="Dismiss"
        className="absolute right-2 top-2 text-paper-0/70 hover:text-paper-0"
      >
        <X size={14} />
      </button>
      <div className="flex items-start gap-3">
        <Sparkles size={16} className="mt-0.5 shrink-0 text-amber-300" />
        <div className="flex-1 min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper-0/60">
            How the Comms Library works
          </p>
          <h3 className="mt-1 font-serif text-lg leading-tight">
            Triage → Draft → Approve → Release, without losing the audit trail.
          </h3>
          <ol className="mt-2 space-y-1 text-[12px] text-paper-0/85">
            <li><span className="font-mono text-[10px] text-amber-300">01</span> Use the cards above to jump to what needs you.</li>
            <li><span className="font-mono text-[10px] text-amber-300">02</span> Open any draft to see its workflow tracker and next action.</li>
            <li><span className="font-mono text-[10px] text-amber-300">03</span> Reuse released work via <b>Save as template</b> → <b>Use template</b>.</li>
          </ol>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              to="/admin/countries/$code/narrative"
              params={{ code }}
              className="inline-flex items-center gap-1 border border-paper-0/40 px-2 py-1 font-mono text-[10px] uppercase tracking-widest hover:bg-paper-0/10"
            >
              <Radio size={11} /> Draft from a signal
            </Link>
            <Button size="sm" variant="secondary" onClick={close}>
              <FileText size={11} className="mr-1" /> Got it
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
