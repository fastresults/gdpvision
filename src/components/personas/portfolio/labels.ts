// Shared wording and colour for the Ministers track (chamber 07). Status is
// coloured text, a small dot and borders — never a filled pill (house rule).

export { MICRO, PRD_META as STATUS_META, formatWhen } from "@/components/egov/labels";
export { FIELD } from "@/components/sector/labels";

export const RUN_META = {
  idle: { label: "Paused", text: "text-ink-500" },
  running: { label: "Running", text: "text-gold-500" },
  failed: { label: "Stopped on an error", text: "text-signal-negative" },
  done: { label: "Run complete", text: "text-signal-positive" },
} as const;
