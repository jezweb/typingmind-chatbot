/**
 * Tests for DOM utility functions
 */

import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { DomUtils } from './dom-utils.js';

describe('DomUtils', () => {
  describe('createShadowRoot', () => {
    test('should create shadow root with default closed mode', () => {
      const element = document.createElement('div');
      const attachShadowSpy = jest.spyOn(element, 'attachShadow');
      
      DomUtils.createShadowRoot(element);
      
      expect(attachShadowSpy).toHaveBeenCalledWith({ mode: 'closed' });
    });
    
    test('should create shadow root with specified mode', () => {
      const element = document.createElement('div');
      const attachShadowSpy = jest.spyOn(element, 'attachShadow');
      
      DomUtils.createShadowRoot(element, 'open');
      
      expect(attachShadowSpy).toHaveBeenCalledWith({ mode: 'open' });
    });
  });

  describe('createElement', () => {
    test('should create element with tag name', () => {
      const element = DomUtils.createElement('div');
      
      expect(element).toBeTruthy();
      expect(element.tagName).toBe('DIV');
    });
    
    test('should set className attribute', () => {
      const element = DomUtils.createElement('div', { className: 'test-class' });
      
      expect(element.className).toBe('test-class');
    });
    
    test('should set innerHTML', () => {
      const element = DomUtils.createElement('div', { innerHTML: '<span>Test</span>' });
      
      expect(element.innerHTML).toBe('<span>Test</span>');
    });
    
    test('should set textContent', () => {
      const element = DomUtils.createElement('div', { textContent: 'Test content' });
      
      expect(element.textContent).toBe('Test content');
    });
    
    test('should set other attributes', () => {
      const element = DomUtils.createElement('button', {
        'aria-label': 'Click me',
        'data-id': '123',
        'disabled': 'true'
      });
      
      expect(element.getAttribute('aria-label')).toBe('Click me');
      expect(element.getAttribute('data-id')).toBe('123');
      expect(element.getAttribute('disabled')).toBe('true');
    });
    
    test('should add content as text if no innerHTML/textContent specified', () => {
      const element = DomUtils.createElement('div', {}, 'Hello World');
      
      expect(element.textContent).toBe('Hello World');
    });
    
    test('should prioritize innerHTML over content parameter', () => {
      const element = DomUtils.createElement('div', { innerHTML: '<b>Bold</b>' }, 'Plain text');
      
      expect(element.innerHTML).toBe('<b>Bold</b>');
    });
  });

  describe('addStylesToShadowRoot', () => {
    let shadowRoot;
    
    beforeEach(() => {
      shadowRoot = document.createElement('div');
      shadowRoot.appendChild = jest.fn();
    });
    
    test('should create style element with content', () => {
      const css = '.test { color: red; }';
      DomUtils.addStylesToShadowRoot(shadowRoot, css);
      
      expect(shadowRoot.appendChild).toHaveBeenCalled();
      
      const styleElement = shadowRoot.appendChild.mock.calls[0][0];
      expect(styleElement.tagName).toBe('STYLE');
      expect(styleElement.textContent).toBe(css);
    });
  });

  describe('querySelector', () => {
    test('should return element if found', () => {
      const parent = document.createElement('div');
      const child = document.createElement('span');
      child.className = 'test';
      parent.appendChild(child);
      
      const result = DomUtils.querySelector(parent, '.test');
      expect(result).toBe(child);
    });
    
    test('should return null if parent is null', () => {
      const result = DomUtils.querySelector(null, '.test');
      expect(result).toBeNull();
    });
    
    test('should return null if element not found', () => {
      const parent = document.createElement('div');
      const result = DomUtils.querySelector(parent, '.missing');
      expect(result).toBeNull();
    });
  });

  describe('querySelectorAll', () => {
    test('should return array of elements', () => {
      const parent = document.createElement('div');
      parent.innerHTML = '<span class="test">1</span><span class="test">2</span>';
      
      const results = DomUtils.querySelectorAll(parent, '.test');
      expect(results).toHaveLength(2);
      expect(Array.isArray(results)).toBe(true);
    });
    
    test('should return empty array if parent is null', () => {
      const results = DomUtils.querySelectorAll(null, '.test');
      expect(results).toEqual([]);
    });
  });

  describe('addEventListener', () => {
    test('should add event listener and return cleanup function', () => {
      const element = document.createElement('button');
      const handler = jest.fn();
      
      const cleanup = DomUtils.addEventListener(element, 'click', handler);
      
      element.click();
      expect(handler).toHaveBeenCalled();
      
      cleanup();
      handler.mockClear();
      
      element.click();
      expect(handler).not.toHaveBeenCalled();
    });
    
    test('should return null if element is null', () => {
      const cleanup = DomUtils.addEventListener(null, 'click', jest.fn());
      expect(cleanup).toBeNull();
    });
  });

  describe('addEventListeners', () => {
    test('should add multiple event listeners', () => {
      const element = document.createElement('div');
      const clickHandler = jest.fn();
      const mouseoverHandler = jest.fn();
      
      const cleanup = DomUtils.addEventListeners(element, {
        click: clickHandler,
        mouseover: mouseoverHandler
      });
      
      element.click();
      element.dispatchEvent(new Event('mouseover'));
      
      expect(clickHandler).toHaveBeenCalled();
      expect(mouseoverHandler).toHaveBeenCalled();
      
      cleanup();
      clickHandler.mockClear();
      mouseoverHandler.mockClear();
      
      element.click();
      element.dispatchEvent(new Event('mouseover'));
      
      expect(clickHandler).not.toHaveBeenCalled();
      expect(mouseoverHandler).not.toHaveBeenCalled();
    });
  });

  describe('removeElement', () => {
    test('should remove element from DOM', () => {
      const parent = document.createElement('div');
      const child = document.createElement('span');
      parent.appendChild(child);
      
      expect(parent.contains(child)).toBe(true);
      
      DomUtils.removeElement(child);
      
      expect(parent.contains(child)).toBe(false);
    });
    
    test('should handle null element', () => {
      expect(() => {
        DomUtils.removeElement(null);
      }).not.toThrow();
    });
  });

  describe('clearElement', () => {
    test('should clear element content', () => {
      const element = document.createElement('div');
      element.innerHTML = '<span>Test</span><p>Content</p>';
      
      DomUtils.clearElement(element);
      
      expect(element.innerHTML).toBe('');
    });
    
    test('should handle null element', () => {
      expect(() => {
        DomUtils.clearElement(null);
      }).not.toThrow();
    });
  });

  describe('setCSSVariables', () => {
    test('should set CSS variables on element', () => {
      const element = document.createElement('div');
      const setPropertySpy = jest.spyOn(element.style, 'setProperty');
      
      DomUtils.setCSSVariables(element, {
        '--color': 'red',
        '--size': '10px'
      });
      
      expect(setPropertySpy).toHaveBeenCalledWith('--color', 'red');
      expect(setPropertySpy).toHaveBeenCalledWith('--size', '10px');
    });
    
    test('should handle null element', () => {
      expect(() => {
        DomUtils.setCSSVariables(null, { '--color': 'red' });
      }).not.toThrow();
    });
  });

  describe('getDimensions', () => {
    test('should return element dimensions', () => {
      const element = document.createElement('div');
      Object.defineProperties(element, {
        offsetWidth: { value: 100 },
        offsetHeight: { value: 50 },
        clientWidth: { value: 90 },
        clientHeight: { value: 40 }
      });
      
      const dimensions = DomUtils.getDimensions(element);
      
      expect(dimensions).toEqual({
        width: 100,
        height: 50,
        clientWidth: 90,
        clientHeight: 40
      });
    });
    
    test('should return zeros for null element', () => {
      const dimensions = DomUtils.getDimensions(null);
      expect(dimensions).toEqual({ width: 0, height: 0 });
    });
  });

  describe('isVisible', () => {
    test('should return true for visible element', () => {
      const element = document.createElement('div');
      document.body.appendChild(element);
      
      expect(DomUtils.isVisible(element)).toBe(true);
      
      document.body.removeChild(element);
    });
    
    test('should return false for display none', () => {
      const element = document.createElement('div');
      element.style.display = 'none';
      document.body.appendChild(element);
      
      expect(DomUtils.isVisible(element)).toBe(false);
      
      document.body.removeChild(element);
    });
    
    test('should return false for null element', () => {
      expect(DomUtils.isVisible(null)).toBe(false);
    });
  });

  describe('scrollToBottom', () => {
    test('should set scrollTop to scrollHeight', () => {
      const element = document.createElement('div');
      Object.defineProperty(element, 'scrollHeight', {
        value: 1000,
        configurable: true
      });
      
      DomUtils.scrollToBottom(element);
      
      expect(element.scrollTop).toBe(1000);
    });
    
    test('should handle null element', () => {
      expect(() => {
        DomUtils.scrollToBottom(null);
      }).not.toThrow();
    });
  });

  describe('debounce', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });
    
    afterEach(() => {
      jest.useRealTimers();
    });
    
    test('should debounce function calls', () => {
      const fn = jest.fn();
      const debounced = DomUtils.debounce(fn, 100);
      
      debounced();
      debounced();
      debounced();
      
      expect(fn).not.toHaveBeenCalled();
      
      jest.advanceTimersByTime(100);
      
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('throttle', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });
    
    afterEach(() => {
      jest.useRealTimers();
    });
    
    test('should throttle function calls', () => {
      const fn = jest.fn();
      const throttled = DomUtils.throttle(fn, 100);
      
      throttled();
      throttled();
      throttled();
      
      expect(fn).toHaveBeenCalledTimes(1);
      
      jest.advanceTimersByTime(100);
      
      throttled();
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('isClickOutside', () => {
    test('should return true for click outside element', () => {
      const element = {
        getBoundingClientRect: () => ({
          left: 100,
          right: 200,
          top: 100,
          bottom: 200
        })
      };
      
      const event = { clientX: 50, clientY: 50 };
      expect(DomUtils.isClickOutside(event, element)).toBe(true);
    });
    
    test('should return false for click inside element', () => {
      const element = {
        getBoundingClientRect: () => ({
          left: 100,
          right: 200,
          top: 100,
          bottom: 200
        })
      };
      
      const event = { clientX: 150, clientY: 150 };
      expect(DomUtils.isClickOutside(event, element)).toBe(false);
    });
    
    test('should return true for null element', () => {
      const event = { clientX: 150, clientY: 150 };
      expect(DomUtils.isClickOutside(event, null)).toBe(true);
    });
  });

  describe('createFocusTrap', () => {
    test('should trap focus within element', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <button id="first">First</button>
        <input type="text" id="middle">
        <button id="last">Last</button>
      `;
      
      const cleanup = DomUtils.createFocusTrap(container);
      
      expect(typeof cleanup).toBe('function');
      
      cleanup();
    });
    
    test('should return null for null element', () => {
      const cleanup = DomUtils.createFocusTrap(null);
      expect(cleanup).toBeNull();
    });
  });
});