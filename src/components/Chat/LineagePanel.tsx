import React from 'react';
import { useGraphStore } from '../../store/graphStore';
import { getCategoryConfig } from '../../constants/categories';
import './LineagePanel.css';

interface LineagePanelProps {
    entityIds: string[];
    relationshipIds: string[];
}

export const LineagePanel: React.FC<LineagePanelProps> = ({ entityIds, relationshipIds }) => {
    const { entities, relationships } = useGraphStore();

    const usedEntities = entities.filter(e => entityIds.includes(e.id));
    const usedRelationships = relationships.filter(r => relationshipIds.includes(r.id));

    if (!usedEntities.length) return null;

    const byType = usedEntities.reduce<Record<string, string[]>>((acc, e) => {
        const label = getCategoryConfig(e.type)?.label ?? e.type.replace(/_/g, ' ');
        if (!acc[label]) acc[label] = [];
        acc[label].push(e.name);
        return acc;
    }, {});

    const relTypes = [...new Set(usedRelationships.map(r => r.type.replace(/_/g, ' ')))];
    const domainCount = Object.keys(byType).length;

    return (
        <div className="lineage-panel">
            <div className="lineage-header">
                <span className="lineage-icon">🔗</span>
                <span className="lineage-title">Lineage</span>
                <span className="lineage-governance">
                    Grounded in <strong>{usedEntities.length}</strong> nodes across <strong>{domainCount}</strong> domain {domainCount === 1 ? 'type' : 'types'} · Source: MDS D2C EKG
                </span>
            </div>

            <div className="lineage-body">
                <div className="lineage-entities">
                    {Object.entries(byType).map(([typeLabel, names]) => (
                        <div key={typeLabel} className="lineage-type-row">
                            <span className="lineage-type-label">{typeLabel}</span>
                            <span className="lineage-type-count">{names.length}</span>
                            <span className="lineage-entity-names">{names.join(' · ')}</span>
                        </div>
                    ))}
                </div>

                {relTypes.length > 0 && (
                    <div className="lineage-relationships">
                        <span className="lineage-rel-label">Traversed relationships:</span>
                        <div className="lineage-rel-chips">
                            {relTypes.map(t => (
                                <span key={t} className="lineage-rel-chip">{t}</span>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
