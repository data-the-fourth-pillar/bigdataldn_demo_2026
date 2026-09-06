import React, { useMemo } from 'react';
import * as d3 from 'd3';
import { useNavigate } from 'react-router-dom';
import { useGraphStore } from '../../store/graphStore';
import { getCategoryConfig } from '../../constants/categories';
import type { GraphNode, GraphLink } from '../../types/graph';
import './ContextGraphPanel.css';

interface ContextGraphPanelProps {
    entityIds: string[];
    relationshipIds: string[];
}

const NODE_RADIUS = 16;
const PADDING = 40;

function layoutGraph(entityIds: string[], relationshipIds: string[], allEntities: GraphNode[], allRelationships: GraphLink[]) {
    const idSet = new Set(entityIds);
    const nodes: GraphNode[] = allEntities
        .filter(e => idSet.has(e.id))
        .map(e => ({ ...e }));

    const nodeIds = new Set(nodes.map(n => n.id));
    const links: GraphLink[] = allRelationships
        .filter(r => relationshipIds.includes(r.id) && nodeIds.has(r.sourceId) && nodeIds.has(r.targetId))
        .map(r => ({ ...r, source: r.sourceId, target: r.targetId }));

    if (nodes.length === 0) return { nodes: [], links: [], viewBox: '0 0 100 100' };

    const simulation = d3.forceSimulation<GraphNode>(nodes)
        .force('link', d3.forceLink<GraphNode, GraphLink>(links).id(d => d.id).distance(70).strength(0.6))
        .force('charge', d3.forceManyBody().strength(-140))
        .force('center', d3.forceCenter(0, 0))
        .force('collision', d3.forceCollide<GraphNode>().radius(NODE_RADIUS + 24))
        .stop();

    for (let i = 0; i < 250; i++) simulation.tick();

    const xs = nodes.map(n => n.x ?? 0);
    const ys = nodes.map(n => n.y ?? 0);
    const minX = Math.min(...xs) - PADDING;
    const maxX = Math.max(...xs) + PADDING;
    const minY = Math.min(...ys) - PADDING;
    const maxY = Math.max(...ys) + PADDING;
    const width = Math.max(maxX - minX, 120);
    const height = Math.max(maxY - minY, 120);

    return { nodes, links, viewBox: `${minX} ${minY} ${width} ${height}` };
}

export const ContextGraphPanel: React.FC<ContextGraphPanelProps> = ({ entityIds, relationshipIds }) => {
    const { entities, relationships, setFocusEntity, setFilter, selectEntity } = useGraphStore();
    const navigate = useNavigate();

    const { nodes, links, viewBox } = useMemo(
        () => layoutGraph(entityIds, relationshipIds, entities as GraphNode[], relationships as GraphLink[]),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [entityIds.join(','), relationshipIds.join(','), entities, relationships]
    );

    if (nodes.length === 0) return null;

    const handleNodeClick = (id: string) => {
        setFocusEntity(null);
        setFilter({ entityIds });
        selectEntity(id);
        navigate('/graph');
    };

    return (
        <div className="context-graph-panel">
            <svg className="context-graph-svg" viewBox={viewBox} preserveAspectRatio="xMidYMid meet">
                <g>
                    {links.map(link => {
                        const s = link.source as GraphNode;
                        const t = link.target as GraphNode;
                        return (
                            <line
                                key={link.id}
                                x1={s.x ?? 0}
                                y1={s.y ?? 0}
                                x2={t.x ?? 0}
                                y2={t.y ?? 0}
                                className="context-graph-edge"
                            />
                        );
                    })}
                </g>
                <g>
                    {nodes.map(node => {
                        const category = getCategoryConfig(node.type);
                        return (
                            <g
                                key={node.id}
                                transform={`translate(${node.x ?? 0},${node.y ?? 0})`}
                                className="context-graph-node"
                                onClick={() => handleNodeClick(node.id)}
                            >
                                <title>{node.name}</title>
                                <circle r={NODE_RADIUS} fill={category?.color ?? 'var(--graph-node-default)'} stroke="white" strokeWidth={1.5} />
                                <text textAnchor="middle" dy={5} fontSize={13} fill="white" style={{ pointerEvents: 'none' }}>
                                    {category?.icon ?? '•'}
                                </text>
                                <text textAnchor="middle" dy={NODE_RADIUS + 13} fontSize={9} className="context-graph-label">
                                    {node.name.length > 18 ? `${node.name.slice(0, 17)}…` : node.name}
                                </text>
                            </g>
                        );
                    })}
                </g>
            </svg>
        </div>
    );
};
