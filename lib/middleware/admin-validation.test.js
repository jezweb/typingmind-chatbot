/**
 * Tests for admin validation middleware
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';

// Mock functions
const mockValidateAdminSession = jest.fn();
const mockCreateUnauthorizedRedirect = jest.fn(() => new Response(null, { 
  status: 302, 
  headers: { Location: '/admin' } 
}));
const mockCreateUnauthorizedResponse = jest.fn(() => new Response(
  JSON.stringify({ error: 'Unauthorized' }), 
  { status: 401, headers: { 'Content-Type': 'application/json' } }
));
const mockCreateResponseHeaders = jest.fn(() => ({ 
  'X-Content-Type-Options': 'nosniff' 
}));

// Mock modules
jest.unstable_mockModule('../auth.js', () => ({
  validateAdminSession: mockValidateAdminSession,
  createUnauthorizedRedirect: mockCreateUnauthorizedRedirect,
  createUnauthorizedResponse: mockCreateUnauthorizedResponse
}));

jest.unstable_mockModule('../security.js', () => ({
  createResponseHeaders: mockCreateResponseHeaders
}));

// Import after mocking
const {
  requireAuth,
  validateRequiredFields,
  parseJsonBody,
  createAdminResponseHeaders,
  withErrorHandling,
  validateInstanceIdFormat
} = await import('./admin-validation.js');

describe('Admin Validation Middleware', () => {
  let mockRequest;
  let mockEnv;

  beforeEach(() => {
    mockRequest = {
      headers: {
        get: jest.fn()
      },
      json: jest.fn()
    };
    
    mockEnv = {
      ADMIN_SESSIONS: {}
    };

    jest.clearAllMocks();
  });

  describe('requireAuth', () => {
    test('should return null for valid session', async () => {
      mockValidateAdminSession.mockResolvedValue(true);
      
      const result = await requireAuth(mockRequest, mockEnv);
      
      expect(result).toBeNull();
      expect(mockValidateAdminSession).toHaveBeenCalledWith(mockRequest, mockEnv);
    });

    test('should return redirect response for HTML requests', async () => {
      mockValidateAdminSession.mockResolvedValue(false);
      mockRequest.headers.get.mockImplementation((name) => {
        if (name === 'Accept') return 'text/html';
        return null;
      });
      
      const result = await requireAuth(mockRequest, mockEnv);
      
      expect(result).toBeDefined();
      expect(result.status).toBe(302);
      expect(result.headers.get('Location')).toBe('/admin');
    });

    test('should return JSON response for API requests', async () => {
      mockValidateAdminSession.mockResolvedValue(false);
      mockRequest.headers.get.mockImplementation((name) => {
        if (name === 'Accept') return 'application/json';
        return null;
      });
      
      const result = await requireAuth(mockRequest, mockEnv);
      
      expect(result).toBeDefined();
      expect(result.status).toBe(401);
      const data = await result.json();
      expect(data.error).toBe('Unauthorized');
    });

    test('should detect API request by Content-Type', async () => {
      mockValidateAdminSession.mockResolvedValue(false);
      mockRequest.headers.get.mockImplementation((name) => {
        if (name === 'Content-Type') return 'application/json';
        return null;
      });
      
      const result = await requireAuth(mockRequest, mockEnv);
      
      expect(result.status).toBe(401);
    });
  });

  describe('validateRequiredFields', () => {
    test('should validate all required fields are present', () => {
      const body = {
        id: 'test',
        name: 'Test Instance',
        api_key: 'secret'
      };
      
      const result = validateRequiredFields(body, ['id', 'name']);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect missing fields', () => {
      const body = {
        id: 'test'
      };
      
      const result = validateRequiredFields(body, ['id', 'name', 'api_key']);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('name is required');
      expect(result.errors).toContain('api_key is required');
    });

    test('should detect empty string fields', () => {
      const body = {
        id: 'test',
        name: '  ',
        api_key: ''
      };
      
      const result = validateRequiredFields(body, ['id', 'name', 'api_key']);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('name is required');
      expect(result.errors).toContain('api_key is required');
    });
  });

  describe('parseJsonBody', () => {
    test('should parse valid JSON body', async () => {
      mockRequest.headers.get.mockImplementation((name) => {
        if (name === 'Content-Type') return 'application/json';
        return null;
      });
      mockRequest.json.mockResolvedValue({ test: 'data' });
      
      const result = await parseJsonBody(mockRequest);
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ test: 'data' });
    });

    test('should reject non-JSON content type', async () => {
      mockRequest.headers.get.mockImplementation((name) => {
        if (name === 'Content-Type') return 'text/plain';
        return null;
      });
      
      const result = await parseJsonBody(mockRequest);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Content-Type must be application/json');
    });

    test('should handle JSON parse errors', async () => {
      mockRequest.headers.get.mockImplementation((name) => {
        if (name === 'Content-Type') return 'application/json';
        return null;
      });
      mockRequest.json.mockRejectedValue(new Error('Invalid JSON'));
      
      const result = await parseJsonBody(mockRequest);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid JSON in request body');
    });

    test('should handle missing Content-Type', async () => {
      mockRequest.headers.get.mockReturnValue(null);
      
      const result = await parseJsonBody(mockRequest);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Content-Type must be application/json');
    });
  });

  describe('createAdminResponseHeaders', () => {
    test('should include default headers', () => {
      const headers = createAdminResponseHeaders();
      
      expect(headers['Content-Type']).toBe('application/json');
      expect(headers['X-Content-Type-Options']).toBe('nosniff');
    });

    test('should merge additional headers', () => {
      const headers = createAdminResponseHeaders({
        'X-Custom': 'value',
        'Cache-Control': 'no-cache'
      });
      
      expect(headers['Content-Type']).toBe('application/json');
      expect(headers['X-Custom']).toBe('value');
      expect(headers['Cache-Control']).toBe('no-cache');
    });

    test('should allow overriding default headers', () => {
      const headers = createAdminResponseHeaders({
        'Content-Type': 'text/plain'
      });
      
      expect(headers['Content-Type']).toBe('text/plain');
    });
  });

  describe('withErrorHandling', () => {
    test('should execute handler successfully', async () => {
      const mockHandler = jest.fn().mockResolvedValue(
        new Response('Success', { status: 200 })
      );
      
      const wrapped = withErrorHandling(mockHandler);
      const response = await wrapped(mockRequest, mockEnv, {});
      
      expect(response.status).toBe(200);
      expect(await response.text()).toBe('Success');
      expect(mockHandler).toHaveBeenCalledWith(mockRequest, mockEnv, {});
    });

    test('should catch and handle errors', async () => {
      const mockHandler = jest.fn().mockRejectedValue(
        new Error('Test error')
      );
      
      const wrapped = withErrorHandling(mockHandler);
      const response = await wrapped(mockRequest, mockEnv, {});
      
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Internal server error');
      expect(data.message).toBe('Test error');
    });

    test('should preserve async behavior', async () => {
      const mockHandler = jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return new Response('Delayed', { status: 200 });
      });
      
      const wrapped = withErrorHandling(mockHandler);
      const response = await wrapped(mockRequest, mockEnv, {});
      
      expect(response.status).toBe(200);
      expect(await response.text()).toBe('Delayed');
    });
  });

  describe('validateInstanceIdFormat', () => {
    test('should accept valid instance IDs', () => {
      const validIds = [
        'test-instance',
        'my-bot-123',
        'simple',
        '123-456-789'
      ];
      
      validIds.forEach(id => {
        const result = validateInstanceIdFormat(id);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });

    test('should reject invalid characters', () => {
      const invalidIds = [
        'Test-Instance',  // uppercase
        'my_bot',         // underscore
        'bot@123',        // special char
        'my bot',         // space
        'bot.com'         // dot
      ];
      
      invalidIds.forEach(id => {
        const result = validateInstanceIdFormat(id);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('lowercase letters, numbers, and hyphens');
      });
    });

    test('should reject empty or whitespace IDs', () => {
      const result1 = validateInstanceIdFormat('');
      expect(result1.valid).toBe(false);
      expect(result1.error).toBe('Instance ID is required');
      
      const result2 = validateInstanceIdFormat('  ');
      expect(result2.valid).toBe(false);
      expect(result2.error).toBe('Instance ID is required');
    });

    test('should reject IDs longer than 50 characters', () => {
      const longId = 'a'.repeat(51);
      const result = validateInstanceIdFormat(longId);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Instance ID must be 50 characters or less');
    });

    test('should accept 50 character IDs', () => {
      const maxId = 'a'.repeat(50);
      const result = validateInstanceIdFormat(maxId);
      
      expect(result.valid).toBe(true);
    });
  });
});