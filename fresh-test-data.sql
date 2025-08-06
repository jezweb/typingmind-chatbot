-- Fresh test data for multi-instance TypingMind chatbot
-- Replace the typingmind_agent_id values with your actual TypingMind agent IDs

-- Test instance 1: SEO Assistant Bot
INSERT INTO agent_instances (id, typingmind_agent_id, name, api_key) VALUES (
  'seo-assistant',
  'character-c4d6907a-b76b-4729-b444-b2ba06d55133', -- Replace with your actual agent ID
  'SEO Assistant Bot',
  NULL -- Uses default API key
);

-- Configure domains (allow all for testing)
INSERT INTO instance_domains (instance_id, domain) VALUES 
  ('seo-assistant', '*');

-- Configure rate limits
INSERT INTO instance_rate_limits (instance_id, messages_per_hour, messages_per_session) VALUES
  ('seo-assistant', 100, 30);

-- Configure features
INSERT INTO instance_features (instance_id, image_upload, markdown, persist_session) VALUES
  ('seo-assistant', 0, 1, 1);

-- Configure theme
INSERT INTO instance_themes (instance_id, primary_color, position, width, embed_mode) VALUES
  ('seo-assistant', '#007bff', 'bottom-right', 380, 'popup');

-- Test instance 2: Support Bot (inline mode)
INSERT INTO agent_instances (id, typingmind_agent_id, name, api_key) VALUES (
  'support-bot',
  'character-97e8c8f5-0c6d-47f6-88ca-a44d16f1b5de', -- Replace with your actual agent ID
  'Customer Support Bot',
  NULL
);

INSERT INTO instance_domains (instance_id, domain) VALUES 
  ('support-bot', '*');

INSERT INTO instance_rate_limits (instance_id, messages_per_hour, messages_per_session) VALUES
  ('support-bot', 200, 50);

INSERT INTO instance_features (instance_id, image_upload, markdown, persist_session) VALUES
  ('support-bot', 1, 1, 1);

INSERT INTO instance_themes (instance_id, primary_color, position, width, embed_mode) VALUES
  ('support-bot', '#28a745', 'bottom-right', 600, 'inline');

-- Verify the data
SELECT 
  i.id as instance_id,
  i.name,
  i.typingmind_agent_id,
  t.embed_mode,
  t.primary_color,
  t.width
FROM agent_instances i
LEFT JOIN instance_themes t ON i.id = t.instance_id
ORDER BY i.id;