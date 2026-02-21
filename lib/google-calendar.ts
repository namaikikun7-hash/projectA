/**
 * Google Calendar API連携
 * OAuth2.0 を使用してユーザーのカレンダーにイベントを追加
 */

interface CalendarEvent {
  id: string;
  htmlLink: string;
}

/** Google OAuth2.0 アクセストークンをリフレッシュ */
async function refreshAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) throw new Error("Failed to refresh Google token");
  const data = await res.json();
  return data.access_token;
}

/** Google Calendarに商談イベントを作成 */
export async function createCalendarEvent(params: {
  refreshToken: string;
  title: string;
  startTime: Date;
  durationMinutes: number;
  description: string;
  attendeeEmail: string;
  zoomJoinUrl?: string;
}): Promise<{ eventId: string; eventLink: string }> {
  const accessToken = await refreshAccessToken(params.refreshToken);

  const endTime = new Date(params.startTime.getTime() + params.durationMinutes * 60 * 1000);

  const event = {
    summary: params.title,
    description: params.zoomJoinUrl
      ? `${params.description}\n\nZoom参加URL: ${params.zoomJoinUrl}`
      : params.description,
    start: { dateTime: params.startTime.toISOString(), timeZone: "Asia/Tokyo" },
    end: { dateTime: endTime.toISOString(), timeZone: "Asia/Tokyo" },
    attendees: [{ email: params.attendeeEmail }],
    reminders: {
      useDefault: false,
      overrides: [
        { method: "email", minutes: 24 * 60 }, // 前日メール
        { method: "popup", minutes: 30 },       // 30分前ポップアップ
      ],
    },
    conferenceData: params.zoomJoinUrl
      ? undefined
      : {
          createRequest: {
            requestId: `meet-${Date.now()}`,
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        },
  };

  const calendarId = process.env.GOOGLE_CALENDAR_ID ?? "primary";
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?conferenceDataVersion=1`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google Calendar event creation failed: ${err}`);
  }

  const created: CalendarEvent = await res.json();
  return { eventId: created.id, eventLink: created.htmlLink };
}

/** カレンダーイベントを削除（商談キャンセル時） */
export async function deleteCalendarEvent(params: {
  refreshToken: string;
  eventId: string;
}): Promise<void> {
  const accessToken = await refreshAccessToken(params.refreshToken);
  const calendarId = process.env.GOOGLE_CALENDAR_ID ?? "primary";

  await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${params.eventId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
}

/** Google OAuth認証URLを生成 */
export function getGoogleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/calendar.events",
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/auth?${params}`;
}

/** 認証コードをリフレッシュトークンに交換 */
export async function exchangeCodeForTokens(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
}> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
      code,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) throw new Error("Failed to exchange code for tokens");
  const data = await res.json();
  return { accessToken: data.access_token, refreshToken: data.refresh_token };
}
