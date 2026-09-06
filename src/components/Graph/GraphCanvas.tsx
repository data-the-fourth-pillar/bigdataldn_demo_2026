import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { useGraphStore } from '../../store/graphStore';
import { useChatStore } from '../../store/chatStore';
import type { GraphNode, GraphLink, Entity } from '../../types/graph';
import { getCategoryConfig, isDemoEntityType, OPERATING_PILLAR_TYPES } from '../../constants/categories';
import { getRelationshipDisplay } from '../../utils/relationshipPerspective';
import './GraphCanvas.css';

interface DisplayGraphLink extends GraphLink {
    displayLabel: string;
}

function truncateLabel(text: string, max = 20): string {
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function getNodeRadius(node: GraphNode, focusEntityId: string | null): number {
    if (node.id === focusEntityId) return 38;
    if (OPERATING_PILLAR_TYPES.includes(node.type as typeof OPERATING_PILLAR_TYPES[number])) return 32;
    return 26;
}

function getNodeFillColor(node: GraphNode, personaLens: string): string {
    if (personaLens === 'vp_supply_chain' && node.type === 'supply_chain_node') {
        const status = node.metadata?.d2c_status;
        if (status === 'ready')   return '#22c55e';
        if (status === 'blocker') return '#ef4444';
        if (status === 'partial') return '#f59e0b';
    }
    return getCategoryConfig(node.type)?.color ?? 'var(--graph-node-default)';
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
    const { selectedEntityId, setFocusEntity, filter } = useGraphStore();

    const personaLens = useChatStore(state => state.personaLens);
    const highlightedEntities = useChatStore(state => state.highlightedEntities);
    const highlightedRelationships = useChatStore(state => state.highlightedRelationships);

    const nodesRef = useRef<GraphNode[]>([]);
    const overviewLayoutRef = useRef<Map<string, { x: number; y: number }>>(new Map());
    const prevDimensionsRef = useRef({ width: 0, height: 0 });
    const prevFilterKeyRef = useRef<string>('');
    const fitRef = useRef<(animated?: boolean) => void>(() => {});
    const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

    const { entities: visibleEntities, relationships: visibleRelationships } = useMemo(
        () => getEgoNetwork(focusEntityId, entities, relationships),
        [focusEntityId, entities, relationships]
    );

    const filteredEntities = useMemo(() => {
        let filtered = visibleEntities;
        if (filter.entityIds && filter.entityIds.length > 0) {
            const scopedIds = new Set(filter.entityIds);
            filtered = filtered.filter(e => scopedIds.has(e.id));
        }
        if (filter.entityTypes !== undefined) {
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

    const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

    useEffect(() => {
        if (!svgRef.current) return;
        const observer = new ResizeObserver(entries => {
            const entry = entries[0];
            if (entry) {
                const { width, height } = entry.contentRect;
                setDimensions({ width, height });
                // Re-fit whenever the canvas resizes (e.g. right panel open/close)
                fitRef.current(false);
            }
        });
        observer.observe(svgRef.current);
        return () => observer.disconnect();
    }, []);

    // 1. Structural Effect: rebuilds graph nodes/links and force simulation
    useEffect(() => {
        if (!svgRef.current) {
            return undefined;
        }

        if (filteredEntities.length === 0) {
            d3.select(svgRef.current).selectAll('*').remove();
            nodesRef.current = [];
            return undefined;
        }

        const width = dimensions.width;
        const height = dimensions.height;
        const centerX = width / 2;
        const centerY = height / 2;

        if (prevDimensionsRef.current.width !== width || prevDimensionsRef.current.height !== height) {
            nodesRef.current = [];
            prevDimensionsRef.current = { width, height };
        }

        const filterKey = JSON.stringify([...(filter.entityTypes ?? [])].sort()) + '|' + (filter.searchQuery ?? '')
            + '|' + JSON.stringify([...(filter.entityIds ?? [])].sort());
        if (prevFilterKeyRef.current !== filterKey) {
            nodesRef.current = [];
            prevFilterKeyRef.current = filterKey;
        }

        const isUnfiltered = filter.entityTypes === undefined && !filter.searchQuery
            && !(filter.entityIds && filter.entityIds.length > 0);

        const nodes: GraphNode[] = filteredEntities.map(e => {
            const existing = nodesRef.current.find(n => n.id === e.id);
            if (existing) {
                return { ...e, x: existing.x, y: existing.y, fx: existing.fx, fy: existing.fy };
            }
            if (!focusEntityId && isUnfiltered) {
                const cached = overviewLayoutRef.current.get(e.id);
                if (cached) {
                    return { ...e, x: cached.x, y: cached.y };
                }
            }
            return { ...e };
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
            getNodeRadius(d, focusEntityId) + (d.id === focusEntityId ? 46 : 40);

        const fitToContent = (animated = true) => {
            if (!svgRef.current || nodesRef.current.length === 0) return;
            const svgEl = d3.select(svgRef.current);
            const zoomBehavior = zoomRef.current;
            if (!zoomBehavior) return;
            const pad = 70;
            const xs = nodesRef.current.map(n => n.x ?? 0);
            const ys = nodesRef.current.map(n => n.y ?? 0);
            const minX = Math.min(...xs) - pad;
            const maxX = Math.max(...xs) + pad;
            const minY = Math.min(...ys) - pad;
            const maxY = Math.max(...ys) + pad;
            const scale = Math.min(1.0, Math.min(width / (maxX - minX), height / (maxY - minY)));
            const tx = (width - scale * (minX + maxX)) / 2;
            const ty = (height - scale * (minY + maxY)) / 2;
            const t = d3.zoomIdentity.translate(tx, ty).scale(scale);
            (animated ? svgEl.transition().duration(600) : svgEl).call(zoomBehavior.transform, t);
        };
        fitRef.current = fitToContent;

        const simulation = d3.forceSimulation<GraphNode>(nodes)
            .alphaDecay(0.08)
            .force('link', d3.forceLink<GraphNode, DisplayGraphLink>(links)
                .id(d => d.id)
                .distance(d => {
                    const s = d.source as GraphNode;
                    const t = d.target as GraphNode;
                    if (s.id === focusEntityId || t.id === focusEntityId) return orbitRadius;
                    return 100;
                })
                .strength(0.45))
            .force('charge', d3.forceManyBody().strength(d =>
                (d as GraphNode).id === focusEntityId ? -600 : -280
            ))
            .force('center', d3.forceCenter(centerX, centerY).strength(0.08))
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
            .selectAll<SVGGElement, GraphNode>('g')
            .data(nodes)
            .join('g')
            .attr('class', d => `graph-node ${d.id === focusEntityId ? 'graph-node-focus' : ''}`)
            .call(d3.drag<SVGGElement, GraphNode>()
                .on('start', dragstarted)
                .on('drag', dragged)
                .on('end', dragended));

        node.each(function (d) {
            const el = d3.select(this);
            const isSelected = d.id === selectedEntityId;
            const isFocus = d.id === focusEntityId;
            const category = getCategoryConfig(d.type);
            const fillColor = getNodeFillColor(d, personaLens);
            const strokeColor = isFocus
                ? 'var(--color-accent-600)'
                : isSelected
                    ? 'var(--color-accent-500)'
                    : 'white';
            const strokeWidth = isFocus ? 4 : isSelected ? 3 : 2;
            const radius = getNodeRadius(d, focusEntityId);
            const iconFontSize = radius * 1.15;

            el.append('circle')
                .attr('r', radius)
                .attr('fill', fillColor)
                .attr('stroke', strokeColor)
                .attr('stroke-width', strokeWidth)
                .on('click', (event) => {
                    event.stopPropagation();
                    setFocusEntity(d.id);
                });

            const icon = category?.icon ?? '•';
            el.append('text')
                .text(icon)
                .attr('text-anchor', 'middle')
                .attr('dy', iconFontSize * 0.32)
                .attr('font-size', `${iconFontSize}px`)
                .attr('fill', 'white')
                .style('pointer-events', 'none');
        });

        node.append('title').text(d => d.name);

        node.append('text')
            .text(d => truncateLabel(d.name))
            .attr('class', 'node-label')
            .attr('text-anchor', 'middle')
            .attr('dy', d => getNodeRadius(d, focusEntityId) + 12)
            .attr('fill', 'var(--text-primary)')
            .attr('font-size', d => d.id === focusEntityId ? '13px' : '11px')
            .attr('font-weight', d => d.id === focusEntityId ? '700' : '600');

        node.append('text')
            .text(d => getCategoryConfig(d.type)?.label ?? d.type)
            .attr('class', 'node-type')
            .attr('text-anchor', 'middle')
            .attr('dy', d => getNodeRadius(d, focusEntityId) + 26)
            .attr('fill', 'var(--color-accent-400)')
            .attr('font-size', '9px');

        simulation.on('end', () => {
            fitRef.current(true);
            if (!focusEntityId && isUnfiltered) {
                nodes.forEach(n => {
                    if (n.x != null && n.y != null) {
                        overviewLayoutRef.current.set(n.id, { x: n.x, y: n.y });
                    }
                });
            }
        });

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

        svg.on('click', () => setFocusEntity(null));
        zoomRef.current = zoom;

        const rafId = requestAnimationFrame(() => fitRef.current(false));

        return () => {
            cancelAnimationFrame(rafId);
            simulation.stop();
        };
        // personaLens is deliberately excluded: it only sets initial fill color here,
        // and is applied reactively (without rebuilding the simulation) by the cosmetic effect below.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dimensions, filter, filteredEntities, filteredRelationships, focusEntityId, selectedEntityId, setFocusEntity]);

    // 2. Cosmetic Effect: mutates node colors, SC glow, and path highlight WITHOUT restarting simulation
    useEffect(() => {
        if (!svgRef.current) return;

        // Node fill colours (persona lens) & VP SC glow classes
        d3.select(svgRef.current)
            .selectAll<SVGGElement, GraphNode>('.graph-node')
            .each(function(d) {
                const fill = getNodeFillColor(d, personaLens);
                d3.select(this).select('circle').attr('fill', fill);

                const el = d3.select(this);
                const status = d.metadata?.d2c_status;
                el.classed('node-sc-ready', personaLens === 'vp_supply_chain' && status === 'ready');
                el.classed('node-sc-blocker', personaLens === 'vp_supply_chain' && status === 'blocker');
                el.classed('node-sc-partial', personaLens === 'vp_supply_chain' && status === 'partial');
            });

        // Path highlighting (CDO lens & general context)
        const entityHighlightSet = new Set(highlightedEntities);
        const relHighlightSet = new Set(highlightedRelationships);
        const hasHighlight = entityHighlightSet.size > 0;

        d3.select(svgRef.current)
            .selectAll<SVGGElement, GraphNode>('.graph-node')
            .attr('opacity', d => hasHighlight ? (entityHighlightSet.has(d.id) ? 1 : 0.25) : 1)
            .each(function(d) {
                d3.select(this).select('circle')
                    .attr('stroke-width', entityHighlightSet.has(d.id) ? 4 : null);
            });

        d3.select(svgRef.current)
            .selectAll<SVGLineElement, DisplayGraphLink>('.graph-link')
            .attr('stroke-opacity', d =>
                hasHighlight ? (relHighlightSet.has(d.id) ? 1 : 0.1) : 0.5
            )
            .attr('stroke-width', d =>
                relHighlightSet.has(d.id) ? 3 : 1.5
            );
    }, [personaLens, highlightedEntities, highlightedRelationships]);

    const handleManualZoom = (factor: number) => {
        if (!svgRef.current) return;
        const svg = d3.select(svgRef.current);
        const zoom = zoomRef.current;
        if (zoom) {
            svg.transition().duration(300).call(zoom.scaleBy, factor);
        }
    };

    return (
        <div className="graph-canvas-container">
            <svg ref={svgRef} className="graph-canvas" />

            {filteredEntities.length === 0 && (
                <div className="graph-empty-overlay">
                    <p>
                        {entities.length === 0
                            ? 'No entities to display. Load the demo or create a new entity.'
                            : 'Select an entity type from the sidebar to start exploring the graph.'}
                    </p>
                </div>
            )}

            <div className="graph-controls">
                <button className="zoom-btn" onClick={() => handleManualZoom(1.5)} title="Zoom In">＋</button>
                <button className="zoom-btn" onClick={() => handleManualZoom(0.6)} title="Zoom Out">－</button>
                <div className="control-divider" />
                <button
                    className="zoom-btn"
                    onClick={() => fitRef.current(true)}
                    title="Fit to content"
                >
                    🎯
                </button>
            </div>

            <div className="graph-hint">Drag to reposition · Click to focus</div>
        </div>
    );
};
