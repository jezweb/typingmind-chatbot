import { checkRateLimit } from './validation.js';

/**
 * Handle chat requests to TypingMind API
 */
export async function handleChatRequest(request, env, agentConfig, messages, sessionId) {
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

/**
 * Track usage analytics
 */
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