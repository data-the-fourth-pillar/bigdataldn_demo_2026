# Stage 0 — Technical Components: MDS D2C Launch Advisor

**Status:** Draft for review. Builds on the confirmed Solution Architecture (Option 1 — extend the existing stack in place), closed FR list (`functional-requirements.md`), and closed NFR list (`non-functional-requirements.md`).

---

## Component Inventory

| # | Component | File | Change Type | FRs / NFRs |
|---|---|---|---|---|
| B1 | Multi-hop context assembly | `backend/services/context_service.py` | Modify | FR-1, FR-3 |
| B2 | LLM provider router | `backend/services/llm_service.py` | Modify | FR-6, FR-7, FR-8, NFR-7, NFR-8, NFR-9 |
| B3 | Chat request model | `backend/models/chat.py` | Modify | FR-4, FR-6 |
| B4 | Chat route | `backend/routes/chat.py` | Modify | FR-4, FR-6, FR-8 |
| B5 | MDS D2C seed data | `backend/data/seed_mds_d2c.json` | New | FR-2, FR-3, FR-5, FR-9, FR-11, FR-12 |
| B6 | MDS D2C seeder module | `backend/services/seed_mds_d2c.py` | New | FR-5 |
| B7 | App entrypoint | `backend/main.py` | Modify | B6 wiring |
| F1 | Chat type definitions | `src/types/chat.ts` | Modify | FR-4, FR-6, FR-7, FR-8 |
| F2 | Chat store | `src/store/chatStore.ts` | Modify | FR-4, FR-6, FR-7, FR-14 |
| F3 | D3 graph canvas | `src/components/Graph/GraphCanvas.tsx` | Modify | FR-12, FR-14 |
| F4 | Chat interface | `src/components/Chat/ChatInterface.tsx` | Modify | FR-7, FR-8, FR-14 |
| F5 | Persona selector | `src/components/Controls/PersonaSelector.tsx` | New | FR-4 |
| F6 | Provider selector | `src/components/Controls/ProviderSelector.tsx` | New | FR-6 |
| F7 | Chat API client | `src/api/chatApi.ts` | Modify | FR-4, FR-6 |
| F8 | App layout | `src/components/Layout/AppLayout.tsx` | Modify | FR-4, FR-6 (surface new controls) |

