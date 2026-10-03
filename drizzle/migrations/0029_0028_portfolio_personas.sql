-- 0028 · Ideal Minister profiles (chamber 07, Persona Lab — Ministers track)
--
-- For each portfolio type (the Prime Minister, Tourism, Education, Housing,
-- Blue Economy, Finance …) the Lab casts 50 grounded composite personas of
-- ministers who have held, or could credibly hold, that office in a Caribbean
-- or small-island state; scores each against a fixed skill taxonomy; and
-- synthesises one Ideal Minister Profile: personality, values, how they decide
-- each class of decision the portfolio faces, and the skill stack the office
-- demands. A country overlay re-weights an approved regional profile for one
-- country. The Prime Minister's profile is built last, from its own personas
-- and from the approved profiles of the other portfolios.
--
--   1. ministry_portfolios — the canonical portfolio taxonomy (seeded), and a
--      portfolio code on every country ministry (seeded by name).
--   2. portfolio_skills — the canonical skill taxonomy (seeded). Personas may
--      only cite skills from this list; that is what makes synthesis countable.
--   3. portfolio_persona_sets, portfolio_personas, portfolio_persona_syntheses.
--      scope_key is 'REGIONAL' or a country code.
--   4. Approval: two-person rule with the sole-admin exception, as in 0014 and
--      0018. Regional profiles are approved by global admins; country overlays
--      by the country's approvers. Approval supersedes the previous version.
--      History to audit_log.

-- ---------------------------------------------------------------- 1 portfolios

CREATE TABLE IF NOT EXISTS public.ministry_portfolios (
  code text PRIMARY KEY,
  -- head_of_government (PM) | opposition (Leader of the Opposition) | ministry
  kind text NOT NULL DEFAULT 'ministry' CHECK (kind IN ('head_of_government','opposition','ministry')),
  label text NOT NULL,
  description text NOT NULL DEFAULT '',
  default_sector_codes text[] NOT NULL DEFAULT ARRAY[]::text[],
  -- [{ key, label, description }] — the classes of decision this office makes.
  decision_classes jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- [{ key, label, values[] }] — sampling axes beyond the common ones.
  matrix_axes jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Regex (case-insensitive, Postgres ARE; \m \M are word boundaries) used to
  -- map a country's ministries to this code.
  name_pattern text,
  first_wave boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ministry_portfolios TO authenticated;
GRANT ALL ON public.ministry_portfolios TO service_role;
ALTER TABLE public.ministry_portfolios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read ministry portfolios" ON public.ministry_portfolios;
CREATE POLICY "read ministry portfolios" ON public.ministry_portfolios FOR SELECT TO authenticated
  USING (true);

INSERT INTO public.ministry_portfolios
  (code, kind, label, description, default_sector_codes, decision_classes, matrix_axes, name_pattern, first_wave, sort_order)
VALUES
('PM', 'head_of_government', 'Prime Minister',
 'Head of Government: chairs Cabinet, sets the fiscal envelope, arbitrates between portfolios, leads in crisis and represents the state in CARICOM, the OECS and abroad.',
 ARRAY['public-administration','financial'],
 '[
   {"key":"cabinet_formation","label":"Cabinet formation and reshuffles","description":"Who holds which portfolio, when to move or remove a minister, and how to balance party, competence and region."},
   {"key":"fiscal_envelope","label":"The fiscal envelope","description":"The size of the budget and its allocation between ministries when every portfolio has a credible claim."},
   {"key":"security_emergency","label":"National security and emergency powers","description":"States of emergency, disaster command after a hurricane, and the use of the security forces."},
   {"key":"regional_treaty","label":"Regional and treaty positions","description":"CARICOM, OECS, CSME and bilateral positions, and the votes the state casts abroad."},
   {"key":"sovereign_debt","label":"Sovereign borrowing and debt","description":"New borrowing, restructuring, IMF programmes, and the terms the state will accept."},
   {"key":"investment_migration","label":"Investment migration and CBI posture","description":"Pricing, due diligence and the international scrutiny a citizenship-by-investment programme draws."},
   {"key":"election_timing","label":"Election timing and mandate","description":"When to call an election, and what to spend political capital on before and after."},
   {"key":"crisis_command","label":"Crisis command and public voice","description":"Being the voice of the government in a shock: pandemic, collapse in arrivals, a bank failure or a scandal."}
 ]'::jsonb,
 '[
   {"key":"route_to_premiership","label":"Route to the premiership","values":["party succession while in government","opposition leader who won","founder of a new party","technocrat drafted in","coalition compromise candidate"]},
   {"key":"mandate_strength","label":"Mandate strength","values":["landslide","comfortable majority","narrow majority","coalition","minority or caretaker"]},
   {"key":"held_portfolios","label":"Portfolios held concurrently","values":["none","Finance","National Security","Foreign Affairs","Finance and National Security","Investment and CBI"]}
 ]'::jsonb,
 '(prime minister|office of the (prime minister|premier)|premier''s office)', true, 1),

('LOO', 'opposition', 'Leader of the Opposition',
 'Leads the parliamentary opposition and the shadow Cabinet: scrutinises the government, offers the alternative programme, and cooperates on matters of national interest.',
 ARRAY['public-administration'],
 '[
   {"key":"shadow_cabinet","label":"Shadow Cabinet and party","description":"Who speaks for which portfolio, holding the party and the parliamentary group together, and succession."},
   {"key":"scrutiny","label":"Scrutiny of the government","description":"Questions, the Public Accounts Committee, motions and which government decisions to contest."},
   {"key":"alternative_programme","label":"The alternative programme","description":"What the opposition would do instead, costed, and when to publish it."},
   {"key":"national_interest","label":"Cooperation in the national interest","description":"When to stand with the government: hurricanes, CBI and correspondent-banking scrutiny, constitutional and regional questions."},
   {"key":"election_readiness","label":"Election readiness","description":"Candidates, constituencies, campaign finance and the timing of the challenge."},
   {"key":"public_voice","label":"Public voice and accountability","description":"How hard to attack, what to concede, and keeping credibility as a government-in-waiting."}
 ]'::jsonb,
 '[
   {"key":"route_to_leadership","label":"Route to leadership","values":["former Prime Minister","former minister","party organiser","new entrant from the professions","leader of a merged or new party"]},
   {"key":"parliamentary_strength","label":"Parliamentary strength","values":["sole opposition member","small minority","near-parity","appointed (no elected seats)"]},
   {"key":"time_in_opposition","label":"Time in opposition","values":["first term in opposition","second term","long-term opposition"]}
 ]'::jsonb,
 NULL, false, 2),
