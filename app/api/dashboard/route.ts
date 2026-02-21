import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { currentPeriod } from "@/lib/evaluations";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") ?? currentPeriod();
  const [year, month] = period.split("-").map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59);

  const isStaff = session.user.role === "STAFF";
  const staffFilter = isStaff ? { staffId: session.user.id } : {};

  // 並列でデータ取得
  const [
    totalMeetings,
    completedMeetings,
    contracts,
    pendingFeedback,
    recentMeetings,
    monthlyTrend,
    staffRanking,
    kpiTarget,
  ] = await Promise.all([
    // 全商談数
    prisma.meeting.count({ where: { ...staffFilter, scheduledAt: { gte: start, lte: end } } }),
    // 完了商談数
    prisma.meeting.count({
      where: { ...staffFilter, scheduledAt: { gte: start, lte: end }, status: "COMPLETED" },
    }),
    // 成約数
    prisma.meeting.count({
      where: { ...staffFilter, scheduledAt: { gte: start, lte: end }, result: "CONTRACTED" },
    }),
    // フィードバック未提出件数
    prisma.meeting.count({
      where: {
        ...staffFilter,
        status: "COMPLETED",
        feedback: null,
        scheduledAt: { gte: start, lte: end },
      },
    }),
    // 直近の商談（5件）
    prisma.meeting.findMany({
      where: { ...staffFilter },
      include: {
        client: { select: { name: true } },
        staff: { select: { name: true } },
        feedback: { select: { id: true } },
      },
      orderBy: { scheduledAt: "desc" },
      take: 5,
    }),
    // 月別トレンド（直近6ヶ月）
    prisma.$queryRaw<Array<{ month: string; meetings: number; contracts: number }>>`
      SELECT
        TO_CHAR(DATE_TRUNC('month', "scheduledAt"), 'YYYY-MM') as month,
        COUNT(*) as meetings,
        COUNT(CASE WHEN result = 'CONTRACTED' THEN 1 END) as contracts
      FROM "Meeting"
      WHERE "scheduledAt" >= NOW() - INTERVAL '6 months'
      ${isStaff ? prisma.$queryRaw`AND "staffId" = ${session.user.id}` : prisma.$queryRaw``}
      GROUP BY DATE_TRUNC('month', "scheduledAt")
      ORDER BY month ASC
    `,
    // スタッフランキング（管理者のみ）
    isStaff
      ? []
      : prisma.evaluation.findMany({
          where: { period },
          include: { staff: { select: { id: true, name: true } } },
          orderBy: { totalScore: "desc" },
          take: 5,
        }),
    // KPI目標
    prisma.kpiTarget.findFirst({
      where: {
        period,
        staffId: isStaff ? session.user.id : null,
      },
    }),
  ]);

  const conversionRate =
    completedMeetings > 0 ? Math.round((contracts / completedMeetings) * 1000) / 10 : 0;

  return NextResponse.json({
    period,
    stats: {
      totalMeetings,
      completedMeetings,
      contracts,
      conversionRate,
      pendingFeedback,
    },
    recentMeetings,
    monthlyTrend,
    staffRanking,
    kpiTarget,
  });
}
