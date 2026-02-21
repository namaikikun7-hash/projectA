import { NextRequest, NextResponse } from "next/server";
import { verifyZoomWebhook, getMeetingRecordings } from "@/lib/zoom";
import { prisma } from "@/lib/prisma";

/**
 * Zoom Webhook エンドポイント
 * 録画完了時に録画URLをDBに保存する
 */
export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("x-zm-signature") ?? "";
  const timestamp = req.headers.get("x-zm-request-timestamp") ?? "";

  // Webhook URL検証（Zoom側からの確認リクエスト）
  const payload = JSON.parse(body);
  if (payload.event === "endpoint.url_validation") {
    const crypto = require("crypto");
    const hashForValidate = crypto
      .createHmac("sha256", process.env.ZOOM_WEBHOOK_SECRET_TOKEN!)
      .update(payload.payload.plainToken)
      .digest("hex");
    return NextResponse.json({
      plainToken: payload.payload.plainToken,
      encryptedToken: hashForValidate,
    });
  }

  // 署名検証
  if (!verifyZoomWebhook(body, signature, timestamp)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // 録画完了イベント
  if (payload.event === "recording.completed") {
    const meetingId = String(payload.payload.object.id);
    const recording = await getMeetingRecordings(meetingId);

    if (recording) {
      await prisma.meeting.updateMany({
        where: { zoomMeetingId: meetingId },
        data: { zoomRecordingUrl: recording },
      });
    }
  }

  // 参加者入室イベント → 商談ステータスをIN_PROGRESSに更新
  if (payload.event === "meeting.participant_joined") {
    const meetingId = String(payload.payload.object.id);
    await prisma.meeting.updateMany({
      where: { zoomMeetingId: meetingId, status: "SCHEDULED" },
      data: { status: "IN_PROGRESS" },
    });
  }

  // 会議終了イベント
  if (payload.event === "meeting.ended") {
    const meetingId = String(payload.payload.object.id);
    await prisma.meeting.updateMany({
      where: { zoomMeetingId: meetingId, status: "IN_PROGRESS" },
      data: { status: "COMPLETED" },
    });
  }

  return NextResponse.json({ received: true });
}
