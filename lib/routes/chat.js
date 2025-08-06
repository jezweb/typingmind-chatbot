/**
 * Chat routes module
 * Handles chat API endpoints and instance information
 */

import { 
  validateInstanceId, 
  validateDomain,
  createResponseHeaders
} from '../security.js';
import { getInstanceConfig } from '../database.js';
import {
  checkAndUpdateRateLimit,
  generateRateLimitKeys,
  extractClientId,
  createRateLimitErrorResponse
} from '../rate-limiter.js';

/**
 * Get instance information endpoint
 * @param {Request} request - HTTP request
 * @param {Object} env - Environment bindings
 * @returns {Response} Instance information or error
 */
export async function handleGetInstance(request, env) {
  const instanceId = request.params?.id;
  const responseHeaders = createResponseHeaders();
  
  if (!instanceId) {
    return new Response(JSON.stringify({ error: 'Instance ID is required' }), {
      status: 400,
      headers: responseHeaders
    });
  }
  
  // Validate instance ID format
  if (!validateInstanceId(instanceId)) {
    return new Response(JSON.stringify({ error: 'Invalid instance ID format' }), {
      status: 400,
      headers: responseHeaders
    });
  }
  
  try {
    const instance = await getInstanceConfig(env.DB, instanceId);
    if (!instance) {
      return new Response(JSON.stringify({ error: 'Instance not found' }), {
        status: 404,
        headers: responseHeaders
      });
    }
    
    // Return limited instance info for public use
    return new Response(JSON.stringify({
      id: instance.id,
      name: instance.name,
      theme: instance.theme,
      features: instance.features
    }), {
      status: 200,
      headers: responseHeaders
    });
  } catch (error) {
    console.error('[Instance] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: responseHeaders
    });
  }
}

/**
 * Handle chat endpoint
 * @param {Request} request - HTTP request
 * @param {Object} env - Environment bindings
 * @returns {Response} Chat response or error
 */
