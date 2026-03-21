"use client";

import { useState, useEffect, type ReactNode } from "react";
import { Lock } from "lucide-react";

interface SourcingGateProps {
  children: ReactNode;
}

/**
 * 仕入れ機能の専用パスワードゲート
 * sessionStorage にトークンを保存し、認証済みなら children を表示
 */
export function SourcingGate({ children }: SourcingGateProps) {
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 既存トークンの検証
  useEffect(() => {
    const token = sessionStorage.getItem("sourcing-token");
    if (token) {
      // トークンが有効か軽く確認
      fetch("/api/sourcing/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: token }),
      })
        .then((res) => {
          if (res.ok) {
            setAuthenticated(true);
          } else {
            sessionStorage.removeItem("sourcing-token");
          }
        })
        .catch(() => {
          // ネットワークエラー時はトークン信用
          setAuthenticated(true);
        })
        .finally(() => setChecking(false));
    } else {
      setChecking(false);
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/sourcing/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (res.ok) {
        sessionStorage.setItem("sourcing-token", data.token);
        setAuthenticated(true);
      } else {
        setError(data.error || "認証に失敗しました");
      }
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  }

  if (checking) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-sm text-muted-foreground">読み込み中...</div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="w-full max-w-sm rounded-2xl border bg-white p-8 shadow-lg">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
              <Lock className="h-6 w-6 text-gray-600" />
            </div>
            <h2 className="text-lg font-bold">仕入れ機能</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              専用パスワードを入力してください
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="パスワード"
              autoFocus
              className="w-full rounded-lg border px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
            <button
              type="submit"
              disabled={submitting || !password}
              className="w-full rounded-lg bg-primary py-3 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {submitting ? "認証中..." : "アクセス"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

/**
 * 認証済みfetch: x-sourcing-token ヘッダーを自動付与
 */
export async function sourcingFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = sessionStorage.getItem("sourcing-token") || "";
  const headers = new Headers(options.headers);
  headers.set("x-sourcing-token", token);

  const res = await fetch(url, { ...options, headers });

  // 403でパスワード要求された場合、トークンをクリア
  if (res.status === 403) {
    const data = await res.clone().json().catch(() => ({}));
    if (data.requirePassword) {
      sessionStorage.removeItem("sourcing-token");
      window.location.reload();
    }
  }

  return res;
}
