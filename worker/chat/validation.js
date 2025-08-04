/**
 * Domain validation for chat requests
 */

export async function validateDomain(request, agentConfig) {
  const origin = request.headers.get('Origin');
  const referer = request.headers.get('Referer');
  
  if (!origin && !referer) {
    console.log('No origin or referer header');
    return false;
  }
  
  try {
    const requestUrl = origin || referer;
    const { hostname, pathname } = new URL(requestUrl);
    
    // Check allowed domains
    const isDomainAllowed = agentConfig.allowedDomains.some(allowedDomain => {
      // Handle wildcard subdomains
      if (allowedDomain.startsWith('*.')) {
        const baseDomain = allowedDomain.substring(2);
        return hostname === baseDomain || hostname.endsWith(`.${baseDomain}`);
      }
      // Exact match
      return hostname === allowedDomain;
    });
    
    if (!isDomainAllowed) {
      console.log(`Domain ${hostname} not in allowed list:`, agentConfig.allowedDomains);
      return false;
    }
    
    // Check path restrictions if configured
    if (agentConfig.allowedPaths && agentConfig.allowedPaths.length > 0) {
      const isPathAllowed = agentConfig.allowedPaths.some(allowedPath => {
        // Convert wildcard pattern to regex
        const pattern = allowedPath
          .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape special chars
          .replace(/\*/g, '.*'); // Convert * to .*
        
        const regex = new RegExp(`^${pattern}$`);
        return regex.test(pathname);
      });
      
      if (!isPathAllowed) {
        console.log(`Path ${pathname} not in allowed list:`, agentConfig.allowedPaths);
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.error('Domain validation error:', error);
    return false;
  }
}

/**
 * Rate limiting check
 */
export async function checkRateLimit(request, env, agentConfig, sessionId) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const now = Date.now();
  const hourAgo = now - 60 * 60 * 1000;
  const tenMinutesAgo = now - 10 * 60 * 1000;
  
  // Check IP-based rate limit
  const ipKey = `ratelimit:ip:${agentConfig.id}:${ip}`;
  const ipData = await env.RATE_LIMITS.get(ipKey, 'json') || { messages: [] };
  
  // Filter out old messages and count recent ones
  ipData.messages = ipData.messages.filter(timestamp => timestamp > hourAgo);
  
  if (ipData.messages.length >= (agentConfig.rateLimit?.messagesPerHour || 100)) {
    return { allowed: false, reason: 'IP rate limit exceeded' };
  }
  
  // Check session-based rate limit
  if (sessionId) {
    const sessionKey = `ratelimit:session:${agentConfig.id}:${sessionId}`;
    const sessionData = await env.RATE_LIMITS.get(sessionKey, 'json') || { messages: [] };
    
    sessionData.messages = sessionData.messages.filter(timestamp => timestamp > tenMinutesAgo);
    
    if (sessionData.messages.length >= (agentConfig.rateLimit?.messagesPerSession || 20)) {
      return { allowed: false, reason: 'Session rate limit exceeded' };
    }
    
    // Update session rate limit
    sessionData.messages.push(now);
    await env.RATE_LIMITS.put(sessionKey, JSON.stringify(sessionData), {
      expirationTtl: 600 // 10 minutes
    });
  }
  
  // Update IP rate limit
  ipData.messages.push(now);
  await env.RATE_LIMITS.put(ipKey, JSON.stringify(ipData), {
    expirationTtl: 3600 // 1 hour
  });
  
  return { allowed: true };
}