from typing import List, Optional, Dict, Any
from datetime import datetime
import uuid
from backend.models.graph import Entity, EntityCreate, EntityUpdate, Relationship, RelationshipCreate
from backend.services.storage_service import storage_service

class GraphService:
    """
    Graph storage service with JSON persistence.
    """
    
    def __init__(self):
        data = storage_service.load_graph()
        self.entities: Dict[str, Entity] = {
            eid: Entity(**e) for eid, e in data.get("entities", {}).items()
        }
        self.relationships: Dict[str, Relationship] = {
            rid: Relationship(**r) for rid, r in data.get("relationships", {}).items()
        }
    
    def _persist(self):
        storage_service.save_graph(self.entities, self.relationships)
    
    # Entity operations
    def get_all_entities(self) -> List[Entity]:
        return list(self.entities.values())
    
    def get_entity(self, entity_id: str) -> Optional[Entity]:
        return self.entities.get(entity_id)
    
    def create_entity(self, entity_data: EntityCreate) -> Entity:
        entity_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()
        
        entity = Entity(
            id=entity_id,
            name=entity_data.name,
            type=entity_data.type,
            description=entity_data.description,
            metadata=entity_data.metadata,
            createdAt=now,
            updatedAt=now
        )
        
        self.entities[entity_id] = entity
        self._persist()
        return entity
    
    def update_entity(self, entity_id: str, updates: EntityUpdate) -> Optional[Entity]:
        entity = self.entities.get(entity_id)
        if not entity:
            return None
        
        update_data = updates.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(entity, field, value)
        
        entity.updatedAt = datetime.utcnow().isoformat()
        self._persist()
        return entity
    
    def delete_entity(self, entity_id: str) -> bool:
        if entity_id not in self.entities:
            return False
        
        # Delete entity
        del self.entities[entity_id]
        
        # Delete related relationships
        to_delete = [
            rel_id for rel_id, rel in self.relationships.items()
            if rel.sourceId == entity_id or rel.targetId == entity_id
        ]
        for rel_id in to_delete:
            del self.relationships[rel_id]
        
        self._persist()
        return True
    
    # Relationship operations
    def get_all_relationships(self) -> List[Relationship]:
        return list(self.relationships.values())
    
    def get_relationship(self, relationship_id: str) -> Optional[Relationship]:
        return self.relationships.get(relationship_id)
    
    def create_relationship(self, rel_data: RelationshipCreate) -> Optional[Relationship]:
        # Validate that source and target entities exist
        if rel_data.sourceId not in self.entities or rel_data.targetId not in self.entities:
            return None
        
        rel_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()
        
        relationship = Relationship(
            id=rel_id,
            sourceId=rel_data.sourceId,
            targetId=rel_data.targetId,
            type=rel_data.type,
            properties=rel_data.properties,
            confidence=rel_data.confidence,
            notes=rel_data.notes,
            createdAt=now
        )
        
        self.relationships[rel_id] = relationship
        self._persist()
        return relationship
    
    def delete_relationship(self, relationship_id: str) -> bool:
        if relationship_id not in self.relationships:
            return False
        
        del self.relationships[relationship_id]
        self._persist()
        return True
    
    # Graph traversal operations (same as before)
    def get_neighbors(self, entity_id: str, depth: int = 1) -> List[str]:
        if entity_id not in self.entities:
            return []
        visited = {entity_id}
        queue = [entity_id]
        for _ in range(depth):
            next_queue = []
            for node in queue:
                for rel in self.relationships.values():
                    if rel.sourceId == node and rel.targetId not in visited:
                        visited.add(rel.targetId)
                        next_queue.append(rel.targetId)
                    elif rel.targetId == node and rel.sourceId not in visited:
                        visited.add(rel.sourceId)
                        next_queue.append(rel.sourceId)
            queue = next_queue
        return list(visited - {entity_id})
    
    def get_subgraph(self, entity_ids: List[str]) -> Dict[str, Any]:
        entity_id_set = set(entity_ids)
        subgraph_entities = [self.entities[eid] for eid in entity_ids if eid in self.entities]
        subgraph_relationships = [
            rel for rel in self.relationships.values()
            if rel.sourceId in entity_id_set and rel.targetId in entity_id_set
        ]
        return {"entities": subgraph_entities, "relationships": subgraph_relationships}

    def clear_graph(self):
        """Clear all entities and relationships"""
        self.entities = {}
        self.relationships = {}
        self._persist()

# Global instance
graph_service = GraphService()
