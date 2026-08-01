# Stage 1 — Blueprint: MDS D2C Launch Advisor

**Status:** Draft for review. Builds on confirmed Stage 0 artifacts (`docs/concepts/mds-d2c-launch-advisor/`). This is the implementation reference — Antigravity works from this document and the Stage 2 Instruction Set only. Do not implement before Stage 2 is confirmed.

---

## 1. Folder Layout

### New files

```
backend/
  data/
    seed_mds_d2c.json                         # B5 — EKG seed data (~35-45 entities)
  services/
    seed_mds_d2c.py                           # B6 — seeder module

src/
  components/
    Controls/
      PersonaSelector.tsx                     # F5
      PersonaSelector.css                     # F5
      ProviderSelector.tsx                    # F6 (Should — may be cut)
      ProviderSelector.css                    # F6 (Should — may be cut)
```

### Modified files

```
backend/
  models/
    chat.py                                   # B3 — add provider, personaLens, failover fields
  routes/
    chat.py                                   # B4 — thread new params; patch SSE error handler
  services/
    context_service.py                        # B1 — multi-hop depth, MDS keywords, persona ordering
    llm_service.py                            # B2 — dual provider, reasoning extractor, safe logging
  main.py                                     # B7 — register seed endpoint + health provider flags

src/
  types/
    chat.ts                                   # F1 — PersonaLens, LLMProvider, extended request/response
    graph.ts                                  # F1a — add new MDS EntityType values
  constants/
    categories.ts                             # F1b — add MDS entity type configs + isDemoEntityType
  store/
    chatStore.ts                              # F2 — persona, provider, highlight path state
  components/
    Graph/
      GraphCanvas.tsx                         # F3 — split structural/cosmetic effects; VP SC colors; path highlight
      GraphCanvas.css                         # F3 — glow CSS classes
    Chat/
      ChatInterface.tsx                       # F4 — first-SSE handler; FR-7 fallback; FR-8 toast
    Layout/
      AppLayout.tsx                           # F8 — mount PersonaSelector (+ ProviderSelector if FR-6 ships)
  api/
    chatApi.ts                                # F7 — include provider + personaLens in request body
```

---

## 2. Schema & Contracts

### 2.1 Critical clarification — Entity `metadata` vs `properties`

**`Entity` in `models/graph.py` has a `metadata: Dict[str, Any]` field but NO `properties` field.** Relationships have `properties`; entities do not. All entity domain-specific attributes (KPI values, supply-chain readiness status, etc.) must be stored in `metadata`. Stage 0 Technical Components used `properties` loosely — the canonical field name is `metadata` throughout the implementation.

`EntityUpdate` already accepts `metadata: Optional[Dict[str, Any]]`, so `PUT /api/graph/entities/{id}` with `{"metadata": {"value": 5000000}}` is how FR-10 KPI value editing works — no new endpoint or model change needed.

### 2.2 EKG entity schema (`seed_mds_d2c.json`)

Top-level structure matches existing seed files exactly:
```json
{
  "entities": { "<id>": { ...entity }, ... },
  "relationships": { "<id>": { ...relationship }, ... }
}
```

**Entity shape:**
```json
{
  "id": "mds-<kebab-case-slug>",
  "type": "<entity_type>",
  "name": "<Human-readable name>",
  "description": "<one-line description for context packaging>",
  "metadata": { "<type-specific fields — see below>" },
  "createdAt": "2026-08-01T00:00:00.000Z",
  "updatedAt": "2026-08-01T00:00:00.000Z"
}
```

**Type-specific `metadata` fields (all optional except where marked required):**

| `type` | Required `metadata` fields | Optional `metadata` fields |
|---|---|---|
| `supply_chain_node` | `d2c_status` (`"ready"`\|`"blocker"`\|`"partial"`) | `blocker_reason` (str), `node_type` (`"warehouse"`\|`"3pl"`\|`"fulfilment_centre"`) |
| `kpi` | `value` (number), `unit` (str), `lens` (`"ceo"`\|`"all"`) | `year` (number, for EAV-by-year KPIs) |
| `product_category` | `d2c_potential` (`"high"`\|`"medium"`\|`"low"`) | `sku_count` (number), `current_channel` (str) |
| `region` | `demand_index` (number 0–100) | `d2c_penetration_pct` (number), `uk_sub_region` (str) |
| `marketing_channel` | `conflict_risk` (`"high"`\|`"low"`\|`"none"`) | `channel_type` (str) |
| `legal_entity` | (none required) | `contract_type` (str), `exclusivity_clause` (str describing scope or `null`) |
| `finance_entity` | `value` (number), `currency` (`"GBP"`) | `metric_type` (str) |

