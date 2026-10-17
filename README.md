# 渋川つながり

岡山県渋川青年の家で「海の学校」などを体験した人を、イベントを通じて再び渋川へ呼び戻すスマホアプリ(iOS/Android)。
詳細は [docs/spec.md](docs/spec.md)。

## 構成

```
mobile/    Expo アプリ(TypeScript + Expo Router)
supabase/  DB マイグレーション・初期データ・Edge Functions
docs/      仕様書・API 一覧
data/      データ置き場(git 追跡しない)
work/      作業用の素材(git 追跡しない)
```

各ディレクトリの中身は `mobile/README.md` と `supabase/README.md` を参照。
**どのフォルダにどのファイルを作るかは [docs/structure.md](docs/structure.md)。**

## 技術

TypeScript / React Native + Expo / Supabase(PostgreSQL・Auth・Edge Functions・Storage)/ Resend / Expo Push

## 起動

```powershell
cd mobile
npm install
npx expo start
```

## 環境変数

`mobile/.env.example` と `supabase/.env.example` をコピーして `.env` を作る(コミットしない)。
