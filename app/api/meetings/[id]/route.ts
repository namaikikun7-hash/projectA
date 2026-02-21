import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyContracted } from "@/lib/chatwork";
import { z } from "zod";

const updateSchema = z.object({
  status: z.enum(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"]).optional(),
  result: z.enum(["CONTRACTED", "LOST", "FOLLOW_UP", "NO_SHOW"]).optional(),
  contractAmount: z.number().optional(),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const meeting = await prisma.meeting.findUnique({
    where: { id: params.id },
    include: {
      client: true,
      staff: { select: { id: true, name: true, email: true, role: true } },
      feedback: true,
    },
  });

  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // STAFF は自分の商談のみ
  if (session.user.role === "STAFF" && meeting.staffId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(meeting);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const meeting = await prisma.meeting.findUnique({
    where: { id: params.id },
    include: { client: true, staff: { select: { id: true, name: true } } },
  });
  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // STAFF は自分の商談のみ更新可
  if (session.user.role === "STAFF" && meeting.staffId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await prisma.meeting.update({
    where: { id: params.id },
    data: parsed.data,
    include: {
      client: true,
      staff: { select: { id: true, name: true, email: true } },
      feedback: true,
    },
  });

  // 成約通知を Chatwork に送信
  if (parsed.data.result === "CONTRACTED" && process.env.CHATWORK_API_TOKEN) {
    notifyContracted({
      staffName: meeting.staff.name,
      clientName: meeting.client.name,
      amount: parsed.data.contractAmount ?? 0,
      schoolType: meeting.client.schoolType ?? undefined,
    }).catch(console.error);
  }

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session || session.user.role === "STAFF") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.meeting.delete({ where: { id: params.id } });
  return new NextResponse(null, { status: 204 });
}
