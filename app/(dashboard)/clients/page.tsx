"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Search } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: string;
  schoolType: string | null;
  budget: number | null;
  ageGroup: string | null;
  occupation: string | null;
  meetings: Array<{ id: string; status: string; result: string | null; scheduledAt: string }>;
}

const sourceLabels: Record<string, string> = {
  INSTAGRAM: "Instagram",
  TWITTER: "Twitter/X",
  YOUTUBE: "YouTube",
  GOOGLE_AD: "Google広告",
  REFERRAL: "紹介",
  LP: "LP",
  UNKNOWN: "不明",
};

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "", email: "", phone: "", source: "UNKNOWN",
    schoolType: "", budget: "", ageGroup: "", occupation: "", notes: "",
  });

  const fetchClients = async (q = "") => {
    const params = new URLSearchParams({ limit: "50", ...(q ? { q } : {}) });
    const res = await fetch(`/api/clients?${params}`);
    const data = await res.json();
    setClients(data.clients ?? []);
    setTotal(data.total ?? 0);
  };

  useEffect(() => { fetchClients(); }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchClients(search);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, budget: form.budget ? parseInt(form.budget) : undefined }),
    });
    if (res.ok) {
      setShowDialog(false);
      setForm({ name: "", email: "", phone: "", source: "UNKNOWN", schoolType: "", budget: "", ageGroup: "", occupation: "", notes: "" });
      fetchClients();
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">顧客管理</h1>
          <p className="text-muted-foreground">全 {total} 名</p>
        </div>
        <Button onClick={() => setShowDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />顧客を追加
        </Button>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="名前・メールで検索..."
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="outline">検索</Button>
      </form>

      <div className="rounded-lg border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">氏名</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">連絡先</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">流入元</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">希望スクール</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">予算</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">最終商談</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {clients.map((c) => {
              const lastMeeting = c.meetings[0];
              return (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium">{c.name}</p>
                    {c.ageGroup && <p className="text-xs text-muted-foreground">{c.ageGroup} / {c.occupation}</p>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {c.email && <p>{c.email}</p>}
                    {c.phone && <p>{c.phone}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{sourceLabels[c.source] ?? c.source}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c.schoolType ?? "-"}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {c.budget ? formatCurrency(c.budget) : "-"}
                  </td>
                  <td className="px-4 py-3">
                    {lastMeeting ? (
                      <div>
                        <p className="text-xs">{new Date(lastMeeting.scheduledAt).toLocaleDateString("ja-JP")}</p>
                        <Badge variant={lastMeeting.result === "CONTRACTED" ? "success" : "outline"} className="text-xs">
                          {lastMeeting.result === "CONTRACTED" ? "成約" : lastMeeting.result === "LOST" ? "失注" : lastMeeting.status === "SCHEDULED" ? "予定" : "完了"}
                        </Badge>
                      </div>
                    ) : <span className="text-muted-foreground">-</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 顧客追加ダイアログ */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>新しい顧客を追加</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>氏名 *</Label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required className="mt-1" />
              </div>
              <div>
                <Label>メール</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>電話</Label>
                <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>流入元</Label>
                <Select value={form.source} onValueChange={(v) => setForm((f) => ({ ...f, source: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(sourceLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>希望スクール種別</Label>
                <Input value={form.schoolType} onChange={(e) => setForm((f) => ({ ...f, schoolType: e.target.value }))} placeholder="プログラミング等" className="mt-1" />
              </div>
              <div>
                <Label>予算（円）</Label>
                <Input type="number" value={form.budget} onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>年齢層</Label>
                <Input value={form.ageGroup} onChange={(e) => setForm((f) => ({ ...f, ageGroup: e.target.value }))} placeholder="20代" className="mt-1" />
              </div>
              <div>
                <Label>職業</Label>
                <Input value={form.occupation} onChange={(e) => setForm((f) => ({ ...f, occupation: e.target.value }))} placeholder="会社員" className="mt-1" />
              </div>
              <div className="col-span-2">
                <Label>備考</Label>
                <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  className="mt-1 flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>キャンセル</Button>
              <Button type="submit" disabled={loading}>{loading ? "追加中..." : "追加"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
