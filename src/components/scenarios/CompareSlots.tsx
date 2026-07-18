import { Link } from "@tanstack/react-router";
import { Layers } from "lucide-react";

export function CompareSlots({
  code,
  count,
  max = 4,
}: {
  code: string;
  count: number;
  max?: number;
}) {
  return (
    <Link
      to="/admin/countries/$code/scenarios/compare"
      params={{ code }}
      search={{ ids: "" }}
      className="group inline-flex items-center gap-2 border border-line-200 px-2.5 py-1.5 hover:border-ink-950"
      title={`${count} of ${max} pinned for compare`}
    >
      <Layers size={12} className="text-ink-500 group-hover:text-ink-950" />
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-700 group-hover:text-ink-950">
        Compare
      </span>
      <span className="flex items-center gap-[3px]">
        {Array.from({ length: max }).map((_, i) => (
          <span
            key={i}
            className={
              "block h-2.5 w-2.5 border " +
              (i < count
                ? "border-ink-950 bg-ink-950"
                : "border-line-200 bg-paper-0")
            }
          />
        ))}
      </span>
    </Link>
  );
}
