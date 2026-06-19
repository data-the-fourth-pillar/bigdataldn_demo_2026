import type { Relationship } from '../types/graph';

export interface PerspectiveConfig {
    label: string;
    direction: 'out' | 'in';
}

export interface RelationshipDisplay {
    sourceId: string;
    targetId: string;
    label: string;
}

export function getRelationshipDisplay(
    rel: Relationship,
    focusId: string | null
): RelationshipDisplay {
    if (focusId) {
        const perspectives = rel.properties?.perspectives as
            | Record<string, PerspectiveConfig>
            | undefined;
        const perspective = perspectives?.[focusId];

        if (perspective) {
            const neighborId = focusId === rel.sourceId ? rel.targetId : rel.sourceId;

            if (perspective.direction === 'out') {
                return {
                    sourceId: focusId,
                    targetId: neighborId,
                    label: perspective.label,
                };
            }

            return {
                sourceId: neighborId,
                targetId: focusId,
                label: perspective.label,
            };
        }
    }

    return {
        sourceId: rel.sourceId,
        targetId: rel.targetId,
        label: rel.type.replace(/_/g, ' '),
    };
}
