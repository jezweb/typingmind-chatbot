// Chat Window Component
// Handles the main chat window container

export class ChatWindow {
  constructor(config, icons) {
    this.config = config;
    this.icons = icons;
    this.element = null;
    this.headerElement = null;
    this.titleElement = null;
    this.onMinimize = null;
    this.onClose = null;
  }
  
  // Create window element
  create() {
    const windowDiv = document.createElement('div');
    
    // Set appropriate classes based on embed mode
    const windowClasses = this.config.embedMode === 'inline' 
      ? 'tm-chat-window tm-inline' 
      : `tm-chat-window ${this.config.position}`;
    
    windowDiv.className = windowClasses;
    
    // Create header
    const headerHTML = this.createHeader();
    windowDiv.innerHTML = headerHTML;
    
    this.element = windowDiv;
    this.headerElement = windowDiv.querySelector('.tm-header');
    this.titleElement = windowDiv.querySelector('.tm-header-title');
    
    // Setup event listeners for popup mode controls
    if (this.config.embedMode === 'popup') {
      this.setupEventListeners();
    }
    
    // Initialize inline mode if needed
    if (this.config.embedMode === 'inline') {
      this.initializeInlineMode();
    }
    
    return this.element;
  }
  
  // Create header HTML
  createHeader() {
    // Show different header actions based on mode
    const headerActions = this.config.embedMode === 'inline' 
      ? '' // No minimize/close buttons in inline mode
      : `
        <div class="tm-header-actions">
          <button class="tm-minimize" aria-label="Minimize chat">
            ${this.icons.minimize}
          </button>
          <button class="tm-close" aria-label="Close chat">
            ${this.icons.close}
          </button>
        </div>
      `;
    
    return `
      <div class="tm-header">
        <div class="tm-header-title">${this.config.agentName}</div>
        ${headerActions}
      </div>
    `;
  }
  
  // Setup event listeners
  setupEventListeners() {
    const minimizeBtn = this.element.querySelector('.tm-minimize');
    const closeBtn = this.element.querySelector('.tm-close');
    
    if (minimizeBtn) {
      minimizeBtn.addEventListener('click', () => {
        if (this.onMinimize) {
          this.onMinimize();
        }
      });
    }
    
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        if (this.onClose) {
          this.onClose();
        }
      });
    }
  }
  
  // Initialize inline mode
  initializeInlineMode() {
    this.element.classList.add('tm-open', 'tm-inline');
    this.element.style.opacity = '1';
    this.element.style.transform = 'none';
    this.element.style.position = 'relative';
    this.element.style.width = '100%';
    
    // Apply custom height if specified
    if (this.config.height) {
      const height = typeof this.config.height === 'number' 
        ? this.config.height + 'px' 
        : this.config.height;
      this.element.style.height = height;
    }
  }
  
  // Update window position
  updatePosition(position) {
    if (!this.element || this.config.embedMode === 'inline') return;
    
    // Remove old position class
    const positions = ['bottom-right', 'bottom-left', 'top-right', 'top-left'];
    positions.forEach(pos => {
      this.element.classList.remove(pos);
    });
    
    // Add new position class
    this.element.classList.add(position);
  }
  
  // Update title
  updateTitle(title) {
    if (this.titleElement) {
      this.titleElement.textContent = title;
    }
  }
  
  // Show window
  show() {
    if (this.element) {
      this.element.classList.add('tm-open');
    }
  }
  
  // Hide window
  hide() {
    if (this.element && this.config.embedMode !== 'inline') {
      this.element.classList.remove('tm-open');
    }
  }
  
  // Append child element
  appendChild(child) {
    if (this.element) {
      this.element.appendChild(child);
    }
  }
  
  // Get bounding rect
  getBoundingClientRect() {
    return this.element ? this.element.getBoundingClientRect() : null;
  }
  
  // Set handlers
  setOnMinimize(handler) {
    this.onMinimize = handler;
  }
  
  setOnClose(handler) {
    this.onClose = handler;
  }
  
  // Destroy window
  destroy() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.element = null;
    this.headerElement = null;
    this.titleElement = null;
  }
}