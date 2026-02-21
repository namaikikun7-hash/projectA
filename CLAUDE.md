# CLAUDE.md

This file provides guidance for AI assistants (Claude Code and similar tools) working in this repository.

## Project Overview

**営業管理システム** — オンラインスクール営業代行会社向けの商談管理・成約率改善・営業マン評価システム。

### Core Features
- **商談管理**: Zoom URL自動生成、Google Calendar連携、商談結果記録
- **フィードバックシステム**: 商談後に担当者が入力するフィードバックフォーム
- **評価システム**: 月次の成約率・商談数・フィードバック提出率などから自動スコアリング（S/A/B/C/D評価）
- **Chatwork通知**: 成約通知、フィードバック催促、日次レポートを自動送信
- **ダッシュボード**: KPI進捗バー、月別トレンドグラフ、スタッフランキング

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router, TypeScript) |
| Database | PostgreSQL + Prisma ORM |
| Auth | NextAuth.js v5 (Auth.js) — JWT strategy |
| UI | Tailwind CSS + Radix UI primitives (custom shadcn-style components) |
| Charts | Recharts |
| Forms | React Hook Form + Zod |
| External APIs | Zoom API (Server-to-Server OAuth), Google Calendar API, Chatwork API |

## Project Structure

```
projectA/
├── app/
│   ├── (auth)/login/        # ログインページ
│   ├── (dashboard)/         # 認証済みレイアウト
│   │   ├── dashboard/       # ダッシュボード（KPI・グラフ・ランキング）
│   │   ├── meetings/        # 商談一覧・詳細・新規追加
│   │   │   └── [id]/feedback/  # フィードバック入力
│   │   ├── clients/         # 顧客管理
│   │   ├── staff/           # スタッフ管理（管理者・マネージャーのみ）
│   │   └── evaluations/     # 評価・分析
│   └── api/
│       ├── auth/[...nextauth]/  # NextAuth handlers
│       ├── meetings/        # CRUD + フィードバック
│       ├── clients/         # CRUD
│       ├── staff/           # CRUD（管理者のみ）
│       ├── evaluations/     # 月次評価の集計・取得
│       ├── dashboard/       # ダッシュボード集計データ
│       └── webhooks/zoom/   # Zoom Webhook（録画完了・会議終了）
├── components/
│   ├── ui/                  # Button, Card, Badge, Input, Select, Dialog, Label
│   ├── layout/sidebar.tsx   # サイドバーナビゲーション
│   ├── dashboard/           # StatsCard, ConversionChart, StaffRanking
│   └── meetings/            # MeetingStatusBadge, FeedbackFormComponent
├── lib/
│   ├── prisma.ts            # Prisma client singleton
│   ├── auth.ts              # NextAuth config (Credentials provider + bcrypt)
│   ├── zoom.ts              # Zoom API (会議作成・録画取得・Webhook署名検証)
│   ├── google-calendar.ts   # Google Calendar API (OAuth2, イベント作成・削除)
│   ├── chatwork.ts          # Chatwork API (各種通知送信)
│   ├── evaluations.ts       # 評価スコア計算ロジック
│   └── utils.ts             # cn(), formatCurrency(), formatDateTime()
├── prisma/
│   ├── schema.prisma        # DB schema (User, Client, Meeting, Feedback, Evaluation, KpiTarget)
│   └── seed.ts              # 初期データ（管理者・スタッフ3名・サンプル顧客）
└── middleware.ts             # 認証保護（/login と /api/webhooks は公開）
```

## Database Schema

主要モデル:
- **User** — 営業スタッフ / マネージャー / 管理者。`role: STAFF | MANAGER | ADMIN`
- **Client** — 顧客。流入元 (LeadSource) を管理
- **Meeting** — 商談。Zoom・Googleカレンダー連携情報を保持。`status` と `result` は別管理
- **MeetingFeedback** — 商談後フィードバック (1対1)。クロージングスコア・自己評価など
- **Evaluation** — 月次評価集計 (`staffId + period` でユニーク)
- **KpiTarget** — KPI目標 (`staffId=null` は全体目標)
- **NotificationLog** — Chatwork送信ログ

