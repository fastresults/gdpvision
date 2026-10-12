## Restore admin access after sign-in

### What's confirmed
- The admin email and password work. Our records show successful sign-ins today at 06:00 and 06:09 UTC.
- The account still has its admin rights.
- So the problem happens after sign-in: something sends you back, blocks you, or shows a blank page.

### Steps
1. Sign the preview in as the admin account and repeat your steps: sign-in page, then home, then an admin page such as the Ministers board. Take screenshots and record any errors.
2. Find the exact point where access breaks. Likely places:
   - the sign-in page's redirect after a successful sign-in;
   - the check that lets only signed-in people into protected pages;
   - the check that loads admin rights;
   - recent changes to the briefing page, the gallery's admin check, or the startup code that sends your sign-in to the server.
3. Fix the cause, plus any other places that share the same mistake.
4. Check the full flow again while signed in: sign in, reach the admin pages, edit the gallery, sign out and sign back in.

### Technical notes
- Inspect `src/routes/auth.tsx`, `src/routes/_authenticated/route.tsx`, `src/routes/_authenticated/admin/route.tsx`, the role lookup, and the middleware array in `src/start.ts`.
- No database or password changes are expected. The roles table is intact.
