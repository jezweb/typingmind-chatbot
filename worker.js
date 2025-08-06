import { Router } from 'itty-router';
import { 
  corsHeaders, 
  securityHeaders, 
  validateInstanceId, 
  validateDomain,
  createResponseHeaders,
  handleCORSPreflight
} from './lib/security.js';
import {
  getInstanceConfig,
  getAllInstances,
  getInstanceById,
  createInstance,
  updateInstance,
  deleteInstance,
  cloneInstance
} from './lib/database.js';
import {
  checkAndUpdateRateLimit,
  generateRateLimitKeys,
  extractClientId,
  createRateLimitErrorResponse
} from './lib/rate-limiter.js';
import {
  parseCookies,
  validateAdminSession,
  extractSessionId,
  createAdminSession,
  deleteAdminSession,
  createLogoutCookie,
  validatePassword,
  createUnauthorizedRedirect,
  createUnauthorizedResponse
} from './lib/auth.js';

const router = Router();


// Handle CORS preflight
router.options('*', (request) => {
  return handleCORSPreflight(request);
});

// Get instance info endpoint
router.get('/instance/:id', async (request, env) => {
  const instanceId = request.params?.id;
  const responseHeaders = createResponseHeaders();
  
  if (!instanceId) {
    return new Response(JSON.stringify({ error: 'Instance ID is required' }), {
      status: 400,
      headers: responseHeaders
    });
  }
  
  // Validate instance ID format
  if (!validateInstanceId(instanceId)) {
    return new Response(JSON.stringify({ error: 'Invalid instance ID format' }), {
      status: 400,
      headers: responseHeaders
    });
  }
  
  try {
    const instance = await getInstanceConfig(env.DB, instanceId);
    if (!instance) {
      return new Response(JSON.stringify({ error: 'Instance not found' }), {
        status: 404,
        headers: responseHeaders
      });
    }
    
    // Return limited instance info for public use
    return new Response(JSON.stringify({
      id: instance.id,
      name: instance.name,
      theme: instance.theme,
      features: instance.features
    }), {
      status: 200,
      headers: responseHeaders
    });
  } catch (error) {
    console.error('[Instance] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: responseHeaders
    });
  }
});