**Relationship shape:**
```json
{
  "id": "mds-rel-<kebab-slug>",
  "sourceId": "<entity id>",
  "targetId": "<entity id>",
  "type": "<relationship_type>",
  "properties": {},
  "confidence": 1.0,
  "notes": null,
  "createdAt": "2026-08-01T00:00:00.000Z"
}
```

**Valid new relationship types for this seed:** `measures`, `fulfils_region`, `serves_category`, `competes_with`, `governs`, `funds`, `phases_in_year`, `depends_on`.

### 2.3 Backend API contracts

**`ChatRequest` (modified `models/chat.py`):**
```python
class ChatRequest(BaseModel):
    message: str
    groundingMode: str                        # 'generic' | 'kg_only' | 'kg_full'
    conversationHistory: Optional[List[Message]] = None
    focusEntityId: Optional[str] = None
    provider: str = 'openai'                  # NEW — 'openai' | 'gemini'
    personaLens: str = 'ceo'                  # NEW — 'ceo' | 'vp_supply_chain' | 'cdo'
```

**`ChatResponse` (modified `models/chat.py`):**
```python
class ChatResponse(BaseModel):
    message: Message
    usedContext: UsedContext
    tokensUsed: Optional[int] = None
    failoverTriggered: Optional[bool] = None  # NEW
    failoverNotice: Optional[str] = None      # NEW
```

**`/api/health` (modified `main.py`):**
```json
{
  "status": "healthy",
  "providers": {
    "openai": true,
    "gemini": false
  }
}
```
`providers.<name>` is `true` if the corresponding API key is set and non-placeholder. This resolves Open Item 1 from Technical Components — frontend `ProviderSelector` uses this to grey-out unavailable providers.

**`POST /api/graph/seed/mds-d2c` (new, `main.py`):**
- No request body.
- Response: `{"status": "ok", "entities": <count>, "relationships": <count>}`
- Behaviour: clears current graph, loads `seed_mds_d2c.json`, returns counts.

### 2.4 SSE event protocol

The `/api/chat/stream` endpoint yields events in this order:

**Event 1 — context metadata** (before any answer text):
```json
{
  "context": {
    "entities": ["mds-sc-lutterworth", "mds-kpi-eav-yr1", "..."],
    "relationships": ["mds-rel-001", "..."],
    "raw_context_string": "...",
    "citations": [{ "entityId": "...", "entityName": "...", "entityType": "..." }],
    "persona_lens": "ceo"
  },
  "done": false
}
```
*`persona_lens` is new — the frontend uses it to confirm the active lens when rendering the first event.*

**Events 2…N — answer text chunks:**
```json
{ "delta": "<text chunk>", "done": false }
```

**Event (conditional, FR-8 only) — stream reset:**
```json
{ "type": "stream_reset", "failoverNotice": "OpenAI timed out — switched to Gemini." }
```
Emitted if failover fires after streaming has started. Frontend must handle by clearing `currentStreamingMessage` before resuming `appendStreamChunk`.

**Final event — done:**
```json
{ "done": true, "failoverTriggered": false, "failoverNotice": null }
```
This replaces the current literal `data: [DONE]\n\n` string. Resolves Open Item 3 from Technical Components.

### 2.5 Frontend type contracts (`src/types/chat.ts`)

```typescript
export type PersonaLens = 'ceo' | 'vp_supply_chain' | 'cdo';
export type LLMProvider  = 'openai' | 'gemini';

export interface ChatRequest {
    message: string;
    groundingMode: GroundingMode;
    conversationHistory?: Message[];
    focusEntityId?: string | null;
    provider?: LLMProvider;       // default 'openai'
    personaLens?: PersonaLens;    // default 'ceo'
}

export interface ChatResponse {
    message: Message;
    usedContext: UsedContext;
    tokensUsed?: number;
    failoverTriggered?: boolean;  // FR-8
    failoverNotice?: string;      // FR-8
}
```

