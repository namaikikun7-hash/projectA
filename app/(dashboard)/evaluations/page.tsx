import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { currentPeriod } from "@/lib/evaluations";
import { getPeriodLabel, formatCurrency } from "@/lib/utils";
import Link from "next/link";

const gradeColors: Record<string, "default" | "success" | "secondary" | "warning" | "destructive"> = {
  S: "default",
  A: "success",
  B: "secondary",
  C: "warning",
  D: "destructive",
};

export default async function EvaluationsPage({
  searchParams,
}: {
  searchParams: { period?: string };
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const isStaff = session.user.role === "STAFF";
  const period = searchParams.period ?? currentPeriod();

  const evaluations = await prisma.evaluation.findMany({
    where: {
      period,
      ...(isStaff ? { staffId: session.user.id } : {}),
    },
    include: { staff: { select: { id: true, name: true, email: true } } },
    orderBy: { totalScore: "desc" },
  });

  const kpiTargets = await prisma.kpiTarget.findMany({
    where: { period, ...(isStaff ? { staffId: session.user.id } : {}) },
  });

  // 直近6ヶ月のリスト
  const periods: string[] = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    periods.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">評価・分析</h1>
          <p className="text-muted-foreground">{getPeriodLabel(period)}</p>
        </div>
        {!isStaff && (
          <form action="/api/evaluations" method="POST">
            <input type="hidden" name="period" value={period} />
            <input type="hidden" name="recalculateAll" value="true" />
            <Button type="submit" variant="outline" size="sm">
              評価を再計算
            </Button>
          </form>
        )}
      </div>

      {/* 月切り替え */}
      <div className="flex gap-2 flex-wrap">
        {periods.map((p) => (
          <Link key={p} href={`/evaluations?period=${p}`}>
            <Button variant={p === period ? "default" : "outline"} size="sm">
              {getPeriodLabel(p)}
            </Button>
          </Link>
        ))}
      </div>

      {evaluations.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">この月の評価データがありません。</p>
            {!isStaff && (
              <p className="text-sm text-muted-foreground mt-2">
                「評価を再計算」ボタンで集計できます。
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* 評価テーブル（管理者・マネージャー） */}
          {!isStaff && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">スタッフ評価一覧</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="border-b bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">順位</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">スタッフ</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">商談数</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">成約数</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">成約率</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">売上</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">FB提出率</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">スコア</th>
                      <th className="px-4 py-3 text-center font-medium text-muted-foreground">評価</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {evaluations.map((ev, i) => (
                      <tr key={ev.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-center font-bold text-muted-foreground">
                          {i + 1}
                        </td>
                        <td className="px-4 py-3 font-medium">{ev.staff.name}</td>
                        <td className="px-4 py-3 text-right">{ev.totalMeetings}</td>
                        <td className="px-4 py-3 text-right text-green-700 font-medium">{ev.contracts}</td>
                        <td className="px-4 py-3 text-right">{ev.conversionRate.toFixed(1)}%</td>
                        <td className="px-4 py-3 text-right">
                          {ev.totalContractAmount > 0 ? formatCurrency(ev.totalContractAmount) : "-"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={ev.feedbackSubmitRate < 80 ? "text-red-600" : "text-green-600"}>
                            {ev.feedbackSubmitRate.toFixed(0)}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-bold">{ev.totalScore.toFixed(1)}</td>
                        <td className="px-4 py-3 text-center">
                          {ev.grade && (
                            <Badge variant={gradeColors[ev.grade] ?? "outline"}>{ev.grade}</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {/* 個人詳細カード */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {evaluations
              .filter((ev) => !isStaff || ev.staffId === session.user.id)
              .map((ev) => {
                const kpi = kpiTargets.find((k) => k.staffId === ev.staffId || k.staffId === null);
                return (
                  <Card key={ev.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{ev.staff.name}</CardTitle>
                        {ev.grade && (
                          <Badge variant={gradeColors[ev.grade] ?? "outline"} className="text-lg px-3 py-1">
                            {ev.grade}
                          </Badge>
                        )}
                      </div>
                      <p className="text-2xl font-bold">{ev.totalScore.toFixed(1)}<span className="text-sm font-normal text-muted-foreground"> / 100点</span></p>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <ScoreBar label="成約率" value={ev.conversionRate} max={100} target={kpi?.targetConversionRate} unit="%" />
                      <ScoreBar label="商談数" value={ev.totalMeetings} max={kpi?.targetMeetings ?? 30} target={kpi?.targetMeetings} unit="件" />
                      <ScoreBar label="FB提出率" value={ev.feedbackSubmitRate} max={100} unit="%" warning={ev.feedbackSubmitRate < 80} />
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                        <Metric label="成約数" value={`${ev.contracts}件`} />
                        <Metric label="失注" value={`${ev.lost}件`} />
                        <Metric label="無断キャンセル" value={`${ev.noShows}件`} color={ev.noShows > 2 ? "text-red-600" : undefined} />
                        <Metric label="クロージング" value={`${ev.avgClosingScore.toFixed(1)}/10`} />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreBar({
  label, value, max, target, unit = "", warning,
}: {
  label: string; value: number; max: number; target?: number | null; unit?: string; warning?: boolean;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className={warning ? "text-red-600" : ""}>{value.toFixed(unit === "件" ? 0 : 1)}{unit}{target ? ` / 目標${target}${unit}` : ""}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${warning ? "bg-red-400" : "bg-blue-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-medium ${color ?? ""}`}>{value}</p>
    </div>
  );
}
