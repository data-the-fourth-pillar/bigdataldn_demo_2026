import React, { useRef } from 'react';
import { graphApi } from '../../api/graphApi';
import { useGraphStore } from '../../store/graphStore';
import './GraphActions.css';

export const GraphActions: React.FC = () => {
    const { setEntities, setRelationships, setFocusEntity, clearFilter, selectEntity } = useGraphStore();
    const fileInputRef = useRef<HTMLInputElement>(null);

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
        } catch {
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
                alert(`Imported ${result.entities} entities, ${result.relationships} relationships`);
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
        } catch {
            console.error('Reset failed');
        }
    };

    const handleReloadDemo = async () => {
        try {
            await graphApi.seedMdsD2c();
            const data = await graphApi.getGraphData();
            setEntities(data.entities);
            setRelationships(data.relationships);
            clearFilter();
            setFocusEntity(null);
        } catch {
            console.error('Demo reload failed');
        }
    };

    return (
        <div className="graph-actions">
            <button onClick={handleReloadDemo} className="ga-btn" title="Reload Demo Data">
                🌱 Reload Demo
            </button>
            <div className="ga-divider" />
            <button onClick={handleExport} className="ga-btn" title="Export JSON">📤</button>
            <button onClick={handleImportClick} className="ga-btn" title="Import JSON">📥</button>
            <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept=".json" onChange={handleFileChange} />
            <button onClick={handleReset} className="ga-btn ga-btn-danger" title="Reset Graph">🗑️</button>
        </div>
    );
};
