/**
 * Admin Validation Middleware
 * Provides reusable validation and authentication middleware for admin routes
 */

import { 
  validateAdminSession,
  createUnauthorizedRedirect,
  createUnauthorizedResponse 
} from '../auth.js';
import { createResponseHeaders } from '../security.js';

/**
 * Middleware to ensure admin is authenticated
 * Returns early with redirect if not authenticated
 * @param {Request} request - HTTP request
 * @param {Object} env - Environment bindings
 * @returns {Promise<Response|null>} Response if unauthorized, null if authorized
 */
export async function requireAuth(request, env) {
  const isValid = await validateAdminSession(request, env);
  
  if (!isValid) {
    // Check if this is an API request (JSON expected) or page request
    const acceptHeader = request.headers.get('Accept') || '';
    const isApiRequest = acceptHeader.includes('application/json') || 
                        request.headers.get('Content-Type')?.includes('application/json');
    
    if (isApiRequest) {
      return createUnauthorizedResponse();
    } else {
      return createUnauthorizedRedirect();
    }
  }
  
  return null; // Authorized, continue processing
}

/**
 * Validate request body contains required fields
 * @param {Object} body - Request body
 * @param {string[]} requiredFields - List of required field names
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export function validateRequiredFields(body, requiredFields) {
  const errors = [];
  
  for (const field of requiredFields) {
    if (!body[field] || (typeof body[field] === 'string' && body[field].trim() === '')) {
      errors.push(`${field} is required`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Parse and validate JSON request body
 * @param {Request} request - HTTP request
 * @returns {Promise<Object>} { success: boolean, data?: Object, error?: string }
 */
export async function parseJsonBody(request) {
  try {
    const contentType = request.headers.get('Content-Type') || '';
    
    if (!contentType.includes('application/json')) {
      return {
        success: false,
        error: 'Content-Type must be application/json'
      };
    }
    
    const body = await request.json();
    
    return {
      success: true,
      data: body
    };
  } catch (error) {
    console.error('[Admin] Failed to parse JSON body:', error);
    return {
      success: false,
      error: 'Invalid JSON in request body'
    };
  }
}

/**
 * Create standard admin API response headers
 * @param {Object} additionalHeaders - Additional headers to include
 * @returns {Object} Headers object
 */
export function createAdminResponseHeaders(additionalHeaders = {}) {
  return {
    'Content-Type': 'application/json',
    ...createResponseHeaders(),
    ...additionalHeaders
  };
}

/**
 * Wrap an async route handler with error handling
 * @param {Function} handler - Async route handler function
 * @returns {Function} Wrapped handler with error handling
 */
export function withErrorHandling(handler) {
  return async (request, env, ctx) => {
    try {
      return await handler(request, env, ctx);
    } catch (error) {
      console.error('[Admin] Route handler error:', error);
      
      return new Response(JSON.stringify({
        error: 'Internal server error',
        message: error.message
      }), {
        status: 500,
        headers: createAdminResponseHeaders()
      });
    }
  };
}

/**
 * Validate instance ID format
 * @param {string} instanceId - Instance ID to validate
 * @returns {Object} { valid: boolean, error?: string }
 */
export function validateInstanceIdFormat(instanceId) {
  if (!instanceId || instanceId.trim() === '') {
    return { valid: false, error: 'Instance ID is required' };
  }
  
  if (!/^[a-z0-9-]+$/.test(instanceId)) {
    return { 
      valid: false, 
      error: 'Instance ID must contain only lowercase letters, numbers, and hyphens' 
    };
  }
  
  if (instanceId.length > 50) {
    return { valid: false, error: 'Instance ID must be 50 characters or less' };
  }
  
  return { valid: true };
}