import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const feedbackSchema = z.object({
  painPoints: z.string().optional(),
  budget: z.number().optional(),
  motivation: z.number().min(1).max(5),
  decisionMaker: z.boolean().default(true),
  competitors: z.string().optional(),
  objections: z.string().optional(),
  closingScore: z.number().min(1).max(10),
  selfScore: z.number().min(1).max(5),
  nextAction: z.string().optional(),
  followUpDate: z.string().datetime().optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 商談の存在確認
  const meeting = await prisma.meeting.findUnique({ where: { id: params.id } });
  if (!meeting) return NextResponse.json({ error: "Meeting not found" }, { status: 404 });

  // STAFF は自分の商談のみフィードバック可
  if (session.user.role === "STAFF" && meeting.staffId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = feedbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const feedback = await prisma.meetingFeedback.upsert({
    where: { meetingId: params.id },
    update: {
      ...parsed.data,
      followUpDate: parsed.data.followUpDate ? new Date(parsed.data.followUpDate) : null,
    },
    create: {
      meetingId: params.id,
      ...parsed.data,
      followUpDate: parsed.data.followUpDate ? new Date(parsed.data.followUpDate) : null,
    },
  });

  // 商談を完了済みに更新
  await prisma.meeting.update({
    where: { id: params.id },
    data: { status: "COMPLETED" },
  });

  return NextResponse.json(feedback, { status: 201 });
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const feedback = await prisma.meetingFeedback.findUnique({
    where: { meetingId: params.id },
    include: { meeting: { include: { client: true, staff: { select: { name: true } } } } },
  });

  if (!feedback) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(feedback);
}
