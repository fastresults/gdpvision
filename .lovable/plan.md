# Standards Audit and Investment Syndication — Recommended Approach

Two new capabilities, built on the existing country corpus, ledger and onboarding data. Both follow one principle: every claim is traceable to a source, a standard clause, and a named owner.

## Part 1 — Data Standards Audit and Governed Collection

### What it does
For each country, show which international reporting standards apply, which required data items are being collected, which are missing or stale, and a governed plan to close each gap.

### Standards to cover (starting set)
- IMF: SDDS / SDDS Plus / e-GDDS (national accounts, fiscal, external sector, prices, reserves)
- IMF GFSM 2014 (government finance), BPM6 (balance of payments), SNA 2008/2025 (national accounts)
- UN SDG indicator framework, World Bank Statistical Performance Indicators
- FATF / CFATF recommendations (relevant to CBI programmes), OECD CRS tax transparency
- IPSAS (public sector accounting), PEFA (public financial management)
- Caribbean regional: CARICOM Regional Statistics Programme, ECCB reporting (OECS)

### Recommended model
```text
Standard -> Requirement (clause, frequency, timeliness, granularity)
         -> Mapped data item in platform (series / KPI / table)
         -> Status: collected | partial | stale | missing | not applicable
         -> Evidence (source, last update, grade)
         -> Remediation protocol (owner, method, cadence, due date)
```

### Audit flow
1. Standards library: curated, versioned requirement catalogue (seeded once, reviewed by admins).
2. Automatic mapping: match requirements to existing series and KPIs; AI proposes matches, admin accepts.
3. Coverage scorecard per country and per standard: percent met, timeliness, data-quality grade, with Explain rationale for every score.
4. Gap register: missing and stale items ranked by impact (e.g., blocks SDDS subscription, investor due diligence, CBI compliance).

### Governed collection protocols
- Each gap generates a protocol: responsible ministry/agency, method (admin records, survey via Persona Lab fieldwork, API, manual upload), cadence, validation rules, approval step.
- Four-eyes approval: collector submits, data steward approves, immutable audit log of every change.
- Quality gates: completeness, range/plausibility checks, revision tracking, confidence grade (A–D, already used).
- Governance outputs: printable compliance report, board-level summary, monthly refresh alongside the existing benchmark cron.

## Part 2 — National Investment Pipeline and Global Syndication

### What it does
Capture every national investment opportunity (public projects, PPPs, concessions, SOE assets, CBI-eligible projects) in one standard format, check it against investor-grade requirements, and package it for distribution.

### Recommended standards to align with
- Project data: SIF / Global Infrastructure Hub project preparation, World Bank PPP Framework, IFC Performance Standards (E&S)
- Sustainability: EU Taxonomy, ICMA Green/Social Bond Principles, TCFD/ISSB climate disclosure
- Integrity: FATF/AML beneficial ownership, CBI due-diligence rules, anti-corruption (OECD)
- Syndication formats: SIF Source-compatible fields, IJGlobal/ Convergence-style deal sheets, open data (OC4IDS — Open Contracting for Infrastructure Data Standard)

### Pipeline stages
```text
Intake -> Standardise -> Compliance check -> Package -> Syndicate -> Track
```
1. Intake: guided wizard (matches existing wizard style) plus bulk upload of ministry project lists.
2. Standardise: map to one schema (sector, size, stage, structure, revenue model, risks, E&S category, sponsor, beneficial owners).
3. Compliance check: readiness score against the standards above; missing items become tasks (reusing Part 1 governance).
4. Package: auto-generated teaser, information memorandum, data room index, and presentation deck (reusing existing deck generation), unbranded or government-branded.
5. Syndicate: public share links (existing pattern), OC4IDS/JSON export, investor-portal feed, optional listing on multilateral platforms.
6. Track: investor interest, NDA status, pipeline value by sector, linked to FDI Transition Studio and Sovereign Eye capital flows.

### Guardrails
- Nothing is published without admin approval and a completed compliance check.
- Sensitive fields (beneficial owners, pricing) stay private; only approved fields appear in shared packages.
- Every derived score carries an Explain rationale.

## Suggested phasing
1. Standards library + coverage scorecard (read-only audit).
2. Gap register + governed collection protocols with approvals.
3. Investment pipeline intake + standard schema + readiness score.
4. Packaging, share links and exports; investor tracking.

## Technical details
- New tables (with GRANTs, RLS via has_country_access): reporting_standards, standard_requirements, requirement_mappings, collection_protocols, protocol_submissions, investment_projects, investment_compliance_checks, investment_packages, investor_interest.
- Server fns in src/lib/standards/*.functions.ts and src/lib/investments/*.functions.ts with requireSupabaseAuth; AI mapping via Lovable AI Gateway through the corpus gateway.
- New routes under admin/countries/$code/standards and admin/countries/$code/investments; public package view reuses the /s/$token share pattern.
- Monthly audit refresh added to the existing first-of-month cron.
