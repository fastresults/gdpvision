// @domain explain
// @tables none
// @ui src/components/personas/portfolio/IdealProfileView.tsx
//
// Rationale entries for the Ministers track of Chamber 07: how each number on
// an Ideal Minister Profile was derived, and what weight it can carry.

import { registerRationales } from "@/lib/explain/registry";

registerRationales([
  {
    key: "ministers.skill.weight",
    title: "How skills are ranked",
    short: "Weight = share of the cast holding the skill × their mean proficiency ÷ 5.",
    basis:
      "Every persona names 8–14 skills from one fixed taxonomy, each with a proficiency from 1 to 5. The count is done in code, not by the model: for each skill, how many of the personas that passed the quality check hold it, and how well on average. A skill held by everyone at 5 has weight 1.0; a skill held by half the cast at 3 has weight 0.3.",
    caveat:
      "Common is not the same as decisive. The synthesis may tier a less common skill as a must-have when the cited research shows it separates success from failure in the office; it says so in the narrative.",
  },
  {
    key: "ministers.ocean.band",
    title: "Personality bands",
    short:
      "Each trait shows the spread of the cast and, in gold, the Ideal Profile's target range.",
    basis:
      "The grey box is the middle half of the cast (25th to 75th percentile), the whisker the full range, the tick the median — counted in code from the personas' OCEAN scores (0–100). The gold bar is the target range the synthesis chose; it should sit inside the cast's range unless the narrative explains why the ideal differs.",
    caveat:
      "Synthetic personality scores describe a type of person to look for, not a test any real minister has taken. Never score a real office holder against them.",
  },
  {
    key: "ministers.profile.decision",
    title: "The decision model",
    short:
      "One entry per class of decision this office makes: what the ideal minister weighs, and when they say no.",
    basis:
      "The decision classes are fixed for each portfolio (the taxonomy in migration 0028). The synthesis reads the cast's decision styles, the counted aggregates and the cited context, and writes how the ideal holder of the office would approach each class — order of considerations, horizon, risk posture, who they consult, and their red lines.",
    caveat:
      "A rehearsal standard, not a recommendation on any live decision. Use it to test a Cabinet paper's reasoning, not to make the decision.",
  },
  {
    key: "ministers.pm.weighting",
    title: "The Cabinet weighting",
    short:
      "How the ideal Prime Minister arbitrates between portfolios when the fiscal envelope is fixed.",
    basis:
      "The Prime Minister's profile is synthesised from its own 50 personas and from the approved Ideal Minister Profiles of the other portfolios. For each portfolio it states a stance, a weight from 1 to 5 for the attention and political capital it commands, and the rule by which its claims are arbitrated. When a ministry profile is re-approved after the PM's was written, the weighting is marked out of date.",
    caveat:
      "The weights express a governing philosophy, not a budget allocation. They change when the approved ministry profiles change.",
  },
  {
    key: "ministers.overlay",
    title: "Country overlay",
    short:
      "The approved regional profile, re-weighted for one country, with every change listed and justified.",
    basis:
      "The overlay keeps the regional profile wherever this country's corpus is silent, and changes it only where the country's scale, economy, institutions or exposures — cited from its own record — require. Each change appears under Country deltas with its reason. The cast is the regional one.",
    caveat:
      "An overlay is only as specific as the country's corpus. A thin record yields an overlay close to the regional profile.",
  },
]);
