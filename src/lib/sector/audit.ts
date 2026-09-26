// The Auditor: deterministic checks on a drafted section, run after every
// draft and edit. Pure — no model call — so its findings are reproducible
// and cheap. Findings are advisory in Phase 1; they are shown beside the
// section and summarised on the plan.

import type { AuditFinding } from "./db";
import type { SectorStage } from "./stages";

interface Table {
  header: string[];
  rows: string[][];
}

/** Pipe tables in a markdown body. */
export function markdownTables(md: string): Table[] {
  const out: Table[] = [];
  const lines = md.split("\n");
  for (let i = 0; i < lines.length - 1; i++) {
    const head = lines[i]!.trim();
    const sep = lines[i + 1]!.trim();
    if (!head.startsWith("|") || !/^\|?\s*:?-{2,}/.test(sep)) continue;
    const cells = (l: string) =>
      l
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((c) => c.trim());
    const t: Table = { header: cells(head).map((h) => h.toLowerCase()), rows: [] };
    let j = i + 2;
    while (j < lines.length && lines[j]!.trim().startsWith("|")) {
      t.rows.push(cells(lines[j]!));
      j++;
    }
    out.push(t);
    i = j - 1;
  }
  return out;
}

const EMPTY = /^(|—|-|–|n\/a|na|tbc|tbd|unknown|none)$/i;
const TO_CONFIRM = /to be (confirmed|established|assigned|determined)/i;

function emptyIn(
  tables: Table[],
  columns: Array<[RegExp, string]>,
): { rows: number; missing: Record<string, number> } {
  let rows = 0;
  const missing: Record<string, number> = {};
  for (const t of tables) {
    const idx = columns.map(([re]) => t.header.findIndex((h) => re.test(h)));
    if (idx.every((i) => i === -1)) continue;
    for (const r of t.rows) {
      rows++;
      idx.forEach((i, k) => {
        if (i === -1) return;
        const v = r[i] ?? "";
        if (EMPTY.test(v) || TO_CONFIRM.test(v)) {
          const key = columns[k]![1];
          missing[key] = (missing[key] ?? 0) + 1;
        }
      });
    }
  }
  return { rows, missing };
}

/** Numbers of the form 12%, 3.5, US$40m — to compare targets across sections. */
export function targetFigures(md: string): string[] {
  return Array.from(
    md.matchAll(/(?:US\$\s?)?\d[\d,]*(?:\.\d+)?\s?(?:%|m\b|bn\b|million|billion|jobs)/gi),
  ).map((m) => m[0].replace(/\s+/g, "").toLowerCase());
}

export function auditSection(
  stage: SectorStage,
  body: string,
  citations: number,
  others: Partial<Record<SectorStage, string>> = {},
): AuditFinding[] {
  const f: AuditFinding[] = [];
  const words = body.split(/\s+/).filter(Boolean).length;
  if (citations === 0 && words > 40)
    f.push({
      kind: "citation",
      message: "No corpus line is cited. Every factual statement needs a source.",
    });
  else if (citations > 0 && words / citations > 220)
    f.push({
      kind: "citation",
      message: `Thin grounding: ${citations} citation${citations === 1 ? "" : "s"} for ${words} words.`,
    });

  const tables = markdownTables(body);
  if (stage === "measurement") {
    const r = emptyIn(tables, [
      [/baseline/, "baseline"],
      [/source/, "source"],
      [/owner/, "owner"],
    ]);
    if (r.rows === 0)
      f.push({
        kind: "kpi",
        message: "No scorecard table with baseline, source and owner columns was found.",
      });
    for (const [k, n] of Object.entries(r.missing))
      f.push({
        kind: "kpi",
        message: `${n} KPI${n === 1 ? "" : "s"} without ${k === "owner" ? "an" : "a"} ${k}. Move ${n === 1 ? "it" : "them"} to the data-collection list or supply ${k === "owner" ? "an owner" : `a ${k}`}.`,
      });
  }
  if (stage === "projects") {
    const r = emptyIn(tables, [
      [/owner/, "owner"],
      [/fund/, "funding source"],
      [/milestone|completion|date/, "date"],
      [/kpi/, "KPI"],
    ]);
    if (r.rows === 0)
      f.push({
        kind: "project",
        message: "No project table with owner, funding, dates and KPI columns was found.",
      });
    for (const [k, n] of Object.entries(r.missing))
      f.push({
        kind: "project",
        message: `${n} project${n === 1 ? "" : "s"} without a confirmed ${k}.`,
      });
    if (r.rows > 0 && (r.rows < 8 || r.rows > 20))
      f.push({
        kind: "project",
        message: `${r.rows} projects listed; the method asks for 8 to 20.`,
      });
  }
  if (stage === "compact" && others.ambition) {
    const a = new Set(targetFigures(others.ambition));
    const c = targetFigures(body);
    const unmatched = c.filter((x) => !a.has(x));
    if (a.size && c.length && unmatched.length > c.length / 2)
      f.push({
        kind: "consistency",
        message:
          "Most figures in the Compact do not appear in the ambition section. The three targets must be identical in both.",
      });
  }
  const tbc = (body.match(new RegExp(TO_CONFIRM, "gi")) ?? []).length;
  if (tbc > 0)
    f.push({
      kind: "gap",
      message: `${tbc} item${tbc === 1 ? "" : "s"} marked to be confirmed or established.`,
    });
  return f;
}
