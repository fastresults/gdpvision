# Make every `/present` viewer finish loading on its own, and show it

## What the audit found

I opened `/present` fresh in a test browser and timed it second by second.

1. **Loading does start immediately.** All 19 embedded pages (10 Chambers, 9 event sites) begin downloading within 1 second of opening `/present`, before any scrolling. The event sites finish within about 3 seconds.
2. **The viewers never find out that their page has loaded. This is the real fault.** Each viewer keeps its page invisible behind the "Loading…" plate until it receives a "page finished" signal. The pages finish in 1–3 seconds, but the briefing itself doesn't become interactive until about 15 seconds. By then every "page finished" signal has already gone, and nothing re-checks. In the test, 0 of 19 green "ready" dots ever lit, even after 30 seconds. So the pages are loaded but stay hidden. Scrolling or reloading a viewer seems to "start" it, but it's really just showing the page late.
3. **Why the briefing takes ~15 seconds to wake up.** The 10 Chamber viewers are each a full copy of GDPVision. All ten start up at the same moment on the same browser thread as the briefing, so they hold up the briefing's own startup.
4. **Chamber viewers need a signed-in presenter.** Signed out, each Chamber viewer moves on to the sign-in page after about 11–17 seconds. That's expected, but the viewer shows no message to explain it.

## The fix

1. **Catch the "loaded" signal from the very first moment.** Add a tiny early listener that runs before the briefing becomes interactive and stamps each viewer the moment its page finishes. When the briefing wakes up, each viewer reads that stamp and reveals its page straight away. It also keeps listening for later reloads.
2. **Double-check on wake-up.** For GDPVision's own Chamber pages, the viewer also checks the page's ready state directly. A finished page is never left hidden behind the plate again.
3. **Never leave a viewer stuck.** If a page hasn't reported finishing within 45 seconds, it reloads automatically once. If it still doesn't finish, the viewer shows "Taking longer than usual — Reload" instead of an endless plate. Background loading carries on until every viewer is ready or has given up.
4. **Readiness counter in the briefing bar**, for example "Viewers 14 / 19 ready". It turns gold when all of them are ready, so you can see before you present that everything is loaded.
5. **Sign-in notice.** If a Chamber viewer ends up on the sign-in page, its address strip says "Sign in to show live Chamber". The page also isn't counted as ready.
6. **Ease the startup jam without delaying anything.** All 19 viewers still start at once. Each embedded Chamber page skips its own entrance animations when shown inside the briefing, so the briefing wakes up sooner.

## Verification

- Fresh load, signed in: every embedded page starts within 1 second, and all green dots and the counter reach full without any scrolling. Then confirm the last Chamber and the last event viewer are already showing their page when you arrive.
- Fresh load, signed out: Chamber viewers show the sign-in notice, and the event viewers still finish.
- Reload button, the automatic retry, and no console errors.

## Technical details

- `src/components/present/PresentDeck.tsx`: an inline `<script>` placed before the steps adds `window.addEventListener('load', e => e.target.tagName==='IFRAME' && e.target.setAttribute('data-loaded','1'), true)`. Add the readiness counter, driven by a small shared store that viewers report into.
- `src/components/present/LiveFrame.tsx`: an iframe ref. On mount, read `data-loaded` and, for same-origin pages, `contentDocument.readyState === 'complete'`. Attach a native `load` listener. Add a 45s watchdog (one automatic `gen` bump, then an error state). Detect a same-origin `/auth` location and show the sign-in label.
- When embedded (`window.self !== window.top`), Chamber pages add a `data-embedded` class that turns off the `prs-`/`cjj-` entrance animations.
