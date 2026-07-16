/**
 * storage.js — LocalStorage データ管理レイヤー
 */

const KEYS = {
  SETTINGS: 'debtrun_settings',
  TODAY: 'debtrun_today',
  HISTORY: 'debtrun_history',
  RUNS: 'debtrun_runs',
};

const DEFAULT_SETTINGS = {
  metersPerScreen: 1,          // 1画面 = 1m (デフォルト)
  summaryTime: '21:00',         // 毎日まとめ通知時刻
  notificationsEnabled: true,
  appRates: {
    instagram: { label: 'Instagram', icon: '📸', screensPerMinute: 3 },
    twitter:   { label: 'X (Twitter)', icon: '𝕏', screensPerMinute: 4 },
    tiktok:    { label: 'TikTok', icon: '🎵', screensPerMinute: 1 },
    youtube:   { label: 'YouTube Shorts', icon: '▶️', screensPerMinute: 1 },
    facebook:  { label: 'Facebook', icon: '📘', screensPerMinute: 2.5 },
    other:     { label: 'その他', icon: '📱', screensPerMinute: 2 },
  },
};

/** 今日の日付文字列 */
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

/** 設定の読み込み */
function loadSettings() {
  const raw = localStorage.getItem(KEYS.SETTINGS);
  if (!raw) return structuredClone(DEFAULT_SETTINGS);
  try {
    const saved = JSON.parse(raw);
    // appRates はデフォルトとマージ（新しいアプリが追加された場合）
    return {
      ...DEFAULT_SETTINGS,
      ...saved,
      appRates: { ...DEFAULT_SETTINGS.appRates, ...(saved.appRates || {}) },
    };
  } catch {
    return structuredClone(DEFAULT_SETTINGS);
  }
}

/** 設定の保存 */
function saveSettings(settings) {
  localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
}

/** 今日のデータ構造 */
function defaultToday() {
  return {
    date: todayKey(),
    scrollDebtScreens: 0,    // 総スクロール画面数
    scrollDebtMeters: 0,     // 換算距離(m)
    runMeters: 0,            // ランニング距離(m)
    entries: [],             // [{ type:'debt'|'run', app, screens, meters, timestamp }]
  };
}

/** 今日のデータ読み込み */
function loadToday() {
  const key = todayKey();
  const raw = localStorage.getItem(KEYS.TODAY);
  if (!raw) return defaultToday();
  try {
    const data = JSON.parse(raw);
    if (data.date !== key) {
      // 日付が変わっていたら履歴に保存して新しいデータを返す
      archiveDay(data);
      return defaultToday();
    }
    return data;
  } catch {
    return defaultToday();
  }
}

/** 今日のデータ保存 */
function saveToday(data) {
  localStorage.setItem(KEYS.TODAY, JSON.stringify(data));
}

/** 日々の履歴アーカイブ */
function archiveDay(dayData) {
  const history = loadHistory();
  // 重複チェック
  const exists = history.find(h => h.date === dayData.date);
  if (!exists) {
    history.unshift(dayData);
    // 最大90日分
    if (history.length > 90) history.pop();
    localStorage.setItem(KEYS.HISTORY, JSON.stringify(history));
  }
}

/** 履歴の読み込み */
function loadHistory() {
  const raw = localStorage.getItem(KEYS.HISTORY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

/** ランニング履歴の読み込み */
function loadRuns() {
  const raw = localStorage.getItem(KEYS.RUNS);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

/** ランニング履歴への保存 */
function saveRun(runData) {
  const runs = loadRuns();
  runs.unshift(runData);
  if (runs.length > 100) runs.pop();
  localStorage.setItem(KEYS.RUNS, JSON.stringify(runs));
}

/** 過去7日分のデータを取得 */
function getLast7Days() {
  const history = loadHistory();
  const today = loadToday();
  const result = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (i === 0) {
      result.push({ ...today, dateObj: d });
    } else {
      const found = history.find(h => h.date === key);
      result.push(found
        ? { ...found, dateObj: d }
        : { ...defaultToday(), date: key, dateObj: d }
      );
    }
  }
  return result;
}

/** スクロール負債を追加 */
function addScrollDebt(appKey, minutes) {
  const settings = loadSettings();
  const appRate = settings.appRates[appKey];
  const screens = Math.round(appRate.screensPerMinute * minutes * 10) / 10;
  const meters  = Math.round(screens * settings.metersPerScreen * 10) / 10;

  const today = loadToday();
  today.scrollDebtScreens += screens;
  today.scrollDebtMeters  += meters;
  today.entries.push({
    type: 'debt',
    app: appKey,
    appLabel: appRate.label,
    appIcon: appRate.icon,
    minutes,
    screens,
    meters,
    timestamp: Date.now(),
  });
  saveToday(today);
  return { screens, meters };
}

/** ランニング距離を追加 */
function addRunMeters(meters, runEntry) {
  const today = loadToday();
  today.runMeters += meters;
  today.entries.push({
    type: 'run',
    meters,
    timestamp: Date.now(),
  });
  saveToday(today);
  if (runEntry) saveRun(runEntry);
}

/** 純負債（メートル） */
function getNetDebt(today) {
  return Math.max(0, today.scrollDebtMeters - today.runMeters);
}

/** ランニングストリーク（連続日数） */
function getRunStreak() {
  const runs = loadRuns();
  if (runs.length === 0) return 0;
  const today = loadToday();
  const runDates = new Set(runs.map(r => r.date));
  if (today.runMeters > 0) runDates.add(todayKey());

  let streak = 0;
  const d = new Date();
  while (true) {
    const key = d.toISOString().slice(0, 10);
    if (runDates.has(key)) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

export {
  loadSettings, saveSettings,
  loadToday, saveToday,
  loadHistory, archiveDay,
  loadRuns, saveRun,
  getLast7Days,
  addScrollDebt, addRunMeters,
  getNetDebt, getRunStreak,
  todayKey,
  DEFAULT_SETTINGS,
};
