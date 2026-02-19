-- Agent configuration table — admin-configurable settings for the chat widget.
-- Stores all agent settings as key-value pairs, readable by any authenticated user,
-- writable by any authenticated user (admin enforcement happens at the UI layer
-- in admin.html, matching the existing pattern used for site_config).

CREATE TABLE IF NOT EXISTS agent_config (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger to auto-update updated_at on changes
CREATE OR REPLACE FUNCTION update_agent_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER agent_config_updated_at
  BEFORE UPDATE ON agent_config
  FOR EACH ROW EXECUTE FUNCTION update_agent_config_timestamp();

-- Seed default configuration values
INSERT INTO agent_config (key, value) VALUES
  ('model',
   'gemini-2.5-flash-lite'),

  ('system_prompt',
   ''),

  ('welcome_message',
   'Hi! I''m your personal assistant for this site. Ask me anything about Jia & Vickey''s journey, or just say hello ✨'),

  ('max_history',
   '20'),

  ('widget_theme',
   '{"preset":"warm","primaryColor":"#c8907e","primaryDark":"#a86f5e"}'),

  ('quick_prompts',
   '[{"label":"Tell me about 2017","prompt":"Tell me about what happened in 2017 in Jia and Vickey''s relationship"},{"label":"Share a memory","prompt":"Share a special memory or milestone from their journey together"},{"label":"What is ODOW?","prompt":"What is the One Day One Word section on this site about?"}]'),

  ('enabled_tools',
   '["timeline_context","quick_prompts","conversation_history","general_knowledge"]')

ON CONFLICT (key) DO NOTHING;  -- Don't overwrite existing config on re-run

-- Row-Level Security
ALTER TABLE agent_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users can read agent config"
  ON agent_config FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated users can write agent config"
  ON agent_config FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
