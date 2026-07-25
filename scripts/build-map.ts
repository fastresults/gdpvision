#!/usr/bin/env bun
/**
 * scripts/build-map.ts — regenerates docs/map/{server-fns,routes,tables}.md
 * from the source tree. Deterministic; run `bun run map`.
 *
 * - server-fns.md: every `src/lib/**\/*.functions.ts` with exported server fns,
 *   header docblock (@domain/@tables/@ui) when present, and one-line purpose.
 * - routes.md: every file under `src/routes/`, its `createFileRoute` path,
 *   grouped by persona (marketing, auth, admin, console, instrument, narrative, api).
 * - tables.md: every `CREATE TABLE public.<name>` across supabase/migrations
 *   with the first migration that defined it and whether GRANTs appear in the
 *   same migration.
 *
 * Pass `--check` to fail (exit 1) when regenerating would change the files.
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const CHECK = process.argv.includes("--check");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function rel(p: string) {
  return relative(ROOT, p).replaceAll("\\", "/");
}

function parseHeaderTags(src: string): {
  domain?: string;
  tables?: string;
  ui?: string;
} {
  const head = src.slice(0, 800);
  const grab = (tag: string) => {
    const m = head.match(new RegExp(`//\\s*@${tag}\\s+(.+)`));
    return m?.[1].trim();
  };
  return { domain: grab("domain"), tables: grab("tables"), ui: grab("ui") };
}

/* -------- server-fns.md -------- */

function buildServerFns(): string {
  const files = walk(join(ROOT, "src/lib"))
    .filter((f) => f.endsWith(".functions.ts") || f.endsWith(".functions.tsx"))
    .sort();

  const lines: string[] = [
    "# Server functions map (generated)",
    "",
    "Regenerate with `bun run map`. Do not hand-edit.",
    "",
    "Each row is one `*.functions.ts` module. Header tags (`@domain`, `@tables`, `@ui`)",
    "are lifted from the top-of-file docblock — add them to any module missing them.",
    "",
    "| Module | Exports | @domain | @tables | @ui |",
    "|--------|---------|---------|---------|-----|",
  ];

  for (const f of files) {
    const src = readFileSync(f, "utf8");
    const exports = Array.from(
      src.matchAll(
        /export\s+const\s+([A-Za-z0-9_]+)\s*=\s*createServerFn/g,
      ),
    ).map((m) => m[1]);
    if (exports.length === 0) {
      // still list — could be a shared helper file that mostly re-exports
    }
    const { domain, tables, ui } = parseHeaderTags(src);
    const exportsCell = exports.length ? exports.join(", ") : "_(no createServerFn exports)_";
    lines.push(
      `| \`${rel(f)}\` | ${exportsCell} | ${domain ?? "—"} | ${tables ?? "—"} | ${ui ?? "—"} |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

/* -------- routes.md -------- */

function personaOf(path: string): string {
  if (path.startsWith("src/routes/api/")) return "api";
  if (path.includes("_authenticated/admin/")) return "admin";
  if (path.includes("_authenticated/console")) return "console";
  if (path.includes("_authenticated/instrument")) return "instrument";
  if (path.includes("_authenticated/narrative")) return "narrative";
  if (path.includes("_authenticated/")) return "authenticated";
  if (path.startsWith("src/routes/auth")) return "auth";
  if (path.startsWith("src/routes/kiosk")) return "kiosk";
  return "public";
}

function buildRoutes(): string {
  const files = walk(join(ROOT, "src/routes"))
    .filter((f) => /\.(tsx?|ts)$/.test(f))
    .filter((f) => !f.endsWith("routeTree.gen.ts"))
    .sort();

  const groups: Record<string, Array<{ file: string; route: string }>> = {};

  for (const f of files) {
    const src = readFileSync(f, "utf8");
    const m = src.match(/createFileRoute\(\s*["']([^"']+)["']\s*\)/);
    if (!m) continue;
    const persona = personaOf(rel(f));
    (groups[persona] ??= []).push({ file: rel(f), route: m[1] });
  }

  const order = [
    "public",
    "auth",
    "authenticated",
    "console",
    "admin",
    "instrument",
    "narrative",
    "kiosk",
    "api",
  ];
  const lines: string[] = [
    "# Routes map (generated)",
    "",
    "Regenerate with `bun run map`. Do not hand-edit.",
    "",
  ];
  for (const persona of order) {
    const rows = groups[persona];
    if (!rows?.length) continue;
    lines.push(`## ${persona}`, "");
    lines.push("| Route | File |", "|-------|------|");
    for (const r of rows.sort((a, b) => a.route.localeCompare(b.route))) {
      lines.push(`| \`${r.route}\` | \`${r.file}\` |`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

/* -------- tables.md -------- */

function buildTables(): string {
  const migDir = join(ROOT, "supabase/migrations");
  const migs = readdirSync(migDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  type Row = { table: string; migration: string; hasGrant: boolean; hasRls: boolean };
  const seen = new Map<string, Row>();

  for (const m of migs) {
    const src = readFileSync(join(migDir, m), "utf8");
    const createRe = /create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z0-9_]+)/gi;
    for (const match of src.matchAll(createRe)) {
      const table = match[1];
      if (seen.has(table)) continue;
      const scope = src; // grants may live anywhere in the same file
      const hasGrant = new RegExp(`grant\\s+[^;]+on\\s+public\\.${table}\\b`, "i").test(scope);
      const hasRls = new RegExp(
        `alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`,
        "i",
      ).test(scope);
      seen.set(table, { table, migration: m, hasGrant, hasRls });
    }
  }

  const rows = [...seen.values()].sort((a, b) => a.table.localeCompare(b.table));

  const lines: string[] = [
    "# Tables map (generated)",
    "",
    "Regenerate with `bun run map`. Do not hand-edit.",
    "",
    "Rows are `CREATE TABLE public.*` in the first migration that defined them.",
    "`grant?` / `rls?` reflect only the same migration — later migrations may add either.",
    "",
    "| Table | First migration | grant? | rls? |",
    "|-------|-----------------|--------|------|",
  ];
  for (const r of rows) {
    lines.push(
      `| \`${r.table}\` | \`${r.migration}\` | ${r.hasGrant ? "✓" : "—"} | ${r.hasRls ? "✓" : "—"} |`,
    );
  }
  lines.push("", `_Total tables: ${rows.length}_`, "");
  return lines.join("\n");
}

/* -------- main -------- */

const outputs: Array<{ path: string; content: string }> = [
  { path: "docs/map/server-fns.md", content: buildServerFns() },
  { path: "docs/map/routes.md", content: buildRoutes() },
  { path: "docs/map/tables.md", content: buildTables() },
];

let changed = false;
for (const { path, content } of outputs) {
  const full = join(ROOT, path);
  let existing = "";
  try {
    existing = readFileSync(full, "utf8");
  } catch {
    /* new file */
  }
  if (existing !== content) {
    changed = true;
    if (CHECK) {
      console.error(`[build-map] out of date: ${path}`);
    } else {
      writeFileSync(full, content);
      console.log(`[build-map] wrote ${path}`);
    }
  }
}

if (CHECK && changed) {
  console.error("[build-map] run `bun run map` to regenerate.");
  process.exit(1);
}
if (!CHECK && !changed) console.log("[build-map] no changes.");
