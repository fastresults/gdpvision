
## What I confirmed

- The server function ran fine: three "test" projects for GRD were inserted at 01:33, 01:41, and 01:45 UTC (matching the reported failed attempt).
- Manually loading `/admin/countries/GRD/personas/studies?project=<id>` in preview renders the Studies page correctly — the target route exists and accepts the search shape.
- Reproducing the flow via a scripted click in preview also succeeded (URL and page both landed on Studies).
- The user's 404 (session replay + "Go home" click) means the router matched the **root** `notFoundComponent` — i.e. the URL that was pushed did not match any route, so the failure is in the `navigate({...})` call inside `ProgramsIndex`, not in the destination route.

## Diagnosis (unconfirmed, high confidence)

`ProgramsIndex.onSuccess` fires:

```ts
navigate({
  to: "/admin/countries/$code/personas/studies",
  params: { code },
  search: { project: row?.id },
});
```

Three fragile things happen at the same time:

1. `qc.invalidateQueries` refetches `persona-projects`, unmounting the empty-state form and re-rendering the row list — during that render cycle the `code` closure is the one captured when the mutation started.
2. `row?.id` — if the server-fn payload ever comes back wrapped (`{ data: row }`), `row?.id` is `undefined` and we push `?project=undefined`. Not a 404 by itself, but a symptom worth removing.
3. `navigate` uses the URL-form path (`/admin/...`). `ProjectSwitcher` (which works) uses the **route-id form** (`/_authenticated/...`). If `code` is ever falsy on this render, the URL-form call pushes `/admin/countries//personas/studies` → root 404, exactly what the user saw. The route-id form fails validation instead of silently 404-ing.

## Fix

Small, defensive changes only in `src/components/personas/StudyWizard/ProgramsIndex.tsx`:

1. **Assert `code` before navigate.** If missing, keep the form open and surface an inline error instead of pushing a broken URL.
2. **Normalize the mutation result.** Accept both `row` and `{ data: row }` shapes; require a non-empty `id`; on missing id, refetch `persona-projects`, pick the freshest project for `code`, and use that id.
3. **Await the invalidation** (`await qc.invalidateQueries(...)`) so the projects list is authoritative before we leave the page.
4. **Switch `to` to the route-id form** used by the working `ProjectSwitcher`: `"/_authenticated/admin/countries/$code/personas/studies"`. This gives TanStack a typed match; a bad `code` throws instead of falling through to root 404.
5. **Log the failure once.** Wrap the navigate in try/catch and `console.error("[programs] navigate failed", { code, id, err })` so a repeat is diagnosable from the console log tool without more guessing.
6. **Same treatment for the two `<Link>`s** in `ProgramRow` (Continue / Open report) — move them to the route-id `to` form for consistency.

## Verification

- Click **New program → Create** in preview and confirm the URL becomes `/admin/countries/GRD/personas/studies?project=<uuid>` and the Studies page renders (not the 404).
- Retry with the form open and empty `code` (simulated) — expect an inline error, not a bounce.
- Confirm existing rows' Continue / Open report links still work.

## Out of scope

- No server-function, schema, or RLS changes — DB writes are already succeeding.
- No changes to `ProjectSwitcher` (already uses the safe pattern) or to the Studies route itself.
