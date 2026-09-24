/**
 * stats.ts
 * 連続ランニング日数・週間グラフ・換算比率のおすすめなどの集計。
 */

import { addDays, lastNDates, weekdayLabel } from './dates';
import { DayActivity } from './debt';

/**
 * 連続ランニング日数。今日走っていれば今日から、まだ走っていなければ昨日から遡って数える
 * (今日の途中で連続記録が0に見えないように)。
 */
export function runStreak(runDates: Iterable<string>, today: string): number {
  const dates = new Set(runDates);
  let day = dates.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (dates.has(day)) {
    streak++;
    day = addDays(day, -1);
  }
  return streak;
}

export interface WeekBar {
  date: string;
  /** 曜日(日〜土) */
  label: string;
  scrollMeters: number;
  runMeters: number;
}

/**
 * 週間グラフ用に、今日までの直近7日分を日付順に並べる。記録のない日も0で埋める
 * (日付でそろえるので、スクロールとランニングの棒が別の日にずれない)。
 */
export function weekSeries(days: DayActivity[], metersPerScreen: number, today: string, n = 7): WeekBar[] {
  const byDate = new Map(days.map(d => [d.date, d]));
  return lastNDates(n, today).map(date => {
    const d = byDate.get(date);
    return {
      date,
      label: weekdayLabel(date),
      scrollMeters: (d?.screens ?? 0) * metersPerScreen,
      runMeters: d?.runMeters ?? 0,
    };
  });
}

export interface RatioRecommendation {
  /** おすすめの換算比率(m/画面) */
  metersPerScreen: number;
  /** おすすめの目安となる1日の返済目標(m) */
  targetDailyMeters: number;
  reason: string;
}

/** 走ったことがない人の最初の1日の目標(m)。ウォーキング混じりでも届く距離 */
const BEGINNER_TARGET_METERS = 1500;

/**
 * データから換算比率(m/画面)のおすすめを計算する(Gemini を使わない場合の「AI提案」の中身、
 * および Gemini に渡す基準値)。
 *
 * 考え方: 1日のスクロール負債が「頑張れば返せる距離」になるように比率を決める。
 * 返済目標 = 普段のランニング距離の1.2倍(少しだけ背伸び)。ほとんど走っていなければ1.5km。
 * 比率 = 返済目標 ÷ 1日の平均スクロール画面数(0.1〜10m、0.1刻み)。
 * スクロールの記録がほとんどない場合は判断できないので null。
 */
export function recommendRatio(avgDailyScreens: number, avgDailyRunMeters: number): RatioRecommendation | null {
  if (avgDailyScreens < 10) return null;
  const target = Math.min(10_000, Math.max(avgDailyRunMeters * 1.2, BEGINNER_TARGET_METERS));
  const ratio = Math.min(10, Math.max(0.1, Math.round((target / avgDailyScreens) * 10) / 10));
  const targetRounded = Math.round(target / 100) * 100;
  const reason = avgDailyRunMeters < BEGINNER_TARGET_METERS / 1.2
    ? `1日平均${Math.round(avgDailyScreens)}画面のスクロールを、まずは1日${(targetRounded / 1000).toFixed(1)}kmで返せる比率です。`
    : `普段のランニング(1日平均${(avgDailyRunMeters / 1000).toFixed(1)}km)より少しだけ多い、1日${(targetRounded / 1000).toFixed(1)}kmで返せる比率です。`;
  return { metersPerScreen: ratio, targetDailyMeters: targetRounded, reason };
}

/** 直近 [n] 日(今日を含む)の1日平均。記録のない日も0として数える。 */
export function dailyAverages(days: DayActivity[], today: string, n = 7): { screens: number; runMeters: number } {
  const dates = new Set(lastNDates(n, today));
  const recent = days.filter(d => dates.has(d.date));
  return {
    screens: recent.reduce((s, d) => s + d.screens, 0) / n,
    runMeters: recent.reduce((s, d) => s + d.runMeters, 0) / n,
  };
}
