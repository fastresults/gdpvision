import { markdownTables } from "./audit";
import type { PlanCitationRow, PlanSectionRow } from "./db";
import type { SectorStage } from "./stages";

export interface PlanTarget {
  label: string;
  values: Array<{ period: string; raw: string; value: number | null }>;
}

export interface PlanProject {
  name: string;
  pillar: string;
  confirmed: boolean;
  flagship: boolean;
}

export interface PlanPhase {
  label: string;
  achievement: string;
}

export interface SectorPlanSummary {
  targets: PlanTarget[];
  projects: PlanProject[];
  phases: PlanPhase[];
  flagship: string | null;
  readiness: {
    pct: number;
    label: "Ready for review" | "Needs evidence" | "Incomplete";
    checks: Array<{ label: string; passed: boolean }>;
  };
  evidence: {
    grounded: number;
    needsConfirmation: number;
    gaps: number;
    citations: number;
    findings: number;
  };
  staleStages: SectorStage[];
}

const UNCERTAIN = /to be (confirmed|established|assigned|determined)|\btbc\b|\btbd\b/i;

function section(sections: PlanSectionRow[], stage: SectorStage): PlanSectionRow | undefined {
  return sections.find((item) => item.stage_key === stage);
}

function numberIn(value: string): number | null {
  const match = value.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function targetSummary(body: string): PlanTarget[] {
  for (const table of markdownTables(body)) {
    const metric = table.header.findIndex((h) => /target|outcome|metric|indicator|kpi/.test(h));
    const baseline = table.header.findIndex((h) => /baseline|current/.test(h));
    const year3 = table.header.findIndex((h) => /year\s*3|3[- ]?year/.test(h));
    const year5 = table.header.findIndex((h) => /year\s*5|5[- ]?year/.test(h));
    const year10 = table.header.findIndex((h) => /year\s*10|10[- ]?year/.test(h));
    if (metric < 0 || baseline < 0 || [year3, year5, year10].filter((i) => i >= 0).length < 2)
      continue;
    return table.rows.slice(0, 3).map((row) => {
      const cells: Array<[string, number]> = [
        ["Baseline", baseline],
        ["Year 3", year3],
        ["Year 5", year5],
        ["Year 10", year10],
      ];
      return {
        label: row[metric]?.replace(/\*\*/g, "").trim() || "Outcome target",
        values: cells
          .filter(([, index]) => index >= 0)
          .map(([period, index]) => ({
            period,
            raw: row[index]?.trim() || "—",
            value: numberIn(row[index] ?? ""),
          })),
      };
    });
  }
  return [];
}

function projectSummary(body: string): PlanProject[] {
  for (const table of markdownTables(body)) {
    const project = table.header.findIndex((h) => /^project$|project name|entry point/.test(h));
    const pillar = table.header.findIndex((h) => /pillar/.test(h));
    if (project < 0) continue;
    return table.rows.map((row) => {
      const name = row[project]?.replace(/\*\*/g, "").trim() || "Unnamed project";
      return {
        name,
        pillar: pillar >= 0 ? row[pillar]?.trim() || "Other" : "Other",
        confirmed: !row.some((cell) => UNCERTAIN.test(cell)),
        flagship: /flagship/i.test(name) || row.some((cell) => /\bflagship\b/i.test(cell)),
      };
    });
  }
  return [];
}

function phaseSummary(body: string): PlanPhase[] {
  for (const table of markdownTables(body)) {
    const phase = table.header.findIndex((h) => /phase|period|stage/.test(h));
    const delivery = table.header.findIndex((h) =>
      /deliver|achievement|output|milestone|gate/.test(h),
    );
    if (phase < 0 || delivery < 0) continue;
    return table.rows.slice(0, 4).map((row) => ({
      label: row[phase]?.trim() || "Phase",
      achievement: row[delivery]?.trim() || "Planned achievement",
    }));
  }
  const prosePhases = Array.from(
    body.matchAll(
      /(?:^|\n)#{0,6}\s*\*{0,2}(Phase\s+\d+\s*:[^\n*]+)\*{0,2}\s*\n([\s\S]*?)(?=\n#{0,6}\s*\*{0,2}Phase\s+\d+\s*:|\n#{1,6}\s+|\n[A-Z][A-Z ]{5,}\s*\n|$)/gi,
    ),
  );
  return prosePhases.slice(0, 4).map((match) => {
    const phaseBody = match[2] ?? "";
    const deliverables = phaseBody.match(
      /(?:^|\n)\s*\*{0,2}Deliverables\*{0,2}\s*:\s*\*{0,2}\s*([^\n]+)/i,
    );
    const focus = phaseBody.match(
      /(?:^|\n)\s*\*{0,2}Focus\*{0,2}\s*:\s*\*{0,2}\s*([^\n]+)/i,
    );
    return {
      label: (match[1] ?? "Phase").replace(/\*+/g, "").trim(),
      achievement: (deliverables?.[1] ?? focus?.[1] ?? "Planned achievement")
        .replace(/\*+/g, "")
        .trim(),
    };
  });
}

function namedFlagship(body: string, projects: PlanProject[]): string | null {
  const inTable = projects.find((project) => project.flagship);
  if (inTable) return inTable.name;
  const match = body.match(/flagship(?: project)?(?: is|:|—|–)\s*\*{0,2}([^\n.*|]{3,100})/i);
  return match?.[1]?.trim() ?? null;
}

export function summarizeSectorPlan(
  sections: PlanSectionRow[],
  citations: PlanCitationRow[],
): SectorPlanSummary {
  const ambition = section(sections, "ambition")?.body_md ?? "";
  const projectsBody = section(sections, "projects")?.body_md ?? "";
  const roadmapBody = section(sections, "roadmap")?.body_md ?? "";
  const projects = projectSummary(projectsBody);
  const phases = phaseSummary(roadmapBody);
  const drafted = sections.filter((item) => item.status !== "pending").length;
  const current = sections.filter(
    (item) => item.status !== "pending" && item.status !== "stale",
  ).length;
  const citedSectionIds = new Set(citations.map((citation) => citation.section_id));
  const cited = sections.filter((item) => citedSectionIds.has(item.id)).length;
  const measurementSound = !(section(sections, "measurement")?.audit ?? []).some(
    (f) => f.kind === "kpi",
  );
  const projectsSound =
    projects.length > 0 &&
    !(section(sections, "projects")?.audit ?? []).some((f) => f.kind === "project");
  const checks = [
    { label: "All sections drafted", passed: drafted === sections.length && sections.length > 0 },
    { label: "Every section current", passed: current === sections.length && sections.length > 0 },
    { label: "Every drafted section cited", passed: cited === drafted && drafted > 0 },
    {
      label: "KPIs fully specified",
      passed: measurementSound && !!section(sections, "measurement")?.body_md,
    },
    { label: "Projects fully specified", passed: projectsSound },
  ];
  const pct = Math.round((checks.filter((check) => check.passed).length / checks.length) * 100);
  const evidenceStates = sections.reduce(
    (acc, item) => {
      if (item.status === "gap" || !item.body_md.trim()) acc.gaps += 1;
      else if (UNCERTAIN.test(item.body_md)) acc.needsConfirmation += 1;
      else acc.grounded += 1;
      return acc;
    },
    { grounded: 0, needsConfirmation: 0, gaps: 0 },
  );
  const findings = sections.reduce((sum, item) => sum + item.audit.length, 0);

  return {
    targets: targetSummary(ambition),
    projects,
    phases,
    flagship: namedFlagship(projectsBody, projects),
    readiness: {
      pct,
      label:
        pct === 100
          ? "Ready for review"
          : drafted < sections.length
            ? "Incomplete"
            : "Needs evidence",
      checks,
    },
    evidence: { ...evidenceStates, citations: citations.length, findings },
    staleStages: sections.filter((item) => item.status === "stale").map((item) => item.stage_key),
  };
}
