"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ProductTable } from "@/components/sourcing/product-table";
import { PurchaseDialog } from "@/components/sourcing/purchase-dialog";
import { ResearchButton } from "@/components/sourcing/research-button";
import { Plus, Filter } from "lucide-react";

interface Product {
  id: string;
  name: string;
  asin: string | null;
  imageUrl: string | null;
  category: string | null;
  officialUrl: string | null;
  officialPrice: number | null;
  amazonPrice: number | null;
  amazonStock: string;
  estimatedProfit: number | null;
  profitMargin: number | null;
  trendScore: number;
  status: string;
  detectedAt: string;
  trendSources: Array<{
    id: string;
    sourceType: string;
    sourceTitle: string | null;
    sourceUrl: string | null;
  }>;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function SourcingProductsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [purchaseProduct, setPurchaseProduct] = useState<Product | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProductName, setNewProductName] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  // フィルター
  const [statusFilter, setStatusFilter] = useState(
    searchParams.get("status") || ""
  );
  const [stockFilter, setStockFilter] = useState(
    searchParams.get("amazonStock") || ""
  );
  const [searchQuery, setSearchQuery] = useState(
    searchParams.get("search") || ""
  );
  const [showFilter, setShowFilter] = useState(false);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (stockFilter) params.set("amazonStock", stockFilter);
    if (searchQuery) params.set("search", searchQuery);
    params.set("page", String(pagination.page));
    params.set("sortBy", searchParams.get("sortBy") || "trendScore");
    params.set("order", searchParams.get("order") || "desc");

    try {
      const res = await fetch(`/api/sourcing/products?${params}`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products);
        setPagination(data.pagination);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [statusFilter, stockFilter, searchQuery, pagination.page, searchParams]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  async function handleStatusChange(productId: string, status: string) {
    await fetch(`/api/sourcing/products/${productId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchProducts();
  }

  async function handleAddProduct(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);

    try {
      const res = await fetch("/api/sourcing/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newProductName }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "追加に失敗しました");
      }

      setNewProductName("");
      setShowAddForm(false);
      fetchProducts();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "エラー");
    }
  }

  function handleViewDetail(id: string) {
    router.push(`/sourcing/products?search=${id}`);
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">商品一覧</h1>
          <p className="text-sm text-muted-foreground">
            {pagination.total}件の商品
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ResearchButton onComplete={fetchProducts} />
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
          >
            <Plus className="h-4 w-4" />
            手動追加
          </button>
        </div>
      </div>

      {/* 手動追加フォーム */}
      {showAddForm && (
        <div className="rounded-lg border bg-white p-4">
          <form onSubmit={handleAddProduct} className="flex items-end gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium">商品名</label>
              <input
                type="text"
                value={newProductName}
                onChange={(e) => setNewProductName(e.target.value)}
                required
                placeholder="商品名を入力..."
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              className="rounded-md bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90"
            >
              追加
            </button>
          </form>
          {addError && <p className="mt-2 text-sm text-red-600">{addError}</p>}
        </div>
      )}

      {/* フィルター */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="商品名・ASIN・JANで検索..."
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={() => setShowFilter(!showFilter)}
            className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
          >
            <Filter className="h-4 w-4" />
            フィルター
          </button>
        </div>

        {showFilter && (
          <div className="flex flex-wrap gap-3 rounded-lg border bg-gray-50 p-3">
            <div>
              <label className="mb-1 block text-xs font-medium">ステータス</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-md border px-2 py-1 text-sm"
              >
                <option value="">すべて</option>
                <option value="DETECTED">検出済み</option>
                <option value="PROFITABLE">利益あり</option>
                <option value="PURCHASING">仕入れ中</option>
                <option value="IN_STOCK">在庫あり</option>
                <option value="LISTED">出品中</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Amazon在庫</label>
              <select
                value={stockFilter}
                onChange={(e) => setStockFilter(e.target.value)}
                className="rounded-md border px-2 py-1 text-sm"
              >
                <option value="">すべて</option>
                <option value="OUT_OF_STOCK">在庫切れ</option>
                <option value="LOW_STOCK">在庫わずか</option>
                <option value="IN_STOCK">在庫あり</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* 商品テーブル */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="text-sm text-muted-foreground">読み込み中...</div>
        </div>
      ) : (
        <ProductTable
          products={products}
          onViewDetail={handleViewDetail}
          onPurchase={(product) => setPurchaseProduct(product)}
          onStatusChange={handleStatusChange}
        />
      )}

      {/* ページネーション */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() =>
              setPagination((p) => ({ ...p, page: Math.max(1, p.page - 1) }))
            }
            disabled={pagination.page <= 1}
            className="rounded-md border px-3 py-1 text-sm disabled:opacity-50"
          >
            前へ
          </button>
          <span className="text-sm text-muted-foreground">
            {pagination.page} / {pagination.totalPages}
          </span>
          <button
            onClick={() =>
              setPagination((p) => ({
                ...p,
                page: Math.min(p.totalPages, p.page + 1),
              }))
            }
            disabled={pagination.page >= pagination.totalPages}
            className="rounded-md border px-3 py-1 text-sm disabled:opacity-50"
          >
            次へ
          </button>
        </div>
      )}

      {/* 仕入れダイアログ */}
      {purchaseProduct && (
        <PurchaseDialog
          product={purchaseProduct}
          open={!!purchaseProduct}
          onClose={() => setPurchaseProduct(null)}
          onSuccess={fetchProducts}
        />
      )}
    </div>
  );
}
