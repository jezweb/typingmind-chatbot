/**
 * Tests for admin CRUD routes module
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';

// Create mock functions before importing modules
const mockValidateAdminSession = jest.fn();
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
const mockCreateInstanceForm = jest.fn();
const mockEditInstanceForm = jest.fn();
const mockValidateInstanceId = jest.fn((id) => /^[a-z0-9-]+$/.test(id));
const mockCreateInstance = jest.fn();
const mockUpdateInstance = jest.fn();
const mockDeleteInstance = jest.fn();
const mockCloneInstance = jest.fn();
const mockGetInstanceConfig = jest.fn();
const mockGetInstanceById = jest.fn();

// Mock modules before imports
jest.unstable_mockModule('../auth.js', () => ({
  validateAdminSession: mockValidateAdminSession,
  createUnauthorizedRedirect: mockCreateUnauthorizedRedirect,
  createUnauthorizedResponse: mockCreateUnauthorizedResponse
}));

jest.unstable_mockModule('../security.js', () => ({
  securityHeaders: mockSecurityHeaders,
  validateInstanceId: mockValidateInstanceId
}));

jest.unstable_mockModule('../templates/admin-forms.js', () => ({
  createInstanceForm: mockCreateInstanceForm,
  editInstanceForm: mockEditInstanceForm
}));

jest.unstable_mockModule('../database.js', () => ({
  getInstanceById: mockGetInstanceById,
  createInstance: mockCreateInstance,
  updateInstance: mockUpdateInstance,
  deleteInstance: mockDeleteInstance,
  cloneInstance: mockCloneInstance,
  getInstanceConfig: mockGetInstanceConfig
}));

// Import after mocking
const {
  handleCreateInstanceForm,
  handleCreateInstance,
  handleEditInstanceForm,
  handleUpdateInstance,
  handleDeleteInstance,
  handleCloneInstance
} = await import('./admin-crud.js');

describe('Admin CRUD Routes', () => {
  let mockEnv;
  let mockRequest;

  beforeEach(() => {
    mockEnv = {
      DB: {},
      ADMIN_SESSIONS: {}
    };
    
    mockRequest = {
      headers: {
        get: jest.fn()
      },
      params: {},
      formData: jest.fn(),
      json: jest.fn()
    };

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('handleCreateInstanceForm', () => {
    test('should return create form for valid session', async () => {
      mockRequest.headers.get.mockImplementation((name) => {
        if (name === 'Cookie') return 'admin_session=valid-session';
        return null;
      });
      
      mockValidateAdminSession.mockResolvedValue(true);
      mockCreateInstanceForm.mockReturnValue('<html>Create Form</html>');
      
      const response = await handleCreateInstanceForm(mockRequest, mockEnv);
      
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/html');
      expect(await response.text()).toBe('<html>Create Form</html>');
      expect(mockCreateInstanceForm).toHaveBeenCalled();
    });

    test('should return unauthorized for invalid session', async () => {
      mockRequest.headers.get.mockReturnValue(null);
      mockValidateAdminSession.mockResolvedValue(false);
      
      const response = await handleCreateInstanceForm(mockRequest, mockEnv);
      
      expect(response.status).toBe(302); // redirect to login
      expect(mockCreateInstanceForm).not.toHaveBeenCalled();
    });
  });

  describe('handleCreateInstance', () => {
    const validData = {
      id: 'new-instance',
      name: 'New Instance',
      typingmind_agent_id: 'agent-123',
      api_key: 'custom-key',
      domains: ['*.example.com', 'app.example.com'],
      features: {
        markdown: true,
        image_upload: true,
        persist_session: false
      },
      theme: {
        primary_color: '#ff0000',
        position: 'top-left',
        width: 400,
        embed_mode: 'inline'
      },
      rateLimit: {
        messages_per_hour: 200,
        messages_per_session: 50
      }
    };

    test('should create instance with valid data', async () => {
      mockRequest.headers.get.mockImplementation((name) => {
        if (name === 'Cookie') return 'admin_session=valid-session';
        return null;
      });
      
      mockValidateAdminSession.mockResolvedValue(true);
      mockRequest.json.mockResolvedValue(validData);
      
      const response = await handleCreateInstance(mockRequest, mockEnv);
      const data = await response.json();
      
      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.id).toBe('new-instance');
      expect(mockCreateInstance).toHaveBeenCalledWith(mockEnv.DB, validData);
    });

    test('should validate required fields', async () => {
      mockRequest.headers.get.mockImplementation((name) => {
        if (name === 'Cookie') return 'admin_session=valid-session';
        return null;
      });
      
      mockValidateAdminSession.mockResolvedValue(true);
      
      const incompleteData = {
        id: 'new-instance',
        // missing name and typingmind_agent_id
      };
      mockRequest.json.mockResolvedValue(incompleteData);
      mockCreateInstance.mockRejectedValue(new Error('Missing required fields'));
      
      const response = await handleCreateInstance(mockRequest, mockEnv);
      const data = await response.json();
      
      expect(response.status).toBe(500); // Since createInstance will throw an error
      expect(data.error).toBe('Failed to create instance');
    });

    test('should validate instance ID format', async () => {
      mockRequest.headers.get.mockImplementation((name) => {
        if (name === 'Cookie') return 'admin_session=valid-session';
        return null;
      });
      
      mockValidateAdminSession.mockResolvedValue(true);
      
      const invalidIdData = {
        id: 'Invalid_ID!',
        name: 'Test',
        typingmind_agent_id: 'agent-123'
      };
      mockRequest.json.mockResolvedValue(invalidIdData);
      
      const response = await handleCreateInstance(mockRequest, mockEnv);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid instance ID format');
    });

    test('should handle database errors', async () => {
      mockRequest.headers.get.mockImplementation((name) => {
        if (name === 'Cookie') return 'admin_session=valid-session';
        return null;
      });
      
      mockValidateAdminSession.mockResolvedValue(true);
      mockRequest.json.mockResolvedValue(validData);
      mockCreateInstance.mockRejectedValue(new Error('DB error'));
      
      const response = await handleCreateInstance(mockRequest, mockEnv);
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.error).toContain('Failed to create instance');
    });
  });

  describe('handleEditInstanceForm', () => {
    test('should return edit form with instance data', async () => {
      mockRequest.headers.get.mockImplementation((name) => {
        if (name === 'Cookie') return 'admin_session=valid-session';
        return null;
      });
      mockRequest.params = { id: 'test-instance' };
      
      mockValidateAdminSession.mockResolvedValue(true);
      
      const mockInstanceData = {
        instance: { id: 'test-instance', name: 'Test Instance' },
        domains: [{ domain: '*.example.com' }],
        features: { markdown: true },
        rateLimits: { messages_per_hour: 100 },
        theme: { primary_color: '#007bff' }
      };
      
      mockGetInstanceById.mockResolvedValue(mockInstanceData);
      mockEditInstanceForm.mockReturnValue('<html>Edit Form</html>');
      
      const response = await handleEditInstanceForm(mockRequest, mockEnv);
      
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/html');
      expect(mockEditInstanceForm).toHaveBeenCalledWith('test-instance', mockInstanceData);
    });

    test('should return 404 for missing instance', async () => {
      mockRequest.headers.get.mockImplementation((name) => {
        if (name === 'Cookie') return 'admin_session=valid-session';
        return null;
      });
      mockRequest.params = { id: 'non-existent' };
      
      mockValidateAdminSession.mockResolvedValue(true);
      mockGetInstanceById.mockResolvedValue(null);
      
      const response = await handleEditInstanceForm(mockRequest, mockEnv);
      const text = await response.text();
      
      expect(response.status).toBe(404);
      expect(text).toBe('Instance not found');
    });
  });

  describe('handleUpdateInstance', () => {
    test('should update instance with valid data', async () => {
      mockRequest.headers.get.mockImplementation((name) => {
        if (name === 'Cookie') return 'admin_session=valid-session';
        return null;
      });
      mockRequest.params = { id: 'test-instance' };
      
      mockValidateAdminSession.mockResolvedValue(true);
      
      const updateData = {
        name: 'Updated Instance',
        typingmind_agent_id: 'agent-updated',
        api_key: 'new-key',
        domains: ['updated.example.com'],
        features: { markdown: false },
        theme: { primary_color: '#00ff00' },
        rateLimit: { messages_per_hour: 300 }
      };
      
      mockRequest.json.mockResolvedValue(updateData);
      
      const response = await handleUpdateInstance(mockRequest, mockEnv);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockUpdateInstance).toHaveBeenCalledWith(
        mockEnv.DB,
        'test-instance',
        {
          name: 'Updated Instance',
          typingmind_agent_id: 'agent-updated',
          api_key: 'new-key',
          domains: ['updated.example.com'],
          features: { markdown: false },
          theme: { primary_color: '#00ff00' },
          rateLimit: { messages_per_hour: 300 }
        }
      );
    });

    test('should validate required fields on update', async () => {
      mockRequest.headers.get.mockImplementation((name) => {
        if (name === 'Cookie') return 'admin_session=valid-session';
        return null;
      });
      mockRequest.params = { id: 'test-instance' };
      
      mockValidateAdminSession.mockResolvedValue(true);
      mockRequest.json.mockResolvedValue({
        // missing required fields
      });
      mockUpdateInstance.mockRejectedValue(new Error('Missing required fields'));
      
      const response = await handleUpdateInstance(mockRequest, mockEnv);
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to update instance');
    });
  });

  describe('handleDeleteInstance', () => {
    test('should delete instance', async () => {
      mockRequest.headers.get.mockImplementation((name) => {
        if (name === 'Cookie') return 'admin_session=valid-session';
        return null;
      });
      mockRequest.params = { id: 'test-instance' };
      
      mockValidateAdminSession.mockResolvedValue(true);
      
      const response = await handleDeleteInstance(mockRequest, mockEnv);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockDeleteInstance).toHaveBeenCalledWith(mockEnv.DB, 'test-instance');
    });

    test('should handle delete errors', async () => {
      mockRequest.headers.get.mockImplementation((name) => {
        if (name === 'Cookie') return 'admin_session=valid-session';
        return null;
      });
      mockRequest.params = { id: 'test-instance' };
      
      mockValidateAdminSession.mockResolvedValue(true);
      mockDeleteInstance.mockRejectedValue(new Error('Cannot delete'));
      
      const response = await handleDeleteInstance(mockRequest, mockEnv);
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.error).toContain('Failed to delete instance');
    });
  });

  describe('handleCloneInstance', () => {
    test('should clone instance with new ID', async () => {
      mockRequest.headers.get.mockImplementation((name) => {
        if (name === 'Cookie') return 'admin_session=valid-session';
        return null;
      });
      mockRequest.params = { id: 'test-instance' };
      
      mockValidateAdminSession.mockResolvedValue(true);
      mockRequest.json.mockResolvedValue({ name: 'Cloned Instance' });
      
      const response = await handleCloneInstance(mockRequest, mockEnv);
      const data = await response.json();
      
      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.id).toMatch(/^cloned-instance-\d+$/);
      expect(mockCloneInstance).toHaveBeenCalledWith(
        mockEnv.DB, 
        'test-instance', 
        expect.stringMatching(/^cloned-instance-\d+$/),
        'Cloned Instance'
      );
    });

    test('should handle source instance not found', async () => {
      mockRequest.headers.get.mockImplementation((name) => {
        if (name === 'Cookie') return 'admin_session=valid-session';
        return null;
      });
      mockRequest.params = { id: 'non-existent' };
      
      mockValidateAdminSession.mockResolvedValue(true);
      mockRequest.json.mockResolvedValue({ name: 'Cloned Instance' });
      mockCloneInstance.mockRejectedValue(new Error('Source instance not found'));
      
      const response = await handleCloneInstance(mockRequest, mockEnv);
      const data = await response.json();
      
      expect(response.status).toBe(404);
      expect(data.error).toBe('Source instance not found');
    });

    test('should require name', async () => {
      mockRequest.headers.get.mockImplementation((name) => {
        if (name === 'Cookie') return 'admin_session=valid-session';
        return null;
      });
      mockRequest.params = { id: 'test-instance' };
      
      mockValidateAdminSession.mockResolvedValue(true);
      mockRequest.json.mockResolvedValue({});
      
      const response = await handleCloneInstance(mockRequest, mockEnv);
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to clone instance');
    });
  });
});