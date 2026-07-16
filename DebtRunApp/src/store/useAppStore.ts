/**
 * useAppStore.ts
 * Zustand グローバル状態管理
 */

import { create } from 'zustand';
import {
  loadSettings,
  saveSettings,
  getTodayScrollRecords,
  getTodayRunTotal,
  getDailyScrollTotals,
  getDailyRunTotals,
  getRunStreak,
  AppSettings,
  ScrollRecord,
} from '../services/storageService';

interface DailyTrend {
  date: string;
  screens: number;
  meters: number;
}

interface RunTrend {
  date: string;
  meters: number;
}

interface AppState {
  // ── 設定 ──
  settings: AppSettings;
  setSettings: (s: Partial<AppSettings>) => Promise<void>;

  // ── 今日のデータ ──
  todayScrollScreens: number;
  todayScrollMeters: number;
  todayScrollByApp: ScrollRecord[];
  todayRunMeters: number;
  runStreak: number;

  // トレンドデータ（7日）
  scrollTrend: DailyTrend[];
  runTrend: RunTrend[];

  // 純負債
  netDebtMeters: number;

  // ランニング中か
  isRunning: boolean;
  setIsRunning: (v: boolean) => void;

  // ローディング
  isLoading: boolean;

  // ── データ読み込み ──
  refreshData: () => Promise<void>;
  refreshTodayRun: () => Promise<void>;
  refreshScrollData: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  settings: {
    metersPerScreen: 1.0,
    summaryHour: 21,
    summaryMinute: 0,
    notificationsEnabled: true,
    geminiApiKey: '',
    weightKg: 60,
  },

  todayScrollScreens: 0,
  todayScrollMeters: 0,
  todayScrollByApp: [],
  todayRunMeters: 0,
  runStreak: 0,
  scrollTrend: [],
  runTrend: [],
  netDebtMeters: 0,
  isRunning: false,
  isLoading: false,

  setIsRunning: (v) => set({ isRunning: v }),

  setSettings: async (partial) => {
    const newSettings = { ...get().settings, ...partial };
    await saveSettings(partial);
    set({ settings: newSettings });
    // 換算比率が変わった場合はデータを再計算
    if (partial.metersPerScreen !== undefined) {
      get().refreshData();
    }
  },

  refreshData: async () => {
    set({ isLoading: true });
    try {
      const [settings, scrollRecords, runMeters, streak, scrollTrend, runTrend] =
        await Promise.all([
          loadSettings(),
          getTodayScrollRecords(),
          getTodayRunTotal(),
          getRunStreak(),
          getDailyScrollTotals(7),
          getDailyRunTotals(7),
        ]);

      const totalScreens = scrollRecords.reduce((s, r) => s + r.screens, 0);
      // 設定の換算比率で再計算
      const totalMeters = totalScreens * settings.metersPerScreen;
      const netDebt = Math.max(0, totalMeters - runMeters);

      set({
        settings,
        todayScrollScreens: totalScreens,
        todayScrollMeters: totalMeters,
        todayScrollByApp: scrollRecords,
        todayRunMeters: runMeters,
        runStreak: streak,
        scrollTrend,
        runTrend,
        netDebtMeters: netDebt,
        isLoading: false,
      });
    } catch (e) {
      console.error('[Store] refreshData error:', e);
      set({ isLoading: false });
    }
  },

  refreshTodayRun: async () => {
    const [runMeters, streak] = await Promise.all([
      getTodayRunTotal(),
      getRunStreak(),
    ]);
    const { todayScrollMeters } = get();
    set({
      todayRunMeters: runMeters,
      runStreak: streak,
      netDebtMeters: Math.max(0, todayScrollMeters - runMeters),
    });
  },

  refreshScrollData: async () => {
    const { settings } = get();
    const scrollRecords = await getTodayScrollRecords();
    const totalScreens = scrollRecords.reduce((s, r) => s + r.screens, 0);
    const totalMeters  = totalScreens * settings.metersPerScreen;
    const { todayRunMeters } = get();
    set({
      todayScrollScreens: totalScreens,
      todayScrollMeters: totalMeters,
      todayScrollByApp: scrollRecords,
      netDebtMeters: Math.max(0, totalMeters - todayRunMeters),
    });
  },
}));
