/**
 * Admin UI renderer
 */

export async function renderAdminUI(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  
  // Check if user is authenticated for protected pages
  if (path !== '/admin' && path !== '/admin/') {
    const cookie = request.headers.get('Cookie');
    const sessionId = extractSessionId(cookie);
    
    if (!sessionId) {
      return new Response('', {
        status: 302,
        headers: { 'Location': '/admin' }
      });
    }
    
    const session = await env.ADMIN_SESSIONS.get(`session:${sessionId}`, 'json');
    if (!session) {
      return new Response('', {
        status: 302,
        headers: { 'Location': '/admin' }
      });
    }
  }
  
  // Route to appropriate page
  if (path === '/admin' || path === '/admin/') {
    return renderLoginPage();
  } else if (path === '/admin/dashboard') {
    return renderDashboard();
  } else if (path === '/admin/agents') {
    return renderAgentsList();
  } else if (path === '/admin/agents/new') {
    return renderAgentForm();
  } else if (path.match(/^\/admin\/agents\/[^/]+$/)) {
    return renderAgentForm(path.split('/').pop());
  }
  
  return new Response('Not Found', { status: 404 });
}

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

function renderDashboard() {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard - TypingMind Chatbot Platform</title>
  <style>
    ${getAdminStyles()}
  </style>
</head>
<body>
  <div class="admin-container">
    ${renderAdminNav('dashboard')}
    
    <main class="admin-content">
      <h1>Dashboard</h1>
      
      <div class="stats-grid">
        <div class="stat-card">
          <h3>Total Agents</h3>
          <div class="stat-value" id="totalAgents">-</div>
        </div>
        <div class="stat-card">
          <h3>Messages Today</h3>
          <div class="stat-value" id="messagesToday">-</div>
        </div>
        <div class="stat-card">
          <h3>Active Sessions</h3>
          <div class="stat-value" id="activeSessions">-</div>
        </div>
        <div class="stat-card">
          <h3>Response Time</h3>
          <div class="stat-value" id="responseTime">-</div>
        </div>
      </div>
      
      <div class="recent-activity">
        <h2>Recent Activity</h2>
        <div id="activityList">Loading...</div>
      </div>
    </main>
  </div>
  
  <script>
    // Load dashboard data
    async function loadDashboard() {
      try {
        const response = await fetch('/api/admin/agents');
        const agents = await response.json();
        document.getElementById('totalAgents').textContent = agents.length;
        
        // TODO: Load real analytics data
        document.getElementById('messagesToday').textContent = '0';
        document.getElementById('activeSessions').textContent = '0';
        document.getElementById('responseTime').textContent = '0ms';
      } catch (error) {
        console.error('Failed to load dashboard:', error);
      }
    }
    
    loadDashboard();
  </script>
</body>
</html>
  `;
  
  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}

function renderAgentsList() {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Agents - TypingMind Chatbot Platform</title>
  <style>
    ${getAdminStyles()}
  </style>
</head>
<body>
  <div class="admin-container">
    ${renderAdminNav('agents')}
    
    <main class="admin-content">
      <div class="page-header">
        <h1>Agents</h1>
        <a href="/admin/agents/new" class="btn btn-primary">Add New Agent</a>
      </div>
      
      <div class="agents-table">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Agent ID</th>
              <th>Allowed Domains</th>
              <th>API Key</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="agentsList">
            <tr>
              <td colspan="5" class="loading">Loading agents...</td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>
  </div>
  
  <script>
    async function loadAgents() {
      try {
        const response = await fetch('/api/admin/agents');
        const agents = await response.json();
        
        const tbody = document.getElementById('agentsList');
        
        if (agents.length === 0) {
          tbody.innerHTML = '<tr><td colspan="5" class="empty">No agents configured</td></tr>';
          return;
        }
        
        tbody.innerHTML = agents.map(agent => \`
          <tr>
            <td>\${agent.name}</td>
            <td><code>\${agent.id}</code></td>
            <td>\${agent.allowedDomains.join(', ')}</td>
            <td>\${agent.apiKey ? 'Custom' : 'Default'}</td>
            <td>
              <a href="/admin/agents/\${agent.internalId}" class="btn btn-sm">Edit</a>
              <button onclick="deleteAgent('\${agent.internalId}')" class="btn btn-sm btn-danger">Delete</button>
            </td>
          </tr>
        \`).join('');
      } catch (error) {
        console.error('Failed to load agents:', error);
      }
    }
    
    async function deleteAgent(id) {
      if (!confirm('Are you sure you want to delete this agent?')) return;
      
      try {
        const response = await fetch(\`/api/admin/agents/\${id}\`, {
          method: 'DELETE'
        });
        
        if (response.ok) {
          loadAgents();
        } else {
          alert('Failed to delete agent');
        }
      } catch (error) {
        alert('Network error');
      }
    }
    
    loadAgents();
  </script>
</body>
</html>
  `;
  
  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}

