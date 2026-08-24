# CBI Stakeholder Survey — Survey Instruments Breakdown

**Study:** Strategic Positioning and Public Mandate Assessment for Investment Migration Grenada
**Client:** Investment Migration Agency (IMA) Grenada
**Country:** Grenada (GRD)
**Method:** Mixed-method field programme — quantitative survey (citizens & Diaspora), focus groups, and qualitative depth interviews
**Status:** Draft
**Generated:** 24 August 2026

> **Confidentiality.** All instruments below are administered under strict confidentiality. Individual responses are non-attributable and reported only in aggregate. Findings inform the strategic recommendations presented to the IMA Grenada Executive Board and the Cabinet of Ministers ahead of the **24 October 2026** executive board meeting.

---

## 1. Study Overview

A 75-day mixed-method research programme designed for the Investment Migration Agency (IMA) Grenada to assess its public mandate, establish a stakeholder CSAT baseline, and evaluate strategic positioning. The study combines a robust quantitative survey of Grenadian citizens and Diaspora with qualitative depth interviews of international marketing agents to inform critical decisions ahead of the October 24, 2026 executive board meeting.

### Research objectives

| Ref | Objective | Why it matters |
| --- | --- | --- |
| **O1** | Measure customer satisfaction (CSAT) across five key stakeholder touchpoints and establish a baseline Trust Index. | To identify operational bottlenecks and build a defensible, metrics-driven baseline of program integrity for international regulators. |
| **O2** | Assess domestic and international public mandate, sentiment, and perceived national benefit of the investment migration program. | To address domestic skepticism, measure the perceived local utility of CBI funds, and provide the Cabinet with evidence of a public mandate. |
| **O3** | Evaluate the on-the-ground impact of the recent IMA rebranding and marketing investments to date. | To determine whether the transition from CIU to IMA has successfully shifted brand perception and improved international trust since the 2024 brand audit. |
| **O4** | Test market appetite and stakeholder receptivity for alternative program models required for the 2026–2028 regulatory horizon. | To proactively mitigate the risk of the June 2028 EU visa-free access phase-out by identifying viable alternative investment structures. |

### Instrument inventory

| # | Instrument | Kind | Version | Questions | Drafted by | Audience | Distribution |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | National Public Mandate & Sentiment Survey (field title: *Strategic Positioning and Public Mandate Assessment: Grenada Investment Migration*) | Survey | v4 | 17 | AI-drafted | Grenadian citizens (mainland, Carriacou & Petite Martinique) and overseas Diaspora — combined | **Email / hosted open link** (anonymous, token-gated), printable form, CSV/JSON pack |
| 2 | Focus Group Participant Pre-Session Questionnaire: Investment Migration Grenada (IMA) | Survey | v1 | 10 | Human-reviewed | Focus group participants (citizens & Diaspora) | Completed in-session, before discussion |
| 3 | Strategic Positioning and Public Mandate Assessment for Investment Migration Grenada — Moderator Discussion Guide | Discussion guide | v3 | 10 | AI-drafted | International marketing agents, developers, regulators, industry stakeholders | Moderator-administered (depth interviews / panels) |

*Versioning note: instrument versions increment study-wide across every draft. v2 was an earlier discussion guide ("Stakeholder & Expert Consultation Guide", 9 questions), superseded by v3. v4 is the quantitative field survey — the newest instrument and the study's primary quantitative baseline.*

---

## 2. Instrument 1 — National Public Mandate & Sentiment Survey (Survey v4)

**Title:** Strategic Positioning and Public Mandate Assessment: Grenada Investment Migration
**Kind:** `survey` · **Version:** 4 · **Questions:** 17 · **Drafted by:** AI
**Audience:** Grenadian citizens and Diaspora, combined — results segment by residency, location, and age band.
**Distribution:** self-completion by email and hosted open link; mobile-first; approximately 8–10 minutes.

**Intro (shown to respondent):**

> Thank you for participating in this independent survey. The Investment Migration Agency (IMA) Grenada is currently conducting a strategic review of its programme to ensure it serves the national interest, maintains international trust, and adapts to changing global regulations. Whether you live in Grenada, Carriacou, Petite Martinique, or are part of our overseas Diaspora, your feedback is vital. This survey is completely anonymous and will take approximately 8 to 10 minutes to complete. Your honest views will directly inform policy decisions ahead of the October 2026 strategic planning horizon.

