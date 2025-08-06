import { Router } from 'itty-router';

const router = Router();

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Origin',
  'Access-Control-Max-Age': '86400',
  'Access-Control-Allow-Credentials': 'true'
};

// Security headers
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'",
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
};

// Get instance configuration from D1
async function getInstanceConfig(db, instanceId) {
  const query = `
    SELECT 
      i.id, i.name, i.typingmind_agent_id, i.api_key,
      rl.messages_per_hour, rl.messages_per_session,
      f.image_upload, f.markdown, f.persist_session,
      t.primary_color, t.position, t.width, t.embed_mode
    FROM agent_instances i
    LEFT JOIN instance_rate_limits rl ON i.id = rl.instance_id
    LEFT JOIN instance_features f ON i.id = f.instance_id
    LEFT JOIN instance_themes t ON i.id = t.instance_id
    WHERE i.id = ?
  `;
  
  const result = await db.prepare(query).bind(instanceId).first();
  if (!result) return null;
  
  // Get allowed domains
  const domains = await db.prepare(
    'SELECT domain FROM instance_domains WHERE instance_id = ?'
  ).bind(instanceId).all();
  
  // Get allowed paths
  const paths = await db.prepare(
    'SELECT path FROM instance_paths WHERE instance_id = ?'
  ).bind(instanceId).all();
  
  return {
    id: result.id,
    name: result.name,
    typingmindAgentId: result.typingmind_agent_id,
    apiKey: result.api_key,
    allowedDomains: domains.results.map(d => d.domain),
    allowedPaths: paths.results.map(p => p.path),
    rateLimit: {
      messagesPerHour: result.messages_per_hour || 100,
      messagesPerSession: result.messages_per_session || 30
    },
    features: {
      imageUpload: !!result.image_upload,
      markdown: !!result.markdown,
      persistSession: !!result.persist_session
    },
    theme: {
      primaryColor: result.primary_color || '#007bff',
      position: result.position || 'bottom-right',
      width: result.width || 380,
      embedMode: result.embed_mode || 'popup'
    }
  };
}

// Validate instance ID format
function validateInstanceId(instanceId) {
  // Only allow lowercase letters, numbers, and hyphens
  return /^[a-z0-9-]+$/.test(instanceId);
}

// Rate limiting implementation
async function checkAndUpdateRateLimit(env, options) {
  const { hourlyKey, sessionKey, hourlyLimit, sessionLimit, sessionId } = options;
  
  // Get current counts
  const [hourlyCount, sessionCount] = await Promise.all([
    env.RATE_LIMITS.get(hourlyKey),
    sessionId ? env.RATE_LIMITS.get(sessionKey) : null
  ]);
  
  const currentHourlyCount = parseInt(hourlyCount || '0');
  const currentSessionCount = parseInt(sessionCount || '0');
  
  // Check hourly limit
  if (currentHourlyCount >= hourlyLimit) {
    const hourlyTTL = await env.RATE_LIMITS.getWithMetadata(hourlyKey);
    const retryAfter = hourlyTTL.metadata?.ttl || 3600;
    return {
      allowed: false,
      message: `Hourly rate limit exceeded. Maximum ${hourlyLimit} messages per hour.`,
      retryAfter
    };
  }
  
  // Check session limit if applicable
  if (sessionId && currentSessionCount >= sessionLimit) {
    return {
      allowed: false,
      message: `Session rate limit exceeded. Maximum ${sessionLimit} messages per session.`,
      retryAfter: 300 // 5 minutes
    };
  }
  
  // Update counts with TTL
  const promises = [
    env.RATE_LIMITS.put(hourlyKey, String(currentHourlyCount + 1), {
      expirationTtl: 3600 // 1 hour
    })
  ];
  
  if (sessionId) {
    promises.push(
      env.RATE_LIMITS.put(sessionKey, String(currentSessionCount + 1), {
        expirationTtl: 86400 // 24 hours
      })
    );
  }
  
  await Promise.all(promises);
  
  return {
    allowed: true,
    currentHourlyCount: currentHourlyCount + 1,
    currentSessionCount: currentSessionCount + 1
  };
}

