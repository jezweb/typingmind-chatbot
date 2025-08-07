/**
 * Tests for the InputArea component
 */

import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { InputArea } from './input-area.js';

describe('InputArea', () => {
  let inputArea;
  let mockIcons;
  
  beforeEach(() => {
    mockIcons = {
      chat: '<svg>chat icon</svg>',
      close: '<svg>close icon</svg>',
      minimize: '<svg>minimize icon</svg>',
      send: '<svg>send icon</svg>'
    };
    
    inputArea = new InputArea(mockIcons);
  });

  describe('constructor', () => {
    test('should initialize with icons', () => {
      expect(inputArea.icons).toBe(mockIcons);
      expect(inputArea.element).toBeNull();
      expect(inputArea.textareaElement).toBeNull();
      expect(inputArea.sendButtonElement).toBeNull();
      expect(inputArea.onSend).toBeNull();
    });
  });

  describe('create', () => {
    test('should create input area element', () => {
      const element = inputArea.create();
      
      expect(element).toBeTruthy();
      expect(element.tagName).toBe('DIV');
      expect(element.className).toBe('tm-input-area');
      
      // Check textarea
      const textarea = element.querySelector('.tm-input');
      expect(textarea).toBeTruthy();
      expect(textarea.placeholder).toBe('Type your message...');
      expect(textarea.getAttribute('aria-label')).toBe('Type your message');
      expect(textarea.rows).toBe(1);
      
      // Check send button
      const sendButton = element.querySelector('.tm-send-button');
      expect(sendButton).toBeTruthy();
      expect(sendButton.getAttribute('aria-label')).toBe('Send message');
      expect(sendButton.innerHTML).toContain('<svg>send icon</svg>');
    });
    
    test('should store references to elements', () => {
      inputArea.create();
      
      expect(inputArea.element).toBeTruthy();
      expect(inputArea.textareaElement).toBeTruthy();
      expect(inputArea.sendButtonElement).toBeTruthy();
    });
  });

  describe('event listeners', () => {
    beforeEach(() => {
      inputArea.create();
    });
    
    test('should handle Enter key to send', () => {
      const onSend = jest.fn();
      inputArea.setOnSend(onSend);
      
      inputArea.textareaElement.value = 'Test message';
      
      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        shiftKey: false
      });
      event.preventDefault = jest.fn();
      
      inputArea.textareaElement.dispatchEvent(event);
      
      expect(event.preventDefault).toHaveBeenCalled();
      expect(onSend).toHaveBeenCalledWith('Test message');
    });
    
    test('should allow Shift+Enter for new line', () => {
      const onSend = jest.fn();
      inputArea.setOnSend(onSend);
      
      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        shiftKey: true
      });
      event.preventDefault = jest.fn();
      
      inputArea.textareaElement.dispatchEvent(event);
      
      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(onSend).not.toHaveBeenCalled();
    });
    
    test('should handle send button click', () => {
      const onSend = jest.fn();
      inputArea.setOnSend(onSend);
      
      inputArea.textareaElement.value = 'Click send';
      inputArea.sendButtonElement.click();
      
      expect(onSend).toHaveBeenCalledWith('Click send');
    });
    
    test('should auto-resize on input', () => {
      const autoResizeSpy = jest.spyOn(inputArea, 'autoResize');
      
      const event = new Event('input');
      inputArea.textareaElement.dispatchEvent(event);
      
      expect(autoResizeSpy).toHaveBeenCalled();
    });
  });

  describe('handleSend', () => {
    beforeEach(() => {
      inputArea.create();
    });
    
    test('should send trimmed message', () => {
      const onSend = jest.fn();
      inputArea.setOnSend(onSend);
      
      inputArea.textareaElement.value = '  Test message  \n';
      inputArea.handleSend();
      
      expect(onSend).toHaveBeenCalledWith('Test message');
    });
    
    test('should not send empty messages', () => {
      const onSend = jest.fn();
      inputArea.setOnSend(onSend);
      
      inputArea.textareaElement.value = '   ';
      inputArea.handleSend();
      
      expect(onSend).not.toHaveBeenCalled();
    });
    
    test('should do nothing if no onSend handler', () => {
      inputArea.textareaElement.value = 'Test';
      
      expect(() => {
        inputArea.handleSend();
      }).not.toThrow();
    });
  });

  describe('getValue', () => {
    test('should return trimmed input value', () => {
      inputArea.create();
      inputArea.textareaElement.value = '  Test  ';
      
      expect(inputArea.getValue()).toBe('Test');
    });
    
    test('should return empty string before create', () => {
      expect(inputArea.getValue()).toBe('');
    });
  });

  describe('clear', () => {
    beforeEach(() => {
      inputArea.create();
    });
    
    test('should clear textarea value', () => {
      inputArea.textareaElement.value = 'Some text';
      inputArea.clear();
      
      expect(inputArea.textareaElement.value).toBe('');
    });
    
    test('should reset height after clear', () => {
      const autoResizeSpy = jest.spyOn(inputArea, 'autoResize');
      
      inputArea.clear();
      
      expect(autoResizeSpy).toHaveBeenCalled();
    });
    
    test('should handle clear before create', () => {
      const newArea = new InputArea(mockIcons);
      
      expect(() => {
        newArea.clear();
      }).not.toThrow();
    });
  });

  describe('focus', () => {
    test('should focus textarea', () => {
      inputArea.create();
      const focusSpy = jest.spyOn(inputArea.textareaElement, 'focus');
      
      inputArea.focus();
      
      expect(focusSpy).toHaveBeenCalled();
    });
    
    test('should handle focus before create', () => {
      expect(() => {
        inputArea.focus();
      }).not.toThrow();
    });
  });

  describe('setEnabled', () => {
    beforeEach(() => {
      inputArea.create();
    });
    
    test('should enable input and button', () => {
      inputArea.setEnabled(true);
      
      expect(inputArea.textareaElement.disabled).toBe(false);
      expect(inputArea.sendButtonElement.disabled).toBe(false);
    });
    
    test('should disable input and button', () => {
      inputArea.setEnabled(false);
      
      expect(inputArea.textareaElement.disabled).toBe(true);
      expect(inputArea.sendButtonElement.disabled).toBe(true);
    });
    
    test('should handle setEnabled before create', () => {
      const newArea = new InputArea(mockIcons);
      
      expect(() => {
        newArea.setEnabled(true);
      }).not.toThrow();
    });
  });

  describe('autoResize', () => {
    beforeEach(() => {
      inputArea.create();
    });
    
    test('should adjust height based on content', () => {
      // Mock scrollHeight
      Object.defineProperty(inputArea.textareaElement, 'scrollHeight', {
        value: 80,
        configurable: true
      });
      
      inputArea.autoResize();
      
      expect(inputArea.textareaElement.style.height).toBe('80px');
    });
    
    test('should limit height to maximum', () => {
      // Mock scrollHeight larger than max
      Object.defineProperty(inputArea.textareaElement, 'scrollHeight', {
        value: 200,
        configurable: true
      });
      
      inputArea.autoResize();
      
      expect(inputArea.textareaElement.style.height).toBe('120px');
    });
    
    test('should handle autoResize before create', () => {
      const newArea = new InputArea(mockIcons);
      
      expect(() => {
        newArea.autoResize();
      }).not.toThrow();
    });
  });

  describe('setOnSend', () => {
    test('should set send handler', () => {
      const handler = jest.fn();
      inputArea.setOnSend(handler);
      
      expect(inputArea.onSend).toBe(handler);
    });
  });

  describe('getHeight', () => {
    test('should return element height', () => {
      inputArea.create();
      
      // Mock offsetHeight
      Object.defineProperty(inputArea.element, 'offsetHeight', {
        value: 60,
        configurable: true
      });
      
      expect(inputArea.getHeight()).toBe(60);
    });
    
    test('should return 0 before create', () => {
      expect(inputArea.getHeight()).toBe(0);
    });
  });

  describe('destroy', () => {
    test('should remove element from DOM', () => {
      const parent = document.createElement('div');
      inputArea.create();
      parent.appendChild(inputArea.element);
      
      expect(parent.contains(inputArea.element)).toBe(true);
      
      inputArea.destroy();
      
      expect(parent.contains(inputArea.element)).toBe(false);
      expect(inputArea.element).toBeNull();
      expect(inputArea.textareaElement).toBeNull();
      expect(inputArea.sendButtonElement).toBeNull();
    });
    
    test('should handle destroy before create', () => {
      expect(() => {
        inputArea.destroy();
      }).not.toThrow();
    });
  });

  describe('accessibility', () => {
    beforeEach(() => {
      inputArea.create();
    });
    
    test('should have proper ARIA labels', () => {
      expect(inputArea.textareaElement.getAttribute('aria-label')).toBe('Type your message');
      expect(inputArea.sendButtonElement.getAttribute('aria-label')).toBe('Send message');
    });
  });
});