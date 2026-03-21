/**
 * 商品仕入れ通知
 * リサーチ結果をChatwork/LINEに通知する
 */

import { prisma } from "@/lib/prisma";

const CHATWORK_API_BASE = "https://api.chatwork.com/v2";
const LINE_NOTIFY_URL = "https://notify-api.line.me/api/notify";

/**
 * Chatworkにメッセージ送信
 */
async function sendChatwork(roomId: string, message: string): Promise<boolean> {
  const token = process.env.CHATWORK_API_TOKEN;
  if (!token) return false;

  const res = await fetch(`${CHATWORK_API_BASE}/rooms/${roomId}/messages`, {
    method: "POST",
    headers: {
      "X-ChatWorkToken": token,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ body: message }),
  });

  return res.ok;
}

/**
 * LINE Notifyにメッセージ送信
 */
async function sendLine(message: string): Promise<boolean> {
  const token = process.env.LINE_NOTIFY_TOKEN;
  if (!token) return false;

  const res = await fetch(LINE_NOTIFY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ message }),
  });

  return res.ok;
}

/**
 * 通知をDBに記録
 */
async function logNotification(
  message: string,
  target: string,
  relatedId?: string
): Promise<void> {
  try {
    await prisma.notificationLog.create({
      data: {
        type: "SOURCING_ALERT",
        target,
        message,
        relatedId,
      },
    });
  } catch {
    // ログ失敗は無視
  }
}

export interface SourcingOpportunity {
  productId: string;
  name: string;
  officialPrice: number;
  amazonPrice: number | null;
  estimatedProfit: number;
  profitMargin: number;
  recommendation: "STRONG_BUY" | "BUY" | "HOLD" | "SKIP";
  reason: string;
  officialUrl?: string | null;
  asin?: string | null;
}

/**
 * 仕入れ推奨商品の通知を送信（Chatwork + LINE）
 */
export async function notifySourcingOpportunities(
  opportunities: SourcingOpportunity[]
): Promise<{ chatwork: boolean; line: boolean; notified: number }> {
  // BUY以上のみ通知
  const targets = opportunities.filter(
    (o) => o.recommendation === "STRONG_BUY" || o.recommendation === "BUY"
  );

  if (targets.length === 0) {
    return { chatwork: false, line: false, notified: 0 };
  }

  // Chatwork用メッセージ
  const chatworkMsg = buildChatworkMessage(targets);
  // LINE用メッセージ
  const lineMsg = buildLineMessage(targets);

  const roomId = process.env.CHATWORK_ROOM_ID || "";

  const [chatworkOk, lineOk] = await Promise.all([
    roomId ? sendChatwork(roomId, chatworkMsg) : Promise.resolve(false),
    sendLine(lineMsg),
  ]);

  // ログ保存
  await logNotification(chatworkMsg, roomId || "line");

  return { chatwork: chatworkOk, line: lineOk, notified: targets.length };
}

/**
 * Chatwork用メッセージ組み立て
 */
function buildChatworkMessage(targets: SourcingOpportunity[]): string {
  const items = targets
    .map((t, i) => {
      const emoji = t.recommendation === "STRONG_BUY" ? "!!!" : "";
      const profit = `+${t.estimatedProfit.toLocaleString("ja-JP")}円`;
      const margin = `利益率${t.profitMargin}%`;
      const amazonUrl = t.asin ? `https://www.amazon.co.jp/dp/${t.asin}` : "";
      const buyUrl = t.officialUrl || "";

      let line = `${i + 1}. ${emoji}${t.name}\n`;
      line += `   仕入値: ¥${t.officialPrice.toLocaleString("ja-JP")} → 推定利益: ${profit}（${margin}）\n`;
      line += `   判定: ${t.recommendation} - ${t.reason}\n`;
      if (buyUrl) line += `   仕入れURL: ${buyUrl}\n`;
      if (amazonUrl) line += `   Amazon: ${amazonUrl}`;
      return line;
    })
    .join("\n\n");

  return `[info][title]🔥 仕入れ推奨商品が見つかりました！（${targets.length}件）[/title]
${items}

リサーチ時刻: ${new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}[/info]`;
}

/**
 * LINE Notify用メッセージ組み立て
 */
function buildLineMessage(targets: SourcingOpportunity[]): string {
  const items = targets
    .map((t, i) => {
      const profit = `+${t.estimatedProfit.toLocaleString("ja-JP")}円`;
      const buyUrl = t.officialUrl || "";
      let line = `\n${i + 1}. ${t.name}`;
      line += `\n   ${profit}（利益率${t.profitMargin}%）`;
      line += `\n   判定: ${t.recommendation}`;
      if (buyUrl) line += `\n   購入: ${buyUrl}`;
      return line;
    })
    .join("\n");

  return `\n🔥仕入れ推奨 ${targets.length}件${items}`;
}

/**
 * 単一商品の緊急アラート（STRONG_BUY検出時に即座に通知）
 */
export async function notifyUrgentOpportunity(
  product: SourcingOpportunity
): Promise<void> {
  const profit = `+${product.estimatedProfit.toLocaleString("ja-JP")}円`;
  const buyUrl = product.officialUrl || "";
  const amazonUrl = product.asin
    ? `https://www.amazon.co.jp/dp/${product.asin}`
    : "";

  const chatworkMsg = `[info][title]🚨 緊急！仕入れチャンス発見[/title]
商品: ${product.name}
仕入値: ¥${product.officialPrice.toLocaleString("ja-JP")}
推定利益: ${profit}（利益率${product.profitMargin}%）

理由: ${product.reason}

${buyUrl ? `👉 今すぐ仕入れ: ${buyUrl}` : ""}
${amazonUrl ? `📦 Amazon: ${amazonUrl}` : ""}

⚡ このチャンスを逃すな！[/info]`;

  const lineMsg = `\n🚨緊急！仕入れチャンス\n${product.name}\n${profit}（利益率${product.profitMargin}%）\n${buyUrl ? `購入→ ${buyUrl}` : ""}`;

  const roomId = process.env.CHATWORK_ROOM_ID || "";

  await Promise.all([
    roomId ? sendChatwork(roomId, chatworkMsg) : Promise.resolve(),
    sendLine(lineMsg),
  ]);

  await logNotification(chatworkMsg, roomId || "line", product.productId);
}
