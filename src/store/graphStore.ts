import { create } from 'zustand';
import type { Entity, Relationship, GraphData, GraphFilter } from '../types/graph';

interface GraphState {
    entities: Entity[];
    relationships: Relationship[];
    selectedEntityId: string | null;
    selectedRelationshipId: string | null;
    focusEntityId: string | null;
    filter: GraphFilter;

    // Actions
    setEntities: (entities: Entity[]) => void;
    addEntity: (entity: Entity) => void;
    updateEntity: (id: string, updates: Partial<Entity>) => void;
    deleteEntity: (id: string) => void;

    setRelationships: (relationships: Relationship[]) => void;
    addRelationship: (relationship: Relationship) => void;
    deleteRelationship: (id: string) => void;

    selectEntity: (id: string | null) => void;
    selectRelationship: (id: string | null) => void;
    setFocusEntity: (id: string | null) => void;

    setFilter: (filter: Partial<GraphFilter>) => void;
    clearFilter: () => void;

    getFilteredData: () => GraphData;
}

export const useGraphStore = create<GraphState>((set, get) => ({
    entities: [],
    relationships: [],
    selectedEntityId: null,
    selectedRelationshipId: null,
    focusEntityId: null,
    filter: {},

    setEntities: (entities) => set({ entities }),

    addEntity: (entity) => {
        console.log('Store: Adding entity to state:', entity);
        set((state) => ({
            entities: [...state.entities, entity]
        }));
    },

    updateEntity: (id, updates) => set((state) => ({
        entities: state.entities.map(e =>
            e.id === id ? { ...e, ...updates, updatedAt: new Date().toISOString() } : e
        )
    })),

    deleteEntity: (id) => set((state) => ({
        entities: state.entities.filter(e => e.id !== id),
        relationships: state.relationships.filter(r =>
            r.sourceId !== id && r.targetId !== id
        ),
        selectedEntityId: state.selectedEntityId === id ? null : state.selectedEntityId
    })),

    setRelationships: (relationships) => set({ relationships }),

    addRelationship: (relationship) => {
        console.log('Store: Adding relationship to state:', relationship);
        set((state) => ({
            relationships: [...state.relationships, relationship]
        }));
    },

    deleteRelationship: (id) => set((state) => ({
        relationships: state.relationships.filter(r => r.id !== id),
        selectedRelationshipId: state.selectedRelationshipId === id ? null : state.selectedRelationshipId
    })),

    selectEntity: (id) => set({ selectedEntityId: id, selectedRelationshipId: null }),

    selectRelationship: (id) => set({ selectedRelationshipId: id, selectedEntityId: null }),

    setFocusEntity: (id) => set({ focusEntityId: id, selectedEntityId: id }),

    setFilter: (filter) => set((state) => ({
        filter: { ...state.filter, ...filter }
    })),

    clearFilter: () => set({ filter: {} }),

    getFilteredData: () => {
        const state = get();
        let filteredEntities = state.entities;
        let filteredRelationships = state.relationships;

        // Filter by entity types
        if (state.filter.entityTypes && state.filter.entityTypes.length > 0) {
            filteredEntities = filteredEntities.filter(e =>
                state.filter.entityTypes!.includes(e.type)
            );
        }

        // Filter by search query
        if (state.filter.searchQuery) {
            const query = state.filter.searchQuery.toLowerCase();
            filteredEntities = filteredEntities.filter(e =>
                e.name.toLowerCase().includes(query) ||
                e.description?.toLowerCase().includes(query)
            );
        }

        // Filter relationships to only include those between visible entities
        const entityIds = new Set(filteredEntities.map(e => e.id));
        filteredRelationships = filteredRelationships.filter(r =>
            entityIds.has(r.sourceId) && entityIds.has(r.targetId)
        );

        // Filter by relationship types
        if (state.filter.relationshipTypes && state.filter.relationshipTypes.length > 0) {
            filteredRelationships = filteredRelationships.filter(r =>
                state.filter.relationshipTypes!.includes(r.type)
            );
        }

        return {
            entities: filteredEntities,
            relationships: filteredRelationships
        };
    }
}));
