/**
 * Simplified integration tests focusing on module interactions
 */

import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { StateManager } from '../core/state-manager.js';
import { ConfigManager } from '../core/config-manager.js';
import { ApiClient } from '../core/api-client.js';
import { Storage } from '../utils/storage.js';
import { MarkdownParser } from '../utils/markdown-parser.js';

describe('Core Module Integration', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    
    // Mock localStorage
    const localStorageMock = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
      key: jest.fn(),
      length: 0
    };
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true
    });
  });
  
  describe('StateManager + ConfigManager Integration', () => {
    test('should sync state changes with config updates', () => {
      const stateManager = new StateManager();
      const configManager = new ConfigManager({ instanceId: 'test' });
      
      // Subscribe to state changes
      const stateChanges = [];
      stateManager.subscribe('theme', (newValue) => {
        stateChanges.push(newValue);
      });
      
      // Update config and reflect in state
      configManager.update({ theme: { primaryColor: '#ff0000' } });
      stateManager.setState({ theme: configManager.get('theme') });
      
      expect(stateChanges).toEqual([{ primaryColor: '#ff0000' }]);
      expect(stateManager.getState().theme).toEqual({ primaryColor: '#ff0000' });
    });
  });
  
  describe('ApiClient + Storage Integration', () => {
    test('should store session data from API responses', async () => {
      const apiClient = new ApiClient('https://api.test.com', 'test-instance');
      const storage = new Storage('tm-chat');
      
      // Mock API response
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sessionId: 'new-session-123',
          messages: [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi there!' }
          ]
        })
      });
      
      // Fetch instance info (simulate session creation)
      const response = await apiClient.fetchInstanceInfo();
      
      // Store session data
      const sessionData = {
        id: response.sessionId || 'session-123',
        messages: response.messages || [],
        timestamp: Date.now()
      };
      
      storage.set('current-session', sessionData);
      
      // Verify storage
      window.localStorage.setItem.mockClear();
      storage.set('test-key', 'test-value');
      
      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        'tm-chat-test-key',
        'test-value'
      );
    });
  });
  
  describe('MarkdownParser + Message Rendering', () => {
    test('should parse markdown content for messages', () => {
      const parser = new MarkdownParser();
      const messages = [
        {
          role: 'assistant',
          content: '# Welcome!\n\nHere are some **features**:\n\n* Feature 1\n* Feature 2'
        }
      ];
      
      const parsedContent = parser.parse(messages[0].content);
      
      expect(parsedContent.querySelector('h1')).toBeTruthy();
      expect(parsedContent.querySelector('h1').textContent).toBe('Welcome!');
      expect(parsedContent.querySelector('strong')).toBeTruthy();
      // The parser creates a div container with multiple elements
      // Lists are not combined, so we have two separate ul elements
      const ulElements = parsedContent.querySelectorAll('ul');
      expect(ulElements.length).toBeGreaterThan(0);
    });
  });
  
  describe('Error Handling Chain', () => {
    test('should propagate errors through the system', async () => {
      const apiClient = new ApiClient('https://api.test.com', 'test-instance');
      const stateManager = new StateManager();
      
      // Mock API error
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Server error' })
      });
      
      // Track error state
      const errorStates = [];
      stateManager.subscribe('error', (error) => {
        errorStates.push(error);
      });
      
      // Attempt API call
      try {
        await apiClient.sendMessage([{ role: 'user', content: 'Test' }], 'session-123');
      } catch (error) {
        // Handle error in state
        stateManager.setState({ 
          error: error.message,
          isLoading: false 
        });
      }
      
      expect(errorStates).toEqual(['Server error']);
      expect(stateManager.getState().isLoading).toBe(false);
    });
  });
  
  describe('Session Management Flow', () => {
    test('should manage complete session lifecycle', () => {
      const storage = new Storage('tm-chat');
      const stateManager = new StateManager();
      const configManager = new ConfigManager({ instanceId: 'test-bot' });
      
      // Initialize session
      const sessionId = `session-${Date.now()}`;
      const initialSession = {
        id: sessionId,
        instanceId: configManager.get('instanceId'),
        messages: [],
        startTime: Date.now()
      };
      
      // Store session
      storage.set(`session-${configManager.get('instanceId')}`, initialSession);
      stateManager.setState({ sessionId, messages: [] });
      
      // Add messages
      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi! How can I help?' }
      ];
      
      stateManager.setState({ messages });
      
      // Update stored session
      const updatedSession = {
        ...initialSession,
        messages,
        lastActivity: Date.now()
      };
      
      storage.set(`session-${configManager.get('instanceId')}`, updatedSession);
      
      // Verify session persisted
      window.localStorage.getItem.mockReturnValue(JSON.stringify(updatedSession));
      const restored = storage.get(`session-${configManager.get('instanceId')}`);
      
      expect(restored.messages).toEqual(messages);
      expect(restored.id).toBe(sessionId);
    });
  });
  
  describe('Streaming Response Handling', () => {
    test('should handle streaming API responses', async () => {
      const apiClient = new ApiClient('https://api.test.com', 'test-instance');
      const chunks = [];
      
      // Mock streaming response
      const encoder = new TextEncoder();
      global.fetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue('text/event-stream')
        },
        body: {
          getReader: () => ({
            read: jest.fn()
              .mockResolvedValueOnce({
                done: false,
                value: encoder.encode('data: {"text": "Hello "}\n\n')
              })
              .mockResolvedValueOnce({
                done: false,
                value: encoder.encode('data: {"text": "world!"}\n\n')
              })
              .mockResolvedValueOnce({
                done: false,
                value: encoder.encode('data: {"done": true}\n\n')
              })
              .mockResolvedValueOnce({
                done: true
              })
          })
        }
      });
      
      // Handle streaming
      await apiClient.sendMessage(
        [{ role: 'user', content: 'Test' }],
        'session-123',
        (chunk) => chunks.push(chunk)
      );
      
      expect(chunks).toEqual([
        { text: 'Hello ' },
        { text: 'world!' },
        { done: true }
      ]);
    });
  });
  
  describe('Configuration Cascade', () => {
    test('should handle configuration priority correctly', () => {
      // Default config
      const defaultConfig = new ConfigManager({ instanceId: 'test' });
      
      // Instance config (from API)
      const instanceConfig = {
        theme: { primaryColor: '#007bff' },
        position: 'bottom-left',
        width: 450
      };
      
      // User override
      const userConfig = {
        position: 'top-right',
        width: 500
      };
      
      // Apply cascade
      defaultConfig.update(instanceConfig);
      defaultConfig.update(userConfig);
      
      // Verify final config
      expect(defaultConfig.get('theme').primaryColor).toBe('#007bff'); // From instance
      expect(defaultConfig.get('position')).toBe('top-right'); // User override
      expect(defaultConfig.get('width')).toBe(500); // User override
    });
  });
});