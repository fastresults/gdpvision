export const CLIENT_OUTPUT_BANNED_TERMS = [
  /\bgdp\s*vision\b/i,
  /\bchamber\s*(?:0?[1-9]|one|two|three|four|five|six|seven|eight)\b/i,
  /\bsecond brain\b/i,
  /\bpersona lab\b/i,
  /\bresearch chamber\b/i,
  /\binternal workspace\b/i,
];

export type GoverningBriefIdentity = {
  sourceName: string;
  preparedFor: string;
  preparedBy: string;
};

export type OutputPreflightItem = {
  sectionId: string;
  source: "governing_brief" | "approved_plan" | "approved_segments" | "approved_instrument";
  unsupportedClaimCount: number;
  bannedTermCount: number;
  ready: boolean;
};

function lineAfter(text: string, label: RegExp): string {
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  const index = lines.findIndex((line) => label.test(line));
  if (index < 0) return "";
  return lines.slice(index + 1).find((line) => line.length > 0) ?? "";
}

export function governingBriefIdentity(
  source: unknown,
  fallbackTitle: string,
): GoverningBriefIdentity {
  const record = source && typeof source === "object" ? (source as Record<string, unknown>) : {};
  const excerpt = typeof record["excerpt"] === "string" ? record["excerpt"] : "";
  const sourceName = typeof record["name"] === "string" ? record["name"] : fallbackTitle;
  return {
    sourceName,
    preparedFor: lineAfter(excerpt, /^prepared\s+for\b/i),
    preparedBy: lineAfter(excerpt, /^(?:submitted|prepared)\s+by\b/i),
  };
}

export function governingBriefText(source: unknown, raw: unknown): string {
  const record = source && typeof source === "object" ? (source as Record<string, unknown>) : {};
  const excerpt = typeof record["excerpt"] === "string" ? record["excerpt"].trim() : "";
  if (excerpt.length > 0) return excerpt;
  return typeof raw === "string" ? raw.trim() : "";
}

export function bannedTermCount(value: unknown): number {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return CLIENT_OUTPUT_BANNED_TERMS.reduce((count, pattern) => count + (pattern.test(text) ? 1 : 0), 0);
}

export function assertClientOutputClean(value: unknown, label: string): void {
  const count = bannedTermCount(value);
  if (count > 0) {
    throw new Error(`${label} contains ${count} prohibited internal reference${count === 1 ? "" : "s"}.`);
  }
}

export function makePreflightItem(
  sectionId: string,
  source: OutputPreflightItem["source"],
  value: unknown,
): OutputPreflightItem {
  const banned = bannedTermCount(value);
  return {
    sectionId,
    source,
    unsupportedClaimCount: 0,
    bannedTermCount: banned,
    ready: banned === 0,
  };
}