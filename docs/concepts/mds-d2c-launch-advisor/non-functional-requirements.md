# Stage 0.B — Non-Functional Requirements: MDS D2C Launch Advisor

**Status:** All four open items confirmed by Sujay in his own words, 2026-06-22 (see bottom section). Scoped for a live, single-presenter conference demo (Sept 2026), not a production multi-tenant deployment — targets below are intentionally modest, matching the FR doc's "small hand-seeded EKG, simplicity first" framing rather than generic enterprise scale.

---

## Performance

**NFR-1. Grounded response latency.** A non-streaming `/api/chat/message` call with `kg_full` grounding and 3–4 hop traversal (FR-1) returns within **5 seconds** end-to-end (graph traversal + LLM call), against the ~30–50 entity EKG.

**NFR-2. Time-to-first-highlight.** For the `/stream` endpoint, the initial `context_info` SSE event (entities/relationships/citations — FR-14) is sent within **1 second** of request start. This is achievable because `context_service.assemble_context()` already runs before the LLM call begins (`routes/chat.py:58-75`), so the highlight doesn't wait on the LLM.

**NFR-2b. Streaming time-to-first-token (TTFT).** For the `/stream` endpoint, the first answer-text `delta` chunk (distinct from NFR-2's metadata-only event, which arrives first and faster) renders within **1.5 seconds** of request start. Added 2026-06-22: with a small hand-seeded EKG, in-memory graph traversal is sub-10ms — the entire latency budget is LLM API time, and our context is small (~2-3k tokens), so TTFT is the realistic primary "feels instantaneous" KPI for the streaming path that the demo actually uses, not the 5-second non-streaming ceiling (NFR-1).

**NFR-3. UI responsiveness on toggle.** Persona lens switch (FR-4), grounding-mode toggle (FR-2), and VP Supply Chain color recoloring (FR-12) apply to the D3 canvas within **300ms** — these are client-side state changes over already-loaded graph data, not new fetches.

## Scalability

**NFR-4. Graph size ceiling.** EKG is hand-seeded and expected to stay in the **30–50 entity** range for this demo (per FR-1's depth-cap rationale). No requirement to perform/scale beyond that — if entity count grows materially past this in later seeding work, traversal depth and latency targets above should be re-checked, not assumed to still hold.

**NFR-5. Concurrency.** Demo runs as a **single presenter session** at a time (one laptop/browser tab driving the stage display). No requirement for concurrent multi-user sessions, session isolation, or horizontal scaling.
*Known limitation:* Because graph state is held in-memory and persisted ephemerally (to `/tmp` on Vercel), if co-authors present from separate laptops using the same deployed Vercel URL simultaneously, changes made by one presenter (such as editing KPI values) will not sync to the other presenter's screen or session. The app expects independent sandboxes (running locally on each laptop) or one active laptop at a time when using the deployed URL. No cross-device synchronization logic will be built.

## Cost

**NFR-6. LLM cost ceiling.** Both providers (`gpt-4o-mini`, Gemini equivalent) are low-cost models already chosen for this reason. No specific budget cap is being set — demo-scale usage (rehearsals + live sessions) is expected to be negligible cost regardless of provider mix. Not worth instrumenting/alerting on for this scope.

## Security

**NFR-7. Credential handling.** `OPENAI_API_KEY` and `GEMINI_API_KEY` are read from environment variables only — never hardcoded, never passed as request params, never logged. Applies the project's existing Stage 2 mandatory credential-handling subsection (per CLAUDE.md) to the multi-provider work in FR-6.

**NFR-8. No secret/PII leakage in error paths.** Provider errors (timeouts, auth failures triggering FR-8 failover) must not surface raw API responses, headers, or keys in logs, the failover toast, or any exception message shown in the UI.

## Reliability

**NFR-9. Failover trigger threshold.** If FR-8 (automatic failover) ships, the provider-error/timeout threshold that triggers a retry against the other provider is **3–5 seconds** with no response chunk (revised down from an earlier 10s draft, 2026-06-22 — 10s of frozen UI in front of a live audience feels broken; a snappier trigger reads as a deliberate, impressive failover rather than a stall). Stays conditional on FR-8 (Could): if FR-8 is cut, this NFR is automatically out of scope.

**NFR-10. Demo environment stability.** Since Vercel `/tmp` storage resets on cold start (FR-5's documented constraint), and cold starts (importing FastAPI/Pydantic/OpenAI deps + reloading the seeded graph) can take 3–7 seconds, the deployed demo environment should be **kept warm** via a pre-show warm-up request 1-2 minutes before each live session, rather than building any persistence workaround.
*Mechanism gap found 2026-06-22, fixed same day:* the health-check route at `backend/main.py` was registered as plain `/health` only, which `vercel.json`'s `/api/(.*)` rewrite rule never matches — so it was unreachable on the deployed Vercel app. Fixed by stacking a second `@app.get("/api/health")` decorator on the same handler (`backend/main.py:66-68`), so both paths now resolve: `/health` for local/direct checks, `/api/health` for the deployed Vercel app via the existing rewrite rule. No `vercel.json` change needed. Presenter pre-show checklist: `curl https://<deployed-domain>/api/health` 1-2 minutes before walking on stage.

---

## Confirmed by Sujay, 2026-06-22

1. **NFR-1 / NFR-2b latency split** — confirmed. NFR-2b (1.5s streaming TTFT) governs the presenter's flow since streaming is the default UI path; NFR-1 (5s) remains the safety-net ceiling for standard non-streaming POST completion.
2. **NFR-5 concurrency** — confirmed. Strictly a single local laptop / single browser tab projecting to the screen, no audience-device or multi-user scenario. Keeps the Zustand store and backend in-memory model simple, no multi-session sync needed.
3. **NFR-9 failover threshold** — confirmed at 3–5 seconds as the right window for a live stage environment. Still conditional on FR-8 (Could) actually shipping.
4. **NFR-10 warmup mechanism gap** — already fixed in code the same day (`/api/health` added in `backend/main.py:66-68`); no longer an open item.

No further open items on this NFR pass. As always, this stays open to revision if anything new comes up later — nothing here is being treated as permanently unchangeable.
