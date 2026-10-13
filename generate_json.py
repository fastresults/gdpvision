import json

data = {
    "Defending the growth figure": {
        "question": "The IMF questions our growth figure — can we defend it?",
        "steps": [
            "Gather official statistics and peer benchmarks into a central corpus.",
            "Source and grade each input for accuracy and reliability.",
            "Explain the logic behind the figure in the National Ledger.",
            "Produce a one-page decision brief with cited evidence.",
            "Present a unified government position to the Cabinet.",
            "Provide a response within days instead of months."
        ],
        "outcome": "Aim to maintain credibility with lenders and ratings agencies."
    },
    "Tourism shock": {
        "question": "Tourism arrivals drop 15% — how big is the hit to GDP?",
        "steps": [
            "Measure the impact of falling arrivals and spending flows.",
            "Trace the hit through every linked sector in the National Ledger.",
            "Rehearse potential responses through simulated scenarios.",
            "Cost the available options in a decision brief.",
            "Target support to protect the most essential jobs."
        ],
        "outcome": "Support a measured response based on evidence."
    },
    "A new minister": {
        "question": "A new minister takes office — which growth levers do they own?",
        "steps": [
            "Consolidate ministry mandates and KPIs.",
            "Map sectors and policy levers in the Portfolio view.",
            "Agree on priorities with the Cabinet in the first weeks.",
            "Set owners and deadlines for specific commitments.",
            "Ensure a productive start without learning delays."
        ],
        "outcome": "Support a productive first hundred days."
    },
    "Overlapping programmes": {
        "question": "Two ministries claim the same programme — who delivers?",
        "steps": [
            "Identify overlaps in mandates and public promises.",
            "Compare the actual influence of each ministry within their portfolios.",
            "Assign a single owner and budget to the commitment.",
            "Remove duplicate spending to improve efficiency."
        ],
        "outcome": "Ensure one accountable owner and reduced waste."
    },
    "Revenue shock": {
        "question": "Citizenship by Investment receipts fall — what replaces the revenue?",
        "steps": [
            "Measure revenue exposure from capital flows and statistics.",
            "Price the fiscal gap year-by-year in the National Ledger.",
            "Rehearse replacement options against GDP through simulations.",
            "Cost the best options in a decision brief.",
            "Enable the Cabinet to choose with a complete picture.",
            "Redirect spending to high-return replacements."
        ],
        "outcome": "Aim to close the revenue gap before it becomes a crisis."
    },
    "Closing the deficit": {
        "question": "Should we raise VAT or cut spending to close the deficit?",
        "steps": [
            "Consolidate public figures and secure confidential Treasury data.",
            "Test each option against GDP, debt, and jobs through simulations.",
            "Compare trade-offs side-by-side in a decision brief.",
            "Enable an evidence-based choice through the Cabinet.",
            "Apply the mix of measures that minimizes economic damage."
        ],
        "outcome": "Reduce the deficit while aiming to minimize the hit to growth."
    },
    "Global promotion": {
        "question": "A new national project is ready for global promotion — what do we do?",
        "steps": [
            "Research how rivals pitch similar projects using peer benchmarks.",
            "Check readiness across law, land, and workforce in the FDI Studio.",
            "Create a trusted investor package using open standards.",
            "Promote the project to global investors."
        ],
        "outcome": "Support the commitment of capital to national priorities."
    },
    "Investor exit": {
        "question": "A major foreign investor threatens to leave — how exposed are we?",
        "steps": [
            "Measure the investor's share of jobs and revenue.",
            "Price the economic exposure in the FDI Studio.",
            "Rehearse options to retain, replace, or let go in simulations.",
            "Present options in a decision brief.",
            "Agree on a negotiating position through the Cabinet.",
            "Set commitments with a clear owner.",
            "Spend incentives only where they offer a return."
        ],
        "outcome": "Protect jobs while avoiding overpayment for retention."
    },
    "Cabinet scandal": {
        "question": "A scandal breaks inside Cabinet — what do we do?",
        "steps": [
            "Establish the facts privately using internal records in a secure vault.",
            "Shape a truthful position using only verified facts.",
            "Authorize the response through the Cabinet.",
            "Continue government business without interruption."
        ],
        "outcome": "Maintain confidence and keep decisions moving."
    },
    "Disaster preparation": {
        "question": "A natural disaster is imminent — how do we prepare the public?",
        "steps": [
            "Consolidate population, shelter, and supply data.",
            "Draft clear, sourced public guidance.",
            "Release official warnings through the Cabinet.",
            "Commit every ministry to preparation tasks.",
            "Initiate action within hours."
        ],
        "outcome": "Support a prepared public and faster recovery."
    },
    "Crowded agenda": {
        "question": "Five urgent decisions, one Cabinet session — what comes first?",
        "steps": [
            "Identify the impact of each decision using national KPIs.",
            "Check the strength of evidence for each proposal.",
            "Rank the queue by value and urgency in the Cabinet Room.",
            "Decide in order of priority.",
            "Ensure the most valuable decisions are no longer waiting."
        ],
        "outcome": "Reduce time lost to the wrong priorities."
    },
    "Slipping commitment": {
        "question": "A flagship commitment is slipping — intervene or re-plan?",
        "steps": [
            "Consolidate delivery KPIs and internal ministry reports.",
            "Identify the cause of delay in the Cabinet Room.",
            "Re-plan the commitment with a new owner or date.",
            "Record the changes on the public record."
        ],
        "outcome": "Support recovery of the flagship while maintaining an honest record."
    },
    "Testing a new tax": {
        "question": "Will citizens accept a new property tax before we announce it?",
        "steps": [
            "Analyze property records on secure state-owned servers.",
            "Produce explainable and graded findings.",
            "Test the tax with simulated households in the Persona Lab.",
            "Shape the explanation before the launch.",
            "Decide based on predicted public reaction.",
            "Reduce the risk of reversals and delays."
        ],
        "outcome": "Help adopt reforms faster while keeping private data secure."
    },
    "Diaspora bond": {
        "question": "Will the diaspora invest in a national bond?",
        "steps": [
            "Consolidate regional bond examples and remittance flows.",
            "Study diaspora investor profiles in the Persona Lab.",
            "Identify the terms most likely to sell in a decision brief.",
            "Approve the bond through the Cabinet.",
            "Direct proceeds to agreed projects."
        ],
        "outcome": "Support new national funding from citizens abroad."
    },
    "Manifesto to delivery": {
        "question": "A new government takes office — turn the manifesto into a delivery plan.",
        "steps": [
            "Match manifesto promises to the ministries that own them.",
            "Translate mandates into tracked commitments with owners.",
            "Set deadlines and KPIs for every commitment.",
            "Publish results on the National Record."
        ],
        "outcome": "Support delivery on the record and improve future evidence."
    },
    "Quarterly review": {
        "question": "The quarterly review shows three ministries off track.",
        "steps": [
            "Consolidate quarterly performance KPIs.",
            "Identify gaps in the Mandate Compact.",
            "Find the constraint within each ministry's portfolio.",
            "Agree on corrective action through the Cabinet.",
            "Set revised commitments.",
            "Report progress publicly."
        ],
        "outcome": "Help return projects to their planned schedule."
    },
    "One-day registration": {
        "question": "Business registration takes six weeks — make it one day.",
        "steps": [
            "Identify where time and cost are lost using KPIs and ministry data.",
            "Design and approve the new digital service.",
            "Schedule the rollout through the Cabinet Room.",
            "Assign owners and dates to tracked commitments.",
            "Reduce friction and record progress publicly."
        ],
        "outcome": "Enable new businesses to start trading weeks sooner."
    },
    "National digital ID": {
        "question": "Launch a national digital ID people trust.",
        "steps": [
            "Consolidate service needs and secure civil registry data.",
            "Apply strict privacy and approval rules.",
            "Design the ID system with independent oversight.",
            "Authorize the launch through the Cabinet Room.",
            "Set tracked commitments for delivery.",
            "Report on uptake publicly."
        ],
        "outcome": "Support faster services with data under national control."
    },
    "Budget priorities": {
        "question": "Which three sectors should the next budget back?",
        "steps": [
            "Consolidate national accounts and peer benchmarks.",
            "Rank sectors in the Sector Studio for the Head of Government.",
            "Set a delivery plan for each chosen sector.",
            "Direct the budget to where it grows output most."
        ],
        "outcome": "Aim for more growth per dollar in the budget."
    },
    "Agriculture growth plan": {
        "question": "Build a growth plan for agriculture that investors can back.",
        "steps": [
            "Consolidate food import flows and regional peer data.",
            "Develop a cited diagnosis and roadmap in the Sector Studio.",
            "Create bankable investor packages for projects.",
            "Encourage investment in local production."
        ],
        "outcome": "Help lower import bills and potentially create new rural jobs."
    },
    "Article IV mission": {
        "question": "The IMF Article IV mission arrives in two weeks — are our numbers ready?",
        "steps": [
            "Consolidate national accounts, fiscal data, and debt figures.",
            "Flag weak or stale figures for correction.",
            "Explain every headline figure in the National Ledger.",
            "Draft a cited decision brief outlining the government position.",
            "Ensure ministers enter the mission with a unified position."
        ],
        "outcome": "Aim for a stronger mission report and fewer surprises."
    },
    "Debt-service spike": {
        "question": "Global rates rise — how much more will our debt cost, and when?",
        "steps": [
            "Consolidate debt stock and financing flows.",
            "Project extra interest costs year-by-year in the National Ledger.",
            "Test refinancing, delays, or reprioritization in simulations.",
            "Identify the least damaging path in a decision brief.",
            "Protect essential spending from rising costs."
        ],
        "outcome": "Manage debt costs to help prevent the crowding out of services."
    },
    "Remittances fall": {
        "question": "Remittances are falling as diaspora economies slow — what does it mean at home?",
        "steps": [
            "Consolidate remittance flows and regional peer data.",
            "Trace the impact on household spending and FX in the National Ledger.",
            "Detail exposure by household and sector in a decision brief.",
            "Agree on targeted support through the Cabinet."
        ],
        "outcome": "Help protect vulnerable households from economic slowdowns."
    },
    "Mid-year overspend": {
        "question": "One ministry has spent 70% of its budget by mid-year — what now?",
        "steps": [
            "Consolidate spending and delivery performance data.",
            "Compare spending against results and ministry mandates.",
            "Determine whether to protect, trim, or reallocate funds through the Cabinet.",
            "Set revised commitments with assigned owners.",
            "Manage the budget to ensure it holds to year-end."
        ],
        "outcome": "Help prevent end-of-year fiscal surprises."
    },
    "Unfunded capital project": {
        "question": "A minister announces a project the budget never funded — back it or stop it?",
        "steps": [
            "Consolidate ministry mandates and commitments.",
            "Evaluate project value against ministry priorities.",
            "Make a collective decision through the Cabinet.",
            "Allocate funding only for what was agreed."
        ],
        "outcome": "Maintain fiscal discipline and reduce public conflict."
    },
    "Stalled flagship": {
        "question": "The flagship port upgrade is eighteen months late — who fixes it?",
        "steps": [
            "Consolidate delivery milestones and ministry data.",
            "Identify the blocking ministry and policy lever.",
            "Assign a single owner and new completion dates.",
            "Report progress on the National Record."
        ],
        "outcome": "Help restart stalled flagships while maintaining the record."
    },
    "Hurricane in 96 hours": {
        "question": "A Category 4 hurricane is tracking toward us — what do we decide now?",
        "steps": [
            "Consolidate population, asset, and supply data.",
            "Rehearse damage and recovery paths through simulations.",
            "Plan pre-positioning and fiscal buffers in a decision brief.",
            "Authorize emergency measures through the Cabinet.",
            "Assign specific tasks to every ministry."
        ],
        "outcome": "Support faster recovery and potentially reduced economic loss."
    },
    "Oil price jump": {
        "question": "Oil prices jump 40% — what happens to fuel, power bills and the budget?",
        "steps": [
            "Consolidate import bills and price data.",
            "Test subsidies, pass-throughs, and targeted relief in simulations.",
            "Compare costs and impacts side-by-side in a decision brief.",
            "Direct relief to where it is most needed."
        ],
        "outcome": "Help cushion households without destabilizing the budget."
    },
    "Airline cuts routes": {
        "question": "A major airline cuts our routes next season — how do we respond?",
        "steps": [
            "Consolidate data on arrivals, seat capacity, and peer routes.",
            "Model the impact on visitors and national revenue.",
            "Cost route support options in a decision brief.",
            "Agree on a negotiating mandate through the Cabinet."
        ],
        "outcome": "Help protect air connectivity at a justified cost."
    },
    "Investment-citizenship rules tighten": {
        "question": "Partner countries tighten rules on our investment-citizenship programme — how do we keep investment coming?",
        "steps": [
            "Consolidate programme inflows and peer reforms.",
            "Identify exposure and compliant alternatives in the FDI Studio.",
            "Test reform paths against revenue in simulations.",
            "Present findings in a decision brief.",
            "Select a reform path through the Cabinet before it is imposed."
        ],
        "outcome": "Help maintain investment and protect international standing."
    },
    "Hotel tax concession": {
        "question": "A hotel group asks for a 15-year tax holiday to expand — is it worth it?",
        "steps": [
            "Consolidate project economics and peer deals.",
            "Price expected jobs, revenue, and payback in the FDI Studio.",
            "Create a fair counter-offer in an investor package.",
            "Secure capital commitments on national terms."
        ],
        "outcome": "Encourage growth while aiming to protect the tax base."
    },
    "Correspondent banking": {
        "question": "Foreign banks threaten to cut correspondent links — how exposed are payments?",
        "steps": [
            "Consolidate data on payment and trade flows.",
            "Identify exposed sectors and banks in the FDI Studio.",
            "Test compliance and backup channels in simulations.",
            "Detail findings in a decision brief.",
            "Agree on a remediation plan through the Cabinet."
        ],
        "outcome": "Help ensure trade and remittance payments continue to flow."
    },
    "Leaked audit": {
        "question": "An audit of a state enterprise leaks to the press — what do we say?",
        "steps": [
            "Establish facts privately using internal records in a secure vault.",
            "Develop a narrative based on verified facts and the planned fix.",
            "Approve the response and corrective action through the Cabinet.",
            "Make reform commitments public."
        ],
        "outcome": "Help rebuild trust through transparency and facts."
    },
    "Cost-of-living attack": {
        "question": "The opposition says we caused a cost-of-living crisis — how do we answer?",
        "steps": [
            "Consolidate data on prices, wages, and peer inflation.",
            "Develop a sourced, plain-language answer for the public.",
            "Align the official message with planned relief measures.",
            "Shift the debate toward solutions."
        ],
        "outcome": "Provide an honest answer that stands up to scrutiny."
    },
    "Emergency misinformation": {
        "question": "False rumours spread online during a flood — how do we correct them fast?",
        "steps": [
            "Consolidate official situation data.",
            "Draft corrections from sourced facts.",
            "Release a unified voice through the Cabinet within the hour.",
            "Ensure all agencies repeat the same message."
        ],
        "outcome": "Help protect public safety and avoid panic."
    },
    "Budget week trade-offs": {
        "question": "Ministries ask for twice the money available — how does Cabinet decide?",
        "steps": [
            "Consolidate budget bids and expected results.",
            "Test claims for validity.",
            "Rank bids by projected value in the Cabinet Room.",
            "Agree on the budget through the Cabinet.",
            "Allocate money to the highest-return bids."
        ],
        "outcome": "Aim for a budget that funds growth over noise."
    },
    "Public-sector wage talks": {
        "question": "Unions threaten a strike over pay — what can we afford?",
        "steps": [
            "Consolidate wage bill data and secure negotiating limits.",
            "Cost offers against the budget in the Cabinet Room.",
            "Agree on a negotiating mandate through the Cabinet.",
            "Track the final settlement."
        ],
        "outcome": "Support a fair settlement and help avoid industrial action."
    },
    "100-day review": {
        "question": "One hundred days in — which promises are on track?",
        "steps": [
            "Consolidate commitment KPIs.",
            "Verify progress for accuracy.",
            "Review status in the Cabinet Room using red-amber-green flags.",
            "Re-plan commitments where needed.",
            "Publish results for transparency."
        ],
        "outcome": "Maintain momentum and keep the public informed."
    },
    "Appointing a Tourism Minister": {
        "question": "We must appoint a new Minister of Tourism — what profile does the job need?",
        "steps": [
            "Consolidate portfolio mandates and sector KPIs.",
            "Study ideal minister profiles in the Persona Lab.",
            "Identify the skills that matter most in a decision brief.",
            "Make the appointment based on evidence."
        ],
        "outcome": "Help place the right person in the job sooner."
    },
    "Statistics chief shortlist": {
        "question": "Shortlisting a new head of statistics — who will protect credibility?",
        "steps": [
            "Consolidate data on peer institutions and the role mandate.",
            "Define the ideal candidate profile in the Persona Lab.",
            "Compare candidates against the profile in a decision brief.",
            "Finalize the appointment through the Cabinet."
        ],
        "outcome": "Support the long-term credibility of national numbers."
    },
    "Hostile donor meeting": {
        "question": "A minister faces a tough donor review next week — how do we prepare?",
        "steps": [
            "Consolidate donor priorities and programme results.",
            "Simulate donor reactions in the Persona Lab.",
            "Prepare detailed answers and evidence.",
            "Agree on the official line through the Cabinet."
        ],
        "outcome": "Help maintain funding and strengthen donor relationships."
    },
    "Promises vs fiscal room": {
        "question": "We promised more than the budget allows — which promises go first?",
        "steps": [
            "Consolidate manifesto and fiscal data.",
            "Cost and sequence each promise in the Mandate Compact.",
            "Establish a realistic order of commitments.",
            "Explain the chosen sequence to the public."
        ],
        "outcome": "Help keep promises in an order the budget can support."
    },
    "Donor programme off track": {
        "question": "A donor-funded programme is behind — will we lose the money?",
        "steps": [
            "Consolidate programme KPIs and identify owners.",
            "Determine the cause of the gap in the Mandate Compact.",
            "Identify the ministry that must act.",
            "Set revised commitments.",
            "Ensure funds are fully drawn down."
        ],
        "outcome": "Help ensure donor money is used effectively."
    },
    "Mid-term reset": {
        "question": "Halfway through the term — what must be delivered before the election?",
        "steps": [
            "Consolidate promises and results achieved to date.",
            "Define the remaining mandate for the term.",
            "Set specific tracked commitments for the final period.",
            "Report progress on the National Record."
        ],
        "outcome": "Support a government in completing its objectives."
    },
    "Digital payments": {
        "question": "Pensions and grants still go out as cheques — move them to digital?",
        "steps": [
            "Consolidate service data and secure beneficiary records.",
            "Apply privacy rules to protect citizen data.",
            "Design the digital payment service.",
            "Approve the rollout through the Cabinet Room.",
            "Set tracked commitments for implementation."
        ],
        "outcome": "Support faster payments and potentially lower cost and fraud."
    },
    "Cyber-attack": {
        "question": "A cyber-attack takes down a government service — what now?",
        "steps": [
            "Secure incident records in a sovereign vault.",
            "Confirm the extent of exposure through safeguards.",
            "Develop a recovery plan for digital services.",
            "Authorize the response through the Cabinet Room.",
            "Track commitments to harden national infrastructure."
        ],
        "outcome": "Help restore services and protect public trust."
    },
    "Licence delays": {
        "question": "Business licences take months — where is the time lost?",
        "steps": [
            "Consolidate processing times and agency data.",
            "Redesign the licensing process for efficiency.",
            "Decide on changes through the Cabinet Room.",
            "Assign commitments for implementation.",
            "Reduce approvals to a matter of days."
        ],
        "outcome": "Help new investment start sooner."
    },
    "Drought and food imports": {
        "question": "Drought has cut local harvests — how do we limit the food import bill?",
        "steps": [
            "Consolidate import flows and harvest data.",
            "Rank resilience projects in the Sector Studio.",
            "Set owners and deadlines for commitments.",
            "Fund water and storage projects as a priority."
        ],
        "outcome": "Support lower food prices and a sturdier farm sector."
    },
    "Blue economy plan": {
        "question": "How should we license our fisheries and ocean economy for growth?",
        "steps": [
            "Consolidate peer licensing and catch flows.",
            "Develop a sustainable growth plan in the Sector Studio.",
            "Create investor packages for key projects.",
            "Encourage investment in processing and ports."
        ],
        "outcome": "Support new exports while helping protect the ocean."
    },
    "Renewable energy transition": {
        "question": "Power costs strangle business — can renewables bring them down?",
        "steps": [
            "Consolidate tariffs, fuel imports, and peer data.",
            "Develop a transition roadmap in the Sector Studio.",
            "Create investor packages for solar and storage.",
            "Secure capital commitments for infrastructure."
        ],
        "outcome": "Help lower power costs and reduce imported fuel dependency."
    }
}

print(json.dumps(data, indent=2))
