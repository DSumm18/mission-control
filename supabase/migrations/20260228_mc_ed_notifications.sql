-- Ed Notifications table
-- Centralized notification system for Ed → David communication
-- Delivered via Telegram (audible) and web PWA (visual badge)

CREATE TABLE IF NOT EXISTS mc_ed_notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  body            TEXT,
  category        TEXT NOT NULL DEFAULT 'info'
                  CHECK (category IN ('job_complete','job_failed','decision_needed',
                         'approval_needed','deploy_ready','alert','info','reminder')),
  priority        TEXT NOT NULL DEFAULT 'normal'
                  CHECK (priority IN ('low','normal','high','urgent')),
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','delivered','acknowledged','dismissed','expired')),
  source_type     TEXT,
  source_id       UUID,
  delivered_via   TEXT[],
  delivered_at    TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  metadata        JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fast lookup for pending/delivered notifications
CREATE INDEX idx_ed_notif_pending ON mc_ed_notifications (status, priority DESC, created_at DESC)
  WHERE status IN ('pending', 'delivered');

-- RLS
ALTER TABLE mc_ed_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on mc_ed_notifications" ON mc_ed_notifications;
CREATE POLICY "Service role full access on mc_ed_notifications"
  ON mc_ed_notifications FOR ALL
  USING (true)
  WITH CHECK (true);
