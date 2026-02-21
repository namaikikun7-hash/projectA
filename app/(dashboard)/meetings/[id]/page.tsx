"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MeetingStatusBadge, MeetingResultBadge } from "@/components/meetings/meeting-status-badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Video, ExternalLink, FileText } from "lucide-react";
import Link from "next/link";
import { formatDateTime, formatCurrency } from "@/lib/utils";

interface Meeting {
  id: string;
  scheduledAt: string;
  durationMinutes: number;
  status: string;
  result: string | null;
  contractAmount: number | null;
  notes: string | null;
  zoomJoinUrl: string | null;
  zoomRecordingUrl: string | null;
  client: { id: string; name: string; email: string | null; phone: string | null; schoolType: string | null; budget: number | null };
  staff: { id: string; name: string; email: string };
  feedback: {
    id: string;
    painPoints: string | null;
    budget: number | null;
    motivation: number;
    decisionMaker: boolean;
    objections: string | null;
    closingScore: number;
    selfScore: number;
    nextAction: string | null;
    submittedAt: string;
  } | null;
}

export default function MeetingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [result, setResult] = useState("");
  const [contractAmount, setContractAmount] = useState("");

  useEffect(() => {
    fetch(`/api/meetings/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setMeeting(data);
        setResult(data.result ?? "");
        setContractAmount(data.contractAmount?.toString() ?? "");
        setLoading(false);
      });
  }, [id]);

  const updateResult = async () => {
    if (!result) return;
    setUpdating(true);
    const res = await fetch(`/api/meetings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        result,
        status: "COMPLETED",
        contractAmount: contractAmount ? parseInt(contractAmount) : undefined,
      }),
    });
    const updated = await res.json();
    setMeeting(updated);
    setUpdating(false);
  };

  if (loading) return <div className="py-20 text-center text-muted-foreground">読み込み中...</div>;
  if (!meeting) return <div className="py-20 text-center text-muted-foreground">商談が見つかりません</div>;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/meetings">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{meeting.client.name} との商談</h1>
          <p className="text-muted-foreground">{formatDateTime(meeting.scheduledAt)}</p>
        </div>
        <MeetingStatusBadge status={meeting.status} />
        {meeting.result && <MeetingResultBadge result={meeting.result} />}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* 顧客情報 */}
        <Card>
          <CardHeader><CardTitle className="text-base">顧客情報</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <InfoRow label="氏名" value={meeting.client.name} />
            <InfoRow label="メール" value={meeting.client.email} />
            <InfoRow label="電話" value={meeting.client.phone} />
            <InfoRow label="希望スクール" value={meeting.client.schoolType} />
            {meeting.client.budget && (
              <InfoRow label="予算" value={formatCurrency(meeting.client.budget)} />
            )}
          </CardContent>
        </Card>

        {/* 商談情報 */}
        <Card>
          <CardHeader><CardTitle className="text-base">商談情報</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <InfoRow label="担当者" value={meeting.staff.name} />
            <InfoRow label="日時" value={formatDateTime(meeting.scheduledAt)} />
            <InfoRow label="時間" value={`${meeting.durationMinutes}分`} />
            {meeting.notes && <InfoRow label="メモ" value={meeting.notes} />}
            {meeting.zoomJoinUrl && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Zoom</span>
                <a href={meeting.zoomJoinUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="gap-1">
                    <Video className="h-3 w-3" /> 参加
                  </Button>
                </a>
              </div>
            )}
            {meeting.zoomRecordingUrl && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">録画</span>
                <a href={meeting.zoomRecordingUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="gap-1">
                    <ExternalLink className="h-3 w-3" /> 視聴
                  </Button>
                </a>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 結果入力 */}
      {!meeting.result && (
        <Card className="border-blue-200">
          <CardHeader><CardTitle className="text-base">商談結果を記録</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>結果</Label>
                <Select value={result} onValueChange={setResult}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="結果を選択..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CONTRACTED">成約</SelectItem>
                    <SelectItem value="LOST">失注</SelectItem>
                    <SelectItem value="FOLLOW_UP">再商談・保留</SelectItem>
                    <SelectItem value="NO_SHOW">無断キャンセル</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {result === "CONTRACTED" && (
                <div>
                  <Label>成約金額（円）</Label>
                  <Input
                    type="number"
                    value={contractAmount}
                    onChange={(e) => setContractAmount(e.target.value)}
                    placeholder="300000"
                    className="mt-1"
                  />
                </div>
              )}
            </div>
            <Button onClick={updateResult} disabled={!result || updating}>
              {updating ? "更新中..." : "結果を保存"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* フィードバック */}
      {meeting.status === "COMPLETED" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">フィードバック</CardTitle>
            {!meeting.feedback && (
              <Link href={`/meetings/${id}/feedback`}>
                <Button size="sm">
                  <FileText className="mr-2 h-4 w-4" />
                  入力する
                </Button>
              </Link>
            )}
          </CardHeader>
          <CardContent>
            {!meeting.feedback ? (
              <p className="text-sm text-muted-foreground">フィードバックが未入力です。商談結果を振り返るため、入力をお願いします。</p>
            ) : (
              <div className="grid gap-3 text-sm md:grid-cols-2">
                <InfoRow label="モチベーション" value={`${meeting.feedback.motivation}/5`} />
                <InfoRow label="意思決定者" value={meeting.feedback.decisionMaker ? "本人" : "本人以外"} />
                <InfoRow label="クロージング評価" value={`${meeting.feedback.closingScore}/10`} />
                <InfoRow label="自己評価" value={`${meeting.feedback.selfScore}/5`} />
                {meeting.feedback.budget && (
                  <InfoRow label="ヒアリング予算" value={formatCurrency(meeting.feedback.budget)} />
                )}
                {meeting.feedback.painPoints && (
                  <div className="md:col-span-2">
                    <InfoRow label="課題・悩み" value={meeting.feedback.painPoints} />
                  </div>
                )}
                {meeting.feedback.objections && (
                  <div className="md:col-span-2">
                    <InfoRow label="反論・懸念" value={meeting.feedback.objections} />
                  </div>
                )}
                {meeting.feedback.nextAction && (
                  <div className="md:col-span-2">
                    <InfoRow label="次のアクション" value={meeting.feedback.nextAction} />
                  </div>
                )}
                <p className="text-xs text-muted-foreground md:col-span-2">
                  提出: {formatDateTime(meeting.feedback.submittedAt)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
