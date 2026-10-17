# ファイル配置ガイド

「どのフォルダに、どのファイルを作るか」の指定。迷ったらここに従う。
画面ID(P-xx / O-xx / A-xx)・機能ID(F-xx)・テーブル名は [spec.md](spec.md) の定義。
★ = MVP(仕様書9章の1日版)で必要。無印は Should 以下なので後回し。

## 0. 実装済み(フロントエンド・仮データ版)

デザイン案の画面を `mobile/` に実装し、Supabase に接続済み。
`mobile/.env` に Supabase の接続先がないときは、`src/constants/mockEvents.ts` の仮データでそのまま動く。

| 画面 | ファイル | バックエンド |
|---|---|---|
| ログイン・新規登録(P-01 と P-02 の入力を1画面にまとめたデザイン) | `app/(auth)/login.tsx` | メール＋パスワード(Supabase Auth) |
| ホーム(カレンダー)P-03 | `app/(tabs)/index.tsx` | `list_events` |
| イベント詳細 P-04(当日TODOリスト・出欠・共有/QRつき) | `app/events/[id]/index.tsx` | `get_event` `apply_event` `cancel_registration` `check_todo` `create_invite_link` |
| イベント作成 O-02(管理者のみ。ホーム右下のFABから開く) | `app/organizer/new.tsx` + `src/components/EventForm.tsx` | `events` へ直接 insert |
| 招待の設定 O-03(招待リンク・QR・全体招待メールの状況) | `app/organizer/[id]/invite.tsx` | `create_invite_link` `get_invite_status` |
| 招待ページ(招待リンク・QRを開いたとき。ログイン前でも見られる) | `app/invite/[token].tsx` | `get_invite` `apply_event` |
| お知らせ(「準備中」表示) | `app/(tabs)/announcements.tsx` | — |
| マイページ(自分のプロフィール・ログアウト) | `app/(tabs)/mypage.tsx` | `users` を直接取得 |

デザイン案が仕様書と違う点は、デザイン案を優先して作った(バックエンドもデザイン案に合わせた)。

| 項目 | 仕様書 | 実装(デザイン案) |
|---|---|---|
| 当日の体験 | 固定プラン＋スタンプラリー | 全イベント共通の「当日のTODOリスト」(5項目。`todo_items`) |
| 招待 | 対象条件で抽出して送信(3回まで) | 公開形式で決まる。**招待制**＝招待リンク・QR、**オープン**＝開催14日前に会員全員へ自動メール |
| 渋川経験 | 参加年度・学校名 | 自由記述の「思い出メモ」(`users.memories`) |
| ログイン | メール＋パスワード | 同じ(デザイン案にパスワード欄を追加。Google連携の見た目は残している) |

## 1. `mobile/` 直下(ツールが生成するもの)

自分で書かず、コマンドで生成する。

| ファイル | 作り方 |
|---|---|
| `package.json` `app.json` `tsconfig.json` | 作成済み(Expo SDK 58) |
| `eas.json` | `eas build:configure`(開発ビルド用。Androidは FCM の設定も) |
| `.env` | `.env.example` をコピー(コミットしない) |

## 2. `mobile/app/` 画面(1ファイル = 1画面)

ファイル名がそのままURLになる(Expo Router)。通知・メールのディープリンク `/events/123` は `events/[id]/index.tsx` で開く。

