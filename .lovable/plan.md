# Sovereign Decision Circuit for The Vault

## Creative direction

Replace the three-unit photograph in the `/vault` opening with a purpose-built animated graphite instrument titled **The Sovereign Decision Circuit**.

The state-owned server is the visual anchor—not a background detail. Three engraved compute units sit inside a clearly marked government boundary. Public Corpus evidence flows inward from one side; protected national records remain visibly sealed inside the boundary. The two streams meet only inside the government-controlled system, where they become a governed decision brief. A narrow approved-results path then rises toward **Faster, better-informed decisions** and a qualified **Conditions for higher GDP** outcome.

This tells the story in one glance:

```text
PUBLIC CORPUS ───────► ┌───────────────────────────────┐
                       │  OWNED + MANAGED BY THE STATE │
PRIVATE NATIONAL DATA  │  [ THREE SOVEREIGN SERVERS ]  │
STAYS INSIDE ─────────►│  protected synthesis          │
                       └──────────────┬────────────────┘
                                      │ approved findings only
                                      ▼
                         TIMELY, ACCURATE DECISIONS
                                      │
                                      ▼
                         CONDITIONS FOR HIGHER GDP
```

## Animation sequence

1. Draw the government boundary and three pen-and-hatch server units.
2. Bring cited public Corpus records inward as small paper marks.
3. Illuminate private-data marks already inside the boundary; none cross outward.
4. Pass both streams through a central synthesis dial labelled **GOVERNED ANALYSIS**.
5. Require two approval marks before a finding can leave the boundary.
6. Send approved findings into a decision register, then draw a restrained rising GDP path.
7. Loop the complete sequence while the page remains open; pause while a visitor explores a stage.

## Interaction and explanatory copy

- Make **Corpus**, **State-owned Vault**, **Governed analysis**, **Approved finding**, and **Decision value** focusable on desktop and tappable on touch screens.
- Hover, focus, or tap replaces the caption beneath the animation with a concise explanation.
- Make ownership explicit in the default caption: **“The hardware, the data and the release decision remain under government control.”**
- Describe GDP as a qualified pathway, never a guaranteed uplift or forecast: stronger evidence can improve investment, delivery, resilience and productivity decisions.
- Keep all private records abstract; never depict names, rows, record contents, or data leaving the secure boundary.

## Visual treatment

- Match GDPVision’s established monochrome graphite, fine cross-hatch and technical-instrument language.
- Use paper, ink and line tokens throughout; reserve gold for approved movement and the qualified economic pathway.
- Keep the composition quiet and legible rather than diagram-heavy.
- Fit the existing right-hand opening space without changing the page structure or surrounding copy.
- Replace the current image and its hardware caption completely; do not show both.

## Implementation

- Add one focused animated SVG/React component for the Vault opening.
- Add scoped motion styles and keyframes to the global design system.
- Reuse the existing interaction pattern: start on entry, loop indefinitely, pause on engagement, and provide a complete static composition for reduced-motion visitors.
- Keep the full story visible on phones in a simplified stacked arrangement rather than hiding the visual.
- Preserve `/vault` metadata, briefing form, navigation, and all other sections unchanged.

## Verification

- Confirm every stage is legible and the server ownership message is prominent on desktop and mobile.
- Confirm public evidence enters, private data never appears to leave, and only approved findings cross the boundary.
- Confirm the loop restarts cleanly, pauses during engagement, and stops when the page exits.
- Confirm keyboard/touch access, reduced-motion behavior, no sideways scrolling, and no page errors.
