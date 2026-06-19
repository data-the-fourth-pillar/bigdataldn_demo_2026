export interface Entity {
    id: string;
    name: string;
    type: EntityType;
    description?: string;
    metadata: Record<string, any>;
    createdAt: string;
    updatedAt: string;
}

export interface Relationship {
    id: string;
    sourceId: string;
    targetId: string;
    type: RelationshipType;
    properties?: Record<string, any>;
    confidence?: number;
    notes?: string;
    createdAt: string;
}

export type EntityType = string;
export type RelationshipType = string;

export interface GraphData {
    entities: Entity[];
    relationships: Relationship[];
}

export interface GraphNode extends Entity {
    x?: number;
    y?: number;
    fx?: number | null;
    fy?: number | null;
}

export interface GraphLink extends Relationship {
    source: string | GraphNode;
    target: string | GraphNode;
}

export interface GraphFilter {
    entityTypes?: EntityType[];
    relationshipTypes?: RelationshipType[];
    searchQuery?: string;
}
