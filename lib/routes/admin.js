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
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Login - TypingMind Chatbot</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f5f5f5; }
    .login { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); width: 100%; max-width: 400px; }
    h2 { margin-top: 0; color: #333; }
    input, button { width: 100%; padding: 0.75rem; margin: 0.5rem 0; font-size: 16px; }
    input { border: 1px solid #ddd; border-radius: 4px; }
    button { background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; }
    button:hover { background: #0056b3; }
    .error { color: #dc3545; font-size: 14px; margin-top: 0.5rem; display: none; }
  </style>
</head>
<body>
  <div class="login">
    <h2>Admin Login</h2>
    <form action="/admin/login" method="post" onsubmit="login(event)">
      <input type="password" id="password" name="password" placeholder="Password" required autocomplete="current-password">
      <button type="submit">Login</button>
      <div class="error" id="error"></div>
    </form>
    <noscript>
      <div style="color: red; margin-top: 1rem;">JavaScript is required for admin login</div>
    </noscript>
  </div>
  <script>
    async function login(e) {
      e.preventDefault();
      console.log('[Admin] Login attempt started');
      
      const errorEl = document.getElementById('error');
      const passwordInput = document.getElementById('password');
      errorEl.style.display = 'none';
      
      if (!passwordInput || !passwordInput.value) {
        console.error('[Admin] Password input not found or empty');
        errorEl.textContent = 'Please enter a password';
        errorEl.style.display = 'block';
        return;
      }
      
      try {
        console.log('[Admin] Sending login request...');
        const response = await fetch('/admin/login', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({password: passwordInput.value})
        });
        
        console.log('[Admin] Response status:', response.status);
        const data = await response.json();
        
        if (response.ok && data.success) {
          console.log('[Admin] Login successful');
          // Cookie is set by the server, just redirect
          window.location.href = '/admin/dashboard';
        } else if (response.status === 500) {
          console.error('[Admin] Server error:', data.error);
          errorEl.textContent = data.error || 'Server configuration error';
          errorEl.style.display = 'block';
        } else {
          console.error('[Admin] Login failed:', data.error);
          errorEl.textContent = data.error || 'Invalid password';
          errorEl.style.display = 'block';
        }
      } catch (error) {
        console.error('[Admin] Login error:', error);
        errorEl.textContent = 'Network error. Check console for details.';
        errorEl.style.display = 'block';
      }
    }
  </script>
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
  
  const instanceRows = instances.map(instance => `
    <tr>
      <td>${instance.name}</td>
      <td><code>${instance.id}</code></td>
      <td><code>${instance.typingmind_agent_id}</code></td>
      <td>${instance.domain_count} domains</td>
      <td>${new Date(instance.created_at).toLocaleDateString()}</td>
      <td>
        <a href="/admin/instances/${instance.id}/edit" class="btn btn-sm">Edit</a>
        <button onclick="cloneInstance('${instance.id}')" class="btn btn-sm btn-info">Clone</button>
        <button onclick="copyWidgetCode(this)" data-instance-id="${instance.id}" class="btn btn-sm btn-success">Copy Widget</button>
        <button onclick="deleteInstance('${instance.id}')" class="btn btn-sm btn-danger">Delete</button>
      </td>
    </tr>
  `).join('');
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Dashboard - TypingMind Chatbot</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; background: #f5f5f5; }
    .header { background: white; padding: 1rem 2rem; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header h1 { margin: 0; color: #333; }
    .container { padding: 2rem; }
    .actions { margin-bottom: 2rem; }
    .btn { padding: 0.5rem 1rem; border: none; border-radius: 4px; cursor: pointer; text-decoration: none; display: inline-block; }
    .btn-primary { background: #007bff; color: white; }
    .btn-primary:hover { background: #0056b3; }
    .btn-sm { padding: 0.25rem 0.5rem; font-size: 0.875rem; }
    .btn-info { background: #17a2b8; color: white; }
    .btn-success { background: #28a745; color: white; }
    .btn-danger { background: #dc3545; color: white; }
    table { width: 100%; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    th, td { padding: 1rem; text-align: left; border-bottom: 1px solid #dee2e6; }
    th { background: #f8f9fa; font-weight: 600; }
    tr:last-child td { border-bottom: none; }
    code { background: #f8f9fa; padding: 0.2rem 0.4rem; border-radius: 3px; font-size: 0.875rem; }
    .logout { float: right; }
  </style>
</head>
<body>
  <div class="header">
    <h1>TypingMind Chatbot Admin <button onclick="logout()" class="btn btn-sm logout">Logout</button></h1>
  </div>
  <div class="container">
    <div class="actions">
      <a href="/admin/instances/new" class="btn btn-primary">Create New Instance</a>
    </div>
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Instance ID</th>
          <th>TypingMind Agent ID</th>
          <th>Domains</th>
          <th>Created</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${instanceRows || '<tr><td colspan="6">No instances found</td></tr>'}
      </tbody>
    </table>
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