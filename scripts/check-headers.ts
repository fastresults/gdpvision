#!/usr/bin/env bun
/**
 * scripts/check-headers.ts — drift guard for AI-navigation headers.
 *
 * Fails (exit 1) if any `src/lib/**​/*.functions.ts(x)` file is missing a
 * `@domain`, `@tables`, or `@ui` tag in its top-of-file docblock. Run
 * `bun run headers` to auto-backfill, then commit.
 *
 * Wired into `bun run check:maps` alongside `build-map --check`.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

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

const files = walk(join(ROOT, "src/lib"))
  .filter((f) => f.endsWith(".functions.ts") || f.endsWith(".functions.tsx"))
  .sort();

const REQUIRED = ["domain", "tables", "ui"] as const;
const missing: Array<{ file: string; tags: string[] }> = [];

for (const f of files) {
  const head = readFileSync(f, "utf8").slice(0, 1200);
  const gaps = REQUIRED.filter((tag) => !new RegExp(`//\\s*@${tag}\\s+\\S`).test(head));
  if (gaps.length) missing.push({ file: relative(ROOT, f), tags: gaps });
}

if (missing.length) {
  console.error(`[check-headers] ${missing.length} module(s) missing header tags:`);
  for (const m of missing) console.error(`  - ${m.file}  (missing: ${m.tags.join(", ")})`);
  console.error("\nRun `bun run headers` to backfill, then commit the changes.");
  process.exit(1);
}

console.log(`[check-headers] all ${files.length} server-fn modules tagged.`);