No new Python packages. No new npm packages. The `openai` SDK already installed drives both OpenAI and Gemini (via Gemini's OpenAI-compat endpoint). D3 highlight/glow is CSS + attribute changes on existing D3 selections.

---

## Backend Components

### B1 — `backend/services/context_service.py` (Modify)

**What changes:**

1. **`CATEGORY_LABELS`** — add entries for the five new MDS entity types:
   `product_category`, `region`, `supply_chain_node`, `marketing_channel`, `kpi`, `legal_entity`, `finance_entity`.

2. **`interpret_query()`** — extend `type_keywords` and `rel_keywords` dicts to cover MDS-domain vocabulary (e.g., `kpi` ← ["kpi", "eav", "tav", "rv", "revenue"], `supply_chain_node` ← ["fulfillment", "warehouse", "supply chain", "3pl"], `region` ← ["london", "uk", "region", "southeast", "midlands"]). Existing non-MDS entries are **preserved** — the seed-switching endpoint at `/api/graph/seed/*` already handles dataset switching, so `interpret_query` must work across both seed datasets.

3. **`expand_context()`** — parameterise traversal depth. Currently hardcoded to `get_neighbors(entity.id, depth=1)` for up to 5 seed entities, neighbour count capped at 8. Change signature to accept `depth: int = 1` defaulting to existing behaviour; the chat route will pass `depth=3` when `groundingMode != 'generic'` to satisfy FR-1. The cap of 5 seed entities and 8 neighbours per seed is retained — at the target EKG size (30–50 entities) a depth-3 BFS over 5 seeds will comfortably saturate the graph without blowing up context size.

   **Deduplication — two layers already in place (engineer feedback point 1):** `get_neighbors()` maintains a `visited` set seeded with the start entity (lines 122–134 of `graph_service.py`, post-bugfix) — cycles within a single BFS call are already pruned. Across multiple seed entity calls, `expand_context()` accumulates all returned IDs into a single `entity_ids` Python set, which naturally deduplicates any overlap between the 5 seeds' neighbour expansions before passing to `get_subgraph()`. No additional deduplication logic is needed; this should be explicitly confirmed in the Stage 3 diff review rather than re-invented in code.

4. **`package_context()`** — accept `persona_lens: str = 'ceo'` param. Use it to order and filter what surfaces first in the context string:
   - `ceo`: KPI entities surface first (TAV, EAV-by-year, RV), then recommendations.
   - `vp_supply_chain`: supply chain nodes surface first with their `d2c_status` property included in the description line.
   - `cdo`: no reordering — the existing entity list order is fine; CDO lens is about graph-path highlighting (FR-14), which is frontend-only.
   Persona lens does **not** change which entities are in the subgraph — it only affects presentation order in the context string so the LLM answer front-loads the right framing.

5. **`assemble_context()`** — add `persona_lens: str = 'ceo'` param; pass it to `package_context()` and include it in the returned dict so `routes/chat.py` can forward it in the first SSE event.

---

### B2 — `backend/services/llm_service.py` (Modify)

**What changes:**

1. **Dual client init** — replace single `self.client` with `self.openai_client` (keyed by `OPENAI_API_KEY`) and `self.gemini_client` (keyed by `GEMINI_API_KEY`, `base_url='https://generativelanguage.googleapis.com/v1beta/openai/'`). Each client has a separate `available` flag (`self.openai_available`, `self.gemini_available`). Existing fallback path (`generate_fallback_response()`) triggers when both are unavailable.

   **Provider-specific model constants (engineer feedback point 2):** OpenAI and Gemini require different model identifier strings — a single shared `self.model` is incorrect. Define two module-level constants instead:
   ```python
   OPENAI_MODEL = "gpt-4o-mini"
   GEMINI_MODEL = "gemini-2.0-flash"
   ```
   `_get_client()` returns the appropriate `(client, model)` pair for the requested provider; callers never need to know which model string applies to which provider.

2. **`_get_client(provider: str)`** — private method returning `(client, model, resolved_provider_name)` for a given provider string (`'openai'` | `'gemini'`), with a fallback to whichever client is available if the requested one is not. `resolved_provider_name` may differ from `provider` when fallback occurs (used in the FR-8 failover notice string).

3. **`build_prompt()`** — add `persona_lens: str = 'ceo'` param. Append a short persona-framing instruction to the system message (e.g., "You are advising a CEO — lead with TAV/EAV/RV business impact." / "You are advising a VP Supply Chain — lead with readiness status and blockers." / "You are advising a CDO — lead with data lineage and governance."). Everything else in `build_prompt()` is unchanged.

4. **`generate_response()` and `stream_response()`** — add `provider: str = 'openai'` and `persona_lens: str = 'ceo'` params; thread both through to `_get_client()` and `build_prompt()`.

5. **FR-7 — `extract_reasoning(raw: str) -> tuple[str, str]`** — new private method. Regex-extracts `<reasoning>...</reasoning>`. Returns `(reasoning_text, answer_text)`. If the tag is absent or malformed, returns `('', raw)` — the caller treats empty reasoning as the collapsed-drawer signal (FR-7 degradation path). Applied in both `generate_response()` (populates `message.reasoning`) and as a pass on the full concatenated stream output in `stream_response()` before the final SSE event.

6. **FR-8 (Could) — failover wrapper** — if FR-8 ships: wrap the primary provider call in `asyncio.wait_for(..., timeout=NFR-9's 3–5s)`. On `TimeoutError` or provider `APIError`, retry against the other available client and set `failover_triggered=True` / `failover_notice="<primary> timed out — switched to <fallback>."` in the return dict. If FR-8 is cut, the try/except already in place degrades to `generate_fallback_response()` as today.

   **Mid-stream failover safety (engineer feedback point 3):** Failover must be detected and resolved *before* any answer `delta` chunks are emitted to the client. In `stream_response()`, the timeout wraps the provider call that *opens* the stream — if the initial connection or first chunk does not arrive within the threshold, failover triggers before `yield` begins. If failover occurs after chunks have already been yielded (e.g. provider drops mid-stream), `stream_response()` must emit a structured `event: stream_reset` SSE event before starting the secondary provider's generator, so the frontend can clear its accumulated buffer before appending new chunks. This prevents partial answers from two providers being concatenated. The `stream_reset` event shape:
   ```json
   {"type": "stream_reset", "failoverNotice": "OpenAI dropped mid-stream — retrying with Gemini."}
   ```
   `ChatInterface.tsx` must handle this event by clearing `currentStreamingMessage` in `chatStore` before resuming `appendStreamChunk` calls.

7. **Security** — replace `print(f"LLM Error: {e}")` in both exception handlers with a safe log: `print("LLM provider error — details suppressed")`. Raw exception messages from provider SDKs can contain URL paths, API key fragments, or response body excerpts (NFR-8). No further logging/telemetry change needed for this scope.

---

### B3 — `backend/models/chat.py` (Modify)

**What changes:**

Add two optional fields to `ChatRequest`:
```
provider: str = 'openai'        # 'openai' | 'gemini'
personaLens: str = 'ceo'        # 'ceo' | 'vp_supply_chain' | 'cdo'
```

Add two optional fields to `ChatResponse` (for FR-8 failover surfacing):
```
failoverTriggered: Optional[bool] = None
failoverNotice: Optional[str] = None
```

No other model changes.

---

### B4 — `backend/routes/chat.py` (Modify)

**What changes:**

1. Thread `request.provider` and `request.personaLens` through to `context_service.assemble_context()` and `llm_service.generate_response()` / `llm_service.stream_response()`.

2. In the `/stream` route's `generate()` function: include `persona_lens` in the first SSE `context_info` event so the frontend can use it for persona-conditional rendering without re-deriving it from store state.

3. If FR-8 ships: include `failover_triggered` and `failover_notice` from the LLM response dict in the final SSE event (a new `"done": true` event shape) and in the `/message` `ChatResponse`.

4. **Security** — the existing exception handler in `generate()` uses `str(e)` in the SSE error event. Replace with a generic `"Stream error — please retry."` to avoid leaking exception detail to the browser (NFR-8).

---

### B5 — `backend/data/seed_mds_d2c.json` (New)

The hero EKG. ~35–45 entities across 5 domains, hand-seeded.

**Entity types and key `properties` fields:**

| Entity type | Key `properties` | Count | Examples |
|---|---|---|---|
| `product_category` | `sku_count`, `current_channel`, `d2c_potential` | 4–5 | Sports Nutrition, Vitamins & Supplements, Beauty & Personal Care, Pet Nutrition |
| `region` | `uk_sub_region`, `demand_index`, `d2c_penetration_pct` | 4–5 | London & SE, Midlands, North England, Scotland, Wales |
| `supply_chain_node` | `d2c_status` (`'ready'`\|`'blocker'`\|`'partial'`), `blocker_reason`, `node_type` (`'warehouse'`\|`'3pl'`\|`'fulfilment_centre'`) | 6–8 | MDS Lutterworth DC, 3PL Partner North, Last-Mile SE |
| `marketing_channel` | `channel_type`, `conflict_risk` (`'high'`\|`'low'`\|`'none'`) | 3–4 | MDS Trade Wholesale, Amazon UK, MDS D2C (new) |
| `kpi` | `value`, `unit`, `year`, `lens` | 6–8 | TAV UK D2C, EAV Year 1, EAV Year 2, EAV Year 3, RV Baseline, D2C Margin Target |
| `legal_entity` | `contract_type`, `exclusivity_clause` | 2–3 | Retailer Channel Agreement, 3PL MSA |
| `finance_entity` | `metric_type`, `value`, `currency` | 3–4 | D2C Capex Estimate, Break-even Month, COGs D2C |

**Relationship types:**

| Relationship type | Source → Target | Notes |
|---|---|---|
| `measures` | `kpi` → `product_category` or `region` | FR-5 core schema |
| `fulfils_region` | `supply_chain_node` → `region` | which DC serves which region |
| `serves_category` | `supply_chain_node` → `product_category` | which DC handles which category |
| `competes_with` | `marketing_channel` → `marketing_channel` | channel conflict signal (FR-11) |
| `governs` | `legal_entity` → `marketing_channel` | exclusivity/conflict constraints |
| `funds` | `finance_entity` → `product_category` or `region` | capex/RV tie-in |
| `phases_in_year` | `product_category` → `kpi` | EAV-by-year roadmap linkage (FR-3) |
| `depends_on` | `product_category` → `supply_chain_node` | which categories need which nodes ready |

**Critical properties for FR-12 (VP SC color-coding):**
`supply_chain_node.properties.d2c_status` drives node color. Must be present on every `supply_chain_node` entity in the seed. Valid values: `'ready'` (green glow), `'blocker'` (red/orange glow), `'partial'` (amber, neutral treatment acceptable).

**KPI entity shape (FR-5 canonical form):**
```json
{
  "id": "kpi-eav-yr1",
  "type": "kpi",
  "name": "EAV Year 1",
  "description": "Estimated addressable D2C revenue in year 1 of rollout",
  "properties": {
    "value": 2000000,
    "unit": "GBP",
    "year": 1,
    "lens": "ceo"
  }
}
```
All KPI entities link to at least one `product_category` or `region` via a `measures` relationship.

The full JSON schema (node/edge shape) follows the existing `seed_big_data_demo.json` format exactly — no schema changes required in `graph_service.py` or `models/graph.py`.

---

### B6 — `backend/services/seed_mds_d2c.py` (New)

Parallel to `seed_big_data_demo.py`. Loads `backend/data/seed_mds_d2c.json`, clears the current graph, and calls `graph_service.add_entity()` / `graph_service.add_relationship()` in bulk. Called by the seed endpoint added in B7.

---

### B7 — `backend/main.py` (Modify)

Add one endpoint:
```
POST /api/graph/seed/mds-d2c
```
Parallel to existing `/api/graph/seed/demo` and `/api/graph/seed/customer`. Calls `seed_mds_d2c.seed_mds_d2c_graph()`. No other `main.py` changes.

---

## Frontend Components

### F1 — `src/types/chat.ts` (Modify)

Add:
```ts
export type PersonaLens = 'ceo' | 'vp_supply_chain' | 'cdo';
export type LLMProvider  = 'openai' | 'gemini';
```

Extend `ChatRequest`:
```ts
provider?: LLMProvider;      // default 'openai'
personaLens?: PersonaLens;   // default 'ceo'
```

Extend `ChatResponse`:
```ts
failoverTriggered?: boolean;
failoverNotice?: string;
```

No changes to `GroundingMode` — the existing three values are still correct.

---

### F2 — `src/store/chatStore.ts` (Modify)

Add state fields:
```ts
personaLens: PersonaLens;           // default 'ceo'
provider: LLMProvider;              // default 'openai'
highlightedEntities: string[];      // entity IDs from last context_info SSE event
highlightedRelationships: string[]; // relationship IDs from last context_info SSE event
```

Add actions:
```ts
setPersonaLens: (lens: PersonaLens) => void;
setProvider: (provider: LLMProvider) => void;
setHighlightedPath: (entities: string[], relationships: string[]) => void;
clearHighlightedPath: () => void;    // called on new question or clear
```

`highlightedPath` is set from the first SSE event in `ChatInterface.tsx` (F4). `clearHighlightedPath()` is called on `clearMessages()` and at the start of a new stream.

---

### F3 — `src/components/Graph/GraphCanvas.tsx` (Modify)

Two visual changes, both applied to the existing D3 node/link rendering:

**FR-14 — path highlight:**
- Props: `highlightedEntities: string[]`, `highlightedRelationships: string[]` (read from `chatStore`).
- In the D3 node `attr('fill')` / `attr('stroke')` callbacks: if `node.id` is in `highlightedEntities`, apply a highlight stroke (e.g. `2px white glow` or `stroke-width: 3, stroke: #fff`). Highlighted edges similarly get a contrasting stroke.
- Highlight is additive — it does not override the persona-lens color from FR-12, it stacks on top (e.g., stroke-width increase + opacity on non-highlighted nodes).

**FR-12 — VP SC readiness color coding:**
- Props: `personaLens: PersonaLens` (read from `chatStore`).
- Node `fill` callback: when `personaLens === 'vp_supply_chain'` and `node.type === 'supply_chain_node'`, derive color from `node.properties.d2c_status`:
  - `'ready'` → green (`#22c55e`) with soft radial glow (CSS `filter: drop-shadow(0 0 6px #22c55e)`)
  - `'blocker'` → red-orange (`#ef4444`) with glow
  - `'partial'` → amber (`#f59e0b`) with glow
  - All other entity types in VP SC lens → default color (unchanged).
- When `personaLens` is not `vp_supply_chain`, all nodes use their existing default type-based color.
- **D3 simulation stability — cosmetic vs structural update split (engineer feedback point 4):** Updating `personaLens` or `highlightedEntities` must NOT restart the D3 force simulation — doing so causes the graph to jump and re-layout on stage, which is jarring mid-demo. Two separate `useEffect` hooks are required:
  - **Structural hook** (deps: `nodes`, `links` arrays) — runs the full D3 force simulation setup and calls `simulation.alpha(1).restart()`. Only fires when entities/relationships are added or removed from the graph.
  - **Cosmetic hook** (deps: `personaLens`, `highlightedEntities`, `highlightedRelationships`) — uses `d3.selectAll('circle')` / `d3.selectAll('line')` to update `attr('fill')`, `attr('stroke')`, and `attr('stroke-width')` on already-rendered DOM elements. Never calls `simulation.alpha()` or `simulation.restart()`. This makes persona switches and path highlight updates instant DOM mutations with zero simulation disturbance.

---

### F4 — `src/components/Chat/ChatInterface.tsx` (Modify)

Three targeted changes:

**FR-14 — wire first SSE event to graph highlight:**
The `/stream` endpoint already yields a `context_info` event first (before any `delta` chunks) — confirmed in `routes/chat.py:66-75`. On receiving this event, call `chatStore.setHighlightedPath(event.context.entities, event.context.relationships)`. This is the only change needed; the D3 canvas already listens to those store fields (F3).

**FR-7 — reasoning fallback:**
After streaming completes, check whether the accumulated response contains a `<reasoning>` tag. If not, render the explainability drawer in a collapsed state with the notice "Direct EKG response generated." rather than empty/broken markup. Existing `showExplainability` toggle still works — the drawer simply shows the fallback copy instead of reasoning text when the tag is absent.

**FR-8 (Could) — failover toast:**
If the final SSE `done` event carries `failoverTriggered: true`, render a transient toast (3s auto-dismiss) with `failoverNotice` text (e.g. "OpenAI timed out — switched to Gemini."). A simple positioned `<div>` with a CSS fade-out animation is sufficient; no toast library needed.

---

### F5 — `src/components/Controls/PersonaSelector.tsx` (New)

A three-button segmented toggle: **CEO** / **VP Supply Chain** / **CDO**.
- Reads `chatStore.personaLens`; calls `chatStore.setPersonaLens()` on click.
- On switch: also calls `chatStore.clearHighlightedPath()` (highlight from a prior question under a different lens should not persist).
- Styled to match the existing `GraphToolbar` toggle buttons.

---

### F6 — `src/components/Controls/ProviderSelector.tsx` (New, Should)

A two-button segmented toggle: **OpenAI** / **Gemini**.
- Reads `chatStore.provider`; calls `chatStore.setProvider()` on click.
- Disabled-state styling when the backend reports a provider as unavailable (use an availability check from the first SSE event or a static `/api/health` response extended to include provider availability flags — simpler: just show both buttons active and let the backend degrade gracefully).
- If FR-6 is cut, this component is simply not mounted — no other component depends on it.

---

### F7 — `src/api/chatApi.ts` (Modify)

Extend the request body sent to `/api/chat/stream` (and `/api/chat/message`) to include `provider` and `personaLens` from store state. The calling component (`ChatInterface.tsx`) reads both from `chatStore` and passes them here. No other change to the API client.

---

### F8 — `src/components/Layout/AppLayout.tsx` (Modify)

Mount `PersonaSelector` and `ProviderSelector` (if FR-6 ships) in the toolbar/header area alongside the existing grounding-mode toggle. Exact placement TBD at Stage 1 Blueprint — the only constraint is that they must be reachable without scrolling when the app is projected to a conference screen (typically 1920×1080 or 16:9 aspect).

---

## New Dependencies

**None.** Confirmed per SA Option 1:
- Backend: `openai` SDK already in `requirements.txt`; Gemini uses the same SDK via its OpenAI-compat endpoint. No `google-generativeai` or any other package added.
- Frontend: existing D3, Zustand, and CSS are sufficient for highlight/glow/toast. No new npm package.

---

## Open Items / Decisions Deferred to Stage 1

1. **`/api/health` provider availability flags** — the pre-show warmup curl (`NFR-10`) currently just checks `{"status": "healthy"}`. Stage 1 should decide whether to extend this to include `{"openai_available": true, "gemini_available": false}` for the UI to use in F6's disabled-state logic, or whether F6 stays always-enabled and degrades to the backend fallback silently.

2. **KPI value-editing UI (FR-10, Should)** — not listed as a component above because the UI surface (which entity property field to expose, which panel it lives in) is a Stage 1 Blueprint decision. The underlying schema (KPIs as EKG entities) is already accounted for in B5/B6; only the frontend CRUD form is deferred.

3. **`/stream` final `done` event shape** — currently `routes/chat.py` yields the literal string `data: [DONE]\n\n`. If FR-8 ships, this needs to become a structured JSON event (`{"done": true, "failoverTriggered": bool, "failoverNotice": str}`) so the frontend can parse it. Stage 1 should define this contract and update `src/api/chatApi.ts`'s stream parser accordingly.

4. **Seed endpoint for pre-show reset** — the presenter may want a one-click "reset to MDS D2C seed" button in the UI (in case a demo session mutates KPI values and the next session starts from a dirty state). Whether this lives as a UI button calling `/api/graph/seed/mds-d2c`, or just a presenter-known curl, is a Stage 1 usability call.

---

*Pending your review and sign-off before moving to Phased Roadmap (the final Stage 0 sub-stage) or Stage 1 Blueprint.*
