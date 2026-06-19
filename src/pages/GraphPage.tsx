import React, { useEffect } from 'react';
import { GraphCanvas } from '../components/Graph/GraphCanvas';
import { EntityPanel } from '../components/Graph/EntityPanel';
import { useGraphStore } from '../store/graphStore';
import { graphApi } from '../api/graphApi';
import { DEMO_GRAPH, DEMO_DOMAIN_ID } from '../data/demoGraph';
import { GraphToolbar } from '../components/Graph/GraphToolbar';
import './GraphPage.css';

async function seedDemoLocally(
    setEntities: (entities: typeof DEMO_GRAPH.entities) => void,
    setRelationships: (relationships: typeof DEMO_GRAPH.relationships) => void,
    setFocusEntity: (id: string) => void
) {
    setEntities(DEMO_GRAPH.entities);
    setRelationships(DEMO_GRAPH.relationships);
    setFocusEntity(DEMO_DOMAIN_ID);
}

export const GraphPage: React.FC = () => {
    const { setEntities, setRelationships, setFocusEntity } = useGraphStore();

    useEffect(() => {
        loadGraphData();
    }, []);

    const loadGraphData = async () => {
        try {
            let data = await graphApi.getGraphData();

            if (data.entities.length === 0) {
                try {
                    await graphApi.seedDemo();
                    data = await graphApi.getGraphData();
                } catch {
                    await seedDemoLocally(setEntities, setRelationships, setFocusEntity);
                    return;
                }
            }

            setEntities(data.entities);
            setRelationships(data.relationships);

            const defaultDomain = data.entities.find(e => e.type === 'domain');
            setFocusEntity(defaultDomain?.id ?? DEMO_DOMAIN_ID);
        } catch (error) {
            console.error('Failed to load graph data, using local demo:', error);
            await seedDemoLocally(setEntities, setRelationships, setFocusEntity);
        }
    };

    return (
        <div className="graph-page">
            <GraphToolbar />
            <div className="graph-content">
                <GraphCanvas />
                <EntityPanel />
            </div>
        </div>
    );
};
