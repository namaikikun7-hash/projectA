import { Badge } from "@/components/ui/badge";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "success" | "warning" | "destructive" | "outline" }> = {
  SCHEDULED: { label: "予定", variant: "secondary" },
  IN_PROGRESS: { label: "実施中", variant: "default" },
  COMPLETED: { label: "完了", variant: "success" },
  CANCELLED: { label: "キャンセル", variant: "outline" },
  NO_SHOW: { label: "無断キャンセル", variant: "destructive" },
};

const resultConfig: Record<string, { label: string; variant: "default" | "secondary" | "success" | "warning" | "destructive" | "outline" }> = {
  CONTRACTED: { label: "成約", variant: "success" },
  LOST: { label: "失注", variant: "destructive" },
  FOLLOW_UP: { label: "再商談", variant: "warning" },
  NO_SHOW: { label: "無断キャンセル", variant: "destructive" },
};

export function MeetingStatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export function MeetingResultBadge({ result }: { result: string | null }) {
  if (!result) return null;
  const config = resultConfig[result] ?? { label: result, variant: "outline" as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
