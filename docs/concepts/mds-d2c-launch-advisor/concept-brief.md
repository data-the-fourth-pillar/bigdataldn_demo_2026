# Stage 0.A — Concept Brief: MDS D2C Launch Advisor

**Status:** Confirmed by Sujay, 2026-06-19. Proceed to Stage 0.B (Functional Requirements).

---

MDS (My Dream Shoe) is a branded sports shoe manufacturer currently operating a wholesale distribution model — selling through UK retail partners such as JD Sports, Decathlon, and Foot Locker. The business wants to launch Direct-to-Consumer (D2C) in the UK next quarter. The strategic question is not whether to launch, but *where to start and in what sequence*. The hero question has two parts:

**a) Prioritisation** — which product categories (Running, Fashion, Trail, etc.) and which UK regions (London, Manchester, Birmingham, etc.) should MDS start with?

**b) Roadmap** — what is the phased sequence for rolling out the remaining categories/regions over time (tying to the EAV-by-year projection, Yr1/Yr2/...)? This is not a single best-first-move answer — the system must produce a multi-phase sequence, not just a top pick.

This question cannot be answered by any single system MDS currently operates. Product readiness data lives in the ERP. Consumer demand signals live in marketing analytics. Fulfillment capability (small-parcel, last-mile logistics) lives in supply chain systems. Retailer channel conflict risk lives in legal/CRM contracts. Margin data by category and channel lives in finance. The Enterprise Knowledge Graph (EKG) is the connective tissue that models all these domains and their relationships. An AI agent traversing the EKG can answer the hero question with grounded, cited, explainable reasoning — something a generic LLM cannot do reliably, and something no siloed dashboard can do at all.

The demo is a live web application with three persona views — **CEO**, **VP Supply Chain**, and **CDO** — each seeing the same EKG through a different lens. The CEO sees the business case: TAV (Total Addressable Value of the D2C initiative), EAV (Expected Addressable Value by year per the roadmap), and RV (Realized Value trajectory) alongside a prioritised launch recommendation. The VP Supply Chain sees which supply chain nodes are D2C-ready and which are blockers — by category and region. The CDO sees the data lineage: which data products feed the EKG, how the AI reasoning was grounded in specific graph nodes and relationships, and what the governance model looks like. The demo is designed to serve a Big Data London audience that spans all three personas in the room simultaneously, and to make the book's Data Operating Model framework tangible and concrete rather than conceptual.

---

## Scope decisions confirmed during 0.A

- **Multi-hop traversal is required.** The hero question spans five siloed domains (ERP, marketing analytics, supply chain, legal/CRM, finance); a single-hop neighbor expansion (the current `context_service.expand_context()` pattern) cannot credibly connect them. Stage 0.B functional/non-functional requirements and Stage 0 architecture options must scope the EKG traversal as genuine multi-hop graph reasoning, not the existing 1-hop pattern. (Confirmed by Sujay, 2026-06-19.)
- **EKG is fully hand-curated/seeded for the demo** — not built live on stage from documents. The live stage moment instead contrasts AI agent behavior *without* the EKG (`groundingMode: generic` — ungrounded, no graph context) against the same question *with* the EKG (`groundingMode: kg_full`/`kg_hybrid` — grounded, cited, explainable). This maps directly onto the grounding-mode switch already in `context_service.package_context` / `llm_service.build_prompt`, so the before/after demo is a UI toggle over existing infrastructure rather than new plumbing. (Confirmed by Sujay, 2026-06-19.)
- **KPIs are configurable, not fixed, per persona.** TAV/EAV/RV (CEO) and any CDO/VP Supply Chain KPIs are not a hardcoded list — a persona can add, edit, or remove KPIs live during the demo, reflecting how a real persona's KPI set evolves over the course of an initiative. This is a functional requirement (KPI CRUD against the graph/persona view), not just a content question, so the previous open item ("CDO KPIs beyond TAV/EAV/RV — to be supplied") is superseded: no fixed CDO KPI list needs to be supplied up front, since the feature itself must support defining new ones at runtime. (Confirmed by Sujay, 2026-06-19.)
- **Multi-LLM-provider support, selectable live in the UI.** Replace the single hardcoded OpenAI `gpt-4o-mini` integration with a provider abstraction exposed as a UI dropdown (alongside the existing persona/grounding-mode toggles), not just a server-side env var — so the presenter can switch providers (OpenAI ↔ Gemini) live on stage and show the EKG-grounded answer staying consistent regardless of underlying LLM. This requires both `OPENAI_API_KEY` and `GEMINI_API_KEY` to be available simultaneously in the running backend (with independent per-provider availability checks), and threads a `provider` parameter through the same three layers `groundingMode` already touches (`routes/chat.py` → `context_service`/`llm_service` → frontend type). Narrative bonus: reinforces the CDO-persona governance story that EKG grounding — not LLM choice — is what makes the answer trustworthy. Provider-abstraction design and the cross-provider `<reasoning>` tag contract are Stage 0.B/1 concerns. (Confirmed by Sujay, 2026-06-19.)
- **Automatic provider failover.** If the UI-selected provider is unavailable or errors at request time, the backend automatically retries against the other configured provider before falling back to the existing no-LLM regex response (`generate_fallback_response()`), so a live demo never stalls on a single provider outage. Failover order, retry/timeout thresholds, and how the failover is surfaced to the presenter (silent vs. a visible "switched to Gemini" notice) are Stage 0.B/1 design details. (Confirmed by Sujay, 2026-06-19.)
- **The two conference sessions differ by KPI emphasis, not by content.** It's one demo, not two — but the Business Execs session defaults to the CEO persona/lens (TAV/EAV/RV, business-case framing) and the CDO/Tech session defaults to the CDO persona/lens (data lineage, governance, grounding KPIs). Whichever KPI set is in focus determines which outcome framing the AI surfaces first (business case vs. technical/governance explanation) — same underlying EKG and recommendation, different lens on top. (Confirmed by Sujay, 2026-06-19.)

All Stage 0.A open items are now resolved.

## Preliminary MoSCoW pass (full pass deferred to Stage 0.B)

Done now to flag scope-vs-timeline risk ahead of the Sept 2026 conference date; formal Stage 0.B Functional Requirements will restate these properly.

**Must:**
- Multi-hop traversal across the 5 siloed domains
- EKG fully seeded + before/after (`generic` vs. grounded) demo toggle
- Roadmap/phased sequencing output (hero question part b)
- Session-specific KPI emphasis (CEO lens for Business Execs session, CDO lens for CDO/Tech session)

**Should:**
- Configurable KPI CRUD at runtime (per persona) — pre-seeded fixed KPIs are an acceptable fallback if time runs short
- Multi-LLM provider UI selection (OpenAI + Gemini live, switchable) — a single working provider is sufficient to land the hero question if needed

**Could:**
- Automatic provider failover — a presenter manual-switch/backup plan is an acceptable substitute; build only after Musts and Shoulds are solid

(Confirmed by Sujay, 2026-06-19.)
