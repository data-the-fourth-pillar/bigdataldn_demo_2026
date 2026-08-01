# Stage 0.B — Functional Requirements: MDS D2C Launch Advisor

**Status:** Draft for review. Builds on the confirmed Stage 0.A concept brief (`concept-brief.md`) and the 2026-06-20 engineer-feedback review folded into it.

---

## Cross-cutting (engine/infrastructure)

**FR-1. Multi-hop graph traversal** — **Must**
The system must traverse the EKG across multiple hops to connect entities across the 5 siloed domains (ERP, marketing, supply chain, legal/CRM, finance) when answering the hero question. The existing single-hop `context_service.expand_context()` pattern does not satisfy this. Traversal depth is capped at **3–4 hops** — the EKG is hand-seeded and expected to stay small (~30–50 entities), so an unbounded traversal isn't needed and risks blowing up context size / response latency for no benefit at this scale.
*Acceptance:* a query requiring ≥3 domains to be connected (e.g. product readiness → fulfillment capability → channel conflict risk) returns a grounded answer citing entities from all relevant domains, not just 1-hop neighbors of the seed entity, within the depth cap.

**FR-2. Grounding-mode before/after toggle** — **Must**
The UI must let the presenter switch between `generic` (ungrounded LLM, no graph context) and `kg_full`/`kg_hybrid` (EKG-grounded) for the same question, live, to show the contrast.
*Acceptance:* asking the same question in both modes produces visibly different answers — generic is generic/hedged, grounded cites specific entities/relationships.

**FR-3. Roadmap / phased sequencing output** — **Must**
The system must output a multi-phase sequence (Yr1/Yr2/...) for rolling out remaining categories/regions, not just a single best-first-move, tied to the EAV-by-year projection.
*Acceptance:* hero-question response includes both a prioritised first move and an explicit phase list with rough timing/EAV tie-in.

**FR-4. Persona/session lens switching** — **Must**
The UI must let the presenter switch between CEO, VP Supply Chain, and CDO lenses over the same underlying EKG/recommendation. Business Execs session defaults to CEO; CDO/Tech session defaults to CDO.
*Acceptance:* switching lens changes which KPIs/framing surface first without changing the underlying graph or recommendation.

**FR-5. KPI-as-entity schema** — **Must**
KPIs (TAV/EAV/RV and any persona-defined KPI) must be modeled as `kpi`-typed entities linked via a `measures` relationship to the domain/region entity they apply to, persisted through the existing EKG entity/relationship CRUD API — not a separate KPI store, and not a hardcoded dict even for the pre-seeded fallback.
*Acceptance:* every KPI shown in any persona view resolves to a real entity ID in the graph, traceable the same way any other entity is.
*Known constraint (documented, not engineered around):* on Vercel, KPI entity mutations persist to `/tmp/data/graph.json`, which resets on cold start (per `VERCEL_STORAGE_FIX.md`). Runtime KPI edits during a live demo will not survive a cold start. No sync/persistence mechanism will be built to work around this for the conference deadline — if a cold start resets edited KPI values mid-demo, that's an accepted risk, not a bug to fix in this scope.

**FR-6. Multi-LLM provider selection** — **Should**
A UI control (alongside grounding-mode/persona toggles) lets the presenter pick OpenAI or Gemini live; both providers' keys are available simultaneously server-side with independent availability checks; the same grounded answer holds regardless of provider.
*Acceptance:* switching provider mid-session re-answers the same question via the other provider without restarting the app, and the EKG-grounded facts stay consistent.

**FR-7. Cross-provider `<reasoning>` tag parsing** — **Should** (hard dependency of FR-6)
Backend must reliably extract the `<reasoning>...</reasoning>` block regardless of provider. Since Gemini may omit/warp the tag where OpenAI is compliant, a fallback parser must degrade gracefully rather than erroring or showing malformed output. **Defined degradation path:** if no `<reasoning>` tag is found, the frontend explainability drawer collapses cleanly with a fallback notice ("Direct EKG response generated") instead of attempting to render a partial/broken tag.
*Acceptance:* forcing a non-compliant/malformed model response still renders a usable answer in the UI; the reasoning panel is either populated normally or replaced by the collapsed fallback notice — never showing broken tag markup.

