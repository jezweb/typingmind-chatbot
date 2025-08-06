/**
 * Security module for TypingMind Chatbot Platform
 * Handles CORS, security headers, domain validation, and instance ID validation
 */

// CORS headers configuration
export const corsHeaders = {
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Origin',
  'Access-Control-Max-Age': '86400',
  'Access-Control-Allow-Credentials': 'true'
};

// Security headers configuration
export const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'",
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
};

/**
 * Validate instance ID format
 * Only allow lowercase letters, numbers, and hyphens
 * @param {string} instanceId - The instance ID to validate
 * @returns {boolean} - True if valid, false otherwise
 */
export function validateInstanceId(instanceId) {
  return /^[a-z0-9-]+$/.test(instanceId);
}

/**
 * Enhanced domain validation with better debugging
 * @param {Request} request - The incoming request
 * @param {Object} instanceConfig - The instance configuration containing allowed domains
 * @returns {Promise<boolean>} - True if domain is allowed, false otherwise
 */
export async function validateDomain(request, instanceConfig) {
  const origin = request.headers.get('Origin');
  const referer = request.headers.get('Referer');
  const requestHost = request.headers.get('Host');
  
  // Debug logging
  console.log('[validateDomain] Headers:', {
    origin,
    referer,
    host: requestHost,
    method: request.method,
    url: request.url
  });
  
  // For same-origin requests (like test pages), check if the request is from the worker's own domain
  if (!origin && !referer) {
    // If no origin/referer but we have a host header, check if it's the same domain
    if (requestHost) {
      const workerUrl = new URL(request.url);
      console.log('[validateDomain] Same-origin check:', {
        requestHost,
        workerHost: workerUrl.hostname
      });
      
      // Allow requests from the same domain (like our test pages)
      if (requestHost === workerUrl.hostname || 
          requestHost.startsWith(workerUrl.hostname)) {
        console.log('[validateDomain] Same-origin request allowed');
        return true;
      }
    }
    
    console.log('[validateDomain] No origin/referer headers, rejecting');
    return false;
  }
  
  try {
    const requestUrl = origin || referer;
    const { hostname } = new URL(requestUrl);
    
    console.log('[validateDomain] Checking hostname:', hostname);
    console.log('[validateDomain] Allowed domains:', instanceConfig.allowedDomains);
    
    const isAllowed = instanceConfig.allowedDomains.some(allowedDomain => {
      // Allow wildcard * for all domains
      if (allowedDomain === '*') {
        console.log('[validateDomain] Wildcard * matched');
        return true;
      }
      
      if (allowedDomain.startsWith('*.')) {
        const baseDomain = allowedDomain.substring(2);
        const matches = hostname === baseDomain || hostname.endsWith(`.${baseDomain}`);
        if (matches) {
          console.log(`[validateDomain] Wildcard domain ${allowedDomain} matched`);
        }
        return matches;
      }
      
      const exactMatch = hostname === allowedDomain;
      if (exactMatch) {
        console.log(`[validateDomain] Exact domain ${allowedDomain} matched`);
      }
      return exactMatch;
    });
    
    console.log('[validateDomain] Final result:', isAllowed);
    return isAllowed;
  } catch (error) {
    console.error('[validateDomain] Error:', error);
    return false;
  }
}

/**
 * Create response headers with CORS and security headers
 * @param {string} origin - The request origin
 * @returns {Object} - Combined headers object
 */
export function createResponseHeaders(origin = '*') {
  return {
    'Content-Type': 'application/json',
    ...corsHeaders,
    'Access-Control-Allow-Origin': origin,
    ...securityHeaders
  };
}

/**
 * Handle CORS preflight requests
 * @param {Request} request - The incoming request
 * @returns {Response} - CORS preflight response
 */
export function handleCORSPreflight(request) {
  const origin = request.headers.get('Origin') || '*';
  return new Response(null, {
    status: 204,
    headers: {
      ...corsHeaders,
      'Access-Control-Allow-Origin': origin,
      ...securityHeaders
    }
  });
}