---

## 3. Resolved Open Items (from Technical Components)

| # | Item | Resolution |
|---|---|---|
| 1 | `/api/health` provider flags | Extended to `{"status":"healthy","providers":{"openai":bool,"gemini":bool}}` — see §2.3 |
| 2 | KPI edit UI placement | Inline edit on the KPI entity card in the CEO lens section of `ChatInterface.tsx`; PUT to existing `/api/graph/entities/{id}`. No new component — keep as a `contentEditable` span or small `<input>` on the displayed KPI value field. Only the `metadata.value` field is editable; entity name/type/description are read-only in this UI. |
| 3 | `[DONE]` event contract | Structured JSON `{"done":true,"failoverTriggered":bool,"failoverNotice":str\|null}` — see §2.4 |
| 4 | Demo seed-reset button | Single "Reset Demo" button in `GraphToolbar.tsx`, calls `POST /api/graph/seed/mds-d2c`. Styled as a destructive-action button (red/orange). No confirmation dialog needed — presenters know what it does. |

---

## 4. Backend Component Specs

### B1 — `context_service.py`

**`CATEGORY_LABELS` additions:**
```python
'product_category':   'Product Category',
'region':             'UK Region',
'supply_chain_node':  'Supply Chain Node',
'marketing_channel':  'Marketing Channel',
'kpi':                'KPI',
'legal_entity':       'Legal Entity',
'finance_entity':     'Finance',
```

**`interpret_query()` — new keyword dicts (append to existing, do not replace):**
```python
type_keywords additions:
  'kpi':               ['kpi', 'eav', 'tav', 'rv', 'revenue', 'addressable'],
  'product_category':  ['product', 'category', 'nutrition', 'beauty', 'vitamin', 'pet'],
  'region':            ['region', 'uk', 'london', 'southeast', 'midlands', 'north', 'scotland', 'wales'],
  'supply_chain_node': ['supply chain', 'fulfillment', 'fulfilment', 'warehouse', '3pl', 'last-mile'],
  'marketing_channel': ['channel', 'wholesale', 'retailer', 'd2c', 'amazon'],
  'legal_entity':      ['legal', 'contract', 'exclusivity', 'agreement'],
  'finance_entity':    ['capex', 'breakeven', 'margin', 'cost', 'cogs'],

rel_keywords additions:
  'measures':          ['measures', 'kpi for', 'tracks'],
  'fulfils_region':    ['fulfils', 'serves', 'covers'],
  'depends_on':        ['depends on', 'requires', 'needs'],
  'phases_in_year':    ['phase', 'year 1', 'year 2', 'year 3', 'roadmap'],
  'governs':           ['governs', 'contract', 'exclusivity'],
```

**`expand_context()` — new signature:**
```python
def expand_context(self, seed_entities: List[Entity], depth: int = 1) -> Dict[str, Any]:
```
Caller (`assemble_context`) passes `depth=3` when `grounding_mode != 'generic'`; `depth=1` for generic (keeps backward compatibility). Inner loop unchanged — accumulated `entity_ids` set handles deduplication across seeds.

**`package_context()` — new signature:**
```python
def package_context(
    self,
    subgraph: Dict[str, Any],
    grounding_mode: str,
    focus_entity_id: Optional[str] = None,
    persona_lens: str = 'ceo',
) -> str:
```
Persona-lens ordering applied before rendering the entity list:
- `'ceo'`: sort entities so `type == 'kpi'` and `type == 'finance_entity'` appear first.
- `'vp_supply_chain'`: sort so `type == 'supply_chain_node'` appears first; append `metadata.d2c_status` to the description line for each supply chain node: `f"{entity.description} [Status: {entity.metadata.get('d2c_status', 'unknown')}]"`.
- `'cdo'`: no reordering (CDO differentiation is frontend-only path highlighting).

**`assemble_context()` — new signature:**
```python
def assemble_context(
    self,
    query: str,
    grounding_mode: str,
    focus_entity_id: Optional[str] = None,
    persona_lens: str = 'ceo',
) -> Dict[str, Any]:
```
Pass `depth=3` to `expand_context()` when `grounding_mode != 'generic'`. Add `persona_lens` to the returned dict.

