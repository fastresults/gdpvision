// @domain explain
// @tables none
// @ui src/routes/_authenticated/admin/media-scan.tsx

import { registerRationales, type Rationale } from "@/lib/explain/registry";
import { PRIORITY_WEIGHTS } from "@/lib/narrative-priority-score";

const w = PRIORITY_WEIGHTS;

const entries: Array<Rationale<Record<string, never>>> = [
  {
    key: "narrative.priority-score",
    title: "How article importance is scored",
    short: "A 0–100 score that orders articles within each priority level.",
    formula: `Urgency up to ${w.urgency} + reach up to ${w.reach} + politics ${w.politics} + GDP/economy ${w.economy} + source credibility up to ${w.credibility} + story spread up to ${w.spread} + government or minister named ${w.government} + freshness up to ${w.freshness} (fades over 72 hours).`,
    basis:
      "Urgency, reach, politics, economy and government mentions come from the AI reading of each article. Credibility: official bodies 5, listed outlets as set on the Media Scan page, otherwise 3. Spread counts how many outlets carry the same story.",
    caveat:
      "The P1–P5 level still follows the recommended response, urgency and reach; the score ranks articles inside a level.",
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
];

registerRationales(entries as Array<Rationale<never>>);
