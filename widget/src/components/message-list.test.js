/**
 * Tests for the MessageList component
 */

import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { MessageList } from './message-list.js';

describe('MessageList', () => {
  let messageList;
  
  beforeEach(() => {
    messageList = new MessageList();
  });

  describe('constructor', () => {
    test('should initialize with empty state', () => {
      expect(messageList.element).toBeNull();
      expect(messageList.messages).toEqual([]);
      expect(messageList.loadingElement).toBeNull();
    });
  });

  describe('create', () => {
    test('should create messages container element', () => {
      const element = messageList.create();
      
      expect(element).toBeTruthy();
      expect(element.tagName).toBe('DIV');
      expect(element.className).toBe('tm-messages');
      expect(element.getAttribute('role')).toBe('log');
      expect(element.getAttribute('aria-live')).toBe('polite');
      
      // Check welcome message
      const welcome = element.querySelector('.tm-welcome');
      expect(welcome).toBeTruthy();
      expect(welcome.textContent).toContain('Hi! How can I help you today?');
    });
    
    test('should store reference to element', () => {
      messageList.create();
      expect(messageList.element).toBeTruthy();
    });
  });

  describe('clear', () => {
    beforeEach(() => {
      messageList.create();
      messageList.addMessage({ role: 'user', content: 'Test', timestamp: Date.now() });
    });
    
    test('should clear all messages', () => {
      expect(messageList.messages.length).toBe(1);
      
      messageList.clear();
      
      expect(messageList.element.innerHTML).toBe('');
      expect(messageList.messages).toEqual([]);
    });
    
    test('should handle clear before create', () => {
      const newList = new MessageList();
      
      expect(() => {
        newList.clear();
      }).not.toThrow();
    });
  });

  describe('addMessage', () => {
    beforeEach(() => {
      messageList.create();
    });
    
    test('should add user message', () => {
      const message = { 
        role: 'user', 
        content: 'Hello world',
        timestamp: Date.now() 
      };
      
      messageList.addMessage(message);
      
      expect(messageList.messages.length).toBe(1);
      expect(messageList.messages[0].message).toEqual(message);
      
      const messageEl = messageList.element.querySelector('.tm-message');
      expect(messageEl).toBeTruthy();
      expect(messageEl.classList.contains('tm-message-user')).toBe(true);
      
      const avatar = messageEl.querySelector('.tm-message-avatar');
      expect(avatar.textContent).toBe('U');
      
      const content = messageEl.querySelector('.tm-message-content');
      expect(content.textContent).toContain('Hello world');
    });
    
    test('should add assistant message', () => {
      const message = { 
        role: 'assistant', 
        content: 'Hi there!',
        timestamp: Date.now() 
      };
      
      messageList.addMessage(message);
      
      const messageEl = messageList.element.querySelector('.tm-message');
      expect(messageEl.classList.contains('tm-message-assistant')).toBe(true);
      
      const avatar = messageEl.querySelector('.tm-message-avatar');
      expect(avatar.textContent).toBe('B');
    });
    
    test('should remove welcome message on first message', () => {
      expect(messageList.element.querySelector('.tm-welcome')).toBeTruthy();
      
      messageList.addMessage({ 
        role: 'user', 
        content: 'Test',
        timestamp: Date.now() 
      });
      
      expect(messageList.element.querySelector('.tm-welcome')).toBeFalsy();
    });
    
    test('should scroll to bottom after adding message', () => {
      const scrollToBottomSpy = jest.spyOn(messageList, 'scrollToBottom');
      
      messageList.addMessage({ 
        role: 'user', 
        content: 'Test',
        timestamp: Date.now() 
      });
      
      expect(scrollToBottomSpy).toHaveBeenCalled();
    });
    
    test('should handle addMessage before create', () => {
      const newList = new MessageList();
      
      expect(() => {
        newList.addMessage({ role: 'user', content: 'Test', timestamp: Date.now() });
      }).not.toThrow();
    });
  });

  describe('updateMessage', () => {
    beforeEach(() => {
      messageList.create();
      messageList.addMessage({ 
        role: 'assistant', 
        content: 'Initial content',
        timestamp: Date.now() 
      });
    });
    
    test('should update existing message', () => {
      const updatedMessage = {
        role: 'assistant',
        content: 'Updated content',
        timestamp: Date.now()
      };
      
      messageList.updateMessage(0, updatedMessage);
      
      expect(messageList.messages[0].message).toEqual(updatedMessage);
      
      const contentEl = messageList.element.querySelector('.tm-message-content');
      expect(contentEl.textContent).toContain('Updated content');
    });
    
    test('should handle invalid index', () => {
      expect(() => {
        messageList.updateMessage(-1, { content: 'Test' });
        messageList.updateMessage(5, { content: 'Test' });
      }).not.toThrow();
    });
    
    test('should scroll to bottom after update', () => {
      const scrollToBottomSpy = jest.spyOn(messageList, 'scrollToBottom');
      
      messageList.updateMessage(0, {
        role: 'assistant',
        content: 'Updated',
        timestamp: Date.now()
      });
      
      expect(scrollToBottomSpy).toHaveBeenCalled();
    });
  });

  describe('formatMessage', () => {
    beforeEach(() => {
      messageList.create();
    });
    
    test('should format plain text', () => {
      const container = messageList.formatMessage('Plain text message');
      
      expect(container.tagName).toBe('DIV');
      expect(container.querySelector('p').textContent).toBe('Plain text message');
    });
    
    test('should handle multiple paragraphs', () => {
      const container = messageList.formatMessage('First paragraph\n\nSecond paragraph');
      
      const paragraphs = container.querySelectorAll('p');
      expect(paragraphs.length).toBe(2);
      expect(paragraphs[0].textContent).toBe('First paragraph');
      expect(paragraphs[1].textContent).toBe('Second paragraph');
    });
    
    test('should parse bold markdown', () => {
      const container = messageList.formatMessage('This is **bold** text');
      
      const strong = container.querySelector('strong');
      expect(strong).toBeTruthy();
      expect(strong.textContent).toBe('bold');
    });
    
    test('should parse italic markdown', () => {
      const container = messageList.formatMessage('This is *italic* text');
      
      const em = container.querySelector('em');
      expect(em).toBeTruthy();
      expect(em.textContent).toBe('italic');
    });
    
    test('should parse code markdown', () => {
      const container = messageList.formatMessage('This is `code` text');
      
      const code = container.querySelector('code');
      expect(code).toBeTruthy();
      expect(code.textContent).toBe('code');
    });
    
    test('should handle line breaks', () => {
      const container = messageList.formatMessage('Line 1\nLine 2\nLine 3');
      
      const p = container.querySelector('p');
      const brs = p.querySelectorAll('br');
      expect(brs.length).toBe(2);
    });
  });

  describe('showLoading', () => {
    beforeEach(() => {
      messageList.create();
    });
    
    test('should show loading indicator', () => {
      messageList.showLoading();
      
      const loading = messageList.element.querySelector('#tm-loading');
      expect(loading).toBeTruthy();
      expect(loading.classList.contains('tm-message')).toBe(true);
      
      const typing = loading.querySelector('.tm-typing');
      expect(typing).toBeTruthy();
      
      const dots = typing.querySelectorAll('span');
      expect(dots.length).toBe(3);
    });
    
    test('should store reference to loading element', () => {
      messageList.showLoading();
      expect(messageList.loadingElement).toBeTruthy();
    });
    
    test('should scroll to bottom when showing loading', () => {
      const scrollToBottomSpy = jest.spyOn(messageList, 'scrollToBottom');
      
      messageList.showLoading();
      
      expect(scrollToBottomSpy).toHaveBeenCalled();
    });
    
    test('should handle showLoading before create', () => {
      const newList = new MessageList();
      
      expect(() => {
        newList.showLoading();
      }).not.toThrow();
    });
  });

  describe('hideLoading', () => {
    beforeEach(() => {
      messageList.create();
      messageList.showLoading();
    });
    
    test('should remove loading indicator', () => {
      expect(messageList.element.querySelector('#tm-loading')).toBeTruthy();
      
      messageList.hideLoading();
      
      expect(messageList.element.querySelector('#tm-loading')).toBeFalsy();
      expect(messageList.loadingElement).toBeNull();
    });
    
    test('should handle hideLoading when no loading element', () => {
      messageList.hideLoading(); // Already hidden
      
      expect(() => {
        messageList.hideLoading();
      }).not.toThrow();
    });
  });

  describe('showError', () => {
    beforeEach(() => {
      messageList.create();
      jest.useFakeTimers();
    });
    
    afterEach(() => {
      jest.useRealTimers();
    });
    
    test('should show error message', () => {
      messageList.showError('An error occurred');
      
      const error = messageList.element.querySelector('.tm-error');
      expect(error).toBeTruthy();
      expect(error.textContent).toBe('An error occurred');
    });
    
    test('should remove error after 5 seconds', () => {
      messageList.showError('Temporary error');
      
      const error = messageList.element.querySelector('.tm-error');
      expect(error).toBeTruthy();
      
      jest.advanceTimersByTime(5000);
      
      expect(messageList.element.querySelector('.tm-error')).toBeFalsy();
    });
    
    test('should scroll to bottom when showing error', () => {
      const scrollToBottomSpy = jest.spyOn(messageList, 'scrollToBottom');
      
      messageList.showError('Error message');
      
      expect(scrollToBottomSpy).toHaveBeenCalled();
    });
    
    test('should handle showError before create', () => {
      const newList = new MessageList();
      
      expect(() => {
        newList.showError('Test error');
      }).not.toThrow();
    });
  });

  describe('scrollToBottom', () => {
    beforeEach(() => {
      messageList.create();
    });
    
    test('should set scrollTop to scrollHeight', () => {
      Object.defineProperty(messageList.element, 'scrollHeight', {
        value: 1000,
        configurable: true
      });
      
      messageList.scrollToBottom();
      
      expect(messageList.element.scrollTop).toBe(1000);
    });
    
    test('should handle scrollToBottom before create', () => {
      const newList = new MessageList();
      
      expect(() => {
        newList.scrollToBottom();
      }).not.toThrow();
    });
  });

  describe('renderMessages', () => {
    beforeEach(() => {
      messageList.create();
    });
    
    test('should render multiple messages', () => {
      const messages = [
        { role: 'user', content: 'Message 1', timestamp: Date.now() },
        { role: 'assistant', content: 'Message 2', timestamp: Date.now() },
        { role: 'user', content: 'Message 3', timestamp: Date.now() }
      ];
      
      messageList.renderMessages(messages);
      
      expect(messageList.messages.length).toBe(3);
      
      const messageEls = messageList.element.querySelectorAll('.tm-message');
      expect(messageEls.length).toBe(3);
    });
    
    test('should clear existing messages before rendering', () => {
      messageList.addMessage({ role: 'user', content: 'Old', timestamp: Date.now() });
      
      const messages = [
        { role: 'user', content: 'New 1', timestamp: Date.now() },
        { role: 'assistant', content: 'New 2', timestamp: Date.now() }
      ];
      
      messageList.renderMessages(messages);
      
      expect(messageList.messages.length).toBe(2);
    });
  });

  describe('getMessageCount', () => {
    beforeEach(() => {
      messageList.create();
    });
    
    test('should return message count', () => {
      expect(messageList.getMessageCount()).toBe(0);
      
      messageList.addMessage({ role: 'user', content: 'Test 1', timestamp: Date.now() });
      expect(messageList.getMessageCount()).toBe(1);
      
      messageList.addMessage({ role: 'assistant', content: 'Test 2', timestamp: Date.now() });
      expect(messageList.getMessageCount()).toBe(2);
    });
  });

  describe('time formatting', () => {
    beforeEach(() => {
      messageList.create();
    });
    
    test('should format message time', () => {
      const timestamp = new Date('2024-01-01T14:30:00').getTime();
      
      messageList.addMessage({ 
        role: 'user', 
        content: 'Test',
        timestamp 
      });
      
      const timeEl = messageList.element.querySelector('.tm-message-time');
      expect(timeEl).toBeTruthy();
      // Time format depends on locale, just check it exists
      expect(timeEl.textContent).toMatch(/\d{1,2}:\d{2}/);
    });
  });
});