---

### B2 — `llm_service.py`

**Module-level constants:**
```python
OPENAI_MODEL = "gpt-4o-mini"
GEMINI_MODEL = "gemini-2.0-flash"
GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"
```

**`__init__` — dual client setup:**
```python
openai_key = os.getenv('OPENAI_API_KEY')
self.openai_available = bool(openai_key and openai_key != 'your_openai_api_key_here')
self.openai_client = OpenAI(api_key=openai_key) if self.openai_available else None

gemini_key = os.getenv('GEMINI_API_KEY')
self.gemini_available = bool(gemini_key and gemini_key != 'your_gemini_api_key_here')
self.gemini_client = OpenAI(api_key=gemini_key, base_url=GEMINI_BASE_URL) if self.gemini_available else None

# Keep self.available for backward compatibility with existing fallback checks
self.available = self.openai_available or self.gemini_available
```

**`_get_client(provider: str) -> tuple[OpenAI, str, str]`:**
Returns `(client, model_name, resolved_provider)`. If the requested provider is unavailable, falls back to whichever is available. If neither is available, returns `(None, None, None)`.
```python
def _get_client(self, provider: str):
    if provider == 'gemini' and self.gemini_available:
        return self.gemini_client, GEMINI_MODEL, 'gemini'
    if self.openai_available:
        return self.openai_client, OPENAI_MODEL, 'openai'
    if self.gemini_available:
        return self.gemini_client, GEMINI_MODEL, 'gemini'
    return None, None, None
```

**`extract_reasoning(raw: str) -> tuple[str, str]`:**
```python
import re
def extract_reasoning(self, raw: str) -> tuple[str, str]:
    match = re.search(r'<reasoning>(.*?)</reasoning>', raw, re.DOTALL)
    if match:
        reasoning = match.group(1).strip()
        answer = raw[match.end():].strip()
        return reasoning, answer
    return '', raw  # empty reasoning = collapsed drawer signal (FR-7)
```

**`build_prompt()` — persona lens system message suffix:**

Append to the existing system message (after the context block, before the `CRITICAL INSTRUCTIONS` block):
```
Persona framing: {persona_instruction}
```
Where `persona_instruction` by lens:
- `'ceo'`: `"You are advising a CEO. Lead with TAV, EAV-by-year, and RV business impact first, then the recommendation."`
- `'vp_supply_chain'`: `"You are advising a VP Supply Chain. Lead with readiness status and blockers. Name specific supply chain nodes and their D2C status."`
- `'cdo'`: `"You are advising a CDO. Lead with which data products feed the recommendation and how the AI reasoning was grounded in specific graph nodes."`

**Exception handler security patch (both `generate_response` and `stream_response`):**

Replace:
```python
print(f"LLM Error: {e}")
print(f"LLM Streaming Error: {e}")
```
With:
```python
print("LLM provider error — details suppressed for security")
```

**`generate_response()` and `stream_response()` — new signatures:**
```python
async def generate_response(
    self, user_message, context, conversation_history=None,
    grounding_mode='kg_full', provider='openai', persona_lens='ceo'
) -> dict:

async def stream_response(
    self, user_message, context, conversation_history=None,
    grounding_mode='kg_full', provider='openai', persona_lens='ceo'
) -> AsyncGenerator[str, None]:
```
Both call `_get_client(provider)` and `build_prompt(..., persona_lens=persona_lens)`.

**FR-8 failover (Could — implement only if Phase 1+2 complete early):**
Wrap provider call in `asyncio.wait_for(..., timeout=4.0)`. On `TimeoutError` or `openai.APIError`, retry with the other provider. Emit `stream_reset` SSE event in `stream_response()` before the retry generator starts. Set `failover_triggered=True` and `failover_notice=f"{primary} timed out — switched to {fallback}."` in return dict.

---

### B3 — `models/chat.py`

Add to `ChatRequest`:
```python
provider: str = 'openai'
personaLens: str = 'ceo'
```

Add to `ChatResponse`:
```python
failoverTriggered: Optional[bool] = None
failoverNotice: Optional[str] = None
```

No other changes.

---

### B4 — `routes/chat.py`