**FR-8. Automatic provider failover** — **Could**
If the selected provider errors/times out, auto-retry the other configured provider before falling back to `generate_fallback_response()`. Failover must be surfaced visibly (toast notice naming both providers), not silently.
*Acceptance:* simulating a provider failure mid-demo shows the toast and still returns a grounded answer from the other provider, without presenter intervention.

---

## CEO lens

**FR-9. CEO business-case view** — **Must**
CEO lens surfaces TAV, EAV(-by-year), RV, and the prioritised launch recommendation, sourced from KPI entities (FR-5).
*Acceptance:* CEO view renders all three KPIs plus the hero-question recommendation without manual configuration.

**FR-10. KPI value-editing UI** — **Should** (scope narrowed from full CRUD, 2026-06-22)
Scoped to **editing the value of an existing pre-seeded KPI entity** (e.g. nudging EAV from $2M to $5M to see the recommendation shift) — not full add/delete of KPI entities/relationships. A full graph entity-creator UI (node/edge forms, valid source/target validation) is unnecessary UX surface area and risk for a live stage demo; editing values of entities that already exist via FR-5's schema is enough to demonstrate "KPIs are live and graph-backed," and is far more robust under stage conditions. Pre-seeded fixed KPI values are an acceptable fallback if even this doesn't ship in time.
*Acceptance:* editing an existing KPI entity's value live during the CEO lens updates the displayed KPI and (if downstream logic depends on it) the recommendation, without a page reload. Adding/removing KPI entities at runtime is explicitly out of scope.

## VP Supply Chain lens

**FR-11. Supply-chain readiness/blocker view** — **Must**
VP Supply Chain lens shows which supply-chain nodes are D2C-ready vs. blockers, by category and region.
*Acceptance:* view lists or visualizes readiness status per relevant supply-chain entity.

**FR-12. Color-coded readiness/blocker node styling** — **Must**
On the D3 canvas, ready nodes glow green, blocker nodes glow red/orange, when the VP Supply Chain persona is active.
*Acceptance:* toggling into VP Supply Chain lens recolors the relevant nodes on the existing graph canvas without a separate visualization.

## CDO lens

**FR-13. Data lineage / governance view** — **Must**
CDO lens shows which data products feed the EKG, how AI reasoning was grounded in specific graph nodes/relationships, and the governance model.
*Acceptance:* view surfaces the data-product sources and a human-readable governance summary.

**FR-14. Immediate graph path highlighting upon stream start** — **Must** (rephrased 2026-06-22)
`routes/chat.py`'s `/stream` endpoint already yields the full `used_entities`/`used_relationships`/citations payload as the *first* SSE event (`context_info`, before any answer-text `delta` chunks). The frontend should highlight the traversed path on the D3 canvas immediately on receiving that first event — not by parsing entity mentions out of the streamed answer text token-by-token, which would be fragile and is unnecessary given the data already arrives up front.
*Acceptance:* asking a question in CDO lens highlights the specific nodes/edges cited in that answer as soon as the stream opens (before the answer text finishes rendering), distinct from the rest of the graph. No incremental text-stream parsing is implemented for this purpose.

---

## Status: second engineer-feedback round incorporated, 2026-06-22 — pending your sign-off

Changes made from the second review (not yet a closed/locked state — open to further rounds):
- Must/Should/Could split: engineer feedback says correct as-is.
- FR-7's dependency framing on FR-6: engineer feedback says correct as-is.
- FR-1 traversal depth capped at 3–4 hops (small hand-seeded graph, no benefit to unbounded traversal at this scale).
- FR-5 now documents an explicit, accepted Vercel cold-start persistence-loss risk for KPI edits — not something to engineer around for the conference deadline.
- FR-7 degradation path defined: collapsed explainability drawer + "Direct EKG response generated" fallback notice when no `<reasoning>` tag is found.
- FR-10 narrowed from full KPI CRUD to value-editing only on pre-seeded KPI entities — full add/delete UI proposed as out of scope, unnecessary stage-demo risk.
- FR-14 rephrased to target the existing first-SSE-event payload (`context_info` in `routes/chat.py`) rather than incremental text-stream parsing.

We're moving into Non-Functional Requirements as the next Stage 0.B sub-step per your instruction, but this FR list stays open to revision — flag anything, any time.
