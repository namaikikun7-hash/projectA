/**
 * 仕入れ機能専用のアクセス制御
 *
 * ログイン認証とは別に、SOURCING_PASSWORD による追加認証を行う。
 * - APIルート: リクエストヘッダー x-sourcing-token を検証
 * - フロントエンド: sessionStorage に保存したトークンをヘッダーに付与
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const SOURCING_PASSWORD = process.env.SOURCING_PASSWORD || "";

/**
 * APIルート用: ログイン認証 + 仕入れパスワード検証
 * 失敗時は NextResponse を返す。成功時は null。
 */
export async function verifySourcingAccess(
  req: Request
): Promise<NextResponse | null> {
  // 1. ログイン認証
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  // 2. 仕入れパスワード検証
  if (!SOURCING_PASSWORD) {
    // パスワード未設定の場合はスキップ（開発時用）
    return null;
  }

  const token = req.headers.get("x-sourcing-token") || "";
  if (token !== SOURCING_PASSWORD) {
    return NextResponse.json(
      { error: "仕入れ機能のアクセス権がありません", requirePassword: true },
      { status: 403 }
    );
  }

  return null;
}

/**
 * POST /api/sourcing/auth - パスワード検証エンドポイント
 * フロントエンドからパスワードを送信し、正しければ認証OKを返す
 */
export async function verifySourcingPassword(password: string): Promise<boolean> {
  if (!SOURCING_PASSWORD) return true; // 未設定時はスキップ
  return password === SOURCING_PASSWORD;
}
