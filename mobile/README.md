# mobile/

Expo (React Native + TypeScript + Expo Router) のアプリ本体。

```powershell
cd mobile
npm install
npx expo start      # Expo Go で確認(Android は a、Web は w)
npm run typecheck
```

現在は `work/画面.txt` のデザイン案4画面を仮データで表示するフロントエンドに、認証(F-01)のみ Supabase Auth で接続した状態。
メール+パスワードで登録・ログイン可(Googleボタンは見た目のみ)。プロフィール保存は `users` / `shibukawa_experiences` テーブル作成後に有効。

`.env.example` をコピーした `.env` に `EXPO_PUBLIC_SUPABASE_URL` と `EXPO_PUBLIC_SUPABASE_ANON_KEY` を設定して使う。
Supabase ダッシュボードの「メールアドレス確認」は OFF 推奨(登録→即ログインになる)。

## ルート(`app/`)と画面ID

| ディレクトリ | 画面 |
|---|---|
| `app/(auth)/` | P-01 ログイン・新規登録 |
| `app/(onboarding)/` | P-02 初回プロフィール登録、通知許可の説明 |
| `app/(tabs)/` | P-03 ホーム(カレンダー)、P-06 マイページ |
| `app/events/` | P-04 詳細、P-05 申込、P-07 スタンプ台紙、P-08 押印、P-09 コンプリート |
| `app/organizer/` | O-01 ダッシュボード、O-02 作成・編集、O-03 招待、O-04 申込者管理 |
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
