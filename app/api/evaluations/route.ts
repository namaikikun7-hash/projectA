import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateEvaluation, recalculateAllEvaluations, currentPeriod } from "@/lib/evaluations";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") ?? currentPeriod();
  const staffId = searchParams.get("staffId");

  // STAFF ロールは自分の評価のみ
  const effectiveStaffId =
    session.user.role === "STAFF" ? session.user.id : staffId ?? undefined;

  const evaluations = await prisma.evaluation.findMany({
    where: {
      period,
      ...(effectiveStaffId ? { staffId: effectiveStaffId } : {}),
    },
    include: {
      staff: { select: { id: true, name: true, email: true } },
    },
    orderBy: { totalScore: "desc" },
  });

  // KPI目標も一緒に返す
  const kpiTargets = await prisma.kpiTarget.findMany({
    where: {
      period,
      ...(effectiveStaffId ? { staffId: effectiveStaffId } : {}),
    },
  });

  return NextResponse.json({ evaluations, kpiTargets, period });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role === "STAFF") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { period, staffId, recalculateAll } = body;

  if (recalculateAll) {
    await recalculateAllEvaluations(period ?? currentPeriod());
    return NextResponse.json({ message: "All evaluations recalculated" });
  }

  if (!staffId) {
    return NextResponse.json({ error: "staffId is required" }, { status: 400 });
  }

  const result = await calculateEvaluation(staffId, period ?? currentPeriod());
  const evaluation = await prisma.evaluation.upsert({
    where: { staffId_period: { staffId, period: period ?? currentPeriod() } },
    update: result,
    create: { staffId, period: period ?? currentPeriod(), ...result },
    include: { staff: { select: { id: true, name: true } } },
  });

  return NextResponse.json(evaluation);
}
