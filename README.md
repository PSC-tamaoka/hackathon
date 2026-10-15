# Hackathon Project

React (Vite) + FastAPI の最小構成。

## 構成

```
frontend/  React + Vite (http://localhost:5173)
backend/   FastAPI      (http://localhost:8000)
docs/      設計メモ・API仕様
data/      データ置き場
```

## 前提

- Node.js 18+ / Python 3.10+

## 起動手順(ターミナルを2つ使う)

### 1. バックエンド

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

確認: http://localhost:8000/api/hello → `{"message":"hello"}`
Swagger UI: http://localhost:8000/docs

### 2. フロントエンド

```powershell
cd frontend
npm install
npm run dev
```

http://localhost:5173 を開くと、API からのメッセージが表示される。

## トラブルシュート

- 画面に「APIに接続できません」→ backend が 8000 番で起動しているか確認
- PowerShell でスクリプト実行がブロックされる → `Set-ExecutionPolicy -Scope Process RemoteSigned`

## 環境変数

| 変数 | 場所 | 既定値 | 説明 |
|---|---|---|---|
| `VITE_API_URL` | frontend (`.env` に記載。`.env.example` 参照) | `http://localhost:8000` | バックエンドのURL |
| `CORS_ORIGINS` | backend (シェルの環境変数) | `http://localhost:5173,http://127.0.0.1:5173` | 許可するフロントのオリジン(カンマ区切り) |
