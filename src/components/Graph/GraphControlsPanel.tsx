import React, { useMemo } from 'react';
import { useGraphStore } from '../../store/graphStore';
import { DEMO_CATEGORIES, isDemoEntityType } from '../../constants/categories';
import './GraphControlsPanel.css';

export const GraphControlsPanel: React.FC = () => {
    const {
        entities,
        relationships,
        focusEntityId,
        setFocusEntity,
        filter,
        setFilter,
    } = useGraphStore();

    const demoEntities = entities.filter(e => isDemoEntityType(e.type));

    const visibleEntityTypes = useMemo(() => {
        if (!focusEntityId) {
            return new Set(demoEntities.map(e => e.type));
        }
        const neighborIds = new Set<string>([focusEntityId]);
        relationships.forEach(r => {
            if (r.sourceId === focusEntityId) neighborIds.add(r.targetId);
            if (r.targetId === focusEntityId) neighborIds.add(r.sourceId);
        });
        return new Set(demoEntities.filter(e => neighborIds.has(e.id)).map(e => e.type));
    }, [focusEntityId, demoEntities, relationships]);

    const toggleEntityType = (typeId: string) => {
        const current = filter.entityTypes || [];
        const next = current.includes(typeId)
            ? current.filter(t => t !== typeId)
            : [...current, typeId];
        setFilter({ entityTypes: next.length > 0 ? next : undefined });
    };

    return (
        <div className="graph-controls-panel">
            <div className="gc-section">
                <span className="gc-label">Focus</span>
                <select
                    className="gc-focus-select"
                    value={focusEntityId ?? ''}
                    onChange={e => setFocusEntity(e.target.value || null)}
                >
                    <option value="">All</option>
                    {DEMO_CATEGORIES.map(category => {
                        const cats = demoEntities.filter(e =>
                            e.type === category.id ||
                            (category.id === 'technology' && e.type === 'metadata_technical')
                        );
                        if (cats.length === 0) return null;
                        return (
                            <optgroup key={category.id} label={category.label}>
                                {cats.map(entity => (
                                    <option key={entity.id} value={entity.id}>
                                        {entity.name}
                                    </option>
                                ))}
                            </optgroup>
                        );
                    })}
                </select>
            </div>

            <div className="gc-section">
                <div className="gc-label-row">
                    <span className="gc-label">Filter by Type</span>
                    {filter.entityTypes && filter.entityTypes.length > 0 && (
                        <button
                            type="button"
                            className="gc-clear-btn"
                            onClick={() => setFilter({ entityTypes: undefined })}
                        >
                            Clear all
                        </button>
                    )}
                </div>
                <div className="gc-chips">
                    {[...DEMO_CATEGORIES]
                        .filter(t => visibleEntityTypes.has(t.id))
                        .sort((a, b) => a.label.localeCompare(b.label))
                        .map(type => (
                        <label
                                key={type.id}
                                className={`gc-chip ${filter.entityTypes?.includes(type.id) ? 'active' : ''}`}
                                title={`Toggle ${type.label}`}
                            >
                                <input
                                    type="checkbox"
                                    checked={filter.entityTypes?.includes(type.id) || false}
                                    onChange={() => toggleEntityType(type.id)}
                                />
                                <span>{type.icon}</span>
                                <span>{type.label}</span>
                            </label>
                        ))}
                </div>
            </div>
        </div>
    );
};
