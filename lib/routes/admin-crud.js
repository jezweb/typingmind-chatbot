/**
 * Admin CRUD routes module
 * Handles create, read, update, delete operations for instances
 */

import { securityHeaders } from '../security.js';
import { 
  validateAdminSession,
  createUnauthorizedRedirect,
  createUnauthorizedResponse
} from '../auth.js';
import {
  getInstanceById,
  createInstance,
  updateInstance,
  deleteInstance,
  cloneInstance
} from '../database.js';
import { validateInstanceId } from '../security.js';

/**
 * Create new instance form
 * @param {Request} request - HTTP request
 * @param {Object} env - Environment bindings
 * @returns {Response} Create form HTML
 */
export async function handleCreateInstanceForm(request, env) {
  // Validate session
  const isValid = await validateAdminSession(request, env);
  if (!isValid) {
    return createUnauthorizedRedirect();
  }
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Create New Instance - TypingMind Chatbot</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; background: #f5f5f5; }
    .header { background: white; padding: 1rem 2rem; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem; }
    .header h1 { margin: 0; color: #333; }
    .container { max-width: 800px; margin: 0 auto; padding: 0 2rem; }
    .form-card { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .form-group { margin-bottom: 1.5rem; }
    label { display: block; margin-bottom: 0.5rem; font-weight: 600; }
    input[type="text"], textarea, select { width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px; font-size: 16px; }
    textarea { resize: vertical; min-height: 100px; }
    .checkbox-group { display: flex; align-items: center; }
    .checkbox-group input { width: auto; margin-right: 0.5rem; }
    .btn { padding: 0.5rem 1rem; border: none; border-radius: 4px; cursor: pointer; text-decoration: none; display: inline-block; }
    .btn-primary { background: #007bff; color: white; }
    .btn-primary:hover { background: #0056b3; }
    .btn-secondary { background: #6c757d; color: white; margin-right: 1rem; }
    .help-text { font-size: 0.875rem; color: #6c757d; margin-top: 0.25rem; }
    .section { margin-top: 2rem; padding-top: 2rem; border-top: 1px solid #dee2e6; }
    .section h3 { margin-top: 0; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Create New Instance</h1>
  </div>
  <div class="container">
    <form class="form-card" id="create-instance-form">
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
      
      <div style="margin-top: 2rem;">
        <a href="/admin/dashboard" class="btn btn-secondary">Cancel</a>
        <button type="submit" class="btn btn-primary">Create Instance</button>
      </div>
    </form>
  </div>
  <script src="/admin/admin.js"></script>
</body>
</html>`;
  
  return new Response(html, {
    headers: { 
      'Content-Type': 'text/html',
      ...securityHeaders
    }
  });
}

/**
 * Create new instance endpoint
 * @param {Request} request - HTTP request
 * @param {Object} env - Environment bindings
 * @returns {Response} Create result
 */
export async function handleCreateInstance(request, env) {
  // Validate session
  const isValid = await validateAdminSession(request, env);
  if (!isValid) {
    return createUnauthorizedResponse();
  }
  
  try {
    const data = await request.json();
    
    // Validate instance ID
    if (!validateInstanceId(data.id)) {
      return new Response(JSON.stringify({ error: 'Invalid instance ID format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Create instance with all related data
    await createInstance(env.DB, data);
    
    return new Response(JSON.stringify({ success: true, id: data.id }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('[Admin] Create instance error:', error);
    return new Response(JSON.stringify({ error: 'Failed to create instance' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Delete instance endpoint
 * @param {Request} request - HTTP request
 * @param {Object} env - Environment bindings
 * @returns {Response} Delete result
 */
export async function handleDeleteInstance(request, env) {
  // Validate session
  const isValid = await validateAdminSession(request, env);
  if (!isValid) {
    return createUnauthorizedResponse();
  }
  
  try {
    const { id } = request.params;
    
    // Delete instance (cascading deletes will handle related tables)
    await deleteInstance(env.DB, id);
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('[Admin] Delete instance error:', error);
    return new Response(JSON.stringify({ error: 'Failed to delete instance' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Edit instance form
 * @param {Request} request - HTTP request
 * @param {Object} env - Environment bindings
 * @returns {Response} Edit form HTML
 */
export async function handleEditInstanceForm(request, env) {
  // Validate session
  const isValid = await validateAdminSession(request, env);
  if (!isValid) {
    return createUnauthorizedRedirect();
  }
  
  const { id } = request.params;
  
  // Get instance data with all related data
  const instanceData = await getInstanceById(env.DB, id);
  
  if (!instanceData) {
    return new Response('Instance not found', { status: 404 });
  }
  
  const { instance, domains, features, rateLimits, theme } = instanceData;
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Edit Instance - TypingMind Chatbot</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; background: #f5f5f5; }
    .header { background: white; padding: 1rem 2rem; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem; }
    .header h1 { margin: 0; color: #333; }
    .container { max-width: 800px; margin: 0 auto; padding: 0 2rem; }
    .form-card { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .form-group { margin-bottom: 1.5rem; }
    label { display: block; margin-bottom: 0.5rem; font-weight: 500; }
    input[type="text"], input[type="number"], textarea, select { width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px; }
    textarea { min-height: 100px; resize: vertical; }
    .help-text { font-size: 0.875rem; color: #666; margin-top: 0.25rem; }
    .btn { padding: 0.5rem 1rem; border: none; border-radius: 4px; cursor: pointer; text-decoration: none; display: inline-block; }
    .btn-primary { background: #007bff; color: white; }
    .btn-secondary { background: #6c757d; color: white; margin-right: 1rem; }
    .checkbox-group { display: flex; align-items: center; }
    .checkbox-group input { width: auto; margin-right: 0.5rem; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Edit Instance: ${instance.name}</h1>
  </div>
  <div class="container">
    <form class="form-card" id="edit-instance-form" data-instance-id="${id}">
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
          <input type="checkbox" id="markdown" name="markdown" ${features?.markdown ? 'checked' : ''}>
          <label for="markdown">Enable Markdown</label>
        </div>
        <div class="checkbox-group">
          <input type="checkbox" id="image_upload" name="image_upload" ${features?.image_upload ? 'checked' : ''}>
          <label for="image_upload">Enable Image Upload</label>
        </div>
        <div class="checkbox-group">
          <input type="checkbox" id="persist_session" name="persist_session" ${features?.persist_session ? 'checked' : ''}>
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
          <option value="bottom-right" ${theme?.position === 'bottom-right' ? 'selected' : ''}>Bottom Right</option>
          <option value="bottom-left" ${theme?.position === 'bottom-left' ? 'selected' : ''}>Bottom Left</option>
          <option value="top-right" ${theme?.position === 'top-right' ? 'selected' : ''}>Top Right</option>
          <option value="top-left" ${theme?.position === 'top-left' ? 'selected' : ''}>Top Left</option>
        </select>
      </div>
      
      <div class="form-group">
        <label for="width">Widget Width (px)</label>
        <input type="number" id="width" name="width" value="${theme?.width || 380}" min="300" max="600">
      </div>
      
      <div class="form-group">
        <label for="embed_mode">Embed Mode</label>
        <select id="embed_mode" name="embed_mode">
          <option value="popup" ${theme?.embed_mode === 'popup' ? 'selected' : ''}>Popup (Floating)</option>
          <option value="inline" ${theme?.embed_mode === 'inline' ? 'selected' : ''}>Inline (Embedded)</option>
        </select>
      </div>
      
      <div style="margin-top: 2rem;">
        <a href="/admin/dashboard" class="btn btn-secondary">Cancel</a>
        <button type="submit" class="btn btn-primary">Save Changes</button>
      </div>
    </form>
  </div>
  <script src="/admin/admin.js"></script>
</body>
</html>`;
  
  return new Response(html, {
    headers: { 
      'Content-Type': 'text/html',
      ...securityHeaders
    }
  });
}

/**
 * Update instance endpoint
 * @param {Request} request - HTTP request
 * @param {Object} env - Environment bindings
 * @returns {Response} Update result
 */
export async function handleUpdateInstance(request, env) {
  // Validate session
  const isValid = await validateAdminSession(request, env);
  if (!isValid) {
    return createUnauthorizedResponse();
  }
  
  try {
    const { id } = request.params;
    const data = await request.json();
    
    // Update instance with all related data
    await updateInstance(env.DB, id, data);
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('[Admin] Update instance error:', error);
    return new Response(JSON.stringify({ error: 'Failed to update instance' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Clone instance endpoint
 * @param {Request} request - HTTP request
 * @param {Object} env - Environment bindings
 * @returns {Response} Clone result
 */
export async function handleCloneInstance(request, env) {
  // Validate session
  const isValid = await validateAdminSession(request, env);
  if (!isValid) {
    return createUnauthorizedResponse();
  }
  
  try {
    const { id } = request.params;
    const { name } = await request.json();
    
    // Generate new instance ID
    const newId = name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now();
    
    // Clone instance with all settings
    try {
      await cloneInstance(env.DB, id, newId, name);
    } catch (error) {
      if (error.message === 'Source instance not found') {
        return new Response(JSON.stringify({ error: 'Source instance not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      throw error;
    }
    
    return new Response(JSON.stringify({ success: true, id: newId }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('[Admin] Clone instance error:', error);
    return new Response(JSON.stringify({ error: 'Failed to clone instance' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}