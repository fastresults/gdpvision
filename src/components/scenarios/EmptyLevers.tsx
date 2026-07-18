import { Link } from "@tanstack/react-router";
import { SlidersHorizontal, ArrowUpRight } from "lucide-react";

export function EmptyLevers({ code }: { code: string }) {
  return (
    <div className="flex flex-col items-start gap-3 border border-dashed border-line-200 bg-paper-100/40 p-6">
      <div className="grid h-10 w-10 place-items-center border border-line-200 bg-paper-0 text-ink-500">
        <SlidersHorizontal size={16} />
      </div>
      <div>
        <p className="font-serif text-lg text-ink-950">No policy levers yet</p>
        <p className="mt-1 max-w-md text-sm leading-relaxed text-ink-500">
          Levers, bounds, and response functions for {code} are defined during
          onboarding. Once stewards commit them, they appear here and drive the
          live projection.
        </p>
      </div>
      <Link
        to="/admin/countries/$code/onboard"
        params={{ code }}
        className="mt-1 inline-flex items-center gap-1 border border-ink-950 bg-ink-950 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-paper-0 hover:bg-ink-700"
      >
        Configure in onboarding <ArrowUpRight size={12} />
      </Link>
    </div>
  );
}
