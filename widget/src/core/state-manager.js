// State Manager Module
// Handles all state management for the chat widget

export class StateManager {
  constructor(instanceId) {
    this.instanceId = instanceId;
    this.state = {
      isOpen: false,
      messages: [],
      sessionId: this.getOrCreateSessionId(),
      isLoading: false,
      unreadCount: 0,
      agentInfo: null,
      renderedMode: null,
      hasShownWelcome: false
    };
    
    this.listeners = new Map();
  }
  
  // Generate fallback UUID for older browsers
  generateFallbackUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
  
  // Get or create session ID
  getOrCreateSessionId() {
    const key = `tm-session-${this.instanceId}`;
    let sessionId = localStorage.getItem(key);
    
    if (!sessionId) {
      // Use crypto.randomUUID() for secure session ID generation
      sessionId = 'sess_' + (
        typeof crypto !== 'undefined' && crypto.randomUUID 
          ? crypto.randomUUID() 
          : this.generateFallbackUUID()
      );
      localStorage.setItem(key, sessionId);
    }
    
    return sessionId;
  }
  
  // Get current state
  getState() {
    return { ...this.state };
  }
  
  // Update state and notify listeners
  setState(updates) {
    const oldState = { ...this.state };
    this.state = { ...this.state, ...updates };
    
    // Notify listeners of changes
    Object.keys(updates).forEach(key => {
      if (this.listeners.has(key)) {
        this.listeners.get(key).forEach(callback => {
          callback(this.state[key], oldState[key]);
        });
      }
    });
  }
  
  // Subscribe to state changes
  subscribe(key, callback) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key).add(callback);
    
    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(key);
      if (listeners) {
        listeners.delete(callback);
      }
    };
  }
  
  // Message management
  addMessage(message) {
    const messages = [...this.state.messages, message];
    this.setState({ messages });
    this.saveMessages();
  }
  
  updateMessage(index, message) {
    const messages = [...this.state.messages];
    messages[index] = message;
    this.setState({ messages });
    this.saveMessages();
  }
  
  saveMessages() {
    const key = `tm-messages-${this.instanceId}`;
    const toSave = this.state.messages.slice(-50); // Keep last 50 messages
    localStorage.setItem(key, JSON.stringify(toSave));
  }
  
  loadMessages() {
    const key = `tm-messages-${this.instanceId}`;
    const saved = localStorage.getItem(key);
    
    if (saved) {
      try {
        const messages = JSON.parse(saved);
        this.setState({ messages });
        return messages;
      } catch (e) {
        console.error('Failed to load messages:', e);
      }
    }
    
    return [];
  }
  
  // Unread count management
  incrementUnreadCount() {
    this.setState({ unreadCount: this.state.unreadCount + 1 });
  }
  
  resetUnreadCount() {
    this.setState({ unreadCount: 0 });
  }
  
  // Loading state
  setLoading(isLoading) {
    this.setState({ isLoading });
  }
  
  // Agent info
  setAgentInfo(agentInfo) {
    this.setState({ agentInfo });
  }
  
  // Widget open/close state
  setOpen(isOpen) {
    this.setState({ isOpen });
    if (isOpen) {
      this.resetUnreadCount();
    }
  }
  
  // Welcome message management
  setWelcomeShown() {
    this.setState({ hasShownWelcome: true });
    const key = `tm-welcome-shown-${this.instanceId}`;
    sessionStorage.setItem(key, 'true');
  }
  
  hasWelcomeBeenShown() {
    const key = `tm-welcome-shown-${this.instanceId}`;
    return this.state.hasShownWelcome || sessionStorage.getItem(key) === 'true';
  }
  
  isNewSession() {
    return this.state.messages.length === 0;
  }
  
  // Clear all state
  clearState() {
    this.setState({
      messages: [],
      unreadCount: 0,
      isLoading: false,
      hasShownWelcome: false
    });
    const key = `tm-messages-${this.instanceId}`;
    localStorage.removeItem(key);
    const welcomeKey = `tm-welcome-shown-${this.instanceId}`;
    sessionStorage.removeItem(welcomeKey);
  }
}