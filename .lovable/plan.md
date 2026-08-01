## Confirmed cause

`ShareLinkBar.tsx` currently creates the client URL with `window.location.origin`. When an administrator is working in the Lovable preview/editor, that produces a gated preview address, so external recipients are redirected to a Lovable login. The project already has `browserPublicOrigin()` in `src/lib/personas/public-origin.ts`, which explicitly rejects these gated hosts, but the dossier share UI is not using it.

## Plan

1. **Generate only public share addresses**
   - Replace `window.location.origin` in `ShareLinkBar.tsx` with the existing `browserPublicOrigin()` resolver.
   - Add a dossier-link helper alongside the existing participant-link helper so all external dossier URLs have one canonical construction path.
   - Use the canonical public origin `https://gdpvision.com`, while preserving support for an explicitly configured public site URL.

2. **Prevent gated links from reappearing**
   - Keep rejecting preview/editor hosts such as `lovableproject.com`, `lovable.dev`, and preview-prefixed domains.
   - Ensure **Create client link**, **New address**, the visible URL field, and **Copy** all produce the same public-domain address.
   - Do not change the token or sharing permissions; only correct the host used to present the link.

3. **Verify the public access path end to end**
   - Confirm `/d/$token` remains outside the authenticated route tree.
   - Confirm `/api/public/dossier/$token` remains callable without a session and returns only the approved briefing/deck payload.
   - Test a real enabled share token in a fresh signed-out browser context and verify there is no redirect to `/auth` or Lovable login.
   - Verify dossier reading, presentation opening, and print/PDF actions still work from the public URL.

4. **Regression protection**
   - Add focused coverage for origin selection and dossier URL generation, including a gated-preview input resolving to `https://gdpvision.com`.
   - Check other external-link generators use the same public-origin contract so this class of failure does not recur.