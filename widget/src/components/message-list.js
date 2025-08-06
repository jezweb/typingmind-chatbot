// Message List Component
// Handles the message display area and message rendering

export class MessageList {
  constructor() {
    this.element = null;
    this.messages = [];
    this.loadingElement = null;
  }
  
  // Create message list element
  create() {
    const messagesDiv = document.createElement('div');
    messagesDiv.className = 'tm-messages';
    messagesDiv.setAttribute('role', 'log');
    messagesDiv.setAttribute('aria-live', 'polite');
    
    // Add welcome message
    messagesDiv.innerHTML = `
      <div class="tm-welcome">
        <p>Hi! How can I help you today?</p>
      </div>
    `;
    
    this.element = messagesDiv;
    return this.element;
  }
  
  // Clear messages
  clear() {
    if (this.element) {
      this.element.innerHTML = '';
      this.messages = [];
    }
  }
  
  // Add message
  addMessage(message) {
    if (!this.element) return;
    
    // Clear welcome message on first real message
    const welcomeMessage = this.element.querySelector('.tm-welcome');
    if (welcomeMessage) {
      welcomeMessage.remove();
    }
    
    const messageEl = this.createMessageElement(message);
    this.element.appendChild(messageEl);
    this.messages.push({ message, element: messageEl });
    
    this.scrollToBottom();
  }
  
  // Update message
  updateMessage(index, message) {
    if (index < 0 || index >= this.messages.length) return;
    
    const messageData = this.messages[index];
    messageData.message = message;
    
    // Update content element
    const contentEl = messageData.element.querySelector('.tm-message-content');
    if (contentEl) {
      contentEl.innerHTML = '';
      const formattedContent = this.formatMessage(message.content);
      contentEl.appendChild(formattedContent);
    }
    
    this.scrollToBottom();
  }
  
  // Create message element
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
  
  // Format message content (basic markdown support)
  formatMessage(content) {
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
  
  // Parse inline markdown
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
  
  // Create text nodes with line breaks
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
  
  // Show loading indicator
  showLoading() {
    if (!this.element) return;
    
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
    
    this.loadingElement = loadingEl;
    this.element.appendChild(loadingEl);
    this.scrollToBottom();
  }
  
  // Hide loading indicator
  hideLoading() {
    if (this.loadingElement) {
      this.loadingElement.remove();
      this.loadingElement = null;
    }
  }
  
  // Show error message
  showError(message) {
    if (!this.element) return;
    
    const errorEl = document.createElement('div');
    errorEl.className = 'tm-error';
    errorEl.textContent = message;
    this.element.appendChild(errorEl);
    this.scrollToBottom();
    
    // Remove after 5 seconds
    setTimeout(() => {
      errorEl.remove();
    }, 5000);
  }
  
  // Scroll to bottom
  scrollToBottom() {
    if (this.element) {
      this.element.scrollTop = this.element.scrollHeight;
    }
  }
  
  // Render saved messages
  renderMessages(messages) {
    this.clear();
    messages.forEach(msg => {
      this.addMessage(msg);
    });
  }
  
  // Get message count
  getMessageCount() {
    return this.messages.length;
  }
}