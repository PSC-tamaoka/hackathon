# API 一覧

自前サーバーはなく、Supabase の Edge Functions と PostgreSQL 関数(RPC)を呼ぶ。
単純な読み書き(申込など)はアプリから Supabase へ直接行う(RLS で制限)。

## Edge Functions(`supabase/functions/`)

| 名前 | 説明 | 優先度 |
|---|---|---|
| send-invitation | 招待送信(メール/プッシュ) | Must |
| send-notification | 申込完了メールなどの通知送信 | Must |

## RPC(PostgreSQL 関数)

| 名前 | 説明 | 優先度 |
|---|---|---|
| stamp_in | 押印(開催時間内・申込者本人・未押印を確認して stamps に追加) | Must |
