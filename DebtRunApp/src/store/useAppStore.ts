/**
 * useAppStore.ts
 * Zustand グローバル状態管理。
 * 保存済みの記録を読み込み、画面に出す数字は domain/dashboard.ts でまとめて計算する。
 */

import { create } from 'zustand';
import { localDateKey } from '../domain/dates';
import { buildDashboard, Dashboard, UsageEntry } from '../domain/dashboard';
import { scrollTracker, usageStats } from '../services/nativeModules';
import {
  AppSettings,
  DEFAULT_SETTINGS,
  getDailyRunTotals,
  loadSettings,
  saveSettings,
} from '../services/storageService';
import { ScrollPx } from '../domain/scroll';

/** AI提案に渡す使用時間の期間(日) */
export const USAGE_DAYS = 7;

interface Permissions {
  scrollTracking: boolean;
  usageAccess: boolean;
}

interface RawData {
  scrollEntries: ScrollPx[];
  screenHeightPx: number | null;
  runTotals: Array<{ date: string; meters: number }>;
  usage: UsageEntry[] | null;
  screenTime: Array<{ date: string; totalTimeMs: number }> | null;
}

interface AppState {
  settings: AppSettings;
  setSettings: (s: Partial<AppSettings>) => Promise<void>;

  dashboard: Dashboard;
  /** 直近の対象アプリの使用時間(AI提案用)。未許可なら null */
  usage: UsageEntry[] | null;
  /** 直近の日別スクリーンタイム(全アプリ合計、AI提案用)。未許可なら null */
  screenTime: Array<{ date: string; totalTimeMs: number }> | null;
  permissions: Permissions;

  isRunning: boolean;
  setIsRunning: (v: boolean) => void;

  /** 一日のまとめ画面を表示中か */
  summaryVisible: boolean;
  openSummary: () => void;
  closeSummary: () => void;

  isLoading: boolean;
  /** 保存済みの記録をすべて読み直す */
  refreshData: () => Promise<void>;
}

const EMPTY_RAW: RawData = { scrollEntries: [], screenHeightPx: null, runTotals: [], usage: null, screenTime: null };
let raw: RawData = EMPTY_RAW;

function compute(settings: AppSettings): Dashboard {
  return buildDashboard({ ...raw, metersPerScreen: settings.metersPerScreen, today: localDateKey() });
}

export const useAppStore = create<AppState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  dashboard: buildDashboard({ ...EMPTY_RAW, metersPerScreen: DEFAULT_SETTINGS.metersPerScreen, today: localDateKey() }),
  usage: null,
  screenTime: null,
  permissions: { scrollTracking: false, usageAccess: false },
  isRunning: false,
  isLoading: false,
  summaryVisible: false,

  setIsRunning: v => set({ isRunning: v }),
  openSummary: () => set({ summaryVisible: true }),
  closeSummary: () => set({ summaryVisible: false }),

  setSettings: async partial => {
    const settings = await saveSettings(partial);
    // 換算比率を変えると過去分も新しい比率で計算し直す
    set({ settings, dashboard: compute(settings) });
  },

  refreshData: async () => {
    set({ isLoading: true });
    try {
      const [settings, scrollLog, runTotals, usage, scrollTracking, usageAccess] = await Promise.all([
        loadSettings(),
        scrollTracker.getLog().catch(() => ({ screenHeightPx: null, entries: [] })),
        getDailyRunTotals(),
        usageStats.getDailyUsage(USAGE_DAYS),
        scrollTracker.isEnabled().catch(() => false),
        usageStats.hasPermission().catch(() => false),
      ]);
      raw = {
        scrollEntries: scrollLog.entries,
        screenHeightPx: scrollLog.screenHeightPx,
        runTotals,
        usage: usage?.apps ?? null,
        screenTime: usage?.screenTime ?? null,
      };
      set({
        settings,
        usage: raw.usage,
        screenTime: raw.screenTime,
        permissions: { scrollTracking, usageAccess },
        dashboard: compute(settings),
        isLoading: false,
      });
    } catch (e) {
      console.error('[Store] refreshData error:', e);
      set({ isLoading: false, dashboard: compute(get().settings) });
    }
  },
}));