('FIN', 'ministry', 'Finance and Economic Planning',
 'Budget, tax, debt management, the public accounts and economic planning.',
 ARRAY['financial','public-administration'],
 '[
   {"key":"budget","label":"Budget preparation and in-year control","description":"Ceilings, supplementaries, and saying no to colleagues mid-year."},
   {"key":"tax_policy","label":"Tax policy and revenue administration","description":"Rates, concessions, VAT, compliance drives and the cost of exemptions."},
   {"key":"debt","label":"Debt and financing","description":"Domestic and external borrowing, market access, restructuring and IMF engagement."},
   {"key":"concessions","label":"Investment concessions","description":"Duty-free and tax-holiday packages, and who pays for them."},
   {"key":"financial_sector","label":"Financial-sector stability","description":"Banks, credit unions, insurers, de-risking and correspondent banking."}
 ]'::jsonb, '[]'::jsonb, '(financ|treasury|economic (planning|development)|budget)', true, 2),

('TOUR', 'ministry', 'Tourism and Aviation',
 'Destination marketing, airlift, cruise and stay-over policy, hotel investment and the visitor economy.',
 ARRAY['tourism','transport'],
 '[
   {"key":"airlift","label":"Airlift and route deals","description":"Revenue guarantees and incentives to airlines, and which routes to defend."},
   {"key":"marketing_spend","label":"Marketing spend and markets","description":"Budget allocation between source markets, events and channels."},
   {"key":"cruise_vs_stayover","label":"Cruise versus stay-over","description":"Berthing, head taxes, port investment and the trade-off with land-based tourism."},
   {"key":"hotel_concessions","label":"Hotel investment and concessions","description":"Which projects get land, duty relief and fast-tracking, and on what terms."},
   {"key":"tourism_crisis","label":"Crisis response","description":"Hurricanes, pandemics, crime incidents and travel advisories."}
 ]'::jsonb, '[]'::jsonb, '(touris|aviation|civil aviation|hospitality)', true, 3),

('EDUC', 'ministry', 'Education',
 'Early childhood to tertiary, the teaching service, curriculum, examinations and skills.',
 ARRAY['public-administration','other-services'],
 '[
   {"key":"curriculum","label":"Curriculum and examinations","description":"What is taught and assessed, CXC alignment, and reforms such as digital or TVET pathways."},
   {"key":"teaching_service","label":"The teaching service","description":"Recruitment, pay, unions, deployment and retention against migration."},
   {"key":"school_estate","label":"The school estate","description":"Building, repairing and rationalising schools, including after storms."},
   {"key":"tertiary_skills","label":"Tertiary and skills","description":"Funding for the state college or university campus, scholarships and labour-market fit."},
   {"key":"equity","label":"Access and equity","description":"Transport, meals, special needs and closing gaps between schools."}
 ]'::jsonb, '[]'::jsonb, '(educat|schools)', true, 4),

('HLTH', 'ministry', 'Health and Wellness',
 'Public hospitals and clinics, primary care, public health, health insurance and the health workforce.',
 ARRAY['public-administration','other-services'],
 '[
   {"key":"hospital_services","label":"Hospital services and capital","description":"New hospitals, equipment, overseas referrals and waiting lists."},
   {"key":"public_health","label":"Public health and NCDs","description":"Prevention, vector control, screening and the non-communicable-disease burden."},
   {"key":"health_financing","label":"Health financing","description":"National health insurance, user fees and pharmaceutical procurement."},
   {"key":"health_workforce","label":"The health workforce","description":"Nurses and doctors lost to migration, recruitment abroad and pay."},
   {"key":"health_emergency","label":"Health emergencies","description":"Outbreaks, pandemic measures and border health."}
 ]'::jsonb, '[]'::jsonb, '(health|wellness|medical)', true, 5),

('HOUS', 'ministry', 'Housing and Urban Development',
 'Public and affordable housing, land allocation, squatting regularisation and planning.',
 ARRAY['construction','real-estate'],
 '[
   {"key":"housing_supply","label":"Housing supply programmes","description":"How many units, where, built by whom, and at what subsidy."},
   {"key":"land_allocation","label":"Crown land allocation","description":"Who gets state land, at what price, and with what conditions."},
   {"key":"regularisation","label":"Informal settlement and regularisation","description":"Squatting, titling and relocation from hazard zones."},
   {"key":"mortgage_finance","label":"Mortgage finance","description":"State mortgage banks, guarantees and first-time-buyer support."},
   {"key":"planning_resilience","label":"Planning and building resilience","description":"Building codes, approvals and rebuilding after storms."}
 ]'::jsonb, '[]'::jsonb, '(housing|urban|lands|human settlement)', true, 6),

('BLUE', 'ministry', 'Blue Economy and Marine Resources',
 'Fisheries, the maritime domain, marine protected areas, ports and ocean-based industry.',
 ARRAY['blue-economy','agriculture','transport'],
 '[
   {"key":"marine_spatial","label":"Marine spatial planning and protected areas","description":"Zoning the ocean, protected areas and who may use what."},
   {"key":"fisheries_management","label":"Fisheries management","description":"Licensing, quotas, foreign fleets and support to fishers."},
   {"key":"blue_finance","label":"Blue finance","description":"Blue bonds, debt-for-nature swaps and climate finance for the ocean."},
   {"key":"maritime_industry","label":"Maritime industry and ports","description":"Ports, yachting, shipping registries and seabed or offshore proposals."},
   {"key":"coastal_resilience","label":"Coastal resilience","description":"Sargassum, erosion, reefs and the coast as infrastructure."}
 ]'::jsonb, '[]'::jsonb, '(blue economy|marine|maritime|ocean|fisher)', true, 7),

('AGRI', 'ministry', 'Agriculture and Food Security',
 'Farming, agro-processing, food import substitution, rural development and plant and animal health.',
 ARRAY['agriculture','manufacturing'],
 '[
   {"key":"food_security","label":"Food security and import substitution","description":"Which crops and livestock to back to cut the import bill."},
   {"key":"farmer_support","label":"Farmer support","description":"Inputs, credit, insurance and extension services."},
   {"key":"agri_land","label":"Agricultural land","description":"Leasing state estates, idle land and land-use conflict."},
   {"key":"sps","label":"Plant and animal health","description":"Pests, disease, standards and access to export markets."},
   {"key":"agri_investment","label":"Agro-processing investment","description":"Value-added projects and the incentives they need."}
 ]'::jsonb, '[]'::jsonb, '(agricultur|food|rural)', false, 8),

