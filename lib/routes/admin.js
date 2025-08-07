/**
 * Admin routes module
 * Handles all admin panel routes and functionality
 */

import { securityHeaders } from '../security.js';
import { 
  extractSessionId,
  createAdminSession,
  deleteAdminSession,
  createLogoutCookie,
  validatePassword
} from '../auth.js';
import { getAllInstances } from '../database.js';
import { loginPage, dashboardPage } from '../templates/admin-pages.js';
import { 
  requireAuth,
  parseJsonBody,
  createAdminResponseHeaders
} from '../middleware/admin-validation.js';
import {
  createErrorResponse,
  createSuccessResponse
} from '../services/admin-service.js';

/**
 * Serve admin.js file
 * This function now serves the admin.js from KV storage to avoid code duplication
 * @param {Object} env - Environment bindings
 * @returns {Response} JavaScript code for admin panel
 */
export async function handleAdminJs(env) {
  try {
    // Try to get admin.js from KV storage
    const adminJs = await env.AGENT_CONFIG.get('admin:js', { type: 'text' });
    
    if (adminJs) {
      return new Response(adminJs, {
        headers: {
          'Content-Type': 'application/javascript',
          'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
        }
      });
    }
  } catch (error) {
    console.error('[Admin] Failed to load admin.js from KV:', error);
  }
  
  // Fallback: Return a message indicating the admin.js needs to be deployed
  return new Response(`
    console.error('Admin JavaScript not deployed to KV storage.');
    console.info('Deploy with: wrangler kv key put "admin:js" --binding=AGENT_CONFIG --path assets/admin.js --remote');
  `, {
    status: 503,
    headers: {
      'Content-Type': 'application/javascript'
    }
  });
}

/**
 * Admin login page
 * @returns {Response} Login page HTML
 */
export function handleAdminLoginPage() {
  const html = loginPage();
  
  return new Response(html, {
    headers: { 
      'Content-Type': 'text/html',
      ...securityHeaders
    }
  });
}

/**
 * Admin login endpoint
 * @param {Request} request - HTTP request
 * @param {Object} env - Environment bindings
 * @returns {Response} Login result
 */
export async function handleAdminLogin(request, env) {
  // Parse request body
  const { success, data, error } = await parseJsonBody(request);
  
  if (!success) {
    return createErrorResponse(error, 400, createAdminResponseHeaders());
  }
  
  const { password } = data;
  
  // Validate admin configuration
  if (!env.ADMIN_PASSWORD) {
    return createErrorResponse('Admin not configured', 500, createAdminResponseHeaders());
  }
  
  // Validate password
  if (!validatePassword(password, env.ADMIN_PASSWORD)) {
    return createErrorResponse('Invalid password', 401, createAdminResponseHeaders());
  }
  
  try {
    // Create admin session
    const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
    const { sessionId, cookieOptions } = await createAdminSession(env, clientIp);
    
    return createSuccessResponse(
      { sessionId },
      200,
      {
        ...createAdminResponseHeaders(),
        'Set-Cookie': cookieOptions
      }
    );
  } catch (error) {
    console.error('[Admin] Login error:', error);
    return createErrorResponse('Login failed', 500, createAdminResponseHeaders());
  }
}

/**
 * Admin logout endpoint
 * @param {Request} request - HTTP request
 * @param {Object} env - Environment bindings
 * @returns {Response} Logout result
 */
export async function handleAdminLogout(request, env) {
  try {
    // Extract session ID from request
    const sessionId = extractSessionId(request);
    
    // Delete session from KV if found
    if (sessionId) {
      await deleteAdminSession(env, sessionId);
    }
    
    // Clear cookie and return success
    return createSuccessResponse(
      {},
      200,
      {
        ...createAdminResponseHeaders(),
        'Set-Cookie': createLogoutCookie()
      }
    );
  } catch (error) {
    console.error('[Admin] Logout error:', error);
    return createErrorResponse('Logout failed', 500, createAdminResponseHeaders());
  }
}

/**
 * Admin dashboard
 * @param {Request} request - HTTP request
 * @param {Object} env - Environment bindings
 * @returns {Response} Dashboard HTML
 */
export async function handleAdminDashboard(request, env) {
  // Check authentication
  const authResponse = await requireAuth(request, env);
  if (authResponse) {
    return authResponse;
  }
  
  try {
    // Get all instances from database
    const instances = await getAllInstances(env.DB);
    
    // Generate dashboard HTML
    const html = dashboardPage(instances);
    
    return new Response(html, {
      headers: { 
        'Content-Type': 'text/html',
        ...securityHeaders
      }
    });
  } catch (error) {
    console.error('[Admin] Dashboard error:', error);
    
    // Return error page
    return new Response('<h1>Error loading dashboard</h1>', {
      status: 500,
      headers: {
        'Content-Type': 'text/html',
        ...securityHeaders
      }
    });
  }
}