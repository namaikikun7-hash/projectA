"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

interface Client { id: string; name: string; email?: string }
interface Staff { id: string; name: string }

export default function NewMeetingPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    clientId: "",
    staffId: "",
    scheduledAt: "",
    durationMinutes: 60,
    notes: "",
    createZoom: true,
    createCalendar: false,
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/clients?limit=100").then((r) => r.json()),
      fetch("/api/staff").then((r) => r.json()),
    ]).then(([clientData, staffData]) => {
      setClients(clientData.clients ?? []);
      setStaff(staffData ?? []);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.clientId || !form.staffId || !form.scheduledAt) {
      setError("必須項目を入力してください");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          scheduledAt: new Date(form.scheduledAt).toISOString(),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "作成に失敗しました");
      }
      const meeting = await res.json();
      router.push(`/meetings/${meeting.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/meetings">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">商談を追加</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>}

        <Card>
          <CardHeader><CardTitle className="text-base">基本情報</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>顧客 *</Label>
              <Select onValueChange={(v) => setForm((f) => ({ ...f, clientId: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="顧客を選択..." />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="mt-2">
                <Link href="/clients" className="text-xs text-primary hover:underline">
                  + 新しい顧客を追加
                </Link>
              </div>
            </div>

            <div>
              <Label>担当スタッフ *</Label>
              <Select onValueChange={(v) => setForm((f) => ({ ...f, staffId: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="スタッフを選択..." />
                </SelectTrigger>
                <SelectContent>
                  {staff.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>日時 *</Label>
                <Input
                  type="datetime-local"
                  value={form.scheduledAt}
                  onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>所要時間（分）</Label>
                <Input
                  type="number"
                  value={form.durationMinutes}
                  onChange={(e) => setForm((f) => ({ ...f, durationMinutes: parseInt(e.target.value) }))}
                  min={15}
                  max={180}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label>メモ</Label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="mt-1 flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="商談に関するメモ..."
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">外部連携</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.createZoom}
                onChange={(e) => setForm((f) => ({ ...f, createZoom: e.target.checked }))}
                className="h-4 w-4"
              />
              <div>
                <p className="text-sm font-medium">Zoom会議を自動作成</p>
                <p className="text-xs text-muted-foreground">商談用のZoom URLを自動生成します（クラウド録画ON）</p>
              </div>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.createCalendar}
                onChange={(e) => setForm((f) => ({ ...f, createCalendar: e.target.checked }))}
                className="h-4 w-4"
              />
              <div>
                <p className="text-sm font-medium">Google Calendarに追加</p>
                <p className="text-xs text-muted-foreground">担当者のGoogleカレンダーにイベントを追加します</p>
              </div>
            </label>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={loading} className="flex-1">
            {loading ? "作成中..." : "商談を作成"}
          </Button>
          <Link href="/meetings">
            <Button type="button" variant="outline">キャンセル</Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
