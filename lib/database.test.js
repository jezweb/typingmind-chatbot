/**
 * Tests for the database module
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import {
  getInstanceConfig,
  getAllInstances,
  getInstanceById,
  createInstance,
  updateInstance,
  deleteInstance,
  cloneInstance
} from './database.js';

// Mock D1 database
function createMockDB() {
  const mockData = {
    agent_instances: [
      {
        id: 'test-instance',
        name: 'Test Instance',
        typingmind_agent_id: 'agent-123',
        api_key: 'test-key',
        created_at: '2024-01-01',
        updated_at: '2024-01-01'
      }
    ],
    instance_domains: [
      { id: 1, instance_id: 'test-instance', domain: 'example.com' },
      { id: 2, instance_id: 'test-instance', domain: '*.test.com' }
    ],
    instance_paths: [
      { id: 1, instance_id: 'test-instance', path: '/api/*' }
    ],
    instance_rate_limits: [
      { instance_id: 'test-instance', messages_per_hour: 200, messages_per_session: 50 }
    ],
    instance_features: [
      { instance_id: 'test-instance', image_upload: 1, markdown: 1, persist_session: 0 }
    ],
    instance_themes: [
      { instance_id: 'test-instance', primary_color: '#ff0000', position: 'bottom-left', width: 400, embed_mode: 'inline' }
    ]
  };

  const statements = [];

  return {
    prepare: (query) => {
      const normalizedQuery = query.toLowerCase().replace(/\s+/g, ' ').trim();
      
      return {
        bind: (...params) => {
          const boundQuery = { query: normalizedQuery, params, statements };
          
          return {
            first: async () => {
              if (normalizedQuery.includes('from agent_instances') && normalizedQuery.includes('left join')) {
                // getInstanceConfig query
                const instanceId = params[0];
                const instance = mockData.agent_instances.find(i => i.id === instanceId);
                if (!instance) return null;
                
                const rateLimits = mockData.instance_rate_limits.find(r => r.instance_id === instanceId);
                const features = mockData.instance_features.find(f => f.instance_id === instanceId);
                const theme = mockData.instance_themes.find(t => t.instance_id === instanceId);
                
                return {
                  ...instance,
                  messages_per_hour: rateLimits?.messages_per_hour,
                  messages_per_session: rateLimits?.messages_per_session,
                  image_upload: features?.image_upload,
                  markdown: features?.markdown,
                  persist_session: features?.persist_session,
                  primary_color: theme?.primary_color,
                  position: theme?.position,
                  width: theme?.width,
                  embed_mode: theme?.embed_mode
                };
              }
              
              if (normalizedQuery.includes('from agent_instances where id')) {
                const instanceId = params[0];
                return mockData.agent_instances.find(i => i.id === instanceId) || null;
              }
              
              if (normalizedQuery.includes('from instance_features')) {
                const instanceId = params[0];
                return mockData.instance_features.find(f => f.instance_id === instanceId) || null;
              }
              
              if (normalizedQuery.includes('from instance_rate_limits')) {
                const instanceId = params[0];
                return mockData.instance_rate_limits.find(r => r.instance_id === instanceId) || null;
              }
              
              if (normalizedQuery.includes('from instance_themes')) {
                const instanceId = params[0];
                return mockData.instance_themes.find(t => t.instance_id === instanceId) || null;
              }
              
              return null;
            },
            all: async () => {
              if (normalizedQuery.includes('from instance_domains')) {
                const instanceId = params[0];
                const domains = mockData.instance_domains.filter(d => d.instance_id === instanceId);
                return { results: domains };
              }
              
              if (normalizedQuery.includes('from instance_paths')) {
                const instanceId = params[0];
                const paths = mockData.instance_paths.filter(p => p.instance_id === instanceId);
                return { results: paths };
              }
              
              if (normalizedQuery.includes('count(distinct')) {
                // getAllInstances query
                return {
                  results: mockData.agent_instances.map(instance => ({
                    ...instance,
                    domain_count: mockData.instance_domains.filter(d => d.instance_id === instance.id).length,
                    path_count: mockData.instance_paths.filter(p => p.instance_id === instance.id).length
                  }))
                };
              }
              
              return { results: [] };
            },
            run: async () => {
              // For delete operations
              if (normalizedQuery.includes('delete from agent_instances')) {
                const instanceId = params[0];
                const index = mockData.agent_instances.findIndex(i => i.id === instanceId);
                if (index !== -1) {
                  mockData.agent_instances.splice(index, 1);
                }
              }
              return { success: true };
            }
          };
        }
      };
    },
    batch: async (stmts) => {
      statements.push(...stmts);
      return { success: true };
    }
  };
}

describe('Database Module', () => {
  let mockDB;

  beforeEach(() => {
    mockDB = createMockDB();
  });

  describe('getInstanceConfig', () => {
    test('should return instance configuration with all related data', async () => {
      const result = await getInstanceConfig(mockDB, 'test-instance');
      
      expect(result).toMatchObject({
        id: 'test-instance',
        name: 'Test Instance',
        typingmindAgentId: 'agent-123',
        apiKey: 'test-key',
        allowedDomains: ['example.com', '*.test.com'],
        allowedPaths: ['/api/*'],
        rateLimit: {
          messagesPerHour: 200,
          messagesPerSession: 50
        },
        features: {
          imageUpload: true,
          markdown: true,
          persistSession: false
        },
        theme: {
          primaryColor: '#ff0000',
          position: 'bottom-left',
          width: 400,
          embedMode: 'inline'
        }
      });
    });

    test('should return null for non-existent instance', async () => {
      const result = await getInstanceConfig(mockDB, 'non-existent');
      expect(result).toBeNull();
    });

    test('should use defaults for missing data', async () => {
      const emptyDB = createMockDB();
      // Override to return instance without related data
      emptyDB.prepare = (query) => ({
        bind: () => ({
          first: async () => ({ 
            id: 'test', 
            name: 'Test', 
            typingmind_agent_id: 'agent-123' 
          }),
          all: async () => ({ results: [] })
        })
      });
      
      const result = await getInstanceConfig(emptyDB, 'test');
      
      expect(result.rateLimit).toEqual({
        messagesPerHour: 100,
        messagesPerSession: 30
      });
      expect(result.theme).toEqual({
        primaryColor: '#007bff',
        position: 'bottom-right',
        width: 380,
        embedMode: 'popup'
      });
    });
  });

  describe('getAllInstances', () => {
    test('should return all instances with counts', async () => {
      const result = await getAllInstances(mockDB);
      
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'test-instance',
        name: 'Test Instance',
        domain_count: 2,
        path_count: 1
      });
    });
  });

  describe('getInstanceById', () => {
    test('should return instance with all related data', async () => {
      const result = await getInstanceById(mockDB, 'test-instance');
      
      expect(result).toMatchObject({
        instance: {
          id: 'test-instance',
          name: 'Test Instance'
        },
        domains: [
          { domain: 'example.com' },
          { domain: '*.test.com' }
        ],
        features: {
          image_upload: 1,
          markdown: 1,
          persist_session: 0
        },
        rateLimits: {
          messages_per_hour: 200,
          messages_per_session: 50
        },
        theme: {
          primary_color: '#ff0000',
          position: 'bottom-left',
          width: 400,
          embed_mode: 'inline'
        }
      });
    });

    test('should return null for non-existent instance', async () => {
      const result = await getInstanceById(mockDB, 'non-existent');
      expect(result).toBeNull();
    });
  });

  describe('createInstance', () => {
    test('should create instance with all related data', async () => {
      const statements = [];
      const trackingDB = {
        ...mockDB,
        prepare: (query) => ({
          bind: (...params) => {
            statements.push({ query, params });
            return {};
          }
        }),
        batch: async (stmts) => {
          statements.push(...stmts);
        }
      };

      const data = {
        id: 'new-instance',
        name: 'New Instance',
        typingmind_agent_id: 'agent-456',
        api_key: 'new-key',
        domains: ['new.example.com', '*.new.com'],
        messages_per_hour: 300,
        messages_per_session: 60,
        image_upload: true,
        markdown: true,
        persist_session: true,
        primary_color: '#00ff00',
        position: 'top-right',
        width: 500,
        embed_mode: 'popup'
      };

      await createInstance(trackingDB, data);
      
      // Check that all necessary statements were prepared
      expect(statements.length).toBeGreaterThan(5); // instance + domains + rate limits + features + theme
    });

    test('should use defaults for optional fields', async () => {
      const statements = [];
      const trackingDB = {
        ...mockDB,
        prepare: (query) => ({
          bind: (...params) => {
            statements.push({ query, params });
            return {};
          }
        }),
        batch: async (stmts) => {
          statements.push(...stmts);
        }
      };

      const minimalData = {
        id: 'minimal',
        name: 'Minimal Instance',
        typingmind_agent_id: 'agent-789'
      };

      await createInstance(trackingDB, minimalData);
      
      // Find rate limit statement and check defaults
      const rateLimitStmt = statements.find(s => 
        s.query.toLowerCase().includes('instance_rate_limits')
      );
      expect(rateLimitStmt.params).toContain(100); // default messages_per_hour
      expect(rateLimitStmt.params).toContain(30);  // default messages_per_session
    });
  });

  describe('updateInstance', () => {
    test('should update instance with all related data', async () => {
      const statements = [];
      const trackingDB = {
        ...mockDB,
        prepare: (query) => ({
          bind: (...params) => {
            statements.push({ query, params });
            return {};
          }
        }),
        batch: async (stmts) => {
          statements.push(...stmts);
        }
      };

      const data = {
        name: 'Updated Instance',
        typingmind_agent_id: 'agent-updated',
        api_key: 'updated-key',
        domains: ['updated.com'],
        messages_per_hour: 400,
        messages_per_session: 80,
        image_upload: false,
        markdown: true,
        persist_session: true,
        primary_color: '#0000ff',
        position: 'center',
        width: 600,
        embed_mode: 'inline'
      };

      await updateInstance(trackingDB, 'test-instance', data);
      
      // Check that update statements were prepared
      expect(statements.length).toBeGreaterThan(5);
      
      // Check that domains are deleted and re-inserted
      const deleteDomainsStmt = statements.find(s => 
        s.query.toLowerCase().includes('delete from instance_domains')
      );
      expect(deleteDomainsStmt).toBeDefined();
    });
  });

  describe('deleteInstance', () => {
    test('should delete instance', async () => {
      await deleteInstance(mockDB, 'test-instance');
      
      // Verify instance was deleted from mock data
      const result = await getInstanceById(mockDB, 'test-instance');
      expect(result).toBeNull();
    });
  });

  describe('cloneInstance', () => {
    test('should clone instance with all settings', async () => {
      const statements = [];
      const trackingDB = {
        ...mockDB,
        prepare: (query) => ({
          bind: (...params) => {
            const boundQuery = { query, params };
            statements.push(boundQuery);
            
            // Return mock data for SELECT queries
            if (query.toLowerCase().includes('select')) {
              return mockDB.prepare(query).bind(...params);
            }
            
            return boundQuery;
          }
        }),
        batch: async (stmts) => {
          statements.push(...stmts);
        }
      };

      await cloneInstance(trackingDB, 'test-instance', 'cloned-instance', 'Cloned Instance');
      
      // Verify all components were cloned
      const insertStatements = statements.filter(s => 
        s.query && s.query.toLowerCase().includes('insert')
      );
      
      // Should have inserts for: instance, domains (2), rate limits, features, theme
      expect(insertStatements.length).toBeGreaterThanOrEqual(6);
    });

    test('should throw error for non-existent source', async () => {
      await expect(
        cloneInstance(mockDB, 'non-existent', 'new-id', 'New Name')
      ).rejects.toThrow('Source instance not found');
    });
  });
});