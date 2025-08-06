// Admin Panel JavaScript Functions
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
  
  const response = await apiCall(`/admin/instances/${id}`, {
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
  
  const response = await apiCall(`/admin/instances/${id}/clone`, {
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
  const code = `<!-- TypingMind Chatbot Widget -->
<script>
  (function() {
    var script = document.createElement('script');
    script.src = '${window.location.origin}/widget.js';
    script.async = true;
    script.onload = function() {
      TypingMindChat.init({
        instanceId: '${instanceId}'
      });
    };
    document.head.appendChild(script);
  })();
</script>`;
  
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
  data.domains = data.domains ? data.domains.split('\n').filter(d => d.trim()) : [];
  data.paths = data.paths ? data.paths.split('\n').filter(p => p.trim()) : [];
  
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
  data.domains = data.domains ? data.domains.split('\n').filter(d => d.trim()) : [];
  
  // Convert numbers
  data.width = parseInt(data.width);
  data.messages_per_hour = parseInt(data.messages_per_hour);
  data.messages_per_session = parseInt(data.messages_per_session);
  
  const response = await fetch(`/admin/instances/${instanceId}`, {
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
});