('ENER', 'ministry', 'Energy and Utilities',
 'Electricity, the utility, renewables, fuel imports and, where relevant, oil and gas.',
 ARRAY['energy'],
 '[
   {"key":"generation_mix","label":"Generation mix and renewables","description":"Solar, wind, geothermal and storage versus diesel and LNG."},
   {"key":"utility_governance","label":"The utility","description":"Tariffs, subsidies, ownership and the regulator."},
   {"key":"ipp_procurement","label":"Independent power procurement","description":"Licensing and contracting independent producers."},
   {"key":"fuel_pricing","label":"Fuel pricing and import","description":"Price-setting, taxes on fuel and supply security."},
   {"key":"extractives","label":"Extractives","description":"Licensing, local content and revenue management where oil, gas or minerals exist."}
 ]'::jsonb, '[]'::jsonb, '(energy|utilit|electric|public utilities|petroleum)', false, 9),

('DIGI', 'ministry', 'Digital Transformation and ICT',
 'E-government, digital identity, connectivity, data and the digital economy.',
 ARRAY['digital','public-administration'],
 '[
   {"key":"egov","label":"E-government services","description":"Which services go online first, built how, and by whom."},
   {"key":"digital_id","label":"Digital identity and data","description":"National ID, data protection and data sharing across government."},
   {"key":"connectivity","label":"Connectivity and telecoms","description":"Spectrum, broadband targets and the telecoms regulator."},
   {"key":"digital_economy","label":"Digital economy","description":"Start-ups, BPO, digital nomads and AI policy."},
   {"key":"cyber","label":"Cybersecurity","description":"Protecting government systems and critical infrastructure."}
 ]'::jsonb, '[]'::jsonb, '(digital|information|\mict\M|technolog|telecom|innovation)', false, 10),

('NSEC', 'ministry', 'National Security',
 'Police, defence force, coast guard, prisons, immigration and border control.',
 ARRAY['public-administration'],
 '[
   {"key":"crime","label":"Crime strategy","description":"Violent crime, gangs, firearms and the policing model."},
   {"key":"border","label":"Border and immigration control","description":"Ports of entry, irregular migration and visa policy."},
   {"key":"forces","label":"The security forces","description":"Resources, leadership and conduct of the police and defence force."},
   {"key":"justice_chain","label":"Prisons and the justice chain","description":"Remand, prisons, rehabilitation and case backlogs."},
   {"key":"security_cooperation","label":"Security cooperation","description":"RSS, CARICOM IMPACS and partnerships with larger states."}
 ]'::jsonb, '[]'::jsonb, '(national security|police|defen[cs]e|home affairs|public safety|immigration)', false, 11),

('FOR', 'ministry', 'Foreign Affairs and Trade Diplomacy',
 'Diplomatic relations, missions abroad, the diaspora, and trade and regional negotiations.',
 ARRAY['public-administration'],
 '[
   {"key":"alignments","label":"Alignments and partners","description":"Relations with the US, UK, EU, China, Venezuela, Taiwan and the Gulf, and the votes that follow."},
   {"key":"regional","label":"Regional integration","description":"CARICOM, OECS, CSME commitments and free movement."},
   {"key":"diaspora","label":"Diaspora engagement","description":"Remittances, diaspora bonds, voting and return migration."},
   {"key":"missions","label":"Missions abroad","description":"Where to keep embassies and honorary consuls on a small budget."},
   {"key":"trade_negotiation","label":"Trade negotiation","description":"Trade agreements, preferences and market access."}
 ]'::jsonb, '[]'::jsonb, '(foreign|external affairs|international|diaspora)', false, 12),

('LEG', 'ministry', 'Legal Affairs and Justice',
 'The Attorney General''s chambers, legislative drafting, the courts and law reform.',
 ARRAY['public-administration'],
 '[
   {"key":"legislative_agenda","label":"Legislative agenda","description":"Which bills are drafted first with a small drafting unit."},
   {"key":"courts","label":"Courts and access to justice","description":"Backlogs, legal aid and court administration."},
   {"key":"constitution","label":"Constitutional reform","description":"Republic questions, CCJ accession and electoral law."},
   {"key":"state_litigation","label":"Litigation for and against the state","description":"Settling or fighting claims, and arbitration with investors."},
   {"key":"compliance_listing","label":"International compliance","description":"FATF, EU and OECD lists, AML and beneficial ownership."}
 ]'::jsonb, '[]'::jsonb, '(legal affairs|justice|attorney.general|law reform)', false, 13),

('ENV', 'ministry', 'Environment and Climate Resilience',
 'Environmental protection, climate adaptation, disaster risk and access to climate finance.',
 ARRAY['public-administration','blue-economy'],
 '[
   {"key":"adaptation","label":"Adaptation investment","description":"Which adaptation projects to fund and in what order."},
   {"key":"climate_finance","label":"Climate finance access","description":"GCF, loss and damage, and accreditation of national entities."},
   {"key":"eia","label":"Environmental approvals","description":"Impact assessments for hotels, ports and mines, and when to say no."},
   {"key":"waste","label":"Waste and pollution","description":"Landfills, plastics bans and water quality."},
   {"key":"climate_diplomacy","label":"Climate diplomacy","description":"The state''s voice at the COP and in AOSIS."}
 ]'::jsonb, '[]'::jsonb, '(environment|climate|resilience|sustainab|disaster)', false, 14),

('WORKS', 'ministry', 'Infrastructure and Public Works',
 'Roads, bridges, public buildings, water and drainage, and the capital works programme.',
 ARRAY['construction','transport'],
 '[
   {"key":"capital_programme","label":"Capital programme priorities","description":"Which roads, bridges and buildings are funded first."},
   {"key":"procurement","label":"Procurement and contractors","description":"Tendering, local contractors and cost overruns."},
   {"key":"maintenance","label":"Maintenance versus new build","description":"Keeping what exists running against cutting ribbons."},
   {"key":"water","label":"Water and drainage","description":"Supply, desalination, flooding and drainage."},
   {"key":"ppp","label":"Public-private partnerships","description":"When to use a PPP and how to manage the contingent liability."}
 ]'::jsonb, '[]'::jsonb, '(works|infrastructure|transport|roads|public utilities and works)', false, 15),

('TRADE', 'ministry', 'Trade, Investment and Industry',
 'Investment promotion, industry, small business, consumer affairs and export development.',
 ARRAY['manufacturing','financial','other-services'],
 '[
   {"key":"investment_promotion","label":"Investment promotion","description":"Target sectors, the investment agency and the pipeline."},
   {"key":"msme","label":"Small business","description":"Finance, registration and support for MSMEs."},
   {"key":"export","label":"Export development","description":"Which exports to back and how."},
   {"key":"business_climate","label":"Ease of doing business","description":"Licensing, company registry and red tape."},
   {"key":"consumer","label":"Consumer affairs and prices","description":"Price controls, competition and cost of living."}
 ]'::jsonb, '[]'::jsonb, '(trade|commerce|industry|investment|enterprise|business)', false, 16),

