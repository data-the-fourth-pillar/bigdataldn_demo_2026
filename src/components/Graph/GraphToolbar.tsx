import React, { useRef } from 'react';
import { graphApi } from '../../api/graphApi';
import { useGraphStore } from '../../store/graphStore';
import { DEMO_CATEGORIES, isDemoEntityType } from '../../constants/categories';
import './GraphToolbar.css';

export const GraphToolbar: React.FC = () => {
    const {
        entities,
        focusEntityId,
        setEntities,
        setRelationships,
        setFocusEntity,
        filter,
        setFilter,
        clearFilter,
        selectEntity,
    } = useGraphStore();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const demoEntities = entities.filter(e => isDemoEntityType(e.type));

    const handleExport = async () => {
        try {
            const data = await graphApi.exportGraph();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `knowledge-graph-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Export failed:', error);
            alert('Export failed');
        }
    };

    const handleImportClick = () => fileInputRef.current?.click();

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const json = JSON.parse(e.target?.result as string);
                const result = await graphApi.importGraph(json);
                const data = await graphApi.getGraphData();
                setEntities(data.entities);
                setRelationships(data.relationships);
                clearFilter();
                selectEntity(null);
                const defaultDomain = data.entities.find(ent => ent.type === 'domain');
                setFocusEntity(defaultDomain?.id ?? null);
                alert(`Graph imported (${result.entities} entities, ${result.relationships} relationships)`);
            } catch (error: any) {
                alert(`Import failed: ${error.response?.data?.detail || error.message}`);
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    };

    const handleReset = async () => {
        if (!confirm('Clear the entire graph? This cannot be undone.')) return;
        try {
            await graphApi.resetGraph();
            setEntities([]);
            setRelationships([]);
            setFocusEntity(null);
        } catch (error) {
            console.error('Reset failed:', error);
        }
    };

    const handleReloadDemo = async () => {
        try {
            await graphApi.seedMdsD2c();
            const data = await graphApi.getGraphData();
            setEntities(data.entities);
            setRelationships(data.relationships);
            clearFilter();
            const defaultCategory = data.entities.find(e => e.type === 'product_category' || e.type === 'domain');
            setFocusEntity(defaultCategory?.id ?? null);
        } catch (error) {
            console.error('Demo reload failed:', error);
        }
    };

    const toggleEntityType = (typeId: string) => {
        const currentTypes = filter.entityTypes || [];
        const newTypes = currentTypes.includes(typeId)
            ? currentTypes.filter(t => t !== typeId)
            : [...currentTypes, typeId];
        setFilter({ entityTypes: newTypes.length > 0 ? newTypes : undefined });
    };

    const scrollRef = useRef<HTMLDivElement>(null);
    const scrollFilters = (direction: 'left' | 'right') => {
        scrollRef.current?.scrollBy({ left: direction === 'left' ? -200 : 200, behavior: 'smooth' });
    };

    return (
        <div className="graph-toolbar">
            <div className="toolbar-left">
                <div className="focus-picker">
                    <label htmlFor="focus-select">Focus</label>
                    <select
                        id="focus-select"
                        value={focusEntityId ?? ''}
                        onChange={(e) => setFocusEntity(e.target.value || null)}
                    >
                        <option value="" disabled>Select entity...</option>
                        {DEMO_CATEGORIES.map(category => {
                            const categoryEntities = demoEntities.filter(e =>
                                e.type === category.id ||
                                (category.id === 'technology' && e.type === 'metadata_technical')
                            );
                            if (categoryEntities.length === 0) return null;
                            return (
                                <optgroup key={category.id} label={category.label}>
                                    {categoryEntities.map(entity => (
                                        <option key={entity.id} value={entity.id}>
                                            {entity.name}
                                        </option>
                                    ))}
                                </optgroup>
                            );
                        })}
                    </select>
                </div>
            </div>

            <div className="toolbar-center">
                <div className="filter-navigation">
                    <button className="scroll-arrow" onClick={() => scrollFilters('left')}>◀</button>
                    <div className="type-filters" ref={scrollRef}>
                        {DEMO_CATEGORIES.map(type => (
                            <label
                                key={type.id}
                                className={`type-filter-chip ${filter.entityTypes?.includes(type.id) ? 'active' : ''}`}
                                title={`Toggle ${type.label}`}
                            >
                                <input
                                    type="checkbox"
                                    checked={filter.entityTypes?.includes(type.id) || false}
                                    onChange={() => toggleEntityType(type.id)}
                                />
                                <span className="type-icon">{type.icon}</span>
                                <span className="type-label">{type.label}</span>
                            </label>
                        ))}
                    </div>
                    <button className="scroll-arrow" onClick={() => scrollFilters('right')}>▶</button>
                </div>
            </div>

            <div className="toolbar-right">
                <button onClick={handleReloadDemo} className="btn-icon" title="Reload Demo Data">
                    <span>🌱</span>
                    <label>Reload Demo</label>
                </button>
                <div className="divider" />
                <button onClick={handleExport} className="btn-icon" title="Export JSON">
                    <span>📤</span>
                </button>
                <button onClick={handleImportClick} className="btn-icon" title="Import JSON">
                    <span>📥</span>
                </button>
                <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    accept=".json"
                    onChange={handleFileChange}
                />
                <button onClick={handleReset} className="btn-icon btn-danger-icon" title="Reset Graph">
                    <span>🗑️</span>
                </button>
            </div>
        </div>
    );
};
