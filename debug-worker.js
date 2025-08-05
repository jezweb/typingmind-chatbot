// Debug version of worker to find the issue
export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }

    if (request.url.endsWith('/chat') && request.method === 'POST') {
      try {
        const body = await request.json();
        const { agentId, messages } = body;
        
        // Get agent config
        const agentConfig = await env.AGENT_CONFIG.get(`agent:${agentId}`, 'json');
        
        // Call TypingMind API directly
        const apiKey = env.DEFAULT_API_KEY;
        const apiHost = env.TYPINGMIND_API_HOST || 'https://api.typingmind.com';
        
        console.log('Debug: Making API call to:', `${apiHost}/api/v2/agents/${agentId}/chat`);
        
        const apiResponse = await fetch(`${apiHost}/api/v2/agents/${agentId}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-KEY': apiKey
          },
          body: JSON.stringify({ messages })
        });
        
        const responseText = await apiResponse.text();
        console.log('API Response Status:', apiResponse.status);
        console.log('API Response:', responseText.substring(0, 200));
        
        return new Response(responseText, {
          status: apiResponse.status,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
        
      } catch (error) {
        console.error('Debug error:', error);
        return new Response(JSON.stringify({ 
          error: error.message,
          stack: error.stack 
        }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
    }
    
    return new Response('Not found', { status: 404 });
  }
};