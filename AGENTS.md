# AGENTS.md — GDPVision navigation index

Read this first, then the matching `docs/map/<domain>.md` (`chambers`, `onboarding`, `corpus`, `routes`, `server-fns`, `tables`). Full tables of chambers, onboarding stages, routes and troubleshooting: `docs/map/agents-full-reference.md`.

Stack: TanStack Start (React 19, Vite 7) on Cloudflare Workers · Tailwind v4 · Supabase (Lovable Cloud) · AI SDK via Lovable AI Gateway.

## Cardinal rules
- **Buttons**: `btn-primary`/`btn-secondary`/`btn-ghost`/`btn-accent` from `src/styles.css`; never inline `bg-ink-* text-paper-*`. Only `@theme inline` colour tokens exist.
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
- **Briefing data**: `/present` gets only aggregate corpus counts via `getCorpusSnapshot`; never rows or text. `CorpusMark` is the single Second Brain drawing in briefing circuits.

## Do not edit
`src/routeTree.gen.ts`, `src/integrations/supabase/{client,client.server,auth-middleware,auth-attacher,types}.ts`, `.env`, `supabase/config.toml`.

## Where things live
- Chambers 01–10: admin routes `admin/countries/$code/<chamber>`; components/server fns per chamber in `docs/map/chambers.md`. New chamber section → update that map.
- Onboarding: stage order in `src/lib/country-onboarding/stages.ts`, orchestrator `orchestrator.functions.ts`. New stage → update `docs/map/onboarding.md`.
- Corpus: types `src/lib/corpus/types.ts`, gateway `corpus/gateway.server.ts`, writers `corpus/writers.server.ts`, searchers `corpus/searchers/*`. RLS via `has_country_access`.
- Shells: `__root.tsx`; `_authenticated/route.tsx` (auth gate); `admin/route.tsx` (super-admin); `console.tsx` (country users); `instrument/route.tsx`; `narrative/route.tsx`; `index.tsx` (`MarketingHome`).

## Map drift guard
After adding a server fn, migration or route: `bun run headers && bun run map`. CI runs `bun run check:maps`.
