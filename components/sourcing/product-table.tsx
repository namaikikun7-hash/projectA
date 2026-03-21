"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  TrendingUp,
  ExternalLink,
  ShoppingCart,
  Eye,
  MoreHorizontal,
} from "lucide-react";

interface TrendSource {
  id: string;
  sourceType: string;
  sourceTitle: string | null;
  sourceUrl: string | null;
}

interface Product {
  id: string;
  name: string;
  asin: string | null;
  imageUrl: string | null;
  category: string | null;
  officialPrice: number | null;
  amazonPrice: number | null;
  amazonStock: string;
  estimatedProfit: number | null;
  profitMargin: number | null;
  trendScore: number;
  status: string;
  detectedAt: string;
  trendSources: TrendSource[];
}

interface ProductTableProps {
  products: Product[];
  onViewDetail: (id: string) => void;
  onPurchase: (product: Product) => void;
  onStatusChange: (id: string, status: string) => void;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  DETECTED: { label: "検出済み", color: "bg-blue-100 text-blue-800" },
  RESEARCHING: { label: "リサーチ中", color: "bg-yellow-100 text-yellow-800" },
  PROFITABLE: { label: "利益あり", color: "bg-green-100 text-green-800" },
  PURCHASING: { label: "仕入れ中", color: "bg-purple-100 text-purple-800" },
  IN_STOCK: { label: "在庫あり", color: "bg-indigo-100 text-indigo-800" },
  LISTED: { label: "出品中", color: "bg-orange-100 text-orange-800" },
  SOLD: { label: "販売完了", color: "bg-gray-100 text-gray-800" },
  SKIPPED: { label: "スキップ", color: "bg-gray-100 text-gray-500" },
  EXPIRED: { label: "期限切れ", color: "bg-red-100 text-red-800" },
};

const stockLabels: Record<string, { label: string; color: string }> = {
  IN_STOCK: { label: "在庫あり", color: "text-green-600" },
  LOW_STOCK: { label: "在庫わずか", color: "text-yellow-600" },
  OUT_OF_STOCK: { label: "在庫切れ", color: "text-red-600" },
  UNAVAILABLE: { label: "取扱なし", color: "text-gray-500" },
  UNKNOWN: { label: "不明", color: "text-gray-400" },
};

const sourceTypeLabels: Record<string, string> = {
  RAKUTEN_RANKING: "楽天",
  TWITTER_BUZZ: "X",
  TV_FEATURE: "TV",
  DISCONTINUATION: "終了",
  NEWS_ARTICLE: "ニュース",
  MANUAL: "手動",
};

export function ProductTable({
  products,
  onViewDetail,
  onPurchase,
  onStatusChange,
}: ProductTableProps) {
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto rounded-lg border bg-white">
      <table className="w-full text-sm">
        <thead className="border-b bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
              商品
            </th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
              ソース
            </th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">
              公式価格
            </th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">
              Amazon価格
            </th>
            <th className="px-4 py-3 text-center font-medium text-muted-foreground">
              Amazon在庫
            </th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">
              推定利益
            </th>
            <th className="px-4 py-3 text-center font-medium text-muted-foreground">
              トレンド
            </th>
            <th className="px-4 py-3 text-center font-medium text-muted-foreground">
              ステータス
            </th>
            <th className="px-4 py-3 text-center font-medium text-muted-foreground">
              操作
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {products.map((product) => {
            const statusInfo = statusLabels[product.status] || {
              label: product.status,
              color: "bg-gray-100",
            };
            const stockInfo = stockLabels[product.amazonStock] || {
              label: "不明",
              color: "text-gray-400",
            };

            return (
              <tr key={product.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="h-10 w-10 rounded object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded bg-gray-100 text-xs text-gray-400">
                        N/A
                      </div>
                    )}
                    <div className="max-w-[200px]">
                      <p className="truncate font-medium">{product.name}</p>
                      {product.asin && (
                        <p className="text-xs text-muted-foreground">
                          ASIN: {product.asin}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {product.trendSources.map((source) => (
                      <span
                        key={source.id}
                        className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs"
                        title={source.sourceTitle || ""}
                      >
                        {sourceTypeLabels[source.sourceType] || source.sourceType}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  {product.officialPrice
                    ? formatCurrency(product.officialPrice)
                    : "-"}
                </td>
                <td className="px-4 py-3 text-right">
                  {product.amazonPrice
                    ? formatCurrency(product.amazonPrice)
                    : "-"}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={cn("text-xs font-medium", stockInfo.color)}>
                    {stockInfo.label}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {product.estimatedProfit != null ? (
                    <div>
                      <span
                        className={cn(
                          "font-medium",
                          product.estimatedProfit > 0
                            ? "text-green-600"
                            : "text-red-600"
                        )}
                      >
                        {formatCurrency(product.estimatedProfit)}
                      </span>
                      {product.profitMargin != null && (
                        <p className="text-xs text-muted-foreground">
                          ({product.profitMargin}%)
                        </p>
                      )}
                    </div>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    <span
                      className={cn(
                        "text-xs font-bold",
                        product.trendScore >= 70
                          ? "text-red-600"
                          : product.trendScore >= 40
                          ? "text-orange-500"
                          : "text-gray-500"
                      )}
                    >
                      {product.trendScore}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                      statusInfo.color
                    )}
                  >
                    {statusInfo.label}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="relative flex items-center justify-center gap-1">
                    <button
                      onClick={() => onViewDetail(product.id)}
                      className="rounded p-1 hover:bg-gray-100"
                      title="詳細"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    {product.status === "PROFITABLE" && (
                      <button
                        onClick={() => onPurchase(product)}
                        className="rounded p-1 text-green-600 hover:bg-green-50"
                        title="仕入れ"
                      >
                        <ShoppingCart className="h-4 w-4" />
                      </button>
                    )}
                    {product.asin && (
                      <a
                        href={`https://www.amazon.co.jp/dp/${product.asin}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded p-1 hover:bg-gray-100"
                        title="Amazon"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                    <div className="relative">
                      <button
                        onClick={() =>
                          setMenuOpen(menuOpen === product.id ? null : product.id)
                        }
                        className="rounded p-1 hover:bg-gray-100"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                      {menuOpen === product.id && (
                        <div className="absolute right-0 top-full z-10 mt-1 w-32 rounded-md border bg-white py-1 shadow-lg">
                          {["SKIPPED", "EXPIRED"].map((s) => (
                            <button
                              key={s}
                              onClick={() => {
                                onStatusChange(product.id, s);
                                setMenuOpen(null);
                              }}
                              className="block w-full px-3 py-1.5 text-left text-xs hover:bg-gray-50"
                            >
                              {statusLabels[s]?.label || s}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {products.length === 0 && (
        <div className="py-12 text-center text-sm text-muted-foreground">
          商品が見つかりません
        </div>
      )}
    </div>
  );
}
