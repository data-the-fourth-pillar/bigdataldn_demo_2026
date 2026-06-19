import json
import os
from backend.services.graph_service import graph_service
from backend.models.graph import Entity, Relationship

def seed_customer_support_agent():
    """Seed the knowledge graph from the preserved snapshot"""
    
    # Always clear graph before seeding this scenario
    graph_service.clear_graph()
    
    print("Loading Customer Support Knowledge Graph from snapshot...")

    # Path to the seed file
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    seed_file = os.path.join(base_dir, "data", "seed_customer_support.json")
    
    try:
        with open(seed_file, 'r') as f:
            data = json.load(f)
            
            # Restore entities
            for entity_data in data.get("entities", {}).values():
                # Ensure we handle potential missing fields gracefully or convert formats if needed
                # The snapshot format matches internal storage, so we can likely cast directly
                # However, create_entity expects EntityCreate, but here we have full Entity objects with IDs
                # We should directly inject them into the service's storage to preserve IDs
                
                entity = Entity(**entity_data)
                graph_service.entities[entity.id] = entity
            
            # Restore relationships
            for rel_data in data.get("relationships", {}).values():
                rel = Relationship(**rel_data)
                graph_service.relationships[rel.id] = rel
                
            # Persist the restored state
            graph_service._persist()
            
            print(f"Successfully loaded {len(graph_service.entities)} entities and {len(graph_service.relationships)} relationships.")
            
    except Exception as e:
        print(f"Error loading seed snapshot: {e}")
        # Fallback to empty if file missing (or could raise error)
