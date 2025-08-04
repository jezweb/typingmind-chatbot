import { Router } from 'itty-router';

const router = Router();

// CORS headers for widget
const corsHeaders = {
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

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

// Admin routes
router.post('/admin/login', handleAdminAuth);
router.get('/admin', renderAdminUI);
router.get('/admin/*', requireAuth, renderAdminUI);

// Admin API routes
router.get('/api/admin/agents', requireAuth, handleListAgents);
router.get('/api/admin/agents/:id', requireAuth, handleGetAgent);
router.post('/api/admin/agents', requireAuth, handleCreateAgent);
router.put('/api/admin/agents/:id', requireAuth, handleUpdateAgent);
router.delete('/api/admin/agents/:id', requireAuth, handleDeleteAgent);

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