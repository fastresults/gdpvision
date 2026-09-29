# Show how GDPVision turns national evidence into stronger economic outcomes

## Recommendation

Add one flagship animation to `/record`: a **Sovereign Intelligence Flywheel**. It will show the Second Brain, Corpus and Sovereign Vault as distinct systems that continually strengthen one governed national record, which then supports better decisions and measurable economic outcomes.

The animation should explain a process, not decorate the page. It must not imply that technology automatically raises GDP or invent a percentage uplift.

## Placement and story

Place the new visual immediately after the current country-led opening and before the live graded figures. The country picker remains the first control, so the visual is clearly framed around the selected country.

The animation moves through five readable stages:

```text
PUBLIC EVIDENCE          STATE-OWNED RECORDS
      ↓                         ↓
   CORPUS                 SOVEREIGN VAULT
      └──────→ SECOND BRAIN ←──────┘
                    ↓
        ONE GOVERNED NATIONAL RECORD
                    ↓
   faster decisions · stronger investment cases
   better delivery · risks found earlier
                    ↓
       CONDITIONS FOR HIGHER, DURABLE GDP
```

- **Corpus:** public sources, reports and economic measures arrive as small cited fragments; duplicates visibly merge and grades attach.
- **Sovereign Vault:** protected national records remain inside a secure core. Only an approved finding crosses its boundary, never the underlying restricted data.
- **Second Brain:** connects the trusted evidence by country, ministry, sector, programme and decision; relationships assemble as a living network.
- **National Record:** the three streams resolve into one clear, governed record rather than three disconnected databases.
- **Economic outcomes:** the record fans into four practical pathways—investment, delivery, resilience and productivity—before a restrained rising GDP trajectory appears.

## Visual direction

- Match the existing graphite, fine-line, gold-accent instrument style.
- Use a wide, unframed composition rather than another card.
- Give each system a recognizable shape: an indexed archive for Corpus, a locked sovereign core for the Vault, and a connected neural map for the Second Brain.
- Animate evidence particles through the system in a deliberate 10–12 second sequence, then settle into a quiet ambient pulse.
- End with a thin rising line labelled **“Potential economic effect—not a forecast”** rather than a fabricated value.
- On hover, focus or tap, pause the sequence and reveal a concise explanation of that stage, what enters it, what leaves it and who governs it.
- Include a visible Replay control using the existing button style.

## Page copy

Use a direct section heading:

**Three systems combine to turn scattered national evidence into stronger economic decisions.**

Supporting line:

**The Corpus gathers and grades public evidence. The Sovereign Vault protects the records that must remain in government. The Second Brain connects both into a national memory that helps leaders act faster, prepare stronger investments and improve delivery.**

The final outcome label should read:

**Better evidence does not guarantee growth. It improves the decisions, delivery and investor confidence that make durable growth more achievable.**

## Interaction and accessibility

- The selected country name follows the country picker into the animation.
- Keyboard focus and touch provide the same explanations as hover.
- Every moving element has a plain-language accessible label.
- Respect reduced-motion settings by showing the completed diagram without movement.
- Stack vertically on phones with no sideways scrolling or clipped labels.
- Keep restricted and Vault data abstract; show no protected values.

## Technical details

- Add a focused visualization component alongside the existing `/record` visuals and reuse the current in-view/count-up utilities.
- Use hand-built SVG and CSS motion so it remains light, crisp and consistent with the existing constellation, custody rings and figure journey.
- Reuse semantic paper, ink, line and gold tokens only.
- Add an `<Explain>` rationale for the GDP outcome line and its non-forecast qualification.
- Do not add a new data request: the current country name and public aggregate counts are sufficient for this explanatory visual.
- Verify the full animation, replay, hover/focus/tap explanations, reduced motion, desktop layout and phone layout.
