# Demo Questions — Big Data London

Three flagship questions, one per persona. Each is asked **identically across all three grounding modes** (Generic → Data → Data + EC) so the audience sees the same question get a materially better answer as context is added.

**Suggested run order:** lead with CEO — run all 3 modes back-to-back on the identical question — then repeat just the Data → Data+EC jump for VP Supply Chain and CDO to show it's not a one-off.

---

## CEO — "Which product category should we launch D2C first, and what return can we expect?"

| Mode | What happens | What to point out live |
|---|---|---|
| **Generic** | Generic industry playbook: "start small, test highest-margin SKUs, watch fulfilment costs" — no MDS category names, no numbers. | It could be any company's advice. Zero specificity. |
| **Data** | Pulls Product Catalogue Data + Sales Revenue Data tables. Can spot Sports Nutrition has the highest target margin (62%) and is D2C-ready — but has no idea whether supply chain can actually fulfil it, no launch-readiness KPI targets (D2C Target Gross Margin 62%, ROI 28%, EAV Year 1 £2M), and can't see the Channel Exclusivity Policy that restricts which categories go where. | Answer sounds plausible but is missing a critical caveat: it can't tell you supply chain risk exists. |
| **Data + EC** | Names Sports Nutrition, cites the actual KPI targets, and flags that Central Beauty Hub is only Partial-ready and 3PL Partner North is a Blocker — plus surfaces the Channel Exclusivity Policy and D2C Pricing Policy constraints, and who owns the call (D2C Category Manager). | The "aha" moment — the same question now returns a decision-grade answer with real risk flags the Data-only mode structurally couldn't see. |

## VP Supply Chain — "Which supply chain nodes are ready for D2C, and what should I fix first?"

| Mode | What happens | What to point out live |
|---|---|---|
| **Generic** | Generic "audit capacity, lead times, 3PL partners" advice. No node names. | Useless for an actual ops decision. |
| **Data** | Lists all 7 nodes' status from the raw table: Lutterworth DC + Last-Mile SE Courier (Ready), Midlands 3PL Facility + Central Beauty Hub + Belfast Regional Hub (Partial), 3PL Partner North + Last-Mile Scotland Carrier (Blocker). Numbers only — no idea why they're blocked, who owns fixing them, or what policy governs them. | It can enumerate but not diagnose or assign ownership. |
| **Data + EC** | Same node list, but tied to the 3PL Master Services Agreement and National Courier Terms policies, and the Supply Chain Planner as the accountable owner via the Supply Chain Domain. | The jump from "here's a status list" to "here's who's accountable and under what contract." |

## CDO — "What governs the Customer domain, and are we set up for compliant personalization?"

| Mode | What happens | What to point out live |
|---|---|---|
| **Generic** | Generic GDPR/consent-management talking points. No mention of MDS systems at all. | Pure boilerplate — this is what "everyone already has." |
| **Data** | Pulls Customer Insights Data table (segment size, AOV, LTV, D2C propensity by segment) — real numbers, but zero way to answer "are we compliant" since that's a policy/relationship question, not a column in a table. Watch it hedge or flatly say it can't determine this from data alone. | The mode's most exposed failure — compliance literally cannot be answered from a spreadsheet. |
| **Data + EC** | Names Customer Data Privacy Policy and Customer Consent Personalisation Policy, the systems they apply to (CDP, CRM, Marketing Analytics Platform, Customer Insights Data), and the accountable owner (Data Analytics Lead via Customer Domain) — then layers in the actual segment numbers. | Strongest contrast of the three: Data mode can't even attempt the governance half of the question; Data+EC answers it directly. |

---

## Reference values (verified against seed data)

**KPIs:**
- TAV UK D2C Market — £15,000,000
- EAV Year 1 Rollout — £2,000,000
- EAV Year 2 Expansion — £5,000,000
- EAV Year 3 Full Rollout — £9,000,000
- RV Wholesale Baseline — £45,000,000
- D2C Target Gross Margin — 62%
- D2C Target Return on Investment — 28%
- Initial D2C Capex Target — £850,000

**Supply chain node D2C status:**
- Ready: MDS Lutterworth DC, Last-Mile SE Courier
- Partial: Midlands 3PL Facility, Central Beauty Hub, Belfast Regional Hub
- Blocker: 3PL Partner North, Last-Mile Scotland Carrier

**Domain owners:**
- Product Domain → D2C Category Manager
- Sales Domain → Digital Commerce Lead
- Supply Chain Domain → Supply Chain Planner
- Customer Domain → Data Analytics Lead
