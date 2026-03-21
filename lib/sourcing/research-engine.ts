/**
 * 商品リサーチエンジン
 * 複数ソースからの情報を統合し、仕入れ判断を自動化
 */

import { prisma } from "@/lib/prisma";
import { fetchRakutenRanking, POPULAR_GENRE_IDS, type RakutenRankingItem } from "./rakuten";
import { searchAmazonProducts, getProductByAsin, calculateProfit, type AmazonProductInfo } from "./amazon";
import { searchResaleOpportunities, calculateTrendScore, type TweetProduct } from "./twitter";
import { fetchTvTrendProducts, searchDiscontinuedProducts, type TvTrendItem } from "./tv-trend";

export interface ResearchResult {
  newProducts: number;
  updatedProducts: number;
  errors: string[];
  sources: {
    rakuten: number;
    twitter: number;
    tv: number;
    discontinued: number;
  };
}

/**
 * 全ソースからトレンド商品をリサーチして DB に保存
 */
export async function runFullResearch(): Promise<ResearchResult> {
  const result: ResearchResult = {
    newProducts: 0,
    updatedProducts: 0,
    errors: [],
    sources: { rakuten: 0, twitter: 0, tv: 0, discontinued: 0 },
  };

  // 並行してリサーチ実行
  const [rakutenResult, twitterResult, tvResult, discontinuedResult] =
    await Promise.allSettled([
      researchFromRakuten(),
      researchFromTwitter(),
      researchFromTv(),
      researchDiscontinued(),
    ]);

  // 楽天結果
  if (rakutenResult.status === "fulfilled") {
    result.sources.rakuten = rakutenResult.value.count;
    result.newProducts += rakutenResult.value.newProducts;
    result.updatedProducts += rakutenResult.value.updatedProducts;
  } else {
    result.errors.push(`楽天: ${rakutenResult.reason}`);
  }

  // Twitter結果
  if (twitterResult.status === "fulfilled") {
    result.sources.twitter = twitterResult.value.count;
    result.newProducts += twitterResult.value.newProducts;
    result.updatedProducts += twitterResult.value.updatedProducts;
  } else {
    result.errors.push(`X(Twitter): ${twitterResult.reason}`);
  }

  // TV結果
  if (tvResult.status === "fulfilled") {
    result.sources.tv = tvResult.value.count;
    result.newProducts += tvResult.value.newProducts;
    result.updatedProducts += tvResult.value.updatedProducts;
  } else {
    result.errors.push(`TV: ${tvResult.reason}`);
  }

  // 生産終了結果
  if (discontinuedResult.status === "fulfilled") {
    result.sources.discontinued = discontinuedResult.value.count;
    result.newProducts += discontinuedResult.value.newProducts;
    result.updatedProducts += discontinuedResult.value.updatedProducts;
  } else {
    result.errors.push(`生産終了: ${discontinuedResult.reason}`);
  }

  return result;
}

interface SourceResult {
  count: number;
  newProducts: number;
  updatedProducts: number;
}

/**
 * 楽天ランキングからリサーチ
 */
async function researchFromRakuten(): Promise<SourceResult> {
  let newProducts = 0;
  let updatedProducts = 0;
  let totalCount = 0;

  for (const [, genreId] of Object.entries(POPULAR_GENRE_IDS)) {
    try {
      const ranking = await fetchRakutenRanking(genreId);

      for (const item of ranking.items.slice(0, 10)) {
        totalCount++;
        const result = await upsertFromRakuten(item);
        if (result === "new") newProducts++;
        if (result === "updated") updatedProducts++;
      }
    } catch {
      continue;
    }
  }

  return { count: totalCount, newProducts, updatedProducts };
}

/**
 * Xからリサーチ
 */
async function researchFromTwitter(): Promise<SourceResult> {
  const searchResult = await searchResaleOpportunities();
  let newProducts = 0;
  let updatedProducts = 0;

  for (const tweet of searchResult.tweets) {
    if (!tweet.extractedProductName) continue;

    const result = await upsertFromTwitter(tweet);
    if (result === "new") newProducts++;
    if (result === "updated") updatedProducts++;
  }

  return { count: searchResult.totalCount, newProducts, updatedProducts };
}

