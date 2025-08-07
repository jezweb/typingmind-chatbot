/**
 * Tests for admin service module
 */

import { describe, test, expect } from '@jest/globals';
import {
  processFormData,
  validateInstanceData,
  createErrorResponse,
  createSuccessResponse,
  generateWidgetCode
} from './admin-service.js';

describe('Admin Service', () => {
  describe('processFormData', () => {
    test('should convert checkbox values to booleans', () => {
      const input = {
        id: 'test',
        markdown: 'on',
        image_upload: 'on',
        persist_session: 'off'
      };
      
      const result = processFormData(input);
      
      expect(result.markdown).toBe(true);
      expect(result.image_upload).toBe(true);
      expect(result.persist_session).toBe(false);
    });

    test('should preserve boolean values', () => {
      const input = {
        id: 'test',
        markdown: true,
        image_upload: false,
        persist_session: true
      };
      
      const result = processFormData(input);
      
      expect(result.markdown).toBe(true);
      expect(result.image_upload).toBe(false);
      expect(result.persist_session).toBe(true);
    });

    test('should parse domains from string', () => {
      const input = {
        id: 'test',
        domains: '*.example.com\nexample.com\n  \ntest.com  '
      };
      
      const result = processFormData(input);
      
      expect(result.domains).toEqual(['*.example.com', 'example.com', 'test.com']);
    });

    test('should handle empty domains', () => {
      const input = {
        id: 'test',
        domains: '\n  \n'
      };
      
      const result = processFormData(input);
      
      expect(result.domains).toEqual([]);
    });

    test('should preserve domain arrays', () => {
      const input = {
        id: 'test',
        domains: ['example.com', 'test.com']
      };
      
      const result = processFormData(input);
      
      expect(result.domains).toEqual(['example.com', 'test.com']);
    });

    test('should convert numeric fields', () => {
      const input = {
        id: 'test',
        width: '450',
        messages_per_hour: '200',
        messages_per_session: '50'
      };
      
      const result = processFormData(input);
      
      expect(result.width).toBe(450);
      expect(result.messages_per_hour).toBe(200);
      expect(result.messages_per_session).toBe(50);
    });

    test('should use defaults for invalid numeric values', () => {
      const input = {
        id: 'test',
        width: 'invalid',
        messages_per_hour: '',
        messages_per_session: null
      };
      
      const result = processFormData(input);
      
      expect(result.width).toBe(380);
      expect(result.messages_per_hour).toBe(100);
      expect(result.messages_per_session).toBe(30);
    });
  });

  describe('validateInstanceData', () => {
    test('should validate required fields', () => {
      const data = {
        id: '',
        typingmind_agent_id: '',
        name: '',
        domains: []
      };
      
      const result = validateInstanceData(data);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Instance ID is required');
      expect(result.errors).toContain('TypingMind Agent ID is required');
      expect(result.errors).toContain('Instance name is required');
      expect(result.errors).toContain('At least one allowed domain is required');
    });

    test('should validate instance ID format', () => {
      const data = {
        id: 'Test-ID-123!',
        typingmind_agent_id: 'agent-123',
        name: 'Test',
        domains: ['example.com']
      };
      
      const result = validateInstanceData(data);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Instance ID must contain only lowercase letters, numbers, and hyphens');
    });

    test('should validate numeric ranges', () => {
      const data = {
        id: 'test',
        typingmind_agent_id: 'agent-123',
        name: 'Test',
        domains: ['example.com'],
        width: 200,
        messages_per_hour: 0,
        messages_per_session: -1
      };
      
      const result = validateInstanceData(data);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Width must be between 300 and 800 pixels');
      expect(result.errors).toContain('Messages per hour must be at least 1');
      expect(result.errors).toContain('Messages per session must be at least 1');
    });

    test('should validate color format', () => {
      const data = {
        id: 'test',
        typingmind_agent_id: 'agent-123',
        name: 'Test',
        domains: ['example.com'],
        primary_color: 'blue'
      };
      
      const result = validateInstanceData(data);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Primary color must be a valid hex color (e.g., #007bff)');
    });

    test('should validate position values', () => {
      const data = {
        id: 'test',
        typingmind_agent_id: 'agent-123',
        name: 'Test',
        domains: ['example.com'],
        position: 'center'
      };
      
      const result = validateInstanceData(data);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid position value');
    });

    test('should validate embed mode', () => {
      const data = {
        id: 'test',
        typingmind_agent_id: 'agent-123',
        name: 'Test',
        domains: ['example.com'],
        embed_mode: 'modal'
      };
      
      const result = validateInstanceData(data);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid embed mode');
    });

    test('should accept valid data', () => {
      const data = {
        id: 'test-instance',
        typingmind_agent_id: 'agent-123',
        name: 'Test Instance',
        domains: ['example.com', '*.test.com'],
        width: 400,
        messages_per_hour: 100,
        messages_per_session: 30,
        primary_color: '#007bff',
        position: 'bottom-right',
        embed_mode: 'popup'
      };
      
      const result = validateInstanceData(data);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('createErrorResponse', () => {
    test('should create error response with single message', async () => {
      const response = createErrorResponse('Test error', 400);
      
      expect(response.status).toBe(400);
      expect(response.headers.get('Content-Type')).toBe('application/json');
      
      const data = await response.json();
      expect(data.error).toBe('Test error');
      expect(data.errors).toEqual(['Test error']);
    });

    test('should create error response with multiple messages', async () => {
      const errors = ['Error 1', 'Error 2', 'Error 3'];
      const response = createErrorResponse(errors, 422);
      
      expect(response.status).toBe(422);
      
      const data = await response.json();
      expect(data.error).toBe('Error 1, Error 2, Error 3');
      expect(data.errors).toEqual(errors);
    });

    test('should include custom headers', async () => {
      const response = createErrorResponse('Error', 500, {
        'X-Custom-Header': 'value'
      });
      
      expect(response.headers.get('X-Custom-Header')).toBe('value');
    });
  });

  describe('createSuccessResponse', () => {
    test('should create success response with data', async () => {
      const response = createSuccessResponse({ id: 'test', name: 'Test' });
      
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/json');
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.id).toBe('test');
      expect(data.name).toBe('Test');
    });

    test('should create success response with custom status', async () => {
      const response = createSuccessResponse({}, 201);
      
      expect(response.status).toBe(201);
      
      const data = await response.json();
      expect(data.success).toBe(true);
    });

    test('should include custom headers', async () => {
      const response = createSuccessResponse({}, 200, {
        'Location': '/test'
      });
      
      expect(response.headers.get('Location')).toBe('/test');
    });
  });

  describe('generateWidgetCode', () => {
    test('should generate widget code with instance ID', () => {
      const code = generateWidgetCode('test-instance');
      
      expect(code).toContain('TypingMind Chatbot Widget');
      expect(code).toContain("instanceId: 'test-instance'");
      expect(code).toContain('TypingMindChat.init');
    });

    test('should include origin in widget code', () => {
      const code = generateWidgetCode('test-instance', 'https://example.com');
      
      expect(code).toContain("script.src = 'https://example.com/widget.js'");
    });

    test('should generate self-executing function', () => {
      const code = generateWidgetCode('test-instance');
      
      expect(code).toContain('(function() {');
      expect(code).toContain('})();');
    });
  });
});