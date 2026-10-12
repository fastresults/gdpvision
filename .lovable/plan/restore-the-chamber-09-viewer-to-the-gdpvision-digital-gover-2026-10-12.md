## Restore the Chamber 09 viewer to the GDPVision Digital Government Studio page

The Digital Government Studio slide (Chamber 09) in the briefing will show GDPVision's own Digital Government Studio page again: the page listing the Antigua & Barbuda e-government platform PRD. It will no longer load atg.gdpvision.com.

- The viewer's address bar will read `gdpvision.com/admin/countries/ATG/egov` again.
- It still starts loading as soon as the briefing opens. As before, you need to be signed in to see the page inside it.
- The separate "Digital government" section keeps loading atg.gdpvision.com, unchanged.

### Technical notes
- In `src/lib/present/chambers.ts`, change the Chamber 09 `path` back to `` `${base}/egov` ``.
- Keep the label logic in `PresentDeck.tsx`, which handles both full web addresses and in-app page addresses.
