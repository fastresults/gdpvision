# Closing slide: "Build the floor first. Then measure." as a full 16:9 engraving

## Recommendation

Turn the final briefing slide into one full-screen, 16:9 hand-drawn engraving in pen and hatch: graphite on paper, no colour. The closing line and contact details sit on a quiet band of paper inside the artwork, so the picture does the talking and the words stay easy to read.

## The picture: one scene, read left to right

The picture is an architectural allegory: a nation's economy as a building, and measurement as the instruments on top of it.

- **Left, the mature economies (finished, solid).** A classical observatory-exchange stands on a deep, cross-sectioned foundation. The cut-away shows laid courses of stone marked as ledgers, statute books, census rolls and regular published series. On the roof, precise instruments (a telescope, a barometer, a ticking dial echoing GDPNow) feed thin lines out to a stock exchange, ships, factories and growing towns. A faint London skyline and Washington dome sit in the distance.
- **Centre, the developing nation (the gap).** An island nation, with a harbour, a palm line and modest civic buildings, where the same instruments sit on bare, uneven ground. They tilt and the dials can't be read. Loose papers blow away. Measuring without a floor means nothing.
- **Right, GDPVision at work (the floor being laid).** Surveyors and masons set a level, gridded foundation slab beneath the island's civic buildings. Each stone is engraved with a small mark: Source, Method, Grade, Date, Audit. A spirit level and plumb line show the slab is true. Only at the far right, on finished ground, does a first instrument stand upright and readable, with a thin gold-free line running to an investor's ship and a growing town.
- **Composition.** A continuous horizon and ground line ties the three zones together. Strong cross-section hatching below ground makes the foundation the visual subject, with deep blacks underground and open, light hatching in the sky. The top-left third of the sky stays calm, open hatching so the title can sit over it.

## The slide

- The artwork fills the whole 16:9 slide edge to edge.
- "Build the floor first. *Then measure.*", the contact details and the two buttons stay, laid over the calm sky area with a soft paper wash behind them so they stay readable.
- On phones the artwork sits above the text instead of behind it.
- With reduced motion turned on there's no zoom. Otherwise the picture gets a very slow, subtle push-in once the slide opens.

## House-style note

House rules keep illustrations small and never full-bleed. This slide becomes a second deliberate exception, alongside the homepage hero, because you asked for a full 16:9 masterpiece. I'll record this exception in the illustration rules so it isn't copied elsewhere.

## Technical details

- Generate with `imagegen--generate_image` at the premium tier, 1920×1080, monochrome engraved graphite style per `docs/illustration-contract.md`, with no text in the image. Save to `src/assets/illustrations/floor-first-masterpiece.jpg`, then convert to a Lovable Asset pointer (`.asset.json`) like the other illustrations.
- I'll review the result and regenerate or edit it if any zone is unclear, there's stray lettering, or there's any colour.
- `PresentDeck.tsx` close `Step`: an absolute full-bleed layer rendered through `<Illustration>` (add a `cover`/`slide` variant, or an explicit exception prop), plus a `paper-0` gradient wash behind the text block. The text is positioned in the top-left. Alt text describes the allegory.
- Update `docs/illustration-contract.md` and `mem://design/illustration-contract` with the closing-slide exception.
- Verify at 1397×857 and 390×844 that the image fills the slide, the text is readable, and there are no console errors.
