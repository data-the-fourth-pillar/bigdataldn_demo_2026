import React from 'react';
import { useChatStore } from '../../store/chatStore';
import type { GroundingMode } from '../../types/chat';
import './GroundingModeSelector.css';

const GROUNDING_OPTIONS: { value: GroundingMode; label: string; title: string }[] = [
    { value: 'generic', label: 'Generic', title: 'No graph context — standard AI response' },
    { value: 'kg_only', label: 'EC', title: 'Answers grounded in graph entities and relationships' },
    { value: 'kg_full', label: 'EC + Data', title: 'Full context including data product tables' },
];

export const GroundingModeSelector: React.FC = () => {
    const groundingMode = useChatStore(state => state.groundingMode);
    const setGroundingMode = useChatStore(state => state.setGroundingMode);
    const clearHighlightedPath = useChatStore(state => state.clearHighlightedPath);

    const handleChange = (value: GroundingMode) => {
        if (value === groundingMode) return;
        setGroundingMode(value);
        clearHighlightedPath();
    };

    return (
        <div className="grounding-selector">
            <span className="grounding-label">Grounding Mode:</span>
            <div className="grounding-segmented-control">
                {GROUNDING_OPTIONS.map((option) => (
                    <button
                        key={option.value}
                        type="button"
                        className={`grounding-btn ${groundingMode === option.value ? 'active' : ''}`}
                        onClick={() => handleChange(option.value)}
                        title={option.title}
                    >
                        {option.label}
                    </button>
                ))}
            </div>
        </div>
    );
};
