# Stage 2 — Antigravity Instruction Set: MDS D2C Launch Advisor

**Who this is for:** Antigravity CLI (Engineer). Claude (Architect) authored this; do not modify it without flagging a conflict first.

**Primary reference:** `docs/blueprints/mds-d2c-launch-advisor.md` (Stage 1 Blueprint). This document tells you *how* to implement; the Blueprint tells you *what* to implement and *why*. Read the Blueprint in full before starting. Where this document and the Blueprint conflict, stop and flag — do not resolve silently.

**Conference deadline:** Big Data London, mid-September 2026. Phase 1 (Must FRs) target: 2026-08-22.

---

## Stop Conditions

Stop and flag to Claude before continuing if you encounter any of the following:

1. A function, class, or file referenced in this document does not exist at the path specified.
2. An existing pattern in the codebase contradicts an instruction here.
3. Implementing an instruction would require installing a new package.
4. Any credential, URL, or request/response body appears in a log line or exception message.
5. You are uncertain whether a change is additive or breaking to existing behaviour.

---

## Mandatory Security Section

**This feature touches `OPENAI_API_KEY`, `GEMINI_API_KEY`, network calls to two external LLM APIs, and file I/O for seed loading. Every rule below is non-negotiable.**

### S1 — Credential handling
- Both `OPENAI_API_KEY` and `GEMINI_API_KEY` must be read from `os.getenv(...)` only.
- Never hardcode either key anywhere — not in a default parameter, not in a comment, not in a test fixture.
- The placeholder check (`!= 'your_openai_api_key_here'`) pattern already used in `llm_service.py` must be applied to `GEMINI_API_KEY` as well using a corresponding placeholder string `'your_gemini_api_key_here'`.
- Never pass either key as a query parameter, request header logged at INFO or below, or in any response body.

