// Chamber 05 · pure cost-control rules for the news scan (no I/O).
// Decides which stories never reach AI, when a scan must stop starting new
// AI work, and how an AI Gateway status affects the scan.
import { keywordTags } from "@/lib/narrative-keyword-tags";

/** Low-cost model used for every news-sorting call. */
export const PRESS_CLASSIFIER_MODEL = "google/gemini-3.1-flash-lite";

/** Hard limits that apply to every scan regardless of admin settings. */
export const SCAN_LIMITS = {
  /** Stop starting new AI work this long after the scan begins (ms). */
  timeBudgetMs: 60_000,
  /** Full-article reads (Firecrawl) per scan. */
  articleReadsPerRun: 12,
  /** Only stories fetched within this window are considered (days). */
  freshDays: 3,
  /** Characters of article text sent to AI. */
  maxPromptChars: 3_500,
};

const OFF_TOPIC: Array<{ reason: string; words: RegExp }> = [
  {
    reason: "sports",
    words:
      /\b(football|soccer|baseball|béisbol|beisbol|pelota|jonr[oó]n|basketball|cricket|t20|odi|wicket|innings|batsman|bowler|test match|cpl|world cup|olympic|olympics|athlete|athletics|sprinter|boxing|boxer|tennis|golf|golfer|racing|regatta|marathon|fixture|tournament|championship|league|striker|goalkeeper|coach|stadium|serie nacional|fútbol|futbol|football club|fc)\b/i,
  },
  {
    reason: "entertainment",
    words:
      /\b(celebrity|celebrities|concert|album|music video|movie|film premiere|box office|actress|actor|singer|rapper|grammy|grammys|oscars?|netflix|reality show|beauty pageant|miss universe|miss world|fashion week|red carpet)\b/i,
  },
  {
    reason: "lifestyle",
    words: /\b(horoscope|zodiac|lottery|lotto|winning numbers|recipe|recipes|obituary|obituaries|in memoriam|funeral notice|crossword|dating tips)\b/i,
  },
];

// Phrases that contain political words but are not about politics.
const MISLEADING = /\b(premier league|premier division|party (?:time|music|night)|birthday party|block party)\b/gi;

/**
 * Reason a story is clearly off-topic (sports, entertainment, lifestyle) and
 * should be skipped before AI, or null when it might matter. A story that also
 * mentions politics or the economy is never skipped.
 */
export function offTopicReason(title: string | null, excerpt: string | null): string | null {
  const text = `${title ?? ""} ${excerpt ?? ""}`;
  const hit = OFF_TOPIC.find((o) => o.words.test(text));
  if (!hit) return null;
  const k = keywordTags(text.replace(MISLEADING, " "));
  if (k.is_political || k.is_economic || k.mentions_government) return null;
  return hit.reason;
}

export type ScanBudget = {
  startedAt: number;
  deadline: number;
  /** AI requests this scan may still make (per-scan limit). */
  remaining: number;
  articleReads: number;
  aiCalls: number;
  skippedOffTopic: number;
  skippedNoBudget: number;
  /** Set when the scan must stop starting AI work. */
  stop: null | { kind: StopKind; message: string };
};

export function newBudget(perRunLimit: number, now = Date.now()): ScanBudget {
  return {
    startedAt: now,
    deadline: now + SCAN_LIMITS.timeBudgetMs,
    remaining: Math.max(0, Math.floor(perRunLimit)),
    articleReads: 0,
    aiCalls: 0,
    skippedOffTopic: 0,
    skippedNoBudget: 0,
    stop: null,
  };
}

/** Whether the scan may start one more AI request. */
export function canStartAi(b: ScanBudget, now = Date.now()): boolean {
  return !b.stop && b.remaining > 0 && now < b.deadline;
}

export type StopKind = "pause" | "rate" | "daily_limit";

/**
 * How an AI Gateway HTTP status affects the scan:
 * - "pause": credits exhausted or access blocked (402/403) — stop and stay paused until an admin clears it.
 * - "rate": rate limited or a server hiccup (429/5xx) — stop this scan; the next scan tries again.
 * - "item": a problem with this one story — mark it failed and never resend it.
 */
export function gatewayOutcome(status: number): "pause" | "rate" | "item" {
  if (status === 402 || status === 403) return "pause";
  if (status === 429 || status >= 500) return "rate";
  return "item";
}
