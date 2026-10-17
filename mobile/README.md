# mobile/

Expo (React Native + TypeScript + Expo Router) のアプリ本体。プロジェクト作成は `mobile/` 直下で行う。

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
