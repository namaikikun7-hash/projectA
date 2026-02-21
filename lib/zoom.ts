/**
 * Zoom API連携
 * Server-to-Server OAuth (Account Credentials) を使用
 * https://marketplace.zoom.us/
 */

interface ZoomMeeting {
  id: string;
  join_url: string;
  start_url: string;
  topic: string;
  start_time: string;
  duration: number;
  password: string;
}

interface ZoomRecording {
  recording_files: Array<{
    id: string;
    file_type: string;
    play_url: string;
    download_url: string;
    status: string;
  }>;
}

let _accessToken: string | null = null;
let _tokenExpiry: number = 0;

/** Zoom Server-to-Server OAuth トークン取得 */
async function getAccessToken(): Promise<string> {
  if (_accessToken && Date.now() < _tokenExpiry) return _accessToken;

  const credentials = Buffer.from(
    `${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`
  ).toString("base64");

  const res = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${process.env.ZOOM_ACCOUNT_ID}`,
    {
      method: "POST",
      headers: { Authorization: `Basic ${credentials}` },
    }
  );

  if (!res.ok) throw new Error(`Zoom OAuth failed: ${res.statusText}`);

  const data = await res.json();
  _accessToken = data.access_token;
  _tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return _accessToken!;
}

/** Zoom会議を作成してURLを返す */
export async function createZoomMeeting(params: {
  topic: string;
  startTime: Date;
  durationMinutes: number;
  hostEmail?: string;
}): Promise<{ meetingId: string; joinUrl: string; startUrl: string; password: string }> {
  const token = await getAccessToken();

  const body = {
    topic: params.topic,
    type: 2, // Scheduled meeting
    start_time: params.startTime.toISOString(),
    duration: params.durationMinutes,
    settings: {
      host_video: true,
      participant_video: true,
      join_before_host: false,
      mute_upon_entry: false,
      auto_recording: "cloud", // クラウド録画を自動開始
      waiting_room: true,
    },
  };

  const res = await fetch("https://api.zoom.us/v2/users/me/meetings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Zoom meeting creation failed: ${err}`);
  }

  const meeting: ZoomMeeting = await res.json();
  return {
    meetingId: String(meeting.id),
    joinUrl: meeting.join_url,
    startUrl: meeting.start_url,
    password: meeting.password,
  };
}

/** 商談の録画URLを取得 */
export async function getMeetingRecordings(meetingId: string): Promise<string | null> {
  const token = await getAccessToken();

  const res = await fetch(`https://api.zoom.us/v2/meetings/${meetingId}/recordings`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) return null;

  const data: ZoomRecording = await res.json();
  const videoFile = data.recording_files?.find(
    (f) => f.file_type === "MP4" && f.status === "completed"
  );

  return videoFile?.play_url ?? null;
}

/** Zoom Webhook の署名を検証 */
export function verifyZoomWebhook(body: string, signature: string, timestamp: string): boolean {
  const crypto = require("crypto");
  const message = `v0:${timestamp}:${body}`;
  const hashForVerify = crypto
    .createHmac("sha256", process.env.ZOOM_WEBHOOK_SECRET_TOKEN!)
    .update(message)
    .digest("hex");
  const signatureToCompare = `v0=${hashForVerify}`;
  return signatureToCompare === signature;
}
