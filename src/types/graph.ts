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

export type EntityType =
    | 'domain'
    | 'data_product'
    | 'process'
    | 'person'
    | 'technology'
    | 'ai_agent'
    | 'metadata_technical'
    | 'product_category'
    | 'region'
    | 'supply_chain_node'
    | 'marketing_channel'
    | 'kpi'
    | 'legal_entity'
    | 'finance_entity'
    | 'policy'
    | string;
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
    /** When set, scopes the graph to exactly this entity ID set (e.g. a chat response's used context) */
    entityIds?: string[];
}
