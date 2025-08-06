// Input Area Component
// Handles the message input area with textarea and send button

export class InputArea {
  constructor(icons) {
    this.icons = icons;
    this.element = null;
    this.textareaElement = null;
    this.sendButtonElement = null;
    this.onSend = null;
  }
  
  // Create input area element
  create() {
    const inputAreaDiv = document.createElement('div');
    inputAreaDiv.className = 'tm-input-area';
    
    inputAreaDiv.innerHTML = `
      <textarea 
        class="tm-input" 
        placeholder="Type your message..."
        aria-label="Type your message"
        rows="1"
      ></textarea>
      <button class="tm-send-button" aria-label="Send message">
        ${this.icons.send}
      </button>
    `;
    
    this.element = inputAreaDiv;
    this.textareaElement = inputAreaDiv.querySelector('.tm-input');
    this.sendButtonElement = inputAreaDiv.querySelector('.tm-send-button');
    
    this.setupEventListeners();
    
    return this.element;
  }
  
  // Setup event listeners
  setupEventListeners() {
    // Handle Enter key
    this.textareaElement.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSend();
      }
    });
    
    // Handle send button click
    this.sendButtonElement.addEventListener('click', () => {
      this.handleSend();
    });
    
    // Auto-resize textarea
    this.textareaElement.addEventListener('input', () => {
      this.autoResize();
    });
  }
  
  // Handle send action
  handleSend() {
    const text = this.getValue();
    if (text && this.onSend) {
      this.onSend(text);
    }
  }
  
  // Get input value
  getValue() {
    return this.textareaElement ? this.textareaElement.value.trim() : '';
  }
  
  // Clear input
  clear() {
    if (this.textareaElement) {
      this.textareaElement.value = '';
      this.autoResize();
    }
  }
  
  // Focus input
  focus() {
    if (this.textareaElement) {
      this.textareaElement.focus();
    }
  }
  
  // Enable/disable input
  setEnabled(enabled) {
    if (this.textareaElement) {
      this.textareaElement.disabled = !enabled;
    }
    if (this.sendButtonElement) {
      this.sendButtonElement.disabled = !enabled;
    }
  }
  
  // Auto-resize textarea
  autoResize() {
    if (!this.textareaElement) return;
    
    this.textareaElement.style.height = 'auto';
    const newHeight = Math.min(120, this.textareaElement.scrollHeight);
    this.textareaElement.style.height = newHeight + 'px';
  }
  
  // Set send handler
  setOnSend(handler) {
    this.onSend = handler;
  }
  
  // Get height
  getHeight() {
    return this.element ? this.element.offsetHeight : 0;
  }
  
  // Destroy input area
  destroy() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.element = null;
    this.textareaElement = null;
    this.sendButtonElement = null;
  }
}