// @domain explain
// @tables none
// @ui src/routes/_authenticated/admin/media-scan.tsx

import { registerRationales, type Rationale } from "@/lib/explain/registry";
import { PRIORITY_WEIGHTS } from "@/lib/narrative-priority-score";
import { SOURCE_PRIOR, SOURCE_WEIGHTS as sw } from "@/lib/narrative-source-strength";

const w = PRIORITY_WEIGHTS;

const entries: Array<Rationale<Record<string, never>>> = [
  {
    key: "narrative.priority-score",
    title: "How article importance is scored",
    short: "A 0–100 score that orders articles within each priority level.",
    formula: `Urgency up to ${w.urgency} + reach up to ${w.reach} + politics ${w.politics} + GDP/economy ${w.economy} + source strength (credibility) up to ${w.credibility} + story spread up to ${w.spread} + government or minister named ${w.government} + freshness up to ${w.freshness} (fades over 72 hours).`,
    basis:
      "Urgency, reach, politics, economy and government mentions come from the AI reading of each article. Credibility comes from the source's strength profile (falling back to official bodies 5, listed outlets as set, otherwise 3). Spread counts outlets carrying the same story, weighted by each outlet's strength.",
    caveat:
      "The P1–P5 level still follows the recommended response, urgency and reach; the score ranks articles inside a level.",
    derive: () => [],
  },
  {
    key: "narrative.source-strength",
    title: "How source strength is scored",
    short: "A 0–100 score from each source's last 30 days; it sets the source tier S1–S5.",
    formula: `Reach up to ${sw.reach} + hit rate (share that became P1–P3) up to ${sw.hit} + influence (share of its stories other outlets followed) up to ${sw.influence} + first to report up to ${sw.first} + accuracy up to ${sw.accuracy} + relevance up to ${sw.relevance}. Then × admin weight (0.5–1.5); paused sources × 0.5. Tiers: S1 ≥ 75, S2 ≥ 55, S3 ≥ 35, S4 ≥ 20, else S5.`,
    basis: `Sources with fewer than 30 articles are blended towards a neutral ${SOURCE_PRIOR} until they build a record. Reach defaults to 4 for international and 3 for others (or the outlet's listed credibility) unless an admin sets it.`,
    caveat: "Articles dismissed as noise count double against accuracy. Profiles refresh daily.",
    derive: () => [],
  },
  {
    key: "narrative.link-status",
    title: "How article links are checked",
    short: "Each new article's link is opened once when it is collected.",
    formula:
      "Verified = opens on the same site. Redirected = opens on a different site. Broken = error or no response within 7 seconds.",
    caveat: "Up to 80 links are checked per scan; the rest show as unchecked.",
    derive: () => [],
  },
  {
    key: "narrative.p1-guarantee",
    title: "Guaranteed P1 GDP and political story",
    short: "Every country keeps at least one P1 GDP story and one P1 political story after each scan.",
    formula:
      "If no story reaches P1 on its own, the most important matching story from the last 30 days is raised. The search goes P2 first, then P3, then P4, picking the highest importance score, then the newest.",
    caveat: "P5 and stories marked Noise, Duplicate or Dismissed are never raised. If nothing matches, the country shows a gap. A raise is removed once a natural P1 appears.",
    derive: () => [],
  },
];

registerRationales(entries as Array<Rationale<never>>);
