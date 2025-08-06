// TypingMind Chat Widget - Main Orchestrator
// Modular architecture entry point

import { StateManager } from './core/state-manager.js';
import { ConfigManager } from './core/config-manager.js';
import { ApiClient } from './core/api-client.js';
import { ChatButton } from './components/chat-button.js';
import { ChatWindow } from './components/chat-window.js';
import { MessageList } from './components/message-list.js';
import { InputArea } from './components/input-area.js';
import { DomUtils } from './utils/dom-utils.js';
import { MarkdownParser } from './utils/markdown-parser.js';
import { Storage } from './utils/storage.js';

// Import icons and styles (will be inlined by build process)
const icons = WIDGET_ICONS;
const styles = WIDGET_STYLES;

// Widget class
class TypingMindChatWidget {
  constructor(config) {
    try {
      // Initialize managers
      this.configManager = new ConfigManager(config);
      this.stateManager = new StateManager(config.instanceId);
      this.apiClient = new ApiClient(this.configManager.get('workerUrl'));
      this.storage = new Storage(`tm-${config.instanceId}`);
      this.markdownParser = new MarkdownParser();
      
      // Initialize components (will be created during render)
      this.chatButton = null;
      this.chatWindow = null;
      this.messageList = null;
      this.inputArea = null;
      
      // Widget container and shadow root
      this.container = null;
      this.shadowRoot = null;
      
      // Event cleanup functions
      this.cleanupFunctions = [];
      
      // Initialize widget
      this.init();
      
    } catch (error) {
      console.error('TypingMind Chat initialization error:', error);
    }
  }
  
  async init() {
    // Create container
    this.createContainer();
    
    // Create UI
    this.render();
    
    // Load saved messages
    this.loadMessages();
    
    // Setup state subscriptions
    this.setupStateSubscriptions();
    
    // Fetch agent info
    await this.fetchAgentInfo();
    
    // Setup global event listeners
    this.setupGlobalListeners();
  }
  
  createContainer() {
    // Create container element
    const container = DomUtils.createElement('div', {
      id: `typingmind-widget-${this.configManager.get('instanceId')}`
    });
    
    // Set container styles based on embed mode
    if (this.configManager.isInlineMode()) {
      container.style.cssText = 'position:relative;width:100%;height:100%;pointer-events:auto;';
    } else {
      container.style.cssText = 'position:fixed;z-index:999999;pointer-events:none;';
    }
    
    // Create shadow root
    this.shadowRoot = DomUtils.createShadowRoot(container, 'closed');
    
    // Add styles
    DomUtils.addStylesToShadowRoot(this.shadowRoot, styles);
    
    // Add inline mode class if needed
    if (this.configManager.isInlineMode()) {
      container.classList.add('tm-inline-mode');
    }
    
    // Apply theme
    this.configManager.applyThemeToElement(container);
    
    this.container = container;
  }
  
  render() {
    const wrapper = DomUtils.createElement('div', {
      style: 'pointer-events:auto;'
    });
    
    // Create components based on mode
    if (this.configManager.isPopupMode()) {
      // Create chat button
      this.chatButton = new ChatButton(
        this.configManager.get('position'),
        icons
      );
      this.chatButton.setOnClick(() => this.toggle());
      wrapper.appendChild(this.chatButton.create());
    }
    
    // Create chat window
    this.chatWindow = new ChatWindow(this.configManager.config, icons);
    this.chatWindow.setOnMinimize(() => this.close());
    this.chatWindow.setOnClose(() => this.close());
    const windowElement = this.chatWindow.create();
    
    // Create message list
    this.messageList = new MessageList();
    windowElement.appendChild(this.messageList.create());
    
    // Create input area
    this.inputArea = new InputArea(icons);
    this.inputArea.setOnSend((text) => this.sendMessage(text));
    windowElement.appendChild(this.inputArea.create());
    
    wrapper.appendChild(windowElement);
    this.shadowRoot.appendChild(wrapper);
    
    // Add to page
    if (this.configManager.isInlineMode() && this.configManager.get('container')) {
      this.configManager.get('container').appendChild(this.container);
      // Set state for inline mode
      this.stateManager.setOpen(true);
      this.stateManager.setState({ renderedMode: 'inline' });
    } else {
      document.body.appendChild(this.container);
      this.stateManager.setState({ renderedMode: 'popup' });
    }
    
    // Focus input for inline mode
    if (this.configManager.isInlineMode()) {
      setTimeout(() => this.inputArea.focus(), 100);
    }
  }
  
  setupStateSubscriptions() {
    // Subscribe to unread count changes
    this.stateManager.subscribe('unreadCount', (count) => {
      if (this.chatButton) {
        this.chatButton.updateBadgeCount(count);
      }
    });
    
    // Subscribe to loading state
    this.stateManager.subscribe('isLoading', (isLoading) => {
      this.inputArea.setEnabled(!isLoading);
      
      if (isLoading) {
        this.messageList.showLoading();
      } else {
        this.messageList.hideLoading();
      }
    });
    
    // Subscribe to agent info changes
    this.stateManager.subscribe('agentInfo', (agentInfo) => {
      if (agentInfo && agentInfo.name) {
        this.chatWindow.updateTitle(agentInfo.name);
      }
    });
  }
  
  async fetchAgentInfo() {
    try {
      const agentInfo = await this.apiClient.fetchInstanceInfo(
        this.configManager.get('instanceId')
      );
      
      // Apply configuration from agent info
      this.configManager.applyAgentInfo(agentInfo);
      this.stateManager.setAgentInfo(agentInfo);
      
      // Update theme
      this.configManager.applyThemeToElement(this.container);
      
      // Update position if changed
      const newPosition = this.configManager.get('position');
      if (this.chatButton) {
        this.chatButton.updatePosition(newPosition);
      }
      this.chatWindow.updatePosition(newPosition);
      
    } catch (error) {
      console.error('Failed to fetch agent info:', error);
    }
  }
  