('LAB', 'ministry', 'Labour and Social Security',
 'Employment law, industrial relations, social security and labour migration.',
 ARRAY['public-administration'],
 '[
   {"key":"industrial_relations","label":"Industrial relations","description":"Public-sector pay, strikes and the social partnership."},
   {"key":"employment_law","label":"Employment law","description":"Minimum wage, severance and labour standards."},
   {"key":"social_security","label":"Social security","description":"Pension reform and the sustainability of the scheme."},
   {"key":"labour_migration","label":"Labour migration","description":"Work permits, CSME skills certificates and seasonal work abroad."},
   {"key":"jobs","label":"Jobs programmes","description":"Public employment schemes and their exit."}
 ]'::jsonb, '[]'::jsonb, '(labour|labor|employment|social security|public service)', false, 17),

('SOC', 'ministry', 'Social Development and Family',
 'Social protection, poverty, gender, the elderly, children and people with disabilities.',
 ARRAY['public-administration','other-services'],
 '[
   {"key":"cash_transfers","label":"Social protection and cash transfers","description":"Targeting, adequacy and shock-responsive transfers."},
   {"key":"child_protection","label":"Children and families","description":"Child protection, early childhood and family services."},
   {"key":"ageing","label":"Ageing","description":"Care for the elderly and pensions for those outside the scheme."},
   {"key":"gender_inclusion","label":"Gender and inclusion","description":"Gender policy, disability and inclusion."},
   {"key":"community","label":"Community development","description":"Community programmes and NGOs as delivery partners."}
 ]'::jsonb, '[]'::jsonb, '(social|family|gender|community|poverty|human services)', false, 18),

('YOUTH', 'ministry', 'Youth, Sports and Culture',
 'Youth development, sport, the creative industries, culture and national events.',
 ARRAY['other-services','tourism'],
 '[
   {"key":"youth_employment","label":"Youth employment and enterprise","description":"Programmes that get young people into work or business."},
   {"key":"sport","label":"Sport and facilities","description":"Facilities, elite athletes and hosting events."},
   {"key":"creative_economy","label":"Creative economy","description":"Music, carnival, film and the creative industries as an export."},
   {"key":"heritage","label":"Heritage and culture","description":"Heritage sites, festivals and national identity."},
   {"key":"youth_risk","label":"Youth at risk","description":"Prevention programmes that keep young people out of crime."}
 ]'::jsonb, '[]'::jsonb, '\m(youth|sports?|culture|creative|arts)\M', false, 19)
ON CONFLICT (code) DO UPDATE SET
  kind = EXCLUDED.kind, label = EXCLUDED.label, description = EXCLUDED.description,
  default_sector_codes = EXCLUDED.default_sector_codes, decision_classes = EXCLUDED.decision_classes,
  matrix_axes = EXCLUDED.matrix_axes, name_pattern = EXCLUDED.name_pattern,
  first_wave = EXCLUDED.first_wave, sort_order = EXCLUDED.sort_order, updated_at = now();

-- Every country ministry carries a primary portfolio code and any secondary
-- codes (compound ministries: "Tourism, Civil Aviation and Investment").
ALTER TABLE public.ministries ADD COLUMN IF NOT EXISTS portfolio_code text
  REFERENCES public.ministry_portfolios(code) ON DELETE SET NULL;
ALTER TABLE public.ministries ADD COLUMN IF NOT EXISTS secondary_portfolio_codes text[]
  NOT NULL DEFAULT ARRAY[]::text[];

-- First mapping by name. Primary = the first pattern that matches in
-- sort order; secondaries = every other match. Only fills blanks.
WITH matches AS (
  SELECT m.id, p.code, p.sort_order,
         row_number() OVER (PARTITION BY m.id ORDER BY p.sort_order) AS rn
  FROM public.ministries m
  JOIN public.ministry_portfolios p ON p.name_pattern IS NOT NULL AND m.name ~* p.name_pattern
)
UPDATE public.ministries m SET
  portfolio_code = (SELECT code FROM matches x WHERE x.id = m.id AND x.rn = 1),
  secondary_portfolio_codes = COALESCE(
    (SELECT array_agg(code ORDER BY sort_order) FROM matches x WHERE x.id = m.id AND x.rn > 1),
    ARRAY[]::text[])
WHERE m.portfolio_code IS NULL
  AND EXISTS (SELECT 1 FROM matches x WHERE x.id = m.id);

