import os
import time
from datetime import datetime, timezone
from typing import Dict, Tuple

from dotenv import load_dotenv
from fastapi import Request, HTTPException

from backend.services.storage_service import storage_service

load_dotenv()

# Bounds worst-case Gemini spend once the demo is on a public domain: a per-IP
# window (stops any single visitor/bot from looping) plus a shared daily cap
# (bounds total spend for the whole demo regardless of how traffic is spread).
# Both configurable via env vars so limits can be tuned without a code change.
IP_LIMIT = int(os.getenv('CHAT_RATE_LIMIT_PER_IP', '40'))
IP_WINDOW_SECONDS = int(os.getenv('CHAT_RATE_LIMIT_WINDOW_SECONDS', '600'))
DAILY_LIMIT = int(os.getenv('CHAT_DAILY_MESSAGE_LIMIT', '500'))

# Lets the presenter's browser skip all limits below, regardless of what IP
# venue WiFi NATs them behind (often shared with the whole room, and unknown
# in advance). Empty by default: unset, so no header value can ever match
# and accidentally bypass anything.
BYPASS_TOKEN = os.getenv('DEMO_BYPASS_TOKEN', '')

# Local-dev fallback only — a single process, so a plain dict is enough.
# On Vercel, storage_service.use_redis is always true when KV_REST_API_URL/
# TOKEN are set, since different requests can land on different, isolated
# containers that don't share memory (same reasoning as graph storage).
_local_counters: Dict[str, Tuple[int, float]] = {}


def _get_client_ip(request: Request) -> str:
    forwarded = request.headers.get('x-forwarded-for')
    if forwarded:
        return forwarded.split(',')[0].strip()
    real_ip = request.headers.get('x-real-ip')
    if real_ip:
        return real_ip.strip()
    return request.client.host if request.client else 'unknown'


def _incr_with_window(key: str, window_seconds: int) -> int:
    """Increment a fixed-window counter and return the new count."""
    if storage_service.use_redis:
        count = storage_service.redis.incr(key)
        if count == 1:
            storage_service.redis.expire(key, window_seconds)
        return count

    now = time.time()
    count, expires_at = _local_counters.get(key, (0, now + window_seconds))
    if now >= expires_at:
        count, expires_at = 0, now + window_seconds
    count += 1
    _local_counters[key] = (count, expires_at)
    return count


def check_rate_limit(request: Request) -> None:
    """Raises HTTPException(429) if the caller has exceeded the per-IP or the
    shared daily message limit. Call before any LLM call is made — the whole
    point is to avoid spending tokens on requests that get rejected anyway."""
    if BYPASS_TOKEN and request.headers.get('x-demo-bypass-key') == BYPASS_TOKEN:
        return

    ip = _get_client_ip(request)

    ip_count = _incr_with_window(f"ratelimit:ip:{ip}", IP_WINDOW_SECONDS)
    if ip_count > IP_LIMIT:
        raise HTTPException(
            status_code=429,
            detail="Rate limit reached — please wait a few minutes before sending more messages.",
        )

    today = datetime.now(timezone.utc).date().isoformat()
    daily_count = _incr_with_window(f"ratelimit:daily:{today}", 26 * 3600)
    if daily_count > DAILY_LIMIT:
        raise HTTPException(
            status_code=429,
            detail="This demo has reached its daily message limit — please try again after midnight UTC, or contact the presenter.",
        )
