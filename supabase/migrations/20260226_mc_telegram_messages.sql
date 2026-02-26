-- Telegram conversation history for Ed bridge
-- Messages queued by Vercel webhook, processed by local Ed bridge

CREATE TABLE IF NOT EXISTS mc_telegram_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  chat_id BIGINT NOT NULL,
  message_id INTEGER,
  from_name TEXT NOT NULL DEFAULT 'unknown',
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT,
  photo_file_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'replied', 'sent', 'error')),
  actions_taken JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  error_message TEXT
);

CREATE INDEX idx_tg_msg_status ON mc_telegram_messages(status) WHERE status = 'pending';
CREATE INDEX idx_tg_msg_chat   ON mc_telegram_messages(chat_id, created_at DESC);

ALTER TABLE mc_telegram_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on mc_telegram_messages" ON mc_telegram_messages;
CREATE POLICY "Service role full access on mc_telegram_messages"
  ON mc_telegram_messages FOR ALL USING (true) WITH CHECK (true);
