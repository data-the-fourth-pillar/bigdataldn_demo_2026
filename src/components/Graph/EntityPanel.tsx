import React, { useState, useEffect, useRef } from 'react';
import { useGraphStore } from '../../store/graphStore';
import type { EntityType, RelationshipType } from '../../types/graph';
import { graphApi } from '../../api/graphApi';
import { DEMO_CATEGORIES, DEMO_RELATIONSHIP_TYPES, isDemoEntityType, getCategoryConfig } from '../../constants/categories';
import './EntityPanel.css';

export const EntityPanel: React.FC = () => {
    const {
        entities,
        relationships,
        selectedEntityId,
        addEntity,
        updateEntity,
        deleteEntity,
        addRelationship,
        setFocusEntity,
        selectEntity,
    } = useGraphStore();

    const visibleEntities = entities.filter(e => isDemoEntityType(e.type));
    const selectedEntity = visibleEntities.find(e => e.id === selectedEntityId);
    const [isCollapsed, setIsCollapsed] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const prevEntityIdRef = useRef<string | null | undefined>(undefined);
    const [isAddingRelationship, setIsAddingRelationship] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        type: 'domain' as EntityType,
        description: '',
    });

    const [kpiValue, setKpiValue] = useState<string>('');
    const [kpiUnit, setKpiUnit] = useState<string>('');

    const [relationshipData, setRelationshipData] = useState({
        targetId: '',
        type: 'used_in' as RelationshipType | string,
    });
    const [isCustomType, setIsCustomType] = useState(false);

    useEffect(() => {
        if (selectedEntity) {
            setFormData({
                name: selectedEntity.name,
                type: selectedEntity.type,
                description: selectedEntity.description || '',
            });
            if (selectedEntity.type === 'kpi') {
                setKpiValue(String(selectedEntity.metadata?.value ?? ''));
                setKpiUnit(String(selectedEntity.metadata?.unit ?? ''));
            } else {
                setKpiValue('');
                setKpiUnit('');
            }
            setIsCreating(false);
            // Only expand when the entity selection actually changes (not on initial mount/navigation-back)
            if (prevEntityIdRef.current !== undefined && prevEntityIdRef.current !== selectedEntity.id) {
                setIsCollapsed(false);
            }
            prevEntityIdRef.current = selectedEntity.id;
        } else {
            prevEntityIdRef.current = null;
            setIsCollapsed(true);
        }
    }, [selectedEntity]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            if (selectedEntity) {
                const payload: Record<string, unknown> = { ...formData };
                if (selectedEntity.type === 'kpi') {
                    payload.metadata = {
                        ...(selectedEntity.metadata ?? {}),
                        ...(kpiValue !== '' ? { value: parseFloat(kpiValue) } : {}),
                        ...(kpiUnit !== '' ? { unit: kpiUnit } : {}),
                    };
                }
                const updated = await graphApi.updateEntity(selectedEntity.id, payload);
                updateEntity(selectedEntity.id, updated);
            } else {
                const newEntity = await graphApi.createEntity({
                    ...formData,
                    metadata: {},
                });
                addEntity(newEntity);
                setIsCreating(false);
                setFormData({ name: '', type: 'domain', description: '' });
                setKpiValue('');
                setKpiUnit('');
            }
        } catch (error: any) {
            alert(`Failed to save entity: ${error.response?.data?.detail || error.message}`);
        }
    };

    const handleDelete = async () => {
        if (!selectedEntity) return;
        if (!confirm(`Delete "${selectedEntity.name}"?`)) return;

        try {
            await graphApi.deleteEntity(selectedEntity.id);
            deleteEntity(selectedEntity.id);
            setFocusEntity(entities.find(e => e.type === 'domain')?.id ?? null);
        } catch (error) {
            console.error('Failed to delete entity:', error);
        }
    };

    const handleAddRelationship = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedEntity) return;

        try {
            const newRelationship = await graphApi.createRelationship({
                sourceId: selectedEntity.id,
                targetId: relationshipData.targetId,
                type: relationshipData.type,
            });
            addRelationship(newRelationship);
            setIsAddingRelationship(false);
            setRelationshipData({ targetId: '', type: 'used_in' });
            setIsCustomType(false);
        } catch (error) {
            console.error('Failed to create relationship:', error);
            alert('Failed to create relationship.');
        }
    };

    const availableTargets = visibleEntities.filter(e => e.id !== selectedEntityId);
    const panelTitle = selectedEntity ? selectedEntity.name : isCreating ? 'New Entity' : 'Entity Panel';

    const entityRelationships = selectedEntityId
        ? relationships.filter(r => r.sourceId === selectedEntityId || r.targetId === selectedEntityId)
        : [];
    const entityIndex = Object.fromEntries(entities.map(e => [e.id, e]));

    if (isCollapsed) {
        return (
            <aside className="entity-panel is-collapsed">
                <button
                    type="button"
                    className="panel-expand-tab"
                    onClick={() => setIsCollapsed(false)}
                    title="Expand entity panel"
                >
                    <span className="panel-expand-icon">◀</span>
                    <span className="panel-expand-label">Entity</span>
                </button>
            </aside>
        );
    }

    return (
        <aside className="entity-panel">
            <div className="panel-header">
                <div className="panel-header-title">
                    <h2>{panelTitle}</h2>
                    {selectedEntity && (
                        <span className="panel-entity-type">
                            {getCategoryConfig(selectedEntity.type)?.label ?? selectedEntity.type}
                        </span>
                    )}
                </div>
                <div className="panel-header-actions">
                    {!selectedEntity && !isCreating && (
                        <button
                            type="button"
                            className="btn btn-primary btn-compact"
                            onClick={() => setIsCreating(true)}
                        >
                            + New
                        </button>
                    )}
                    <button
                        type="button"
                        className="panel-collapse-btn"
                        onClick={() => setIsCollapsed(true)}
                        title="Minimize panel"
                    >
                        ▶
                    </button>
                </div>
            </div>

            <div className="panel-body">
                {(selectedEntity || isCreating) ? (
                    <form onSubmit={handleSubmit} className="entity-form">
                        <div className="form-group">
                            <label htmlFor="name">Name</label>
                            <input
                                id="name"
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Entity name"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="type">Category</label>
                            <select
                                id="type"
                                value={formData.type}
                                onChange={(e) => setFormData({ ...formData, type: e.target.value as EntityType })}
                            >
                                {DEMO_CATEGORIES.map(category => (
                                    <option key={category.id} value={category.id}>
                                        {category.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label htmlFor="description">Description</label>
                            <textarea
                                id="description"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Optional description"
                                rows={3}
                            />
                        </div>

                        {(selectedEntity?.type === 'kpi' || (isCreating && formData.type === 'kpi')) && (
                            <>
                                <div className="form-group">
                                    <label htmlFor="kpi-value">Value</label>
                                    <input
                                        id="kpi-value"
                                        type="number"
                                        step="any"
                                        value={kpiValue}
                                        onChange={(e) => setKpiValue(e.target.value)}
                                        placeholder="e.g. 2000000"
                                    />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="kpi-unit">Unit</label>
                                    <input
                                        id="kpi-unit"
                                        type="text"
                                        value={kpiUnit}
                                        onChange={(e) => setKpiUnit(e.target.value)}
                                        placeholder="e.g. GBP"
                                    />
                                </div>
                            </>
                        )}

                        <div className="form-actions">
                            <button type="submit" className="btn btn-primary">
                                {selectedEntity ? 'Save' : 'Create'}
                            </button>
                            {selectedEntity && (
                                <>
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        onClick={() => setFocusEntity(selectedEntity.id)}
                                    >
                                        Focus
                                    </button>
                                    <button type="button" className="btn btn-danger" onClick={handleDelete}>
                                        Delete
                                    </button>
                                </>
                            )}
                            {isCreating && (
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => {
                                        setIsCreating(false);
                                        setFormData({ name: '', type: 'domain', description: '' });
                                        setKpiValue('');
                                        setKpiUnit('');
                                    }}
                                >
                                    Cancel
                                </button>
                            )}
                        </div>
                    </form>
                ) : (
                    <div className="empty-state">
                        <p>Select a node or create a new entity</p>
                        <button
                            type="button"
                            className="btn btn-primary btn-compact"
                            onClick={() => setIsCreating(true)}
                        >
                            + New Entity
                        </button>
                    </div>
                )}

                {selectedEntity && !isAddingRelationship && (
                    <div className="relationships-section">
                        <div className="section-header">
                            <h3>Relationships ({entityRelationships.length})</h3>
                            <button
                                type="button"
                                className="btn btn-sm btn-secondary"
                                onClick={() => setIsAddingRelationship(true)}
                            >
                                + Add
                            </button>
                        </div>
                        {entityRelationships.length === 0 ? (
                            <p className="rel-empty">No relationships yet.</p>
                        ) : (
                            <ul className="rel-list">
                                {entityRelationships.map(r => {
                                    const isOutgoing = r.sourceId === selectedEntityId;
                                    const otherId = isOutgoing ? r.targetId : r.sourceId;
                                    const other = entityIndex[otherId];
                                    if (!other) return null;
                                    const typeLabel = r.type.replace(/_/g, ' ');
                                    const otherTypeLabel = getCategoryConfig(other.type)?.label ?? other.type;
                                    return (
                                        <li key={r.id} className="rel-item">
                                            <span className="rel-direction">{isOutgoing ? '→' : '←'}</span>
                                            <span className="rel-type">{typeLabel}</span>
                                            <button
                                                type="button"
                                                className="rel-target"
                                                onClick={() => selectEntity(other.id)}
                                                title={`Go to ${other.name}`}
                                            >
                                                {other.name}
                                                <span className="rel-target-type">{otherTypeLabel}</span>
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                )}

                {selectedEntity && isAddingRelationship && (
                    <form onSubmit={handleAddRelationship} className="relationship-form">
                        <h3>Add Relationship</h3>

                        <div className="form-group">
                            <label htmlFor="target">Target Entity</label>
                            <select
                                id="target"
                                value={relationshipData.targetId}
                                onChange={(e) => setRelationshipData({ ...relationshipData, targetId: e.target.value })}
                                required
                            >
                                <option value="">Select entity...</option>
                                {availableTargets.map(entity => (
                                    <option key={entity.id} value={entity.id}>
                                        {entity.name} ({DEMO_CATEGORIES.find(c => c.id === entity.type)?.label ?? entity.type})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label htmlFor="rel-type">Relationship Type</label>
                            {!isCustomType ? (
                                <div className="select-with-button">
                                    <select
                                        id="rel-type"
                                        value={relationshipData.type}
                                        onChange={(e) => setRelationshipData({ ...relationshipData, type: e.target.value })}
                                    >
                                        {DEMO_RELATIONSHIP_TYPES.map(type => (
                                            <option key={type} value={type}>
                                                {type.replace(/_/g, ' ')}
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline"
                                        onClick={() => setIsCustomType(true)}
                                    >
                                        Custom
                                    </button>
                                </div>
                            ) : (
                                <div className="select-with-button">
                                    <input
                                        type="text"
                                        value={relationshipData.type}
                                        onChange={(e) => setRelationshipData({ ...relationshipData, type: e.target.value })}
                                        placeholder="Enter custom type..."
                                        required
                                        autoFocus
                                    />
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline"
                                        onClick={() => {
                                            setIsCustomType(false);
                                            setRelationshipData({ ...relationshipData, type: 'used_in' });
                                        }}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="form-actions">
                            <button type="submit" className="btn btn-primary">Create</button>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => {
                                    setIsAddingRelationship(false);
                                    setRelationshipData({ targetId: '', type: 'used_in' });
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </aside>
    );
};
