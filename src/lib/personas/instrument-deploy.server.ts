// Chamber 07 · Instrument deployment — server-only builders.
//
// An instrument is only useful when it can leave the building. The same
// questions must be answerable on a hosted link, on a printed sheet in a
// village hall, or in whatever survey tool an agency already licenses — and
// every route back must be machine-mappable. These builders emit those
// artefacts from the single instrument of record, stamped with its version so
// returns can never be silently filed against the wrong draft.

import type { FieldQuestion } from "./instrument-draft.server";

export interface DeployPack {
  filename: string;
  mime: string;
  body: string;
}

function csvCell(v: string) {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function optionText(q: FieldQuestion) {
  if (q.type === "scale") {
    return `${q.scale_min ?? 1}–${q.scale_max ?? 5}${
      q.scale_min_label ? ` (${q.scale_min_label} → ${q.scale_max_label ?? ""})` : ""
    }`;
  }
  return q.options?.length ? q.options.join(" | ") : "";
}

/** A blank return sheet: one column per question, headed by the question id. */
export function buildCsvTemplate(
  title: string,
  version: number,
  questions: FieldQuestion[],
): DeployPack {
  const header = ["participant_code", ...questions.map((q) => q.id)];
  const legend = ["(leave blank to auto-number)", ...questions.map((q) => q.prompt)];
  const hints = ["", ...questions.map(optionText)];
  const body = [header, legend, hints].map((r) => r.map(csvCell).join(",")).join("\n");
  return {
    filename: `${slug(title)}-v${version}-template.csv`,
    mime: "text/csv",
    body: `${body}\n`,
  };
}

/** The instrument as data, for teams wiring it into their own tooling. */
export function buildJsonSchema(
  title: string,
  version: number,
  kind: string,
  questions: FieldQuestion[],
): DeployPack {
  return {
    filename: `${slug(title)}-v${version}.json`,
    mime: "application/json",
    body: JSON.stringify({ title, version, kind, questions }, null, 2),
  };
}

/** A printable paper form whose answer boxes carry the machine ids. */
export function buildPrintableForm(
  title: string,
  version: number,
  intro: string | null,
  outro: string | null,
  questions: FieldQuestion[],
): DeployPack {
  const items = questions
    .map((q, i) => {
      const opts =
        q.type === "single_choice" || q.type === "multi_choice"
          ? `<ul class="opts">${(q.options ?? [])
              .map((o) => `<li><span class="box"></span>${esc(o)}</li>`)
              .join("")}</ul>`
          : q.type === "scale"
            ? `<p class="scale">${range(q.scale_min ?? 1, q.scale_max ?? 5)
                .map((n) => `<span class="box"></span>${n}`)
                .join(" ")} <em>${esc(q.scale_min_label ?? "")} → ${esc(q.scale_max_label ?? "")}</em></p>`
            : `<div class="lines"></div>`;
      return `<li><p class="q"><span class="id">${esc(q.id)}</span> ${i + 1}. ${esc(q.prompt)}</p>${
        q.help ? `<p class="help">${esc(q.help)}</p>` : ""
      }${opts}</li>`;
    })
    .join("");

  const body = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  @page { margin: 18mm; }
  body { font: 12pt/1.5 Georgia, serif; color:#111; }
  h1 { font-size: 18pt; margin: 0 0 4pt; }
  .meta { font: 9pt ui-monospace, monospace; letter-spacing:.12em; text-transform:uppercase; color:#555; }
  .intro { margin: 12pt 0; }
  ol { padding-left: 0; list-style: none; }
  li { margin: 0 0 14pt; break-inside: avoid; }
  .q { margin: 0; }
  .id { font: 8pt ui-monospace, monospace; color:#777; border:1px solid #ccc; padding:0 3pt; margin-right:4pt; }
  .help { font-size: 10pt; color:#555; margin: 2pt 0 0; }
  .opts { list-style:none; padding-left: 10pt; margin: 4pt 0 0; }
  .box { display:inline-block; width:11pt; height:11pt; border:1px solid #333; margin-right:6pt; vertical-align:-1pt; }
  .lines { border-bottom:1px solid #999; height:16pt; margin-top:6pt; }
  .lines::after { content:""; display:block; border-bottom:1px solid #999; margin-top:16pt; }
  .scale em { font-size:9pt; color:#555; }
  footer { margin-top: 18pt; font-size: 10pt; color:#444; }
</style></head><body>
<h1>${esc(title)}</h1>
<p class="meta">Version ${version} · participant code ____________ · date __________</p>
${intro ? `<div class="intro">${esc(intro)}</div>` : ""}
<ol>${items}</ol>
${outro ? `<footer>${esc(outro)}</footer>` : ""}
<footer class="meta">Return this sheet to the programme office. Codes in grey are for filing only.</footer>
</body></html>`;

  return { filename: `${slug(title)}-v${version}-form.html`, mime: "text/html", body };
}

function range(a: number, b: number) {
  const out: number[] = [];
  for (let i = a; i <= b && out.length < 12; i += 1) out.push(i);
  return out;
}

function esc(s: string) {
  return s.replace(
    /[&<>"]/g,
    (c) => (({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }) as Record<string, string>)[c] ?? c,
  );
}

export function slug(s: string) {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "instrument"
  );
}
