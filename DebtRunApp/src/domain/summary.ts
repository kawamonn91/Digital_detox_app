/**
 * summary.ts
 * 一日のまとめ(まとめ画面・通知)の文言。
 */

import { formatDistance, formatScreenTime } from './format';

export interface DailySummaryInput {
  screens: number;
  scrollMeters: number;
  runMeters: number;
  /** 今日の終わり時点(現時点)の残債(m) */
  debtMeters: number;
  /** 前日までから繰り越した残債(m) */
  carriedOverMeters: number;
  /** 今日のスクリーンタイム(全アプリ合計、ms)。取得できなければnull */
  screenTimeMs: number | null;
  /** 今日のSNS・動画アプリの使用時間(ms)。取得できなければnull */
  snsTimeMs: number | null;
  streak: number;
}

export interface DailySummary {
  title: string;
  headline: string;
  lines: string[];
}

export function buildDailySummary(s: DailySummaryInput): DailySummary {
  const lines = [
    `スクロール: ${Math.round(s.screens)}画面(${formatDistance(s.scrollMeters)})`,
    ...(s.screenTimeMs !== null
      ? [`スクリーンタイム: ${formatScreenTime(s.screenTimeMs)}` + (s.snsTimeMs !== null ? `(うちSNS・動画 ${formatScreenTime(s.snsTimeMs)})` : '')]
      : []),
    `ランニング: ${formatDistance(s.runMeters)}`,
    ...(s.carriedOverMeters > 0 ? [`前日からの繰り越し: ${formatDistance(s.carriedOverMeters)}`] : []),
    ...(s.streak > 0 ? [`連続ランニング: ${s.streak}日`] : []),
  ];

  let headline: string;
  if (s.debtMeters <= 0 && s.runMeters > 0) {
    headline = '負債を完済しました!この調子で続けましょう';
  } else if (s.debtMeters <= 0) {
    headline = '負債はありません。スクロールを控えめにできています';
  } else if (s.runMeters > 0) {
    headline = `今日は${formatDistance(s.runMeters)}返済。残り${formatDistance(s.debtMeters)}です`;
  } else {
    headline = `残債は${formatDistance(s.debtMeters)}。明日は少しだけ走ってみませんか`;
  }
  return { title: '今日のDebtRunまとめ', headline, lines };
}
