// DOM Utilities Module
// Helper functions for DOM manipulation and Shadow DOM creation

export class DomUtils {
  // Create shadow root for element
  static createShadowRoot(element, mode = 'closed') {
    return element.attachShadow({ mode });
  }
  
  // Create element with attributes and content
  static createElement(tag, attributes = {}, content = '') {
    const element = document.createElement(tag);
    
    // Set attributes
    Object.entries(attributes).forEach(([key, value]) => {
      if (key === 'className') {
        element.className = value;
      } else if (key === 'innerHTML') {
        element.innerHTML = value;
      } else if (key === 'textContent') {
        element.textContent = value;
      } else {
        element.setAttribute(key, value);
      }
    });
    
    // Add content if provided as string
    if (typeof content === 'string' && content && !attributes.innerHTML && !attributes.textContent) {
      element.textContent = content;
    }
    
    return element;
  }
  
  // Add styles to shadow root
  static addStylesToShadowRoot(shadowRoot, styles) {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    shadowRoot.appendChild(styleSheet);
  }
  
  // Safe query selector
  static querySelector(parent, selector) {
    return parent ? parent.querySelector(selector) : null;
  }
  
  // Safe query selector all
  static querySelectorAll(parent, selector) {
    return parent ? Array.from(parent.querySelectorAll(selector)) : [];
  }
  
  // Add event listener with automatic cleanup
  static addEventListener(element, event, handler, options) {
    if (!element) return null;
    
    element.addEventListener(event, handler, options);
    
    // Return cleanup function
    return () => {
      element.removeEventListener(event, handler, options);
    };
  }
  
  // Add multiple event listeners
  static addEventListeners(element, events) {
    const cleanupFunctions = [];
    
    Object.entries(events).forEach(([event, handler]) => {
      const cleanup = this.addEventListener(element, event, handler);
      if (cleanup) {
        cleanupFunctions.push(cleanup);
      }
    });
    
    // Return cleanup function for all listeners
    return () => {
      cleanupFunctions.forEach(cleanup => cleanup());
    };
  }
  
  // Remove element from DOM
  static removeElement(element) {
    if (element && element.parentNode) {
      element.parentNode.removeChild(element);
    }
  }
  
  // Clear element content
  static clearElement(element) {
    if (element) {
      element.innerHTML = '';
    }
  }
  
  // Set CSS variables on element
  static setCSSVariables(element, variables) {
    if (!element) return;
    
    Object.entries(variables).forEach(([key, value]) => {
      element.style.setProperty(key, value);
    });
  }
  
  // Get element dimensions
  static getDimensions(element) {
    if (!element) return { width: 0, height: 0 };
    
    return {
      width: element.offsetWidth,
      height: element.offsetHeight,
      clientWidth: element.clientWidth,
      clientHeight: element.clientHeight
    };
  }
  
  // Check if element is visible
  static isVisible(element) {
    if (!element) return false;
    
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && 
           style.visibility !== 'hidden' && 
           style.opacity !== '0';
  }
  
  // Scroll element to bottom
  static scrollToBottom(element) {
    if (element) {
      element.scrollTop = element.scrollHeight;
    }
  }
  
  // Create debounced function
  static debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
  
  // Create throttled function
  static throttle(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }
  
  // Check if click is outside element
  static isClickOutside(event, element) {
    if (!element) return true;
    
    const rect = element.getBoundingClientRect();
    return event.clientX < rect.left || 
           event.clientX > rect.right || 
           event.clientY < rect.top || 
           event.clientY > rect.bottom;
  }
  
  // Apply focus trap to element
  static createFocusTrap(element) {
    if (!element) return null;
    
    const focusableElements = element.querySelectorAll(
      'a[href], button, textarea, input[type="text"], input[type="radio"], input[type="checkbox"], select'
    );
    
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];
    
    const trapFocus = (e) => {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === firstFocusable) {
            lastFocusable.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastFocusable) {
            firstFocusable.focus();
            e.preventDefault();
          }
        }
      }
    };
    
    element.addEventListener('keydown', trapFocus);
    
    // Return cleanup function
    return () => {
      element.removeEventListener('keydown', trapFocus);
    };
  }
}