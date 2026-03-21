"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Package,
  TrendingUp,
  ShoppingCart,
  DollarSign,
  AlertCircle,
  Eye,
} from "lucide-react";
import { SourcingStatsCard } from "@/components/sourcing/sourcing-stats-card";
import { ResearchButton } from "@/components/sourcing/research-button";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface MonitorData {
  statusCounts: Record<string, number>;
  stockCounts: Record<string, number>;
  topTrending: Array<{
    id: string;
    name: string;
    trendScore: number;
    amazonStock: string;
    officialPrice: number | null;
    amazonPrice: number | null;
    estimatedProfit: number | null;
    status: string;
    imageUrl: string | null;
    trendSources: Array<{
      sourceType: string;
      sourceTitle: string | null;
    }>;
  }>;
  recommended: Array<{
    id: string;
    name: string;
    officialPrice: number | null;
    amazonPrice: number | null;
    estimatedProfit: number | null;
    profitMargin: number | null;
    amazonStock: string;
  }>;
  recentDetections: number;
  purchaseStats: { totalCost: number; orderCount: number };
  salesStats: { totalRevenue: number; totalSold: number; listingCount: number };
  sourceCounts: Record<string, number>;
}

const statusLabels: Record<string, string> = {
  DETECTED: "検出済み",
  RESEARCHING: "リサーチ中",
  PROFITABLE: "利益あり",
  PURCHASING: "仕入れ中",
  IN_STOCK: "在庫あり",
  LISTED: "出品中",
  SOLD: "販売完了",
  SKIPPED: "スキップ",
  EXPIRED: "期限切れ",
};

const sourceTypeLabels: Record<string, string> = {
  RAKUTEN_RANKING: "楽天ランキング",
  TWITTER_BUZZ: "X(Twitter)",
  TV_FEATURE: "テレビ紹介",
  DISCONTINUATION: "生産終了",
  NEWS_ARTICLE: "ニュース",
  MANUAL: "手動登録",
};

