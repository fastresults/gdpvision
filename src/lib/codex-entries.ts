// Codex methodology entries — canonical source shared by the Codex screen
// and the `<WhyThisNumber>` drill-down component (PRD FR-SE-09).

export interface CodexEntry {
  id: string;
  title: string;
  body: string;
}

export const CODEX_ENTRIES: readonly CodexEntry[] = [
  {
    id: "confidence",
    title: "Confidence grading (A/B/C/D)",
    body:
      "Every stored figure carries a grade. A: government-published, current-fiscal. B: government-published, prior-fiscal or partial. C: multilateral (IMF/World Bank/ECCB) or reputable third-party. D: analyst reconstruction. Grades pair with pattern in the design system (§13.4) so hue is never load-bearing.",
  },
  {
    id: "sector-composition",
    title: "Sector composition (Ledger)",
    body:
      "Shares reconcile to 100% at the national level. Where a national account line spans two GDPVision sectors, the split is disclosed in the country_pack methodology block and is auditable in Stewardship.",
  },
  {
    id: "cbi-index",
    title: "CBI Exposure Index",
    body:
      "The index reads on a 0–100 scale, where 100 = full dependency of consolidated fiscal revenue on CBI receipts. Components: (a) CBI as share of recurrent revenue, (b) CBI as share of capital budget financing, (c) sensitivity to a 20% wind-down. Methodology drill-down is available on the Exposure screen.",
  },
  {
    id: "ripple",
    title: "Scenario ripple propagation",
    body:
      "First-order impact is direct-sector. Second-order impact runs through the dependency web (fixed-coefficient in v1.0, reviewed annually by the external economist). Third-order impact is fiscal (revenue elasticity table by sector). Ranges, never points.",
  },
  {
    id: "target-anchoring",
    title: "Evidence-anchored target setting (Mandate)",
    body:
      "Every KPI target must reference a baseline, a peer benchmark, or a scenario projection. Targets that exceed the best of the three by more than 30% are flagged as over-claim and require an override note. Classifications: Committed, Stretch, Aspirational (FR-KP-02).",
  },
  {
    id: "second-brain",
    title: "The Second Brain (Narrative Memory)",
    body:
      "Memory objects are typed: audience, position, statement, outlet, precedent. Every object is scoped (country silo vs. regional commons), sector-keyed, and weighted 1–5. Suppressed sources are removed from both retrieval and citation; suppression state is auditable.",
  },
  {
    id: "release-doctrine",
    title: "Comms release doctrine",
    body:
      "Drafts progress draft → advisor_review → comms_review → cabinet_review → released. Artifacts containing fiscal figures gate at comms_review pending a Ledger sign-off note. No autonomous release, ever (Principle 7).",
  },
  {
    id: "fact-check-policy",
    title: "Fact-check policy",
    body:
      "Every generated draft passes a numeric-claim extraction on save. Claims within ±5% of a live Ledger series_point are grounded; ungrounded fiscal figures gate release. Overrides record a reason to data_revisions and are surfaced in the audit log.",
  },
  {
    id: "counsel-doctrine",
    title: "Counsel doctrine",
    body:
      "2–4 sentence answers, ranked alternatives named where relevant, every claim cited to a Ledger figure or Second-Brain object. Confidence grade is spoken when it is C or D. Save-to-archive captures the exact scenario snapshot the answer was given under.",
  },
  {
    id: "national-signature",
    title: "National Signature",
    body:
      "The generative identity artifact for each country: pillars, distinctives, risks, and a comms tagline distilled from the Country Pack and sector shares. Regenerated on demand by admins; every regeneration is versioned in `countries.signature_generated_at`.",
  },
  {
    id: "keying-audit",
    title: "Country + sector keying audit",
    body:
      "Definition-of-Done gate: every domain row must carry a valid country_code and, where applicable, a sector_code. The audit walks every table, persists a per-run report, and blocks GA if any violation is present.",
  },
] as const;
