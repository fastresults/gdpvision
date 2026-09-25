// The project content form, in four sections: profile, commercial, impact and
// preparation. Compliance (beneficial owners, AML) is not here: it lives in
// the restricted compliance record.

import type { InvestmentContent } from "@/lib/investments/pipeline.functions";
import { ES_CATEGORIES, STAGE_LABEL, STAGES } from "@/lib/investments/readiness";

import { Field, inputCls, SectionTitle } from "./ui";

export type ProjectDraft = {
  title: string;
  sector: string;
  structure: string;
  stage: (typeof STAGES)[number];
  capex_usd: string;
  summary: string;
  revenue_model: string;
  sponsor: string;
  es_category: "" | (typeof ES_CATEGORIES)[number];
  climate_alignment: string;
  risks: string;
  feasibility_done: boolean;
  land_secured: boolean;
};

export const EMPTY_DRAFT: ProjectDraft = {
  title: "",
  sector: "",
  structure: "",
  stage: "concept",
  capex_usd: "",
  summary: "",
  revenue_model: "",
  sponsor: "",
  es_category: "",
  climate_alignment: "",
  risks: "",
  feasibility_done: false,
  land_secured: false,
};

type ProjectLike = {
  title: string;
  sector: string | null;
  structure: string | null;
  stage: string;
  capex_usd: number | string | null;
  summary: string | null;
  revenue_model: string | null;
  sponsor: string | null;
  es_category: string | null;
  climate_alignment: string | null;
  risks: string | null;
  feasibility_done: boolean;
  land_secured: boolean;
};

export function toDraft(p: ProjectLike): ProjectDraft {
  return {
    title: p.title ?? "",
    sector: p.sector ?? "",
    structure: p.structure ?? "",
    stage: ((STAGES as readonly string[]).includes(p.stage)
      ? p.stage
      : "concept") as ProjectDraft["stage"],
    capex_usd: p.capex_usd == null ? "" : String(p.capex_usd),
    summary: p.summary ?? "",
    revenue_model: p.revenue_model ?? "",
    sponsor: p.sponsor ?? "",
    es_category: ((ES_CATEGORIES as readonly string[]).includes(p.es_category ?? "")
      ? p.es_category
      : "") as ProjectDraft["es_category"],
    climate_alignment: p.climate_alignment ?? "",
    risks: p.risks ?? "",
    feasibility_done: !!p.feasibility_done,
    land_secured: !!p.land_secured,
  };
}

/** Parses "12,500,000" or "12.5m" into a number; returns NaN if it cannot. */
export function parseAmount(s: string): number {
  const t = s
    .trim()
    .toLowerCase()
    .replace(/[,\s$]|us\$|usd/g, "");
  if (!t) return NaN;
  const m = /^(\d+(?:\.\d+)?)(k|m|bn|b)?$/.exec(t);
  if (!m) return NaN;
  const mult = m[2] === "k" ? 1e3 : m[2] === "m" ? 1e6 : m[2] === "bn" || m[2] === "b" ? 1e9 : 1;
  return Number(m[1]) * mult;
}

export function draftToContent(d: ProjectDraft): InvestmentContent {
  const capex = d.capex_usd.trim() === "" ? null : parseAmount(d.capex_usd);
  if (capex != null && !Number.isFinite(capex)) {
    throw new Error("Capital cost must be a number in US dollars, e.g. 12500000 or 12.5m.");
  }
  return {
    title: d.title,
    sector: d.sector,
    structure: d.structure,
    stage: d.stage,
    capex_usd: capex,
    summary: d.summary,
    revenue_model: d.revenue_model,
    sponsor: d.sponsor,
    es_category: d.es_category === "" ? null : d.es_category,
    climate_alignment: d.climate_alignment,
    risks: d.risks,
    feasibility_done: d.feasibility_done,
    land_secured: d.land_secured,
  };
}

const SECTORS = [
  "Energy — solar",
  "Energy — wind",
  "Energy — geothermal",
  "Energy — grid",
  "Transport — ports",
  "Transport — airports",
  "Transport — roads",
  "Water and sanitation",
  "Waste",
  "Communications — broadband",
  "Health",
  "Education",
  "Tourism",
  "Agriculture",
  "Social housing",
  "Coastal and flood protection",
];
const STRUCTURES = [
  "PPP",
  "Concession",
  "Joint venture",
  "Public works",
  "SOE asset",
  "CBI-funded project",
  "Private (licensed)",
];

const ES_HELP: Record<string, string> = {
  A: "A — significant, diverse or irreversible impacts",
  B: "B — limited, site-specific, reversible impacts",
  C: "C — minimal or no adverse impacts",
  FI: "FI — through a financial intermediary",
};

