ALTER TABLE public.bot_settings
  ADD COLUMN IF NOT EXISTS agent_token TEXT NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', ''),
  ADD COLUMN IF NOT EXISTS agent_last_seen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS agent_version TEXT;

CREATE TABLE IF NOT EXISTS public.automation_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL CHECK (task_type IN ('send_bank_details','release_usdt')),
  order_id TEXT NOT NULL,
  buyer_username TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','claimed','done','failed')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  result TEXT,
  attempts INT NOT NULL DEFAULT 0,
  claimed_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS automation_tasks_user_status_idx ON public.automation_tasks (user_id, status, created_at DESC);

GRANT SELECT ON public.automation_tasks TO authenticated;
GRANT ALL ON public.automation_tasks TO service_role;
ALTER TABLE public.automation_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own automation tasks" ON public.automation_tasks;
CREATE POLICY "Users can view their own automation tasks"
  ON public.automation_tasks FOR SELECT TO authenticated
  USING (auth.uid() = user_id);