# Root cause

We ship **two parallel Narrative Chamber surfaces** and only one of them is country-safe.

1. `/admin/countries/$code/narrative/*` — country is in the URL path, so every link, refresh, and share is unambiguously scoped. This is what `ChambersLauncher` opens for Chamber 05.
2. `/_authenticated/narrative/*` (files `route.tsx`, `index.tsx`, `queue.tsx`, `signal.$id.tsx`, `strategy.*`, `comms.*`, `brain.tsx`, `coverage.tsx`, `ingest.tsx`, `trace.$id.tsx`) — country is **ambient**. It comes from `useChamberCountry(bindings)` which reads an optional `?code=XXX` query param and otherwise falls back to the first `is_default` binding (or `"LCA"`).

Every internal `<Link>` under `/_authenticated/narrative/*` is written as `to="/narrative/queue"`, `to="/narrative/signal/$id"`, `to="/narrative/comms/$id"` etc. — **none of them re-attach `?code=`**. The header wordmark is `to="/narrative"`. TanStack's `Link` replaces the search object by default, so the moment a user clicks any tab or sub-link inside this shell the `?code=KNA` query is dropped, `useChamberCountry` re-resolves to the default binding, and for a super-admin session with no default binding that resolves to **LCA** (the hard-coded fallback in `useChamberCountry`). That is exactly the screenshot: KNA chambers → click into a narrative sub-nav → shell repaints as `LCA · NARRATIVE / Signal Desk`, header says `LCA`.

Confirmed by reading:
- `src/hooks/useChamberCountry.ts` — `?code=` → default binding → `"LCA"` fallback.
- `src/routes/_authenticated/narrative/route.tsx` L23 — same fallback chain for the header pill, no `search` propagation on any `<Link>`.
- `src/routes/_authenticated/narrative/index.tsx`, `signal.$id.tsx`, `queue.tsx`, `comms.tsx`, `strategy.index.tsx`, `trace.$id.tsx` — all internal `<Link>`s use bare `to="/narrative/..."` with no `search`.
- `src/components/country/ChambersLauncher.tsx` L17 — Chamber 05 correctly targets `/admin/countries/$code/narrative`, so the user starts on the safe surface; contamination happens the first time they touch a link that jumps into the shared shell.

Secondary contributor: the hard-coded `"LCA"` last-resort fallback in `useChamberCountry` silently picks a country instead of failing loudly, so the bug looks like "wrong country" rather than "no country".

# Fix

**Principle: country identity lives in the URL, or the page refuses to render.** No ambient defaults, no query-param drift.

### 1. Retire the ambient `/narrative/*` surface as a country-scoped destination

- Convert `src/routes/_authenticated/narrative/route.tsx` into a **redirector**: in `beforeLoad`, resolve the intended country using the same precedence (`?code` → default binding → first binding), then `throw redirect({ to: "/admin/countries/$code/narrative", params: { code } })`. If no binding exists and no `?code` is given, redirect a super-admin to `/admin/countries` and a country-admin to `/onboarding/country`. Never fall back to a hard-coded ISO.
- Delete or forward the sub-routes (`index.tsx`, `queue.tsx`, `signal.$id.tsx`, `strategy.index.tsx`, `strategy.new.tsx`, `strategy.$id.tsx`, `comms.tsx`, `comms.new.tsx`, `comms.$id.tsx`, `brain.tsx`, `coverage.tsx`, `ingest.tsx`, `trace.$id.tsx`) — either remove them entirely (preferred, since the country-scoped tree already covers the same UX) or turn each into a `beforeLoad` redirector that maps to its `/admin/countries/$code/narrative/...` equivalent.
- Remove the header `<span>{defaultCode}</span>` on the shared shell; the country identity should never be presented from an ambient source.

### 2. Harden `useChamberCountry`

- Remove the `"LCA"` last-resort fallback. If URL and bindings both fail, return `null` and callers must `throw redirect(...)` to the country picker.
- Add an invariant assert during development so any new chamber route that reaches a component with `null` fails loudly instead of silently rendering another country's data.

### 3. Audit every chamber for the same pattern

Sweep `src/routes/_authenticated/**` for chamber shells (Ledger, Portfolios, Scenarios, Studio, Cabinet, Exposure, Stewardship, Personas, Sector dossiers) and confirm the country is a **path param**, not a query or an ambient default. Where a shell is currently ambient (like this narrative one), apply the same redirect-to-scoped-route treatment. In `/instrument/*` the same defect exists (`defaultCode` in `instrument/route.tsx`); scope its inner links or gate them behind an explicit country picker.

### 4. Regression guard

Add a lightweight test / lint rule: any `<Link>` whose `to` starts with `/admin/countries/$code/` or a chamber prefix must also include a `params={{ code }}` prop; any `<Link to="/narrative...`, `/instrument...` etc. inside a country-scoped shell is a build-time error via an ESLint `no-restricted-syntax` rule.

# Technical notes

- Redirects in loaders/`beforeLoad` should use `throw redirect({ to, params })` (TanStack pattern) — do NOT use `window.location`.
- Preserve deep-link intent: when redirecting `/narrative/signal/$id` → `/admin/countries/$code/narrative/signal/$id`, forward `params.id` and any search params.
- `ChambersLauncher` already routes correctly — no change needed there beyond confirming every chamber `to` is a `$code` path route.
- Keep the migration in one PR so the shared `/narrative/*` surface never exists as an "empty shell" while sub-routes still resolve.
