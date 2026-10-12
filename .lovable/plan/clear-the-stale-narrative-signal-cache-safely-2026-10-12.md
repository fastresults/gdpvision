# Clear the stale Narrative signal cache safely

## Confirmed cause

The signal query changed from returning an array to returning `{ signals, total }`, but its cache key stayed unchanged. An already-open Narrative Chamber can therefore retain the old array under the same key. In that stale value, `total` is undefined, so formatting it with `toLocaleString()` throws the error. A fresh browser session worked because it had no old cached value.

## Plan

1. Version the Narrative signal query key so every open page fetches the new response shape instead of reusing the old array.
2. Add a defensive response normalizer at the UI boundary so an old cached array can never crash the page during hot updates or a rolling release.
3. Use the normalized full total everywhere it is formatted, and preserve the newest-200 rendering sample.
4. Verify the failure case by preloading the old array shape under the former key, then opening the Narrative Chamber and confirming it refetches and renders the full count without an exception.
5. Confirm the preview build and browser console are clean.
