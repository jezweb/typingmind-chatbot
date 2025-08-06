/**
 * Tests for admin layout templates
 */

import { describe, test, expect } from '@jest/globals';
import { adminLayout, formLayout } from './admin-layout.js';

describe('Admin Layout Templates', () => {
  describe('adminLayout', () => {
    test('should generate basic admin layout with title and content', () => {
      const html = adminLayout({
        title: 'Test Page',
        content: '<div>Test Content</div>'
      });

      expect(html).toContain('<title>Test Page - TypingMind Chatbot</title>');
      expect(html).toContain('<div>Test Content</div>');
      expect(html).toContain('<script src="/admin/admin.js"></script>');
    });

    test('should exclude admin.js when includeAdminJs is false', () => {
      const html = adminLayout({
        title: 'Test Page',
        content: '<div>Test Content</div>',
        includeAdminJs: false
      });

      expect(html).not.toContain('<script src="/admin/admin.js"></script>');
    });

    test('should include additional styles when provided', () => {
      const html = adminLayout({
        title: 'Test Page',
        content: '<div>Test Content</div>',
        styles: '.custom { color: red; }'
      });

      expect(html).toContain('.custom { color: red; }');
    });
  });

  describe('formLayout', () => {
    test('should generate form layout with all required parameters', () => {
      const html = formLayout({
        title: 'Test Form',
        heading: 'Test Form Heading',
        formContent: '<input type="text" name="test">',
        formId: 'test-form',
        submitText: 'Submit Test'
      });

      expect(html).toContain('<title>Test Form - TypingMind Chatbot</title>');
      expect(html).toContain('<h1>Test Form Heading</h1>');
      expect(html).toContain('id="test-form"');
      expect(html).toContain('<input type="text" name="test">');
      expect(html).toContain('>Submit Test</button>');
    });

    test('should use default cancel URL when not provided', () => {
      const html = formLayout({
        title: 'Test Form',
        heading: 'Test Form Heading',
        formContent: '<input>',
        formId: 'test-form',
        submitText: 'Submit'
      });

      expect(html).toContain('href="/admin/dashboard"');
    });

    test('should use custom cancel URL when provided', () => {
      const html = formLayout({
        title: 'Test Form',
        heading: 'Test Form Heading',
        formContent: '<input>',
        formId: 'test-form',
        submitText: 'Submit',
        cancelUrl: '/admin/custom'
      });

      expect(html).toContain('href="/admin/custom"');
    });
  });
});