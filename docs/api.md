# API 一覧

自前サーバーはなく、Supabase の PostgreSQL 関数(RPC)と Edge Functions を呼ぶ。
アプリからの呼び出しは `mobile/src/lib/api.ts` にまとめてある(画面はその関数だけを呼ぶ)。
RPC のエラーは日本語の文言で返るので、`error.message` をそのまま画面に出せる。

## RPC(PostgreSQL 関数。`supabase/migrations/`)

`supabase.rpc('関数名', { 引数 })` で呼ぶ。

### イベント・出欠・TODO(`..._rpc_events.sql`)

| 名前 | 引数 | 説明 | 呼べる人 |
|---|---|---|---|
| list_events | p_from, p_to(日付) | カレンダー用の一覧。残席・自分の出欠・受付中かを含む。招待制は主催者と参加登録者にだけ出る | ログイン済み |
| get_event | p_event_id, p_invite_token? | イベント詳細。招待制は招待リンクのトークンがあれば申込前でも見られる | ログイン済み |
| apply_event | p_event_id, p_party_size?, p_invite_token? | 参加する。定員・締切・招待制(トークン必須)を確認 | ログイン済み |
| cancel_registration | p_event_id | 参加をとりやめる | ログイン済み |
| check_todo | p_event_id, p_todo_id, p_checked | 当日のTODOをチェック・解除。参加登録した本人が、イベント当日(日本時間)だけ | ログイン済み |

### 固定ミッションのラリー(`20261018090000_event_rally.sql`)

| 名前 | 引数 | 説明 | 呼べる人 |
|---|---|---|---|
| get_rally_progress | p_event_id | 本人の達成済みミッションIDの配列。キャンセル後も履歴を保持 | ログイン済み |
| complete_rally_mission | p_event_id, p_mission_id | 公開中・非表示でないイベントの参加者本人が、開始時刻〜翌々日0時(日本時間)に達成を保存。二重送信は1件にまとめ、保存済みID一覧を返す | ログイン済み |

ミッションIDは `cutter / net / song / photo / memories` の5つ。項目・キーワードは `mobile/src/lib/eventRally.ts`、曲は `mobile/src/constants/rallyMedia.ts` に固定する。DBにはユーザーごとの達成記録(`rally_checks`)だけを保存する。達成取消APIは設けない。
旧TODO(`todo_items` / `todo_checks`、ID `t1..t5`)は内容が違うため流用しない。既存の出欠・招待RPCと返却形式は維持する。

### 招待(`..._rpc_invitations.sql`)

| 名前 | 引数 | 説明 | 呼べる人 |
|---|---|---|---|
| create_invite_link | p_event_id, p_regenerate? | 招待リンクのトークンを返す(なければ作る)。作り直しは主催者だけ | 主催者・イベントを見られる人 |
| get_invite | p_token | 招待ページの表示内容。無効なリンクなら0件 | **ログイン前でも可** |
| get_invite_status | p_event_id | 招待の状況(公開形式・全体招待メールの送信予定日と件数・リンクが開かれた回数・参加登録数) | 主催者 |
| claim_due_all_invites ほか4つ | — | 全体招待メールの送信処理用(下の send-invitation が使う) | service_role のみ |

### 認証・管理者(`users` マグレーション)

| 名前 | 引数 | 説明 | 呼べる人 |
|---|---|---|---|
| is_admin | — | 管理者判定(users.is_admin。アプリの管理者チェックと、users などの RLS からも使う) | ログイン済み |

イベントの作成・更新は RPC を使わず、アプリから `events` テーブルへ直接書く。作成はRLSでも管理者限定(`20261018090100_restrict_event_creation.sql`)、更新は主催者限定。

## Edge Functions(`supabase/functions/`)

| 名前 | 説明 | 呼び出し元 |
|---|---|---|
| send-invitation | 全体招待メール。公開形式がオープンのイベントについて、開催14日前になったら会員全員(メール受信を許可した人)へ送る。1日の上限を超えた分は翌日に続きから送り、同じ人に二度は送らない | pg_cron(毎日9:00。`supabase/cron.sql`) |
| unsubscribe | 招待メールの配信停止リンクの受け口(署名付き) | メール本文のリンク |
| send-notification | 申込完了メールなど(未着手) | — |

スタンプ相当の達成処理は `complete_rally_mission` に統一する。
