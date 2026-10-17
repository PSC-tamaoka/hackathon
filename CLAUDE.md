# CLAUDE.md

「渋川つながり」(仕様は `docs/spec.md`)。1日で作るハッカソン用プロジェクト。**スピード最優先**。動くものを小さく積み上げる。

## 構成

- `mobile/` Expo + TypeScript + Expo Router。画面は `app/`、部品は `src/`(詳細は `mobile/README.md`)
- `supabase/` マイグレーション(`migrations/`)、初期データ(`seed.sql`)、Edge Functions(`functions/`)
- `docs/` 仕様書(`spec.md`)・API一覧(`api.md`)
- `data/`・`work/` 作業用(中身は git 追跡しない)
- ファイルを作る場所は `docs/structure.md` に従う

## 開発方針

- 自前サーバーは持たない。サーバー処理は Supabase(RLS / Edge Functions / PostgreSQL関数)
- 単純な読み書きはアプリから直接。不正を防ぎたい処理(招待の回数制限、押印の確認)は Edge Functions か RPC
- Edge Function / RPC を追加したら `docs/api.md` も更新する
- MVP は仕様書9章の範囲(Should 以下は作らない)
- 過剰設計しない。テストは後回し、デモで見せる部分を優先
- 秘密情報は `.env` に置き、コミットしない
- 前提: Windows / PowerShell
