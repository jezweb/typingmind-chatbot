// Configuration Manager Module
// Handles widget configuration and theme management

export class ConfigManager {
  constructor(userConfig) {
    // Default configuration
    this.defaultConfig = {
      workerUrl: 'https://typingmind-chatbot.webfonts.workers.dev',
      position: 'bottom-right',
      theme: {},
      agentName: 'Chat Support',
      width: 380,
      height: null, // null means use CSS default
      embedMode: 'popup',
      container: null
    };
    
    // Merge user config with defaults
    this.config = { ...this.defaultConfig, ...userConfig };
    
    // Store explicitly set values to prevent overrides
    this.explicitConfig = {
      embedMode: userConfig.embedMode || null,
      position: userConfig.position || null,
      width: userConfig.width || null,
      height: userConfig.height || null
    };
    
    // Validate required fields
    if (!this.config.instanceId) {
      throw new Error('TypingMind Chat: instanceId is required');
    }
  }
  
  // Get configuration value
  get(key) {
    return this.config[key];
  }
  
  // Set configuration value
  set(key, value) {
    this.config[key] = value;
  }
  
  // Update configuration with new values
  update(updates) {
    this.config = { ...this.config, ...updates };
  }
  
  // Check if a value was explicitly set by user
  isExplicitlySet(key) {
    return this.explicitConfig[key] !== null && this.explicitConfig[key] !== undefined;
  }
  
  // Apply agent info to configuration
  applyAgentInfo(agentInfo) {
    if (!agentInfo) return;
    
    // Update agent name
    if (agentInfo.name) {
      this.config.agentName = agentInfo.name;
    }
    
    // Apply theme if provided
    if (agentInfo.theme) {
      this.config.theme = { ...this.config.theme, ...agentInfo.theme };
      
      // Apply position from theme (only if not explicitly set)
      if (agentInfo.theme.position && !this.isExplicitlySet('position')) {
        this.config.position = agentInfo.theme.position;
      }
      
      // Apply width from theme (only if not explicitly set)
      if (agentInfo.theme.width && !this.isExplicitlySet('width')) {
        this.config.width = agentInfo.theme.width;
      }
      
      // Apply embed mode from theme (only if not explicitly set)
      if (agentInfo.theme.embedMode && !this.isExplicitlySet('embedMode')) {
        this.config.embedMode = agentInfo.theme.embedMode;
      }
    }
  }
  
  // Generate CSS variables for theming
  getThemeVariables() {
    const theme = this.config.theme;
    const variables = {};
    
    if (theme.primaryColor) {
      variables['--tm-primary-color'] = theme.primaryColor;
    }
    if (theme.fontFamily) {
      variables['--tm-font-family'] = theme.fontFamily;
    }
    if (theme.borderRadius) {
      variables['--tm-border-radius'] = theme.borderRadius;
    }
    
    // Apply width configuration
    if (this.config.width) {
      variables['--tm-window-width'] = this.config.width + 'px';
    }
    
    // Apply height configuration for inline mode
    if (this.config.height && this.config.embedMode === 'inline') {
      const height = typeof this.config.height === 'number' 
        ? this.config.height + 'px' 
        : this.config.height;
      variables['--tm-inline-height'] = height;
    }
    
    return variables;
  }
  
  // Apply theme variables to element
  applyThemeToElement(element) {
    const variables = this.getThemeVariables();
    Object.entries(variables).forEach(([key, value]) => {
      element.style.setProperty(key, value);
    });
  }
  
  // Check if widget should be in inline mode
  isInlineMode() {
    return this.config.embedMode === 'inline';
  }
  
  // Check if widget should be in popup mode
  isPopupMode() {
    return this.config.embedMode === 'popup';
  }
  
  // Get widget position classes
  getPositionClasses() {
    return this.config.position;
  }
  
  // Validate configuration
  validate() {
    const errors = [];
    
    if (!this.config.instanceId) {
      errors.push('instanceId is required');
    }
    
    if (this.isInlineMode() && !this.config.container) {
      errors.push('container is required for inline mode');
    }
    
    const validPositions = ['bottom-right', 'bottom-left', 'top-right', 'top-left'];
    if (!validPositions.includes(this.config.position)) {
      errors.push(`Invalid position: ${this.config.position}`);
    }
    
    const validEmbedModes = ['popup', 'inline'];
    if (!validEmbedModes.includes(this.config.embedMode)) {
      errors.push(`Invalid embedMode: ${this.config.embedMode}`);
    }
    
    return errors;
  }
}