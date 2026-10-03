// Corpus domain `portfolio_persona` — the Ideal Minister Profiles (chamber 07,
// Ministers track; drizzle/migrations/0028). Server-only.
//
// The profile in force for a portfolio in a country is the approved country
// overlay if there is one, otherwise the approved regional profile. Drafts are
// never returned here: other chambers only read approved profiles.
//
// This domain has no external search or write-back — profiles are made by the
// Persona Lab's run and approved by people — so it is read directly rather
// than through the miss → search → write-back gateway.

import { clipText as clip, contextLine as line } from "@/lib/egov/context.server";
import { hasProfile, type ContextLine, type IdealProfile } from "@/lib/personas/portfolio/db";
import { effectiveProfile } from "@/lib/personas/portfolio/engine.server";
import { db, type AnyClient } from "@/lib/syndication/db";

export interface IdealProfileRead {
  portfolio_code: string;
  label: string;
  scope: string;
  version: number;
  synthesis_id: string;
  profile: IdealProfile;
}

export async function readIdealProfile(
  sb: AnyClient,
  country: string,
  portfolioCode: string,
): Promise<IdealProfileRead | null> {
  const eff = await effectiveProfile(sb, country, portfolioCode).catch(() => null);
  if (!eff || !eff.approved || !hasProfile(eff.synthesis.profile)) return null;
  const { data } = await db(sb)
    .from("ministry_portfolios")
    .select("label")
    .eq("code", portfolioCode)
    .maybeSingle();
  return {
    portfolio_code: portfolioCode,
    label: (data as { label?: string } | null)?.label ?? portfolioCode,
    scope: eff.set.scope_key,
    version: eff.set.version,
    synthesis_id: eff.synthesis.id,
    profile: eff.synthesis.profile,
  };
}

/** Portfolios relevant to a sector: those that list it, plus the Prime Minister. */
export async function portfoliosForSector(sb: AnyClient, sector: string): Promise<string[]> {
  const { data } = await db(sb)
    .from("ministry_portfolios")
    .select("code,kind,default_sector_codes")
    .order("sort_order");
  return ((data ?? []) as Array<{ code: string; kind: string; default_sector_codes: string[] }>)
    .filter(
      (p) => p.kind === "head_of_government" || (p.default_sector_codes ?? []).includes(sector),
    )
    .map((p) => p.code);
}

/**
 * Context lines for other chambers' packs: for each portfolio with an
 * approved profile, its summary, must-have skills and how it decides.
 * Keys are `ideal.<code>.*`; the source row is the synthesis.
 */
export async function idealProfileLines(
  sb: AnyClient,
  country: string,
  portfolioCodes: string[],
): Promise<ContextLine[]> {
  const out: ContextLine[] = [];
  for (const code of portfolioCodes) {
    const r = await readIdealProfile(sb, country, code);
    if (!r) continue;
    const k = code.toLowerCase();
    const ref = `portfolio_persona_syntheses:${r.synthesis_id}`;
    const lbl = `Ideal ${code === "PM" ? "Prime Minister" : `Minister — ${r.label}`} (v${r.version}${r.scope === country ? `, ${country} overlay` : ", regional"})`;
    const p = r.profile;
    out.push(
      line(`ideal.${k}.summary`, clip(`${p.title}: ${p.summary}`, 600), "corpus_row", ref, lbl),
    );
    const must = p.skill_stack.filter((s) => s.tier === "must_have").map((s) => s.code);
    if (must.length)
      out.push(
        line(`ideal.${k}.skills`, `Must-have skills: ${must.join(", ")}`, "corpus_row", ref, lbl),
      );
    for (const d of p.decision_model.slice(0, 6))
      out.push(
        line(
          `ideal.${k}.decides.${d.key}`,
          clip(
            `${d.label} — weighs ${d.weighs.join(", ")}; horizon ${d.horizon}; says no when ${d.says_no_when}`,
            420,
          ),
          "corpus_row",
          ref,
          lbl,
        ),
      );
    for (const w of (p.portfolio_weighting ?? []).slice(0, 12))
      out.push(
        line(
          `ideal.pm.weighs.${w.portfolio_code.toLowerCase()}`,
          clip(
            `The ideal Prime Minister gives ${w.portfolio_code} weight ${w.weight}/5: ${w.arbitration_rule}`,
            360,
          ),
          "corpus_row",
          ref,
          lbl,
        ),
      );
  }
  return out;
}
