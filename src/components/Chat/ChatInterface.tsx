import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useChatStore } from '../../store/chatStore';
import { chatApi } from '../../api/chatApi';
import { LineagePanel } from './LineagePanel';
import { DataUsedPanel } from './DataUsedPanel';
import './ChatInterface.css';

function stripTabularData(contextStr: string): string {
    // Remove "Data Product Content:" label and all subsequent table lines (| ... |)
    return contextStr
        .split('\n')
        .filter(line => {
            const t = line.trim();
            return t !== 'Data Product Content:' && !(t.startsWith('|'));
        })
        .join('\n');
}

const PERSONA_LABELS: Record<string, string> = {
    ceo: 'CEO',
    vp_supply_chain: 'VP Supply Chain',
    cdo: 'CDO',
};

const EXAMPLE_QUESTIONS: Record<string, string[]> = {
    ceo: [
        'We want to launch D2C in the UK next quarter. Which categories and regions should we start with?',
        'What are the KPI targets and financial projections for the D2C launch?',
        'What is the expected return on investment and break-even for the D2C channel?',
        'Which legal contracts govern channel conflict between Wholesale and D2C?',
    ],
    vp_supply_chain: [
        'Which supply chain nodes are ready for D2C fulfilment and which are blockers?',
        'What is the capacity and lead time of each DC supporting D2C?',
        'Which regions can we fulfil next-day D2C orders from today?',
        'What 3PL partners do we need to activate for Year 2 D2C expansion?',
    ],
    cdo: [
        'What does our data tell us about the D2C revenue opportunity by category?',
        'Which data products support the D2C launch decision?',
        'What customer insights do we have on D2C propensity by segment?',
        'Which data domains govern the D2C product catalogue and customer data?',
    ],
};

export const ChatInterface: React.FC = () => {
    const {
        messages,
        groundingMode,
        provider,
        personaLens,
        isStreaming,
        currentStreamingMessage,
        addMessage,
        setHighlightedPath,
        clearHighlightedPath,
        startStreaming,
        appendStreamChunk,
        finishStreaming,
    } = useChatStore();

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
                    // Don't send history in Generic mode — prevents EC entity names bleeding through
                    conversationHistory: groundingMode !== 'generic' ? messages : undefined,
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

            <div className="messages-container">
                {messages.length === 0 && (
                    <div className="welcome-message">
                        {!isGraphGrounded ? (
                            <h3>🌐 Generic</h3>
                        ) : groundingMode === 'kg_full' ? (
                            <h3><span className="icon-graph">🕸️</span> 📊 Leverage your Enterprise Context and Data</h3>
                        ) : groundingMode === 'data_only' ? (
                            <h3>📊 Data — No Enterprise Context</h3>
                        ) : (
                            <h3><span className="icon-graph">🕸️</span> Leverage your Enterprise Context</h3>
                        )}
                        <p>
                            {!isGraphGrounded
                                ? <>Does not use enterprise context.<br />Answers are based on general knowledge only.</>
                                : groundingMode === 'kg_full'
                                    ? 'Chat is grounded in your enterprise context and data.'
                                    : groundingMode === 'data_only'
                                        ? <>Answers use data only.<br />No relationships, ownership, or business context applied.</>
                                        : 'Chat is grounded in your enterprise context.'}
                        </p>
                        <div className="example-questions">
                            <p className="example-label">Try asking:</p>
                            {(EXAMPLE_QUESTIONS[personaLens] ?? EXAMPLE_QUESTIONS.ceo).map((question) => (
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

                    const isGenericResponse = message.role === 'assistant' && message.groundingMode === 'generic';

                    return (
                        <div key={message.id} className={`message ${message.role}`}>
                            <div className="message-avatar">
                                <div className="message-avatar-icon">
                                    {message.role === 'user' ? '👤' : '🤖'}
                                </div>
                                {message.role === 'user' && (
                                    <span className="message-persona-label">{PERSONA_LABELS[personaLens] ?? personaLens}</span>
                                )}
                            </div>
                            <div className="message-content">
                                <div className="message-timestamp">
                                    {new Date(message.timestamp).toLocaleString(undefined, {
                                        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                                    })}
                                </div>
                                {message.role === 'assistant' && isGenericResponse && (
                                    <div className="generic-mode-badge">🌐 Generic — no enterprise context used</div>
                                )}
                                {message.role === 'assistant' && message.groundingMode === 'data_only' && (
                                    <div className="generic-mode-badge">📊 Data only — no Enterprise Context used. Relationships, ownership, and business meaning are not reflected in this answer.</div>
                                )}
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
                                        ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{cleanContent || (!isStreaming ? '...' : '')}</ReactMarkdown>
                                        : cleanContent}
                                </div>


                                {hasContext && message.groundingMode !== 'data_only' && (
                                    <details className="context-details">
                                        <summary>💾 Enterprise Context Used</summary>
                                        <div className="context-markdown">
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{stripTabularData(message.usedContext?.raw_context_string ?? '')}</ReactMarkdown>
                                        </div>
                                    </details>
                                )}

                                {message.role === 'assistant' && (message.groundingMode === 'kg_full' || message.groundingMode === 'data_only') && (message.usedContext?.entities?.length ?? 0) > 0 && (
                                    <DataUsedPanel entityIds={message.usedContext!.entities} />
                                )}

                                {message.role === 'assistant' && !isGenericResponse && message.groundingMode !== 'data_only' && (message.usedContext?.entities?.length ?? 0) > 0 && (
                                    <details className="lineage-details">
                                        <summary>🔗 Lineage</summary>
                                        <LineagePanel
                                            entityIds={message.usedContext!.entities}
                                            relationshipIds={message.usedContext!.relationships}
                                        />
                                    </details>
                                )}

                                {message.role === 'assistant' && (message.followUpQuestions?.length ?? 0) > 0 && !isStreaming && (
                                    <div className="follow-up-chips">
                                        <div className="follow-up-label">Follow-up questions:</div>
                                        <div className="follow-up-list">
                                            {message.followUpQuestions!.map((q, i) => (
                                                <button
                                                    key={i}
                                                    type="button"
                                                    className="follow-up-chip"
                                                    onClick={() => sendMessage(q)}
                                                >
                                                    {q}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}

                {isStreaming && (
                    <div className="message assistant">
                        <div className="message-avatar">🤖</div>
                        <div className="message-content">
                            {currentStreamingMessage ? (
                                <div className="message-text">{currentStreamingMessage}</div>
                            ) : (
                                <div className="message-text thinking-text">Agent is developing the response…</div>
                            )}
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
                    placeholder="Ask a question..."
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
