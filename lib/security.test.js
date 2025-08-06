/**
 * Tests for the security module
 */

import { describe, test, expect } from '@jest/globals';
import { 
  corsHeaders, 
  securityHeaders, 
  validateInstanceId, 
  validateDomain,
  createResponseHeaders,
  handleCORSPreflight
} from './security.js';

describe('Security Module', () => {
  describe('validateInstanceId', () => {
    test('should accept valid instance IDs', () => {
      expect(validateInstanceId('seo-assistant')).toBe(true);
      expect(validateInstanceId('support-bot-123')).toBe(true);
      expect(validateInstanceId('test')).toBe(true);
      expect(validateInstanceId('a-b-c-1-2-3')).toBe(true);
    });

    test('should reject invalid instance IDs', () => {
      expect(validateInstanceId('SEO-Assistant')).toBe(false); // uppercase
      expect(validateInstanceId('seo_assistant')).toBe(false); // underscore
      expect(validateInstanceId('seo assistant')).toBe(false); // space
      expect(validateInstanceId('seo@assistant')).toBe(false); // special char
      expect(validateInstanceId('')).toBe(false); // empty
    });
  });

  describe('validateDomain', () => {
    const mockInstanceConfig = {
      allowedDomains: ['example.com', '*.test.com', 'localhost']
    };

    test('should allow exact domain match', async () => {
      const request = new Request('https://example.com/test', {
        headers: { 'Origin': 'https://example.com' }
      });
      expect(await validateDomain(request, mockInstanceConfig)).toBe(true);
    });

    test('should allow wildcard subdomain match', async () => {
      const request1 = new Request('https://api.test.com/test', {
        headers: { 'Origin': 'https://api.test.com' }
      });
      expect(await validateDomain(request1, mockInstanceConfig)).toBe(true);

      const request2 = new Request('https://www.test.com/test', {
        headers: { 'Origin': 'https://www.test.com' }
      });
      expect(await validateDomain(request2, mockInstanceConfig)).toBe(true);

      const request3 = new Request('https://test.com/test', {
        headers: { 'Origin': 'https://test.com' }
      });
      expect(await validateDomain(request3, mockInstanceConfig)).toBe(true);
    });

    test('should reject non-matching domains', async () => {
      const request = new Request('https://evil.com/test', {
        headers: { 'Origin': 'https://evil.com' }
      });
      expect(await validateDomain(request, mockInstanceConfig)).toBe(false);
    });

    test('should handle referer header when origin is missing', async () => {
      const request = new Request('https://example.com/test', {
        headers: { 'Referer': 'https://example.com/page' }
      });
      expect(await validateDomain(request, mockInstanceConfig)).toBe(true);
    });

    test('should allow wildcard * for all domains', async () => {
      const config = { allowedDomains: ['*'] };
      const request = new Request('https://any-domain.com/test', {
        headers: { 'Origin': 'https://any-domain.com' }
      });
      expect(await validateDomain(request, config)).toBe(true);
    });

    test('should handle same-origin requests', async () => {
      const request = new Request('https://worker.example.com/test', {
        headers: { 'Host': 'worker.example.com' }
      });
      expect(await validateDomain(request, mockInstanceConfig)).toBe(true);
    });
  });

  describe('createResponseHeaders', () => {
    test('should include CORS and security headers', () => {
      const headers = createResponseHeaders('https://example.com');
      
      expect(headers['Content-Type']).toBe('application/json');
      expect(headers['Access-Control-Allow-Origin']).toBe('https://example.com');
      expect(headers['X-Content-Type-Options']).toBe('nosniff');
      expect(headers['X-Frame-Options']).toBe('DENY');
      expect(headers['Access-Control-Allow-Methods']).toBe('GET, POST, OPTIONS');
    });

    test('should default origin to * if not provided', () => {
      const headers = createResponseHeaders();
      expect(headers['Access-Control-Allow-Origin']).toBe('*');
    });
  });

  describe('handleCORSPreflight', () => {
    test('should return 204 with CORS headers', () => {
      const request = new Request('https://example.com/test', {
        method: 'OPTIONS',
        headers: { 'Origin': 'https://example.com' }
      });
      
      const response = handleCORSPreflight(request);
      
      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com');
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, OPTIONS');
    });
  });
});

// Export headers for validation
describe('Header configurations', () => {
  test('corsHeaders should contain required headers', () => {
    expect(corsHeaders).toHaveProperty('Access-Control-Allow-Methods');
    expect(corsHeaders).toHaveProperty('Access-Control-Allow-Headers');
    expect(corsHeaders).toHaveProperty('Access-Control-Max-Age');
    expect(corsHeaders).toHaveProperty('Access-Control-Allow-Credentials');
  });

  test('securityHeaders should contain required headers', () => {
    expect(securityHeaders).toHaveProperty('X-Content-Type-Options');
    expect(securityHeaders).toHaveProperty('X-Frame-Options');
    expect(securityHeaders).toHaveProperty('X-XSS-Protection');
    expect(securityHeaders).toHaveProperty('Content-Security-Policy');
    expect(securityHeaders).toHaveProperty('Strict-Transport-Security');
  });
});