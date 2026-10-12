# Point the event web viewers at the new gdpvision.com sites

## Recommendation

Update the one shared event list that powers `/present`. Every event viewer reads its address from there, so a single change updates all of them. Events that now have a site will get a live viewer and preload straight away, with no layout changes.

## Address mapping

| Event | New viewer address |
| --- | --- |
| CGDPS '26 Caribbean GDP Summit | https://gdp-event.gdpvision.com |
| CBES '26 Blue Economy | https://blue-economy.gdpvision.com |
| CADIS '26 AI & Digital Infrastructure | https://cadis.gdpvision.com |
| CHIS '27 Housing & Infrastructure | https://housing.gdpvision.com |
| CAFS '27 Agriculture & Food Sovereignty | https://agriculture.gdpvision.com |
| CEIS '27 Energy & Infrastructure | https://energy.gdpvision.com |
| CBIS '27 Business & Industry | https://commerce.gdpvision.com |
| CHWIS '27 Health, Wellness & Innovation | https://health.gdpvision.com |

No change:
- CIS '27 Investment Summit keeps https://caribbeaninvestmentsummit.com
- CIPWS '27 Infrastructure & Public Works stays without a viewer (no address supplied)

This takes the live viewers from 4 to 9 events: three are new (Blue Economy, CADIS, Energy) plus Business and Health. The other four replace their old addresses.

## Verification

- Load `/present` and confirm all nine event viewers mount and start loading right away.
- Check that each site fits the viewer width with no sideways scrolling.
- Flag any site that refuses to be shown inside another page. It will still open in a new tab.

## Technical details

- Edit only the `url` fields in `src/lib/present/events.ts`.
- Use https and drop any trailing slash.
