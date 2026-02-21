import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createZoomMeeting } from "@/lib/zoom";
import { createCalendarEvent } from "@/lib/google-calendar";
import { notifyMeetingReminder } from "@/lib/chatwork";
import { z } from "zod";

const createSchema = z.object({
  clientId: z.string(),
  staffId: z.string(),
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().min(15).max(180).default(60),
  notes: z.string().optional(),
  createZoom: z.boolean().default(true),
  createCalendar: z.boolean().default(false),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const staffId = searchParams.get("staffId");
  const status = searchParams.get("status");
  const period = searchParams.get("period"); // "2024-01"
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = parseInt(searchParams.get("limit") ?? "20");

  // STAFF ロールは自分の商談のみ閲覧可能
  const effectiveStaffId =
    session.user.role === "STAFF" ? session.user.id : staffId ?? undefined;

  let dateFilter = {};
  if (period) {
    const [year, month] = period.split("-").map(Number);
    dateFilter = {
      scheduledAt: {
        gte: new Date(year, month - 1, 1),
        lte: new Date(year, month, 0, 23, 59, 59),
      },
    };
  }

  const [meetings, total] = await Promise.all([
    prisma.meeting.findMany({
      where: {
        ...(effectiveStaffId ? { staffId: effectiveStaffId } : {}),
        ...(status ? { status: status as never } : {}),
        ...dateFilter,
      },
      include: {
        client: { select: { id: true, name: true, email: true, phone: true, schoolType: true } },
        staff: { select: { id: true, name: true, email: true } },
        feedback: { select: { id: true, submittedAt: true, closingScore: true, selfScore: true } },
      },
      orderBy: { scheduledAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.meeting.count({
      where: {
        ...(effectiveStaffId ? { staffId: effectiveStaffId } : {}),
        ...(status ? { status: status as never } : {}),
        ...dateFilter,
      },
    }),
  ]);

  return NextResponse.json({ meetings, total, page, limit });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const scheduledAt = new Date(data.scheduledAt);
  const feedbackDueAt = new Date(scheduledAt.getTime() + 24 * 60 * 60 * 1000); // 翌日

  // 顧客・スタッフを取得
  const [client, staff] = await Promise.all([
    prisma.client.findUnique({ where: { id: data.clientId } }),
    prisma.user.findUnique({ where: { id: data.staffId } }),
  ]);
  if (!client || !staff) {
    return NextResponse.json({ error: "Client or staff not found" }, { status: 404 });
  }

  let zoomMeetingId: string | undefined;
  let zoomJoinUrl: string | undefined;
  let calendarEventId: string | undefined;

  // Zoom会議を作成
  if (data.createZoom && process.env.ZOOM_CLIENT_ID) {
    try {
      const zoom = await createZoomMeeting({
        topic: `無料面談: ${client.name} × ${staff.name}`,
        startTime: scheduledAt,
        durationMinutes: data.durationMinutes,
      });
      zoomMeetingId = zoom.meetingId;
      zoomJoinUrl = zoom.joinUrl;
    } catch (e) {
      console.error("Zoom meeting creation failed:", e);
    }
  }

  // Google Calendarにイベントを追加
  if (data.createCalendar && staff.googleRefreshToken) {
    try {
      const cal = await createCalendarEvent({
        refreshToken: staff.googleRefreshToken,
        title: `【無料面談】${client.name} 様`,
        startTime: scheduledAt,
        durationMinutes: data.durationMinutes,
        description: `顧客: ${client.name}\nスタッフ: ${staff.name}\n${data.notes ?? ""}`,
        attendeeEmail: client.email ?? staff.email,
        zoomJoinUrl,
      });
      calendarEventId = cal.eventId;
    } catch (e) {
      console.error("Google Calendar event creation failed:", e);
    }
  }

  const meeting = await prisma.meeting.create({
    data: {
      clientId: data.clientId,
      staffId: data.staffId,
      scheduledAt,
      durationMinutes: data.durationMinutes,
      zoomMeetingId,
      zoomJoinUrl,
      calendarEventId,
      feedbackDueAt,
      notes: data.notes,
    },
    include: {
      client: true,
      staff: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json(meeting, { status: 201 });
}
