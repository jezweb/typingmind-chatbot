// Test utilities for widget testing

export function createMockShadowRoot() {
  const shadowRoot = document.createElement('div');
  shadowRoot.host = document.createElement('div');
  shadowRoot.mode = 'open';
  
  // Add shadow DOM methods
  const originalQuerySelector = shadowRoot.querySelector;
  const originalQuerySelectorAll = shadowRoot.querySelectorAll;
  
  shadowRoot.querySelector = function(selector) {
    return originalQuerySelector.call(this, selector);
  };
  
  shadowRoot.querySelectorAll = function(selector) {
    return originalQuerySelectorAll.call(this, selector);
  };
  
  shadowRoot.getElementById = function(id) {
    return this.querySelector(`#${id}`);
  };
  
  return shadowRoot;
}

export function mockFetch(response, options = {}) {
  const mockResponse = {
    ok: true,
    status: 200,
    headers: new Headers(),
    json: async () => response,
    text: async () => JSON.stringify(response),
    body: options.stream ? createMockStream(response) : null,
    ...options
  };
  
  global.fetch.mockResolvedValueOnce(mockResponse);
  return mockResponse;
}

export function mockFetchError(error) {
  global.fetch.mockRejectedValueOnce(error);
}

export function createMockStream(chunks) {
  let index = 0;
  const encoder = new TextEncoder();
  
  return {
    getReader() {
      return {
        async read() {
          if (index >= chunks.length) {
            return { done: true };
          }
          
          const chunk = chunks[index++];
          return {
            done: false,
            value: encoder.encode(typeof chunk === 'string' ? chunk : JSON.stringify(chunk))
          };
        },
        
        releaseLock() {}
      };
    }
  };
}

export function waitFor(condition, timeout = 1000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const check = () => {
      if (condition()) {
        resolve();
      } else if (Date.now() - startTime > timeout) {
        reject(new Error('Timeout waiting for condition'));
      } else {
        setTimeout(check, 10);
      }
    };
    
    check();
  });
}

export function createMockConfig(overrides = {}) {
  return {
    instanceId: 'test-instance',
    apiUrl: 'http://localhost:8787',
    position: 'bottom-right',
    width: 380,
    embedMode: 'popup',
    theme: {
      primaryColor: '#007bff',
      fontFamily: 'inherit',
      borderRadius: '8px'
    },
    features: {
      markdown: true,
      persistSession: false
    },
    ...overrides
  };
}

export function createMockAgentInfo(overrides = {}) {
  return {
    name: 'Test Agent',
    typingmindAgentId: 'test-agent-123',
    themes: {
      primaryColor: '#28a745',
      position: 'bottom-right',
      width: 400,
      embedMode: 'popup'
    },
    features: {
      markdown: true,
      persistSession: true
    },
    ...overrides
  };
}

export function createMockMessage(role, content, overrides = {}) {
  return {
    role,
    content,
    timestamp: new Date().toISOString(),
    ...overrides
  };
}

export function triggerEvent(element, eventType, options = {}) {
  const event = new Event(eventType, { bubbles: true, ...options });
  Object.assign(event, options);
  element.dispatchEvent(event);
  return event;
}

export function getByTestId(container, testId) {
  return container.querySelector(`[data-testid="${testId}"]`);
}

export function getAllByTestId(container, testId) {
  return Array.from(container.querySelectorAll(`[data-testid="${testId}"]`));
}