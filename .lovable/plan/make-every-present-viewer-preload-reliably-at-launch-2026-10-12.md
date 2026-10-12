# Make every `/present` viewer preload reliably at launch

## Audit finding

A fresh launch creates all **23 viewers** immediately: 10 Chamber pages, 10 event sites, the sovereign-corpus controls, Antigua’s Second Brain controls, and the eGovernment site. Browser tracing confirmed all 23 top-level page requests begin within the first second.

The failure is therefore not missing or scroll-triggered mounting. It is a combination of:

- **Readiness is detected too late:** each viewer attaches its native load listener after mounting, so a fast load can finish before the listener exists.
- **The counter mislabels loaded viewers:** a viewer that successfully reaches a sign-in page is marked `signin`, but the header only counts `ready`; it can therefore say viewers are unfinished even when they loaded.
- **Twenty-three full sites compete at once:** the browser starts every request, but may deprioritize distant frames and their scripts. `loading="eager"` starts navigation but cannot guarantee when a remote site finishes.
- **The 45-second retry recreates the iframe:** this throws away the current page and begins another cold navigation, which can make a slow viewer appear never to settle.

## Recommended implementation

### 1. Add a launch-time preload coordinator

Create one presentation-level registry containing the exact 23 expected viewer IDs and URLs. On the first client render it will:

- confirm every expected iframe is mounted with its URL;
- record `requested`, `loaded`, `sign-in required`, `slow`, and `failed` separately;
- expose one shared status snapshot to the header and each viewer;
- detect any missing viewer immediately rather than waiting for the presenter to reach its slide.

This preserves the current presentation: each page remains in its existing slide and no duplicate hidden iframe is created.

### 2. Make load detection impossible to miss

Move the primary load signal onto the iframe’s React `onLoad` handler, which is attached when the element is created. Keep same-origin inspection only to distinguish a real Chamber page from its sign-in page.

Add a short post-launch reconciliation pass that checks all 23 iframe documents after hydration. This catches restored/cached pages and confirms that every viewer has actually begun navigation.

### 3. Report preload truthfully

Replace the single “ready” count with clear launch status:

- `23 / 23 viewers launched`
- `18 loaded · 5 require sign-in`, when applicable
- identify slow or failed viewers without treating authenticated sign-in pages as unloaded

The presenter will be able to see whether all viewers launched before moving through the briefing.

### 4. Make retries preserve progress

Remove the automatic cold remount after 45 seconds. A slow viewer will remain mounted and continue loading. Its manual Reload control will reload only that viewer, and the coordinator will update its state without affecting the other 22.

Add one bounded automatic recovery only when a viewer has demonstrably failed or remained on `about:blank`, not merely because its full application is slow.

### 5. Warm all external origins before viewer startup

Add launch-time preconnects for the distinct event and eGovernment origins so DNS and secure connections begin before their iframe applications request assets. Same-origin Chamber viewers will reuse the current GDPVision connection.

## Validation

Test a fresh `/present` launch with cache disabled and verify:

1. all 23 iframe page requests start without scrolling;
2. the registry reaches `23 / 23 launched` on desktop and mobile;
3. loaded sign-in pages are reported as loaded but requiring sign-in;
4. event and eGovernment viewers settle independently;
5. no iframe is recreated during normal slow loading;
6. navigating through the full briefing shows the same already-loaded iframe instances;
7. manual Reload affects only the selected viewer;
8. no new console, runtime, or build errors appear.

## Limit

GDPVision can guarantee that all 23 viewers are created and their requests are launched when `/present` opens. It cannot guarantee the completion time of a remote website, an authentication redirect, or a browser under resource pressure; the new status display will make those cases explicit instead of presenting them as missing preload work.
