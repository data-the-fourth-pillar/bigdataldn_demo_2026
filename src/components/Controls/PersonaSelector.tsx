import React from 'react';
import { useChatStore } from '../../store/chatStore';
import type { PersonaLens } from '../../types/chat';
import './PersonaSelector.css';

const PERSONA_OPTIONS: { value: PersonaLens; label: string }[] = [
    { value: 'ceo', label: 'CEO' },
    { value: 'vp_supply_chain', label: 'VP Supply Chain' },
    { value: 'cdo', label: 'CDO' },
];

export const PersonaSelector: React.FC = () => {
    const personaLens = useChatStore(state => state.personaLens);
    const setPersonaLens = useChatStore(state => state.setPersonaLens);
    const clearHighlightedPath = useChatStore(state => state.clearHighlightedPath);

    const handlePersonaChange = (value: PersonaLens) => {
        if (value === personaLens) return;
        setPersonaLens(value);
        clearHighlightedPath();
    };

    return (
        <div className="persona-selector">
            <span className="persona-label">Persona:</span>
            <div className="persona-segmented-control">
                {PERSONA_OPTIONS.map((option) => (
                    <button
                        key={option.value}
                        type="button"
                        className={`persona-btn ${personaLens === option.value ? 'active' : ''}`}
                        onClick={() => handlePersonaChange(option.value)}
                    >
                        {option.label}
                    </button>
                ))}
            </div>
        </div>
    );
};
