/**
 * Tests for Storage utility
 */

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { Storage } from './storage.js';

describe('Storage', () => {
  let storage;
  let mockLocalStorage;
  
  beforeEach(() => {
    // Mock localStorage
    mockLocalStorage = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
      key: jest.fn(),
      length: 0
    };
    
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true
    });
    
    // Create storage instance with test prefix
    storage = new Storage('tm-chat');
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should create storage with prefix', () => {
      expect(storage.prefix).toBe('tm-chat');
    });
    
    test('should check localStorage availability', () => {
      expect(storage.available).toBe(true);
    });
    
    test('should handle localStorage not available', () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('Storage disabled');
      });
      
      const newStorage = new Storage('test');
      expect(newStorage.available).toBe(false);
    });
  });

  describe('get', () => {
    test('should get and parse JSON value', () => {
      const data = { name: 'Test', value: 123 };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(data));
      
      const result = storage.get('test-key');
      
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('tm-chat-test-key');
      expect(result).toEqual(data);
    });
    
    test('should return default value for non-existent key', () => {
      mockLocalStorage.getItem.mockReturnValue(null);
      
      const result = storage.get('missing-key', 'default');
      
      expect(result).toBe('default');
    });
    
    test('should return string value if not valid JSON', () => {
      mockLocalStorage.getItem.mockReturnValue('plain string');
      
      const result = storage.get('string-key');
      
      expect(result).toBe('plain string');
    });
    
    test('should handle localStorage errors', () => {
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('Storage error');
      });
      
      const result = storage.get('error-key');
      
      expect(result).toBeNull();
    });
    
    test('should return default when storage not available', () => {
      storage.available = false;
      
      const result = storage.get('test-key', 'fallback');
      
      expect(result).toBe('fallback');
    });
  });

  describe('set', () => {
    test('should stringify and store object value', () => {
      const data = { name: 'Test', value: 123 };
      
      const success = storage.set('test-key', data);
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'tm-chat-test-key',
        JSON.stringify(data)
      );
      expect(success).toBe(true);
    });
    
    test('should store string values directly', () => {
      const success = storage.set('string-key', 'Hello World');
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'tm-chat-string-key',
        'Hello World'
      );
      expect(success).toBe(true);
    });
    
    test('should store number values as JSON', () => {
      storage.set('number-key', 42);
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'tm-chat-number-key',
        '42'
      );
    });
    
    test('should handle localStorage errors', () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('Storage full');
      });
      
      const success = storage.set('error-key', 'value');
      
      expect(success).toBe(false);
    });
    
    test('should return false when storage not available', () => {
      storage.available = false;
      
      const success = storage.set('test-key', 'value');
      
      expect(success).toBe(false);
    });
  });

  describe('remove', () => {
    test('should remove item by key', () => {
      const success = storage.remove('test-key');
      
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('tm-chat-test-key');
      expect(success).toBe(true);
    });
    
    test('should handle removal errors', () => {
      mockLocalStorage.removeItem.mockImplementation(() => {
        throw new Error('Remove error');
      });
      
      const success = storage.remove('error-key');
      
      expect(success).toBe(false);
    });
    
    test('should return false when storage not available', () => {
      storage.available = false;
      
      const success = storage.remove('test-key');
      
      expect(success).toBe(false);
    });
  });

  describe('clear', () => {
    test('should clear all items with prefix', () => {
      // Mock storage with mixed keys
      const storageKeys = [
        'tm-chat-session-1',
        'tm-chat-messages',
        'other-app-data',
        'tm-chat-config',
        'user-preferences'
      ];
      
      mockLocalStorage.length = storageKeys.length;
      mockLocalStorage.key.mockImplementation((index) => storageKeys[index]);
      
      // Clear any previous mock calls
      mockLocalStorage.removeItem.mockClear();
      
      const success = storage.clear();
      
      // Should only remove tm-chat prefixed keys
      expect(mockLocalStorage.removeItem).toHaveBeenCalledTimes(3);
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('tm-chat-session-1');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('tm-chat-messages');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('tm-chat-config');
      expect(mockLocalStorage.removeItem).not.toHaveBeenCalledWith('other-app-data');
      expect(mockLocalStorage.removeItem).not.toHaveBeenCalledWith('user-preferences');
      expect(success).toBe(true);
    });
    
    test('should handle clear errors', () => {
      mockLocalStorage.length = 1;
      mockLocalStorage.key.mockReturnValue('tm-chat-test');
      mockLocalStorage.removeItem.mockImplementation(() => {
        throw new Error('Clear error');
      });
      
      const success = storage.clear();
      
      expect(success).toBe(false);
    });
    
    test('should return false when storage not available', () => {
      storage.available = false;
      
      const success = storage.clear();
      
      expect(success).toBe(false);
    });
  });

  describe('getFullKey', () => {
    test('should generate full key with prefix', () => {
      const fullKey = storage.getFullKey('test-key');
      
      expect(fullKey).toBe('tm-chat-test-key');
    });
  });

  describe('getSize', () => {
    test('should calculate total size of prefixed items', () => {
      const keys = ['tm-chat-key1', 'tm-chat-key2', 'other-key'];
      const values = ['value1', 'value2', 'other'];
      
      mockLocalStorage.length = keys.length;
      mockLocalStorage.key.mockImplementation((index) => keys[index]);
      mockLocalStorage.getItem.mockImplementation((key) => {
        const index = keys.indexOf(key);
        return index >= 0 ? values[index] : null;
      });
      
      const size = storage.getSize();
      
      // Size = (tm-chat-key1 + value1) + (tm-chat-key2 + value2)
      const expectedSize = 
        keys[0].length + values[0].length + 
        keys[1].length + values[1].length;
      
      expect(size).toBe(expectedSize);
    });
    
    test('should return 0 when storage not available', () => {
      storage.available = false;
      
      const size = storage.getSize();
      
      expect(size).toBe(0);
    });
    
    test('should handle errors gracefully', () => {
      mockLocalStorage.key.mockImplementation(() => {
        throw new Error('Size error');
      });
      
      const size = storage.getSize();
      
      expect(size).toBe(0);
    });
  });

  describe('has', () => {
    test('should return true if key exists', () => {
      mockLocalStorage.getItem.mockReturnValue('some value');
      
      const exists = storage.has('test-key');
      
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('tm-chat-test-key');
      expect(exists).toBe(true);
    });
    
    test('should return false if key does not exist', () => {
      mockLocalStorage.getItem.mockReturnValue(null);
      
      const exists = storage.has('missing-key');
      
      expect(exists).toBe(false);
    });
    
    test('should return false when storage not available', () => {
      storage.available = false;
      
      const exists = storage.has('test-key');
      
      expect(exists).toBe(false);
    });
    
    test('should handle errors gracefully', () => {
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('Has error');
      });
      
      const exists = storage.has('error-key');
      
      expect(exists).toBe(false);
    });
  });

  describe('real world usage', () => {
    test('should handle session management', () => {
      const sessionData = {
        id: 'session-123',
        startTime: Date.now(),
        instanceId: 'test-instance'
      };
      
      // Save session
      storage.set('session-test-instance', sessionData);
      
      // Get session
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(sessionData));
      const retrieved = storage.get('session-test-instance');
      
      expect(retrieved).toEqual(sessionData);
    });
    
    test('should handle messages storage', () => {
      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' }
      ];
      
      // Save messages
      storage.set('messages-session-123', messages);
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'tm-chat-messages-session-123',
        JSON.stringify(messages)
      );
    });
  });
});