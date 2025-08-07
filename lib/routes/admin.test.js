/**
 * Tests for admin routes module
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';

// Create mock functions before importing modules
const mockCreateAdminSession = jest.fn();
const mockDeleteAdminSession = jest.fn();
const mockValidatePassword = jest.fn();
const mockExtractSessionId = jest.fn();
const mockCreateLogoutCookie = jest.fn(() => 'admin_session=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict');
const mockSecurityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block'
};
const mockLoginPage = jest.fn();
const mockDashboardPage = jest.fn();
const mockGetAllInstances = jest.fn();
const mockRequireAuth = jest.fn();
const mockParseJsonBody = jest.fn();
const mockCreateAdminResponseHeaders = jest.fn(() => ({ 'Content-Type': 'application/json' }));
const mockCreateErrorResponse = jest.fn((error, status, headers) => 
  new Response(JSON.stringify({ error }), { status, headers })
);
const mockCreateSuccessResponse = jest.fn((data, status, headers) => 
  new Response(JSON.stringify({ success: true, ...data }), { status, headers })
);

// Mock modules before imports
jest.unstable_mockModule('../auth.js', () => ({
  extractSessionId: mockExtractSessionId,
  createAdminSession: mockCreateAdminSession,
  deleteAdminSession: mockDeleteAdminSession,
  createLogoutCookie: mockCreateLogoutCookie,
  validatePassword: mockValidatePassword
}));

jest.unstable_mockModule('../security.js', () => ({
  securityHeaders: mockSecurityHeaders
}));

jest.unstable_mockModule('../database.js', () => ({
  getAllInstances: mockGetAllInstances
}));

jest.unstable_mockModule('../templates/admin-pages.js', () => ({
  loginPage: mockLoginPage,
  dashboardPage: mockDashboardPage
}));

jest.unstable_mockModule('../middleware/admin-validation.js', () => ({
  requireAuth: mockRequireAuth,
  parseJsonBody: mockParseJsonBody,
  createAdminResponseHeaders: mockCreateAdminResponseHeaders
}));

jest.unstable_mockModule('../services/admin-service.js', () => ({
  createErrorResponse: mockCreateErrorResponse,
  createSuccessResponse: mockCreateSuccessResponse
}));


// Import after mocking
const { 
  handleAdminLoginPage, 
  handleAdminLogin, 
  handleAdminLogout,
  handleAdminDashboard,
  handleAdminJs 
} = await import('./admin.js');

describe('Admin Routes', () => {
  let mockEnv;
  let mockRequest;

  beforeEach(() => {
    mockEnv = {
      DB: {
        prepare: jest.fn().mockReturnThis(),
        bind: jest.fn().mockReturnThis(),
        all: jest.fn()
      },
      ADMIN_PASSWORD: 'test-password',
      ADMIN_SESSIONS: {},
      AGENT_CONFIG: {
        get: jest.fn(),
        put: jest.fn()
      }
    };
    
    mockRequest = {
      headers: {
        get: jest.fn()
      },
      formData: jest.fn(),
      json: jest.fn()
    };

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('handleAdminLoginPage', () => {
    test('should return login page HTML', async () => {
      const mockHtml = '<html>Login Page</html>';
      mockLoginPage.mockReturnValue(mockHtml);
      
      const response = await handleAdminLoginPage();
      
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/html');
      expect(await response.text()).toBe(mockHtml);
      expect(mockLoginPage).toHaveBeenCalled();
    });

    test('should include security headers', async () => {
      mockLoginPage.mockReturnValue('<html></html>');
      
      const response = await handleAdminLoginPage();
      
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
      expect(response.headers.get('X-XSS-Protection')).toBe('1; mode=block');
    });
  });

  describe('handleAdminLogin', () => {
    test('should create session on valid password', async () => {
      mockParseJsonBody.mockResolvedValue({
        success: true,
        data: { password: 'test-password' }
      });
      mockRequest.headers.get.mockImplementation((name) => {
        if (name === 'CF-Connecting-IP') return '192.168.1.1';
        return null;
      });
      
      mockValidatePassword.mockReturnValue(true);
      mockCreateAdminSession.mockResolvedValue({
        sessionId: 'session-123',
        cookieOptions: 'admin_session=session-123; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=86400'
      });
      
      const response = await handleAdminLogin(mockRequest, mockEnv);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.sessionId).toBe('session-123');
      expect(response.headers.get('Set-Cookie')).toContain('admin_session=session-123');
      expect(mockValidatePassword).toHaveBeenCalledWith('test-password', 'test-password');
      expect(mockCreateAdminSession).toHaveBeenCalledWith(mockEnv, '192.168.1.1');
    });

    test('should reject invalid password', async () => {
      mockParseJsonBody.mockResolvedValue({
        success: true,
        data: { password: 'wrong-password' }
      });
      
      mockValidatePassword.mockReturnValue(false);
      
      const response = await handleAdminLogin(mockRequest, mockEnv);
      const data = await response.json();
      
      expect(response.status).toBe(401);
      expect(data.error).toBe('Invalid password');
      expect(mockCreateAdminSession).not.toHaveBeenCalled();
    });

    test('should handle missing password', async () => {
      mockRequest.json.mockResolvedValue({});
      
      mockValidatePassword.mockReturnValue(false);
      
      const response = await handleAdminLogin(mockRequest, mockEnv);
      const data = await response.json();
      
      expect(response.status).toBe(401);
      expect(data.error).toBe('Invalid password');
    });

    test('should handle JSON parse errors', async () => {
      mockParseJsonBody.mockResolvedValue({
        success: false,
        error: 'Invalid JSON in request body'
      });
      
      const response = await handleAdminLogin(mockRequest, mockEnv);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid JSON in request body');
    });
  });

  describe('handleAdminLogout', () => {
    test('should delete session and clear cookie', async () => {
      mockRequest.headers.get.mockImplementation((name) => {
        if (name === 'Cookie') return 'admin_session=session-123';
        return null;
      });
      
      mockExtractSessionId.mockReturnValue('session-123');
      
      const response = await handleAdminLogout(mockRequest, mockEnv);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(response.headers.get('Set-Cookie')).toContain('admin_session=');
      expect(response.headers.get('Set-Cookie')).toContain('Max-Age=0');
      expect(mockDeleteAdminSession).toHaveBeenCalledWith(mockEnv, 'session-123');
    });

    test('should handle missing session', async () => {
      mockRequest.headers.get.mockReturnValue(null);
      mockExtractSessionId.mockReturnValue(null);
      
      const response = await handleAdminLogout(mockRequest, mockEnv);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockDeleteAdminSession).not.toHaveBeenCalled();
    });
  });

  describe('handleAdminDashboard', () => {
    test('should return dashboard for valid session', async () => {
      mockRequireAuth.mockResolvedValue(null); // null means authenticated
      
      const mockInstances = [
        {
          id: 'test-1',
          name: 'Test Instance',
          typingmind_agent_id: 'agent-1',
          created_at: '2023-01-01'
        }
      ];
      
      mockGetAllInstances.mockResolvedValue(mockInstances);
      mockDashboardPage.mockReturnValue('<html>Dashboard</html>');
      
      const response = await handleAdminDashboard(mockRequest, mockEnv);
      
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/html');
      expect(mockRequireAuth).toHaveBeenCalledWith(mockRequest, mockEnv);
      expect(mockDashboardPage).toHaveBeenCalledWith(mockInstances);
    });

    test('should return auth response for invalid session', async () => {
      const mockAuthResponse = new Response(null, { 
        status: 302, 
        headers: { Location: '/admin' } 
      });
      mockRequireAuth.mockResolvedValue(mockAuthResponse);
      
      const response = await handleAdminDashboard(mockRequest, mockEnv);
      
      expect(response).toBe(mockAuthResponse);
      expect(mockGetAllInstances).not.toHaveBeenCalled();
    });

    test('should handle database errors', async () => {
      mockRequireAuth.mockResolvedValue(null); // authenticated
      
      mockGetAllInstances.mockRejectedValue(new Error('DB error'));
      
      const response = await handleAdminDashboard(mockRequest, mockEnv);
      
      expect(response.status).toBe(500);
      expect(response.headers.get('Content-Type')).toBe('text/html');
      const html = await response.text();
      expect(html).toContain('Error loading dashboard');
    });
  });

  describe('handleAdminJs', () => {
    test('should return admin JavaScript from KV storage', async () => {
      const mockAdminJs = 'console.log("Admin JS loaded");';
      mockEnv.AGENT_CONFIG.get.mockResolvedValue(mockAdminJs);
      
      const response = await handleAdminJs(mockEnv);
      const js = await response.text();
      
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/javascript');
      expect(response.headers.get('Cache-Control')).toBe('public, max-age=3600');
      expect(js).toBe(mockAdminJs);
      expect(mockEnv.AGENT_CONFIG.get).toHaveBeenCalledWith('admin:js', { type: 'text' });
    });

    test('should return error message when admin.js not in KV', async () => {
      mockEnv.AGENT_CONFIG.get.mockResolvedValue(null);
      
      const response = await handleAdminJs(mockEnv);
      const js = await response.text();
      
      expect(response.status).toBe(503);
      expect(response.headers.get('Content-Type')).toBe('application/javascript');
      expect(js).toContain('Admin JavaScript not deployed');
      expect(js).toContain('wrangler kv key put');
    });

    test('should handle KV storage errors gracefully', async () => {
      mockEnv.AGENT_CONFIG.get.mockRejectedValue(new Error('KV error'));
      
      const response = await handleAdminJs(mockEnv);
      const js = await response.text();
      
      expect(response.status).toBe(503);
      expect(js).toContain('Admin JavaScript not deployed');
    });
  });
});