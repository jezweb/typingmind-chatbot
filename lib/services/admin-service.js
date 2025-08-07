/**
 * Admin Service Module
 * Handles business logic for admin operations
 */

/**
 * Process form data for instance creation/update
 * Converts form data to the format expected by the database
 * @param {Object} formData - Raw form data from request
 * @returns {Object} Processed data ready for database operations
 */
export function processFormData(formData) {
  const data = { ...formData };
  
  // Convert checkboxes to booleans
  data.markdown = data.markdown === 'on' || data.markdown === true;
  data.image_upload = data.image_upload === 'on' || data.image_upload === true;
  data.persist_session = data.persist_session === 'on' || data.persist_session === true;
  
  // Parse domains (split by newlines and filter empty)
  if (typeof data.domains === 'string') {
    data.domains = data.domains
      .split('\n')
      .map(d => d.trim())
      .filter(d => d.length > 0);
  } else if (!Array.isArray(data.domains)) {
    data.domains = [];
  }
  
  // Parse paths if provided (for future use)
  if (data.paths) {
    if (typeof data.paths === 'string') {
      data.paths = data.paths
        .split('\n')
        .map(p => p.trim())
        .filter(p => p.length > 0);
    }
  }
  
  // Convert numeric fields
  if (data.width !== undefined) {
    data.width = parseInt(data.width) || 380;
  }
  if (data.messages_per_hour !== undefined) {
    data.messages_per_hour = parseInt(data.messages_per_hour) || 100;
  }
  if (data.messages_per_session !== undefined) {
    data.messages_per_session = parseInt(data.messages_per_session) || 30;
  }
  
  return data;
}

/**
 * Validate instance data before creation/update
 * @param {Object} data - Instance data to validate
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export function validateInstanceData(data) {
  const errors = [];
  
  // Required fields
  if (!data.id || data.id.trim() === '') {
    errors.push('Instance ID is required');
  }
  
  if (!data.typingmind_agent_id || data.typingmind_agent_id.trim() === '') {
    errors.push('TypingMind Agent ID is required');
  }
  
  if (!data.name || data.name.trim() === '') {
    errors.push('Instance name is required');
  }
  
  // Instance ID format validation (lowercase, alphanumeric, hyphens only)
  if (data.id && !/^[a-z0-9-]+$/.test(data.id)) {
    errors.push('Instance ID must contain only lowercase letters, numbers, and hyphens');
  }
  
  // Domain validation
  if (!data.domains || data.domains.length === 0) {
    errors.push('At least one allowed domain is required');
  }
  
  // Numeric field validation
  if (data.width !== undefined && (data.width < 300 || data.width > 800)) {
    errors.push('Width must be between 300 and 800 pixels');
  }
  
  if (data.messages_per_hour !== undefined && data.messages_per_hour < 1) {
    errors.push('Messages per hour must be at least 1');
  }
  
  if (data.messages_per_session !== undefined && data.messages_per_session < 1) {
    errors.push('Messages per session must be at least 1');
  }
  
  // Theme validation
  if (data.primary_color && !/^#[0-9A-Fa-f]{6}$/.test(data.primary_color)) {
    errors.push('Primary color must be a valid hex color (e.g., #007bff)');
  }
  
  if (data.position && !['bottom-right', 'bottom-left', 'top-right', 'top-left'].includes(data.position)) {
    errors.push('Invalid position value');
  }
  
  if (data.embed_mode && !['popup', 'inline'].includes(data.embed_mode)) {
    errors.push('Invalid embed mode');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Create error response with consistent format
 * @param {string|string[]} errors - Error message(s)
 * @param {number} status - HTTP status code
 * @param {Object} headers - Additional headers
 * @returns {Response} Error response
 */
export function createErrorResponse(errors, status = 400, headers = {}) {
  const errorMessage = Array.isArray(errors) ? errors.join(', ') : errors;
  
  return new Response(JSON.stringify({ 
    error: errorMessage,
    errors: Array.isArray(errors) ? errors : [errors]
  }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  });
}

/**
 * Create success response with consistent format
 * @param {Object} data - Response data
 * @param {number} status - HTTP status code
 * @param {Object} headers - Additional headers
 * @returns {Response} Success response
 */
export function createSuccessResponse(data = {}, status = 200, headers = {}) {
  return new Response(JSON.stringify({
    success: true,
    ...data
  }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  });
}

/**
 * Generate widget embed code for an instance
 * @param {string} instanceId - Instance ID
 * @param {string} origin - Origin URL for the widget script
 * @returns {string} HTML embed code
 */
export function generateWidgetCode(instanceId, origin = '') {
  return `<!-- TypingMind Chatbot Widget -->
<script>
  (function() {
    var script = document.createElement('script');
    script.src = '${origin}/widget.js';
    script.async = true;
    script.onload = function() {
      TypingMindChat.init({
        instanceId: '${instanceId}'
      });
    };
    document.head.appendChild(script);
  })();
</script>`;
}