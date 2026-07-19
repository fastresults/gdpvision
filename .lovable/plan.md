## What I got wrong last turn

The screenshots I captured were correctly uploaded to the CDN, but I wired them into `src/components/country/ChambersLauncher.tsx` — a card grid that only appears on the country admin dashboard. The card grid the user is pointing at is the **seven `ChamberPanel` tiles inside `MarketingHome.tsx`** (the public homepage rendered at `/`). That's why nothing changed for them.

The chamber screenshots for JAM are already uploaded and live at:
- `src/assets/chambers/chamber-01.jpg.asset.json` … `chamber-07.jpg.asset.json`

They render fine — I just wired them into the wrong component.

## What I'll change

1. **`src/components/marketing/ChamberPanel.tsx`** — add an optional `image` prop. When present, render it as a full-width header image at the top of the panel:
   - 3:1 aspect ratio, cropped `object-cover object-top`
   - hairline `border-b border-line-200` matching the existing hairlines
   - a subtle paper-white gradient overlay from bottom so the type below the image stays crisp
   - lazy-loaded, with `alt` derived from the chamber title
   - preserves the existing 2px sector-hue accent bar down the left edge, running the full height of the panel including the image
   - `min-h-[240px]` stays but the panel grows naturally to fit the image

2. **`src/components/marketing/MarketingHome.tsx`** — import the 7 `.asset.json` pointer files and add an `image` field to each entry in the `CHAMBERS` array so each panel receives its own screenshot.

3. **No changes** to the CountryAdminWelcome grid in `src/routes/_authenticated/home.tsx` (different component, out of scope for this request) or to `src/components/country/ChambersLauncher.tsx` (last turn's edit stands; it wasn't wrong, just not what was being asked about).

## Result

Each of the 7 tiles on the public homepage's "Seven chambers" section — Ledger, Portfolio, Scenario, Studio, Narrative, Cabinet, Persona — gets a real product screenshot as its header, above the CHAMBER 0X eyebrow, title, purpose sentence, and bullet list. Layout, typography, accent bar, and copy remain untouched.
