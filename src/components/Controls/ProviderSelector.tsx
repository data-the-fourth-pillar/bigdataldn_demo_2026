import React from 'react';
import { useChatStore } from '../../store/chatStore';
import type { LLMProvider } from '../../types/chat';
import './ProviderSelector.css';

const PROVIDER_OPTIONS: { value: LLMProvider; label: string }[] = [
    { value: 'openai', label: 'OpenAI' },
    { value: 'gemini', label: 'Gemini' },
];

export const ProviderSelector: React.FC = () => {
    const provider = useChatStore(state => state.provider);
    const setProvider = useChatStore(state => state.setProvider);

    return (
        <div className="provider-selector">
            <span className="provider-label">Provider:</span>
            <div className="provider-segmented-control">
                {PROVIDER_OPTIONS.map((option) => (
                    <button
                        key={option.value}
                        type="button"
                        className={`provider-btn ${provider === option.value ? 'active' : ''}`}
                        onClick={() => setProvider(option.value)}
                    >
                        {option.label}
                    </button>
                ))}
            </div>
        </div>
    );
};
