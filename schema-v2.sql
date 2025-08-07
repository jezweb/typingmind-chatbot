-- TypingMind Chatbot Multi-Instance Schema v2
-- This schema supports multiple instances of the same TypingMind agent

-- Drop existing tables if doing a fresh install
-- DROP TABLE IF EXISTS agent_themes;
-- DROP TABLE IF EXISTS agent_features;
-- DROP TABLE IF EXISTS agent_rate_limits;
-- DROP TABLE IF EXISTS agent_paths;
-- DROP TABLE IF EXISTS agent_domains;
-- DROP TABLE IF EXISTS agents;

-- Agents/Instances table
CREATE TABLE IF NOT EXISTS agent_instances (
  id TEXT PRIMARY KEY, -- Our unique instance ID
  typingmind_agent_id TEXT NOT NULL, -- The actual TypingMind agent ID
  name TEXT NOT NULL, -- Instance display name
  api_key TEXT, -- Optional instance-specific API key
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Allowed domains table
CREATE TABLE IF NOT EXISTS instance_domains (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  instance_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (instance_id) REFERENCES agent_instances(id) ON DELETE CASCADE,
  UNIQUE(instance_id, domain)
);

-- Allowed paths table (optional)
CREATE TABLE IF NOT EXISTS instance_paths (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  instance_id TEXT NOT NULL,
  path TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (instance_id) REFERENCES agent_instances(id) ON DELETE CASCADE,
  UNIQUE(instance_id, path)
);

-- Rate limits table
CREATE TABLE IF NOT EXISTS instance_rate_limits (
  instance_id TEXT PRIMARY KEY,
  messages_per_hour INTEGER DEFAULT 100,
  messages_per_session INTEGER DEFAULT 30,
  FOREIGN KEY (instance_id) REFERENCES agent_instances(id) ON DELETE CASCADE
);

-- Features table
CREATE TABLE IF NOT EXISTS instance_features (
  instance_id TEXT PRIMARY KEY,
  image_upload BOOLEAN DEFAULT 0,
  markdown BOOLEAN DEFAULT 1,
  persist_session BOOLEAN DEFAULT 0,
  FOREIGN KEY (instance_id) REFERENCES agent_instances(id) ON DELETE CASCADE
);

-- Theme table
CREATE TABLE IF NOT EXISTS instance_themes (
  instance_id TEXT PRIMARY KEY,
  primary_color TEXT DEFAULT '#007bff',
  position TEXT DEFAULT 'bottom-right',
  width INTEGER DEFAULT 380,
  embed_mode TEXT DEFAULT 'popup',
  font_family TEXT,
  border_radius TEXT DEFAULT '8px',
  FOREIGN KEY (instance_id) REFERENCES agent_instances(id) ON DELETE CASCADE
);

-- Welcome messages table
CREATE TABLE IF NOT EXISTS instance_welcome_messages (
  instance_id TEXT PRIMARY KEY,
  welcome_message TEXT DEFAULT 'Hello! How can I help you today?',
  show_on_new_session BOOLEAN DEFAULT 1,
  show_on_return BOOLEAN DEFAULT 0,
  FOREIGN KEY (instance_id) REFERENCES agent_instances(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_instance_domains_instance_id ON instance_domains(instance_id);
CREATE INDEX IF NOT EXISTS idx_instance_paths_instance_id ON instance_paths(instance_id);
CREATE INDEX IF NOT EXISTS idx_typingmind_agent_id ON agent_instances(typingmind_agent_id);

-- Insert example instances
-- SEO Bot for Newcastle (main site)
INSERT INTO agent_instances (id, typingmind_agent_id, name, api_key) VALUES (
  'seo-bot-newcastle',
  'character-c4d6907a-b76b-4729-b444-b2ba06d55133', -- Replace with actual TypingMind agent ID
  'SEO Assistant Bot - Newcastle',
  NULL
);

-- SEO Bot for blog section (same agent, different config)
INSERT INTO agent_instances (id, typingmind_agent_id, name, api_key) VALUES (
  'seo-bot-blog',
  'character-c4d6907a-b76b-4729-b444-b2ba06d55133', -- Same TypingMind agent
  'SEO Assistant Bot - Blog',
  NULL
);

-- Brand Discovery Bot (different agent)
INSERT INTO agent_instances (id, typingmind_agent_id, name, api_key) VALUES (
  'brand-discovery-embed',
  'character-97e8c8f5-0c6d-47f6-88ca-a44d16f1b5de', -- Different TypingMind agent
  'Brand Discovery Agent (Embed)',
  NULL
);

-- Set up domains for each instance
INSERT INTO instance_domains (instance_id, domain) VALUES
  ('seo-bot-newcastle', 'newcastleseo.com.au'),
  ('seo-bot-newcastle', '*.newcastleseo.com.au'),
  ('seo-bot-blog', 'blog.newcastleseo.com.au'),
  ('brand-discovery-embed', '*'); -- Allow all domains for testing

-- Set up rate limits
INSERT INTO instance_rate_limits (instance_id, messages_per_hour, messages_per_session) VALUES
  ('seo-bot-newcastle', 100, 30),
  ('seo-bot-blog', 200, 50), -- Higher limits for blog
  ('brand-discovery-embed', 100, 30);

-- Set up features
INSERT INTO instance_features (instance_id, image_upload, markdown, persist_session) VALUES
  ('seo-bot-newcastle', 0, 1, 1),
  ('seo-bot-blog', 1, 1, 1), -- Image upload enabled for blog
  ('brand-discovery-embed', 0, 1, 0);

-- Set up themes
INSERT INTO instance_themes (instance_id, primary_color, position, width, embed_mode) VALUES
  ('seo-bot-newcastle', '#007bff', 'bottom-right', 380, 'popup'),
  ('seo-bot-blog', '#28a745', 'bottom-left', 400, 'popup'), -- Different color and position
  ('brand-discovery-embed', '#007bff', 'bottom-right', 600, 'inline');

-- Set up welcome messages
INSERT INTO instance_welcome_messages (instance_id, welcome_message, show_on_new_session, show_on_return) VALUES
  ('seo-bot-newcastle', 'Welcome to Newcastle SEO! I''m here to help you optimize your website for search engines. What can I assist you with today?', 1, 0),
  ('seo-bot-blog', 'Hi there! I''m your SEO blog assistant. Ask me anything about content optimization, keyword research, or SEO best practices!', 1, 0),
  ('brand-discovery-embed', 'Welcome! I''m the Brand Discovery Agent. Let me help you explore and develop your brand identity.', 1, 0);