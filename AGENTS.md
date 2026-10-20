# AGENTS.md — GDPVision navigation index

Read this first, then the matching `docs/map/<domain>.md` (`chambers`, `onboarding`, `corpus`, `routes`, `server-fns`, `tables`). Full ref: `docs/map/agents-full-reference.md`.

Stack: TanStack Start (React 19, Vite 7) on Cloudflare Workers · Tailwind v4 · Supabase (Lovable Cloud) · AI SDK via Lovable AI Gateway.

## Cardinal rules

- **Vault presentation**: separate the opening circuit from contained `Illustration` artwork and asset pointers; preserve data controls.

- **Decision playback**: national and Chamber examples share `PlaybackStrip`; manual navigation pauses, replay restarts the example, and Chamber selection follows an explicitly sorted index so controls and story state stay aligned.

- **Decision presentation copy**: keep scenario title keys and route edges stable; derive stage inputs from route source nodes rather than parsing display captions, so plain-language copy changes cannot break journey lookup or evidence assembly.

- **Events/nav**: `/events` alone uses `.theme-events` + `ev-*` tokens (photos allowed), so the two styles never mix; public nav comes only from `NAV_GROUPS`.
- **Buttons**: `btn-primary`/`btn-secondary`/`btn-ghost`/`btn-accent` from `src/styles.css`; never inline `bg-ink-* text-paper-*`. Only `@theme inline` colour tokens exist.
- **Measuring-body logos**: use static official assets via `src/assets/measuring-bodies/*.asset.json`, with provenance in `sources.md` and a fixed contain-fit slot in `IndexBand`; this keeps institutional identity accurate without runtime lookup or layout shifts.
- **JSON in UI**: `<PrettyJson>` from `@/components/data/PrettyJson`; raw `JSON.stringify` in JSX only in a `<textarea>` or collapsed `<details>`.
- **Illustrations**: monochrome engraved graphite via `<Illustration>`; variants `mark`/`spot`/`aside`/`rule`, one per section, never full-bleed. Exceptions: marketing hero, and the `/present` closing `plate`. Spec: `docs/illustration-contract.md`.
- **Header logo**: every header Wordmark link/button calls `scrollToTop()` from `@/lib/utils`.
- **Second brain no-dup**: every ingest/commit path upserts on a normalized key (`docs/map/corpus.md`).
- **Explain**: derived figures use `<Explain>` + registered rationale, never bare tooltips. Homepage and Brief share `proposedInputForCountry`.
- **Public tables**: every `CREATE TABLE public.*` has GRANTs + RLS + policies in the same migration.
- **Server fns**: `createServerFn` in `src/lib/<domain>/*.functions.ts` with `@domain/@tables/@ui` header; `.server.ts` is server-only; admin client via `await import('@/integrations/supabase/client.server')` inside handlers.
- **Auth**: protected fns use `requireSupabaseAuth`; call from components (`useServerFn` + `useQuery`), never public loaders.
- **Impersonation**: `useImpersonation()` → `viewAs.country_code` for super-admins.
- **AI research**: go through the corpus gateway + fallback waterfall (`fallback.server.ts` → Perplexity → Gemini → infer); never call providers from components.
- **Briefing data**: `/present` gives public visitors only aggregate counts or anonymous shape (`getCorpusSnapshot`, `getCountryBrainShape`), never titles or text; real rows only for signed-in admins via protected fns. `CorpusMark` is the default Second Brain drawing in briefing circuits; the sovereign-corpus circuit intentionally uses the compact Elevating GDP puzzle mark.
- **Briefing flow fit**: `/present` fits only the desktop Data & Decision Flow diagram on a fixed reference canvas; keep the reserved-space reading tray outside that transform and flush to the slide’s right edge so it remains readable and collapsible. Mobile keeps the native stacked flow.
- **Briefing viewer preload**: register every `/present` `LiveFrame` with `ViewerPreloadProvider`; mount each iframe eagerly once and report launched, loaded, sign-in and slow states separately so offscreen viewers preload without cold remounts.

## Do not edit

`src/routeTree.gen.ts`, `src/integrations/supabase/{client,client.server,auth-middleware,auth-attacher,types}.ts`, `.env`, `supabase/config.toml`.

## Where things live

- Chambers 01–10: admin routes `admin/countries/$code/<chamber>`; components/server fns per chamber in `docs/map/chambers.md`. New chamber section → update that map.
- Onboarding: stage order in `src/lib/country-onboarding/stages.ts`, orchestrator `orchestrator.functions.ts`. New stage → update `docs/map/onboarding.md`.
- Corpus: types `src/lib/corpus/types.ts`, gateway `corpus/gateway.server.ts`, writers `corpus/writers.server.ts`, searchers `corpus/searchers/*`. RLS via `has_country_access`.
- Shells: `__root.tsx`; `_authenticated/route.tsx` (auth gate); `admin/route.tsx` (super-admin); `console.tsx` (country users); `instrument/route.tsx`; `narrative/route.tsx`; `index.tsx` (`MarketingHome`).

## Map drift guard

After adding a server fn, migration or route: `bun run headers && bun run map`. CI runs `bun run check:maps`.

<!-- LOVABLE:BEGIN -->
- Homepage scrollers share a once-per-visit visible-entry horizontal step; manual input and reduced motion cancel it so discovery never competes with browsing.
<!-- LOVABLE:END -->

Subfolders may have their own `AGENTS.md` (e.g. `src/lib`); read it first.
