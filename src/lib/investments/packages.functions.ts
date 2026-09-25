// @domain investments
// @tables investment_packages,investment_projects,countries,country_kpis
// @ui src/components/investments/packages/InvestorPackagesPanel.tsx
//
// Investor packages: teaser, information memorandum, data-room index, deck.
//
// Each package is a version of one kind for one project, written from a
// stored facts object (package-facts.server.ts). The data-room index is built
// by rule; the other three are drafted by a model that may use only those
// facts, then passed through the number guard, which brackets any figure it
// cannot find in them. Approval is a status change only: the
// investment_packages_guard trigger (migration 0009) enforces the two-person
// rule, the approver role, an approved project and a current project version.

import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import {
  PACKAGE_KINDS,
  db,
  governanceError,
  loadCapabilities,
  type PackageKind,
  type PackageRow,
} from "@/lib/syndication/db";

import { collectFactNumbers, guardDeep, type FactNumbers } from "./number-guard";
import {
  buildDataRoom,
  display,
  factFigure,
  hostOf,
  keyTerms,
  gatherPackageFacts,
} from "./package-facts.server";
import {
  CONTACT_PLACEHOLDER,
  DECK_VISUALS,
  DISCLAIMER,
  DeckAiSchema,
  MEMO_SECTIONS,
  MemorandumAiSchema,
  TO_BE_CONFIRMED,
  TeaserAiSchema,
  countWarnings,
  type DeckContent,
  type DeckVisual,
  type MemorandumContent,
  type PackageContent,
  type PackageFacts,
  type PackageFigure,
  type PackageTable,
  type TeaserContent,
} from "./package-schema";

const MODEL = "google/gemini-2.5-flash";
const DATA_ROOM_MODEL = "rules:data-room-v1";

const Code = z.string().min(2).max(3);
const KindEnum = z.enum(PACKAGE_KINDS);

// ------------------------------------------------------------------ list

export interface PackageSummary {
  id: string;
  kind: PackageKind;
  version: number;
  project_version: number;
  status: PackageRow["status"];
  model: string | null;
  created_at: string;
  approved_at: string | null;
  drafted_by_me: boolean;
  /** The project has changed since this package was generated. */
  stale: boolean;
  warnings: number;
}

export const listPackages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ code: Code, projectId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const c = db(context.supabase);
    const [{ data: project, error: pErr }, { data: rows, error }, caps] = await Promise.all([
      c
        .from("investment_projects")
        .select("id,title,version,approval_status")
        .eq("id", data.projectId)
        .eq("country_code", data.code)
        .maybeSingle(),
      c
        .from("investment_packages")
        .select(
          "id,kind,version,project_version,status,model,created_by,created_at,approved_at,content",
        )
        .eq("project_id", data.projectId)
        .eq("country_code", data.code)
        .order("version", { ascending: false }),
      loadCapabilities(context.supabase, context.userId, data.code),
    ]);
    if (pErr) throw governanceError(pErr);
    if (error) throw governanceError(error);
    if (!project) throw new Error("Project not found for this country.");
    const proj = project as { id: string; title: string; version: number; approval_status: string };
    const packages: PackageSummary[] = ((rows ?? []) as Array<PackageRow>).map((r) => ({
      id: r.id,
      kind: r.kind,
      version: r.version,
      project_version: r.project_version,
      status: r.status,
      model: r.model,
      created_at: r.created_at,
      approved_at: r.approved_at,
      drafted_by_me: r.created_by === context.userId,
      stale: r.project_version !== proj.version,
      warnings: countWarnings(r.content),
    }));
    return {
      project: {
        id: proj.id,
        title: proj.title,
        version: proj.version,
        approval_status: proj.approval_status,
      },
      packages,
      capabilities: caps,
      aiAvailable: !!process.env.LOVABLE_API_KEY,
    };
  });

// ------------------------------------------------------------------ read one (print view)

