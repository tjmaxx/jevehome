-- Agent chat tables for the Jeve Home AI assistant widget
-- Stores conversation threads and individual messages per authenticated user

CREATE TABLE IF NOT EXISTS agent_conversations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID NOT NULL REFERENCES agent_conversations(id) ON DELETE CASCADE,
  role             TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content          TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast message lookups by conversation
CREATE INDEX IF NOT EXISTS agent_messages_conversation_id_idx
  ON agent_messages (conversation_id, created_at);

-- Index for fast conversation lookups by user
CREATE INDEX IF NOT EXISTS agent_conversations_user_id_idx
  ON agent_conversations (user_id, updated_at DESC);

-- Row-Level Security: each user only sees their own data
ALTER TABLE agent_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_messages      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can manage their own conversations"
  ON agent_conversations
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users can manage their own messages"
  ON agent_messages
  FOR ALL
  USING (
    conversation_id IN (
      SELECT id FROM agent_conversations WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    conversation_id IN (
      SELECT id FROM agent_conversations WHERE user_id = auth.uid()
    )
  );

-- Trigger to keep updated_at current on agent_conversations
CREATE OR REPLACE FUNCTION update_agent_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER agent_conversations_updated_at
  BEFORE UPDATE ON agent_conversations
  FOR EACH ROW EXECUTE FUNCTION update_agent_conversation_timestamp();
