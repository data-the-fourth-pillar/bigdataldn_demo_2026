export interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: string;
    citations?: Citation[];
    usedContext?: UsedContext;
    reasoning?: string;
}

export interface Citation {
    entityId: string;
    entityName: string;
    entityType: string;
    snippet?: string;
}

export interface UsedContext {
    entities: string[];
    relationships: string[];
    subgraph?: {
        nodes: string[];
        edges: string[];
    };
    raw_context_string?: string;
}

export type GroundingMode = 'generic' | 'kg_only' | 'kg_full';

export interface ChatRequest {
    message: string;
    groundingMode: GroundingMode;
    conversationHistory?: Message[];
    focusEntityId?: string | null;
}

export interface ChatResponse {
    message: Message;
    usedContext: UsedContext;
    tokensUsed?: number;
}

export interface StreamChunk {
    delta: string;
    done: boolean;
}
