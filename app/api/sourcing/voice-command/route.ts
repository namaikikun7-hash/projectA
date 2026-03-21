import { NextResponse } from "next/server";
import { runFullResearch, evaluatePurchaseOpportunities } from "@/lib/sourcing/research-engine";
import { notifySourcingOpportunities, notifyUrgentOpportunity } from "@/lib/sourcing/notify";
import { prisma } from "@/lib/prisma";
import { verifySourcingAccess } from "@/lib/sourcing/auth-guard";

/**
 * POST /api/sourcing/voice-command
 *
 * 音声入力（テキスト変換済み）を受け取り、
 * リサーチ→判定→通知までを一気通貫で実行する
 *
 * body: { command: string }
 *
 * ブラウザ側のWeb Speech APIで音声→テキスト変換後にこのAPIを叩く
 */
export async function POST(req: Request) {
  const denied = await verifySourcingAccess(req);
  if (denied) return denied;

  const body = await req.json();
  const command = (body.command || "").toLowerCase();

  // フローのステップを記録（UIでリアルタイム表示用）
  const steps: Array<{
    step: string;
    status: "running" | "done" | "error";
    detail?: string;
    timestamp: string;
  }> = [];

  function addStep(step: string, status: "running" | "done" | "error", detail?: string) {
    steps.push({
      step,
      status,
      detail,
      timestamp: new Date().toISOString(),
    });
  }

  try {
    // Step 1: コマンド解析
    addStep("音声コマンド受信", "done", `「${body.command}」`);

    // Step 2: リサーチ実行
    addStep("トレンド商品リサーチ中", "running", "楽天・X・TV・生産終了情報を収集中...");
    const researchResult = await runFullResearch();
    steps[steps.length - 1].status = "done";
    steps[steps.length - 1].detail =
      `${researchResult.newProducts}件の新規商品, ${researchResult.updatedProducts}件更新`;

    // Step 3: Amazon在庫チェック（リサーチ内で実行済み）
    addStep("Amazon在庫・価格チェック", "done", "PA-APIで在庫状況を確認完了");

    // Step 4: 利益計算・仕入れ判定
    addStep("利益計算・仕入れ判定中", "running");
    const evalResult = await evaluatePurchaseOpportunities();
    const strongBuys = evalResult.opportunities.filter(
      (o) => o.recommendation === "STRONG_BUY"
    );
    const buys = evalResult.opportunities.filter(
      (o) => o.recommendation === "BUY"
    );
    steps[steps.length - 1].status = "done";
    steps[steps.length - 1].detail =
      `STRONG_BUY: ${strongBuys.length}件, BUY: ${buys.length}件`;

    // Step 5: 通知送信
    const notifyTargets = [...strongBuys, ...buys];
    if (notifyTargets.length > 0) {
      addStep("仕入れ推奨通知を送信中", "running");

      // 商品の公式URLとASINを取得
      const enriched = await Promise.all(
        notifyTargets.map(async (o) => {
          const product = await prisma.sourcingProduct.findUnique({
            where: { id: o.productId },
            select: { officialUrl: true, asin: true },
          });
          return { ...o, officialUrl: product?.officialUrl, asin: product?.asin };
        })
      );

      // 緊急アラート（STRONG_BUYは個別通知）
      for (const sb of enriched.filter((e) => e.recommendation === "STRONG_BUY")) {
        await notifyUrgentOpportunity(sb);
      }

      // 一括通知
      const notifyResult = await notifySourcingOpportunities(enriched);
      steps[steps.length - 1].status = "done";
      steps[steps.length - 1].detail =
        `${notifyResult.notified}件の通知送信完了（Chatwork: ${notifyResult.chatwork ? "OK" : "未設定"}, LINE: ${notifyResult.line ? "OK" : "未設定"}）`;
    } else {
      addStep("仕入れ推奨商品", "done", "今回は推奨なし - 引き続き監視中");
    }

    // 完了
    addStep("完了", "done",
      `リサーチ完了！${notifyTargets.length}件の仕入れチャンスを通知しました`
    );

    return NextResponse.json({
      success: true,
      command: body.command,
      steps,
      summary: {
        newProducts: researchResult.newProducts,
        updatedProducts: researchResult.updatedProducts,
        strongBuys: strongBuys.length,
        buys: buys.length,
        notified: notifyTargets.length,
        opportunities: notifyTargets.slice(0, 5), // 上位5件を返す
      },
    });
  } catch (error) {
    addStep("エラー", "error", String(error));
    return NextResponse.json(
      { success: false, steps, error: String(error) },
      { status: 500 }
    );
  }
}
