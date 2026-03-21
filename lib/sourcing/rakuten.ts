/**
 * 楽天市場ランキングAPI連携
 * https://webservice.rakuten.co.jp/documentation/ichiba-ranking
 */

export interface RakutenRankingItem {
  rank: number;
  itemName: string;
  itemCode: string;
  itemPrice: number;
  itemUrl: string;
  imageUrl: string;
  shopName: string;
  genreId: string;
  reviewCount: number;
  reviewAverage: number;
}

export interface RakutenRankingResponse {
  items: RakutenRankingItem[];
  lastBuildDate: string;
  title: string;
}

const RAKUTEN_APP_ID = process.env.RAKUTEN_APP_ID || "";
const RAKUTEN_BASE_URL = "https://app.rakuten.co.jp/services/api";

/**
 * 楽天ランキングを取得
 * @param genreId ジャンルID（省略で総合ランキング）
 * @param page ページ番号
 */
export async function fetchRakutenRanking(
  genreId?: string,
  page: number = 1
): Promise<RakutenRankingResponse> {
  if (!RAKUTEN_APP_ID) {
    throw new Error("RAKUTEN_APP_ID が設定されていません");
  }

  const params = new URLSearchParams({
    applicationId: RAKUTEN_APP_ID,
    format: "json",
    page: String(page),
  });

  if (genreId) {
    params.set("genreId", genreId);
  }

  const url = `${RAKUTEN_BASE_URL}/IchibaItem/Ranking/20220601?${params}`;
  const res = await fetch(url, { next: { revalidate: 600 } }); // 10分キャッシュ

  if (!res.ok) {
    throw new Error(`楽天API エラー: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();

  return {
    title: data.title || "楽天ランキング",
    lastBuildDate: data.lastBuildDate || new Date().toISOString(),
    items: (data.Items || []).map((wrapper: Record<string, Record<string, unknown>>, index: number) => {
      const item = wrapper.Item || wrapper;
      return {
        rank: index + 1,
        itemName: item.itemName as string || "",
        itemCode: item.itemCode as string || "",
        itemPrice: Number(item.itemPrice) || 0,
        itemUrl: item.itemUrl as string || "",
        imageUrl: (item.mediumImageUrls as Array<{ imageUrl: string }>)?.[0]?.imageUrl || "",
        shopName: item.shopName as string || "",
        genreId: item.genreId as string || "",
        reviewCount: Number(item.reviewCount) || 0,
        reviewAverage: Number(item.reviewAverage) || 0,
      };
    }),
  };
}

/**
 * 楽天商品検索
 * @param keyword 検索キーワード
 */
export async function searchRakutenItems(
  keyword: string,
  page: number = 1
): Promise<RakutenRankingItem[]> {
  if (!RAKUTEN_APP_ID) {
    throw new Error("RAKUTEN_APP_ID が設定されていません");
  }

  const params = new URLSearchParams({
    applicationId: RAKUTEN_APP_ID,
    format: "json",
    keyword,
    page: String(page),
    sort: "-reviewCount", // レビュー数が多い順
    hits: "30",
  });

  const url = `${RAKUTEN_BASE_URL}/IchibaItem/Search/20220601?${params}`;
  const res = await fetch(url, { next: { revalidate: 300 } });

  if (!res.ok) {
    throw new Error(`楽天API エラー: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();

  return (data.Items || []).map((wrapper: Record<string, Record<string, unknown>>, index: number) => {
    const item = wrapper.Item || wrapper;
    return {
      rank: index + 1,
      itemName: item.itemName as string || "",
      itemCode: item.itemCode as string || "",
      itemPrice: Number(item.itemPrice) || 0,
      itemUrl: item.itemUrl as string || "",
      imageUrl: (item.mediumImageUrls as Array<{ imageUrl: string }>)?.[0]?.imageUrl || "",
      shopName: item.shopName as string || "",
      genreId: item.genreId as string || "",
      reviewCount: Number(item.reviewCount) || 0,
      reviewAverage: Number(item.reviewAverage) || 0,
    };
  });
}

/**
 * 主要ジャンルID一覧（よく転売で利益が出るカテゴリ）
 */
export const POPULAR_GENRE_IDS = {
  "総合": "0",
  "おもちゃ・ゲーム": "101164",
  "家電": "100026",
  "美容・コスメ": "100371",
  "食品": "100227",
  "日用品": "215783",
  "ベビー・キッズ": "100533",
  "スポーツ": "101070",
  "ペット": "101213",
} as const;
