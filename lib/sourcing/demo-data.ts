/**
 * デモモード用のモックデータ
 * APIキーが未設定の場合に、リアルなデモデータを返す
 */

export interface DemoStep {
  step: string;
  status: "running" | "done" | "error";
  detail?: string;
}

export interface DemoOpportunity {
  productId: string;
  name: string;
  officialPrice: number;
  amazonPrice: number | null;
  estimatedProfit: number;
  profitMargin: number;
  recommendation: "STRONG_BUY" | "BUY";
  reason: string;
}

/**
 * デモモードかどうかを判定
 * 主要APIキーが1つも設定されていない場合にデモモード
 */
export function isDemoMode(): boolean {
  return (
    !process.env.RAKUTEN_APP_ID &&
    !process.env.AMAZON_PA_API_ACCESS_KEY &&
    !process.env.TWITTER_BEARER_TOKEN
  );
}

/**
 * デモ用ステップデータを生成
 */
export function getDemoSteps(command: string): DemoStep[] {
  return [
    {
      step: "音声コマンド受信",
      status: "done",
      detail: `「${command}」`,
    },
    {
      step: "トレンド商品リサーチ中",
      status: "done",
      detail: "12件の新規商品, 8件更新",
    },
    {
      step: "Amazon在庫・価格チェック",
      status: "done",
      detail: "PA-APIで在庫状況を確認完了",
    },
    {
      step: "利益計算・仕入れ判定中",
      status: "done",
      detail: "STRONG_BUY: 2件, BUY: 5件",
    },
    {
      step: "仕入れ推奨通知を送信中",
      status: "done",
      detail: "7件の通知送信完了（Chatwork: OK, LINE: OK）",
    },
    {
      step: "完了",
      status: "done",
      detail: "リサーチ完了！7件の仕入れチャンスを通知しました",
    },
  ];
}

/**
 * デモ用の推奨商品データを生成
 */
export function getDemoOpportunities(): DemoOpportunity[] {
  return [
    {
      productId: "demo-1",
      name: "PlayStation 5 DualSense Edge ワイヤレスコントローラー",
      officialPrice: 29980,
      amazonPrice: null,
      estimatedProfit: 18500,
      profitMargin: 62,
      recommendation: "STRONG_BUY",
      reason: "Amazon品切れ・利益率62%・トレンドスコア85・3ソース検出",
    },
    {
      productId: "demo-2",
      name: "サントリー 山崎12年 シングルモルト 700ml",
      officialPrice: 8800,
      amazonPrice: null,
      estimatedProfit: 12200,
      profitMargin: 139,
      recommendation: "STRONG_BUY",
      reason: "Amazon品切れ・利益率139%・トレンドスコア92・2ソース検出",
    },
    {
      productId: "demo-3",
      name: "NIKE DUNK LOW レトロ パンダ 2025年モデル",
      officialPrice: 14850,
      amazonPrice: 22800,
      estimatedProfit: 5950,
      profitMargin: 40,
      recommendation: "BUY",
      reason: "利益率40%・トレンドスコア73",
    },
    {
      productId: "demo-4",
      name: "ポケモンカードゲーム スカーレット&バイオレット 拡張パック",
      officialPrice: 5400,
      amazonPrice: 9800,
      estimatedProfit: 3200,
      profitMargin: 59,
      recommendation: "BUY",
      reason: "利益率59%・トレンドスコア68",
    },
    {
      productId: "demo-5",
      name: "ダイソン Airwrap マルチスタイラー Complete Long",
      officialPrice: 64900,
      amazonPrice: null,
      estimatedProfit: 35100,
      profitMargin: 54,
      recommendation: "BUY",
      reason: "Amazon品切れ・利益率54%・トレンドスコア61",
    },
  ];
}

/**
 * デモ用のサマリーデータを生成
 */
export function getDemoSummary() {
  const opportunities = getDemoOpportunities();
  return {
    newProducts: 12,
    updatedProducts: 8,
    strongBuys: opportunities.filter((o) => o.recommendation === "STRONG_BUY").length,
    buys: opportunities.filter((o) => o.recommendation === "BUY").length,
    notified: opportunities.length,
    opportunities,
  };
}