export const getPackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ code: Code, packageId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const c = db(context.supabase);
    const { data: row, error } = await c
      .from("investment_packages")
      .select(
        "id,project_id,kind,version,project_version,status,content,model,created_at,approved_at",
      )
      .eq("id", data.packageId)
      .eq("country_code", data.code)
      .maybeSingle();
    if (error) throw governanceError(error);
    if (!row) throw new Error("Package not found.");
    const pkg = row as Pick<
      PackageRow,
      | "id"
      | "project_id"
      | "kind"
      | "version"
      | "project_version"
      | "status"
      | "content"
      | "model"
      | "created_at"
      | "approved_at"
    >;
    const { data: project } = await c
      .from("investment_projects")
      .select("id,title,version")
      .eq("id", pkg.project_id)
      .maybeSingle();
    const proj = project as { id: string; title: string; version: number } | null;
    return {
      id: pkg.id,
      project_id: pkg.project_id,
      kind: pkg.kind,
      version: pkg.version,
      project_version: pkg.project_version,
      status: pkg.status,
      model: pkg.model,
      created_at: pkg.created_at,
      approved_at: pkg.approved_at,
      content: pkg.content as Json,
      project_title: proj?.title ?? "Project",
      stale: proj ? proj.version !== pkg.project_version : false,
    };
  });

// ------------------------------------------------------------------ approve

export const approvePackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ code: Code, packageId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: current } = await db(context.supabase)
      .from("investment_packages")
      .select("content")
      .eq("id", data.packageId)
      .eq("country_code", data.code)
      .maybeSingle();
    const unverified = countWarnings((current as { content?: unknown } | null)?.content);
    if (unverified > 0) {
      throw new Error(
        `This draft contains ${unverified} figure${unverified === 1 ? "" : "s"} that could not be matched to the project's facts. Regenerate it, or correct the project, before approval.`,
      );
    }
    const { data: rows, error } = await db(context.supabase)
      .from("investment_packages")
      .update({ status: "approved" })
      .eq("id", data.packageId)
      .eq("country_code", data.code)
      .select("id,status");
    if (error) throw governanceError(error);
    if (!rows || rows.length === 0)
      throw new Error("Package not found, or you don't have permission to approve it.");
    return { ok: true as const };
  });

// ------------------------------------------------------------------ generate

const SYSTEM_PROMPT = `You draft investor materials for a national investment authority in the Caribbean.

Rules — follow every one:
- Write for institutional investors (development finance institutions, infrastructure funds, pension funds, strategic operators) in plain, sober English. British/Caribbean spelling: programme, organisation, harbour, labour, centre.
- Use ONLY the facts provided. Never invent a number, name, date, deadline, rate of return, yield, tariff, guarantee, incentive, partner, investor or timetable.
- Do not state or imply returns, guarantees, government support, exclusivity or tax incentives unless a fact states them.
- Where an investor would expect information that is not in the facts, write "To be confirmed".
- When you use a figure, copy it exactly as it appears in the fact's display value. Do not round, convert, add up or compare figures.
- No promotional language: no "world-class", "unique", "unparalleled", "unprecedented", "exciting", "game-changing".
- No markdown, no bullet characters, no headings inside text fields.`;

function factsBlock(facts: PackageFacts): string {
  const lines = Object.values(facts.items).map((f) => {
    const extra = [
      f.period ? `period ${f.period}` : null,
      f.source_url ? `source ${hostOf(f.source_url)}` : null,
      f.standard ? `standard ${f.standard}` : null,
    ]
      .filter(Boolean)
      .join("; ");
    return `${f.key} | ${f.label} | ${f.display}${extra ? ` | ${extra}` : ""}`;
  });
  return `FACTS (key | label | display value | notes). These are the only facts you may use.\n${lines.join("\n")}`;
}

/** Pull a readable string out of whatever the model put in a string slot. */
function asText(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    for (const k of ["text", "content", "value", "title", "item", "description", "body"]) {
      if (typeof o[k] === "string") return o[k] as string;
    }
    const firstStr = Object.values(o).find((x) => typeof x === "string");
    if (typeof firstStr === "string") return firstStr;
  }
  return "";
}

function unwrapOptional(s: z.ZodTypeAny): z.ZodTypeAny {
  let cur: z.ZodTypeAny = s;
  while (cur instanceof z.ZodOptional || cur instanceof z.ZodNullable) cur = cur.unwrap();
  return cur;
}