function renderAgentForm(agentId = null) {
  const isEdit = !!agentId;
  const title = isEdit ? 'Edit Agent' : 'Create New Agent';
  
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - TypingMind Chatbot Platform</title>
  <style>
    ${getAdminStyles()}
  </style>
</head>
<body>
  <div class="admin-container">
    ${renderAdminNav('agents')}
    
    <main class="admin-content">
      <h1>${title}</h1>
      
      <form id="agentForm" class="agent-form">
        <div class="form-section">
          <h2>Basic Information</h2>
          
          <div class="form-group">
            <label for="name">Agent Name</label>
            <input type="text" id="name" name="name" required>
          </div>
          
          <div class="form-group">
            <label for="id">TypingMind Agent ID</label>
            <input type="text" id="id" name="id" placeholder="character-c4d6907a-b76b-4729..." required>
            <small>The agent ID from your TypingMind dashboard</small>
          </div>
          
          <div class="form-group">
            <label for="apiKey">API Key (Optional)</label>
            <input type="text" id="apiKey" name="apiKey" placeholder="Leave empty to use default">
            <small>Custom API key for this agent</small>
          </div>
        </div>
        
        <div class="form-section">
          <h2>Access Control</h2>
          
          <div class="form-group">
            <label>Allowed Domains</label>
            <div id="domainsList" class="dynamic-list">
              <input type="text" placeholder="example.com" class="domain-input">
            </div>
            <button type="button" onclick="addDomainField()" class="btn btn-sm">Add Domain</button>
            <small>Use *.example.com for wildcard subdomains</small>
          </div>
          
          <div class="form-group">
            <label>Allowed Paths (Optional)</label>
            <div id="pathsList" class="dynamic-list">
              <input type="text" placeholder="/support/*" class="path-input">
            </div>
            <button type="button" onclick="addPathField()" class="btn btn-sm">Add Path</button>
            <small>Leave empty to allow all paths</small>
          </div>
        </div>
        
        <div class="form-section">
          <h2>Rate Limits</h2>
          
          <div class="form-group">
            <label for="messagesPerHour">Messages Per Hour</label>
            <input type="number" id="messagesPerHour" name="messagesPerHour" value="100" min="1">
          </div>
          
          <div class="form-group">
            <label for="messagesPerSession">Messages Per Session</label>
            <input type="number" id="messagesPerSession" name="messagesPerSession" value="30" min="1">
          </div>
        </div>
        
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">${isEdit ? 'Update' : 'Create'} Agent</button>
          <a href="/admin/agents" class="btn">Cancel</a>
        </div>
      </form>
    </main>
  </div>
  
  <script>
    ${isEdit ? `const agentId = '${agentId}';` : 'const agentId = null;'}
    
    function addDomainField() {
      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = 'example.com';
      input.className = 'domain-input';
      document.getElementById('domainsList').appendChild(input);
    }
    
    function addPathField() {
      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = '/path/*';
      input.className = 'path-input';
      document.getElementById('pathsList').appendChild(input);
    }
    
    async function loadAgent() {
      if (!agentId) return;
      
      try {
        const response = await fetch(\`/api/admin/agents/\${agentId}\`);
        const agent = await response.json();
        
        document.getElementById('name').value = agent.name;
        document.getElementById('id').value = agent.id;
        document.getElementById('apiKey').value = agent.apiKey || '';
        document.getElementById('messagesPerHour').value = agent.rateLimit?.messagesPerHour || 100;
        document.getElementById('messagesPerSession').value = agent.rateLimit?.messagesPerSession || 30;
        
        // Load domains
        const domainsList = document.getElementById('domainsList');
        domainsList.innerHTML = '';
        agent.allowedDomains.forEach(domain => {
          const input = document.createElement('input');
          input.type = 'text';
          input.value = domain;
          input.className = 'domain-input';
          domainsList.appendChild(input);
        });
        
        // Load paths
        if (agent.allowedPaths?.length > 0) {
          const pathsList = document.getElementById('pathsList');
          pathsList.innerHTML = '';
          agent.allowedPaths.forEach(path => {
            const input = document.createElement('input');
            input.type = 'text';
            input.value = path;
            input.className = 'path-input';
            pathsList.appendChild(input);
          });
        }
      } catch (error) {
        alert('Failed to load agent');
        window.location.href = '/admin/agents';
      }
    }
    
    document.getElementById('agentForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const domains = Array.from(document.querySelectorAll('.domain-input'))
        .map(input => input.value.trim())
        .filter(Boolean);
        
      const paths = Array.from(document.querySelectorAll('.path-input'))
        .map(input => input.value.trim())
        .filter(Boolean);
      
      const agentData = {
        name: document.getElementById('name').value,
        id: document.getElementById('id').value,
        apiKey: document.getElementById('apiKey').value || null,
        allowedDomains: domains,
        allowedPaths: paths,
        rateLimit: {
          messagesPerHour: parseInt(document.getElementById('messagesPerHour').value),
          messagesPerSession: parseInt(document.getElementById('messagesPerSession').value)
        }
      };
      
      try {
        const url = agentId ? \`/api/admin/agents/\${agentId}\` : '/api/admin/agents';
        const method = agentId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(agentData)
        });
        
        if (response.ok) {
          window.location.href = '/admin/agents';
        } else {
          const error = await response.json();
          alert(error.error || 'Failed to save agent');
        }
      } catch (error) {
        alert('Network error');
      }
    });
    
    if (agentId) {
      loadAgent();
    }
  </script>
</body>
</html>
  `;
  
  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}

function renderAdminNav(active) {
  return `
    <nav class="admin-nav">
      <div class="admin-logo">
        <h2>TypingMind Chatbot Admin</h2>
      </div>
      <ul class="nav-menu">
        <li><a href="/admin/dashboard" class="${active === 'dashboard' ? 'active' : ''}">Dashboard</a></li>
        <li><a href="/admin/agents" class="${active === 'agents' ? 'active' : ''}">Agents</a></li>
        <li><a href="/admin/analytics" class="${active === 'analytics' ? 'active' : ''}">Analytics</a></li>
        <li><a href="/admin/settings" class="${active === 'settings' ? 'active' : ''}">Settings</a></li>
      </ul>
      <div class="nav-footer">
        <a href="#" onclick="logout()">Logout</a>
      </div>
    </nav>
  `;
}

function getAdminStyles() {
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
    }
    .admin-container {
      display: flex;
      min-height: 100vh;
    }
    .admin-nav {
      width: 250px;
      background: #2c3e50;
      color: white;
      padding: 2rem 0;
    }
    .admin-logo {
      padding: 0 1.5rem;
      margin-bottom: 2rem;
    }
    .admin-logo h2 {
      font-size: 1.25rem;
    }
    .nav-menu {
      list-style: none;
    }
    .nav-menu a {
      display: block;
      padding: 0.75rem 1.5rem;
      color: #bdc3c7;
      text-decoration: none;
      transition: all 0.2s;
    }
    .nav-menu a:hover,
    .nav-menu a.active {
      background: #34495e;
      color: white;
    }
    .nav-footer {
      position: absolute;
      bottom: 2rem;
      padding: 0 1.5rem;
    }
    .nav-footer a {
      color: #bdc3c7;
      text-decoration: none;
    }
    .admin-content {
      flex: 1;
      padding: 2rem;
      max-width: 1200px;
      margin: 0 auto;
      width: 100%;
    }
    h1 {
      margin-bottom: 2rem;
      color: #2c3e50;
    }
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
    }
    .btn {
      display: inline-block;
      padding: 0.5rem 1rem;
      background: #3498db;
      color: white;
      text-decoration: none;
      border-radius: 4px;
      border: none;
      cursor: pointer;
      font-size: 0.875rem;
      transition: background 0.2s;
    }
    .btn:hover {
      background: #2980b9;
    }
    .btn-primary {
      background: #007bff;
    }
    .btn-primary:hover {
      background: #0056b3;
    }
    .btn-danger {
      background: #e74c3c;
    }
    .btn-danger:hover {
      background: #c0392b;
    }
    .btn-sm {
      padding: 0.25rem 0.5rem;
      font-size: 0.8rem;
    }
    table {
      width: 100%;
      background: white;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    th, td {
      padding: 1rem;
      text-align: left;
      border-bottom: 1px solid #ecf0f1;
    }
    th {
      background: #f8f9fa;
      font-weight: 600;
      color: #2c3e50;
    }
    code {
      background: #f8f9fa;
      padding: 0.2rem 0.4rem;
      border-radius: 3px;
      font-size: 0.875rem;
    }
    .loading, .empty {
      text-align: center;
      color: #7f8c8d;
      padding: 2rem;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1.5rem;
      margin-bottom: 3rem;
    }
    .stat-card {
      background: white;
      padding: 1.5rem;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .stat-card h3 {
      font-size: 0.875rem;
      color: #7f8c8d;
      margin-bottom: 0.5rem;
    }
    .stat-value {
      font-size: 2rem;
      font-weight: 600;
      color: #2c3e50;
    }
    .form-section {
      background: white;
      padding: 2rem;
      border-radius: 8px;
      margin-bottom: 1.5rem;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .form-section h2 {
      font-size: 1.25rem;
      margin-bottom: 1.5rem;
      color: #2c3e50;
    }
    .form-group {
      margin-bottom: 1.5rem;
    }
    .form-group label {
      display: block;
      margin-bottom: 0.5rem;
      color: #2c3e50;
      font-weight: 500;
    }
    .form-group input,
    .form-group select {
      width: 100%;
      padding: 0.75rem;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 1rem;
    }
    .form-group small {
      display: block;
      margin-top: 0.25rem;
      color: #7f8c8d;
      font-size: 0.875rem;
    }
    .dynamic-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
    }
    .dynamic-list input {
      width: 100%;
    }
    .form-actions {
      display: flex;
      gap: 1rem;
      padding-top: 1rem;
    }
  `;
}

function extractSessionId(cookieHeader) {
  if (!cookieHeader) return null;
  
  const cookies = cookieHeader.split(';').map(c => c.trim());
  const sessionCookie = cookies.find(c => c.startsWith('admin_session='));
  
  if (!sessionCookie) return null;
  
  return sessionCookie.split('=')[1];
}