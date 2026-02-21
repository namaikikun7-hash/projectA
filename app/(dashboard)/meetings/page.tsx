import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MeetingStatusBadge, MeetingResultBadge } from "@/components/meetings/meeting-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";
import Link from "next/link";
import { Plus, Video } from "lucide-react";

interface SearchParams {
  status?: string;
  staffId?: string;
  page?: string;
}

export default async function MeetingsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth();
  if (!session) return null;

  const isStaff = session.user.role === "STAFF";
  const page = parseInt(searchParams.page ?? "1");
  const limit = 20;
  const statusFilter = searchParams.status;
  const staffFilter = isStaff
    ? { staffId: session.user.id }
    : searchParams.staffId
    ? { staffId: searchParams.staffId }
    : {};

  const [meetings, total, staffList] = await Promise.all([
    prisma.meeting.findMany({
      where: {
        ...staffFilter,
        ...(statusFilter ? { status: statusFilter as never } : {}),
      },
      include: {
        client: { select: { id: true, name: true, phone: true, schoolType: true } },
        staff: { select: { id: true, name: true } },
        feedback: { select: { id: true, closingScore: true } },
      },
      orderBy: { scheduledAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.meeting.count({
      where: {
        ...staffFilter,
        ...(statusFilter ? { status: statusFilter as never } : {}),
      },
    }),
    isStaff ? [] : prisma.user.findMany({
      where: { isActive: true, role: { in: ["STAFF", "MANAGER"] } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">商談管理</h1>
          <p className="text-muted-foreground">全 {total} 件</p>
        </div>
        <Link href="/meetings/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            商談を追加
          </Button>
        </Link>
      </div>

      {/* フィルター */}
      <div className="flex flex-wrap gap-2">
        {["", "SCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW"].map((s) => (
          <Link
            key={s}
            href={`/meetings?${new URLSearchParams({ ...(s ? { status: s } : {}), ...(searchParams.staffId ? { staffId: searchParams.staffId } : {}) })}`}
          >
            <Button
              variant={statusFilter === s || (!statusFilter && !s) ? "default" : "outline"}
              size="sm"
            >
              {s === "" ? "すべて" : s === "SCHEDULED" ? "予定" : s === "COMPLETED" ? "完了" : s === "CANCELLED" ? "キャンセル" : "無断キャンセル"}
            </Button>
          </Link>
        ))}
      </div>

      {/* 商談リスト */}
      <div className="rounded-lg border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">日時</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">顧客</th>
              {!isStaff && <th className="px-4 py-3 text-left font-medium text-muted-foreground">担当</th>}
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">ステータス</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">結果</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">FB</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Zoom</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {meetings.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  商談がありません
                </td>
              </tr>
            ) : (
              meetings.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link href={`/meetings/${m.id}`} className="text-primary hover:underline">
                      {formatDateTime(m.scheduledAt)}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{m.client.name}</p>
                    {m.client.schoolType && (
                      <p className="text-xs text-muted-foreground">{m.client.schoolType}</p>
                    )}
                  </td>
                  {!isStaff && <td className="px-4 py-3 text-muted-foreground">{m.staff.name}</td>}
                  <td className="px-4 py-3">
                    <MeetingStatusBadge status={m.status} />
                  </td>
                  <td className="px-4 py-3">
                    <MeetingResultBadge result={m.result} />
                  </td>
                  <td className="px-4 py-3">
                    {m.status === "COMPLETED" ? (
                      m.feedback ? (
                        <Badge variant="success">提出済</Badge>
                      ) : (
                        <Link href={`/meetings/${m.id}/feedback`}>
                          <Badge variant="warning" className="cursor-pointer hover:opacity-80">未提出</Badge>
                        </Link>
                      )
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {m.zoomJoinUrl ? (
                      <a href={m.zoomJoinUrl} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="icon" title="Zoomに参加">
                          <Video className="h-4 w-4 text-blue-600" />
                        </Button>
                      </a>
                    ) : (
                      <span className="text-muted-foreground px-3">-</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ページネーション */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link key={p} href={`/meetings?page=${p}${statusFilter ? `&status=${statusFilter}` : ""}`}>
              <Button variant={p === page ? "default" : "outline"} size="sm">{p}</Button>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