### S2 — Exception handler redaction
The `openai` SDK raises exceptions whose `str(e)` representation can include: the full request URL (which contains no key for OpenAI, but Gemini's compat endpoint embeds the key as a query param in some SDK versions), response body excerpts, and internal auth headers.

- Replace every `print(f"LLM Error: {e}")` and `print(f"LLM Streaming Error: {e}")` in `llm_service.py` with:
  ```python
  print("LLM provider error — details suppressed for security")
  ```
- The SSE error handler in `routes/chat.py` currently emits `str(e)` to the browser:
  ```python
  # CURRENT — must change:
  error_data = json.dumps({"error": str(e), "done": True})
  # REPLACE WITH:
  error_data = json.dumps({"error": "Stream error — please retry.", "done": True})
  ```
- No other exception handler in any file you touch may use `str(e)`, `repr(e)`, `traceback.format_exc()`, or any variant that exposes exception internals in a log line or response.

### S3 — Network library log suppression
The `openai` SDK uses `httpx` internally. `httpx` logs full request URLs at `INFO` level by default, which would expose the Gemini compat URL (and potentially embedded credentials) in stdout.

Add the following **at module level in `llm_service.py`**, before the class definition:
```python
import logging
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logging.getLogger("openai").setLevel(logging.WARNING)
```

This must be present before any `OpenAI(...)` client is instantiated.

### S4 — Runtime artifact directories
`data/`, `logs/`, `output/`, `cache/`, `*.db`, `*.log` are already in `.gitignore` (committed 2026-07-31). Do not add any new output directory without also adding it to `.gitignore`. The seed file `backend/data/seed_mds_d2c.json` is source data (not a runtime artifact) and IS committed — this is correct.

### S5 — No new packages
Do not install any new Python package or npm package. The `openai` SDK (already in `requirements.txt`) drives both OpenAI and Gemini. If you find yourself reaching for `google-generativeai`, `httpx` (standalone), `langchain`, or any other package — stop and flag.

---

## Coding Standards

### Python
- Match the style of the file you are editing. Do not reformat lines you are not changing.
- Type hints on all new function signatures — match the pattern in the file (e.g. `Optional[str]` not `str | None` — the codebase uses `Optional` from `typing`).
- No docstrings on new private methods (`_get_client`, `extract_reasoning`). One-line docstrings only on public methods, matching the existing `"""Get all entities"""` brevity.
- No `f"..."` strings in any `print()` that could embed an exception or a variable whose value comes from an external API response.
- Imports: add new stdlib imports at the top of the existing stdlib block; new third-party imports alongside existing ones. Do not reorder existing imports.

### TypeScript / React
- Functional components only — no class components.
- New components follow the existing pattern: named export, `React.FC` type, `.tsx` file alongside a `.css` file of the same name.
- Store access: read from `chatStore` via the hook `useChatStore(state => state.field)` for individual fields — do not destructure the whole store in a single call (matches existing pattern in `GraphCanvas.tsx`).
- No `any` casts unless you are binding to D3 datum types where the existing code already uses `as any` (e.g. `(d as any).id` — match existing usage exactly).
- CSS: add new rules to the existing `.css` file for that component. Do not create a global stylesheet entry for component-specific styles.

---

## Implementation Order

Implement in batch order. Do not start a batch until the prior batch compiles without errors.

### Batch 1 — Foundation (no interdependencies, implement in parallel or any order)
- **B5** `backend/data/seed_mds_d2c.json` — author the seed data
- **B3** `backend/models/chat.py` — add two request fields, two response fields
- **F1a** `src/types/graph.ts` — extend `EntityType` union
- **F1b** `src/constants/categories.ts` — add 7 MDS entity type configs

### Batch 2 — Backend services (after Batch 1)
- **B6** `backend/services/seed_mds_d2c.py` — seeder module (needs B5)
- **B7** `backend/main.py` — seed endpoint + health extension (needs B6, B3)
- **B1** `backend/services/context_service.py` — multi-hop, keywords, persona ordering (needs B3)
- **B2** `backend/services/llm_service.py` — dual provider, reasoning extractor, security fixes (needs B3)

### Batch 3 — Backend route + frontend foundation (after Batch 2)
- **B4** `backend/routes/chat.py` — thread params, patch SSE (needs B1, B2, B3)
- **F1** `src/types/chat.ts` — new types (needs F1a)
- **F2** `src/store/chatStore.ts` — new state (needs F1)
- **F7** `src/api/chatApi.ts` — extend request body + SSE parser (needs F1)

### Batch 4 — Frontend UI (after Batch 3)
- **F3** `src/components/Graph/GraphCanvas.tsx` + `GraphCanvas.css` (needs F1a/b, F2)
- **F4** `src/components/Chat/ChatInterface.tsx` (needs F2, F7, B4 running)
- **F5** `src/components/Controls/PersonaSelector.tsx` + `.css` (needs F1, F2)
- **F8** `src/components/Layout/AppLayout.tsx` (needs F5)

---

## Per-Component Instructions

### B5 — `backend/data/seed_mds_d2c.json`

**What to build:** A JSON file with `"entities"` and `"relationships"` top-level keys, matching the structure of `backend/data/seed_big_data_demo.json` exactly.

**Entity rules:**
- All entity IDs prefixed `mds-`. Relationship IDs prefixed `mds-rel-`.
- Use fixed IDs (not UUIDs) — relationships reference entity IDs by value; random IDs break the graph on every seed.
- All entity-specific attributes go in `"metadata"` — there is NO `"properties"` field on entities in this codebase. `Entity` in `models/graph.py` has `metadata: Dict[str, Any]`; that is the data bag.
- Do not add a `"properties"` key to any entity object.

**Mandatory `metadata` fields per type — see Blueprint §2.2.** Key requirements:
- Every `supply_chain_node` entity MUST have `"d2c_status"` in `metadata` with value `"ready"`, `"blocker"`, or `"partial"`. No supply chain node may be missing this field — FR-12 node coloring reads it.
- Every `kpi` entity MUST have `"value"` (number), `"unit"` (string), and `"lens"` in `metadata`.
- `kpi` entities for EAV year projections MUST also have `"year"` (integer) in `metadata`.

**Required entity counts (minimum):** 4+ `product_category`, 4+ `region`, 5+ `supply_chain_node` (at least 2 `ready`, 2 `blocker`, 1 `partial`), 3 `marketing_channel`, 6+ `kpi`, 2+ `legal_entity`, 3+ `finance_entity`. Total: 35–45 entities.

**Required relationships for hero question multi-hop path (minimum):**
- At least one `phases_in_year` relationship from each `product_category` to an EAV-year `kpi` entity.
- At least one `depends_on` relationship from each `product_category` to a relevant `supply_chain_node`.
- At least one `measures` relationship from each `kpi` to a `product_category` or `region`.
- At least one `governs` relationship from each `legal_entity` to a `marketing_channel`.
- `fulfils_region` and `serves_category` on every `supply_chain_node`.

**Verify before committing:** Load the seed via the `/api/graph/seed/mds-d2c` endpoint locally and confirm: entity count ≥ 35, every `supply_chain_node` has `d2c_status` in its metadata, every `kpi` has `value` + `unit` + `lens`.

---

### B3 — `backend/models/chat.py`

**Exact changes — add these fields only, touch nothing else:**

To `ChatRequest`, add after `focusEntityId`:
```python
provider: str = 'openai'
personaLens: str = 'ceo'
```

To `ChatResponse`, add after `tokensUsed`:
```python
failoverTriggered: Optional[bool] = None
failoverNotice: Optional[str] = None
```

**Do not** change any existing field, validator, or model config. Do not add `Literal` types — plain `str` with defaults matches the existing `groundingMode: str` pattern.

---

### B6 — `backend/services/seed_mds_d2c.py`

Implement exactly as specified in Blueprint §4 B6. Key rules:
- Instantiate `Entity` and `Relationship` directly from the seed dict, preserving the seed file's `id` values.
- Use `graph_service.entities.clear()` and `graph_service.relationships.clear()` before loading — do not call `delete_entity()` in a loop (triggers `_persist()` on every call, O(n) writes).
- Call `graph_service._persist()` once after loading is complete.
- Return `(entity_count, relationship_count)` as a tuple.
- No print statements, no logging.

---

### B7 — `backend/main.py`

**Two changes only:**

1. Add seed endpoint. Import `seed_mds_d2c_graph` from `backend.services.seed_mds_d2c`. Register endpoint after the existing `/api/graph/seed/customer` endpoint — preserve the ordering pattern. Endpoint spec: Blueprint §2.3.

2. Extend `/api/health` and `/health` handlers. Add `import os` if not already present at the top. Read both env vars inside the handler (not at module level — avoids caching the value before `.env` is loaded). Return the extended response shape from Blueprint §2.3.

**Do not** modify any other route, middleware, or startup hook.

---

### B1 — `backend/services/context_service.py`

**Four targeted changes:**

**1. `CATEGORY_LABELS` additions** (append to the existing dict — do not replace):
```python
'product_category':   'Product Category',
'region':             'UK Region',
'supply_chain_node':  'Supply Chain Node',
'marketing_channel':  'Marketing Channel',
'kpi':                'KPI',
'legal_entity':       'Legal Entity',
'finance_entity':     'Finance',
```

**2. `interpret_query()` — keyword dict extensions.** Append new entries to the existing `type_keywords` and `rel_keywords` dicts. Do not remove or rename any existing entry. Full new entries: Blueprint §4 B1.

**3. `expand_context()` — add `depth` parameter:**
```python
def expand_context(self, seed_entities: List[Entity], depth: int = 1) -> Dict[str, Any]:
```
Change the inner `get_neighbors(entity.id, depth=1)` call to `get_neighbors(entity.id, depth=depth)`. Nothing else changes in this method.

**4. `package_context()` — add `persona_lens` parameter and ordering logic:**
```python
def package_context(
    self,
    subgraph: Dict[str, Any],
    grounding_mode: str,
    focus_entity_id: Optional[str] = None,
    persona_lens: str = 'ceo',
) -> str:
```
Immediately after `entities = subgraph.get('entities', [])`, add persona-lens sort:
```python
if persona_lens == 'ceo':
    entities = sorted(entities, key=lambda e: 0 if e.type in ('kpi', 'finance_entity') else 1)
elif persona_lens == 'vp_supply_chain':
    entities = sorted(entities, key=lambda e: 0 if e.type == 'supply_chain_node' else 1)
# 'cdo': no reordering
```
For `vp_supply_chain`, also patch the description line for supply chain nodes inside the entity rendering loop:
```python
desc = entity.description or "No description"
if persona_lens == 'vp_supply_chain' and entity.type == 'supply_chain_node':
    status = (entity.metadata or {}).get('d2c_status', 'unknown')
    desc = f"{desc} [D2C Status: {status}]"
```

**5. `assemble_context()` — add `persona_lens` parameter, pass through:**
```python
def assemble_context(
    self,
    query: str,
    grounding_mode: str,
    focus_entity_id: Optional[str] = None,
    persona_lens: str = 'ceo',
) -> Dict[str, Any]:
```
Pass `depth=3 if grounding_mode != 'generic' else 1` to `expand_context()`.
Pass `persona_lens=persona_lens` to `package_context()`.
Add `'persona_lens': persona_lens` to the returned dict.

---

### B2 — `backend/services/llm_service.py`

**This file touches credentials and network calls. Apply the full Security section (S1–S3) before any other change.**

**Step 1 — apply S3 first:** Add the three logging suppression lines at module level, immediately after the existing imports and before the class definition. Verify they appear before any `OpenAI(...)` instantiation.

**Step 2 — add module-level constants** (after imports, before class):
```python
OPENAI_MODEL = "gpt-4o-mini"
GEMINI_MODEL = "gemini-2.0-flash"
GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"
```

**Step 3 — refactor `__init__`:** Replace the single `self.client` / `self.available` pattern with dual clients as specified in Blueprint §4 B2. Preserve `self.available = self.openai_available or self.gemini_available` for backward compatibility with any caller that checks it.

**Step 4 — add `_get_client()`:** Exact implementation in Blueprint §4 B2.

**Step 5 — add `extract_reasoning()`:**
```python
def extract_reasoning(self, raw: str) -> tuple:
    import re
    match = re.search(r'<reasoning>(.*?)</reasoning>', raw, re.DOTALL)
    if match:
        return match.group(1).strip(), raw[match.end():].strip()
    return '', raw
```
Return type is `tuple[str, str]` — `(reasoning_text, answer_text)`. Empty `reasoning_text` is the FR-7 collapsed-drawer signal. Do not raise on missing tag.

**Step 6 — update `build_prompt()`:** Add `persona_lens: str = 'ceo'` parameter. Append persona instruction to system message as specified in Blueprint §4 B2. Existing system message structure is unchanged — the persona instruction is appended between the context block and the `CRITICAL INSTRUCTIONS` block.

**Step 7 — update `generate_response()` and `stream_response()`:** Add `provider: str = 'openai'` and `persona_lens: str = 'ceo'` parameters. Replace `self.client` references with `_get_client(provider)` result. Apply `extract_reasoning()` to the full response content in `generate_response()` — set `'reasoning'` key in return dict. For `stream_response()`, reasoning extraction happens client-side (see F7).

**Step 8 — apply S2:** Replace both `print(f"LLM Error: {e}")` lines. Verify no other `str(e)` or `repr(e)` exists anywhere in the file.

**Do not** add FR-8 failover in Phase 1. The try/except already present degrades to `generate_fallback_response()` — leave that intact.

**Do not** change `generate_fallback_response()` — it has no LLM calls and is security-safe.

---

### B4 — `backend/routes/chat.py`

**Four targeted changes:**

**1. Thread new params** in both `/message` and `/stream` handlers — see Blueprint §4 B4.

**2. Add `persona_lens` to first SSE `context_info` event** — see Blueprint §4 B4.

**3. Replace literal `[DONE]`** with structured done event:
```python
# Remove: yield f"data: [DONE]\n\n"
# Add:
done_payload = json.dumps({"done": True, "failoverTriggered": False, "failoverNotice": None})
yield f"data: {done_payload}\n\n"
```
Note: `failoverTriggered` is hardcoded `False` in Phase 1 (FR-8 not yet implemented). Phase 2 will wire the actual value from the LLM response dict.

**4. Patch SSE error handler** — apply S2. Replace `str(e)` with generic string.

**For `/message` handler:** After receiving `llm_response`, call `extract_reasoning()` to split content and populate `message.reasoning`:
```python
reasoning, answer = llm_service.extract_reasoning(llm_response['content'])
message = Message(
    ...,
    content=answer,
    reasoning=reasoning or None,
    ...
)
```

---

### F1a — `src/types/graph.ts`

Locate the `EntityType` type definition. Add the 7 new MDS values to the union — do not remove any existing value. Exact additions: Blueprint §5 F1a.

---

### F1b — `src/constants/categories.ts`

Append 7 new entries to the `DEMO_CATEGORIES` array — do not remove or reorder existing entries. Exact entries: Blueprint §5 F1b.

`isDemoEntityType()` requires **no change** — it derives from `DEMO_CATEGORIES` map automatically.
`DEMO_RELATIONSHIP_TYPES` const: add the 8 new MDS relationship type strings to the array (`'measures'`, `'fulfils_region'`, `'serves_category'`, `'competes_with'`, `'governs'`, `'funds'`, `'phases_in_year'`, `'depends_on'` — `'depends_on'` already exists, do not duplicate).

---

### F1 — `src/types/chat.ts`

Add new types and extend interfaces as specified in Blueprint §2.5. Do not change `GroundingMode` — the three existing values are still correct and unchanged.

---

### F2 — `src/store/chatStore.ts`

Add 4 new state fields and 4 new actions as specified in Blueprint §5 F2.

`clearMessages` action already exists — update it to also call the clear-highlight logic:
```typescript
clearMessages: () => set({
    messages: [],
    highlightedEntities: [],
    highlightedRelationships: [],
}),
```
Do not create a separate `clearHighlightedPath` action call inside `clearMessages` — inline the reset to avoid an extra set() call.

---

### F7 — `src/api/chatApi.ts`

**Two changes:**

**1. Extend `streamMessage` request body.** The function already takes `request: ChatRequest` and passes it to `JSON.stringify(request)`. The new `provider` and `personaLens` fields are added to `ChatRequest` in F1 — no body change is needed here, they're included automatically. The only change needed is adding two new callback parameters:

```typescript
async streamMessage(
    request: ChatRequest,
    onChunk: (chunk: string) => void,
    onContextInfo: (entities: string[], relationships: string[], personaLens: string) => void,  // NEW
    onComplete: (message: Message, reasoning: string) => void,  // EXTENDED — add reasoning
    onError: (error: Error) => void,
    onStreamReset?: (notice: string) => void,  // NEW optional — FR-8 prep
): Promise<void>
```

**2. Extend the SSE parser** inside `streamMessage`. Current parser only handles `parsed.context` and `parsed.delta`. Extend to handle all four event shapes:

```typescript
const parsed = JSON.parse(data);

// Event 1: context_info
if (parsed.context) {
    usedContext = parsed.context;
    citations = parsed.context.citations;
    onContextInfo(
        parsed.context.entities ?? [],
        parsed.context.relationships ?? [],
        parsed.context.persona_lens ?? 'ceo',
    );
}

// Events 2…N: delta chunks
if (parsed.delta) {
    fullMessage += parsed.delta;
    onChunk(parsed.delta);
}

// FR-8 stream reset (Phase 2 — handle defensively now)
if (parsed.type === 'stream_reset') {
    fullMessage = '';
    onStreamReset?.(parsed.failoverNotice ?? '');
}

// Final done event (replaces old [DONE] literal check)
if (parsed.done === true) {
    break;
}
```

**Reasoning extraction** — after the `while(true)` loop ends (stream complete), extract reasoning client-side before calling `onComplete`:
```typescript
const reasoningMatch = fullMessage.match(/<reasoning>([\s\S]*?)<\/reasoning>/);
const reasoning = reasoningMatch ? reasoningMatch[1].trim() : '';
const answerContent = reasoningMatch
    ? fullMessage.slice(fullMessage.indexOf('</reasoning>') + '</reasoning>'.length).trim()
    : fullMessage;

const message: Message = {
    id: crypto.randomUUID(),
    role: 'assistant',
    content: answerContent,
    timestamp: new Date().toISOString(),
    usedContext,
    citations,
    reasoning: reasoning || undefined,
};
onComplete(message, reasoning);
```

**Update `sendMessage`** to also pass `provider` and `personaLens` — they are part of `ChatRequest` so already serialised. No signature change needed for `sendMessage`.

**Do not** change `getBaseUrl()`, the `axios` instance setup, or the `getContext` function.

---

### F3 — `src/components/Graph/GraphCanvas.tsx` + `GraphCanvas.css`

**Read the entire existing file before touching it.** The existing `useEffect` (lines 100–377 in the current file) is the structural effect — it runs on `[dimensions, filteredEntities, filteredRelationships, focusEntityId, selectEntity, selectedEntityId, setFocusEntity]`. Keep that dep array unchanged.

**Change 1 — add `getNodeFillColor` helper** (module-level, above the component):
```typescript
function getNodeFillColor(node: GraphNode, personaLens: string): string {
    if (personaLens === 'vp_supply_chain' && node.type === 'supply_chain_node') {
        const status = (node.metadata as any)?.d2c_status;
        if (status === 'ready')   return '#22c55e';
        if (status === 'blocker') return '#ef4444';
        if (status === 'partial') return '#f59e0b';
    }
    return getCategoryConfig(node.type)?.color ?? 'var(--graph-node-default)';
}
```

**Change 2 — read new store values** at the top of the component (after existing store reads):
```typescript
const personaLens = useChatStore(state => state.personaLens);
const highlightedEntities = useChatStore(state => state.highlightedEntities);
const highlightedRelationships = useChatStore(state => state.highlightedRelationships);
```

**Change 3 — patch structural effect.** Inside `node.each(function(d) {...})`, replace:
```typescript
const fillColor = category?.color ?? 'var(--graph-node-default)';
```
With:
```typescript
const fillColor = getNodeFillColor(d, personaLens);
```
This is the only change inside the structural effect. Do not add `personaLens`, `highlightedEntities`, or `highlightedRelationships` to the structural effect's dependency array.

**Change 4 — add cosmetic `useEffect`** (new, after the structural effect):

```typescript
useEffect(() => {
    if (!svgRef.current) return;

    // Node fill colours (persona lens)
    d3.select(svgRef.current)
        .selectAll<SVGGElement, GraphNode>('.graph-node')
        .each(function(d) {
            const fill = getNodeFillColor(d, personaLens);
            d3.select(this).select('circle').attr('fill', fill);

            // VP SC glow classes
            const el = d3.select(this);
            el.classed('node-sc-ready',   personaLens === 'vp_supply_chain' && (d.metadata as any)?.d2c_status === 'ready');
            el.classed('node-sc-blocker', personaLens === 'vp_supply_chain' && (d.metadata as any)?.d2c_status === 'blocker');
            el.classed('node-sc-partial', personaLens === 'vp_supply_chain' && (d.metadata as any)?.d2c_status === 'partial');
        });

    // Highlight path (CDO lens + general)
    const entityHighlightSet = new Set(highlightedEntities);
    const relHighlightSet = new Set(highlightedRelationships);
    const hasHighlight = entityHighlightSet.size > 0;

    d3.select(svgRef.current)
        .selectAll<SVGGElement, GraphNode>('.graph-node')
        .attr('opacity', d => hasHighlight ? (entityHighlightSet.has(d.id) ? 1 : 0.25) : 1)
        .each(function(d) {
            d3.select(this).select('circle')
                .attr('stroke-width', entityHighlightSet.has(d.id) ? 4 : undefined);
        });

    d3.select(svgRef.current)
        .selectAll<SVGLineElement, DisplayGraphLink>('.graph-link')
        .attr('stroke-opacity', (d: any) =>
            hasHighlight ? (relHighlightSet.has(d.id) ? 1 : 0.1) : 0.5
        )
        .attr('stroke-width', (d: any) =>
            relHighlightSet.has(d.id) ? 3 : 1.5
        );

}, [personaLens, highlightedEntities, highlightedRelationships]);
```

**Critical rule:** The cosmetic `useEffect` must NEVER call `simulation.alpha()`, `simulation.restart()`, `svg.selectAll('*').remove()`, or any D3 method that creates or destroys DOM elements. It is attribute mutations only.

**GraphCanvas.css additions:**
```css
/* VP Supply Chain node glow */
.node-sc-ready   circle { filter: drop-shadow(0 0 6px #22c55e); }
.node-sc-blocker circle { filter: drop-shadow(0 0 8px #ef4444); }
.node-sc-partial circle { filter: drop-shadow(0 0 5px #f59e0b); }
```

---

### F4 — `src/components/Chat/ChatInterface.tsx`

Read the full file before editing. Key changes:

**1 — Update `streamMessage` call** to match the new signature (F7). Pass the two new callbacks:

- `onContextInfo`: call `chatStore.setHighlightedPath(entities, relationships)`. Call `chatStore.clearHighlightedPath()` before initiating the stream (at the start of the send handler, not inside the callback).
- `onComplete`: now receives `(message, reasoning)`. Store `message` as before. If `reasoning` is an empty string, set a local state flag `reasoningUnavailable = true` for FR-7 drawer rendering.

**2 — FR-7 reasoning drawer fallback.** Wherever the explainability/reasoning panel renders, check `message.reasoning`. If `undefined` or empty string, render a collapsed state with the copy:
```
Direct EKG response generated — reasoning trace unavailable for this response.
```
Do not attempt to render the reasoning panel content when this copy is shown.

**3 — FR-8 failover toast (Phase 2 prep — add the state wiring now, render conditionally):**
```typescript
const [failoverNotice, setFailoverNotice] = useState<string | null>(null);
```
Pass `onStreamReset?: (notice) => { setFailoverNotice(notice); setTimeout(() => setFailoverNotice(null), 3000); }` to `streamMessage`. Render:
```tsx
{failoverNotice && (
    <div className="failover-toast">{failoverNotice}</div>
)}
```
The CSS class `.failover-toast` should be a fixed-position toast (top-right, `z-index: 9999`, `background: var(--color-accent-600)`, auto-fade via the 3-second timeout clearing state). This wiring has no functional effect in Phase 1 since `stream_reset` events are never emitted — but it makes Phase 2 a frontend-only addition.

---

### F5 — `src/components/Controls/PersonaSelector.tsx`

Three-segment button toggle. Model the pattern on the existing grounding-mode toggle if one exists in `GraphToolbar.tsx` or `ChatInterface.tsx`.

```tsx
const PERSONA_OPTIONS: { value: PersonaLens; label: string }[] = [
    { value: 'ceo',              label: 'CEO' },
    { value: 'vp_supply_chain',  label: 'VP Supply Chain' },
    { value: 'cdo',              label: 'CDO' },
];
```

On click: call `setPersonaLens(value)` and `clearHighlightedPath()`. Do not call `clearMessages()` — switching persona does not clear the conversation.

CSS: text labels only (no icons). Minimum button width sufficient for "VP Supply Chain" to render without truncation on a 1920px projected display. Active state should be visually distinct (filled background vs outline).

---

### F8 — `src/components/Layout/AppLayout.tsx`

Import and mount `PersonaSelector` in the header/toolbar. It must be visible without scrolling at 1080p. Do not mount `ProviderSelector` — F6 is Phase 2. Do not restructure any existing layout element — insert `PersonaSelector` alongside existing controls only.

---

## Phase 1 Exit Checklist

Complete these checks before handing off for Stage 3 review. Do not mark Phase 1 done if any item fails.

### Functional
- [ ] `POST /api/graph/seed/mds-d2c` returns `{"status":"ok","entities":N,"relationships":M}` with N ≥ 35
- [ ] Hero question in `kg_full` mode returns answer citing entities from ≥ 3 different domain types
- [ ] Same hero question in `generic` mode returns a generic answer with no entity citations
- [ ] Switching to VP Supply Chain persona: supply chain nodes recolour (green/red/orange) without graph re-layout or simulation restart
- [ ] Switching to CDO persona after asking a question: traversed nodes/edges are highlighted; non-traversed nodes dim to opacity 0.25
- [ ] Switching persona when no question has been asked: no highlight visible, no error
- [ ] CEO persona: KPI entities appear first in grounded answer
- [ ] `<reasoning>` tag present in grounded OpenAI response → reasoning panel populates
- [ ] `<reasoning>` tag absent (simulate by testing fallback path) → drawer shows "Direct EKG response generated..." copy, no broken markup
- [ ] `/api/health` returns `{"status":"healthy","providers":{"openai":true/false,"gemini":true/false}}`
- [ ] "Reset Demo" button in toolbar calls seed endpoint and reloads graph

### Security (Stage 3.5 gate — must all pass)
- [ ] Start the backend with `OPENAI_API_KEY` set. Make a grounded request. Check stdout — no URL containing `generativelanguage`, no key substring, no request body visible.
- [ ] Trigger a provider error (set `OPENAI_API_KEY` to a bad value). Check stdout — only `"LLM provider error — details suppressed for security"` appears; no exception traceback, no URL.
- [ ] Check browser console / network tab — SSE error event body is `"Stream error — please retry."` only; no exception detail.
- [ ] `grep -r "OPENAI_API_KEY\|GEMINI_API_KEY" backend/` — keys appear only in `os.getenv(...)` calls; zero hardcoded values.
- [ ] `grep -r "str(e)\|repr(e)\|format_exc" backend/` — zero results in any file you modified.
- [ ] `grep -r "httpx\|httpcore\|openai" backend/services/llm_service.py` — logging suppression lines are present.

### No-regression
- [ ] Existing `seed_big_data_demo` and `seed_customer_support` seeds still load correctly.
- [ ] Graph canvas renders existing seed data without change to layout or node colours when persona is `ceo` (default).
- [ ] `/api/chat/message` (non-streaming) still returns a valid response with `reasoning` populated (or `null` for generic mode).

---

## What NOT to Build in Phase 1

- **FR-8 failover** (Could) — do not implement `asyncio.wait_for` or `stream_reset` emit in backend. The state wiring in `ChatInterface.tsx` is the only FR-8 work in Phase 1.
- **FR-6 / F6 ProviderSelector** (Should) — do not create `ProviderSelector.tsx`. Gemini client is instantiated in `__init__` if the key is present, but the UI selector waits for Phase 2.
- **FR-10 KPI inline edit** (Should) — do not build the `contentEditable` UI. Pre-seeded KPI values are the Phase 1 fallback.
- **Multi-user / session isolation** — single presenter, no session state beyond what exists today.
- **Any new npm or pip package.**
