# Stage 0 — Phased Roadmap: MDS D2C Launch Advisor

**Status:** Draft for review. Final Stage 0 sub-stage. Builds on confirmed FR/NFR/SA/Technical Components. Hard deadline: Big Data London, mid-September 2026 (~7 weeks from 2026-07-31).

This document has two parts:

1. **Implementation roadmap** — what gets built in what order before the conference.
2. **D2C rollout narrative** — the phased output the EKG encodes and the AI advisor surfaces in response to the hero question (FR-3). This is not implementation scope; it is the content the demo must credibly demonstrate.

---

## Part 1 — Implementation Roadmap

### Timeline Overview

| Phase | Scope | Target completion |
|---|---|---|
| Stage 0 complete | All concept/design docs | 2026-07-31 (today) |
| Stage 1 — Blueprint | TRD, contracts, folder layout | ~2026-08-05 |
| Stage 2 — Antigravity Instruction Set | Coding standards, acceptance criteria | ~2026-08-07 |
| **Phase 1 — Must FRs** | Core demo end-to-end working | **~2026-08-22** |
| Stage 3 / 3.5 review (Phase 1) | Diff review + runtime audit | ~2026-08-26 |
| **Phase 2 — Should FRs** | Multi-provider + KPI edit UI | **~2026-09-03** |
| Stage 3 / 3.5 review (Phase 2) | Diff review + runtime audit | ~2026-09-06 |
| Rehearsal buffer | Demo run-through, seed reset test | 2026-09-07 to conference |

Phase 3 (Could FRs) is conditional — only attempted if Phase 2 is complete and reviewed with time to spare. Do not plan for it; plan to cut it.

---

### Phase 1 — Must FRs (target: 2026-08-22)

Goal: the demo is end-to-end functional for all three persona lenses, grounding-mode toggle works, grounded answers cite multi-hop graph paths, VP SC node coloring is live, and CDO graph-highlight fires on stream start.

**Component build order — critical path:**

```
B5 seed data  ──┐
B3 model ext  ──┼──> B4 route ──> B2 (OpenAI only) ──> B1 multi-hop ──> [backend done]
B6/B7 seeder  ──┘

F1 types ──> F2 store ──> F3 GraphCanvas ──┐
                       └──> F4 ChatInterface ──┼──> F8 AppLayout ──> [frontend done]
                       └──> F5 PersonaSelector ──┘
                       └──> F7 chatApi
```

**Batch 1 (parallel, no interdependencies):**
- **B5** — author `seed_mds_d2c.json`: all entity types, `d2c_status` on supply chain nodes, KPI entities with `measures` relationships, `phases_in_year` links. This is the highest-leverage item in Phase 1 — every persona view and the hero-question answer depend on it. Build and validate this first.
- **B3** — extend `ChatRequest` with `provider` / `personaLens`; extend `ChatResponse` with `failoverTriggered` / `failoverNotice`. No logic, just model fields.
- **F1** — add `PersonaLens`, `LLMProvider` types; extend `ChatRequest` / `ChatResponse` interfaces.

**Batch 2 (after Batch 1):**
- **B6 + B7** — seeder module + `/api/graph/seed/mds-d2c` endpoint. Unblocked once B5 JSON exists.
- **B1** — extend `context_service.py`: depth-3 `expand_context()`, MDS keyword dicts in `interpret_query()`, persona-lens ordering in `package_context()`. Can be developed against an in-progress B5.
- **F2** — extend `chatStore` with `personaLens`, `highlightedEntities/Relationships`, `setHighlightedPath`, `clearHighlightedPath`. Unblocked once F1 types exist.
- **F7** — extend `chatApi.ts` to include `provider` and `personaLens` in request body.