| 場所 | 作るファイル | 画面 |
|---|---|---|
| `app/` | `_layout.tsx` ★ | ルートレイアウト(ログイン状態で振り分け、通知タップの遷移) |
| `app/` | `index.tsx` ★ | `/` へ来たら `(tabs)` へ飛ばすだけ |
| `app/(auth)/` | `_layout.tsx` ★ `login.tsx` ★ | P-01 ログイン・新規登録 |
| `app/(onboarding)/` | `_layout.tsx` ★ `profile.tsx` ★ | P-02 初回プロフィール・渋川経験 |
| `app/(onboarding)/` | `notification-permission.tsx` ★ | 通知許可の説明画面(P-02 の後) |
| `app/(tabs)/` | `_layout.tsx` ★ | 下タブ(ホーム/お知らせ/マイページ) |
| `app/(tabs)/` | `index.tsx` ★ | P-03 ホーム(月カレンダー) |
| `app/(tabs)/` | `mypage.tsx` ★ | P-06 マイページ |
| `app/events/[id]/` | `index.tsx` ★ | P-04 イベント詳細 |
| `app/events/[id]/` | `apply.tsx` | P-05 申込フォーム(デザイン案では詳細画面の「出欠」シートで申し込むので不要) |
| `app/events/[id]/` | `stamps.tsx` | P-07 スタンプ台紙(デザイン案では詳細画面の「当日のTODOリスト」に置き換え。不要) |
| `app/events/[id]/` | `complete.tsx` | P-09 コンプリート(TODOを全部チェックしたときの画面。Should) |
| `app/organizer/` | `_layout.tsx` ★ | 管理者ゲート(非管理者は (tabs) へ戻す。organizer 配下は管理者のみ) |
| `app/organizer/` | `index.tsx` ★ | O-01 主催者ダッシュボード |
| `app/organizer/` | `new.tsx` ★ | O-02 イベント作成(管理者のみ。FABから開く) |
| `app/organizer/[id]/` | `edit.tsx` | O-02 イベント編集 |
| `app/organizer/[id]/` | `invite.tsx` ★ | O-03 招待の設定(招待リンク・QR・全体招待メールの状況) |
| `app/invite/` | `[token].tsx` ★ | 招待ページ(招待リンク・QRコードの行き先。ログイン前でも見られる) |
| `app/organizer/[id]/` | `registrations.tsx` | O-04 申込者管理・当日受付 |
| `app/admin/` | `index.tsx` | A-01 管理画面(F-13 は Could) |

画面ファイルには「データを取って部品を並べる」処理だけ置き、見た目の部品は `src/components/` に分ける。

## 3. `mobile/src/` 部品・処理

### `components/`(共通UI。1ファイル1コンポーネント)

| ファイル | 用途 |
|---|---|
| `Button.tsx` ★ | 大きめの共通ボタン(画面下に置く主操作用) |
| `TextField.tsx` ★ | 共通入力欄(本文16px以上) |
| `CreateEventFab.tsx` ★ | 管理者(is_admin)のときだけ出るホーム右下の作成ボタン |
| `EventCalendar.tsx` ★ | 月カレンダー+ドット(react-native-calendars) |
| `EventPickerSheet.tsx` ★ | 同日に複数イベントがあるときの下から出るシート |
| `EventCard.tsx` ★ | イベントの要約表示 |
| `EventForm.tsx` ★ | イベント作成・編集の入力項目(F-03) |
| `ExperienceForm.tsx` ★ | 渋川経験の入力(参加年度・学校名) |
| ~~`PlanTimeline.tsx` `StampCard.tsx` `StampCell.tsx` `StampConfirmModal.tsx`~~ | スタンプラリー用(当日のTODOリストに置き換えたため作らない) |
| `CompleteView.tsx` | コンプリート表示(Should) |
| `RegistrationList.tsx` | 申込者一覧(O-04) |

### `hooks/`(データ取得・操作。1ファイル1フック)

| ファイル | 用途 |
|---|---|
| `useSession.ts` ★ | ログイン状態(作成済み) |
| `useEvents.ts` ★ | 月ごとのイベント一覧(カレンダー用。作成済み) |
| `useEvent.ts` ★ | イベント1件(残席・自分の出欠・TODOのチェックを含む。作成済み) |
| `useProfile.ts` | 自分のプロフィール(マイページ用) |
| `useOrganizerEvents.ts` | 自分が作ったイベント(主催者ダッシュボード用) |

申込・TODOのチェック・招待リンクの取得は、フックにせず `lib/api.ts` の関数を画面から直接呼ぶ。

### `lib/`(外部サービスとの接続)

| ファイル | 用途 |
|---|---|
| `supabase.ts` ★ | Supabase クライアントの生成(1か所だけ。接続先が未設定なら仮データで動く) |
| `api.ts` ★ | バックエンドとの通信をまとめたもの(RPC・ログイン・仮データ)。画面はこれだけを呼ぶ |
| `notifications.ts` ★ | expo-notifications の許可・トークン取得・`push_tokens` 保存・タップ時の遷移 |
| `dates.ts` | 日付の整形 |

