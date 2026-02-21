import { auth } from "@/lib/auth";
import { StatsCard } from "@/components/dashboard/stats-card";
import { ConversionChart } from "@/components/dashboard/conversion-chart";
import { StaffRanking } from "@/components/dashboard/staff-ranking";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, CheckCircle, TrendingUp, AlertCircle, DollarSign } from "lucide-react";
import { MeetingStatusBadge, MeetingResultBadge } from "@/components/meetings/meeting-status-badge";
import { formatDateTime, formatCurrency, currentPeriod, getPeriodLabel } from "@/lib/utils";
import Link from "next/link";

async function getDashboardData(period: string, userId: string, role: string) {
  const params = new URLSearchParams({ period });
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/dashboard?${params}`, {
    headers: { Cookie: "" }, // Server component: use direct DB instead
    cache: "no-store",
  });
  // For server components, fetch directly
  return null;
}

import { prisma } from "@/lib/prisma";
import { currentPeriod as getPeriod } from "@/lib/evaluations";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) return null;

  const period = getPeriod();
  const [year, month] = period.split("-").map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59);
  const isStaff = session.user.role === "STAFF";
  const staffFilter = isStaff ? { staffId: session.user.id } : {};

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
    prisma.meeting.count({ where: { ...staffFilter, scheduledAt: { gte: start, lte: end } } }),
    prisma.meeting.count({ where: { ...staffFilter, scheduledAt: { gte: start, lte: end }, status: "COMPLETED" } }),
    prisma.meeting.count({ where: { ...staffFilter, scheduledAt: { gte: start, lte: end }, result: "CONTRACTED" } }),
    prisma.meeting.count({
      where: { ...staffFilter, status: "COMPLETED", feedback: null, scheduledAt: { gte: start, lte: end } },
    }),
    prisma.meeting.findMany({
      where: staffFilter,
      include: {
        client: { select: { name: true } },
        staff: { select: { name: true } },
        feedback: { select: { id: true } },
      },
      orderBy: { scheduledAt: "desc" },
      take: 8,
    }),
    prisma.$queryRaw<Array<{ month: string; meetings: bigint; contracts: bigint }>>`
      SELECT
        TO_CHAR(DATE_TRUNC('month', "scheduledAt"), 'YYYY-MM') as month,
        COUNT(*) as meetings,
        COUNT(CASE WHEN result = 'CONTRACTED' THEN 1 END) as contracts
      FROM "Meeting"
      WHERE "scheduledAt" >= NOW() - INTERVAL '6 months'
      GROUP BY DATE_TRUNC('month', "scheduledAt")
      ORDER BY month ASC
    `,
    isStaff ? [] : prisma.evaluation.findMany({
      where: { period },
      include: { staff: { select: { id: true, name: true } } },
      orderBy: { totalScore: "desc" },
      take: 5,
    }),
    prisma.kpiTarget.findFirst({ where: { period, staffId: isStaff ? session.user.id : null } }),
  ]);

  const conversionRate =
    completedMeetings > 0 ? Math.round((contracts / completedMeetings) * 1000) / 10 : 0;

  const trendData = monthlyTrend.map((d) => ({
    month: d.month,
    meetings: Number(d.meetings),
    contracts: Number(d.contracts),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">ダッシュボード</h1>
        <p className="text-muted-foreground">{getPeriodLabel(period)} の実績</p>
      </div>

      {/* KPI達成状況バー */}
      {kpiTarget && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-blue-800 mb-3">今月のKPI進捗</p>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <KpiProgress label="商談数" current={totalMeetings} target={kpiTarget.targetMeetings} />
              <KpiProgress label="成約数" current={contracts} target={kpiTarget.targetContracts} />
              <KpiProgress label="成約率" current={conversionRate} target={kpiTarget.targetConversionRate} unit="%" />
              {kpiTarget.targetContractAmount > 0 && (
                <KpiProgress
                  label="売上"
                  current={0}
                  target={kpiTarget.targetContractAmount}
                  unit="円"
                  formatValue={(v) => `¥${v.toLocaleString()}`}
                />
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 統計カード */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="商談数"
          value={totalMeetings}
          subtitle={`完了: ${completedMeetings}件`}
          icon={Calendar}
          color="blue"
        />
        <StatsCard
          title="成約数"
          value={contracts}
          icon={CheckCircle}
          color="green"
        />
        <StatsCard
          title="成約率"
          value={`${conversionRate}%`}
          subtitle="完了商談ベース"
          icon={TrendingUp}
          color="purple"
        />
        <StatsCard
          title="フィードバック未提出"
          value={pendingFeedback}
          subtitle="早めに入力をお願いします"
          icon={AlertCircle}
          color={pendingFeedback > 0 ? "red" : "green"}
        />
      </div>

      {/* チャート */}
      <ConversionChart data={trendData} />

      {/* ランキング & 直近商談 */}
      <div className="grid gap-4 md:grid-cols-2">
        {!isStaff && <StaffRanking data={staffRanking as never} />}

        <Card className={isStaff ? "md:col-span-2" : ""}>
          <CardHeader>
            <CardTitle className="text-base">直近の商談</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentMeetings.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">商談がありません</p>
              ) : (
                recentMeetings.map((m) => (
                  <Link
                    key={m.id}
                    href={`/meetings/${m.id}`}
                    className="flex items-center justify-between rounded-md p-2 hover:bg-accent transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{m.client.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {!isStaff && `${m.staff.name} · `}
                        {formatDateTime(m.scheduledAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      {m.result ? (
                        <MeetingResultBadge result={m.result} />
                      ) : (
                        <MeetingStatusBadge status={m.status} />
                      )}
                      {m.status === "COMPLETED" && !m.feedback && (
                        <Badge variant="warning" className="text-xs">FB未提出</Badge>
                      )}
                    </div>
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiProgress({
  label,
  current,
  target,
  unit = "",
  formatValue,
}: {
  label: string;
  current: number;
  target: number;
  unit?: string;
  formatValue?: (v: number) => string;
}) {
  const pct = target > 0 ? Math.min(Math.round((current / target) * 100), 100) : 0;
  const display = formatValue ? formatValue(current) : `${current}${unit}`;
  const targetDisplay = formatValue ? formatValue(target) : `${target}${unit}`;

  return (
    <div>
      <div className="flex justify-between text-xs text-blue-700 mb-1">
        <span>{label}</span>
        <span>{display} / {targetDisplay}</span>
      </div>
      <div className="h-2 bg-blue-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-600 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-blue-600 mt-0.5 text-right">{pct}%</p>
    </div>
  );
}