**Batch 3 (after Batch 2):**
- **B2 (OpenAI only, Phase 1 scope)** — dual client init, `OPENAI_MODEL`/`GEMINI_MODEL` constants, `_get_client()`, `extract_reasoning()` (FR-7), security-safe exception logging (NFR-8). Gemini client instantiation can be added but left dormant until Phase 2. OpenAI path must be fully functional end-to-end, including `<reasoning>` extraction and FR-7 degradation.
- **B4** — thread `personaLens` + `provider` through route; patch SSE error handler to suppress raw exception detail (NFR-8); emit `persona_lens` in first SSE `context_info` event.
- **F3** — structural/cosmetic `useEffect` split; VP SC node coloring (FR-12); path highlight on `highlightedEntities` (FR-14).
- **F4** — wire first SSE event → `setHighlightedPath()` (FR-14); FR-7 collapsed drawer fallback; clear highlighted path on new question.
- **F5** — `PersonaSelector` three-button toggle.

**Batch 4 (after Batch 3):**
- **F8** — mount `PersonaSelector` in layout alongside grounding-mode toggle.

**Phase 1 exit criteria (all must pass before Phase 2 starts):**
- [ ] `/api/graph/seed/mds-d2c` seeds cleanly; graph has ≥35 entities across all 5 domains; KPI entities have `measures` relationships.
- [ ] Hero question in `kg_full` mode returns a grounded answer citing entities from ≥3 domains.
- [ ] Hero question in `generic` mode returns a generic, ungrounded answer — visible contrast with `kg_full`.
- [ ] Switching to VP Supply Chain lens: supply chain nodes recolor (green/red/orange) without graph re-layout.
- [ ] Switching to CDO lens: D3 canvas highlights the traversed path nodes/edges within 1s of stream open.
- [ ] Switching to CEO lens: KPI entities (TAV/EAV/RV) surface first in the grounded answer.
- [ ] No `<reasoning>` tag in response → explainability drawer collapses with fallback notice, no broken markup.
- [ ] `/api/health` returns 200 on the deployed Vercel URL (NFR-10 warm-up check).
- [ ] Stage 3 / 3.5 review passes: no raw exception text in logs, no API key fragments in any SSE event.

---

### Phase 2 — Should FRs (target: 2026-09-03)

Goal: Gemini provider live and switchable in UI; KPI value editing works. Both are independently cuttable — if either runs long, cut it and move to rehearsal.

**B2 (Gemini activation)** — enable the Gemini client instantiated but dormant in Phase 1: wire `GEMINI_API_KEY`, test `stream_response()` via Gemini endpoint, confirm `<reasoning>` tag fallback (FR-7) fires correctly for Gemini's response format.

**F6 — `ProviderSelector`** — two-button toggle (OpenAI / Gemini). Mount in F8 alongside PersonaSelector. Unblocked once B2 Gemini path is confirmed working.

**FR-10 — KPI value editing UI** — inline edit on an existing KPI entity's `value` field in the CEO lens view. Calls the existing `PUT /api/graph/entities/{id}` endpoint (already implemented in `routes/graph.py`) — no new backend work. Frontend only: a click-to-edit field on the KPI card in the CEO lens panel.

**Phase 2 exit criteria:**
- [ ] Switching provider from OpenAI to Gemini mid-session returns a grounded answer from Gemini.
- [ ] FR-7 degradation path tested with Gemini: response missing `<reasoning>` tag collapses drawer cleanly.
- [ ] Editing a KPI entity's value in CEO lens and re-asking the hero question reflects the updated value in the grounded answer.
- [ ] Stage 3 / 3.5 review passes for Phase 2 diff: Gemini `GEMINI_API_KEY` read from env only; no key or URL path logged.

---

### Phase 3 — Could FRs (conditional, only if Phase 2 complete by ~2026-09-05)

**FR-8 — automatic failover** — failover wrapper in `stream_response()`, `stream_reset` SSE event (per Technical Components engineer feedback point 3), failover toast in `ChatInterface.tsx`. Do not attempt unless Phase 2 is reviewed and clean — a buggy failover mid-demo is worse than no failover.

---

### What to cut and in what order

If time pressure forces cuts before the conference:

1. **Cut FR-8 (Could) first** — failover is a crowd-pleaser but manual provider switch (F6) is an acceptable fallback and already planned.
2. **Cut FR-10 (Should) second** — pre-seeded fixed KPI values are explicitly the accepted fallback per FR-10 spec.
3. **Cut FR-6/F6 (Should) third** — a single working provider (OpenAI) satisfies the hero question. Gemini adds dual-key flexibility for co-presenters but is not load-bearing for the demo narrative.
4. **Never cut Must FRs** — multi-hop traversal, VP SC color coding, CDO highlight, CEO KPI entities, grounding toggle. These are the demo.

