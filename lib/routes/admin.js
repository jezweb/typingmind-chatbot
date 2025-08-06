/**
 * Admin routes module
 * Handles all admin panel routes and functionality
 */

import { securityHeaders } from '../security.js';
import { 
  validateAdminSession,
  extractSessionId,
  createAdminSession,
  deleteAdminSession,
  createLogoutCookie,
  validatePassword,
  createUnauthorizedRedirect,
  createUnauthorizedResponse
} from '../auth.js';
import {
  getAllInstances,
  getInstanceById,
  createInstance,
  updateInstance,
  deleteInstance,
  cloneInstance
} from '../database.js';
import { validateInstanceId, createResponseHeaders } from '../security.js';
import { loginPage, dashboardPage } from '../templates/admin-pages.js';

// Admin JS code that will be served
const adminJsCode = `// Admin Panel JavaScript Functions
// This file contains all client-side JavaScript for the admin panel

// API call helper with automatic session handling via cookies
async function apiCall(url, options = {}) {
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    credentials: 'same-origin' // Include cookies
  });
}

// Delete instance
async function deleteInstance(id) {
  if (!confirm('Are you sure you want to delete this instance?')) return;
  
  const response = await apiCall(\`/admin/instances/\${id}\`, {
    method: 'DELETE'
  });
  
  if (response.ok) {
    location.reload();
  } else {
    alert('Failed to delete instance');
  }
}

// Clone instance
async function cloneInstance(id) {
  const name = prompt('Enter name for cloned instance:');
  if (!name) return;
  
  const response = await apiCall(\`/admin/instances/\${id}/clone\`, {
    method: 'POST',
    body: JSON.stringify({ name })
  });
  
  if (response.ok) {
    location.reload();
  } else {
    alert('Failed to clone instance');
  }
}

// Copy widget code
function copyWidgetCode(button) {
  const instanceId = button.getAttribute('data-instance-id');
  const code = \`<!-- TypingMind Chatbot Widget -->
<script>
  (function() {
    var script = document.createElement('script');
    script.src = '\${window.location.origin}/widget.js';
    script.async = true;
    script.onload = function() {
      TypingMindChat.init({
        instanceId: '\${instanceId}'
      });
    };
    document.head.appendChild(script);
  })();
</script>\`;
  
  navigator.clipboard.writeText(code).then(() => {
    alert('Widget code copied to clipboard!');
  }).catch(() => {
    prompt('Copy this code:', code);
  });
}

// Logout
async function logout() {
  try {
    await fetch('/admin/logout', {
      method: 'POST',
      credentials: 'same-origin'
    });
  } catch (error) {
    console.error('Logout error:', error);
  }
  window.location.href = '/admin';
}

// Create instance (for the new instance form)
async function createInstance(e) {
  e.preventDefault();
  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData);
  
  // Convert checkboxes
  data.markdown = data.markdown === 'on';
  data.image_upload = data.image_upload === 'on';
  data.persist_session = data.persist_session === 'on';
  
  // Parse domains and paths
  data.domains = data.domains ? data.domains.split('\\n').filter(d => d.trim()) : [];
  data.paths = data.paths ? data.paths.split('\\n').filter(p => p.trim()) : [];
  
  // Convert numbers
  data.width = parseInt(data.width);
  data.messages_per_hour = parseInt(data.messages_per_hour);
  data.messages_per_session = parseInt(data.messages_per_session);
  
  const response = await fetch('/admin/instances', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'same-origin',
    body: JSON.stringify(data)
  });
  
  if (response.ok) {
    window.location.href = '/admin/dashboard';
  } else {
    const error = await response.json();
    alert('Error: ' + (error.error || 'Failed to create instance'));
  }
}

// Edit instance
async function editInstance(e) {
  e.preventDefault();
  const form = e.target;
  const instanceId = form.getAttribute('data-instance-id');
  const formData = new FormData(form);
  const data = Object.fromEntries(formData);
  
  // Convert checkboxes
  data.markdown = data.markdown === 'on';
  data.image_upload = data.image_upload === 'on';
  data.persist_session = data.persist_session === 'on';
  
  // Parse domains
  data.domains = data.domains ? data.domains.split('\\n').filter(d => d.trim()) : [];
  
  // Convert numbers
  data.width = parseInt(data.width);
  data.messages_per_hour = parseInt(data.messages_per_hour);
  data.messages_per_session = parseInt(data.messages_per_session);
  
  const response = await fetch(\`/admin/instances/\${instanceId}\`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'same-origin',
    body: JSON.stringify(data)
  });
  
  if (response.ok) {
    window.location.href = '/admin/dashboard';
  } else {
    const error = await response.json();
    alert('Error: ' + (error.error || 'Failed to update instance'));
  }
}

// Initialize event listeners when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  // Add form submit handler if on create instance page
  const createForm = document.getElementById('create-instance-form');
  if (createForm) {
    createForm.addEventListener('submit', createInstance);
  }
  
  // Add form submit handler if on edit instance page
  const editForm = document.getElementById('edit-instance-form');
  if (editForm) {
    editForm.addEventListener('submit', editInstance);
  }
});`;

