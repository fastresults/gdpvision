// Shared wording and colour for the Sector Studio. Status is coloured text,
// a small dot and borders — never a filled pill (house rule).

import type { Recommendation } from "@/lib/sector/db";

export { MICRO, PRD_META as PLAN_META, SECTION_META, formatWhen } from "@/components/egov/labels";

export const RECOMMENDATION_META: Record<
  Recommendation,
  { label: string; text: string; border: string }
> = {
  recommend: { label: "Recommend", text: "text-signal-positive", border: "border-signal-positive" },
  consider: { label: "Consider", text: "text-gold-500", border: "border-gold-500" },
  hold: { label: "Hold", text: "text-ink-400", border: "border-line-200" },
};

export const FIELD =
  "w-full border border-line-200 bg-paper-0 px-3 py-2 text-sm text-ink-950 focus:border-ink-950 focus:outline-none";
