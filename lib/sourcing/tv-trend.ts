/**
 * テレビ紹介商品の検出
 * Yahoo!リアルタイム検索やTVer関連情報からトレンドを検出
 */

export interface TvTrendItem {
  productName: string;
  programName: string;
  broadcastDate: string;
  network: string | null;
  description: string | null;
  searchVolume: number; // 検索ボリューム（推定）
  sourceUrl: string | null;
}

export interface TvTrendResult {
  items: TvTrendItem[];
  fetchedAt: string;
}

/**
 * Yahoo!リアルタイム検索からTV紹介商品を検出
 * 「テレビで紹介」「TV紹介」「番組で」等のキーワードで検索
 */
export async function fetchTvTrendProducts(): Promise<TvTrendResult> {
  const keywords = [
    "テレビで紹介 商品",
    "TV紹介 人気",
    "番組で紹介 品切れ",
    "マツコの知らない世界",
    "王様のブランチ 商品",
    "ヒルナンデス 商品",
    "ZIP 紹介 商品",
    "めざましテレビ 紹介",
  ];

  const items: TvTrendItem[] = [];

  for (const keyword of keywords) {
    try {
      // Yahoo!リアルタイム検索のRSS/APIは公式には公開されていないため
      // Google Custom Search API を代替として使用
      const searchItems = await searchGoogleForTvProducts(keyword);
      items.push(...searchItems);
    } catch {
      continue;
    }
  }

  // 重複除去（商品名ベース）
  const uniqueItems = items.reduce((acc: TvTrendItem[], item) => {
    if (!acc.some((i) => i.productName === item.productName)) {
      acc.push(item);
    }
    return acc;
  }, []);

  return {
    items: uniqueItems,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Google Custom Search APIでTV紹介商品を検索
 */
async function searchGoogleForTvProducts(keyword: string): Promise<TvTrendItem[]> {
  const apiKey = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;
  const searchEngineId = process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID;

  if (!apiKey || !searchEngineId) {
    // APIキーがない場合はスキップ
    return [];
  }

  const params = new URLSearchParams({
    key: apiKey,
    cx: searchEngineId,
    q: keyword,
    dateRestrict: "d7", // 直近7日間
    lr: "lang_ja",
    num: "10",
  });

  const res = await fetch(
    `https://www.googleapis.com/customsearch/v1?${params}`
  );

  if (!res.ok) return [];

  const data = await res.json();
  const searchItems = (data.items || []) as Array<Record<string, unknown>>;

  return searchItems
    .filter((item) => {
      const title = (item.title as string) || "";
      const snippet = (item.snippet as string) || "";
      // TV関連の記事のみフィルタ
      return (
        /テレビ|TV|番組|紹介|放送/.test(title) ||
        /テレビ|TV|番組|紹介|放送/.test(snippet)
      );
    })
    .map((item) => {
      const title = (item.title as string) || "";
      // タイトルから商品名と番組名を抽出
      const productName = extractProductFromTitle(title);
      const programName = extractProgramFromTitle(title);

      return {
        productName: productName || title,
        programName: programName || "不明",
        broadcastDate: new Date().toISOString().split("T")[0],
        network: null,
        description: (item.snippet as string) || null,
        searchVolume: 0,
        sourceUrl: (item.link as string) || null,
      };
    });
}

/**
 * 記事タイトルから商品名を抽出
 */
function extractProductFromTitle(title: string): string | null {
  // 「」『』【】で囲まれた部分を抽出
  const match = title.match(/[「『【](.+?)[」』】]/);
  if (match) return match[1];

  // 「の」や「を」の前の部分を商品名候補として抽出
  const productMatch = title.match(/(.+?)(?:を紹介|が話題|が人気|で紹介)/);
  if (productMatch) return productMatch[1].trim();

  return null;
}

/**
 * 記事タイトルからTV番組名を抽出
 */
function extractProgramFromTitle(title: string): string | null {
  const programs = [
    "マツコの知らない世界",
    "王様のブランチ",
    "ヒルナンデス",
    "ZIP!",
    "めざましテレビ",
    "世界一受けたい授業",
    "有吉ゼミ",
    "アメトーーク",
    "ホンマでっか!?TV",
    "所さんお届けモノです",
    "サタデープラス",
    "がっちりマンデー",
    "カンブリア宮殿",
    "WBS",
  ];

  for (const program of programs) {
    if (title.includes(program)) return program;
  }

  return null;
}

/**
 * 生産終了・販売終了情報を検索
 */
export async function searchDiscontinuedProducts(): Promise<TvTrendItem[]> {
  const keywords = [
    "生産終了 人気",
    "販売終了 まとめ買い",
    "廃盤 入手困難",
    "限定品 売り切れ",
  ];

  const items: TvTrendItem[] = [];

  for (const keyword of keywords) {
    try {
      const results = await searchGoogleForTvProducts(keyword);
      items.push(
        ...results.map((item) => ({
          ...item,
          programName: "生産終了情報",
        }))
      );
    } catch {
      continue;
    }
  }

  return items;
}