/**
 * TV紹介からリサーチ
 */
async function researchFromTv(): Promise<SourceResult> {
  const tvResult = await fetchTvTrendProducts();
  let newProducts = 0;
  let updatedProducts = 0;

  for (const item of tvResult.items) {
    const result = await upsertFromTv(item);
    if (result === "new") newProducts++;
    if (result === "updated") updatedProducts++;
  }

  return { count: tvResult.items.length, newProducts, updatedProducts };
}

/**
 * 生産終了商品リサーチ
 */
async function researchDiscontinued(): Promise<SourceResult> {
  const items = await searchDiscontinuedProducts();
  let newProducts = 0;
  let updatedProducts = 0;

  for (const item of items) {
    const result = await upsertFromTv(item, "DISCONTINUATION");
    if (result === "new") newProducts++;
    if (result === "updated") updatedProducts++;
  }

  return { count: items.length, newProducts, updatedProducts };
}

/**
 * 楽天商品をDBに登録/更新
 */
async function upsertFromRakuten(
  item: RakutenRankingItem
): Promise<"new" | "updated" | "skipped"> {
  // 同名商品が既に存在するか確認
  const existing = await prisma.sourcingProduct.findFirst({
    where: {
      OR: [
        { name: { contains: item.itemName.slice(0, 30) } },
      ],
    },
  });

  if (existing) {
    // トレンドソースを追加
    await prisma.trendSource.upsert({
      where: { id: `rakuten-${existing.id}-${item.itemCode}` },
      create: {
        id: `rakuten-${existing.id}-${item.itemCode}`,
        productId: existing.id,
        sourceType: "RAKUTEN_RANKING",
        sourceUrl: item.itemUrl,
        sourceTitle: `楽天ランキング ${item.rank}位`,
        mentionCount: 1,
      },
      update: {
        mentionCount: { increment: 1 },
      },
    });

    // トレンドスコアを更新
    await prisma.sourcingProduct.update({
      where: { id: existing.id },
      data: {
        trendScore: Math.min(100, existing.trendScore + 5),
        officialPrice: item.itemPrice || existing.officialPrice,
      },
    });

    return "updated";
  }

  // 新規商品を登録
  const product = await prisma.sourcingProduct.create({
    data: {
      name: item.itemName,
      imageUrl: item.imageUrl,
      officialUrl: item.itemUrl,
      officialPrice: item.itemPrice,
      trendScore: Math.min(100, item.rank <= 3 ? 60 : item.rank <= 10 ? 40 : 20),
      status: "DETECTED",
      trendSources: {
        create: {
          sourceType: "RAKUTEN_RANKING",
          sourceUrl: item.itemUrl,
          sourceTitle: `楽天ランキング ${item.rank}位 (${item.shopName})`,
        },
      },
    },
  });

  // Amazon価格と在庫を調査
  await checkAmazonForProduct(product.id, item.itemName);

  return "new";
}

/**
 * Xの情報をDBに登録/更新
 */
async function upsertFromTwitter(
  tweet: TweetProduct
): Promise<"new" | "updated" | "skipped"> {
  const productName = tweet.extractedProductName;
  if (!productName) return "skipped";

  const existing = await prisma.sourcingProduct.findFirst({
    where: { name: { contains: productName.slice(0, 20) } },
  });

  const trendScore = calculateTrendScore(tweet);

  if (existing) {
    await prisma.trendSource.create({
      data: {
        productId: existing.id,
        sourceType: "TWITTER_BUZZ",
        sourceUrl: tweet.url,
        sourceTitle: tweet.text.slice(0, 200),
        mentionCount: tweet.retweetCount + tweet.likeCount,
      },
    });

    await prisma.sourcingProduct.update({
      where: { id: existing.id },
      data: {
        trendScore: Math.min(100, Math.max(existing.trendScore, trendScore)),
      },
    });

    return "updated";
  }

  const product = await prisma.sourcingProduct.create({
    data: {
      name: productName,
      trendScore,
      status: "DETECTED",
      trendSources: {
        create: {
          sourceType: "TWITTER_BUZZ",
          sourceUrl: tweet.url,
          sourceTitle: tweet.text.slice(0, 200),
          mentionCount: tweet.retweetCount + tweet.likeCount,
        },
      },
    },
  });

  await checkAmazonForProduct(product.id, productName);

  return "new";
}

