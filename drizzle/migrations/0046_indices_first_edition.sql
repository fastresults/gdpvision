-- Caribbean Indices: first official edition — owner decisions of 19 Oct 2026 (Adam Anderson).
--
-- 1. IMF World Economic Outlook series are parked (status pending_source).
--    IMF Copyright and Usage, Data terms: redistribution and derivative works are allowed with
--    attribution, but "commercial reuse" needs written permission (copyright@imf.org). GDP Advisor
--    is commercial (memberships, Investor Data Licence), so IMF values may not enter a published
--    edition until permission is granted. Parked indicators are not fetched and carry no values.
--    Effect on scores today: none — CGX cannot score yet (its diversification pillar has no live
--    sources). Reactivate by a later migration, with a method version bump, once permission is
--    granted, and set licence_status = 'confirmed'.
UPDATE public.index_indicators
   SET status = 'pending_source',
       notes  = concat_ws(' · ', notes,
                 'Parked 19 Oct 2026: IMF commercial reuse needs written permission (copyright@imf.org)')
 WHERE source_kind = 'imf_weo'
   AND status = 'active';

-- 2. Method v1 frozen for all four indexes, with the owner's waiver of the PRD's methodology-panel
--    ratification and 30-day lead before the data cut-off, so the first edition can be published.
--    Goalposts, weights and windows are unchanged from v0. The panel review still follows; any
--    change it makes ships as method v2 and a new numbered edition (published editions are never
--    overwritten).
UPDATE public.index_specs
   SET method_version = 1,
       method_status  = 'frozen',
       updated_at     = now()
 WHERE method_status <> 'frozen'
    OR method_version < 1;
