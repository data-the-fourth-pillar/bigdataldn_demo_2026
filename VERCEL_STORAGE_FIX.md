# Vercel Storage — Upstash Redis

_Last updated 2026-09-26. The live deployment has used Redis since 2026-09-12 (commit `034d02a`)._

## Problem

Vercel runs the FastAPI backend as serverless functions. Different requests can land on different, **isolated container instances**. Each instance has its own in-memory `graph_service` and its own `/tmp` filesystem. So a graph seeded by one request appeared empty to the next, and the live API returned inconsistent entity/relationship counts (70/359, then 0/0, then a mix).

The earlier fix (writing to `/tmp/data/graph.json` when `VERCEL` is set) made saves stop failing. It could never make state consistent across containers.

## Solution: Upstash Redis

`backend/services/storage_service.py` stores the whole graph as one JSON value under the Redis key `graph` whenever both env vars are set:

| Env var | Source |
|---|---|
| `KV_REST_API_URL` | Vercel Storage → Upstash Redis marketplace integration |
| `KV_REST_API_TOKEN` | same |

Dependency: `upstash-redis==1.8.0`, in both root `requirements.txt` (what Vercel builds from) and `backend/requirements.txt`.

### Storage selection (in order)

1. **Redis**: if both KV vars are set, whatever the `VERCEL` setting. This is the live Vercel path.
2. **Vercel without Redis**: `/tmp/data/graph.json`. Ephemeral and per-container. Last-resort fallback only.
3. **Local**: `<repo_root>/data/graph.json`. Local dev never sets the KV vars, so it is unaffected.

### Behaviour

- **Load**: reads the `graph` key. If it's empty or unreadable, it falls back to the bundled `backend/data/seed_mds_d2c.json`.
- **Save**: writes the full graph on every mutation. Failures are logged, not raised, so a persistence error doesn't crash the request.

## Also uses Redis: chat rate limiting

`backend/services/rate_limit_service.py` (commit `24f505a`) keeps its fixed-window counters in the same Redis, for the same cross-container reason:

| Env var | Default | Meaning |
|---|---|---|
| `CHAT_RATE_LIMIT_PER_IP` | 40 | messages per IP per window |
| `CHAT_RATE_LIMIT_WINDOW_SECONDS` | 600 | per-IP window |
| `CHAT_DAILY_MESSAGE_LIMIT` | 500 | shared cap across all users, per UTC day |
| `DEMO_BYPASS_TOKEN` | _(unset)_ | presenter secret; matching `x-demo-bypass-key` header skips all limits |

Without Redis (local dev), the counters fall back to an in-process dict.

## Verifying on Vercel

- Function logs should show `🔴 Using Upstash Redis for graph storage`. If you see `Running on Vercel without Redis configured`, the KV env vars are missing.
- Repeated `GET /api/graph` calls should return the same counts every time.

## History

- **Before 2026-09-12**: `/tmp` storage on Vercel. Saves worked, but state wasn't shared across containers.
- **2026-09-12**: migrated to Upstash Redis. This replaces the Vercel Postgres / KV plan this document used to recommend.
