# Stage 0 — Solution Architecture: MDS D2C Launch Advisor

**Status:** Option 1 and the provider design confirmed by Sujay in his own words, 2026-06-22 (see bottom section). Builds on the closed FR/NFR pass (`functional-requirements.md`, `non-functional-requirements.md`, both confirmed by Sujay 2026-06-22).

---

## Option 1 (Recommended) — Extend the existing stack in place

Keep the current two-process shape (FastAPI backend + Vite/React frontend, in-memory `graph_service` singleton, JSON persistence via `storage_service`). All FR/NFR work is additive, following patterns the codebase already uses:

- **FR-1 multi-hop traversal**: extend `context_service.expand_context()` with a depth-capped (3–4 hop) BFS over `graph_service.get_neighbors()`, in-process, no new dependency. At 30–50 entities (NFR-4) this is sub-10ms — no algorithmic sophistication needed.
  - ***Critical pre-existing bug found and fixed, 2026-06-22:*** `get_neighbors()` (`graph_service.py:119-133`) had a logic error — it added each node to `visited` *before* computing its neighbors but only returned `visited`, never the computed-but-unreturned neighbor set. Verified by direct test: calling `get_neighbors('A', depth=1)` on a 4-node chain A→B→C→D returned only `['A']`, not `['A','B']`. Practical effect: `depth=N` actually returned the `(N-1)`-hop ego network, off by one. **This wasn't just a future FR-1 risk — `context_service.py:132` already calls `get_neighbors(entity.id, depth=1)` inside the live `expand_context()`.** Before the fix, that call contributed zero real neighbors to every grounded answer; the existing single-hop context expansion has been silently a no-op. Fixed with a standard BFS queue (visited seeded with the entity itself, each hop's newly-reached nodes added to both `visited` and the next queue) — re-verified depth=1 now correctly returns `['A','B']`. **This changes today's live grounded-answer behavior**, not just future multi-hop work — grounded (`kg_full`) answers will now be measurably richer than whatever's been seen/tested so far, since real neighbor expansion is happening for the first time. Worth a fresh look at existing demo answers before the conference, since "what grounded mode produces" has changed.
- **FR-6/FR-7 multi-LLM**: simpler than originally drafted — Gemini publishes a documented OpenAI-compatible endpoint (`https://generativelanguage.googleapis.com/v1beta/openai/`), so both providers can be driven by the *same* `openai` Python SDK, just pointed at different `base_url`/`api_key` pairs. No second SDK dependency, no separate streaming-chunk-parsing logic for Gemini — one client class, a router in `llm_service.py` that picks which instantiated client to call based on the `provider` request param (threaded through `routes/chat.py` the same way `groundingMode` already is). FR-7's fallback `<reasoning>` parser lives here too, and now only has to handle one response shape instead of two.
- **FR-5 KPI-as-entity**: no new store — `kpi`-typed entities + `measures` relationships go through the existing `graph_service`/`storage_service` CRUD path, inheriting the already-documented and now NFR-5-confirmed Vercel `/tmp` ephemeral caveat.
- **FR-14 graph highlight, FR-12 color-coding**: frontend-only — `chatStore` consumes the already-existing first-SSE-event payload, `GraphCanvas.tsx`'s D3 render gets a highlight-path prop and a persona-conditional node-color function.
- **FR-8 failover, NFR-9**: server-side retry-and-switch in `llm_service.py` with a 3–5s timeout, surfaced via a toast the frontend renders off a response flag.

**Trade-off:** Lowest implementation risk and effort — every piece is additive to a codebase the team already understands, with no new infrastructure, no new deployment topology, no new credentials to manage beyond the already-planned `GEMINI_API_KEY`. Ceiling is whatever the existing architecture's ceiling is — but per NFR-4/NFR-5, that ceiling (30-50 entities, single presenter) is exactly the scope this demo needs, not a constraint it's straining against.

## Option 2 — Split KPI/analytics into a dedicated service

Move KPI management (TAV/EAV/RV CRUD + persona-lens computation) into a separate service/module from the core graph-chat pipeline, called internally by the main API.

**Trade-off:** Cleaner separation of concerns in principle, but: doubles the Vercel cold-start/ephemeral-storage problem (NFR-10) across two functions instead of one; contradicts FR-5's already-confirmed decision to reuse the *existing* EKG CRUD API rather than build a separate KPI store; adds inter-service call latency that works against NFR-1/NFR-2b. **Not recommended** — flagged to explicitly rule out rather than silently dismiss, since it's the kind of "looks more correct" option that's tempting to default into.

## Option 3 — Real graph database (Neo4j/Memgraph) backing the EKG

Replace the in-memory `graph_service` + JSON persistence with a managed graph database, enabling native multi-hop Cypher traversal and solving the Vercel ephemeral-storage problem (NFR-10) at the root instead of working around it.

**Trade-off:** This is the architecturally "correct" long-term answer — it's literally the not-yet-implemented plan already flagged in `VERCEL_STORAGE_FIX.md`. But it introduces a new external dependency, provisioning/credential work, network round-trip latency per query (risking NFR-1/NFR-2b's latency targets versus today's in-memory dict lookups), and migration effort entirely disproportionate to a hand-seeded ~30-50 entity graph built for a one-off conference demo. **Not recommended for Sept 2026** — appropriate as a post-demo roadmap item, not Stage 0 scope here.

---

## Recommendation

Option 1. Options 2 and 3 are both legitimate architectures in the abstract, but every NFR confirmed in the prior sub-stage (small graph, single presenter, simplicity-first, no persistence workaround) points away from them for this specific deadline. Worth revisiting Option 3 specifically if this demo's EKG is ever reused beyond the Sept 2026 conference.

## Confirmed by Sujay, 2026-06-22

1. **Option 1** — confirmed. Extending the existing FastAPI + React/Zustand stack in place is the only approach that respects the Sept 2026 deadline and avoids unnecessary architectural overhead; in-memory state + JSON storage is the right fit for the presenter sandbox.
2. **Provider design** — confirmed. Two instances of the same `openai`-SDK client class with one router selecting between them, via Gemini's OpenAI-compatibility layer — no second SDK, no separate token-parsing loop.
3. **`get_neighbors` fix** — verified by Sujay directly against the code (queue-based BFS, returns neighbors excluding the seed entity — refined further than the first fix to exclude `entity_id` from the result via `visited - {entity_id}`, re-tested: `depth=1` on the A→B→C→D chain now returns `['B']` only). Confirmed this repairs the off-by-one depth error so context expansion pulls real neighbors instead of being a silent no-op.

No further open items on this Solution Architecture pass. Stays open to revision if anything new comes up.
