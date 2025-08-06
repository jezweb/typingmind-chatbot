// TypingMind Chat Widget
(function() {
  'use strict';
  
  // Import icons and styles (will be inlined by build process)
  const icons = WIDGET_ICONS;
  const styles = WIDGET_STYLES;
  
  // Widget class
  class TypingMindChatWidget {
    constructor(config) {
      this.config = {
        workerUrl: 'https://typingmind-chatbot.webfonts.workers.dev',
        position: 'bottom-right',
        theme: {},
        agentName: 'Chat Support',
        width: 380,
        height: null, // null means use CSS default
        embedMode: 'popup',
        container: null,
        ...config
      };
      
      // Store explicitly set values
      this.explicitConfig = {
        embedMode: config.embedMode || null,
        position: config.position || null,
        width: config.width || null,
        height: config.height || null
      };
      
      // Require instanceId
      if (!this.config.instanceId) {
        console.error('TypingMind Chat: instanceId is required');
        return;
      }
      
      this.instanceId = this.config.instanceId;
      
      this.state = {
        isOpen: false,
        messages: [],
        sessionId: this.getOrCreateSessionId(),
        isLoading: false,
        unreadCount: 0,
        agentInfo: null
      };
      
      this.elements = {};
      this.init();
      this.fetchAgentInfo();
    }
    
    init() {
      // Create container
      const container = document.createElement('div');
      container.id = `typingmind-widget-${this.instanceId}`;
      
      // Set container styles based on embed mode
      if (this.config.embedMode === 'inline') {
        container.style.cssText = 'position:relative;width:100%;height:100%;pointer-events:auto;';
      } else {
        container.style.cssText = 'position:fixed;z-index:999999;pointer-events:none;';
      }
      
      // Create shadow root
      this.shadowRoot = container.attachShadow({ mode: 'closed' });
      
      // Add styles
      const styleSheet = document.createElement('style');
      styleSheet.textContent = styles;
      this.shadowRoot.appendChild(styleSheet);
      
      // Add inline mode class to host if needed
      if (this.config.embedMode === 'inline') {
        this.shadowRoot.host.classList.add('tm-inline-mode');
      }
      
      // Apply custom theme
      if (this.config.theme) {
        this.applyTheme();
      }
      
      // For inline mode, set isOpen BEFORE render
      if (this.config.embedMode === 'inline') {
        this.state.isOpen = true;
      }
      
      // Create UI
      this.render();
      
      // Add to page or container
      if (this.config.embedMode === 'inline' && this.config.container) {
        this.config.container.appendChild(container);
        // Ensure inline mode is properly displayed
        this.initializeInlineMode();
      } else {
        document.body.appendChild(container);
      }
      
      // Load saved messages
      this.loadMessages();
      
      // Setup event listeners
      this.setupEventListeners();
    }
    
    generateFallbackUUID() {
      // Fallback UUID v4 generation for older browsers
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    }
    
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
    
    async fetchAgentInfo() {
      try {
        // Fetch instance info
        const response = await fetch(`${this.config.workerUrl}/instance/${this.instanceId}`);
        if (response.ok) {
          const agentInfo = await response.json();
          this.state.agentInfo = agentInfo;
          
          // Update widget with agent info
          if (agentInfo.name) {
            this.config.agentName = agentInfo.name;
            const titleElement = this.shadowRoot.querySelector('.tm-header-title');
            if (titleElement) {
              titleElement.textContent = agentInfo.name;
            }
          }
          
          // Apply theme if provided
          if (agentInfo.theme) {
            this.config.theme = { ...this.config.theme, ...agentInfo.theme };
            
            // Apply position from theme (only if not explicitly set)
            if (agentInfo.theme.position && !this.explicitConfig.position) {
              this.config.position = agentInfo.theme.position;
              // Update button and window position classes
              this.updatePositionClasses();
            }
            
            // Apply width from theme (only if not explicitly set)
            if (agentInfo.theme.width && !this.explicitConfig.width) {
              this.config.width = agentInfo.theme.width;
            }
            
            // Apply embed mode from theme (only if not explicitly set during init)
            if (agentInfo.theme.embedMode && !this.explicitConfig.embedMode) {
              this.config.embedMode = agentInfo.theme.embedMode;
              // If embed mode changed after init, we need to re-render
              if (this.config.embedMode !== this.state.renderedMode) {
                console.warn('Embed mode changed after render. Manual refresh may be required.');
              }
            }
            
            this.applyTheme();
          }
        }
      } catch (error) {
        console.error('Failed to fetch agent info:', error);
      }
    }
    
    applyTheme() {
      const root = this.shadowRoot.host.style;
      const theme = this.config.theme;
      
      if (theme.primaryColor) {
        root.setProperty('--tm-primary-color', theme.primaryColor);
      }
      if (theme.fontFamily) {
        root.setProperty('--tm-font-family', theme.fontFamily);
      }
      if (theme.borderRadius) {
        root.setProperty('--tm-border-radius', theme.borderRadius);
      }
      
      // Apply width configuration
      if (this.config.width) {
        root.setProperty('--tm-window-width', this.config.width + 'px');
      }
      
      // Apply height configuration for inline mode
      if (this.config.height && this.config.embedMode === 'inline') {
        const height = typeof this.config.height === 'number' 
          ? this.config.height + 'px' 
          : this.config.height;
        root.setProperty('--tm-inline-height', height);
      }
    }
    
    updatePositionClasses() {
      if (!this.elements.button || !this.elements.window) return;
      
      // Remove all position classes
      const positions = ['bottom-right', 'bottom-left', 'top-right', 'top-left'];
      positions.forEach(pos => {
        this.elements.button.classList.remove(pos);
        this.elements.window.classList.remove(pos);
      });
      
      // Add new position class
      this.elements.button.classList.add(this.config.position);
      this.elements.window.classList.add(this.config.position);
    }
    
    initializeInlineMode() {
      if (!this.elements.window) return;
      
      // Ensure the window is visible for inline mode
      this.elements.window.classList.add('tm-open', 'tm-inline');
      this.elements.window.style.opacity = '1';
      this.elements.window.style.transform = 'none';
      this.elements.window.style.position = 'relative';
      this.elements.window.style.width = '100%';
      
      // Apply custom height if specified
      if (this.config.height) {
        const height = typeof this.config.height === 'number' 
          ? this.config.height + 'px' 
          : this.config.height;
        this.elements.window.style.height = height;
      }
      
      // Focus the input
      if (this.elements.input) {
        setTimeout(() => {
          this.elements.input.focus();
        }, 100);
      }
    }
    
    render() {
      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'pointer-events:auto;';
      
      // Don't show chat button in inline mode
      const chatButtonHTML = this.config.embedMode === 'inline' ? '' : `
        <button class="tm-chat-button ${this.config.position}" aria-label="Open chat">
          ${icons.chat}
          <span class="tm-badge" style="display:none">0</span>
        </button>
      `;
      
      // Add inline class to chat window if needed
      const windowClasses = this.config.embedMode === 'inline' 
        ? 'tm-chat-window tm-inline' 
        : `tm-chat-window ${this.config.position}`;
      
      // Show different header actions based on mode
      const headerActions = this.config.embedMode === 'inline' 
        ? '' // No minimize/close buttons in inline mode
        : `
          <div class="tm-header-actions">
            <button class="tm-minimize" aria-label="Minimize chat">
              ${icons.minimize}
            </button>
            <button class="tm-close" aria-label="Close chat">
              ${icons.close}
            </button>
          </div>
        `;
      
      wrapper.innerHTML = `
        ${chatButtonHTML}
        
        <div class="${windowClasses}">
          <div class="tm-header">
            <div class="tm-header-title">${this.config.agentName}</div>
            ${headerActions}
          </div>
          
          <div class="tm-messages" role="log" aria-live="polite">
            <div class="tm-welcome">
              <p>Hi! How can I help you today?</p>
            </div>
          </div>
          
          <div class="tm-input-area">
            <textarea 
              class="tm-input" 
              placeholder="Type your message..."
              aria-label="Type your message"
              rows="1"
            ></textarea>
            <button class="tm-send-button" aria-label="Send message">
              ${icons.send}
            </button>
          </div>
        </div>
      `;
      
      this.shadowRoot.appendChild(wrapper);
      
      // Store element references
      this.elements = {
        button: wrapper.querySelector('.tm-chat-button'),
        badge: wrapper.querySelector('.tm-badge'),
        window: wrapper.querySelector('.tm-chat-window'),
        title: wrapper.querySelector('.tm-header-title'),
        minimize: wrapper.querySelector('.tm-minimize'),
        close: wrapper.querySelector('.tm-close'),
        messages: wrapper.querySelector('.tm-messages'),
        input: wrapper.querySelector('.tm-input'),
        sendButton: wrapper.querySelector('.tm-send-button')
      };
      
      // In inline mode, show the window immediately
      if (this.config.embedMode === 'inline') {
        this.elements.window.classList.add('tm-open', 'tm-inline');
        // Ensure it's visible
        this.elements.window.style.opacity = '1';
        this.elements.window.style.transform = 'none';
      }
    }
    
    setupEventListeners() {
      // Chat button (only in popup mode)
      if (this.elements.button) {
        this.elements.button.addEventListener('click', () => this.toggle());
      }
      
      // Window controls (only in popup mode)
      if (this.elements.minimize) {
        this.elements.minimize.addEventListener('click', () => this.close());
      }
      if (this.elements.close) {
        this.elements.close.addEventListener('click', () => this.close());
      }
      
      // Input handling
      this.elements.input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
      });
      
      this.elements.sendButton.addEventListener('click', () => this.sendMessage());
      
      // Auto-resize textarea
      this.elements.input.addEventListener('input', () => {
        this.elements.input.style.height = 'auto';
        this.elements.input.style.height = Math.min(120, this.elements.input.scrollHeight) + 'px';
      });
      
      // Handle clicks outside
      document.addEventListener('click', (e) => {
        if (this.state.isOpen && !this.shadowRoot.contains(e.target)) {
          const rect = this.elements.window.getBoundingClientRect();
          if (e.clientX < rect.left || e.clientX > rect.right || 
              e.clientY < rect.top || e.clientY > rect.bottom) {
            // Clicked outside the window
          }
        }
      });
    }
    
    toggle() {
      if (this.state.isOpen) {
        this.close();
      } else {
        this.open();
      }
    }
    
    open() {
      this.state.isOpen = true;
      this.state.unreadCount = 0;
      
      // Only manipulate button/badge in popup mode
      if (this.elements.button) {
        this.elements.button.classList.add('tm-hidden');
      }
      if (this.elements.badge) {
        this.elements.badge.style.display = 'none';
      }
      
      this.elements.window.classList.add('tm-open');
      this.elements.input.focus();
      
      // Scroll to bottom
      setTimeout(() => {
        this.scrollToBottom();
      }, 300);
      
      // Callback
      if (this.config.onOpen) {
        this.config.onOpen();
      }
    }
    
    close() {
      // Don't allow closing in inline mode
      if (this.config.embedMode === 'inline') {
        return;
      }
      
      this.state.isOpen = false;
      this.elements.window.classList.remove('tm-open');
      
      if (this.elements.button) {
        this.elements.button.classList.remove('tm-hidden');
      }
      
      // Callback
      if (this.config.onClose) {
        this.config.onClose();
      }
    }
    
    async sendMessage() {
      const text = this.elements.input.value.trim();
      if (!text || this.state.isLoading) return;
      
      // Clear input
      this.elements.input.value = '';
      this.elements.input.style.height = 'auto';
      
      // Add user message
      this.addMessage({
        role: 'user',
        content: text,
        timestamp: new Date().toISOString()
      });
      
      // Show loading
      this.setLoading(true);
      
      try {
        // Prepare messages for API
        const messages = this.state.messages.map(m => ({
          role: m.role,
          content: m.content
        }));
        
        // Send to API
        const response = await fetch(`${this.config.workerUrl}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            instanceId: this.instanceId,
            messages: messages,
            sessionId: this.state.sessionId
          })
        });
        
        if (!response.ok) {
          let error;
          try {
            error = await response.json();
          } catch (e) {
            error = { error: `HTTP ${response.status} error`, details: 'Failed to parse error response' };
          }
          
          console.error('Chat API error:', {
            status: response.status,
            error: error,
            instanceId: this.instanceId,
            workerUrl: this.config.workerUrl
          });
          
          // Use detailed error message if available
          const errorMessage = error.details || error.error || `Failed to get response (${response.status})`;
          throw new Error(errorMessage);
        }
        
        // Handle streaming response
        if (response.headers.get('content-type')?.includes('text/event-stream')) {
          await this.handleStreamingResponse(response);
        } else {
          // Handle regular JSON response
          const data = await response.json();
          let assistantContent = 'Sorry, I could not process that.';
          
          // Extract content from TypingMind API response format
          if (data.messages && data.messages.length > 0) {
            const message = data.messages[0];
            if (message.content) {
              if (Array.isArray(message.content)) {
                // Handle array of content blocks
                assistantContent = message.content
                  .filter(block => block.type === 'text')
                  .map(block => block.text)
                  .join('\n');
              } else if (typeof message.content === 'string') {
                assistantContent = message.content;
              }
            }
          } else if (data.content) {
            assistantContent = data.content;
          } else if (data.message) {
            assistantContent = data.message;
          } else if (data.error) {
            // If the response contains an error, show it
            if (typeof data.error === 'object') {
              // Handle error object
              assistantContent = `Error: ${data.error.message || JSON.stringify(data.error)}`;
            } else {
              assistantContent = `Error: ${data.error}`;
            }
            if (data.details) {
              assistantContent += ` - ${data.details}`;
            }
            console.error('API returned error in response:', data);
          }
          
          this.addMessage({
            role: 'assistant',
            content: assistantContent,
            timestamp: new Date().toISOString()
          });
        }
        
      } catch (error) {
        console.error('Chat error:', error);
        this.showError(error.message || 'Failed to send message. Please try again.');
      } finally {
        this.setLoading(false);
      }
    }
    
    async handleStreamingResponse(response) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = {
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString()
      };
      
      // Add empty assistant message
      this.addMessage(assistantMessage, false);
      const messageIndex = this.state.messages.length - 1;
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;
              
              try {
                const parsed = JSON.parse(data);
                if (parsed.content) {
                  assistantMessage.content += parsed.content;
                  this.updateMessage(messageIndex, assistantMessage);
                }
              } catch (e) {
                // Ignore parse errors
              }
            }
          }
        }
      } finally {
        this.saveMessages();
      }
    }
    
    addMessage(message, save = true) {
      this.state.messages.push(message);
      
      const messageEl = this.createMessageElement(message);
      this.elements.messages.appendChild(messageEl);
      
      this.scrollToBottom();
      
      if (save) {
        this.saveMessages();
      }
      
      // Update unread count
      if (!this.state.isOpen && message.role === 'assistant') {
        this.state.unreadCount++;
        this.updateBadge();
      }
      
      // Callback
      if (this.config.onMessage && message.role === 'assistant') {
        this.config.onMessage(message);
      }
    }
    
    updateMessage(index, message) {
      this.state.messages[index] = message;
      
      const messageEls = this.elements.messages.querySelectorAll('.tm-message');
      if (messageEls[index]) {
        const contentEl = messageEls[index].querySelector('.tm-message-content');
        if (contentEl) {
          // Clear existing content and append safe formatted content
          contentEl.innerHTML = '';
          const formattedContent = this.formatMessage(message.content);
          contentEl.appendChild(formattedContent);
        }
      }
      
      this.scrollToBottom();
    }
    
    createMessageElement(message) {
      const div = document.createElement('div');
      div.className = `tm-message tm-message-${message.role}`;
      
      const time = new Date(message.timestamp).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      
      // Create avatar element
      const avatarDiv = document.createElement('div');
      avatarDiv.className = 'tm-message-avatar';
      avatarDiv.textContent = message.role === 'user' ? 'U' : 'B';
      
      // Create content wrapper
      const contentWrapper = document.createElement('div');
      
      // Create message content element
      const contentDiv = document.createElement('div');
      contentDiv.className = 'tm-message-content';
      const formattedContent = this.formatMessage(message.content);
      contentDiv.appendChild(formattedContent);
      
      // Create time element
      const timeDiv = document.createElement('div');
      timeDiv.className = 'tm-message-time';
      timeDiv.textContent = time;
      
      // Assemble the message structure
      contentWrapper.appendChild(contentDiv);
      contentWrapper.appendChild(timeDiv);
      
      div.appendChild(avatarDiv);
      div.appendChild(contentWrapper);
      
      return div;
    }
    
    formatMessage(content) {
      // Safe markdown parsing using DOM methods
      const container = document.createElement('div');
      
      // Split content into paragraphs
      const paragraphs = content.split(/\n\n/);
      
      paragraphs.forEach(paragraph => {
        const p = document.createElement('p');
        
        // Process the paragraph text safely
        const processedNodes = this.parseInlineMarkdown(paragraph);
        processedNodes.forEach(node => p.appendChild(node));
        
        container.appendChild(p);
      });
      
      return container;
    }
    
    parseInlineMarkdown(text) {
      const nodes = [];
      let remaining = text;
      
      // Regular expressions for inline markdown
      const patterns = [
        { regex: /\*\*(.*?)\*\*/, tag: 'strong' },
        { regex: /\*(.*?)\*/, tag: 'em' },
        { regex: /`(.*?)`/, tag: 'code' }
      ];
      
      while (remaining) {
        let earliestMatch = null;
        let earliestIndex = remaining.length;
        let matchedPattern = null;
        
        // Find the earliest match
        for (const pattern of patterns) {
          const match = remaining.match(pattern.regex);
          if (match && match.index < earliestIndex) {
            earliestMatch = match;
            earliestIndex = match.index;
            matchedPattern = pattern;
          }
        }
        
        if (earliestMatch) {
          // Add text before the match
          if (earliestIndex > 0) {
            const textBefore = remaining.substring(0, earliestIndex);
            nodes.push(...this.createTextNodesWithLineBreaks(textBefore));
          }
          
          // Add the matched element
          const element = document.createElement(matchedPattern.tag);
          element.textContent = earliestMatch[1];
          nodes.push(element);
          
          // Update remaining text
          remaining = remaining.substring(earliestIndex + earliestMatch[0].length);
        } else {
          // No more matches, add remaining text
          nodes.push(...this.createTextNodesWithLineBreaks(remaining));
          break;
        }
      }
      
      return nodes;
    }
    
    createTextNodesWithLineBreaks(text) {
      const nodes = [];
      const lines = text.split('\n');
      
      lines.forEach((line, index) => {
        if (index > 0) {
          nodes.push(document.createElement('br'));
        }
        if (line) {
          nodes.push(document.createTextNode(line));
        }
      });
      
      return nodes;
    }
    
    setLoading(loading) {
      this.state.isLoading = loading;
      this.elements.sendButton.disabled = loading;
      
      if (loading) {
        const loadingEl = document.createElement('div');
        loadingEl.className = 'tm-message';
        loadingEl.innerHTML = `
          <div class="tm-message-avatar">B</div>
          <div class="tm-typing">
            <span></span>
            <span></span>
            <span></span>
          </div>
        `;
        loadingEl.id = 'tm-loading';
        this.elements.messages.appendChild(loadingEl);
        this.scrollToBottom();
      } else {
        const loadingEl = this.shadowRoot.getElementById('tm-loading');
        if (loadingEl) {
          loadingEl.remove();
        }
      }
    }
    
    showError(message) {
      const errorEl = document.createElement('div');
      errorEl.className = 'tm-error';
      errorEl.textContent = message;
      this.elements.messages.appendChild(errorEl);
      this.scrollToBottom();
      
      // Remove after 5 seconds
      setTimeout(() => {
        errorEl.remove();
      }, 5000);
    }
    
    scrollToBottom() {
      this.elements.messages.scrollTop = this.elements.messages.scrollHeight;
    }
    
    updateBadge() {
      // Only update badge in popup mode
      if (!this.elements.badge) return;
      
      if (this.state.unreadCount > 0) {
        this.elements.badge.textContent = this.state.unreadCount > 9 ? '9+' : this.state.unreadCount;
        this.elements.badge.style.display = 'block';
      } else {
        this.elements.badge.style.display = 'none';
      }
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
          this.state.messages = messages;
          
          // Clear welcome message
          this.elements.messages.innerHTML = '';
          
          // Render saved messages
          messages.forEach(msg => {
            const messageEl = this.createMessageElement(msg);
            this.elements.messages.appendChild(messageEl);
          });
          
          this.scrollToBottom();
        } catch (e) {
          console.error('Failed to load messages:', e);
        }
      }
    }
    
    destroy() {
      // Remove from DOM
      if (this.shadowRoot.host.parentNode) {
        this.shadowRoot.host.parentNode.removeChild(this.shadowRoot.host);
      }
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
  
})();