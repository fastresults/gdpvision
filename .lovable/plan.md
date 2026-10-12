## Make atg.gdpvision.com open inside the briefing viewer

### What I found
- The password **1234 is correct.** I typed it on atg.gdpvision.com in its own browser tab, and the full "Government services for Antigua and Barbuda" site opened.
- It fails only **inside the viewer**. The ATG site marks you as unlocked by saving a small note in your browser, called a cookie. Browsers block that cookie when the site is shown inside another website's page, as it is in the Lovable preview here. So the next time the site checks, it finds no note and treats you as locked. That is very likely why you saw "Incorrect password".
- atg.gdpvision.com is a separate Lovable project. Its password screen lives in that project, not in GDPVision.

### Recommended fix (made in the ATG project)
1. Open the ATG project and find its password-gate code.
2. Change that saved unlock note so browsers keep it when the site is shown inside another website's page, the way the briefing shows it. Technically, mark the cookie as allowed across sites and partitioned.
3. Republish the ATG site.
4. Check it from GDPVision: open the briefing, enter 1234 in the Chamber 09 viewer and in the Digital government viewer, and confirm both open the site. Check present.gdpvision.com as well.

### Optional extra, for a live presentation
Have the briefing open ATG already unlocked, so nobody types a password on screen. The ATG site would accept a private, time-limited pass placed in the viewer's address. The pass would be issued by the ATG project and expire after one day. This needs a small addition in the ATG project and a matching address in the briefing.

### What changes in GDPVision
Nothing for the main fix. With the optional extra, only the two viewer addresses change.

### Technical notes
- In the ATG project, change the session cookie to `sameSite: "none", secure: true, partitioned: true`. Partitioned cookies (CHIPS) are what Chrome and Safari keep for an embedded site.
- I'll use the cross-project tools to find and edit the ATG project, then republish it. If those tools can't edit it, I'll give you the exact change to make there.
