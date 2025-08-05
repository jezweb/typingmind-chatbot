export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }
    
    // Only handle POST to /chat
    if (!request.url.endsWith('/chat') || request.method !== 'POST') {
      return new Response('Not Found', { status: 404 });
    }
    
    try {
      // Get request body
      const body = await request.json();
      const { agentId, messages } = body;
      
      if (!agentId || !messages) {
        return new Response(JSON.stringify({ error: 'Missing fields' }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
      
      // Get agent config from KV
      const agentConfig = await env.AGENT_CONFIG.get(`agent:${agentId}`, 'json');
      if (!agentConfig) {
        return new Response(JSON.stringify({ error: 'Agent not found' }), {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
      
      // Simple domain check
      const origin = request.headers.get('Origin');
      const referer = request.headers.get('Referer');
      if (origin || referer) {
        const url = origin || referer;
        const hostname = new URL(url).hostname;
        
        const allowed = agentConfig.allowedDomains.some(domain => {
          if (domain.startsWith('*.')) {
            const base = domain.substring(2);
            return hostname === base || hostname.endsWith('.' + base);
          }
          return hostname === domain;
        });
        
        if (!allowed) {
          return new Response(JSON.stringify({ error: 'Domain not authorized' }), {
            status: 403,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          });
        }
      }
      
      // Use agent's API key or default
      const apiKey = agentConfig.apiKey || env.DEFAULT_API_KEY || 'tm-sk-cfac2ddb-f1a8-4c5f-a5c8-695aa758b96a';
      
      // Call TypingMind API
      const apiResponse = await fetch(`https://api.typingmind.com/api/v2/agents/${agentId}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': apiKey
        },
        body: JSON.stringify({ messages })
      });
      
      // Get response as text first
      const responseText = await apiResponse.text();
      
      // Return the response
      return new Response(responseText, {
        status: apiResponse.status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
      
    } catch (error) {
      return new Response(JSON.stringify({ 
        error: 'Proxy error',
        message: error.message 
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }
};