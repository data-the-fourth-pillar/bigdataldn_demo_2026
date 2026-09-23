import React from 'react';
import { useChatStore } from '../../store/chatStore';
import type { PersonaLens, GroundingMode } from '../../types/chat';
import './ChatHistoryPanel.css';

const PERSONA_LABELS: Record<PersonaLens, string> = {
    ceo: 'CEO',
    vp_supply_chain: 'VP Supply Chain',
    cdo: 'CDO',
};

const GROUNDING_LABELS: Record<GroundingMode, string> = {
    generic: 'Generic',
    data_only: 'Data',
    kg_full: 'Data + EC',
    kg_only: 'EC',
};

export const ChatHistoryPanel: React.FC = () => {
    const { sessions, messages, activeSessionId, newChat, loadSession, deleteSession, clearAllSessions, isStreaming } = useChatStore();

    const formatTime = (iso: string) => {
        const d = new Date(iso);
        const now = new Date();
        const diffMs = now.getTime() - d.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);
        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        return `${diffDays}d ago`;
    };

    return (
        <div className="chat-history-panel">
            <div className="chp-header">
                <span className="chp-title">Chats</span>
                <div className="chp-header-actions">
                    {sessions.length > 0 && (
                        <button
                            type="button"
                            className="chp-clear-btn"
                            onClick={clearAllSessions}
                            title="Delete all saved chats"
                        >
                            Clear All
                        </button>
                    )}
                    <button
                        type="button"
                        className="chp-new-btn"
                        onClick={newChat}
                        disabled={messages.length === 0 || isStreaming}
                        title={isStreaming ? 'Wait for the current response to finish' : 'Save current chat and start new'}
                    >
                        + New
                    </button>
                </div>
            </div>

            {sessions.length === 0 ? (
                <div className="chp-empty">No previous chats</div>
            ) : (
                <ul className="chp-list">
                    {sessions.map(session => (
                        <li key={session.id} className={`chp-item${activeSessionId === session.id ? ' active' : ''}`}>
                            <button
                                type="button"
                                className="chp-session-btn"
                                onClick={() => loadSession(session.id)}
                                title={isStreaming ? 'Wait for the current response to finish' : session.title}
                                disabled={activeSessionId === session.id || isStreaming}
                            >
                                <span className="chp-session-title">{session.title}</span>
                                {session.personaLens && session.groundingMode && (
                                    <span className="chp-session-meta">
                                        {PERSONA_LABELS[session.personaLens] ?? session.personaLens} · {GROUNDING_LABELS[session.groundingMode] ?? session.groundingMode}
                                    </span>
                                )}
                                <span className="chp-session-time">{formatTime(session.createdAt)}</span>
                            </button>
                            <button
                                type="button"
                                className="chp-delete-btn"
                                onClick={(e) => { e.stopPropagation(); deleteSession(session.id); }}
                                disabled={isStreaming && activeSessionId === session.id}
                                title={isStreaming && activeSessionId === session.id ? 'Wait for the current response to finish' : 'Delete session'}
                            >
                                ×
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};
