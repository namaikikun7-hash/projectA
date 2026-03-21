/**
 * Amazon商品調査
 * PA-API (Product Advertising API) または スクレイピングで在庫・価格を取得
 */

export interface AmazonProductInfo {
  asin: string;
  title: string;
  price: number | null;
  listPrice: number | null; // 定価
  imageUrl: string | null;
  stockStatus: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "UNAVAILABLE" | "UNKNOWN";
  sellerCount: number;
  rating: number | null;
  reviewCount: number;
  category: string | null;
  url: string;
  buyBoxSeller: string | null; // カート取得セラー
  fbaEligible: boolean;
}

export interface AmazonSearchResult {
  items: AmazonProductInfo[];
  totalResults: number;
}

// PA-API v5 設定
const PA_API_ACCESS_KEY = process.env.AMAZON_PA_API_ACCESS_KEY || "";
const PA_API_SECRET_KEY = process.env.AMAZON_PA_API_SECRET_KEY || "";
const PA_API_PARTNER_TAG = process.env.AMAZON_PA_API_PARTNER_TAG || "";
const PA_API_HOST = "webservices.amazon.co.jp";
const PA_API_REGION = "us-west-2";

/**
 * HMAC-SHA256署名を生成（PA-API v5用）
 */
async function createSignature(
  key: ArrayBuffer,
  message: string
): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(message));
}

async function getSignatureKey(
  key: string,
  dateStamp: string,
  regionName: string,
  serviceName: string
): Promise<ArrayBuffer> {
  const kDate = await createSignature(
    new TextEncoder().encode(`AWS4${key}`).buffer as ArrayBuffer,
    dateStamp
  );
  const kRegion = await createSignature(kDate, regionName);
  const kService = await createSignature(kRegion, serviceName);
  return createSignature(kService, "aws4_request");
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * PA-API v5 リクエスト送信
 */
async function paApiRequest(
  operation: string,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  if (!PA_API_ACCESS_KEY || !PA_API_SECRET_KEY || !PA_API_PARTNER_TAG) {
    throw new Error("Amazon PA-API認証情報が設定されていません");
  }

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);

  const body = JSON.stringify({
    ...payload,
    PartnerTag: PA_API_PARTNER_TAG,
    PartnerType: "Associates",
    Marketplace: "www.amazon.co.jp",
  });

  const path = `/paapi5/${operation.toLowerCase()}`;
  const headers: Record<string, string> = {
    "content-type": "application/json; charset=utf-8",
    "content-encoding": "amz-1.0",
    host: PA_API_HOST,
    "x-amz-date": amzDate,
    "x-amz-target": `com.amazon.paapi5.v1.ProductAdvertisingAPIv1.${operation}`,
  };

  // 署名プロセス（AWS Signature Version 4）
  const canonicalHeaders = Object.entries(headers)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v}\n`)
    .join("");
  const signedHeaders = Object.keys(headers)
    .sort()
    .join(";");

  const bodyHash = toHex(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body))
  );

  const canonicalRequest = [
    "POST",
    path,
    "",
    canonicalHeaders,
    signedHeaders,
    bodyHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${PA_API_REGION}/ProductAdvertisingAPI/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    toHex(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(canonicalRequest)
      )
    ),
  ].join("\n");

  const signingKey = await getSignatureKey(
    PA_API_SECRET_KEY,
    dateStamp,
    PA_API_REGION,
    "ProductAdvertisingAPI"
  );
  const signature = toHex(await createSignature(signingKey, stringToSign));

  const authorization = `AWS4-HMAC-SHA256 Credential=${PA_API_ACCESS_KEY}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(`https://${PA_API_HOST}${path}`, {
    method: "POST",
    headers: { ...headers, authorization },
    body,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Amazon PA-API エラー: ${res.status} - ${errText}`);
  }

  return res.json();
}

/**
 * ASINで商品情報を取得
 */
export async function getProductByAsin(asin: string): Promise<AmazonProductInfo> {
  const data = await paApiRequest("GetItems", {
    ItemIds: [asin],
    Resources: [
      "ItemInfo.Title",
      "ItemInfo.Features",
      "ItemInfo.Classifications",
      "Offers.Listings.Price",
      "Offers.Listings.Availability.Type",
      "Offers.Listings.MerchantInfo",
      "Offers.Listings.DeliveryInfo.IsFreeShippingEligible",
      "Offers.Summaries.OfferCount",
      "Images.Primary.Large",
      "BrowseNodeInfo.BrowseNodes",
    ],
  });

  const items = (data.ItemsResult as Record<string, unknown[]>)?.Items || [];
  if (items.length === 0) {
    throw new Error(`ASIN ${asin} の商品が見つかりません`);
  }

  return parseAmazonItem(items[0] as Record<string, unknown>);
}

/**
 * キーワードで商品検索
 */
export async function searchAmazonProducts(
  keyword: string,
  category?: string
): Promise<AmazonSearchResult> {
  const payload: Record<string, unknown> = {
    Keywords: keyword,
    SearchIndex: category || "All",
    ItemCount: 10,
    Resources: [
      "ItemInfo.Title",
      "ItemInfo.Classifications",
      "Offers.Listings.Price",
      "Offers.Listings.Availability.Type",
      "Offers.Summaries.OfferCount",
      "Images.Primary.Large",
    ],
  };

  const data = await paApiRequest("SearchItems", payload);
  const result = data.SearchResult as Record<string, unknown> | undefined;
  const items = (result?.Items || []) as Record<string, unknown>[];

  return {
    items: items.map(parseAmazonItem),
    totalResults: Number(result?.TotalResultCount || 0),
  };
}

/**
 * PA-APIレスポンスをパース
 */
function parseAmazonItem(item: Record<string, unknown>): AmazonProductInfo {
  const asin = item.ASIN as string || "";
  const itemInfo = item.ItemInfo as Record<string, unknown> || {};
  const offers = item.Offers as Record<string, unknown> || {};
  const images = item.Images as Record<string, unknown> || {};

  const title = (itemInfo.Title as Record<string, string>)?.DisplayValue || "";
  const category = (itemInfo.Classifications as Record<string, Record<string, string>>)
    ?.Binding?.DisplayValue || null;

  const listings = (offers.Listings as Array<Record<string, unknown>>) || [];
  const summaries = (offers.Summaries as Array<Record<string, unknown>>) || [];

  const firstListing = listings[0] || {};
  const price = (firstListing.Price as Record<string, unknown>)?.Amount as number | undefined ?? null;
  const listPrice = (firstListing.Price as Record<string, Record<string, number>>)
    ?.Savings?.Amount
    ? (price ?? 0) + ((firstListing.Price as Record<string, Record<string, number>>).Savings.Amount)
    : null;

  const availabilityType = (firstListing.Availability as Record<string, string>)?.Type || "";
  const stockStatus = parseStockStatus(availabilityType);

  const merchantName = (firstListing.MerchantInfo as Record<string, string>)?.Name || null;
  const isFba = (firstListing.DeliveryInfo as Record<string, boolean>)
    ?.IsFreeShippingEligible || false;

  const sellerCount = summaries.reduce(
    (sum: number, s: Record<string, unknown>) => sum + (Number(s.OfferCount) || 0),
    0
  );

  const primaryImage = (images.Primary as Record<string, Record<string, string>>)
    ?.Large?.URL || null;

  return {
    asin,
    title,
    price,
    listPrice,
    imageUrl: primaryImage,
    stockStatus,
    sellerCount,
    rating: null,
    reviewCount: 0,
    category,
    url: `https://www.amazon.co.jp/dp/${asin}`,
    buyBoxSeller: merchantName,
    fbaEligible: isFba,
  };
}

