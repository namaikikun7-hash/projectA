import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export interface InventoryItem {
  site: string;
  siteLogo: string;
  productName: string;
  price: number | null;
  inStock: boolean;
  url: string;
  imageUrl?: string;
  shopName?: string;
}

export interface InventorySearchResult {
  query: string;
  items: InventoryItem[];
  quickLinks: { site: string; url: string }[];
  errors: { site: string; message: string }[];
}

async function searchRakuten(keyword: string): Promise<{ items: InventoryItem[]; error?: string }> {
  const appId = process.env.RAKUTEN_APP_ID;
  if (!appId) return { items: [], error: "RAKUTEN_APP_ID未設定" };

  try {
    const params = new URLSearchParams({
      applicationId: appId,
      keyword,
      hits: "10",
      availability: "1", // 在庫あり
      sort: "+itemPrice",
    });

    const res = await fetch(
      `https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601?${params}`,
      { next: { revalidate: 60 } }
    );

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const items: InventoryItem[] = (data.Items ?? []).slice(0, 5).map((entry: Record<string, unknown>) => {
      const item = entry.Item as Record<string, unknown>;
      return {
        site: "楽天市場",
        siteLogo: "rakuten",
        productName: String(item.itemName ?? "").slice(0, 60),
        price: typeof item.itemPrice === "number" ? item.itemPrice : null,
        inStock: true,
        url: String(item.itemUrl ?? ""),
        imageUrl: String((item.mediumImageUrls as { imageUrl: string }[])?.[0]?.imageUrl ?? ""),
        shopName: String(item.shopName ?? ""),
      };
    });

    return { items };
  } catch (e) {
    return { items: [], error: `楽天API エラー: ${(e as Error).message}` };
  }
}

async function searchYahooShopping(keyword: string): Promise<{ items: InventoryItem[]; error?: string }> {
  const appId = process.env.YAHOO_APP_ID;
  if (!appId) return { items: [], error: "YAHOO_APP_ID未設定" };

  try {
    const params = new URLSearchParams({
      appid: appId,
      query: keyword,
      results: "10",
      in_stock: "true",
      sort: "+price",
    });

    const res = await fetch(
      `https://shopping.yahooapis.jp/ShoppingWebService/V3/itemSearch?${params}`,
      { next: { revalidate: 60 } }
    );

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const hits = data.hits ?? [];
    const items: InventoryItem[] = hits.slice(0, 5).map((item: Record<string, unknown>) => ({
      site: "Yahoo!ショッピング",
      siteLogo: "yahoo",
      productName: String(item.name ?? "").slice(0, 60),
      price: typeof item.price === "number" ? item.price : null,
      inStock: (item.inStock as boolean) ?? false,
      url: String(item.url ?? ""),
      imageUrl: String((item.image as Record<string, string>)?.small ?? ""),
      shopName: String((item.seller as Record<string, string>)?.name ?? ""),
    }));

    return { items };
  } catch (e) {
    return { items: [], error: `Yahoo!API エラー: ${(e as Error).message}` };
  }
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const keyword = req.nextUrl.searchParams.get("q")?.trim();
  if (!keyword) return NextResponse.json({ error: "キーワードを入力してください" }, { status: 400 });

  const encoded = encodeURIComponent(keyword);

  const [rakutenResult, yahooResult] = await Promise.all([
    searchRakuten(keyword),
    searchYahooShopping(keyword),
  ]);

  const allItems = [...rakutenResult.items, ...yahooResult.items];
  const errors: { site: string; message: string }[] = [];
  if (rakutenResult.error) errors.push({ site: "楽天市場", message: rakutenResult.error });
  if (yahooResult.error) errors.push({ site: "Yahoo!ショッピング", message: yahooResult.error });

  const quickLinks = [
    { site: "Amazon.co.jp", url: `https://www.amazon.co.jp/s?k=${encoded}` },
    { site: "楽天市場", url: `https://search.rakuten.co.jp/search/mall/${encoded}/` },
    { site: "Yahoo!ショッピング", url: `https://shopping.yahoo.co.jp/search?p=${encoded}` },
    { site: "メルカリ", url: `https://jp.mercari.com/search?keyword=${encoded}&status=on_sale` },
    { site: "ヤフオク!", url: `https://auctions.yahoo.co.jp/search/search?p=${encoded}&exflg=1&b=1&n=50` },
    { site: "PayPayモール", url: `https://paypaymall.yahoo.co.jp/search?p=${encoded}` },
  ];

  const result: InventorySearchResult = {
    query: keyword,
    items: allItems,
    quickLinks,
    errors,
  };

  return NextResponse.json(result);
}
