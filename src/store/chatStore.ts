import { create } from 'zustand';
import type { Message, GroundingMode, PersonaLens, LLMProvider } from '../types/chat';

export interface ChatSession {
    id: string;
    title: string;
    createdAt: string;
    messages: Message[];
    personaLens: PersonaLens;
    groundingMode: GroundingMode;
}

const SESSIONS_KEY = 'ec-chat-sessions';
const MAX_SESSIONS = 20;
const PRESENTER_KEY_STORAGE = 'demo-presenter-key';

function loadPresenterKey(): string {
    try {
        return localStorage.getItem(PRESENTER_KEY_STORAGE) || '';
    } catch {
        return '';
    }
}

function loadSessions(): ChatSession[] {
    try {
        const raw = localStorage.getItem(SESSIONS_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function saveSessions(sessions: ChatSession[]): void {
    try {
        localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions.slice(0, MAX_SESSIONS)));
    } catch {}
}

function makeSession(messages: Message[], personaLens: PersonaLens, groundingMode: GroundingMode): ChatSession {
    const firstUser = messages.find(m => m.role === 'user');
    const title = firstUser
        ? firstUser.content.slice(0, 60) + (firstUser.content.length > 60 ? '…' : '')
        : 'Chat session';
    return {
        id: crypto.randomUUID(),
        title,
        createdAt: new Date().toISOString(),
        messages,
        personaLens,
        groundingMode,
    };
}

interface ChatState {
    messages: Message[];
    sessions: ChatSession[];
    activeSessionId: string | null;
    groundingMode: GroundingMode;
    isStreaming: boolean;
    currentStreamingMessage: string;
    showExplainability: boolean;
    selectedMessageId: string | null;

    personaLens: PersonaLens;
    provider: LLMProvider;
    presenterKey: string;
    highlightedEntities: string[];
    highlightedRelationships: string[];

    // Actions
    addMessage: (message: Message) => void;
    setMessages: (messages: Message[]) => void;
    clearMessages: () => void;
    newChat: () => void;

    // Session actions
    loadSession: (id: string) => void;
    deleteSession: (id: string) => void;
    clearAllSessions: () => void;

    setGroundingMode: (mode: GroundingMode) => void;
    setPersonaLens: (lens: PersonaLens) => void;
    setProvider: (provider: LLMProvider) => void;
    setPresenterKey: (key: string) => void;

    setHighlightedPath: (entities: string[], relationships: string[]) => void;
    clearHighlightedPath: () => void;

    startStreaming: () => void;
    appendStreamChunk: (chunk: string) => void;
    finishStreaming: (message: Message) => void;

    toggleExplainability: () => void;
    selectMessage: (id: string | null) => void;
}

export const useChatStore = create<ChatState>((set) => ({
    messages: [],
    sessions: loadSessions(),
    activeSessionId: null,
    groundingMode: 'generic',
    isStreaming: false,
    currentStreamingMessage: '',
    showExplainability: false,
    selectedMessageId: null,

    personaLens: 'ceo',
    provider: 'gemini',
    presenterKey: loadPresenterKey(),
    highlightedEntities: [],
    highlightedRelationships: [],

    addMessage: (message) => set((state) => ({
        messages: [...state.messages, message]
    })),

    setMessages: (messages) => set({ messages }),

    clearMessages: () => set({
        messages: [],
        activeSessionId: null,
        highlightedEntities: [],
        highlightedRelationships: [],
    }),

    newChat: () => set((state) => {
        if (state.messages.length === 0) return { activeSessionId: null };

        let sessions = state.sessions;
        if (state.activeSessionId) {
            // Update the active session with latest messages and persona/mode
            sessions = sessions.map(s =>
                s.id === state.activeSessionId
                    ? { ...s, messages: state.messages, personaLens: state.personaLens, groundingMode: state.groundingMode }
                    : s
            );
        } else {
            // Unsaved conversation — create a new session entry
            const session = makeSession(state.messages, state.personaLens, state.groundingMode);
            sessions = [session, ...sessions];
        }
        saveSessions(sessions);

        return {
            sessions,
            activeSessionId: null,
            messages: [],
            groundingMode: 'generic',
            highlightedEntities: [],
            highlightedRelationships: [],
        };
    }),

    loadSession: (id) => set((state) => {
        // Already viewing this session — no-op
        if (state.activeSessionId === id) return {};

        const session = state.sessions.find(s => s.id === id);
        if (!session) return {};

        let sessions = state.sessions;
        if (state.messages.length > 0) {
            if (state.activeSessionId) {
                // Persist any new messages and the latest persona/mode back to the session we're leaving
                sessions = sessions.map(s =>
                    s.id === state.activeSessionId
                        ? { ...s, messages: state.messages, personaLens: state.personaLens, groundingMode: state.groundingMode }
                        : s
                );
            } else {
                // Save the current unsaved conversation before switching
                const current = makeSession(state.messages, state.personaLens, state.groundingMode);
                sessions = [current, ...sessions];
            }
            saveSessions(sessions);
        }

        return {
            sessions,
            activeSessionId: id,
            messages: session.messages,
            // Restore the persona/grounding mode that was last used in the chat being opened,
            // so the top-bar selectors reflect what actually applied to it.
            personaLens: session.personaLens ?? state.personaLens,
            groundingMode: session.groundingMode ?? state.groundingMode,
            highlightedEntities: [],
            highlightedRelationships: [],
        };
    }),

    deleteSession: (id) => set((state) => {
        const sessions = state.sessions.filter(s => s.id !== id);
        saveSessions(sessions);
        const wasActive = state.activeSessionId === id;
        return {
            sessions,
            ...(wasActive ? { activeSessionId: null, messages: [], highlightedEntities: [], highlightedRelationships: [] } : {}),
        };
    }),

    clearAllSessions: () => set(() => {
        saveSessions([]);
        return { sessions: [], activeSessionId: null, messages: [], highlightedEntities: [], highlightedRelationships: [] };
    }),

    setGroundingMode: (mode) => set({ groundingMode: mode }),
    setPersonaLens: (lens) => set({ personaLens: lens }),
    setProvider: (provider) => set({ provider }),
    setPresenterKey: (key) => {
        try {
            localStorage.setItem(PRESENTER_KEY_STORAGE, key);
        } catch {
            // Best-effort only — key still applies for this session even if storage fails
        }
        set({ presenterKey: key });
    },

    setHighlightedPath: (entities, relationships) => set({
        highlightedEntities: entities,
        highlightedRelationships: relationships,
    }),

    clearHighlightedPath: () => set({
        highlightedEntities: [],
        highlightedRelationships: [],
    }),

    startStreaming: () => set({
        isStreaming: true,
        currentStreamingMessage: ''
    }),

    appendStreamChunk: (chunk) => set((state) => ({
        currentStreamingMessage: state.currentStreamingMessage + chunk
    })),

    // Write new messages back to the active session immediately so history stays current.
    // A brand-new conversation has no activeSessionId yet — create its session on the
    // first completed exchange instead of waiting for the user to navigate away.
    finishStreaming: (message) => set((state) => {
        const newMessages = [...state.messages, message];
        let sessions = state.sessions;
        let activeSessionId = state.activeSessionId;

        if (activeSessionId) {
            sessions = sessions.map(s =>
                s.id === activeSessionId
                    ? { ...s, messages: newMessages, personaLens: state.personaLens, groundingMode: state.groundingMode }
                    : s
            );
        } else {
            const session = makeSession(newMessages, state.personaLens, state.groundingMode);
            activeSessionId = session.id;
            sessions = [session, ...sessions];
        }
        saveSessions(sessions);

        return {
            isStreaming: false,
            currentStreamingMessage: '',
            messages: newMessages,
            sessions,
            activeSessionId,
        };
    }),

    toggleExplainability: () => set((state) => ({
        showExplainability: !state.showExplainability
    })),

    selectMessage: (id) => set({ selectedMessageId: id })
}));
