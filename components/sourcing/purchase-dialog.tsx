"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/utils";

interface Product {
  id: string;
  name: string;
  officialPrice: number | null;
  officialUrl: string | null;
}

interface PurchaseDialogProps {
  product: Product;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function PurchaseDialog({
  product,
  open,
  onClose,
  onSuccess,
}: PurchaseDialogProps) {
  const [purchaseSite, setPurchaseSite] = useState("");
  const [purchaseUrl, setPurchaseUrl] = useState(product.officialUrl || "");
  const [purchasePrice, setPurchasePrice] = useState(
    product.officialPrice?.toString() || ""
  );
  const [quantity, setQuantity] = useState("1");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const token = sessionStorage.getItem("sourcing-token") || "";
      const res = await fetch("/api/sourcing/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-sourcing-token": token },
        body: JSON.stringify({
          productId: product.id,
          purchaseSite,
          purchaseUrl: purchaseUrl || undefined,
          purchasePrice: Number(purchasePrice),
          quantity: Number(quantity),
          notes: notes || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "注文作成に失敗しました");
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  }

  const totalCost = Number(purchasePrice || 0) * Number(quantity || 1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-bold">仕入れ注文を作成</h2>
        <p className="mb-4 text-sm text-muted-foreground">{product.name}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">
              仕入先サイト名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={purchaseSite}
              onChange={(e) => setPurchaseSite(e.target.value)}
              required
              placeholder="例: 公式オンラインショップ、楽天市場"
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">仕入先URL</label>
            <input
              type="url"
              value={purchaseUrl}
              onChange={(e) => setPurchaseUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium">
                仕入れ単価 <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                required
                min={1}
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">数量</label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                min={1}
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="rounded-md bg-gray-50 p-3">
            <p className="text-sm">
              合計: <span className="font-bold">{formatCurrency(totalCost)}</span>
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">メモ</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={submitting || !purchaseSite || !purchasePrice}
              className="rounded-md bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {submitting ? "作成中..." : "注文を作成"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
