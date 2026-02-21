import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy } from "lucide-react";

interface StaffRankItem {
  staff: { id: string; name: string };
  conversionRate: number;
  contracts: number;
  totalScore: number;
  grade: string;
}

interface StaffRankingProps {
  data: StaffRankItem[];
}

const gradeColors: Record<string, "default" | "success" | "secondary" | "warning" | "destructive" | "outline"> = {
  S: "default",
  A: "success",
  B: "secondary",
  C: "warning",
  D: "destructive",
};

const medalColors = ["text-yellow-500", "text-gray-400", "text-amber-600"];

export function StaffRanking({ data }: StaffRankingProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="h-4 w-4" />
            今月のランキング
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            データがありません
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="h-4 w-4" />
          今月のランキング
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {data.map((item, index) => (
            <div key={item.staff.id} className="flex items-center gap-3">
              <span className={`text-lg font-bold w-6 text-center ${medalColors[index] ?? "text-muted-foreground"}`}>
                {index + 1}
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium">{item.staff.name}</p>
                <p className="text-xs text-muted-foreground">
                  成約率 {item.conversionRate.toFixed(1)}% / 成約 {item.contracts}件
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{item.totalScore.toFixed(0)}点</span>
                <Badge variant={gradeColors[item.grade] ?? "outline"}>{item.grade}</Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
