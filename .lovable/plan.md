# Add "The National Record" to the public navigation

## Goal
`/record` is currently reachable only from the homepage's "One trusted national record" section link. Add it to the public top navigation, immediately after "The Vault", on desktop and mobile.

## Changes
Single file: `src/components/marketing/MarketingShell.tsx`

1. **Desktop nav** (uppercase mono links): insert a `<Link to="/record">` labelled **The National Record** directly after the existing "The Vault" link, keeping the same styling (`hover:text-ink-950`).
2. **Mobile menu**: insert the same link after "The Vault" in the stacked menu, with `onClick={() => setMenuOpen(false)}` and the existing `border-b border-line-100 py-3` styling so the menu stays consistent.
3. **Footer**: leave unchanged (per placement decision).

No other files change. The `/record` route and its head metadata already exist (`src/routes/record.tsx`); the homepage section link stays as is.

## Verification
- Desktop preview: nav shows Vault → National Record → business case, link navigates to `/record`.
- Mobile width: the link appears in the opened menu and closes the menu on tap.
- Typecheck and build pass.
