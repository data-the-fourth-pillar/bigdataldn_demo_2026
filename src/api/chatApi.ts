import axios from 'axios';
import type { ChatRequest, ChatResponse, Message } from '../types/chat';

// Detect if we are running in a browser environment and what the base URL should be
const getBaseUrl = () => {
    // 1. Explicit environment variable takes precedence
    if (import.meta.env.VITE_API_BASE_URL) {
        return import.meta.env.VITE_API_BASE_URL.replace(/\/api$/, '');
    }

    // 2. If we are in the browser, check if we are on Vercel or other production host
    if (typeof window !== 'undefined') {
        const { hostname, protocol, port } = window.location;

        // If not localhost, we should likely use the current origin
        if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
            return `${protocol}//${hostname}${port ? `:${port}` : ''}`;
        }
    }

    // 3. Fallback to default local development port
    return 'http://localhost:8000';
};

const API_BASE_URL = getBaseUrl();

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

export const chatApi = {
    async sendMessage(request: ChatRequest): Promise<ChatResponse> {
        const response = await api.post('/api/chat/message', request);
        return response.data;
    },

    async streamMessage(
        request: ChatRequest,
        onChunk: (chunk: string) => void,
        onContextInfo?: (entities: string[], relationships: string[], personaLens: string) => void,
        onComplete?: (message: Message, reasoning: string) => void,
        onError?: (error: Error) => void,
        onStreamReset?: (notice: string) => void,
    ): Promise<void> {
        try {
            const response = await fetch(`${API_BASE_URL}/api/chat/stream`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(request),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) {
                throw new Error('No response body');
            }

            let fullMessage = '';
            let usedContext: Message['usedContext'];
            let citations: Message['citations'];

            while (true) {
                const { done, value } = await reader.read();

                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);

                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.context) {
                                usedContext = parsed.context;
                                citations = parsed.context.citations;
                                onContextInfo?.(
                                    parsed.context.entities ?? [],
                                    parsed.context.relationships ?? [],
                                    parsed.context.persona_lens ?? 'ceo',
                                );
                            }
                            if (parsed.delta) {
                                fullMessage += parsed.delta;
                                onChunk(parsed.delta);
                            }
                            if (parsed.type === 'stream_reset') {
                                fullMessage = '';
                                onStreamReset?.(parsed.failoverNotice ?? '');
                            }
                            if (parsed.done === true) {
                                // Structured done event received
                            }
                        } catch {
                            // Skip non-JSON or partial lines
                        }
                    }
                }
            }

            const reasoningMatch = fullMessage.match(/<reasoning>([\s\S]*?)<\/reasoning>/);
            const reasoning = reasoningMatch ? reasoningMatch[1].trim() : '';
            let answerContent = reasoningMatch
                ? fullMessage.slice(fullMessage.indexOf('</reasoning>') + '</reasoning>'.length).trim()
                : fullMessage;

            // Strip FOLLOW_UPS: only when it is truly the final line of the response.
            // Use lastIndexOf and verify the remaining text has no paragraph breaks
            // (if it does, the marker appeared mid-response and we should leave it untouched).
            let followUpQuestions: string[] | undefined;
            const FU_MARKER = '\nFOLLOW_UPS:';
            const fuLastIdx = answerContent.lastIndexOf(FU_MARKER);
            if (fuLastIdx !== -1) {
                const afterMarker = answerContent.slice(fuLastIdx + FU_MARKER.length).trim();
                if (!afterMarker.includes('\n\n') && afterMarker.length < 500) {
                    followUpQuestions = afterMarker.split('|').map(s => s.trim()).filter(Boolean).slice(0, 3);
                    answerContent = answerContent.slice(0, fuLastIdx).trim();
                }
            }

            const message: Message = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: answerContent,
                timestamp: new Date().toISOString(),
                usedContext,
                citations,
                reasoning: reasoning || undefined,
                followUpQuestions,
                groundingMode: request.groundingMode,
            };
            onComplete?.(message, reasoning);
        } catch (error) {
            onError?.(error as Error);
        }
    },

    async getContext(messageId: string) {
        const response = await api.get(`/api/chat/context/${messageId}`);
        return response.data;
    },
};
