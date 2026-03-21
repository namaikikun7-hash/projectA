import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { runFullResearch, refreshAmazonData, evaluatePurchaseOpportunities } from "@/lib/sourcing/research-engine";

/**
 * POST /api/sourcing/research - リサーチを実行
 * body: { type: "full" | "amazon" | "evaluate" }
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const body = await req.json();
  const type = body.type || "full";

  try {
    switch (type) {
      case "full": {
        const result = await runFullResearch();
        return NextResponse.json({
          message: "フルリサーチ完了",
          result,
        });
      }
      case "amazon": {
        const result = await refreshAmazonData();
        return NextResponse.json({
          message: "Amazon価格・在庫更新完了",
          result,
        });
      }
      case "evaluate": {
        const result = await evaluatePurchaseOpportunities();
        return NextResponse.json({
          message: "仕入れ判定完了",
          result,
        });
      }
      default:
        return NextResponse.json(
          { error: `不明なリサーチタイプ: ${type}` },
          { status: 400 }
        );
    }
  } catch (error) {
    return NextResponse.json(
      { error: "リサーチ中にエラーが発生しました", details: String(error) },
      { status: 500 }
    );
  }
}
