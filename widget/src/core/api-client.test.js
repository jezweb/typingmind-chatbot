/**
 * Tests for the ApiClient module
 */

import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { ApiClient } from './api-client.js';
import { mockFetch, mockFetchError } from '../../test-utils.js';

describe('ApiClient', () => {
  let apiClient;
  const workerUrl = 'https://test-api.com';

  beforeEach(() => {
    apiClient = new ApiClient(workerUrl);
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should initialize with worker URL', () => {
      expect(apiClient.workerUrl).toBe(workerUrl);
    });
  });

  describe('fetchInstanceInfo', () => {
    const instanceId = 'test-instance';

    test('should fetch instance information successfully', async () => {
      const mockInstanceInfo = {
        name: 'Test Agent',
        typingmindAgentId: 'agent-123',
        themes: { primaryColor: '#007bff' }
      };
      
      mockFetch(mockInstanceInfo);
      
      const result = await apiClient.fetchInstanceInfo(instanceId);
      
      expect(fetch).toHaveBeenCalledWith(`${workerUrl}/instance/${instanceId}`);
      expect(result).toEqual(mockInstanceInfo);
    });

    test('should throw error on non-OK response', async () => {
      mockFetch(null, { ok: false, status: 404 });
      
      await expect(apiClient.fetchInstanceInfo(instanceId))
        .rejects.toThrow('Failed to fetch instance info: 404');
    });

    test('should handle network errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockFetchError(new Error('Network error'));
      
      await expect(apiClient.fetchInstanceInfo(instanceId))
        .rejects.toThrow('Network error');
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('sendMessage', () => {
    const instanceId = 'test-instance';
    const sessionId = 'session-123';
    const messages = [{ role: 'user', content: 'Hello' }];

    test('should send message and handle JSON response', async () => {
      const mockResponse = {
        content: 'Hello! How can I help you?',
        role: 'assistant'
      };
      
      mockFetch(mockResponse, {
        headers: new Headers({ 'content-type': 'application/json' })
      });
      
      const result = await apiClient.sendMessage(instanceId, messages, sessionId);
      
      expect(fetch).toHaveBeenCalledWith(
        `${workerUrl}/chat`,
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            instanceId,
            messages,
            sessionId
          })
        })
      );
      
      expect(result).toEqual({
        streaming: false,
        data: mockResponse
      });
    });

    test('should detect streaming response', async () => {
      const mockResponse = {
        ok: true,
        headers: new Headers({ 'content-type': 'text/event-stream' })
      };
      
      global.fetch.mockResolvedValueOnce(mockResponse);
      
      const result = await apiClient.sendMessage(instanceId, messages, sessionId);
      
      expect(result).toEqual({
        streaming: true,
        response: mockResponse
      });
    });

    test('should handle API errors', async () => {
      mockFetch(
        { error: 'Rate limit exceeded' },
        { 
          ok: false, 
          status: 429,
          statusText: 'Too Many Requests'
        }
      );
      
      await expect(apiClient.sendMessage(instanceId, messages, sessionId))
        .rejects.toThrow('Rate limit exceeded');
    });

    test('should parse custom error messages', async () => {
      const errorResponse = {
        json: async () => ({ error: 'Custom error message' }),
        text: async () => '{"error":"Custom error message"}',
        ok: false,
        status: 400,
        statusText: 'Bad Request'
      };
      
      global.fetch.mockResolvedValueOnce(errorResponse);
      
      await expect(apiClient.sendMessage(instanceId, messages, sessionId))
        .rejects.toThrow('Custom error message');
    });
  });

  describe('parseErrorResponse', () => {
    test('should parse JSON error response', async () => {
      const response = {
        json: async () => ({ error: 'JSON error message' }),
        text: async () => '{"error":"JSON error message"}',
        statusText: 'Bad Request'
      };
      
      const error = await apiClient.parseErrorResponse(response);
      
      expect(error.message).toBe('JSON error message');
    });

    test('should handle non-JSON error response', async () => {
      const response = {
        json: async () => { throw new Error('Invalid JSON'); },
        text: async () => 'Plain text error',
        statusText: 'Internal Server Error',
        status: 500
      };
      
      const error = await apiClient.parseErrorResponse(response);
      
      expect(error.message).toBe('Failed to parse error response');
    });

    test('should handle empty error response', async () => {
      const response = {
        json: async () => ({}),
        text: async () => '{}',
        statusText: 'Unknown Error',
        status: 500
      };
      
      const error = await apiClient.parseErrorResponse(response);
      
      expect(error.message).toBe('Failed to get response (500)');
    });
  });

  describe('handleStreamingResponse', () => {
    test('should process streaming chunks', async () => {
      const encoder = new TextEncoder();
      
      const chunks = [
        encoder.encode('data: {"content":"Hello"}\n\n'),
        encoder.encode('data: {"content":" world"}\n\n'),
        encoder.encode('data: [DONE]\n\n')
      ];
      
      let index = 0;
      const reader = {
        read: async () => {
          if (index >= chunks.length) {
            return { done: true };
          }
          return { done: false, value: chunks[index++] };
        },
        releaseLock: jest.fn()
      };
      
      const response = {
        body: {
          getReader: () => reader
        }
      };
      
      const chunks_received = [];
      for await (const chunk of apiClient.handleStreamingResponse(response)) {
        chunks_received.push(chunk);
      }
      
      expect(chunks_received).toEqual(['Hello', ' world']);
      expect(reader.releaseLock).toHaveBeenCalled();
    });

    test('should handle malformed streaming data', async () => {
      const encoder = new TextEncoder();
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const chunks = [
        encoder.encode('data: {"content":"Valid"}\n\n'),
        encoder.encode('data: invalid json\n\n'),
        encoder.encode('data: [DONE]\n\n')
      ];
      
      let index = 0;
      const reader = {
        read: async () => {
          if (index >= chunks.length) {
            return { done: true };
          }
          return { done: false, value: chunks[index++] };
        },
        releaseLock: jest.fn()
      };
      
      const response = {
        body: {
          getReader: () => reader
        }
      };
      
      const chunks_received = [];
      for await (const chunk of apiClient.handleStreamingResponse(response)) {
        chunks_received.push(chunk);
      }
      
      expect(chunks_received).toEqual(['Valid']);
      expect(consoleSpy).toHaveBeenCalled();
      expect(reader.releaseLock).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    test('should handle empty chunks', async () => {
      const encoder = new TextEncoder();
      
      const chunks = [
        encoder.encode('\n\n'),
        encoder.encode('data: \n\n'),
        encoder.encode('data: {"content":"Test"}\n\n'),
        encoder.encode('data: [DONE]\n\n')
      ];
      
      let index = 0;
      const reader = {
        read: async () => {
          if (index >= chunks.length) {
            return { done: true };
          }
          return { done: false, value: chunks[index++] };
        },
        releaseLock: jest.fn()
      };
      
      const response = {
        body: {
          getReader: () => reader
        }
      };
      
      const chunks_received = [];
      for await (const chunk of apiClient.handleStreamingResponse(response)) {
        chunks_received.push(chunk);
      }
      
      expect(chunks_received).toEqual(['Test']);
      expect(reader.releaseLock).toHaveBeenCalled();
    });
  });
});