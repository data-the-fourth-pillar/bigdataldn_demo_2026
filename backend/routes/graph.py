from fastapi import APIRouter, HTTPException, Body
from typing import List, Any, Dict
from backend.models.graph import Entity, EntityCreate, EntityUpdate, Relationship, RelationshipCreate, GraphData
from backend.services.graph_service import graph_service

router = APIRouter(tags=["graph"])

# Entity endpoints
@router.get("/entities", response_model=List[Entity])
async def get_entities():
    """Get all entities"""
    return graph_service.get_all_entities()

@router.get("/entities/{entity_id}", response_model=Entity)
async def get_entity(entity_id: str):
    """Get a specific entity"""
    entity = graph_service.get_entity(entity_id)
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")
    return entity

@router.post("/entities", response_model=Entity)
async def create_entity(entity: EntityCreate):
    """Create a new entity"""
    return graph_service.create_entity(entity)

@router.put("/entities/{entity_id}", response_model=Entity)
async def update_entity(entity_id: str, updates: EntityUpdate):
    """Update an existing entity"""
    entity = graph_service.update_entity(entity_id, updates)
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")
    return entity

@router.delete("/entities/{entity_id}")
async def delete_entity(entity_id: str):
    """Delete an entity"""
    success = graph_service.delete_entity(entity_id)
    if not success:
        raise HTTPException(status_code=404, detail="Entity not found")
    return {"message": "Entity deleted successfully"}

# Relationship endpoints
@router.get("/relationships", response_model=List[Relationship])
async def get_relationships():
    """Get all relationships"""
    return graph_service.get_all_relationships()

@router.get("/relationships/{relationship_id}", response_model=Relationship)
async def get_relationship(relationship_id: str):
    """Get a specific relationship"""
    relationship = graph_service.get_relationship(relationship_id)
    if not relationship:
        raise HTTPException(status_code=404, detail="Relationship not found")
    return relationship

@router.post("/relationships", response_model=Relationship)
async def create_relationship(relationship: RelationshipCreate):
    """Create a new relationship"""
    result = graph_service.create_relationship(relationship)
    if not result:
        raise HTTPException(status_code=400, detail="Invalid source or target entity")
    return result

@router.delete("/relationships/{relationship_id}")
async def delete_relationship(relationship_id: str):
    """Delete a relationship"""
    success = graph_service.delete_relationship(relationship_id)
    if not success:
        raise HTTPException(status_code=404, detail="Relationship not found")
    return {"message": "Relationship deleted successfully"}

# Graph management endpoints
@router.get("/graph/export")
async def export_graph():
    """Export the entire graph as JSON"""
    return {
        "entities": [e.model_dump() for e in graph_service.get_all_entities()],
        "relationships": [r.model_dump() for r in graph_service.get_all_relationships()]
    }

@router.post("/graph/import")
async def import_graph(data: Any = Body(...)):
    """
    Import and overwrite the entire graph.
    Supports both list and dictionary formats for entities and relationships.
    """
    try:
        # data can be a dict or a GraphData model
        if hasattr(data, 'model_dump'):
            data_dict = data.model_dump()
        else:
            data_dict = data

        print(f"DEBUG: Importing graph data. Entities: {type(data_dict.get('entities'))}, Relationships: {type(data_dict.get('relationships'))}")

        # Clear existing
        graph_service.entities = {}
        graph_service.relationships = {}
        
        # Process entities
        entities_input = data_dict.get('entities', [])
        print(f"DEBUG: Processing entities from {type(entities_input)}")
        if isinstance(entities_input, dict):
            for eid, e_data in entities_input.items():
                try:
                    if 'id' not in e_data: e_data['id'] = eid
                    graph_service.entities[eid] = Entity(**e_data)
                except Exception as ve:
                    print(f"ERROR: Failed to validate entity {eid}: {ve}")
                    continue
        elif isinstance(entities_input, list):
            for e_data in entities_input:
                eid = e_data.get('id')
                try:
                    if eid:
                        graph_service.entities[eid] = Entity(**e_data)
                except Exception as ve:
                    print(f"ERROR: Failed to validate entity {eid}: {ve}")
                    continue
        
        # Process relationships
        rels_input = data_dict.get('relationships', [])
        print(f"DEBUG: Processing relationships from {type(rels_input)}")
        if isinstance(rels_input, dict):
            for rid, r_data in rels_input.items():
                try:
                    if 'id' not in r_data: r_data['id'] = rid
                    # Field mapping robustness
                    if 'sourceId' not in r_data and 'source' in r_data:
                        src = r_data['source']
                        r_data['sourceId'] = src.get('id') if isinstance(src, dict) else str(src)
                    if 'targetId' not in r_data and 'target' in r_data:
                        tgt = r_data['target']
                        r_data['targetId'] = tgt.get('id') if isinstance(tgt, dict) else str(tgt)
                    
                    graph_service.relationships[rid] = Relationship(**r_data)
                except Exception as ve:
                    print(f"ERROR: Failed to validate relationship {rid}: {ve}")
                    continue
        elif isinstance(rels_input, list):
            for r_data in rels_input:
                rid = r_data.get('id')
                try:
                    if rid:
                        # Field mapping robustness
                        if 'sourceId' not in r_data and 'source' in r_data:
                            src = r_data['source']
                            r_data['sourceId'] = src.get('id') if isinstance(src, dict) else str(src)
                        if 'targetId' not in r_data and 'target' in r_data:
                            tgt = r_data['target']
                            r_data['targetId'] = tgt.get('id') if isinstance(tgt, dict) else str(tgt)
                        
                        graph_service.relationships[rid] = Relationship(**r_data)
                except Exception as ve:
                    print(f"ERROR: Failed to validate relationship {rid}: {ve}")
                    continue

        print(f"DEBUG: Import complete. Internal state: {len(graph_service.entities)} entities, {len(graph_service.relationships)} relationships")
        
        graph_service._persist()
        return {
            "message": "Graph imported successfully", 
            "entities": len(graph_service.entities), 
            "relationships": len(graph_service.relationships)
        }
    except Exception as e:
        print(f"ERROR: Import failed: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/graph/reset")
async def reset_graph():
    """Clear all data from the graph"""
    graph_service.clear_graph()
    return {"message": "Graph reset successfully"}

@router.post("/graph/seed/customer")
async def seed_customer():
    """Seed the Customer Service Support Agent data"""
    from backend.services.seed_customer_agent import seed_customer_support_agent
    seed_customer_support_agent()
    return {"message": "Customer support seed data applied"}

@router.post("/graph/seed/demo")
async def seed_demo():
    """Seed the Big Data demo knowledge graph"""
    from backend.services.seed_big_data_demo import seed_big_data_demo
    seed_big_data_demo()
    return {"message": "Big Data demo seed data applied"}

@router.post("/graph/seed/mds-d2c")
async def seed_mds_d2c():
    """Seed the MDS D2C Launch Advisor knowledge graph"""
    from backend.services.seed_mds_d2c import seed_mds_d2c_graph
    entity_count, rel_count = seed_mds_d2c_graph()
    return {"status": "ok", "entities": entity_count, "relationships": rel_count}
