import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { useChatStore } from '../../store/chatStore';
import { useGraphStore } from '../../store/graphStore';
import { chatApi } from '../../api/chatApi';
import { getCategoryConfig } from '../../constants/categories';
import type { GroundingMode } from '../../types/chat';
import './ChatInterface.css';

const EXAMPLE_QUESTIONS = [
    'We want to launch D2C in the UK next quarter. Which categories and regions should we start with?',
    'What are the main supply chain blockers for launching D2C?',
    'Show me the EAV revenue projections across Year 1, Year 2, and Year 3.',
    'Which legal contracts govern channel conflict between Wholesale and D2C?',
];

export const ChatInterface: React.FC = () => {
    const {
        messages,
        groundingMode,
        provider,
        personaLens,
        isStreaming,
        currentStreamingMessage,
        addMessage,
        setGroundingMode,
        setHighlightedPath,
        clearHighlightedPath,
        startStreaming,
        appendStreamChunk,
        finishStreaming,
    } = useChatStore();

    const { entities, relationships, focusEntityId, setFocusEntity } = useGraphStore();
    const focusEntity = entities.find(e => e.id === focusEntityId);

    const [input, setInput] = useState('');
    const [failoverNotice, setFailoverNotice] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, currentStreamingMessage]);

    const sendMessage = async (text: string) => {
        if (!text.trim() || isStreaming) return;

        clearHighlightedPath();

        const userMessage = {
            id: crypto.randomUUID(),
            role: 'user' as const,
            content: text.trim(),
            timestamp: new Date().toISOString(),
        };

        addMessage(userMessage);
        setInput('');
        startStreaming();

        try {
            await chatApi.streamMessage(
                {
                    message: userMessage.content,
                    groundingMode,
                    conversationHistory: messages,
                    focusEntityId,
                    provider,
                    personaLens,
                },
                (chunk) => appendStreamChunk(chunk),
                (ctxEntities, ctxRelationships, _lens) => {
                    setHighlightedPath(ctxEntities, ctxRelationships);
                },
                (message, _reasoning) => finishStreaming(message),
                (error) => {
                    console.error('Streaming error:', error);
                    finishStreaming({
                        id: crypto.randomUUID(),
                        role: 'assistant',
                        content: 'Sorry, I encountered an error processing your request. Make sure the backend is running on port 8000.',
                        timestamp: new Date().toISOString(),
                    });
                },
                (notice) => {
                    setFailoverNotice(notice);
                    setTimeout(() => setFailoverNotice(null), 3000);
                }
            );
        } catch (error) {
            console.error('Failed to send message:', error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await sendMessage(input);
    };

    const groundingModes: { value: GroundingMode; label: string; description: string }[] = [
        { value: 'generic', label: 'Generic', description: 'No graph context — standard AI response' },
        { value: 'kg_only', label: 'Enterprise Context (EC)', description: 'Answers grounded in graph entities and relationships' },
        { value: 'kg_full', label: 'EC + Data', description: 'Full context including data product tables' },
    ];

    const isGraphGrounded = groundingMode !== 'generic';

    return (
        <div className="chat-interface">
            {failoverNotice && (
                <div className="failover-toast" style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    zIndex: 9999,
                    background: 'var(--color-accent-600, #2563eb)',
                    color: '#ffffff',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                }}>
                    ⚠️ {failoverNotice}
                </div>
            )}

            <div className="chat-header">
                <div className="header-content">
                    <div className="graph-stats">
                        <span className="stat">
                            <span className="stat-value">{entities.length}</span>
                            <span className="stat-label">entities</span>
                        </span>
                        <span className="stat">
                            <span className="stat-value">{relationships.length}</span>
                            <span className="stat-label">relationships</span>
                        </span>
                    </div>
                </div>

                {isGraphGrounded && (
                    <div className="focus-context-bar">
                        <label htmlFor="chat-focus">Graph focus:</label>
                        <select
                            id="chat-focus"
                            value={focusEntityId ?? ''}
                            onChange={(e) => setFocusEntity(e.target.value || null)}
                        >
                            <option value="">All entities</option>
                            {entities.map(entity => (
                                <option key={entity.id} value={entity.id}>
                                    {entity.name} ({getCategoryConfig(entity.type)?.label ?? entity.type})
                                </option>
                            ))}
                        </select>
                        {focusEntity && (
                            <span className="focus-hint">
                                Answers prioritize connections around <strong>{focusEntity.name}</strong>
                            </span>
                        )}
                    </div>
                )}

                <div className="grounding-controls">
                    <label>Grounding Mode:</label>
                    <div className="mode-selector">
                        {groundingModes.map(mode => (
                            <button
                                key={mode.value}
                                type="button"
                                className={`mode-btn ${groundingMode === mode.value ? 'active' : ''}`}
                                onClick={() => setGroundingMode(mode.value)}
                                title={mode.description}
                            >
                                {mode.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="messages-container">
                {messages.length === 0 && (
                    <div className="welcome-message">
                        <h3>👋 Ask your Enterprise Context</h3>
                        <p>
                            Chat is connected to your enterprise context
                            {entities.length > 0
                                ? ` (${entities.length} entities, ${relationships.length} relationships).`
                                : '. Loading graph data...'}
                            {isGraphGrounded
                                ? ' Answers are grounded in your graph structure.'
                                : ' Switch to Enterprise Context mode to use graph context.'}
                        </p>
                        <div className="example-questions">
                            <p className="example-label">Try asking:</p>
                            {EXAMPLE_QUESTIONS.map((question) => (
                                <button
                                    key={question}
                                    type="button"
                                    className="example-item"
                                    onClick={() => sendMessage(question)}
                                >
                                    "{question}"
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {messages.map((message) => {
                    const reasoningMatch = message.content.match(/<reasoning>([\s\S]*?)<\/reasoning>/);
                    const reasoning = message.reasoning || (reasoningMatch ? reasoningMatch[1].trim() : null);
                    const cleanContent = message.content.replace(/<reasoning>[\s\S]*?<\/reasoning>/, '').trim();
                    const hasContext = message.usedContext?.raw_context_string;
                    const citations = message.citations ?? [];

                    return (
                        <div key={message.id} className={`message ${message.role}`}>
                            <div className="message-avatar">
                                {message.role === 'user' ? '👤' : '🤖'}
                            </div>
                            <div className="message-content">
                                {message.role === 'assistant' && isGraphGrounded && (
                                    reasoning ? (
                                        <details className="reasoning-details" open>
                                            <summary>🔍 Agent Reasoning</summary>
                                            <div className="reasoning-text">{reasoning}</div>
                                        </details>
                                    ) : (
                                        <details className="reasoning-details">
                                            <summary>🔍 Agent Reasoning</summary>
                                            <div className="reasoning-text" style={{ fontStyle: 'italic', opacity: 0.8 }}>
                                                Direct EKG response generated — reasoning trace unavailable for this response.
                                            </div>
                                        </details>
                                    )
                                )}
                                <div className="message-text">
                                    {message.role === 'assistant'
                                        ? <ReactMarkdown>{cleanContent || (!isStreaming ? '...' : '')}</ReactMarkdown>
                                        : cleanContent}
                                </div>

                                {citations.length > 0 && (
                                    <div className="citations">
                                        <div className="citations-label">Graph sources:</div>
                                        <div className="citation-chips">
                                            {citations.map((citation) => (
                                                <button
                                                    key={citation.entityId}
                                                    type="button"
                                                    className="citation-chip"
                                                    onClick={() => setFocusEntity(citation.entityId)}
                                                    title="Set as graph focus"
                                                >
                                                    {citation.entityName}
                                                    <span className="citation-type">{citation.entityType}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {hasContext && (
                                    <details className="context-details">
                                        <summary>💾 Enterprise Context Used</summary>
                                        <pre className="context-text">{message.usedContext?.raw_context_string}</pre>
                                    </details>
                                )}
                            </div>
                        </div>
                    );
                })}

                {isStreaming && currentStreamingMessage && (
                    <div className="message assistant">
                        <div className="message-avatar">🤖</div>
                        <div className="message-content">
                            <div className="message-text">{currentStreamingMessage}</div>
                            <div className="streaming-indicator">
                                <span className="dot"></span>
                                <span className="dot"></span>
                                <span className="dot"></span>
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSubmit} className="chat-input-form">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={
                        isGraphGrounded
                            ? 'Ask about entities, processes, data products...'
                            : 'Ask a question...'
                    }
                    disabled={isStreaming}
                    className="chat-input"
                />
                <button
                    type="submit"
                    disabled={!input.trim() || isStreaming}
                    className="send-button"
                >
                    {isStreaming ? '⏳' : '➤'}
                </button>
            </form>
        </div>
    );
};