/** Repair common near-misses (missing keys, string for list, objects for strings, wrappers). */
function coerce(schema: z.ZodTypeAny, v: unknown): unknown {
  const s = unwrapOptional(schema);
  if (s instanceof z.ZodString) return asText(v);
  if (s instanceof z.ZodArray) {
    const el = s.element as z.ZodTypeAny;
    const arr = Array.isArray(v)
      ? v
      : v == null || v === ""
        ? []
        : typeof v === "string"
          ? v
              .split(/\n+/)
              .map((x) => x.replace(/^\s*[-*•\d.)]+\s*/, ""))
              .filter(Boolean)
          : [v];
    return arr.map((x) => coerce(el, x));
  }
  if (s instanceof z.ZodObject) {
    const shape = s.shape as Record<string, z.ZodTypeAny>;
    // A bare array (e.g. the slide list without its wrapper) goes into the
    // object's first array field.
    if (Array.isArray(v)) {
      const arrKey = Object.keys(shape).find(
        (k) => unwrapOptional(shape[k]!) instanceof z.ZodArray,
      );
      v = arrKey ? { [arrKey]: v } : {};
    }
    let o = v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
    const keys = Object.keys(shape);
    // Unwrap { "teaser": { ...fields } } style wrappers.
    if (!keys.some((k) => k in o)) {
      const inner = Object.values(o).find(
        (x) =>
          x && typeof x === "object" && !Array.isArray(x) && keys.some((k) => k in (x as object)),
      );
      if (inner) o = inner as Record<string, unknown>;
    }
    if (typeof v === "string" && keys.includes("text")) o = { text: v };
    const out: Record<string, unknown> = {};
    for (const k of keys) {
      const field = shape[k];
      const isOptional = field.isOptional() || field.isNullable();
      if (o[k] == null && isOptional) out[k] = null;
      else out[k] = coerce(field, o[k]);
    }
    return out;
  }
  return v;
}

function parseLenient<T>(schema: z.ZodType<T>, raw: unknown): T | null {
  const direct = schema.safeParse(raw);
  if (direct.success) return direct.data;
  const fixed = schema.safeParse(coerce(schema as unknown as z.ZodTypeAny, raw));
  return fixed.success ? fixed.data : null;
}

function parseFallback<T>(schema: z.ZodType<T>, text: string | undefined): T | null {
  if (!text) return null;
  const cleaned = text
    .replace(/^\s*```(?:json)?/i, "")
    .replace(/```\s*$/, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return parseLenient(schema, JSON.parse(cleaned.slice(start, end + 1)));
  } catch {
    return null;
  }
}

async function draft<T>(apiKey: string, schema: z.ZodType<T>, prompt: string): Promise<T> {
  const gateway = createLovableAiGatewayProvider(apiKey);
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { output } = await generateText({
        model: gateway(MODEL),
        system: SYSTEM_PROMPT,
        output: Output.object({ schema }),
        maxOutputTokens: 16000,
        prompt,
      });
      return output as T;
    } catch (err) {
      lastErr = err;
      const e = err as { text?: string };
      const parsed = parseFallback(schema, e?.text);
      if (parsed) return parsed;
      const cause = (err as { cause?: unknown }).cause;
      console.warn(
        "[packages] draft attempt failed",
        attempt + 1,
        (err as Error)?.message,
        "| finish:",
        (err as { finishReason?: string }).finishReason,
        "| textLen:",
        e?.text?.length,
        "| head:",
        e?.text?.slice(0, 300),
        "| tail:",
        e?.text?.slice(-200),
        "| cause:",
        cause instanceof Error ? cause.message.slice(0, 600) : String(cause).slice(0, 600),
      );
    }
  }
  const msg = (lastErr as { message?: string })?.message ?? String(lastErr);
  throw new Error(
    `The draft could not be generated after two attempts. Please try again. (${msg})`,
  );
}

const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
const cleanList = (xs: Array<string | null | undefined> | null | undefined, max: number) =>
  (xs ?? []).map(clean).filter(Boolean).slice(0, max);

function kpiKeys(facts: PackageFacts): string[] {
  return Object.keys(facts.items).filter((k) => k.startsWith("kpi."));
}

function figures(facts: PackageFacts, keys: string[]): PackageFigure[] {
  return keys.map((k) => factFigure(facts, k)).filter((f): f is PackageFigure => !!f);
}

