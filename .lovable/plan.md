The CIS ’27 item still has a saved stale favicon URL: `https://www.google.com/s2/favicons?domain=wikipedia.org&sz=64`. The previous change only filled missing favicons, so rows with an existing wrong favicon were skipped.

Plan:
1. Update the admin edit flow so changing an item URL does not keep sending the old favicon back to the server.
2. Update the favicon refresh server function to recompute icons for all auto-generated Google favicon URLs, not just blank ones, while preserving any future truly custom favicon URLs.
3. Backfill the existing CIS ’27 row so its saved favicon becomes `https://www.google.com/s2/favicons?domain=cis27.com&sz=64`.
4. Verify the saved row and kiosk tab now point at the CIS ’27 domain favicon instead of the stale W icon.