**Thread new params** through both `/message` and `/stream` handlers:
```python
context_data = context_service.assemble_context(
    request.message,
    request.groundingMode,
    request.focusEntityId,
    persona_lens=request.personaLens,      # NEW
)

llm_response = await llm_service.generate_response(
    ...,
    provider=request.provider,             # NEW
    persona_lens=request.personaLens,      # NEW
)
```

**First SSE event** — add `persona_lens` to the `context_info` payload:
```python
context_info = {
    "context": {
        "entities": context_data['used_entities'],
        "relationships": context_data['used_relationships'],
        "raw_context_string": context_data['context_string'],
        "citations": context_data.get('citations', []),
        "persona_lens": context_data.get('persona_lens', 'ceo'),  # NEW
    },
    "done": False,
}
```

**Final SSE event** — replace literal `[DONE]` with structured JSON:
```python
# Replace: yield f"data: [DONE]\n\n"
# With:
done_data = json.dumps({
    "done": True,
    "failoverTriggered": llm_meta.get('failover_triggered', False),
    "failoverNotice": llm_meta.get('failover_notice', None),
})
yield f"data: {done_data}\n\n"
```
*`llm_meta` is the dict returned by `stream_response()` after the generator is exhausted — or pass via a mutable container if needed.*

**SSE error handler** — replace raw exception string:
```python
# Replace: error_data = json.dumps({"error": str(e), "done": True})
# With:
error_data = json.dumps({"error": "Stream error — please retry.", "done": True})
```

---

### B5 — `backend/data/seed_mds_d2c.json`

Target: 35–45 entities, all using `metadata` (not `properties`) for type-specific fields. Entity IDs prefixed `mds-`. Relationship IDs prefixed `mds-rel-`.

Mandatory entities (minimum viable for hero question):
- 4–5 `product_category` entities (Sports Nutrition, Vitamins & Supplements, Beauty & Personal Care, Pet Nutrition)
- 4–5 `region` entities (London & SE, Midlands, North England, Scotland, Wales)
- 5–6 `supply_chain_node` entities — at least 2 `ready`, 2 `blocker`, 1 `partial`
- 3 `marketing_channel` entities (Trade Wholesale, Amazon UK, MDS D2C)
- 6–8 `kpi` entities (TAV, EAV Year 1/2/3, RV Baseline, D2C Margin Target)
- 2–3 `legal_entity` entities (Retailer Channel Agreement with Beauty exclusivity, 3PL MSA)
- 3–4 `finance_entity` entities (Capex Estimate, Break-even Month, COGs)

Mandatory relationships for multi-hop hero question (must span ≥3 hops from any single seed):
- `measures`: every KPI → at least one product_category or region
- `phases_in_year`: product_category → EAV Year N KPI (encodes FR-3 roadmap)
- `depends_on`: product_category → supply_chain_node (connects readiness to recommendation)
- `fulfils_region`: supply_chain_node → region
- `serves_category`: supply_chain_node → product_category
- `governs`: legal_entity → marketing_channel (encodes channel conflict)
- `competes_with`: MDS D2C channel → Trade Wholesale channel
- `funds`: finance_entity → product_category or region

---

### B6 — `backend/services/seed_mds_d2c.py`

```python
import json
from pathlib import Path
from backend.services.graph_service import graph_service
from backend.models.graph import EntityCreate, RelationshipCreate

def seed_mds_d2c_graph():
    graph_service.entities.clear()
    graph_service.relationships.clear()

    data_path = Path(__file__).parent.parent / 'data' / 'seed_mds_d2c.json'
    with open(data_path) as f:
        data = json.load(f)

    for entity_data in data['entities'].values():
        # Use graph_service internal dict directly to preserve IDs from seed file
        from backend.models.graph import Entity
        graph_service.entities[entity_data['id']] = Entity(**entity_data)

    for rel_data in data['relationships'].values():
        from backend.models.graph import Relationship
        graph_service.relationships[rel_data['id']] = Relationship(**rel_data)

    graph_service._persist()
    return len(graph_service.entities), len(graph_service.relationships)
```

*Pattern matches `seed_big_data_demo.py` exactly — preserve IDs from the seed file rather than generating new UUIDs, so the seed is deterministic and relationships always resolve.*

---

### B7 — `main.py`