// Enhanced domain validation with better debugging
async function validateDomain(request, instanceConfig) {
  const origin = request.headers.get('Origin');
  const referer = request.headers.get('Referer');
  const requestHost = request.headers.get('Host');
  
  // Debug logging
  console.log('[validateDomain] Headers:', {
    origin,
    referer,
    host: requestHost,
    method: request.method,
    url: request.url
  });
  
  // For same-origin requests (like test pages), check if the request is from the worker's own domain
  if (!origin && !referer) {
    // If no origin/referer but we have a host header, check if it's the same domain
    if (requestHost) {
      const workerUrl = new URL(request.url);
      console.log('[validateDomain] Same-origin check:', {
        requestHost,
        workerHost: workerUrl.hostname
      });
      
      // Allow requests from the same domain (like our test pages)
      if (requestHost === workerUrl.hostname || 
          requestHost.startsWith(workerUrl.hostname)) {
        console.log('[validateDomain] Same-origin request allowed');
        return true;
      }
    }
    
    console.log('[validateDomain] No origin/referer headers, rejecting');
    return false;
  }
  
  try {
    const requestUrl = origin || referer;
    const { hostname } = new URL(requestUrl);
    
    console.log('[validateDomain] Checking hostname:', hostname);
    console.log('[validateDomain] Allowed domains:', instanceConfig.allowedDomains);
    
    const isAllowed = instanceConfig.allowedDomains.some(allowedDomain => {
      // Allow wildcard * for all domains
      if (allowedDomain === '*') {
        console.log('[validateDomain] Wildcard * matched');
        return true;
      }
      
      if (allowedDomain.startsWith('*.')) {
        const baseDomain = allowedDomain.substring(2);
        const matches = hostname === baseDomain || hostname.endsWith(`.${baseDomain}`);
        if (matches) {
          console.log(`[validateDomain] Wildcard domain ${allowedDomain} matched`);
        }
        return matches;
      }
      
      const exactMatch = hostname === allowedDomain;
      if (exactMatch) {
        console.log(`[validateDomain] Exact domain ${allowedDomain} matched`);
      }
      return exactMatch;
    });
    
    console.log('[validateDomain] Final result:', isAllowed);
    return isAllowed;
  } catch (error) {
    console.error('[validateDomain] Error:', error);
    return false;
  }
}

// Handle CORS preflight
router.options('*', (request) => {
  const origin = request.headers.get('Origin') || '*';
  return new Response(null, {
    headers: {
      ...corsHeaders,
      'Access-Control-Allow-Origin': origin
    }
  });
});

