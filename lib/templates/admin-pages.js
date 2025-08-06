/**
 * Admin page templates module
 * Provides HTML templates for admin pages
 */

import { adminLayout } from './admin-layout.js';

/**
 * Generate login page HTML
 * @returns {string} Login page HTML
 */
export function loginPage() {
  const styles = `
    body { display: flex; align-items: center; justify-content: center; height: 100vh; }
    .login { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); width: 100%; max-width: 400px; }
    h2 { margin-top: 0; color: #333; }
    input, button { width: 100%; padding: 0.75rem; margin: 0.5rem 0; font-size: 16px; }
    input { border: 1px solid #ddd; border-radius: 4px; }
    button { background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; }
    button:hover { background: #0056b3; }
    .error { color: #dc3545; font-size: 14px; margin-top: 0.5rem; display: none; }
  `;

  const content = `
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
  `;

  return adminLayout({ 
    title: 'Admin Login', 
    content, 
    styles, 
    includeAdminJs: false 
  });
}

/**
 * Generate dashboard page HTML
 * @param {Array} instances - Array of instance objects
 * @returns {string} Dashboard page HTML
 */
export function dashboardPage(instances) {
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

  const styles = `
    .header { margin-bottom: 0; }
    .actions { margin-bottom: 2rem; }
    table { width: 100%; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    th, td { padding: 1rem; text-align: left; border-bottom: 1px solid #dee2e6; }
    th { background: #f8f9fa; font-weight: 600; }
    tr:last-child td { border-bottom: none; }
    .logout { float: right; }
  `;

  const content = `
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
  `;

  return adminLayout({ 
    title: 'Admin Dashboard', 
    content, 
    styles 
  });
}