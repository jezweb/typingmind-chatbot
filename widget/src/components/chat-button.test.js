/**
 * Tests for the ChatButton component
 */

import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { ChatButton } from './chat-button.js';

describe('ChatButton', () => {
  let chatButton;
  let mockIcons;
  
  beforeEach(() => {
    mockIcons = {
      chat: '<svg>chat icon</svg>',
      close: '<svg>close icon</svg>',
      minimize: '<svg>minimize icon</svg>',
      send: '<svg>send icon</svg>'
    };
    
    chatButton = new ChatButton('bottom-right', mockIcons);
  });

  describe('constructor', () => {
    test('should initialize with position and icons', () => {
      expect(chatButton.position).toBe('bottom-right');
      expect(chatButton.icons).toBe(mockIcons);
      expect(chatButton.element).toBeNull();
      expect(chatButton.badgeElement).toBeNull();
      expect(chatButton.onClick).toBeNull();
    });
  });

  describe('create', () => {
    test('should create button element with correct structure', () => {
      const button = chatButton.create();
      
      expect(button).toBeTruthy();
      expect(button.tagName).toBe('BUTTON');
      expect(button.className).toBe('tm-chat-button bottom-right');
      expect(button.getAttribute('aria-label')).toBe('Open chat');
      
      // Check for chat icon
      expect(button.innerHTML).toContain('<svg>chat icon</svg>');
      
      // Check for badge element
      const badge = button.querySelector('.tm-badge');
      expect(badge).toBeTruthy();
      expect(badge.style.display).toBe('none');
      expect(badge.textContent).toBe('0');
    });
    
    test('should store references to elements', () => {
      chatButton.create();
      
      expect(chatButton.element).toBeTruthy();
      expect(chatButton.badgeElement).toBeTruthy();
    });
    
    test('should handle click events', () => {
      const onClick = jest.fn();
      chatButton.onClick = onClick;
      
      const button = chatButton.create();
      button.click();
      
      expect(onClick).toHaveBeenCalled();
    });
  });

  describe('updatePosition', () => {
    beforeEach(() => {
      chatButton.create();
    });
    
    test('should update button position', () => {
      chatButton.updatePosition('top-left');
      
      expect(chatButton.position).toBe('top-left');
      expect(chatButton.element.classList.contains('top-left')).toBe(true);
      expect(chatButton.element.classList.contains('bottom-right')).toBe(false);
    });
    
    test('should remove all position classes before adding new one', () => {
      const positions = ['bottom-right', 'bottom-left', 'top-right', 'top-left'];
      
      // Add all position classes manually
      positions.forEach(pos => chatButton.element.classList.add(pos));
      
      chatButton.updatePosition('bottom-left');
      
      // Should only have the new position
      expect(chatButton.element.classList.contains('bottom-left')).toBe(true);
      expect(chatButton.element.classList.contains('bottom-right')).toBe(false);
      expect(chatButton.element.classList.contains('top-right')).toBe(false);
      expect(chatButton.element.classList.contains('top-left')).toBe(false);
    });
    
    test('should handle updatePosition before create', () => {
      const newButton = new ChatButton('bottom-right', mockIcons);
      
      expect(() => {
        newButton.updatePosition('top-left');
      }).not.toThrow();
    });
  });

  describe('show/hide', () => {
    beforeEach(() => {
      chatButton.create();
    });
    
    test('should show button', () => {
      chatButton.element.classList.add('tm-hidden');
      chatButton.show();
      
      expect(chatButton.element.classList.contains('tm-hidden')).toBe(false);
    });
    
    test('should hide button', () => {
      chatButton.hide();
      
      expect(chatButton.element.classList.contains('tm-hidden')).toBe(true);
    });
    
    test('should handle show/hide before create', () => {
      const newButton = new ChatButton('bottom-right', mockIcons);
      
      expect(() => {
        newButton.show();
        newButton.hide();
      }).not.toThrow();
    });
  });

  describe('updateBadgeCount', () => {
    beforeEach(() => {
      chatButton.create();
    });
    
    test('should show badge with count', () => {
      chatButton.updateBadgeCount(5);
      
      expect(chatButton.badgeElement.textContent).toBe('5');
      expect(chatButton.badgeElement.style.display).toBe('block');
    });
    
    test('should hide badge when count is 0', () => {
      chatButton.updateBadgeCount(5);
      chatButton.updateBadgeCount(0);
      
      expect(chatButton.badgeElement.style.display).toBe('none');
    });
    
    test('should show 9+ for counts over 9', () => {
      chatButton.updateBadgeCount(15);
      
      expect(chatButton.badgeElement.textContent).toBe('9+');
    });
    
    test('should handle updateBadgeCount before create', () => {
      const newButton = new ChatButton('bottom-right', mockIcons);
      
      expect(() => {
        newButton.updateBadgeCount(5);
      }).not.toThrow();
    });
  });

  describe('setOnClick', () => {
    test('should set click handler', () => {
      const handler = jest.fn();
      chatButton.setOnClick(handler);
      
      expect(chatButton.onClick).toBe(handler);
    });
    
    test('should update click handler after create', () => {
      chatButton.create();
      
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      
      chatButton.setOnClick(handler1);
      chatButton.element.click();
      expect(handler1).toHaveBeenCalled();
      
      chatButton.setOnClick(handler2);
      chatButton.element.click();
      expect(handler2).toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    test('should remove element from DOM', () => {
      const parent = document.createElement('div');
      chatButton.create();
      parent.appendChild(chatButton.element);
      
      expect(parent.contains(chatButton.element)).toBe(true);
      
      chatButton.destroy();
      
      expect(parent.contains(chatButton.element)).toBe(false);
      expect(chatButton.element).toBeNull();
      expect(chatButton.badgeElement).toBeNull();
    });
    
    test('should handle destroy before create', () => {
      expect(() => {
        chatButton.destroy();
      }).not.toThrow();
    });
  });

  describe('different positions', () => {
    test('should create button with different positions', () => {
      const positions = ['bottom-right', 'bottom-left', 'top-right', 'top-left'];
      
      positions.forEach(position => {
        const button = new ChatButton(position, mockIcons);
        const element = button.create();
        
        expect(element.classList.contains(position)).toBe(true);
      });
    });
  });
});