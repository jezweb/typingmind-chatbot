-- Agents table
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  api_key TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Allowed domains table
CREATE TABLE IF NOT EXISTS agent_domains (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  UNIQUE(agent_id, domain)
);

-- Allowed paths table (optional)
CREATE TABLE IF NOT EXISTS agent_paths (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT NOT NULL,
  path TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  UNIQUE(agent_id, path)
);

-- Rate limits table
CREATE TABLE IF NOT EXISTS agent_rate_limits (
  agent_id TEXT PRIMARY KEY,
  messages_per_hour INTEGER DEFAULT 100,
  messages_per_session INTEGER DEFAULT 30,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

-- Features table
CREATE TABLE IF NOT EXISTS agent_features (
  agent_id TEXT PRIMARY KEY,
  image_upload BOOLEAN DEFAULT 0,
  markdown BOOLEAN DEFAULT 1,
  persist_session BOOLEAN DEFAULT 0,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

-- Theme table
CREATE TABLE IF NOT EXISTS agent_themes (
  agent_id TEXT PRIMARY KEY,
  primary_color TEXT DEFAULT '#007bff',
  position TEXT DEFAULT 'bottom-right',
  width INTEGER DEFAULT 380,
  embed_mode TEXT DEFAULT 'popup',
  font_family TEXT,
  border_radius TEXT DEFAULT '8px',
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_agent_domains_agent_id ON agent_domains(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_paths_agent_id ON agent_paths(agent_id);

-- Insert our test agent
INSERT INTO agents (id, name, api_key) VALUES (
  'character-c4d6907a-b76b-4729-b444-b2ba06d55133',
  'SEO Assistant Bot',
  NULL
);

INSERT INTO agent_domains (agent_id, domain) VALUES
  ('character-c4d6907a-b76b-4729-b444-b2ba06d55133', 'newcastleseo.com.au'),
  ('character-c4d6907a-b76b-4729-b444-b2ba06d55133', '*.newcastleseo.com.au');

INSERT INTO agent_rate_limits (agent_id, messages_per_hour, messages_per_session) VALUES
  ('character-c4d6907a-b76b-4729-b444-b2ba06d55133', 100, 30);

INSERT INTO agent_features (agent_id, image_upload, markdown, persist_session) VALUES
  ('character-c4d6907a-b76b-4729-b444-b2ba06d55133', 0, 1, 0);

INSERT INTO agent_themes (agent_id, primary_color, position) VALUES
  ('character-c4d6907a-b76b-4729-b444-b2ba06d55133', '#007bff', 'bottom-right');