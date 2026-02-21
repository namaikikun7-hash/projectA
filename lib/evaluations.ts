/**
 * 営業マン評価ロジック
 *
 * スコアリング方針（100点満点）:
 *   成約率          40点 (目標比)
 *   商談数達成率    20点 (目標比)
 *   フィードバック提出率  20点
 *   平均クロージングスコア 10点 (1-10 → 正規化)
 *   無断キャンセル率     10点 (少ないほど高得点)
 *
 * グレード: S(90+) / A(75-89) / B(60-74) / C(45-59) / D(<45)
 */

import { prisma } from "@/lib/prisma";
import { MeetingResult, MeetingStatus } from "@prisma/client";

export interface EvaluationInput {
  staffId: string;
  period: string; // "2024-01"
}

export interface EvaluationResult {
  totalMeetings: number;
  completedMeetings: number;
  contracts: number;
  lost: number;
  followUps: number;
  noShows: number;
  totalContractAmount: number;
  conversionRate: number;
  feedbackSubmitRate: number;
  avgClosingScore: number;
  avgSelfScore: number;
  noShowRate: number;
  totalScore: number;
  grade: string;
}

export async function calculateEvaluation(
  staffId: string,
  period: string
): Promise<EvaluationResult> {
  const [year, month] = period.split("-").map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59);

  // 対象期間の商談を取得
  const meetings = await prisma.meeting.findMany({
    where: {
      staffId,
      scheduledAt: { gte: start, lte: end },
    },
    include: { feedback: true },
  });

  const totalMeetings = meetings.length;
  const completedMeetings = meetings.filter(
    (m) => m.status === MeetingStatus.COMPLETED
  ).length;
  const contracts = meetings.filter(
    (m) => m.result === MeetingResult.CONTRACTED
  ).length;
  const lost = meetings.filter(
    (m) => m.result === MeetingResult.LOST
  ).length;
  const followUps = meetings.filter(
    (m) => m.result === MeetingResult.FOLLOW_UP
  ).length;
  const noShows = meetings.filter(
    (m) =>
      m.status === MeetingStatus.NO_SHOW || m.result === MeetingResult.NO_SHOW
  ).length;

  const totalContractAmount = meetings
    .filter((m) => m.result === MeetingResult.CONTRACTED)
    .reduce((sum, m) => sum + (m.contractAmount ?? 0), 0);

  // 成約率（完了した商談のうち成約）
  const conversionRate =
    completedMeetings > 0 ? (contracts / completedMeetings) * 100 : 0;

  // フィードバック提出率
  const feedbackSubmitted = meetings.filter(
    (m) => m.status === MeetingStatus.COMPLETED && m.feedback != null
  ).length;
  const feedbackSubmitRate =
    completedMeetings > 0 ? (feedbackSubmitted / completedMeetings) * 100 : 0;

  // 平均スコア
  const feedbacks = meetings.map((m) => m.feedback).filter(Boolean);
  const avgClosingScore =
    feedbacks.length > 0
      ? feedbacks.reduce((sum, f) => sum + (f?.closingScore ?? 0), 0) / feedbacks.length
      : 0;
  const avgSelfScore =
    feedbacks.length > 0
      ? feedbacks.reduce((sum, f) => sum + (f?.selfScore ?? 0), 0) / feedbacks.length
      : 0;

  // 無断キャンセル率
  const noShowRate = totalMeetings > 0 ? (noShows / totalMeetings) * 100 : 0;

  // KPI目標を取得
  const kpi = await prisma.kpiTarget.findFirst({
    where: { staffId, period },
  });
  const globalKpi = await prisma.kpiTarget.findFirst({
    where: { staffId: null, period },
  });
  const targetConversionRate =
    kpi?.targetConversionRate ?? globalKpi?.targetConversionRate ?? 50;
  const targetMeetings =
    kpi?.targetMeetings ?? globalKpi?.targetMeetings ?? 20;

  // =========================================
  // スコア計算
  // =========================================

  // 成約率スコア（40点）: 目標の成約率に対する達成率（上限100%）
  const conversionScore =
    Math.min(conversionRate / targetConversionRate, 1) * 40;

  // 商談数スコア（20点）: 目標商談数に対する達成率（上限100%）
  const meetingScore = Math.min(totalMeetings / targetMeetings, 1) * 20;

  // フィードバック提出率スコア（20点）
  const feedbackScore = (feedbackSubmitRate / 100) * 20;

  // 平均クロージングスコア（10点）: 1-10 → 0-10点
  const closingScorePoints = (avgClosingScore / 10) * 10;

  // 無断キャンセルペナルティ（10点）: 少ないほど高得点
  const noShowPenalty = Math.max(0, 10 - noShowRate * 0.5);

  const totalScore =
    conversionScore +
    meetingScore +
    feedbackScore +
    closingScorePoints +
    noShowPenalty;

  const grade = getGrade(totalScore);

  return {
    totalMeetings,
    completedMeetings,
    contracts,
    lost,
    followUps,
    noShows,
    totalContractAmount,
    conversionRate: Math.round(conversionRate * 10) / 10,
    feedbackSubmitRate: Math.round(feedbackSubmitRate * 10) / 10,
    avgClosingScore: Math.round(avgClosingScore * 10) / 10,
    avgSelfScore: Math.round(avgSelfScore * 10) / 10,
    noShowRate: Math.round(noShowRate * 10) / 10,
    totalScore: Math.round(totalScore * 10) / 10,
    grade,
  };
}

function getGrade(score: number): string {
  if (score >= 90) return "S";
  if (score >= 75) return "A";
  if (score >= 60) return "B";
  if (score >= 45) return "C";
  return "D";
}

/** 指定月の全スタッフ評価を一括計算・保存 */
export async function recalculateAllEvaluations(period: string): Promise<void> {
  const staff = await prisma.user.findMany({
    where: { isActive: true, role: { in: ["STAFF", "MANAGER"] } },
    select: { id: true },
  });

  for (const s of staff) {
    const result = await calculateEvaluation(s.id, period);
    await prisma.evaluation.upsert({
      where: { staffId_period: { staffId: s.id, period } },
      update: result,
      create: { staffId: s.id, period, ...result },
    });
  }
}

/** 現在の月を "YYYY-MM" 形式で返す */
export function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
