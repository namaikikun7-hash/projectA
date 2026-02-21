/**
 * Chatwork API連携
 * https://developer.chatwork.com/
 */

const CHATWORK_API_BASE = "https://api.chatwork.com/v2";

async function sendMessage(roomId: string, message: string): Promise<void> {
  const res = await fetch(`${CHATWORK_API_BASE}/rooms/${roomId}/messages`, {
    method: "POST",
    headers: {
      "X-ChatWorkToken": process.env.CHATWORK_API_TOKEN!,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ body: message }),
  });

  if (!res.ok) {
    console.error(`Chatwork send failed: ${res.status} ${res.statusText}`);
  }
}

/** 成約通知を管理者チャンネルに送信 */
export async function notifyContracted(params: {
  staffName: string;
  clientName: string;
  amount: number;
  schoolType?: string;
}): Promise<void> {
  const roomId = process.env.CHATWORK_ROOM_ID!;
  const amountStr = params.amount.toLocaleString("ja-JP");
  const message = `[info][title]🎉 成約通知[/title]
担当: ${params.staffName}
顧客: ${params.clientName}
金額: ¥${amountStr}
${params.schoolType ? `スクール種別: ${params.schoolType}` : ""}

お疲れ様でした！[/info]`;

  await sendMessage(roomId, message);

  // ログ保存
  await logNotification("CONTRACT_ALERT", roomId, message);
}

/** 商談後フィードバック未提出の催促通知 */
export async function notifyFeedbackReminder(params: {
  staffName: string;
  staffEmail: string;
  clientName: string;
  meetingId: string;
  hoursAgo: number;
}): Promise<void> {
  const roomId = process.env.CHATWORK_ROOM_ID!;
  const message = `[info][title]⚠️ フィードバック未提出リマインダー[/title]
${params.staffName} さん

${params.hoursAgo}時間前の商談のフィードバックが未提出です。

顧客: ${params.clientName}
入力URL: ${process.env.NEXTAUTH_URL}/meetings/${params.meetingId}/feedback

本日中にご入力をお願いします。[/info]`;

  await sendMessage(roomId, message);
  await logNotification("FEEDBACK_REMINDER", roomId, message, params.meetingId);
}

/** 商談前リマインダー（1時間前） */
export async function notifyMeetingReminder(params: {
  staffName: string;
  clientName: string;
  meetingId: string;
  scheduledAt: Date;
  zoomJoinUrl?: string;
}): Promise<void> {
  const roomId = process.env.CHATWORK_ROOM_ID!;
  const timeStr = params.scheduledAt.toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
  });

  const message = `[info][title]📅 商談リマインダー（1時間前）[/title]
担当: ${params.staffName}
顧客: ${params.clientName}
開始時刻: ${timeStr}
${params.zoomJoinUrl ? `Zoom URL: ${params.zoomJoinUrl}` : ""}[/info]`;

  await sendMessage(roomId, message);
  await logNotification("MEETING_REMINDER", roomId, message, params.meetingId);
}

/** 日次サマリーレポートを送信 */
export async function sendDailyReport(params: {
  date: string;
  totalMeetings: number;
  contracts: number;
  conversionRate: number;
  topStaff: Array<{ name: string; contracts: number; rate: number }>;
}): Promise<void> {
  const roomId = process.env.CHATWORK_ROOM_ID!;
  const rankingStr = params.topStaff
    .slice(0, 3)
    .map((s, i) => `${i + 1}位: ${s.name} (${s.contracts}件 / 成約率${s.rate.toFixed(1)}%)`)
    .join("\n");

  const message = `[info][title]📊 日次営業レポート - ${params.date}[/title]
本日の商談数: ${params.totalMeetings}件
成約数: ${params.contracts}件
全体成約率: ${params.conversionRate.toFixed(1)}%

[本日のトップ3]
${rankingStr}[/info]`;

  await sendMessage(roomId, message);
  await logNotification("DAILY_REPORT", roomId, message);
}

/** 通知ログをDBに保存 */
async function logNotification(
  type: string,
  target: string,
  message: string,
  relatedId?: string
): Promise<void> {
  try {
    const { prisma } = await import("@/lib/prisma");
    await prisma.notificationLog.create({
      data: {
        type: type as never,
        target,
        message,
        relatedId,
      },
    });
  } catch {
    // ログ保存失敗は無視
  }
}
