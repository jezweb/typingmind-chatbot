// Test setup for widget testing
import { jest } from '@jest/globals';
import '@testing-library/jest-dom';

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => {
      store[key] = value.toString();
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    }
  };
})();

global.localStorage = localStorageMock;

// Mock crypto.randomUUID
global.crypto = {
  randomUUID: () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
};

// Mock fetch
global.fetch = jest.fn();

// Mock shadow DOM attachShadow
Element.prototype.attachShadow = jest.fn(function(init) {
  const shadowRoot = document.createElement('div');
  shadowRoot.host = this;
  shadowRoot.mode = init.mode;
  shadowRoot.innerHTML = '';
  shadowRoot.querySelector = function(selector) {
    return this.querySelector(selector);
  };
  shadowRoot.querySelectorAll = function(selector) {
    return this.querySelectorAll(selector);
  };
  shadowRoot.getElementById = function(id) {
    return this.querySelector(`#${id}`);
  };
  shadowRoot.appendChild = function(child) {
    return HTMLElement.prototype.appendChild.call(this, child);
  };
  shadowRoot.removeChild = function(child) {
    return HTMLElement.prototype.removeChild.call(this, child);
  };
  this._shadowRoot = shadowRoot;
  return shadowRoot;
});

// Add TextEncoder/TextDecoder if not available
if (typeof TextEncoder === 'undefined') {
  global.TextEncoder = class TextEncoder {
    encode(str) {
      const buf = Buffer.from(str, 'utf8');
      const arr = new Uint8Array(buf.length);
      for (let i = 0; i < buf.length; i++) {
        arr[i] = buf[i];
      }
      return arr;
    }
  };
}

if (typeof TextDecoder === 'undefined') {
  global.TextDecoder = class TextDecoder {
    decode(arr, options) {
      if (arr instanceof ArrayBuffer) {
        arr = new Uint8Array(arr);
      }
      return Buffer.from(arr).toString('utf8');
    }
  };
}

// Clean up after each test
global.afterEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  document.body.innerHTML = '';
});