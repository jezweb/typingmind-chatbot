/**
 * Database module for D1 database operations
 * Handles all instance-related database queries
 */

/**
 * Get instance configuration with all related data
 * @param {D1Database} db - D1 database instance
 * @param {string} instanceId - Instance ID to fetch
 * @returns {Promise<Object|null>} Instance configuration or null if not found
 */
export async function getInstanceConfig(db, instanceId) {
  const query = `
    SELECT 
      i.id, i.name, i.typingmind_agent_id, i.api_key,
      rl.messages_per_hour, rl.messages_per_session,
      f.image_upload, f.markdown, f.persist_session,
      t.primary_color, t.position, t.width, t.embed_mode
    FROM agent_instances i
    LEFT JOIN instance_rate_limits rl ON i.id = rl.instance_id
    LEFT JOIN instance_features f ON i.id = f.instance_id
    LEFT JOIN instance_themes t ON i.id = t.instance_id
    WHERE i.id = ?
  `;
  
  const result = await db.prepare(query).bind(instanceId).first();
  if (!result) return null;
  
  // Get allowed domains
  const domains = await db.prepare(
    'SELECT domain FROM instance_domains WHERE instance_id = ?'
  ).bind(instanceId).all();
  
  // Get allowed paths
  const paths = await db.prepare(
    'SELECT path FROM instance_paths WHERE instance_id = ?'
  ).bind(instanceId).all();
  
  return {
    id: result.id,
    name: result.name,
    typingmindAgentId: result.typingmind_agent_id,
    apiKey: result.api_key,
    allowedDomains: domains.results.map(d => d.domain),
    allowedPaths: paths.results.map(p => p.path),
    rateLimit: {
      messagesPerHour: result.messages_per_hour || 100,
      messagesPerSession: result.messages_per_session || 30
    },
    features: {
      imageUpload: !!result.image_upload,
      markdown: !!result.markdown,
      persistSession: !!result.persist_session
    },
    theme: {
      primaryColor: result.primary_color || '#007bff',
      position: result.position || 'bottom-right',
      width: result.width || 380,
      embedMode: result.embed_mode || 'popup'
    }
  };
}

/**
 * Get all instances with domain counts
 * @param {D1Database} db - D1 database instance
 * @returns {Promise<Array>} Array of instances
 */
export async function getAllInstances(db) {
  const instances = await db.prepare(`
    SELECT i.*, 
      COUNT(DISTINCT d.id) as domain_count,
      COUNT(DISTINCT p.id) as path_count
    FROM agent_instances i
    LEFT JOIN instance_domains d ON i.id = d.instance_id
    LEFT JOIN instance_paths p ON i.id = p.instance_id
    GROUP BY i.id
    ORDER BY i.created_at DESC
  `).bind().all();
  
  return instances.results;
}

/**
 * Get instance by ID with all related data
 * @param {D1Database} db - D1 database instance
 * @param {string} id - Instance ID
 * @returns {Promise<Object|null>} Instance data or null if not found
 */
export async function getInstanceById(db, id) {
  const instance = await db.prepare(`
    SELECT * FROM agent_instances WHERE id = ?
  `).bind(id).first();
  
  if (!instance) return null;
  
  // Get domains
  const domains = await db.prepare(`
    SELECT domain FROM instance_domains WHERE instance_id = ?
  `).bind(id).all();
  
  // Get features
  const features = await db.prepare(`
    SELECT * FROM instance_features WHERE instance_id = ?
  `).bind(id).first();
  
  // Get rate limits
  const rateLimits = await db.prepare(`
    SELECT * FROM instance_rate_limits WHERE instance_id = ?
  `).bind(id).first();
  
  // Get theme
  const theme = await db.prepare(`
    SELECT * FROM instance_themes WHERE instance_id = ?
  `).bind(id).first();
  
  return {
    instance,
    domains: domains.results,
    features,
    rateLimits,
    theme
  };
}

/**
 * Create a new instance with all related data
 * @param {D1Database} db - D1 database instance
 * @param {Object} data - Instance data
 * @returns {Promise<void>}
 */
export async function createInstance(db, data) {
  const statements = [];
  
  // Insert instance
  statements.push(db.prepare(
    `INSERT INTO agent_instances (id, typingmind_agent_id, name, api_key) 
     VALUES (?, ?, ?, ?)`
  ).bind(data.id, data.typingmind_agent_id, data.name, data.api_key || null));
  
  // Insert domains
  if (data.domains && data.domains.length > 0) {
    for (const domain of data.domains) {
      statements.push(db.prepare(
        `INSERT INTO instance_domains (instance_id, domain) VALUES (?, ?)`
      ).bind(data.id, domain));
    }
  }
  
  // Insert rate limits
  statements.push(db.prepare(
    `INSERT INTO instance_rate_limits (instance_id, messages_per_hour, messages_per_session) 
     VALUES (?, ?, ?)`
  ).bind(data.id, data.messages_per_hour || 100, data.messages_per_session || 30));
  
  // Insert features
  statements.push(db.prepare(
    `INSERT INTO instance_features (instance_id, image_upload, markdown, persist_session) 
     VALUES (?, ?, ?, ?)`
  ).bind(data.id, data.image_upload ? 1 : 0, data.markdown ? 1 : 0, data.persist_session ? 1 : 0));
  
  // Insert theme
  statements.push(db.prepare(
    `INSERT INTO instance_themes (instance_id, primary_color, position, width, embed_mode) 
     VALUES (?, ?, ?, ?, ?)`
  ).bind(data.id, data.primary_color || '#007bff', data.position || 'bottom-right', 
         data.width || 380, data.embed_mode || 'popup'));
  
  // Execute all statements
  await db.batch(statements);
}

