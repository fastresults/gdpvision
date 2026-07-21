// Markdown exporters for Chamber 07 reports (individual study + program synthesis).
// Emits a single .md file with every section fully expanded — nothing hidden
// behind accordions or truncated slices. Formatters are pure and take the
// shapes already returned by getStudy / getStudyProgramReport.

type Citation = {
  n?: number;
  kind?: string;
  title?: string;
  url?: string | null;
  org?: string | null;
  excerpt?: string | null;
};

function toCitations(v: unknown): Citation[] {
  if (!Array.isArray(v)) return [];
  return (v as unknown[])
    .map((c) => (c && typeof c === "object" ? (c as Citation) : null))
    .filter((c): c is Citation => !!c);
}

function esc(s: unknown): string {
  return String(s ?? "").replace(/\r\n/g, "\n").trimEnd();
}

function fence(v: unknown): string {
  return "```json\n" + JSON.stringify(v, null, 2) + "\n```";
}

function slug(s: string): string {
  return String(s || "report")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "report";
}

function sourcesBlock(citations: Citation[]): string {
  if (citations.length === 0) return "";
  const lines = citations
    .slice()
    .sort((a, b) => (a.n ?? 0) - (b.n ?? 0))
    .map((c) => {
      const n = c.n ?? "?";
      const bits: string[] = [`[${n}] ${esc(c.title || "(untitled)")}`];
      if (c.org) bits.push(`_${esc(c.org)}_`);
      if (c.url) bits.push(`<${c.url}>`);
      let line = `- ${bits.join(" — ")}`;
      if (c.excerpt) line += `\n  > ${esc(c.excerpt).replace(/\n/g, "\n  > ")}`;
      return line;
    });
  return `\n\n---\n\n## Sources\n\n${lines.join("\n")}\n`;
}

// ── Individual study ─────────────────────────────────────────────────────
export type StudyExportInput = {
  study: {
    title?: string | null;
    kind?: string | null;
    status?: string | null;
    objective?: string | null;
    country_code?: string | null;
    created_at?: string | null;
    project_id?: string | null;
    segment_id?: string | null;
  } | null;
  questions: Array<{ id: string; ord?: number | null; prompt?: string | null; kind?: string | null; options?: unknown }>;
  responses: Array<{
    id: string;
    question_id?: string | null;
    answer?: unknown;
    rationale?: string | null;
    citations?: unknown;
    personas?: { name?: string | null; archetype?: string | null } | null;
  }>;
  transcript: Array<{ id: string; ord?: number | null; speaker?: string | null; utterance?: string | null; citations?: unknown }>;
  report: {
    summary_md?: string | null;
    themes?: unknown;
    recommendations?: unknown;
    citations?: unknown;
  } | null;
};