  setupGlobalListeners() {
    // Handle clicks outside widget (for popup mode)
    if (this.configManager.isPopupMode()) {
      const handleOutsideClick = (e) => {
        if (this.stateManager.getState().isOpen && 
            DomUtils.isClickOutside(e, this.chatWindow.element)) {
          // User clicked outside - could close widget here if desired
        }
      };
      
      const cleanup = DomUtils.addEventListener(
        document, 
        'click', 
        handleOutsideClick
      );
      this.cleanupFunctions.push(cleanup);
    }
  }
  
  loadMessages() {
    const messages = this.stateManager.loadMessages();
    if (messages.length > 0) {
      this.messageList.renderMessages(messages);
    }
  }
  
  toggle() {
    if (this.stateManager.getState().isOpen) {
      this.close();
    } else {
      this.open();
    }
  }
  
  open() {
    this.stateManager.setOpen(true);
    
    if (this.chatButton) {
      this.chatButton.hide();
    }
    
    this.chatWindow.show();
    this.inputArea.focus();
    
    // Scroll to bottom after animation
    setTimeout(() => {
      this.messageList.scrollToBottom();
    }, 300);
    
    // Callback
    const onOpen = this.configManager.get('onOpen');
    if (onOpen) {
      onOpen();
    }
  }
  
  close() {
    // Don't allow closing in inline mode
    if (this.configManager.isInlineMode()) {
      return;
    }
    
    this.stateManager.setOpen(false);
    this.chatWindow.hide();
    
    if (this.chatButton) {
      this.chatButton.show();
    }
    
    // Callback
    const onClose = this.configManager.get('onClose');
    if (onClose) {
      onClose();
    }
  }
  
  async sendMessage(text) {
    if (!text || this.stateManager.getState().isLoading) return;
    
    // Clear input
    this.inputArea.clear();
    
    // Add user message
    const userMessage = {
      role: 'user',
      content: text,
      timestamp: new Date().toISOString()
    };
    
    this.stateManager.addMessage(userMessage);
    this.messageList.addMessage(userMessage);
    
    // Set loading state
    this.stateManager.setLoading(true);
    
    try {
      // Prepare messages for API
      const messages = this.apiClient.prepareMessagesForApi(
        this.stateManager.getState().messages
      );
      
      // Send to API
      const result = await this.apiClient.sendMessage(
        this.configManager.get('instanceId'),
        messages,
        this.stateManager.getState().sessionId
      );
      
      if (result.streaming) {
        // Handle streaming response
        await this.handleStreamingResponse(result.response);
      } else {
        // Handle regular response
        const content = this.apiClient.extractAssistantContent(result.data);
        const assistantMessage = {
          role: 'assistant',
          content: content,
          timestamp: new Date().toISOString()
        };
        
        this.stateManager.addMessage(assistantMessage);
        this.messageList.addMessage(assistantMessage);
        
        // Trigger callback
        this.triggerMessageCallback(assistantMessage);
      }
      
    } catch (error) {
      console.error('Chat error:', error);
      this.messageList.showError(error.message || 'Failed to send message. Please try again.');
    } finally {
      this.stateManager.setLoading(false);
    }
  }
  
  async handleStreamingResponse(response) {
    const assistantMessage = {
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString()
    };
    
    // Add empty message
    this.stateManager.addMessage(assistantMessage);
    const messageIndex = this.stateManager.getState().messages.length - 1;
    this.messageList.addMessage(assistantMessage);
    
    try {
      // Process streaming chunks
      for await (const chunk of this.apiClient.handleStreamingResponse(response)) {
        assistantMessage.content += chunk;
        this.stateManager.updateMessage(messageIndex, assistantMessage);
        this.messageList.updateMessage(
          this.messageList.getMessageCount() - 1,
          assistantMessage
        );
      }
      
      // Trigger callback
      this.triggerMessageCallback(assistantMessage);
      
    } catch (error) {
      console.error('Streaming error:', error);
    }
  }
  
  triggerMessageCallback(message) {
    if (!this.stateManager.getState().isOpen) {
      this.stateManager.incrementUnreadCount();
    }
    
    const onMessage = this.configManager.get('onMessage');
    if (onMessage && message.role === 'assistant') {
      onMessage(message);
    }
  }
  
  destroy() {
    // Cleanup event listeners
    this.cleanupFunctions.forEach(cleanup => cleanup());
    
    // Destroy components
    if (this.chatButton) this.chatButton.destroy();
    if (this.chatWindow) this.chatWindow.destroy();
    if (this.messageList) this.messageList.destroy();
    if (this.inputArea) this.inputArea.destroy();
    
    // Remove container
    DomUtils.removeElement(this.container);
    
    // Clear references
    this.container = null;
    this.shadowRoot = null;
  }
}

// Public API
window.TypingMindChat = {
  instances: {},
  
  init(config) {
    // Only support instanceId
    const id = config.instanceId;
    
    if (!id) {
      console.error('TypingMind Chat: instanceId is required');
      return null;
    }
    
    // Destroy existing instance if present
    if (this.instances[id]) {
      this.instances[id].destroy();
    }
    
    // Create new instance
    const widget = new TypingMindChatWidget(config);
    this.instances[id] = widget;
    
    return widget;
  },
  
  destroy(id) {
    if (this.instances[id]) {
      this.instances[id].destroy();
      delete this.instances[id];
    }
  },
  
  open(id) {
    if (this.instances[id]) {
      this.instances[id].open();
    }
  },
  
  close(id) {
    if (this.instances[id]) {
      this.instances[id].close();
    }
  }
};