/**
 * TV紹介情報をDBに登録/更新
 */
async function upsertFromTv(
  item: TvTrendItem,
  sourceType: "TV_FEATURE" | "DISCONTINUATION" = "TV_FEATURE"
): Promise<"new" | "updated" | "skipped"> {
  if (!item.productName) return "skipped";

  const existing = await prisma.sourcingProduct.findFirst({
    where: { name: { contains: item.productName.slice(0, 20) } },
  });

  if (existing) {
    await prisma.trendSource.create({
      data: {
        productId: existing.id,
        sourceType,
        sourceUrl: item.sourceUrl,
        sourceTitle: `${item.programName}: ${item.productName}`,
      },
    });

    const scoreBoost = sourceType === "TV_FEATURE" ? 30 : 25;
    await prisma.sourcingProduct.update({
      where: { id: existing.id },
      data: {
        trendScore: Math.min(100, existing.trendScore + scoreBoost),
      },
    });

    return "updated";
  }

  const baseScore = sourceType === "TV_FEATURE" ? 50 : 40;

  const product = await prisma.sourcingProduct.create({
    data: {
      name: item.productName,
      trendScore: baseScore,
      status: "DETECTED",
      notes: item.description,
      trendSources: {
        create: {
          sourceType,
          sourceUrl: item.sourceUrl,
          sourceTitle: `${item.programName}: ${item.productName}`,
        },
      },
    },
  });

  await checkAmazonForProduct(product.id, item.productName);

  return "new";
}

/**
 * Amazon で商品を検索して価格・在庫情報を更新
 */
async function checkAmazonForProduct(
  productId: string,
  searchKeyword: string
): Promise<void> {
  try {
    const searchResult = await searchAmazonProducts(searchKeyword);
    if (searchResult.items.length === 0) return;

    const amazonItem = searchResult.items[0];
    await updateProductWithAmazonData(productId, amazonItem);
  } catch {
    // Amazon API エラーは無視（後でリトライ可能）
  }
}

/**
 * Amazon データで商品情報を更新
 */
async function updateProductWithAmazonData(
  productId: string,
  amazonData: AmazonProductInfo
): Promise<void> {
  const product = await prisma.sourcingProduct.findUnique({
    where: { id: productId },
  });
  if (!product) return;

  const amazonStockMap: Record<string, "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "UNAVAILABLE" | "UNKNOWN"> = {
    IN_STOCK: "IN_STOCK",
    LOW_STOCK: "LOW_STOCK",
    OUT_OF_STOCK: "OUT_OF_STOCK",
    UNAVAILABLE: "UNAVAILABLE",
    UNKNOWN: "UNKNOWN",
  };

  let estimatedProfit: number | null = null;
  let profitMargin: number | null = null;

  if (amazonData.price && product.officialPrice) {
    const calc = calculateProfit(
      amazonData.price,
      product.officialPrice,
      amazonData.category || undefined
    );
    estimatedProfit = calc.profit;
    profitMargin = calc.margin;
  }

  // ステータスを自動判定
  let newStatus = product.status;
  if (amazonData.stockStatus === "OUT_OF_STOCK" && product.officialPrice) {
    newStatus = "PROFITABLE"; // Amazon品切れ＆仕入れ元あり → 利益見込み
  }

  await prisma.sourcingProduct.update({
    where: { id: productId },
    data: {
      asin: amazonData.asin,
      amazonPrice: amazonData.price,
      amazonStock: amazonStockMap[amazonData.stockStatus] || "UNKNOWN",
      imageUrl: amazonData.imageUrl || product.imageUrl,
      category: amazonData.category || product.category,
      estimatedProfit,
      profitMargin,
      status: newStatus,
    },
  });

  // 価格推移を記録
  await prisma.priceHistory.create({
    data: {
      productId,
      amazonPrice: amazonData.price,
      officialPrice: product.officialPrice,
      amazonStock: amazonStockMap[amazonData.stockStatus] || "UNKNOWN",
    },
  });
}

