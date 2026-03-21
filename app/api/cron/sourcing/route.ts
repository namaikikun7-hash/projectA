import { NextResponse } from "next/server";
import { runFullResearch, refreshAmazonData, evaluatePurchaseOpportunities } from "@/lib/sourcing/research-engine";

/**
 * GET /api/cron/sourcing - 定期実行用エンドポイント
 *
 * 外部のcronサービス（Vercel Cron, crontab, etc.）から呼び出す
 * Authorization ヘッダーに CRON_SECRET を設定して認証
 *
 * クエリパラメータ:
 * - type: "full" | "amazon" | "evaluate" （デフォルト: "full"）
 */
export async function GET(req: Request) {
  // Cron認証
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "full";

  try {
    let result: unknown;

    switch (type) {
      case "full":
        result = await runFullResearch();
        break;
      case "amazon":
        result = await refreshAmazonData();
        break;
      case "evaluate":
        result = await evaluatePurchaseOpportunities();
        break;
      default:
        return NextResponse.json({ error: `Unknown type: ${type}` }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      type,
      executedAt: new Date().toISOString(),
      result,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Cron実行エラー", details: String(error) },
      { status: 500 }
    );
  }
}
