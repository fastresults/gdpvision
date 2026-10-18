// @domain public-data · @tables intake_items, narrative_source_stats · @ui none
// Allow-list shaping for media scan data shared through the Partner API and MCP.
// Drafts, recommendations, pin/flag notes and reviewer fields are never emitted.

export const MEDIA_WINDOW_DAYS = 30;
export const MEDIA_TOPICS = ["politics", "gdp", "government"] as const;
export type MediaTopic = (typeof MEDIA_TOPICS)[number];

/** Mirrors SQL narrative_priority_level(). */
export function priorityLevel(rec: string | null, sev: number | null, reach: number | null): number {
  const s = sev ?? 0;
  const r = reach ?? 0;
  if (rec === "lead" || rec === "counter") return s >= 4 || r >= 4 ? 1 : 2;
  if (rec === "amplify") return s >= 4 ? 2 : 3;
  if (rec === "monitor") return 4;
  if (rec === "ignore") return 5;
  if (s >= 4 || r >= 4) return 2;
  if (s >= 2 || r >= 2) return 4;
  return 5;
}

export const MEDIA_SELECT =
  "id,topic,summary,url,link_final_url,link_status,scope,severity,reach,sentiment,recommendation,state,review_verdict,tags,countries,is_political,is_economic,mentions_government,priority_score,priority_override,priority_raised_from,source_tier,first_to_report,story_key,created_at,metadata";

type Row = Record<string, unknown>;

export function isShareable(row: Row, now = Date.now()): boolean {
  if (row.review_verdict === "noise") return false;
  if (row.state === "duplicate" || row.state === "dismissed") return false;
  const t = Date.parse(String(row.created_at ?? ""));
  return Number.isFinite(t) && now - t <= MEDIA_WINDOW_DAYS * 86400000;
}

export function toPublicSignal(row: Row) {
  const meta = (row.metadata ?? {}) as Row;
  const topics: MediaTopic[] = [];
  if (row.is_political) topics.push("politics");
  if (row.is_economic) topics.push("gdp");
  if (row.mentions_government) topics.push("government");
  return {
    id: String(row.id),
    headline: String(row.topic ?? ""),
    summary: row.summary ? String(row.summary) : null,
    url: String(row.link_final_url ?? row.url ?? "") || null,
    link_verified: row.link_status === "ok",
    outlet: typeof meta.outlet === "string" ? meta.outlet : typeof meta.source === "string" ? meta.source : null,
    published_at: typeof meta.published_at === "string" ? meta.published_at : String(row.created_at),
    collected_at: String(row.created_at),
    coverage: row.scope ? String(row.scope) : null,
    topics,
    tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
    countries: Array.isArray(row.countries) ? row.countries.map(String) : [],
    priority_level: row.priority_override === 1 ? 1 : priorityLevel(row.recommendation as string | null, row.severity as number | null, row.reach as number | null),
    priority_raised_from: row.priority_raised_from == null ? null : Number(row.priority_raised_from),
    importance_score: row.priority_score == null ? null : Math.round(Number(row.priority_score) * 100) / 100,
    source_tier: row.source_tier == null ? null : `S${row.source_tier}`,
    first_to_report: row.first_to_report === true,
    sentiment: row.sentiment == null ? null : Number(row.sentiment),
    story_key: row.story_key ? String(row.story_key) : null,
  };
}

export function shapeMedia(
  rows: Row[],
  opts: { topic?: string | null; minPriority?: number | null; now?: number } = {},
) {
  return rows
    .filter((r) => isShareable(r, opts.now))
    .map(toPublicSignal)
    .filter((s) => !opts.topic || s.topics.includes(opts.topic as MediaTopic))
    .filter((s) => !opts.minPriority || s.priority_level <= opts.minPriority);
}

export function toPublicSource(stat: Row, feed: Row) {
  return {
    outlet: String(feed.label ?? ""),
    country: String(stat.country_code ?? feed.country_code ?? ""),
    coverage: feed.scope ? String(feed.scope) : null,
    strength_tier: stat.tier == null ? null : `S${stat.tier}`,
    reach_tier: stat.reach_tier == null ? null : Number(stat.reach_tier),
    items_per_day: stat.per_day == null ? null : Number(stat.per_day),
    influence_rate: stat.influence_rate == null ? null : Number(stat.influence_rate),
    first_to_report_rate: stat.first_rate == null ? null : Number(stat.first_rate),
  };
}
