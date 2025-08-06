/**
 * Rate limiting module for KV-based rate limits
 * Handles per-instance and per-session rate limiting
 */

/**
 * Check and update rate limits
 * @param {KVNamespace} rateLimitsKV - Cloudflare KV namespace for rate limits
 * @param {Object} options - Rate limiting options
 * @param {string} options.hourlyKey - Key for hourly rate limit
 * @param {string} options.sessionKey - Key for session rate limit
 * @param {number} options.hourlyLimit - Maximum messages per hour
 * @param {number} options.sessionLimit - Maximum messages per session
 * @param {string|null} options.sessionId - Session ID (optional)
 * @returns {Promise<Object>} Rate limit result with allowed status and message
 */
export async function checkAndUpdateRateLimit(rateLimitsKV, options) {
  const { hourlyKey, sessionKey, hourlyLimit, sessionLimit, sessionId } = options;
  
  // Get current counts
  const [hourlyCount, sessionCount] = await Promise.all([
    rateLimitsKV.get(hourlyKey),
    sessionId ? rateLimitsKV.get(sessionKey) : null
  ]);
  
  const currentHourlyCount = parseInt(hourlyCount || '0');
  const currentSessionCount = parseInt(sessionCount || '0');
  
  // Check hourly limit
  if (currentHourlyCount >= hourlyLimit) {
    const hourlyTTL = await rateLimitsKV.getWithMetadata(hourlyKey);
    const retryAfter = hourlyTTL.metadata?.ttl || 3600;
    return {
      allowed: false,
      message: `Hourly rate limit exceeded. Maximum ${hourlyLimit} messages per hour.`,
      retryAfter
    };
  }
  
  // Check session limit if applicable
  if (sessionId && currentSessionCount >= sessionLimit) {
    return {
      allowed: false,
      message: `Session rate limit exceeded. Maximum ${sessionLimit} messages per session.`,
      retryAfter: 300 // 5 minutes
    };
  }
  
  // Update counts with TTL
  const promises = [
    rateLimitsKV.put(hourlyKey, String(currentHourlyCount + 1), {
      expirationTtl: 3600 // 1 hour
    })
  ];
  
  if (sessionId) {
    promises.push(
      rateLimitsKV.put(sessionKey, String(currentSessionCount + 1), {
        expirationTtl: 86400 // 24 hours
      })
    );
  }
  
  await Promise.all(promises);
  
  return {
    allowed: true,
    message: 'Request allowed',
    remainingHourly: hourlyLimit - currentHourlyCount - 1,
    remainingSession: sessionId ? sessionLimit - currentSessionCount - 1 : null
  };
}

/**
 * Generate rate limit keys for a given instance and client
 * @param {string} instanceId - Instance ID
 * @param {string} clientId - Client identifier (IP or sessionId)
 * @param {string|null} sessionId - Session ID (optional)
 * @returns {Object} Rate limit keys
 */
export function generateRateLimitKeys(instanceId, clientId, sessionId = null) {
  return {
    hourlyKey: `rate:hour:${instanceId}:${clientId}`,
    sessionKey: sessionId ? `rate:session:${instanceId}:${sessionId}` : null
  };
}

/**
 * Extract client ID from request
 * @param {Request} request - HTTP request
 * @param {string|null} sessionId - Session ID (optional)
 * @returns {string} Client identifier
 */
export function extractClientId(request, sessionId = null) {
  return sessionId || request.headers.get('CF-Connecting-IP') || 'anonymous';
}

/**
 * Create rate limit error response
 * @param {Object} rateLimitResult - Result from checkAndUpdateRateLimit
 * @param {Object} responseHeaders - Base response headers
 * @returns {Response} HTTP 429 response
 */
export function createRateLimitErrorResponse(rateLimitResult, responseHeaders) {
  return new Response(JSON.stringify({ 
    error: 'Rate limit exceeded',
    message: rateLimitResult.message,
    retryAfter: rateLimitResult.retryAfter
  }), {
    status: 429,
    headers: {
      ...responseHeaders,
      'Retry-After': String(rateLimitResult.retryAfter || 3600)
    }
  });
}

/**
 * Clear rate limits for a specific client (useful for testing)
 * @param {KVNamespace} rateLimitsKV - Cloudflare KV namespace
 * @param {string} instanceId - Instance ID
 * @param {string} clientId - Client identifier
 * @param {string|null} sessionId - Session ID (optional)
 * @returns {Promise<void>}
 */
export async function clearRateLimits(rateLimitsKV, instanceId, clientId, sessionId = null) {
  const { hourlyKey, sessionKey } = generateRateLimitKeys(instanceId, clientId, sessionId);
  
  const promises = [rateLimitsKV.delete(hourlyKey)];
  if (sessionKey) {
    promises.push(rateLimitsKV.delete(sessionKey));
  }
  
  await Promise.all(promises);
}

/**
 * Get current rate limit status without incrementing
 * @param {KVNamespace} rateLimitsKV - Cloudflare KV namespace
 * @param {string} instanceId - Instance ID
 * @param {string} clientId - Client identifier
 * @param {string|null} sessionId - Session ID (optional)
 * @param {Object} limits - Rate limits configuration
 * @returns {Promise<Object>} Current rate limit status
 */
export async function getRateLimitStatus(rateLimitsKV, instanceId, clientId, sessionId, limits) {
  const { hourlyKey, sessionKey } = generateRateLimitKeys(instanceId, clientId, sessionId);
  
  const [hourlyCount, sessionCount] = await Promise.all([
    rateLimitsKV.get(hourlyKey),
    sessionId ? rateLimitsKV.get(sessionKey) : null
  ]);
  
  const currentHourlyCount = parseInt(hourlyCount || '0');
  const currentSessionCount = parseInt(sessionCount || '0');
  
  return {
    hourly: {
      current: currentHourlyCount,
      limit: limits.hourlyLimit,
      remaining: Math.max(0, limits.hourlyLimit - currentHourlyCount),
      exceeded: currentHourlyCount >= limits.hourlyLimit
    },
    session: sessionId ? {
      current: currentSessionCount,
      limit: limits.sessionLimit,
      remaining: Math.max(0, limits.sessionLimit - currentSessionCount),
      exceeded: currentSessionCount >= limits.sessionLimit
    } : null
  };
}