**Outro (shown after submission):**

> Thank you for your valuable time and feedback. Your responses have been recorded anonymously and will be analyzed to help shape the future strategy and public accountability of Grenada's investment migration programme.

### Question-by-question breakdown

#### S1 — Residency status *(segmentation)*

| Field | Value |
| --- | --- |
| Question ID | `residency_status` |
| Type | Single choice |
| Required | Yes |
| Help text | Please select the option that best describes your primary place of residence. |

**Prompt:** Where do you currently reside?

**Options:**
1. Grenada (Mainland)
2. Carriacou or Petite Martinique
3. Overseas (Grenadian Diaspora)

#### S2 — Location detail *(segmentation)*

| Field | Value |
| --- | --- |
| Question ID | `location_detail` |
| Type | Single choice |
| Required | Yes |
| Help text | Select your local parish or your current global region. |

**Prompt:** Which parish do you live in, or where in the Diaspora are you based?

**Options:**
1. St. George
2. St. John
3. St. Mark
4. St. Patrick
5. St. Andrew
6. St. David
7. Carriacou & Petite Martinique
8. North America (USA / Canada)
9. Europe / United Kingdom
10. Caribbean / OECS Region
11. Other International Location

#### S3 — Age band *(segmentation)*

| Field | Value |
| --- | --- |
| Question ID | `age_band` |
| Type | Single choice |
| Required | Yes |
| Help text | This helps us ensure we capture a representative sample of all generations. |

**Prompt:** Which of the following age groups do you belong to?

**Options:**
1. 18–29
2. 30–44
3. 45–59
4. 60 or older

#### S4 — Awareness of the CIU → IMA transition *(objective O3)*

| Field | Value |
| --- | --- |
| Question ID | `brand_awareness` |
| Type | Single choice |
| Required | Yes |
| Help text | This refers to the rebranding and structural shift from the old CIU to the current IMA. |

**Prompt:** In 2024, the government transitioned the Citizenship by Investment Unit (CIU) into the newly structured Investment Migration Agency (IMA) Grenada. Prior to this survey, were you aware of this transition?

**Options:**
1. Yes, I was fully aware of the change
2. Yes, I had heard about it but did not know the details
3. No, I was not aware of this change

#### S5 — Rebrand perception impact *(objective O3)*

| Field | Value |
| --- | --- |
| Question ID | `brand_perception_impact` |
| Type | Scale 1–5 |
| Required | Yes |
| Scale anchors | 1 = Not at all improved → 5 = Significantly improved |
| Help text | Consider how international partners, agents, and regulators view the program now compared to before 2024. |

**Prompt:** To what extent do you feel that transitioning from the CIU to the IMA has improved the international reputation and trust of Grenada's investment migration programme?

#### S6 — Transparency rating *(objective O1)*

| Field | Value |
| --- | --- |
| Question ID | `trust_transparency` |
| Type | Scale 1–5 |
| Required | Yes |
| Scale anchors | 1 = Very Poor → 5 = Excellent |
| Help text | Think about how easy it is to find clear, reliable information about the program's operations. |

**Prompt:** How would you rate the transparency of the Investment Migration Agency (IMA) regarding how program revenues and applicant numbers are reported to the public?

#### S7 — Communication satisfaction *(objective O1)*

| Field | Value |
| --- | --- |
| Question ID | `trust_communication` |
| Type | Scale 1–5 |
| Required | Yes |
| Scale anchors | 1 = Very Dissatisfied → 5 = Very Satisfied |
| Help text | This includes news releases, public statements, and educational campaigns about the program. |

**Prompt:** How satisfied are you with the quality and frequency of official communications and public updates from the IMA?

#### S8 — Vetting confidence *(objective O1)*

| Field | Value |
| --- | --- |
| Question ID | `trust_integrity` |
| Type | Scale 1–5 |
| Required | Yes |
| Scale anchors | 1 = Not Confident At All → 5 = Extremely Confident |
| Help text | This relates to the security and compliance measures used to screen applicants. |

**Prompt:** How confident are you in the background checks and vetting processes used by Grenada to ensure only reputable investors are approved?

*S6–S8 together form the baseline Trust Index battery.*

#### S9 — Perceived national benefit *(objective O2)*

