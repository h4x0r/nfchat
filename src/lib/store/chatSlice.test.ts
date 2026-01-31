import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createChatSlice } from './chatSlice';
import { create, type StoreApi } from 'zustand';
import type { ChatSlice } from './types';

describe('chatSlice', () => {
  let store: StoreApi<ChatSlice>;

  beforeEach(() => {
    store = create<ChatSlice>()(createChatSlice);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initial state', () => {
    it('has empty messages array', () => {
      expect(store.getState().messages).toEqual([]);
    });

    it('is not loading', () => {
      expect(store.getState().isLoading).toBe(false);
    });
  });

  describe('addMessage', () => {
    it('adds user message', () => {
      store.getState().addMessage({ role: 'user', content: 'Hello' });
      const messages = store.getState().messages;
      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe('user');
      expect(messages[0].content).toBe('Hello');
    });

    it('adds assistant message', () => {
      store.getState().addMessage({ role: 'assistant', content: 'Hi there!' });
      expect(store.getState().messages[0].role).toBe('assistant');
    });

    it('generates unique id', () => {
      store.getState().addMessage({ role: 'user', content: 'First' });
      store.getState().addMessage({ role: 'user', content: 'Second' });
      const messages = store.getState().messages;
      expect(messages[0].id).toBeDefined();
      expect(messages[1].id).toBeDefined();
      expect(messages[0].id).not.toBe(messages[1].id);
    });

    it('adds timestamp', () => {
      const now = new Date('2024-01-15T10:00:00Z');
      vi.setSystemTime(now);
      store.getState().addMessage({ role: 'user', content: 'Test' });
      expect(store.getState().messages[0].timestamp).toEqual(now);
    });

    it('preserves optional fields', () => {
      store.getState().addMessage({
        role: 'assistant',
        content: 'Here are the results',
        sql: 'SELECT * FROM flows',
        suggestedPivots: ['Show exploits', 'Filter by IP'],
      });
      const msg = store.getState().messages[0];
      expect(msg.sql).toBe('SELECT * FROM flows');
      expect(msg.suggestedPivots).toEqual(['Show exploits', 'Filter by IP']);
    });
  });

  describe('setIsLoading', () => {
    it('sets loading state', () => {
      store.getState().setIsLoading(true);
      expect(store.getState().isLoading).toBe(true);
    });

    it('clears loading state', () => {
      store.getState().setIsLoading(true);
      store.getState().setIsLoading(false);
      expect(store.getState().isLoading).toBe(false);
    });
  });

  describe('clearChat', () => {
    it('clears all messages', () => {
      store.getState().addMessage({ role: 'user', content: 'One' });
      store.getState().addMessage({ role: 'assistant', content: 'Two' });
      store.getState().clearChat();
      expect(store.getState().messages).toEqual([]);
    });
  });

  describe('message windowing', () => {
    it('keeps only the most recent 100 messages', () => {
      // Add 105 messages
      for (let i = 0; i < 105; i++) {
        store.getState().addMessage({ role: 'user', content: `Message ${i}` });
      }

      const messages = store.getState().messages;

      // Should only have 100 messages (windowed)
      expect(messages).toHaveLength(100);

      // Should keep the most recent messages (5-104, not 0-99)
      expect(messages[0].content).toBe('Message 5');
      expect(messages[99].content).toBe('Message 104');
    });

    it('does not trim messages when under the limit', () => {
      // Add 50 messages
      for (let i = 0; i < 50; i++) {
        store.getState().addMessage({ role: 'user', content: `Message ${i}` });
      }

      const messages = store.getState().messages;

      // Should keep all 50 messages
      expect(messages).toHaveLength(50);
      expect(messages[0].content).toBe('Message 0');
    });
  });
});
