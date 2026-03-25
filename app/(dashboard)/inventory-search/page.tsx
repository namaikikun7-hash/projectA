import { InventorySearch } from "@/components/inventory/InventorySearch";
import { ShoppingCart } from "lucide-react";

export const metadata = { title: "在庫検索" };

export default function InventorySearchPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <ShoppingCart className="h-6 w-6" />
          在庫検索ツール
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          商品名を入力して楽天市場・Yahoo!ショッピング・Amazon・メルカリなどの在庫状況を一括確認できます
        </p>
      </div>
      <InventorySearch />
    </div>
  );
}
