/**
 * Tests for the authentication module
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import {
  parseCookies,
  validateAdminSession,
  extractSessionId,
  createAdminSession,
  deleteAdminSession,
  createLogoutCookie,
  validatePassword,
  createUnauthorizedRedirect,
  createUnauthorizedResponse
} from './auth.js';

// Mock KV namespace
function createMockKV() {
  const store = new Map();
  return {
    get: async (key) => store.get(key) || null,
    put: async (key, value, options) => {
      store.set(key, value);
    },
    delete: async (key) => {
      store.delete(key);
    }
  };
}

// Mock request
function createMockRequest(headers = {}, cookies = {}) {
  const cookieHeader = Object.entries(cookies)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('; ');
  
  if (cookieHeader) {
    headers['Cookie'] = cookieHeader;
  }
  
  return {
    headers: {
      get: (name) => headers[name] || null
    }
  };
}

// Mock crypto.randomUUID
global.crypto = {
  randomUUID: () => 'test-uuid-12345'
};

describe('Auth Module', () => {
  let mockEnv;

  beforeEach(() => {
    mockEnv = {
      ADMIN_SESSIONS: createMockKV(),
      ADMIN_PASSWORD: 'test-password-123'
    };
  });

  describe('parseCookies', () => {
    test('should parse single cookie', () => {
      const result = parseCookies('session=abc123');
      expect(result).toEqual({ session: 'abc123' });
    });

    test('should parse multiple cookies', () => {
      const result = parseCookies('session=abc123; user=john; theme=dark');
      expect(result).toEqual({
        session: 'abc123',
        user: 'john',
        theme: 'dark'
      });
    });

    test('should handle URL-encoded values', () => {
      const result = parseCookies('data=%7B%22test%22%3A%22value%22%7D');
      expect(result).toEqual({ data: '{"test":"value"}' });
    });

    test('should handle empty cookie header', () => {
      expect(parseCookies('')).toEqual({});
      expect(parseCookies(null)).toEqual({});
      expect(parseCookies(undefined)).toEqual({});
    });

    test('should ignore malformed cookies', () => {
      const result = parseCookies('valid=yes; invalid; another=value');
      expect(result).toEqual({
        valid: 'yes',
        another: 'value'
      });
    });
  });

  describe('validateAdminSession', () => {
    test('should validate session from Authorization header', async () => {
      // Create session
      await mockEnv.ADMIN_SESSIONS.put('admin:session:test-123', JSON.stringify({
        createdAt: new Date().toISOString(),
        ip: '127.0.0.1'
      }));

      const request = createMockRequest({
        'Authorization': 'Bearer test-123'
      });

      const result = await validateAdminSession(request, mockEnv);
      expect(result).toBe(true);
    });

    test('should validate session from X-Admin-Session header', async () => {
      // Create session
      await mockEnv.ADMIN_SESSIONS.put('admin:session:test-456', JSON.stringify({
        createdAt: new Date().toISOString(),
        ip: '127.0.0.1'
      }));

      const request = createMockRequest({
        'X-Admin-Session': 'test-456'
      });

      const result = await validateAdminSession(request, mockEnv);
      expect(result).toBe(true);
    });

    test('should validate session from cookie', async () => {
      // Create session
      await mockEnv.ADMIN_SESSIONS.put('admin:session:test-789', JSON.stringify({
        createdAt: new Date().toISOString(),
        ip: '127.0.0.1'
      }));

      const request = createMockRequest({}, {
        'admin_session': 'test-789'
      });

      const result = await validateAdminSession(request, mockEnv);
      expect(result).toBe(true);
    });

    test('should return false for invalid session', async () => {
      const request = createMockRequest({
        'Authorization': 'Bearer invalid-session'
      });

      const result = await validateAdminSession(request, mockEnv);
      expect(result).toBe(false);
    });

    test('should return false when no session provided', async () => {
      const request = createMockRequest({});
      const result = await validateAdminSession(request, mockEnv);
      expect(result).toBe(false);
    });

    test('should prefer Authorization header over cookie', async () => {
      // Create only the header session
      await mockEnv.ADMIN_SESSIONS.put('admin:session:header-session', JSON.stringify({
        createdAt: new Date().toISOString(),
        ip: '127.0.0.1'
      }));

      const request = createMockRequest({
        'Authorization': 'Bearer header-session'
      }, {
        'admin_session': 'cookie-session'
      });

      const result = await validateAdminSession(request, mockEnv);
      expect(result).toBe(true);
    });
  });

  describe('extractSessionId', () => {
    test('should extract from Authorization header', () => {
      const request = createMockRequest({
        'Authorization': 'Bearer test-123'
      });
      
      expect(extractSessionId(request)).toBe('test-123');
    });

    test('should extract from X-Admin-Session header', () => {
      const request = createMockRequest({
        'X-Admin-Session': 'test-456'
      });
      
      expect(extractSessionId(request)).toBe('test-456');
    });

    test('should extract from cookie', () => {
      const request = createMockRequest({}, {
        'admin_session': 'test-789'
      });
      
      expect(extractSessionId(request)).toBe('test-789');
    });

    test('should return null when no session found', () => {
      const request = createMockRequest({});
      expect(extractSessionId(request)).toBeNull();
    });
  });

  describe('createAdminSession', () => {
    test('should create session with correct format', async () => {
      const result = await createAdminSession(mockEnv, '192.168.1.1');
      
      expect(result.sessionId).toBe('test-uuid-12345');
      expect(result.cookieOptions).toContain('admin_session=test-uuid-12345');
      expect(result.cookieOptions).toContain('HttpOnly');
      expect(result.cookieOptions).toContain('Secure');
      expect(result.cookieOptions).toContain('SameSite=Strict');
      expect(result.cookieOptions).toContain('Path=/');
      expect(result.cookieOptions).toContain('Max-Age=86400');
      
      // Verify session was stored
      const stored = await mockEnv.ADMIN_SESSIONS.get('admin:session:test-uuid-12345');
      expect(stored).toBeTruthy();
      
      const session = JSON.parse(stored);
      expect(session.ip).toBe('192.168.1.1');
      expect(session.createdAt).toBeTruthy();
    });

    test('should handle missing IP', async () => {
      const result = await createAdminSession(mockEnv, null);
      
      const stored = await mockEnv.ADMIN_SESSIONS.get('admin:session:test-uuid-12345');
      const session = JSON.parse(stored);
      expect(session.ip).toBe('unknown');
    });
  });

  describe('deleteAdminSession', () => {
    test('should delete existing session', async () => {
      // Create session
      await mockEnv.ADMIN_SESSIONS.put('admin:session:test-123', 'session-data');
      
      // Delete it
      await deleteAdminSession(mockEnv, 'test-123');
      
      // Verify it's gone
      const result = await mockEnv.ADMIN_SESSIONS.get('admin:session:test-123');
      expect(result).toBeNull();
    });

    test('should handle null sessionId gracefully', async () => {
      await expect(deleteAdminSession(mockEnv, null)).resolves.not.toThrow();
      await expect(deleteAdminSession(mockEnv, undefined)).resolves.not.toThrow();
    });
  });

  describe('createLogoutCookie', () => {
    test('should create proper logout cookie', () => {
      const cookie = createLogoutCookie();
      
      expect(cookie).toContain('admin_session=');
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('Secure');
      expect(cookie).toContain('SameSite=Strict');
      expect(cookie).toContain('Path=/');
      expect(cookie).toContain('Max-Age=0');
    });
  });

  describe('validatePassword', () => {
    test('should validate correct password', () => {
      expect(validatePassword('test-password-123', 'test-password-123')).toBe(true);
    });

    test('should reject incorrect password', () => {
      expect(validatePassword('wrong-password', 'test-password-123')).toBe(false);
    });

    test('should reject when no admin password configured', () => {
      // Mock console.error
      const originalError = console.error;
      let errorMessage = '';
      console.error = (msg) => { errorMessage = msg; };
      
      expect(validatePassword('any-password', null)).toBe(false);
      expect(errorMessage).toBe('[Admin] No admin password configured');
      
      // Restore console.error
      console.error = originalError;
    });
  });

  describe('createUnauthorizedRedirect', () => {
    test('should create redirect response', () => {
      const response = createUnauthorizedRedirect();
      
      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('/admin');
    });
  });

  describe('createUnauthorizedResponse', () => {
    test('should create JSON error response', async () => {
      const response = createUnauthorizedResponse();
      
      expect(response.status).toBe(401);
      expect(response.headers.get('Content-Type')).toBe('application/json');
      
      const body = await response.json();
      expect(body).toEqual({ error: 'Unauthorized' });
    });

    test('should include additional headers', async () => {
      const response = createUnauthorizedResponse({
        'X-Custom': 'value'
      });
      
      expect(response.headers.get('X-Custom')).toBe('value');
      expect(response.headers.get('Content-Type')).toBe('application/json');
    });
  });
});