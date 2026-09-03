# CLAUDE.md

**Read `AGENTS.md` first.** It is the navigation index for this repo — cardinal rules, chamber map,
do-not-edit list, and pointers into `docs/map/*.md`. Everything below is supplementary.

## Project

GDPVision — sovereign economic intelligence platform (gdpvision.com).
Repo: no GitHub repo is connected to this project — the only Git remote is Lovable's internal store, branch `main`.
To connect or check GitHub sync, use the Plus (+) menu in the Lovable chat input → GitHub. (The former
`fastresults/eyeframe-showcase` reference was stale and 404s.)

Stack: TanStack Start (React 19, Vite 7) on Cloudflare Workers · Tailwind v4 · Supabase (Lovable Cloud)
· AI SDK via Lovable AI Gateway. Package manager: **bun** (`bun.lock` is authoritative).

## Commands

```
bun install            # install deps
bun run dev            # vite dev server
bun run build          # production build
bun run lint           # eslint
bun run format         # prettier --write .
bun run check:maps     # verify docs/map/* and file headers are in sync
bun run map            # regenerate docs/map/*
bun run ledger-qa:all  # ledger verify + cascade invariants + e2e
```

CI runs `.github/workflows/map-check.yml` — if you add or move routes, server fns, or tables,
run `bun run check:maps` before committing or CI will fail.

## Layout

```
src/routes/        TanStack file-based routes (_authenticated/, api/, kiosk.*)
src/components/    UI, grouped by chamber/domain
src/lib/           domain logic, server fns (*.functions.ts), *.server.ts helpers
src/integrations/  Supabase clients — auto-generated, do not edit
supabase/migrations/  SQL migrations, timestamp-prefixed
docs/map/          generated domain maps: chambers, routes, tables, server-fns, corpus, onboarding
scripts/           map builders, header checks, ledger QA
```

## Non-negotiables (full list in AGENTS.md §1)

- Buttons use `btn-primary` / `btn-secondary` / `btn-ghost` / `btn-accent` from `src/styles.css`.
  Never inline `bg-ink-* text-paper-*` on `<button>` / `<a>`.
- Render JSON with `<PrettyJson>` from `@/components/data/PrettyJson`, not raw `JSON.stringify` in JSX.
- Every `CREATE TABLE public.*` migration must include its GRANTs in the same migration.
- Server fns: `createServerFn` in `*.functions.ts`. Protected ones use `.middleware([requireSupabaseAuth])`
  and must be called from components via `useServerFn` + `useQuery` — never from public route loaders.
- Ingest/commit paths upsert on a normalized key (no duplicates in the second brain).

## Do not edit

`src/routeTree.gen.ts` · `src/integrations/supabase/{client,client.server,auth-middleware,auth-attacher,types}.ts`
· `.env` · `supabase/config.toml`

## Git

Never commit new secrets. `.env` is currently tracked and holds only Supabase *publishable*
(client-side) keys — do not add service-role keys, gateway tokens, or anything server-only to it.
