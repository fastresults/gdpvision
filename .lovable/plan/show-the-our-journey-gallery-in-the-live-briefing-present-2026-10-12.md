# Show the "Our Journey" gallery in the live briefing (/present)

## What happened

The gallery was added to the public homepage only, right under the opening section, as the plan described. The briefing at /present is a separate page, so the gallery never appeared there.

## Recommendation

Add "Our Journey" to the briefing as its own section, straight after the Cover and before "01 · What it is". It reuses the same gallery, so both pages always show the same photos.

- Same drifting row of photos. Click to pause or resume, use the arrows to move along, and click a photo to open it full size.
- Admins keep **Edit gallery** in the briefing too. Photos added, removed or reordered there also change on the homepage, and the other way round.
- It shows in the briefing's progress list as "Our Journey" and works with the arrow keys like every other section.
- The section numbers that follow stay the same (the gallery carries no number).
- The homepage gallery stays where it is.

## Technical details

- In `src/components/present/PresentDeck.tsx`, insert `<Step id="journey" label="Our Journey">` after the cover step, rendering `<SiteGallery variant="present" />`.
- Give `SiteGallery` a small `variant` prop:
  - "present" drops the section's own border and padding so it fits the slide.
  - It uses the briefing's label style.
  - It uses a larger photo height so the row fills the slide.
- Use a distinct section id inside the gallery (`journey-gallery`) so the step id doesn't clash with the briefing's anchor.
- Verify at 1397×857 and 390×844: the ten photos show and drift, pause and the lightbox work, keyboard step navigation works, and there are no console errors.
