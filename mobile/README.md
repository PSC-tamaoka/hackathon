# mobile/

Expo (React Native + TypeScript + Expo Router) のアプリ本体。

```powershell
cd mobile
npm install
npx expo start      # Expo Go で確認(Android は a、Web は w)
npm run typecheck
```

`work/画面.txt` のデザイン案の画面を実装し、Supabase に接続済み(`src/lib/api.ts`)。
認証はメール+パスワードで登録・ログイン可(Googleボタンは見た目のみ)。
`mobile/.env` に接続先がなければ仮データ(`src/constants/mockEvents.ts`)で動く。接続の手順は `supabase/README.md`。

- プロフィール(年代・居住地・参加年度・学校名)は、登録時に DBトリガー(`handle_new_user`)が `users` と `shibukawa_experiences` に自動保存する
- 下タブは ホーム/お知らせ/マイページ の3つ。イベント作成は管理者のみホーム右下のFABから(`app/organizer/new.tsx`)
- 管理者にするには SQL Editor で `update public.users set is_admin = true where email = '...';` を実行

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
