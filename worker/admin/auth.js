import crypto from 'crypto';

/**
 * Handle admin authentication
 */
export async function handleAdminAuth(request, env) {
  try {
    const { password } = await request.json();
    
    if (!password) {
      return new Response(JSON.stringify({ error: 'Password required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // In production, use proper bcrypt comparison
    // For development, simple hash comparison
    const passwordHash = await hashPassword(password);
    const storedHash = env.ADMIN_PASSWORD_HASH;
    
    if (passwordHash !== storedHash && password !== 'admin123') { // Remove admin123 in production
      return new Response(JSON.stringify({ error: 'Invalid password' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Create session
    const sessionId = generateSessionId();
    const sessionData = {
      createdAt: Date.now(),
      lastAccess: Date.now()
    };
    
    await env.ADMIN_SESSIONS.put(`session:${sessionId}`, JSON.stringify(sessionData), {
      expirationTtl: 86400 // 24 hours
    });
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': `admin_session=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`
      }
    });
  } catch (error) {
    console.error('Auth error:', error);
    return new Response(JSON.stringify({ error: 'Authentication failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Middleware to require authentication
 */
export async function requireAuth(request, env) {
  const cookie = request.headers.get('Cookie');
  const sessionId = extractSessionId(cookie);
  
  if (!sessionId) {
    return new Response('Unauthorized', { 
      status: 401,
      headers: {
        'Location': '/admin',
        'Content-Type': 'text/plain'
      }
    });
  }
  
  const sessionData = await env.ADMIN_SESSIONS.get(`session:${sessionId}`, 'json');
  
  if (!sessionData) {
    return new Response('Session expired', { 
      status: 401,
      headers: {
        'Location': '/admin',
        'Set-Cookie': 'admin_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'
      }
    });
  }
  
  // Update last access time
  sessionData.lastAccess = Date.now();
  await env.ADMIN_SESSIONS.put(`session:${sessionId}`, JSON.stringify(sessionData), {
    expirationTtl: 86400
  });
  
  // Continue to next handler
  return null;
}

/**
 * Simple password hashing (use bcrypt in production)
 */
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate session ID
 */
function generateSessionId() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Extract session ID from cookie
 */
function extractSessionId(cookieHeader) {
  if (!cookieHeader) return null;
  
  const cookies = cookieHeader.split(';').map(c => c.trim());
  const sessionCookie = cookies.find(c => c.startsWith('admin_session='));
  
  if (!sessionCookie) return null;
  
  return sessionCookie.split('=')[1];
}