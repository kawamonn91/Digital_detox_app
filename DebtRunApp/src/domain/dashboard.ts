/**
 * dashboard.ts
 * 保存済みの記録(スクロール・ランニング・使用時間)から、画面に出す数字をまとめて計算する。
 */

import { buildDebtLedger, carriedOverDebt, currentDebt, DayActivity, mergeDailyActivity } from './debt';
import { appScreensOn, dailyScreens, ScrollPx } from './scroll';
import { runStreak, WeekBar, weekSeries } from './stats';

export interface UsageEntry {
  date: string;
  packageName: string;
  appName: string;
  totalTimeMs: number;
}

export interface AppRow {
  appName: string;
  packageName: string;
  screens: number;
  meters: number;
  /** 今日の使用時間(ms)。使用状況へのアクセスが未許可なら null */
  timeMs: number | null;
}

export interface Dashboard {
  days: DayActivity[];
  todayScreens: number;
  todayScrollMeters: number;
  todayRunMeters: number;
  /** 現在の残債(前日からの繰り越し込み) */
  debtMeters: number;
  carriedOverMeters: number;
  /** 今日のスクロールに対する今日のランニングの割合(0〜1) */
  todayRepayRatio: number;
  streak: number;
  week: WeekBar[];
  apps: AppRow[];
  /** 今日のスクリーンタイム(全アプリ合計、ms)。未許可なら null */
  screenTimeTodayMs: number | null;
  /** 今日の対象アプリ(SNS・動画)の使用時間合計(ms)。未許可なら null */
  snsTimeTodayMs: number | null;
}

export function buildDashboard(params: {
  scrollEntries: ScrollPx[];
  screenHeightPx: number | null;
  runTotals: Array<{ date: string; meters: number }>;
  usage: UsageEntry[] | null;
  /** 日別のスクリーンタイム(全アプリ合計)。未許可なら null */
  screenTime: Array<{ date: string; totalTimeMs: number }> | null;
  metersPerScreen: number;
  today: string;
}): Dashboard {
  const { scrollEntries, screenHeightPx, runTotals, usage, screenTime, metersPerScreen, today } = params;
  const days = mergeDailyActivity(dailyScreens(scrollEntries, screenHeightPx), runTotals);
  const ledger = buildDebtLedger(days, metersPerScreen);
  const todayDay = days.find(d => d.date === today);
  const todayScreens = todayDay?.screens ?? 0;
  const todayScrollMeters = todayScreens * metersPerScreen;
  const todayRunMeters = todayDay?.runMeters ?? 0;

  const todayUsage = usage?.filter(u => u.date === today) ?? null;
  const timeByName = new Map<string, number>();
  todayUsage?.forEach(u => timeByName.set(u.appName, (timeByName.get(u.appName) ?? 0) + u.totalTimeMs));

  // スクロールした(または使った)アプリの一覧。スクロールしていなくても使用時間があれば出す
  const rows = new Map<string, AppRow>();
  appScreensOn(scrollEntries, screenHeightPx, today).forEach(a => {
    rows.set(a.appName, { ...a, meters: a.screens * metersPerScreen, timeMs: todayUsage ? timeByName.get(a.appName) ?? 0 : null });
  });
  todayUsage?.forEach(u => {
    if (!rows.has(u.appName)) {
      rows.set(u.appName, { appName: u.appName, packageName: u.packageName, screens: 0, meters: 0, timeMs: timeByName.get(u.appName) ?? 0 });
    }
  });
  const apps = [...rows.values()].sort((a, b) => b.screens - a.screens || (b.timeMs ?? 0) - (a.timeMs ?? 0));

  return {
    days,
    todayScreens,
    todayScrollMeters,
    todayRunMeters,
    debtMeters: currentDebt(ledger),
    carriedOverMeters: carriedOverDebt(ledger, today),
    todayRepayRatio: todayScrollMeters > 0 ? Math.min(1, todayRunMeters / todayScrollMeters) : todayRunMeters > 0 ? 1 : 0,
    streak: runStreak(runTotals.filter(r => r.meters > 0).map(r => r.date), today),
    week: weekSeries(days, metersPerScreen, today),
    apps,
    screenTimeTodayMs: screenTime ? screenTime.find(d => d.date === today)?.totalTimeMs ?? 0 : null,
    snsTimeTodayMs: todayUsage ? todayUsage.reduce((sum, u) => sum + u.totalTimeMs, 0) : null,
  };
}

/** 1日平均のスクリーンタイム(分)。未許可・記録なしなら null */
export function avgScreenTimeMinutes(screenTime: Array<{ date: string; totalTimeMs: number }> | null): number | null {
  if (!screenTime || screenTime.length === 0) return null;
  return screenTime.reduce((sum, d) => sum + d.totalTimeMs, 0) / screenTime.length / 60000;
}

/** 直近の使用時間から、最も長く使ったアプリと1日平均の使用時間(分) */
export function topApp(usage: UsageEntry[] | null, days: number): { appName: string; avgMinutes: number } | null {
  if (!usage || usage.length === 0) return null;
  const byName = new Map<string, number>();
  usage.forEach(u => byName.set(u.appName, (byName.get(u.appName) ?? 0) + u.totalTimeMs));
  const [appName, total] = [...byName.entries()].sort((a, b) => b[1] - a[1])[0];
  return { appName, avgMinutes: total / days / 60000 };
}
