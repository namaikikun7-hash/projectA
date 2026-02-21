"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter } from "next/navigation";

const schema = z.object({
  painPoints: z.string().optional(),
  budget: z.coerce.number().optional(),
  motivation: z.coerce.number().min(1).max(5),
  decisionMaker: z.boolean().default(true),
  competitors: z.string().optional(),
  objections: z.string().optional(),
  closingScore: z.coerce.number().min(1).max(10),
  selfScore: z.coerce.number().min(1).max(5),
  nextAction: z.string().optional(),
});

type FeedbackForm = z.infer<typeof schema>;

interface FeedbackFormProps {
  meetingId: string;
  clientName: string;
  defaultValues?: Partial<FeedbackForm>;
}

export function FeedbackFormComponent({ meetingId, clientName, defaultValues }: FeedbackFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FeedbackForm>({
    resolver: zodResolver(schema),
    defaultValues: { motivation: 3, closingScore: 5, selfScore: 3, decisionMaker: true, ...defaultValues },
  });

  const onSubmit = async (data: FeedbackForm) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("送信に失敗しました");
      router.push(`/meetings/${meetingId}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">顧客情報（{clientName}）</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>課題・悩み</Label>
            <textarea
              {...register("painPoints")}
              className="mt-1 flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="顧客が抱えている課題や悩みを記入"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>ヒアリング予算（円）</Label>
              <Input {...register("budget")} type="number" placeholder="300000" className="mt-1" />
            </div>
            <div>
              <Label>モチベーション（1-5）</Label>
              <Input
                {...register("motivation")}
                type="number"
                min={1}
                max={5}
                className="mt-1"
              />
              {errors.motivation && <p className="text-xs text-red-500">{errors.motivation.message}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="decisionMaker" {...register("decisionMaker")} />
            <Label htmlFor="decisionMaker">意思決定者本人と話した</Label>
          </div>
          <div>
            <Label>競合他社の検討状況</Label>
            <Input {...register("competitors")} placeholder="〇〇スクールも検討中..." className="mt-1" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">商談評価</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>反論・懸念事項</Label>
            <textarea
              {...register("objections")}
              className="mt-1 flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="価格が高い、家族と相談したい、など"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>クロージング評価（1-10）</Label>
              <Input
                {...register("closingScore")}
                type="number"
                min={1}
                max={10}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">10: 完璧なクロージング</p>
              {errors.closingScore && <p className="text-xs text-red-500">{errors.closingScore.message}</p>}
            </div>
            <div>
              <Label>自己評価（1-5）</Label>
              <Input
                {...register("selfScore")}
                type="number"
                min={1}
                max={5}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">5: 非常に良い商談</p>
              {errors.selfScore && <p className="text-xs text-red-500">{errors.selfScore.message}</p>}
            </div>
          </div>
          <div>
            <Label>次のアクション</Label>
            <textarea
              {...register("nextAction")}
              className="mt-1 flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="3日後にフォローアップの電話をする..."
            />
          </div>
        </CardContent>
      </Card>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "送信中..." : "フィードバックを送信"}
      </Button>
    </form>
  );
}
