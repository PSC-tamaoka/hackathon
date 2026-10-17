-- =====================================================================
-- 全体招待メールの自動送信を毎日実行する設定
-- マイグレーションではなく、Supabase の SQL Editor で1回だけ実行する
-- （プロジェクトの URL と秘密の値を Vault に入れるため）
--
-- 事前準備
--   1. Dashboard > Database > Extensions で pg_cron と pg_net を有効にする
--   2. Edge Function に CRON_SECRET を登録しておく（supabase/README.md の手順）
-- =====================================================================

-- プロジェクトの URL と、Edge Function の CRON_SECRET と同じ値を Vault に保存
select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
select vault.create_secret('<CRON_SECRET と同じ値>', 'cron_secret');

-- 毎日 9:00（日本時間）に実行。pg_cron は UTC で動くので 0:00 UTC を指定
select cron.schedule(
  'send-invitation-daily',
  '0 0 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/send-invitation',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) as request_id;
  $$
);

-- 確認・停止
-- select * from cron.job;                                       登録内容
-- select * from cron.job_run_details order by start_time desc;  実行履歴
-- select * from net._http_response order by created desc;       Edge Function の応答
-- select cron.unschedule('send-invitation-daily');       停止
