/**
 * X (Twitter) トレンド商品検出
 * X API v2 を使用してバズっている商品を検出
 */

export interface TweetProduct {
  tweetId: string;
  text: string;
  authorUsername: string;
  likeCount: number;
  retweetCount: number;
  replyCount: number;
  impressionCount: number;
  createdAt: string;
  url: string;
  extractedProductName: string | null;
}

export interface TwitterSearchResult {
  tweets: TweetProduct[];
  totalCount: number;
}

const TWITTER_BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN || "";
const TWITTER_API_BASE = "https://api.twitter.com/2";

/**
 * X API v2 リクエスト送信
 */
async function twitterApiRequest(
  endpoint: string,
  params: Record<string, string> = {}
): Promise<Record<string, unknown>> {
  if (!TWITTER_BEARER_TOKEN) {
    throw new Error("TWITTER_BEARER_TOKEN が設定されていません");
  }

  const url = new URL(`${TWITTER_API_BASE}${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${TWITTER_BEARER_TOKEN}`,
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`X API エラー: ${res.status} - ${errText}`);
  }

  return res.json();
}

/**
 * 商品関連のバズツイートを検索
 * @param keyword 検索キーワード
 * @param minLikes 最低いいね数（バズ判定閾値）
 */
export async function searchBuzzProducts(
  keyword: string,
  minLikes: number = 1000
): Promise<TwitterSearchResult> {
  const query = `${keyword} -is:retweet lang:ja min_faves:${minLikes}`;

  const data = await twitterApiRequest("/tweets/search/recent", {
    query,
    "tweet.fields": "public_metrics,created_at,author_id",
    "user.fields": "username",
    expansions: "author_id",
    max_results: "100",
    sort_order: "relevancy",
  });

  const tweets = (data.data || []) as Array<Record<string, unknown>>;
  const users = ((data.includes as Record<string, unknown[]>)?.users || []) as Array<
    Record<string, string>
  >;

  const userMap = new Map(users.map((u) => [u.id, u.username]));

  return {
    tweets: tweets.map((tweet) => {
      const metrics = tweet.public_metrics as Record<string, number> || {};
      const authorId = tweet.author_id as string;
      return {
        tweetId: tweet.id as string,
        text: tweet.text as string,
        authorUsername: userMap.get(authorId) || "",
        likeCount: metrics.like_count || 0,
        retweetCount: metrics.retweet_count || 0,
        replyCount: metrics.reply_count || 0,
        impressionCount: metrics.impression_count || 0,
        createdAt: tweet.created_at as string,
        url: `https://x.com/i/status/${tweet.id}`,
        extractedProductName: extractProductName(tweet.text as string),
      };
    }),
    totalCount: (data.meta as Record<string, number>)?.result_count || 0,
  };
}

/**
 * 転売・品薄関連のツイートを検索
 */
export async function searchResaleOpportunities(): Promise<TwitterSearchResult> {
  const queries = [
    "売り切れ 続出 -is:retweet lang:ja min_faves:500",
    "入手困難 -is:retweet lang:ja min_faves:500",
    "生産終了 -is:retweet lang:ja min_faves:500",
    "販売終了 再販 -is:retweet lang:ja min_faves:300",
    "テレビで紹介 品切れ -is:retweet lang:ja min_faves:300",
  ];

  const allTweets: TweetProduct[] = [];

  for (const query of queries) {
    try {
      const data = await twitterApiRequest("/tweets/search/recent", {
        query,
        "tweet.fields": "public_metrics,created_at,author_id",
        "user.fields": "username",
        expansions: "author_id",
        max_results: "20",
        sort_order: "relevancy",
      });

      const tweets = (data.data || []) as Array<Record<string, unknown>>;
      const users = ((data.includes as Record<string, unknown[]>)?.users || []) as Array<
        Record<string, string>
      >;
      const userMap = new Map(users.map((u) => [u.id, u.username]));

      for (const tweet of tweets) {
        const metrics = tweet.public_metrics as Record<string, number> || {};
        const authorId = tweet.author_id as string;
        allTweets.push({
          tweetId: tweet.id as string,
          text: tweet.text as string,
          authorUsername: userMap.get(authorId) || "",
          likeCount: metrics.like_count || 0,
          retweetCount: metrics.retweet_count || 0,
          replyCount: metrics.reply_count || 0,
          impressionCount: metrics.impression_count || 0,
          createdAt: tweet.created_at as string,
          url: `https://x.com/i/status/${tweet.id}`,
          extractedProductName: extractProductName(tweet.text as string),
        });
      }
    } catch {
      // 個別クエリの失敗は無視して次へ
      continue;
    }
  }

  // エンゲージメント順にソート
  allTweets.sort(
    (a, b) =>
      b.likeCount + b.retweetCount * 2 - (a.likeCount + a.retweetCount * 2)
  );

  return {
    tweets: allTweets,
    totalCount: allTweets.length,
  };
}

/**
 * ツイートテキストから商品名を抽出（簡易的なパターンマッチ）
 */
function extractProductName(text: string): string | null {
  // 「」や【】で囲まれたテキストを抽出
  const bracketMatch = text.match(/[「【『](.+?)[」】』]/);
  if (bracketMatch) return bracketMatch[1];

  // #ハッシュタグから商品名候補を抽出
  const hashMatch = text.match(/#([^\s#]+)/);
  if (hashMatch) return hashMatch[1];

  return null;
}

/**
 * トレンドスコアを計算（エンゲージメントベース）
 */
export function calculateTrendScore(tweet: TweetProduct): number {
  const engagementScore =
    tweet.likeCount * 1 +
    tweet.retweetCount * 3 +
    tweet.replyCount * 2 +
    tweet.impressionCount * 0.01;

  // 0-100のスコアに正規化（10000エンゲージメントで100点）
  return Math.min(100, Math.round((engagementScore / 10000) * 100));
}