Add seed endpoint (after existing seed endpoints):
```python
from backend.services.seed_mds_d2c import seed_mds_d2c_graph

@app.post("/api/graph/seed/mds-d2c")
async def seed_mds_d2c():
    entity_count, rel_count = seed_mds_d2c_graph()
    return {"status": "ok", "entities": entity_count, "relationships": rel_count}
```

Extend health check:
```python
@app.get("/api/health")
@app.get("/health")
async def health_check():
    openai_key = os.getenv('OPENAI_API_KEY', '')
    gemini_key = os.getenv('GEMINI_API_KEY', '')
    return {
        "status": "healthy",
        "providers": {
            "openai": bool(openai_key and openai_key != 'your_openai_api_key_here'),
            "gemini": bool(gemini_key and gemini_key != 'your_gemini_api_key_here'),
        }
    }
```

---

## 5. Frontend Component Specs

### F1a — `src/types/graph.ts`

Add new MDS values to the `EntityType` union (do not replace existing values):
```typescript
export type EntityType =
    // existing values...
    | 'domain' | 'data_product' | 'process' | 'person' | 'technology' | 'ai_agent' | 'metadata_technical'
    // MDS D2C additions:
    | 'product_category' | 'region' | 'supply_chain_node' | 'marketing_channel'
    | 'kpi' | 'legal_entity' | 'finance_entity';
```

---

### F1b — `src/constants/categories.ts`

Add MDS entity type configs. Append to `DEMO_CATEGORIES` array — do not replace:
```typescript
// MDS D2C additions
{ id: 'product_category',   label: 'Product Category',    icon: '📦', color: '#0ea5e9' },
{ id: 'region',             label: 'UK Region',           icon: '🗺️', color: '#14b8a6' },
{ id: 'supply_chain_node',  label: 'Supply Chain Node',   icon: '🏭', color: '#f97316' },
{ id: 'marketing_channel',  label: 'Marketing Channel',   icon: '📢', color: '#a855f7' },
{ id: 'kpi',                label: 'KPI',                 icon: '💰', color: '#22c55e' },
{ id: 'legal_entity',       label: 'Legal Entity',        icon: '⚖️', color: '#ef4444' },
{ id: 'finance_entity',     label: 'Finance',             icon: '💹', color: '#eab308' },
```

`isDemoEntityType()` requires no change — it already returns true for anything in `DEMO_ENTITY_TYPES`, and `DEMO_ENTITY_TYPES` is derived from `DEMO_CATEGORIES.map(c => c.id)`, so extending `DEMO_CATEGORIES` automatically covers the new types.

**Supply chain node color override (FR-12):** The base `color` (`#f97316`) is used for non-VP-SC persona views. The VP SC glow colors (`#22c55e` / `#ef4444` / `#f59e0b`) are applied in the `GraphCanvas.tsx` cosmetic effect — not here. `categories.ts` is not persona-aware.

---

### F1 — `src/types/chat.ts`

As specified in §2.5. Add `PersonaLens`, `LLMProvider` types; extend `ChatRequest` and `ChatResponse`.

---

### F2 — `src/store/chatStore.ts`

New state fields:
```typescript
personaLens: PersonaLens;              // default: 'ceo'
provider: LLMProvider;                 // default: 'openai'
highlightedEntities: string[];         // default: []
highlightedRelationships: string[];    // default: []
```

New actions:
```typescript
setPersonaLens: (lens: PersonaLens) => void;
setProvider: (provider: LLMProvider) => void;
setHighlightedPath: (entities: string[], relationships: string[]) => void;
clearHighlightedPath: () => void;
```

`clearMessages()` should also call `clearHighlightedPath()` internally — highlighted path from a prior session should not persist across a cleared conversation.

---

### F3 — `src/components/GraphCanvas.tsx`

**Structural `useEffect` (existing — keep dep array, keep `.remove()` rebuild):**
No change to the existing `useEffect` logic except: when computing `fillColor` in `node.each(...)`, call the new `getNodeFillColor(d, personaLens)` helper (see below) instead of `category?.color ?? 'var(--graph-node-default)'`. This ensures the initial render already respects the active persona lens.

**New `getNodeFillColor(node, personaLens)` helper (module-level, not a hook):**
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

