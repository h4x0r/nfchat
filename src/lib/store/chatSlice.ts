import type { StateCreator } from 'zustand';
import type { ChatSlice, ChatMessage } from './types';

/**
 * Maximum number of messages to keep in memory.
 * Prevents DOM/memory bloat in long conversations.
 */
const MAX_MESSAGES = 100;

export const createChatSlice: StateCreator<ChatSlice> = (set) => ({
  messages: [],
  isLoading: false,

  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) =>
    set((state) => {
      const newMessages = [
        ...state.messages,
        {
          ...message,
          id: crypto.randomUUID(),
          timestamp: new Date(),
        },
      ];

      // Windowing: keep only the most recent messages
      return {
        messages: newMessages.length > MAX_MESSAGES
          ? newMessages.slice(-MAX_MESSAGES)
          : newMessages,
      };
    }),

  setIsLoading: (loading: boolean) => set({ isLoading: loading }),

  clearChat: () => set({ messages: [] }),
});
