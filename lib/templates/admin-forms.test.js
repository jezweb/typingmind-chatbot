/**
 * Tests for admin form templates
 */

import { describe, test, expect } from '@jest/globals';
import { createInstanceForm, editInstanceForm } from './admin-forms.js';

describe('Admin Form Templates', () => {
  describe('createInstanceForm', () => {
    test('should generate create instance form HTML', () => {
      const html = createInstanceForm();

      expect(html).toContain('<title>Create New Instance - TypingMind Chatbot</title>');
      expect(html).toContain('<h1>Create New Instance</h1>');
      expect(html).toContain('id="create-instance-form"');
    });

    test('should include all required form fields', () => {
      const html = createInstanceForm();

      // Basic fields
      expect(html).toContain('name="id"');
      expect(html).toContain('pattern="[a-z0-9-]+"');
      expect(html).toContain('name="name"');
      expect(html).toContain('name="typingmind_agent_id"');
      expect(html).toContain('name="api_key"');
      expect(html).toContain('name="domains"');

      // Feature checkboxes
      expect(html).toContain('name="markdown"');
      expect(html).toContain('name="image_upload"');
      expect(html).toContain('name="persist_session"');

      // Theme fields
      expect(html).toContain('name="primary_color"');
      expect(html).toContain('name="position"');
      expect(html).toContain('name="width"');
      expect(html).toContain('name="embed_mode"');

      // Rate limit fields
      expect(html).toContain('name="messages_per_hour"');
      expect(html).toContain('name="messages_per_session"');
    });

    test('should have default values set', () => {
      const html = createInstanceForm();

      expect(html).toContain('value="#007bff"'); // primary color
      expect(html).toContain('value="380"'); // width
      expect(html).toContain('value="100"'); // messages per hour
      expect(html).toContain('value="30"'); // messages per session
      expect(html).toContain('checked'); // markdown checkbox
    });
  });

  describe('editInstanceForm', () => {
    const mockInstanceData = {
      instance: {
        id: 'test-instance',
        name: 'Test Instance',
        typingmind_agent_id: 'agent-123',
        api_key: 'custom-key'
      },
      domains: [
        { domain: '*.example.com' },
        { domain: 'app.example.com' }
      ],
      features: {
        markdown: true,
        image_upload: false,
        persist_session: true
      },
      rateLimits: {
        messages_per_hour: 200,
        messages_per_session: 50
      },
      theme: {
        primary_color: '#ff0000',
        position: 'top-left',
        width: 450,
        embed_mode: 'inline'
      }
    };

    test('should generate edit instance form HTML', () => {
      const html = editInstanceForm('test-instance', mockInstanceData);

      expect(html).toContain('<title>Edit Instance - TypingMind Chatbot</title>');
      expect(html).toContain('<h1>Edit Instance: Test Instance</h1>');
      expect(html).toContain('id="edit-instance-form"');
      expect(html).toContain('data-instance-id="test-instance"');
    });

    test('should populate form fields with instance data', () => {
      const html = editInstanceForm('test-instance', mockInstanceData);

      // Basic fields
      expect(html).toContain('value="Test Instance"');
      expect(html).toContain('value="agent-123"');
      expect(html).toContain('value="custom-key"');
      
      // Domains
      expect(html).toContain('*.example.com\napp.example.com');

      // Rate limits
      expect(html).toContain('value="200"'); // messages per hour
      expect(html).toContain('value="50"'); // messages per session

      // Theme
      expect(html).toContain('value="#ff0000"');
      expect(html).toContain('value="450"');
    });

    test('should correctly set checkbox states', () => {
      const html = editInstanceForm('test-instance', mockInstanceData);

      // Markdown should be checked
      expect(html).toMatch(/name="markdown"\s+checked/);
      
      // Image upload should not be checked
      expect(html).toMatch(/name="image_upload"(?!\s+checked)/);
      
      // Persist session should be checked
      expect(html).toMatch(/name="persist_session"\s+checked/);
    });

    test('should correctly set select options', () => {
      const html = editInstanceForm('test-instance', mockInstanceData);

      // Position select
      expect(html).toContain('<option value="top-left" selected>Top Left</option>');
      
      // Embed mode select
      expect(html).toContain('<option value="inline" selected>Inline (Embedded)</option>');
    });

    test('should handle missing optional data', () => {
      const minimalData = {
        instance: {
          id: 'minimal',
          name: 'Minimal Instance',
          typingmind_agent_id: 'agent-min',
          api_key: null
        },
        domains: [],
        features: null,
        rateLimits: null,
        theme: null
      };

      const html = editInstanceForm('minimal', minimalData);

      // Should use default values
      expect(html).toContain('value="100"'); // default messages per hour
      expect(html).toContain('value="30"'); // default messages per session
      expect(html).toContain('value="#007bff"'); // default primary color
      expect(html).toContain('value="380"'); // default width
    });
  });
});