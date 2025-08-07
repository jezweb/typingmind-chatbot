/**
 * Tests for the ConfigManager module
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { ConfigManager } from './config-manager.js';

describe('ConfigManager', () => {
  describe('constructor', () => {
    test('should initialize with default config when given minimal config', () => {
      const configManager = new ConfigManager({ instanceId: 'test-instance' });
      
      expect(configManager.get('workerUrl')).toBe('https://typingmind-chatbot.webfonts.workers.dev');
      expect(configManager.get('position')).toBe('bottom-right');
      expect(configManager.get('width')).toBe(380);
      expect(configManager.get('embedMode')).toBe('popup');
      expect(configManager.get('theme')).toEqual({});
      expect(configManager.get('agentName')).toBe('Chat Support');
      expect(configManager.get('height')).toBeNull();
      expect(configManager.get('container')).toBeNull();
    });

    test('should throw error when instanceId is missing', () => {
      expect(() => {
        new ConfigManager({});
      }).toThrow('TypingMind Chat: instanceId is required');
    });

    test('should merge user config with defaults', () => {
      const configManager = new ConfigManager({
        instanceId: 'test-instance',
        position: 'top-left',
        width: 500,
        theme: { primaryColor: '#ff0000' }
      });
      
      expect(configManager.get('position')).toBe('top-left');
      expect(configManager.get('width')).toBe(500);
      expect(configManager.get('theme')).toEqual({ primaryColor: '#ff0000' });
    });

    test('should track explicitly set values', () => {
      const configManager = new ConfigManager({
        instanceId: 'test-instance',
        position: 'top-left',
        width: 500
      });
      
      expect(configManager.isExplicitlySet('position')).toBe(true);
      expect(configManager.isExplicitlySet('width')).toBe(true);
      expect(configManager.isExplicitlySet('embedMode')).toBe(false);
      expect(configManager.isExplicitlySet('height')).toBe(false);
    });
  });

  describe('get/set methods', () => {
    let configManager;

    beforeEach(() => {
      configManager = new ConfigManager({ instanceId: 'test-instance' });
    });

    test('should get configuration values', () => {
      expect(configManager.get('instanceId')).toBe('test-instance');
      expect(configManager.get('workerUrl')).toBe('https://typingmind-chatbot.webfonts.workers.dev');
    });

    test('should set configuration values', () => {
      configManager.set('agentName', 'My Bot');
      expect(configManager.get('agentName')).toBe('My Bot');
      
      configManager.set('width', 450);
      expect(configManager.get('width')).toBe(450);
    });
  });

  describe('update method', () => {
    let configManager;

    beforeEach(() => {
      configManager = new ConfigManager({ instanceId: 'test-instance' });
    });

    test('should update multiple configuration values', () => {
      configManager.update({
        position: 'bottom-left',
        width: 600,
        theme: { primaryColor: '#28a745' }
      });
      
      expect(configManager.get('position')).toBe('bottom-left');
      expect(configManager.get('width')).toBe(600);
      expect(configManager.get('theme')).toEqual({ primaryColor: '#28a745' });
    });
  });

  describe('applyAgentInfo', () => {
    let configManager;

    beforeEach(() => {
      configManager = new ConfigManager({ instanceId: 'test-instance' });
    });

    test('should apply agent name', () => {
      configManager.applyAgentInfo({
        name: 'Custom Agent'
      });
      
      expect(configManager.get('agentName')).toBe('Custom Agent');
    });

    test('should apply theme values when not explicitly set', () => {
      configManager.applyAgentInfo({
        theme: {
          position: 'top-right',
          width: 450,
          embedMode: 'inline',
          primaryColor: '#dc3545'
        }
      });
      
      expect(configManager.get('position')).toBe('top-right');
      expect(configManager.get('width')).toBe(450);
      expect(configManager.get('embedMode')).toBe('inline');
      expect(configManager.get('theme')).toEqual({ 
        primaryColor: '#dc3545',
        position: 'top-right',
        width: 450,
        embedMode: 'inline'
      });
    });

    test('should not override explicitly set values', () => {
      // Create with explicit values
      const cm = new ConfigManager({
        instanceId: 'test-instance',
        position: 'bottom-left',
        width: 500
      });
      
      cm.applyAgentInfo({
        theme: {
          position: 'top-right',
          width: 450
        }
      });
      
      // Explicit values should be preserved
      expect(cm.get('position')).toBe('bottom-left');
      expect(cm.get('width')).toBe(500);
    });

    test('should handle missing agent info gracefully', () => {
      expect(() => {
        configManager.applyAgentInfo(null);
        configManager.applyAgentInfo(undefined);
      }).not.toThrow();
    });

    test('should merge theme properties', () => {
      configManager.set('theme', { fontFamily: 'Arial' });
      
      configManager.applyAgentInfo({
        theme: {
          primaryColor: '#007bff',
          borderRadius: '12px'
        }
      });
      
      expect(configManager.get('theme')).toEqual({
        fontFamily: 'Arial',
        primaryColor: '#007bff',
        borderRadius: '12px'
      });
    });
  });

  describe('getThemeVariables', () => {
    let configManager;

    beforeEach(() => {
      configManager = new ConfigManager({ instanceId: 'test-instance' });
    });

    test('should generate CSS variables from theme', () => {
      configManager.set('theme', {
        primaryColor: '#28a745',
        fontFamily: 'Georgia, serif',
        borderRadius: '16px'
      });
      
      const variables = configManager.getThemeVariables();
      
      expect(variables['--tm-primary-color']).toBe('#28a745');
      expect(variables['--tm-font-family']).toBe('Georgia, serif');
      expect(variables['--tm-border-radius']).toBe('16px');
    });

    test('should include width variable', () => {
      configManager.set('width', 450);
      
      const variables = configManager.getThemeVariables();
      
      expect(variables['--tm-window-width']).toBe('450px');
    });

    test('should handle empty theme', () => {
      const variables = configManager.getThemeVariables();
      
      expect(variables['--tm-window-width']).toBe('380px'); // Default width
      expect(variables['--tm-primary-color']).toBeUndefined();
      expect(variables['--tm-font-family']).toBeUndefined();
      expect(variables['--tm-border-radius']).toBeUndefined();
    });
  });

  describe('container and inline mode', () => {
    test('should accept container element', () => {
      const container = document.createElement('div');
      const configManager = new ConfigManager({
        instanceId: 'test-instance',
        container
      });
      
      expect(configManager.get('container')).toBe(container);
    });

    test('should handle embed mode configuration', () => {
      const configManager = new ConfigManager({
        instanceId: 'test-instance',
        embedMode: 'inline'
      });
      
      expect(configManager.get('embedMode')).toBe('inline');
    });

    test('should support height configuration', () => {
      const configManager = new ConfigManager({
        instanceId: 'test-instance',
        height: 600
      });
      
      expect(configManager.get('height')).toBe(600);
    });

    test('should support string height values', () => {
      const configManager = new ConfigManager({
        instanceId: 'test-instance',
        height: '80%'
      });
      
      expect(configManager.get('height')).toBe('80%');
    });
  });

  describe('callback functions', () => {
    test('should store callback functions', () => {
      const onOpen = () => {};
      const onClose = () => {};
      const onMessage = () => {};
      
      const configManager = new ConfigManager({
        instanceId: 'test-instance',
        onOpen,
        onClose,
        onMessage
      });
      
      expect(configManager.get('onOpen')).toBe(onOpen);
      expect(configManager.get('onClose')).toBe(onClose);
      expect(configManager.get('onMessage')).toBe(onMessage);
    });
  });
});