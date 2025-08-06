/**
 * Tests for admin page templates
 */

import { describe, test, expect } from '@jest/globals';
import { loginPage, dashboardPage } from './admin-pages.js';

describe('Admin Page Templates', () => {
  describe('loginPage', () => {
    test('should generate login page HTML', () => {
      const html = loginPage();

      expect(html).toContain('<title>Admin Login - TypingMind Chatbot</title>');
      expect(html).toContain('<h2>Admin Login</h2>');
      expect(html).toContain('type="password"');
      expect(html).toContain('id="password"');
      expect(html).toContain('onsubmit="login(event)"');
      expect(html).toContain('JavaScript is required for admin login');
    });

    test('should include login script', () => {
      const html = loginPage();

      expect(html).toContain('async function login(e)');
      expect(html).toContain('fetch(\'/admin/login\'');
      expect(html).toContain('window.location.href = \'/admin/dashboard\'');
    });
  });

  describe('dashboardPage', () => {
    test('should generate dashboard with instances', () => {
      const instances = [
        {
          id: 'test-1',
          name: 'Test Instance 1',
          typingmind_agent_id: 'agent-1',
          domain_count: 3,
          created_at: '2023-01-01T00:00:00Z'
        },
        {
          id: 'test-2',
          name: 'Test Instance 2',
          typingmind_agent_id: 'agent-2',
          domain_count: 1,
          created_at: '2023-01-02T00:00:00Z'
        }
      ];

      const html = dashboardPage(instances);

      expect(html).toContain('<title>Admin Dashboard - TypingMind Chatbot</title>');
      expect(html).toContain('TypingMind Chatbot Admin');
      expect(html).toContain('Test Instance 1');
      expect(html).toContain('Test Instance 2');
      expect(html).toContain('<code>test-1</code>');
      expect(html).toContain('<code>test-2</code>');
      expect(html).toContain('3 domains');
      expect(html).toContain('1 domains');
    });

    test('should show no instances message when empty', () => {
      const html = dashboardPage([]);

      expect(html).toContain('No instances found');
    });

    test('should include action buttons for each instance', () => {
      const instances = [{
        id: 'test-1',
        name: 'Test Instance',
        typingmind_agent_id: 'agent-1',
        domain_count: 1,
        created_at: '2023-01-01T00:00:00Z'
      }];

      const html = dashboardPage(instances);

      expect(html).toContain('href="/admin/instances/test-1/edit"');
      expect(html).toContain('onclick="cloneInstance(\'test-1\')"');
      expect(html).toContain('onclick="deleteInstance(\'test-1\')"');
      expect(html).toContain('data-instance-id="test-1"');
    });

    test('should include logout button and create instance link', () => {
      const html = dashboardPage([]);

      expect(html).toContain('onclick="logout()"');
      expect(html).toContain('href="/admin/instances/new"');
      expect(html).toContain('Create New Instance');
    });
  });
});