**Cosmetic `useEffect` (new — separate from structural):**
```typescript
useEffect(() => {
    if (!svgRef.current) return;
    // Update node fill colors only — no simulation touch
    d3.select(svgRef.current)
        .selectAll<SVGCircleElement, GraphNode>('.graph-node circle')
        .attr('fill', d => getNodeFillColor(d, personaLens));

    // Update highlight: dim non-highlighted, brighten highlighted
    const highlightSet = new Set(highlightedEntities);
    const hasHighlight = highlightSet.size > 0;
    d3.select(svgRef.current)
        .selectAll<SVGGElement, GraphNode>('.graph-node')
        .attr('opacity', d => hasHighlight ? (highlightSet.has(d.id) ? 1 : 0.3) : 1)
        .select('circle')
        .attr('stroke-width', d => highlightSet.has(d.id) ? 4 : undefined);

    const relHighlightSet = new Set(highlightedRelationships);
    d3.select(svgRef.current)
        .selectAll<SVGLineElement, DisplayGraphLink>('.graph-link')
        .attr('stroke-opacity', d =>
            hasHighlight ? (relHighlightSet.has((d as any).id) ? 1 : 0.15) : 0.5
        )
        .attr('stroke-width', d =>
            relHighlightSet.has((d as any).id) ? 3 : 1.5
        );
}, [personaLens, highlightedEntities, highlightedRelationships]);
```
This effect never calls `simulation.alpha()` or `simulation.restart()` — it is DOM attribute mutations only.

**VP SC glow (CSS class, not inline `filter:`):**
Add `.node-sc-ready`, `.node-sc-blocker`, `.node-sc-partial` CSS classes to `GraphCanvas.css` instead of using inline `filter: drop-shadow(...)`. Apply classes in the cosmetic effect. This keeps the structural effect's `d3.selectAll('*').remove()` from needing to know about glow state — the CSS classes are re-applied by the cosmetic effect on next render.

```css
/* GraphCanvas.css additions */
.node-sc-ready   circle { filter: drop-shadow(0 0 6px #22c55e); }
.node-sc-blocker circle { filter: drop-shadow(0 0 8px #ef4444); }
.node-sc-partial circle { filter: drop-shadow(0 0 5px #f59e0b); }
```

---

### F4 — `src/components/Chat/ChatInterface.tsx`

**First SSE event handler (FR-14):**
When the first SSE event is received and `event.context` is present, call:
```typescript
chatStore.setHighlightedPath(
    event.context.entities,
    event.context.relationships
);
```
Call `chatStore.clearHighlightedPath()` immediately before starting a new stream request.

**FR-7 — reasoning fallback:**
After stream completes, check `message.reasoning`. If empty string (set by `extract_reasoning` when no `<reasoning>` tag found):
- Render the explainability drawer with a collapsed state.
- Show the copy: `"Direct EKG response generated — reasoning trace unavailable for this response."`
- Do not attempt to render the reasoning panel content.

**FR-8 — failover toast (Could):**
On receiving the structured `done` event, check `event.failoverTriggered`. If true, render a 3-second auto-dismiss toast with `event.failoverNotice` text. Position: top-right, `z-index` above the graph canvas. Implement as a simple `useState` timeout — no toast library.

**`[DONE]` event parsing update:**
The existing stream parser currently checks for the literal string `[DONE]`. Replace with JSON parse of the `done` event: `if (parsed.done === true)`.

**FR-10 — KPI inline edit (Should):**
In the CEO lens panel (wherever KPI entities are surfaced in the chat response), render the `metadata.value` as a `<span contentEditable>` or `<input>` when `personaLens === 'ceo'`. On blur/enter, call `PUT /api/graph/entities/{entityId}` with `{"metadata": {...existing, "value": newValue}}`. Only `metadata.value` is editable — name, description, and other fields are read-only in this UI.

---

### F5 — `src/components/Controls/PersonaSelector.tsx`

Three-segment button toggle. Labels: `CEO` / `VP Supply Chain` / `CDO`. Reads `chatStore.personaLens`; calls `chatStore.setPersonaLens()` + `chatStore.clearHighlightedPath()` on switch.

Styled to match existing `GraphToolbar` toggle button pattern. No icon — text labels only (readable on a projected screen).

---

### F6 — `src/components/Controls/ProviderSelector.tsx` (Should)