| Field | Value |
| --- | --- |
| Question ID | `national_benefit_perception` |
| Type | Scale 1–5 |
| Required | Yes |
| Scale anchors | 1 = No Benefit At All → 5 = Substantial Benefit |
| Help text | Consider impacts on local jobs, public infrastructure, community projects, and the overall economy. |

**Prompt:** To what extent do you believe the investment migration programme currently provides tangible benefits to everyday Grenadian citizens?

#### S10 — Revenue allocation priorities *(objective O2)*

| Field | Value |
| --- | --- |
| Question ID | `revenue_allocation_preference` |
| Type | Multi choice (select up to three) |
| Required | Yes |
| Help text | Please select the top three areas where you believe program revenues would make the most positive impact. |

**Prompt:** In your opinion, which areas should be the highest priority for funding generated by the investment migration programme? (Select up to 3)

**Options:**
1. Healthcare infrastructure and hospital equipment
2. Education, school facilities, and youth scholarships
3. Roads, water systems, and public utilities
4. Climate resilience, sea defense, and disaster preparedness
5. Direct funding, grants, or loans for local Grenadian businesses
6. Sovereign debt reduction and national savings reserves

#### S11 — Programme continuation stance *(objective O2)*

| Field | Value |
| --- | --- |
| Question ID | `programme_continuation` |
| Type | Single choice |
| Required | Yes |
| Help text | Select the option that closest matches your overall stance on the program. |

**Prompt:** Which of the following statements best aligns with your view on the future of Grenada's investment migration programme?

**Options:**
1. The programme should continue in its current form.
2. The programme should continue, but with major reforms to transparency and local benefits.
3. The programme should be phased out and stopped entirely.
4. I am undecided or do not have enough information.

#### S12 — EU visa-free phase-out concern *(objective O4)*

| Field | Value |
| --- | --- |
| Question ID | `eu_phaseout_concern` |
| Type | Scale 1–5 |
| Required | Yes |
| Scale anchors | 1 = Not Concerned At All → 5 = Extremely Concerned |
| Help text | Consider how losing visa-free travel to Europe might affect the program's appeal and Grenada's broader economic stability. |

**Prompt:** The European Union has indicated a potential phase-out of visa-free access for countries operating investor-citizenship programmes by June 2028. How concerned are you about the impact of this on Grenada's economy?

#### S13 — Regional harmonisation support *(objective O4)*

| Field | Value |
| --- | --- |
| Question ID | `regional_harmonisation_support` |
| Type | Scale 1–5 |
| Required | Yes |
| Scale anchors | 1 = Strongly Oppose → 5 = Strongly Support |
| Help text | This agreement sets a minimum investment threshold of USD $200,000 and standardizes security screening across five Caribbean islands. |

**Prompt:** Grenada recently signed a regional Memorandum of Agreement (MOA) to harmonise pricing and vetting standards across Caribbean nations. How strongly do you support this regional cooperation?

#### S14 — Alternative model preference *(objective O4)*

| Field | Value |
| --- | --- |
| Question ID | `alternative_models_preference` |
| Type | Single choice |
| Required | Yes |
| Help text | Select the alternative pathway that you believe is most viable and beneficial for the country. |

**Prompt:** If international regulatory pressures limit traditional citizenship-by-investment, which alternative model would you most support for Grenada?

**Options:**
1. A residency-first model (investors must live in Grenada for a set period before applying for citizenship)
2. An active business model (investors must establish physical businesses that employ a minimum number of Grenadians)
3. A sovereign development fund model (investments are locked strictly into government-managed national infrastructure projects)
4. Winding down the investment migration programme entirely, regardless of alternative options

#### S15 — Friction with the public *(frontline insight)*

| Field | Value |
| --- | --- |
| Question ID | `frontline_friction` |
| Type | Open text |
| Required | No (optional) |
| Help text | Please share any specific issues, communication gaps, or operational bottlenecks you have observed. |

**Prompt:** From your perspective, what is the single biggest point of friction or misunderstanding between the Investment Migration Agency (IMA) and the Grenadian public?

#### S16 — One change and what it improves *(frontline insight)*

| Field | Value |
| --- | --- |
| Question ID | `frontline_change` |
| Type | Open text |
| Required | No (optional) |
| Help text | Focus on a practical change that would make the program more transparent, beneficial, or trusted. |

**Prompt:** If you could make one specific change to how the investment migration programme operates or communicates to better serve Grenadians, what would it be and what would it improve?

