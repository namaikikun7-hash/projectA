import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { verifySourcingAccess } from "@/lib/sourcing/auth-guard";

/**
 * GET /api/sourcing/monitor - ダッシュボード集計データ
 */
export async function GET(req: Request) {
  const denied = await verifySourcingAccess(req);
  if (denied) return denied;

  // 各ステータスの商品数
  const statusCounts = await prisma.sourcingProduct.groupBy({
    by: ["status"],
    _count: { id: true },
  });

  // Amazon在庫ステータスの分布
  const stockCounts = await prisma.sourcingProduct.groupBy({
    by: ["amazonStock"],
    _count: { id: true },
    where: {
      status: { notIn: ["SKIPPED", "EXPIRED", "SOLD"] },
    },
  });

  // 高トレンド商品（トップ10）
  const topTrending = await prisma.sourcingProduct.findMany({
    where: {
      status: { notIn: ["SKIPPED", "EXPIRED", "SOLD"] },
      trendScore: { gte: 30 },
    },
    orderBy: { trendScore: "desc" },
    take: 10,
    include: {
      trendSources: { take: 3 },
    },
  });

  // 仕入れ推奨商品（利益率順）
  const recommended = await prisma.sourcingProduct.findMany({
    where: {
      status: { in: ["DETECTED", "PROFITABLE"] },
      amazonStock: { in: ["OUT_OF_STOCK", "UNAVAILABLE"] },
      officialPrice: { not: null },
      estimatedProfit: { gt: 0 },
    },
    orderBy: { profitMargin: "desc" },
    take: 10,
  });

  // 直近7日の新規検出数
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const recentDetections = await prisma.sourcingProduct.count({
    where: { detectedAt: { gte: sevenDaysAgo } },
  });

  // 仕入れ統計
  const purchaseStats = await prisma.purchaseOrder.aggregate({
    _sum: { totalCost: true },
    _count: { id: true },
    where: {
      orderStatus: { in: ["ORDERED", "SHIPPED", "DELIVERED"] },
    },
  });

  // 販売統計
  const salesStats = await prisma.amazonListing.aggregate({
    _sum: { totalRevenue: true, soldQuantity: true },
    _count: { id: true },
    where: {
      listingStatus: "SOLD",
    },
  });

  // トレンドソース別検出数
  const sourceCounts = await prisma.trendSource.groupBy({
    by: ["sourceType"],
    _count: { id: true },
  });

  return NextResponse.json({
    statusCounts: statusCounts.reduce(
      (acc, item) => ({ ...acc, [item.status]: item._count.id }),
      {} as Record<string, number>
    ),
    stockCounts: stockCounts.reduce(
      (acc, item) => ({ ...acc, [item.amazonStock]: item._count.id }),
      {} as Record<string, number>
    ),
    topTrending,
    recommended,
    recentDetections,
    purchaseStats: {
      totalCost: purchaseStats._sum.totalCost || 0,
      orderCount: purchaseStats._count.id,
    },
    salesStats: {
      totalRevenue: salesStats._sum.totalRevenue || 0,
      totalSold: salesStats._sum.soldQuantity || 0,
      listingCount: salesStats._count.id,
    },
    sourceCounts: sourceCounts.reduce(
      (acc, item) => ({ ...acc, [item.sourceType]: item._count.id }),
      {} as Record<string, number>
    ),
  });
}
