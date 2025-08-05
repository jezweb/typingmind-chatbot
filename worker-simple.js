import { Router } from 'itty-router';

const router = Router();

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Origin',
  'Access-Control-Max-Age': '86400',
  'Access-Control-Allow-Credentials': 'true'
};

// Simple domain validation
async function validateDomain(request, agentConfig) {
  const origin = request.headers.get('Origin');
  const referer = request.headers.get('Referer');
  
  if (!origin && !referer) return false;
  
  try {
    const requestUrl = origin || referer;
    const { hostname } = new URL(requestUrl);
    
    return agentConfig.allowedDomains.some(allowedDomain => {
      if (allowedDomain.startsWith('*.')) {
        const baseDomain = allowedDomain.substring(2);
        return hostname === baseDomain || hostname.endsWith(`.${baseDomain}`);
      }
      return hostname === allowedDomain;
    });
  } catch (error) {
    return false;
  }
}

// Simple rate limiting
async function checkRateLimit(request, env, agentConfig, sessionId) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const now = Date.now();
  const hourAgo = now - 60 * 60 * 1000;
  
  const ipKey = `ratelimit:ip:${agentConfig.id}:${ip}`;
  const ipData = await env.RATE_LIMITS.get(ipKey, 'json') || { messages: [] };
  
  ipData.messages = ipData.messages.filter(timestamp => timestamp > hourAgo);
  
  if (ipData.messages.length >= (agentConfig.rateLimit?.messagesPerHour || 100)) {
    return { allowed: false, reason: 'Rate limit exceeded' };
  }
  
  ipData.messages.push(now);
  await env.RATE_LIMITS.put(ipKey, JSON.stringify(ipData), {
    expirationTtl: 3600
  });
  
  return { allowed: true };
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

// Chat endpoint - simplified and robust
router.post('/chat', async (request, env) => {
  const origin = request.headers.get('Origin') || '*';
  const responseHeaders = {
    'Content-Type': 'application/json',
    ...corsHeaders,
    'Access-Control-Allow-Origin': origin
  };
  
  try {
    // Parse request
    const { agentId, messages, sessionId } = await request.json();
    
    if (!agentId || !messages) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: responseHeaders
      });
    }
    
    // Get agent config
    const agentConfig = await env.AGENT_CONFIG.get(`agent:${agentId}`, 'json');
    if (!agentConfig) {
      return new Response(JSON.stringify({ error: 'Agent not found' }), {
        status: 404,
        headers: responseHeaders
      });
    }
    
    // Validate domain
    if (!await validateDomain(request, agentConfig)) {
      return new Response(JSON.stringify({ error: 'Domain not authorized' }), {
        status: 403,
        headers: responseHeaders
      });
    }
    
    // Check rate limit
    const rateLimit = await checkRateLimit(request, env, agentConfig, sessionId);
    if (!rateLimit.allowed) {
      return new Response(JSON.stringify({ error: rateLimit.reason }), {
        status: 429,
        headers: responseHeaders
      });
    }
    
    // Call TypingMind API
    const apiKey = agentConfig.apiKey || env.DEFAULT_API_KEY;
    const apiHost = env.TYPINGMIND_API_HOST || 'https://api.typingmind.com';
    
    const apiResponse = await fetch(`${apiHost}/api/v2/agents/${agentConfig.id}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey
      },
      body: JSON.stringify({ messages })
    });
    
    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      return new Response(JSON.stringify({ 
        error: `API error: ${apiResponse.status}` 
      }), {
        status: 500,
        headers: responseHeaders
      });
    }
    
    // Return API response
    const data = await apiResponse.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: responseHeaders
    });
    
  } catch (error) {
    // Simple error response without stack traces
    return new Response(JSON.stringify({ 
      error: 'Internal server error' 
    }), {
      status: 500,
      headers: responseHeaders
    });
  }
});

// Simple admin login page
router.get('/admin', () => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Login</title>
  <style>
    body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f5f5f5; }
    .login { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    input, button { width: 100%; padding: 0.75rem; margin: 0.5rem 0; }
    button { background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; }
  </style>
</head>
<body>
  <div class="login">
    <h2>Admin Login</h2>
    <form onsubmit="login(event)">
      <input type="password" id="password" placeholder="Password" required>
      <button type="submit">Login</button>
    </form>
  </div>
  <script>
    async function login(e) {
      e.preventDefault();
      const response = await fetch('/admin/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({password: document.getElementById('password').value})
      });
      if (response.ok) window.location.href = '/admin/dashboard';
      else alert('Invalid password');
    }
  </script>
</body>
</html>`;
  
  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
});

// Admin login
router.post('/admin/login', async (request, env) => {
  try {
    const { password } = await request.json();
    const adminPassword = env.ADMIN_PASSWORD || 'Uptake-Skillful8-Spearman';
    
    if (password === adminPassword) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ error: 'Invalid password' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Auth failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

// Admin dashboard
router.get('/admin/dashboard', () => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Dashboard</title>
  <style>
    body { font-family: sans-serif; margin: 0; padding: 2rem; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; }
    .card { background: white; padding: 2rem; margin: 1rem 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    pre { background: #f8f9fa; padding: 1rem; border-radius: 4px; overflow-x: auto; }
    code { background: #e9ecef; padding: 0.2rem 0.4rem; border-radius: 3px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>TypingMind Chatbot Admin</h1>
    
    <div class="card">
      <h2>Widget Embed Code</h2>
      <pre>&lt;script src="https://typingmind-chatbot.webfonts.workers.dev/widget.js"&gt;&lt;/script&gt;
&lt;script&gt;
  TypingMindChat.init({
    agentId: 'character-c4d6907a-b76b-4729-b444-b2ba06d55133',
    position: 'bottom-right'
  });
&lt;/script&gt;</pre>
    </div>
    
    <div class="card">
      <h2>Agent Configuration</h2>
      <p>To configure agents, go to Cloudflare Dashboard → Workers & Pages → KV → AGENT_CONFIG namespace</p>
      <p>Add entries with key format: <code>agent:YOUR-AGENT-ID</code></p>
      <h3>Example Configuration:</h3>
      <pre>{
  "id": "character-c4d6907a-b76b-4729-b444-b2ba06d55133",
  "name": "SEO Assistant",
  "apiKey": null,
  "allowedDomains": ["newcastleseo.com.au", "*.newcastleseo.com.au"],
  "allowedPaths": [],
  "rateLimit": {
    "messagesPerHour": 100,
    "messagesPerSession": 30
  },
  "features": {
    "imageUpload": false,
    "markdown": true,
    "persistSession": false
  }
}</pre>
    </div>
  </div>
</body>
</html>`;
  
  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
});

// Widget endpoint
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

// 404 handler
router.all('*', () => new Response('Not Found', { status: 404 }));

// Export worker
export default {
  async fetch(request, env, ctx) {
    return router.handle(request, env);
  }
};