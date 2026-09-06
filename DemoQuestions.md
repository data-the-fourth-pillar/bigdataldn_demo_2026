# Demo Questions — Big Data London

Three flagship questions, one per persona. Each is asked **identically across all three grounding modes** (Generic → Data → Data + EC) so the audience sees the same question get a materially better answer as context is added.

**Suggested run order:** lead with CEO — run all 3 modes back-to-back on the identical question — then repeat just the Data → Data+EC jump for VP Supply Chain and CDO to show it's not a one-off.

---

## CEO — "Which product category should we launch D2C first, and what return can we expect?"

| Mode | What happens | What to point out live |
|---|---|---|
| **Generic** | Generic industry playbook: "start small, test highest-margin SKUs, watch fulfilment costs" — no MDS category names, no numbers. | It could be any company's advice. Zero specificity. |
| **Data** | Pulls all 5 data product tables, including D2C Financial Performance Data (Capex £750K, Marketing Budget £350K, COGS £14.50/order, Break-Even 9 months, Gross Margin target 62%, ROI target 28%, Wholesale Baseline £45M). Can spot Sports Nutrition has the highest target margin and is D2C-ready — but still has no idea whether supply chain can actually fulfil it, can't see the Channel Exclusivity Policy that restricts which categories go where, and has no concept of legal-entity accountability for that spend. | Even with every number in the warehouse, it's structurally blind to relationships — it's not a "less data" problem, it's a "no ownership or risk context" problem. |
| **Data + EC** | Names Sports Nutrition, cites the actual KPI targets, flags that Central Beauty Hub is only Partial-ready and 3PL Partner North is a Blocker, surfaces the Channel Exclusivity Policy and D2C Pricing Policy constraints, names D2C Category Manager as the operational owner — **and now also names MDS D2C OpCo Ltd as the legal entity the Capex/Marketing spend is booked to**, since Cost/Budget items are now linked to the legal entity that bears them. | The "aha" moment — decision-grade answer with real risk flags, an accountable person, *and* an accountable legal entity, none of which Data mode could see regardless of how many tables it had. |

## VP Supply Chain — "Which supply chain nodes are ready for D2C, and what should I fix first?"

| Mode | What happens | What to point out live |
|---|---|---|
| **Generic** | Generic "audit capacity, lead times, 3PL partners" advice. No node names. | Useless for an actual ops decision. |
| **Data** | Lists all 7 nodes' status from the raw table: Lutterworth DC + Last-Mile SE Courier (Ready), Midlands 3PL Facility + Central Beauty Hub + Belfast Regional Hub (Partial), 3PL Partner North + Last-Mile Scotland Carrier (Blocker). Numbers only — no idea why they're blocked, who owns fixing them, or what policy or legal entity governs them. | It can enumerate but not diagnose or assign ownership. |
| **Data + EC** | Same node list, but tied to the 3PL Master Services Agreement and National Courier Terms policies, the Supply Chain Planner as the accountable owner via the Supply Chain Domain — **and now also names MDS D2C OpCo Ltd as the legal entity those policies apply to**, since Policy → Legal Entity links now exist. | The jump from "here's a status list" to "here's who's accountable, under what contract, and for which legal entity." |

## CDO — "Which data products power our D2C decisions, and how are they connected?"

| Mode | What happens | What to point out live |
|---|---|---|
| **Generic** | Generic "maintain a data catalog, understand your lineage" talking points. No MDS system or dataset names. | Boilerplate — this is what every data-maturity slide already says. |
| **Data** | Dumps all 5 data product tables (Product Catalogue, Customer Insights, Supply Chain, Sales Revenue, D2C Financial Performance) — real numbers, but zero idea which dataset feeds which, or who's accountable for any of them. Lineage is inherently a relationship concept, so this is the mode's most exposed failure of the three flagships. | It can list datasets but cannot trace a single arrow between them — lineage literally cannot live in a spreadsheet. |
| **Data + EC** | Names the actual lineage chain — Product Catalogue Data as the master dataset feeding Sales Revenue Data and Supply Chain Data, which in turn feed Customer Insights Data and D2C Financial Performance Data — and names Data Analytics Lead (employed at the Group level, not a subsidiary) as the owner overseeing all 5, not just Customer Insights Data. | Strongest contrast of the three: Data mode can't even attempt the "how are they connected" half of the question; Data+EC traces the whole chain and names one accountable owner across it. |

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

**Legal entity accountability (added 2026-09-06):**
- D2C launch Cost/Budget items (Capex, Marketing Budget, COGS, Break-Even) — booked to MDS D2C OpCo Ltd
- Wholesale Operating Margin — booked to MDS Wholesale Trading Ltd
- 3PL Master Services Agreement, National Courier Terms, D2C Pricing Policy, Customer Consent Personalisation Policy — apply to MDS D2C OpCo Ltd
- Channel Exclusivity Policy — applies to both MDS D2C OpCo Ltd and MDS Wholesale Trading Ltd
- Customer Data Privacy Policy, Supplier Code of Conduct, New Product Introduction, Product Data Quality Standard — apply to MDS Group Ltd (group-wide standards)

**Data product lineage (added 2026-09-06):**
- Product Catalogue Data — master dataset, nothing depends on it further upstream
- Sales Revenue Data, Supply Chain Data — depend on Product Catalogue Data
- Customer Insights Data, D2C Financial Performance Data — depend on Sales Revenue Data
- Data Analytics Lead oversees all 5 data products (manages Customer Insights Data directly; consumes the other 4) — a group-wide role, since they're employed by MDS Group Ltd rather than a subsidiary
