# Vercel デプロイ手順

## 前提条件

- [Vercel アカウント](https://vercel.com)
- PostgreSQL データベース（[Neon](https://neon.tech) / [Supabase](https://supabase.com) / [Railway](https://railway.app) 推奨）

## デプロイ手順

### 1. GitHub リポジトリを Vercel に接続

1. [vercel.com/new](https://vercel.com/new) にアクセス
2. `namaikikun7-hash/projectA` を選択して **Import**
3. Framework: **Next.js** が自動検出されます

### 2. 環境変数を設定

Vercel の「Environment Variables」セクションに以下を設定:

| 変数名 | 説明 | 例 |
|--------|------|-----|
| `DATABASE_URL` | PostgreSQL 接続文字列 | `postgresql://user:pass@host:5432/db?sslmode=require` |
| `AUTH_SECRET` | NextAuth シークレット（32文字以上のランダム文字列） | `openssl rand -base64 32` で生成 |
| `NEXTAUTH_URL` | デプロイ後の URL | `https://your-project.vercel.app` |
| `ZOOM_ACCOUNT_ID` | Zoom Server-to-Server OAuth アカウント ID | - |
| `ZOOM_CLIENT_ID` | Zoom クライアント ID | - |
| `ZOOM_CLIENT_SECRET` | Zoom クライアントシークレット | - |
| `ZOOM_WEBHOOK_SECRET_TOKEN` | Zoom Webhook 検証トークン | - |
| `GOOGLE_CLIENT_ID` | Google OAuth クライアント ID | - |
| `GOOGLE_CLIENT_SECRET` | Google OAuth クライアントシークレット | - |
| `GOOGLE_REDIRECT_URI` | Google OAuth コールバック URL | `https://your-project.vercel.app/api/integrations/google/callback` |
| `CHATWORK_API_TOKEN` | Chatwork API トークン | - |
| `CHATWORK_ROOM_ID` | 通知先 Chatwork ルーム ID | - |

### 3. Deploy ボタンをクリック

ビルドコマンド (`prisma generate && next build`) が自動実行されます。

### 4. データベースのセットアップ

デプロイ後、Vercel の「Functions」タブまたは接続済みDBのコンソールから:

```bash
# マイグレーション適用
npx prisma db push

# 初期データ投入（任意）
npx ts-node prisma/seed.ts
```

または Vercel CLI を使用:

```bash
vercel env pull .env.local
npx prisma db push
```

## ビルド設定

`vercel.json` に設定済み:
- ビルドコマンド: `prisma generate && next build`
- リージョン: `nrt1`（東京）

## 注意事項

- Zoom Webhook URL は `https://your-project.vercel.app/api/webhooks/zoom` を設定
- Google Calendar のリダイレクト URI を Google Cloud Console で更新
- `NEXTAUTH_URL` はデプロイ後の実際の URL に変更