Two-button toggle: `OpenAI` / `Gemini`. Reads `chatStore.provider`; calls `chatStore.setProvider()` on switch.

On mount, fetch `/api/health` to get `providers` availability flags. Disable (grey-out, `cursor: not-allowed`) whichever provider has `false`. If both available, both enabled.

Only mount this component if FR-6 ships. `AppLayout.tsx` conditionally renders it — guarded by a `VITE_ENABLE_PROVIDER_SELECTOR=true` env var or simply omitted if not in scope.

---

### F7 — `src/api/chatApi.ts`

Extend the stream/message request body to include `provider` and `personaLens` from parameters passed by `ChatInterface.tsx`:
```typescript
body: JSON.stringify({
    message,
    groundingMode,
    conversationHistory,
    focusEntityId,
    provider,       // NEW
    personaLens,    // NEW
})
```

Update the stream event parser:
- Parse JSON for every `data:` line (not just non-`[DONE]` lines).
- Route by event shape: `event.context` → context_info; `event.delta` → text chunk; `event.type === 'stream_reset'` → reset signal; `event.done === true` → done.

---

### F8 — `src/components/Layout/AppLayout.tsx`

Mount `PersonaSelector` in the header/toolbar alongside the existing grounding-mode toggle. Mount `ProviderSelector` to the right of `PersonaSelector` if FR-6 ships.

Layout constraint: all controls must be visible without scrolling on a 1920×1080 projected display. Keep to a single toolbar row.

---

## 6. Logic Flows

### 6.1 Full request pipeline (streaming path)

```
User submits question
│
├── ChatInterface clears highlighted path
├── chatApi.ts POSTs /api/chat/stream with {message, groundingMode, provider, personaLens}
│
└── routes/chat.py
    ├── context_service.assemble_context(message, groundingMode, focusEntityId, personaLens)
    │   ├── interpret_query() → relevant types + keywords (MDS-aware)
    │   ├── find_relevant_entities() → top seed entities
    │   ├── expand_context(seeds, depth=3) → subgraph (BFS, visited-set dedup)
    │   └── package_context(subgraph, groundingMode, focusEntityId, personaLens) → context string
    │
    ├── yield SSE event 1: context_info {entities, relationships, citations, persona_lens}
    │   └── ChatInterface receives → chatStore.setHighlightedPath() → GraphCanvas cosmetic effect fires
    │
    ├── llm_service.stream_response(message, context, history, groundingMode, provider, personaLens)
    │   ├── _get_client(provider) → (client, model, resolved_provider)
    │   ├── build_prompt(message, context, history, groundingMode, personaLens) → messages[]
    │   └── streams chunks from provider API
    │       (FR-8: if timeout → emit stream_reset SSE → retry other provider)
    │
    ├── yield SSE events 2…N: {delta, done: false}
    │   └── ChatInterface.appendStreamChunk() → currentStreamingMessage grows
    │
    └── yield SSE final: {done: true, failoverTriggered, failoverNotice}
        └── ChatInterface.finishStreaming(message) → extract_reasoning → store message
            (FR-8: if failoverTriggered → show toast)
            (FR-7: if reasoning empty → collapsed drawer fallback)
```

### 6.2 D3 rendering decision tree

```
State change arrives
│
├── filteredEntities or filteredRelationships changed?
│   └── YES → structural useEffect fires
│           → svg.selectAll('*').remove()
│           → rebuild nodes, links, simulation
│           → getNodeFillColor(d, personaLens) used for initial fill
│
└── personaLens OR highlightedEntities OR highlightedRelationships changed?
    └── YES → cosmetic useEffect fires
            → d3.selectAll('.graph-node circle').attr('fill', ...)
            → d3.selectAll('.graph-node').attr('opacity', ...)
            → d3.selectAll('.graph-link').attr('stroke-opacity', ...)
            → NO simulation.alpha() or simulation.restart() called
```

---

## 7. Instrumentation Gap (carry-forward from NFR-10)

Pre-show warm-up: `curl https://<deployed-domain>/api/health` 1–2 minutes before presenting. The extended health response now also tells the presenter which providers are live, so this doubles as a provider availability check.

---

*Pending your review and sign-off. No implementation begins before Stage 2 Instruction Set is confirmed.*
