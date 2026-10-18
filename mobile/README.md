# mobile/

Expo (React Native + TypeScript + Expo Router) のアプリ本体。

```powershell
cd mobile
npm install
npx expo start      # Expo Go で確認(Android は a、Web は w)
npm run typecheck
```

## iPhone の Expo Go で確認する

このプロジェクトは Expo SDK 57 を使う。iPhone には SDK 57 対応の Expo Go を入れ、CLI と Expo Go の両方で同じ Expo アカウントにログインする。
SDK 58 への移行期間中は、ストア版 Expo Go が SDK 58 に未対応のため SDK 57 に揃えている([Expo 公式案内](https://docs.expo.dev/get-started/create-a-project/))。

依存関係を更新した後は、起動中の Expo を `Ctrl+C` で止め、キャッシュを消して起動し直す。Wi-Fi 経由で接続できない場合はトンネルを使う。

```sh
npx expo start --go --tunnel --clear
```

SDK 57 のトンネル接続は Expo CLI が ngrok を起動する。必要な `@expo/ngrok` は開発依存に含めているため、別途 ngrok を手動起動する必要はない。

WSL で `spawn firefox ENOENT` が出る場合は `BROWSER=none npx expo login --browser` を使い、表示された認証リンクを Windows のブラウザで開く。

## 実装について

`work/画面.txt` のデザイン案の画面を実装し、Supabase に接続済み(`src/lib/api.ts`)。
認証はメール+パスワードで登録・ログイン可(Googleボタンは見た目のみ)。
イベントAPIは接続先未設定時に仮データ(`src/constants/mockEvents.ts`)を返すが、通常のログイン・登録には `mobile/.env` のSupabase設定が必要。接続の手順は `supabase/README.md`。

- プロフィール(年代・居住地・参加年度・学校名)は、登録時に DBトリガー(`handle_new_user`)が `users` と `shibukawa_experiences` に自動保存する
- 下タブは ホーム/お知らせ/マイページ の3つ。イベント作成は管理者のみホーム右下のFABから(`app/organizer/new.tsx`)
- 管理者にするには SQL Editor で `update public.users set is_admin = true where email = '...';` を実行
- 詳細画面の5つのミッション・キーワード・効果音・歌は全イベント共通の固定データ。達成記録だけをDBに保存し、保存成功後に演出・全達成時の歌を解放する。旧TODOのチェックとは別の記録を使う
- ラリーは日本時間の開始時刻〜翌日いっぱい。DBが `users` だけなら `supabase/setup_from_users.sql` を全体実行する。イベント・出欠のテーブルまで作成済みならラリーと管理者制限の追加SQLを適用する(`supabase/README.md`)

`.env.example` をコピーした `.env` に `EXPO_PUBLIC_SUPABASE_URL` と `EXPO_PUBLIC_SUPABASE_ANON_KEY` を設定して使う。
Supabase ダッシュボードの「メールアドレス確認」は OFF 推奨(登録→即ログインになる)。
マイグレーションは `supabase/migrations/` のSQLを SQL Editor に貼って適用する(CLI未導入のため)。

## ルート(`app/`)と画面ID

| ディレクトリ | 画面 |
|---|---|
| `app/(auth)/` | P-01 ログイン・新規登録 |
| `app/(onboarding)/` | P-02 初回プロフィール登録、通知許可の説明 |
| `app/(tabs)/` | P-03 ホーム(カレンダー)、お知らせ、P-06 マイページ |
| `app/events/` | P-04 詳細、P-05 申込、P-07 スタンプ台紙、P-08 押印、P-09 コンプリート |
| `app/organizer/` | O-02 イベント作成(管理者のみ。ホーム右下のFABから) |
| `app/admin/` | A-01 管理画面 |

## `src/`

| ディレクトリ | 置くもの |
|---|---|
| `components/` | 共通UI部品 |
| `hooks/` | データ取得などのカスタムフック |
| `lib/` | Supabase クライアントなど外部接続 |
| `constants/` | 固定プラン(アプリ同梱分)、配色 |
| `types/` | 型定義 |

`assets/stamps/` にスタンプ絵柄、`assets/images/` にその他画像。