export function studyReportToMarkdown(input: StudyExportInput): { filename: string; body: string } {
  const s = input.study ?? {};
  const title = s.title || "Untitled study";
  const parts: string[] = [];

  // Frontmatter (YAML)
  const fm: Record<string, string> = {
    title,
    country: s.country_code ?? "",
    kind: s.kind ?? "",
    status: s.status ?? "",
    created_at: s.created_at ?? "",
  };
  if (s.project_id) fm.project = s.project_id;
  parts.push("---");
  for (const [k, v] of Object.entries(fm)) if (v) parts.push(`${k}: ${JSON.stringify(v)}`);
  parts.push("---\n");

  parts.push(`# ${title}`);
  if (s.objective) parts.push(`\n> **Objective.** ${esc(s.objective)}`);

  // Methodology
  parts.push(`\n## Methodology\n`);
  parts.push(`- **Method:** ${s.kind ?? "—"}`);
  parts.push(`- **Status:** ${s.status ?? "—"}`);
  parts.push(`- **Questions:** ${input.questions.length}`);
  parts.push(`- **Responses:** ${input.responses.length}`);
  parts.push(`- **Transcript turns:** ${input.transcript.length}`);

  // Questions
  if (input.questions.length > 0) {
    parts.push(`\n## Questions asked (${input.questions.length})\n`);
    input.questions.forEach((q, i) => {
      const n = (typeof q.ord === "number" ? q.ord : i) + 1;
      parts.push(`${n}. **[${q.kind ?? "open"}]** ${esc(q.prompt)}`);
      if (Array.isArray(q.options) && (q.options as unknown[]).length > 0) {
        parts.push(`   - Options: ${(q.options as unknown[]).map((o) => String(o)).join(" · ")}`);
      }
    });
  }

  // Synthesis
  if (input.report?.summary_md) {
    parts.push(`\n## Synthesis\n\n${esc(input.report.summary_md)}`);
  }

  // Themes
  const themes = Array.isArray(input.report?.themes) ? (input.report!.themes as Array<Record<string, unknown>>) : [];
  if (themes.length > 0) {
    parts.push(`\n## Themes (${themes.length})\n`);
    themes.forEach((t, i) => {
      const label = t.label ?? `Theme ${i + 1}`;
      const prev = typeof t.prevalence === "number" ? ` — ${Math.round((t.prevalence as number) * 100)}%` : "";
      parts.push(`- **${esc(label)}**${prev}`);
      if (t.quote) parts.push(`  > ${esc(t.quote as string).replace(/\n/g, "\n  > ")}`);
    });
  }

  // Recommendations
  const recs = Array.isArray(input.report?.recommendations) ? (input.report!.recommendations as Array<Record<string, unknown>>) : [];
  if (recs.length > 0) {
    parts.push(`\n## Recommendations (${recs.length})\n`);
    recs.forEach((r, i) => {
      parts.push(`### ${i + 1}. ${esc(r.move ?? "—")}`);
      if (r.why) parts.push(`\n${esc(r.why as string)}`);
      const meta: string[] = [];
      if (r.owner) meta.push(`Owner: ${esc(r.owner as string)}`);
      if (r.horizon) meta.push(`Horizon: ${esc(r.horizon as string)}`);
      if (meta.length) parts.push(`\n_${meta.join(" · ")}_`);
    });
  }

  // Transcript
  if (input.transcript.length > 0) {
    parts.push(`\n## Transcript (${input.transcript.length} turns)\n`);
    input.transcript.forEach((t) => {
      parts.push(`**${esc(t.speaker || "?")}**\n\n${esc(t.utterance)}\n`);
    });
  }

  // Responses grouped by question
  if (input.responses.length > 0) {
    const byQ = new Map<string, StudyExportInput["responses"]>();
    for (const r of input.responses) {
      const k = r.question_id ?? "_unassigned";
      const arr = byQ.get(k) ?? [];
      arr.push(r);
      byQ.set(k, arr);
    }
    parts.push(`\n## Responses (${input.responses.length})\n`);
    input.questions.forEach((q, i) => {
      const rows = byQ.get(q.id) ?? [];
      if (rows.length === 0) return;
      const n = (typeof q.ord === "number" ? q.ord : i) + 1;
      parts.push(`\n### Q${n}. ${esc(q.prompt)}\n`);
      rows.forEach((r) => {
        const who = `${r.personas?.name ?? "?"}${r.personas?.archetype ? ` · ${r.personas.archetype}` : ""}`;
        parts.push(`- **${esc(who)}**`);
        if (typeof r.answer === "string") {
          parts.push(`  ${esc(r.answer).replace(/\n/g, "\n  ")}`);
        } else if (r.answer !== undefined && r.answer !== null) {
          parts.push(`  ${fence(r.answer).replace(/\n/g, "\n  ")}`);
        }
        if (r.rationale) parts.push(`  _${esc(r.rationale).replace(/\n/g, " ")}_`);
      });
    });
    const unassigned = byQ.get("_unassigned") ?? [];
    if (unassigned.length > 0) {
      parts.push(`\n### Unassigned responses\n`);
      unassigned.forEach((r) => {
        const who = `${r.personas?.name ?? "?"}${r.personas?.archetype ? ` · ${r.personas.archetype}` : ""}`;
        parts.push(`- **${esc(who)}** ${typeof r.answer === "string" ? esc(r.answer) : fence(r.answer)}`);
      });
    }
  }

  const cites = toCitations(input.report?.citations);
  parts.push(sourcesBlock(cites));

  const date = new Date().toISOString().slice(0, 10);
  const filename = `${(s.country_code || "country").toLowerCase()}-${slug(title)}-${date}.md`;
  return { filename, body: parts.join("\n") };
}

