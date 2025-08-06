/**
 * Authentication module for admin panel
 * Handles admin login, logout, and session management
 */

/**
 * Parse cookies from cookie header string
 * @param {string} cookieHeader - Raw cookie header string
 * @returns {Object} Parsed cookies as key-value pairs
 */
export function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  
  cookieHeader.split(';').forEach(cookie => {
    const [key, value] = cookie.trim().split('=');
    if (key && value) {
      cookies[key] = decodeURIComponent(value);
    }
  });
  
  return cookies;
}

/**
 * Validate admin session
 * @param {Request} request - HTTP request object
 * @param {Object} env - Environment bindings
 * @returns {Promise<boolean>} True if session is valid
 */
export async function validateAdminSession(request, env) {
  // Check for session in Authorization header, X-Admin-Session header, or cookie
  const authHeader = request.headers.get('Authorization');
  let sessionId = authHeader?.replace('Bearer ', '') || 
                 request.headers.get('X-Admin-Session');
  
  // If no session in headers, check cookies
  if (!sessionId) {
    const cookieHeader = request.headers.get('Cookie');
    const cookies = parseCookies(cookieHeader);
    sessionId = cookies['admin_session'];
  }
  
  if (!sessionId) {
    return false;
  }
  
  const sessionKey = `admin:session:${sessionId}`;
  const session = await env.ADMIN_SESSIONS.get(sessionKey);
  
  return session !== null;
}

/**
 * Extract session ID from request
 * @param {Request} request - HTTP request object
 * @returns {string|null} Session ID or null if not found
 */
export function extractSessionId(request) {
  // Check Authorization header
  const authHeader = request.headers.get('Authorization');
  let sessionId = authHeader?.replace('Bearer ', '') || 
                 request.headers.get('X-Admin-Session');
  
  // If no session in headers, check cookies
  if (!sessionId) {
    const cookieHeader = request.headers.get('Cookie');
    const cookies = parseCookies(cookieHeader);
    sessionId = cookies['admin_session'];
  }
  
  return sessionId || null;
}

/**
 * Create session for admin user
 * @param {Object} env - Environment bindings
 * @param {string} ip - Client IP address
 * @returns {Promise<Object>} Session object with id and cookie options
 */
export async function createAdminSession(env, ip) {
  // Generate secure session ID
  const sessionId = crypto.randomUUID();
  const sessionKey = `admin:session:${sessionId}`;
  
  // Store session in KV with 24 hour expiration
  await env.ADMIN_SESSIONS.put(sessionKey, JSON.stringify({
    createdAt: new Date().toISOString(),
    ip: ip || 'unknown'
  }), {
    expirationTtl: 86400 // 24 hours
  });
  
  // Create cookie options with secure flags
  const cookieOptions = [
    `admin_session=${sessionId}`,
    'HttpOnly',
    'Secure',
    'SameSite=Strict',
    'Path=/',
    `Max-Age=${86400}` // 24 hours
  ].join('; ');
  
  return {
    sessionId,
    cookieOptions
  };
}

/**
 * Delete admin session
 * @param {Object} env - Environment bindings
 * @param {string} sessionId - Session ID to delete
 * @returns {Promise<void>}
 */
export async function deleteAdminSession(env, sessionId) {
  if (!sessionId) return;
  
  const sessionKey = `admin:session:${sessionId}`;
  await env.ADMIN_SESSIONS.delete(sessionKey);
}

/**
 * Create logout cookie to clear session
 * @returns {string} Cookie string to clear session
 */
export function createLogoutCookie() {
  return [
    'admin_session=',
    'HttpOnly',
    'Secure',
    'SameSite=Strict',
    'Path=/',
    'Max-Age=0' // Expire immediately
  ].join('; ');
}

/**
 * Validate admin password
 * @param {string} password - Password to validate
 * @param {string} adminPassword - Correct admin password from environment
 * @returns {boolean} True if password is valid
 */
export function validatePassword(password, adminPassword) {
  if (!adminPassword) {
    console.error('[Admin] No admin password configured');
    return false;
  }
  
  return password === adminPassword;
}

/**
 * Create unauthorized redirect response
 * @returns {Response} Redirect response to login page
 */
export function createUnauthorizedRedirect() {
  return new Response(null, {
    status: 302,
    headers: {
      'Location': '/admin'
    }
  });
}

/**
 * Create unauthorized JSON response
 * @param {Object} headers - Response headers
 * @returns {Response} JSON error response
 */
export function createUnauthorizedResponse(headers = {}) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  });
}