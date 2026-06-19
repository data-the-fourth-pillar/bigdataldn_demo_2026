import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { useGraphStore } from '../../store/graphStore';
import type { GraphNode, GraphLink, Entity } from '../../types/graph';
import { getCategoryConfig, isDemoEntityType } from '../../constants/categories';
import { getRelationshipDisplay } from '../../utils/relationshipPerspective';
import './GraphCanvas.css';

interface DisplayGraphLink extends GraphLink {
    displayLabel: string;
}

function truncateLabel(text: string, max = 20): string {
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function getEgoNetwork(
    focusId: string | null,
    entities: Entity[],
    relationships: ReturnType<typeof useGraphStore.getState>['relationships']
) {
    const allowed = entities.filter(e => isDemoEntityType(e.type));

    if (!focusId) {
        return { entities: allowed, relationships };
    }

    const neighborIds = new Set<string>([focusId]);
    relationships.forEach(r => {
        if (r.sourceId === focusId) neighborIds.add(r.targetId);
        if (r.targetId === focusId) neighborIds.add(r.sourceId);
    });

    const visibleEntities = allowed.filter(e => neighborIds.has(e.id));
    const visibleIds = new Set(visibleEntities.map(e => e.id));
    const visibleRelationships = relationships.filter(
        r => visibleIds.has(r.sourceId) && visibleIds.has(r.targetId)
    );

    return { entities: visibleEntities, relationships: visibleRelationships };
}

export const GraphCanvas: React.FC = () => {
    const svgRef = useRef<SVGSVGElement>(null);
    const entities = useGraphStore(state => state.entities);
    const relationships = useGraphStore(state => state.relationships);
    const focusEntityId = useGraphStore(state => state.focusEntityId);
    const { selectEntity, selectedEntityId, setFocusEntity, filter, setFilter, clearFilter } = useGraphStore();
    const nodesRef = useRef<GraphNode[]>([]);
    const prevFocusRef = useRef<string | null>(null);

    const { entities: visibleEntities, relationships: visibleRelationships } = useMemo(
        () => getEgoNetwork(focusEntityId, entities, relationships),
        [focusEntityId, entities, relationships]
    );

    const filteredEntities = useMemo(() => {
        let filtered = visibleEntities;
        if (filter.entityTypes && filter.entityTypes.length > 0) {
            filtered = filtered.filter(e =>
                filter.entityTypes!.includes(e.type) ||
                (e.type === 'metadata_technical' && filter.entityTypes!.includes('technology'))
            );
        }
        if (filter.searchQuery) {
            const query = filter.searchQuery.toLowerCase();
            filtered = filtered.filter(e =>
                e.name.toLowerCase().includes(query) ||
                e.description?.toLowerCase().includes(query)
            );
        }
        return filtered;
    }, [visibleEntities, filter]);

    const filteredRelationships = useMemo(() => {
        const entityIds = new Set(filteredEntities.map(e => e.id));
        return visibleRelationships.filter(
            r => entityIds.has(r.sourceId) && entityIds.has(r.targetId)
        );
    }, [visibleRelationships, filteredEntities]);

    const focusEntity = focusEntityId
        ? entities.find(e => e.id === focusEntityId)
        : undefined;

    const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

    useEffect(() => {
        const updateDimensions = () => {
            if (svgRef.current) {
                const { width, height } = svgRef.current.getBoundingClientRect();
                setDimensions({ width, height });
            }
        };
        updateDimensions();
        window.addEventListener('resize', updateDimensions);
        return () => window.removeEventListener('resize', updateDimensions);
    }, []);

    useEffect(() => {
        if (!svgRef.current || filteredEntities.length === 0) {
            return undefined;
        }

        const width = dimensions.width;
        const height = dimensions.height;
        const centerX = width / 2;
        const centerY = height / 2;

        if (prevFocusRef.current !== focusEntityId) {
            nodesRef.current = [];
            prevFocusRef.current = focusEntityId;
        }

        const nodes: GraphNode[] = filteredEntities.map(e => {
            const existing = nodesRef.current.find(n => n.id === e.id);
            return existing
                ? { ...e, x: existing.x, y: existing.y, fx: existing.fx, fy: existing.fy }
                : { ...e };
        });

        const orbitRadius = Math.min(width, height) * 0.34;
        const focusNode = focusEntityId ? nodes.find(n => n.id === focusEntityId) : undefined;
        const neighbors = nodes.filter(n => n.id !== focusEntityId);

        if (focusNode && focusNode.x == null && focusNode.y == null) {
            focusNode.x = centerX;
            focusNode.y = centerY;
        }

        neighbors.forEach((node, index) => {
            if (node.x != null && node.y != null) return;
            const angle = (2 * Math.PI * index) / Math.max(neighbors.length, 1) - Math.PI / 2;
            node.x = centerX + orbitRadius * Math.cos(angle);
            node.y = centerY + orbitRadius * Math.sin(angle);
        });

        if (!focusNode && nodes.length > 0) {
            nodes.forEach((node, index) => {
                if (node.x != null && node.y != null) return;
                const angle = (2 * Math.PI * index) / nodes.length - Math.PI / 2;
                node.x = centerX + orbitRadius * 0.75 * Math.cos(angle);
                node.y = centerY + orbitRadius * 0.75 * Math.sin(angle);
            });
        }

        nodesRef.current = nodes;

        const links: DisplayGraphLink[] = filteredRelationships.map(r => {
            const display = getRelationshipDisplay(r, focusEntityId);
            return {
                ...r,
                source: display.sourceId,
                target: display.targetId,
                displayLabel: display.label,
            };
        });

        d3.select(svgRef.current).selectAll('*').remove();

        const svg = d3.select(svgRef.current);
        const g = svg.append('g');

        const existingTransform = d3.zoomTransform(svg.node() as Element);
        g.attr('transform', existingTransform.toString());

        const zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.1, 4])
            .on('zoom', (event) => {
                g.attr('transform', event.transform);
            });
        svg.call(zoom);

        const labelCollisionRadius = (d: GraphNode) =>
            d.id === focusEntityId ? 78 : 62;

        const simulation = d3.forceSimulation<GraphNode>(nodes)
            .force('link', d3.forceLink<GraphNode, DisplayGraphLink>(links)
                .id(d => d.id)
                .distance(d => {
                    const s = d.source as GraphNode;
                    const t = d.target as GraphNode;
                    if (s.id === focusEntityId || t.id === focusEntityId) return orbitRadius;
                    return 140;
                })
                .strength(0.45))
            .force('charge', d3.forceManyBody().strength(d =>
                (d as GraphNode).id === focusEntityId ? -900 : -520
            ))
            .force('center', d3.forceCenter(centerX, centerY).strength(0.03))
            .force('collision', d3.forceCollide<GraphNode>()
                .radius(labelCollisionRadius)
                .strength(0.95)
                .iterations(3));

        if (focusEntityId) {
            simulation.force('radial', d3.forceRadial<GraphNode>(
                d => d.id === focusEntityId ? 0 : orbitRadius,
                centerX,
                centerY
            ).strength(d => (d.fx != null || d.fy != null) ? 0 : d.id === focusEntityId ? 0 : 0.35));
        }

        svg.append('defs').selectAll('marker')
            .data(['default', 'selected'])
            .join('marker')
            .attr('id', d => `arrow-${d}`)
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', 28)
            .attr('refY', 0)
            .attr('markerWidth', 6)
            .attr('markerHeight', 6)
            .attr('orient', 'auto')
            .append('path')
            .attr('d', 'M0,-5L10,0L0,5')
            .attr('fill', d => d === 'selected' ? 'var(--color-accent-600)' : 'var(--color-gray-400)');

        const link = g.append('g')
            .selectAll('line')
            .data(links)
            .join('line')
            .attr('class', 'graph-link')
            .attr('stroke', 'var(--graph-edge-default)')
            .attr('stroke-opacity', 0.5)
            .attr('stroke-width', 1.5)
            .attr('marker-end', 'url(#arrow-default)');

        const linkLabel = g.append('g')
            .attr('class', 'link-labels')
            .selectAll('g')
            .data(links)
            .join('g')
            .attr('class', 'link-label-group');

        linkLabel.append('rect')
            .attr('class', 'link-label-bg')
            .attr('rx', 4)
            .attr('ry', 4);

        linkLabel.append('text')
            .attr('class', 'link-label')
            .attr('text-anchor', 'middle')
            .attr('dy', '0.35em')
            .text(d => d.displayLabel);

        const node = g.append('g')
            .selectAll('g')
            .data(nodes)
            .join('g')
            .attr('class', d => `graph-node ${d.id === focusEntityId ? 'graph-node-focus' : ''}`)
            .call(d3.drag<SVGGElement, GraphNode>()
                .on('start', dragstarted)
                .on('drag', dragged)
                .on('end', dragended) as any);

        node.each(function (d) {
            const el = d3.select(this);
            const isSelected = d.id === selectedEntityId;
            const isFocus = d.id === focusEntityId;
            const category = getCategoryConfig(d.type);
            const fillColor = category?.color ?? 'var(--graph-node-default)';
            const strokeColor = isFocus
                ? 'var(--color-accent-600)'
                : isSelected
                    ? 'var(--color-accent-500)'
                    : 'white';
            const strokeWidth = isFocus ? 4 : isSelected ? 3 : 2;
            const radius = isFocus ? 32 : 22;

            el.append('circle')
                .attr('r', radius)
                .attr('fill', fillColor)
                .attr('stroke', strokeColor)
                .attr('stroke-width', strokeWidth)
                .on('click', (event) => {
                    event.stopPropagation();
                    selectEntity(d.id);
                })
                .on('dblclick', (event) => {
                    event.stopPropagation();
                    setFocusEntity(d.id);
                });

            const icon = category?.icon ?? '•';
            el.append('text')
                .text(icon)
                .attr('text-anchor', 'middle')
                .attr('dy', 5)
                .attr('font-size', isFocus ? '16px' : '12px')
                .attr('fill', 'white')
                .style('pointer-events', 'none');
        });

        node.append('title').text(d => d.name);

        node.append('text')
            .text(d => truncateLabel(d.name))
            .attr('class', 'node-label')
            .attr('text-anchor', 'middle')
            .attr('dy', d => d.id === focusEntityId ? 46 : 34)
            .attr('fill', 'var(--text-primary)')
            .attr('font-size', d => d.id === focusEntityId ? '13px' : '11px')
            .attr('font-weight', d => d.id === focusEntityId ? '700' : '600');

        node.append('text')
            .text(d => getCategoryConfig(d.type)?.label ?? d.type)
            .attr('class', 'node-type')
            .attr('text-anchor', 'middle')
            .attr('dy', d => d.id === focusEntityId ? 60 : 48)
            .attr('fill', 'var(--text-tertiary)')
            .attr('font-size', '9px');

        simulation.on('tick', () => {
            link
                .attr('x1', d => (d.source as GraphNode).x ?? 0)
                .attr('y1', d => (d.source as GraphNode).y ?? 0)
                .attr('x2', d => (d.target as GraphNode).x ?? 0)
                .attr('y2', d => (d.target as GraphNode).y ?? 0);

            linkLabel.each(function (d) {
                const s = d.source as GraphNode;
                const t = d.target as GraphNode;
                const sx = s.x ?? 0;
                const sy = s.y ?? 0;
                const tx = t.x ?? 0;
                const ty = t.y ?? 0;
                const mx = (sx + tx) / 2;
                const my = (sy + ty) / 2;
                const dx = tx - sx;
                const dy = ty - sy;
                const len = Math.hypot(dx, dy) || 1;
                const offset = 14;
                const lx = mx - (dy / len) * offset;
                const ly = my + (dx / len) * offset;

                const group = d3.select(this);
                group.attr('transform', `translate(${lx},${ly})`);

                const text = group.select('text');
                const rect = group.select('rect');
                const bbox = (text.node() as SVGTextElement)?.getBBox();
                if (bbox) {
                    rect
                        .attr('x', bbox.x - 4)
                        .attr('y', bbox.y - 2)
                        .attr('width', bbox.width + 8)
                        .attr('height', bbox.height + 4);
                }
            });

            node.attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`);
        });

        function dragstarted(event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
        }

        function dragged(event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode) {
            d.fx = event.x;
            d.fy = event.y;
        }

        function dragended(event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode) {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = event.x;
            d.fy = event.y;
        }

        svg.on('click', () => selectEntity(null));
        (svgRef.current as any)._zoom = zoom;

        return () => {
            simulation.stop();
        };
    }, [dimensions, filteredEntities, filteredRelationships, focusEntityId, selectEntity, selectedEntityId, setFocusEntity]);

    const handleManualZoom = (factor: number) => {
        if (!svgRef.current) return;
        const svg = d3.select(svgRef.current);
        const zoom = (svgRef.current as any)._zoom;
        if (zoom) {
            svg.transition().duration(300).call(zoom.scaleBy, factor);
        }
    };

    const focusLabel = focusEntity
        ? `${getCategoryConfig(focusEntity.type)?.label ?? focusEntity.type} in Focus`
        : 'Knowledge Graph';

    return (
        <div className="graph-canvas-container">
            <div className="canvas-top-bar">
                <div className="focus-banner">
                    <span className="focus-banner-label">{focusLabel}</span>
                    <span className="focus-banner-name">{focusEntity?.name ?? 'Select a focus'}</span>
                </div>

                <div className="search-overlay">
                    <div className="floating-search">
                        <span className="search-icon">🔍</span>
                        <input
                            type="text"
                            placeholder="Search entities..."
                            value={filter.searchQuery || ''}
                            onChange={(e) => setFilter({ searchQuery: e.target.value })}
                            className="search-input"
                        />
                        {(filter.searchQuery || (filter.entityTypes && filter.entityTypes.length > 0)) && (
                            <button onClick={clearFilter} className="clear-btn" title="Clear all filters">
                                ✕
                            </button>
                        )}
                    </div>
                </div>

                <div className="canvas-top-bar-spacer" aria-hidden="true" />
            </div>

            <svg ref={svgRef} className="graph-canvas" />

            {filteredEntities.length === 0 && (
                <div className="graph-empty-overlay">
                    <p>No entities to display. Load the demo or create a new entity.</p>
                </div>
            )}

            <div className="graph-controls">
                <button className="zoom-btn" onClick={() => handleManualZoom(1.5)} title="Zoom In">＋</button>
                <button className="zoom-btn" onClick={() => handleManualZoom(0.6)} title="Zoom Out">－</button>
                <div className="control-divider" />
                <button
                    className="zoom-btn"
                    onClick={() => {
                        if (!svgRef.current) return;
                        const svg = d3.select(svgRef.current);
                        const zoom = (svgRef.current as any)._zoom;
                        if (zoom) {
                            svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity);
                        }
                    }}
                    title="Reset Zoom"
                >
                    🎯
                </button>
            </div>

            <div className="graph-hint">Drag to reposition · Double-click to focus · Click to select</div>
        </div>
    );
};
