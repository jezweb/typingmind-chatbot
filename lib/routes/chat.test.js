/**
 * Tests for chat routes module
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';

// Create mock functions before importing modules
const mockValidateInstanceId = jest.fn((id) => /^[a-z0-9-]+$/.test(id));
const mockValidateDomain = jest.fn();
const mockCreateResponseHeaders = jest.fn(() => ({ 'Content-Type': 'application/json' }));
const mockGetInstanceConfig = jest.fn();
const mockCheckAndUpdateRateLimit = jest.fn();
const mockGenerateRateLimitKeys = jest.fn();
const mockExtractClientId = jest.fn();
const mockCreateRateLimitErrorResponse = jest.fn();

// Mock modules before imports
jest.unstable_mockModule('../security.js', () => ({
  validateInstanceId: mockValidateInstanceId,
  validateDomain: mockValidateDomain,
  createResponseHeaders: mockCreateResponseHeaders
}));

jest.unstable_mockModule('../database.js', () => ({
  getInstanceConfig: mockGetInstanceConfig
}));

jest.unstable_mockModule('../rate-limiter.js', () => ({
  checkAndUpdateRateLimit: mockCheckAndUpdateRateLimit,
  generateRateLimitKeys: mockGenerateRateLimitKeys,
  extractClientId: mockExtractClientId,
  createRateLimitErrorResponse: mockCreateRateLimitErrorResponse
}));

// Import after mocking
const { handleGetInstance, handleChat } = await import('./chat.js');

// Mock fetch
global.fetch = jest.fn();

describe('Chat Routes', () => {
  let mockEnv;
  let mockRequest;

  beforeEach(() => {
    mockEnv = {
      DB: {},
      DEFAULT_API_KEY: 'test-api-key',
      TYPINGMIND_API_HOST: 'https://api.typingmind.com',
      RATE_LIMITS: {}
    };
    
    mockRequest = {
      params: {},
      headers: {
        get: jest.fn()
      },
      json: jest.fn()
    };

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('handleGetInstance', () => {
    test('should return instance info for valid ID', async () => {
      mockRequest.params = { id: 'test-instance' };
      
      const mockInstance = {
        id: 'test-instance',
        name: 'Test Instance',
        theme: { primaryColor: '#007bff' },
        features: { markdown: true }
      };
      
      mockGetInstanceConfig.mockResolvedValue(mockInstance);
      
      const response = await handleGetInstance(mockRequest, mockEnv);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toEqual({
        id: 'test-instance',
        name: 'Test Instance',
        theme: { primaryColor: '#007bff' },
        features: { markdown: true }
      });
      expect(mockGetInstanceConfig).toHaveBeenCalledWith(mockEnv.DB, 'test-instance');
    });

    test('should return 400 when instance ID is missing', async () => {
      mockRequest.params = {};
      
      const response = await handleGetInstance(mockRequest, mockEnv);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBe('Instance ID is required');
    });

    test('should return 400 for invalid instance ID format', async () => {
      mockRequest.params = { id: 'Invalid_ID!' };
      
      const response = await handleGetInstance(mockRequest, mockEnv);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid instance ID format');
    });

    test('should return 404 when instance not found', async () => {
      mockRequest.params = { id: 'non-existent' };
      mockGetInstanceConfig.mockResolvedValue(null);
      
      const response = await handleGetInstance(mockRequest, mockEnv);
      const data = await response.json();
      
      expect(response.status).toBe(404);
      expect(data.error).toBe('Instance not found');
    });

    test('should handle database errors', async () => {
      mockRequest.params = { id: 'test-instance' };
      mockGetInstanceConfig.mockRejectedValue(new Error('DB error'));
      
      const response = await handleGetInstance(mockRequest, mockEnv);
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });
  });

  describe('handleChat', () => {
    beforeEach(() => {
      mockRequest.headers.get.mockImplementation((name) => {
        if (name === 'Origin') return 'https://example.com';
        return null;
      });
      
      mockGenerateRateLimitKeys.mockReturnValue({
        hourlyKey: 'rate:hour:test',
        sessionKey: 'rate:session:test'
      });
      
      mockExtractClientId.mockReturnValue('client-123');
    });

    test('should handle valid chat request', async () => {
      const mockBody = {
        instanceId: 'test-instance',
        messages: [{ role: 'user', content: 'Hello' }],
        sessionId: 'session-123'
      };
      
      mockRequest.json.mockResolvedValue(mockBody);
      
      const mockInstance = {
        id: 'test-instance',
        name: 'Test Instance',
        typingmindAgentId: 'agent-123',
        allowedDomains: ['example.com'],
        apiKey: null,
        rateLimit: {
          messagesPerHour: 100,
          messagesPerSession: 30
        }
      };
      
      mockGetInstanceConfig.mockResolvedValue(mockInstance);
      mockValidateDomain.mockResolvedValue(true);
      mockCheckAndUpdateRateLimit.mockResolvedValue({ allowed: true });
      
      const mockApiResponse = { content: 'Hello! How can I help?' };
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => mockApiResponse
      });
      
      const response = await handleChat(mockRequest, mockEnv);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toEqual(mockApiResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.typingmind.com/api/v2/agents/agent-123/chat',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-KEY': 'test-api-key'
          },
          body: JSON.stringify({ messages: mockBody.messages })
        })
      );
    });

    test('should reject request exceeding size limit', async () => {
      mockRequest.headers.get.mockImplementation((name) => {
        if (name === 'Content-Length') return '2000000'; // 2MB
        return null;
      });
      
      const response = await handleChat(mockRequest, mockEnv);
      const data = await response.json();
      
      expect(response.status).toBe(413);
      expect(data.error).toBe('Request too large');
      expect(data.message).toBe('Request body exceeds 1MB limit');
    });

    test('should validate required fields', async () => {
      mockRequest.json.mockResolvedValue({
        instanceId: 'test-instance'
        // missing messages
      });
      
      const response = await handleChat(mockRequest, mockEnv);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing required fields: instanceId and messages');
    });

    test('should validate messages array', async () => {
      mockRequest.json.mockResolvedValue({
        instanceId: 'test-instance',
        messages: [] // empty array
      });
      
      const response = await handleChat(mockRequest, mockEnv);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBe('Messages must be a non-empty array');
    });

    test('should enforce message limit', async () => {
      const messages = Array(101).fill({ role: 'user', content: 'test' });
      mockRequest.json.mockResolvedValue({
        instanceId: 'test-instance',
        messages
      });
      
      const response = await handleChat(mockRequest, mockEnv);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBe('Too many messages');
      expect(data.message).toBe('Maximum 100 messages allowed per request');
    });

    test('should handle domain validation failure', async () => {
      mockRequest.json.mockResolvedValue({
        instanceId: 'test-instance',
        messages: [{ role: 'user', content: 'Hello' }]
      });
      
      mockGetInstanceConfig.mockResolvedValue({
        id: 'test-instance',
        allowedDomains: ['allowed.com']
      });
      
      mockValidateDomain.mockResolvedValue(false);
      
      const response = await handleChat(mockRequest, mockEnv);
      const data = await response.json();
      
      expect(response.status).toBe(403);
      expect(data.error).toBe('Domain not authorized');
      expect(data.details).toContain('allowed.com');
    });

    test('should handle rate limit exceeded', async () => {
      mockRequest.json.mockResolvedValue({
        instanceId: 'test-instance',
        messages: [{ role: 'user', content: 'Hello' }]
      });
      
      mockGetInstanceConfig.mockResolvedValue({
        id: 'test-instance',
        allowedDomains: ['example.com'],
        rateLimit: { messagesPerHour: 100, messagesPerSession: 30 }
      });
      
      mockValidateDomain.mockResolvedValue(true);
      mockCheckAndUpdateRateLimit.mockResolvedValue({ 
        allowed: false,
        retryAfter: 3600
      });
      
      const mockErrorResponse = new Response('Rate limit exceeded', { status: 429 });
      mockCreateRateLimitErrorResponse.mockReturnValue(mockErrorResponse);
      
      const response = await handleChat(mockRequest, mockEnv);
      
      expect(response).toBe(mockErrorResponse);
    });

    test('should handle API timeout', async () => {
      mockRequest.json.mockResolvedValue({
        instanceId: 'test-instance',
        messages: [{ role: 'user', content: 'Hello' }]
      });
      
      mockGetInstanceConfig.mockResolvedValue({
        id: 'test-instance',
        allowedDomains: ['example.com'],
        typingmindAgentId: 'agent-123',
        rateLimit: { messagesPerHour: 100, messagesPerSession: 30 }
      });
      
      mockValidateDomain.mockResolvedValue(true);
      mockCheckAndUpdateRateLimit.mockResolvedValue({ allowed: true });
      
      // Simulate timeout
      global.fetch.mockRejectedValue(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
      
      const response = await handleChat(mockRequest, mockEnv);
      const data = await response.json();
      
      expect(response.status).toBe(504);
      expect(data.error).toBe('Request timeout');
      expect(data.message).toBe('The API request timed out after 30 seconds');
    });

    test('should handle agent not found error', async () => {
      mockRequest.json.mockResolvedValue({
        instanceId: 'test-instance',
        messages: [{ role: 'user', content: 'Hello' }]
      });
      
      mockGetInstanceConfig.mockResolvedValue({
        id: 'test-instance',
        allowedDomains: ['example.com'],
        typingmindAgentId: 'invalid-agent',
        rateLimit: { messagesPerHour: 100, messagesPerSession: 30 }
      });
      
      mockValidateDomain.mockResolvedValue(true);
      mockCheckAndUpdateRateLimit.mockResolvedValue({ allowed: true });
      
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          error: { code: 'agent_not_found' }
        })
      });
      
      const response = await handleChat(mockRequest, mockEnv);
      const data = await response.json();
      
      expect(response.status).toBe(404);
      expect(data.error).toBe('Agent not configured in TypingMind');
      expect(data.typingmindAgentId).toBe('invalid-agent');
    });
  });
});