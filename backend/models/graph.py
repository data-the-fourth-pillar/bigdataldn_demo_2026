from pydantic import BaseModel
from typing import Dict, Any, Optional
from datetime import datetime

class EntityBase(BaseModel):
    name: str
    type: str
    description: Optional[str] = None
    metadata: Dict[str, Any] = {}

class EntityCreate(EntityBase):
    pass

class EntityUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    description: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

class Entity(EntityBase):
    id: str
    createdAt: str
    updatedAt: str

    model_config = {
        "from_attributes": True,
        "extra": "ignore"
    }

class RelationshipBase(BaseModel):
    sourceId: str
    targetId: str
    type: str
    properties: Optional[Dict[str, Any]] = None
    confidence: Optional[float] = None
    notes: Optional[str] = None

class RelationshipCreate(RelationshipBase):
    pass

class Relationship(RelationshipBase):
    id: str
    createdAt: str

    model_config = {
        "from_attributes": True,
        "extra": "ignore"
    }

class GraphData(BaseModel):
    entities: list[Entity]
    relationships: list[Relationship]
