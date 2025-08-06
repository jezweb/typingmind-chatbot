// Storage Utility Module
// LocalStorage wrapper with error handling and data validation

export class Storage {
  constructor(prefix = 'tm') {
    this.prefix = prefix;
    this.available = this.checkAvailability();
  }
  
  // Check if localStorage is available
  checkAvailability() {
    try {
      const testKey = `${this.prefix}-test`;
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      console.warn('LocalStorage not available:', e);
      return false;
    }
  }
  
  // Get item from storage
  get(key, defaultValue = null) {
    if (!this.available) return defaultValue;
    
    try {
      const fullKey = this.getFullKey(key);
      const item = localStorage.getItem(fullKey);
      
      if (item === null) {
        return defaultValue;
      }
      
      // Try to parse as JSON
      try {
        return JSON.parse(item);
      } catch {
        // Return as string if not valid JSON
        return item;
      }
    } catch (e) {
      console.error('Storage get error:', e);
      return defaultValue;
    }
  }
  
  // Set item in storage
  set(key, value) {
    if (!this.available) return false;
    
    try {
      const fullKey = this.getFullKey(key);
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      localStorage.setItem(fullKey, serialized);
      return true;
    } catch (e) {
      console.error('Storage set error:', e);
      return false;
    }
  }
  
  // Remove item from storage
  remove(key) {
    if (!this.available) return false;
    
    try {
      const fullKey = this.getFullKey(key);
      localStorage.removeItem(fullKey);
      return true;
    } catch (e) {
      console.error('Storage remove error:', e);
      return false;
    }
  }
  
  // Clear all items with prefix
  clear() {
    if (!this.available) return false;
    
    try {
      const keysToRemove = [];
      
      // Find all keys with our prefix
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.prefix + '-')) {
          keysToRemove.push(key);
        }
      }
      
      // Remove them
      keysToRemove.forEach(key => localStorage.removeItem(key));
      return true;
    } catch (e) {
      console.error('Storage clear error:', e);
      return false;
    }
  }
  
  // Get full key with prefix
  getFullKey(key) {
    return `${this.prefix}-${key}`;
  }
  
  // Get storage size for our prefix
  getSize() {
    if (!this.available) return 0;
    
    let size = 0;
    
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.prefix + '-')) {
          const value = localStorage.getItem(key);
          if (value) {
            size += key.length + value.length;
          }
        }
      }
    } catch (e) {
      console.error('Storage size error:', e);
    }
    
    return size;
  }
  
  // Check if key exists
  has(key) {
    if (!this.available) return false;
    
    try {
      const fullKey = this.getFullKey(key);
      return localStorage.getItem(fullKey) !== null;
    } catch {
      return false;
    }
  }
}