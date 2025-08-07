/**
 * Tests for the ChatWindow component
 */

import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { ChatWindow } from './chat-window.js';

describe('ChatWindow', () => {
  let chatWindow;
  let mockConfig;
  let mockIcons;
  
  beforeEach(() => {
    mockConfig = {
      position: 'bottom-right',
      width: 380,
      height: null,
      embedMode: 'popup',
      agentName: 'Chat Support'
    };
    
    mockIcons = {
      chat: '<svg>chat icon</svg>',
      close: '<svg>close icon</svg>',
      minimize: '<svg>minimize icon</svg>',
      send: '<svg>send icon</svg>'
    };
    
    chatWindow = new ChatWindow(mockConfig, mockIcons);
  });

  describe('constructor', () => {
    test('should initialize with config and icons', () => {
      expect(chatWindow.config).toBe(mockConfig);
      expect(chatWindow.icons).toBe(mockIcons);
      expect(chatWindow.element).toBeNull();
      expect(chatWindow.headerElement).toBeNull();
      expect(chatWindow.titleElement).toBeNull();
      expect(chatWindow.onMinimize).toBeNull();
      expect(chatWindow.onClose).toBeNull();
    });
  });

  describe('create', () => {
    test('should create window element with correct structure', () => {
      const window = chatWindow.create();
      
      expect(window).toBeTruthy();
      expect(window.tagName).toBe('DIV');
      expect(window.className).toBe('tm-chat-window bottom-right');
      
      // Check header exists
      const header = window.querySelector('.tm-header');
      expect(header).toBeTruthy();
      
      // Check title
      const title = window.querySelector('.tm-header-title');
      expect(title).toBeTruthy();
      expect(title.textContent).toBe('Chat Support');
      
      // Check header actions in popup mode
      const minimizeBtn = window.querySelector('.tm-minimize');
      const closeBtn = window.querySelector('.tm-close');
      expect(minimizeBtn).toBeTruthy();
      expect(closeBtn).toBeTruthy();
    });
    
    test('should store references to elements', () => {
      chatWindow.create();
      
      expect(chatWindow.element).toBeTruthy();
      expect(chatWindow.headerElement).toBeTruthy();
      expect(chatWindow.titleElement).toBeTruthy();
    });
    
    test('should create inline mode window', () => {
      const inlineConfig = { ...mockConfig, embedMode: 'inline', height: 600 };
      const inlineWindow = new ChatWindow(inlineConfig, mockIcons);
      
      const window = inlineWindow.create();
      
      expect(window.className).toBe('tm-chat-window tm-inline tm-open');
      expect(window.classList.contains('tm-open')).toBe(true);
      expect(window.style.opacity).toBe('1');
      expect(window.style.transform).toBe('none');
      expect(window.style.position).toBe('relative');
      expect(window.style.width).toBe('100%');
      expect(window.style.height).toBe('600px');
      
      // Should not have minimize/close buttons
      expect(window.querySelector('.tm-minimize')).toBeFalsy();
      expect(window.querySelector('.tm-close')).toBeFalsy();
    });
    
    test('should handle string height in inline mode', () => {
      const inlineConfig = { ...mockConfig, embedMode: 'inline', height: '80%' };
      const inlineWindow = new ChatWindow(inlineConfig, mockIcons);
      
      const window = inlineWindow.create();
      expect(window.style.height).toBe('80%');
    });
  });

  describe('event handlers', () => {
    beforeEach(() => {
      chatWindow.create();
    });
    
    test('should handle minimize button click', () => {
      const onMinimize = jest.fn();
      chatWindow.setOnMinimize(onMinimize);
      
      const minimizeBtn = chatWindow.element.querySelector('.tm-minimize');
      minimizeBtn.click();
      
      expect(onMinimize).toHaveBeenCalled();
    });
    
    test('should handle close button click', () => {
      const onClose = jest.fn();
      chatWindow.setOnClose(onClose);
      
      const closeBtn = chatWindow.element.querySelector('.tm-close');
      closeBtn.click();
      
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('updatePosition', () => {
    beforeEach(() => {
      chatWindow.create();
    });
    
    test('should update window position in popup mode', () => {
      chatWindow.updatePosition('top-left');
      
      expect(chatWindow.element.classList.contains('top-left')).toBe(true);
      expect(chatWindow.element.classList.contains('bottom-right')).toBe(false);
    });
    
    test('should not update position in inline mode', () => {
      const inlineConfig = { ...mockConfig, embedMode: 'inline' };
      const inlineWindow = new ChatWindow(inlineConfig, mockIcons);
      inlineWindow.create();
      
      inlineWindow.updatePosition('top-left');
      
      // Should remain as tm-inline without position classes
      expect(inlineWindow.element.classList.contains('top-left')).toBe(false);
      expect(inlineWindow.element.classList.contains('tm-inline')).toBe(true);
    });
    
    test('should handle updatePosition before create', () => {
      const newWindow = new ChatWindow(mockConfig, mockIcons);
      
      expect(() => {
        newWindow.updatePosition('top-left');
      }).not.toThrow();
    });
  });

  describe('updateTitle', () => {
    beforeEach(() => {
      chatWindow.create();
    });
    
    test('should update window title', () => {
      chatWindow.updateTitle('New Agent Name');
      
      expect(chatWindow.titleElement.textContent).toBe('New Agent Name');
    });
    
    test('should handle updateTitle before create', () => {
      const newWindow = new ChatWindow(mockConfig, mockIcons);
      
      expect(() => {
        newWindow.updateTitle('New Title');
      }).not.toThrow();
    });
  });

  describe('show/hide', () => {
    beforeEach(() => {
      chatWindow.create();
    });
    
    test('should show window', () => {
      chatWindow.show();
      
      expect(chatWindow.element.classList.contains('tm-open')).toBe(true);
    });
    
    test('should hide window in popup mode', () => {
      chatWindow.show();
      chatWindow.hide();
      
      expect(chatWindow.element.classList.contains('tm-open')).toBe(false);
    });
    
    test('should not hide window in inline mode', () => {
      const inlineConfig = { ...mockConfig, embedMode: 'inline' };
      const inlineWindow = new ChatWindow(inlineConfig, mockIcons);
      inlineWindow.create();
      
      inlineWindow.hide();
      
      // Should remain open in inline mode
      expect(inlineWindow.element.classList.contains('tm-open')).toBe(true);
    });
    
    test('should handle show/hide before create', () => {
      const newWindow = new ChatWindow(mockConfig, mockIcons);
      
      expect(() => {
        newWindow.show();
        newWindow.hide();
      }).not.toThrow();
    });
  });

  describe('appendChild', () => {
    beforeEach(() => {
      chatWindow.create();
    });
    
    test('should append child element', () => {
      const child = document.createElement('div');
      child.className = 'test-child';
      
      chatWindow.appendChild(child);
      
      expect(chatWindow.element.querySelector('.test-child')).toBe(child);
    });
    
    test('should handle appendChild before create', () => {
      const newWindow = new ChatWindow(mockConfig, mockIcons);
      const child = document.createElement('div');
      
      expect(() => {
        newWindow.appendChild(child);
      }).not.toThrow();
    });
  });

  describe('getBoundingClientRect', () => {
    test('should return bounding rect', () => {
      chatWindow.create();
      document.body.appendChild(chatWindow.element);
      
      const rect = chatWindow.getBoundingClientRect();
      expect(rect).toBeTruthy();
      expect(rect).toHaveProperty('width');
      expect(rect).toHaveProperty('height');
      
      document.body.removeChild(chatWindow.element);
    });
    
    test('should return null before create', () => {
      expect(chatWindow.getBoundingClientRect()).toBeNull();
    });
  });

  describe('destroy', () => {
    test('should remove element from DOM', () => {
      const parent = document.createElement('div');
      chatWindow.create();
      parent.appendChild(chatWindow.element);
      
      expect(parent.contains(chatWindow.element)).toBe(true);
      
      chatWindow.destroy();
      
      expect(parent.contains(chatWindow.element)).toBe(false);
      expect(chatWindow.element).toBeNull();
      expect(chatWindow.headerElement).toBeNull();
      expect(chatWindow.titleElement).toBeNull();
    });
    
    test('should handle destroy before create', () => {
      expect(() => {
        chatWindow.destroy();
      }).not.toThrow();
    });
  });

  describe('inline mode specific behavior', () => {
    let inlineWindow;
    
    beforeEach(() => {
      const inlineConfig = { ...mockConfig, embedMode: 'inline', height: 500 };
      inlineWindow = new ChatWindow(inlineConfig, mockIcons);
    });
    
    test('should always be visible in inline mode', () => {
      inlineWindow.create();
      
      expect(inlineWindow.element.classList.contains('tm-open')).toBe(true);
      expect(inlineWindow.element.classList.contains('tm-inline')).toBe(true);
    });
    
    test('should handle default height if not specified', () => {
      const noHeightConfig = { ...mockConfig, embedMode: 'inline' };
      const noHeightWindow = new ChatWindow(noHeightConfig, mockIcons);
      noHeightWindow.create();
      
      // Should not set height when not specified
      expect(noHeightWindow.element.style.height).toBe('');
    });
  });
});