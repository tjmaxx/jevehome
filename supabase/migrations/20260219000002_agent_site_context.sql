-- Add site_context key to agent_config.
-- This field is filled in through the admin panel (never committed to GitHub)
-- and is injected into every system prompt so the agent knows about the family.

INSERT INTO agent_config (key, value)
VALUES ('site_context', '')
ON CONFLICT (key) DO NOTHING;
