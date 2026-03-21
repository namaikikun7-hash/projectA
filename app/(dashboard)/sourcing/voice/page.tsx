"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, MicOff, Loader2, Check, AlertCircle, TrendingUp, ExternalLink, Zap } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";

interface Step {
  step: string;
  status: "running" | "done" | "error";
  detail?: string;
  timestamp: string;
}

interface Opportunity {
  productId: string;
  name: string;
  officialPrice: number;
  amazonPrice: number | null;
  estimatedProfit: number;
  profitMargin: number;
  recommendation: "STRONG_BUY" | "BUY";
  reason: string;
}

interface CommandResult {
  success: boolean;
  command: string;
  steps: Step[];
  summary?: {
    newProducts: number;
    updatedProducts: number;
    strongBuys: number;
    buys: number;
    notified: number;
    opportunities: Opportunity[];
  };
}

export default function VoiceCommandPage() {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [processing, setProcessing] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [result, setResult] = useState<CommandResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [speechSupported, setSpeechSupported] = useState(true);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [waveAmplitudes, setWaveAmplitudes] = useState<number[]>(
    Array(20).fill(0)
  );

  // 音声波形アニメーション
  useEffect(() => {
    if (!listening) {
      setWaveAmplitudes(Array(20).fill(0));
      return;
    }
    const interval = setInterval(() => {
      setWaveAmplitudes(
        Array(20)
          .fill(0)
          .map(() => Math.random() * 100)
      );
    }, 100);
    return () => clearInterval(interval);
  }, [listening]);

  // Web Speech API初期化
  useEffect(() => {
    const SpeechRecognition =
      typeof window !== "undefined"
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : null;

    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "ja-JP";
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let final = "";
      let interim = "";
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setTranscript(final || interim);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognition.onerror = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;
  }, []);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;
    setTranscript("");
    setSteps([]);
    setResult(null);
    setError(null);
    setListening(true);
    recognitionRef.current.start();
  }, []);

  const stopListeningAndExecute = useCallback(async () => {
    if (recognitionRef.current && listening) {
      recognitionRef.current.stop();
    }
    setListening(false);

    const command = transcript.trim();
    if (!command) return;

    setProcessing(true);
    setError(null);

    // ステップを段階的にアニメーション表示するためのポーリング
    try {
      const res = await fetch("/api/sourcing/voice-command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command }),
      });

      const data: CommandResult = await res.json();

      // ステップを1つずつアニメーション表示
      for (let i = 0; i < data.steps.length; i++) {
        await new Promise((resolve) => setTimeout(resolve, 400));
        setSteps((prev) => [...prev, data.steps[i]]);
      }

      setResult(data);

      if (!data.success) {
        setError("リサーチ中にエラーが発生しました");
      }
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setProcessing(false);
    }
  }, [listening, transcript]);

  // テキスト入力で実行（音声非対応時のフォールバック）
  async function handleTextSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!transcript.trim()) return;
    setListening(false);
    await stopListeningAndExecute();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* ヘッダー */}
      <div className="text-center">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-1 text-xs font-bold text-white">
          <Zap className="h-3 w-3" />
          VOICE SOURCING
        </div>
        <h1 className="text-3xl font-black">
          話しかけるだけで仕入れ商品を見つける
        </h1>
        <p className="mt-2 text-muted-foreground">
          音声コマンドでリサーチ→判定→通知を全自動実行
        </p>
      </div>

      {/* マイクボタン */}
      <div className="flex flex-col items-center gap-6">
        {/* 波形表示 */}
        <div className="flex h-16 items-end gap-[3px]">
          {waveAmplitudes.map((amp, i) => (
            <div
              key={i}
              className={cn(
                "w-2 rounded-full transition-all duration-100",
                listening
                  ? "bg-gradient-to-t from-purple-500 to-pink-400"
                  : "bg-gray-200"
              )}
              style={{ height: `${Math.max(4, listening ? amp * 0.6 : 4)}px` }}
            />
          ))}
        </div>

        {/* マイクボタン */}
        <button
          onClick={listening ? stopListeningAndExecute : startListening}
          disabled={processing || !speechSupported}
          className={cn(
            "relative flex h-24 w-24 items-center justify-center rounded-full text-white transition-all",
            listening
              ? "bg-red-500 shadow-[0_0_40px_rgba(239,68,68,0.5)] scale-110"
              : processing
              ? "bg-gray-400"
              : "bg-gradient-to-br from-purple-600 to-pink-500 shadow-lg hover:shadow-[0_0_30px_rgba(168,85,247,0.4)] hover:scale-105",
            "disabled:opacity-50"
          )}
        >
          {processing ? (
            <Loader2 className="h-10 w-10 animate-spin" />
          ) : listening ? (
            <MicOff className="h-10 w-10" />
          ) : (
            <Mic className="h-10 w-10" />
          )}
          {listening && (
            <span className="absolute inset-0 animate-ping rounded-full bg-red-400 opacity-20" />
          )}
        </button>

        <p className="text-sm text-muted-foreground">
          {!speechSupported
            ? "お使いのブラウザは音声入力に対応していません。テキストで入力してください。"
            : listening
            ? "話し終わったらボタンを押してください"
            : processing
            ? "リサーチ実行中..."
            : "ボタンを押して話しかけてください"}
        </p>

        {/* テキスト入力フォールバック */}
        <form onSubmit={handleTextSubmit} className="flex w-full max-w-md gap-2">
          <input
            type="text"
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder={
              listening ? "音声認識中..." : "テキストでも入力できます..."
            }
            className={cn(
              "flex-1 rounded-full border px-5 py-3 text-sm transition-all",
              listening && "border-red-300 bg-red-50",
              transcript && "border-purple-300"
            )}
          />
          <button
            type="submit"
            disabled={!transcript.trim() || processing || listening}
            className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-white disabled:opacity-50"
          >
            実行
          </button>
        </form>
      </div>

      {/* 実行ステップ表示 */}
      {steps.length > 0 && (
        <div className="rounded-2xl border bg-gray-950 p-6 text-white shadow-2xl">
          <div className="mb-4 flex items-center gap-2 text-xs text-gray-400">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            SOURCING ENGINE
          </div>
          <div className="space-y-3 font-mono text-sm">
            {steps.map((step, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-start gap-3 transition-all duration-500",
                  i === steps.length - 1 && step.status === "running"
                    ? "opacity-100"
                    : "opacity-90"
                )}
                style={{
                  animation: `fadeSlideIn 0.4s ease-out`,
                }}
              >
                <div className="mt-0.5 flex-shrink-0">
                  {step.status === "running" ? (
                    <Loader2 className="h-4 w-4 animate-spin text-yellow-400" />
                  ) : step.status === "done" ? (
                    <Check className="h-4 w-4 text-green-400" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-400" />
                  )}
                </div>
                <div>
                  <span
                    className={cn(
                      step.status === "running" && "text-yellow-300",
                      step.status === "done" && "text-green-300",
                      step.status === "error" && "text-red-300"
                    )}
                  >
                    {step.step}
                  </span>
                  {step.detail && (
                    <span className="ml-2 text-gray-500">
                      — {step.detail}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 結果カード */}
      {result?.success && result.summary && (
        <div className="space-y-4">
          {/* サマリー */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-blue-50 p-4 text-center">
              <p className="text-2xl font-black text-blue-600">
                {result.summary.newProducts}
              </p>
              <p className="text-xs text-blue-600/70">新規検出</p>
            </div>
            <div className="rounded-xl bg-purple-50 p-4 text-center">
              <p className="text-2xl font-black text-purple-600">
                {result.summary.updatedProducts}
              </p>
              <p className="text-xs text-purple-600/70">情報更新</p>
            </div>
            <div className="rounded-xl bg-red-50 p-4 text-center">
              <p className="text-2xl font-black text-red-600">
                {result.summary.strongBuys}
              </p>
              <p className="text-xs text-red-600/70">STRONG BUY</p>
            </div>
            <div className="rounded-xl bg-green-50 p-4 text-center">
              <p className="text-2xl font-black text-green-600">
                {result.summary.notified}
              </p>
              <p className="text-xs text-green-600/70">通知送信</p>
            </div>
          </div>

          {/* 推奨商品リスト */}
          {result.summary.opportunities.length > 0 && (
            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
                <TrendingUp className="h-5 w-5 text-green-600" />
                仕入れ推奨商品
              </h2>
              <div className="space-y-3">
                {result.summary.opportunities.map((opp, i) => (
                  <div
                    key={opp.productId}
                    className={cn(
                      "flex items-center justify-between rounded-xl border p-4",
                      opp.recommendation === "STRONG_BUY"
                        ? "border-red-200 bg-red-50"
                        : "border-green-200 bg-green-50"
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-bold text-white",
                            opp.recommendation === "STRONG_BUY"
                              ? "bg-red-500"
                              : "bg-green-500"
                          )}
                        >
                          {opp.recommendation === "STRONG_BUY"
                            ? "STRONG BUY"
                            : "BUY"}
                        </span>
                        <span className="text-xs text-gray-500">
                          #{i + 1}
                        </span>
                      </div>
                      <p className="mt-1 truncate font-medium">{opp.name}</p>
                      <p className="text-xs text-muted-foreground">
                        仕入値: {formatCurrency(opp.officialPrice)} → {opp.reason}
                      </p>
                    </div>
                    <div className="ml-4 text-right">
                      <p className="text-xl font-black text-green-600">
                        +{formatCurrency(opp.estimatedProfit)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        利益率 {opp.profitMargin}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-center text-xs text-muted-foreground">
                仕入れURLはChatwork/LINEに送信済みです
              </p>
            </div>
          )}
        </div>
      )}

      {/* エラー表示 */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center text-sm text-red-600">
          {error}
        </div>
      )}

      <style jsx>{`
        @keyframes fadeSlideIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
