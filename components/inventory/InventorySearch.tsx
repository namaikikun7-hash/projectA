"use client";

import { useState, useRef } from "react";
import { Search, ExternalLink, Package, AlertCircle, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { InventorySearchResult, InventoryItem } from "@/app/api/inventory-search/route";

const SITE_COLORS: Record<string, string> = {
  rakuten: "bg-red-50 border-red-200",
  yahoo: "bg-purple-50 border-purple-200",
};

const SITE_BADGE_COLORS: Record<string, string> = {
  "楽天市場": "bg-red-100 text-red-800",
  "Yahoo!ショッピング": "bg-purple-100 text-purple-800",
};

const QUICK_LINK_COLORS: Record<string, string> = {
  "Amazon.co.jp": "border-orange-300 hover:bg-orange-50 text-orange-700",
  "楽天市場": "border-red-300 hover:bg-red-50 text-red-700",
  "Yahoo!ショッピング": "border-purple-300 hover:bg-purple-50 text-purple-700",
  "メルカリ": "border-pink-300 hover:bg-pink-50 text-pink-700",
  "ヤフオク!": "border-blue-300 hover:bg-blue-50 text-blue-700",
  "PayPayモール": "border-yellow-300 hover:bg-yellow-50 text-yellow-700",
};

function formatPrice(price: number | null): string {
  if (price === null) return "価格不明";
  return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY" }).format(price);
}

function ItemCard({ item }: { item: InventoryItem }) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`block rounded-lg border p-4 transition-shadow hover:shadow-md ${SITE_COLORS[item.siteLogo] ?? "bg-gray-50 border-gray-200"}`}
    >
      <div className="flex gap-3">
        {item.imageUrl && (
          <img
            src={item.imageUrl}
            alt={item.productName}
            className="h-16 w-16 rounded object-contain flex-shrink-0 bg-white border"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${SITE_BADGE_COLORS[item.site] ?? "bg-gray-100 text-gray-700"}`}>
              {item.site}
            </span>
            {item.inStock ? (
              <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                <CheckCircle className="h-3 w-3" /> 在庫あり
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-red-500 font-medium">
                <XCircle className="h-3 w-3" /> 在庫なし
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-gray-800 line-clamp-2">{item.productName}</p>
          {item.shopName && (
            <p className="text-xs text-gray-500 mt-0.5 truncate">出品店: {item.shopName}</p>
          )}
          <p className="text-base font-bold text-gray-900 mt-1">{formatPrice(item.price)}</p>
        </div>
        <ExternalLink className="h-4 w-4 text-gray-400 flex-shrink-0 mt-1" />
      </div>
    </a>
  );
}

export function InventorySearch() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<InventorySearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`/api/inventory-search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "検索に失敗しました");
      setResult(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const hasApiResults = (result?.items.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      {/* 検索フォーム */}
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="商品名を入力してください (例: Nintendo Switch、AirPods Pro)"
                className="pl-9"
                disabled={loading}
              />
            </div>
            <Button type="submit" disabled={loading || !query.trim()}>
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> 検索中...</>
              ) : (
                <><Search className="h-4 w-4" /> 在庫検索</>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* エラー表示 */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* 結果 */}
      {result && (
        <div className="space-y-6">
          {/* API設定エラー通知 */}
          {result.errors.length > 0 && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800 space-y-1">
              <p className="font-medium flex items-center gap-1">
                <AlertCircle className="h-4 w-4" /> 一部のAPIキーが未設定のため検索できませんでした
              </p>
              {result.errors.map((e) => (
                <p key={e.site} className="ml-5 text-xs">・{e.site}: {e.message}</p>
              ))}
              <p className="ml-5 text-xs">.env に RAKUTEN_APP_ID / YAHOO_APP_ID を設定すると自動で在庫取得できます。</p>
            </div>
          )}

          {/* クイックリンク */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ExternalLink className="h-4 w-4" />
                「{result.query}」を各サイトで確認
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {result.quickLinks.map((link) => (
                  <a
                    key={link.site}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${QUICK_LINK_COLORS[link.site] ?? "border-gray-300 hover:bg-gray-50 text-gray-700"}`}
                  >
                    {link.site}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* API検索結果 */}
          {hasApiResults ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  在庫あり商品
                  <Badge variant="secondary">{result.items.length}件</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  {result.items.map((item, i) => (
                    <ItemCard key={i} item={item} />
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            result.errors.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                <Package className="h-10 w-10" />
                <p className="text-sm">「{result.query}」の在庫が見つかりませんでした</p>
                <p className="text-xs">上のクイックリンクから各サイトで直接ご確認ください</p>
              </div>
            )
          )}
        </div>
      )}

      {/* 初期状態の説明 */}
      {!result && !loading && !error && (
        <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
          <Package className="h-12 w-12 opacity-40" />
          <p className="text-sm font-medium">商品名を入力して在庫を検索</p>
          <p className="text-xs text-center max-w-md">
            楽天市場・Yahoo!ショッピングの在庫を自動取得します。<br />
            Amazon・メルカリ・ヤフオクなど他サイトはクイックリンクから確認できます。
          </p>
        </div>
      )}
    </div>
  );
}
