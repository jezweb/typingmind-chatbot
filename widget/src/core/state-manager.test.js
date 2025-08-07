/**
 * Tests for the StateManager module
 */

import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { StateManager } from './state-manager.js';

describe('StateManager', () => {
  let stateManager;
  const instanceId = 'test-instance';

  beforeEach(() => {
    localStorage.clear();
    stateManager = new StateManager(instanceId);
  });

  describe('constructor', () => {
    test('should initialize with default state', () => {
      const state = stateManager.getState();
      
      expect(state.isOpen).toBe(false);
      expect(state.messages).toEqual([]);
      expect(state.isLoading).toBe(false);
      expect(state.unreadCount).toBe(0);
      expect(state.agentInfo).toBeNull();
      expect(state.renderedMode).toBeNull();
      expect(state.sessionId).toMatch(/^sess_/);
    });

    test('should create new session ID if none exists', () => {
      const sessionId = stateManager.getState().sessionId;
      expect(sessionId).toMatch(/^sess_[0-9a-f-]{36}$/);
      expect(localStorage.getItem(`tm-session-${instanceId}`)).toBe(sessionId);
    });

    test('should reuse existing session ID', () => {
      const existingSessionId = 'sess_existing-123';
      localStorage.setItem(`tm-session-${instanceId}`, existingSessionId);
      
      const newManager = new StateManager(instanceId);
      expect(newManager.getState().sessionId).toBe(existingSessionId);
    });
  });

  describe('generateFallbackUUID', () => {
    test('should generate valid UUID format', () => {
      const uuid = stateManager.generateFallbackUUID();
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });
  });

  describe('setState', () => {
    test('should update state and notify listeners', () => {
      const listener = jest.fn();
      stateManager.subscribe('isOpen', listener);
      
      stateManager.setState({ isOpen: true });
      
      expect(stateManager.getState().isOpen).toBe(true);
      expect(listener).toHaveBeenCalledWith(true, false);
    });

    test('should notify listeners even for same values', () => {
      const listener = jest.fn();
      stateManager.subscribe('isOpen', listener);
      
      // Set same value
      stateManager.setState({ isOpen: false });
      expect(listener).toHaveBeenCalledWith(false, false);
      
      // Set different value
      stateManager.setState({ isOpen: true });
      expect(listener).toHaveBeenCalledWith(true, false);
    });

    test('should update multiple state values', () => {
      stateManager.setState({
        isOpen: true,
        isLoading: true,
        unreadCount: 5
      });
      
      const state = stateManager.getState();
      expect(state.isOpen).toBe(true);
      expect(state.isLoading).toBe(true);
      expect(state.unreadCount).toBe(5);
    });
  });

  describe('subscribe/unsubscribe', () => {
    test('should subscribe to state changes', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      
      stateManager.subscribe('messages', listener1);
      stateManager.subscribe('messages', listener2);
      
      const newMessages = [{ role: 'user', content: 'Hello' }];
      stateManager.setState({ messages: newMessages });
      
      expect(listener1).toHaveBeenCalledWith(newMessages, []);
      expect(listener2).toHaveBeenCalledWith(newMessages, []);
    });

    test('should return unsubscribe function', () => {
      const listener = jest.fn();
      const unsubscribe = stateManager.subscribe('isLoading', listener);
      
      stateManager.setState({ isLoading: true });
      expect(listener).toHaveBeenCalledTimes(1);
      
      unsubscribe();
      
      stateManager.setState({ isLoading: false });
      expect(listener).toHaveBeenCalledTimes(1); // Not called again
    });

    test('should handle multiple subscriptions independently', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      
      const unsub1 = stateManager.subscribe('isOpen', listener1);
      stateManager.subscribe('isOpen', listener2);
      
      unsub1(); // Unsubscribe first listener
      
      stateManager.setState({ isOpen: true });
      
      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).toHaveBeenCalledWith(true, false);
    });
  });

  describe('addMessage', () => {
    test('should add message to state', () => {
      const message = { role: 'user', content: 'Hello' };
      stateManager.addMessage(message);
      
      const messages = stateManager.getState().messages;
      expect(messages).toHaveLength(1);
      expect(messages[0]).toMatchObject(message);
    });

    test('should notify message listeners', () => {
      const listener = jest.fn();
      stateManager.subscribe('messages', listener);
      
      stateManager.addMessage({ role: 'user', content: 'Test' });
      
      expect(listener).toHaveBeenCalled();
      const messages = listener.mock.calls[0][0];
      expect(messages).toHaveLength(1);
    });
  });

  describe('clearState', () => {
    test('should clear all messages and reset state', () => {
      stateManager.addMessage({ role: 'user', content: 'Message 1' });
      stateManager.addMessage({ role: 'assistant', content: 'Message 2' });
      stateManager.setState({ unreadCount: 5, isLoading: true });
      
      expect(stateManager.getState().messages).toHaveLength(2);
      expect(stateManager.getState().unreadCount).toBe(5);
      expect(stateManager.getState().isLoading).toBe(true);
      
      stateManager.clearState();
      
      expect(stateManager.getState().messages).toHaveLength(0);
      expect(stateManager.getState().unreadCount).toBe(0);
      expect(stateManager.getState().isLoading).toBe(false);
    });
  });

  describe('setAgentInfo', () => {
    test('should set agent info', () => {
      const agentInfo = {
        name: 'Test Agent',
        typingmindAgentId: 'agent-123'
      };
      
      stateManager.setAgentInfo(agentInfo);
      
      expect(stateManager.getState().agentInfo).toEqual(agentInfo);
    });
  });

  describe('incrementUnreadCount', () => {
    test('should increment unread count when chat is closed', () => {
      stateManager.setState({ isOpen: false });
      
      stateManager.incrementUnreadCount();
      expect(stateManager.getState().unreadCount).toBe(1);
      
      stateManager.incrementUnreadCount();
      expect(stateManager.getState().unreadCount).toBe(2);
    });

    test('should increment regardless of chat state', () => {
      stateManager.setState({ isOpen: true });
      
      stateManager.incrementUnreadCount();
      expect(stateManager.getState().unreadCount).toBe(1);
      
      stateManager.incrementUnreadCount();
      expect(stateManager.getState().unreadCount).toBe(2);
    });
  });

  describe('resetUnreadCount', () => {
    test('should reset unread count to zero', () => {
      stateManager.setState({ unreadCount: 5 });
      
      stateManager.resetUnreadCount();
      
      expect(stateManager.getState().unreadCount).toBe(0);
    });
  });

  describe('setOpen', () => {
    test('should set open state and reset unread count', () => {
      stateManager.setState({ unreadCount: 5 });
      
      stateManager.setOpen(true);
      
      expect(stateManager.getState().isOpen).toBe(true);
      expect(stateManager.getState().unreadCount).toBe(0);
    });
    
    test('should not reset unread count when closing', () => {
      stateManager.setState({ unreadCount: 5 });
      
      stateManager.setOpen(false);
      
      expect(stateManager.getState().isOpen).toBe(false);
      expect(stateManager.getState().unreadCount).toBe(5);
    });
  });

  describe('loadMessages and saveMessages', () => {
    test('should save and load messages from localStorage', () => {
      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' }
      ];
      
      stateManager.setState({ messages });
      stateManager.saveMessages();
      
      // Create new instance to test loading
      const newManager = new StateManager(instanceId);
      const loaded = newManager.loadMessages();
      
      expect(loaded).toEqual(messages);
      expect(newManager.getState().messages).toEqual(messages);
    });
    
    test('should limit saved messages to 50', () => {
      // Create 60 messages
      const messages = Array.from({ length: 60 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`
      }));
      
      stateManager.setState({ messages });
      stateManager.saveMessages();
      
      const saved = JSON.parse(localStorage.getItem(`tm-messages-${instanceId}`));
      expect(saved).toHaveLength(50);
      expect(saved[0].content).toBe('Message 10'); // First of last 50
      expect(saved[49].content).toBe('Message 59'); // Last message
    });
  });
});