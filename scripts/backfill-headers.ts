#!/usr/bin/env bun
/**
 * scripts/backfill-headers.ts — inserts a `@domain / @tables / @ui` header
 * docblock at the top of every `src/lib/**\/*.functions.ts(x)` that is missing
 * one. Idempotent: files that already start with a `// @domain` line are left
 * alone. Values are derived mechanically:
 *
 *   @domain  = the folder segment under `src/lib/` (e.g. `country-onboarding`),
 *              or `core` for files that live directly under `src/lib/`.
 *   @tables  = distinct `.from("<table>")` / `.from('<table>')` string
 *              arguments found in the file, sorted, comma-joined. `—` when
 *              none are found.
 *   @ui      = up to 3 client callers (files under `src/routes/` or
 *              `src/components/` or `src/hooks/`) that import from this
 *              module, using project-relative paths joined with `; `. `—`
 *              when nothing imports it.
 *
 * Run: `bun scripts/backfill-headers.ts` (or `bun run headers`).
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, dirname, resolve } from "node:path";

const ROOT = process.cwd();

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

const rel = (p: string) => relative(ROOT, p).replaceAll("\\", "/");

/* Collect all fn modules */
const fnFiles = walk(join(ROOT, "src/lib"))
  .filter((f) => f.endsWith(".functions.ts") || f.endsWith(".functions.tsx"))
  .sort();

/* Build reverse-import index from routes/components/hooks */
const clientRoots = ["src/routes", "src/components", "src/hooks"].map((p) =>
  join(ROOT, p),
);
const clientFiles: string[] = [];
for (const r of clientRoots) {
  try {
    clientFiles.push(
      ...walk(r).filter((f) => /\.(tsx?|ts)$/.test(f) && !f.endsWith(".d.ts")),
    );
  } catch {
    /* dir might not exist */
  }
}

const importersByModule = new Map<string, Set<string>>();
const importRe = /from\s+["']([^"']+)["']/g;

function resolveImport(fromFile: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = join(ROOT, "src", spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(fromFile), spec);
  else return null;
  for (const ext of [".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    const candidate = base + ext;
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      /* skip */
    }
  }
  try {
    if (statSync(base).isFile()) return base;
  } catch {
    /* skip */
  }
  return null;
}

for (const cf of clientFiles) {
  const src = readFileSync(cf, "utf8");
  for (const m of src.matchAll(importRe)) {
    const resolved = resolveImport(cf, m[1]);
    if (!resolved) continue;
    if (!resolved.includes(".functions.")) continue;
    (importersByModule.get(resolved) ?? importersByModule.set(resolved, new Set()).get(resolved)!).add(rel(cf));
  }
}

/* Derive header per module */
const tableRe = /\.from\(\s*["']([a-z0-9_]+)["']\s*\)/gi;
let changed = 0;

for (const f of fnFiles) {
  const src = readFileSync(f, "utf8");
  if (/^\s*\/\/\s*@domain\b/m.test(src.slice(0, 400))) continue;

  const relPath = rel(f);
  const parts = relPath.split("/"); // src, lib, [domain?], file
  const domain = parts.length > 3 ? parts[2] : "core";

  const tables = Array.from(new Set(Array.from(src.matchAll(tableRe)).map((m) => m[1]))).sort();
  const uiSet = importersByModule.get(f);
  const ui = uiSet ? Array.from(uiSet).sort().slice(0, 3) : [];

  const header =
    `// @domain ${domain}\n` +
    `// @tables ${tables.length ? tables.join(",") : "—"}\n` +
    `// @ui ${ui.length ? ui.join("; ") : "—"}\n\n`;

  writeFileSync(f, header + src);
  changed += 1;
  console.log(`[backfill-headers] wrote ${relPath}`);
}

console.log(`[backfill-headers] done — ${changed} file(s) updated.`);
