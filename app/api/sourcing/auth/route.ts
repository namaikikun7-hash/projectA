import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { verifySourcingPassword } from "@/lib/sourcing/auth-guard";

/**
 * POST /api/sourcing/auth - 仕入れ機能のパスワード認証
 * body: { password: string }
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { password } = await req.json();
  const ok = await verifySourcingPassword(password || "");

  if (!ok) {
    return NextResponse.json({ error: "パスワードが違います" }, { status: 403 });
  }

  // パスワード自体をトークンとして返す（x-sourcing-token ヘッダーで使う）
  return NextResponse.json({ success: true, token: password });
}
