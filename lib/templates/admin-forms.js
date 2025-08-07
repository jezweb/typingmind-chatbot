/**
 * Admin form templates module
 * Provides HTML templates for admin forms
 */

import { formLayout } from './admin-layout.js';

/**
 * Generate create instance form HTML
 * @returns {string} Create instance form HTML
 */
export function createInstanceForm() {
  const formContent = `
    <div class="form-group">
      <label for="id">Instance ID</label>
      <input type="text" id="id" name="id" required pattern="[a-z0-9-]+" placeholder="my-chatbot">
      <div class="help-text">Lowercase letters, numbers, and hyphens only</div>
    </div>
    
    <div class="form-group">
      <label for="name">Display Name</label>
      <input type="text" id="name" name="name" required placeholder="My Chatbot">
    </div>
    
    <div class="form-group">
      <label for="typingmind_agent_id">TypingMind Agent ID</label>
      <input type="text" id="typingmind_agent_id" name="typingmind_agent_id" required placeholder="character-xxx">
      <div class="help-text">The agent ID from your TypingMind dashboard</div>
    </div>
    
    <div class="form-group">
      <label for="api_key">Custom API Key (Optional)</label>
      <input type="text" id="api_key" name="api_key" placeholder="tm-sk-xxx">
      <div class="help-text">Leave empty to use default API key</div>
    </div>
    
    <div class="form-group">
      <label for="domains">Allowed Domains</label>
      <textarea id="domains" name="domains" placeholder="*.example.com&#10;app.example.com&#10;localhost:3000"></textarea>
      <div class="help-text">One domain per line. Use * for wildcards</div>
    </div>
    
    <div class="section">
      <h3>Features</h3>
      <div class="form-group">
        <div class="checkbox-group">
          <input type="checkbox" id="markdown" name="markdown" checked>
          <label for="markdown">Enable Markdown</label>
        </div>
      </div>
      <div class="form-group">
        <div class="checkbox-group">
          <input type="checkbox" id="image_upload" name="image_upload">
          <label for="image_upload">Enable Image Upload</label>
        </div>
      </div>
      <div class="form-group">
        <div class="checkbox-group">
          <input type="checkbox" id="persist_session" name="persist_session" checked>
          <label for="persist_session">Persist Sessions</label>
        </div>
      </div>
    </div>
    
    <div class="section">
      <h3>Theme</h3>
      <div class="form-group">
        <label for="primary_color">Primary Color</label>
        <input type="text" id="primary_color" name="primary_color" value="#007bff" placeholder="#007bff">
      </div>
      <div class="form-group">
        <label for="position">Position</label>
        <select id="position" name="position">
          <option value="bottom-right" selected>Bottom Right</option>
          <option value="bottom-left">Bottom Left</option>
          <option value="top-right">Top Right</option>
          <option value="top-left">Top Left</option>
        </select>
      </div>
      <div class="form-group">
        <label for="width">Width (pixels)</label>
        <input type="number" id="width" name="width" value="380" min="300" max="600">
      </div>
      <div class="form-group">
        <label for="embed_mode">Default Embed Mode</label>
        <select id="embed_mode" name="embed_mode">
          <option value="popup" selected>Popup (Floating)</option>
          <option value="inline">Inline (Embedded)</option>
        </select>
      </div>
    </div>
    
    <div class="section">
      <h3>Welcome Message</h3>
      <div class="form-group">
        <label for="welcome_message">Welcome Message</label>
        <textarea id="welcome_message" name="welcome_message" rows="3" maxlength="500" placeholder="Hello! How can I help you today?">Hello! How can I help you today?</textarea>
        <div class="help-text">Message shown when users open the chat (max 500 characters)</div>
      </div>
      <div class="form-group">
        <div class="checkbox-group">
          <input type="checkbox" id="show_on_new_session" name="show_on_new_session" checked>
          <label for="show_on_new_session">Show on new sessions</label>
        </div>
      </div>
      <div class="form-group">
        <div class="checkbox-group">
          <input type="checkbox" id="show_on_return" name="show_on_return">
          <label for="show_on_return">Show on returning sessions</label>
        </div>
      </div>
    </div>
    
    <div class="section">
      <h3>Rate Limits</h3>
      <div class="form-group">
        <label for="messages_per_hour">Messages Per Hour</label>
        <input type="number" id="messages_per_hour" name="messages_per_hour" value="100" min="1">
      </div>
      <div class="form-group">
        <label for="messages_per_session">Messages Per Session</label>
        <input type="number" id="messages_per_session" name="messages_per_session" value="30" min="1">
      </div>
    </div>
  `;

  return formLayout({
    title: 'Create New Instance',
    heading: 'Create New Instance',
    formContent,
    formId: 'create-instance-form',
    submitText: 'Create Instance'
  });
}

/**
 * Generate edit instance form HTML
 * @param {string} id - Instance ID
 * @param {Object} instanceData - Instance data object
 * @returns {string} Edit instance form HTML
 */
