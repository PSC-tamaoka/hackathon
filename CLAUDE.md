# CLAUDE.md

2日間ハッカソン用プロジェクト。**スピード最優先**。動くものを小さく積み上げる。

## 構成

- `frontend/` React 18 + Vite(JavaScript)。エントリは `src/main.jsx` / `src/App.jsx`
- `backend/` FastAPI。エントリは `app/main.py`(`uvicorn app.main:app`)
- `docs/` 設計メモ・API仕様(`api.md` にエンドポイントを追記していく)
- `data/` データ置き場(中身は git 追跡しない)

## 開発方針

- API は全て `/api/` プレフィックス。フロントは `VITE_API_URL`(既定 http://localhost:8000)を頭に付けて呼ぶ
  (バックエンドは `CORS_ORIGINS` 環境変数で許可オリジンを指定。既定は localhost:5173)
- エンドポイント追加時は `docs/api.md` も更新する
- 過剰設計しない。DB はまず `data/` 内のJSON/SQLiteで足りるか検討する
- 認証・テスト・型定義は後回し。デモで見せる部分を優先
- 秘密情報は `.env` に置き、コミットしない

## コマンド

- backend: `cd backend && .venv\Scripts\Activate.ps1 && uvicorn app.main:app --reload --port 8000`
- frontend: `cd frontend && npm run dev`
- 前提: Windows / PowerShell