type SetField = <K extends keyof ProjectDraft>(k: K, v: ProjectDraft[K]) => void;

export function ProfileFields({
  d,
  set,
  disabled,
}: {
  d: ProjectDraft;
  set: SetField;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Title" className="sm:col-span-2">
        <input
          className={inputCls}
          value={d.title}
          disabled={disabled}
          onChange={(e) => set("title", e.target.value)}
        />
      </Field>
      <Field label="Sector">
        <input
          className={inputCls}
          list="gdpv-sectors"
          value={d.sector}
          disabled={disabled}
          onChange={(e) => set("sector", e.target.value)}
        />
        <datalist id="gdpv-sectors">
          {SECTORS.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </Field>
      <Field label="Deal structure">
        <input
          className={inputCls}
          list="gdpv-structures"
          value={d.structure}
          disabled={disabled}
          onChange={(e) => set("structure", e.target.value)}
        />
        <datalist id="gdpv-structures">
          {STRUCTURES.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </Field>
      <Field label="Stage">
        <select
          className={inputCls}
          value={d.stage}
          disabled={disabled}
          onChange={(e) => set("stage", e.target.value as ProjectDraft["stage"])}
        >
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {STAGE_LABEL[s]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Capital cost (US$)" hint="A number, e.g. 12500000 or 12.5m.">
        <input
          className={inputCls}
          inputMode="decimal"
          value={d.capex_usd}
          disabled={disabled}
          onChange={(e) => set("capex_usd", e.target.value)}
        />
      </Field>
      <Field
        label="Summary"
        className="sm:col-span-2"
        hint="One paragraph an investor can read in a minute."
      >
        <textarea
          className={inputCls}
          rows={4}
          value={d.summary}
          disabled={disabled}
          onChange={(e) => set("summary", e.target.value)}
        />
      </Field>
    </div>
  );
}

export function ProjectForm({
  d,
  set,
  disabled,
}: {
  d: ProjectDraft;
  set: SetField;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-8">
      <section>
        <SectionTitle id="section-profile" hint="What it is, where it stands and what it costs.">
          Profile
        </SectionTitle>
        <ProfileFields d={d} set={set} disabled={disabled} />
      </section>

      <section>
        <SectionTitle id="section-commercial" hint="Who stands behind it and how it earns.">
          Commercial
        </SectionTitle>
        <div className="grid gap-3">
          <Field
            label="Sponsor"
            hint="The public body or company sponsoring the project. Not shown on share links."
          >
            <input
              className={inputCls}
              value={d.sponsor}
              disabled={disabled}
              onChange={(e) => set("sponsor", e.target.value)}
            />
          </Field>
          <Field
            label="Revenue model"
            hint="User fees, availability payments, offtake — and who pays."
          >
            <textarea
              className={inputCls}
              rows={3}
              value={d.revenue_model}
              disabled={disabled}
              onChange={(e) => set("revenue_model", e.target.value)}
            />
          </Field>
        </div>
      </section>

      <section>
        <SectionTitle
          id="section-impact"
          hint="Environmental and social category, and climate alignment."
        >
          Impact
        </SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="E&S category (IFC)">
            <select
              className={inputCls}
              value={d.es_category}
              disabled={disabled}
              onChange={(e) => set("es_category", e.target.value as ProjectDraft["es_category"])}
            >
              <option value="">Not assigned</option>
              {ES_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {ES_HELP[c]}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Climate and taxonomy alignment"
            className="sm:col-span-2"
            hint="The climate objective served and any taxonomy or NDC alignment."
          >
            <textarea
              className={inputCls}
              rows={3}
              value={d.climate_alignment}
              disabled={disabled}
              onChange={(e) => set("climate_alignment", e.target.value)}
            />
          </Field>
        </div>
      </section>

      <section>
        <SectionTitle
          id="section-preparation"
          hint="Risks and the preparation milestones investors ask about first."
        >
          Preparation
        </SectionTitle>
        <div className="grid gap-3">
          <Field label="Key risks" hint="The main risks and who carries each one.">
            <textarea
              className={inputCls}
              rows={4}
              value={d.risks}
              disabled={disabled}
              onChange={(e) => set("risks", e.target.value)}
            />
          </Field>
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm text-ink-800">
              <input
                type="checkbox"
                checked={d.feasibility_done}
                disabled={disabled}
                onChange={(e) => set("feasibility_done", e.target.checked)}
              />
              Feasibility study complete
            </label>
            <label className="flex items-center gap-2 text-sm text-ink-800">
              <input
                type="checkbox"
                checked={d.land_secured}
                disabled={disabled}
                onChange={(e) => set("land_secured", e.target.checked)}
              />
              Land and permits secured
            </label>
          </div>
        </div>
      </section>
    </div>
  );
}