-- Who may map a country's ministries to portfolios.
CREATE OR REPLACE FUNCTION public.set_ministry_portfolio(_ministry_id uuid, _primary text, _secondary text[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cc text;
BEGIN
  SELECT country_code INTO cc FROM public.ministries WHERE id = _ministry_id;
  IF cc IS NULL THEN RAISE EXCEPTION 'That ministry was not found.'; END IF;
  IF NOT public.has_country_role(auth.uid(), cc,
       ARRAY['country_admin','data_steward','cabinet_secretary']::public.app_role[]) THEN
    RAISE EXCEPTION 'Only the country admin, a data steward or the Cabinet Secretary can map ministries.';
  END IF;
  UPDATE public.ministries SET
    portfolio_code = NULLIF(_primary, ''),
    secondary_portfolio_codes = COALESCE(array_remove(_secondary, NULLIF(_primary, '')), ARRAY[]::text[]),
    updated_at = now()
  WHERE id = _ministry_id;
  PERFORM public.log_governance('ministry.portfolio_mapped', 'ministry', _ministry_id::text, cc,
    jsonb_build_object('primary', _primary, 'secondary', to_jsonb(_secondary)));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.set_ministry_portfolio(uuid, text, text[]) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.set_ministry_portfolio(uuid, text, text[]) TO authenticated, service_role;

-- ---------------------------------------------------------------- 2 skills

CREATE TABLE IF NOT EXISTS public.portfolio_skills (
  code text PRIMARY KEY,
  family text NOT NULL CHECK (family IN
    ('domain','policy','fiscal','stakeholder','communication','leadership','digital')),
  label text NOT NULL,
  definition text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.portfolio_skills TO authenticated;
GRANT ALL ON public.portfolio_skills TO service_role;
ALTER TABLE public.portfolio_skills ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read portfolio skills" ON public.portfolio_skills;
CREATE POLICY "read portfolio skills" ON public.portfolio_skills FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "admin writes portfolio skills" ON public.portfolio_skills;
CREATE POLICY "admin writes portfolio skills" ON public.portfolio_skills FOR ALL TO authenticated
  USING (public.has_country_role(auth.uid(), '__global__', ARRAY[]::public.app_role[]))
  WITH CHECK (public.has_country_role(auth.uid(), '__global__', ARRAY[]::public.app_role[]));

INSERT INTO public.portfolio_skills (code, family, label, definition, sort_order) VALUES
-- domain
('dom.sector_economics','domain','Sector economics','Understands how the portfolio''s sectors make money, employ people and earn foreign exchange.',1),
('dom.technical_literacy','domain','Technical literacy in the portfolio','Can read a technical brief (engineering, clinical, actuarial, marine science) and question it.',2),
('dom.comparative_practice','domain','Comparative practice','Knows what comparable small states have tried, and why it worked or failed.',3),
('dom.institutional_memory','domain','Institutional memory','Knows the ministry''s history, past reforms and why they stalled.',4),
('dom.risk_hazard','domain','Hazard and risk literacy','Understands hurricanes, sea-level rise, pandemics and shocks as they hit the portfolio.',5),
('dom.regulation','domain','Regulatory design','Knows how to regulate an industry without strangling or capturing it.',6),
('dom.data_evidence','domain','Use of evidence','Asks for the number behind a claim, and knows when the data are too weak to act on.',7),
('dom.land_assets','domain','State land and assets','Understands Crown land, state enterprises and the value of public assets.',8),
('dom.international_standards','domain','International standards','Knows the standards, lists and rankings the portfolio is judged by.',9),
('dom.labour_market','domain','Labour-market awareness','Understands skills shortages, migration of talent and wage pressure.',10),
-- policy
('pol.policy_design','policy','Policy design','Turns an objective into a policy with instruments, targets and an exit.',20),
('pol.legislative_craft','policy','Legislative craft','Gets bills drafted, through Cabinet and through Parliament.',21),
('pol.cabinet_paper','policy','Cabinet paper discipline','Brings decisions to Cabinet with options, costs and a recommendation.',22),
('pol.implementation','policy','Implementation follow-through','Tracks delivery after the announcement and unblocks it.',23),
('pol.prioritisation','policy','Prioritisation','Chooses a few things and says no to the rest.',24),
('pol.sequencing','policy','Sequencing','Orders reforms so early wins fund and protect later ones.',25),
('pol.regulatory_reform','policy','Regulatory reform','Removes or simplifies rules that cost more than they protect.',26),
('pol.institutional_reform','policy','Institutional reform','Restructures agencies and statutory bodies without breaking service.',27),
('pol.monitoring','policy','Monitoring and evaluation','Sets KPIs with baselines and reads them honestly.',28),
('pol.crisis_planning','policy','Crisis planning','Prepares plans and stand-by arrangements before the shock.',29),
-- fiscal
('fis.budget_negotiation','fiscal','Budget negotiation','Wins resources from Finance with a credible case, and lives within them.',40),
('fis.public_finance','fiscal','Public financial management','Understands appropriations, virement, arrears and the audit trail.',41),
('fis.procurement','fiscal','Procurement integrity','Runs or oversees procurement that is fast, fair and defensible.',42),
('fis.project_appraisal','fiscal','Project appraisal','Judges a capital project''s cost, benefit and risk before committing.',43),
('fis.concessions','fiscal','Concession judgement','Knows the true cost of a tax holiday or duty waiver and prices it.',44),
('fis.revenue','fiscal','Revenue generation','Finds fees, levies and earned income without choking activity.',45),
('fis.debt_literacy','fiscal','Debt literacy','Understands borrowing terms, contingent liabilities and debt sustainability.',46),
('fis.donor_finance','fiscal','Development-finance access','Raises grants and concessional loans from CDB, World Bank, IDB, GCF and bilateral partners.',47),
('fis.ppp','fiscal','PPP and private capital','Structures partnerships that bring private money without hidden liabilities.',48),
('fis.cost_discipline','fiscal','Cost discipline','Controls overruns and recurrent costs.',49),
-- stakeholder
('stk.cabinet_alliances','stakeholder','Cabinet alliances','Builds support among Cabinet colleagues for the portfolio''s priorities.',60),
('stk.party_management','stakeholder','Party management','Keeps the party and the parliamentary group on side.',61),
('stk.private_sector','stakeholder','Private-sector partnership','Works with chambers, investors and industry associations without capture.',62),
('stk.unions','stakeholder','Union relations','Negotiates with unions and keeps the social partnership intact.',63),
('stk.civil_society','stakeholder','Civil-society engagement','Works with churches, NGOs and community groups.',64),
('stk.diaspora','stakeholder','Diaspora engagement','Mobilises the diaspora''s money, skills and voice.',65),
('stk.regional_diplomacy','stakeholder','Regional diplomacy','Works the CARICOM and OECS system to the state''s advantage.',66),
('stk.international_partners','stakeholder','International partners','Manages relations with multilaterals, donors and larger states.',67),
('stk.opposition','stakeholder','Working with the opposition','Builds bipartisan support where a reform must outlast an election.',68),
('stk.constituency','stakeholder','Constituency service','Holds the seat while carrying a national portfolio.',69),
('stk.negotiation','stakeholder','Negotiation','Negotiates with investors, airlines, lenders or unions from a small state''s position.',70),
-- communication
('com.public_explanation','communication','Public explanation','Explains a hard decision plainly to the public.',80),
('com.crisis_voice','communication','Crisis communication','Is calm, factual and present in a crisis.',81),
('com.media','communication','Media handling','Handles press, talk radio and hostile interviews.',82),
('com.social_media','communication','Social-media fluency','Uses social media to inform, not just to campaign.',83),
('com.parliamentary','communication','Parliamentary performance','Defends the portfolio in Parliament and in committee.',84),
('com.narrative','communication','Narrative and vision','Gives the portfolio a story people can repeat.',85),
('com.listening','communication','Listening','Hears complaints and dissent before they become crises.',86),
('com.international_voice','communication','International voice','Represents the state credibly abroad and to investors.',87),
-- leadership
('lead.decisiveness','leadership','Decisiveness','Decides on time with the information available.',100),
('lead.integrity','leadership','Integrity','Avoids conflicts of interest and is seen to.',101),
('lead.ps_relationship','leadership','Working with the Permanent Secretary','Leads the civil service without bypassing or fighting it.',102),
('lead.talent','leadership','Talent and team','Recruits and keeps good advisers and technical staff.',103),
('lead.accountability','leadership','Accountability','Owns failures and reports results honestly.',104),
('lead.resilience','leadership','Personal resilience','Holds steady under pressure and criticism.',105),
('lead.long_horizon','leadership','Long-horizon thinking','Plans beyond the electoral cycle.',106),
('lead.change_management','leadership','Change management','Takes staff and public through change.',107),
('lead.delegation','leadership','Delegation','Lets agencies and officials do their jobs and holds them to account.',108),
('lead.political_judgement','leadership','Political judgement','Reads what is possible, when, and at what cost.',109),
('lead.ethical_courage','leadership','Ethical courage','Refuses a popular or lucrative decision that is wrong.',110),
('lead.coalition_building','leadership','Coalition building','Assembles a coalition for a reform across interests.',111),
-- digital
('dig.data_driven','digital','Data-driven management','Runs the portfolio on dashboards and data, not anecdote.',120),
('dig.digital_services','digital','Digital service delivery','Pushes services online and judges them by the user''s experience.',121),
('dig.ai_literacy','digital','AI literacy','Understands what AI can and cannot do for the portfolio, and its risks.',122),
('dig.cyber_awareness','digital','Cyber awareness','Treats data protection and cyber risk as ministerial responsibilities.',123),
('dig.digital_economy','digital','Digital-economy vision','Sees how digital changes the portfolio''s industries and jobs.',124),
('dig.open_data','digital','Open data and transparency','Publishes data and decisions so the public can check them.',125)
ON CONFLICT (code) DO UPDATE SET family = EXCLUDED.family, label = EXCLUDED.label,
  definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order;

-- ---------------------------------------------------------------- 3 sets, personas, syntheses

-- Who may approve a profile: global admins for regional profiles, the
-- country's approvers (as chamber 10) for a country overlay.
CREATE OR REPLACE FUNCTION public.can_approve_portfolio(_user_id uuid, _scope text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN _scope = 'REGIONAL'
    THEN EXISTS (SELECT 1 FROM public.user_roles
                 WHERE user_id = _user_id AND role = 'admin'::public.app_role AND country_code IS NULL)
    ELSE public.can_approve_sector(_user_id, _scope) END;
$$;
REVOKE EXECUTE ON FUNCTION public.can_approve_portfolio(uuid, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.can_approve_portfolio(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.can_sole_approve_portfolio(_user_id uuid, _scope text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN _scope = 'REGIONAL'
    THEN public.can_approve_portfolio(_user_id, _scope)
     AND NOT EXISTS (SELECT 1 FROM public.user_roles
                     WHERE user_id <> _user_id AND role = 'admin'::public.app_role AND country_code IS NULL)
    ELSE public.can_sole_approve_sector(_user_id, _scope) END;
$$;
REVOKE EXECUTE ON FUNCTION public.can_sole_approve_portfolio(uuid, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.can_sole_approve_portfolio(uuid, text) TO authenticated, service_role;

-- Who may read and write a set's working rows.
CREATE OR REPLACE FUNCTION public.can_read_portfolio_scope(_user_id uuid, _scope text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _scope = 'REGIONAL' OR public.has_country_access(_user_id, _scope);
$$;
CREATE OR REPLACE FUNCTION public.can_write_portfolio_scope(_user_id uuid, _scope text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN _scope = 'REGIONAL'
    THEN public.can_approve_portfolio(_user_id, _scope)
    ELSE public.has_country_access(_user_id, _scope) END;
$$;
REVOKE EXECUTE ON FUNCTION public.can_read_portfolio_scope(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_write_portfolio_scope(uuid, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.can_read_portfolio_scope(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_write_portfolio_scope(uuid, text) TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.portfolio_persona_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_code text NOT NULL REFERENCES public.ministry_portfolios(code),
  -- 'REGIONAL' or a country code.
  scope_key text NOT NULL,
  -- regional: 50 personas → profile. overlay: re-weights an approved regional
  -- profile (base_set_id) for one country; it has no personas of its own.
  kind text NOT NULL DEFAULT 'regional' CHECK (kind IN ('regional','overlay')),
  base_set_id uuid REFERENCES public.portfolio_persona_sets(id) ON DELETE SET NULL,
  version integer NOT NULL DEFAULT 1,
  title text NOT NULL,
  target_size integer NOT NULL DEFAULT 50 CHECK (target_size BETWEEN 10 AND 50),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','submitted','approved','returned','superseded')),
  -- The run: scope → matrix → generate → qa → aggregate → synthesise → done
  -- (overlay: scope → overlay → done).
  phase text NOT NULL DEFAULT 'scope'
    CHECK (phase IN ('scope','matrix','generate','qa','aggregate','synthesise','overlay','done')),
  run_state text NOT NULL DEFAULT 'idle' CHECK (run_state IN ('idle','running','failed','done')),
  lock_until timestamptz,
  run_error text,
  -- [{ phase, state, ts, duration_ms, model, summary, error }]
  phase_log jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- { axes: [{ key, label, values[] }], cells: [{ slot, cell: { axis: value } }] }
  design_matrix jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- The context lines the run was grounded on: [{ key, text, source }]
  context jsonb NOT NULL DEFAULT '[]'::jsonb,
  context_hash text,
  -- [{ label, family, definition, proposed_by_slots[] }] — skills the model
  -- wanted that the taxonomy lacks, for a person to promote.
  proposed_skills jsonb NOT NULL DEFAULT '[]'::jsonb,
  model text,
  created_by uuid DEFAULT auth.uid(),
  submitted_by uuid,
  submitted_at timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  approval_mode text CHECK (approval_mode IS NULL OR approval_mode IN ('two_person','sole_admin')),
  returned_by uuid,
  returned_at timestamptz,
  returned_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (portfolio_code, scope_key, version)
);
CREATE INDEX IF NOT EXISTS portfolio_persona_sets_scope_idx
  ON public.portfolio_persona_sets (scope_key, portfolio_code, version DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portfolio_persona_sets TO authenticated;
GRANT ALL ON public.portfolio_persona_sets TO service_role;
ALTER TABLE public.portfolio_persona_sets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read portfolio persona sets" ON public.portfolio_persona_sets;
CREATE POLICY "read portfolio persona sets" ON public.portfolio_persona_sets FOR SELECT TO authenticated
  USING (public.can_read_portfolio_scope(auth.uid(), scope_key));
DROP POLICY IF EXISTS "write portfolio persona sets" ON public.portfolio_persona_sets;
CREATE POLICY "write portfolio persona sets" ON public.portfolio_persona_sets FOR ALL TO authenticated
  USING (public.can_write_portfolio_scope(auth.uid(), scope_key))
  WITH CHECK (public.can_write_portfolio_scope(auth.uid(), scope_key));

CREATE TABLE IF NOT EXISTS public.portfolio_personas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id uuid NOT NULL REFERENCES public.portfolio_persona_sets(id) ON DELETE CASCADE,
  scope_key text NOT NULL,
  slot_index integer NOT NULL CHECK (slot_index BETWEEN 1 AND 50),
  matrix_cell jsonb NOT NULL DEFAULT '{}'::jsonb,
  name text NOT NULL,
  archetype text NOT NULL DEFAULT '',
  career_route text NOT NULL DEFAULT '',
  summary text NOT NULL DEFAULT '',
  -- { age_band, formation, prior_roles[], constituency, political_capital, network, values[], signature_moves[] }
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- { openness, conscientiousness, extraversion, agreeableness, neuroticism } each 0–100
  ocean jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- { horizon, risk_posture, evidence_weight, consultation_breadth, speed } each 1–5, plus { style }
  decision_style jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- [{ code, proficiency (1–5), rationale }]
  skills jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- [{ key, label, ref, why }]
  citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- { similarity, nearest_slot, real_person_flag, notes[], retries }
  qa jsonb NOT NULL DEFAULT '{}'::jsonb,
  normalized_key text NOT NULL DEFAULT '',
  model text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (set_id, slot_index)
);
CREATE INDEX IF NOT EXISTS portfolio_personas_set_idx ON public.portfolio_personas (set_id, slot_index);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portfolio_personas TO authenticated;
GRANT ALL ON public.portfolio_personas TO service_role;
ALTER TABLE public.portfolio_personas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read portfolio personas" ON public.portfolio_personas;
CREATE POLICY "read portfolio personas" ON public.portfolio_personas FOR SELECT TO authenticated
  USING (public.can_read_portfolio_scope(auth.uid(), scope_key));
DROP POLICY IF EXISTS "write portfolio personas" ON public.portfolio_personas;
CREATE POLICY "write portfolio personas" ON public.portfolio_personas FOR ALL TO authenticated
  USING (public.can_write_portfolio_scope(auth.uid(), scope_key))
  WITH CHECK (public.can_write_portfolio_scope(auth.uid(), scope_key));

CREATE TABLE IF NOT EXISTS public.portfolio_persona_syntheses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id uuid NOT NULL UNIQUE REFERENCES public.portfolio_persona_sets(id) ON DELETE CASCADE,
  scope_key text NOT NULL,
  portfolio_code text NOT NULL REFERENCES public.ministry_portfolios(code),
  -- Computed, not generated: skill frequency × proficiency, OCEAN bands,
  -- decision-style distributions, career-route mix.
  aggregates jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- The Ideal Minister Profile (see src/lib/personas/portfolio/db.ts).
  profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  narrative_md text NOT NULL DEFAULT '',
  citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Prime Minister only: the approved ministry syntheses this was built from.
  input_synthesis_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  model text,
  edited_by uuid,
  edited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS portfolio_persona_syntheses_scope_idx
  ON public.portfolio_persona_syntheses (scope_key, portfolio_code);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portfolio_persona_syntheses TO authenticated;
GRANT ALL ON public.portfolio_persona_syntheses TO service_role;
ALTER TABLE public.portfolio_persona_syntheses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read portfolio syntheses" ON public.portfolio_persona_syntheses;
CREATE POLICY "read portfolio syntheses" ON public.portfolio_persona_syntheses FOR SELECT TO authenticated
  USING (public.can_read_portfolio_scope(auth.uid(), scope_key));
DROP POLICY IF EXISTS "write portfolio syntheses" ON public.portfolio_persona_syntheses;
CREATE POLICY "write portfolio syntheses" ON public.portfolio_persona_syntheses FOR ALL TO authenticated
  USING (public.can_write_portfolio_scope(auth.uid(), scope_key))
  WITH CHECK (public.can_write_portfolio_scope(auth.uid(), scope_key));

-- ---------------------------------------------------------------- 4 governance

CREATE OR REPLACE FUNCTION public.portfolio_persona_sets_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  actor uuid := auth.uid();
  changed boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF actor IS NOT NULL AND OLD.status NOT IN ('draft','returned','superseded') THEN
      RAISE EXCEPTION 'Only a draft, returned or superseded profile can be deleted. Withdraw or reopen it first.';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.scope_key <> 'REGIONAL' AND NOT EXISTS (SELECT 1 FROM public.countries WHERE code = NEW.scope_key) THEN
      RAISE EXCEPTION 'Unknown scope %.', NEW.scope_key;
    END IF;
    IF NEW.kind = 'overlay' AND NEW.scope_key = 'REGIONAL' THEN
      RAISE EXCEPTION 'A country overlay must name a country.';
    END IF;
    IF actor IS NOT NULL THEN NEW.status := 'draft'; END IF;
    NEW.created_by := COALESCE(actor, NEW.created_by);
    NEW.version := COALESCE((SELECT max(version) FROM public.portfolio_persona_sets
                             WHERE portfolio_code = NEW.portfolio_code AND scope_key = NEW.scope_key), 0) + 1;
    NEW.submitted_by := NULL; NEW.submitted_at := NULL;
    NEW.approved_by := NULL; NEW.approved_at := NULL; NEW.approval_mode := NULL;
    NEW.returned_by := NULL; NEW.returned_at := NULL; NEW.returned_note := NULL;
    RETURN NEW;
  END IF;

  IF NEW.portfolio_code IS DISTINCT FROM OLD.portfolio_code OR NEW.scope_key IS DISTINCT FROM OLD.scope_key
     OR NEW.kind IS DISTINCT FROM OLD.kind THEN
    RAISE EXCEPTION 'A profile cannot be moved to another portfolio or scope.';
  END IF;
  NEW.updated_at := now();
  IF actor IS NULL THEN RETURN NEW; END IF;

  -- Content that, if changed, invalidates a review.
  changed := (NEW.title, NEW.design_matrix, NEW.target_size) IS DISTINCT FROM
             (OLD.title, OLD.design_matrix, OLD.target_size);

  NEW.created_by := OLD.created_by; NEW.version := OLD.version;
  NEW.submitted_by := OLD.submitted_by; NEW.submitted_at := OLD.submitted_at;
  NEW.approved_by := OLD.approved_by; NEW.approved_at := OLD.approved_at;
  NEW.approval_mode := OLD.approval_mode;
  NEW.returned_by := OLD.returned_by; NEW.returned_at := OLD.returned_at;
  IF NOT (NEW.status = 'returned' AND OLD.status = 'submitted') THEN
    NEW.returned_note := OLD.returned_note;
  END IF;

  IF NEW.status = OLD.status THEN
    IF OLD.status IN ('submitted','approved')
       AND (changed OR NEW.phase IS DISTINCT FROM OLD.phase) THEN
      RAISE EXCEPTION 'This profile is under review or approved. Reopen it before changing it.';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status IN ('draft','returned') AND NEW.status = 'submitted' THEN
    IF NEW.phase <> 'done' OR NOT EXISTS (
         SELECT 1 FROM public.portfolio_persona_syntheses s WHERE s.set_id = NEW.id
           AND s.profile <> '{}'::jsonb) THEN
      RAISE EXCEPTION 'Finish the run and the synthesis before submitting this profile.';
    END IF;
    NEW.submitted_by := actor; NEW.submitted_at := now();
    NEW.returned_by := NULL; NEW.returned_at := NULL;

  ELSIF OLD.status = 'submitted' AND NEW.status = 'approved' THEN
    IF changed THEN RAISE EXCEPTION 'Approving cannot change the profile. Return it with a note instead.'; END IF;
    IF NOT public.can_approve_portfolio(actor, OLD.scope_key) THEN
      RAISE EXCEPTION 'You do not hold an approver role for this scope.';
    END IF;
    IF actor = OLD.submitted_by THEN
      IF NOT public.can_sole_approve_portfolio(actor, OLD.scope_key) THEN
        RAISE EXCEPTION 'Two-person rule: the person who submitted this profile cannot approve it.';
      END IF;
      NEW.approval_mode := 'sole_admin';
    ELSE
      NEW.approval_mode := 'two_person';
    END IF;
    NEW.approved_by := actor; NEW.approved_at := now();
    UPDATE public.portfolio_persona_sets SET status = 'superseded'
      WHERE portfolio_code = NEW.portfolio_code AND scope_key = NEW.scope_key
        AND status = 'approved' AND id <> NEW.id;

  ELSIF OLD.status = 'submitted' AND NEW.status = 'returned' THEN
    IF changed THEN RAISE EXCEPTION 'Returning cannot change the profile.'; END IF;
    IF actor = OLD.submitted_by OR NOT public.can_approve_portfolio(actor, OLD.scope_key) THEN
      RAISE EXCEPTION 'Only an approver other than the submitter can return a profile.';
    END IF;
    IF COALESCE(btrim(NEW.returned_note), '') = '' THEN
      RAISE EXCEPTION 'Say what needs to change when returning a profile.';
    END IF;
    NEW.returned_by := actor; NEW.returned_at := now();

  ELSIF OLD.status = 'submitted' AND NEW.status = 'draft' THEN
    IF actor <> OLD.submitted_by AND NOT public.can_approve_portfolio(actor, OLD.scope_key) THEN
      RAISE EXCEPTION 'Only the submitter or an approver can withdraw a profile.';
    END IF;
    NEW.submitted_by := NULL; NEW.submitted_at := NULL;

  ELSIF OLD.status = 'approved' AND NEW.status = 'draft' THEN
    IF NOT public.can_approve_portfolio(actor, OLD.scope_key) THEN
      RAISE EXCEPTION 'Only an approver can reopen an approved profile.';
    END IF;
    NEW.submitted_by := NULL; NEW.submitted_at := NULL;
    NEW.approved_by := NULL; NEW.approved_at := NULL; NEW.approval_mode := NULL;

  ELSIF OLD.status = 'approved' AND NEW.status = 'superseded' THEN
    NULL;

  ELSE
    RAISE EXCEPTION 'A profile cannot move from % to %.', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.portfolio_persona_sets_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  act text;
  r record;
BEGIN
  IF TG_OP = 'DELETE' THEN r := OLD; ELSE r := NEW; END IF;
  IF TG_OP = 'INSERT' THEN act := 'portfolio_profile.created';
  ELSIF TG_OP = 'DELETE' THEN act := 'portfolio_profile.deleted';
  ELSIF NEW.status <> OLD.status THEN act := 'portfolio_profile.' || NEW.status;
  ELSIF NEW.phase <> OLD.phase AND NEW.phase = 'done' THEN act := 'portfolio_profile.run_finished';
  ELSE RETURN NULL;
  END IF;
  PERFORM public.log_governance(act, 'portfolio_profile', r.id::text, r.scope_key,
    jsonb_build_object('portfolio', r.portfolio_code, 'version', r.version,
      'from', CASE WHEN TG_OP = 'UPDATE' THEN OLD.status END, 'to', r.status,
      'mode', r.approval_mode, 'note', CASE WHEN r.status = 'returned' THEN r.returned_note END));
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS portfolio_persona_sets_guard ON public.portfolio_persona_sets;
CREATE TRIGGER portfolio_persona_sets_guard BEFORE INSERT OR UPDATE OR DELETE ON public.portfolio_persona_sets
  FOR EACH ROW EXECUTE FUNCTION public.portfolio_persona_sets_guard();
DROP TRIGGER IF EXISTS portfolio_persona_sets_history ON public.portfolio_persona_sets;
CREATE TRIGGER portfolio_persona_sets_history AFTER INSERT OR UPDATE OR DELETE ON public.portfolio_persona_sets
  FOR EACH ROW EXECUTE FUNCTION public.portfolio_persona_sets_history();

-- History for anyone who can read the profile's scope (audit_log itself is
-- admin-read only, and governance_history() checks country access, which
-- 'REGIONAL' is not).
CREATE OR REPLACE FUNCTION public.portfolio_profile_history(_set_id uuid)
RETURNS TABLE (id uuid, action text, actor_id uuid, actor_label text, metadata jsonb, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.id, a.action, a.actor_id,
         COALESCE(a.actor_label, p.display_name) AS actor_label,
         a.metadata, a.created_at
  FROM public.audit_log a
  LEFT JOIN public.profiles p ON p.id = a.actor_id
  WHERE a.target_type = 'portfolio_profile'
    AND a.target_id = _set_id::text
    AND EXISTS (SELECT 1 FROM public.portfolio_persona_sets s
                WHERE s.id = _set_id AND public.can_read_portfolio_scope(auth.uid(), s.scope_key))
  ORDER BY a.created_at DESC
  LIMIT 100;
$$;
REVOKE EXECUTE ON FUNCTION public.portfolio_profile_history(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.portfolio_profile_history(uuid) TO authenticated, service_role;

-- Personas and the synthesis are frozen while their set is under review or
-- approved. The service role (no actor) is not blocked.
CREATE OR REPLACE FUNCTION public.portfolio_persona_children_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE st text; sid uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF; RETURN NEW;
  END IF;
  sid := CASE WHEN TG_OP = 'DELETE' THEN OLD.set_id ELSE NEW.set_id END;
  SELECT status INTO st FROM public.portfolio_persona_sets WHERE id = sid;
  IF st IN ('submitted','approved','superseded') THEN
    RAISE EXCEPTION 'This profile is under review or approved. Reopen it before changing it.';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS portfolio_personas_guard ON public.portfolio_personas;
CREATE TRIGGER portfolio_personas_guard BEFORE INSERT OR UPDATE OR DELETE ON public.portfolio_personas
  FOR EACH ROW EXECUTE FUNCTION public.portfolio_persona_children_guard();
DROP TRIGGER IF EXISTS portfolio_persona_syntheses_guard ON public.portfolio_persona_syntheses;
CREATE TRIGGER portfolio_persona_syntheses_guard BEFORE INSERT OR UPDATE OR DELETE ON public.portfolio_persona_syntheses
  FOR EACH ROW EXECUTE FUNCTION public.portfolio_persona_children_guard();
