import json
import os
from typing import Dict, Any, List
from backend.models.graph import Entity, Relationship

class JSONStorageService:
    """
    Robust storage service that works on both local and Vercel environments.
    - On Vercel: Uses Upstash Redis (via KV_REST_API_URL/KV_REST_API_TOKEN) when
      configured, since each serverless invocation can land on a different,
      isolated container — in-memory state and /tmp are NOT shared between them,
      so a graph seeded by one request could appear empty to the next. Redis is
      the one thing every container can read/write consistently.
    - Locally: Uses file-based storage in data/ directory, unchanged.
    """

    def __init__(self, data_dir: str = None):
        self.is_vercel = bool(os.environ.get('VERCEL'))

        # Redis is used whenever it's configured, independent of is_vercel, so a
        # local .env with the same KV_REST_API_URL/TOKEN would also work against
        # the same store if ever wanted for testing — but the normal case is
        # these vars only exist on Vercel, so local dev is unaffected.
        redis_url = os.environ.get('KV_REST_API_URL')
        redis_token = os.environ.get('KV_REST_API_TOKEN')
        self.use_redis = bool(redis_url and redis_token)
        self.redis = None

        if self.use_redis:
            from upstash_redis import Redis
            self.redis = Redis(url=redis_url, token=redis_token)
            self.use_file_storage = False
            print("🔴 Using Upstash Redis for graph storage")
            return

        self.use_file_storage = True

        if data_dir is None:
            if self.is_vercel:
                # On Vercel without Redis configured, /tmp is writable but
                # ephemeral and NOT shared across container instances — kept
                # only as a last-resort fallback, not a real fix.
                self.data_dir = '/tmp/data'
                print("🚀 Running on Vercel without Redis configured - using /tmp/data (ephemeral, per-container only)")
            else:
                # Local development - use project data directory
                base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
                self.data_dir = os.path.join(base_dir, "data")
                print(f"💻 Running locally - using {self.data_dir} for storage")
        else:
            self.data_dir = data_dir

        self.graph_file = os.path.join(self.data_dir, "graph.json")

        # Try to ensure data directory exists
        try:
            self._ensure_data_dir()
        except Exception as e:
            print(f"⚠️  WARNING: Could not create data directory: {e}")
            print("📝 Falling back to in-memory only storage")
            self.use_file_storage = False

    def _ensure_data_dir(self):
        """Create data directory and initial graph file if they don't exist"""
        if not os.path.exists(self.data_dir):
            os.makedirs(self.data_dir, exist_ok=True)
            print(f"✅ Created directory: {self.data_dir}")

        if not os.path.exists(self.graph_file):
            with open(self.graph_file, 'w') as f:
                json.dump({"entities": {}, "relationships": {}}, f)
            print(f"✅ Created graph file: {self.graph_file}")

    def _load_seed_fallback(self) -> Dict[str, Any]:
        """Used when there's nothing persisted yet (first-ever Redis key, or no
        file storage available) — seeds straight from the bundled seed file
        rather than starting genuinely empty."""
        try:
            seed_file = os.path.join(
                os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                "data",
                "seed_mds_d2c.json"
            )
            if os.path.exists(seed_file):
                with open(seed_file, 'r') as f:
                    data = json.load(f)
                    print(f"✅ Loaded seed data from {seed_file}")
                    return data
        except Exception as e:
            print(f"⚠️  Could not load seed data: {e}")

        print("📝 Starting with empty graph")
        return {"entities": {}, "relationships": {}}

    def load_graph(self) -> Dict[str, Any]:
        """Load graph data from Redis (if configured), else from file, else seed data."""
        if self.use_redis:
            try:
                raw = self.redis.get("graph")
                if raw:
                    print("✅ Loaded graph from Redis")
                    return json.loads(raw)
            except Exception as e:
                print(f"⚠️  Could not load from Redis: {e}")
            return self._load_seed_fallback()

        if self.use_file_storage:
            try:
                if os.path.exists(self.graph_file):
                    with open(self.graph_file, 'r') as f:
                        data = json.load(f)
                        print(f"✅ Loaded graph from {self.graph_file}")
                        return data
            except Exception as e:
                print(f"⚠️  Could not load from {self.graph_file}: {e}")

        if self.is_vercel:
            return self._load_seed_fallback()

        print("📝 Starting with empty graph")
        return {"entities": {}, "relationships": {}}

    def save_graph(self, entities: Dict[str, Entity], relationships: Dict[str, Relationship]):
        """Save graph data to Redis (if configured), else to file (best-effort on Vercel)."""
        data = {
            "entities": {eid: e.model_dump() for eid, e in entities.items()},
            "relationships": {rid: r.model_dump() for rid, r in relationships.items()}
        }

        if self.use_redis:
            try:
                self.redis.set("graph", json.dumps(data))
                print(f"✅ Saved graph to Redis ({len(entities)} entities, {len(relationships)} relationships)")
            except Exception as e:
                # Same posture as the Vercel file-save fallback below: log, don't
                # crash the request over a persistence failure.
                print(f"⚠️  Could not save to Redis: {e}")
            return

        if not self.use_file_storage:
            # In-memory only mode - just log the save attempt
            print(f"📝 In-memory mode: Graph has {len(entities)} entities, {len(relationships)} relationships")
            return

        try:
            with open(self.graph_file, 'w') as f:
                json.dump(data, f, indent=2)
            print(f"✅ Saved graph to {self.graph_file} ({len(entities)} entities, {len(relationships)} relationships)")
        except (PermissionError, OSError) as e:
            # On Vercel, file saves might fail - this is OK since we use in-memory storage
            if self.is_vercel:
                print(f"⚠️  Could not persist to file (expected on Vercel): {e}")
                print(f"📝 Data is in memory: {len(entities)} entities, {len(relationships)} relationships")
            else:
                # On local, file save failures are real errors
                error_msg = f"Failed to save graph locally: {e}"
                print(f"❌ ERROR: {error_msg}")
                raise Exception(error_msg)
        except Exception as e:
            error_msg = f"Unexpected error saving graph: {e}"
            print(f"❌ ERROR: {error_msg}")
            # Don't raise on Vercel, just log
            if not self.is_vercel:
                raise Exception(error_msg)

storage_service = JSONStorageService()
