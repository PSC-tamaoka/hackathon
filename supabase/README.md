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
   SQL Editor に `migrations/` の4ファイルを**番号順に**貼って実行する。
   CLI を使う場合は `npx supabase link --project-ref <プロジェクトID>` → `npx supabase db push`。
4. **デモ用データを入れる**
   SQL Editor で `seed.sql` を実行する(何度実行しても同じ結果になる)。
5. **アプリに接続先を書く**
   `mobile/.env.example` をコピーして `mobile/.env` を作り、Project Settings > API の
   Project URL と anon(public)キーを入れる。`npx expo start` を起動し直すと本物のデータに切り替わる。

ここまでで、ログイン・カレンダー・詳細・出欠・TODO・イベント作成・招待リンク/QR・招待ページが動く。

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

- **当日のTODO** はイベント当日(日本時間)しかチェックできない。`seed.sql` は実行した日に「渋川海岸 夕陽の再会ミーティング」を作るので、発表当日に `seed.sql` を流し直す。
- **招待ページ** は `/invite/demo-beach-talk`(招待制のデモイベント)。アプリでは `shibukawa://invite/demo-beach-talk`、Expo Go では `exp://<IP>:8081/--/invite/demo-beach-talk`。
- **招待制のイベント** は、主催者と参加登録した人のカレンダーにだけ出る。招待リンク・QRから参加登録すると出るようになる。

## テスト

```sh
deno test supabase/functions
```
