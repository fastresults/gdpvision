# Connecting the new GDP Events website to GDPVision: a step-by-step guide

This guide needs no coding. Follow the steps in order. Each part says which project to open: **GDPVision** (this one) or **GDP Events** (the new one).

## Part A: Publish GDPVision (in GDPVision)
1. In the Lovable editor, click **Publish** in the top-right corner. On a phone, tap Preview, then the "..." menu, then Publish.
2. Click **Update** or **Publish** to confirm, then wait about a minute.
   Why: the new website can only read from the live GDPVision site.

## Part B: Create the new website (in Lovable)
3. Go to your Lovable dashboard and click **New project**.
4. Name it "GDP Events".
5. Publish it once, even while it is empty, so it gets a web address.
6. Copy that address, for example `https://gdp-events.lovable.app`, or your own domain if you connect one.

## Part C: Issue the key (in GDPVision)
7. Open the GDPVision site and sign in as an admin.
8. Go to **Admin**, then **Partner API**.
9. In the "Issue a key" box, click **Set up for GDP Events site** (top-right corner). The form fills itself in.
10. In **Allowed website origins**, paste the address from step 6.
11. Click **Issue key**.
12. Copy the key straight away. It starts with `gdpp_` and is shown only once. Paste it somewhere safe for a moment.

## Part D: Give the key to the new website (in GDP Events)
13. Open the GDP Events project.
14. In the chat, type: "Add a secret called GDPVISION_API_KEY."
15. A box will appear for the secret. Paste your key into it and save. Never paste the key into the chat itself.

## Part E: Build the website (in GDP Events)
16. Open the hand-over guide `docs/guides/gdp-events-site-handover.md` in GDPVision, and copy all of its text.
17. Paste it into the GDP Events chat, and add: "Build this site using GDPVISION_API_KEY on the server only."
18. Wait for the build, then check the preview. You should see the summits, their dates, speakers and partners.
19. Publish GDP Events.

## Part F: Test it
20. On the live GDP Events site, register for a summit using your own email.
21. In GDPVision, go to **Events Admin**, then **Registrations**. Your sign-up should be there, tagged "via GDP Events site".
22. Delete your test sign-up.

## Keeping it up to date
- To change a summit, edit it in GDPVision's **Events Admin**.
- Then go to **Site sync** and click **Sync to Second Brain**.
- The GDP Events site shows the change within a few minutes.

## If something goes wrong
- **No events show:** make sure GDPVision is published (Part A) and the summits are set to "Published" in Events Admin.
- **"Unauthorized" error:** the key is wrong or was revoked. Issue a new one (Part C) and update the secret (Part D).
- **The site is blocked:** the address in step 10 doesn't exactly match the site's address. Issue a new key with the correct address.
- **Lost the key:** keys can't be shown again. Revoke the old key on the Partner API page and issue a new one.

## Not yet working
- Confirmation emails won't send until an email sender domain is set up.