#### S17 — Confidence in proposed change *(frontline insight)*

| Field | Value |
| --- | --- |
| Question ID | `frontline_confidence` |
| Type | Scale 1–5 |
| Required | No (optional) |
| Scale anchors | 1 = Not Confident At All → 5 = Extremely Confident |
| Help text | Rate your confidence in the real-world impact of your suggested change. |

**Prompt:** How confident are you that the change you proposed above would successfully improve public trust and program sustainability?

*S15–S17 are the standing frontline-insight closing block: the ideas citizens volunteer can be ranked (via S17), not merely collected.*

---

## 3. Instrument 2 — Pre-Session Questionnaire (Survey v1)

**Title:** Focus Group Participant Pre-Session Questionnaire: Investment Migration Grenada (IMA)
**Kind:** `survey` · **Version:** 1 · **Questions:** 10 · **Drafted by:** human
**Distribution:** completed in-session by focus group participants before discussion begins; establishes each participant's baseline so group discussion can be read against it.

**Intro (read by participant):**

> Thank you for participating in this focus group session. Before we begin our group discussion, please take a few minutes to complete this brief, confidential questionnaire. Your individual responses will be kept strictly confidential and will be used to establish a baseline of public sentiment to inform the strategic direction of the Investment Migration Agency (IMA) Grenada ahead of the October 2026 executive review. Your honest feedback is highly valued.

**Outro:** none configured.

### Question-by-question breakdown

#### Q1 — Residency status

| Field | Value |
| --- | --- |
| Question ID | `respondent_location` |
| Type | Single choice |
| Required | Yes |
| Help text | Please select one option that represents where you spend the majority of the year. |

**Prompt:** Which of the following best describes your current residency status?

**Options:**
1. Residing in Grenada (Mainland)
2. Residing in Carriacou or Petite Martinique
3. Living overseas (Grenadian Diaspora)

#### Q2 — Awareness of the CIU → IMA transition

| Field | Value |
| --- | --- |
| Question ID | `brand_transition_awareness` |
| Type | Single choice |
| Required | Yes |
| Help text | This refers to the structural and brand transition aimed at improving program governance. |

**Prompt:** In 2024, the government transitioned the Citizenship by Investment Unit (CIU) into the newly structured Investment Migration Agency (IMA) Grenada. Prior to today, were you aware of this change?

**Options:**
1. Yes, I was fully aware of the transition and the new agency name
2. Yes, I had heard about the change but did not know the details
3. No, I was not aware of this transition until today

#### Q3 — Trust in IMA Grenada

| Field | Value |
| --- | --- |
| Question ID | `ima_trust_score` |
| Type | Scale 1–5 |
| Required | Yes |
| Scale anchors | 1 = No trust at all → 5 = Complete trust |
| Help text | Please rate on a scale from 1 to 5. |

**Prompt:** Based on what you know or have heard, how would you rate your overall level of trust in the Investment Migration Agency (IMA) Grenada to manage the program with integrity?

#### Q4 — Perceived national benefit

| Field | Value |
| --- | --- |
| Question ID | `national_benefit_perception` |
| Type | Scale 1–5 |
| Required | Yes |
| Scale anchors | 1 = No benefit at all → 5 = Very high benefit |
| Help text | Consider local infrastructure, public services, and employment opportunities. |

**Prompt:** To what extent do you believe the investment migration program currently provides tangible economic and social benefits to the average citizen of Grenada?

#### Q5 — Fund allocation priorities

| Field | Value |
| --- | --- |
| Question ID | `cbi_fund_allocation_priority` |
| Type | Multi choice (select up to two) |
| Required | Yes |
| Help text | Please select the two most critical areas for public fund allocation. |

**Prompt:** In your opinion, which of the following areas should be the primary focus for investment migration funding in Grenada? (Select up to two options)

**Options:**
1. Public infrastructure (roads, water systems, electricity)
2. Healthcare facilities, equipment, and services
3. Education, schools, and youth training programs
4. Climate resilience, coastal protection, and disaster preparedness
5. Direct support for local agriculture and small businesses
6. A Sovereign Wealth Fund to save for future generations

#### Q6 — Transparency satisfaction

| Field | Value |
| --- | --- |
| Question ID | `transparency_satisfaction` |
| Type | Scale 1–5 |
| Required | Yes |
| Scale anchors | 1 = Very dissatisfied → 5 = Very satisfied |
| Help text | Rate your satisfaction with official government and IMA communications. |

