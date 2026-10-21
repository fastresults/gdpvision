# Why the Partner API page shows 404

## Cause
Nothing is broken. The address typed into the preview has an extra part. The preview is trying to open:

`/dpvision.com/admin/partner-keys`

That's because "gdpvision.com" was typed into the preview's address box. The preview already adds the site's address, so this asks for a page called "dpvision.com", and that page doesn't exist.

## Fix (no changes to the site)
1. In the preview address box, delete everything after the first `/`.
2. Type only: `/admin/partner-keys`
3. Press Enter. If you're signed in as an admin, the Partner API page opens.

Or open `/admin` and click **Partner API** in the admin menu.

## On the live site
After you publish GDPVision, the full address `https://gdpvision.com/admin/partner-keys` will work in a normal browser tab.

## Optional improvement
Add a friendly "Page not found" message with links to Home and Admin, so a wrong address is easier to fix. Only if you want it.