// -------------------------------- teaser

async function buildTeaser(
  apiKey: string,
  facts: PackageFacts,
  fn: FactNumbers,
  preparedOn: string,
): Promise<TeaserContent> {
  const ai = await draft(
    apiKey,
    TeaserAiSchema,
    `${factsBlock(facts)}

Write a one-page investment teaser for "${facts.project_title}" in ${facts.country_name}.
Return:
- headline: at most 14 words, a plain statement of what the opportunity is. No figures unless copied from a fact.
- opportunity: one paragraph of 80–120 words: what the project is, who sponsors it, the structure, the stage, and what is sought from investors.
- highlights: 3 to 5 items, each one sentence of at most 25 words, each grounded in a named fact.
- country_context: 2 to 4 lines, each one sentence about the country's economy, each citing exactly one fact key starting with "kpi." or "country." in fact_key. Copy the figure's display value exactly.
- next_steps: 2 to 4 short items describing how an interested investor proceeds (for example: express interest, sign a non-disclosure agreement, request data-room access). No dates.`,
  );
  const warnings: string[] = [];
  const known = new Set(Object.keys(facts.items));
  const headline = guardDeep(
    clean(ai.headline) || facts.project_title,
    fn,
    "the headline",
    warnings,
  );
  const opportunity = guardDeep(
    clean(ai.opportunity) || TO_BE_CONFIRMED,
    fn,
    "the opportunity paragraph",
    warnings,
  );
  const highlights = guardDeep(
    cleanList(ai.highlights, 5),
    fn,
    "the investment highlights",
    warnings,
  );
  const country_context = (ai.country_context ?? [])
    .slice(0, 4)
    .map((l) => {
      const key = l.fact_key && known.has(l.fact_key) ? l.fact_key : null;
      return {
        text: guardDeep(clean(l.text), fn, "the country context", warnings),
        fact_key: key,
        figure: key ? factFigure(facts, key) : null,
      };
    })
    .filter((l) => l.text);
  const next_steps = guardDeep(cleanList(ai.next_steps, 4), fn, "the next steps", warnings);
  const kpis = kpiKeys(facts);
  const preferred = ["kpi.real_gdp_growth", "kpi.gdp_per_capita", "kpi.population"].filter((k) =>
    kpis.includes(k),
  );
  return {
    kind: "teaser",
    project_title: facts.project_title,
    country_name: facts.country_name,
    prepared_on: preparedOn,
    warnings,
    headline,
    opportunity,
    key_terms: keyTerms(facts),
    key_figures: figures(facts, [
      "project.capex_usd",
      ...(preferred.length ? preferred : kpis).slice(0, 2),
    ]),
    highlights,
    country_context,
    next_steps: next_steps.length
      ? next_steps
      : [
          "Express interest to the investment authority.",
          "Sign a non-disclosure agreement to receive the information memorandum.",
        ],
    contact: CONTACT_PLACEHOLDER,
    disclaimer: DISCLAIMER,
  };
}

// -------------------------------- memorandum

