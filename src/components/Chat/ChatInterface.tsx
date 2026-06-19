import React, { useState, useRef, useEffect } from 'react';
import { useChatStore } from '../../store/chatStore';
import { useGraphStore } from '../../store/graphStore';
import { chatApi } from '../../api/chatApi';
import { getCategoryConfig } from '../../constants/categories';
import type { GroundingMode } from '../../types/chat';
import './ChatInterface.css';

const EXAMPLE_QUESTIONS = [
    'What data products are in the Order Management domain?',
    'How does Lead to Cash Process relate to Orders?',
    'Who uses the Orders data product?',
    'What technology does Customer Support AI Agent interact with?',
];

export const ChatInterface: React.FC = () => {
    const {
        messages,
        groundingMode,
        isStreaming,
        currentStreamingMessage,
        addMessage,
        setGroundingMode,
        startStreaming,
        appendStreamChunk,
        finishStreaming,
    } = useChatStore();

    const { entities, relationships, focusEntityId, setFocusEntity } = useGraphStore();
    const focusEntity = entities.find(e => e.id === focusEntityId);

    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, currentStreamingMessage]);

    const sendMessage = async (text: string) => {
        if (!text.trim() || isStreaming) return;

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
                },
                (chunk) => appendStreamChunk(chunk),
                (message) => finishStreaming(message),
                (error) => {
                    console.error('Streaming error:', error);
                    finishStreaming({
                        id: crypto.randomUUID(),
                        role: 'assistant',
                        content: 'Sorry, I encountered an error processing your request. Make sure the backend is running on port 8000.',
                        timestamp: new Date().toISOString(),
                    });
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
        { value: 'kg_only', label: 'Knowledge Graph', description: 'Answers grounded in graph entities and relationships' },
        { value: 'kg_full', label: 'KG + Data', description: 'Full context including data product tables' },
    ];

    const isGraphGrounded = groundingMode !== 'generic';

    return (
        <div className="chat-interface">
            <div className="chat-header">
                <div className="header-content">
                    <h2>Knowledge Graph Chat</h2>
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
                        <h3>👋 Ask your knowledge graph</h3>
                        <p>
                            Chat is connected to your knowledge graph
                            {entities.length > 0
                                ? ` (${entities.length} entities, ${relationships.length} relationships).`
                                : '. Loading graph data...'}
                            {isGraphGrounded
                                ? ' Answers are grounded in your graph structure.'
                                : ' Switch to Knowledge Graph mode to use graph context.'}
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
                    const reasoning = reasoningMatch ? reasoningMatch[1].trim() : null;
                    const cleanContent = message.content.replace(/<reasoning>[\s\S]*?<\/reasoning>/, '').trim();
                    const hasContext = message.usedContext?.raw_context_string;
                    const citations = message.citations ?? [];

                    return (
                        <div key={message.id} className={`message ${message.role}`}>
                            <div className="message-avatar">
                                {message.role === 'user' ? '👤' : '🤖'}
                            </div>
                            <div className="message-content">
                                {reasoning && (
                                    <details className="reasoning-details">
                                        <summary>🔍 Agent Reasoning</summary>
                                        <div className="reasoning-text">{reasoning}</div>
                                    </details>
                                )}
                                <div className="message-text">
                                    {cleanContent || (message.role === 'assistant' && !isStreaming ? '...' : '')}
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
                                        <summary>💾 Knowledge Context Used</summary>
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
