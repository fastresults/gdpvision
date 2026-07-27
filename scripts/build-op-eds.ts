// Generates src/lib/op-eds/content.ts from content/op-eds/*.md.
//
// The markdown files are the source of truth for all op-ed page copy. Never
// hand-edit the generated module: change the markdown and run
//   bun run scripts/build-op-eds.ts
//
// Source strings are copied character-for-character (PRD §14 forbids
// paraphrasing a citation).

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const CONTENT_DIR = join(process.cwd(), "content", "op-eds");
const OUT = join(process.cwd(), "src", "lib", "op-eds", "content.ts");
const SITE_URL = "https://gdpvision.com";

type Front = Record<string, string | string[]>;

function parseFrontmatter(raw: string): { front: Front; body: string } {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) throw new Error("missing frontmatter");
  const front: Front = {};
  let key: string | null = null;
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim()) continue;
    const item = line.match(/^\s+-\s+(.*)$/);
    if (item && key) {
      const arr = (front[key] ??= []) as string[];
      arr.push(unquote(item[1]));
      continue;
    }
    const kv = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!kv) continue;
    key = kv[1];
    if (kv[2].trim() === "") front[key] = [];
    else front[key] = unquote(kv[2]);
  }
  return { front, body: m[2] };
}

function unquote(v: string): string {
  const t = v.trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    return t.slice(1, -1).replace(/\\"/g, '"');
  }
  return t;
}

/** Paragraphs before the first `##` heading, capped at three. */
function excerpt(body: string): string[] {
  const head = body.split(/\r?\n##\s/)[0];
  return head
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim().replace(/\s*\r?\n\s*/g, " "))
    .filter((p) => p && !p.startsWith("#") && !p.startsWith("!["))
    .slice(0, 3);
}

const q = (s: string) => JSON.stringify(s);

const files = readdirSync(CONTENT_DIR)
  .filter((f) => /^\d\d-.*\.md$/.test(f))
  .sort();

const entries = files.map((file) => {
  const nn = file.slice(0, 2);
  const slug = file.replace(/^\d\d-/, "").replace(/\.md$/, "");
  const { front, body } = parseFrontmatter(readFileSync(join(CONTENT_DIR, file), "utf8"));
  const str = (k: string) => (typeof front[k] === "string" ? (front[k] as string) : "");
  const sources = (Array.isArray(front.sources) ? front.sources : []) as string[];
  const paras = excerpt(body);
  const caption = str("figure_caption");

  return `  {
    slug: ${q(slug)},
    chamber: ${q(str("chamber") || nn)},
    chamberName: ${q(str("chamber_name"))},
    accent: ${q(str("accent"))},
    status: ${paras.length > 0 && sources.length > 0 ? '"published"' : '"draft"'},
    title: ${q(str("title"))},
    standfirst: ${q(str("standfirst"))},
    promise: "One argument, twelve minutes, every figure sourced.",
    excerpt: [
${paras.map((p) => `      ${q(p)},`).join("\n")}
    ],
    emblem: ${q(`/op-eds/art/${nn}-emblem.svg`)},
    ogImage: ${q(`${SITE_URL}/op-eds/art/${nn}-emblem.png`)},
${caption ? `    figure: { caption: ${q(caption)}, image: ${q(`/op-eds/art/${nn}-figure.svg`)} },\n` : ""}    sources: [
${sources.map((s) => `      ${q(s)},`).join("\n")}
    ],
    pdfKey: ${q(`GDPVision-${nn}-${slug}.pdf`)},
  },`;
});

const out = `// @domain marketing
// @tables op_ed_requests, op_ed_events
// @ui src/routes/op-eds.index.tsx, src/routes/op-eds.$slug.tsx
//
// GENERATED FILE — do not edit by hand.
// Source of truth: content/op-eds/*.md
// Regenerate with:  bun run scripts/build-op-eds.ts
//
// An entry is "published" only when it carries real prose and a real source
// list. Sources are transcribed character-for-character from the manuscript.

export interface OpEd {
  slug: string;
  /** Chamber index this argument bridges into, e.g. "04". */
  chamber: string;
  chamberName: string;
  /** Hex accent from the chamber's --sector-* token, as authored. */
  accent: string;
  status: "draft" | "published";
  title: string;
  standfirst: string;
  promise: string;
  /** The paragraphs before the first heading, ungated. */
  excerpt: string[];
  /** Engraved plate — its citation and grade are drawn into the artwork. */
  figure?: { caption: string; image: string };
  /** Visible before the gate — the evidence is never withheld. */
  sources: string[];
  /** Engraved emblem, rendered through <Illustration>. */
  emblem: string;
  /** Absolute https URL used for og:image / twitter:image. */
  ogImage: string;
  /** Object key inside the private \`op-eds\` storage bucket. */
  pdfKey: string;
}

export const OP_EDS: OpEd[] = [
${entries.join("\n")}
];

/** An op-ed is reachable only when it is published and carries real prose. */
export function isReadable(op: OpEd): boolean {
  return op.status === "published" && op.excerpt.length > 0;
}

export const PUBLISHED_OP_EDS = OP_EDS.filter(isReadable);

export function opEdBySlug(slug: string): OpEd | undefined {
  return OP_EDS.find((o) => o.slug === slug);
}

export const OP_ED_AUTHOR = {
  name: "Adam Anderson",
  note: "Adam Anderson is the founder of OPEN Interactive and the author of the GDPVision instrument. He writes for principals, not for procurement.",
};
`;

writeFileSync(OUT, out);
console.log(`wrote ${OUT} — ${entries.length} entries`);