async function buildMemorandum(
  apiKey: string,
  facts: PackageFacts,
  fn: FactNumbers,
  preparedOn: string,
): Promise<MemorandumContent> {
  const ai = await draft(
    apiKey,
    MemorandumAiSchema,
    `${factsBlock(facts)}

Write the text of an information memorandum for "${facts.project_title}" in ${facts.country_name}.
Each field is a list of paragraphs. Write 1 to 3 paragraphs per field, each at most 120 words. Tables are added separately — do not repeat long lists of figures.
- executive_summary: the project, the sponsor, the structure, the capital cost, the stage and what is sought.
- opportunity: why the project exists, grounded only in the project summary and sector facts.
- country_context: the country's economy, using only kpi.* facts; cite period where given.
- sector_context: the sector, using only facts provided. If the facts say little, say so and write "To be confirmed" for the market assessment.
- project_description: scope and components from the summary.
- commercial_structure: the transaction structure and revenue model.
- environmental_social: the IFC category and what it implies under IFC Performance Standard 1.
- climate_alignment: the stated climate alignment.
- risks_intro: one short paragraph introducing the risk table.
- risks: a list of {risk, mitigant} drawn from the key-risks fact. If a mitigant is not stated, write "To be confirmed".
- preparation_status: what is complete and what is outstanding, from the readiness.* and project facts.
- transaction_process: how investors engage (expression of interest, non-disclosure agreement, data-room access, due diligence). No dates.`,
  );
  const warnings: string[] = [];
  const g = <T>(v: T, where: string) => guardDeep(v, fn, `“${where}”`, warnings);
  const paras = (xs: string[] | undefined, where: string) => {
    const list = cleanList(xs, 3);
    return g(list.length ? list : [TO_BE_CONFIRMED], where);
  };

  const kpiTable: PackageTable | null = kpiKeys(facts).length
    ? {
        columns: ["Indicator", "Value", "Period", "Source"],
        rows: kpiKeys(facts).map((k) => {
          const f = facts.items[k];
          return [f.label, f.display, f.period ?? "—", hostOf(f.source_url)];
        }),
        caption: "Latest published values held in the national ledger.",
      }
    : null;
  const risks = (ai.risks ?? [])
    .slice(0, 10)
    .map((r) => [clean(r.risk), clean(r.mitigant) || TO_BE_CONFIRMED])
    .filter((r) => r[0]);
  const readiness = Object.values(facts.items).filter(
    (f) => f.group === "readiness" && f.key !== "readiness.score",
  );

  const heading = (id: string) => MEMO_SECTIONS.find((s) => s.id === id)?.heading ?? id;
  const sections: MemorandumContent["sections"] = [
    {
      id: "executive_summary",
      heading: heading("executive_summary"),
      paragraphs: paras(ai.executive_summary, heading("executive_summary")),
      table: { columns: ["Term", "Detail"], rows: keyTerms(facts).map((t) => [t.label, t.value]) },
    },
    {
      id: "opportunity",
      heading: heading("opportunity"),
      paragraphs: paras(ai.opportunity, heading("opportunity")),
    },
    {
      id: "country_context",
      heading: heading("country_context"),
      paragraphs: paras(ai.country_context, heading("country_context")),
      table: kpiTable,
    },
    {
      id: "sector_context",
      heading: heading("sector_context"),
      paragraphs: paras(ai.sector_context, heading("sector_context")),
    },
    {
      id: "project_description",
      heading: heading("project_description"),
      paragraphs: paras(ai.project_description, heading("project_description")),
    },
    {
      id: "commercial_structure",
      heading: heading("commercial_structure"),
      paragraphs: paras(ai.commercial_structure, heading("commercial_structure")),
    },
    {
      id: "environmental_social",
      heading: heading("environmental_social"),
      paragraphs: paras(ai.environmental_social, heading("environmental_social")),
    },
    {
      id: "climate_alignment",
      heading: heading("climate_alignment"),
      paragraphs: paras(ai.climate_alignment, heading("climate_alignment")),
    },
    {
      id: "risks",
      heading: heading("risks"),
      paragraphs: paras(ai.risks_intro, heading("risks")),
      table: risks.length
        ? { columns: ["Risk", "Mitigant"], rows: g(risks, heading("risks")) }
        : null,
    },
    {
      id: "preparation_status",
      heading: heading("preparation_status"),
      paragraphs: paras(ai.preparation_status, heading("preparation_status")),
      table: {
        columns: ["Check", "Standard", "Status"],
        rows: readiness.map((f) => [f.label, f.standard ?? "—", f.display]),
        caption: `Readiness checks met: ${display(facts, "readiness.score")}.`,
      },
    },
    {
      id: "transaction_process",
      heading: heading("transaction_process"),
      paragraphs: [
        ...paras(ai.transaction_process, heading("transaction_process")),
        `Contact: ${CONTACT_PLACEHOLDER}.`,
      ],
    },
    { id: "disclaimer", heading: heading("disclaimer"), paragraphs: [DISCLAIMER] },
  ];

  return {
    kind: "memorandum",
    project_title: facts.project_title,
    country_name: facts.country_name,
    prepared_on: preparedOn,
    warnings,
    sections,
  };
}

// -------------------------------- deck