// Get instance info endpoint
router.get('/instance/:id', async (request, env) => {
  const instanceId = request.params?.id;
  
  if (!instanceId) {
    return new Response(JSON.stringify({ error: 'Instance ID is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Validate instance ID format
  if (!validateInstanceId(instanceId)) {
    return new Response(JSON.stringify({ error: 'Invalid instance ID format' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const responseHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    ...securityHeaders
  };
  
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
  const responseHeaders = {
    'Content-Type': 'application/json',
    ...corsHeaders,
    'Access-Control-Allow-Origin': origin,
    ...securityHeaders
  };
  
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
    const clientId = sessionId || request.headers.get('CF-Connecting-IP') || 'anonymous';
    const hourlyKey = `rate:hour:${instanceId}:${clientId}`;
    const sessionKey = `rate:session:${instanceId}:${sessionId}`;
    
    // Check rate limits
    const rateLimitResult = await checkAndUpdateRateLimit(env, {
      hourlyKey,
      sessionKey,
      hourlyLimit: instanceConfig.rateLimit.messagesPerHour,
      sessionLimit: instanceConfig.rateLimit.messagesPerSession,
      sessionId
    });
    
    if (!rateLimitResult.allowed) {
      return new Response(JSON.stringify({ 
        error: 'Rate limit exceeded',
        message: rateLimitResult.message,
        retryAfter: rateLimitResult.retryAfter
      }), {
        status: 429,
        headers: {
          ...responseHeaders,
          'Retry-After': String(rateLimitResult.retryAfter || 3600)
        }
      });
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
  const responseHeaders = {
    'Content-Type': 'application/json',
    ...securityHeaders
  };
  
  try {
    const { password } = await request.json();
    const adminPassword = env.ADMIN_PASSWORD;
    
    if (!adminPassword) {
      console.error('[Admin] No admin password configured');
      return new Response(JSON.stringify({ error: 'Admin not configured' }), {
        status: 500,
        headers: responseHeaders
      });
    }
    
    if (password === adminPassword) {
      // Generate secure session ID
      const sessionId = crypto.randomUUID();
      const sessionKey = `admin:session:${sessionId}`;
      
      // Store session in KV with 24 hour expiration
      await env.ADMIN_SESSIONS.put(sessionKey, JSON.stringify({
        createdAt: new Date().toISOString(),
        ip: request.headers.get('CF-Connecting-IP') || 'unknown'
      }), {
        expirationTtl: 86400 // 24 hours
      });
      
      // Set cookie with secure flags
      const cookieOptions = [
        `admin_session=${sessionId}`,
        'HttpOnly',
        'Secure',
        'SameSite=Strict',
        'Path=/',
        `Max-Age=${86400}` // 24 hours
      ].join('; ');
      
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
    }
    
    return new Response(JSON.stringify({ error: 'Invalid password' }), {
      status: 401,
      headers: responseHeaders
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
  const responseHeaders = {
    'Content-Type': 'application/json',
    ...securityHeaders
  };
  
  try {
    // Get session ID from various sources
    const authHeader = request.headers.get('Authorization');
    let sessionId = authHeader?.replace('Bearer ', '') || 
                   request.headers.get('X-Admin-Session');
    
    // If no session in headers, check cookies
    if (!sessionId) {
      const cookieHeader = request.headers.get('Cookie');
      const cookies = parseCookies(cookieHeader);
      sessionId = cookies['admin_session'];
    }
    
    // Delete session from KV if found
    if (sessionId) {
      const sessionKey = `admin:session:${sessionId}`;
      await env.ADMIN_SESSIONS.delete(sessionKey);
    }
    
    // Clear cookie
    const clearCookieOptions = [
      'admin_session=',
      'HttpOnly',
      'Secure',
      'SameSite=Strict',
      'Path=/',
      'Max-Age=0' // Expire immediately
    ].join('; ');
    
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

// Cookie parsing utility
function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  
  cookieHeader.split(';').forEach(cookie => {
    const [key, value] = cookie.trim().split('=');
    if (key && value) {
      cookies[key] = decodeURIComponent(value);
    }
  });
  
  return cookies;
}

// Admin session validation helper
async function validateAdminSession(request, env) {
  // Check for session in Authorization header, X-Admin-Session header, or cookie
  const authHeader = request.headers.get('Authorization');
  let sessionId = authHeader?.replace('Bearer ', '') || 
                 request.headers.get('X-Admin-Session');
  
  // If no session in headers, check cookies
  if (!sessionId) {
    const cookieHeader = request.headers.get('Cookie');
    const cookies = parseCookies(cookieHeader);
    sessionId = cookies['admin_session'];
  }
  
  if (!sessionId) {
    return false;
  }
  
  const sessionKey = `admin:session:${sessionId}`;
  const session = await env.ADMIN_SESSIONS.get(sessionKey);
  
  return session !== null;
}

// Admin dashboard
router.get('/admin/dashboard', async (request, env) => {
  // Validate session
  const isValid = await validateAdminSession(request, env);
  if (!isValid) {
    return new Response(null, {
      status: 302,
      headers: { 'Location': '/admin' }
    });
  }
  
  // Get all instances from database with v2 schema
  const instances = await env.DB.prepare(`
    SELECT i.*, 
      COUNT(DISTINCT d.id) as domain_count,
      COUNT(DISTINCT p.id) as path_count
    FROM agent_instances i
    LEFT JOIN instance_domains d ON i.id = d.instance_id
    LEFT JOIN instance_paths p ON i.id = p.instance_id
    GROUP BY i.id
    ORDER BY i.created_at DESC
  `).all();
  
  const instanceRows = instances.results.map(instance => `
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
    return new Response(null, {
      status: 302,
      headers: { 'Location': '/admin' }
    });
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
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
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
    
    // Start transaction
    const statements = [];
    
    // Insert instance
    statements.push(env.DB.prepare(
      `INSERT INTO agent_instances (id, typingmind_agent_id, name, api_key) 
       VALUES (?, ?, ?, ?)`
    ).bind(data.id, data.typingmind_agent_id, data.name, data.api_key || null));
    
    // Insert domains
    if (data.domains && data.domains.length > 0) {
      for (const domain of data.domains) {
        statements.push(env.DB.prepare(
          `INSERT INTO instance_domains (instance_id, domain) VALUES (?, ?)`
        ).bind(data.id, domain));
      }
    }
    
    // Insert rate limits
    statements.push(env.DB.prepare(
      `INSERT INTO instance_rate_limits (instance_id, messages_per_hour, messages_per_session) 
       VALUES (?, ?, ?)`
    ).bind(data.id, data.messages_per_hour || 100, data.messages_per_session || 30));
    
    // Insert features
    statements.push(env.DB.prepare(
      `INSERT INTO instance_features (instance_id, image_upload, markdown, persist_session) 
       VALUES (?, ?, ?, ?)`
    ).bind(data.id, data.image_upload ? 1 : 0, data.markdown ? 1 : 0, data.persist_session ? 1 : 0));
    
    // Insert theme
    statements.push(env.DB.prepare(
      `INSERT INTO instance_themes (instance_id, primary_color, position, width, embed_mode) 
       VALUES (?, ?, ?, ?, ?)`
    ).bind(data.id, data.primary_color || '#007bff', data.position || 'bottom-right', 
           data.width || 380, data.embed_mode || 'popup'));
    
    // Execute all statements
    await env.DB.batch(statements);
    
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
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    const { id } = request.params;
    
    // Delete instance (cascading deletes will handle related tables)
    await env.DB.prepare('DELETE FROM agent_instances WHERE id = ?').bind(id).run();
    
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
    return new Response(null, {
      status: 302,
      headers: { 'Location': '/admin' }
    });
  }
  
  const { id } = request.params;
  
  // Get instance data with all related data
  const instance = await env.DB.prepare(`
    SELECT * FROM agent_instances WHERE id = ?
  `).bind(id).first();
  
  if (!instance) {
    return new Response('Instance not found', { status: 404 });
  }
  
  // Get domains
  const domains = await env.DB.prepare(`
    SELECT domain FROM instance_domains WHERE instance_id = ?
  `).bind(id).all();
  
  // Get features
  const features = await env.DB.prepare(`
    SELECT * FROM instance_features WHERE instance_id = ?
  `).bind(id).first();
  
  // Get rate limits
  const rateLimits = await env.DB.prepare(`
    SELECT * FROM instance_rate_limits WHERE instance_id = ?
  `).bind(id).first();
  
  // Get theme
  const theme = await env.DB.prepare(`
    SELECT * FROM instance_themes WHERE instance_id = ?
  `).bind(id).first();
  
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
        <textarea id="domains" name="domains">${domains.results.map(d => d.domain).join('\n')}</textarea>
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
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    const { id } = request.params;
    const data = await request.json();
    
    // Start transaction
    const statements = [];
    
    // Update main instance
    statements.push(env.DB.prepare(`
      UPDATE agent_instances 
      SET name = ?, typingmind_agent_id = ?, api_key = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(data.name, data.typingmind_agent_id, data.api_key || null, id));
    
    // Delete existing domains and re-insert
    statements.push(env.DB.prepare('DELETE FROM instance_domains WHERE instance_id = ?').bind(id));
    if (data.domains && data.domains.length > 0) {
      for (const domain of data.domains) {
        statements.push(env.DB.prepare('INSERT INTO instance_domains (instance_id, domain) VALUES (?, ?)').bind(id, domain));
      }
    }
    
    // Update features
    statements.push(env.DB.prepare(`
      INSERT OR REPLACE INTO instance_features (instance_id, markdown, image_upload, persist_session) 
      VALUES (?, ?, ?, ?)
    `).bind(id, data.markdown ? 1 : 0, data.image_upload ? 1 : 0, data.persist_session ? 1 : 0));
    
    // Update rate limits
    statements.push(env.DB.prepare(`
      INSERT OR REPLACE INTO instance_rate_limits (instance_id, messages_per_hour, messages_per_session) 
      VALUES (?, ?, ?)
    `).bind(id, data.messages_per_hour, data.messages_per_session));
    
    // Update theme
    statements.push(env.DB.prepare(`
      INSERT OR REPLACE INTO instance_themes (instance_id, primary_color, position, width, embed_mode) 
      VALUES (?, ?, ?, ?, ?)
    `).bind(id, data.primary_color, data.position, data.width, data.embed_mode));
    
    // Execute all statements
    await env.DB.batch(statements);
    
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
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    const { id } = request.params;
    const { name } = await request.json();
    
    // Generate new instance ID
    const newId = name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now();
    
    // Get source instance data
    const source = await env.DB.prepare(`
      SELECT * FROM agent_instances WHERE id = ?
    `).bind(id).first();
    
    if (!source) {
      return new Response(JSON.stringify({ error: 'Source instance not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Start transaction
    const statements = [];
    
    // Clone instance
    statements.push(env.DB.prepare(
      `INSERT INTO agent_instances (id, typingmind_agent_id, name, api_key) 
       VALUES (?, ?, ?, ?)`
    ).bind(newId, source.typingmind_agent_id, name, source.api_key));
    
    // Clone domains
    const domains = await env.DB.prepare(
      'SELECT domain FROM instance_domains WHERE instance_id = ?'
    ).bind(id).all();
    
    for (const domain of domains.results) {
      statements.push(env.DB.prepare(
        `INSERT INTO instance_domains (instance_id, domain) VALUES (?, ?)`
      ).bind(newId, domain.domain));
    }
    
    // Clone rate limits
    const rateLimits = await env.DB.prepare(
      'SELECT * FROM instance_rate_limits WHERE instance_id = ?'
    ).bind(id).first();
    
    if (rateLimits) {
      statements.push(env.DB.prepare(
        `INSERT INTO instance_rate_limits (instance_id, messages_per_hour, messages_per_session) 
         VALUES (?, ?, ?)`
      ).bind(newId, rateLimits.messages_per_hour, rateLimits.messages_per_session));
    }
    
    // Clone features
    const features = await env.DB.prepare(
      'SELECT * FROM instance_features WHERE instance_id = ?'
    ).bind(id).first();
    
    if (features) {
      statements.push(env.DB.prepare(
        `INSERT INTO instance_features (instance_id, image_upload, markdown, persist_session) 
         VALUES (?, ?, ?, ?)`
      ).bind(newId, features.image_upload, features.markdown, features.persist_session));
    }
    
    // Clone theme
    const theme = await env.DB.prepare(
      'SELECT * FROM instance_themes WHERE instance_id = ?'
    ).bind(id).first();
    
    if (theme) {
      statements.push(env.DB.prepare(
        `INSERT INTO instance_themes (instance_id, primary_color, position, width, embed_mode) 
         VALUES (?, ?, ?, ?, ?)`
      ).bind(newId, theme.primary_color, theme.position, theme.width, theme.embed_mode));
    }
    
    // Execute all statements
    await env.DB.batch(statements);
    
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