---

## Part 2 — D2C Rollout Narrative (EKG Content)

This is what the AI advisor must say in response to the hero question. It is not implementation — it is the narrative the `seed_mds_d2c.json` (B5) must encode as EKG entities and relationships, so the grounded LLM answer surfaces it credibly.

### Hero question

> *"Given MDS's current supply chain position, channel relationships, and market data — which product categories and UK regions should we prioritise for D2C launch, and what's the phased rollout plan tied to our addressable revenue projections?"*

### Part (a) — Priority recommendation (Year 1 launch)

**Category:** Sports Nutrition + Vitamins & Supplements
- Rationale encoded in EKG: highest `demand_index` in the London & SE region entity; no `exclusivity_clause` conflict in the legal entity governing these categories; `supply_chain_node` MDS Lutterworth DC has `d2c_status: 'ready'` for both.

**Region:** London & SE
- Rationale encoded in EKG: highest `d2c_penetration_pct` potential; served by ready DC; fastest path to positive unit economics (lowest last-mile cost per order among UK regions).

The AI answer cites these entities by name and links the recommendation to the `measures` relationships between KPI entities (EAV Year 1) and these category/region nodes — this is what makes it visibly different from a generic LLM answer.

### Part (b) — Phased rollout tied to EAV-by-year

| Phase | Scope | EAV target | EKG signal |
|---|---|---|---|
| Year 1 | Sports Nutrition + Vitamins, London & SE | £2M | Lutterworth DC ready; demand index high; no channel conflict |
| Year 2 | + Beauty & Personal Care + Midlands + North England | £5M cumulative | 3PL Partner North contract resolved (was blocker); Beauty exclusivity clause expires |
| Year 3 | + Pet Nutrition + Scotland + Wales; remaining channel conflicts closed | £9M cumulative | Last-Mile Scotland coverage contracted; full UK footprint |
| TAV | Full UK D2C opportunity (all categories, all regions) | £15M | Sum of all regional `demand_index` × category `d2c_potential` |
| RV baseline | Existing wholesale revenue for context | £45M | Finance entity; frames D2C as incremental, not cannibalising |

**Blocker nodes that the VP Supply Chain lens must surface (FR-11/FR-12):**

| Node | `d2c_status` | `blocker_reason` | Resolved in phase |
|---|---|---|---|
| 3PL Partner North | `blocker` | No D2C-spec pick/pack agreement in current MSA | Year 2 |
| Last-Mile Scotland | `blocker` | No last-mile coverage contract north of Edinburgh | Year 3 |
| MDS Lutterworth DC | `ready` | D2C-capable; pick/pack SLA confirmed | Year 1 |
| Last-Mile SE | `ready` | Next-day coverage; D2C rates agreed | Year 1 |
| Midlands 3PL | `partial` | Capable but needs D2C SLA addendum | Year 2 |

**Legal constraint nodes that feed channel conflict (FR-11):**

| Node | `contract_type` | `exclusivity_clause` | Impact |
|---|---|---|---|
| Retailer Channel Agreement | Wholesale exclusive | Beauty & Personal Care — 18-month exclusivity | Blocks Beauty D2C until exclusivity expires; Year 2 entry |
| 3PL MSA | Logistics | None | No D2C conflict |

The `phases_in_year` relationship (product_category → kpi EAV Year N) and `governs` relationship (legal_entity → marketing_channel) are the graph edges that let the multi-hop traversal connect the blocker reasoning to the EAV phasing in a single grounded answer — this is the core "why the graph matters" demonstration.

---

## Open Item from Technical Components (carried forward)

The four open items deferred to Stage 1 in `technical-components.md` remain open. The roadmap does not resolve them — Stage 1 Blueprint will.

---

*Pending your review and sign-off. Once confirmed, Stage 0 is complete and Stage 1 Blueprint is next.*
