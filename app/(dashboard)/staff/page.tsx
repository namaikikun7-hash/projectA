"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, UserCog } from "lucide-react";

interface Staff {
  id: string;
  name: string;
  email: string;
  role: string;
  phone: string | null;
  createdAt: string;
  _count: { meetings: number };
}

const roleLabel: Record<string, string> = {
  ADMIN: "管理者",
  MANAGER: "マネージャー",
  STAFF: "営業スタッフ",
};

const roleVariant: Record<string, "default" | "secondary" | "outline"> = {
  ADMIN: "default",
  MANAGER: "secondary",
  STAFF: "outline",
};

export default function StaffPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "STAFF", phone: "" });

  const fetchStaff = async () => {
    const res = await fetch("/api/staff");
    if (res.ok) setStaff(await res.json());
  };

  useEffect(() => { fetchStaff(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "作成に失敗しました");
    } else {
      setShowDialog(false);
      setForm({ name: "", email: "", password: "", role: "STAFF", phone: "" });
      fetchStaff();
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">スタッフ管理</h1>
          <p className="text-muted-foreground">全 {staff.length} 名</p>
        </div>
        <Button onClick={() => setShowDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />スタッフを追加
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {staff.map((s) => (
          <div key={s.id} className="rounded-lg border bg-white p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                  {s.name[0]}
                </div>
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-sm text-muted-foreground">{s.email}</p>
                </div>
              </div>
              <Badge variant={roleVariant[s.role] ?? "outline"}>
                {roleLabel[s.role] ?? s.role}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-sm text-muted-foreground border-t pt-3">
              <span>累計商談数: <strong className="text-foreground">{s._count.meetings}</strong>件</span>
              {s.phone && <span>{s.phone}</span>}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>スタッフを追加</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>}
            <div>
              <Label>氏名 *</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required className="mt-1" />
            </div>
            <div>
              <Label>メールアドレス *</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required className="mt-1" />
            </div>
            <div>
              <Label>パスワード（8文字以上）*</Label>
              <Input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required minLength={8} className="mt-1" />
            </div>
            <div>
              <Label>役割</Label>
              <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="STAFF">営業スタッフ</SelectItem>
                  <SelectItem value="MANAGER">マネージャー</SelectItem>
                  <SelectItem value="ADMIN">管理者</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>電話番号</Label>
              <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="mt-1" />
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
