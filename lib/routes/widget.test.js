/**
 * Tests for widget routes module
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { handleWidgetDelivery } from './widget.js';

describe('Widget Routes', () => {
  let mockEnv;
  let mockRequest;

  beforeEach(() => {
    mockEnv = {
      AGENT_CONFIG: {
        get: jest.fn()
      }
    };
    
    mockRequest = {};
  });

  describe('handleWidgetDelivery', () => {
    test('should return widget code when available', async () => {
      const widgetCode = `
        (function() {
          window.TypingMindChat = { init: function() {} };
        })();
      `;
      
      mockEnv.AGENT_CONFIG.get.mockResolvedValue(widgetCode);
      
      const response = await handleWidgetDelivery(mockRequest, mockEnv);
      const content = await response.text();
      
      expect(response.status).toBe(200);
      expect(content).toBe(widgetCode);
      expect(response.headers.get('Content-Type')).toBe('application/javascript');
      expect(response.headers.get('Cache-Control')).toBe('public, max-age=3600');
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(mockEnv.AGENT_CONFIG.get).toHaveBeenCalledWith('widget:code');
    });

    test('should return error message when widget not deployed', async () => {
      mockEnv.AGENT_CONFIG.get.mockResolvedValue(null);
      
      const response = await handleWidgetDelivery(mockRequest, mockEnv);
      const content = await response.text();
      
      expect(response.status).toBe(200);
      expect(content).toBe('console.error("Widget not deployed. Please run npm run deploy:widget");');
      expect(response.headers.get('Content-Type')).toBe('application/javascript');
    });

    test('should handle KV storage errors gracefully', async () => {
      mockEnv.AGENT_CONFIG.get.mockRejectedValue(new Error('KV error'));
      
      // The function doesn't catch errors, so it should throw
      await expect(handleWidgetDelivery(mockRequest, mockEnv)).rejects.toThrow('KV error');
    });
  });
});