// ── Program synthesis ────────────────────────────────────────────────────
type ProgramMethodology = {
  brief?: { title?: string | null; objectives?: string[]; raw_excerpt?: string | null };
  segments?: Array<{
    id: string;
    label?: string;
    prompt?: string | null;
    persona_count?: number;
    personas?: Array<{ id: string; name?: string | null; archetype?: string | null; summary?: string | null; ocean?: Record<string, number | undefined> | null }>;
    used_by_studies?: Array<{ id: string; title?: string; kind?: string }>;
  }>;
  studies?: Array<{
    id: string;
    title?: string;
    kind?: string;
    objective?: string | null;
    segment_label?: string | null;
    persona_count?: number;
    questions?: Array<{ ord: number; prompt: string; kind: string; options?: unknown }>;
  }>;
};

export type ProgramExportInput = {
  countryCode: string;
  projectId?: string;
  report: {
    summary_md?: string | null;
    citations?: unknown;
    sections?: {
      portfolio_scope?: { studies_run?: number; brief_link?: string };
      design_rationale?: { why_segments?: string; why_methods?: string; coverage_gaps?: string };
      recommendations?: Array<{ move?: string; why?: string; owner?: string; horizon?: string }>;
      unanswered?: string[];
      methodology?: ProgramMethodology;
    };
    created_at?: string | null;
  };
  studyReports?: StudyExportInput[];
};


