import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useGraphStore } from '../../store/graphStore';
import { getCategoryConfig, isDemoEntityType } from '../../constants/categories';
import './GraphHeaderControls.css';

export const GraphHeaderControls: React.FC = () => {
    const { entities, relationships, filter, setFilter, clearFilter, selectEntity, setFocusEntity } = useGraphStore();

    const [focused, setFocused] = useState(false);
    const [activeIdx, setActiveIdx] = useState(-1);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const query = filter.searchQuery || '';

    const suggestions = useMemo(() => {
        if (!query.trim()) return [];
        const q = query.toLowerCase();
        return entities
            .filter(e => isDemoEntityType(e.type))
            .filter(e =>
                e.name.toLowerCase().includes(q) ||
                e.description?.toLowerCase().includes(q)
            )
            .slice(0, 8);
    }, [query, entities]);

    const showDropdown = focused && suggestions.length > 0;

    // Close on click outside
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setFocused(false);
                setActiveIdx(-1);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const pickSuggestion = (entityId: string) => {
        setFocusEntity(entityId);
        selectEntity(entityId);
        setFilter({ searchQuery: '' });
        setFocused(false);
        setActiveIdx(-1);
        inputRef.current?.blur();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!showDropdown) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIdx(i => Math.min(i + 1, suggestions.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIdx(i => Math.max(i - 1, -1));
        } else if (e.key === 'Enter' && activeIdx >= 0) {
            e.preventDefault();
            pickSuggestion(suggestions[activeIdx].id);
        } else if (e.key === 'Escape') {
            setFocused(false);
            setActiveIdx(-1);
        }
    };

    return (
        <div className="graph-header-controls">
            <div className="ghc-stats">
                <span className="ghc-stat">
                    <span className="ghc-stat-value">{entities.length}</span>
                    <span className="ghc-stat-label">entities</span>
                </span>
                <span className="ghc-stat-divider" />
                <span className="ghc-stat">
                    <span className="ghc-stat-value">{relationships.length}</span>
                    <span className="ghc-stat-label">relationships</span>
                </span>
            </div>

            <div className="ghc-search-wrapper" ref={wrapperRef}>
                <div className={`ghc-search ${showDropdown ? 'ghc-search-open' : ''}`}>
                    <span className="ghc-search-icon">🔍</span>
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Search entities…"
                        value={query}
                        onChange={e => {
                            setFilter({ searchQuery: e.target.value });
                            setActiveIdx(-1);
                        }}
                        onFocus={() => setFocused(true)}
                        onKeyDown={handleKeyDown}
                        className="ghc-search-input"
                        autoComplete="off"
                    />
                    {(query || (filter.entityTypes && filter.entityTypes.length > 0)) && (
                        <button
                            type="button"
                            className="ghc-search-clear"
                            onClick={() => { clearFilter(); setFocused(false); }}
                            title="Clear all filters"
                        >
                            ✕
                        </button>
                    )}
                </div>

                {showDropdown && (
                    <ul className="ghc-suggestions" role="listbox">
                        {suggestions.map((entity, idx) => {
                            const cat = getCategoryConfig(entity.type);
                            return (
                                <li
                                    key={entity.id}
                                    role="option"
                                    aria-selected={idx === activeIdx}
                                    className={`ghc-suggestion-item ${idx === activeIdx ? 'active' : ''}`}
                                    onMouseDown={() => pickSuggestion(entity.id)}
                                    onMouseEnter={() => setActiveIdx(idx)}
                                >
                                    <span className="ghc-sug-icon">{cat?.icon ?? '•'}</span>
                                    <span className="ghc-sug-name">{entity.name}</span>
                                    <span className="ghc-sug-type">{cat?.label ?? entity.type}</span>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
};
