# Logo to homepage + "Unlock further details" navigation

## What visitors will see
- **Logo (seal or wordmark)** on every public page always goes to the homepage and scrolls to the top. This applies to signed-in visitors too; today they go to the dashboard. The "Dashboard" link next to Sign out still takes them there.
- **Always visible:** "How it works", then the divider, "Request a Cabinet briefing" and "Sign in / Sign out".
- **Hidden by default as one group:** Sovereignty, The Vault, The National Record, The business case, The Decision Brief, The writing.
- **In the group's place:** a small control.
  - Label: **"There's more beneath the surface."**
  - Button: **"Click to enable details"**
  - Clicking it fades the six links into place, and the button becomes **"Hide details"**, so visitors can switch back to the simple view.
- **Remembered choice:** the browser remembers the setting. A visitor who opens the details keeps seeing them on every public page until they hide them. First-time visitors always start with the simple view.
- **Phone menu:** works the same way. "How it works" sits at the top, then one "Click to enable details" row that opens the six links in place, then the briefing request and Sign in at the bottom.

## Recommendation notes
- This uses a real button, not a typing field, because a field suggests a password. It works with the keyboard and screen readers, which hear whether the group is open or closed.
- Hiding the links only changes the menu. Every page stays reachable by direct link and by search engines, and links inside the homepage are unchanged.

## Technical details
- Only `src/components/marketing/MarketingShell.tsx` changes.
- Split `NAV_LINKS` into `primary` (How it works), `details` (six links) and `actions` (briefing request, AuthEntry).
- Add a `useDetailsUnlocked()` hook. It starts `false` during server rendering, reads `localStorage("gdpv.navDetails")` in `useEffect` to avoid hydration mismatches, and writes the value whenever it changes.
- The logo `Link` becomes `to="/"` and keeps `onClick={scrollToTop}`, as the header-logo rule requires.
- The toggle uses the `btn-ghost` style, `aria-expanded` and `aria-controls`. The group uses a short opacity/width transition that respects reduced motion.
- Check the layout with Playwright at 1397px and 390px.
