/**
 * Tests for admin routes module
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';

// Create mock functions before importing modules
const mockValidateAdminSession = jest.fn();
const mockCreateAdminSession = jest.fn();
const mockDeleteAdminSession = jest.fn();
const mockValidatePassword = jest.fn();
const mockExtractSessionId = jest.fn();
const mockCreateLogoutCookie = jest.fn(() => 'admin_session=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict');
const mockCreateUnauthorizedRedirect = jest.fn(() => new Response(null, { 
  status: 302, 
  headers: { Location: '/admin' } 
}));
const mockCreateUnauthorizedResponse = jest.fn(() => new Response('Unauthorized', { status: 401 }));
const mockSecurityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block'
};
const mockLoginPage = jest.fn();
const mockDashboardPage = jest.fn();
const mockGetAllInstances = jest.fn();

// Mock modules before imports
jest.unstable_mockModule('../auth.js', () => ({
  validateAdminSession: mockValidateAdminSession,
  extractSessionId: mockExtractSessionId,
  createAdminSession: mockCreateAdminSession,
  deleteAdminSession: mockDeleteAdminSession,
  createLogoutCookie: mockCreateLogoutCookie,
  validatePassword: mockValidatePassword,
  createUnauthorizedRedirect: mockCreateUnauthorizedRedirect,
  createUnauthorizedResponse: mockCreateUnauthorizedResponse
}));

jest.unstable_mockModule('../security.js', () => ({
  securityHeaders: mockSecurityHeaders,
  validateInstanceId: jest.fn((id) => /^[a-z0-9-]+$/.test(id)),
  createResponseHeaders: jest.fn(() => ({ 'Content-Type': 'application/json' }))
}));

jest.unstable_mockModule('../database.js', () => ({
  getAllInstances: mockGetAllInstances,
  getInstanceById: jest.fn(),
  createInstance: jest.fn(),
  updateInstance: jest.fn(),
  deleteInstance: jest.fn(),
  cloneInstance: jest.fn()
}));

jest.unstable_mockModule('../templates/admin-pages.js', () => ({
  loginPage: mockLoginPage,
  dashboardPage: mockDashboardPage
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
      ADMIN_SESSIONS: {}
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
      mockRequest.json.mockResolvedValue({ password: 'test-password' });
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
      expect(response.headers.get('Set-Cookie')).toContain('admin_session=session-123');
      expect(mockValidatePassword).toHaveBeenCalledWith('test-password', 'test-password');
      expect(mockCreateAdminSession).toHaveBeenCalledWith(mockEnv, '192.168.1.1');
    });

    test('should reject invalid password', async () => {
      mockRequest.json.mockResolvedValue({ password: 'wrong-password' });
      
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
      mockRequest.json.mockRejectedValue(new Error('JSON parse error'));
      
      const response = await handleAdminLogin(mockRequest, mockEnv);
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.error).toBe('Login failed');
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
      expect(mockDeleteAdminSession).toHaveBeenCalledWith(mockEnv, null);
    });
  });

  describe('handleAdminDashboard', () => {
    test('should return dashboard for valid session', async () => {
      mockRequest.headers.get.mockImplementation((name) => {
        if (name === 'Cookie') return 'admin_session=session-123';
        return null;
      });
      
      mockExtractSessionId.mockReturnValue('session-123');
      mockValidateAdminSession.mockResolvedValue(true);
      
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
      expect(mockValidateAdminSession).toHaveBeenCalledWith(mockRequest, mockEnv);
      expect(mockDashboardPage).toHaveBeenCalledWith(mockInstances);
    });

    test('should return unauthorized for invalid session', async () => {
      mockRequest.headers.get.mockImplementation((name) => {
        if (name === 'Cookie') return 'admin_session=invalid';
        return null;
      });
      
      mockExtractSessionId.mockReturnValue('invalid');
      mockValidateAdminSession.mockResolvedValue(false);
      
      const response = await handleAdminDashboard(mockRequest, mockEnv);
      
      expect(response.status).toBe(302); // redirect to login
      expect(mockGetAllInstances).not.toHaveBeenCalled();
    });

    test('should handle database errors', async () => {
      mockRequest.headers.get.mockImplementation((name) => {
        if (name === 'Cookie') return 'admin_session=session-123';
        return null;
      });
      
      mockExtractSessionId.mockReturnValue('session-123');
      mockValidateAdminSession.mockResolvedValue(true);
      mockGetAllInstances.mockRejectedValue(new Error('DB error'));
      
      await expect(handleAdminDashboard(mockRequest, mockEnv)).rejects.toThrow('DB error');
    });
  });

  describe('handleAdminJs', () => {
    test('should return admin JavaScript content', async () => {
      const response = handleAdminJs();
      const js = await response.text();
      
      expect(response.headers.get('Content-Type')).toBe('application/javascript');
      expect(js).toContain('async function apiCall');
      expect(js).toContain('async function logout()');
      expect(js).toContain('async function deleteInstance(id)');
      expect(js).toContain('async function cloneInstance(id)');
      expect(js).toContain('function copyWidgetCode(button)');
    });

    test('should include all required functions', async () => {
      const response = handleAdminJs();
      const js = await response.text();
      
      // Check for all main functions
      const functions = [
        'apiCall',
        'logout',
        'deleteInstance',
        'cloneInstance',
        'copyWidgetCode',
        'createInstance',
        'editInstance'
      ];
      
      functions.forEach(func => {
        expect(js).toContain(`function ${func}`);
      });
    });
  });
});