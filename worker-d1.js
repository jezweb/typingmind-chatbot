import { Router } from 'itty-router';

const router = Router();

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Origin',
  'Access-Control-Max-Age': '86400',
  'Access-Control-Allow-Credentials': 'true'
};

// Get agent configuration from D1
async function getAgentConfig(db, agentId) {
  const query = `
    SELECT 
      a.id, a.name, a.api_key,
      rl.messages_per_hour, rl.messages_per_session,
      f.image_upload, f.markdown, f.persist_session,
      t.primary_color, t.position, t.width, t.embed_mode
    FROM agents a
    LEFT JOIN agent_rate_limits rl ON a.id = rl.agent_id
    LEFT JOIN agent_features f ON a.id = f.agent_id
    LEFT JOIN agent_themes t ON a.id = t.agent_id
    WHERE a.id = ?
  `;
  
  const result = await db.prepare(query).bind(agentId).first();
  if (!result) return null;
  
  // Get allowed domains
  const domains = await db.prepare(
    'SELECT domain FROM agent_domains WHERE agent_id = ?'
  ).bind(agentId).all();
  
  // Get allowed paths
  const paths = await db.prepare(
    'SELECT path FROM agent_paths WHERE agent_id = ?'
  ).bind(agentId).all();
  
  return {
    id: result.id,
    name: result.name,
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

// Get agent info endpoint
router.get('/agent/:id', async (request, env) => {
  const agentId = request.params?.id;
  
  if (!agentId) {
    return new Response(JSON.stringify({ error: 'Agent ID is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const responseHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
  
  try {
    const agent = await getAgentConfig(env.DB, agentId);
    if (!agent) {
      return new Response(JSON.stringify({ error: 'Agent not found' }), {
        status: 404,
        headers: responseHeaders
      });
    }
    
    // Return limited agent info for public use
    return new Response(JSON.stringify({
      id: agent.id,
      name: agent.name,
      theme: agent.theme,
      width: agent.theme.width
    }), {
      status: 200,
      headers: responseHeaders
    });
  } catch (error) {
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
    'Access-Control-Allow-Origin': origin
  };
  
  try {
    const { agentId, messages, sessionId } = await request.json();
    
    if (!agentId || !messages) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: responseHeaders
      });
    }
    
    // Get agent config from D1
    const agentConfig = await getAgentConfig(env.DB, agentId);
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
    
    // TODO: Add rate limiting (still using KV for now)
    
    // Call TypingMind API
    const apiKey = agentConfig.apiKey || env.DEFAULT_API_KEY;
    const apiHost = env.TYPINGMIND_API_HOST || 'https://api.typingmind.com';
    
    const apiResponse = await fetch(`${apiHost}/api/v2/agents/${agentId}/chat`, {
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
    
    const data = await apiResponse.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: responseHeaders
    });
    
  } catch (error) {
    return new Response(JSON.stringify({ 
      error: 'Internal server error' 
    }), {
      status: 500,
      headers: responseHeaders
    });
  }
});

// Admin login page
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

// Admin dashboard - now shows agents from D1
router.get('/admin/dashboard', async (request, env) => {
  // Get all agents from database
  const agents = await env.DB.prepare(`
    SELECT a.*, 
      COUNT(DISTINCT ad.id) as domain_count,
      COUNT(DISTINCT ap.id) as path_count
    FROM agents a
    LEFT JOIN agent_domains ad ON a.id = ad.agent_id
    LEFT JOIN agent_paths ap ON a.id = ap.agent_id
    GROUP BY a.id
    ORDER BY a.created_at DESC
  `).all();
  
  const agentRows = agents.results.map(agent => `
    <tr>
      <td>${agent.name}</td>
      <td><code>${agent.id}</code></td>
      <td>${agent.domain_count} domains</td>
      <td>${new Date(agent.created_at).toLocaleDateString()}</td>
      <td>
        <a href="/admin/agents/${agent.id}/edit" class="btn btn-sm">Edit</a>
        <button onclick="cloneAgent('${agent.id}')" class="btn btn-sm btn-info">Clone</button>
        <button onclick="copyWidgetCode('${agent.id}', this)" class="btn btn-sm btn-success">Copy Widget Code</button>
        <button onclick="deleteAgent('${agent.id}')" class="btn btn-sm btn-danger">Delete</button>
      </td>
    </tr>
  `).join('');
  
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
    .btn { display: inline-block; padding: 0.5rem 1rem; background: #007bff; color: white; text-decoration: none; border-radius: 4px; border: none; cursor: pointer; }
    .btn:hover { background: #0056b3; }
    .btn-success { background: #28a745; }
    .btn-success:hover { background: #218838; }
    .btn-danger { background: #dc3545; }
    .btn-danger:hover { background: #c82333; }
    .btn-info { background: #17a2b8; }
    .btn-info:hover { background: #138496; }
    .btn-sm { padding: 0.25rem 0.5rem; font-size: 0.875rem; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f8f9fa; font-weight: 600; }
    code { background: #e9ecef; padding: 0.2rem 0.4rem; border-radius: 3px; font-size: 0.875rem; }
  </style>
</head>
<body>
  <div class="container">
    <h1>TypingMind Chatbot Admin</h1>
    
    <div class="card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h2>Agents</h2>
        <a href="/admin/agents/new" class="btn btn-success">Create New Agent</a>
      </div>
      
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Agent ID</th>
            <th>Domains</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${agentRows || '<tr><td colspan="5">No agents found</td></tr>'}
        </tbody>
      </table>
    </div>
    
    <div class="card">
      <h2>Widget Embed Code</h2>
      <pre style="background: #f8f9fa; padding: 1rem; border-radius: 4px; overflow-x: auto;">&lt;script src="https://typingmind-chatbot.webfonts.workers.dev/widget.js"&gt;&lt;/script&gt;
&lt;script&gt;
  TypingMindChat.init({
    agentId: 'YOUR-AGENT-ID'
  });
&lt;/script&gt;</pre>
      <p style="margin-top: 1rem; color: #666;">Position and width are configured in the agent settings.</p>
    </div>
  </div>
  
  <script>
    async function deleteAgent(id) {
      if (!confirm('Are you sure you want to delete this agent?')) return;
      
      const response = await fetch(\`/admin/agents/\${id}\`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        location.reload();
      } else {
        alert('Failed to delete agent');
      }
    }
    
    async function cloneAgent(agentId) {
      if (!confirm('Clone this agent to create a new one with the same settings?')) return;
      
      try {
        const response = await fetch(\`/admin/agents/\${agentId}/clone\`, {
          method: 'POST'
        });
        
        if (response.ok) {
          const result = await response.json();
          alert(\`Agent cloned successfully! New agent ID: \${result.newAgentId}\`);
          window.location.reload();
        } else {
          const error = await response.json();
          alert('Failed to clone agent: ' + error.error);
        }
      } catch (error) {
        alert('Error cloning agent: ' + error.message);
      }
    }
    
    async function copyWidgetCode(agentId, button) {
      try {
        // Fetch agent info to get embed mode
        const response = await fetch(\`/agent/\${agentId}\`);
        const agent = await response.json();
        
        let widgetCode;
        if (agent.theme && agent.theme.embedMode === 'inline') {
          // Inline mode code
          widgetCode = '<div id="typingmind-chat-container" style="height: 500px; width: 100%;">\\n' +
            '  <!-- Chat widget will fill this container -->\\n' +
            '</div>\\n' +
            '<script src="https://typingmind-chatbot.webfonts.workers.dev/widget.js"><\\/script>\\n' +
            '<script>\\n' +
            '  TypingMindChat.init({\\n' +
            '    agentId: \\'' + agentId + '\\',\\n' +
            '    container: document.getElementById(\\'typingmind-chat-container\\'),\\n' +
            '    embedMode: \\'inline\\'\\n' +
            '  });\\n' +
            '<\\/script>';
        } else {
          // Popup mode code (default)
          widgetCode = '<script src="https://typingmind-chatbot.webfonts.workers.dev/widget.js"><\\/script>\\n' +
            '<script>\\n' +
            '  TypingMindChat.init({\\n' +
            '    agentId: \\'' + agentId + '\\'\\n' +
            '  });\\n' +
            '<\\/script>';
        }
        
        // Try modern clipboard API first
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(widgetCode);
          showCopySuccess(button);
        } else {
          // Fallback to older method
          const textarea = document.createElement('textarea');
          textarea.value = widgetCode;
          textarea.style.position = 'fixed';
          textarea.style.left = '-999999px';
          textarea.style.top = '-999999px';
          document.body.appendChild(textarea);
          textarea.focus();
          textarea.select();
          
          try {
            const successful = document.execCommand('copy');
            if (successful) {
              showCopySuccess(button);
            } else {
              throw new Error('Copy command failed');
            }
          } catch (err) {
            console.error('Fallback copy failed:', err);
            // Last resort: show the code in a prompt
            prompt('Copy the widget code below:', widgetCode);
          } finally {
            document.body.removeChild(textarea);
          }
        }
      } catch (error) {
        console.error('Copy error:', error);
        alert('Failed to copy widget code. Error: ' + error.message);
      }
    }
    
    function showCopySuccess(button) {
      const originalText = button.textContent;
      const originalBackground = button.style.background;
      button.textContent = 'Copied!';
      button.style.background = '#28a745';
      setTimeout(() => {
        button.textContent = originalText;
        button.style.background = originalBackground;
      }, 2000);
    }
  </script>
</body>
</html>`;
  
  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
});

// Create new agent page
router.get('/admin/agents/new', () => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Create Agent</title>
  <style>
    body { font-family: sans-serif; margin: 0; padding: 2rem; background: #f5f5f5; }
    .container { max-width: 800px; margin: 0 auto; }
    .card { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .form-group { margin-bottom: 1rem; }
    label { display: block; margin-bottom: 0.5rem; font-weight: 600; }
    input, textarea, select { width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px; }
    textarea { min-height: 100px; }
    .btn { padding: 0.75rem 1.5rem; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; }
    .btn:hover { background: #0056b3; }
    .help-text { font-size: 0.875rem; color: #666; margin-top: 0.25rem; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Create New Agent</h1>
    
    <form onsubmit="createAgent(event)" class="card">
      <div class="form-group">
        <label for="id">Agent ID</label>
        <input type="text" id="id" name="id" required>
        <div class="help-text">Unique identifier from TypingMind (e.g., character-xxxxx)</div>
      </div>
      
      <div class="form-group">
        <label for="name">Agent Name</label>
        <input type="text" id="name" name="name" required>
      </div>
      
      <div class="form-group">
        <label for="apiKey">API Key (optional)</label>
        <input type="text" id="apiKey" name="apiKey">
        <div class="help-text">Leave empty to use default API key</div>
      </div>
      
      <div class="form-group">
        <label for="domains">Allowed Domains</label>
        <textarea id="domains" name="domains" required placeholder="example.com
*.example.com
app.example.com"></textarea>
        <div class="help-text">One domain per line. Use * for wildcards</div>
      </div>
      
      <div class="form-group">
        <label for="messagesPerHour">Messages Per Hour</label>
        <input type="number" id="messagesPerHour" name="messagesPerHour" value="100">
      </div>
      
      <div class="form-group">
        <label for="messagesPerSession">Messages Per Session</label>
        <input type="number" id="messagesPerSession" name="messagesPerSession" value="30">
      </div>
      
      <div class="form-group">
        <label for="primaryColor">Primary Color</label>
        <input type="color" id="primaryColor" name="primaryColor" value="#007bff">
      </div>
      
      <div class="form-group">
        <label for="position">Widget Position</label>
        <select id="position" name="position">
          <option value="bottom-right">Bottom Right</option>
          <option value="bottom-left">Bottom Left</option>
          <option value="top-right">Top Right</option>
          <option value="top-left">Top Left</option>
        </select>
      </div>
      
      <div class="form-group">
        <label for="width">Widget Width (px)</label>
        <input type="number" id="width" name="width" value="380" min="300" max="600">
        <div class="help-text">Width in pixels (300-600)</div>
      </div>
      
      <div class="form-group">
        <label for="embedMode">Embed Mode</label>
        <select id="embedMode" name="embedMode">
          <option value="popup" selected>Popup (floating widget)</option>
          <option value="inline">Inline (fills container)</option>
        </select>
        <div class="help-text">Popup shows as floating widget, Inline fills the parent container</div>
      </div>
      
      <button type="submit" class="btn">Create Agent</button>
    </form>
  </div>
  
  <script>
    async function createAgent(e) {
      e.preventDefault();
      
      const formData = new FormData(e.target);
      const data = Object.fromEntries(formData);
      data.domains = data.domains.split('\\n').filter(d => d.trim());
      
      const response = await fetch('/admin/agents', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(data)
      });
      
      if (response.ok) {
        window.location.href = '/admin/dashboard';
      } else {
        const error = await response.json();
        alert('Failed to create agent: ' + error.error);
      }
    }
  </script>
</body>
</html>`;
  
  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
});

// Create agent API
router.post('/admin/agents', async (request, env) => {
  try {
    const data = await request.json();
    const { id, name, apiKey, domains, messagesPerHour, messagesPerSession, primaryColor, position, width, embedMode } = data;
    
    // Start transaction
    const tx = await env.DB.batch([
      env.DB.prepare('INSERT INTO agents (id, name, api_key) VALUES (?, ?, ?)')
        .bind(id, name, apiKey || null),
      
      env.DB.prepare('INSERT INTO agent_rate_limits (agent_id, messages_per_hour, messages_per_session) VALUES (?, ?, ?)')
        .bind(id, messagesPerHour || 100, messagesPerSession || 30),
      
      env.DB.prepare('INSERT INTO agent_features (agent_id, image_upload, markdown, persist_session) VALUES (?, ?, ?, ?)')
        .bind(id, 0, 1, 0),
      
      env.DB.prepare('INSERT INTO agent_themes (agent_id, primary_color, position, width, embed_mode) VALUES (?, ?, ?, ?, ?)')
        .bind(id, primaryColor || '#007bff', position || 'bottom-right', width || 380, embedMode || 'popup')
    ]);
    
    // Insert domains
    for (const domain of domains) {
      await env.DB.prepare('INSERT INTO agent_domains (agent_id, domain) VALUES (?, ?)')
        .bind(id, domain).run();
    }
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

// Edit agent page
router.get('/admin/agents/:id/edit', async (request, env) => {
  try {
    // In itty-router v4, when the first param is 'request', params are on request.params
    const id = request.params?.id;
    console.log('Edit route - Agent ID:', id);
    
    if (!id) {
      throw new Error('Agent ID is required');
    }
    
    // Get agent details
    const agent = await getAgentConfig(env.DB, id);
    if (!agent) {
      return new Response('Agent not found', { status: 404 });
    }
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Edit Agent</title>
  <style>
    body { font-family: sans-serif; margin: 0; padding: 2rem; background: #f5f5f5; }
    .container { max-width: 800px; margin: 0 auto; }
    .card { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .form-group { margin-bottom: 1rem; }
    label { display: block; margin-bottom: 0.5rem; font-weight: 600; }
    input, textarea, select { width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px; }
    textarea { min-height: 100px; }
    .btn { padding: 0.75rem 1.5rem; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; }
    .btn:hover { background: #0056b3; }
    .help-text { font-size: 0.875rem; color: #666; margin-top: 0.25rem; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Edit Agent</h1>
    
    <form onsubmit="updateAgent(event)" class="card">
      <input type="hidden" id="id" value="${agent.id}">
      
      <div class="form-group">
        <label>Agent ID</label>
        <input type="text" value="${agent.id}" disabled>
      </div>
      
      <div class="form-group">
        <label for="name">Agent Name</label>
        <input type="text" id="name" name="name" value="${agent.name}" required>
      </div>
      
      <div class="form-group">
        <label for="apiKey">API Key (optional)</label>
        <input type="text" id="apiKey" name="apiKey" value="${agent.apiKey || ''}">
        <div class="help-text">Leave empty to use default API key</div>
      </div>
      
      <div class="form-group">
        <label for="domains">Allowed Domains</label>
        <textarea id="domains" name="domains" required>${agent.allowedDomains.join('\n')}</textarea>
        <div class="help-text">One domain per line. Use * for wildcards</div>
      </div>
      
      <div class="form-group">
        <label for="messagesPerHour">Messages Per Hour</label>
        <input type="number" id="messagesPerHour" name="messagesPerHour" value="${agent.rateLimit.messagesPerHour}">
      </div>
      
      <div class="form-group">
        <label for="messagesPerSession">Messages Per Session</label>
        <input type="number" id="messagesPerSession" name="messagesPerSession" value="${agent.rateLimit.messagesPerSession}">
      </div>
      
      <div class="form-group">
        <label for="primaryColor">Primary Color</label>
        <input type="color" id="primaryColor" name="primaryColor" value="${agent.theme.primaryColor}">
      </div>
      
      <div class="form-group">
        <label for="position">Widget Position</label>
        <select id="position" name="position">
          <option value="bottom-right" ${agent.theme.position === 'bottom-right' ? 'selected' : ''}>Bottom Right</option>
          <option value="bottom-left" ${agent.theme.position === 'bottom-left' ? 'selected' : ''}>Bottom Left</option>
          <option value="top-right" ${agent.theme.position === 'top-right' ? 'selected' : ''}>Top Right</option>
          <option value="top-left" ${agent.theme.position === 'top-left' ? 'selected' : ''}>Top Left</option>
        </select>
      </div>
      
      <div class="form-group">
        <label for="width">Widget Width (px)</label>
        <input type="number" id="width" name="width" value="${agent.theme.width || 380}" min="300" max="600">
        <div class="help-text">Width in pixels (300-600)</div>
      </div>
      
      <div class="form-group">
        <label for="embedMode">Embed Mode</label>
        <select id="embedMode" name="embedMode">
          <option value="popup" ${agent.theme.embedMode === 'popup' ? 'selected' : ''}>Popup (floating widget)</option>
          <option value="inline" ${agent.theme.embedMode === 'inline' ? 'selected' : ''}>Inline (fills container)</option>
        </select>
        <div class="help-text">Popup shows as floating widget, Inline fills the parent container</div>
      </div>
      
      <button type="submit" class="btn">Update Agent</button>
    </form>
  </div>
  
  <script>
    async function updateAgent(e) {
      e.preventDefault();
      
      const formData = new FormData(e.target);
      const data = Object.fromEntries(formData);
      data.id = document.getElementById('id').value;
      data.domains = data.domains.split('\\n').filter(d => d.trim());
      
      const response = await fetch(\`/admin/agents/\${data.id}\`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(data)
      });
      
      if (response.ok) {
        window.location.href = '/admin/dashboard';
      } else {
        const error = await response.json();
        alert('Failed to update agent: ' + error.error);
      }
    }
  </script>
</body>
</html>`;
  
    return new Response(html, {
      headers: { 'Content-Type': 'text/html' }
    });
  } catch (error) {
    console.error('Error in edit route:', error);
    console.error('Error stack:', error.stack);
    return new Response(`Error: ${error.message}\n\nStack: ${error.stack}`, { 
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
});

// Update agent API
router.put('/admin/agents/:id', async (request, env) => {
  try {
    const id = request.params?.id;
    if (!id) {
      throw new Error('Agent ID is required');
    }
    const data = await request.json();
    const { name, apiKey, domains, messagesPerHour, messagesPerSession, primaryColor, position, width, embedMode } = data;
    
    // Update agent
    await env.DB.prepare('UPDATE agents SET name = ?, api_key = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .bind(name, apiKey || null, id).run();
    
    // Update rate limits
    await env.DB.prepare('UPDATE agent_rate_limits SET messages_per_hour = ?, messages_per_session = ? WHERE agent_id = ?')
      .bind(messagesPerHour || 100, messagesPerSession || 30, id).run();
    
    // Update theme
    await env.DB.prepare('UPDATE agent_themes SET primary_color = ?, position = ?, width = ?, embed_mode = ? WHERE agent_id = ?')
      .bind(primaryColor || '#007bff', position || 'bottom-right', width || 380, embedMode || 'popup', id).run();
    
    // Update domains - delete and re-insert
    await env.DB.prepare('DELETE FROM agent_domains WHERE agent_id = ?').bind(id).run();
    for (const domain of domains) {
      await env.DB.prepare('INSERT INTO agent_domains (agent_id, domain) VALUES (?, ?)')
        .bind(id, domain).run();
    }
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

// Delete agent
router.delete('/admin/agents/:id', async (request, env) => {
  try {
    const id = request.params?.id;
    if (!id) {
      throw new Error('Agent ID is required');
    }
    
    // Delete agent (cascades to related tables)
    await env.DB.prepare('DELETE FROM agents WHERE id = ?').bind(id).run();
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

// Clone agent
router.post('/admin/agents/:id/clone', async (request, env) => {
  try {
    const sourceId = request.params?.id;
    if (!sourceId) {
      throw new Error('Source agent ID is required');
    }
    
    // Generate new agent ID
    const newId = `character-${crypto.randomUUID()}`;
    
    // Fetch source agent data
    const sourceAgent = await env.DB.prepare(`
      SELECT 
        a.name, a.api_key,
        rl.messages_per_hour, rl.messages_per_session,
        f.image_upload, f.markdown, f.persist_session,
        t.primary_color, t.position, t.width, t.embed_mode, t.font_family, t.border_radius
      FROM agents a
      LEFT JOIN agent_rate_limits rl ON a.id = rl.agent_id
      LEFT JOIN agent_features f ON a.id = f.agent_id
      LEFT JOIN agent_themes t ON a.id = t.agent_id
      WHERE a.id = ?
    `).bind(sourceId).first();
    
    if (!sourceAgent) {
      throw new Error('Source agent not found');
    }
    
    // Fetch source agent domains
    const domains = await env.DB.prepare(
      'SELECT domain FROM agent_domains WHERE agent_id = ?'
    ).bind(sourceId).all();
    
    // Create new agent with "Copy of" prefix
    const newName = `Copy of ${sourceAgent.name}`;
    
    // Start transaction to create cloned agent
    const tx = await env.DB.batch([
      // Create agent
      env.DB.prepare('INSERT INTO agents (id, name, api_key) VALUES (?, ?, ?)')
        .bind(newId, newName, sourceAgent.api_key),
      
      // Clone rate limits
      env.DB.prepare('INSERT INTO agent_rate_limits (agent_id, messages_per_hour, messages_per_session) VALUES (?, ?, ?)')
        .bind(newId, sourceAgent.messages_per_hour || 100, sourceAgent.messages_per_session || 30),
      
      // Clone features
      env.DB.prepare('INSERT INTO agent_features (agent_id, image_upload, markdown, persist_session) VALUES (?, ?, ?, ?)')
        .bind(newId, sourceAgent.image_upload || 0, sourceAgent.markdown || 1, sourceAgent.persist_session || 0),
      
      // Clone theme
      env.DB.prepare('INSERT INTO agent_themes (agent_id, primary_color, position, width, embed_mode, font_family, border_radius) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(
          newId, 
          sourceAgent.primary_color || '#007bff', 
          sourceAgent.position || 'bottom-right', 
          sourceAgent.width || 380,
          sourceAgent.embed_mode || 'popup',
          sourceAgent.font_family,
          sourceAgent.border_radius || '8px'
        )
    ]);
    
    // Clone domains
    if (domains.results.length > 0) {
      const domainInserts = domains.results.map(d => 
        env.DB.prepare('INSERT INTO agent_domains (agent_id, domain) VALUES (?, ?)')
          .bind(newId, d.domain)
      );
      await env.DB.batch(domainInserts);
    }
    
    return new Response(JSON.stringify({ 
      success: true, 
      newAgentId: newId,
      newAgentName: newName 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
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
    return router.handle(request, env, ctx);
  }
};