### `constants/`

| ファイル | 用途 |
|---|---|
| `mockEvents.ts` ★ | 仮データと、当日のTODOリスト `commonTodos`(アプリ同梱。内容とIDは `todo_items` と同じにする) |
| `theme.ts` ★ | 配色・文字サイズ・余白(高コントラスト、16px以上) |

### `types/`

| ファイル | 用途 |
|---|---|
| `database.ts` ★ | Supabase のテーブル型(`supabase gen types typescript` で生成) |
| `event.ts` | `target_conditions` など JSON 項目の型 |

## 4. `mobile/assets/`

| 場所 | 置くもの |
|---|---|
| `assets/stamps/` | スタンプ絵柄(TODOリストに置き換えたため現在は不要) |
| `assets/images/` | アイコン、スプラッシュ、ロゴ |

## 5. `supabase/`

### `migrations/`(番号順に1テーマ1ファイル)

ファイル名は `YYYYMMDDHHMMSS_内容.sql`。`supabase migration new 内容` で作る。

| ファイル | 中身 |
|---|---|
| `20261017200000_create_tables.sql` ★ | 8テーブル(users, events, todo_items, registrations, todo_checks, invite_links, invitation_deliveries, push_tokens)、当日のTODO 5項目、会員登録時に users を作るトリガー |
| `20261017200100_enable_rls.sql` ★ | 全テーブルの RLS と列の権限(個人情報は本人・主催者に限定。申込・TODO・招待は RPC 経由だけ) |
| `20261017200200_rpc_events.sql` ★ | イベント一覧・詳細・参加・とりやめ・TODOチェックの RPC |
| `20261017200300_rpc_invitations.sql` ★ | 招待リンク・招待ページ・招待状況・全体招待メール送信用の RPC |
| `20261017212231_create_users.sql` ★ | users・shibukawa_experiences・登録トリガー(handle_new_user)・RLS・is_admin()。SQL Editor で適用 |
| `storage_buckets` | カバー画像のバケット(使う場合) |

### `seed.sql`(デモ用データ)

| 入れるもの |
|---|
| 仮データと同じイベント3件(今月の5・12・19日)と、TODOチェックを見せるための「今日」のイベント ★ |
| 招待制のデモイベントの招待リンク(トークン `demo-beach-talk`)★ |

### `cron.sql`

全体招待メールを毎日9:00に送る設定(pg_cron)。SQL Editor で1回だけ実行する。

### `functions/`(Edge Functions。1フォルダに `index.ts` 1つ)

| 場所 | ファイル | 役割 |
|---|---|---|
| `functions/send-invitation/` | `index.ts` ★ `run.ts` | 全体招待メール(オープンのイベントを開催14日前に会員全員へ。cron から起動) |
| `functions/unsubscribe/` | `index.ts` ★ | 招待メールの配信停止 |
| `functions/send-notification/` | `index.ts` | 申込完了メールなど(未着手) |
| `functions/send-reminder/` | `index.ts` | 前日18時のリマインド(Should) |
| `functions/_shared/` | `supabase.ts` ★ | サーバー側の Supabase クライアント生成 |
| `functions/_shared/` | `resend.ts` ★ | Resend でのメール送信(100通ずつ) |
| `functions/_shared/` | `templates.ts` ★ | 招待メールの文面 |
| `functions/_shared/` | `unsubscribe.ts` ★ | 配信停止リンクの署名 |
| `functions/_shared/` | `expo-push.ts` | Expo Push 送信(未着手) |

`supabase/config.toml` は `supabase init` で生成される。

## 6. `docs/`

| ファイル | いつ更新するか |
|---|---|
| `api.md` | Edge Function / RPC を追加したとき |
| `structure.md` | 上の表にないファイルを作ったとき |

## 7. ルール

- 表にないファイルは、先にこの表へ追記してから作る。
- 画面・フック・コンポーネントのファイル名は上の表の名前をそのまま使う。
- 不正を防ぎたい処理(定員・招待制の確認、TODOのチェック、招待メールの送信)は、アプリ側に書かず `supabase/` 側に置く。
- 空のフォルダに入れてある `.gitkeep` は、最初のファイルを作ったら消してよい。
