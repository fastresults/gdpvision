Root cause confirmed: the visible **New scenario** link on the country portfolio detail page still points to the old generic `/instrument/scenarios/new` route. That generic Instrument route checks for country bindings and redirects users without bindings back to country onboarding, so admins are bounced away instead of opening the country-scoped Scenario Builder.

Plan:

1. **Fix the source link**
   - Change the Portfolio Workspace “New scenario” link from `/instrument/scenarios/new` to the country-scoped route `/admin/countries/$code/scenarios/new`.
   - Preserve the current ministry slug in search params so the builder opens already scoped to that ministry.

2. **Fix saved scenario links in the same section**
   - Change existing scenario artifact links from `/instrument/scenarios/$id` to `/admin/countries/$code/scenarios/$id` so users remain inside the country chamber instead of crossing into the old Instrument shell.

3. **Update the empty-state copy only if needed**
   - Keep the UI language intact unless the link destination change reveals misleading copy.

4. **Verify behavior in the live preview**
   - From `/admin/countries/ATG/portfolio/agriculture-land-fisheries-blue-economy`, confirm the link href becomes `/admin/countries/ATG/scenarios/new?ministry=agriculture-land-fisheries-blue-economy`.
   - Click it and confirm it opens the Scenario Builder, not onboarding.

Technical detail:
```text
Current broken link:
/admin/countries/ATG/portfolio/... -> /instrument/scenarios/new?ministry=...
/instrument loader -> no bindings -> redirect to /onboarding/country or /admin/countries

Correct link:
/admin/countries/ATG/portfolio/... -> /admin/countries/ATG/scenarios/new?ministry=...
country-scoped Scenario Engine route -> builder opens directly
```