export function editInstanceForm(id, instanceData) {
  const { instance, domains, features, rateLimits, theme, welcomeMessage } = instanceData;
  
  // Properly handle checkbox states
  const markdownChecked = features?.markdown ? 'checked' : '';
  const imageUploadChecked = features?.image_upload ? 'checked' : '';
  const persistSessionChecked = features?.persist_session ? 'checked' : '';
  
  // Handle welcome message states
  const showOnNewSessionChecked = welcomeMessage?.show_on_new_session !== false ? 'checked' : '';
  const showOnReturnChecked = welcomeMessage?.show_on_return ? 'checked' : '';
  const welcomeText = welcomeMessage?.welcome_message || 'Hello! How can I help you today?';
  
  // Handle select options
  const positionOptions = ['bottom-right', 'bottom-left', 'top-right', 'top-left'];
  const embedModeOptions = ['popup', 'inline'];
  
  const formContent = `
    <div class="form-group">
      <label for="name">Instance Name</label>
      <input type="text" id="name" name="name" value="${instance.name}" required>
    </div>
    
    <div class="form-group">
      <label for="typingmind_agent_id">TypingMind Agent ID</label>
      <input type="text" id="typingmind_agent_id" name="typingmind_agent_id" value="${instance.typingmind_agent_id}" required>
      <div class="help-text">The agent ID from TypingMind dashboard</div>
    </div>
    
    <div class="form-group">
      <label for="api_key">Custom API Key (Optional)</label>
      <input type="text" id="api_key" name="api_key" value="${instance.api_key || ''}" placeholder="Leave empty to use default">
    </div>
    
    <div class="form-group">
      <label for="domains">Allowed Domains (one per line)</label>
      <textarea id="domains" name="domains">${domains.map(d => d.domain).join('\n')}</textarea>
      <div class="help-text">Use * for wildcard, e.g., *.example.com</div>
    </div>
    
    <div class="form-group">
      <label>Features</label>
      <div class="checkbox-group">
        <input type="checkbox" id="markdown" name="markdown" ${markdownChecked}>
        <label for="markdown">Enable Markdown</label>
      </div>
      <div class="checkbox-group">
        <input type="checkbox" id="image_upload" name="image_upload" ${imageUploadChecked}>
        <label for="image_upload">Enable Image Upload</label>
      </div>
      <div class="checkbox-group">
        <input type="checkbox" id="persist_session" name="persist_session" ${persistSessionChecked}>
        <label for="persist_session">Persist Session</label>
      </div>
    </div>
    
    <div class="form-group">
      <label for="messages_per_hour">Messages Per Hour</label>
      <input type="number" id="messages_per_hour" name="messages_per_hour" value="${rateLimits?.messages_per_hour || 100}" min="1">
    </div>
    
    <div class="form-group">
      <label for="messages_per_session">Messages Per Session</label>
      <input type="number" id="messages_per_session" name="messages_per_session" value="${rateLimits?.messages_per_session || 30}" min="1">
    </div>
    
    <div class="form-group">
      <label for="primary_color">Primary Color</label>
      <input type="text" id="primary_color" name="primary_color" value="${theme?.primary_color || '#007bff'}" placeholder="#007bff">
    </div>
    
    <div class="form-group">
      <label for="position">Widget Position</label>
      <select id="position" name="position">
        ${positionOptions.map(pos => 
          `<option value="${pos}" ${theme?.position === pos ? 'selected' : ''}>${
            pos.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
          }</option>`
        ).join('')}
      </select>
    </div>
    
    <div class="form-group">
      <label for="width">Widget Width (px)</label>
      <input type="number" id="width" name="width" value="${theme?.width || 380}" min="300" max="600">
    </div>
    
    <div class="form-group">
      <label for="embed_mode">Embed Mode</label>
      <select id="embed_mode" name="embed_mode">
        ${embedModeOptions.map(mode => 
          `<option value="${mode}" ${theme?.embed_mode === mode ? 'selected' : ''}>${
            mode === 'popup' ? 'Popup (Floating)' : 'Inline (Embedded)'
          }</option>`
        ).join('')}
      </select>
    </div>
    
    <div class="section">
      <h3>Welcome Message</h3>
      <div class="form-group">
        <label for="welcome_message">Welcome Message</label>
        <textarea id="welcome_message" name="welcome_message" rows="3" maxlength="500" placeholder="Hello! How can I help you today?">${welcomeText}</textarea>
        <div class="help-text">Message shown when users open the chat (max 500 characters)</div>
      </div>
      <div class="form-group">
        <div class="checkbox-group">
          <input type="checkbox" id="show_on_new_session" name="show_on_new_session" ${showOnNewSessionChecked}>
          <label for="show_on_new_session">Show on new sessions</label>
        </div>
      </div>
      <div class="form-group">
        <div class="checkbox-group">
          <input type="checkbox" id="show_on_return" name="show_on_return" ${showOnReturnChecked}>
          <label for="show_on_return">Show on returning sessions</label>
        </div>
      </div>
    </div>
  `;

  // Add data-instance-id attribute to form
  return formLayout({
    title: 'Edit Instance',
    heading: `Edit Instance: ${instance.name}`,
    formContent,
    formId: 'edit-instance-form',
    submitText: 'Save Changes'
  }).replace(
    'id="edit-instance-form"',
    `id="edit-instance-form" data-instance-id="${id}"`
  );
}