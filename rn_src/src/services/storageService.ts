/**
 * storageService.ts
 * SQLite + AsyncStorage によるデータ永続化レイヤー
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import SQLite, { SQLiteDatabase } from 'react-native-sqlite-storage';

SQLite.enablePromise(true);

let db: SQLiteDatabase | null = null;

// ── DB 初期化 ──────────────────────────────────────────────────

export async function initDB(): Promise<void> {
  db = await SQLite.openDatabase({ name: 'debtrun.db', location: 'default' });

  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS scroll_records (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      date        TEXT    NOT NULL,
      package_name TEXT   NOT NULL,
      app_name    TEXT    NOT NULL,
      total_px    REAL    DEFAULT 0,
      screens     REAL    DEFAULT 0,
      meters      REAL    DEFAULT 0,
      source      TEXT    DEFAULT 'auto',  -- 'auto'|'manual'
      created_at  INTEGER NOT NULL
    );
  `);

  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS run_records (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      date        TEXT    NOT NULL,
      meters      REAL    NOT NULL,
      duration_s  INTEGER NOT NULL,
      pace_min_km REAL    DEFAULT 0,
      calories    REAL    DEFAULT 0,
      sim_mode    INTEGER DEFAULT 0,
      created_at  INTEGER NOT NULL
    );
  `);

  await db.executeSql(`
    CREATE INDEX IF NOT EXISTS idx_scroll_date ON scroll_records(date);
    CREATE INDEX IF NOT EXISTS idx_run_date ON run_records(date);
  `);
}

// ── スクロール記録 ──────────────────────────────────────────────

export interface ScrollRecord {
  packageName: string;
  appName: string;
  totalPx: number;
  screens: number;
  meters: number;
  source?: 'auto' | 'manual';
}

export async function saveScrollRecord(record: ScrollRecord): Promise<void> {
  if (!db) await initDB();
  const today = getTodayKey();
  await db!.executeSql(
    `INSERT INTO scroll_records (date, package_name, app_name, total_px, screens, meters, source, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [today, record.packageName, record.appName, record.totalPx,
     record.screens, record.meters, record.source || 'auto', Date.now()]
  );
}

export async function getTodayScrollRecords(): Promise<ScrollRecord[]> {
  if (!db) await initDB();
  const [result] = await db!.executeSql(
    `SELECT package_name, app_name, SUM(total_px) as total_px, SUM(screens) as screens, SUM(meters) as meters
     FROM scroll_records WHERE date = ? GROUP BY package_name ORDER BY screens DESC`,
    [getTodayKey()]
  );
  const records: ScrollRecord[] = [];
  for (let i = 0; i < result.rows.length; i++) {
    const row = result.rows.item(i);
    records.push({
      packageName: row.package_name,
      appName: row.app_name,
      totalPx: row.total_px,
      screens: row.screens,
      meters: row.meters,
    });
  }
  return records;
}

export async function getDailyScrollTotals(days: number): Promise<Array<{date: string; screens: number; meters: number}>> {
  if (!db) await initDB();
  const [result] = await db!.executeSql(
    `SELECT date, SUM(screens) as screens, SUM(meters) as meters
     FROM scroll_records
     GROUP BY date
     ORDER BY date DESC
     LIMIT ?`,
    [days]
  );
  const rows: Array<{date: string; screens: number; meters: number}> = [];
  for (let i = 0; i < result.rows.length; i++) {
    rows.push(result.rows.item(i));
  }
  return rows.reverse();
}

// ── ランニング記録 ──────────────────────────────────────────────

export interface RunRecord {
  meters: number;
  durationS: number;
  paceMinKm?: number;
  calories?: number;
  simMode?: boolean;
}

export async function saveRunRecord(record: RunRecord): Promise<void> {
  if (!db) await initDB();
  const today = getTodayKey();
  await db!.executeSql(
    `INSERT INTO run_records (date, meters, duration_s, pace_min_km, calories, sim_mode, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [today, record.meters, record.durationS, record.paceMinKm || 0,
     record.calories || 0, record.simMode ? 1 : 0, Date.now()]
  );
}

export async function getTodayRunTotal(): Promise<number> {
  if (!db) await initDB();
  const [result] = await db!.executeSql(
    `SELECT SUM(meters) as total FROM run_records WHERE date = ?`,
    [getTodayKey()]
  );
  return result.rows.item(0)?.total || 0;
}

export async function getDailyRunTotals(days: number): Promise<Array<{date: string; meters: number}>> {
  if (!db) await initDB();
  const [result] = await db!.executeSql(
    `SELECT date, SUM(meters) as meters FROM run_records GROUP BY date ORDER BY date DESC LIMIT ?`,
    [days]
  );
  const rows: Array<{date: string; meters: number}> = [];
  for (let i = 0; i < result.rows.length; i++) rows.push(result.rows.item(i));
  return rows.reverse();
}

export async function getRunStreak(): Promise<number> {
  if (!db) await initDB();
  const [result] = await db!.executeSql(
    `SELECT DISTINCT date FROM run_records WHERE meters > 0 ORDER BY date DESC LIMIT 30`
  );
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < result.rows.length; i++) {
    const d = new Date(result.rows.item(i).date);
    const expected = new Date(today);
    expected.setDate(today.getDate() - i);
    if (d.toISOString().slice(0, 10) === expected.toISOString().slice(0, 10)) {
      streak++;
    } else break;
  }
  return streak;
}

// ── 設定 ──────────────────────────────────────────────────────

export interface AppSettings {
  metersPerScreen: number;
  summaryHour: number;
  summaryMinute: number;
  notificationsEnabled: boolean;
  geminiApiKey: string;
  weightKg: number;  // カロリー計算用
}

const DEFAULT_SETTINGS: AppSettings = {
  metersPerScreen: 1.0,
  summaryHour: 21,
  summaryMinute: 0,
  notificationsEnabled: true,
  geminiApiKey: '',
  weightKg: 60,
};

export async function loadSettings(): Promise<AppSettings> {
  const raw = await AsyncStorage.getItem('debtrun_settings');
  if (!raw) return { ...DEFAULT_SETTINGS };
  return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
}

export async function saveSettings(settings: Partial<AppSettings>): Promise<void> {
  const current = await loadSettings();
  await AsyncStorage.setItem('debtrun_settings', JSON.stringify({ ...current, ...settings }));
}

// ── ユーティリティ ──────────────────────────────────────────────

export function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
  return `${Math.round(meters)} m`;
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