/**
 * Serve admin.js file
 * @returns {Response} JavaScript code for admin panel
 */
export function handleAdminJs() {
  return new Response(adminJsCode, {
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
    }
  });
}

/**
 * Admin login page
 * @returns {Response} Login page HTML
 */
export function handleAdminLoginPage() {
  const html = loginPage();
  
  return new Response(html, {
    headers: { 
      'Content-Type': 'text/html',
      ...securityHeaders
    }
  });
}

/**
 * Admin login endpoint
 * @param {Request} request - HTTP request
 * @param {Object} env - Environment bindings
 * @returns {Response} Login result
 */
export async function handleAdminLogin(request, env) {
  const responseHeaders = createResponseHeaders();
  
  try {
    const { password } = await request.json();
    
    if (!validatePassword(password, env.ADMIN_PASSWORD)) {
      if (!env.ADMIN_PASSWORD) {
        return new Response(JSON.stringify({ error: 'Admin not configured' }), {
          status: 500,
          headers: responseHeaders
        });
      }
      
      return new Response(JSON.stringify({ error: 'Invalid password' }), {
        status: 401,
        headers: responseHeaders
      });
    }
    
    // Create admin session
    const clientIp = request.headers.get('CF-Connecting-IP');
    const { sessionId, cookieOptions } = await createAdminSession(env, clientIp);
    
    return new Response(JSON.stringify({ 
      success: true,
      sessionId 
    }), {
      status: 200,
      headers: {
        ...responseHeaders,
        'Set-Cookie': cookieOptions
      }
    });
  } catch (error) {
    console.error('[Admin] Login error:', error);
    return new Response(JSON.stringify({ error: 'Login failed' }), {
      status: 500,
      headers: responseHeaders
    });
  }
}

/**
 * Admin logout endpoint
 * @param {Request} request - HTTP request
 * @param {Object} env - Environment bindings
 * @returns {Response} Logout result
 */
export async function handleAdminLogout(request, env) {
  const responseHeaders = createResponseHeaders();
  
  try {
    // Extract session ID from request
    const sessionId = extractSessionId(request);
    
    // Delete session from KV if found
    await deleteAdminSession(env, sessionId);
    
    // Clear cookie
    const clearCookieOptions = createLogoutCookie();
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        ...responseHeaders,
        'Set-Cookie': clearCookieOptions
      }
    });
  } catch (error) {
    console.error('[Admin] Logout error:', error);
    return new Response(JSON.stringify({ error: 'Logout failed' }), {
      status: 500,
      headers: responseHeaders
    });
  }
}

/**
 * Admin dashboard
 * @param {Request} request - HTTP request
 * @param {Object} env - Environment bindings
 * @returns {Response} Dashboard HTML
 */
export async function handleAdminDashboard(request, env) {
  // Validate session
  const isValid = await validateAdminSession(request, env);
  if (!isValid) {
    return createUnauthorizedRedirect();
  }
  
  // Get all instances from database with v2 schema
  const instances = await getAllInstances(env.DB);
  
  const html = dashboardPage(instances);
  
  return new Response(html, {
    headers: { 
      'Content-Type': 'text/html',
      ...securityHeaders
    }
  });
}