**Prompt:** How satisfied are you with the level of public information and transparency regarding how investment migration revenues are collected and spent?

#### Q7 — EU visa-free access concern

| Field | Value |
| --- | --- |
| Question ID | `eu_visa_impact_concern` |
| Type | Scale 1–5 |
| Required | Yes |
| Scale anchors | 1 = Not concerned at all → 5 = Extremely concerned |
| Help text | This refers to the potential impact on the strength and utility of the Grenadian passport. |

**Prompt:** The European Union has raised regulatory concerns that could affect Grenada's visa-free access to the Schengen Area by June 2028. How concerned are you about the potential loss of visa-free travel to Europe for Grenadian passport holders?

#### Q8 — Alternative program model preference

| Field | Value |
| --- | --- |
| Question ID | `alternative_model_preference` |
| Type | Single choice |
| Required | Yes |
| Help text | Select the option that best aligns with your view of sustainable national development. |

**Prompt:** If international regulatory pressure forces Grenada to modify its current direct-citizenship model, which alternative program structure would you find most acceptable?

**Options:**
1. A 'Residency-First' model (investors must reside in Grenada for a set period before citizenship is considered)
2. An 'Active Business' model (investors must establish physical businesses that employ a minimum number of Grenadians)
3. A 'Sovereign Development Fund' model (investors only contribute to a highly audited, ring-fenced national fund)
4. None of these (the program should be phased out entirely, regardless of revenue loss)

#### Q9 — Regional harmonisation support

| Field | Value |
| --- | --- |
| Question ID | `regional_harmonisation_support` |
| Type | Single choice |
| Required | Yes |
| Help text | This agreement aims to increase international compliance and trust at the cost of lower application volumes. |

**Prompt:** Grenada recently signed a regional Memorandum of Agreement (MOA) to harmonise pricing and increase vetting standards with other Caribbean nations. Do you support this regional approach, even if it leads to a lower volume of applicants?

**Options:**
1. Yes, I strongly support this regional approach
2. Yes, I somewhat support this regional approach
3. No, I somewhat oppose this regional approach
4. No, I strongly oppose this regional approach
5. I do not have enough information to decide

#### Q10 — Single most important improvement

| Field | Value |
| --- | --- |
| Question ID | `improvement_suggestion` |
| Type | Open text |
| Required | No (optional) |
| Help text | Please be as specific as possible in your recommendation. |

**Prompt:** What is the single most important action the Investment Migration Agency (IMA) Grenada can take to improve public trust and support among Grenadians?

---

## 4. Instrument 3 — Moderator Discussion Guide (v3)

**Title:** Strategic Positioning and Public Mandate Assessment for Investment Migration Grenada — Moderator Discussion Guide
**Kind:** `discussion_guide` · **Version:** 3 · **Questions:** 10 · **Drafted by:** AI
**Distribution:** moderator-administered in depth interviews and expert panels with agents, developers, and regulators.

**Intro (read by moderator):**

> Thank you for participating in this discussion. This session is part of a comprehensive, independent research programme commissioned by the Investment Migration Agency (IMA) Grenada to evaluate its strategic positioning, operational touchpoints, and long-term program models ahead of the October 2026 executive board meeting. Your expert insights as a key stakeholder are vital to shaping the 2026–2028 strategic horizon. Your responses will be kept strictly confidential and analyzed in aggregate.

**Outro (closing script):**

> Thank you for your time and valuable insights. Your feedback will directly inform the strategic recommendations presented to the IMA Grenada Executive Board and Cabinet to secure the program's future.

### Question-by-question breakdown

Items marked **Moderator prompt** are spoken discussion openers; items marked **Scale** or **Open text** are values the moderator records during the session. Items marked *frontline insight* are unscripted-reality probes designed to surface operational truth rather than prepared positions.

#### D1 — Brand perception shift *(objective O3)*

| Field | Value |
| --- | --- |
| Question ID | `brand_perception_shift` |
| Type | Moderator prompt |
| Required | Yes |
| Moderator probe | Probe for specific changes in brand trust, professionalism, and international market perception compared to the old CIU model. |

**Prompt:** Let's begin with the transition from the Citizenship by Investment Unit (CIU) to the Investment Migration Agency (IMA) Grenada. Since the rebranding and marketing investments, have you noticed a shift in how the program is perceived by international clients and partners? How has this impacted brand trust?

