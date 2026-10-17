# ファイル配置ガイド

「どのフォルダに、どのファイルを作るか」の指定。迷ったらここに従う。
画面ID(P-xx / O-xx / A-xx)・機能ID(F-xx)・テーブル名は [spec.md](spec.md) の定義。
★ = MVP(仕様書9章の1日版)で必要。無印は Should 以下なので後回し。

## 0. 実装済み(フロントエンド・仮データ版)

デザイン案4画面を `mobile/` に実装済み。データは `src/constants/mockEvents.ts` の仮データで、バックエンドには未接続。

| 画面 | ファイル |
|---|---|
| ログイン・新規登録(P-01 と P-02 の入力を1画面にまとめたデザイン) | `app/(auth)/login.tsx` |
| ホーム(カレンダー)P-03 | `app/(tabs)/index.tsx` |
| イベント詳細 P-04(当日TODOリスト・共有つき) | `app/events/[id]/index.tsx` |
| イベント作成 O-02(管理者のみ。ホーム右下のFABから開く) | `app/organizer/new.tsx` + `src/components/EventForm.tsx` |
| お知らせ・マイページ(デザイン案なし。「準備中」表示) | `app/(tabs)/announcements.tsx` `app/(tabs)/mypage.tsx` |

デザイン案が仕様書(スタンプラリー・招待制の運用など)と違う点は、デザイン案を優先して作った。仕様書側とのすり合わせは未了。

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
| `app/events/[id]/` | `apply.tsx` ★ | P-05 申込フォーム・完了 |
| `app/events/[id]/` | `stamps.tsx` ★ | P-07 スタンプ台紙(P-08 押印の確認はここから開くモーダル部品) |
| `app/events/[id]/` | `complete.tsx` ★ | P-09 コンプリート |
| `app/organizer/` | `_layout.tsx` ★ | 管理者ゲート(非管理者は (tabs) へ戻す。organizer 配下は管理者のみ) |
| `app/organizer/` | `index.tsx` ★ | O-01 ダッシュボード |
| `app/organizer/` | `new.tsx` ★ | O-02 イベント作成(管理者のみ。FABから開く) |
| `app/organizer/[id]/` | `edit.tsx` | O-02 イベント編集 |
| `app/organizer/[id]/` | `invite.tsx` ★ | O-03 招待作成・送信 |
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
| `PlanTimeline.tsx` ★ | 固定プランのタイムテーブル |
| `StampCard.tsx` ★ | スタンプ台紙(マスの並び) |
| `StampCell.tsx` ★ | 台紙の1マス(押印済み/未押印) |
| `StampConfirmModal.tsx` ★ | 「体験しましたか?」確認+押印演出(P-08) |
| `CompleteView.tsx` ★ | コンプリート表示 |
| `RegistrationList.tsx` | 申込者一覧(O-04) |

### `hooks/`(データ取得・操作。1ファイル1フック)

| ファイル | 用途 |
|---|---|
| `useSession.ts` ★ | ログイン状態 |
| `useProfile.ts` ★ | 自分のプロフィールと渋川経験 |
| `useEvents.ts` ★ | 月ごとのイベント一覧(カレンダー用) |
| `useEvent.ts` ★ | イベント1件+残席 |
| `useRegistration.ts` ★ | 自分の申込の取得・申込 |
| `useStamps.ts` ★ | スタンプの取得・押印(RPC呼び出し) |
| `useOrganizerEvents.ts` ★ | 自分が作ったイベント |
| `useInvitation.ts` ★ | 対象人数の取得・招待送信(Edge Function呼び出し) |

### `lib/`(外部サービスとの接続)

| ファイル | 用途 |
|---|---|
| `supabase.ts` ★ | Supabase クライアントの生成(1か所だけ) |
| `notifications.ts` ★ | expo-notifications の許可・トークン取得・`push_tokens` 保存・タップ時の遷移 |
| `dates.ts` | 日付の整形 |

### `constants/`

