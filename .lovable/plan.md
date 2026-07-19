## Goal
Guarantee that (1) every route change scrolls the viewport to the top, and (2) any in-page "subsection" navigation (tab switch, wizard step, drawer/modal open, accordion expand, chamber sub-view) scrolls that component's container to the top.

## Current state (verified)
- `src/router.tsx` sets `scrollRestoration: true`. That preserves back/forward scroll positions but does NOT force new navigations to the top when the app uses a custom scroll container (which several chambers do). No `scrollToTopSelectors` is configured.
- Only three files do ad‑hoc scroll handling today (`AskTheLedger`, `countries.$code.onboard`, `countries.$code.studio.threats.$id`). There is no shared primitive, so behavior is inconsistent across chambers.

## Plan

### 1. Global route-change scroll-to-top
Update `src/router.tsx`:
- Keep `scrollRestoration: true` (preserves back/forward).
- Add `scrollToTopSelectors: ['#app-scroll-root', 'main', 'window']` so both the window and any designated inner scroll container reset on forward navigations.
- Ensure the app shell root element in `src/routes/__root.tsx` (and any authenticated shell wrapper such as `SuperAdminShell` / country admin shell) carries `id="app-scroll-root"` on the scrollable element.

Add a small `RouteScrollTop` component mounted once in `__root.tsx` that subscribes to `useRouterState({ select: s => s.location.pathname })` and, on pathname change (not hash/search-only changes), calls `window.scrollTo({ top: 0 })` and resets `#app-scroll-root` — belt-and-suspenders for cases where TanStack's built-in reset doesn't fire (e.g., same-route param changes).

### 2. Reusable "scroll section into view on change" primitive
Create `src/hooks/useScrollToTopOnChange.ts`:
```
useScrollToTopOnChange(ref, dep, { behavior: 'smooth' | 'auto' })
```
On `dep` change, scrolls `ref.current` into view aligned to the top of the viewport (with a small offset for sticky headers), and also sets `ref.current.scrollTop = 0` when the element is itself scrollable.

Create `src/components/layout/ScrollAnchor.tsx`:
- A tiny wrapper `<ScrollAnchor dep={activeTab}>...children...</ScrollAnchor>` that internally uses the hook. Drop-in for chambers/wizards.

### 3. Apply the primitive to known subsection surfaces
Wire the primitive into the existing subsection switchers so every one behaves the same way:
- Chamber shells (Chambers 01–07): scroll to top of chamber content when the active sub-tab / view / step changes.
- Scenario Engine wizard (Chamber 03): scroll to top of the step container on step change.
- FDI Studio (Chamber 04): scroll to top on Threat / Strategy tab switch.
- Narrative Chamber (Chamber 05): scroll to top on Signal → Draft transitions and on opening a comms artifact.
- Cabinet Room (Chamber 06): scroll to top on session/decision selection.
- Persona Lab (Chamber 07): scroll to top on Persona / Segment / Study switch.
- Onboarding admin: scroll to top on stage change.
- Sector Dossier Drawer / any Sheet/Dialog: reset internal scroll to 0 on open and on tab change inside.

### 4. Respect user intent (accessibility)
- Honor `prefers-reduced-motion`: use `behavior: 'auto'` when reduced motion is set, otherwise `'smooth'` for in-page subsection scrolls. Route-change scroll is always instant.
- Do NOT scroll on hash-only navigation — let the browser handle anchor scrolling.
- Do NOT scroll when navigation is `replace` with only search-param changes that represent filter updates (e.g., queue filters), to avoid yanking the user during typing.

## Technical notes
- TanStack Router's `scrollToTopSelectors` accepts CSS selectors and the special string `'window'`. Adding a stable `#app-scroll-root` id on the shell's scroll container is the cleanest fix; if no inner container scrolls, the `window` entry alone handles it.
- The `RouteScrollTop` component uses `useEffect(() => { ... }, [pathname])` — it triggers after commit, avoiding layout thrash.
- The hook uses `IntersectionObserver`-free logic: it just reads `ref.current.getBoundingClientRect().top` and calls `window.scrollTo`. Cheap and framework-agnostic.

## Out of scope
- No visual/design changes.
- No changes to business logic, data fetching, or route structure.