function parseStockStatus(
  type: string
): AmazonProductInfo["stockStatus"] {
  switch (type) {
    case "Now":
      return "IN_STOCK";
    case "":
      return "OUT_OF_STOCK";
    default:
      return "UNKNOWN";
  }
}

/**
 * 利益計算（Amazon FBA手数料概算）
 * @param sellingPrice 販売価格
 * @param purchasePrice 仕入れ価格
 * @param category カテゴリ（手数料率が変わる）
 */
export function calculateProfit(
  sellingPrice: number,
  purchasePrice: number,
  category?: string
): { profit: number; margin: number; fees: number } {
  // Amazon販売手数料（カテゴリにより8-15%、デフォルト10%）
  const feeRates: Record<string, number> = {
    本: 0.15,
    DVD: 0.15,
    ミュージック: 0.15,
    ゲーム: 0.08,
    おもちゃ: 0.10,
    家電: 0.08,
    ビューティー: 0.08,
    食品: 0.10,
  };
  const feeRate = (category && feeRates[category]) || 0.10;

  // 販売手数料
  const referralFee = Math.ceil(sellingPrice * feeRate);
  // FBA出荷手数料（概算: 小型500円、標準800円）
  const fulfillmentFee = sellingPrice < 5000 ? 500 : 800;
  // カテゴリ成約料（メディア商品のみ、ここでは省略）
  const closingFee = 0;

  const totalFees = referralFee + fulfillmentFee + closingFee;
  const profit = sellingPrice - purchasePrice - totalFees;
  const margin = sellingPrice > 0 ? (profit / sellingPrice) * 100 : 0;

  return {
    profit,
    margin: Math.round(margin * 10) / 10,
    fees: totalFees,
  };
}
