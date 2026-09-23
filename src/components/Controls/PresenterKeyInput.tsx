import React, { useState } from 'react';
import { useChatStore } from '../../store/chatStore';
import './PresenterKeyInput.css';

export const PresenterKeyInput: React.FC = () => {
    const presenterKey = useChatStore(state => state.presenterKey);
    const setPresenterKey = useChatStore(state => state.setPresenterKey);

    const [draft, setDraft] = useState(presenterKey);
    const [justSaved, setJustSaved] = useState(false);

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        setPresenterKey(draft);
        setJustSaved(true);
        setTimeout(() => setJustSaved(false), 2000);
    };

    const isDirty = draft !== presenterKey;

    return (
        <form className="presenter-key-input" onSubmit={handleSave}>
            <div className="presenter-key-row">
                <input
                    type="password"
                    className="presenter-key-field"
                    placeholder="Presenter key"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                />
                <button type="submit" className="presenter-key-save-btn" disabled={!isDirty}>
                    Save
                </button>
            </div>
            <span className="presenter-key-status">
                {justSaved
                    ? '✓ Saved'
                    : presenterKey
                        ? 'Presenter mode: ON — rate limits bypassed'
                        : 'Presenter mode: OFF'}
            </span>
        </form>
    );
};