export default function SourcingDashboardPage() {
  const [data, setData] = useState<MonitorData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/sourcing/monitor");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // エラーは無視
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-sm text-muted-foreground">読み込み中...</div>
      </div>
    );
  }

  const totalProducts = data
    ? Object.values(data.statusCounts).reduce((sum, n) => sum + n, 0)
    : 0;
  const profitableCount = data?.statusCounts.PROFITABLE || 0;
  const outOfStockCount = data?.stockCounts.OUT_OF_STOCK || 0;

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">商品仕入れ自動化</h1>
          <p className="text-sm text-muted-foreground">
            トレンド商品のリサーチ・仕入れ判断を自動化
          </p>
        </div>
        <ResearchButton onComplete={fetchData} />
      </div>

      {/* KPIカード */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SourcingStatsCard
          title="検出商品数"
          value={totalProducts}
          description={`直近7日: ${data?.recentDetections || 0}件`}
          icon={Package}
        />
        <SourcingStatsCard
          title="利益見込み商品"
          value={profitableCount}
          description="仕入れ推奨あり"
          icon={TrendingUp}
          trend={profitableCount > 0 ? "up" : "neutral"}
        />
        <SourcingStatsCard
          title="Amazon品切れ"
          value={outOfStockCount}
          description="仕入れチャンス"
          icon={AlertCircle}
          trend={outOfStockCount > 0 ? "up" : "neutral"}
        />
        <SourcingStatsCard
          title="仕入れ総額"
          value={formatCurrency(data?.purchaseStats.totalCost || 0)}
          description={`${data?.purchaseStats.orderCount || 0}件の注文`}
          icon={ShoppingCart}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* トレンド商品 TOP10 */}
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">トレンド商品 TOP10</h2>
            <Link
              href="/sourcing/products?sortBy=trendScore&order=desc"
              className="text-sm text-primary hover:underline"
            >
              すべて見る
            </Link>
          </div>
          <div className="space-y-3">
            {data?.topTrending.map((product, idx) => (
              <div
                key={product.id}
                className="flex items-center gap-3 rounded-md p-2 hover:bg-gray-50"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs font-bold">
                  {idx + 1}
                </span>
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt=""
                    className="h-8 w-8 rounded object-cover"
                  />
                ) : (
                  <div className="h-8 w-8 rounded bg-gray-100" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {product.name}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {product.trendSources.map((s, i) => (
                      <span key={i}>
                        {sourceTypeLabels[s.sourceType] || s.sourceType}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="text-right">
                  <span
                    className={cn(
                      "text-sm font-bold",
                      product.trendScore >= 70
                        ? "text-red-600"
                        : product.trendScore >= 40
                        ? "text-orange-500"
                        : "text-gray-500"
                    )}
                  >
                    {product.trendScore}点
                  </span>
                </div>
                <Link
                  href={`/sourcing/products?search=${encodeURIComponent(product.name)}`}
                  className="rounded p-1 hover:bg-gray-100"
                >
                  <Eye className="h-4 w-4" />
                </Link>
              </div>
            ))}
            {(!data?.topTrending || data.topTrending.length === 0) && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                まだトレンド商品がありません。「フルリサーチ」を実行してください。
              </p>
            )}
          </div>
        </div>

        {/* 仕入れ推奨商品 */}
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">仕入れ推奨商品</h2>
            <Link
              href="/sourcing/products?status=PROFITABLE&amazonStock=OUT_OF_STOCK"
              className="text-sm text-primary hover:underline"
            >
              すべて見る
            </Link>
          </div>
          <div className="space-y-3">
            {data?.recommended.map((product) => (
              <div
                key={product.id}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {product.name}
                  </p>
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                    <span>
                      仕入: {product.officialPrice ? formatCurrency(product.officialPrice) : "-"}
                    </span>
                    <span className="text-red-600 font-medium">Amazon品切れ</span>
                  </div>
                </div>
                <div className="text-right">
                  {product.estimatedProfit != null && (
                    <div>
                      <p className="text-sm font-bold text-green-600">
                        +{formatCurrency(product.estimatedProfit)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        利益率 {product.profitMargin}%
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {(!data?.recommended || data.recommended.length === 0) && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                現在、仕入れ推奨商品はありません
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ステータス分布 & ソース分布 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-bold">ステータス分布</h2>
          <div className="space-y-2">
            {Object.entries(data?.statusCounts || {}).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <span className="text-sm">
                  {statusLabels[status] || status}
                </span>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-24 rounded-full bg-gray-100">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{
                        width: `${
                          totalProducts > 0
                            ? (count / totalProducts) * 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                  <span className="w-8 text-right text-sm font-medium">
                    {count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-bold">検出ソース別</h2>
          <div className="space-y-2">
            {Object.entries(data?.sourceCounts || {}).map(([source, count]) => (
              <div key={source} className="flex items-center justify-between">
                <span className="text-sm">
                  {sourceTypeLabels[source] || source}
                </span>
                <span className="text-sm font-medium">{count}件</span>
              </div>
            ))}
            {Object.keys(data?.sourceCounts || {}).length === 0 && (
              <p className="text-sm text-muted-foreground">データなし</p>
            )}
          </div>
        </div>
      </div>

      {/* 売上サマリー */}
      {(data?.salesStats.totalRevenue || 0) > 0 && (
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-bold">売上サマリー</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">総売上</p>
              <p className="text-xl font-bold">
                {formatCurrency(data?.salesStats.totalRevenue || 0)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">販売個数</p>
              <p className="text-xl font-bold">
                {data?.salesStats.totalSold || 0}個
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">粗利</p>
              <p className="text-xl font-bold text-green-600">
                {formatCurrency(
                  (data?.salesStats.totalRevenue || 0) -
                    (data?.purchaseStats.totalCost || 0)
                )}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
