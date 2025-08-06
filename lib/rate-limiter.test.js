/**
 * Tests for the rate limiter module
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import {
  checkAndUpdateRateLimit,
  generateRateLimitKeys,
  extractClientId,
  createRateLimitErrorResponse,
  clearRateLimits,
  getRateLimitStatus
} from './rate-limiter.js';

// Mock KV namespace
function createMockKV() {
  const store = new Map();
  const metadata = new Map();
  
  return {
    get: async (key) => store.get(key) || null,
    put: async (key, value, options) => {
      store.set(key, value);
      if (options?.expirationTtl) {
        metadata.set(key, { ttl: options.expirationTtl });
      }
    },
    delete: async (key) => {
      store.delete(key);
      metadata.delete(key);
    },
    getWithMetadata: async (key) => {
      const value = store.get(key);
      const meta = metadata.get(key);
      return {
        value,
        metadata: meta || null
      };
    }
  };
}

// Mock request
function createMockRequest(headers = {}) {
  return {
    headers: {
      get: (name) => headers[name] || null
    }
  };
}

describe('Rate Limiter Module', () => {
  let mockKV;

  beforeEach(() => {
    mockKV = createMockKV();
  });

  describe('checkAndUpdateRateLimit', () => {
    test('should allow request when under limits', async () => {
      const result = await checkAndUpdateRateLimit(mockKV, {
        hourlyKey: 'rate:hour:test:client1',
        sessionKey: 'rate:session:test:session1',
        hourlyLimit: 100,
        sessionLimit: 30,
        sessionId: 'session1'
      });

      expect(result).toMatchObject({
        allowed: true,
        message: 'Request allowed',
        remainingHourly: 99,
        remainingSession: 29
      });
    });

    test('should block request when hourly limit exceeded', async () => {
      // Set count to limit
      await mockKV.put('rate:hour:test:client1', '100', { expirationTtl: 3600 });

      const result = await checkAndUpdateRateLimit(mockKV, {
        hourlyKey: 'rate:hour:test:client1',
        sessionKey: 'rate:session:test:session1',
        hourlyLimit: 100,
        sessionLimit: 30,
        sessionId: 'session1'
      });

      expect(result).toMatchObject({
        allowed: false,
        message: 'Hourly rate limit exceeded. Maximum 100 messages per hour.',
        retryAfter: 3600
      });
    });

    test('should block request when session limit exceeded', async () => {
      // Set session count to limit
      await mockKV.put('rate:session:test:session1', '30', { expirationTtl: 86400 });

      const result = await checkAndUpdateRateLimit(mockKV, {
        hourlyKey: 'rate:hour:test:client1',
        sessionKey: 'rate:session:test:session1',
        hourlyLimit: 100,
        sessionLimit: 30,
        sessionId: 'session1'
      });

      expect(result).toMatchObject({
        allowed: false,
        message: 'Session rate limit exceeded. Maximum 30 messages per session.',
        retryAfter: 300
      });
    });

    test('should increment counts on allowed request', async () => {
      // First request
      await checkAndUpdateRateLimit(mockKV, {
        hourlyKey: 'rate:hour:test:client1',
        sessionKey: 'rate:session:test:session1',
        hourlyLimit: 100,
        sessionLimit: 30,
        sessionId: 'session1'
      });

      // Check counts
      const hourlyCount = await mockKV.get('rate:hour:test:client1');
      const sessionCount = await mockKV.get('rate:session:test:session1');

      expect(hourlyCount).toBe('1');
      expect(sessionCount).toBe('1');

      // Second request
      await checkAndUpdateRateLimit(mockKV, {
        hourlyKey: 'rate:hour:test:client1',
        sessionKey: 'rate:session:test:session1',
        hourlyLimit: 100,
        sessionLimit: 30,
        sessionId: 'session1'
      });

      // Check updated counts
      const hourlyCount2 = await mockKV.get('rate:hour:test:client1');
      const sessionCount2 = await mockKV.get('rate:session:test:session1');

      expect(hourlyCount2).toBe('2');
      expect(sessionCount2).toBe('2');
    });

    test('should work without sessionId', async () => {
      const result = await checkAndUpdateRateLimit(mockKV, {
        hourlyKey: 'rate:hour:test:client1',
        sessionKey: null,
        hourlyLimit: 100,
        sessionLimit: 30,
        sessionId: null
      });

      expect(result).toMatchObject({
        allowed: true,
        message: 'Request allowed',
        remainingHourly: 99,
        remainingSession: null
      });

      // Only hourly count should be set
      const hourlyCount = await mockKV.get('rate:hour:test:client1');
      const sessionCount = await mockKV.get('rate:session:test:session1');

      expect(hourlyCount).toBe('1');
      expect(sessionCount).toBeNull();
    });
  });

  describe('generateRateLimitKeys', () => {
    test('should generate correct keys with sessionId', () => {
      const keys = generateRateLimitKeys('instance1', 'client1', 'session1');
      
      expect(keys).toEqual({
        hourlyKey: 'rate:hour:instance1:client1',
        sessionKey: 'rate:session:instance1:session1'
      });
    });

    test('should generate correct keys without sessionId', () => {
      const keys = generateRateLimitKeys('instance1', 'client1');
      
      expect(keys).toEqual({
        hourlyKey: 'rate:hour:instance1:client1',
        sessionKey: null
      });
    });
  });

  describe('extractClientId', () => {
    test('should use sessionId when provided', () => {
      const request = createMockRequest({ 'CF-Connecting-IP': '192.168.1.1' });
      const clientId = extractClientId(request, 'session123');
      
      expect(clientId).toBe('session123');
    });

    test('should use CF-Connecting-IP when no sessionId', () => {
      const request = createMockRequest({ 'CF-Connecting-IP': '192.168.1.1' });
      const clientId = extractClientId(request);
      
      expect(clientId).toBe('192.168.1.1');
    });

    test('should use anonymous when no sessionId or IP', () => {
      const request = createMockRequest({});
      const clientId = extractClientId(request);
      
      expect(clientId).toBe('anonymous');
    });
  });

  describe('createRateLimitErrorResponse', () => {
    test('should create proper 429 response', () => {
      const rateLimitResult = {
        allowed: false,
        message: 'Rate limit exceeded',
        retryAfter: 3600
      };
      
      const responseHeaders = {
        'Content-Type': 'application/json',
        'X-Custom': 'value'
      };
      
      const response = createRateLimitErrorResponse(rateLimitResult, responseHeaders);
      
      expect(response.status).toBe(429);
      expect(response.headers.get('Retry-After')).toBe('3600');
      expect(response.headers.get('Content-Type')).toBe('application/json');
      expect(response.headers.get('X-Custom')).toBe('value');
    });

    test('should handle missing retryAfter', () => {
      const rateLimitResult = {
        allowed: false,
        message: 'Rate limit exceeded'
        // No retryAfter
      };
      
      const response = createRateLimitErrorResponse(rateLimitResult, {});
      
      expect(response.headers.get('Retry-After')).toBe('3600'); // Default
    });
  });

  describe('clearRateLimits', () => {
    test('should clear both hourly and session limits', async () => {
      // Set some values
      await mockKV.put('rate:hour:instance1:client1', '50');
      await mockKV.put('rate:session:instance1:session1', '20');
      
      // Clear limits
      await clearRateLimits(mockKV, 'instance1', 'client1', 'session1');
      
      // Check they're gone
      const hourlyCount = await mockKV.get('rate:hour:instance1:client1');
      const sessionCount = await mockKV.get('rate:session:instance1:session1');
      
      expect(hourlyCount).toBeNull();
      expect(sessionCount).toBeNull();
    });

    test('should clear only hourly limit when no sessionId', async () => {
      // Set values
      await mockKV.put('rate:hour:instance1:client1', '50');
      await mockKV.put('rate:session:instance1:session1', '20');
      
      // Clear without sessionId
      await clearRateLimits(mockKV, 'instance1', 'client1');
      
      // Check hourly is gone but session remains
      const hourlyCount = await mockKV.get('rate:hour:instance1:client1');
      const sessionCount = await mockKV.get('rate:session:instance1:session1');
      
      expect(hourlyCount).toBeNull();
      expect(sessionCount).toBe('20'); // Unchanged
    });
  });

  describe('getRateLimitStatus', () => {
    test('should return current status without incrementing', async () => {
      // Set some counts
      await mockKV.put('rate:hour:instance1:client1', '50');
      await mockKV.put('rate:session:instance1:session1', '20');
      
      const status = await getRateLimitStatus(
        mockKV, 
        'instance1', 
        'client1', 
        'session1',
        { hourlyLimit: 100, sessionLimit: 30 }
      );
      
      expect(status).toEqual({
        hourly: {
          current: 50,
          limit: 100,
          remaining: 50,
          exceeded: false
        },
        session: {
          current: 20,
          limit: 30,
          remaining: 10,
          exceeded: false
        }
      });
      
      // Verify counts weren't changed
      const hourlyCount = await mockKV.get('rate:hour:instance1:client1');
      const sessionCount = await mockKV.get('rate:session:instance1:session1');
      
      expect(hourlyCount).toBe('50');
      expect(sessionCount).toBe('20');
    });

    test('should show exceeded status correctly', async () => {
      // Set counts at limits
      await mockKV.put('rate:hour:instance1:client1', '100');
      await mockKV.put('rate:session:instance1:session1', '30');
      
      const status = await getRateLimitStatus(
        mockKV, 
        'instance1', 
        'client1', 
        'session1',
        { hourlyLimit: 100, sessionLimit: 30 }
      );
      
      expect(status.hourly.exceeded).toBe(true);
      expect(status.hourly.remaining).toBe(0);
      expect(status.session.exceeded).toBe(true);
      expect(status.session.remaining).toBe(0);
    });

    test('should work without sessionId', async () => {
      await mockKV.put('rate:hour:instance1:client1', '25');
      
      const status = await getRateLimitStatus(
        mockKV, 
        'instance1', 
        'client1', 
        null,
        { hourlyLimit: 100, sessionLimit: 30 }
      );
      
      expect(status).toEqual({
        hourly: {
          current: 25,
          limit: 100,
          remaining: 75,
          exceeded: false
        },
        session: null
      });
    });
  });
});