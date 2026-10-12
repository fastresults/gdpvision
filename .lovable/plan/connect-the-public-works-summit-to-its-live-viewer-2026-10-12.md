# Connect the Public Works summit to its live viewer

## Recommendation

The CIPWS '27 Caribbean Infrastructure & Public Works Summit is the only event in the briefing that has no web address yet. That's why its slide says "coming online". Add https://public-works.gdpvision.com to the shared event list. The slide then shows the same live viewer as the other summits: it fits the column, starts loading as soon as /present opens, and has the reload, larger-view and new-tab buttons.

## Result

- The Public Works slide shows the live site instead of "coming online".
- The briefing's viewer count goes up by one, because every event now has a live viewer.

## Verification

- Open /present and check that the Public Works viewer starts loading straight away and fits the width with no sideways scrolling.
- If the site refuses to be shown inside another page, report it. It will still open in a new tab.

## Technical details

- In `src/lib/present/events.ts`, change the `cipws` entry from `url: null` to `url: "https://public-works.gdpvision.com"`, with https and no trailing slash.
