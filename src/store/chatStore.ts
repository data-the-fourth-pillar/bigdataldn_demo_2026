import { create } from 'zustand';
import type { Message, GroundingMode } from '../types/chat';

interface ChatState {
    messages: Message[];
    groundingMode: GroundingMode;
    isStreaming: boolean;
    currentStreamingMessage: string;
    showExplainability: boolean;
    selectedMessageId: string | null;

    // Actions
    addMessage: (message: Message) => void;
    setMessages: (messages: Message[]) => void;
    clearMessages: () => void;

    setGroundingMode: (mode: GroundingMode) => void;

    startStreaming: () => void;
    appendStreamChunk: (chunk: string) => void;
    finishStreaming: (message: Message) => void;

    toggleExplainability: () => void;
    selectMessage: (id: string | null) => void;
}

export const useChatStore = create<ChatState>((set) => ({
    messages: [],
    groundingMode: 'kg_full',
    isStreaming: false,
    currentStreamingMessage: '',
    showExplainability: false,
    selectedMessageId: null,

    addMessage: (message) => set((state) => ({
        messages: [...state.messages, message]
    })),

    setMessages: (messages) => set({ messages }),

    clearMessages: () => set({ messages: [] }),

    setGroundingMode: (mode) => set({ groundingMode: mode }),

    startStreaming: () => set({
        isStreaming: true,
        currentStreamingMessage: ''
    }),

    appendStreamChunk: (chunk) => set((state) => ({
        currentStreamingMessage: state.currentStreamingMessage + chunk
    })),

    finishStreaming: (message) => set((state) => ({
        isStreaming: false,
        currentStreamingMessage: '',
        messages: [...state.messages, message]
    })),

    toggleExplainability: () => set((state) => ({
        showExplainability: !state.showExplainability
    })),

    selectMessage: (id) => set({ selectedMessageId: id })
}));
