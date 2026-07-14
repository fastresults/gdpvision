## Goal

Turn `/admin/ledger-qa` from a passive dashboard into a **self-healing loop**: any non-green row auto-runs a forensic diagnosis, proposes a systemic fix (not a one-off patch), and — where safe — applies it. Everything is logged so operators see what was diagnosed, what was changed, and why.

## The loop (one contract, applied to every check)

```text
CHECK  →  if not PASS  →  DIAGNOSE  →  CLASSIFY  →  REMEDIATE  →  RE-VERIFY  →  LOG
                                          │
                                          ├─ data-missing      → operator action (seed / run stage)
                                          ├─ data-quality      → auto-repair migration + upstream writer patch
                                          ├─ code-defect       → surface stack + file, block auto-fix
                                          └─ external-outage   → retry w/ backoff, mark transient
```

Every check gets a `diagnose()` companion that returns a **structured `Finding`**, not a string. The UI renders the finding; a "Fix systemically" button runs the `remediate()` when one exists.

## What to build

### 1. Shared types & registry (`src/lib/ledger-qa/types.ts`)

```ts
type Finding = {
  checkKey: string;
  severity: "warn" | "fail";
  rootCause: string;              // one sentence
  class: "data-missing" | "data-quality" | "code-defect" | "external-outage" | "config";
  evidence: Array<{ label: string; value: string | number; sql?: string }>;
  affectedRows?: number;
  systemicFix: {
    kind: "operator-action" | "auto-migration" | "writer-patch" | "retry" | "none";
    description: string;          // what will change and why it's systemic, not a patch
    previewSql?: string;          // for auto-migration
    upstreamFile?: string;        // for writer-patch (path + line)
    canAutoApply: boolean;        // false ⇒ requires operator confirm
  };
};
```

A single `CHECK_REGISTRY` maps `checkKey → { run, diagnose, remediate? }`. Adding a new check = adding one registry entry; the loop is generic.

### 2. Forensic diagnosers (one per non-green class we've already seen)

Written as **server functions** in `src/lib/ledger-qa/diagnose.functions.ts`. Each does read-only DB introspection and returns a `Finding`.

- `diagnoseSankey(cc)` — counts `country_capital_flows` rows, distinguishes "0 rows committed" (data-missing → run Stage 12) from "committed but residual > 10%" (data-quality → identify offending node).
- `diagnoseFreshness(cc)` — counts `country_kpi_points` per KPI; if 0, data-missing; if stale > 24 months, data-quality per series.
- `diagnoseSourceHealth(cc)` — splits failures into `invalid_url` (regex fail on `^https?://`) vs `unreachable` (HEAD 4xx/5xx) vs `timeout`. Attributes invalid URLs to the writer (`kpi-research.server.ts` / onboarding stage) that persisted them.
- `diagnosePublishGate(cc)` — cascades: lists which upstream checks are blocking, deduplicates root causes.
- Manual checks (`explainFigure`, `askLedger` × 2, `snapshot`, `handoff`) — diagnose = "not-run"; systemicFix = operator-action ("click Run").

### 3. Systemic remediators (`src/lib/ledger-qa/remediate.functions.ts`)

Only for **data-quality** classes where a repair is safe & reversible.

- `repairInvalidSourceUrls(cc)` — one idempotent migration-style function: for every `country_sources` row where `url !~ '^https?://'`, set `active=false`, `fetch_status='invalid_url'`, write the offending string to `country_sources.notes` for audit. Returns `{ rowsFixed, sampleBefore }`. Requires super-admin.
- `patchSourceWriter()` — NOT auto-applied. Emits a `Finding` with `upstreamFile: "src/lib/country-onboarding/kpi-research.server.ts:LNN"` and a suggested guard (`if (!/^https?:\/\//.test(url)) skip + log`). Operator opens the file; we don't self-edit code from a check.
- `retryUnreachableSources(cc)` — re-runs the source-health hook with backoff for `unreachable` rows only; skips `invalid_url`.

Everything a remediator does is written to a new audit table `ledger_qa_actions` (checkKey, class, action, rows_before, rows_after, actor, ts) so the loop is auditable.

### 4. UI: forensic drawer + systemic-fix action (`src/routes/_authenticated/admin/ledger-qa.tsx`)

For every row where `verdict.status !== "pass"`:

- Row expands to show the `Finding`: rootCause line, evidence table, class badge.
- One button per fix kind:
  - `operator-action` → deep-link to the page/stage that unblocks it (Stage 12, KPI ingest, Run button on the same page).
  - `auto-migration` → "Apply repair" (super-admin only) → runs remediator → auto re-runs the check → shows before/after counts.
  - `writer-patch` → "Open upstream writer" → deep-link to the file/line in the code panel; explains the guard to add.
  - `retry` → "Retry now" button; disables during in-flight.
- After any remediation the check re-runs and the row must go green, or a new `Finding` is shown (never a silent success).

### 5. Continuous loop (optional, off by default)

Add a `runAllDiagnoses(cc)` server function + a "Diagnose all non-green" button at the top of the QA page. Later, wire it to the existing `/api/public/hooks/source-health` cron so nightly runs write findings to `ledger_qa_actions` and the page shows a "last swept" timestamp. No auto-remediation from cron — cron only diagnoses.

## Guardrails

- **Never auto-fix code.** Code-defect findings surface file/line; humans edit.
- **Every auto-migration is idempotent and reversible** (writes to `notes`, sets flags — no deletes).
- **Super-admin gate** on every remediator (`assertSuperAdmin` — same pattern as `/admin/*`).
- **One audit row per action** in `ledger_qa_actions`; UI shows the last 10 for the country.
- **No new checks in this plan** — this is the framework. Existing 11 checks get diagnosers + (where applicable) remediators.

## Deliverables (in order)

1. `supabase/migrations/*_ledger_qa_actions.sql` — audit table + grants + RLS (super-admin only).
2. `src/lib/ledger-qa/types.ts` — `Finding`, registry types.
3. `src/lib/ledger-qa/diagnose.functions.ts` — one diagnoser per existing check.
4. `src/lib/ledger-qa/remediate.functions.ts` — `repairInvalidSourceUrls`, `retryUnreachableSources`; stubs for the rest returning `kind:"none"`.
5. `src/routes/_authenticated/admin/ledger-qa.tsx` — expandable rows, forensic drawer, per-class action buttons, "Diagnose all" header button, recent-actions strip.

## Verification

- Reload `/admin/ledger-qa` for LCA. Every non-green row now has an expandable Finding with class + evidence.
- Click "Apply repair" on Source health → `36/40` invalid URLs get flagged inactive → check re-runs → row shows `PASS 4/4 reachable` and a link "36 rows quarantined — see audit".
- Click "Open upstream writer" → routes to the file/line writing bad URLs.
- Sankey / Freshness rows show operator-action deep-links (no auto-fix) because the root cause is missing seed data.

## Out of scope

- Actually editing the upstream writer code (surfaced, not auto-patched).
- Cron-driven auto-remediation (framework supports it; wiring deferred).
- New QA checks beyond the current 11.
