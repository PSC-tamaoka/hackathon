# supabase/

DB・認証・Edge Functions をここにまとめる(自前サーバーなし)。

- `migrations/` : テーブル定義・RLS・RPC(押印確認など)。ファイル名は `YYYYMMDDHHMMSS_内容.sql`
- `seed.sql` : 初期データ(固定プラン `plan_items`、デモ用ユーザーと渋川経験)
- `functions/_shared/` : Edge Functions 共通処理
- `functions/send-invitation/` : 招待送信(1イベント3回まで)
- `functions/send-notification/` : メール(Resend)・プッシュ(Expo)送信
- `functions/send-reminder/` : 前日リマインド(Should)
