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

## Engineer feedback incorporated (pre-Stage 0.B), 2026-06-20

Antigravity (Engineer) reviewed the confirmed brief and raised five points. Three resolve open design questions already deferred to Stage 0.B/1; one is a Stage 1 architecture recommendation; one is new scope requiring a MoSCoW decision.

- **CDO lens graph-highlight-on-answer.** `context_service.py` already returns `used_entities`/`used_relationships` per response (verified in code, lines 225-226), threaded through `routes/chat.py` to the frontend. Resolves the CDO lens's lineage requirement concretely: the D3 canvas highlights the traversed node/edge path as the AI answer streams in. Pure frontend wiring against existing data — no new backend work. (Confirmed by Sujay, 2026-06-20.)
- **Failover visibility resolved: visible, not silent.** Answers the open question on failover surfacing (line 25 above) — show a toast (e.g. "OpenAI request timed out. Auto-failing over to Gemini.") rather than switching silently. A visible failover reinforces the EKG-governance narrative and is a stage crowd-pleaser if it fires live. (Confirmed by Sujay, 2026-06-20.)
- **Cross-provider `<reasoning>` tag parsing.** Answers the open cross-provider tag contract question (line 24 above). OpenAI is reliably compliant; Gemini may omit/warp the tag. Stage 1 must specify a fallback parser (regex-extract `<reasoning>...</reasoning>`, with a defined degrade path — e.g. treat the whole response as the answer with no reasoning panel — if the tag is missing) rather than assuming prompt compliance. (Confirmed by Sujay, 2026-06-20.)
- **KPI-as-entity schema — promoted to Must.** KPIs (TAV/EAV/RV and any persona-defined KPI) must be modeled as `kpi`-typed entities linked via a `measures` relationship to the domain/region entity they apply to, reusing the existing EKG node/edge CRUD API instead of a separate KPI store. This is a Must independent of whether the runtime CRUD *feature* ships (that part stays Should, see below): even the fallback path of pre-seeded fixed KPIs must seed them as real EKG entities, not a hardcoded dict — otherwise the CEO/CDO lens KPIs aren't traceable/groundable like the rest of the graph, which breaks the core "AI reasoning grounded in specific graph nodes" narrative the whole demo depends on. Carries the same Vercel ephemeral-`/tmp` persistence caveat already documented in `VERCEL_STORAGE_FIX.md`, since KPI mutations go through the same `storage_service` path as the rest of the graph. (Confirmed by Sujay, 2026-06-20.)
- **VP Supply Chain color-coded readiness/blocker styling — promoted to Must.** Green-glow (D2C-ready) / red-glow (blocker) semantic node styling on the D3 canvas when the VP Supply Chain persona is active. Was implied narratively (line 15) but not previously a named deliverable or MoSCoW item. Promoted to Must, not Should: without visual status coding the VP Supply Chain lens degrades to reading text descriptions, and the VP Supply Chain lens itself is already a Must. (Confirmed by Sujay, 2026-06-20.)

## Preliminary MoSCoW pass (full pass deferred to Stage 0.B)

Done now to flag scope-vs-timeline risk ahead of the Sept 2026 conference date; formal Stage 0.B Functional Requirements will restate these properly.

**Must:**
- Multi-hop traversal across the 5 siloed domains
- EKG fully seeded + before/after (`generic` vs. grounded) demo toggle
- Roadmap/phased sequencing output (hero question part b)
- Session-specific KPI emphasis (CEO lens for Business Execs session, CDO lens for CDO/Tech session)
- VP Supply Chain color-coded readiness/blocker node styling (green = D2C-ready, red/orange = blocker) — added 2026-06-20
- KPIs modeled as first-class EKG entities/relationships (`kpi` entity + `measures` relationship), not a separate store — added 2026-06-20

**Should:**
- Configurable KPI CRUD *feature* at runtime (per persona) — the underlying schema (KPIs as EKG entities, above) is a Must regardless; what's still cuttable is the live add/edit/remove UI itself. Pre-seeded fixed KPIs (as real entities) are an acceptable fallback if time runs short
- Multi-LLM provider UI selection (OpenAI + Gemini live, switchable) — a single working provider is sufficient to land the hero question if needed

**Could:**
- Automatic provider failover — a presenter manual-switch/backup plan is an acceptable substitute; build only after Musts and Shoulds are solid

(Confirmed by Sujay, 2026-06-19.)
