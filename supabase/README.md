# supabase/

DB・認証・Edge Functions をここにまとめる(自前サーバーなし)。RPC と Edge Functions の一覧は `docs/api.md`。

- `migrations/` : テーブル・RLS・RPC。ファイル名は `YYYYMMDDHHMMSS_内容.sql`(番号順に実行)
- `seed.sql` : デモ用データ(イベント4件と招待リンク1本)
- `cron.sql` : 全体招待メールを毎日送る設定(pg_cron)
- `functions/send-invitation/` : 全体招待メール(オープンのイベントを開催14日前に会員全員へ)
- `functions/unsubscribe/` : 招待メールの配信停止
- `functions/_shared/` : Edge Functions 共通(Supabase クライアント、Resend、メール文面、署名)

## セットアップ(アプリを Supabase につなぐまで)

1. **プロジェクトを作る**
   [Supabase](https://supabase.com/dashboard) で New project(リージョンは Tokyo)。チームで1つを共有する。
2. **メール確認をオフにする**
   Authentication > Sign In / Providers > Email の **Confirm email をオフ**。
   (Supabase 標準のメール送信は、チームメンバー以外に届かず1時間2通までのため、デモでは確認メールを使わない)
3. **テーブルを作る**
   SQL Editor に `migrations/` のSQLを**ファイル名の番号順にすべて**貼って実行する。
   CLI を使う場合は `npx supabase link --project-ref <プロジェクトID>` → `npx supabase db push`。
4. **デモ用データを入れる**
   SQL Editor で `seed.sql` を実行する(何度実行しても同じ結果になる)。
5. **アプリに接続先を書く**
   `mobile/.env.example` をコピーして `mobile/.env` を作り、Project Settings > API の
   Project URL と anon(public)キーを入れる。`npx expo start` を起動し直すと本物のデータに切り替わる。

ここまでで、ログイン・カレンダー・詳細・出欠・固定ミッションのラリー・イベント作成・招待リンク/QR・招待ページが動く。

### 既存DBへの追加適用

DBを空から作る場合も `setup_from_users.sql` 単独で構築できる。`20261017190000_create_users.sql` → `setup_from_users.sql` の順でもよいが、すでに `users` があるDBでは `create_users.sql` を再実行せず、以下の一括SQLだけを使う。

**`users` だけがある場合**は、[`setup_from_users.sql`](setup_from_users.sql) の全体をSQL Editorの新規クエリに貼って実行する。既存の `users` は削除せず、不足する列、渋川経験、イベント、出欠、招待、ラリー、RLS、認証トリガー、全RPCを依存順に作成する。既存のプロフィール・管理者フラグ・通知設定は保持する。

- この1ファイルに下記の追加SQLも含まれるため、個別のマイグレーションは重ねて実行しない。
- 最後に `セットアップ完了` とユーザー数・イベント数が表示される。
- 初回はイベント0件。デモイベントが必要なら、その後に `seed.sql` を実行する。
- 同じ構成での再実行は既存ユーザー・イベント・達成記録を保持する。途中で失敗した場合は全体をロールバックする。

PRのマージだけでは、Supabaseのテーブルは作成されない。

**イベント・出欠・招待までDBに作成済みの場合だけ**、次の2ファイルを順に追加実行する。`public.registrations` がない場合は上記の一括SQLを使う。

1. `migrations/20261018090000_event_rally.sql`
2. `migrations/20261018090100_restrict_event_creation.sql`

ミッションの項目・キーワード・曲はアプリ内固定。`rally_checks` にログインユーザー・申込ごとの達成記録だけを保存する。2本目は、画面で制限していた管理者限定のイベント作成をDBにも適用する。
初期の認証SQL(`20261017212231_create_users.sql`)を手動で適用済みなら、同内容の `20261017190000_create_users.sql` を再実行しない。新規DBでは現在の番号順で作成する。

## 全体招待メール(オープンのイベントを開催14日前に自動送信)

1. [Resend](https://resend.com) で API キーを作る。会員に届けるには送信元のドメインを認証する
   (`resend.dev` のままだと自分のアドレスにしか届かない。無料プランは1日100通)。
2. `supabase/.env.example` をコピーして `supabase/.env` を作り、値を入れて登録する
   `npx supabase secrets set --env-file supabase/.env`
3. Edge Function をデプロイする(ログイン情報なしで呼ばれるので `--no-verify-jwt`。代わりに中で合言葉・署名を確認している)
   `npx supabase functions deploy send-invitation --no-verify-jwt`
   `npx supabase functions deploy unsubscribe --no-verify-jwt`
4. Database > Extensions で `pg_cron` と `pg_net` を有効にし、`cron.sql` の `<...>` を書き換えて SQL Editor で実行する。

手動で試す(送らずに宛先だけ確認):

```sh
curl -X POST "https://<プロジェクトID>.supabase.co/functions/v1/send-invitation" \
  -H "x-cron-secret: <CRON_SECRET>" -H "Content-Type: application/json" -d '{"dryRun": true}'
```

`-d '{}'` にすると実際に送る。

## デモのコツ

- **ラリー** はイベント開始時刻〜翌日いっぱい(日本時間)、参加者本人だけが達成操作できる。5つ達成すると固定のYouTube動画が解放される。`seed.sql` の「渋川海岸 夕陽の再会ミーティング」は15時開始なので、早い時間にデモする場合は、データ投入前に同イベントの開始時刻を早める。通常のイベントは開始までに参加登録する(このデモイベントだけは締切を当日の終わりに設定済み)。
- **招待ページ** は `/invite/demo-beach-talk`(招待制のデモイベント)。アプリでは `shibukawa://invite/demo-beach-talk`、Expo Go では `exp://<IP>:8081/--/invite/demo-beach-talk`。
- **招待制のイベント** は、主催者と参加登録した人のカレンダーにだけ出る。招待リンク・QRから参加登録すると出るようになる。

## テスト

```sh
deno test supabase/functions
```

`tests/event_rally.sql` は、全マイグレーションを適用したローカル検証用PostgreSQLで実行する。本人/別ユーザーの分離、二重達成、期間、参加取消、招待経由の参加、管理者限定の作成を確認し、最後にロールバックする。