export async function handleChat(request, env) {
  const origin = request.headers.get('Origin') || '*';
  const responseHeaders = createResponseHeaders(origin);
  
  try {
    // Check Content-Length header for request size limit (1MB)
    const contentLength = request.headers.get('Content-Length');
    if (contentLength && parseInt(contentLength) > 1048576) {
      return new Response(JSON.stringify({ 
        error: 'Request too large',
        message: 'Request body exceeds 1MB limit'
      }), {
        status: 413,
        headers: responseHeaders
      });
    }
    
    const body = await request.json();
    const { instanceId, messages, sessionId } = body;
    
    if (!instanceId || !messages) {
      return new Response(JSON.stringify({ error: 'Missing required fields: instanceId and messages' }), {
        status: 400,
        headers: responseHeaders
      });
    }
    
    // Validate messages array
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Messages must be a non-empty array' }), {
        status: 400,
        headers: responseHeaders
      });
    }
    
    // Limit number of messages
    if (messages.length > 100) {
      return new Response(JSON.stringify({ 
        error: 'Too many messages',
        message: 'Maximum 100 messages allowed per request'
      }), {
        status: 400,
        headers: responseHeaders
      });
    }
    
    // Validate instance ID format
    if (!validateInstanceId(instanceId)) {
      return new Response(JSON.stringify({ error: 'Invalid instance ID format' }), {
        status: 400,
        headers: responseHeaders
      });
    }
    
    // Get instance config from D1
    const instanceConfig = await getInstanceConfig(env.DB, instanceId);
    if (!instanceConfig) {
      return new Response(JSON.stringify({ error: 'Instance not found' }), {
        status: 404,
        headers: responseHeaders
      });
    }
    
    // Validate domain
    if (!await validateDomain(request, instanceConfig)) {
      console.error('[Chat] Domain validation failed:', {
        origin: request.headers.get('Origin'),
        referer: request.headers.get('Referer'),
        allowedDomains: instanceConfig.allowedDomains,
        instanceId
      });
      // Get request details for better error message
      const origin = request.headers.get('Origin');
      const referer = request.headers.get('Referer');
      const requestDomain = origin || referer || 'Unknown domain';
      
      return new Response(JSON.stringify({ 
        error: 'Domain not authorized',
        details: `Domain ${requestDomain} is not in the allowed list for instance '${instanceId}'. Allowed domains: ${instanceConfig.allowedDomains.join(', ')}`,
        debugInfo: {
          requestHeaders: {
            origin: origin || 'not provided',
            referer: referer || 'not provided',
            host: request.headers.get('Host') || 'not provided'
          },
          instanceId,
          allowedDomains: instanceConfig.allowedDomains
        }
      }), {
        status: 403,
        headers: responseHeaders
      });
    }
    
    console.log('[Chat] Processing request:', {
      instanceId,
      instanceName: instanceConfig.name,
      typingmindAgentId: instanceConfig.typingmindAgentId,
      origin: origin || 'no-origin',
      messageCount: messages.length
    });
    
    // Implement rate limiting
    const clientId = extractClientId(request, sessionId);
    const { hourlyKey, sessionKey } = generateRateLimitKeys(instanceId, clientId, sessionId);
    
    // Check rate limits
    const rateLimitResult = await checkAndUpdateRateLimit(env.RATE_LIMITS, {
      hourlyKey,
      sessionKey,
      hourlyLimit: instanceConfig.rateLimit.messagesPerHour,
      sessionLimit: instanceConfig.rateLimit.messagesPerSession,
      sessionId
    });
    
    if (!rateLimitResult.allowed) {
      return createRateLimitErrorResponse(rateLimitResult, responseHeaders);
    }
    
    // Call TypingMind API with the actual agent ID
    const apiKey = instanceConfig.apiKey || env.DEFAULT_API_KEY;
    const apiHost = env.TYPINGMIND_API_HOST || 'https://api.typingmind.com';
    
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    let apiResponse;
    try {
      apiResponse = await fetch(`${apiHost}/api/v2/agents/${instanceConfig.typingmindAgentId}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': apiKey
        },
        body: JSON.stringify({ messages }),
        signal: controller.signal
      });
    } catch (fetchError) {
      clearTimeout(timeout);
      if (fetchError.name === 'AbortError') {
        return new Response(JSON.stringify({ 
          error: 'Request timeout',
          message: 'The API request timed out after 30 seconds'
        }), {
          status: 504,
          headers: responseHeaders
        });
      }
      throw fetchError;
    } finally {
      clearTimeout(timeout);
    }
    
    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      console.error('[Chat] TypingMind API error:', {
        status: apiResponse.status,
        error: errorText,
        instanceId,
        typingmindAgentId: instanceConfig.typingmindAgentId,
        apiHost
      });
      return new Response(JSON.stringify({ 
        error: `API error: ${apiResponse.status}`,
        details: errorText
      }), {
        status: 500,
        headers: responseHeaders
      });
    }
    
    let data;
    try {
      data = await apiResponse.json();
    } catch (jsonError) {
      console.error('[Chat] Failed to parse API response:', jsonError);
      return new Response(JSON.stringify({ 
        error: 'Invalid API response',
        message: 'The API returned an invalid response format'
      }), {
        status: 502,
        headers: responseHeaders
      });
    }
    
    // Validate response structure
    if (!data || typeof data !== 'object') {
      console.error('[Chat] Invalid response structure:', data);
      return new Response(JSON.stringify({ 
        error: 'Invalid response format',
        message: 'The API returned an unexpected response format'
      }), {
        status: 502,
        headers: responseHeaders
      });
    }
    
    // Check if TypingMind returned an error
    if (data.error && data.error.code === 'agent_not_found') {
      console.error('[Chat] TypingMind agent not found:', {
        instanceId,
        typingmindAgentId: instanceConfig.typingmindAgentId,
        error: data.error
      });
      return new Response(JSON.stringify({
        error: 'Agent not configured in TypingMind',
        details: `The TypingMind agent ID (${instanceConfig.typingmindAgentId}) configured for this instance is not recognized by TypingMind. Please update the instance configuration with a valid agent ID.`,
        instanceId: instanceId,
        typingmindAgentId: instanceConfig.typingmindAgentId
      }), {
        status: 404,
        headers: responseHeaders
      });
    }
    
    // TODO: Log analytics
    // await logAnalytics(env, instanceId, sessionId, messages.length);
    
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: responseHeaders
    });
    
  } catch (error) {
    console.error('[Chat] Internal error:', {
      error: error.message,
      stack: error.stack
    });
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message
    }), {
      status: 500,
      headers: responseHeaders
    });
  }
}