/**
 * Update an existing instance with all related data
 * @param {D1Database} db - D1 database instance
 * @param {string} id - Instance ID
 * @param {Object} data - Updated instance data
 * @returns {Promise<void>}
 */
export async function updateInstance(db, id, data) {
  const statements = [];
  
  // Update main instance
  statements.push(db.prepare(`
    UPDATE agent_instances 
    SET name = ?, typingmind_agent_id = ?, api_key = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(data.name, data.typingmind_agent_id, data.api_key || null, id));
  
  // Delete existing domains and re-insert
  statements.push(db.prepare('DELETE FROM instance_domains WHERE instance_id = ?').bind(id));
  if (data.domains && data.domains.length > 0) {
    for (const domain of data.domains) {
      statements.push(db.prepare('INSERT INTO instance_domains (instance_id, domain) VALUES (?, ?)').bind(id, domain));
    }
  }
  
  // Update features
  statements.push(db.prepare(`
    INSERT OR REPLACE INTO instance_features (instance_id, markdown, image_upload, persist_session) 
    VALUES (?, ?, ?, ?)
  `).bind(id, data.markdown ? 1 : 0, data.image_upload ? 1 : 0, data.persist_session ? 1 : 0));
  
  // Update rate limits
  statements.push(db.prepare(`
    INSERT OR REPLACE INTO instance_rate_limits (instance_id, messages_per_hour, messages_per_session) 
    VALUES (?, ?, ?)
  `).bind(id, data.messages_per_hour, data.messages_per_session));
  
  // Update theme
  statements.push(db.prepare(`
    INSERT OR REPLACE INTO instance_themes (instance_id, primary_color, position, width, embed_mode) 
    VALUES (?, ?, ?, ?, ?)
  `).bind(id, data.primary_color, data.position, data.width, data.embed_mode));
  
  // Execute all statements
  await db.batch(statements);
}

/**
 * Delete an instance (cascading deletes handle related tables)
 * @param {D1Database} db - D1 database instance
 * @param {string} id - Instance ID to delete
 * @returns {Promise<void>}
 */
export async function deleteInstance(db, id) {
  await db.prepare('DELETE FROM agent_instances WHERE id = ?').bind(id).run();
}

/**
 * Clone an instance with all its settings
 * @param {D1Database} db - D1 database instance
 * @param {string} sourceId - Source instance ID
 * @param {string} newId - New instance ID
 * @param {string} name - New instance name
 * @returns {Promise<void>}
 */
export async function cloneInstance(db, sourceId, newId, name) {
  const statements = [];
  
  // Get source instance data
  const source = await db.prepare(`
    SELECT * FROM agent_instances WHERE id = ?
  `).bind(sourceId).first();
  
  if (!source) {
    throw new Error('Source instance not found');
  }
  
  // Clone instance
  statements.push(db.prepare(
    `INSERT INTO agent_instances (id, typingmind_agent_id, name, api_key) 
     VALUES (?, ?, ?, ?)`
  ).bind(newId, source.typingmind_agent_id, name, source.api_key));
  
  // Clone domains
  const domains = await db.prepare(
    'SELECT domain FROM instance_domains WHERE instance_id = ?'
  ).bind(sourceId).all();
  
  for (const domain of domains.results) {
    statements.push(db.prepare(
      `INSERT INTO instance_domains (instance_id, domain) VALUES (?, ?)`
    ).bind(newId, domain.domain));
  }
  
  // Clone rate limits
  const rateLimits = await db.prepare(
    'SELECT * FROM instance_rate_limits WHERE instance_id = ?'
  ).bind(sourceId).first();
  
  if (rateLimits) {
    statements.push(db.prepare(
      `INSERT INTO instance_rate_limits (instance_id, messages_per_hour, messages_per_session) 
       VALUES (?, ?, ?)`
    ).bind(newId, rateLimits.messages_per_hour, rateLimits.messages_per_session));
  }
  
  // Clone features
  const features = await db.prepare(
    'SELECT * FROM instance_features WHERE instance_id = ?'
  ).bind(sourceId).first();
  
  if (features) {
    statements.push(db.prepare(
      `INSERT INTO instance_features (instance_id, image_upload, markdown, persist_session) 
       VALUES (?, ?, ?, ?)`
    ).bind(newId, features.image_upload, features.markdown, features.persist_session));
  }
  
  // Clone theme
  const theme = await db.prepare(
    'SELECT * FROM instance_themes WHERE instance_id = ?'
  ).bind(sourceId).first();
  
  if (theme) {
    statements.push(db.prepare(
      `INSERT INTO instance_themes (instance_id, primary_color, position, width, embed_mode) 
       VALUES (?, ?, ?, ?, ?)`
    ).bind(newId, theme.primary_color, theme.position, theme.width, theme.embed_mode));
  }
  
  // Execute all statements
  await db.batch(statements);
}