#### D2 — Operational touchpoint satisfaction *(objective O1)*

| Field | Value |
| --- | --- |
| Question ID | `touchpoint_satisfaction` |
| Type | Moderator prompt |
| Required | Yes |
| Moderator probe | Identify specific operational pain points and areas of high performance within the IMA workflow. |

**Prompt:** Thinking about your day-to-day interactions, how satisfied are you with the five key operational touchpoints: application submission, due diligence processing, regular status updates, escrow/payment verification, and final passport issuance? Where are the primary bottlenecks?

#### D3 — Baseline Trust Index *(objective O1)*

| Field | Value |
| --- | --- |
| Question ID | `trust_index_score` |
| Type | Scale 1–10 (moderator-recorded) |
| Required | Yes |
| Scale anchors | 1 = Extremely Low Trust / High Risk → 10 = Extremely High Trust / Low Risk |
| Moderator probe | This score will be used to establish a quantitative baseline Trust Index among key distribution partners. |

**Prompt:** On a scale of 1 to 10, how would you rate the overall integrity, transparency, and compliance profile of the current IMA Grenada program?

#### D4 — Domestic benefit perception *(objective O2)*

| Field | Value |
| --- | --- |
| Question ID | `domestic_benefit_perception` |
| Type | Moderator prompt |
| Required | Yes |
| Moderator probe | Probe on the visibility of CBI-funded infrastructure, public sentiment, and ideas for improving domestic PR. |

**Prompt:** There is ongoing domestic debate regarding the tangible local benefits of CBI funds. From your perspective, how well does the program align with Grenada's national development goals, and how effectively are these benefits communicated to the local public to maintain a domestic mandate?

#### D5 — EU visa-free threat urgency *(objective O4)*

| Field | Value |
| --- | --- |
| Question ID | `eu_visa_threat_urgency` |
| Type | Moderator prompt |
| Required | Yes |
| Moderator probe | Explore the direct commercial impact of the EU regulatory timeline on current volumes and marketing strategies. |

**Prompt:** The potential June 2028 EU visa-free access phase-out is a critical milestone. How is this timeline currently driving applicant urgency, and how is it shaping agent risk-perception when recommending Grenada over other global programs?

#### D6 — Alternative models appetite *(objective O4)*

| Field | Value |
| --- | --- |
| Question ID | `alternative_models_appetite` |
| Type | Moderator prompt |
| Required | Yes |
| Moderator probe | Assess the viability of non-passport investment migration models and what features would make them attractive to high-net-worth investors. |

**Prompt:** To mitigate the 2028 EU visa-free risk, we are testing alternative program models (such as residency-first pathways, targeted sovereign investment funds, or hybrid structures). What is the market appetite and stakeholder receptivity for these alternative models among your client base?

#### D7 — Frontline friction *(frontline insight)*

| Field | Value |
| --- | --- |
| Question ID | `frontline_friction` |
| Type | Moderator prompt |
| Required | Yes |
| Intent | Frontline insight |
| Moderator probe | Look for unscripted, operational realities that cause delays or client frustration. |

**Prompt:** In your day-to-day operations processing Grenada applications or managing local developments, where does the system actually break down or cause the most friction for you and your clients?

#### D8 — Informal workarounds *(frontline insight)*

| Field | Value |
| --- | --- |
| Question ID | `informal_workarounds` |
| Type | Moderator prompt |
| Required | Yes |
| Intent | Frontline insight |
| Moderator probe | Identify unofficial processes or communication loops that agents use to bypass system inefficiencies. |

**Prompt:** When these operational bottlenecks or regulatory delays occur, what informal workarounds, direct channels, or temporary fixes do you find yourself relying on to keep applications moving?

#### D9 — One strategic change *(frontline insight)*

| Field | Value |
| --- | --- |
| Question ID | `one_strategic_change` |
| Type | Moderator prompt |
| Required | Yes |
| Intent | Frontline insight |
| Moderator probe | Force a single, high-priority recommendation from the participant's perspective. |

**Prompt:** If you could change just one specific aspect of Grenada's investment migration framework, pricing structure, or operational workflow tomorrow to secure its long-term viability, what would it be?

#### D10 — Referral probe (snowball sampling) *(frontline insight)*

