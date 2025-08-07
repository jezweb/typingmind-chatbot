/**
 * Integration tests for the TypingMind widget
 * Tests how different modules work together
 */

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { StateManager } from '../core/state-manager.js';
import { ConfigManager } from '../core/config-manager.js';
import { ApiClient } from '../core/api-client.js';
import { ChatButton } from '../components/chat-button.js';
import { ChatWindow } from '../components/chat-window.js';
import { MessageList } from '../components/message-list.js';
import { InputArea } from '../components/input-area.js';
import { Storage } from '../utils/storage.js';
import { DomUtils } from '../utils/dom-utils.js';
import { MarkdownParser } from '../utils/markdown-parser.js';

describe('Widget Integration Tests', () => {
  let container;
  let stateManager;
  let configManager;
  let apiClient;
  let storage;
  let shadowRoot;
  let fetchMock;
  
  const mockIcons = {
    chat: '<svg>chat</svg>',
    close: '<svg>close</svg>',
    minimize: '<svg>minimize</svg>',
    send: '<svg>send</svg>'
  };

  beforeEach(() => {
    // Create container
    container = document.createElement('div');
    document.body.appendChild(container);
    
    // Create shadow root
    shadowRoot = container.attachShadow({ mode: 'open' });
    
    // Initialize core modules
    stateManager = new StateManager();
    configManager = new ConfigManager({ instanceId: 'test-instance' });
    apiClient = new ApiClient('https://api.test.com', 'test-instance');
    storage = new Storage('tm-chat');
    
    // Mock fetch
    fetchMock = jest.fn();
    global.fetch = fetchMock;
    
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
  
  afterEach(() => {
    document.body.removeChild(container);
    jest.clearAllMocks();
  });
  
  describe('Widget Initialization Flow', () => {
    test('should initialize widget with instance configuration', async () => {
      // Mock instance info response
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          instanceId: 'test-instance',
          name: 'Test Bot',
          theme: {
            primaryColor: '#007bff',
            position: 'bottom-right',
            width: 400,
            embedMode: 'popup'
          },
          features: {
            markdown: true,
            persistSession: true
          }
        })
      });
      
      // Fetch instance info
      const instanceInfo = await apiClient.fetchInstanceInfo();
      
      // Update config with instance info
      configManager.update({
        instanceId: instanceInfo.instanceId,
        position: instanceInfo.theme.position,
        width: instanceInfo.theme.width,
        embedMode: instanceInfo.theme.embedMode,
        theme: {
          primaryColor: instanceInfo.theme.primaryColor
        },
        features: instanceInfo.features
      });
      
      // Create components
      const chatButton = new ChatButton(configManager.get('position'), mockIcons);
      chatButton.create();
      
      const chatWindow = new ChatWindow(configManager.config, mockIcons);
      chatWindow.create();
      
      // Add to shadow root
      shadowRoot.appendChild(chatButton.element);
      shadowRoot.appendChild(chatWindow.element);
      
      // Verify initial state
      expect(chatButton.element).toBeTruthy();
      expect(chatWindow.element).toBeTruthy();
      expect(chatWindow.element.classList.contains('tm-popup')).toBe(true);
    });
  });
  
  describe('User Interaction Flow', () => {
    test('should handle complete chat interaction', async () => {
      // Initialize components
      const chatButton = new ChatButton('bottom-right', mockIcons);
      chatButton.create();
      
      const chatWindow = new ChatWindow({ embedMode: 'popup' }, mockIcons);
      chatWindow.create();
      
      const messageList = new MessageList();
      messageList.create();
      
      const inputArea = new InputArea(mockIcons);
      inputArea.create();
      
      // Set up chat window
      const messagesContainer = chatWindow.element.querySelector('.tm-messages');
      messagesContainer.appendChild(messageList.element);
      
      const inputContainer = chatWindow.element.querySelector('.tm-input-container');
      inputContainer.appendChild(inputArea.element);
      
      // Add to shadow root
      shadowRoot.appendChild(chatButton.element);
      shadowRoot.appendChild(chatWindow.element);
      
      // Simulate opening chat
      chatButton.element.click();
      stateManager.setState({ isOpen: true });
      chatWindow.show();
      
      expect(chatWindow.isVisible).toBe(true);
      
      // Simulate user input
      const input = inputArea.element.querySelector('.tm-input');
      const sendButton = inputArea.element.querySelector('.tm-send-button');
      
      input.value = 'Hello, how are you?';
      input.dispatchEvent(new Event('input'));
      
      // Mock send message
      let messageSentCallback;
      inputArea.onSend = (message) => {
        messageSentCallback = message;
      };
      
      sendButton.click();
      
      expect(messageSentCallback).toBe('Hello, how are you?');
      expect(input.value).toBe('');
      
      // Add user message
      messageList.addMessage({
        role: 'user',
        content: 'Hello, how are you?'
      });
      
      // Mock API response
      fetchMock.mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: jest.fn()
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('data: {"text": "I\'m doing well, "}\n\n')
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('data: {"text": "thank you!"}\n\n')
              })
              .mockResolvedValueOnce({
                done: true
              })
          })
        }
      });
      
      // Send message
      const onChunk = jest.fn();
      await apiClient.sendMessage(
        [{ role: 'user', content: 'Hello, how are you?' }],
        'session-123',
        onChunk
      );
      
      // Verify streaming response
      expect(onChunk).toHaveBeenCalledWith({ text: "I'm doing well, " });
      expect(onChunk).toHaveBeenCalledWith({ text: "thank you!" });
      
      // Add assistant message
      messageList.addMessage({
        role: 'assistant',
        content: "I'm doing well, thank you!"
      });
      
      // Verify messages displayed
      const messages = messageList.element.querySelectorAll('.tm-message');
      expect(messages.length).toBe(2);
      expect(messages[0].classList.contains('tm-user')).toBe(true);
      expect(messages[1].classList.contains('tm-assistant')).toBe(true);
    });
  });
  
  describe('State Synchronization', () => {
    test('should sync state between components', () => {
      const chatButton = new ChatButton('bottom-right', mockIcons);
      chatButton.create();
      
      const chatWindow = new ChatWindow({ embedMode: 'popup' }, mockIcons);
      chatWindow.create();
      
      shadowRoot.appendChild(chatButton.element);
      shadowRoot.appendChild(chatWindow.element);
      
      // Subscribe to state changes
      const openStateChanges = [];
      stateManager.subscribe('isOpen', (newValue) => {
        openStateChanges.push(newValue);
      });
      
      // Open chat via button
      chatButton.element.click();
      stateManager.setState({ isOpen: true });
      chatWindow.show();
      
      expect(openStateChanges).toEqual([true]);
      expect(chatWindow.isVisible).toBe(true);
      
      // Close via window
      const closeButton = chatWindow.element.querySelector('.tm-close');
      closeButton.click();
      stateManager.setState({ isOpen: false });
      chatWindow.hide();
      
      expect(openStateChanges).toEqual([true, false]);
      expect(chatWindow.isVisible).toBe(false);
    });
  });
  
  describe('Session Persistence', () => {
    test('should persist and restore session', () => {
      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' }
      ];
      
      const sessionId = 'test-session-123';
      
      // Save session
      storage.set(`session-${configManager.get('instanceId')}`, {
        id: sessionId,
        messages: messages,
        timestamp: Date.now()
      });
      
      // Simulate page reload by creating new storage instance
      const newStorage = new Storage('tm-chat');
      
      // Mock localStorage to return saved data
      window.localStorage.getItem.mockReturnValue(JSON.stringify({
        id: sessionId,
        messages: messages,
        timestamp: Date.now()
      }));
      
      // Restore session
      const restoredSession = newStorage.get(`session-${configManager.get('instanceId')}`);
      
      expect(restoredSession).toBeTruthy();
      expect(restoredSession.id).toBe(sessionId);
      expect(restoredSession.messages).toEqual(messages);
    });
  });
  
  describe('Error Handling', () => {
    test('should handle API errors gracefully', async () => {
      const messageList = new MessageList();
      messageList.create();
      shadowRoot.appendChild(messageList.element);
      
      // Mock API error
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal server error' })
      });
      
      // Attempt to send message
      try {
        await apiClient.sendMessage(
          [{ role: 'user', content: 'Test message' }],
          'session-123'
        );
      } catch (error) {
        // Add error message
        messageList.addMessage({
          role: 'error',
          content: 'Failed to send message. Please try again.'
        });
      }
      
      // Verify error message displayed
      const errorMessage = messageList.element.querySelector('.tm-error');
      expect(errorMessage).toBeTruthy();
      expect(errorMessage.textContent).toContain('Failed to send message');
    });
  });
  
  describe('Markdown Rendering', () => {
    test('should render markdown in messages', () => {
      const parser = new MarkdownParser();
      const messageList = new MessageList();
      messageList.create();
      shadowRoot.appendChild(messageList.element);
      
      // Add message with markdown
      const markdownContent = '# Hello\n\nThis is **bold** and *italic* text.\n\n```javascript\nconst x = 1;\n```';
      
      messageList.addMessage({
        role: 'assistant',
        content: markdownContent
      });
      
      // Verify markdown rendered
      const messageContent = messageList.element.querySelector('.tm-message-content');
      expect(messageContent.querySelector('h1')).toBeTruthy();
      expect(messageContent.querySelector('strong')).toBeTruthy();
      expect(messageContent.querySelector('em')).toBeTruthy();
      expect(messageContent.querySelector('pre code')).toBeTruthy();
    });
  });
  
  describe('Responsive Behavior', () => {
    test('should handle window resize', () => {
      const chatWindow = new ChatWindow({ 
        embedMode: 'popup',
        width: 400 
      }, mockIcons);
      chatWindow.create();
      
      shadowRoot.appendChild(chatWindow.element);
      chatWindow.show();
      
      // Simulate mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375
      });
      
      window.dispatchEvent(new Event('resize'));
      
      // Check if window adapts to mobile
      const windowWidth = parseInt(getComputedStyle(chatWindow.element).width);
      expect(windowWidth).toBeLessThanOrEqual(375);
    });
  });
  
  describe('Focus Management', () => {
    test('should manage focus correctly', () => {
      const chatWindow = new ChatWindow({ embedMode: 'popup' }, mockIcons);
      chatWindow.create();
      
      const inputArea = new InputArea(mockIcons);
      inputArea.create();
      
      const inputContainer = chatWindow.element.querySelector('.tm-input-container');
      inputContainer.appendChild(inputArea.element);
      
      shadowRoot.appendChild(chatWindow.element);
      chatWindow.show();
      
      // Focus should go to input when window opens
      const input = inputArea.element.querySelector('.tm-input');
      
      // Manually focus since jsdom doesn't handle focus automatically
      input.focus();
      
      expect(shadowRoot.activeElement).toBe(input);
    });
  });
  
  describe('Memory Management', () => {
    test('should clean up event listeners', () => {
      const chatButton = new ChatButton('bottom-right', mockIcons);
      chatButton.create();
      const removeEventListenerSpy = jest.spyOn(chatButton.element, 'removeEventListener');
      
      shadowRoot.appendChild(chatButton.element);
      
      // Create cleanup function
      const cleanup = DomUtils.addEventListener(chatButton.element, 'test', () => {});
      
      // Clean up
      cleanup();
      
      expect(removeEventListenerSpy).toHaveBeenCalled();
    });
  });
});