// Chat endpoint
router.post('/chat', async (request, env) => {
  const origin = request.headers.get('Origin') || '*';
  const responseHeaders = createResponseHeaders(origin);
  
  try {
    // Check Content-Length header for request size limit (1MB)
    const contentLength = request.headers.get('Content-Length');
    if (contentLength && parseInt(contentLength) > 1048576) {
      return new Response(JSON.stringify({ 
        error: 'Request too large',
        message: 'Request body exceeds 1MB limit'
      }), {
        status: 413,
        headers: responseHeaders
      });
    }
    
    const body = await request.json();
    const { instanceId, messages, sessionId } = body;
    
    if (!instanceId || !messages) {
      return new Response(JSON.stringify({ error: 'Missing required fields: instanceId and messages' }), {
        status: 400,
        headers: responseHeaders
      });
    }
    
    // Validate messages array
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Messages must be a non-empty array' }), {
        status: 400,
        headers: responseHeaders
      });
    }
    
    // Limit number of messages
    if (messages.length > 100) {
      return new Response(JSON.stringify({ 
        error: 'Too many messages',
        message: 'Maximum 100 messages allowed per request'
      }), {
        status: 400,
        headers: responseHeaders
      });
    }
    
    // Validate instance ID format
    if (!validateInstanceId(instanceId)) {
      return new Response(JSON.stringify({ error: 'Invalid instance ID format' }), {
        status: 400,
        headers: responseHeaders
      });
    }
    
    // Get instance config from D1
    const instanceConfig = await getInstanceConfig(env.DB, instanceId);
    if (!instanceConfig) {
      return new Response(JSON.stringify({ error: 'Instance not found' }), {
        status: 404,
        headers: responseHeaders
      });
    }
    
    // Validate domain
    if (!await validateDomain(request, instanceConfig)) {
      console.error('[Chat] Domain validation failed:', {
        origin: request.headers.get('Origin'),
        referer: request.headers.get('Referer'),
        allowedDomains: instanceConfig.allowedDomains,
        instanceId
      });
      // Get request details for better error message
      const origin = request.headers.get('Origin');
      const referer = request.headers.get('Referer');
      const requestDomain = origin || referer || 'Unknown domain';
      
      return new Response(JSON.stringify({ 
        error: 'Domain not authorized',
        details: `Domain ${requestDomain} is not in the allowed list for instance '${instanceId}'. Allowed domains: ${instanceConfig.allowedDomains.join(', ')}`,
        debugInfo: {
          requestHeaders: {
            origin: origin || 'not provided',
            referer: referer || 'not provided',
            host: request.headers.get('Host') || 'not provided'
          },
          instanceId,
          allowedDomains: instanceConfig.allowedDomains
        }
      }), {
        status: 403,
        headers: responseHeaders
      });
    }
    
    console.log('[Chat] Processing request:', {
      instanceId,
      instanceName: instanceConfig.name,
      typingmindAgentId: instanceConfig.typingmindAgentId,
      origin: origin || 'no-origin',
      messageCount: messages.length
    });
    
    // Implement rate limiting
    const clientId = extractClientId(request, sessionId);
    const { hourlyKey, sessionKey } = generateRateLimitKeys(instanceId, clientId, sessionId);
    
    // Check rate limits
    const rateLimitResult = await checkAndUpdateRateLimit(env.RATE_LIMITS, {
      hourlyKey,
      sessionKey,
      hourlyLimit: instanceConfig.rateLimit.messagesPerHour,
      sessionLimit: instanceConfig.rateLimit.messagesPerSession,
      sessionId
    });
    
    if (!rateLimitResult.allowed) {
      return createRateLimitErrorResponse(rateLimitResult, responseHeaders);
    }
    
    // Call TypingMind API with the actual agent ID
    const apiKey = instanceConfig.apiKey || env.DEFAULT_API_KEY;
    const apiHost = env.TYPINGMIND_API_HOST || 'https://api.typingmind.com';
    
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    let apiResponse;
    try {
      apiResponse = await fetch(`${apiHost}/api/v2/agents/${instanceConfig.typingmindAgentId}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': apiKey
        },
        body: JSON.stringify({ messages }),
        signal: controller.signal
      });
    } catch (fetchError) {
      clearTimeout(timeout);
      if (fetchError.name === 'AbortError') {
        return new Response(JSON.stringify({ 
          error: 'Request timeout',
          message: 'The API request timed out after 30 seconds'
        }), {
          status: 504,
          headers: responseHeaders
        });
      }
      throw fetchError;
    } finally {
      clearTimeout(timeout);
    }
    
    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      console.error('[Chat] TypingMind API error:', {
        status: apiResponse.status,
        error: errorText,
        instanceId,
        typingmindAgentId: instanceConfig.typingmindAgentId,
        apiHost
      });
      return new Response(JSON.stringify({ 
        error: `API error: ${apiResponse.status}`,
        details: errorText
      }), {
        status: 500,
        headers: responseHeaders
      });
    }
    
    let data;
    try {
      data = await apiResponse.json();
    } catch (jsonError) {
      console.error('[Chat] Failed to parse API response:', jsonError);
      return new Response(JSON.stringify({ 
        error: 'Invalid API response',
        message: 'The API returned an invalid response format'
      }), {
        status: 502,
        headers: responseHeaders
      });
    }
    
    // Validate response structure
    if (!data || typeof data !== 'object') {
      console.error('[Chat] Invalid response structure:', data);
      return new Response(JSON.stringify({ 
        error: 'Invalid response format',
        message: 'The API returned an unexpected response format'
      }), {
        status: 502,
        headers: responseHeaders
      });
    }
    
    // Check if TypingMind returned an error
    if (data.error && data.error.code === 'agent_not_found') {
      console.error('[Chat] TypingMind agent not found:', {
        instanceId,
        typingmindAgentId: instanceConfig.typingmindAgentId,
        error: data.error
      });
      return new Response(JSON.stringify({
        error: 'Agent not configured in TypingMind',
        details: `The TypingMind agent ID (${instanceConfig.typingmindAgentId}) configured for this instance is not recognized by TypingMind. Please update the instance configuration with a valid agent ID.`,
        instanceId: instanceId,
        typingmindAgentId: instanceConfig.typingmindAgentId
      }), {
        status: 404,
        headers: responseHeaders
      });
    }
    
    // TODO: Log analytics
    // await logAnalytics(env, instanceId, sessionId, messages.length);
    
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: responseHeaders
    });
    
  } catch (error) {
    console.error('[Chat] Internal error:', {
      error: error.message,
      stack: error.stack
    });
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message
    }), {
      status: 500,
      headers: responseHeaders
    });
  }
});

// Widget delivery endpoint
router.get('/widget.js', async (request, env) => {
  let widgetCode = await env.AGENT_CONFIG.get('widget:code');
  
  if (!widgetCode) {
    widgetCode = 'console.error("Widget not deployed. Please run npm run deploy:widget");';
  }
  
  return new Response(widgetCode, {
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*'
    }
  });
});

// ============ Admin Panel Routes ============

// Test route
router.get('/test', () => {
  return new Response('Test route works!', {
    headers: { 'Content-Type': 'text/plain' }
  });
});

// Serve admin.js file
router.get('/admin/admin.js', async (request, env) => {
  const adminJs = `// Admin Panel JavaScript Functions
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

  return new Response(adminJs, {
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
    }
  });
});

// Admin login page
router.get('/admin', () => {
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
});

// Admin login endpoint
router.post('/admin/login', async (request, env) => {
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
});

// Admin logout endpoint
router.post('/admin/logout', async (request, env) => {
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
});


// Admin dashboard
router.get('/admin/dashboard', async (request, env) => {
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
});

// Create new instance form
router.get('/admin/instances/new', async (request, env) => {
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
});

// Create new instance endpoint
router.post('/admin/instances', async (request, env) => {
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
});

// Delete instance endpoint
router.delete('/admin/instances/:id', async (request, env) => {
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
});

// Edit instance form
router.get('/admin/instances/:id/edit', async (request, env) => {
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
});

// Update instance endpoint
router.put('/admin/instances/:id', async (request, env) => {
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
});

// Clone instance endpoint
router.post('/admin/instances/:id/clone', async (request, env) => {
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
});

// Health check
router.get('/', () => {
  return new Response('TypingMind Chatbot Multi-Instance API', {
    headers: { 'Content-Type': 'text/plain' }
  });
});

// 404 handler
router.all('*', () => new Response('Not Found', { status: 404 }));

// Export worker
export default {
  async fetch(request, env, ctx) {
    return router.handle(request, env, ctx);
  }
};