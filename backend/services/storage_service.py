import json
import os
from typing import Dict, Any, List
from backend.models.graph import Entity, Relationship

class JSONStorageService:
    """
    Robust storage service that works on both local and Vercel environments.
    - On Vercel: Uses in-memory storage with optional /tmp file backup
    - Locally: Uses file-based storage in data/ directory
    """
    
    def __init__(self, data_dir: str = None):
        self.is_vercel = bool(os.environ.get('VERCEL'))
        self.use_file_storage = True
        
        if data_dir is None:
            if self.is_vercel:
                # On Vercel, use /tmp which is writable but ephemeral
                self.data_dir = '/tmp/data'
                print("🚀 Running on Vercel - using /tmp/data for optional file backup")
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

    def load_graph(self) -> Dict[str, Any]:
        """
        Load graph data from file if available, otherwise return empty structure.
        On Vercel, this will load seed data from backend/data if available.
        """
        # First try to load from the file system
        if self.use_file_storage:
            try:
                if os.path.exists(self.graph_file):
                    with open(self.graph_file, 'r') as f:
                        data = json.load(f)
                        print(f"✅ Loaded graph from {self.graph_file}")
                        return data
            except Exception as e:
                print(f"⚠️  Could not load from {self.graph_file}: {e}")
        
        # On Vercel, try to load seed data from backend/data
        if self.is_vercel:
            try:
                seed_file = os.path.join(
                    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                    "data",
                    "seed_customer_support.json"
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

    def save_graph(self, entities: Dict[str, Entity], relationships: Dict[str, Relationship]):
        """
        Save graph data. On Vercel, this is best-effort file save.
        The graph_service keeps data in memory, so this is just for persistence.
        """
        data = {
            "entities": {eid: e.model_dump() for eid, e in entities.items()},
            "relationships": {rid: r.model_dump() for rid, r in relationships.items()}
        }
        
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
