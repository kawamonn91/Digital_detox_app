/**
 * nativeModules.ts
 * Android ネイティブモジュール(ScrollTracker / UsageStats)の型付きラッパー。
 * iOS やテスト環境などモジュールが無い場合は、未許可・データなしとして振る舞う。
 */

import { NativeEventEmitter, NativeModules, Platform } from 'react-native';

export interface ScrollLogEntry {
  date: string;
  packageName: string;
  appName: string;
  px: number;
}

export interface ScrollLog {
  /** 画面の高さ(px)。スクロール計測がまだ一度も動いていなければ null */
  screenHeightPx: number | null;
  entries: ScrollLogEntry[];
}

export interface AppUsage {
  date: string;
  packageName: string;
  appName: string;
  totalTimeMs: number;
}

export interface DailyUsage {
  /** 対象アプリ(SNS・動画)ごとの使用時間 */
  apps: AppUsage[];
  /** 全アプリ合計のスクリーンタイム(ホーム画面にいた時間を除く) */
  screenTime: Array<{ date: string; totalTimeMs: number }>;
}

const { ScrollTracker, UsageStats } = NativeModules;
const available = Platform.OS === 'android';

export const scrollTracker = {
  async isEnabled(): Promise<boolean> {
    if (!available || !ScrollTracker) return false;
    return !!(await ScrollTracker.isAccessibilityEnabled());
  },
  async openSettings(): Promise<void> {
    await ScrollTracker?.openAccessibilitySettings();
  },
  async getLog(): Promise<ScrollLog> {
    if (!available || !ScrollTracker) return { screenHeightPx: null, entries: [] };
    return ScrollTracker.getScrollLog();
  },
  async clear(): Promise<void> {
    await ScrollTracker?.clearScrollLog();
  },
  /** スクロールが記録されたとき(アプリ起動中のみ・1.5秒に1回まで)に呼ばれる */
  onUpdate(listener: () => void): { remove: () => void } {
    if (!available || !ScrollTracker) return { remove: () => {} };
    return new NativeEventEmitter(ScrollTracker).addListener('ScrollTrackerUpdate', listener);
  },
};

export const usageStats = {
  async hasPermission(): Promise<boolean> {
    if (!available || !UsageStats) return false;
    return !!(await UsageStats.hasUsagePermission());
  },
  async openSettings(): Promise<void> {
    await UsageStats?.openUsageAccessSettings();
  },
  /** 直近 [days] 日分の日別の使用時間。許可がなければ null */
  async getDailyUsage(days: number): Promise<DailyUsage | null> {
    if (!(await this.hasPermission())) return null;
    try {
      return await UsageStats.getDailyUsage(days);
    } catch {
      return null;
    }
  },
};

const { DailySummary } = NativeModules;

export const dailySummary = {
  /** まとめ通知の時刻・有効/無効・換算比率をネイティブ側に渡し、次の通知を予約し直す */
  async configure(hour: number, minute: number, enabled: boolean, metersPerScreen: number): Promise<void> {
    if (!available || !DailySummary) return;
    await DailySummary.configure(hour, minute, enabled, metersPerScreen);
  },
  async showNow(): Promise<void> {
    await DailySummary?.showNow();
  },
};
