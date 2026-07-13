## Why they're missing

The marketing header (`src/components/marketing/MarketingShell.tsx`) only renders a single `Sign in` link once the Supabase session check resolves. Two reasons nothing else appears — and sometimes even "Sign in" looks absent:

1. **By design, only one entry exists.** Create account and Forgot password are *modes* inside the `/auth` route (toggled via links on that page), not top-nav items.
2. **The single link is gated on session hydration.** `InstrumentEntry` returns `null` until `supabase.auth.getUser()` resolves. On a slow first paint you see no auth link at all; once resolved it shows either `Sign in` (logged out) or `Open instrument` (logged in).

## Proposed fix

Update the marketing top-nav so authorization affordances are always visible and match the pattern in `tanstack-auth-guards` (session-driven, never a null flash).

**Logged out** — show three affordances in the header:
- `Sign in` → `/auth` (sign-in mode)
- `Create account` → `/auth?mode=sign-up`
- `Forgot password?` → `/auth?mode=forgot` (rendered smaller/secondary)

**Logged in** — show:
- `Open instrument` → `/instrument`
- `Sign out` (calls `supabase.auth.signOut()` with the sign-out hygiene from the guide: cancel queries, clear cache, replace-navigate to `/`)

**No null flash.** While the session check is pending, render the logged-out affordances as the optimistic default rather than `null`, so the header never appears empty on first paint.

### Files touched
- `src/components/marketing/MarketingShell.tsx` — replace `InstrumentEntry` with a three-link logged-out group + logged-in group; drop the `signedIn === null → return null` branch.
- `src/routes/auth.tsx` — read an optional `mode` search param (`sign-in | sign-up | forgot`) and initialize `useState<Mode>` from it so the deep links land on the right form. No visual change to the page otherwise.

### Out of scope
- No changes to `/auth` layout, styling, or the OAuth (Google) button.
- No new routes; `create-account` and `forgot-password` remain modes of `/auth`, not standalone pages.
- No changes to the super-admin header (`SuperAdminShell`).

Confirm and I'll implement.