async function buildDeck(
  apiKey: string,
  facts: PackageFacts,
  fn: FactNumbers,
  preparedOn: string,
): Promise<DeckContent> {
  const ai = await draft(
    apiKey,
    DeckAiSchema,
    `${factsBlock(facts)}

Write an investor presentation of 8 to 10 slides for "${facts.project_title}" in ${facts.country_name}.
Suggested order: title; the opportunity; country context; sector; the project; commercial structure and revenue model; environmental, social and climate; risks and mitigants; preparation status; next steps.
For each slide return:
- title: at most 8 words.
- kicker: 2 to 4 words, shown small above the title (for example "Country context").
- bullets: at most 4, each at most 14 words. Plain statements, no trailing full stops needed.
- fact_keys: the key of every fact whose figure the slide relies on. Figures are displayed from these keys, so name them rather than typing numbers into bullets.
- visual: "illustration" for the title slide only; "key_figures" when the slide's point is a set of figures named in fact_keys; otherwise "none".`,
  );
  const warnings: string[] = [];
  const known = new Set(Object.keys(facts.items));
  const slides = (ai.slides ?? []).slice(0, 10).map((s, i) => {
    const keys = (s.fact_keys ?? []).filter((k) => known.has(k)).slice(0, 4);
    const figs = figures(facts, keys);
    let visual: DeckVisual = (DECK_VISUALS as readonly string[]).includes(String(s.visual))
      ? (s.visual as DeckVisual)
      : "none";
    if (visual === "key_figures" && figs.length === 0) visual = "none";
    if (visual === "illustration" && i !== 0) visual = "none";
    if (i === 0 && visual === "none") visual = "illustration";
    const where = `slide ${i + 1}`;
    return {
      title: guardDeep(clean(s.title) || facts.project_title, fn, where, warnings),
      kicker: guardDeep(clean(s.kicker), fn, where, warnings),
      bullets: guardDeep(cleanList(s.bullets, 4), fn, where, warnings),
      fact_keys: keys,
      visual,
      figures: figs,
    };
  });
  if (slides.length === 0) throw new Error("The draft came back without slides. Try again.");
  return {
    kind: "deck",
    project_title: facts.project_title,
    country_name: facts.country_name,
    prepared_on: preparedOn,
    warnings,
    slides,
    disclaimer: DISCLAIMER,
  };
}

export const generatePackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ code: Code, projectId: z.string().uuid(), kind: KindEnum }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (data.kind !== "data_room" && !apiKey) {
      throw new Error(
        "Drafting is unavailable: the AI gateway key (LOVABLE_API_KEY) is not configured on this server. The data-room index can still be built.",
      );
    }

    const facts = await gatherPackageFacts(context.supabase, data.code, data.projectId);
    const fn = collectFactNumbers(facts);
    const preparedOn = new Date().toISOString().slice(0, 10);

    let content: PackageContent;
    let model: string;
    switch (data.kind) {
      case "data_room":
        content = buildDataRoom(facts, preparedOn);
        model = DATA_ROOM_MODEL;
        break;
      case "teaser":
        content = await buildTeaser(apiKey!, facts, fn, preparedOn);
        model = MODEL;
        break;
      case "memorandum":
        content = await buildMemorandum(apiKey!, facts, fn, preparedOn);
        model = MODEL;
        break;
      case "deck":
        content = await buildDeck(apiKey!, facts, fn, preparedOn);
        model = MODEL;
        break;
    }

    const c = db(context.supabase);
    // Next version for this kind. Retry once if another draft lands first.
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data: last } = await c
        .from("investment_packages")
        .select("version")
        .eq("project_id", data.projectId)
        .eq("kind", data.kind)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      const version = Number((last as { version?: number } | null)?.version ?? 0) + 1;
      const { data: row, error } = await c
        .from("investment_packages")
        .insert({
          project_id: data.projectId,
          country_code: data.code,
          kind: data.kind,
          version,
          project_version: facts.project_version,
          status: "draft",
          content,
          facts,
          model,
        })
        .select("id,version")
        .single();
      if (!error && row) {
        const r = row as { id: string; version: number };
        return { id: r.id, version: r.version, warnings: content.warnings.length };
      }
      if (error && !/duplicate key/i.test(error.message)) throw governanceError(error);
    }
    throw new Error("Another draft of this package was saved at the same moment. Try again.");
  });
