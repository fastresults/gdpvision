# Homepage password gate

## What visitors will see
- Opening gdpvision.com shows a plain white page with one centred password box and an "Enter" button. Nothing else appears: no menu, logo or homepage content.
- If they type **1234**, the white page fades away and the full homepage appears. The menu and every link work as normal.
- A wrong password shows "Incorrect password" and clears the box.
- **"Every first load"** means a new visit. The page stays unlocked while the browser stays open, including after refreshes and while moving between pages. Once the browser is closed, the next visit shows the white page again.
- Only the homepage has the gate. Other pages, such as /present, /events and /admin, open as they do now.

## Why this approach
- The password is checked on the server, never in the visitor's browser. Someone viewing the page's code can't read "1234".
- The unlocked state is kept in an encrypted cookie that expires when the browser closes. This matches "every first load" without asking returning visitors to type the password on every refresh.
- The homepage content is sent only after the password is accepted. Locked visitors get the white page and nothing else.

## Trade-offs to know
- "1234" is a light gate for a soft launch or private preview, not real security. Anyone who has it can share it.
- Search engines and link previews will see only the white page. The homepage share title and image still work, but Google won't index the homepage content while the gate is on.
- Removing the gate later is a single change.

## Technical details
- Secrets: `SITE_PASSWORD` = `1234` (set_secret) and `SESSION_SECRET` (generate_secret, 64 chars). Neither uses a `VITE_` prefix.
- `src/lib/site-gate/gate.functions.ts`: `getGateStatus` (GET, reads session) and `unlockSite` (POST, sha256 plus `timingSafeEqual` compare, then `session.update({ unlocked: true })`). `useSession` uses an `httpOnly` cookie with `secure` and `sameSite=lax` and **no maxAge**, so it lasts only for the browser session.
- `src/routes/index.tsx`: the loader calls `getGateStatus()`. When locked, it renders `<SiteGate />` (white `bg-paper-0`, `btn-primary`, accessible label, autofocus). When unlocked, it renders `MarketingHome`. `MarketingHome` loads lazily so its content isn't in the locked response. On success, `router.invalidate()` runs and the content fades in, respecting reduced motion.
- Keep the existing `head()` metadata unchanged.
- Record the gate rule in `AGENTS.md` and add a test for the password comparison: correct "1234" unlocks, while "123", "" and "12345" are rejected.
- Verify with Playwright: white page, wrong password, correct password, refresh stays unlocked, and a fresh browser context is locked again.
