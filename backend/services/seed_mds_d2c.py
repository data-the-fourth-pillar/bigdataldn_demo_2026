import json
import os
from backend.services.graph_service import graph_service
from backend.models.graph import Entity, Relationship

def seed_mds_d2c_graph():
    """Seed the MDS D2C Launch Advisor knowledge graph."""
    graph_service.entities.clear()
    graph_service.relationships.clear()

    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    seed_file = os.path.join(base_dir, "data", "seed_mds_d2c.json")

    with open(seed_file, 'r') as f:
        data = json.load(f)

    for entity_data in data.get("entities", {}).values():
        entity = Entity(**entity_data)
        graph_service.entities[entity.id] = entity

    for rel_data in data.get("relationships", {}).values():
        rel = Relationship(**rel_data)
        graph_service.relationships[rel.id] = rel

    graph_service._persist()
    return len(graph_service.entities), len(graph_service.relationships)
