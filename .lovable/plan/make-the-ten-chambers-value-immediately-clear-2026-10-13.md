# Make the ten Chambers’ value immediately clear

## Recommended approach
Lead with what government can achieve, then explain what a Chamber actually is. Present the ten Chambers as connected digital workspaces—not physical rooms, committees or ten separate products.

Make the business case through a clear chain: shared national evidence → informed policy and investment choices → accountable delivery. Use confident, empowering language without claiming GDPVision is the “only smart way” to govern or guarantees economic growth.

## Proposed copy

**Eyebrow**
Ten connected workspaces. One national purpose.

**Title**
Govern with confidence. Turn national priorities into economic progress.

**Subtitle**
GDPVision’s ten Chambers are connected digital workspaces for the work of government—from understanding the economy to shaping policy, attracting investment and delivering results. Each brings your country’s evidence and decision tools together, helping Cabinet and ministries act as one, direct resources where they matter and build the conditions for lasting GDP growth—with government in control.

## Why this works
- The title speaks to the reader’s responsibility and economic ambition before introducing product terminology.
- The first subtitle sentence explicitly defines “Chambers” and gives recognisable examples.
- The second explains country-specific evidence, coordinated action, resource allocation and growth value.
- “Build the conditions” conveys economic purpose without promising a guaranteed GDP increase.
- Government retains authority; the workspaces support leaders rather than replace their judgement.

## Scope and technical details
- Replace only the eyebrow, title and subtitle in the homepage’s `#instrument` introduction in `src/components/marketing/MarketingHome.tsx`.
- Preserve the existing typography, spacing, ten Chamber cards, country selector, estimates and interactions.
- Do not rename the Chambers or change their individual card copy in this pass.
- No changes to data, permissions, calculations or other pages.

## Verification
- Check the introduction at desktop and phone widths for clear wrapping and no clipping.
- Confirm the title communicates value on its own and the subtitle defines “Chamber” before describing benefits.
- Confirm the country selector and Chamber cards remain unchanged and the preview reports no errors.