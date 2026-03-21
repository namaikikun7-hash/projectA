"use client";

import { useState } from "react";
import { Search, RefreshCw, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ResearchButtonProps {
  onComplete?: () => void;
}

export function ResearchButton({ onComplete }: ResearchButtonProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function runResearch(type: "full" | "amazon" | "evaluate") {
    setLoading(type);
    setResult(null);

    try {
      const token = sessionStorage.getItem("sourcing-token") || "";
      const res = await fetch("/api/sourcing/research", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-sourcing-token": token },
        body: JSON.stringify({ type }),
      });

      const data = await res.json();

      if (res.ok) {
        setResult(data.message);
        onComplete?.();
      } else {
        setResult(`エラー: ${data.error}`);
      }
    } catch {
      setResult("通信エラーが発生しました");
    } finally {
      setLoading(null);
    }
  }

  const buttons = [
    {
      type: "full" as const,
      label: "フルリサーチ",
      description: "全ソースから商品を検索",
      icon: Search,
      color: "bg-primary text-white hover:bg-primary/90",
    },
    {
      type: "amazon" as const,
      label: "Amazon更新",
      description: "価格・在庫を更新",
      icon: RefreshCw,
      color: "bg-orange-500 text-white hover:bg-orange-600",
    },
    {
      type: "evaluate" as const,
      label: "仕入れ判定",
      description: "利益を自動計算",
      icon: BarChart3,
      color: "bg-green-600 text-white hover:bg-green-700",
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {buttons.map((btn) => (
          <button
            key={btn.type}
            onClick={() => runResearch(btn.type)}
            disabled={loading !== null}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50",
              btn.color
            )}
          >
            <btn.icon
              className={cn("h-4 w-4", loading === btn.type && "animate-spin")}
            />
            {btn.label}
          </button>
        ))}
      </div>
      {result && (
        <p className="text-sm text-muted-foreground">{result}</p>
      )}
    </div>
  );
}