| ファイル | 用途 |
|---|---|
| `planItems.ts` ★ | 固定プラン(アプリ同梱。圏外でも台紙を出すため。内容は `seed.sql` の `plan_items` と同じにする) |
| `theme.ts` ★ | 配色・文字サイズ・余白(高コントラスト、16px以上) |

### `types/`

| ファイル | 用途 |
|---|---|
| `database.ts` ★ | Supabase のテーブル型(`supabase gen types typescript` で生成) |
| `event.ts` | `target_conditions` など JSON 項目の型 |

## 4. `mobile/assets/`

| 場所 | 置くもの |
|---|---|
| `assets/stamps/` ★ | スタンプ絵柄(カッター・地引網など。`plan_items.stamp_image` に対応。4枚) |
| `assets/images/` | アイコン、スプラッシュ、ロゴ |

## 5. `supabase/`

### `migrations/`(番号順に1テーマ1ファイル)

ファイル名は `YYYYMMDDHHMMSS_内容.sql`。`supabase migration new 内容` で作る。

| 内容(ファイル名の目安) | 中身 |
|---|---|
| `create_tables` ★ | 9テーブル(users, shibukawa_experiences, events, plan_items, registrations, stamps, invitations, invitation_deliveries, push_tokens)と一意制約 |
| `20261017212231_create_users` ★ | users・shibukawa_experiences・登録トリガー(handle_new_user)・RLS・is_admin()。SQL Editor で適用 |
| `enable_rls` ★ | 全テーブルの RLS ポリシー(個人情報は本人・主催者に限定) |
| `rpc_stamp_in` ★ | 押印用の PostgreSQL 関数(開催時間内・申込者本人・未押印を確認) |
| `rpc_target_count` ★ | 対象条件に合う受信許可ユーザー数を返す関数(招待画面の「対象人数」用。匿名の人数のみ返す) |
| `storage_buckets` | カバー画像・スタンプ絵柄のバケット(使う場合) |

### `seed.sql`(初期データ。1ファイルにまとめる)

| 入れるもの |
|---|
| `plan_items`(固定プラン)★ |
| デモ用ユーザー20〜30人分と渋川経験(参加年度は2000〜2010年を中心に)★ |
| デモ用イベント(架空)★ |

### `functions/`(Edge Functions。1フォルダに `index.ts` 1つ)

| 場所 | ファイル | 役割 |
|---|---|---|
| `functions/send-invitation/` | `index.ts` ★ | 回数制限(3回)の確認 → 対象抽出 → 送信 → `invitations` / `invitation_deliveries` 記録 |
| `functions/send-notification/` | `index.ts` ★ | 申込完了メールなど、1件ずつの通知 |
| `functions/send-reminder/` | `index.ts` | 前日18時のリマインド(Cron から起動) |
| `functions/_shared/` | `supabase.ts` ★ | サーバー側の Supabase クライアント生成 |
| `functions/_shared/` | `resend.ts` ★ | Resend でのメール送信 |
| `functions/_shared/` | `expo-push.ts` ★ | Expo Push 送信と、`DeviceNotRegistered` トークンの削除 |
| `functions/_shared/` | `templates.ts` ★ | 招待・申込完了メールの固定文面 |
| `functions/_shared/` | `cors.ts` ★ | CORS ヘッダー |

`supabase/config.toml` は `supabase init` で生成される。

## 6. `docs/`

| ファイル | いつ更新するか |
|---|---|
| `api.md` | Edge Function / RPC を追加したとき |
| `structure.md` | 上の表にないファイルを作ったとき |

## 7. ルール

- 表にないファイルは、先にこの表へ追記してから作る。
- 画面・フック・コンポーネントのファイル名は上の表の名前をそのまま使う。
- 不正を防ぎたい処理(招待の回数制限、押印の確認)は、アプリ側に書かず `supabase/` 側に置く。
- 空のフォルダに入れてある `.gitkeep` は、最初のファイルを作ったら消してよい。
