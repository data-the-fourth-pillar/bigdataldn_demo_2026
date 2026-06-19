# Stage 0.A — Concept Brief: MDS D2C Launch Advisor

**Status:** Drafted 2026-06-19. Not yet explicitly confirmed by Sujay — confirm before proceeding to Stage 0.B (Functional Requirements).

---

MDS (My Dream Shoe) is a branded sports shoe manufacturer currently operating a wholesale distribution model — selling through UK retail partners such as JD Sports, Decathlon, and Foot Locker. The business wants to launch Direct-to-Consumer (D2C) in the UK next quarter. The strategic question is not whether to launch, but *where to start and in what sequence* — specifically, which product categories (Running, Fashion, Trail, etc.) and which UK regions (London, Manchester, Birmingham, etc.) to prioritise, and what the phased roadmap looks like for the rest.

This question cannot be answered by any single system MDS currently operates. Product readiness data lives in the ERP. Consumer demand signals live in marketing analytics. Fulfillment capability (small-parcel, last-mile logistics) lives in supply chain systems. Retailer channel conflict risk lives in legal/CRM contracts. Margin data by category and channel lives in finance. The Enterprise Knowledge Graph (EKG) is the connective tissue that models all these domains and their relationships. An AI agent traversing the EKG can answer the hero question with grounded, cited, explainable reasoning — something a generic LLM cannot do reliably, and something no siloed dashboard can do at all.

The demo is a live web application with three persona views — **CEO**, **VP Supply Chain**, and **CDO** — each seeing the same EKG through a different lens. The CEO sees the business case: TAV (Total Addressable Value of the D2C initiative), EAV (Expected Addressable Value by year per the roadmap), and RV (Realized Value trajectory) alongside a prioritised launch recommendation. The VP Supply Chain sees which supply chain nodes are D2C-ready and which are blockers — by category and region. The CDO sees the data lineage: which data products feed the EKG, how the AI reasoning was grounded in specific graph nodes and relationships, and what the governance model looks like. The demo is designed to serve a Big Data London audience that spans all three personas in the room simultaneously, and to make the book's Data Operating Model framework tangible and concrete rather than conceptual.

---

## Open items carried into Stage 0.B

- CDO-persona KPIs beyond TAV/EAV/RV — to be supplied by Sujay.
- LLM provider choice (currently OpenAI `gpt-4o-mini`, inherited from the original repo) — not yet revisited for this use case.
- Whether the EKG should be hand-curated/seeded (current pattern) or partially built live on stage from documents — not yet discussed.