## Development Workflows

### Setup

```bash
# 依存パッケージのインストール
npm install

# .envファイルを作成
cp .env.example .env
# DATABASE_URL, AUTH_SECRET, Zoom/Google/Chatwork API キーを設定

# DBスキーマを反映
npm run db:push

# 初期データを投入
npm run db:seed

# 開発サーバー起動
npm run dev
```

### Running Tests / Lint

```bash
npm run lint
```

### Build

```bash
npm run build
npm start
```

### DB操作

```bash
npm run db:studio     # Prisma Studio (GUI)
npm run db:migrate    # マイグレーション作成
npm run db:generate   # Prisma Client 再生成
```

## Evaluation Scoring Logic (`lib/evaluations.ts`)

100点満点でスコアリング:

| 項目 | 配点 | 計算方法 |
|------|------|----------|
| 成約率 | 40点 | `(実成約率 / 目標成約率) × 40` (上限100%) |
| 商談数達成率 | 20点 | `(実商談数 / 目標商談数) × 20` (上限100%) |
| FB提出率 | 20点 | `(提出率 / 100) × 20` |
| 平均クロージングスコア | 10点 | `(平均スコア / 10) × 10` |
| 無断キャンセルペナルティ | 10点 | `max(0, 10 - 無断率 × 0.5)` |

グレード: **S**≥90 / **A**≥75 / **B**≥60 / **C**≥45 / **D**<45

## Access Control

| Role | 閲覧 | 商談作成 | 結果記録 | スタッフ管理 | 評価再計算 |
|------|------|----------|----------|------------|----------|
| STAFF | 自分のみ | 可 | 自分のみ | 不可 | 不可 |
| MANAGER | 全員 | 可 | 全員 | 閲覧のみ | 可 |
| ADMIN | 全員 | 可 | 全員 | フル | 可 |

## External Integrations

### Zoom
- `lib/zoom.ts` — Server-to-Server OAuth。`ZOOM_ACCOUNT_ID / CLIENT_ID / CLIENT_SECRET` が必要
- 商談作成時にクラウド録画ONの会議URLを自動発行
- Webhook (`/api/webhooks/zoom`) で録画完了・会議終了を受信しDBに反映

### Google Calendar
- `lib/google-calendar.ts` — OAuth2リフレッシュトークン方式
- 各スタッフが `/api/integrations/google/callback` で連携した後に利用可能
- `user.googleRefreshToken` に保存されたトークンを使用

### Chatwork
- `lib/chatwork.ts` — `CHATWORK_API_TOKEN` と `CHATWORK_ROOM_ID` が必要
- 成約通知・FB催促・商談リマインダー・日次レポートを `CHATWORK_ROOM_ID` に送信

## Key Conventions for AI Assistants

- Server Componentsでは `prisma` を直接呼ぶ。API経由にしない
- Client Componentsには `"use client"` ディレクティブが必須
- 認証チェックはServer Componentでは `auth()` を、API RouteでもServer側の `auth()` を使う
- `lib/utils.ts` の `cn()` を使ってclassNameをマージする
- 日本語ロケール: 日時は `Asia/Tokyo`、通貨は `ja-JP` で `Intl` APIを使う
- スコアリングロジックの変更は `lib/evaluations.ts` の `calculateEvaluation()` に集約する
- 新しい通知種別は `NotificationType` enumに追加してから `lib/chatwork.ts` に実装する

## Seed Accounts

```
Admin:  admin@example.com  /  admin1234
Staff:  yamada@example.com /  staff1234
Staff:  tanaka@example.com /  staff1234
Staff:  suzuki@example.com /  staff1234
```

## Branch Strategy

- AI開発: `claude/` プレフィックスのブランチ
- 命名: `claude/<description>-<session-id>`
- プッシュ: `git push -u origin <branch-name>`
- `main` / `master` への直接プッシュ禁止
