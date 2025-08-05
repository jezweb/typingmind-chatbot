-- Add embed_mode column to agent_themes table
ALTER TABLE agent_themes ADD COLUMN embed_mode TEXT DEFAULT 'popup';