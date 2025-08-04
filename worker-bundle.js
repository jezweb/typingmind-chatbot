import { Router } from 'itty-router';

const router = Router();

// CORS headers for widget
const corsHeaders = {
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

// Domain validation function
async function validateDomain(request, agentConfig) {
  const origin = request.headers.get('Origin');
  const referer = request.headers.get('Referer');
  
  if (!origin && !referer) {
    console.log('No origin or referer header');
    return false;
  }
  
  try {
    const requestUrl = origin || referer;
    const { hostname, pathname } = new URL(requestUrl);
    
    // Check allowed domains
    const isDomainAllowed = agentConfig.allowedDomains.some(allowedDomain => {
      // Handle wildcard subdomains
      if (allowedDomain.startsWith('*.')) {
        const baseDomain = allowedDomain.substring(2);
        return hostname === baseDomain || hostname.endsWith(`.${baseDomain}`);
      }
      // Exact match
      return hostname === allowedDomain;
    });
    
    if (!isDomainAllowed) {
      console.log(`Domain ${hostname} not in allowed list:`, agentConfig.allowedDomains);
      return false;
    }
    
    // Check path restrictions if configured
    if (agentConfig.allowedPaths && agentConfig.allowedPaths.length > 0) {
      const isPathAllowed = agentConfig.allowedPaths.some(allowedPath => {
        // Convert wildcard pattern to regex
        const pattern = allowedPath
          .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape special chars
          .replace(/\*/g, '.*'); // Convert * to .*
        
        const regex = new RegExp(`^${pattern}$`);
        return regex.test(pathname);
      });
      
      if (!isPathAllowed) {
        console.log(`Path ${pathname} not in allowed list:`, agentConfig.allowedPaths);
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.error('Domain validation error:', error);
    return false;
  }
}

// Rate limiting check
async function checkRateLimit(request, env, agentConfig, sessionId) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const now = Date.now();
  const hourAgo = now - 60 * 60 * 1000;
  const tenMinutesAgo = now - 10 * 60 * 1000;
  
  // Check IP-based rate limit
  const ipKey = `ratelimit:ip:${agentConfig.id}:${ip}`;
  const ipData = await env.RATE_LIMITS.get(ipKey, 'json') || { messages: [] };
  
  // Filter out old messages and count recent ones
  ipData.messages = ipData.messages.filter(timestamp => timestamp > hourAgo);
  
  if (ipData.messages.length >= (agentConfig.rateLimit?.messagesPerHour || 100)) {
    return { allowed: false, reason: 'IP rate limit exceeded' };
  }
  
  // Check session-based rate limit
  if (sessionId) {
    const sessionKey = `ratelimit:session:${agentConfig.id}:${sessionId}`;
    const sessionData = await env.RATE_LIMITS.get(sessionKey, 'json') || { messages: [] };
    
    sessionData.messages = sessionData.messages.filter(timestamp => timestamp > tenMinutesAgo);
    
    if (sessionData.messages.length >= (agentConfig.rateLimit?.messagesPerSession || 20)) {
      return { allowed: false, reason: 'Session rate limit exceeded' };
    }
    
    // Update session rate limit
    sessionData.messages.push(now);
    await env.RATE_LIMITS.put(sessionKey, JSON.stringify(sessionData), {
      expirationTtl: 600 // 10 minutes
    });
  }
  
  // Update IP rate limit
  ipData.messages.push(now);
  await env.RATE_LIMITS.put(ipKey, JSON.stringify(ipData), {
    expirationTtl: 3600 // 1 hour
  });
  
  return { allowed: true };
}

// Track usage analytics
async function trackUsage(env, agentId, request) {
  try {
    const date = new Date().toISOString().split('T')[0];
    const hour = new Date().getHours();
    const domain = new URL(request.headers.get('Origin') || request.headers.get('Referer') || 'https://unknown').hostname;
    
    // Daily stats
    const dailyKey = `analytics:daily:${date}:${agentId}`;
    const dailyStats = await env.ANALYTICS.get(dailyKey, 'json') || {
      messages: 0,
      sessions: new Set(),
      domains: {}
    };
    
    dailyStats.messages++;
    dailyStats.domains[domain] = (dailyStats.domains[domain] || 0) + 1;
    
    await env.ANALYTICS.put(dailyKey, JSON.stringify(dailyStats), {
      expirationTtl: 86400 * 30 // Keep for 30 days
    });
    
    // Hourly stats for real-time dashboard
    const hourlyKey = `analytics:hourly:${date}:${hour}:${agentId}`;
    const hourlyStats = await env.ANALYTICS.get(hourlyKey, 'json') || {
      messages: 0
    };
    
    hourlyStats.messages++;
    
    await env.ANALYTICS.put(hourlyKey, JSON.stringify(hourlyStats), {
      expirationTtl: 86400 * 7 // Keep for 7 days
    });
  } catch (error) {
    console.error('Analytics tracking error:', error);
    // Don't fail the request if analytics fails
  }
}

// Handle chat requests
async function handleChatRequest(request, env, agentConfig, messages, sessionId) {
  // Check rate limits
  const rateLimitResult = await checkRateLimit(request, env, agentConfig, sessionId);
  if (!rateLimitResult.allowed) {
    return new Response(JSON.stringify({ 
      error: rateLimitResult.reason 
    }), { 
      status: 429,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Track analytics
  await trackUsage(env, agentConfig.id, request);
  
  // Prepare API request
  const apiKey = agentConfig.apiKey || env.DEFAULT_API_KEY;
  const apiHost = env.TYPINGMIND_API_HOST || 'https://api.typingmind.com';
  
  try {
    // Call TypingMind API
    const apiResponse = await fetch(`${apiHost}/api/v2/agents/${agentConfig.id}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey
      },
      body: JSON.stringify({ messages })
    });
    
    if (!apiResponse.ok) {
      console.error('TypingMind API error:', apiResponse.status, await apiResponse.text());
      return new Response(JSON.stringify({ 
        error: 'Failed to get response from AI' 
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Handle streaming response if applicable
    const contentType = apiResponse.headers.get('Content-Type');
    
    if (contentType?.includes('text/event-stream')) {
      // Stream the response back to client
      return new Response(apiResponse.body, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      });
    } else {
      // Return JSON response
      const data = await apiResponse.json();
      return new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    console.error('Chat handler error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error' 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Admin login page
function renderLoginPage() {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Login - TypingMind Chatbot Platform</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .login-form {
      background: white;
      padding: 2rem;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      width: 100%;
      max-width: 400px;
    }
    h1 {
      margin-bottom: 1.5rem;
      color: #333;
      text-align: center;
    }
    .form-group {
      margin-bottom: 1rem;
    }
    label {
      display: block;
      margin-bottom: 0.5rem;
      color: #666;
      font-size: 0.875rem;
    }
    input {
      width: 100%;
      padding: 0.75rem;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 1rem;
    }
    button {
      width: 100%;
      padding: 0.75rem;
      background: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 1rem;
      cursor: pointer;
      transition: background 0.2s;
    }
    button:hover {
      background: #0056b3;
    }
    .error {
      color: #dc3545;
      font-size: 0.875rem;
      margin-top: 0.5rem;
      display: none;
    }
  </style>
</head>
<body>
  <div class="login-form">
    <h1>Admin Login</h1>
    <form id="loginForm">
      <div class="form-group">
        <label for="password">Password</label>
        <input type="password" id="password" name="password" required autofocus>
      </div>
      <button type="submit">Login</button>
      <div class="error" id="error"></div>
    </form>
  </div>
  
  <script>
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const password = document.getElementById('password').value;
      const errorDiv = document.getElementById('error');
      
      try {
        const response = await fetch('/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
          window.location.href = '/admin/dashboard';
        } else {
          errorDiv.textContent = data.error || 'Login failed';
          errorDiv.style.display = 'block';
        }
      } catch (error) {
        errorDiv.textContent = 'Network error';
        errorDiv.style.display = 'block';
      }
    });
  </script>
</body>
</html>
  `;
  
  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}

// Handle CORS preflight
router.options('*', () => {
  return new Response(null, {
    headers: corsHeaders
  });
});

// Chat endpoint
router.post('/chat', async (request, env) => {
  try {
    const origin = request.headers.get('Origin');
    
    // Validate request body
    const body = await request.json();
    const { agentId, messages, sessionId } = body;
    
    if (!agentId || !messages || !Array.isArray(messages)) {
      return new Response('Invalid request', { 
        status: 400,
        headers: { ...corsHeaders, 'Access-Control-Allow-Origin': origin || '*' }
      });
    }
    
    // Get agent configuration
    const agentConfig = await env.AGENT_CONFIG.get(`agent:${agentId}`, 'json');
    if (!agentConfig) {
      return new Response('Agent not found', { 
        status: 404,
        headers: { ...corsHeaders, 'Access-Control-Allow-Origin': origin || '*' }
      });
    }
    
    // Validate domain
    const domainValid = await validateDomain(request, agentConfig);
    if (!domainValid) {
      return new Response('Domain not authorized', { 
        status: 403,
        headers: corsHeaders
      });
    }
    
    // Handle chat request
    const response = await handleChatRequest(request, env, agentConfig, messages, sessionId);
    
    // Add CORS headers to response
    const newHeaders = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      newHeaders.set(key, value);
    });
    newHeaders.set('Access-Control-Allow-Origin', origin || '*');
    
    return new Response(response.body, {
      status: response.status,
      headers: newHeaders
    });
  } catch (error) {
    console.error('Chat error:', error);
    return new Response('Internal server error', { 
      status: 500,
      headers: corsHeaders
    });
  }
});

// Admin routes (simplified for now)
router.get('/admin', () => renderLoginPage());
router.get('/admin/', () => renderLoginPage());

router.post('/admin/login', async (request, env) => {
  try {
    const { password } = await request.json();
    
    if (!password) {
      return new Response(JSON.stringify({ error: 'Password required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Check password against environment variable
    const adminPassword = env.ADMIN_PASSWORD || 'Uptake-Skillful8-Spearman';
    if (password === adminPassword) { 
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    
    return new Response(JSON.stringify({ error: 'Invalid password' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Auth error:', error);
    return new Response(JSON.stringify({ error: 'Authentication failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

// Admin dashboard
router.get('/admin/dashboard', () => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard - TypingMind Chatbot Platform</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      padding: 2rem;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    h1 {
      margin-bottom: 2rem;
      color: #333;
    }
    .notice {
      background: #fff3cd;
      border: 1px solid #ffeaa7;
      color: #856404;
      padding: 1rem;
      border-radius: 4px;
      margin-bottom: 2rem;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .stat-card {
      background: white;
      padding: 1.5rem;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .stat-card h3 {
      font-size: 0.875rem;
      color: #666;
      margin-bottom: 0.5rem;
    }
    .stat-value {
      font-size: 2rem;
      font-weight: 600;
      color: #333;
    }
    .actions {
      background: white;
      padding: 2rem;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .btn {
      display: inline-block;
      padding: 0.75rem 1.5rem;
      background: #007bff;
      color: white;
      text-decoration: none;
      border-radius: 4px;
      margin-right: 1rem;
      margin-bottom: 1rem;
    }
    .btn:hover {
      background: #0056b3;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>TypingMind Chatbot Admin Dashboard</h1>
    
    <div class="notice">
      <strong>⚠️ Admin Panel Under Construction</strong><br>
      The full admin interface is being developed. For now, you can manage agents directly via the Cloudflare KV dashboard.
    </div>
    
    <div class="stats">
      <div class="stat-card">
        <h3>Total Agents</h3>
        <div class="stat-value">0</div>
      </div>
      <div class="stat-card">
        <h3>Messages Today</h3>
        <div class="stat-value">0</div>
      </div>
      <div class="stat-card">
        <h3>Active Domains</h3>
        <div class="stat-value">0</div>
      </div>
    </div>
    
    <div class="actions">
      <h2>Quick Actions</h2>
      <p style="margin-bottom: 1rem;">Use these links to manage your chatbot platform:</p>
      <a href="https://dash.cloudflare.com" target="_blank" class="btn">Open Cloudflare Dashboard</a>
      <a href="/widget.js" class="btn">View Widget Code</a>
      <a href="/admin" onclick="if(confirm('Logout?')){document.cookie='admin_session=;path=/;expires=Thu, 01 Jan 1970 00:00:00 GMT';return true;}return false;" class="btn" style="background:#dc3545">Logout</a>
    </div>
    
    <div style="margin-top: 2rem; background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
      <h2>Next Steps</h2>
      <ol style="margin-left: 1.5rem; line-height: 1.8;">
        <li>Go to your Cloudflare Dashboard → Workers & Pages → KV</li>
        <li>Find the "AGENT_CONFIG" namespace</li>
        <li>Add a new key-value pair:
          <ul style="margin-top: 0.5rem;">
            <li>Key: <code>agent:your-agent-id</code></li>
            <li>Value: Agent configuration JSON (see example below)</li>
          </ul>
        </li>
        <li>Embed the widget on your website using the provided code</li>
      </ol>
      
      <h3 style="margin-top: 1.5rem;">Example Agent Configuration:</h3>
      <pre style="background: #f8f9fa; padding: 1rem; border-radius: 4px; overflow-x: auto; margin-top: 0.5rem;">
{
  "id": "character-c4d6907a-b76b-4729...",
  "name": "Customer Support Bot",
  "apiKey": null,
  "allowedDomains": ["example.com", "*.example.com"],
  "allowedPaths": [],
  "rateLimit": {
    "messagesPerHour": 100,
    "messagesPerSession": 30
  },
  "features": {
    "imageUpload": false,
    "markdown": true,
    "persistSession": false
  },
  "theme": {
    "primaryColor": "#007bff",
    "position": "bottom-right"
  }
}</pre>
      
      <h3 style="margin-top: 1.5rem;">Widget Embed Code:</h3>
      <pre style="background: #f8f9fa; padding: 1rem; border-radius: 4px; overflow-x: auto; margin-top: 0.5rem;">
&lt;script src="https://typingmind-chatbot.webfonts.workers.dev/widget.js"&gt;&lt;/script&gt;
&lt;script&gt;
  TypingMindChat.init({
    agentId: 'your-agent-id',
    position: 'bottom-right'
  });
&lt;/script&gt;</pre>
    </div>
  </div>
</body>
</html>
  `;
  
  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
});

// Widget delivery
router.get('/widget.js', async (request, env) => {
  // In production, this would serve the built widget file
  const widgetCode = `
    // TypingMind Chat Widget
    (function() {
      console.log('TypingMind Chat Widget loaded');
      window.TypingMindChat = {
        init: function(config) {
          console.log('Initializing with config:', config);
          // Widget implementation will be added here
        }
      };
    })();
  `;
  
  return new Response(widgetCode, {
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'public, max-age=3600'
    }
  });
});

// 404 handler
router.all('*', () => new Response('Not Found', { status: 404 }));

// Main request handler
export default {
  async fetch(request, env, ctx) {
    return router.handle(request, env);
  }
};