/**
 * 全商品のAmazon価格・在庫を更新
 */
export async function refreshAmazonData(): Promise<{
  updated: number;
  errors: number;
}> {
  const products = await prisma.sourcingProduct.findMany({
    where: {
      asin: { not: null },
      status: {
        in: ["DETECTED", "RESEARCHING", "PROFITABLE", "PURCHASING", "IN_STOCK"],
      },
    },
    select: { id: true, asin: true },
  });

  let updated = 0;
  let errors = 0;

  for (const product of products) {
    if (!product.asin) continue;
    try {
      const amazonData = await getProductByAsin(product.asin);
      await updateProductWithAmazonData(product.id, amazonData);
      updated++;
    } catch {
      errors++;
    }
    // レート制限対策
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return { updated, errors };
}

/**
 * 仕入れ判断の自動化
 * - Amazon品切れ or 価格高騰
 * - 公式サイトで定価仕入れ可能
 * - 利益率が基準以上
 */
export async function evaluatePurchaseOpportunities(): Promise<{
  opportunities: Array<{
    productId: string;
    name: string;
    officialPrice: number;
    amazonPrice: number | null;
    estimatedProfit: number;
    profitMargin: number;
    recommendation: "STRONG_BUY" | "BUY" | "HOLD" | "SKIP";
    reason: string;
  }>;
}> {
  const products = await prisma.sourcingProduct.findMany({
    where: {
      status: { in: ["DETECTED", "RESEARCHING", "PROFITABLE"] },
      officialPrice: { not: null },
      trendScore: { gte: 30 },
    },
    include: {
      trendSources: true,
      priceHistory: {
        orderBy: { recordedAt: "desc" },
        take: 5,
      },
    },
    orderBy: { trendScore: "desc" },
    take: 50,
  });

  const opportunities = [];

  for (const product of products) {
    if (!product.officialPrice) continue;

    // Amazon品切れ or 価格上昇中
    const isAmazonOutOfStock =
      product.amazonStock === "OUT_OF_STOCK" ||
      product.amazonStock === "UNAVAILABLE";

    // 推定販売価格（Amazon品切れの場合、定価の1.5-3倍を想定）
    const estimatedSellingPrice = isAmazonOutOfStock
      ? Math.ceil(product.officialPrice * 2)
      : product.amazonPrice || product.officialPrice;

    const calc = calculateProfit(
      estimatedSellingPrice,
      product.officialPrice,
      product.category || undefined
    );

    // 複数ソースからの検出があるほどスコアアップ
    const sourceCount = product.trendSources.length;
    const sourceBonus = sourceCount >= 3 ? 20 : sourceCount >= 2 ? 10 : 0;

    // 総合判定
    let recommendation: "STRONG_BUY" | "BUY" | "HOLD" | "SKIP";
    let reason: string;

    if (
      isAmazonOutOfStock &&
      calc.margin >= 30 &&
      product.trendScore + sourceBonus >= 60
    ) {
      recommendation = "STRONG_BUY";
      reason = `Amazon品切れ・利益率${calc.margin}%・トレンドスコア${product.trendScore}・${sourceCount}ソース検出`;
    } else if (calc.margin >= 20 && product.trendScore + sourceBonus >= 40) {
      recommendation = "BUY";
      reason = `利益率${calc.margin}%・トレンドスコア${product.trendScore}`;
    } else if (calc.margin >= 10) {
      recommendation = "HOLD";
      reason = `利益率${calc.margin}% - 動向要監視`;
    } else {
      recommendation = "SKIP";
      reason = `利益率不足: ${calc.margin}%`;
    }

    opportunities.push({
      productId: product.id,
      name: product.name,
      officialPrice: product.officialPrice,
      amazonPrice: product.amazonPrice,
      estimatedProfit: calc.profit,
      profitMargin: calc.margin,
      recommendation,
      reason,
    });
  }

  // 推奨度順にソート
  const order = { STRONG_BUY: 0, BUY: 1, HOLD: 2, SKIP: 3 };
  opportunities.sort(
    (a, b) =>
      order[a.recommendation] - order[b.recommendation] ||
      b.profitMargin - a.profitMargin
  );

  return { opportunities };
}
