-- Ed Chat: conversations + messages for the web-based Ed chat panel

-- Conversations
CREATE TABLE mc_ed_conversations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL DEFAULT 'New conversation',
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ed_conv_active ON mc_ed_conversations (is_active, updated_at DESC);

-- Messages
CREATE TABLE mc_ed_messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID NOT NULL REFERENCES mc_ed_conversations(id) ON DELETE CASCADE,
  role             TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content          TEXT NOT NULL,
  actions_taken    JSONB DEFAULT '[]'::jsonb,
  metadata         JSONB DEFAULT '{}'::jsonb,
  model_used       TEXT,
  tokens_used      INTEGER,
  duration_ms      INTEGER,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ed_msg_conv ON mc_ed_messages (conversation_id, created_at);

-- Auto-update updated_at on conversations when messages arrive
CREATE OR REPLACE FUNCTION update_ed_conversation_ts()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE mc_ed_conversations SET updated_at = now() WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ed_msg_update_conv
  AFTER INSERT ON mc_ed_messages
  FOR EACH ROW EXECUTE FUNCTION update_ed_conversation_ts();

-- RLS
ALTER TABLE mc_ed_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE mc_ed_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_ed_conversations" ON mc_ed_conversations;
CREATE POLICY "service_role_ed_conversations" ON mc_ed_conversations
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_ed_messages" ON mc_ed_messages;
CREATE POLICY "service_role_ed_messages" ON mc_ed_messages
  FOR ALL USING (true) WITH CHECK (true);