export function programReportToMarkdown(input: ProgramExportInput): { filename: string; body: string } {
  const sections = input.report.sections ?? {};
  const meth = sections.methodology ?? {};
  const parts: string[] = [];

  parts.push("---");
  parts.push(`title: "Program synthesis — ${input.countryCode}"`);
  parts.push(`country: "${input.countryCode}"`);
  if (input.projectId) parts.push(`project: "${input.projectId}"`);
  if (sections.portfolio_scope?.studies_run) parts.push(`studies_consolidated: ${sections.portfolio_scope.studies_run}`);
  if (input.report.created_at) parts.push(`generated_at: "${input.report.created_at}"`);
  parts.push("---\n");

  parts.push(`# Program synthesis — ${input.countryCode}`);

  if (sections.portfolio_scope) {
    parts.push(`\n## Portfolio scope\n`);
    parts.push(`- **Studies consolidated:** ${sections.portfolio_scope.studies_run ?? 0}`);
    if (sections.portfolio_scope.brief_link) parts.push(`- **Brief link:** ${esc(sections.portfolio_scope.brief_link)}`);
  }

  if (meth.brief) {
    parts.push(`\n## Original brief\n`);
    if (meth.brief.title) parts.push(`**${esc(meth.brief.title)}**\n`);
    if (Array.isArray(meth.brief.objectives) && meth.brief.objectives.length > 0) {
      parts.push(`Objectives:`);
      meth.brief.objectives.forEach((o) => parts.push(`- ${esc(o)}`));
    }
    if (meth.brief.raw_excerpt) parts.push(`\n> ${esc(meth.brief.raw_excerpt).replace(/\n/g, "\n> ")}`);
  }

  if (input.report.summary_md) {
    parts.push(`\n## Consolidated summary\n\n${esc(input.report.summary_md)}`);
  }

  // Methodology — Cast
  const segs = meth.segments ?? [];
  if (segs.length > 0) {
    const totalPersonas = segs.reduce((n, s) => n + (s.personas?.length ?? 0), 0);
    parts.push(`\n## Cast — ${totalPersonas} personas across ${segs.length} segments\n`);
    segs.forEach((s) => {
      parts.push(`\n### ${esc(s.label)} (${s.personas?.length ?? 0} personas)`);
      (s.personas ?? []).forEach((p) => {
        parts.push(`- **${esc(p.name)}** — ${esc(p.archetype ?? "—")}`);
        if (p.summary) parts.push(`  ${esc(p.summary).replace(/\n/g, "\n  ")}`);
        if (p.ocean) {
          const chips = Object.entries(p.ocean)
            .filter(([, v]) => typeof v === "number")
            .map(([k, v]) => `${k[0].toUpperCase()}·${Math.round((v as number) * 100) / 100}`)
            .join(" · ");
          if (chips) parts.push(`  \`${chips}\``);
        }
      });
      if (!s.personas || s.personas.length === 0) parts.push(`- _(no personas cast)_`);
    });
  }

  // Methodology — Groups
  if (segs.length > 0) {
    parts.push(`\n## Groups — ${segs.length} segments\n`);
    segs.forEach((s) => {
      parts.push(`\n### ${esc(s.label)}`);
      parts.push(`${esc(s.prompt ?? "(no descriptor)")}`);
      const chips: string[] = [`${s.personas?.length ?? 0} personas`];
      (s.used_by_studies ?? []).forEach((st) => chips.push(`${st.kind} · ${st.title}`));
      parts.push(`\n_${chips.join(" · ")}_`);
    });
  }

  // Methodology — Instruments
  const studies = meth.studies ?? [];
  if (studies.length > 0) {
    const totalQ = studies.reduce((n, s) => n + (s.questions?.length ?? 0), 0);
    parts.push(`\n## Instruments — ${studies.length} studies · ${totalQ} questions\n`);
    studies.forEach((s) => {
      parts.push(`\n### [${s.kind ?? "study"}] ${esc(s.title)}`);
      parts.push(`_${esc(s.segment_label ?? "—")} · ${s.persona_count ?? 0} personas · ${s.questions?.length ?? 0} questions_`);
      if (s.objective) parts.push(`\n> ${esc(s.objective)}`);
      (s.questions ?? []).forEach((q) => {
        parts.push(`${q.ord + 1}. **[${q.kind}]** ${esc(q.prompt)}`);
        if (Array.isArray(q.options) && (q.options as unknown[]).length > 0) {
          parts.push(`   - Options: ${(q.options as unknown[]).map((o) => String(o)).join(" · ")}`);
        }
      });
      if (!s.questions || s.questions.length === 0) parts.push(`_(no questions recorded)_`);
    });
  }

  if (sections.design_rationale) {
    parts.push(`\n## Design rationale\n`);
    if (sections.design_rationale.why_segments) parts.push(`- **Segments:** ${esc(sections.design_rationale.why_segments)}`);
    if (sections.design_rationale.why_methods) parts.push(`- **Methods:** ${esc(sections.design_rationale.why_methods)}`);
    if (sections.design_rationale.coverage_gaps) parts.push(`- **Gaps:** ${esc(sections.design_rationale.coverage_gaps)}`);
  }

  const recs = sections.recommendations ?? [];
  if (recs.length > 0) {
    parts.push(`\n## Sovereign recommendations (${recs.length})\n`);
    recs.forEach((r, i) => {
      parts.push(`### ${i + 1}. ${esc(r.move ?? "—")}`);
      if (r.why) parts.push(`\n${esc(r.why)}`);
      const meta: string[] = [];
      if (r.owner) meta.push(`Owner: ${esc(r.owner)}`);
      if (r.horizon) meta.push(`Horizon: ${esc(r.horizon)}`);
      if (meta.length) parts.push(`\n_${meta.join(" · ")}_`);
    });
  }

  const unans = sections.unanswered ?? [];
  if (unans.length > 0) {
    parts.push(`\n## Unanswered (${unans.length})\n`);
    unans.forEach((u) => parts.push(`- ${esc(u)}`));
  }

  const studyReports = input.studyReports ?? [];
  if (studyReports.length > 0) {
    parts.push(`\n\n---\n\n# Per-study reports (${studyReports.length})\n`);
    studyReports.forEach((sr, i) => {
      const { body } = studyReportToMarkdown(sr);
      // Strip the leading YAML frontmatter from each embedded study.
      const stripped = body.replace(/^---[\s\S]*?---\n+/, "");
      parts.push(`\n\n---\n\n## Study ${i + 1} of ${studyReports.length}\n\n${stripped}`);
    });
  }

  parts.push(sourcesBlock(toCitations(input.report.citations)));

  const date = new Date().toISOString().slice(0, 10);
  const filename = `${input.countryCode.toLowerCase()}-program-synthesis-${date}.md`;
  return { filename, body: parts.join("\n") };
}


// ── Browser download helper ──────────────────────────────────────────────
export function downloadMarkdown(filename: string, body: string): void {
  const blob = new Blob([body], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