| Field | Value |
| --- | --- |
| Question ID | `referral_probe` |
| Type | Moderator prompt |
| Required | Yes |
| Intent | Frontline insight |
| Moderator probe | Identify highly knowledgeable, candid industry contacts for snowball sampling. |

**Prompt:** Who else in the industry—perhaps a specific local developer, a compliance officer, or an agent closer to the ground than anyone else—should we speak with to get the most unvarnished view of this program?

---

## 5. Administration Notes

- **Deployment routes.** Each instrument can be fielded three ways: a hosted open link (anonymous, token-gated), a printable paper form, and a machine-readable pack (CSV return template + JSON schema) for teams using their own survey tooling.
- **Field survey distribution.** The National Public Mandate & Sentiment Survey (v4) is fielded through a live hosted open link issued from the programme's deploy panel, ready to embed in email campaigns to citizen and Diaspora lists. Responses are anonymous, auto-numbered (`P-0001`, `P-0002`, …) on submission, and capped at the collection's target of 450 completes.
- **Participant codes.** Paper and offline returns carry a participant code box; leave blank to auto-number on intake.
- **Versioning rule.** Every deployment is stamped with the instrument version (Survey v4, Survey v1, Guide v3). Returns are filed against exactly what was asked — responses can never be silently attributed to a different draft. If an instrument is re-drafted, the version increments and new packs must be re-issued. Versions increment study-wide across all instrument drafts, which is why the two live surveys are v1 and v4.
- **Machine IDs.** The question IDs in this document (`residency_status`, `trust_transparency`, `trust_index_score`, …) are the column headers in the CSV return template and the keys in the JSON schema. Do not edit them in the field. IDs are unique within each instrument; two instruments may reuse an ID (e.g. both surveys carry `national_benefit_perception`), so always file returns against the instrument version stamp.
- **Required vs. optional.** Field survey v4: all items required except the three frontline-insight items (S15–S17). Pre-session questionnaire v1: all items required except Q10 (`improvement_suggestion`). Guide v3: all items required of the moderator.
- **Coverage check.** Field survey v4 carries 17 items; pre-session questionnaire v1 carries 10; guide v3 carries 10 — 37 questions in total across the programme.

---

## 6. Appendix

### 6.1 Question-type legend

| Type | Meaning | Answer capture |
| --- | --- | --- |
| `single_choice` | Respondent selects exactly one option | Option index / label |
| `multi_choice` | Respondent selects up to the stated number of options | Set of option labels |
| `scale` | Numeric rating between labelled anchors | Integer, min–max |
| `open_text` | Free-form written answer | Text |
| `moderator_prompt` | Spoken discussion opener (discussion guide only) | Session notes / transcript |

### 6.2 Objective cross-reference matrix

| Objective | Field survey v4 items | Pre-session v1 items | Guide v3 items |
| --- | --- | --- | --- |
| **O1** — CSAT & Trust Index baseline | `trust_transparency`, `trust_communication`, `trust_integrity` | `ima_trust_score`, `transparency_satisfaction` | `touchpoint_satisfaction`, `trust_index_score` |
| **O2** — Public mandate & national benefit | `national_benefit_perception`, `revenue_allocation_preference`, `programme_continuation` | `national_benefit_perception`, `cbi_fund_allocation_priority`, `improvement_suggestion` | `domestic_benefit_perception` |
| **O3** — Rebrand impact (CIU → IMA) | `brand_awareness`, `brand_perception_impact` | `brand_transition_awareness` | `brand_perception_shift` |
| **O4** — Alternative models / 2028 horizon | `eu_phaseout_concern`, `regional_harmonisation_support`, `alternative_models_preference` | `eu_visa_impact_concern`, `alternative_model_preference`, `regional_harmonisation_support` | `eu_visa_threat_urgency`, `alternative_models_appetite` |
| Frontline insight (unscripted reality) | `frontline_friction`, `frontline_change`, `frontline_confidence` | — | `frontline_friction`, `informal_workarounds`, `one_strategic_change`, `referral_probe` |
| Segmentation / demographics | `residency_status`, `location_detail`, `age_band` | `respondent_location` | — |

*Field survey v4 and guide v3 items carry explicit `objective_ref` values in the instruments of record (segmentation items are additionally used to cut every objective by residency, location, and age). Pre-session v1 items are mapped to objectives thematically — the v1 instrument predates explicit objective references.*
