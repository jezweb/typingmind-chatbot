// Chat Button Component
// Handles the floating chat button for popup mode

export class ChatButton {
  constructor(position, icons) {
    this.position = position;
    this.icons = icons;
    this.element = null;
    this.badgeElement = null;
    this.onClick = null;
  }
  
  // Create button element
  create() {
    const button = document.createElement('button');
    button.className = `tm-chat-button ${this.position}`;
    button.setAttribute('aria-label', 'Open chat');
    button.innerHTML = `
      ${this.icons.chat}
      <span class="tm-badge" style="display:none">0</span>
    `;
    
    this.element = button;
    this.badgeElement = button.querySelector('.tm-badge');
    
    // Add click handler
    this.element.addEventListener('click', () => {
      if (this.onClick) {
        this.onClick();
      }
    });
    
    return this.element;
  }
  
  // Update button position
  updatePosition(position) {
    if (!this.element) return;
    
    // Remove old position class
    const positions = ['bottom-right', 'bottom-left', 'top-right', 'top-left'];
    positions.forEach(pos => {
      this.element.classList.remove(pos);
    });
    
    // Add new position class
    this.position = position;
    this.element.classList.add(position);
  }
  
  // Show button
  show() {
    if (this.element) {
      this.element.classList.remove('tm-hidden');
    }
  }
  
  // Hide button
  hide() {
    if (this.element) {
      this.element.classList.add('tm-hidden');
    }
  }
  
  // Update badge count
  updateBadgeCount(count) {
    if (!this.badgeElement) return;
    
    if (count > 0) {
      this.badgeElement.textContent = count > 9 ? '9+' : count.toString();
      this.badgeElement.style.display = 'block';
    } else {
      this.badgeElement.style.display = 'none';
    }
  }
  
  // Set click handler
  setOnClick(handler) {
    this.onClick = handler;
  }
  
  // Destroy button
  destroy() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.element = null;
    this.badgeElement = null;
  }
}